<?php
/**
 * Patronage Core Logic
 *
 * @package WAAS_Patronage_Manager
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WAAS Patronage Core Class
 */
class WAAS_Patronage_Core {

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
        // No hooks needed here, just methods
    }

    /**
     * Activate patronage for a seller
     *
     * @param string $seller_id Seller ID or UUID
     * @param array $patron_data Patron data (logo_url, brand_name, email, phone, website, brand_story)
     * @param array $features Features to enable (logo, contact, brand_story, exclusive_products)
     * @return bool|WP_Error True on success, WP_Error on failure
     */
    public function activate_patronage($seller_id, $patron_data = array(), $features = array()) {
        // Validate seller_id
        if (empty($seller_id)) {
            return new WP_Error('invalid_seller_id', __('Seller ID is required', 'waas-patronage'));
        }

        // Validate patron_data
        $required_fields = array('brand_name', 'logo_url');
        foreach ($required_fields as $field) {
            if (empty($patron_data[$field])) {
                return new WP_Error('missing_field', sprintf(__('Missing required field: %s', 'waas-patronage'), $field));
            }
        }

        // Sanitize patron data
        $sanitized_data = array(
            'seller_id' => sanitize_text_field($seller_id),
            'brand_name' => sanitize_text_field($patron_data['brand_name']),
            'logo_url' => esc_url_raw($patron_data['logo_url']),
            'email' => !empty($patron_data['email']) ? sanitize_email($patron_data['email']) : '',
            'phone' => !empty($patron_data['phone']) ? sanitize_text_field($patron_data['phone']) : '',
            'website' => !empty($patron_data['website']) ? esc_url_raw($patron_data['website']) : '',
            'brand_story' => !empty($patron_data['brand_story']) ? wp_kses_post($patron_data['brand_story']) : '',
            'activated_at' => current_time('mysql'),
        );

        // Default features if not provided
        if (empty($features)) {
            $features = array(
                'logo' => true,
                'contact' => true,
                'brand_story' => true,
                'exclusive_products' => true,
            );
        }

        // Update options
        update_option('waas_patronage_active', true);
        update_option('waas_patron_seller_id', $seller_id);
        update_option('waas_patron_data', $sanitized_data);
        update_option('waas_patronage_features', $features);

        // Clear all caches
        $this->clear_all_caches();

        // Log activation
        $this->log_patronage_event('activate', array(
            'seller_id' => $seller_id,
            'brand_name' => $sanitized_data['brand_name'],
        ));

        // Fire action hook for other plugins/themes
        do_action('waas_patronage_activated', $seller_id, $sanitized_data, $features);

        return true;
    }

    /**
     * Deactivate patronage
     *
     * @return bool|WP_Error True on success, WP_Error on failure
     */
    public function deactivate_patronage() {
        // Get current patron info for logging
        $current_seller_id = get_option('waas_patron_seller_id', '');
        $current_patron_data = get_option('waas_patron_data', array());

        // Update options
        update_option('waas_patronage_active', false);
        update_option('waas_patron_seller_id', '');
        update_option('waas_patron_data', array());

        // Keep features settings for next activation
        // update_option('waas_patronage_features', array());

        // Clear all caches
        $this->clear_all_caches();

        // Log deactivation
        $this->log_patronage_event('deactivate', array(
            'seller_id' => $current_seller_id,
            'brand_name' => !empty($current_patron_data['brand_name']) ? $current_patron_data['brand_name'] : '',
        ));

        // Fire action hook
        do_action('waas_patronage_deactivated', $current_seller_id, $current_patron_data);

        return true;
    }

    /**
     * Check if patronage is active
     *
     * @return bool
     */
    public function is_patronage_active() {
        return (bool) get_option('waas_patronage_active', false);
    }

    /**
     * Get current patron seller ID
     *
     * @return string
     */
    public function get_patron_seller_id() {
        return get_option('waas_patron_seller_id', '');
    }

    /**
     * Get patron data
     *
     * @return array
     */
    public function get_patron_data() {
        return get_option('waas_patron_data', array());
    }

    /**
     * Get patronage features
     *
     * @return array
     */
    public function get_patronage_features() {
        return get_option('waas_patronage_features', array());
    }

    /**
     * Check if a specific feature is enabled
     *
     * @param string $feature Feature name
     * @return bool
     */
    public function is_feature_enabled($feature) {
        $features = $this->get_patronage_features();
        return !empty($features[$feature]);
    }

    /**
     * Update patron data
     *
     * @param array $new_data New patron data
     * @return bool|WP_Error
     */
    public function update_patron_data($new_data) {
        if (!$this->is_patronage_active()) {
            return new WP_Error('patronage_inactive', __('Patronage is not active', 'waas-patronage'));
        }

        $current_data = $this->get_patron_data();
        $updated_data = array_merge($current_data, $new_data);

        // Sanitize
        if (!empty($updated_data['brand_name'])) {
            $updated_data['brand_name'] = sanitize_text_field($updated_data['brand_name']);
        }
        if (!empty($updated_data['logo_url'])) {
            $updated_data['logo_url'] = esc_url_raw($updated_data['logo_url']);
        }
        if (!empty($updated_data['email'])) {
            $updated_data['email'] = sanitize_email($updated_data['email']);
        }
        if (!empty($updated_data['phone'])) {
            $updated_data['phone'] = sanitize_text_field($updated_data['phone']);
        }
        if (!empty($updated_data['website'])) {
            $updated_data['website'] = esc_url_raw($updated_data['website']);
        }
        if (!empty($updated_data['brand_story'])) {
            $updated_data['brand_story'] = wp_kses_post($updated_data['brand_story']);
        }

        update_option('waas_patron_data', $updated_data);

        // Clear caches
        $this->clear_all_caches();

        return true;
    }

    /**
     * Clear all caches after patronage change
     */
    private function clear_all_caches() {
        // Clear WordPress object cache
        wp_cache_flush();

        // Clear transients
        delete_transient('waas_patronage_status');
        delete_transient('waas_patron_products');

        // Clear WP Rocket cache if available
        if (function_exists('rocket_clean_domain')) {
            rocket_clean_domain();
        }

        // Clear W3 Total Cache if available
        if (function_exists('w3tc_flush_all')) {
            w3tc_flush_all();
        }

        // Clear WP Super Cache if available
        if (function_exists('wp_cache_clear_cache')) {
            wp_cache_clear_cache();
        }

        // Fire action for custom cache clearing
        do_action('waas_patronage_clear_cache');
    }

    /**
     * Log patronage events
     *
     * @param string $event Event type (activate, deactivate, update)
     * @param array $data Event data
     */
    private function log_patronage_event($event, $data = array()) {
        // Create log entry
        $log_entry = array(
            'event' => $event,
            'data' => $data,
            'timestamp' => current_time('mysql'),
            'user_id' => get_current_user_id(),
            'ip_address' => !empty($_SERVER['REMOTE_ADDR']) ? sanitize_text_field($_SERVER['REMOTE_ADDR']) : '',
        );

        // Get existing logs
        $logs = get_option('waas_patronage_logs', array());

        // Add new log
        $logs[] = $log_entry;

        // Keep only last 100 logs
        if (count($logs) > 100) {
            $logs = array_slice($logs, -100);
        }

        // Save logs
        update_option('waas_patronage_logs', $logs);

        // Also log to error_log for debugging
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log(sprintf(
                'WAAS Patronage: %s - Seller ID: %s, Brand: %s',
                $event,
                !empty($data['seller_id']) ? $data['seller_id'] : 'N/A',
                !empty($data['brand_name']) ? $data['brand_name'] : 'N/A'
            ));
        }
    }

    /**
     * Get patronage logs
     *
     * @param int $limit Number of logs to return
     * @return array
     */
    public function get_patronage_logs($limit = 20) {
        $logs = get_option('waas_patronage_logs', array());

        if ($limit > 0) {
            return array_slice($logs, -$limit);
        }

        return $logs;
    }

    /**
     * Get patronage statistics
     *
     * @return array
     */
    public function get_patronage_stats() {
        $stats = array(
            'is_active' => $this->is_patronage_active(),
            'patron_seller_id' => $this->get_patron_seller_id(),
            'patron_data' => $this->get_patron_data(),
            'features' => $this->get_patronage_features(),
        );

        if ($stats['is_active']) {
            // Count patron products
            $args = array(
                'post_type' => 'waas_product',
                'posts_per_page' => -1,
                'meta_query' => array(
                    array(
                        'key' => '_waas_seller_id',
                        'value' => $this->get_patron_seller_id(),
                        'compare' => '=',
                    ),
                ),
                'fields' => 'ids',
            );

            $patron_products = new WP_Query($args);
            $stats['patron_product_count'] = $patron_products->found_posts;
            wp_reset_postdata();

            // Count all products
            $all_products = wp_count_posts('waas_product');
            $stats['total_product_count'] = $all_products->publish;

            // Calculate percentage
            if ($stats['total_product_count'] > 0) {
                $stats['patron_percentage'] = round(($stats['patron_product_count'] / $stats['total_product_count']) * 100, 2);
            } else {
                $stats['patron_percentage'] = 0;
            }
        } else {
            $stats['patron_product_count'] = 0;
            $stats['total_product_count'] = wp_count_posts('waas_product')->publish;
            $stats['patron_percentage'] = 0;
        }

        return $stats;
    }
}
