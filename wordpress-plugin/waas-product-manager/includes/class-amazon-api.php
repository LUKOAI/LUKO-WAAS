<?php
/**
 * Amazon Product Advertising API 5.0 Integration
 *
 * @package WAAS_Product_Manager
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WAAS Amazon API Class
 */
class WAAS_Amazon_API {

    /**
     * Instance of this class
     *
     * @var object
     */
    protected static $instance = null;

    /**
     * API Access Key
     *
     * @var string
     */
    private $access_key;

    /**
     * API Secret Key
     *
     * @var string
     */
    private $secret_key;

    /**
     * Partner Tag (Associate ID)
     *
     * @var string
     */
    private $partner_tag;

    /**
     * Amazon Region
     *
     * @var string
     */
    private $region;

    /**
     * API Endpoint
     *
     * @var string
     */
    private $endpoint;

    /**
     * Get instance of this class
     *
     * @return object
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
        $this->load_credentials();
    }

    /**
     * Load API credentials from settings
     */
    private function load_credentials() {
        $settings = get_option('waas_pm_amazon_api_settings', array());

        $this->access_key = isset($settings['access_key']) ? $settings['access_key'] : '';
        $this->secret_key = isset($settings['secret_key']) ? $settings['secret_key'] : '';
        $this->partner_tag = isset($settings['partner_tag']) ? $settings['partner_tag'] : '';
        $this->region = isset($settings['region']) ? $settings['region'] : 'us-east-1';

        // Set endpoint based on region
        $this->set_endpoint();
    }

    /**
     * Set API endpoint based on region
     */
    private function set_endpoint() {
        $endpoints = array(
            'us-east-1' => 'webservices.amazon.com',
            'eu-west-1' => 'webservices.amazon.co.uk',
            'us-west-2' => 'webservices.amazon.ca',
            'ap-northeast-1' => 'webservices.amazon.co.jp',
            'eu-central-1' => 'webservices.amazon.de',
        );

        $this->endpoint = isset($endpoints[$this->region]) ? $endpoints[$this->region] : $endpoints['us-east-1'];
    }

    /**
     * Get product details by ASIN
     *
     * @param string $asin Amazon Standard Identification Number
     * @return array|WP_Error Product data or error
     */
    public function get_item($asin) {
        // Check cache first
        $cache_manager = WAAS_Cache_Manager::get_instance();
        $cached_data = $cache_manager->get_product_cache($asin);

        if ($cached_data !== false) {
            return $cached_data;
        }

        // Validate credentials
        if (!$this->validate_credentials()) {
            return new WP_Error('missing_credentials', __('Amazon API credentials are not configured', 'waas-pm'));
        }

        // Prepare request parameters
        $params = array(
            'Operation' => 'GetItems',
            'ItemIds' => $asin,
            'Resources' => array(
                'Images.Primary.Large',
                'Images.Variants.Large',
                'ItemInfo.Title',
                'ItemInfo.ByLineInfo',
                'ItemInfo.Features',
                'ItemInfo.ContentInfo',
                'ItemInfo.TechnicalInfo',
                'Offers.Listings.Price',
                'Offers.Listings.SavingBasis',
                'Offers.Listings.Availability',
                'Offers.Listings.DeliveryInfo',
                'Offers.Listings.Promotions',
                'BrowseNodeInfo.BrowseNodes',
            ),
        );

        // Make API request
        $response = $this->make_request('GetItems', $params);

        if (is_wp_error($response)) {
            return $response;
        }

        // Parse response
        $product_data = $this->parse_item_response($response);

        if ($product_data) {
            // Cache the result (24 hours as per Amazon TOS)
            $cache_manager->set_product_cache($asin, $product_data);
        }

        return $product_data;
    }

