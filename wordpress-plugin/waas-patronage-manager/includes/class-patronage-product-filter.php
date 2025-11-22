<?php
/**
 * Patronage Product Filter
 *
 * Filters products based on patronage status
 *
 * @package WAAS_Patronage_Manager
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WAAS Patronage Product Filter Class
 */
class WAAS_Patronage_Product_Filter {

    /**
     * Instance of this class
     *
     * @var object
     */
    protected static $instance = null;

    /**
     * Patronage core instance
     *
     * @var object
     */
    private $patronage_core;

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
        $this->patronage_core = WAAS_Patronage_Core::get_instance();
        $this->init_hooks();
    }

    /**
     * Initialize hooks
     */
    private function init_hooks() {
        // Filter main query for waas_product post type
        add_action('pre_get_posts', array($this, 'filter_product_query'), 10);

        // Filter shortcode queries
        add_filter('waas_product_query_args', array($this, 'filter_product_query_args'), 10, 1);

        // Filter REST API queries
        add_filter('rest_waas_product_query', array($this, 'filter_rest_product_query'), 10, 2);
    }

    /**
     * Filter main WP_Query for products
     *
     * @param WP_Query $query Query object
     */
    public function filter_product_query($query) {
        // Only filter waas_product queries
        if (!$query->is_main_query() && $query->get('post_type') !== 'waas_product') {
            return;
        }

        // Don't filter in admin
        if (is_admin() && !wp_doing_ajax()) {
            return;
        }

        // Apply patronage filter
        if ($this->patronage_core->is_patronage_active()) {
            $this->apply_patronage_filter($query);
        }
    }

    /**
     * Filter product query args (for shortcodes)
     *
     * @param array $args Query arguments
     * @return array Modified query arguments
     */
    public function filter_product_query_args($args) {
        // Only apply if patronage is active
        if (!$this->patronage_core->is_patronage_active()) {
            return $args;
        }

        // Get patron seller ID
        $patron_seller_id = $this->patronage_core->get_patron_seller_id();

        if (empty($patron_seller_id)) {
            return $args;
        }

        // Add meta query for seller_id
        if (!isset($args['meta_query'])) {
            $args['meta_query'] = array();
        }

        $args['meta_query'][] = array(
            'key' => '_waas_seller_id',
            'value' => $patron_seller_id,
            'compare' => '=',
        );

        // Set relation if multiple meta queries exist
        if (count($args['meta_query']) > 1 && !isset($args['meta_query']['relation'])) {
            $args['meta_query']['relation'] = 'AND';
        }

        return $args;
    }

    /**
     * Filter REST API product queries
     *
     * @param array $args Query arguments
     * @param WP_REST_Request $request Request object
     * @return array Modified query arguments
     */
    public function filter_rest_product_query($args, $request) {
        // Only apply if patronage is active
        if (!$this->patronage_core->is_patronage_active()) {
            return $args;
        }

        // Allow bypassing filter with special parameter (for admin)
        if ($request->get_param('bypass_patronage_filter') && current_user_can('manage_options')) {
            return $args;
        }

        return $this->filter_product_query_args($args);
    }

    /**
     * Apply patronage filter to WP_Query
     *
     * @param WP_Query $query Query object
     */
    private function apply_patronage_filter($query) {
        $patron_seller_id = $this->patronage_core->get_patron_seller_id();

        if (empty($patron_seller_id)) {
            return;
        }

        // Get existing meta query
        $meta_query = $query->get('meta_query');

        if (empty($meta_query)) {
            $meta_query = array();
        }

        // Add seller_id filter
        $meta_query[] = array(
            'key' => '_waas_seller_id',
            'value' => $patron_seller_id,
            'compare' => '=',
        );

        // Set relation if multiple meta queries
        if (count($meta_query) > 1 && !isset($meta_query['relation'])) {
            $meta_query['relation'] = 'AND';
        }

        // Update query
        $query->set('meta_query', $meta_query);
    }

    /**
     * Get products for display (helper function)
     *
     * @param array $args Optional query arguments
     * @return WP_Query
     */
    public function get_products_for_display($args = array()) {
        $defaults = array(
            'post_type' => 'waas_product',
            'posts_per_page' => -1,
            'post_status' => 'publish',
        );

        $args = wp_parse_args($args, $defaults);

        // Apply patronage filter
        if ($this->patronage_core->is_patronage_active()) {
            $patron_seller_id = $this->patronage_core->get_patron_seller_id();

            if (!empty($patron_seller_id)) {
                if (!isset($args['meta_query'])) {
                    $args['meta_query'] = array();
                }

                $args['meta_query'][] = array(
                    'key' => '_waas_seller_id',
                    'value' => $patron_seller_id,
                    'compare' => '=',
                );

                if (count($args['meta_query']) > 1 && !isset($args['meta_query']['relation'])) {
                    $args['meta_query']['relation'] = 'AND';
                }
            }
        }

        return new WP_Query($args);
    }

    /**
     * Check if a product belongs to current patron
     *
     * @param int|WP_Post $product Product ID or post object
     * @return bool
     */
    public function is_patron_product($product) {
        if (!$this->patronage_core->is_patronage_active()) {
            return false;
        }

        $product_id = is_object($product) ? $product->ID : $product;
        $product_seller_id = get_post_meta($product_id, '_waas_seller_id', true);
        $patron_seller_id = $this->patronage_core->get_patron_seller_id();

        return !empty($product_seller_id) && $product_seller_id === $patron_seller_id;
    }

    /**
     * Get count of patron products
     *
     * @return int
     */
    public function get_patron_product_count() {
        if (!$this->patronage_core->is_patronage_active()) {
            return 0;
        }

        $patron_seller_id = $this->patronage_core->get_patron_seller_id();

        if (empty($patron_seller_id)) {
            return 0;
        }

        $args = array(
            'post_type' => 'waas_product',
            'posts_per_page' => -1,
            'meta_query' => array(
                array(
                    'key' => '_waas_seller_id',
                    'value' => $patron_seller_id,
                    'compare' => '=',
                ),
            ),
            'fields' => 'ids',
        );

        $query = new WP_Query($args);
        $count = $query->found_posts;
        wp_reset_postdata();

        return $count;
    }

    /**
     * Get patron products
     *
     * @param array $args Optional query arguments
     * @return array Array of post IDs
     */
    public function get_patron_products($args = array()) {
        if (!$this->patronage_core->is_patronage_active()) {
            return array();
        }

        $patron_seller_id = $this->patronage_core->get_patron_seller_id();

        if (empty($patron_seller_id)) {
            return array();
        }

        $defaults = array(
            'post_type' => 'waas_product',
            'posts_per_page' => -1,
            'meta_query' => array(
                array(
                    'key' => '_waas_seller_id',
                    'value' => $patron_seller_id,
                    'compare' => '=',
                ),
            ),
            'fields' => 'ids',
        );

        $args = wp_parse_args($args, $defaults);
        $query = new WP_Query($args);
        $products = $query->posts;
        wp_reset_postdata();

        return $products;
    }
}
