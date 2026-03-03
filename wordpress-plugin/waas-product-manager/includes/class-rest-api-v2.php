<?php
/**
 * REST API Endpoints V2 - Enhanced with direct WooCommerce sync
 *
 * @package WAAS_Product_Manager
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WAAS REST API Class V2
 */
class WAAS_REST_API_V2 {

    /**
     * Instance of this class
     *
     * @var object
     */
    protected static $instance = null;

    /**
     * API namespace
     *
     * @var string
     */
    private $namespace = 'waas/v1';

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
        add_action('rest_api_init', array($this, 'register_routes'));
    }

    /**
     * Register REST API routes
     */
    public function register_routes() {
        // Import products DIRECTLY to WooCommerce (v3 — no waas_product intermediate)
        register_rest_route($this->namespace, '/products/import', array(
            'methods' => 'POST',
            'callback' => array($this, 'import_products'),
            'permission_callback' => array($this, 'check_admin_permission'),
            'args' => array(
                'products' => array(
                    'required' => true,
                    'type' => 'array',
                    'description' => __('Array of products to import', 'waas-pm'),
                ),
                'domain' => array(
                    'type' => 'string',
                    'description' => __('Domain for tracking ID', 'waas-pm'),
                ),
                'tracking_id' => array(
                    'type' => 'string',
                    'description' => __('Amazon Partner Tag (tracking ID)', 'waas-pm'),
                ),
            ),
        ));

        // Get product list (now reads from WooCommerce products)
        register_rest_route($this->namespace, '/products/list', array(
            'methods' => 'GET',
            'callback' => array($this, 'list_products'),
            'permission_callback' => array($this, 'check_read_permission'),
        ));

        // Bulk sync legacy waas_product to WooCommerce (kept for backwards compat)
        register_rest_route($this->namespace, '/products/sync-woocommerce', array(
            'methods' => 'POST',
            'callback' => array($this, 'bulk_sync_woocommerce'),
            'permission_callback' => array($this, 'check_admin_permission'),
        ));

        // Migrate all waas_product posts to WooCommerce products
        register_rest_route($this->namespace, '/products/migrate-to-wc', array(
            'methods' => 'POST',
            'callback' => array($this, 'migrate_waas_products_to_wc'),
            'permission_callback' => array($this, 'check_admin_permission'),
            'args' => array(
                'delete_originals' => array(
                    'type' => 'boolean',
                    'default' => false,
                    'description' => __('Delete waas_product posts after migration', 'waas-pm'),
                ),
            ),
        ));
    }

    /**
     * Import products DIRECTLY to WooCommerce (v3 — no waas_product intermediate)
     *
     * @param WP_REST_Request $request Request object
     * @return WP_REST_Response|WP_Error Response
     */
    public function import_products($request) {
        $products = $request->get_param('products');
        $domain = $request->get_param('domain');
        $tracking_id = $request->get_param('tracking_id');

        if (empty($products) || !is_array($products)) {
            return new WP_Error('invalid_data', __('Invalid product data', 'waas-pm'), array('status' => 400));
        }

        if (!class_exists('WooCommerce') || !class_exists('WC_Product_External')) {
            return new WP_Error('wc_not_active', __('WooCommerce is required for product import', 'waas-pm'), array('status' => 400));
        }

        error_log("WAAS REST API v3: Importing " . count($products) . " products directly to WooCommerce");
        if ($tracking_id) {
            error_log("WAAS REST API v3: Using tracking ID: {$tracking_id}");
        }

        $results = array();

        foreach ($products as $product_data) {
            try {
                // Add tracking ID to affiliate link if provided
                if ($tracking_id && isset($product_data['affiliate_link'])) {
                    $product_data['affiliate_link'] = $this->add_tracking_id_to_url(
                        $product_data['affiliate_link'],
                        $tracking_id
                    );
                }

                // Import DIRECTLY to WooCommerce (no waas_product intermediate)
                $wc_product_id = $this->create_woocommerce_product_direct(null, $product_data, $tracking_id);

                if (is_wp_error($wc_product_id)) {
                    error_log("WAAS REST API v3: WooCommerce import failed: " . $wc_product_id->get_error_message());
                    $results[] = array(
                        'status' => 'error',
                        'asin' => $product_data['asin'] ?? 'unknown',
                        'message' => $wc_product_id->get_error_message(),
                    );
                    continue;
                }

                error_log("WAAS REST API v3: Created WooCommerce product #{$wc_product_id}");

                $results[] = array(
                    'status' => 'success',
                    'wc_product_id' => $wc_product_id,
                    'asin' => $product_data['asin'] ?? '',
                );

            } catch (Exception $e) {
                error_log("WAAS REST API v3: Import error: " . $e->getMessage());
                $results[] = array(
                    'status' => 'error',
                    'asin' => $product_data['asin'] ?? 'unknown',
                    'message' => $e->getMessage(),
                );
            }
        }

        return new WP_REST_Response(array(
            'success' => true,
            'results' => $results,
            'total' => count($products),
            'succeeded' => count(array_filter($results, function($r) { return $r['status'] === 'success'; })),
        ), 200);
    }

    /**
     * Create WooCommerce product DIRECTLY
     *
     * v3: waas_post_id is now optional (null = direct import without waas_product)
     *
     * @param int|null $waas_post_id Legacy WAAS product post ID (null for direct import)
     * @param array $product_data Product data
     * @param string $tracking_id Amazon Partner Tag
     * @return int|WP_Error WooCommerce product ID or error
     */
    private function create_woocommerce_product_direct($waas_post_id, $product_data, $tracking_id = null) {
        try {
            if (!class_exists('WC_Product_External')) {
                throw new Exception('WooCommerce not available or WC_Product_External class not found');
            }

            $asin = $product_data['asin'] ?? ($waas_post_id ? get_post_meta($waas_post_id, '_waas_asin', true) : '');

            // Sprawdź czy produkt już istnieje
            $existing_wc_id = $this->find_woocommerce_product_by_asin($asin);
            if ($existing_wc_id) {
                error_log("WAAS: Updating existing WooCommerce product #{$existing_wc_id}");
                return $this->update_woocommerce_product($existing_wc_id, $waas_post_id, $product_data, $tracking_id);
            }

            // Utwórz nowy produkt External/Affiliate
            $product = new WC_Product_External();

            // === NAZWA PRODUKTU ===
            $title = $product_data['title'] ?? $product_data['product_name'] ?? ($waas_post_id ? get_the_title($waas_post_id) : 'Untitled Product');
            $product->set_name(sanitize_text_field($title));

            // === OPIS PRODUKTU (Features jako główny opis!) ===
            $features = $product_data['features'] ?? $product_data['bullet_points'] ?? null;
            if ($features) {
                if (is_array($features)) {
                    $features_html = '<ul class="waas-features">';
                    foreach ($features as $feature) {
                        $features_html .= '<li>' . esc_html($feature) . '</li>';
                    }
                    $features_html .= '</ul>';
                    $product->set_description($features_html);
                } elseif (is_string($features)) {
                    $product->set_description(wp_kses_post($features));
                }
            }

            // === KRÓTKI OPIS (WYŁĄCZONY - użytkownik chce puste pole) ===
            // Short Description pozostaje puste

            // === CENA ===
            $price = $product_data['price'] ?? ($waas_post_id ? get_post_meta($waas_post_id, '_waas_price', true) : '');
            if ($price) {
                $price_numeric = $this->extract_price($price);
                if ($price_numeric > 0) {
                    $product->set_regular_price($price_numeric);
                    $product->set_price($price_numeric);
                }
            }

            // === AFFILIATE LINK (z tracking ID) ===
            $affiliate_link = $product_data['affiliate_link'] ?? ($waas_post_id ? get_post_meta($waas_post_id, '_waas_affiliate_link', true) : '');
            if ($affiliate_link) {
                // Dodaj tracking ID jeśli podano
                if ($tracking_id) {
                    $affiliate_link = $this->add_tracking_id_to_url($affiliate_link, $tracking_id);
                }
                $product->set_product_url($affiliate_link);
                $product->set_button_text('Auf Amazon anschauen');
            }

            // === STATUS ===
            $product->set_status('publish');
            $product->set_catalog_visibility('visible');

            // === SKU (ASIN) ===
            $product->set_sku($asin);

            // === ZAPISZ PRODUKT ===
            $wc_product_id = $product->save();

            if (!$wc_product_id) {
                throw new Exception('Failed to save WooCommerce product');
            }

            // === META DATA (v3 — all product data stored on WC product) ===
            update_post_meta($wc_product_id, '_waas_asin', $asin);
            if ($waas_post_id) {
                update_post_meta($wc_product_id, '_waas_source_post_id', $waas_post_id);
            }

            // v3 meta keys per specification
            if ($tracking_id) {
                update_post_meta($wc_product_id, '_waas_partner_tag', sanitize_text_field($tracking_id));
            }
            if (!empty($affiliate_link)) {
                update_post_meta($wc_product_id, '_waas_affiliate_link', esc_url_raw($affiliate_link));
            }
            update_post_meta($wc_product_id, '_waas_source', 'amazon');
            update_post_meta($wc_product_id, '_waas_last_sync', current_time('mysql'));

            // Features as JSON
            $features_raw = $product_data['features'] ?? $product_data['bullet_points'] ?? null;
            if ($features_raw) {
                if (is_array($features_raw)) {
                    update_post_meta($wc_product_id, '_waas_features', wp_json_encode($features_raw));
                } elseif (is_string($features_raw)) {
                    update_post_meta($wc_product_id, '_waas_features', $features_raw);
                }
            }

            // Original price and currency
            if (!empty($product_data['price'])) {
                update_post_meta($wc_product_id, '_waas_original_price', sanitize_text_field($product_data['price']));
            }
            $currency = $product_data['currency'] ?? 'EUR';
            update_post_meta($wc_product_id, '_waas_currency', sanitize_text_field($currency));

            // CRITICAL: Disable reviews for external products (multiple methods)
            update_post_meta($wc_product_id, '_waas_reviews_disabled', 'yes');
            update_post_meta($wc_product_id, 'comment_status', 'closed');
            wp_update_post(array(
                'ID' => $wc_product_id,
                'comment_status' => 'closed'
            ));

            // CRITICAL: Set price update timestamp (for price disclaimer)
            $current_timestamp = current_time('timestamp');
            update_post_meta($wc_product_id, '_waas_price_updated', $current_timestamp);

            // Also save as _waas_last_price_update in MySQL datetime format (for shortcodes)
            $mysql_datetime = current_time('mysql');
            update_post_meta($wc_product_id, '_waas_last_price_update', $mysql_datetime);
            error_log("WAAS: Price timestamp set for product #{$wc_product_id}: {$mysql_datetime}");

            // Auto Update flag (from Google Sheets "Auto Update" column)
            if (isset($product_data['auto_update'])) {
                $auto_update = ($product_data['auto_update'] === '1' || $product_data['auto_update'] === 'true' || $product_data['auto_update'] === true) ? '1' : '0';
                update_post_meta($wc_product_id, '_waas_auto_update', $auto_update);
                error_log("WAAS: Auto update flag set for product #{$wc_product_id}: {$auto_update}");
            } else {
                // Default to auto-update enabled
                update_post_meta($wc_product_id, '_waas_auto_update', '1');
            }

            // Last Price Update (if provided from Google Sheets)
            if (isset($product_data['last_price_update']) && !empty($product_data['last_price_update'])) {
                // Convert German format (DD.MM.YYYY HH:MM) to MySQL datetime
                $german_date = $product_data['last_price_update'];
                // Try to parse it
                try {
                    $dt = DateTime::createFromFormat('d.m.Y H:i', $german_date);
                    if ($dt) {
                        $mysql_format = $dt->format('Y-m-d H:i:s');
                        update_post_meta($wc_product_id, '_waas_last_price_update', $mysql_format);
                        error_log("WAAS: Last price update from Sheets: {$mysql_format}");
                    }
                } catch (Exception $e) {
                    error_log("WAAS: Failed to parse last_price_update: {$german_date}");
                }
            }

            // Brand
            if (!empty($product_data['brand'])) {
                update_post_meta($wc_product_id, '_waas_brand', sanitize_text_field($product_data['brand']));
            }

            // Color
            if (!empty($product_data['color_name']) || !empty($product_data['color'])) {
                $color = $product_data['color_name'] ?? $product_data['color'];
                update_post_meta($wc_product_id, '_waas_color', sanitize_text_field($color));
            }

            // Rating
            if (!empty($product_data['rating'])) {
                update_post_meta($wc_product_id, '_waas_rating', floatval($product_data['rating']));
            }

            // Review count
            if (!empty($product_data['review_count'])) {
                update_post_meta($wc_product_id, '_waas_review_count', intval($product_data['review_count']));
            }

            // === OBRAZKI (Featured + Gallery) ===
            $gallery_images = [];

            // PRIORITY 1: FeaturedImageSource (główne zdjęcie - NAJWYŻSZY PRIORYTET)
            $featured_url = $product_data['FeaturedImageSource'] ?? $product_data['featuredimagesource'] ?? $product_data['featured_image_source'] ?? null;
            if (!empty($featured_url)) {
                $gallery_images[] = $featured_url;
                error_log("WAAS: Found FeaturedImageSource: " . $featured_url);
            }

            // PRIORITY 2: Image0Source...Image9Source (kolejne obrazy do galerii)
            for ($i = 0; $i <= 9; $i++) {
                $key1 = 'Image' . $i . 'Source';
                $key2 = 'image' . $i . 'source';
                $key3 = 'image_' . $i . '_source';
                $url = $product_data[$key1] ?? $product_data[$key2] ?? $product_data[$key3] ?? null;
                if ($url && !empty($url) && !in_array($url, $gallery_images)) {
                    $gallery_images[] = $url;
                    error_log("WAAS: Found Image{$i}Source: " . $url);
                }
            }

            // PRIORITY 3: image_url (pojedynczy - fallback)
            $single_url = $product_data['image_url'] ?? $product_data['Image URL'] ?? null;
            if (!empty($single_url) && !in_array($single_url, $gallery_images)) {
                $gallery_images[] = $single_url;
                error_log("WAAS: Found image_url: " . $single_url);
            }

            // PRIORITY 4: image_urls (array - fallback)
            if (!empty($product_data['image_urls']) && is_array($product_data['image_urls'])) {
                foreach ($product_data['image_urls'] as $url) {
                    if ($url && !empty($url) && !in_array($url, $gallery_images)) {
                        $gallery_images[] = $url;
                    }
                }
            }

            // FALLBACK: Check meta from legacy waas_product if no images found
            if (empty($gallery_images) && $waas_post_id) {
                $meta_image = get_post_meta($waas_post_id, '_waas_image_url', true);
                if ($meta_image) {
                    $gallery_images[] = $meta_image;
                    error_log("WAAS: Found meta image from legacy post: " . $meta_image);
                }
            }

            // Set gallery if we have images
            if (!empty($gallery_images)) {
                error_log("WAAS: Setting product gallery (" . count($gallery_images) . " images) for product #{$wc_product_id}");
                $this->set_product_gallery_from_urls($wc_product_id, $gallery_images, $title);
            } else {
                error_log("WAAS: WARNING - No images found for product #{$wc_product_id}");
            }

            // === KATEGORIE ===
            $category = $product_data['category'] ?? $product_data['category_name'] ?? $product_data['Category'] ?? $product_data['CategoryName'] ?? null;
            error_log("WAAS: Category from data: " . print_r($category, true));
            if ($category && !empty(trim($category))) {
                $this->set_product_category($wc_product_id, trim($category));
                error_log("WAAS: ✓ Category set to: {$category}");
            } else {
                error_log("WAAS: WARNING - No category found in product data");
            }

            // === FORMELLE HINWEISE als Produkt-Attribut ===
            // Wird im "Zusätzliche Information" Tab angezeigt
            $this->add_formelle_hinweise_attribute($wc_product_id);

            error_log("WAAS: ✓ Successfully created WooCommerce product #{$wc_product_id} for ASIN {$asin}");

            return $wc_product_id;

        } catch (Exception $e) {
            error_log("WAAS: WooCommerce product creation error: " . $e->getMessage());
            return new WP_Error('wc_create_failed', $e->getMessage());
        }
    }

    /**
     * Update existing WooCommerce product
     */
    private function update_woocommerce_product($wc_product_id, $waas_post_id, $product_data, $tracking_id = null) {
        try {
            $product = wc_get_product($wc_product_id);
            if (!$product) {
                throw new Exception("WooCommerce product #{$wc_product_id} not found");
            }

            $title = $product_data['title'] ?? '';

            // Update basic data
            if (!empty($title)) {
                $product->set_name(sanitize_text_field($title));
            }

            if (!empty($product_data['price'])) {
                $price = $this->extract_price($product_data['price']);
                if ($price > 0) {
                    $product->set_regular_price($price);
                    $product->set_price($price);
                }
            }

            // Update affiliate link and button text
            if (!empty($product_data['affiliate_link'])) {
                $affiliate_link = $product_data['affiliate_link'];
                if ($tracking_id) {
                    $affiliate_link = $this->add_tracking_id_to_url($affiliate_link, $tracking_id);
                }
                $product->set_product_url($affiliate_link);
                $product->set_button_text('Auf Amazon anschauen');
            }

            // Update features as description
            $features = $product_data['features'] ?? $product_data['bullet_points'] ?? null;
            if ($features) {
                if (is_array($features)) {
                    $features_html = '<ul class="waas-features">';
                    foreach ($features as $feature) {
                        $features_html .= '<li>' . esc_html($feature) . '</li>';
                    }
                    $features_html .= '</ul>';
                    $product->set_description($features_html);
                } elseif (is_string($features) && !empty($features)) {
                    $product->set_description(wp_kses_post($features));
                }
            }

            // Short description empty
            $product->set_short_description('');

            $product->save();

            // === UPDATE IMAGES (same logic as create) ===
            $gallery_images = [];

            // FeaturedImageSource first
            $featured_url = $product_data['FeaturedImageSource'] ?? $product_data['featuredimagesource'] ?? null;
            if (!empty($featured_url)) {
                $gallery_images[] = $featured_url;
                error_log("WAAS Update: Found FeaturedImageSource: " . $featured_url);
            }

            // Image0Source...Image9Source
            for ($i = 0; $i <= 9; $i++) {
                $key1 = 'Image' . $i . 'Source';
                $key2 = 'image' . $i . 'source';
                $url = $product_data[$key1] ?? $product_data[$key2] ?? null;
                if ($url && !empty($url) && !in_array($url, $gallery_images)) {
                    $gallery_images[] = $url;
                    error_log("WAAS Update: Found Image{$i}Source: " . $url);
                }
            }

            // Fallback image_url
            $single_url = $product_data['image_url'] ?? null;
            if (!empty($single_url) && !in_array($single_url, $gallery_images)) {
                $gallery_images[] = $single_url;
            }

            if (!empty($gallery_images)) {
                error_log("WAAS Update: Setting " . count($gallery_images) . " images for product #{$wc_product_id}");
                $this->set_product_gallery_from_urls($wc_product_id, $gallery_images, $title);
            }

            // === UPDATE CATEGORY ===
            $category = $product_data['category'] ?? $product_data['category_name'] ?? $product_data['Category'] ?? null;
            if ($category && !empty(trim($category))) {
                $this->set_product_category($wc_product_id, trim($category));
                error_log("WAAS Update: Category set to: {$category}");
            }

            // Update timestamp
            update_post_meta($wc_product_id, '_waas_last_price_update', current_time('mysql'));

            error_log("WAAS: ✓ Updated WooCommerce product #{$wc_product_id}");

            return $wc_product_id;

        } catch (Exception $e) {
            error_log("WAAS: WooCommerce product update error: " . $e->getMessage());
            return new WP_Error('wc_update_failed', $e->getMessage());
        }
    }

    /**
     * Find WooCommerce product by ASIN
     */
    private function find_woocommerce_product_by_asin($asin) {
        $args = array(
            'post_type' => 'product',
            'meta_query' => array(
                array(
                    'key' => '_waas_asin',
                    'value' => $asin,
                    'compare' => '='
                )
            ),
            'posts_per_page' => 1,
            'fields' => 'ids'
        );

        $products = get_posts($args);
        return !empty($products) ? $products[0] : null;
    }

    /**
     * Set product category
     */
    private function set_product_category($product_id, $category_name) {
        $term = get_term_by('name', $category_name, 'product_cat');

        if (!$term) {
            // Create category if it doesn't exist
            $term_data = wp_insert_term($category_name, 'product_cat');
            if (!is_wp_error($term_data)) {
                wp_set_post_terms($product_id, array($term_data['term_id']), 'product_cat');
            }
        } else {
            wp_set_post_terms($product_id, array($term->term_id), 'product_cat');
        }
    }

    /**
     * Add "Formelle Hinweise" as product attribute
     * Will be displayed in "Zusätzliche Information" tab
     */
    private function add_formelle_hinweise_attribute($product_id) {
        try {
            // Get the product
            $product = wc_get_product($product_id);
            if (!$product) {
                error_log("WAAS: Cannot add Formelle Hinweise - product #{$product_id} not found");
                return;
            }

            // The full German legal text with emoji (without timestamp per user request)
            $attribute_value = "🔸 Wir sind nicht der Verkäufer - Wir verkaufen dieses Produkt nicht selbst. Wir sind weder Hersteller, Händler noch Distributor. Unsere Website dient der Information und Empfehlung von Produkten, die bei Amazon.de erhältlich sind.\n\n🔸 Keine Bestellannahme - Wir nehmen keine Bestellungen entgegen. Der Kauf erfolgt ausschließlich über Amazon.de. Zahlungen werden nicht an uns gesendet.\n\n🔸 Produktfragen und Verfügbarkeit - Wir können keine Fragen zur Produktverfügbarkeit, Lieferzeit oder Funktionen beantworten. Bitte wenden Sie sich an: Den Verkäufer auf Amazon oder den Hersteller des Produkts.\n\n🔸 Reklamationen und Retouren - Wir können keine Reklamationen, Retouren oder Streitigkeiten bearbeiten. Wenden Sie sich bei Problemen direkt an Amazon oder den Verkäufer.\n\n🔸 Preisinformationen - Preise und Verfügbarkeit entsprechen dem angegebenen Stand und können sich ändern. Maßgeblich ist der Preis auf Amazon.de zum Kaufzeitpunkt.\n\n🔸 Versandkosten - Preise inkl. MwSt., ggf. zzgl. Versandkosten. Prime-Mitglieder erhalten oft kostenfreien Versand.";

            // Create/get the attribute taxonomy
            $attribute_name = 'Formelle Hinweise';
            $attribute_slug = 'formelle-hinweise';
            $attribute_taxonomy = 'pa_' . $attribute_slug;

            // Check if WooCommerce attribute functions are available
            if (!function_exists('wc_create_attribute')) {
                error_log("WAAS: wc_create_attribute function not available");
                return;
            }

            // Check if attribute exists in WooCommerce
            $attribute_id = wc_attribute_taxonomy_id_by_name($attribute_slug);

            if (!$attribute_id) {
                // Create the attribute in WooCommerce
                $attribute_id = wc_create_attribute(array(
                    'name' => $attribute_name,
                    'slug' => $attribute_slug,
                    'type' => 'text',
                    'order_by' => 'menu_order',
                    'has_archives' => false,
                ));

                if (is_wp_error($attribute_id)) {
                    error_log("WAAS: Failed to create attribute: " . $attribute_id->get_error_message());
                    return;
                }

                error_log("WAAS: Created attribute '{$attribute_name}' with ID {$attribute_id}");
            }

            // Register taxonomy if not exists
            if (!taxonomy_exists($attribute_taxonomy)) {
                register_taxonomy($attribute_taxonomy, 'product', array(
                    'label' => $attribute_name,
                    'public' => false,
                    'hierarchical' => false,
                ));
            }

            // Create term for the attribute value if it doesn't exist
            $term = get_term_by('name', $attribute_value, $attribute_taxonomy);

            if (!$term) {
                $term_result = wp_insert_term($attribute_value, $attribute_taxonomy);

                if (is_wp_error($term_result)) {
                    error_log("WAAS: Failed to create term: " . $term_result->get_error_message());
                    return;
                }

                $term = get_term($term_result['term_id'], $attribute_taxonomy);
            }

            if (!$term || is_wp_error($term)) {
                error_log("WAAS: Failed to get term for Formelle Hinweise");
                return;
            }

            // Assign term to product
            wp_set_object_terms($product_id, $term->term_id, $attribute_taxonomy);

            // Set product attributes
            $attributes = $product->get_attributes();

            // Check if WC_Product_Attribute class exists
            if (!class_exists('WC_Product_Attribute')) {
                error_log("WAAS: WC_Product_Attribute class not found");
                return;
            }

            $attribute = new WC_Product_Attribute();
            $attribute->set_id($attribute_id);
            $attribute->set_name($attribute_taxonomy);
            $attribute->set_options(array($term->term_id));
            $attribute->set_visible(true);
            $attribute->set_variation(false);

            $attributes[$attribute_taxonomy] = $attribute;
            $product->set_attributes($attributes);
            $product->save();

            error_log("WAAS: Added 'Formelle Hinweise' attribute to product #{$product_id}");

        } catch (Exception $e) {
            error_log("WAAS: Error adding Formelle Hinweise attribute: " . $e->getMessage());
        } catch (Error $e) {
            error_log("WAAS: Fatal error adding Formelle Hinweise attribute: " . $e->getMessage());
        }
    }

    /**
     * Add tracking ID to Amazon URL
     */
    private function add_tracking_id_to_url($url, $tracking_id) {
        if (empty($url) || empty($tracking_id)) {
            return $url;
        }

        // Parse URL
        $parsed = parse_url($url);
        if (!$parsed) {
            return $url;
        }

        // Parse query string
        $query_params = array();
        if (isset($parsed['query'])) {
            parse_str($parsed['query'], $query_params);
        }

        // Replace or add tracking ID
        $query_params['tag'] = $tracking_id;

        // Rebuild URL
        $new_url = $parsed['scheme'] . '://' . $parsed['host'];
        if (isset($parsed['path'])) {
            $new_url .= $parsed['path'];
        }
        $new_url .= '?' . http_build_query($query_params);

        error_log("WAAS: Added tracking ID '{$tracking_id}' to URL");

        return $new_url;
    }

    /**
     * Extract price from string
     */
    private function extract_price($price_string) {
        if (is_numeric($price_string)) {
            return floatval($price_string);
        }

        // Remove everything except digits, dot and comma
        $price = preg_replace('/[^0-9.,]/', '', $price_string);

        // Replace comma with dot
        $price = str_replace(',', '.', $price);

        // Convert to float
        $price = floatval($price);

        return $price > 0 ? $price : 0;
    }

    /**
     * List products (v3 — reads from WooCommerce products with _waas_asin meta)
     */
    public function list_products($request) {
        $args = array(
            'post_type' => 'product',
            'posts_per_page' => -1,
            'post_status' => 'publish',
            'meta_query' => array(
                array(
                    'key' => '_waas_asin',
                    'compare' => 'EXISTS',
                ),
            ),
        );

        $query = new WP_Query($args);
        $products = array();

        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();
                $post_id = get_the_ID();
                $wc_product = wc_get_product($post_id);

                $products[] = array(
                    'id' => $post_id,
                    'title' => get_the_title(),
                    'asin' => get_post_meta($post_id, '_waas_asin', true),
                    'price' => $wc_product ? $wc_product->get_regular_price() : '',
                    'original_price' => get_post_meta($post_id, '_waas_original_price', true),
                    'currency' => get_post_meta($post_id, '_waas_currency', true),
                    'partner_tag' => get_post_meta($post_id, '_waas_partner_tag', true),
                    'affiliate_link' => get_post_meta($post_id, '_waas_affiliate_link', true),
                    'source' => get_post_meta($post_id, '_waas_source', true),
                    'last_sync' => get_post_meta($post_id, '_waas_last_sync', true),
                    'rating' => get_post_meta($post_id, '_waas_rating', true),
                    'review_count' => get_post_meta($post_id, '_waas_review_count', true),
                    'permalink' => get_permalink(),
                );
            }
            wp_reset_postdata();
        }

        return new WP_REST_Response(array(
            'success' => true,
            'count' => count($products),
            'products' => $products,
        ), 200);
    }

    /**
     * Bulk sync all WAAS products to WooCommerce
     */
    public function bulk_sync_woocommerce($request) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('wc_not_active', 'WooCommerce is not active', array('status' => 400));
        }

        $args = array(
            'post_type' => 'waas_product',
            'posts_per_page' => -1,
            'post_status' => 'publish',
        );

        $query = new WP_Query($args);
        $synced = 0;
        $failed = 0;

        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();
                $post_id = get_the_ID();
                $asin = get_post_meta($post_id, '_waas_asin', true);

                $product_data = array(
                    'asin' => $asin,
                    'title' => get_the_title(),
                    'price' => get_post_meta($post_id, '_waas_price', true),
                    'affiliate_link' => get_post_meta($post_id, '_waas_affiliate_link', true),
                    'image_url' => get_post_meta($post_id, '_waas_image_url', true),
                );

                $result = $this->create_woocommerce_product_direct($post_id, $product_data);

                if (is_wp_error($result)) {
                    $failed++;
                } else {
                    $synced++;
                }
            }
            wp_reset_postdata();
        }

        return new WP_REST_Response(array(
            'success' => true,
            'synced' => $synced,
            'failed' => $failed,
        ), 200);
    }

    /**
     * Set product image from URL (download and attach to product)
     *
     * @param int $product_id WooCommerce product ID
     * @param string $image_url Image URL
     * @param string $title Product title (for alt text)
     * @return int|WP_Error Attachment ID or error
     */
    private function set_product_image_from_url($product_id, $image_url, $title = '') {
        if (empty($image_url)) {
            return new WP_Error('no_image', 'No image URL provided');
        }

        // Check if we already have this image attached to the product
        $existing_image_id = get_post_thumbnail_id($product_id);
        if ($existing_image_id) {
            $existing_url = get_post_meta($existing_image_id, '_waas_source_url', true);
            if ($existing_url === $image_url) {
                // Same image already attached, skip
                return $existing_image_id;
            }
        }

        // Download image
        require_once(ABSPATH . 'wp-admin/includes/file.php');
        require_once(ABSPATH . 'wp-admin/includes/media.php');
        require_once(ABSPATH . 'wp-admin/includes/image.php');

        // Get the file
        $tmp = download_url($image_url);

        if (is_wp_error($tmp)) {
            error_log("WAAS: Failed to download image: " . $tmp->get_error_message());
            return $tmp;
        }

        // Get file extension from URL
        $path_info = pathinfo($image_url);
        $ext = isset($path_info['extension']) ? $path_info['extension'] : 'jpg';

        // Clean filename
        $filename = sanitize_file_name($title ? $title : 'product-image') . '.' . $ext;

        // Prepare file array
        $file_array = array(
            'name' => $filename,
            'tmp_name' => $tmp
        );

        // Upload to media library
        $attachment_id = media_handle_sideload($file_array, $product_id, $title);

        // Clean up temp file
        if (file_exists($tmp)) {
            @unlink($tmp);
        }

        if (is_wp_error($attachment_id)) {
            error_log("WAAS: Failed to attach image: " . $attachment_id->get_error_message());
            return $attachment_id;
        }

        // Save source URL as meta
        update_post_meta($attachment_id, '_waas_source_url', $image_url);

        // Set as featured image
        set_post_thumbnail($product_id, $attachment_id);

        // Set alt text
        if ($title) {
            update_post_meta($attachment_id, '_wp_attachment_image_alt', sanitize_text_field($title));
        }

        return $attachment_id;
    }

    /**
     * Set product gallery from array of image URLs
     * First image = Featured image, rest = Gallery
     */
    private function set_product_gallery_from_urls($product_id, $image_urls, $title = '') {
        if (!is_array($image_urls) || count($image_urls) === 0) {
            return;
        }

        $gallery_ids = array();
        $featured_id = null;

        foreach ($image_urls as $index => $image_url) {
            if (empty($image_url)) {
                continue;
            }

            // Download and attach image
            $image_name = $title ? $title . ' - Image ' . ($index + 1) : 'Product Image ' . ($index + 1);
            $attachment_id = $this->set_product_image_from_url($product_id, $image_url, $image_name);

            if ($attachment_id && !is_wp_error($attachment_id)) {
                if ($index === 0) {
                    // First image = Featured image (already set by set_product_image_from_url)
                    $featured_id = $attachment_id;
                    error_log("WAAS: ✓ Featured image set (ID: {$attachment_id})");
                } else {
                    // Rest = Gallery
                    $gallery_ids[] = $attachment_id;
                    error_log("WAAS: ✓ Gallery image added (ID: {$attachment_id})");
                }
            }
        }

        // Set gallery images (if any)
        if (!empty($gallery_ids)) {
            $product = wc_get_product($product_id);
            if ($product) {
                $product->set_gallery_image_ids($gallery_ids);
                $product->save();
                error_log("WAAS: ✓ Product gallery set (" . count($gallery_ids) . " images)");
            }
        }

        error_log("WAAS: ✓ Total images processed: " . count($image_urls) . " (1 featured + " . count($gallery_ids) . " gallery)");
    }

    /**
     * Migrate all waas_product posts to WooCommerce products (C4)
     *
     * POST /waas/v1/products/migrate-to-wc
     *
     * @param WP_REST_Request $request Request object
     * @return WP_REST_Response Migration results
     */
    public function migrate_waas_products_to_wc($request) {
        if (!class_exists('WooCommerce') || !class_exists('WC_Product_External')) {
            return new WP_Error('wc_not_active', 'WooCommerce is required for migration', array('status' => 400));
        }

        $delete_originals = $request->get_param('delete_originals');

        // Get all waas_product posts
        $waas_products = get_posts(array(
            'post_type' => 'waas_product',
            'posts_per_page' => -1,
            'post_status' => 'any',
        ));

        $results = array(
            'total' => count($waas_products),
            'migrated' => 0,
            'skipped' => 0,
            'failed' => 0,
            'deleted' => 0,
            'details' => array(),
        );

        foreach ($waas_products as $waas_post) {
            $asin = get_post_meta($waas_post->ID, '_waas_asin', true);

            if (empty($asin)) {
                $results['skipped']++;
                $results['details'][] = array(
                    'waas_id' => $waas_post->ID,
                    'status' => 'skipped',
                    'reason' => 'No ASIN',
                );
                continue;
            }

            // Check if WC product already exists for this ASIN
            $existing_wc_id = $this->find_woocommerce_product_by_asin($asin);
            if ($existing_wc_id) {
                $results['skipped']++;
                $results['details'][] = array(
                    'waas_id' => $waas_post->ID,
                    'asin' => $asin,
                    'status' => 'skipped',
                    'reason' => 'WC product already exists',
                    'wc_product_id' => $existing_wc_id,
                );

                // Delete original if requested
                if ($delete_originals) {
                    wp_delete_post($waas_post->ID, true);
                    $results['deleted']++;
                }
                continue;
            }

            // Build product_data from waas_product meta
            $product_data = array(
                'asin' => $asin,
                'title' => $waas_post->post_title,
                'price' => get_post_meta($waas_post->ID, '_waas_price', true),
                'affiliate_link' => get_post_meta($waas_post->ID, '_waas_affiliate_link', true),
                'image_url' => get_post_meta($waas_post->ID, '_waas_image_url', true),
                'rating' => get_post_meta($waas_post->ID, '_waas_rating', true),
                'review_count' => get_post_meta($waas_post->ID, '_waas_review_count', true),
                'brand' => get_post_meta($waas_post->ID, '_waas_brand', true),
                'color_name' => get_post_meta($waas_post->ID, '_waas_color', true),
            );

            // Features
            $features = get_post_meta($waas_post->ID, '_waas_features', true);
            if ($features) {
                $product_data['features'] = $features;
            }

            // Migrate
            $wc_product_id = $this->create_woocommerce_product_direct($waas_post->ID, $product_data);

            if (is_wp_error($wc_product_id)) {
                $results['failed']++;
                $results['details'][] = array(
                    'waas_id' => $waas_post->ID,
                    'asin' => $asin,
                    'status' => 'failed',
                    'error' => $wc_product_id->get_error_message(),
                );
            } else {
                $results['migrated']++;
                $results['details'][] = array(
                    'waas_id' => $waas_post->ID,
                    'asin' => $asin,
                    'status' => 'migrated',
                    'wc_product_id' => $wc_product_id,
                );

                // Delete original if requested
                if ($delete_originals) {
                    wp_delete_post($waas_post->ID, true);
                    $results['deleted']++;
                }
            }
        }

        error_log("WAAS Migration: {$results['migrated']} migrated, {$results['skipped']} skipped, {$results['failed']} failed, {$results['deleted']} deleted");

        return new WP_REST_Response(array(
            'success' => true,
            'results' => $results,
        ), 200);
    }

    /**
     * Check admin permission
     */
    public function check_admin_permission() {
        return current_user_can('manage_options');
    }

    /**
     * Check read permission
     */
    public function check_read_permission() {
        return current_user_can('read');
    }
}
