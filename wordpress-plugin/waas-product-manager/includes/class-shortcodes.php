<?php
/**
 * Shortcodes for displaying Amazon products
 *
 * @package WAAS_Product_Manager
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WAAS Shortcodes Class
 */
class WAAS_Shortcodes {

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
        add_shortcode('waas_product', array($this, 'product_shortcode'));
        add_shortcode('amazon_product', array($this, 'product_shortcode')); // Alias
        add_shortcode('waas_grid', array($this, 'grid_shortcode'));
        add_shortcode('amazon_grid', array($this, 'grid_shortcode')); // Alias
        add_shortcode('waas_category', array($this, 'category_shortcode'));
    }

    /**
     * Single product shortcode
     *
     * Usage: [waas_product asin="B08N5WRWNW" layout="horizontal" show_price="yes"]
     *
     * @param array $atts Shortcode attributes
     * @return string HTML output
     */
    public function product_shortcode($atts) {
        $atts = shortcode_atts(array(
            'asin' => '',
            'layout' => 'horizontal', // horizontal, vertical, minimal, card
            'show_price' => 'yes',
            'show_features' => 'yes',
            'show_button' => 'yes',
            'button_text' => __('View on Amazon', 'waas-pm'),
            'image_size' => 'medium', // small, medium, large
        ), $atts, 'waas_product');

        // Validate ASIN
        if (empty($atts['asin'])) {
            return $this->error_message(__('No ASIN provided', 'waas-pm'));
        }

        // Get product data
        $product_data = $this->get_product_data($atts['asin']);

        if (is_wp_error($product_data)) {
            return $this->error_message($product_data->get_error_message());
        }

        if (!$product_data) {
            return $this->error_message(__('Product not found', 'waas-pm'));
        }

        // Load template based on layout
        return $this->render_product_template($product_data, $atts);
    }

    /**
     * Product grid shortcode
     *
     * Usage: [waas_grid asins="B08N5WRWNW,B07XJ8C8F5,B09G9FPHY6" columns="3"]
     *
     * @param array $atts Shortcode attributes
     * @return string HTML output
     */
    public function grid_shortcode($atts) {
        $atts = shortcode_atts(array(
            'asins' => '',
            'columns' => '3',
            'show_price' => 'yes',
            'show_button' => 'yes',
            'button_text' => __('View on Amazon', 'waas-pm'),
        ), $atts, 'waas_grid');

        // Validate ASINs
        if (empty($atts['asins'])) {
            return $this->error_message(__('No ASINs provided', 'waas-pm'));
        }

        // Parse ASINs
        $asins = array_map('trim', explode(',', $atts['asins']));

        if (empty($asins)) {
            return $this->error_message(__('No valid ASINs provided', 'waas-pm'));
        }

        // Get products
        $products = array();
        foreach ($asins as $asin) {
            $product_data = $this->get_product_data($asin);
            if (!is_wp_error($product_data) && $product_data) {
                $products[] = $product_data;
            }
        }

        if (empty($products)) {
            return $this->error_message(__('No products found', 'waas-pm'));
        }

        // Render grid
        return $this->render_grid_template($products, $atts);
    }

    /**
     * Category shortcode
     *
     * Usage: [waas_category category="outdoor-gear" items="12"]
     *
     * @param array $atts Shortcode attributes
     * @return string HTML output
     */
    public function category_shortcode($atts) {
        $atts = shortcode_atts(array(
            'category' => '',
            'items' => '12',
            'columns' => '3',
            'orderby' => 'date',
            'order' => 'DESC',
        ), $atts, 'waas_category');

        // Validate category
        if (empty($atts['category'])) {
            return $this->error_message(__('No category specified', 'waas-pm'));
        }

        // Query products
        $args = array(
            'post_type' => 'waas_product',
            'posts_per_page' => intval($atts['items']),
            'orderby' => $atts['orderby'],
            'order' => $atts['order'],
            'tax_query' => array(
                array(
                    'taxonomy' => 'product_category',
                    'field' => 'slug',
                    'terms' => $atts['category'],
                ),
            ),
        );

        $query = new WP_Query($args);

        if (!$query->have_posts()) {
            return $this->error_message(__('No products found in this category', 'waas-pm'));
        }

        // Get products
        $products = array();
        while ($query->have_posts()) {
            $query->the_post();
            $product_data = $this->get_product_data_from_post(get_the_ID());
            if ($product_data) {
                $products[] = $product_data;
            }
        }
        wp_reset_postdata();

        if (empty($products)) {
            return $this->error_message(__('No valid products found', 'waas-pm'));
        }

        // Render grid
        return $this->render_grid_template($products, $atts);
    }

    /**
     * Get product data (from cache or API)
     *
     * @param string $asin Product ASIN
     * @return array|WP_Error|false Product data
     */
    private function get_product_data($asin) {
        $cache_manager = WAAS_Cache_Manager::get_instance();

        // Check if cache exists and is valid
        if (!$cache_manager->is_cache_expired($asin)) {
            return $cache_manager->get_product_cache($asin);
        }

        // Fetch from Amazon API
        $amazon_api = WAAS_Amazon_API::get_instance();
        return $amazon_api->get_item($asin);
    }

    /**
     * Get product data from WordPress post
     *
     * @param int $post_id Post ID
     * @return array|false Product data
     */
    private function get_product_data_from_post($post_id) {
        $asin = get_post_meta($post_id, '_waas_asin', true);

        if (empty($asin)) {
            return false;
        }

        // Try to get from cache/API first
        $product_data = $this->get_product_data($asin);

        // Fallback to post meta if API fails
        if (is_wp_error($product_data) || !$product_data) {
            $product_data = array(
                'asin' => $asin,
                'title' => get_the_title($post_id),
                'brand' => get_post_meta($post_id, '_waas_brand', true),
                'features' => explode("\n", get_post_meta($post_id, '_waas_features', true)),
                'image_url' => get_post_meta($post_id, '_waas_image_url', true),
                'price' => get_post_meta($post_id, '_waas_price', true),
                'savings_percentage' => get_post_meta($post_id, '_waas_savings', true),
                'availability' => get_post_meta($post_id, '_waas_availability', true),
                'prime_eligible' => get_post_meta($post_id, '_waas_prime_eligible', true) === '1',
                'affiliate_link' => get_post_meta($post_id, '_waas_affiliate_link', true),
            );
        }

        return $product_data;
    }

    /**
     * Render product template
     *
     * @param array $product Product data
     * @param array $atts Shortcode attributes
     * @return string HTML output
     */
    private function render_product_template($product, $atts) {
        $layout = $atts['layout'];

        // Check for custom template
        $template_file = WAAS_PM_PLUGIN_DIR . "templates/product-{$layout}.php";

        if (file_exists($template_file)) {
            ob_start();
            include $template_file;
            return ob_get_clean();
        }

        // Fallback to built-in rendering
        return $this->render_product_html($product, $atts);
    }

    /**
     * Render product HTML (built-in)
     *
     * @param array $product Product data
     * @param array $atts Shortcode attributes
     * @return string HTML output
     */
    private function render_product_html($product, $atts) {
        $layout = $atts['layout'];
        $show_price = filter_var($atts['show_price'], FILTER_VALIDATE_BOOLEAN);
        $show_features = filter_var($atts['show_features'], FILTER_VALIDATE_BOOLEAN);
        $show_button = filter_var($atts['show_button'], FILTER_VALIDATE_BOOLEAN);

        $html = '<div class="waas-product waas-product-' . esc_attr($layout) . '" data-asin="' . esc_attr($product['asin']) . '">';

        // Amazon Associates Disclosure (REQUIRED)
        $html .= $this->get_amazon_disclosure();

        // Image
        if (!empty($product['image_url'])) {
            $html .= '<div class="waas-product-image">';
            $html .= '<img src="' . esc_url($product['image_url']) . '" alt="' . esc_attr($product['title']) . '" loading="lazy" />';
            $html .= '</div>';
        }

        $html .= '<div class="waas-product-content">';

        // Title
        $html .= '<h3 class="waas-product-title">' . esc_html($product['title']) . '</h3>';

        // Brand
        if (!empty($product['brand'])) {
            $html .= '<p class="waas-product-brand">' . sprintf(__('by %s', 'waas-pm'), '<strong>' . esc_html($product['brand']) . '</strong>') . '</p>';
        }

        // Price
        if ($show_price && !empty($product['price'])) {
            $html .= '<div class="waas-product-price">';
            $html .= '<span class="waas-price">' . esc_html($product['price']) . '</span>';

            if (!empty($product['savings_percentage']) && $product['savings_percentage'] > 0) {
                $html .= ' <span class="waas-savings">-' . esc_html($product['savings_percentage']) . '%</span>';
            }

            // Price timestamp (Amazon TOS requirement)
            if (isset($product['cache_timestamp'])) {
                $html .= '<br><small class="waas-price-timestamp">' . sprintf(__('Price as of %s', 'waas-pm'), date_i18n(get_option('date_format') . ' ' . get_option('time_format'), strtotime($product['cache_timestamp']))) . '</small>';
            }

            $html .= '</div>';
        }

        // Prime badge
        if (!empty($product['prime_eligible'])) {
            $html .= '<div class="waas-prime-badge">⚡ Prime</div>';
        }

        // Features
        if ($show_features && !empty($product['features']) && is_array($product['features'])) {
            $html .= '<ul class="waas-product-features">';
            foreach (array_slice($product['features'], 0, 5) as $feature) {
                $html .= '<li>' . esc_html($feature) . '</li>';
            }
            $html .= '</ul>';
        }

        // Button
        if ($show_button && !empty($product['affiliate_link'])) {
            $html .= '<a href="' . esc_url($product['affiliate_link']) . '" class="waas-button" target="_blank" rel="nofollow noopener sponsored">';
            $html .= esc_html($atts['button_text']);
            $html .= '</a>';
        }

        $html .= '</div>'; // .waas-product-content
        $html .= '</div>'; // .waas-product

        return $html;
    }

    /**
     * Render product grid
     *
     * @param array $products Array of products
     * @param array $atts Shortcode attributes
     * @return string HTML output
     */
    private function render_grid_template($products, $atts) {
        $columns = intval($atts['columns']);
        $columns = max(1, min(6, $columns)); // Limit to 1-6 columns

        $html = '<div class="waas-product-grid waas-columns-' . $columns . '">';

        // Amazon Associates Disclosure (REQUIRED)
        $html .= $this->get_amazon_disclosure();

        foreach ($products as $product) {
            $html .= '<div class="waas-grid-item">';
            $html .= $this->render_grid_item($product, $atts);
            $html .= '</div>';
        }

        $html .= '</div>';

        return $html;
    }

    /**
     * Render single grid item
     *
     * @param array $product Product data
     * @param array $atts Shortcode attributes
     * @return string HTML output
     */
    private function render_grid_item($product, $atts) {
        $show_price = filter_var($atts['show_price'], FILTER_VALIDATE_BOOLEAN);
        $show_button = filter_var($atts['show_button'], FILTER_VALIDATE_BOOLEAN);

        $html = '<div class="waas-grid-product" data-asin="' . esc_attr($product['asin']) . '">';

        // Image
        if (!empty($product['image_url'])) {
            $html .= '<div class="waas-grid-image">';
            $html .= '<img src="' . esc_url($product['image_url']) . '" alt="' . esc_attr($product['title']) . '" loading="lazy" />';
            $html .= '</div>';
        }

        // Title
        $html .= '<h4 class="waas-grid-title">' . esc_html($product['title']) . '</h4>';

        // Price
        if ($show_price && !empty($product['price'])) {
            $html .= '<div class="waas-grid-price">';
            $html .= '<span class="waas-price">' . esc_html($product['price']) . '</span>';

            if (!empty($product['savings_percentage']) && $product['savings_percentage'] > 0) {
                $html .= ' <span class="waas-savings">-' . esc_html($product['savings_percentage']) . '%</span>';
            }

            $html .= '</div>';
        }

        // Prime badge
        if (!empty($product['prime_eligible'])) {
            $html .= '<div class="waas-prime-badge">⚡ Prime</div>';
        }

        // Button
        if ($show_button && !empty($product['affiliate_link'])) {
            $html .= '<a href="' . esc_url($product['affiliate_link']) . '" class="waas-grid-button" target="_blank" rel="nofollow noopener sponsored">';
            $html .= esc_html($atts['button_text']);
            $html .= '</a>';
        }

        $html .= '</div>';

        return $html;
    }

    /**
     * Get Amazon Associates disclosure
     *
     * @return string Disclosure HTML
     */
    private function get_amazon_disclosure() {
        $disclosure_text = get_option('waas_pm_disclosure_text', __('As an Amazon Associate I earn from qualifying purchases.', 'waas-pm'));

        return '<div class="waas-amazon-disclosure">' . esc_html($disclosure_text) . '</div>';
    }

    /**
     * Error message
     *
     * @param string $message Error message
     * @return string HTML output
     */
    private function error_message($message) {
        if (current_user_can('manage_options')) {
            return '<div class="waas-error">' . esc_html($message) . '</div>';
        }

        return ''; // Hide errors from non-admins
    }
}
