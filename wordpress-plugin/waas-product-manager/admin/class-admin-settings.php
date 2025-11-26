<?php
/**
 * Admin Settings Page
 *
 * @package WAAS_Product_Manager
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WAAS Admin Settings Class
 */
class WAAS_Admin_Settings {

    /**
     * Instance of this class
     *
     * @var object
     */
    protected static $instance = null;

    /**
     * Settings option name
     *
     * @var string
     */
    const SETTINGS_OPTION = 'waas_pm_settings';
    const API_SETTINGS_OPTION = 'waas_pm_amazon_api_settings';

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
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_notices', array($this, 'show_admin_notices'));
    }

    /**
     * Register settings
     */
    public function register_settings() {
        // Amazon API Settings Section
        add_settings_section(
            'waas_pm_amazon_api_section',
            __('Amazon Product Advertising API Settings', 'waas-pm'),
            array($this, 'render_amazon_api_section'),
            'waas-pm-settings'
        );

        register_setting('waas-pm-settings', self::API_SETTINGS_OPTION, array(
            'sanitize_callback' => array($this, 'sanitize_api_settings'),
        ));

        add_settings_field(
            'access_key',
            __('Access Key', 'waas-pm'),
            array($this, 'render_text_field'),
            'waas-pm-settings',
            'waas_pm_amazon_api_section',
            array(
                'label_for' => 'access_key',
                'option_name' => self::API_SETTINGS_OPTION,
                'field_name' => 'access_key',
                'description' => __('Your Amazon PA-API Access Key (20 characters)', 'waas-pm'),
                'placeholder' => 'AKIAIOSFODNN7EXAMPLE',
            )
        );

        add_settings_field(
            'secret_key',
            __('Secret Key', 'waas-pm'),
            array($this, 'render_password_field'),
            'waas-pm-settings',
            'waas_pm_amazon_api_section',
            array(
                'label_for' => 'secret_key',
                'option_name' => self::API_SETTINGS_OPTION,
                'field_name' => 'secret_key',
                'description' => __('Your Amazon PA-API Secret Key (40 characters)', 'waas-pm'),
                'placeholder' => 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
            )
        );

        add_settings_field(
            'partner_tag',
            __('Associate Tag (Partner Tag)', 'waas-pm'),
            array($this, 'render_text_field'),
            'waas-pm-settings',
            'waas_pm_amazon_api_section',
            array(
                'label_for' => 'partner_tag',
                'option_name' => self::API_SETTINGS_OPTION,
                'field_name' => 'partner_tag',
                'description' => __('Default Amazon Associates ID / Tracking ID (e.g., yoursite-20). Can be overridden per product.', 'waas-pm'),
                'placeholder' => 'yoursite-20',
            )
        );

        add_settings_field(
            'region',
            __('Amazon Region', 'waas-pm'),
            array($this, 'render_select_field'),
            'waas-pm-settings',
            'waas_pm_amazon_api_section',
            array(
                'label_for' => 'region',
                'option_name' => self::API_SETTINGS_OPTION,
                'field_name' => 'region',
                'description' => __('Select your Amazon marketplace region', 'waas-pm'),
                'options' => array(
                    'us-east-1' => __('United States (amazon.com)', 'waas-pm'),
                    'eu-west-1' => __('United Kingdom (amazon.co.uk)', 'waas-pm'),
                    'us-west-2' => __('Canada (amazon.ca)', 'waas-pm'),
                    'ap-northeast-1' => __('Japan (amazon.co.jp)', 'waas-pm'),
                    'eu-central-1' => __('Germany (amazon.de)', 'waas-pm'),
                ),
            )
        );

        // General Settings Section
        add_settings_section(
            'waas_pm_general_section',
            __('General Settings', 'waas-pm'),
            array($this, 'render_general_section'),
            'waas-pm-settings'
        );

        register_setting('waas-pm-settings', self::SETTINGS_OPTION, array(
            'sanitize_callback' => array($this, 'sanitize_general_settings'),
        ));

        add_settings_field(
            'disclosure_text',
            __('Amazon Associates Disclosure', 'waas-pm'),
            array($this, 'render_textarea_field'),
            'waas-pm-settings',
            'waas_pm_general_section',
            array(
                'label_for' => 'disclosure_text',
                'option_name' => self::SETTINGS_OPTION,
                'field_name' => 'disclosure_text',
                'description' => __('Required disclosure text (Amazon TOS)', 'waas-pm'),
                'placeholder' => 'As an Amazon Associate I earn from qualifying purchases.',
                'rows' => 3,
            )
        );

        add_settings_field(
            'auto_sync_enabled',
            __('Daily Auto-Sync', 'waas-pm'),
            array($this, 'render_checkbox_field'),
            'waas-pm-settings',
            'waas_pm_general_section',
            array(
                'label_for' => 'auto_sync_enabled',
                'option_name' => self::SETTINGS_OPTION,
                'field_name' => 'auto_sync_enabled',
                'description' => __('Enable automatic daily product updates (runs at 2:00 AM)', 'waas-pm'),
            )
        );

        add_settings_field(
            'sheets_webhook_url',
            __('Google Sheets Webhook URL', 'waas-pm'),
            array($this, 'render_url_field'),
            'waas-pm-settings',
            'waas_pm_general_section',
            array(
                'label_for' => 'sheets_webhook_url',
                'option_name' => self::SETTINGS_OPTION,
                'field_name' => 'sheets_webhook_url',
                'description' => __('Your Google Apps Script Web App URL for product sync', 'waas-pm'),
                'placeholder' => 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
            )
        );

        add_settings_field(
            'sheets_api_key',
            __('Google Sheets API Key', 'waas-pm'),
            array($this, 'render_password_field'),
            'waas-pm-settings',
            'waas_pm_general_section',
            array(
                'label_for' => 'sheets_api_key',
                'option_name' => self::SETTINGS_OPTION,
                'field_name' => 'sheets_api_key',
                'description' => __('Optional API key for securing Google Sheets communication', 'waas-pm'),
                'placeholder' => 'your-secret-api-key-here',
            )
        );
    }

    /**
     * Render Amazon API section description
     */
    public function render_amazon_api_section() {
        echo '<p>' . __('Configure your Amazon Product Advertising API credentials. You need to sign up for PA-API at <a href="https://affiliate-program.amazon.com/assoc_credentials/home" target="_blank">Amazon Associates</a>.', 'waas-pm') . '</p>';
        echo '<p><strong>' . __('Example credentials:', 'waas-pm') . '</strong></p>';
        echo '<ul style="list-style: disc; margin-left: 20px;">';
        echo '<li>' . __('Access Key: AKIAIOSFODNN7EXAMPLE (20 characters)', 'waas-pm') . '</li>';
        echo '<li>' . __('Secret Key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY (40 characters)', 'waas-pm') . '</li>';
        echo '<li>' . __('Associate Tag: yoursite-20 (your tracking ID)', 'waas-pm') . '</li>';
        echo '</ul>';
    }

    /**
     * Render general section description
     */
    public function render_general_section() {
        echo '<p>' . __('Configure general plugin settings and Google Sheets integration.', 'waas-pm') . '</p>';
    }

    /**
     * Render text field
     */
    public function render_text_field($args) {
        $option_name = $args['option_name'];
        $field_name = $args['field_name'];
        $options = get_option($option_name, array());
        $value = isset($options[$field_name]) ? $options[$field_name] : '';
        $placeholder = isset($args['placeholder']) ? $args['placeholder'] : '';

        ?>
        <input type="text"
               id="<?php echo esc_attr($args['label_for']); ?>"
               name="<?php echo esc_attr($option_name); ?>[<?php echo esc_attr($field_name); ?>]"
               value="<?php echo esc_attr($value); ?>"
               placeholder="<?php echo esc_attr($placeholder); ?>"
               class="regular-text" />
        <?php if (isset($args['description'])): ?>
            <p class="description"><?php echo esc_html($args['description']); ?></p>
        <?php endif; ?>
        <?php
    }

    /**
     * Render URL field
     */
    public function render_url_field($args) {
        $option_name = $args['option_name'];
        $field_name = $args['field_name'];
        $options = get_option($option_name, array());
        $value = isset($options[$field_name]) ? $options[$field_name] : '';
        $placeholder = isset($args['placeholder']) ? $args['placeholder'] : '';

        ?>
        <input type="url"
               id="<?php echo esc_attr($args['label_for']); ?>"
               name="<?php echo esc_attr($option_name); ?>[<?php echo esc_attr($field_name); ?>]"
               value="<?php echo esc_attr($value); ?>"
               placeholder="<?php echo esc_attr($placeholder); ?>"
               class="large-text" />
        <?php if (isset($args['description'])): ?>
            <p class="description"><?php echo esc_html($args['description']); ?></p>
        <?php endif; ?>
        <?php
    }

    /**
     * Render password field
     */
    public function render_password_field($args) {
        $option_name = $args['option_name'];
        $field_name = $args['field_name'];
        $options = get_option($option_name, array());
        $value = isset($options[$field_name]) ? $options[$field_name] : '';
        $placeholder = isset($args['placeholder']) ? $args['placeholder'] : '';

        ?>
        <input type="password"
               id="<?php echo esc_attr($args['label_for']); ?>"
               name="<?php echo esc_attr($option_name); ?>[<?php echo esc_attr($field_name); ?>]"
               value="<?php echo esc_attr($value); ?>"
               placeholder="<?php echo esc_attr($placeholder); ?>"
               class="regular-text"
               autocomplete="off" />
        <button type="button" class="button waas-toggle-password" data-target="<?php echo esc_attr($args['label_for']); ?>">
            <?php _e('Show', 'waas-pm'); ?>
        </button>
        <?php if (isset($args['description'])): ?>
            <p class="description"><?php echo esc_html($args['description']); ?></p>
        <?php endif; ?>
        <?php
    }

    /**
     * Render textarea field
     */
    public function render_textarea_field($args) {
        $option_name = $args['option_name'];
        $field_name = $args['field_name'];
        $options = get_option($option_name, array());
        $value = isset($options[$field_name]) ? $options[$field_name] : '';
        $placeholder = isset($args['placeholder']) ? $args['placeholder'] : '';
        $rows = isset($args['rows']) ? $args['rows'] : 5;

        ?>
        <textarea id="<?php echo esc_attr($args['label_for']); ?>"
                  name="<?php echo esc_attr($option_name); ?>[<?php echo esc_attr($field_name); ?>]"
                  rows="<?php echo esc_attr($rows); ?>"
                  placeholder="<?php echo esc_attr($placeholder); ?>"
                  class="large-text"><?php echo esc_textarea($value); ?></textarea>
        <?php if (isset($args['description'])): ?>
            <p class="description"><?php echo esc_html($args['description']); ?></p>
        <?php endif; ?>
        <?php
    }

    /**
     * Render checkbox field
     */
    public function render_checkbox_field($args) {
        $option_name = $args['option_name'];
        $field_name = $args['field_name'];
        $options = get_option($option_name, array());
        $value = isset($options[$field_name]) ? $options[$field_name] : '0';

        ?>
        <label>
            <input type="checkbox"
                   id="<?php echo esc_attr($args['label_for']); ?>"
                   name="<?php echo esc_attr($option_name); ?>[<?php echo esc_attr($field_name); ?>]"
                   value="1"
                   <?php checked($value, '1'); ?> />
            <?php if (isset($args['description'])): ?>
                <?php echo esc_html($args['description']); ?>
            <?php endif; ?>
        </label>
        <?php
    }

    /**
     * Render select field
     */
    public function render_select_field($args) {
        $option_name = $args['option_name'];
        $field_name = $args['field_name'];
        $options = get_option($option_name, array());
        $value = isset($options[$field_name]) ? $options[$field_name] : '';
        $select_options = isset($args['options']) ? $args['options'] : array();

        ?>
        <select id="<?php echo esc_attr($args['label_for']); ?>"
                name="<?php echo esc_attr($option_name); ?>[<?php echo esc_attr($field_name); ?>]">
            <?php foreach ($select_options as $option_value => $option_label): ?>
                <option value="<?php echo esc_attr($option_value); ?>" <?php selected($value, $option_value); ?>>
                    <?php echo esc_html($option_label); ?>
                </option>
            <?php endforeach; ?>
        </select>
        <?php if (isset($args['description'])): ?>
            <p class="description"><?php echo esc_html($args['description']); ?></p>
        <?php endif; ?>
        <?php
    }

    /**
     * Sanitize API settings
     */
    public function sanitize_api_settings($input) {
        $sanitized = array();

        if (isset($input['access_key'])) {
            $sanitized['access_key'] = sanitize_text_field($input['access_key']);
        }

        if (isset($input['secret_key'])) {
            $sanitized['secret_key'] = sanitize_text_field($input['secret_key']);
        }

        if (isset($input['partner_tag'])) {
            $sanitized['partner_tag'] = sanitize_text_field($input['partner_tag']);
        }

        if (isset($input['region'])) {
            $allowed_regions = array('us-east-1', 'eu-west-1', 'us-west-2', 'ap-northeast-1', 'eu-central-1');
            $sanitized['region'] = in_array($input['region'], $allowed_regions) ? $input['region'] : 'us-east-1';
        }

        // Validate credentials
        if (!empty($sanitized['access_key']) && !empty($sanitized['secret_key']) && !empty($sanitized['partner_tag'])) {
            add_settings_error(
                'waas_pm_settings',
                'credentials_saved',
                __('Amazon API credentials saved successfully!', 'waas-pm'),
                'success'
            );
        }

        return $sanitized;
    }

    /**
     * Sanitize general settings
     */
    public function sanitize_general_settings($input) {
        $sanitized = array();

        if (isset($input['disclosure_text'])) {
            $sanitized['disclosure_text'] = sanitize_textarea_field($input['disclosure_text']);
        }

        if (isset($input['auto_sync_enabled'])) {
            $sanitized['auto_sync_enabled'] = '1';
        } else {
            $sanitized['auto_sync_enabled'] = '0';
        }

        if (isset($input['sheets_webhook_url'])) {
            $sanitized['sheets_webhook_url'] = esc_url_raw($input['sheets_webhook_url']);
        }

        if (isset($input['sheets_api_key'])) {
            $sanitized['sheets_api_key'] = sanitize_text_field($input['sheets_api_key']);
        }

        return $sanitized;
    }

    /**
     * Show admin notices
     */
    public function show_admin_notices() {
        // Check if API credentials are configured
        $api_settings = get_option(self::API_SETTINGS_OPTION, array());

        if (empty($api_settings['access_key']) || empty($api_settings['secret_key']) || empty($api_settings['partner_tag'])) {
            $screen = get_current_screen();

            if ($screen && strpos($screen->id, 'waas-pm') !== false) {
                ?>
                <div class="notice notice-warning">
                    <p>
                        <strong><?php _e('WAAS Product Manager:', 'waas-pm'); ?></strong>
                        <?php _e('Amazon API credentials are not configured.', 'waas-pm'); ?>
                        <a href="<?php echo admin_url('admin.php?page=waas-pm-settings'); ?>">
                            <?php _e('Configure now', 'waas-pm'); ?>
                        </a>
                    </p>
                </div>
                <?php
            }
        }
    }

    /**
     * Render settings page
     */
    public static function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        // Handle form submission
        if (isset($_POST['waas_test_api'])) {
            check_admin_referer('waas_test_api_nonce');
            self::test_api_connection();
        }

        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>

            <form action="options.php" method="post">
                <?php
                settings_fields('waas-pm-settings');
                do_settings_sections('waas-pm-settings');
                submit_button(__('Save Settings', 'waas-pm'));
                ?>
            </form>

            <hr>

            <h2><?php _e('Test API Connection', 'waas-pm'); ?></h2>
            <p><?php _e('Test your Amazon PA-API credentials with a sample ASIN.', 'waas-pm'); ?></p>

            <form method="post">
                <?php wp_nonce_field('waas_test_api_nonce'); ?>
                <table class="form-table">
                    <tr>
                        <th scope="row"><?php _e('Test ASIN', 'waas-pm'); ?></th>
                        <td>
                            <input type="text" name="test_asin" value="B08N5WRWNW" class="regular-text" />
                            <p class="description"><?php _e('Enter an ASIN to test (default: B08N5WRWNW - Apple AirPods Pro)', 'waas-pm'); ?></p>
                        </td>
                    </tr>
                </table>
                <p>
                    <button type="submit" name="waas_test_api" class="button button-secondary">
                        <?php _e('Test API Connection', 'waas-pm'); ?>
                    </button>
                </p>
            </form>
        </div>
        <?php
    }

    /**
     * Test API connection
     */
    private static function test_api_connection() {
        $test_asin = isset($_POST['test_asin']) ? sanitize_text_field($_POST['test_asin']) : 'B08N5WRWNW';

        $amazon_api = WAAS_Amazon_API::get_instance();
        $result = $amazon_api->get_item($test_asin);

        if (is_wp_error($result)) {
            add_settings_error(
                'waas_pm_settings',
                'api_test_failed',
                sprintf(__('API Test Failed: %s', 'waas-pm'), $result->get_error_message()),
                'error'
            );
        } else {
            add_settings_error(
                'waas_pm_settings',
                'api_test_success',
                sprintf(__('API Test Successful! Retrieved product: %s', 'waas-pm'), $result['title']),
                'success'
            );
        }
    }
}