    /**
     * Get multiple items by ASIN (batch request, max 10)
     *
     * @param array $asins Array of ASINs (max 10)
     * @return array|WP_Error Array of product data or error
     */
    public function get_items($asins) {
        // Limit to 10 ASINs per Amazon API requirement
        $asins = array_slice($asins, 0, 10);

        if (empty($asins)) {
            return new WP_Error('empty_asins', __('No ASINs provided', 'waas-pm'));
        }

        // Check cache for each ASIN
        $cache_manager = WAAS_Cache_Manager::get_instance();
        $results = array();
        $uncached_asins = array();

        foreach ($asins as $asin) {
            $cached_data = $cache_manager->get_product_cache($asin);
            if ($cached_data !== false) {
                $results[$asin] = $cached_data;
            } else {
                $uncached_asins[] = $asin;
            }
        }

        // If all items are cached, return immediately
        if (empty($uncached_asins)) {
            return $results;
        }

        // Validate credentials
        if (!$this->validate_credentials()) {
            return new WP_Error('missing_credentials', __('Amazon API credentials are not configured', 'waas-pm'));
        }

        // Prepare request parameters
        $params = array(
            'Operation' => 'GetItems',
            'ItemIds' => implode(',', $uncached_asins),
            'Resources' => array(
                'Images.Primary.Large',
                'Images.Variants.Large',
                'ItemInfo.Title',
                'ItemInfo.ByLineInfo',
                'ItemInfo.Features',
                'ItemInfo.ContentInfo',
                'ItemInfo.TechnicalInfo',
                'Offers.Listings.Price',
                'Offers.Listings.SavingBasis',
                'Offers.Listings.Availability',
                'Offers.Listings.DeliveryInfo',
                'Offers.Listings.Promotions',
                'BrowseNodeInfo.BrowseNodes',
            ),
        );

        // Make API request
        $response = $this->make_request('GetItems', $params);

        if (is_wp_error($response)) {
            return $response;
        }

        // Parse each item in response
        if (isset($response['ItemsResult']['Items'])) {
            foreach ($response['ItemsResult']['Items'] as $item) {
                $product_data = $this->parse_single_item($item);
                if ($product_data) {
                    $asin = $item['ASIN'];
                    $results[$asin] = $product_data;

                    // Cache the result
                    $cache_manager->set_product_cache($asin, $product_data);
                }
            }
        }

        return $results;
    }

    /**
     * Search for products
     *
     * @param string $keywords Search keywords
     * @param array $args Additional search parameters
     * @return array|WP_Error Search results or error
     */
    public function search_items($keywords, $args = array()) {
        if (!$this->validate_credentials()) {
            return new WP_Error('missing_credentials', __('Amazon API credentials are not configured', 'waas-pm'));
        }

        $defaults = array(
            'SearchIndex' => 'All',
            'ItemCount' => 10,
            'ItemPage' => 1,
        );

        $args = wp_parse_args($args, $defaults);

        $params = array(
            'Operation' => 'SearchItems',
            'Keywords' => $keywords,
            'SearchIndex' => $args['SearchIndex'],
            'ItemCount' => $args['ItemCount'],
            'ItemPage' => $args['ItemPage'],
            'Resources' => array(
                'Images.Primary.Medium',
                'ItemInfo.Title',
                'ItemInfo.ByLineInfo',
                'Offers.Listings.Price',
            ),
        );

        $response = $this->make_request('SearchItems', $params);

        if (is_wp_error($response)) {
            return $response;
        }

        return $this->parse_search_response($response);
    }

    /**
     * Make API request
     *
     * @param string $operation API operation
     * @param array $params Request parameters
     * @return array|WP_Error Response data or error
     */
    private function make_request($operation, $params) {
        $request_url = 'https://' . $this->endpoint . '/paapi5/' . strtolower($operation);

        // Build request payload
        $payload = array(
            'PartnerTag' => $this->partner_tag,
            'PartnerType' => 'Associates',
            'Marketplace' => 'www.amazon.com',
        );

        $payload = array_merge($payload, $params);

        // Sign request
        $headers = $this->sign_request($payload, $operation);

        // Make HTTP request
        $response = wp_remote_post($request_url, array(
            'headers' => $headers,
            'body' => json_encode($payload),
            'timeout' => 30,
        ));

        // Handle errors
        if (is_wp_error($response)) {
            $this->log_api_call($operation, $params, $response, 'error');
            return $response;
        }

        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        // Check for API errors
        if (isset($data['Errors'])) {
            $error_message = isset($data['Errors'][0]['Message']) ? $data['Errors'][0]['Message'] : __('Unknown API error', 'waas-pm');
            $this->log_api_call($operation, $params, $data, 'api_error');
            return new WP_Error('api_error', $error_message);
        }

        // Log successful call
        $this->log_api_call($operation, $params, $data, 'success');

        return $data;
    }

