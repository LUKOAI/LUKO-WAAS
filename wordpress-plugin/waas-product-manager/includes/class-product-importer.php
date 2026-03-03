<?php
/**
 * WAAS Product Importer
 *
 * @package WAAS_Product_Manager
 */

if (!defined('ABSPATH')) {
    exit;
}

class WAAS_Product_Importer {

    public function import_product($product_data, $options = array()) {
        $post_data = array(
            'post_title' => $product_data['title'] ?? 'Untitled Product',
            'post_type' => 'waas_product',
            'post_status' => 'publish',
            'post_content' => $product_data['description'] ?? '',
        );

        $post_id = wp_insert_post($post_data);

        if (is_wp_error($post_id)) {
            return $post_id;
        }

        // Save meta
        if (isset($product_data['asin'])) {
            update_post_meta($post_id, '_waas_asin', $product_data['asin']);
        }
        if (isset($product_data['price'])) {
            update_post_meta($post_id, '_waas_price', $product_data['price']);
        }
        if (isset($product_data['brand'])) {
            update_post_meta($post_id, '_waas_brand', $product_data['brand']);
        }
        if (isset($product_data['image_url'])) {
            update_post_meta($post_id, '_waas_image_url', $product_data['image_url']);
        }
        if (isset($product_data['affiliate_link'])) {
            update_post_meta($post_id, '_waas_affiliate_link', $product_data['affiliate_link']);
        }
        if (isset($product_data['rating'])) {
            update_post_meta($post_id, '_waas_rating', $product_data['rating']);
        }
        if (isset($product_data['review_count'])) {
            update_post_meta($post_id, '_waas_review_count', $product_data['review_count']);
        }
        if (isset($product_data['features'])) {
            $features = is_array($product_data['features']) ? implode("\n", $product_data['features']) : $product_data['features'];
            update_post_meta($post_id, '_waas_features', $features);
        }
        if (isset($product_data['color_name'])) {
            update_post_meta($post_id, '_waas_color', $product_data['color_name']);
        }

        // Fire action hook
        do_action('waas_product_imported', $post_id, $product_data);

        return $post_id;
    }

    public function update_all_products($limit = 100) {
        return array(
            'updated' => 0,
            'errors' => 0,
            'skipped' => 0,
        );
    }
}
