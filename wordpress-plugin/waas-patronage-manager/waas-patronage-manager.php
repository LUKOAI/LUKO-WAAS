<?php
/**
 * Plugin Name: LUKO-WAAS Patronage Manager
 * Plugin URI: https://github.com/LUKOAI/LUKO-WAAS
 * Description: Manages patronage system for WAAS - allows switching between multi-vendor and single-vendor (patron) mode with conditional branding
 * Version: 1.0.0
 * Author: LUKO AI
 * Author URI: https://github.com/LUKOAI
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: waas-patronage
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 *
 * @package WAAS_Patronage_Manager
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('WAAS_PATRONAGE_VERSION', '1.0.0');
define('WAAS_PATRONAGE_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WAAS_PATRONAGE_PLUGIN_URL', plugin_dir_url(__FILE__));
define('WAAS_PATRONAGE_PLUGIN_BASENAME', plugin_basename(__FILE__));

/**
 * Main WAAS Patronage Manager Class
 */
class WAAS_Patronage_Manager {

    /**
     * Instance of this class
     *
     * @var object
     */
    protected static $instance = null;

    /**
     * Initialize the plugin
     */
    private function __construct() {
        $this->load_dependencies();
        $this->init_hooks();
    }

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
     * Load required dependencies
     */
    private function load_dependencies() {
        // Core functionality
        require_once WAAS_PATRONAGE_PLUGIN_DIR . 'includes/class-patronage-core.php';
        require_once WAAS_PATRONAGE_PLUGIN_DIR . 'includes/class-patronage-rest-api.php';
        require_once WAAS_PATRONAGE_PLUGIN_DIR . 'includes/class-patronage-product-filter.php';
        require_once WAAS_PATRONAGE_PLUGIN_DIR . 'includes/class-patronage-cache.php';

        // Admin functionality
        if (is_admin()) {
            require_once WAAS_PATRONAGE_PLUGIN_DIR . 'admin/class-patronage-admin.php';
        }

        // Public functionality
        if (!is_admin()) {
            require_once WAAS_PATRONAGE_PLUGIN_DIR . 'public/class-patronage-public.php';
        }
    }

    /**
     * Initialize WordPress hooks
     */
    private function init_hooks() {
        // Activation/Deactivation hooks
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));

        // Initialize components
        add_action('plugins_loaded', array($this, 'init_components'));

        // Enqueue public assets
        add_action('wp_enqueue_scripts', array($this, 'enqueue_public_assets'));

        // Enqueue admin assets
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_assets'));

        // Load plugin textdomain
        add_action('init', array($this, 'load_textdomain'));
    }

    /**
     * Initialize plugin components
     */
    public function init_components() {
        // Initialize core patronage system
        WAAS_Patronage_Core::get_instance();

        // Initialize REST API
        WAAS_Patronage_REST_API::get_instance();

        // Initialize product filter
        WAAS_Patronage_Product_Filter::get_instance();

        // Initialize cache manager
        WAAS_Patronage_Cache::get_instance();

        // Initialize admin if in admin area
        if (is_admin()) {
            WAAS_Patronage_Admin::get_instance();
        }

        // Initialize public if not in admin
        if (!is_admin()) {
            WAAS_Patronage_Public::get_instance();
        }
    }

    /**
     * Plugin activation
     */
    public function activate() {
        // Initialize default options
        $this->init_default_options();

        // Flush rewrite rules
        flush_rewrite_rules();

        // Log activation
        if (function_exists('error_log')) {
            error_log('WAAS Patronage Manager: Plugin activated');
        }
    }

    /**
     * Plugin deactivation
     */
    public function deactivate() {
        // Flush rewrite rules
        flush_rewrite_rules();

        // Log deactivation
        if (function_exists('error_log')) {
            error_log('WAAS Patronage Manager: Plugin deactivated');
        }
    }

    /**
     * Initialize default options
     */
    private function init_default_options() {
        // Set default patronage status to inactive
        if (get_option('waas_patronage_active') === false) {
            add_option('waas_patronage_active', false);
        }

        // Initialize empty patron data
        if (get_option('waas_patron_data') === false) {
            add_option('waas_patron_data', array());
        }

        // Initialize empty patron seller ID
        if (get_option('waas_patron_seller_id') === false) {
            add_option('waas_patron_seller_id', '');
        }

        // Initialize patronage features
        if (get_option('waas_patronage_features') === false) {
            add_option('waas_patronage_features', array(
                'logo' => true,
                'contact' => true,
                'brand_story' => true,
                'exclusive_products' => true,
            ));
        }
    }

    /**
     * Enqueue public assets
     */
    public function enqueue_public_assets() {
        // Only enqueue if patronage is active
        if (!get_option('waas_patronage_active', false)) {
            return;
        }

        wp_enqueue_style(
            'waas-patronage-public',
            WAAS_PATRONAGE_PLUGIN_URL . 'public/css/patronage-public.css',
            array(),
            WAAS_PATRONAGE_VERSION
        );
    }

    /**
     * Enqueue admin assets
     */
    public function enqueue_admin_assets($hook) {
        // Only load on our admin pages
        if (!in_array($hook, array('toplevel_page_waas-patronage', 'waas-patronage_page_waas-patronage-settings'))) {
            return;
        }

        wp_enqueue_style(
            'waas-patronage-admin',
            WAAS_PATRONAGE_PLUGIN_URL . 'admin/css/patronage-admin.css',
            array(),
            WAAS_PATRONAGE_VERSION
        );

        wp_enqueue_script(
            'waas-patronage-admin',
            WAAS_PATRONAGE_PLUGIN_URL . 'admin/js/patronage-admin.js',
            array('jquery'),
            WAAS_PATRONAGE_VERSION,
            true
        );

        wp_localize_script('waas-patronage-admin', 'waasPatronage', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('waas_patronage_admin_nonce'),
            'rest_url' => rest_url('waas/v1/'),
            'rest_nonce' => wp_create_nonce('wp_rest')
        ));
    }

    /**
     * Load plugin textdomain
     */
    public function load_textdomain() {
        load_plugin_textdomain(
            'waas-patronage',
            false,
            dirname(WAAS_PATRONAGE_PLUGIN_BASENAME) . '/languages'
        );
    }
}

/**
 * Initialize the plugin
 */
function waas_patronage_init() {
    return WAAS_Patronage_Manager::get_instance();
}

// Start the plugin
waas_patronage_init();
