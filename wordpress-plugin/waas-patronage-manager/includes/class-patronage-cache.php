<?php
/**
 * Patronage Cache Manager
 *
 * @package WAAS_Patronage_Manager
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WAAS Patronage Cache Class
 */
class WAAS_Patronage_Cache {

    /**
     * Instance of this class
     *
     * @var object
     */
    protected static $instance = null;

    /**
     * Cache group name
     *
     * @var string
     */
    private $cache_group = 'waas_patronage';

    /**
     * Cache expiration time (1 hour)
     *
     * @var int
     */
    private $cache_expiration = 3600;

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
        // Hook into patronage activation/deactivation to clear cache
        add_action('waas_patronage_activated', array($this, 'clear_all_cache'));
        add_action('waas_patronage_deactivated', array($this, 'clear_all_cache'));
    }

    /**
     * Get patronage status from cache
     *
     * @return array|false
     */
    public function get_patronage_status() {
        $cached = wp_cache_get('status', $this->cache_group);

        if (false !== $cached) {
            return $cached;
        }

        // Build status from options
        $status = array(
            'is_active' => (bool) get_option('waas_patronage_active', false),
            'patron_seller_id' => get_option('waas_patron_seller_id', ''),
            'patron_data' => get_option('waas_patron_data', array()),
            'features' => get_option('waas_patronage_features', array()),
        );

        // Cache for 1 hour
        wp_cache_set('status', $status, $this->cache_group, $this->cache_expiration);

        return $status;
    }

    /**
     * Get patron products from cache
     *
     * @return array
     */
    public function get_patron_products() {
        $patron_seller_id = get_option('waas_patron_seller_id', '');

        if (empty($patron_seller_id)) {
            return array();
        }

        $cache_key = 'products_' . md5($patron_seller_id);
        $cached = wp_cache_get($cache_key, $this->cache_group);

        if (false !== $cached) {
            return $cached;
        }

        // Query patron products
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
        $products = $query->posts;
        wp_reset_postdata();

        // Cache for 1 hour
        wp_cache_set($cache_key, $products, $this->cache_group, $this->cache_expiration);

        return $products;
    }

    /**
     * Get patron product count from cache
     *
     * @return int
     */
    public function get_patron_product_count() {
        $products = $this->get_patron_products();
        return count($products);
    }

    /**
     * Clear all patronage cache
     */
    public function clear_all_cache() {
        // Clear object cache
        wp_cache_flush_group($this->cache_group);

        // Clear transients
        delete_transient('waas_patronage_status');
        delete_transient('waas_patron_products');
        delete_transient('waas_patronage_stats');

        // Clear all transients with prefix
        global $wpdb;
        $wpdb->query(
            "DELETE FROM {$wpdb->options}
            WHERE option_name LIKE '_transient_waas_patronage_%'
            OR option_name LIKE '_transient_timeout_waas_patronage_%'"
        );
    }

    /**
     * Clear specific product cache
     *
     * @param string $seller_id Seller ID
     */
    public function clear_product_cache($seller_id) {
        $cache_key = 'products_' . md5($seller_id);
        wp_cache_delete($cache_key, $this->cache_group);
    }

    /**
     * Clear status cache
     */
    public function clear_status_cache() {
        wp_cache_delete('status', $this->cache_group);
        delete_transient('waas_patronage_status');
    }
}
