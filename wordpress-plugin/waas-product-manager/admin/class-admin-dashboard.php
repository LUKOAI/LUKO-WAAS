<?php
/**
 * Admin Dashboard
 *
 * @package WAAS_Product_Manager
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WAAS Admin Dashboard Class
 */
class WAAS_Admin_Dashboard {

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
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'handle_actions'));
        add_action('wp_ajax_waas_import_products', array($this, 'ajax_import_products'));
        add_action('wp_ajax_waas_sync_product', array($this, 'ajax_sync_product'));
        add_action('wp_ajax_waas_get_cache_stats', array($this, 'ajax_get_cache_stats'));
    }

    /**
     * Add admin menu pages
     */
    public function add_admin_menu() {
        add_menu_page(
            __('WAAS Dashboard', 'waas-pm'),
            __('WAAS Products', 'waas-pm'),
            'manage_options',
            'waas-pm-dashboard',
            array($this, 'render_dashboard_page'),
            'dashicons-products',
            6
        );

        add_submenu_page(
            'waas-pm-dashboard',
            __('Dashboard', 'waas-pm'),
            __('Dashboard', 'waas-pm'),
            'manage_options',
            'waas-pm-dashboard',
            array($this, 'render_dashboard_page')
        );

        add_submenu_page(
            'waas-pm-dashboard',
            __('Import Products', 'waas-pm'),
            __('Import Products', 'waas-pm'),
            'manage_options',
            'waas-pm-import',
            array($this, 'render_import_page')
        );

        add_submenu_page(
            'waas-pm-dashboard',
            __('Cache Management', 'waas-pm'),
            __('Cache', 'waas-pm'),
            'manage_options',
            'waas-pm-cache',
            array($this, 'render_cache_page')
        );

        add_submenu_page(
            'waas-pm-dashboard',
            __('Settings', 'waas-pm'),
            __('Settings', 'waas-pm'),
            'manage_options',
            'waas-pm-settings',
            array('WAAS_Admin_Settings', 'render_settings_page')
        );
    }

    /**
     * Render dashboard page
     */
    public function render_dashboard_page() {
        // Get statistics
        $total_products = wp_count_posts('waas_product')->publish;

        $cache_manager = WAAS_Cache_Manager::get_instance();
        $cache_stats = $cache_manager->get_cache_stats();

        // Get products needing update
        $products_needing_update = $this->get_products_needing_update();

        ?>
        <div class="wrap">
            <h1><?php _e('WAAS Product Manager Dashboard', 'waas-pm'); ?></h1>

            <div class="waas-dashboard-stats">
                <div class="waas-stat-card">
                    <h3><?php _e('Total Products', 'waas-pm'); ?></h3>
                    <p class="waas-stat-number"><?php echo number_format_i18n($total_products); ?></p>
                </div>

                <div class="waas-stat-card">
                    <h3><?php _e('Cached Products', 'waas-pm'); ?></h3>
                    <p class="waas-stat-number"><?php echo number_format_i18n($cache_stats['valid']); ?></p>
                    <p class="waas-stat-label"><?php printf(__('%d expired', 'waas-pm'), $cache_stats['expired']); ?></p>
                </div>

                <div class="waas-stat-card">
                    <h3><?php _e('Needs Update', 'waas-pm'); ?></h3>
                    <p class="waas-stat-number"><?php echo number_format_i18n(count($products_needing_update)); ?></p>
                </div>
            </div>

            <h2><?php _e('Recent Products', 'waas-pm'); ?></h2>
            <?php $this->render_recent_products_table(); ?>

            <?php if (!empty($products_needing_update)): ?>
            <h2><?php _e('Products Needing Update', 'waas-pm'); ?></h2>
            <p>
                <button type="button" class="button button-primary" id="waas-update-all-products">
                    <?php _e('Update All Products', 'waas-pm'); ?>
                </button>
            </p>
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th><?php _e('Product', 'waas-pm'); ?></th>
                        <th><?php _e('ASIN', 'waas-pm'); ?></th>
                        <th><?php _e('Last Sync', 'waas-pm'); ?></th>
                        <th><?php _e('Actions', 'waas-pm'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($products_needing_update as $product): ?>
                    <tr>
                        <td><?php echo esc_html($product['title']); ?></td>
                        <td><code><?php echo esc_html($product['asin']); ?></code></td>
                        <td><?php echo esc_html($product['last_sync']); ?></td>
                        <td>
                            <button type="button" class="button button-small waas-sync-product" data-asin="<?php echo esc_attr($product['asin']); ?>">
                                <?php _e('Sync Now', 'waas-pm'); ?>
                            </button>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <?php endif; ?>
        </div>
        <?php
    }

    /**
     * Render import page
     */
    public function render_import_page() {
        ?>
        <div class="wrap">
            <h1><?php _e('Import Amazon Products', 'waas-pm'); ?></h1>

            <div class="waas-import-section">
                <h2><?php _e('Bulk Import by ASIN', 'waas-pm'); ?></h2>
                <form method="post" id="waas-import-form">
                    <?php wp_nonce_field('waas_import_products', 'waas_import_nonce'); ?>

                    <p>
                        <label for="waas_import_asins"><strong><?php _e('ASINs (one per line)', 'waas-pm'); ?></strong></label><br>
                        <textarea name="asins" id="waas_import_asins" rows="10" class="large-text" placeholder="B08N5WRWNW&#10;B07XJ8C8F5&#10;B09G9FPHY6"></textarea>
                    </p>

                    <p>
                        <label for="waas_import_category"><strong><?php _e('Category (optional)', 'waas-pm'); ?></strong></label><br>
                        <?php
                        wp_dropdown_categories(array(
                            'taxonomy' => 'product_category',
                            'name' => 'category',
                            'id' => 'waas_import_category',
                            'show_option_none' => __('None', 'waas-pm'),
                            'hide_empty' => false,
                        ));
                        ?>
                    </p>

                    <p>
                        <button type="submit" class="button button-primary">
                            <?php _e('Import Products', 'waas-pm'); ?>
                        </button>
                        <span class="spinner" style="float: none;"></span>
                    </p>
                </form>

                <div id="waas-import-results" style="display: none;">
                    <h3><?php _e('Import Results', 'waas-pm'); ?></h3>
                    <div id="waas-import-results-content"></div>
                </div>
            </div>
        </div>
        <?php
    }

    /**
     * Render cache page
     */
    public function render_cache_page() {
        $cache_manager = WAAS_Cache_Manager::get_instance();
        $stats = $cache_manager->get_cache_stats();

        ?>
        <div class="wrap">
            <h1><?php _e('Cache Management', 'waas-pm'); ?></h1>

            <div class="waas-cache-stats">
                <h2><?php _e('Cache Statistics', 'waas-pm'); ?></h2>
                <table class="widefat">
                    <tr>
                        <th><?php _e('Total Cached Products', 'waas-pm'); ?></th>
                        <td><?php echo number_format_i18n($stats['total']); ?></td>
                    </tr>
                    <tr>
                        <th><?php _e('Valid Cache Entries', 'waas-pm'); ?></th>
                        <td><?php echo number_format_i18n($stats['valid']); ?></td>
                    </tr>
                    <tr>
                        <th><?php _e('Expired Cache Entries', 'waas-pm'); ?></th>
                        <td><?php echo number_format_i18n($stats['expired']); ?></td>
                    </tr>
                    <tr>
                        <th><?php _e('Cache Duration', 'waas-pm'); ?></th>
                        <td><?php printf(__('%d hours (Amazon TOS)', 'waas-pm'), $stats['cache_duration_hours']); ?></td>
                    </tr>
                </table>

                <p>
                    <button type="button" class="button" id="waas-clean-cache">
                        <?php _e('Clean Expired Cache', 'waas-pm'); ?>
                    </button>
                    <button type="button" class="button" id="waas-refresh-stats">
                        <?php _e('Refresh Statistics', 'waas-pm'); ?>
                    </button>
                </p>
            </div>

            <div class="waas-cache-info">
                <h3><?php _e('Amazon Associates TOS Compliance', 'waas-pm'); ?></h3>
                <p><?php _e('Product data must be refreshed at least once every 24 hours to comply with Amazon Associates Program Operating Agreement.', 'waas-pm'); ?></p>
                <p><?php _e('This plugin automatically caches product data and refreshes it daily through scheduled tasks.', 'waas-pm'); ?></p>
            </div>
        </div>
        <?php
    }

    /**
     * Handle admin actions
     */
    public function handle_actions() {
        if (!isset($_POST['waas_import_nonce'])) {
            return;
        }

        if (!wp_verify_nonce($_POST['waas_import_nonce'], 'waas_import_products')) {
            return;
        }

        if (!current_user_can('manage_options')) {
            return;
        }

        // This is now handled via AJAX
    }

    /**
     * AJAX: Import products
     */
    public function ajax_import_products() {
        check_ajax_referer('waas_pm_admin_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => __('Permission denied', 'waas-pm')));
        }

        $asins = isset($_POST['asins']) ? sanitize_textarea_field($_POST['asins']) : '';
        $category = isset($_POST['category']) ? intval($_POST['category']) : 0;

        if (empty($asins)) {
            wp_send_json_error(array('message' => __('No ASINs provided', 'waas-pm')));
        }

        // Parse ASINs
        $asin_list = array_filter(array_map('trim', explode("\n", $asins)));

        if (empty($asin_list)) {
            wp_send_json_error(array('message' => __('No valid ASINs provided', 'waas-pm')));
        }

        // Import products
        $importer = new WAAS_Product_Importer();
        $options = array();

        if ($category > 0) {
            $term = get_term($category, 'product_category');
            if ($term && !is_wp_error($term)) {
                $options['category'] = $term->slug;
            }
        }

        $results = $importer->bulk_import($asin_list, $options);

        wp_send_json_success($results);
    }

    /**
     * AJAX: Sync product
     */
    public function ajax_sync_product() {
        check_ajax_referer('waas_pm_admin_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => __('Permission denied', 'waas-pm')));
        }

        $asin = isset($_POST['asin']) ? sanitize_text_field($_POST['asin']) : '';

        if (empty($asin)) {
            wp_send_json_error(array('message' => __('No ASIN provided', 'waas-pm')));
        }

        $importer = new WAAS_Product_Importer();
        $result = $importer->update_product_by_asin($asin);

        if (is_wp_error($result)) {
            wp_send_json_error(array('message' => $result->get_error_message()));
        }

        wp_send_json_success(array('message' => __('Product synced successfully', 'waas-pm')));
    }

    /**
     * AJAX: Get cache stats
     */
    public function ajax_get_cache_stats() {
        check_ajax_referer('waas_pm_admin_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => __('Permission denied', 'waas-pm')));
        }

        $cache_manager = WAAS_Cache_Manager::get_instance();
        $stats = $cache_manager->get_cache_stats();

        wp_send_json_success($stats);
    }

    /**
     * Get products needing update
     */
    private function get_products_needing_update() {
        $args = array(
            'post_type' => 'waas_product',
            'posts_per_page' => 20,
            'post_status' => 'publish',
            'meta_key' => '_waas_last_sync',
            'orderby' => 'meta_value',
            'order' => 'ASC',
        );

        $query = new WP_Query($args);

        $products = array();

        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();

                $last_sync = get_post_meta(get_the_ID(), '_waas_last_sync', true);

                // Check if older than 24 hours
                if ($last_sync) {
                    $time_diff = current_time('timestamp') - strtotime($last_sync);
                    if ($time_diff < 86400) {
                        continue; // Still valid
                    }
                }

                $products[] = array(
                    'id' => get_the_ID(),
                    'title' => get_the_title(),
                    'asin' => get_post_meta(get_the_ID(), '_waas_asin', true),
                    'last_sync' => $last_sync ? human_time_diff(strtotime($last_sync), current_time('timestamp')) . ' ago' : __('Never', 'waas-pm'),
                );
            }
            wp_reset_postdata();
        }

        return $products;
    }

    /**
     * Render recent products table
     */
    private function render_recent_products_table() {
        $args = array(
            'post_type' => 'waas_product',
            'posts_per_page' => 10,
            'post_status' => 'publish',
            'orderby' => 'date',
            'order' => 'DESC',
        );

        $query = new WP_Query($args);

        if (!$query->have_posts()) {
            echo '<p>' . __('No products found.', 'waas-pm') . '</p>';
            return;
        }

        ?>
        <table class="wp-list-table widefat fixed striped">
            <thead>
                <tr>
                    <th><?php _e('Product', 'waas-pm'); ?></th>
                    <th><?php _e('ASIN', 'waas-pm'); ?></th>
                    <th><?php _e('Price', 'waas-pm'); ?></th>
                    <th><?php _e('Last Sync', 'waas-pm'); ?></th>
                    <th><?php _e('Actions', 'waas-pm'); ?></th>
                </tr>
            </thead>
            <tbody>
                <?php while ($query->have_posts()): $query->the_post(); ?>
                <tr>
                    <td>
                        <strong><a href="<?php echo get_edit_post_link(); ?>"><?php the_title(); ?></a></strong>
                    </td>
                    <td><code><?php echo esc_html(get_post_meta(get_the_ID(), '_waas_asin', true)); ?></code></td>
                    <td><?php echo esc_html(get_post_meta(get_the_ID(), '_waas_price', true)); ?></td>
                    <td>
                        <?php
                        $last_sync = get_post_meta(get_the_ID(), '_waas_last_sync', true);
                        echo $last_sync ? human_time_diff(strtotime($last_sync), current_time('timestamp')) . ' ago' : __('Never', 'waas-pm');
                        ?>
                    </td>
                    <td>
                        <a href="<?php echo get_permalink(); ?>" class="button button-small" target="_blank"><?php _e('View', 'waas-pm'); ?></a>
                        <a href="<?php echo get_edit_post_link(); ?>" class="button button-small"><?php _e('Edit', 'waas-pm'); ?></a>
                    </td>
                </tr>
                <?php endwhile; ?>
            </tbody>
        </table>
        <?php

        wp_reset_postdata();
    }
}
