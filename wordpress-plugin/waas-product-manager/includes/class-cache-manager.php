<?php
/**
 * Cache Manager - 24-Hour Amazon TOS Compliance
 *
 * @package WAAS_Product_Manager
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WAAS Cache Manager Class
 */
class WAAS_Cache_Manager {

    /**
     * Instance of this class
     *
     * @var object
     */
    protected static $instance = null;

    /**
     * Cache duration in seconds (24 hours as per Amazon TOS)
     *
     * @var int
     */
    const CACHE_DURATION = 86400; // 24 hours

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
        // Constructor intentionally left empty
    }

    /**
     * Get product data from cache
     *
     * @param string $asin Product ASIN
     * @return array|false Product data if found and valid, false otherwise
     */
    public function get_product_cache($asin) {
        // Try WordPress transients first (faster)
        $transient_key = $this->get_transient_key($asin);
        $cached_data = get_transient($transient_key);

        if ($cached_data !== false) {
            return $cached_data;
        }

        // Fallback to database cache
        $db_cache = $this->get_database_cache($asin);

        if ($db_cache !== false) {
            // Restore to transient cache for faster subsequent access
            $this->set_transient_cache($asin, $db_cache);
            return $db_cache;
        }

        return false;
    }

    /**
     * Set product data in cache
     *
     * @param string $asin Product ASIN
     * @param array $data Product data
     * @return bool True on success
     */
    public function set_product_cache($asin, $data) {
        // Add timestamp to data
        $data['cache_timestamp'] = current_time('mysql');

        // Store in transients (primary cache)
        $this->set_transient_cache($asin, $data);

        // Store in database (backup cache)
        return $this->set_database_cache($asin, $data);
    }

    /**
     * Delete product cache
     *
     * @param string $asin Product ASIN
     * @return bool True on success
     */
    public function delete_product_cache($asin) {
        // Delete transient
        delete_transient($this->get_transient_key($asin));

        // Delete from database
        return $this->delete_database_cache($asin);
    }

    /**
     * Check if cache is expired (older than 24 hours)
     *
     * @param string $asin Product ASIN
     * @return bool True if expired
     */
    public function is_cache_expired($asin) {
        $cached_data = $this->get_product_cache($asin);

        if ($cached_data === false || !isset($cached_data['cache_timestamp'])) {
            return true; // No cache = expired
        }

        $cache_time = strtotime($cached_data['cache_timestamp']);
        $current_time = current_time('timestamp');

        return ($current_time - $cache_time) > self::CACHE_DURATION;
    }

    /**
     * Get cache age in seconds
     *
     * @param string $asin Product ASIN
     * @return int|false Cache age in seconds or false if no cache
     */
    public function get_cache_age($asin) {
        $cached_data = $this->get_product_cache($asin);

        if ($cached_data === false || !isset($cached_data['cache_timestamp'])) {
            return false;
        }

        $cache_time = strtotime($cached_data['cache_timestamp']);
        $current_time = current_time('timestamp');

        return $current_time - $cache_time;
    }

    /**
     * Get formatted cache timestamp for display
     *
     * @param string $asin Product ASIN
     * @return string|false Formatted timestamp or false
     */
    public function get_cache_timestamp($asin) {
        $cached_data = $this->get_product_cache($asin);

        if ($cached_data === false || !isset($cached_data['cache_timestamp'])) {
            return false;
        }

        return $cached_data['cache_timestamp'];
    }

    /**
     * Clean expired caches
     *
     * @return int Number of caches cleaned
     */
    public function clean_expired_caches() {
        global $wpdb;

        $table_name = $wpdb->prefix . 'waas_product_cache';

        // Calculate expiry timestamp
        $expiry_time = date('Y-m-d H:i:s', current_time('timestamp') - self::CACHE_DURATION);

        // Delete expired records
        $deleted = $wpdb->query($wpdb->prepare(
            "DELETE FROM {$table_name} WHERE last_updated < %s",
            $expiry_time
        ));

        return $deleted !== false ? $deleted : 0;
    }

    /**
     * Get all cached ASINs
     *
     * @return array Array of ASINs
     */
    public function get_cached_asins() {
        global $wpdb;

        $table_name = $wpdb->prefix . 'waas_product_cache';

        $asins = $wpdb->get_col("SELECT asin FROM {$table_name}");

        return $asins !== null ? $asins : array();
    }

    /**
     * Get cache statistics
     *
     * @return array Cache stats
     */
    public function get_cache_stats() {
        global $wpdb;

        $table_name = $wpdb->prefix . 'waas_product_cache';

        $total = $wpdb->get_var("SELECT COUNT(*) FROM {$table_name}");

        $expiry_time = date('Y-m-d H:i:s', current_time('timestamp') - self::CACHE_DURATION);

        $valid = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$table_name} WHERE last_updated >= %s",
            $expiry_time
        ));

        $expired = $total - $valid;

        return array(
            'total' => (int) $total,
            'valid' => (int) $valid,
            'expired' => (int) $expired,
            'cache_duration_hours' => self::CACHE_DURATION / 3600,
        );
    }

    /**
     * Get transient key for ASIN
     *
     * @param string $asin Product ASIN
     * @return string Transient key
     */
    private function get_transient_key($asin) {
        return 'waas_product_' . sanitize_key($asin);
    }

    /**
     * Set transient cache
     *
     * @param string $asin Product ASIN
     * @param array $data Product data
     * @return bool True on success
     */
    private function set_transient_cache($asin, $data) {
        $transient_key = $this->get_transient_key($asin);
        return set_transient($transient_key, $data, self::CACHE_DURATION);
    }

    /**
     * Get data from database cache
     *
     * @param string $asin Product ASIN
     * @return array|false Product data or false
     */
    private function get_database_cache($asin) {
        global $wpdb;

        $table_name = $wpdb->prefix . 'waas_product_cache';

        $row = $wpdb->get_row($wpdb->prepare(
            "SELECT product_data, last_updated FROM {$table_name} WHERE asin = %s",
            $asin
        ));

        if ($row === null) {
            return false;
        }

        // Check if cache is expired
        $cache_time = strtotime($row->last_updated);
        $current_time = current_time('timestamp');

        if (($current_time - $cache_time) > self::CACHE_DURATION) {
            // Cache expired, delete it
            $this->delete_database_cache($asin);
            return false;
        }

        $data = json_decode($row->product_data, true);

        if (!is_array($data)) {
            return false;
        }

        // Add timestamp to data
        $data['cache_timestamp'] = $row->last_updated;

        return $data;
    }

    /**
     * Set data in database cache
     *
     * @param string $asin Product ASIN
     * @param array $data Product data
     * @return bool True on success
     */
    private function set_database_cache($asin, $data) {
        global $wpdb;

        $table_name = $wpdb->prefix . 'waas_product_cache';

        // Check if entry exists
        $exists = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$table_name} WHERE asin = %s",
            $asin
        ));

        $product_data = json_encode($data);

        if ($exists) {
            // Update existing entry
            $result = $wpdb->update(
                $table_name,
                array(
                    'product_data' => $product_data,
                    'last_updated' => current_time('mysql'),
                ),
                array('asin' => $asin),
                array('%s', '%s'),
                array('%s')
            );
        } else {
            // Insert new entry
            $result = $wpdb->insert(
                $table_name,
                array(
                    'asin' => $asin,
                    'product_data' => $product_data,
                    'last_updated' => current_time('mysql'),
                ),
                array('%s', '%s', '%s')
            );
        }

        return $result !== false;
    }

    /**
     * Delete from database cache
     *
     * @param string $asin Product ASIN
     * @return bool True on success
     */
    private function delete_database_cache($asin) {
        global $wpdb;

        $table_name = $wpdb->prefix . 'waas_product_cache';

        $result = $wpdb->delete(
            $table_name,
            array('asin' => $asin),
            array('%s')
        );

        return $result !== false;
    }

    /**
     * Refresh cache for a specific product
     *
     * @param string $asin Product ASIN
     * @return array|WP_Error Refreshed product data or error
     */
    public function refresh_product_cache($asin) {
        // Delete existing cache
        $this->delete_product_cache($asin);

        // Fetch fresh data from Amazon API
        $amazon_api = WAAS_Amazon_API::get_instance();
        $product_data = $amazon_api->get_item($asin);

        if (is_wp_error($product_data)) {
            return $product_data;
        }

        // Cache will be set automatically by the API class
        return $product_data;
    }

    /**
     * Get products that need refreshing (older than 24 hours)
     *
     * @param int $limit Limit number of results
     * @return array Array of ASINs that need refreshing
     */
    public function get_products_needing_refresh($limit = 100) {
        global $wpdb;

        $table_name = $wpdb->prefix . 'waas_product_cache';

        $expiry_time = date('Y-m-d H:i:s', current_time('timestamp') - self::CACHE_DURATION);

        $asins = $wpdb->get_col($wpdb->prepare(
            "SELECT asin FROM {$table_name} WHERE last_updated < %s LIMIT %d",
            $expiry_time,
            $limit
        ));

        return $asins !== null ? $asins : array();
    }
}
