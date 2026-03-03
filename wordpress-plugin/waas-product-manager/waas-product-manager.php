<?php
/**
 * Plugin Name: LUKO-WAAS Product Manager
 * Plugin URI: https://github.com/LUKOAI/LUKO-WAAS
 * Description: Automated WordPress Affiliate Site Framework for Amazon Sellers - Product management, shortcodes, and PA-API integration
 * Version: 3.0.0
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
define('WAAS_PM_VERSION', '3.0.0');
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

        // Enhanced shortcodes (if available)
        if (file_exists(WAAS_PM_PLUGIN_DIR . 'includes/class-shortcodes-enhanced.php')) {
            require_once WAAS_PM_PLUGIN_DIR . 'includes/class-shortcodes-enhanced.php';
        }

        // Comparison shortcodes (product comparisons, direct Amazon links, grids, tables)
        if (file_exists(WAAS_PM_PLUGIN_DIR . 'includes/class-shortcodes-comparison.php')) {
            require_once WAAS_PM_PLUGIN_DIR . 'includes/class-shortcodes-comparison.php';
        }

        // WooCommerce integration files - loaded in init_components() when WooCommerce is available

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

        // Initialize components after all plugins are loaded
        add_action('plugins_loaded', array($this, 'init_components'), 20);

        // WooCommerce integration - delay to 'init' hook for safety
        add_action('init', array($this, 'init_woocommerce_integration'), 0);

        // Enqueue scripts and styles
        add_action('wp_enqueue_scripts', array($this, 'enqueue_frontend_assets'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_assets'));

        // Daily cron for product updates
        add_action('waas_pm_daily_update', array($this, 'run_daily_product_update'));

        // Load plugin textdomain
        add_action('init', array($this, 'load_textdomain'));

        // Add affiliate disclaimer to site footer
        add_action('wp_footer', array($this, 'add_footer_disclaimer'), 99);
    }

    /**
     * Initialize plugin components
     *
     * v3: waas_product CPT is deprecated — kept only for migration.
     * Products are now imported directly to WooCommerce.
     */
    public function init_components() {
        // Initialize deprecated custom post type (hidden, for migration only)
        WAAS_Product_Post_Type::get_instance();

        // Initialize shortcodes
        WAAS_Shortcodes::get_instance();

        // Initialize enhanced shortcodes (if available)
        if (class_exists('WAAS_Product_Shortcodes')) {
            WAAS_Product_Shortcodes::get_instance();
        }

        // Initialize comparison shortcodes (if available)
        if (class_exists('WAAS_Shortcodes_Comparison')) {
            WAAS_Shortcodes_Comparison::get_instance();
        }

        // Initialize REST API V2 (v3 — direct WooCommerce import + migration)
        if (file_exists(WAAS_PM_PLUGIN_DIR . 'includes/class-rest-api-v2.php')) {
            require_once WAAS_PM_PLUGIN_DIR . 'includes/class-rest-api-v2.php';
            WAAS_REST_API_V2::get_instance();
        } else {
            // Fallback to V1
            WAAS_REST_API::get_instance();
        }

        // Initialize admin if in admin area
        if (is_admin()) {
            WAAS_Admin_Dashboard::get_instance();
            WAAS_Admin_Settings::get_instance();
        }
    }

    /**
     * Initialize WooCommerce integration
     * Called on 'woocommerce_loaded' hook to ensure WooCommerce is fully available
     */
    public function init_woocommerce_integration() {
        // Only proceed if WooCommerce is active
        if (!class_exists('WooCommerce')) {
            return;
        }

        // Prevent double initialization
        static $initialized = false;
        if ($initialized) {
            return;
        }
        $initialized = true;

        // Load WooCommerce integration files
        require_once WAAS_PM_PLUGIN_DIR . 'includes/class-woocommerce-sync.php';
        require_once WAAS_PM_PLUGIN_DIR . 'includes/class-price-disclaimer.php';
        require_once WAAS_PM_PLUGIN_DIR . 'includes/class-price-updater.php';

        // Initialize components
        WAAS_WooCommerce_Sync::get_instance();
        WAAS_Price_Disclaimer::get_instance();
        WAAS_Price_Updater::get_instance();
    }

    /**
     * Plugin activation
     */
    public function activate() {
        // Create custom post type
        WAAS_Product_Post_Type::register_post_type();

        // Flush rewrite rules
        flush_rewrite_rules();

        // v3: Schedule daily cron job at random time between 01:00-05:00
        // Random hour prevents all sites from hitting Amazon API simultaneously
        if (!wp_next_scheduled('waas_pm_daily_update')) {
            $random_hour = wp_rand(1, 4);   // 1-4
            $random_min  = wp_rand(0, 59);  // 0-59
            $cron_time   = strtotime(sprintf('today %02d:%02d:00', $random_hour, $random_min));
            // If that time already passed today, schedule for tomorrow
            if ($cron_time < time()) {
                $cron_time += DAY_IN_SECONDS;
            }
            wp_schedule_event($cron_time, 'daily', 'waas_pm_daily_update');
            error_log(sprintf('WAAS: Daily price sync scheduled at %02d:%02d', $random_hour, $random_min));
        }

        // Create database tables if needed
        $this->create_tables();

        // CRITICAL: Set WooCommerce settings to German format
        // This ensures the settings are applied even if filters don't work
        if (class_exists('WooCommerce')) {
            // German price format: 115,00 € (comma for decimal, dot for thousands)
            update_option('woocommerce_price_decimal_sep', ',');
            update_option('woocommerce_price_thousand_sep', '.');
            update_option('woocommerce_price_num_decimals', 2);
            update_option('woocommerce_currency_pos', 'right_space'); // Price then symbol: 115,00 €

            error_log('WAAS: German price format settings applied');
        }

        // Create Amazon-Vorteile page
        $this->create_amazon_vorteile_page();
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
     * Create Amazon-Vorteile page
     * NEW: Per latest requirements - page promoting Amazon services
     */
    private function create_amazon_vorteile_page() {
        // Check if page already exists
        $existing_page = get_page_by_path('amazon-vorteile');
        if ($existing_page) {
            error_log('WAAS: Amazon-Vorteile page already exists');
            return;
        }

        // Get tracking ID from settings (from WAAS Product Manager Settings)
        $tracking_id = get_option('waas_pm_amazon_partner_tag', '');
        if (empty($tracking_id)) {
            $tracking_id = 'YOUR_TRACKING_ID'; // Fallback if not configured
        }

        // Page content with all Amazon services
        $content = '
<div class="amazon-vorteile" style="max-width: 1200px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="font-size: 2.5em; color: #232F3E; margin-bottom: 15px;">Amazon-Vorteile entdecken</h1>
        <p style="font-size: 1.2em; color: #666;">Entdecken Sie die besten Services von Amazon</p>
    </div>

    <!-- Amazon Prime -->
    <div class="service-box" style="background: linear-gradient(135deg, #00A8E1 0%, #0073CF 100%); padding: 40px; margin-bottom: 30px; border-radius: 10px; color: white;">
        <h2 style="color: white; font-size: 2em; margin-bottom: 15px;">🎁 Amazon Prime</h2>
        <p style="font-size: 1.1em; margin-bottom: 20px; line-height: 1.6;">
            Schneller, kostenloser Versand, exklusive Deals und unbegrenztes Streaming von Filmen und Serien.
            Genießen Sie Prime Video, Prime Music, Prime Reading und vieles mehr – alles in einer Mitgliedschaft!
        </p>
        <ul style="font-size: 1em; margin-bottom: 25px; line-height: 1.8;">
            <li>✓ Kostenloser Premium-Versand</li>
            <li>✓ Prime Video: Unbegrenzt Filme & Serien streamen</li>
            <li>✓ Prime Music: Millionen Songs werbefrei</li>
            <li>✓ Exklusive Angebote und früher Zugang zu Deals</li>
            <li>✓ 30 Tage kostenlos testen</li>
        </ul>
        <a href="https://www.amazon.de/prime?tag=' . $tracking_id . '" target="_blank" rel="nofollow noopener" style="display: inline-block; background-color: #FF9900; color: #000; padding: 15px 40px; font-size: 1.2em; font-weight: bold; text-decoration: none; border-radius: 5px; transition: all 0.3s;">
            Jetzt 30 Tage kostenlos testen →
        </a>
    </div>

    <!-- Prime Video -->
    <div class="service-box" style="background: linear-gradient(135deg, #1A98FF 0%, #0D47A1 100%); padding: 40px; margin-bottom: 30px; border-radius: 10px; color: white;">
        <h2 style="color: white; font-size: 2em; margin-bottom: 15px;">🎬 Prime Video</h2>
        <p style="font-size: 1.1em; margin-bottom: 20px; line-height: 1.6;">
            Streamen Sie tausende Filme und Serien, darunter preisgekrönte Amazon Originals.
            Auf jedem Gerät verfügbar – zu Hause oder unterwegs.
        </p>
        <ul style="font-size: 1em; margin-bottom: 25px; line-height: 1.8;">
            <li>✓ Tausende Filme und Serien</li>
            <li>✓ Exklusive Amazon Originals</li>
            <li>✓ Auf allen Geräten verfügbar</li>
            <li>✓ Download für Offline-Viewing</li>
        </ul>
        <a href="https://www.amazon.de/primevideo?tag=' . $tracking_id . '" target="_blank" rel="nofollow noopener" style="display: inline-block; background-color: #FF9900; color: #000; padding: 15px 40px; font-size: 1.2em; font-weight: bold; text-decoration: none; border-radius: 5px; transition: all 0.3s;">
            Prime Video entdecken →
        </a>
    </div>

    <!-- Audible -->
    <div class="service-box" style="background: linear-gradient(135deg, #FF9900 0%, #FF6600 100%); padding: 40px; margin-bottom: 30px; border-radius: 10px; color: white;">
        <h2 style="color: white; font-size: 2em; margin-bottom: 15px;">🎧 Audible</h2>
        <p style="font-size: 1.1em; margin-bottom: 20px; line-height: 1.6;">
            Hörbücher und Hörspiele von Bestseller-Autoren. Perfekt für unterwegs, beim Sport oder zum Einschlafen.
        </p>
        <ul style="font-size: 1em; margin-bottom: 25px; line-height: 1.8;">
            <li>✓ Über 200.000 Hörbücher und Podcasts</li>
            <li>✓ Exklusive Audible Originals</li>
            <li>✓ Offline hörbar</li>
            <li>✓ 30 Tage kostenlos testen</li>
        </ul>
        <a href="https://www.amazon.de/hz/audible/mlp?tag=' . $tracking_id . '" target="_blank" rel="nofollow noopener" style="display: inline-block; background-color: #232F3E; color: white; padding: 15px 40px; font-size: 1.2em; font-weight: bold; text-decoration: none; border-radius: 5px; transition: all 0.3s;">
            Audible kostenlos testen →
        </a>
    </div>

    <!-- Music Unlimited -->
    <div class="service-box" style="background: linear-gradient(135deg, #FF4081 0%, #C51162 100%); padding: 40px; margin-bottom: 30px; border-radius: 10px; color: white;">
        <h2 style="color: white; font-size: 2em; margin-bottom: 15px;">🎵 Amazon Music Unlimited</h2>
        <p style="font-size: 1.1em; margin-bottom: 20px; line-height: 1.6;">
            Über 100 Millionen Songs in HD-Qualität. Werbefreies Streaming auf allen Geräten.
        </p>
        <ul style="font-size: 1em; margin-bottom: 25px; line-height: 1.8;">
            <li>✓ 100 Millionen Songs</li>
            <li>✓ HD und Ultra HD Qualität</li>
            <li>✓ Offline-Modus</li>
            <li>✓ Alexa-Integration</li>
            <li>✓ 30 Tage kostenlos testen</li>
        </ul>
        <a href="https://www.amazon.de/music/unlimited?tag=' . $tracking_id . '" target="_blank" rel="nofollow noopener" style="display: inline-block; background-color: #232F3E; color: white; padding: 15px 40px; font-size: 1.2em; font-weight: bold; text-decoration: none; border-radius: 5px; transition: all 0.3s;">
            Music Unlimited testen →
        </a>
    </div>

    <!-- Amazon Geräte -->
    <div class="service-box" style="background: linear-gradient(135deg, #232F3E 0%, #131A22 100%); padding: 40px; margin-bottom: 30px; border-radius: 10px; color: white;">
        <h2 style="color: white; font-size: 2em; margin-bottom: 15px;">📱 Amazon Geräte</h2>
        <p style="font-size: 1.1em; margin-bottom: 20px; line-height: 1.6;">
            Echo, Kindle, Fire TV und mehr – entdecken Sie die innovativen Geräte von Amazon für Ihr Smart Home.
        </p>
        <ul style="font-size: 1em; margin-bottom: 25px; line-height: 1.8;">
            <li>✓ Echo & Alexa: Sprachassistent für Ihr Zuhause</li>
            <li>✓ Kindle: E-Reader für Leseratten</li>
            <li>✓ Fire TV: Streaming-Stick & Smart TVs</li>
            <li>✓ Ring: Smarte Türklingeln & Sicherheit</li>
            <li>✓ eero: WLAN-Mesh-Systeme</li>
        </ul>
        <a href="https://www.amazon.de/b?node=10925051&tag=' . $tracking_id . '" target="_blank" rel="nofollow noopener" style="display: inline-block; background-color: #FF9900; color: #000; padding: 15px 40px; font-size: 1.2em; font-weight: bold; text-decoration: none; border-radius: 5px; transition: all 0.3s;">
            Amazon Geräte entdecken →
        </a>
    </div>

    <!-- Footer Disclaimer -->
    <div style="text-align: center; margin-top: 50px; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
        <p style="font-size: 0.9em; color: #666; margin: 0;">
            * Als Amazon-Partner verdienen wir an qualifizierten Verkäufen. Die Preise können sich ändern.
            Alle Angaben ohne Gewähr. Letzte Aktualisierung am ' . date('d.m.Y') . '.
        </p>
    </div>
</div>
';

        // Create the page
        $page_data = array(
            'post_title'    => 'Amazon-Vorteile entdecken',
            'post_content'  => $content,
            'post_status'   => 'publish',
            'post_type'     => 'page',
            'post_name'     => 'amazon-vorteile',
            'post_author'   => 1,
            'comment_status' => 'closed',
            'ping_status'   => 'closed'
        );

        $page_id = wp_insert_post($page_data);

        if ($page_id && !is_wp_error($page_id)) {
            error_log("WAAS: Created Amazon-Vorteile page (ID: {$page_id})");
        } else {
            error_log("WAAS: Failed to create Amazon-Vorteile page");
        }
    }

    /**
     * Enqueue frontend assets
     */
    public function enqueue_frontend_assets() {
        // Original frontend styles
        wp_enqueue_style(
            'waas-pm-frontend',
            WAAS_PM_PLUGIN_URL . 'assets/css/frontend.css',
            array(),
            WAAS_PM_VERSION
        );

        // Shortcodes styles (if file exists)
        if (file_exists(WAAS_PM_PLUGIN_DIR . 'assets/css/shortcodes.css')) {
            wp_enqueue_style(
                'waas-pm-shortcodes',
                WAAS_PM_PLUGIN_URL . 'assets/css/shortcodes.css',
                array(),
                WAAS_PM_VERSION
            );
        }

        // Original frontend script
        wp_enqueue_script(
            'waas-pm-frontend',
            WAAS_PM_PLUGIN_URL . 'assets/js/frontend.js',
            array('jquery'),
            WAAS_PM_VERSION,
            true
        );

        // Shortcodes script (if file exists)
        if (file_exists(WAAS_PM_PLUGIN_DIR . 'assets/js/shortcodes.js')) {
            wp_enqueue_script(
                'waas-pm-shortcodes',
                WAAS_PM_PLUGIN_URL . 'assets/js/shortcodes.js',
                array('jquery'),
                WAAS_PM_VERSION,
                true
            );
        }

        wp_localize_script('waas-pm-frontend', 'waasPM', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('waas_pm_nonce')
        ));

        // Product meta disclaimer - DISABLED, handled by class-price-disclaimer.php
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

    /**
     * Add affiliate disclaimer to site footer
     * Outputs custom CSS and a fallback PHP-based footer injection
     */
    public function add_footer_disclaimer() {
        // Output custom CSS for footer styling
        ?>
        <style type="text/css">
            /* WAAS Footer Styling - Override theme styles */
            #footer-bottom,
            .footer-bottom,
            #main-footer .bottom-nav-wrap,
            .et_pb_bottom_footer_container {
                background-color: #ffffff !important;
            }

            #footer-info,
            .waas-affiliate-footer,
            #footer-bottom .container,
            .et_pb_bottom_footer_container .container {
                background-color: #ffffff !important;
                color: #888888 !important;
                font-size: 0.85em !important;
                text-align: center !important;
                line-height: 1.5 !important;
                padding: 15px 0 !important;
            }

            /* Ensure contrast */
            #footer-info a,
            .waas-affiliate-footer a {
                color: #666666 !important;
            }
        </style>

        <!-- PHP Fallback Footer (hidden, revealed by JS if needed) -->
        <div id="waas-footer-fallback" style="display: none; background-color: #ffffff; color: #888888; font-size: 0.85em; text-align: center; line-height: 1.5; padding: 15px 0;">
            &copy; 2025 Passgenaue LKW-Fußmatten | * Affiliate-Link (Werbung). Preise inkl. MwSt., ggf. zzgl. Versandkosten.<br>
            Als Amazon-Partner verdienen wir an qualifizierten Käufen eine kleine<br>
            Provision, die den Produktpreis nicht beeinflusst.
        </div>
        <?php
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
