<?php
/**
 * Product Importer - Import and update Amazon products
 *
 * @package WAAS_Product_Manager
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WAAS Product Importer Class
 */
class WAAS_Product_Importer {

    /**
     * Import product by ASIN
     *
     * @param string $asin Product ASIN
     * @param array $options Additional options
     * @return int|WP_Error Post ID on success, WP_Error on failure
     */
    public function import_by_asin($asin, $options = array()) {
        // Fetch product data from Amazon API
        $amazon_api = WAAS_Amazon_API::get_instance();
        $product_data = $amazon_api->get_item($asin);

        if (is_wp_error($product_data)) {
            return $product_data;
        }

        if (!$product_data) {
            return new WP_Error('product_not_found', __('Product not found on Amazon', 'waas-pm'));
        }

        // Import the product
        return $this->import_product($product_data, $options);
    }

    /**
     * Import product with data
     *
     * @param array $product_data Product data from Amazon API
     * @param array $options Additional options
     * @return int|WP_Error Post ID on success, WP_Error on failure
     */
    public function import_product($product_data, $options = array()) {
        // Check if product already exists
        $existing_post_id = $this->get_product_by_asin($product_data['asin']);

        if ($existing_post_id) {
            // Update existing product
            return $this->update_product_post($existing_post_id, $product_data);
        }

        // Create new product post
        $post_data = array(
            'post_title' => $product_data['title'],
            'post_type' => 'waas_product',
            'post_status' => isset($options['post_status']) ? $options['post_status'] : 'publish',
            'post_content' => isset($product_data['description']) ? $product_data['description'] : '',
        );

        $post_id = wp_insert_post($post_data);

        if (is_wp_error($post_id)) {
            return $post_id;
        }

        // Save product meta
        $this->save_product_meta($post_id, $product_data);

        // Set category if provided
        if (isset($options['category'])) {
            wp_set_object_terms($post_id, $options['category'], 'product_category');
        }

        // Fire action hook for integrations (e.g., WooCommerce sync)
        do_action('waas_product_imported', $post_id, $product_data);

        return $post_id;
    }

    /**
     * Update product by ASIN
     *
     * @param string $asin Product ASIN
     * @return int|WP_Error Post ID on success, WP_Error on failure
     */
    public function update_product_by_asin($asin) {
        // Get existing post
        $post_id = $this->get_product_by_asin($asin);

        if (!$post_id) {
            return new WP_Error('product_not_found', __('Product not found in WordPress', 'waas-pm'));
        }

        // Check if auto-sync is enabled
        $auto_sync = get_post_meta($post_id, '_waas_auto_sync', true);

        if ($auto_sync !== '1') {
            return new WP_Error('sync_disabled', __('Auto-sync is disabled for this product', 'waas-pm'));
        }

        // Refresh cache and get new data
        $cache_manager = WAAS_Cache_Manager::get_instance();
        $product_data = $cache_manager->refresh_product_cache($asin);

        if (is_wp_error($product_data)) {
            return $product_data;
        }

        // Update product
        return $this->update_product_post($post_id, $product_data);
    }

    /**
     * Update all products (daily cron job)
     *
     * @param int $limit Limit number of products to update
     * @return array Update results
     */
    public function update_all_products($limit = 100) {
        // Get all products with auto-sync enabled
        $args = array(
            'post_type' => 'waas_product',
            'posts_per_page' => $limit,
            'post_status' => 'publish',
            'meta_query' => array(
                array(
                    'key' => '_waas_auto_sync',
                    'value' => '1',
                ),
            ),
        );

        $query = new WP_Query($args);

        $results = array(
            'updated' => 0,
            'errors' => 0,
            'skipped' => 0,
        );

        if ($query->have_posts()) {
            // Collect ASINs
            $asins = array();

            while ($query->have_posts()) {
                $query->the_post();
                $asin = get_post_meta(get_the_ID(), '_waas_asin', true);

                if ($asin) {
                    $asins[get_the_ID()] = $asin;
                }
            }
            wp_reset_postdata();

            // Batch update (10 ASINs per API call)
            $amazon_api = WAAS_Amazon_API::get_instance();
            $asin_batches = array_chunk($asins, 10, true);

            foreach ($asin_batches as $batch) {
                // Fetch data from Amazon API
                $products_data = $amazon_api->get_items(array_values($batch));

                if (is_wp_error($products_data)) {
                    $results['errors'] += count($batch);
                    continue;
                }

                // Update each product
                foreach ($batch as $post_id => $asin) {
                    if (isset($products_data[$asin])) {
                        $update_result = $this->update_product_post($post_id, $products_data[$asin]);

                        if (is_wp_error($update_result)) {
                            $results['errors']++;
                        } else {
                            $results['updated']++;
                        }
                    } else {
                        $results['skipped']++;
                    }
                }

                // Rate limiting: 1 TPS (1 second per request)
                sleep(1);
            }
        }

        return $results;
    }

    /**
     * Get product post ID by ASIN
     *
     * @param string $asin Product ASIN
     * @return int|false Post ID or false if not found
     */
    private function get_product_by_asin($asin) {
        $args = array(
            'post_type' => 'waas_product',
            'posts_per_page' => 1,
            'post_status' => 'any',
            'meta_query' => array(
                array(
                    'key' => '_waas_asin',
                    'value' => $asin,
                ),
            ),
            'fields' => 'ids',
        );

        $query = new WP_Query($args);

        if ($query->have_posts()) {
            return $query->posts[0];
        }

        return false;
    }

