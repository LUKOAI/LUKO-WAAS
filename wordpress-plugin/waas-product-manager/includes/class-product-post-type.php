<?php
/**
 * WAAS Product Post Type (DEPRECATED — v3)
 *
 * The waas_product CPT is deprecated in WAAS v3.
 * Products are now stored directly as WooCommerce products (WC_Product_External).
 *
 * This CPT is kept registered (but hidden from admin menus) so that:
 * 1. Existing waas_product posts remain queryable for migration
 * 2. The migration endpoint (POST /waas/v1/products/migrate-to-wc) can find them
 *
 * After migration is complete, this file can be safely removed.
 *
 * @package WAAS_Product_Manager
 * @deprecated 3.0.0 Use WooCommerce products with _waas_asin meta instead
 */

if (!defined('ABSPATH')) {
    exit;
}

class WAAS_Product_Post_Type {

    protected static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('init', array($this, 'register_post_type'));
    }

    /**
     * Register the deprecated waas_product post type
     * Hidden from admin sidebar (show_in_menu = false) but still queryable
     */
    public static function register_post_type() {
        // Only register if there are still waas_product posts to migrate
        $count = wp_count_posts('waas_product');
        $has_posts = false;
        if ($count) {
            $has_posts = ($count->publish ?? 0) > 0 || ($count->draft ?? 0) > 0 || ($count->trash ?? 0) > 0;
        }

        $args = array(
            'labels' => array(
                'name' => 'Amazon Products (Legacy)',
                'singular_name' => 'Amazon Product (Legacy)',
                'menu_name' => 'Amazon Products (Legacy)',
            ),
            'public' => false,           // Not publicly queryable
            'publicly_queryable' => false,
            'show_ui' => $has_posts,     // Show in admin only if there are posts to migrate
            'show_in_menu' => $has_posts, // Same — visible only during migration
            'show_in_rest' => true,       // REST API still available for migration
            'supports' => array('title', 'editor', 'thumbnail'),
            'menu_icon' => 'dashicons-warning',
            'rewrite' => false,           // No URL rewrites
        );

        register_post_type('waas_product', $args);
    }
}
