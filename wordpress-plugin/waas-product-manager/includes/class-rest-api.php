<?php
/**
 * REST API Endpoints
 *
 * @package WAAS_Product_Manager
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WAAS REST API Class
 */
class WAAS_REST_API {

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
        add_action('rest_api_init', array($this, 'register_routes'));
    }

    /**
     * Register REST API routes
     */
    public function register_routes() {
        // Import products
        register_rest_route($this->namespace, '/products/import', array(
            'methods' => 'POST',
            'callback' => array($this, 'import_products'),
            'permission_callback' => array($this, 'check_admin_permission'),
            'args' => array(
                'products' => array(
                    'required' => true,
                    'type' => 'array',
                    'description' => __('Array of product ASINs', 'waas-pm'),
                ),
            ),
        ));

        // Update products
        register_rest_route($this->namespace, '/products/update', array(
            'methods' => 'POST',
            'callback' => array($this, 'update_products'),
            'permission_callback' => array($this, 'check_admin_permission'),
            'args' => array(
                'asins' => array(
                    'type' => 'array',
                    'description' => __('Array of ASINs to update (optional, updates all if empty)', 'waas-pm'),
                ),
            ),
        ));

        // Get product list
        register_rest_route($this->namespace, '/products/list', array(
            'methods' => 'GET',
            'callback' => array($this, 'list_products'),
            'permission_callback' => array($this, 'check_read_permission'),
        ));

        // Generate content
        register_rest_route($this->namespace, '/content/generate', array(
            'methods' => 'POST',
            'callback' => array($this, 'generate_content'),
            'permission_callback' => array($this, 'check_admin_permission'),
            'args' => array(
                'asin' => array(
                    'required' => true,
                    'type' => 'string',
                    'description' => __('Product ASIN', 'waas-pm'),
                ),
                'content_type' => array(
                    'required' => true,
                    'type' => 'string',
                    'description' => __('Type of content to generate', 'waas-pm'),
                ),
            ),
        ));

        // Cache stats
        register_rest_route($this->namespace, '/cache/stats', array(
            'methods' => 'GET',
            'callback' => array($this, 'cache_stats'),
            'permission_callback' => array($this, 'check_admin_permission'),
        ));

        // Sync single product
        register_rest_route($this->namespace, '/products/sync/(?P<asin>[a-zA-Z0-9]+)', array(
            'methods' => 'POST',
            'callback' => array($this, 'sync_product'),
            'permission_callback' => array($this, 'check_admin_permission'),
        ));
    }

    /**
     * Import products
     *
     * @param WP_REST_Request $request Request object
     * @return WP_REST_Response|WP_Error Response
     */
    public function import_products($request) {
        $products = $request->get_param('products');

        if (empty($products) || !is_array($products)) {
            return new WP_Error('invalid_data', __('Invalid product data', 'waas-pm'), array('status' => 400));
        }

        $importer = new WAAS_Product_Importer();
        $results = array();

        foreach ($products as $product_data) {
            if (is_string($product_data)) {
                // Just ASIN provided
                $result = $importer->import_by_asin($product_data);
            } elseif (is_array($product_data) && isset($product_data['asin'])) {
                // Full product data provided
                $result = $importer->import_product($product_data);
            } else {
                continue;
            }

            if (is_wp_error($result)) {
                $results[] = array(
                    'status' => 'error',
                    'message' => $result->get_error_message(),
                );
            } else {
                $results[] = array(
                    'status' => 'success',
                    'post_id' => $result,
                );
            }
        }

        return new WP_REST_Response(array(
            'success' => true,
            'results' => $results,
        ), 200);
    }

    /**
     * Update products
     *
     * @param WP_REST_Request $request Request object
     * @return WP_REST_Response|WP_Error Response
     */
    public function update_products($request) {
        $asins = $request->get_param('asins');

        $importer = new WAAS_Product_Importer();

        if (empty($asins)) {
            // Update all products
            $result = $importer->update_all_products();
        } else {
            // Update specific products
            $result = array(
                'updated' => 0,
                'errors' => array(),
            );

            foreach ($asins as $asin) {
                $update_result = $importer->update_product_by_asin($asin);

                if (is_wp_error($update_result)) {
                    $result['errors'][] = array(
                        'asin' => $asin,
                        'message' => $update_result->get_error_message(),
                    );
                } else {
                    $result['updated']++;
                }
            }
        }

        return new WP_REST_Response(array(
            'success' => true,
            'data' => $result,
        ), 200);
    }

    /**
     * List products
     *
     * @param WP_REST_Request $request Request object
     * @return WP_REST_Response Response
     */
    public function list_products($request) {
        $args = array(
            'post_type' => 'waas_product',
            'posts_per_page' => -1,
            'post_status' => 'publish',
        );

        $query = new WP_Query($args);

        $products = array();

        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();

                $post_id = get_the_ID();

                $products[] = array(
                    'id' => $post_id,
                    'title' => get_the_title(),
                    'asin' => get_post_meta($post_id, '_waas_asin', true),
                    'price' => get_post_meta($post_id, '_waas_price', true),
                    'availability' => get_post_meta($post_id, '_waas_availability', true),
                    'last_sync' => get_post_meta($post_id, '_waas_last_sync', true),
                    'permalink' => get_permalink(),
                );
            }
            wp_reset_postdata();
        }

        return new WP_REST_Response(array(
            'success' => true,
            'count' => count($products),
            'products' => $products,
        ), 200);
    }

    /**
     * Generate content
     *
     * @param WP_REST_Request $request Request object
     * @return WP_REST_Response|WP_Error Response
     */
    public function generate_content($request) {
        $asin = $request->get_param('asin');
        $content_type = $request->get_param('content_type');

        // TODO: Implement Claude API content generation
        // This will be implemented in the Claude API module

        return new WP_REST_Response(array(
            'success' => true,
            'message' => __('Content generation not yet implemented', 'waas-pm'),
        ), 200);
    }

    /**
     * Get cache statistics
     *
     * @param WP_REST_Request $request Request object
     * @return WP_REST_Response Response
     */
    public function cache_stats($request) {
        $cache_manager = WAAS_Cache_Manager::get_instance();
        $stats = $cache_manager->get_cache_stats();

        return new WP_REST_Response(array(
            'success' => true,
            'stats' => $stats,
        ), 200);
    }

    /**
     * Sync single product
     *
     * @param WP_REST_Request $request Request object
     * @return WP_REST_Response|WP_Error Response
     */
    public function sync_product($request) {
        $asin = $request->get_param('asin');

        if (empty($asin)) {
            return new WP_Error('missing_asin', __('ASIN is required', 'waas-pm'), array('status' => 400));
        }

        $cache_manager = WAAS_Cache_Manager::get_instance();
        $product_data = $cache_manager->refresh_product_cache($asin);

        if (is_wp_error($product_data)) {
            return $product_data;
        }

        return new WP_REST_Response(array(
            'success' => true,
            'message' => __('Product synced successfully', 'waas-pm'),
            'data' => $product_data,
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