    /**
     * Update product post with new data
     *
     * @param int $post_id Post ID
     * @param array $product_data Product data
     * @return int|WP_Error Post ID on success, WP_Error on failure
     */
    private function update_product_post($post_id, $product_data) {
        // Update post title if changed
        $post_data = array(
            'ID' => $post_id,
            'post_title' => $product_data['title'],
        );

        $result = wp_update_post($post_data);

        if (is_wp_error($result)) {
            return $result;
        }

        // Update product meta
        $this->save_product_meta($post_id, $product_data);

        // Update sync timestamp
        update_post_meta($post_id, '_waas_last_sync', current_time('mysql'));
        update_post_meta($post_id, '_waas_sync_status', 'success');

        // Fire action hook for integrations (e.g., WooCommerce sync)
        do_action('waas_product_updated', $post_id, $product_data);

        return $post_id;
    }

    /**
     * Save product meta data
     *
     * @param int $post_id Post ID
     * @param array $product_data Product data
     */
    private function save_product_meta($post_id, $product_data) {
        // ASIN
        if (isset($product_data['asin'])) {
            update_post_meta($post_id, '_waas_asin', $product_data['asin']);
        }

        // Brand
        if (isset($product_data['brand'])) {
            update_post_meta($post_id, '_waas_brand', $product_data['brand']);
        }

        // Features
        if (isset($product_data['features']) && is_array($product_data['features'])) {
            update_post_meta($post_id, '_waas_features', implode("\n", $product_data['features']));
        }

        // Image URL (Amazon TOS: cannot download/host images)
        if (isset($product_data['image_url'])) {
            update_post_meta($post_id, '_waas_image_url', $product_data['image_url']);
        }

        // Price
        if (isset($product_data['price'])) {
            update_post_meta($post_id, '_waas_price', $product_data['price']);
            update_post_meta($post_id, '_waas_last_price_update', current_time('mysql'));
        }

        // Savings
        if (isset($product_data['savings_percentage'])) {
            update_post_meta($post_id, '_waas_savings', $product_data['savings_percentage']);
        }

        // Availability
        if (isset($product_data['availability'])) {
            $availability_status = $this->map_availability($product_data['availability']);
            update_post_meta($post_id, '_waas_availability', $availability_status);
        }

        // Prime eligible
        if (isset($product_data['prime_eligible'])) {
            update_post_meta($post_id, '_waas_prime_eligible', $product_data['prime_eligible'] ? '1' : '0');
        }

        // Affiliate link
        if (isset($product_data['affiliate_link'])) {
            update_post_meta($post_id, '_waas_affiliate_link', $product_data['affiliate_link']);
        } elseif (isset($product_data['detail_page_url'])) {
            update_post_meta($post_id, '_waas_affiliate_link', $product_data['detail_page_url']);
        }

        // Enable auto-sync by default
        if (!get_post_meta($post_id, '_waas_auto_sync', true)) {
            update_post_meta($post_id, '_waas_auto_sync', '1');
        }
    }

    /**
     * Map Amazon availability status to our format
     *
     * @param string $amazon_availability Amazon availability string
     * @return string Mapped availability
     */
    private function map_availability($amazon_availability) {
        $amazon_availability = strtolower($amazon_availability);

        if (strpos($amazon_availability, 'available') !== false || strpos($amazon_availability, 'in stock') !== false) {
            return 'in_stock';
        }

        if (strpos($amazon_availability, 'out of stock') !== false || strpos($amazon_availability, 'unavailable') !== false) {
            return 'out_of_stock';
        }

        return 'limited';
    }

    /**
     * Bulk import products
     *
     * @param array $asins Array of ASINs
     * @param array $options Import options
     * @return array Import results
     */
    public function bulk_import($asins, $options = array()) {
        $results = array(
            'imported' => 0,
            'updated' => 0,
            'errors' => 0,
            'details' => array(),
        );

        // Batch fetch from Amazon (10 per request)
        $amazon_api = WAAS_Amazon_API::get_instance();
        $asin_batches = array_chunk($asins, 10);

        foreach ($asin_batches as $batch) {
            $products_data = $amazon_api->get_items($batch);

            if (is_wp_error($products_data)) {
                $results['errors'] += count($batch);
                $results['details'][] = array(
                    'status' => 'error',
                    'message' => $products_data->get_error_message(),
                );
                continue;
            }

            // Import each product
            foreach ($products_data as $asin => $product_data) {
                $existing_post_id = $this->get_product_by_asin($asin);

                if ($existing_post_id) {
                    // Update
                    $result = $this->update_product_post($existing_post_id, $product_data);
                    if (!is_wp_error($result)) {
                        $results['updated']++;
                    } else {
                        $results['errors']++;
                    }
                } else {
                    // Import
                    $result = $this->import_product($product_data, $options);
                    if (!is_wp_error($result)) {
                        $results['imported']++;
                    } else {
                        $results['errors']++;
                    }
                }

                $results['details'][] = array(
                    'asin' => $asin,
                    'status' => is_wp_error($result) ? 'error' : 'success',
                    'post_id' => is_wp_error($result) ? null : $result,
                );
            }

            // Rate limiting
            sleep(1);
        }

        return $results;
    }
}
