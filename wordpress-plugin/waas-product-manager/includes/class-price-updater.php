<?php
/**
 * WAAS Price Updater - Daily Price Sync
 *
 * Features:
 * - Updates prices on page visit (for single products)
 * - Only updates once per day (24-hour check)
 * - Syncs to Google Sheets with all price columns
 * - Runs via WordPress cron for batch updates
 * - v3: SP-API support (Login with Amazon → Selling Partner API)
 * - v3: Price source routing (PA-API → SP-API fallback)
 * - v3: Rate limiting (1 req/sec PA-API, 5 req/sec SP-API)
 * - v3: Returns summary from run_daily_update()
 *
 * @package WAAS_Product_Manager
 * @version 3.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class WAAS_Price_Updater {

    /**
     * Instance of this class
     */
    protected static $instance = null;

    /**
     * Rate limiting: timestamps of last requests
     * @var array
     */
    private $last_request_time = array(
        'pa_api' => 0,
        'sp_api' => 0,
    );

    /**
     * SP-API access token cache
     * @var string|null
     */
    private $sp_api_token = null;

    /**
     * SP-API token expiry
     * @var int
     */
    private $sp_api_token_expires = 0;

    /**
     * Get instance
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructor
     */
    private function __construct() {
        // Hook into WordPress cron (daily batch update)
        add_action('waas_pm_daily_update', array($this, 'run_daily_update'));

        // Hook into single product page view for on-demand updates
        add_action('woocommerce_before_single_product', array($this, 'maybe_update_product_price_on_view'));

        // Hook into product save (admin edit) to sync back to Google Sheets
        add_action('woocommerce_update_product', array($this, 'sync_product_to_sheets_on_save'), 20, 1);

        error_log('WAAS Price Updater: Initialized (v3 — PA-API + SP-API)');
    }

    // =========================================================================
    // PRICE SOURCE ROUTER (v3)
    // =========================================================================

    /**
     * Get configured price source
     *
     * @return string 'pa_api', 'sp_api', or 'auto' (default)
     */
    private function get_price_source() {
        return get_option('waas_pm_price_source', 'auto');
    }

    /**
     * Fetch price using configured source with fallback
     *
     * auto: PA-API first → SP-API fallback
     * pa_api: PA-API only
     * sp_api: SP-API only
     *
     * @param string $asin Product ASIN
     * @return array|WP_Error Price data array or error
     */
    private function fetch_price($asin) {
        $source = $this->get_price_source();

        switch ($source) {
            case 'pa_api':
                return $this->fetch_price_from_amazon($asin);

            case 'sp_api':
                return $this->fetch_price_from_sp_api($asin);

            case 'auto':
            default:
                // Try PA-API first
                $result = $this->fetch_price_from_amazon($asin);
                if (!is_wp_error($result) && !empty($result['price'])) {
                    $result['price_source'] = 'pa_api';
                    return $result;
                }

                // Fallback to SP-API
                error_log("WAAS Price Updater: PA-API failed for {$asin}, trying SP-API fallback");
                $result = $this->fetch_price_from_sp_api($asin);
                if (!is_wp_error($result) && !empty($result['price'])) {
                    $result['price_source'] = 'sp_api';
                    return $result;
                }

                // Both failed
                return new WP_Error('both_apis_failed', "Both PA-API and SP-API failed for ASIN: {$asin}");
        }
    }

    // =========================================================================
    // RATE LIMITING (v3)
    // =========================================================================

    /**
     * Enforce rate limit before API call
     *
     * PA-API: 1 request/second
     * SP-API: 5 requests/second (200ms between calls)
     *
     * @param string $api_type 'pa_api' or 'sp_api'
     */
    private function rate_limit($api_type) {
        $min_interval = ($api_type === 'pa_api') ? 1.0 : 0.2; // seconds

        $now = microtime(true);
        $elapsed = $now - $this->last_request_time[$api_type];

        if ($elapsed < $min_interval) {
            $sleep_us = (int) (($min_interval - $elapsed) * 1000000);
            usleep($sleep_us);
        }

        $this->last_request_time[$api_type] = microtime(true);
    }

    // =========================================================================
    // SP-API METHODS (v3)
    // =========================================================================

    /**
     * Check if SP-API credentials are configured
     *
     * @return bool
     */
    private function has_sp_api_credentials() {
        $client_id = get_option('waas_pm_sp_api_client_id', '');
        $client_secret = get_option('waas_pm_sp_api_client_secret', '');
        $refresh_token = get_option('waas_pm_sp_api_refresh_token', '');

        return !empty($client_id) && !empty($client_secret) && !empty($refresh_token);
    }

    /**
     * Get SP-API access token via Login with Amazon (LWA)
     *
     * Caches token until expiry.
     *
     * @return string|WP_Error Access token or error
     */
    private function get_sp_api_access_token() {
        // Return cached token if still valid (with 60s margin)
        if ($this->sp_api_token && time() < ($this->sp_api_token_expires - 60)) {
            return $this->sp_api_token;
        }

        // Also check transient cache (survives between cron runs)
        $cached = get_transient('waas_sp_api_token');
        if ($cached) {
            $this->sp_api_token = $cached['token'];
            $this->sp_api_token_expires = $cached['expires'];
            if (time() < ($this->sp_api_token_expires - 60)) {
                return $this->sp_api_token;
            }
        }

        $client_id = get_option('waas_pm_sp_api_client_id', '');
        $client_secret = get_option('waas_pm_sp_api_client_secret', '');
        $refresh_token = get_option('waas_pm_sp_api_refresh_token', '');

        if (empty($client_id) || empty($client_secret) || empty($refresh_token)) {
            return new WP_Error('sp_api_no_creds', 'SP-API credentials not configured');
        }

        $response = wp_remote_post('https://api.amazon.com/auth/o2/token', array(
            'headers' => array('Content-Type' => 'application/x-www-form-urlencoded'),
            'body' => array(
                'grant_type'    => 'refresh_token',
                'refresh_token' => $refresh_token,
                'client_id'     => $client_id,
                'client_secret' => $client_secret,
            ),
            'timeout' => 15,
        ));

        if (is_wp_error($response)) {
            error_log('WAAS Price Updater: LWA token request failed: ' . $response->get_error_message());
            return $response;
        }

        $status = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($status !== 200 || empty($body['access_token'])) {
            $error_msg = $body['error_description'] ?? $body['error'] ?? 'Unknown LWA error';
            error_log("WAAS Price Updater: LWA token error (HTTP {$status}): {$error_msg}");
            return new WP_Error('sp_api_token_error', $error_msg);
        }

        // Cache token
        $this->sp_api_token = $body['access_token'];
        $this->sp_api_token_expires = time() + (int) ($body['expires_in'] ?? 3600);

        set_transient('waas_sp_api_token', array(
            'token'   => $this->sp_api_token,
            'expires' => $this->sp_api_token_expires,
        ), $body['expires_in'] ?? 3600);

        error_log('WAAS Price Updater: SP-API access token obtained (expires in ' . ($body['expires_in'] ?? 3600) . 's)');

        return $this->sp_api_token;
    }

    /**
     * Fetch price from Amazon SP-API (Catalog Items API)
     *
     * @param string $asin Product ASIN
     * @return array|WP_Error Price data or error
     */
    private function fetch_price_from_sp_api($asin) {
        if (!$this->has_sp_api_credentials()) {
            return new WP_Error('sp_api_no_creds', 'SP-API credentials not configured');
        }

        $token = $this->get_sp_api_access_token();
        if (is_wp_error($token)) {
            return $token;
        }

        // Rate limit
        $this->rate_limit('sp_api');

        $marketplace_id = get_option('waas_pm_sp_api_marketplace_id', 'A1PA6795UKMFR9'); // Amazon.de default
        $endpoint = 'https://sellingpartnerapi-eu.amazon.com';

        // SP-API Catalog Items v2022-04-01
        $url = $endpoint . '/catalog/2022-04-01/items/' . urlencode($asin)
            . '?marketplaceIds=' . urlencode($marketplace_id)
            . '&includedData=summaries';

        $response = wp_remote_get($url, array(
            'headers' => array(
                'x-amz-access-token' => $token,
                'Content-Type'       => 'application/json',
            ),
            'timeout' => 15,
        ));

        if (is_wp_error($response)) {
            error_log('WAAS Price Updater: SP-API request failed: ' . $response->get_error_message());
            return $response;
        }

        $status = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($status !== 200) {
            $error_msg = $body['errors'][0]['message'] ?? "HTTP {$status}";
            error_log("WAAS Price Updater: SP-API error for {$asin}: {$error_msg}");
            return new WP_Error('sp_api_error', $error_msg);
        }

        // Extract price from SP-API response
        return $this->parse_sp_api_price($body, $asin);
    }

    /**
     * Parse SP-API catalog response to extract price data
     *
     * @param array  $body SP-API response body
     * @param string $asin ASIN for logging
     * @return array|WP_Error
     */
    private function parse_sp_api_price($body, $asin) {
        // SP-API Catalog Items returns summaries
        $summaries = $body['summaries'] ?? array();

        if (empty($summaries)) {
            return new WP_Error('sp_api_no_data', "No catalog data for ASIN: {$asin}");
        }

        // Get the first summary (main marketplace)
        $summary = $summaries[0];

        // SP-API may not always have price in catalog endpoint
        // Try buyingPrice from the summary
        $price = null;
        $currency = 'EUR';

        if (isset($summary['buyingPrice']['amount'])) {
            $price = floatval($summary['buyingPrice']['amount']);
            $currency = $summary['buyingPrice']['currencyCode'] ?? 'EUR';
        } elseif (isset($summary['listPrice']['amount'])) {
            $price = floatval($summary['listPrice']['amount']);
            $currency = $summary['listPrice']['currencyCode'] ?? 'EUR';
        }

        if ($price === null || $price <= 0) {
            // Try Pricing API as fallback
            return $this->fetch_price_from_sp_api_pricing($asin);
        }

        $formatted_price = number_format($price, 2, ',', '.') . ' €';

        return array(
            'price'           => $price,
            'currency'        => $currency,
            'formatted_price' => $formatted_price,
            'price_text'      => '',
            'price_source'    => 'sp_api',
        );
    }

    /**
     * Fetch price from SP-API Pricing API (getItemOffers)
     *
     * @param string $asin Product ASIN
     * @return array|WP_Error
     */
    private function fetch_price_from_sp_api_pricing($asin) {
        $token = $this->get_sp_api_access_token();
        if (is_wp_error($token)) {
            return $token;
        }

        $this->rate_limit('sp_api');

        $marketplace_id = get_option('waas_pm_sp_api_marketplace_id', 'A1PA6795UKMFR9');
        $endpoint = 'https://sellingpartnerapi-eu.amazon.com';

        $url = $endpoint . '/products/pricing/v0/items/' . urlencode($asin) . '/offers'
            . '?MarketplaceId=' . urlencode($marketplace_id)
            . '&ItemCondition=New';

        $response = wp_remote_get($url, array(
            'headers' => array(
                'x-amz-access-token' => $token,
                'Content-Type'       => 'application/json',
            ),
            'timeout' => 15,
        ));

        if (is_wp_error($response)) {
            return $response;
        }

        $status = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($status !== 200) {
            $error_msg = $body['errors'][0]['message'] ?? "HTTP {$status}";
            return new WP_Error('sp_api_pricing_error', $error_msg);
        }

        // Parse offers response
        $offers = $body['payload']['Offers'] ?? array();
        if (empty($offers)) {
            return new WP_Error('sp_api_no_offers', "No offers found for ASIN: {$asin}");
        }

        // Get lowest price from offers
        $lowest_price = null;
        $currency = 'EUR';

        foreach ($offers as $offer) {
            $listing_price = $offer['ListingPrice']['Amount'] ?? null;
            if ($listing_price !== null) {
                $p = floatval($listing_price);
                if ($lowest_price === null || $p < $lowest_price) {
                    $lowest_price = $p;
                    $currency = $offer['ListingPrice']['CurrencyCode'] ?? 'EUR';
                }
            }
        }

        if ($lowest_price === null || $lowest_price <= 0) {
            return new WP_Error('sp_api_no_price', "No valid price in offers for ASIN: {$asin}");
        }

        $formatted_price = number_format($lowest_price, 2, ',', '.') . ' €';

        return array(
            'price'           => $lowest_price,
            'currency'        => $currency,
            'formatted_price' => $formatted_price,
            'price_text'      => '',
            'price_source'    => 'sp_api',
        );
    }

    // =========================================================================
    // EXISTING METHODS (updated for v3)
    // =========================================================================

    /**
     * Sync product to Google Sheets when saved in admin
     * This ensures Google Sheets is updated when admin edits product prices
     *
     * @param int $product_id WooCommerce product ID
     */
    public function sync_product_to_sheets_on_save($product_id) {
        // Prevent infinite loops
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }

        // Don't sync back when product is being imported from Google Sheets
        // This flag is set by REST API during import
        if (defined('WAAS_IMPORTING_FROM_SHEETS') && WAAS_IMPORTING_FROM_SHEETS) {
            return;
        }

        // Don't sync during REST API requests (likely an import)
        if (defined('REST_REQUEST') && REST_REQUEST) {
            return;
        }

        // Check if this is an external/affiliate product
        $product = wc_get_product($product_id);
        if (!$product || !$product->is_type('external')) {
            return;
        }

        // Get ASIN
        $asin = get_post_meta($product_id, '_waas_asin', true);
        if (empty($asin)) {
            return;
        }

        // Get current price
        $price = $product->get_price();
        if (empty($price)) {
            return;
        }

        // Format timestamp in German timezone
        $dt = new DateTime('now', new DateTimeZone('Europe/Berlin'));
        $timestamp = $dt->format('d.m.Y H:i');

        // Format price in German format
        $price_formatted = number_format(floatval($price), 2, ',', '.') . ' €';

        error_log("WAAS Price Updater: Product #{$product_id} (ASIN: {$asin}) saved, syncing to Sheets");

        // Sync to Google Sheets
        $this->sync_prices_to_google_sheets(array(
            array(
                'asin' => $asin,
                'price' => floatval($price),
                'price_currency' => 'EUR',
                'price_formatted' => $price_formatted,
                'price_text' => '',
                'last_price_update' => $timestamp
            )
        ));
    }

    /**
     * Check if product needs price update (only once per day)
     *
     * @param int $product_id WooCommerce product ID
     * @return bool True if update needed, false otherwise
     */
    public function needs_price_update($product_id) {
        $last_update = get_post_meta($product_id, '_waas_last_price_sync_date', true);

        if (empty($last_update)) {
            return true;
        }

        // Check if last update was today
        $today = date('Y-m-d');
        $last_update_date = date('Y-m-d', strtotime($last_update));

        if ($last_update_date === $today) {
            error_log("WAAS Price Updater: Product #{$product_id} already synced today ({$last_update_date})");
            return false;
        }

        return true;
    }

    /**
     * Maybe update product price on page view
     * Called when user visits a single product page
     */
    public function maybe_update_product_price_on_view() {
        global $product;

        if (!$product || !method_exists($product, 'is_type') || !$product->is_type('external')) {
            return;
        }

        $product_id = $product->get_id();
        $asin = get_post_meta($product_id, '_waas_asin', true);

        if (empty($asin)) {
            return;
        }

        // Check if already updated today
        if (!$this->needs_price_update($product_id)) {
            return;
        }

        error_log("WAAS Price Updater: Updating price for product #{$product_id} (ASIN: {$asin}) on page view");

        // v3: Use price router (PA-API → SP-API fallback)
        $price_data = $this->fetch_price($asin);

        if (is_wp_error($price_data) || empty($price_data['price'])) {
            error_log("WAAS Price Updater: Failed to fetch price for {$asin}");
            return;
        }

        // Update WooCommerce product
        $this->update_product_price($product_id, $price_data);

        // Sync to Google Sheets
        $this->sync_single_product_to_sheets($asin, $price_data);
    }

    /**
     * Update product price and meta
     *
     * @param int $product_id WooCommerce product ID
     * @param array $price_data Array with price, currency, formatted_price, price_source
     */
    private function update_product_price($product_id, $price_data) {
        if (!function_exists('wc_get_product')) {
            return;
        }

        $wc_product = wc_get_product($product_id);
        if (!$wc_product) {
            return;
        }

        $new_price = $price_data['price'];

        // Update WooCommerce price
        $wc_product->set_regular_price($new_price);
        $wc_product->set_price($new_price);
        $wc_product->save();

        // Update meta fields
        $current_time = current_time('mysql');

        update_post_meta($product_id, '_waas_price', $new_price);
        update_post_meta($product_id, '_waas_price_currency', $price_data['currency'] ?? 'EUR');
        update_post_meta($product_id, '_waas_price_formatted', $price_data['formatted_price'] ?? number_format($new_price, 2, ',', '.') . ' €');
        update_post_meta($product_id, '_waas_price_text', $price_data['price_text'] ?? '');
        update_post_meta($product_id, '_waas_price_updated', current_time('timestamp'));
        update_post_meta($product_id, '_waas_last_price_update', $current_time);
        update_post_meta($product_id, '_waas_last_price_sync_date', $current_time);

        // v3: Save price source
        if (!empty($price_data['price_source'])) {
            update_post_meta($product_id, '_waas_price_source', $price_data['price_source']);
        }

        $source_label = $price_data['price_source'] ?? 'unknown';
        error_log("WAAS Price Updater: Updated product #{$product_id}: {$new_price} (source: {$source_label}, synced at {$current_time})");
    }

    /**
     * Run daily price update (called by WordPress cron)
     *
     * v3: Returns summary array for REST API endpoint.
     *
     * @return array Summary { updated, failed, skipped, total, source_stats, duration_seconds }
     */
    public function run_daily_update() {
        $start = microtime(true);
        error_log('WAAS Price Updater: Starting daily price update');

        // Get all products with auto-update enabled
        $products = $this->get_auto_update_products();

        if (empty($products)) {
            error_log('WAAS Price Updater: No products with auto-update enabled');
            return array(
                'updated' => 0,
                'failed' => 0,
                'skipped' => 0,
                'total' => 0,
                'source_stats' => array('pa_api' => 0, 'sp_api' => 0),
                'duration_seconds' => round(microtime(true) - $start, 2),
            );
        }

        error_log('WAAS Price Updater: Found ' . count($products) . ' products to update');

        $updated = 0;
        $failed = 0;
        $skipped = 0;
        $source_stats = array('pa_api' => 0, 'sp_api' => 0);
        $sheets_updates = array();

        foreach ($products as $product) {
            $product_id = $product->ID;
            $asin = get_post_meta($product_id, '_waas_asin', true);

            if (empty($asin)) {
                error_log("WAAS Price Updater: Product #{$product_id} has no ASIN, skipping");
                $skipped++;
                continue;
            }

            // Check if already updated today
            if (!$this->needs_price_update($product_id)) {
                $skipped++;
                continue;
            }

            error_log("WAAS Price Updater: Updating product #{$product_id} (ASIN: {$asin})");

            // v3: Use price router (PA-API → SP-API fallback)
            $price_data = $this->fetch_price($asin);

            if (is_wp_error($price_data) || empty($price_data['price'])) {
                error_log("WAAS Price Updater: Failed to fetch price for {$asin}");
                $failed++;
                continue;
            }

            // Update WooCommerce product
            $this->update_product_price($product_id, $price_data);

            // Track price source
            $used_source = $price_data['price_source'] ?? 'pa_api';
            if (isset($source_stats[$used_source])) {
                $source_stats[$used_source]++;
            }

            // Prepare Google Sheets update
            $sheets_updates[] = array(
                'asin' => $asin,
                'price' => $price_data['price'],
                'price_currency' => $price_data['currency'] ?? 'EUR',
                'price_formatted' => $price_data['formatted_price'] ?? number_format($price_data['price'], 2, ',', '.') . ' €',
                'price_text' => $price_data['price_text'] ?? '',
                'price_source' => $used_source,
                'last_price_update' => date_i18n('d.m.Y H:i') // German format
            );

            $updated++;
        }

        $duration = round(microtime(true) - $start, 2);

        error_log("WAAS Price Updater: Update complete. Success: {$updated}, Failed: {$failed}, Skipped: {$skipped} (PA-API: {$source_stats['pa_api']}, SP-API: {$source_stats['sp_api']}) [{$duration}s]");

        // Sync all updates to Google Sheets in one batch
        if (!empty($sheets_updates)) {
            $this->sync_prices_to_google_sheets($sheets_updates);
        }

        return array(
            'updated'          => $updated,
            'failed'           => $failed,
            'skipped'          => $skipped,
            'total'            => count($products),
            'source_stats'     => $source_stats,
            'duration_seconds' => $duration,
        );
    }

    /**
     * Sync single product price to Google Sheets
     *
     * @param string $asin Product ASIN
     * @param array $price_data Price data
     */
    private function sync_single_product_to_sheets($asin, $price_data) {
        $sheets_update = array(
            array(
                'asin' => $asin,
                'price' => $price_data['price'],
                'price_currency' => $price_data['currency'] ?? 'EUR',
                'price_formatted' => $price_data['formatted_price'] ?? number_format($price_data['price'], 2, ',', '.') . ' €',
                'price_text' => $price_data['price_text'] ?? '',
                'price_source' => $price_data['price_source'] ?? '',
                'last_price_update' => date_i18n('d.m.Y H:i') // German format
            )
        );

        $this->sync_prices_to_google_sheets($sheets_update);
    }

    /**
     * Get all products with auto-update enabled
     *
     * @return array Array of WP_Post objects
     */
    private function get_auto_update_products() {
        $args = array(
            'post_type' => 'product',
            'post_status' => 'publish',
            'posts_per_page' => -1,
            'meta_query' => array(
                array(
                    'key' => '_waas_auto_update',
                    'value' => '1',
                    'compare' => '='
                )
            )
        );

        return get_posts($args);
    }

    /**
     * Fetch price from Amazon PA-API
     *
     * @param string $asin Product ASIN
     * @return array|WP_Error Price data array or error
     */
    private function fetch_price_from_amazon($asin) {
        // Check if Amazon API class exists
        if (!class_exists('WAAS_Amazon_API')) {
            return new WP_Error('no_api', 'Amazon API class not found');
        }

        // Rate limit
        $this->rate_limit('pa_api');

        try {
            $amazon_api = WAAS_Amazon_API::get_instance();
            $product_data = $amazon_api->get_item($asin);

            if (is_wp_error($product_data)) {
                return $product_data;
            }

            if (isset($product_data['price'])) {
                $price_string = $product_data['price'];
                $price = $this->extract_numeric_price($price_string);

                return array(
                    'price' => $price,
                    'currency' => $product_data['currency'] ?? 'EUR',
                    'formatted_price' => $product_data['formatted_price'] ?? $price_string,
                    'price_text' => $product_data['price_text'] ?? '',
                    'price_source' => 'pa_api',
                );
            }

            return new WP_Error('no_price', 'No price in Amazon response');

        } catch (Exception $e) {
            return new WP_Error('api_error', $e->getMessage());
        }
    }

    /**
     * Extract numeric price from string
     *
     * @param string $price_string Price string (e.g., "€115.99" or "115,99 €")
     * @return float Numeric price
     */
    private function extract_numeric_price($price_string) {
        if (is_numeric($price_string)) {
            return floatval($price_string);
        }

        // Remove everything except digits, dot and comma
        $price = preg_replace('/[^0-9.,]/', '', $price_string);

        // Handle German format (comma as decimal separator)
        if (strpos($price, ',') !== false && strpos($price, '.') !== false) {
            // Both present: assume German format (1.234,56)
            $price = str_replace('.', '', $price); // Remove thousand separator
            $price = str_replace(',', '.', $price); // Convert decimal separator
        } elseif (strpos($price, ',') !== false) {
            // Only comma: assume decimal separator
            $price = str_replace(',', '.', $price);
        }

        $price = floatval($price);

        return $price > 0 ? $price : 0;
    }

    /**
     * Sync updated prices to Google Sheets
     *
     * @param array $updates Array of updates with all price columns
     */
    private function sync_prices_to_google_sheets($updates) {
        error_log('WAAS Price Updater: Syncing ' . count($updates) . ' price updates to Google Sheets');

        // Get Google Sheets webhook URL from settings
        $webhook_url = get_option('waas_pm_sheets_webhook_url', '');

        if (empty($webhook_url)) {
            error_log('WAAS Price Updater: No Google Sheets webhook URL configured. Skipping sync.');
            error_log('WAAS Price Updater: Go to Settings → WAAS Product Manager to configure webhook URL');
            return;
        }

        $json_body = json_encode(array(
            'action' => 'update_prices',
            'updates' => $updates
        ));

        // Google Apps Script redirects POST requests (302)
        // We need to follow the redirect manually and resend as POST
        $response = wp_remote_post($webhook_url, array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => $json_body,
            'timeout' => 30,
            'redirection' => 0  // Don't follow redirects automatically
        ));

        if (is_wp_error($response)) {
            error_log('WAAS Price Updater: Failed to sync to Google Sheets: ' . $response->get_error_message());
            return;
        }

        $status_code = wp_remote_retrieve_response_code($response);

        // Handle Google Apps Script redirect (302)
        if ($status_code === 302 || $status_code === 307) {
            $redirect_url = wp_remote_retrieve_header($response, 'location');
            error_log("WAAS Price Updater: Following redirect to: {$redirect_url}");

            if (!empty($redirect_url)) {
                // Resend POST to redirect URL
                $response = wp_remote_post($redirect_url, array(
                    'headers' => array('Content-Type' => 'application/json'),
                    'body' => $json_body,
                    'timeout' => 30,
                    'redirection' => 0
                ));

                if (is_wp_error($response)) {
                    error_log('WAAS Price Updater: Failed after redirect: ' . $response->get_error_message());
                    return;
                }

                $status_code = wp_remote_retrieve_response_code($response);
            }
        }

        $body = wp_remote_retrieve_body($response);

        if ($status_code === 200) {
            error_log('WAAS Price Updater: Successfully synced prices to Google Sheets');
            error_log('WAAS Price Updater: Response: ' . $body);
        } else {
            error_log("WAAS Price Updater: Google Sheets sync failed (HTTP {$status_code}): {$body}");
        }
    }
}