    /**
     * Sign API request using AWS Signature Version 4
     *
     * @param array $payload Request payload
     * @param string $operation API operation
     * @return array Request headers
     */
    private function sign_request($payload, $operation) {
        $method = 'POST';
        $service = 'ProductAdvertisingAPI';
        $canonical_uri = '/paapi5/' . strtolower($operation);
        $host = $this->endpoint;

        $timestamp = gmdate('Ymd\THis\Z');
        $datestamp = gmdate('Ymd');

        // Create canonical request
        $payload_hash = hash('sha256', json_encode($payload));

        $canonical_headers = "content-type:application/json; charset=utf-8\n" .
                           "host:{$host}\n" .
                           "x-amz-date:{$timestamp}\n" .
                           "x-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.{$operation}\n";

        $signed_headers = 'content-type;host;x-amz-date;x-amz-target';

        $canonical_request = "{$method}\n{$canonical_uri}\n\n{$canonical_headers}\n{$signed_headers}\n{$payload_hash}";

        // Create string to sign
        $credential_scope = "{$datestamp}/{$this->region}/{$service}/aws4_request";
        $string_to_sign = "AWS4-HMAC-SHA256\n{$timestamp}\n{$credential_scope}\n" . hash('sha256', $canonical_request);

        // Calculate signature
        $signing_key = $this->get_signature_key($this->secret_key, $datestamp, $this->region, $service);
        $signature = hash_hmac('sha256', $string_to_sign, $signing_key);

        // Build authorization header
        $authorization = "AWS4-HMAC-SHA256 Credential={$this->access_key}/{$credential_scope}, SignedHeaders={$signed_headers}, Signature={$signature}";

        return array(
            'Accept' => 'application/json',
            'Accept-Charset' => 'utf-8',
            'Content-Type' => 'application/json; charset=utf-8',
            'X-Amz-Date' => $timestamp,
            'X-Amz-Target' => "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.{$operation}",
            'Authorization' => $authorization,
        );
    }

    /**
     * Get signature key for AWS Signature Version 4
     *
     * @param string $key Secret key
     * @param string $date_stamp Date stamp
     * @param string $region_name Region
     * @param string $service_name Service
     * @return string Signature key
     */
    private function get_signature_key($key, $date_stamp, $region_name, $service_name) {
        $k_date = hash_hmac('sha256', $date_stamp, 'AWS4' . $key, true);
        $k_region = hash_hmac('sha256', $region_name, $k_date, true);
        $k_service = hash_hmac('sha256', $service_name, $k_region, true);
        $k_signing = hash_hmac('sha256', 'aws4_request', $k_service, true);

        return $k_signing;
    }

    /**
     * Parse GetItems response
     *
     * @param array $response API response
     * @return array|false Parsed product data
     */
    private function parse_item_response($response) {
        if (isset($response['ItemsResult']['Items'][0])) {
            return $this->parse_single_item($response['ItemsResult']['Items'][0]);
        }

        return false;
    }

