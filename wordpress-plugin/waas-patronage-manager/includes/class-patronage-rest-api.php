<?php
/**
 * Patronage REST API Endpoints
 *
 * @package WAAS_Patronage_Manager
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WAAS Patronage REST API Class
 */
class WAAS_Patronage_REST_API {

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
        add_action('rest_api_init', array($this, 'register_routes'));
    }

    /**
     * Register REST API routes
     */
    public function register_routes() {
        // Activate patronage
        register_rest_route($this->namespace, '/patronage/activate', array(
            'methods' => 'POST',
            'callback' => array($this, 'activate_patronage'),
            'permission_callback' => array($this, 'check_admin_permission'),
            'args' => array(
                'seller_id' => array(
                    'required' => true,
                    'type' => 'string',
                    'description' => __('Seller ID or UUID', 'waas-patronage'),
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'brand_name' => array(
                    'required' => true,
                    'type' => 'string',
                    'description' => __('Brand name', 'waas-patronage'),
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'logo_url' => array(
                    'required' => true,
                    'type' => 'string',
                    'description' => __('Logo URL', 'waas-patronage'),
                    'sanitize_callback' => 'esc_url_raw',
                ),
                'email' => array(
                    'required' => false,
                    'type' => 'string',
                    'description' => __('Contact email', 'waas-patronage'),
                    'sanitize_callback' => 'sanitize_email',
                ),
                'phone' => array(
                    'required' => false,
                    'type' => 'string',
                    'description' => __('Contact phone', 'waas-patronage'),
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'website' => array(
                    'required' => false,
                    'type' => 'string',
                    'description' => __('Website URL', 'waas-patronage'),
                    'sanitize_callback' => 'esc_url_raw',
                ),
                'brand_story' => array(
                    'required' => false,
                    'type' => 'string',
                    'description' => __('Brand story (HTML allowed)', 'waas-patronage'),
                    'sanitize_callback' => 'wp_kses_post',
                ),
                'features' => array(
                    'required' => false,
                    'type' => 'array',
                    'description' => __('Features to enable', 'waas-patronage'),
                    'default' => array(
                        'logo' => true,
                        'contact' => true,
                        'brand_story' => true,
                        'exclusive_products' => true,
                    ),
                ),
            ),
        ));

        // Deactivate patronage
        register_rest_route($this->namespace, '/patronage/deactivate', array(
            'methods' => 'POST',
            'callback' => array($this, 'deactivate_patronage'),
            'permission_callback' => array($this, 'check_admin_permission'),
        ));

        // Get patronage status
        register_rest_route($this->namespace, '/patronage/status', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_patronage_status'),
            'permission_callback' => array($this, 'check_read_permission'),
        ));

        // Update patron data
        register_rest_route($this->namespace, '/patronage/update', array(
            'methods' => 'POST',
            'callback' => array($this, 'update_patron_data'),
            'permission_callback' => array($this, 'check_admin_permission'),
            'args' => array(
                'brand_name' => array(
                    'required' => false,
                    'type' => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'logo_url' => array(
                    'required' => false,
                    'type' => 'string',
                    'sanitize_callback' => 'esc_url_raw',
                ),
                'email' => array(
                    'required' => false,
                    'type' => 'string',
                    'sanitize_callback' => 'sanitize_email',
                ),
                'phone' => array(
                    'required' => false,
                    'type' => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'website' => array(
                    'required' => false,
                    'type' => 'string',
                    'sanitize_callback' => 'esc_url_raw',
                ),
                'brand_story' => array(
                    'required' => false,
                    'type' => 'string',
                    'sanitize_callback' => 'wp_kses_post',
                ),
            ),
        ));

        // Get patronage statistics
        register_rest_route($this->namespace, '/patronage/stats', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_patronage_stats'),
            'permission_callback' => array($this, 'check_admin_permission'),
        ));

        // Get patronage logs
        register_rest_route($this->namespace, '/patronage/logs', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_patronage_logs'),
            'permission_callback' => array($this, 'check_admin_permission'),
            'args' => array(
                'limit' => array(
                    'required' => false,
                    'type' => 'integer',
                    'default' => 20,
                    'sanitize_callback' => 'absint',
                ),
            ),
        ));
    }

    /**
     * Activate patronage endpoint
     *
     * @param WP_REST_Request $request Request object
     * @return WP_REST_Response|WP_Error
     */
    public function activate_patronage($request) {
        $seller_id = $request->get_param('seller_id');

        $patron_data = array(
            'brand_name' => $request->get_param('brand_name'),
            'logo_url' => $request->get_param('logo_url'),
            'email' => $request->get_param('email'),
            'phone' => $request->get_param('phone'),
            'website' => $request->get_param('website'),
            'brand_story' => $request->get_param('brand_story'),
        );

        $features = $request->get_param('features');

        $result = $this->patronage_core->activate_patronage($seller_id, $patron_data, $features);

        if (is_wp_error($result)) {
            return new WP_Error(
                $result->get_error_code(),
                $result->get_error_message(),
                array('status' => 400)
            );
        }

        return new WP_REST_Response(array(
            'success' => true,
            'message' => __('Patronage activated successfully', 'waas-patronage'),
            'data' => array(
                'seller_id' => $seller_id,
                'patron_data' => $this->patronage_core->get_patron_data(),
                'features' => $this->patronage_core->get_patronage_features(),
            ),
        ), 200);
    }

    /**
     * Deactivate patronage endpoint
     *
     * @param WP_REST_Request $request Request object
     * @return WP_REST_Response|WP_Error
     */
    public function deactivate_patronage($request) {
        $result = $this->patronage_core->deactivate_patronage();

        if (is_wp_error($result)) {
            return new WP_Error(
                $result->get_error_code(),
                $result->get_error_message(),
                array('status' => 400)
            );
        }

        return new WP_REST_Response(array(
            'success' => true,
            'message' => __('Patronage deactivated successfully', 'waas-patronage'),
        ), 200);
    }

    /**
     * Get patronage status endpoint
     *
     * @param WP_REST_Request $request Request object
     * @return WP_REST_Response
     */
    public function get_patronage_status($request) {
        return new WP_REST_Response(array(
            'success' => true,
            'data' => array(
                'is_active' => $this->patronage_core->is_patronage_active(),
                'patron_seller_id' => $this->patronage_core->get_patron_seller_id(),
                'patron_data' => $this->patronage_core->get_patron_data(),
                'features' => $this->patronage_core->get_patronage_features(),
            ),
        ), 200);
    }

    /**
     * Update patron data endpoint
     *
     * @param WP_REST_Request $request Request object
     * @return WP_REST_Response|WP_Error
     */
    public function update_patron_data($request) {
        $new_data = array();

        $fields = array('brand_name', 'logo_url', 'email', 'phone', 'website', 'brand_story');

        foreach ($fields as $field) {
            $value = $request->get_param($field);
            if (!empty($value)) {
                $new_data[$field] = $value;
            }
        }

        if (empty($new_data)) {
            return new WP_Error('no_data', __('No data provided to update', 'waas-patronage'), array('status' => 400));
        }

        $result = $this->patronage_core->update_patron_data($new_data);

        if (is_wp_error($result)) {
            return new WP_Error(
                $result->get_error_code(),
                $result->get_error_message(),
                array('status' => 400)
            );
        }

        return new WP_REST_Response(array(
            'success' => true,
            'message' => __('Patron data updated successfully', 'waas-patronage'),
            'data' => $this->patronage_core->get_patron_data(),
        ), 200);
    }

    /**
     * Get patronage statistics endpoint
     *
     * @param WP_REST_Request $request Request object
     * @return WP_REST_Response
     */
    public function get_patronage_stats($request) {
        return new WP_REST_Response(array(
            'success' => true,
            'data' => $this->patronage_core->get_patronage_stats(),
        ), 200);
    }

    /**
     * Get patronage logs endpoint
     *
     * @param WP_REST_Request $request Request object
     * @return WP_REST_Response
     */
    public function get_patronage_logs($request) {
        $limit = $request->get_param('limit');

        return new WP_REST_Response(array(
            'success' => true,
            'data' => array(
                'logs' => $this->patronage_core->get_patronage_logs($limit),
            ),
        ), 200);
    }

    /**
     * Check admin permission
     *
     * @return bool
     */
    public function check_admin_permission() {
        return current_user_can('manage_options');
    }

    /**
     * Check read permission
     *
     * @return bool
     */
    public function check_read_permission() {
        return current_user_can('read');
    }
}
