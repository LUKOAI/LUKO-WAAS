<?php
/**
 * WAAS Structure API - REST endpoints for WooCommerce structure setup
 *
 * @package WAAS_Product_Manager
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WAAS Structure API Class
 */
class WAAS_Structure_API {

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
        add_action('rest_api_init', array($this, 'register_routes'));
    }

    /**
     * Register REST API routes
     */
    public function register_routes() {
        // Upload plugin endpoint
        register_rest_route('waas/v1', '/upload-plugin', array(
            'methods' => 'POST',
            'callback' => array($this, 'upload_plugin'),
            'permission_callback' => array($this, 'check_permissions'),
        ));

        // Setup status endpoint
        register_rest_route('waas/v1', '/setup-status', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_setup_status'),
            'permission_callback' => '__return_true', // Public endpoint
        ));

        // Delete plugin endpoint
        register_rest_route('waas/v1', '/delete-plugin/(?P<slug>[a-zA-Z0-9-]+)', array(
            'methods' => 'DELETE',
            'callback' => array($this, 'delete_plugin'),
            'permission_callback' => array($this, 'check_permissions'),
        ));
    }

    /**
     * Check permissions for authenticated endpoints
     */
    public function check_permissions() {
        return current_user_can('install_plugins') && current_user_can('activate_plugins');
    }

    /**
     * Upload and install plugin
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response|WP_Error
     */
    public function upload_plugin($request) {
        try {
            // Get uploaded file
            $files = $request->get_file_params();
            $plugin_slug = $request->get_param('plugin_slug');

            if (empty($files['plugin_file'])) {
                return new WP_Error('no_file', __('No plugin file uploaded', 'waas-pm'), array('status' => 400));
            }

            if (empty($plugin_slug)) {
                return new WP_Error('no_slug', __('No plugin slug provided', 'waas-pm'), array('status' => 400));
            }

            $file = $files['plugin_file'];

            // Validate file type
            $allowed_types = array('text/plain', 'application/x-php');
            if (!in_array($file['type'], $allowed_types) && pathinfo($file['name'], PATHINFO_EXTENSION) !== 'php') {
                return new WP_Error('invalid_file_type', __('Invalid file type. Only PHP files allowed.', 'waas-pm'), array('status' => 400));
            }

            // Read file content
            $plugin_code = file_get_contents($file['tmp_name']);

            if ($plugin_code === false) {
                return new WP_Error('read_error', __('Failed to read uploaded file', 'waas-pm'), array('status' => 500));
            }

            // Validate plugin code (basic security check)
            if (!$this->validate_plugin_code($plugin_code)) {
                return new WP_Error('invalid_code', __('Plugin code validation failed', 'waas-pm'), array('status' => 400));
            }

            // Create plugin directory
            $plugins_dir = WP_PLUGIN_DIR;
            $plugin_dir = $plugins_dir . '/' . $plugin_slug;

            if (!file_exists($plugin_dir)) {
                if (!wp_mkdir_p($plugin_dir)) {
                    return new WP_Error('mkdir_failed', __('Failed to create plugin directory', 'waas-pm'), array('status' => 500));
                }
            }

            // Write plugin file
            $plugin_file = $plugin_dir . '/' . $plugin_slug . '.php';
            $written = file_put_contents($plugin_file, $plugin_code);

            if ($written === false) {
                return new WP_Error('write_failed', __('Failed to write plugin file', 'waas-pm'), array('status' => 500));
            }

            // Refresh plugin cache
            wp_cache_delete('plugins', 'plugins');

            return rest_ensure_response(array(
                'success' => true,
                'message' => __('Plugin uploaded successfully', 'waas-pm'),
                'plugin_slug' => $plugin_slug,
                'plugin_path' => $plugin_slug . '/' . $plugin_slug . '.php',
                'plugin_file' => $plugin_file,
            ));

        } catch (Exception $e) {
            return new WP_Error('exception', $e->getMessage(), array('status' => 500));
        }
    }

    /**
     * Get setup status (from transients set by structure plugin)
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function get_setup_status($request) {
        $success = get_transient('waas_setup_success');
        $result = get_transient('waas_setup_result');
        $error = get_transient('waas_setup_error');

        return rest_ensure_response(array(
            'success' => $success === true,
            'result' => $result ? $result : null,
            'error' => $error ? $error : null,
        ));
    }

    /**
     * Delete plugin
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response|WP_Error
     */
    public function delete_plugin($request) {
        $plugin_slug = $request->get_param('slug');

        if (empty($plugin_slug)) {
            return new WP_Error('no_slug', __('No plugin slug provided', 'waas-pm'), array('status' => 400));
        }

        // Sanitize slug
        $plugin_slug = sanitize_file_name($plugin_slug);

        $plugins_dir = WP_PLUGIN_DIR;
        $plugin_dir = $plugins_dir . '/' . $plugin_slug;

        if (!file_exists($plugin_dir)) {
            return new WP_Error('not_found', __('Plugin directory not found', 'waas-pm'), array('status' => 404));
        }

        // Delete plugin directory recursively
        $deleted = $this->delete_directory($plugin_dir);

        if (!$deleted) {
            return new WP_Error('delete_failed', __('Failed to delete plugin directory', 'waas-pm'), array('status' => 500));
        }

        // Refresh plugin cache
        wp_cache_delete('plugins', 'plugins');

        return rest_ensure_response(array(
            'success' => true,
            'message' => __('Plugin deleted successfully', 'waas-pm'),
        ));
    }

    /**
     * Validate plugin code (basic security check)
     *
     * @param string $code PHP code
     * @return bool
     */
    private function validate_plugin_code($code) {
        // Check for PHP opening tag
        if (strpos($code, '<?php') !== 0) {
            return false;
        }

        // Check for dangerous functions (basic blacklist)
        $dangerous_functions = array(
            'eval(',
            'exec(',
            'system(',
            'passthru(',
            'shell_exec(',
            'popen(',
            'proc_open(',
            'pcntl_exec(',
            'base64_decode(',
            'file_get_contents("http',
            'file_put_contents($',
            'curl_exec(',
            'fsockopen(',
        );

        foreach ($dangerous_functions as $func) {
            if (stripos($code, $func) !== false) {
                // Allow some safe contexts
                if ($func === 'file_put_contents($' || $func === 'file_get_contents("http') {
                    continue; // These might be used safely in WordPress
                }
                return false;
            }
        }

        // Check for WordPress plugin header
        if (stripos($code, 'Plugin Name:') === false) {
            return false;
        }

        return true;
    }

    /**
     * Delete directory recursively
     *
     * @param string $dir Directory path
     * @return bool
     */
    private function delete_directory($dir) {
        if (!is_dir($dir)) {
            return false;
        }

        $files = array_diff(scandir($dir), array('.', '..'));

        foreach ($files as $file) {
            $path = $dir . '/' . $file;

            if (is_dir($path)) {
                $this->delete_directory($path);
            } else {
                unlink($path);
            }
        }

        return rmdir($dir);
    }
}
