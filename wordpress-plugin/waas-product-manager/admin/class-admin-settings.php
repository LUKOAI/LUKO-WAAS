<?php
/**
 * WAAS Admin Settings
 *
 * @package WAAS_Product_Manager
 */

if (!defined('ABSPATH')) {
    exit;
}

class WAAS_Admin_Settings {

    protected static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('admin_menu', array($this, 'add_settings_page'));
        add_action('admin_init', array($this, 'register_settings'));
    }

    public function add_settings_page() {
        add_submenu_page(
            'waas-pm-dashboard',
            'WAAS Settings',
            'Settings',
            'manage_options',
            'waas-pm-settings',
            array($this, 'render_settings_page')
        );
    }

    public function register_settings() {
        register_setting('waas_pm_settings', 'waas_pm_amazon_associate_tag');
        register_setting('waas_pm_settings', 'waas_pm_amazon_access_key');
        register_setting('waas_pm_settings', 'waas_pm_amazon_secret_key');
        register_setting('waas_pm_settings', 'waas_pm_amazon_partner_tag');
        register_setting('waas_pm_settings', 'waas_pm_sheets_webhook_url');
    }

    public function render_settings_page() {
        ?>
        <div class="wrap">
            <h1>WAAS Product Manager Settings</h1>

            <form method="post" action="options.php">
                <?php settings_fields('waas_pm_settings'); ?>
                <?php do_settings_sections('waas_pm_settings'); ?>

                <table class="form-table">
                    <tr>
                        <th scope="row">
                            <label for="waas_pm_amazon_partner_tag">Amazon Partner Tag (Tracking ID)</label>
                        </th>
                        <td>
                            <input type="text"
                                   id="waas_pm_amazon_partner_tag"
                                   name="waas_pm_amazon_partner_tag"
                                   value="<?php echo esc_attr(get_option('waas_pm_amazon_partner_tag')); ?>"
                                   class="regular-text"
                                   placeholder="your-tag-21" />
                            <p class="description">
                                Your Amazon Associate Program tracking ID (e.g., your-tag-21).
                                This will be added to all Amazon links.
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="waas_pm_amazon_associate_tag">Amazon Associate Tag (Legacy)</label>
                        </th>
                        <td>
                            <input type="text"
                                   id="waas_pm_amazon_associate_tag"
                                   name="waas_pm_amazon_associate_tag"
                                   value="<?php echo esc_attr(get_option('waas_pm_amazon_associate_tag')); ?>"
                                   class="regular-text" />
                            <p class="description">Legacy field - use "Amazon Partner Tag" above instead.</p>
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="waas_pm_amazon_access_key">Amazon PA-API Access Key</label>
                        </th>
                        <td>
                            <input type="text"
                                   id="waas_pm_amazon_access_key"
                                   name="waas_pm_amazon_access_key"
                                   value="<?php echo esc_attr(get_option('waas_pm_amazon_access_key')); ?>"
                                   class="regular-text" />
                            <p class="description">Product Advertising API Access Key (optional).</p>
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="waas_pm_amazon_secret_key">Amazon PA-API Secret Key</label>
                        </th>
                        <td>
                            <input type="password"
                                   id="waas_pm_amazon_secret_key"
                                   name="waas_pm_amazon_secret_key"
                                   value="<?php echo esc_attr(get_option('waas_pm_amazon_secret_key')); ?>"
                                   class="regular-text" />
                            <p class="description">Product Advertising API Secret Key (optional).</p>
                        </td>
                    </tr>
                </table>

                <h2 style="margin-top: 30px;">Google Sheets Integration</h2>
                <table class="form-table">
                    <tr>
                        <th scope="row">
                            <label for="waas_pm_sheets_webhook_url">Google Sheets Webhook URL</label>
                        </th>
                        <td>
                            <input type="url"
                                   id="waas_pm_sheets_webhook_url"
                                   name="waas_pm_sheets_webhook_url"
                                   value="<?php echo esc_attr(get_option('waas_pm_sheets_webhook_url')); ?>"
                                   class="large-text"
                                   placeholder="https://script.google.com/macros/s/..." />
                            <p class="description">
                                <strong>⚠️ Required for daily price sync!</strong><br>
                                Deploy <code>ProductManager-PRICE-WEBHOOK.gs</code> as Web App in Google Apps Script,
                                then paste the URL here.<br>
                                This allows WordPress to send price updates back to Google Sheets after daily cron runs.
                            </p>
                            <details style="margin-top: 10px;">
                                <summary style="cursor: pointer; color: #2271b1;">📚 How to get the webhook URL</summary>
                                <ol style="margin-left: 20px; margin-top: 10px;">
                                    <li>Open your Google Apps Script project</li>
                                    <li>Create new file: <code>ProductManager-PRICE-WEBHOOK.gs</code></li>
                                    <li>Paste the webhook code from the repository</li>
                                    <li>Click <strong>Deploy</strong> → <strong>New deployment</strong></li>
                                    <li>Select type: <strong>Web app</strong></li>
                                    <li>Execute as: <strong>Me</strong></li>
                                    <li>Who has access: <strong>Anyone</strong></li>
                                    <li>Click <strong>Deploy</strong></li>
                                    <li>Copy the <strong>Web app URL</strong> and paste it here</li>
                                </ol>
                            </details>
                        </td>
                    </tr>
                </table>

                <?php submit_button(); ?>
            </form>

            <hr>

            <h2>About WAAS Product Manager</h2>
            <p><strong>Version:</strong> <?php echo defined('WAAS_PM_VERSION') ? WAAS_PM_VERSION : '1.0.3'; ?></p>
            <p><strong>Repository:</strong> <a href="https://github.com/LUKOAI/LUKO-WAAS" target="_blank">GitHub</a></p>

            <h3>Features:</h3>
            <ul>
                <li>✅ Import products from Amazon PA-API</li>
                <li>✅ Sync products to WooCommerce (External/Affiliate)</li>
                <li>✅ Product shortcodes with image zoom</li>
                <li>✅ Google Sheets integration</li>
                <li>✅ Automatic tracking ID injection</li>
            </ul>
        </div>
        <?php
    }
}
