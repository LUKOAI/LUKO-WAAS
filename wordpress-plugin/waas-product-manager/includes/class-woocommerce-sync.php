<?php
/**
 * WAAS WooCommerce Sync (Legacy)
 *
 * v3 Note: New imports go directly to WC via WAAS_REST_API_V2::import_products().
 * This class handles legacy sync from waas_product → WC for backward compatibility.
 *
 * @package WAAS_Product_Manager
 * @since 1.0.0
 * @deprecated 3.0.0 Direct WC import via REST API v2
 */

if (!defined('ABSPATH')) {
    exit;
}

class WAAS_WooCommerce_Sync {

    /**
     * Instance of this class
     *
     * @var object
     */
    protected static $instance = null;

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
        // Hook do synchronizacji po imporcie produktu
        add_action('waas_product_imported', array($this, 'sync_to_woocommerce'), 10, 2);
        add_action('waas_product_updated', array($this, 'sync_to_woocommerce'), 10, 2);

        // Admin notices
        add_action('admin_notices', array($this, 'admin_notices'));
    }

    /**
     * Sprawdź czy WooCommerce jest aktywny
     */
    public function is_woocommerce_active() {
        return class_exists('WooCommerce');
    }

    /**
     * Wyświetl admin notice jeśli WooCommerce nie jest aktywny
     */
    public function admin_notices() {
        if (!$this->is_woocommerce_active() && current_user_can('manage_options')) {
            ?>
            <div class="notice notice-warning">
                <p>
                    <strong>WAAS Product Manager:</strong>
                    WooCommerce is not active. Product sync to WooCommerce is disabled.
                    <a href="<?php echo admin_url('plugins.php'); ?>">Activate WooCommerce</a>
                </p>
            </div>
            <?php
        }
    }

    /**
     * Synchronizuj produkt WAAS do WooCommerce
     *
     * @param int $post_id WAAS product post ID
     * @param array $product_data Dane produktu z Amazon
     * @return int|WP_Error WooCommerce product ID lub błąd
     */
    public function sync_to_woocommerce($post_id, $product_data) {
        // Sprawdź czy WooCommerce jest aktywny
        if (!$this->is_woocommerce_active()) {
            error_log('WAAS WooCommerce Sync: WooCommerce is not active');
            return new WP_Error('woocommerce_inactive', 'WooCommerce is not active');
        }

        // Pobierz dane produktu WAAS
        $asin = get_post_meta($post_id, '_waas_asin', true);

        if (empty($asin)) {
            error_log('WAAS WooCommerce Sync: Product has no ASIN (Post ID: ' . $post_id . ')');
            return new WP_Error('no_asin', 'Product has no ASIN');
        }

        error_log("WAAS WooCommerce Sync: Starting sync for ASIN {$asin} (Post ID: {$post_id})");

        // Sprawdź czy produkt WooCommerce już istnieje dla tego ASIN
        $wc_product_id = $this->get_woocommerce_product_by_asin($asin);

        if ($wc_product_id) {
            error_log("WAAS WooCommerce Sync: Found existing WooCommerce product #{$wc_product_id} for ASIN {$asin}");
            // Update istniejącego produktu
            return $this->update_woocommerce_product($wc_product_id, $post_id, $product_data);
        } else {
            error_log("WAAS WooCommerce Sync: Creating new WooCommerce product for ASIN {$asin}");
            // Utwórz nowy produkt
            return $this->create_woocommerce_product($post_id, $product_data);
        }
    }

    /**
     * Znajdź produkt WooCommerce po ASIN
     *
     * @param string $asin Amazon ASIN
     * @return int|false Product ID lub false
     */
    private function get_woocommerce_product_by_asin($asin) {
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

        return !empty($products) ? $products[0] : false;
    }

    /**
     * Utwórz nowy produkt WooCommerce (External/Affiliate)
     *
     * @param int $waas_post_id WAAS product post ID
     * @param array $product_data Dane produktu
     * @return int|WP_Error Product ID lub błąd
     */
    private function create_woocommerce_product($waas_post_id, $product_data) {
        try {
            error_log("WAAS WooCommerce Sync: create_woocommerce_product() called for post #{$waas_post_id}");

            // Pobierz dane z WAAS product
            $asin = get_post_meta($waas_post_id, '_waas_asin', true);
            $title = get_the_title($waas_post_id);
            $description = get_post_field('post_content', $waas_post_id);
            $short_description = get_post_field('post_excerpt', $waas_post_id);

            error_log("WAAS WooCommerce Sync: Product title: {$title}");

            // Pobierz meta
            $price = get_post_meta($waas_post_id, '_waas_price', true);
            $brand = get_post_meta($waas_post_id, '_waas_brand', true);
            $image_url = get_post_meta($waas_post_id, '_waas_image_url', true);
            $affiliate_link = get_post_meta($waas_post_id, '_waas_affiliate_link', true);
            $features = get_post_meta($waas_post_id, '_waas_features', true);

            error_log("WAAS WooCommerce Sync: Price: {$price}, Brand: {$brand}, Image: {$image_url}");

            // Sprawdź czy klasa WC_Product_External istnieje
            if (!class_exists('WC_Product_External')) {
                throw new Exception('WC_Product_External class not found. Is WooCommerce fully loaded?');
            }

            // Utwórz produkt WooCommerce typu External/Affiliate
            $product = new WC_Product_External();

            // Podstawowe dane
            $product->set_name($title);
            $product->set_status('publish');
            $product->set_catalog_visibility('visible');

            error_log("WAAS WooCommerce Sync: Set basic product data");

            // Description - use features/BulletPoints as main description
            if (!empty($features)) {
                $features_html = $this->format_features_html($features);
                $product->set_description($features_html);
            } else if (!empty($description)) {
                $product->set_description($description);
            }

            // Short description - always empty per user request
            $product->set_short_description('');

            // Cena (display only - External products nie mają własnej ceny)
            if (!empty($price)) {
                $price_numeric = $this->extract_price($price);
                if ($price_numeric) {
                    $product->set_regular_price($price_numeric);
                    $product->set_price($price_numeric);
                    error_log("WAAS WooCommerce Sync: Set price: {$price_numeric}");
                }
            }

            // External product URL (link do Amazon)
            if (!empty($affiliate_link)) {
                $product->set_product_url($affiliate_link);
                $product->set_button_text('Auf Amazon anschauen');
                error_log("WAAS WooCommerce Sync: Set affiliate link: {$affiliate_link}");
            }

            // Set ASIN as SKU (Artikelnummer)
            if (!empty($asin)) {
                $product->set_sku($asin);
                error_log("WAAS WooCommerce Sync: Set SKU (ASIN): {$asin}");
            }

            // Zapisz produkt
            $wc_product_id = $product->save();

            if (!$wc_product_id) {
                throw new Exception('Failed to create WooCommerce product - save() returned false');
            }

            error_log("WAAS WooCommerce Sync: Product saved with ID: {$wc_product_id}");

            // Zapisz ASIN jako meta (do późniejszego wyszukiwania)
            update_post_meta($wc_product_id, '_waas_asin', $asin);
            update_post_meta($wc_product_id, '_waas_source_post_id', $waas_post_id);

            // Dodaj brand jako meta (opcjonalne)
            if (!empty($brand)) {
                update_post_meta($wc_product_id, '_waas_brand', $brand);
            }

            // Ustaw featured image
            if (!empty($image_url)) {
                $this->set_product_image($wc_product_id, $image_url, $title);
            }

            // Synchronizuj kategorie z WAAS product do WooCommerce
            $this->sync_categories($waas_post_id, $wc_product_id);

            error_log("WAAS WooCommerce Sync: ✓ Successfully created WooCommerce product #{$wc_product_id} for ASIN {$asin}");

            return $wc_product_id;

        } catch (Exception $e) {
            error_log('WAAS WooCommerce Sync ERROR: ' . $e->getMessage());
            error_log('WAAS WooCommerce Sync ERROR Stack: ' . $e->getTraceAsString());
            return new WP_Error('create_failed', $e->getMessage());
        }
    }

    /**
     * Aktualizuj istniejący produkt WooCommerce
     *
     * @param int $wc_product_id WooCommerce product ID
     * @param int $waas_post_id WAAS product post ID
     * @param array $product_data Dane produktu
     * @return int|WP_Error Product ID lub błąd
     */
    private function update_woocommerce_product($wc_product_id, $waas_post_id, $product_data) {
        try {
            $product = wc_get_product($wc_product_id);

            if (!$product) {
                throw new Exception("WooCommerce product #{$wc_product_id} not found");
            }

            // Aktualizuj tytuł
            $title = get_the_title($waas_post_id);
            $product->set_name($title);

            // Aktualizuj opisy
            $description = get_post_field('post_content', $waas_post_id);
            if (!empty($description)) {
                $product->set_description($description);
            }

            $short_description = get_post_field('post_excerpt', $waas_post_id);
            if (!empty($short_description)) {
                $product->set_short_description($short_description);
            }

            // Aktualizuj cenę
            $price = get_post_meta($waas_post_id, '_waas_price', true);
            if (!empty($price)) {
                $price_numeric = $this->extract_price($price);
                if ($price_numeric) {
                    $product->set_regular_price($price_numeric);
                    $product->set_price($price_numeric);
                }
            }

            // Aktualizuj affiliate link
            $affiliate_link = get_post_meta($waas_post_id, '_waas_affiliate_link', true);
            if (!empty($affiliate_link)) {
                $product->set_product_url($affiliate_link);
            }

            // Aktualizuj obrazek
            $image_url = get_post_meta($waas_post_id, '_waas_image_url', true);
            if (!empty($image_url)) {
                $this->set_product_image($wc_product_id, $image_url, $title);
            }

            // Zapisz
            $product->save();

            // Synchronizuj kategorie
            $this->sync_categories($waas_post_id, $wc_product_id);

            error_log("WAAS WooCommerce Sync: ✓ Updated WooCommerce product #{$wc_product_id}");

            return $wc_product_id;

        } catch (Exception $e) {
            error_log('WAAS WooCommerce Sync Update ERROR: ' . $e->getMessage());
            return new WP_Error('update_failed', $e->getMessage());
        }
    }

    /**
     * Ustaw featured image produktu z URL
     *
     * @param int $product_id Product ID
     * @param string $image_url URL obrazka
     * @param string $title Tytuł (dla alt text)
     * @return int|false Attachment ID lub false
     */
    private function set_product_image($product_id, $image_url, $title) {
        require_once(ABSPATH . 'wp-admin/includes/media.php');
        require_once(ABSPATH . 'wp-admin/includes/file.php');
        require_once(ABSPATH . 'wp-admin/includes/image.php');

        try {
            // Pobierz obrazek
            $tmp = download_url($image_url);

            if (is_wp_error($tmp)) {
                error_log('WAAS: Failed to download image: ' . $tmp->get_error_message());
                return false;
            }

            // Przygotuj dane pliku
            $file_array = array(
                'name' => basename($image_url),
                'tmp_name' => $tmp
            );

            // Upload do Media Library
            $attachment_id = media_handle_sideload($file_array, $product_id, $title);

            // Usuń tymczasowy plik
            @unlink($tmp);

            if (is_wp_error($attachment_id)) {
                error_log('WAAS: Failed to sideload image: ' . $attachment_id->get_error_message());
                return false;
            }

            // Ustaw jako featured image
            set_post_thumbnail($product_id, $attachment_id);

            return $attachment_id;

        } catch (Exception $e) {
            error_log('WAAS: Image upload error: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Synchronizuj kategorie z WAAS product do WooCommerce
     *
     * @param int $waas_post_id WAAS product post ID
     * @param int $wc_product_id WooCommerce product ID
     */
    private function sync_categories($waas_post_id, $wc_product_id) {
        // Pobierz kategorie z WAAS product (taxonomy: product_category)
        $waas_categories = wp_get_post_terms($waas_post_id, 'product_category', array('fields' => 'names'));

        if (empty($waas_categories) || is_wp_error($waas_categories)) {
            return;
        }

        // Mapuj na kategorie WooCommerce (product_cat)
        $wc_category_ids = array();

        foreach ($waas_categories as $category_name) {
            // Znajdź lub utwórz kategorię WooCommerce
            $term = get_term_by('name', $category_name, 'product_cat');

            if (!$term) {
                // Utwórz kategorię jeśli nie istnieje
                $term_data = wp_insert_term($category_name, 'product_cat');
                if (!is_wp_error($term_data)) {
                    $wc_category_ids[] = $term_data['term_id'];
                }
            } else {
                $wc_category_ids[] = $term->term_id;
            }
        }

        // Przypisz kategorie do produktu WooCommerce
        if (!empty($wc_category_ids)) {
            wp_set_post_terms($wc_product_id, $wc_category_ids, 'product_cat');
        }
    }

    /**
     * Formatuj features jako HTML lista
     *
     * @param string $features Features (oddzielone \n)
     * @return string HTML
     */
    private function format_features_html($features) {
        if (empty($features)) {
            return '';
        }

        $features_array = explode("\n", $features);
        $features_array = array_filter(array_map('trim', $features_array));

        if (empty($features_array)) {
            return '';
        }

        $html = '<ul class="waas-product-features">';
        foreach ($features_array as $feature) {
            $html .= '<li>' . esc_html($feature) . '</li>';
        }
        $html .= '</ul>';

        return $html;
    }

    /**
     * Wyciągnij numeryczną cenę ze stringa
     *
     * @param string $price_string Cena jako string (np. "$99.99", "€50,00")
     * @return float|false Cena numeryczna lub false
     */
    private function extract_price($price_string) {
        // Usuń wszystko oprócz cyfr, kropki i przecinka
        $price = preg_replace('/[^0-9.,]/', '', $price_string);

        // Zamień przecinek na kropkę
        $price = str_replace(',', '.', $price);

        // Konwertuj na float
        $price = floatval($price);

        return $price > 0 ? $price : false;
    }

    /**
     * Bulk sync wszystkich produktów WAAS do WooCommerce
     *
     * @return array Statystyki sync
     */
    public function bulk_sync_all_products() {
        if (!$this->is_woocommerce_active()) {
            return array('error' => 'WooCommerce is not active');
        }

        // Pobierz wszystkie produkty WAAS
        $waas_products = get_posts(array(
            'post_type' => 'waas_product',
            'posts_per_page' => -1,
            'post_status' => 'publish'
        ));

        $stats = array(
            'total' => count($waas_products),
            'synced' => 0,
            'errors' => 0
        );

        foreach ($waas_products as $product) {
            $result = $this->sync_to_woocommerce($product->ID, array());

            if (is_wp_error($result)) {
                $stats['errors']++;
            } else {
                $stats['synced']++;
            }
        }

        return $stats;
    }
}
