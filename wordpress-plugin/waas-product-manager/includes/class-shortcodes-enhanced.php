<?php
/**
 * WAAS Product Shortcodes
 *
 * Shortcodes dla wyświetlania produktów Amazon:
 * - [waas_product asin="..."]
 * - [waas_product_box asin="..."]
 * - [waas_product_button asin="..."]
 * - [waas_product_price asin="..."]
 * - [waas_product_image asin="..."]
 *
 * @package WAAS_Product_Manager
 */

if (!defined('ABSPATH')) {
    exit;
}

class WAAS_Product_Shortcodes {

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
        $this->register_shortcodes();
    }

    /**
     * Register all shortcodes
     */
    private function register_shortcodes() {
        add_shortcode('waas_product', array($this, 'product_shortcode'));
        add_shortcode('waas_product_box', array($this, 'product_box_shortcode'));
        add_shortcode('waas_product_button', array($this, 'product_button_shortcode'));
        add_shortcode('waas_product_price', array($this, 'product_price_shortcode'));
        add_shortcode('waas_product_image', array($this, 'product_image_shortcode'));
        add_shortcode('waas_product_rating', array($this, 'product_rating_shortcode'));
    }

    /**
     * Main product shortcode
     *
     * [waas_product asin="B09QMB59TM" template="box" redirect="amazon"]
     *
     * @param array $atts Shortcode attributes
     * @return string HTML output
     */
    public function product_shortcode($atts) {
        $atts = shortcode_atts(array(
            'asin' => '',
            'template' => 'box', // box, horizontal, simple
            'redirect' => 'amazon', // amazon, product_page, both
            'show_price' => 'yes',
            'show_rating' => 'yes',
            'show_button' => 'yes',
            'button_text' => 'Auf Amazon anschauen', // German default
        ), $atts);

        if (empty($atts['asin'])) {
            return '<p class="waas-error">Error: ASIN is required</p>';
        }

        $product = $this->get_product_by_asin($atts['asin']);

        if (!$product) {
            return '<p class="waas-error">Product not found: ' . esc_html($atts['asin']) . '</p>';
        }

        // Get template
        $template = $atts['template'];
        ob_start();

        switch ($template) {
            case 'horizontal':
                echo $this->render_horizontal_template($product, $atts);
                break;
            case 'simple':
                echo $this->render_simple_template($product, $atts);
                break;
            case 'box':
            default:
                echo $this->render_box_template($product, $atts);
                break;
        }

        return ob_get_clean();
    }

    /**
     * Product box shortcode
     *
     * [waas_product_box asin="B09QMB59TM"]
     */
    public function product_box_shortcode($atts) {
        $atts = shortcode_atts(array(
            'asin' => '',
            'redirect' => 'amazon',
        ), $atts);

        return $this->product_shortcode(array_merge($atts, array('template' => 'box')));
    }

    /**
     * Product button shortcode
     *
     * [waas_product_button asin="B09QMB59TM" text="Kup na Amazon"]
     */
    public function product_button_shortcode($atts) {
        $atts = shortcode_atts(array(
            'asin' => '',
            'text' => 'Auf Amazon anschauen', // German default
            'redirect' => 'amazon',
            'class' => 'waas-button',
        ), $atts);

        if (empty($atts['asin'])) {
            return '';
        }

        $product = $this->get_product_by_asin($atts['asin']);
        if (!$product) {
            return '';
        }

        $url = $this->get_product_url($product, $atts['redirect']);
        $text = esc_html($atts['text']);
        $class = esc_attr($atts['class']);

        return sprintf(
            '<a href="%s" class="%s" target="_blank" rel="nofollow sponsored">%s</a>',
            esc_url($url),
            $class,
            $text
        );
    }

    /**
     * Product price shortcode
     *
     * [waas_product_price asin="B09QMB59TM"]
     */
    public function product_price_shortcode($atts) {
        $atts = shortcode_atts(array(
            'asin' => '',
        ), $atts);

        if (empty($atts['asin'])) {
            return '';
        }

        $product = $this->get_product_by_asin($atts['asin']);
        if (!$product) {
            return '';
        }

        $price = get_post_meta($product->ID, '_waas_price', true);

        if (empty($price)) {
            return '';
        }

        $formatted_price = $this->format_german_price($price);
        return sprintf(
            '<span class="waas-price">%s<sup style="color: #e74c3c; font-weight: bold;">*</sup></span>',
            $formatted_price
        );
    }

    /**
     * Product image shortcode
     *
     * [waas_product_image asin="B09QMB59TM" size="medium"]
     */
    public function product_image_shortcode($atts) {
        $atts = shortcode_atts(array(
            'asin' => '',
            'size' => 'medium', // small, medium, large
            'link' => 'yes', // yes, no, amazon
        ), $atts);

        if (empty($atts['asin'])) {
            return '';
        }

        $product = $this->get_product_by_asin($atts['asin']);
        if (!$product) {
            return '';
        }

        $image_url = get_post_meta($product->ID, '_waas_image_url', true);
        if (empty($image_url)) {
            return '';
        }

        $title = get_the_title($product->ID);
        $img_html = sprintf(
            '<img src="%s" alt="%s" class="waas-product-image waas-image-%s" />',
            esc_url($image_url),
            esc_attr($title),
            esc_attr($atts['size'])
        );

        // Add link if requested
        if ($atts['link'] === 'yes' || $atts['link'] === 'amazon') {
            $url = $this->get_product_url($product, $atts['link'] === 'amazon' ? 'amazon' : 'product_page');
            return sprintf(
                '<a href="%s" class="waas-product-image-link">%s</a>',
                esc_url($url),
                $img_html
            );
        }

        return $img_html;
    }

    /**
     * Product rating shortcode
     *
     * [waas_product_rating asin="B09QMB59TM"]
     */
    public function product_rating_shortcode($atts) {
        $atts = shortcode_atts(array(
            'asin' => '',
            'show_count' => 'yes',
        ), $atts);

        if (empty($atts['asin'])) {
            return '';
        }

        $product = $this->get_product_by_asin($atts['asin']);
        if (!$product) {
            return '';
        }

        $rating = get_post_meta($product->ID, '_waas_rating', true);
        $review_count = get_post_meta($product->ID, '_waas_review_count', true);

        if (empty($rating)) {
            return '';
        }

        $stars_html = $this->render_stars($rating);

        if ($atts['show_count'] === 'yes' && !empty($review_count)) {
            return sprintf(
                '<div class="waas-rating">%s <span class="waas-review-count">(%s)</span></div>',
                $stars_html,
                esc_html($review_count)
            );
        }

        return sprintf('<div class="waas-rating">%s</div>', $stars_html);
    }

    /**
     * Get product by ASIN
     */
    private function get_product_by_asin($asin) {
        // First try to get from WooCommerce
        if (class_exists('WooCommerce')) {
            $args = array(
                'post_type' => 'product',
                'meta_query' => array(
                    array(
                        'key' => '_waas_asin',
                        'value' => $asin,
                        'compare' => '='
                    )
                ),
                'posts_per_page' => 1,
            );

            $products = get_posts($args);
            if (!empty($products)) {
                return $products[0];
            }
        }

        // Fallback to WAAS products
        $args = array(
            'post_type' => 'waas_product',
            'meta_query' => array(
                array(
                    'key' => '_waas_asin',
                    'value' => $asin,
                    'compare' => '='
                )
            ),
            'posts_per_page' => 1,
        );

        $products = get_posts($args);
        return !empty($products) ? $products[0] : null;
    }

    /**
     * Get product URL based on redirect setting
     */
    private function get_product_url($product, $redirect = 'amazon') {
        if ($redirect === 'amazon') {
            $affiliate_link = get_post_meta($product->ID, '_waas_affiliate_link', true);
            return !empty($affiliate_link) ? $affiliate_link : get_permalink($product->ID);
        }

        return get_permalink($product->ID);
    }

    /**
     * Format price to German style (115,00€ instead of €115.00)
     *
     * @param string $price_string Raw price string
     * @return string Formatted German price
     */
    private function format_german_price($price_string) {
        if (empty($price_string)) {
            return '';
        }

        // Extract numbers and currency symbol
        preg_match('/([€$£¥])?([\d,\.\s]+)([€$£¥])?/', $price_string, $matches);

        if (empty($matches[2])) {
            return $price_string; // Return as-is if can't parse
        }

        $amount = $matches[2];
        $currency = !empty($matches[1]) ? $matches[1] : (!empty($matches[3]) ? $matches[3] : '€');

        // Remove spaces and thousand separators
        $amount = str_replace(array(',', ' '), '', $amount);

        // If it has a dot, it's the decimal separator
        if (strpos($amount, '.') !== false) {
            // Convert to float then format
            $numeric = floatval($amount);
            $amount = number_format($numeric, 2, ',', '.');
        }

        // German format: amount THEN currency with space
        return $amount . '&nbsp;' . $currency;
    }

    /**
     * Get price disclaimer HTML (German legal compliance)
     *
     * @param int $product_id Product ID
     * @return string Disclaimer HTML
     */
    private function get_price_disclaimer($product_id) {
        // Get last price update timestamp
        $last_update = get_post_meta($product_id, '_waas_last_price_update', true);

        // Format timestamp: DD.MM.YYYY, HH:MM Uhr
        $date_str = '';
        if (!empty($last_update)) {
            try {
                $dt = new DateTime($last_update);
                $dt->setTimezone(new DateTimeZone('Europe/Berlin'));
                $date_str = $dt->format('d.m.Y, H:i') . ' Uhr';
            } catch (Exception $e) {
                $date_str = date('d.m.Y, H:i') . ' Uhr'; // Fallback to current time
            }
        } else {
            $date_str = date('d.m.Y, H:i') . ' Uhr'; // Fallback to current time
        }

        // Simple short disclaimer with timestamp
        $html = '<div class="waas-price-disclaimer" style="display: block; margin-top: 5px; margin-bottom: 10px; font-size: 0.75em; color: #999; font-style: italic;">';
        $html .= '* inkl. MwSt., ggf. zzgl. Versandkosten<br>';
        $html .= 'Preisstand: ' . esc_html($date_str);
        $html .= '</div>';

        return $html;
    }

    /**
     * Render box template
     */
    private function render_box_template($product, $atts) {
        $image_url = get_post_meta($product->ID, '_waas_image_url', true);
        $price = get_post_meta($product->ID, '_waas_price', true);
        $rating = get_post_meta($product->ID, '_waas_rating', true);
        $review_count = get_post_meta($product->ID, '_waas_review_count', true);
        $url = $this->get_product_url($product, $atts['redirect']);

        ob_start();
        ?>
        <div class="waas-product-box">
            <?php if (!empty($image_url)): ?>
            <div class="waas-product-image">
                <a href="<?php echo esc_url($url); ?>" target="_blank" rel="nofollow sponsored">
                    <img src="<?php echo esc_url($image_url); ?>" alt="<?php echo esc_attr(get_the_title($product->ID)); ?>" class="waas-image-zoom" />
                </a>
            </div>
            <?php endif; ?>

            <div class="waas-product-content">
                <h3 class="waas-product-title">
                    <a href="<?php echo esc_url($url); ?>" target="_blank" rel="nofollow sponsored">
                        <?php echo esc_html(get_the_title($product->ID)); ?>
                    </a>
                </h3>

                <?php if ($atts['show_rating'] === 'yes' && !empty($rating)): ?>
                <div class="waas-product-rating">
                    <?php echo $this->render_stars($rating); ?>
                    <?php if (!empty($review_count)): ?>
                        <span class="waas-review-count">(<?php echo esc_html($review_count); ?>)</span>
                    <?php endif; ?>
                </div>
                <?php endif; ?>

                <?php if ($atts['show_price'] === 'yes' && !empty($price)): ?>
                <div class="waas-product-price">
                    <?php echo $this->format_german_price($price); ?><sup style="color: #e74c3c; font-weight: bold;">*</sup>
                </div>
                <?php endif; ?>

                <?php if ($atts['show_button'] === 'yes'): ?>
                <div class="waas-product-button">
                    <a href="<?php echo esc_url($url); ?>" class="button waas-amazon-button" target="_blank" rel="nofollow sponsored">
                        <?php echo esc_html($atts['button_text']); ?>
                    </a>
                </div>
                <?php endif; ?>

                <?php
                // Price disclaimer (German legal compliance)
                echo $this->get_price_disclaimer($product->ID);
                ?>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Render horizontal template
     */
    private function render_horizontal_template($product, $atts) {
        $image_url = get_post_meta($product->ID, '_waas_image_url', true);
        $price = get_post_meta($product->ID, '_waas_price', true);
        $rating = get_post_meta($product->ID, '_waas_rating', true);
        $url = $this->get_product_url($product, $atts['redirect']);

        ob_start();
        ?>
        <div class="waas-product-horizontal">
            <?php if (!empty($image_url)): ?>
            <div class="waas-product-image-horizontal">
                <a href="<?php echo esc_url($url); ?>" target="_blank" rel="nofollow sponsored">
                    <img src="<?php echo esc_url($image_url); ?>" alt="<?php echo esc_attr(get_the_title($product->ID)); ?>" class="waas-image-zoom" />
                </a>
            </div>
            <?php endif; ?>

            <div class="waas-product-details">
                <h4 class="waas-product-title">
                    <a href="<?php echo esc_url($url); ?>" target="_blank" rel="nofollow sponsored">
                        <?php echo esc_html(get_the_title($product->ID)); ?>
                    </a>
                </h4>

                <?php if ($atts['show_rating'] === 'yes' && !empty($rating)): ?>
                <div class="waas-product-rating"><?php echo $this->render_stars($rating); ?></div>
                <?php endif; ?>

                <?php if ($atts['show_price'] === 'yes' && !empty($price)): ?>
                <div class="waas-product-price">
                    <?php echo $this->format_german_price($price); ?><sup style="color: #e74c3c; font-weight: bold;">*</sup>
                </div>
                <?php endif; ?>

                <?php if ($atts['show_button'] === 'yes'): ?>
                <a href="<?php echo esc_url($url); ?>" class="button waas-button-small" target="_blank" rel="nofollow sponsored">
                    <?php echo esc_html($atts['button_text']); ?>
                </a>
                <?php endif; ?>

                <?php
                // Price disclaimer (German legal compliance)
                echo $this->get_price_disclaimer($product->ID);
                ?>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Render simple template (just title and link)
     */
    private function render_simple_template($product, $atts) {
        $url = $this->get_product_url($product, $atts['redirect']);

        return sprintf(
            '<div class="waas-product-simple"><a href="%s" target="_blank" rel="nofollow sponsored">%s</a></div>',
            esc_url($url),
            esc_html(get_the_title($product->ID))
        );
    }

    /**
     * Render star rating
     */
    private function render_stars($rating) {
        $rating = floatval($rating);
        $full_stars = floor($rating);
        $half_star = ($rating - $full_stars) >= 0.5;
        $empty_stars = 5 - $full_stars - ($half_star ? 1 : 0);

        $html = '<div class="waas-stars">';

        // Full stars
        for ($i = 0; $i < $full_stars; $i++) {
            $html .= '<span class="waas-star waas-star-full">★</span>';
        }

        // Half star
        if ($half_star) {
            $html .= '<span class="waas-star waas-star-half">★</span>';
        }

        // Empty stars
        for ($i = 0; $i < $empty_stars; $i++) {
            $html .= '<span class="waas-star waas-star-empty">☆</span>';
        }

        $html .= sprintf(' <span class="waas-rating-number">%.1f</span>', $rating);
        $html .= '</div>';

        return $html;
    }
}
