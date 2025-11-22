<?php
/**
 * Patronage Admin Interface
 *
 * @package WAAS_Patronage_Manager
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WAAS Patronage Admin Class
 */
class WAAS_Patronage_Admin {

    /**
     * Instance of this class
     *
     * @var object
     */
    protected static $instance = null;

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
        $this->init_hooks();
    }

    /**
     * Initialize hooks
     */
    private function init_hooks() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'handle_form_submission'));
        add_action('admin_notices', array($this, 'show_admin_notices'));
    }

    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        add_menu_page(
            __('WAAS Patronage', 'waas-patronage'),
            __('WAAS Patronage', 'waas-patronage'),
            'manage_options',
            'waas-patronage',
            array($this, 'render_admin_page'),
            'dashicons-groups',
            30
        );

        add_submenu_page(
            'waas-patronage',
            __('Patronage Manager', 'waas-patronage'),
            __('Manager', 'waas-patronage'),
            'manage_options',
            'waas-patronage',
            array($this, 'render_admin_page')
        );

        add_submenu_page(
            'waas-patronage',
            __('Statistics', 'waas-patronage'),
            __('Statistics', 'waas-patronage'),
            'manage_options',
            'waas-patronage-stats',
            array($this, 'render_stats_page')
        );

        add_submenu_page(
            'waas-patronage',
            __('Logs', 'waas-patronage'),
            __('Logs', 'waas-patronage'),
            'manage_options',
            'waas-patronage-logs',
            array($this, 'render_logs_page')
        );
    }

    /**
     * Handle form submission
     */
    public function handle_form_submission() {
        if (!isset($_POST['waas_patronage_action'])) {
            return;
        }

        // Verify nonce
        if (!isset($_POST['waas_patronage_nonce']) || !wp_verify_nonce($_POST['waas_patronage_nonce'], 'waas_patronage_action')) {
            wp_die(__('Security check failed', 'waas-patronage'));
        }

        // Check permissions
        if (!current_user_can('manage_options')) {
            wp_die(__('You do not have permission to perform this action', 'waas-patronage'));
        }

        $action = sanitize_text_field($_POST['waas_patronage_action']);

        if ($action === 'activate') {
            $this->handle_activation();
        } elseif ($action === 'deactivate') {
            $this->handle_deactivation();
        } elseif ($action === 'update') {
            $this->handle_update();
        }
    }

    /**
     * Handle activation
     */
    private function handle_activation() {
        $seller_id = sanitize_text_field($_POST['seller_id']);
        $brand_name = sanitize_text_field($_POST['brand_name']);
        $logo_url = esc_url_raw($_POST['logo_url']);

        $patron_data = array(
            'brand_name' => $brand_name,
            'logo_url' => $logo_url,
            'email' => !empty($_POST['email']) ? sanitize_email($_POST['email']) : '',
            'phone' => !empty($_POST['phone']) ? sanitize_text_field($_POST['phone']) : '',
            'website' => !empty($_POST['website']) ? esc_url_raw($_POST['website']) : '',
            'brand_story' => !empty($_POST['brand_story']) ? wp_kses_post($_POST['brand_story']) : '',
        );

        $features = array(
            'logo' => isset($_POST['feature_logo']),
            'contact' => isset($_POST['feature_contact']),
            'brand_story' => isset($_POST['feature_brand_story']),
            'exclusive_products' => isset($_POST['feature_exclusive_products']),
        );

        $result = $this->patronage_core->activate_patronage($seller_id, $patron_data, $features);

        if (is_wp_error($result)) {
            set_transient('waas_patronage_admin_error', $result->get_error_message(), 30);
        } else {
            set_transient('waas_patronage_admin_success', __('Patronage activated successfully!', 'waas-patronage'), 30);
        }

        wp_redirect(admin_url('admin.php?page=waas-patronage'));
        exit;
    }

    /**
     * Handle deactivation
     */
    private function handle_deactivation() {
        $result = $this->patronage_core->deactivate_patronage();

        if (is_wp_error($result)) {
            set_transient('waas_patronage_admin_error', $result->get_error_message(), 30);
        } else {
            set_transient('waas_patronage_admin_success', __('Patronage deactivated successfully!', 'waas-patronage'), 30);
        }

        wp_redirect(admin_url('admin.php?page=waas-patronage'));
        exit;
    }

    /**
     * Handle update
     */
    private function handle_update() {
        $new_data = array();

        if (!empty($_POST['brand_name'])) {
            $new_data['brand_name'] = sanitize_text_field($_POST['brand_name']);
        }
        if (!empty($_POST['logo_url'])) {
            $new_data['logo_url'] = esc_url_raw($_POST['logo_url']);
        }
        if (!empty($_POST['email'])) {
            $new_data['email'] = sanitize_email($_POST['email']);
        }
        if (!empty($_POST['phone'])) {
            $new_data['phone'] = sanitize_text_field($_POST['phone']);
        }
        if (!empty($_POST['website'])) {
            $new_data['website'] = esc_url_raw($_POST['website']);
        }
        if (!empty($_POST['brand_story'])) {
            $new_data['brand_story'] = wp_kses_post($_POST['brand_story']);
        }

        $result = $this->patronage_core->update_patron_data($new_data);

        if (is_wp_error($result)) {
            set_transient('waas_patronage_admin_error', $result->get_error_message(), 30);
        } else {
            set_transient('waas_patronage_admin_success', __('Patron data updated successfully!', 'waas-patronage'), 30);
        }

        wp_redirect(admin_url('admin.php?page=waas-patronage'));
        exit;
    }

    /**
     * Show admin notices
     */
    public function show_admin_notices() {
        $error = get_transient('waas_patronage_admin_error');
        if ($error) {
            echo '<div class="notice notice-error is-dismissible"><p>' . esc_html($error) . '</p></div>';
            delete_transient('waas_patronage_admin_error');
        }

        $success = get_transient('waas_patronage_admin_success');
        if ($success) {
            echo '<div class="notice notice-success is-dismissible"><p>' . esc_html($success) . '</p></div>';
            delete_transient('waas_patronage_admin_success');
        }
    }

    /**
     * Render admin page
     */
    public function render_admin_page() {
        $is_active = $this->patronage_core->is_patronage_active();
        $patron_data = $this->patronage_core->get_patron_data();
        $features = $this->patronage_core->get_patronage_features();

        include WAAS_PATRONAGE_PLUGIN_DIR . 'admin/partials/patronage-admin-display.php';
    }

    /**
     * Render statistics page
     */
    public function render_stats_page() {
        $stats = $this->patronage_core->get_patronage_stats();
        include WAAS_PATRONAGE_PLUGIN_DIR . 'admin/partials/patronage-stats-display.php';
    }

    /**
     * Render logs page
     */
    public function render_logs_page() {
        $logs = $this->patronage_core->get_patronage_logs(50);
        include WAAS_PATRONAGE_PLUGIN_DIR . 'admin/partials/patronage-logs-display.php';
    }
}