    /**
     * Parse single item from response
     *
     * @param array $item Item data from API
     * @return array Parsed product data
     */
    private function parse_single_item($item) {
        $data = array(
            'asin' => isset($item['ASIN']) ? $item['ASIN'] : '',
            'title' => isset($item['ItemInfo']['Title']['DisplayValue']) ? $item['ItemInfo']['Title']['DisplayValue'] : '',
            'brand' => isset($item['ItemInfo']['ByLineInfo']['Brand']['DisplayValue']) ? $item['ItemInfo']['ByLineInfo']['Brand']['DisplayValue'] : '',
            'features' => array(),
            'image_url' => '',
            'images' => array(),
            'price' => '',
            'currency' => 'USD',
            'savings_amount' => '',
            'savings_percentage' => 0,
            'availability' => '',
            'prime_eligible' => false,
            'detail_page_url' => isset($item['DetailPageURL']) ? $item['DetailPageURL'] : '',
        );

        // Extract features
        if (isset($item['ItemInfo']['Features']['DisplayValues']) && is_array($item['ItemInfo']['Features']['DisplayValues'])) {
            $data['features'] = $item['ItemInfo']['Features']['DisplayValues'];
        }

        // Extract images
        if (isset($item['Images']['Primary']['Large']['URL'])) {
            $data['image_url'] = $item['Images']['Primary']['Large']['URL'];
        }

        if (isset($item['Images']['Variants']) && is_array($item['Images']['Variants'])) {
            foreach ($item['Images']['Variants'] as $variant) {
                if (isset($variant['Large']['URL'])) {
                    $data['images'][] = $variant['Large']['URL'];
                }
            }
        }

        // Extract pricing (only if available in listings)
        if (isset($item['Offers']['Listings'][0])) {
            $listing = $item['Offers']['Listings'][0];

            if (isset($listing['Price']['Amount'])) {
                $data['price'] = $listing['Price']['DisplayAmount'];
                $data['currency'] = $listing['Price']['Currency'];
            }

            if (isset($listing['Price']['Savings'])) {
                $data['savings_amount'] = $listing['Price']['Savings']['DisplayAmount'];
                $data['savings_percentage'] = isset($listing['Price']['Savings']['Percentage']) ? $listing['Price']['Savings']['Percentage'] : 0;
            }

            if (isset($listing['Availability']['Type'])) {
                $data['availability'] = $listing['Availability']['Type'];
            }

            if (isset($listing['DeliveryInfo']['IsPrimeEligible'])) {
                $data['prime_eligible'] = (bool) $listing['DeliveryInfo']['IsPrimeEligible'];
            }
        }

        // Generate affiliate link
        $data['affiliate_link'] = $this->generate_affiliate_link($data['asin']);

        return $data;
    }

    /**
     * Parse SearchItems response
     *
     * @param array $response API response
     * @return array Search results
     */
    private function parse_search_response($response) {
        $results = array();

        if (isset($response['SearchResult']['Items']) && is_array($response['SearchResult']['Items'])) {
            foreach ($response['SearchResult']['Items'] as $item) {
                $results[] = $this->parse_single_item($item);
            }
        }

        return $results;
    }

    /**
     * Generate affiliate link from ASIN
     *
     * @param string $asin ASIN
     * @param string $tracking_id Optional tracking ID to override default partner_tag
     * @return string Affiliate link
     */
    public function generate_affiliate_link($asin, $tracking_id = null) {
        $tag = !empty($tracking_id) ? $tracking_id : $this->partner_tag;

        if (empty($tag) || empty($asin)) {
            return '';
        }

        return "https://www.amazon.com/dp/{$asin}/?tag={$tag}";
    }

    /**
     * Get affiliate link for a product with per-site tracking ID
     *
     * @param string $asin ASIN
     * @param int $post_id Optional WordPress post ID to get tracking_id from
     * @return string Affiliate link
     */
    public function get_product_affiliate_link($asin, $post_id = null) {
        $tracking_id = null;

        // Try to get tracking_id from product meta
        if ($post_id) {
            $tracking_id = get_post_meta($post_id, '_waas_tracking_id', true);
        }

        // Fallback to global partner_tag if no tracking_id set
        if (empty($tracking_id)) {
            $tracking_id = $this->partner_tag;
        }

        return $this->generate_affiliate_link($asin, $tracking_id);
    }

    /**
     * Validate API credentials
     *
     * @return bool True if valid
     */
    private function validate_credentials() {
        return !empty($this->access_key) && !empty($this->secret_key) && !empty($this->partner_tag);
    }

    /**
     * Log API call
     *
     * @param string $operation Operation name
     * @param array $request Request data
     * @param mixed $response Response data
     * @param string $status Status (success, error, api_error)
     */
    private function log_api_call($operation, $request, $response, $status) {
        global $wpdb;

        $table_name = $wpdb->prefix . 'waas_api_logs';

        $wpdb->insert(
            $table_name,
            array(
                'api_type' => $operation,
                'request_data' => json_encode($request),
                'response_data' => is_wp_error($response) ? $response->get_error_message() : json_encode($response),
                'status' => $status,
                'created_at' => current_time('mysql'),
            ),
            array('%s', '%s', '%s', '%s', '%s')
        );
    }
}
