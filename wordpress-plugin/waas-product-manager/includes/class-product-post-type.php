<?php
/**
 * Custom Post Type: Amazon Product
 *
 * @package WAAS_Product_Manager
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WAAS Product Post Type Class
 */
class WAAS_Product_Post_Type {

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
        add_action('init', array($this, 'register_post_type'));
        add_action('init', array($this, 'register_taxonomy'));
        add_action('add_meta_boxes', array($this, 'add_meta_boxes'));
        add_action('save_post_waas_product', array($this, 'save_meta_boxes'), 10, 2);
        add_filter('manage_waas_product_posts_columns', array($this, 'set_custom_columns'));
        add_action('manage_waas_product_posts_custom_column', array($this, 'custom_column_content'), 10, 2);
    }

    /**
     * Register Amazon Product custom post type
     */
    public static function register_post_type() {
        $labels = array(
            'name' => _x('Amazon Products', 'Post Type General Name', 'waas-pm'),
            'singular_name' => _x('Amazon Product', 'Post Type Singular Name', 'waas-pm'),
            'menu_name' => __('Amazon Products', 'waas-pm'),
            'name_admin_bar' => __('Amazon Product', 'waas-pm'),
            'archives' => __('Product Archives', 'waas-pm'),
            'attributes' => __('Product Attributes', 'waas-pm'),
            'parent_item_colon' => __('Parent Product:', 'waas-pm'),
            'all_items' => __('All Products', 'waas-pm'),
            'add_new_item' => __('Add New Product', 'waas-pm'),
            'add_new' => __('Add New', 'waas-pm'),
            'new_item' => __('New Product', 'waas-pm'),
            'edit_item' => __('Edit Product', 'waas-pm'),
            'update_item' => __('Update Product', 'waas-pm'),
            'view_item' => __('View Product', 'waas-pm'),
            'view_items' => __('View Products', 'waas-pm'),
            'search_items' => __('Search Product', 'waas-pm'),
            'not_found' => __('Not found', 'waas-pm'),
            'not_found_in_trash' => __('Not found in Trash', 'waas-pm'),
            'featured_image' => __('Product Image', 'waas-pm'),
            'set_featured_image' => __('Set product image', 'waas-pm'),
            'remove_featured_image' => __('Remove product image', 'waas-pm'),
            'use_featured_image' => __('Use as product image', 'waas-pm'),
            'insert_into_item' => __('Insert into product', 'waas-pm'),
            'uploaded_to_this_item' => __('Uploaded to this product', 'waas-pm'),
            'items_list' => __('Products list', 'waas-pm'),
            'items_list_navigation' => __('Products list navigation', 'waas-pm'),
            'filter_items_list' => __('Filter products list', 'waas-pm'),
        );

        $args = array(
            'label' => __('Amazon Product', 'waas-pm'),
            'description' => __('Amazon affiliate products', 'waas-pm'),
            'labels' => $labels,
            'supports' => array('title', 'editor', 'thumbnail', 'excerpt', 'custom-fields', 'revisions'),
            'taxonomies' => array('product_category'),
            'hierarchical' => false,
            'public' => true,
            'show_ui' => true,
            'show_in_menu' => true,
            'menu_position' => 5,
            'menu_icon' => 'dashicons-products',
            'show_in_admin_bar' => true,
            'show_in_nav_menus' => true,
            'can_export' => true,
            'has_archive' => true,
            'exclude_from_search' => false,
            'publicly_queryable' => true,
            'capability_type' => 'post',
            'show_in_rest' => true,
            'rest_base' => 'amazon-products',
            'rewrite' => array('slug' => 'products'),
        );

        register_post_type('waas_product', $args);
    }

    /**
     * Register product category taxonomy
     */
    public function register_taxonomy() {
        $labels = array(
            'name' => _x('Product Categories', 'Taxonomy General Name', 'waas-pm'),
            'singular_name' => _x('Product Category', 'Taxonomy Singular Name', 'waas-pm'),
            'menu_name' => __('Categories', 'waas-pm'),
            'all_items' => __('All Categories', 'waas-pm'),
            'parent_item' => __('Parent Category', 'waas-pm'),
            'parent_item_colon' => __('Parent Category:', 'waas-pm'),
            'new_item_name' => __('New Category Name', 'waas-pm'),
            'add_new_item' => __('Add New Category', 'waas-pm'),
            'edit_item' => __('Edit Category', 'waas-pm'),
            'update_item' => __('Update Category', 'waas-pm'),
            'view_item' => __('View Category', 'waas-pm'),
            'separate_items_with_commas' => __('Separate categories with commas', 'waas-pm'),
            'add_or_remove_items' => __('Add or remove categories', 'waas-pm'),
            'choose_from_most_used' => __('Choose from the most used', 'waas-pm'),
            'popular_items' => __('Popular Categories', 'waas-pm'),
            'search_items' => __('Search Categories', 'waas-pm'),
            'not_found' => __('Not Found', 'waas-pm'),
            'no_terms' => __('No categories', 'waas-pm'),
            'items_list' => __('Categories list', 'waas-pm'),
            'items_list_navigation' => __('Categories list navigation', 'waas-pm'),
        );

        $args = array(
            'labels' => $labels,
            'hierarchical' => true,
            'public' => true,
            'show_ui' => true,
            'show_admin_column' => true,
            'show_in_nav_menus' => true,
            'show_tagcloud' => true,
            'show_in_rest' => true,
            'rewrite' => array('slug' => 'product-category'),
        );

        register_taxonomy('product_category', array('waas_product'), $args);
    }

    /**
     * Add meta boxes for product data
     */
    public function add_meta_boxes() {
        add_meta_box(
            'waas_product_data',
            __('Amazon Product Data', 'waas-pm'),
            array($this, 'render_product_data_meta_box'),
            'waas_product',
            'normal',
            'high'
        );

        add_meta_box(
            'waas_product_pricing',
            __('Pricing & Availability', 'waas-pm'),
            array($this, 'render_pricing_meta_box'),
            'waas_product',
            'side',
            'default'
        );

        add_meta_box(
            'waas_product_sync',
            __('Synchronization', 'waas-pm'),
            array($this, 'render_sync_meta_box'),
            'waas_product',
            'side',
            'default'
        );
    }

    /**
     * Render product data meta box
     */
    public function render_product_data_meta_box($post) {
        wp_nonce_field('waas_product_meta_box', 'waas_product_meta_box_nonce');

        $asin = get_post_meta($post->ID, '_waas_asin', true);
        $brand = get_post_meta($post->ID, '_waas_brand', true);
        $features = get_post_meta($post->ID, '_waas_features', true);
        $affiliate_link = get_post_meta($post->ID, '_waas_affiliate_link', true);
        $image_url = get_post_meta($post->ID, '_waas_image_url', true);
        ?>
        <div class="waas-meta-box">
            <p>
                <label for="waas_asin"><strong><?php _e('ASIN', 'waas-pm'); ?></strong></label><br>
                <input type="text" id="waas_asin" name="waas_asin" value="<?php echo esc_attr($asin); ?>" class="widefat" />
                <span class="description"><?php _e('Amazon Standard Identification Number (10 characters)', 'waas-pm'); ?></span>
            </p>

            <p>
                <label for="waas_brand"><strong><?php _e('Brand', 'waas-pm'); ?></strong></label><br>
                <input type="text" id="waas_brand" name="waas_brand" value="<?php echo esc_attr($brand); ?>" class="widefat" />
            </p>

            <p>
                <label for="waas_affiliate_link"><strong><?php _e('Amazon Affiliate Link', 'waas-pm'); ?></strong></label><br>
                <input type="url" id="waas_affiliate_link" name="waas_affiliate_link" value="<?php echo esc_url($affiliate_link); ?>" class="widefat" />
                <span class="description"><?php _e('Full Amazon affiliate URL with your associate tag', 'waas-pm'); ?></span>
            </p>

            <p>
                <label for="waas_image_url"><strong><?php _e('Product Image URL', 'waas-pm'); ?></strong></label><br>
                <input type="url" id="waas_image_url" name="waas_image_url" value="<?php echo esc_url($image_url); ?>" class="widefat" />
                <span class="description"><?php _e('Amazon product image URL (not downloaded, per Amazon TOS)', 'waas-pm'); ?></span>
            </p>

            <p>
                <label for="waas_features"><strong><?php _e('Product Features', 'waas-pm'); ?></strong></label><br>
                <textarea id="waas_features" name="waas_features" rows="5" class="widefat"><?php echo esc_textarea($features); ?></textarea>
                <span class="description"><?php _e('One feature per line (bullet points)', 'waas-pm'); ?></span>
            </p>

            <?php if ($asin): ?>
            <p>
                <button type="button" class="button button-secondary" id="waas_fetch_from_amazon">
                    <?php _e('Fetch from Amazon PA-API', 'waas-pm'); ?>
                </button>
                <span class="spinner" style="float: none;"></span>
                <span id="waas_fetch_status"></span>
            </p>
            <?php endif; ?>
        </div>
        <?php
    }

    /**
     * Render pricing meta box
     */
    public function render_pricing_meta_box($post) {
        $price = get_post_meta($post->ID, '_waas_price', true);
        $savings = get_post_meta($post->ID, '_waas_savings', true);
        $availability = get_post_meta($post->ID, '_waas_availability', true);
        $prime = get_post_meta($post->ID, '_waas_prime_eligible', true);
        $last_price_update = get_post_meta($post->ID, '_waas_last_price_update', true);
        ?>
        <div class="waas-meta-box">
            <p>
                <label for="waas_price"><strong><?php _e('Price', 'waas-pm'); ?></strong></label><br>
                <input type="text" id="waas_price" name="waas_price" value="<?php echo esc_attr($price); ?>" class="widefat" />
            </p>

            <p>
                <label for="waas_savings"><strong><?php _e('Savings %', 'waas-pm'); ?></strong></label><br>
                <input type="text" id="waas_savings" name="waas_savings" value="<?php echo esc_attr($savings); ?>" class="widefat" />
            </p>

            <p>
                <label for="waas_availability"><strong><?php _e('Availability', 'waas-pm'); ?></strong></label><br>
                <select id="waas_availability" name="waas_availability" class="widefat">
                    <option value="in_stock" <?php selected($availability, 'in_stock'); ?>><?php _e('In Stock', 'waas-pm'); ?></option>
                    <option value="out_of_stock" <?php selected($availability, 'out_of_stock'); ?>><?php _e('Out of Stock', 'waas-pm'); ?></option>
                    <option value="limited" <?php selected($availability, 'limited'); ?>><?php _e('Limited Availability', 'waas-pm'); ?></option>
                </select>
            </p>

            <p>
                <label>
                    <input type="checkbox" id="waas_prime_eligible" name="waas_prime_eligible" value="1" <?php checked($prime, '1'); ?> />
                    <?php _e('Prime Eligible', 'waas-pm'); ?>
                </label>
            </p>

            <?php if ($last_price_update): ?>
            <p class="description">
                <?php printf(__('Last updated: %s', 'waas-pm'), date_i18n(get_option('date_format') . ' ' . get_option('time_format'), strtotime($last_price_update))); ?>
            </p>
            <?php endif; ?>

            <p class="description" style="color: #d63638;">
                <strong><?php _e('Amazon TOS Reminder:', 'waas-pm'); ?></strong><br>
                <?php _e('Prices must be updated daily (max 24h cache)', 'waas-pm'); ?>
            </p>
        </div>
        <?php
    }

    /**
     * Render sync meta box
     */
    public function render_sync_meta_box($post) {
        $auto_sync = get_post_meta($post->ID, '_waas_auto_sync', true);
        $last_sync = get_post_meta($post->ID, '_waas_last_sync', true);
        $sync_status = get_post_meta($post->ID, '_waas_sync_status', true);
        ?>
        <div class="waas-meta-box">
            <p>
                <label>
                    <input type="checkbox" id="waas_auto_sync" name="waas_auto_sync" value="1" <?php checked($auto_sync, '1'); ?> />
                    <?php _e('Enable automatic daily sync', 'waas-pm'); ?>
                </label>
            </p>

            <?php if ($last_sync): ?>
            <p>
                <strong><?php _e('Last Sync:', 'waas-pm'); ?></strong><br>
                <?php echo esc_html(date_i18n(get_option('date_format') . ' ' . get_option('time_format'), strtotime($last_sync))); ?>
            </p>
            <?php endif; ?>

            <?php if ($sync_status): ?>
            <p>
                <strong><?php _e('Status:', 'waas-pm'); ?></strong><br>
                <span class="waas-sync-status <?php echo esc_attr($sync_status); ?>">
                    <?php echo esc_html(ucfirst(str_replace('_', ' ', $sync_status))); ?>
                </span>
            </p>
            <?php endif; ?>

            <p>
                <button type="button" class="button button-primary widefat" id="waas_sync_now">
                    <?php _e('Sync Now', 'waas-pm'); ?>
                </button>
            </p>
        </div>
        <?php
    }

    /**
     * Save meta box data
     */
    public function save_meta_boxes($post_id, $post) {
        // Check nonce
        if (!isset($_POST['waas_product_meta_box_nonce']) || !wp_verify_nonce($_POST['waas_product_meta_box_nonce'], 'waas_product_meta_box')) {
            return;
        }

        // Check autosave
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }

        // Check permissions
        if (!current_user_can('edit_post', $post_id)) {
            return;
        }

        // Save fields
        $fields = array(
            'waas_asin' => 'sanitize_text_field',
            'waas_brand' => 'sanitize_text_field',
            'waas_affiliate_link' => 'esc_url_raw',
            'waas_image_url' => 'esc_url_raw',
            'waas_features' => 'sanitize_textarea_field',
            'waas_price' => 'sanitize_text_field',
            'waas_savings' => 'sanitize_text_field',
            'waas_availability' => 'sanitize_text_field',
        );

        foreach ($fields as $field => $sanitize_callback) {
            if (isset($_POST[$field])) {
                update_post_meta($post_id, '_' . $field, call_user_func($sanitize_callback, $_POST[$field]));
            }
        }

        // Save checkboxes
        update_post_meta($post_id, '_waas_prime_eligible', isset($_POST['waas_prime_eligible']) ? '1' : '0');
        update_post_meta($post_id, '_waas_auto_sync', isset($_POST['waas_auto_sync']) ? '1' : '0');
    }

    /**
     * Set custom columns for admin list
     */
    public function set_custom_columns($columns) {
        $new_columns = array();

        $new_columns['cb'] = $columns['cb'];
        $new_columns['thumbnail'] = __('Image', 'waas-pm');
        $new_columns['title'] = $columns['title'];
        $new_columns['asin'] = __('ASIN', 'waas-pm');
        $new_columns['price'] = __('Price', 'waas-pm');
        $new_columns['availability'] = __('Availability', 'waas-pm');
        $new_columns['last_sync'] = __('Last Sync', 'waas-pm');
        $new_columns['taxonomy-product_category'] = __('Categories', 'waas-pm');
        $new_columns['date'] = $columns['date'];

        return $new_columns;
    }

    /**
     * Custom column content
     */
    public function custom_column_content($column, $post_id) {
        switch ($column) {
            case 'thumbnail':
                $image_url = get_post_meta($post_id, '_waas_image_url', true);
                if ($image_url) {
                    echo '<img src="' . esc_url($image_url) . '" style="max-width: 50px; height: auto;" />';
                } else {
                    echo '—';
                }
                break;

            case 'asin':
                $asin = get_post_meta($post_id, '_waas_asin', true);
                echo $asin ? esc_html($asin) : '—';
                break;

            case 'price':
                $price = get_post_meta($post_id, '_waas_price', true);
                $savings = get_post_meta($post_id, '_waas_savings', true);
                if ($price) {
                    echo esc_html($price);
                    if ($savings) {
                        echo '<br><small style="color: green;">-' . esc_html($savings) . '%</small>';
                    }
                } else {
                    echo '—';
                }
                break;

            case 'availability':
                $availability = get_post_meta($post_id, '_waas_availability', true);
                $prime = get_post_meta($post_id, '_waas_prime_eligible', true);

                $status_labels = array(
                    'in_stock' => '<span style="color: green;">●</span> ' . __('In Stock', 'waas-pm'),
                    'out_of_stock' => '<span style="color: red;">●</span> ' . __('Out of Stock', 'waas-pm'),
                    'limited' => '<span style="color: orange;">●</span> ' . __('Limited', 'waas-pm'),
                );

                echo isset($status_labels[$availability]) ? $status_labels[$availability] : '—';

                if ($prime === '1') {
                    echo '<br><small style="color: #00a8e1;">⚡ Prime</small>';
                }
                break;

            case 'last_sync':
                $last_sync = get_post_meta($post_id, '_waas_last_sync', true);
                if ($last_sync) {
                    $time_diff = human_time_diff(strtotime($last_sync), current_time('timestamp'));
                    echo esc_html(sprintf(__('%s ago', 'waas-pm'), $time_diff));

                    // Warning if older than 24 hours
                    if ((current_time('timestamp') - strtotime($last_sync)) > 86400) {
                        echo '<br><small style="color: red;">' . __('Needs update!', 'waas-pm') . '</small>';
                    }
                } else {
                    echo '<small>' . __('Never synced', 'waas-pm') . '</small>';
                }
                break;
        }
    }
}
