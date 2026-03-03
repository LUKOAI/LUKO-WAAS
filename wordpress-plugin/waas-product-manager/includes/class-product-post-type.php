<?php
/**
 * WAAS Product Post Type
 *
 * @package WAAS_Product_Manager
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
        add_action('init', array($this, 'register_taxonomies'));
    }

    public static function register_post_type() {
        $labels = array(
            'name' => 'WAAS Products',
            'singular_name' => 'WAAS Product',
            'add_new' => 'Add New',
            'add_new_item' => 'Add New Product',
            'edit_item' => 'Edit Product',
            'new_item' => 'New Product',
            'view_item' => 'View Product',
            'search_items' => 'Search Products',
            'not_found' => 'No products found',
            'not_found_in_trash' => 'No products found in trash',
            'menu_name' => 'Amazon Products'
        );

        $args = array(
            'labels' => $labels,
            'public' => true,
            'has_archive' => true,
            'show_in_menu' => true,
            'show_in_rest' => true,
            'supports' => array('title', 'editor', 'thumbnail', 'excerpt'),
            'menu_icon' => 'dashicons-products',
            'rewrite' => array('slug' => 'amazon-product'),
        );

        register_post_type('waas_product', $args);
    }

    public function register_taxonomies() {
        register_taxonomy('product_category', 'waas_product', array(
            'label' => 'Product Categories',
            'hierarchical' => true,
            'show_in_rest' => true,
        ));
    }
}
