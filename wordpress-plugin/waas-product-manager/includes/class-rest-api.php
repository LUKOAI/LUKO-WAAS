<?php
/**
 * REST API V1 (Fallback)
 *
 * @package WAAS_Product_Manager
 */

if (!defined('ABSPATH')) {
    exit;
}

class WAAS_REST_API {

    protected static $instance = null;
    private $namespace = 'waas/v1';

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('rest_api_init', array($this, 'register_routes'));
    }

    public function register_routes() {
        // Basic routes - V2 is preferred
        register_rest_route($this->namespace, '/products/list', array(
            'methods' => 'GET',
            'callback' => array($this, 'list_products'),
            'permission_callback' => '__return_true',
        ));
    }

    public function list_products($request) {
        return new WP_REST_Response(array(
            'success' => true,
            'products' => array(),
            'message' => 'Please use REST API V2'
        ), 200);
    }
}
