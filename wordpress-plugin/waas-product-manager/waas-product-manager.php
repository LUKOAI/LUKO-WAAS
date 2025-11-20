<?php
/**
 * Plugin Name: LUKO-WAAS Product Manager
 * Plugin URI: https://github.com/LUKOAI/LUKO-WAAS
 * Description: Automated WordPress Affiliate Site Framework for Amazon Sellers - Product management, shortcodes, and PA-API integration
 * Version: 1.0.0
 * Author: LUKO AI
 * Author URI: https://github.com/LUKOAI
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: waas-pm
 * Domain Path: /languages
 *
 * @package WAAS_Product_Manager
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('WAAS_PM_VERSION', '1.0.0');
define('WAAS_PM_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WAAS_PM_PLUGIN_URL', plugin_dir_url(__FILE__));
define('WAAS_PM_PLUGIN_BASENAME', plugin_basename(__FILE__));

/**
 * Main WAAS Product Manager Class
 */
class WAAS_Product_Manager {

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
        require_once WAAS_PM_PLUGIN_DIR . 'includes/class-product-post-type.php';
        require_once WAAS_PM_PLUGIN_DIR . 'includes/class-shortcodes.php';
        require_once WAAS_PM_PLUGIN_DIR . 'includes/class-amazon-api.php';
        require_once WAAS_PM_PLUGIN_DIR . 'includes/class-cache-manager.php';
        require_once WAAS_PM_PLUGIN_DIR . 'includes/class-rest-api.php';
        require_once WAAS_PM_PLUGIN_DIR . 'includes/class-product-importer.php';

        // Admin functionality
        if (is_admin()) {
            require_once WAAS_PM_PLUGIN_DIR . 'admin/class-admin-dashboard.php';
            require_once WAAS_PM_PLUGIN_DIR . 'admin/class-admin-settings.php';
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

        // Enqueue scripts and styles
        add_action('wp_enqueue_scripts', array($this, 'enqueue_frontend_assets'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_assets'));

        // Daily cron for product updates
        add_action('waas_pm_daily_update', array($this, 'run_daily_product_update'));

        // Load plugin textdomain
        add_action('init', array($this, 'load_textdomain'));
    }

    /**
     * Initialize plugin components
     */
    public function init_components() {
        // Initialize custom post type
        WAAS_Product_Post_Type::get_instance();

        // Initialize shortcodes
        WAAS_Shortcodes::get_instance();

        // Initialize REST API
        WAAS_REST_API::get_instance();

        // Initialize admin if in admin area
        if (is_admin()) {
            WAAS_Admin_Dashboard::get_instance();
            WAAS_Admin_Settings::get_instance();
        }
    }

    /**
     * Plugin activation
     */
    public function activate() {
        // Create custom post type
        WAAS_Product_Post_Type::register_post_type();

        // Flush rewrite rules
        flush_rewrite_rules();

        // Schedule daily cron job for product updates
        if (!wp_next_scheduled('waas_pm_daily_update')) {
            wp_schedule_event(strtotime('02:00:00'), 'daily', 'waas_pm_daily_update');
        }

        // Create database tables if needed
        $this->create_tables();
    }

    /**
     * Plugin deactivation
     */
    public function deactivate() {
        // Unschedule cron jobs
        wp_clear_scheduled_hook('waas_pm_daily_update');

        // Flush rewrite rules
        flush_rewrite_rules();
    }

    /**
     * Create custom database tables
     */
    private function create_tables() {
        global $wpdb;

        $charset_collate = $wpdb->get_charset_collate();

        // Table for product cache
        $table_name = $wpdb->prefix . 'waas_product_cache';

        $sql = "CREATE TABLE IF NOT EXISTS $table_name (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            asin varchar(20) NOT NULL,
            product_data longtext NOT NULL,
            last_updated datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY asin (asin),
            KEY last_updated (last_updated)
        ) $charset_collate;";

        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);

        // Table for API logs
        $table_name = $wpdb->prefix . 'waas_api_logs';

        $sql = "CREATE TABLE IF NOT EXISTS $table_name (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            api_type varchar(50) NOT NULL,
            request_data longtext,
            response_data longtext,
            status varchar(20) NOT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY (id),
            KEY api_type (api_type),
            KEY created_at (created_at)
        ) $charset_collate;";

        dbDelta($sql);
    }

    /**
     * Enqueue frontend assets
     */
    public function enqueue_frontend_assets() {
        wp_enqueue_style(
            'waas-pm-frontend',
            WAAS_PM_PLUGIN_URL . 'assets/css/frontend.css',
            array(),
            WAAS_PM_VERSION
        );

        wp_enqueue_script(
            'waas-pm-frontend',
            WAAS_PM_PLUGIN_URL . 'assets/js/frontend.js',
            array('jquery'),
            WAAS_PM_VERSION,
            true
        );

        wp_localize_script('waas-pm-frontend', 'waasPM', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('waas_pm_nonce')
        ));
    }

    /**
     * Enqueue admin assets
     */
    public function enqueue_admin_assets($hook) {
        // Only load on our admin pages
        if (!in_array($hook, array('toplevel_page_waas-pm-dashboard', 'waas-product-manager_page_waas-pm-settings'))) {
            return;
        }

        wp_enqueue_style(
            'waas-pm-admin',
            WAAS_PM_PLUGIN_URL . 'assets/css/admin.css',
            array(),
            WAAS_PM_VERSION
        );

        wp_enqueue_script(
            'waas-pm-admin',
            WAAS_PM_PLUGIN_URL . 'assets/js/admin.js',
            array('jquery'),
            WAAS_PM_VERSION,
            true
        );

        wp_localize_script('waas-pm-admin', 'waasPMAdmin', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('waas_pm_admin_nonce'),
            'rest_url' => rest_url('waas/v1/'),
            'rest_nonce' => wp_create_nonce('wp_rest')
        ));
    }

    /**
     * Run daily product update
     */
    public function run_daily_product_update() {
        $importer = new WAAS_Product_Importer();
        $importer->update_all_products();
    }

    /**
     * Load plugin textdomain
     */
    public function load_textdomain() {
        load_plugin_textdomain(
            'waas-pm',
            false,
            dirname(WAAS_PM_PLUGIN_BASENAME) . '/languages'
        );
    }
}

/**
 * Initialize the plugin
 */
function waas_pm_init() {
    return WAAS_Product_Manager::get_instance();
}

// Start the plugin
waas_pm_init();
