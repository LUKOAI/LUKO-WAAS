<?php
/**
 * WAAS Product Comparison Shortcodes
 *
 * Advanced shortcodes for product comparisons and direct Amazon links
 * Similar to AAWP plugin functionality
 *
 * Shortcodes:
 * - [waas_compare_2] - Compare 2 products side by side
 * - [waas_compare_3] - Compare 3 products
 * - [waas_compare_4] - Compare 4 products
 * - [waas_compare_5] - Compare 5 products
 * - [waas_bestseller_list] - Bestseller list with numbers
 * - [waas_product_grid] - Product grid layout
 * - [waas_product_table] - Product comparison table
 * - [waas_product_direct] - Direct Amazon link (bypasses product page)
 *
 * @package WAAS_Product_Manager
 */

if (!defined('ABSPATH')) {
    exit;
}

class WAAS_Shortcodes_Comparison {

    protected static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->register_shortcodes();
    }

    private function register_shortcodes() {
        // Comparison shortcodes
        add_shortcode('waas_compare_2', array($this, 'compare_2_products'));
        add_shortcode('waas_compare_3', array($this, 'compare_3_products'));
        add_shortcode('waas_compare_4', array($this, 'compare_4_products'));
        add_shortcode('waas_compare_5', array($this, 'compare_5_products'));

        // List & Grid layouts
        add_shortcode('waas_bestseller_list', array($this, 'bestseller_list'));
        add_shortcode('waas_product_grid', array($this, 'product_grid'));
        add_shortcode('waas_product_table', array($this, 'product_table'));

        // Direct Amazon links (bypasses WooCommerce product page)
        add_shortcode('waas_product_direct', array($this, 'product_direct'));
        add_shortcode('waas_button_direct', array($this, 'button_direct'));
    }

    /**
     * Compare 2 products side by side
     * [waas_compare_2 asin1="B001" asin2="B002"]
     */
    public function compare_2_products($atts) {
        return $this->render_comparison($atts, 2);
    }

    /**
     * Compare 3 products
     * [waas_compare_3 asin1="B001" asin2="B002" asin3="B003"]
     */
    public function compare_3_products($atts) {
        return $this->render_comparison($atts, 3);
    }

    /**
     * Compare 4 products
     * [waas_compare_4 asin1="B001" asin2="B002" asin3="B003" asin4="B004"]
     */
    public function compare_4_products($atts) {
        return $this->render_comparison($atts, 4);
    }

    /**
     * Compare 5 products
     * [waas_compare_5 asin1="B001" asin2="B002" asin3="B003" asin4="B004" asin5="B005"]
     */
    public function compare_5_products($atts) {
        return $this->render_comparison($atts, 5);
    }

    /**
     * Render product comparison
     */
    private function render_comparison($atts, $count) {
        $defaults = array('button_text' => 'Auf Amazon anschauen');
        for ($i = 1; $i <= $count; $i++) {
            $defaults["asin$i"] = '';
        }
        $atts = shortcode_atts($defaults, $atts);

        $products = array();
        for ($i = 1; $i <= $count; $i++) {
            $asin = $atts["asin$i"];
            if (!empty($asin)) {
                $product = $this->get_product_by_asin($asin);
                if ($product) {
                    $products[] = $product;
                }
            }
        }

        if (empty($products)) {
            return '<p class="waas-error">No products found for comparison</p>';
        }

        $columns = 100 / count($products);
        ob_start();
        ?>
        <div class="waas-comparison waas-comparison-<?php echo count($products); ?>">
            <div class="waas-comparison-grid" style="display: grid; grid-template-columns: repeat(<?php echo count($products); ?>, 1fr); gap: 20px;">
                <?php foreach ($products as $product): ?>
                    <div class="waas-comparison-item">
                        <div class="waas-comparison-image">
                            <a href="<?php echo esc_url($this->get_affiliate_link($product)); ?>" target="_blank" rel="nofollow noopener">
                                <?php if ($product->image_url): ?>
                                    <img src="<?php echo esc_url($product->image_url); ?>" alt="<?php echo esc_attr($product->name); ?>" />
                                <?php endif; ?>
                            </a>
                        </div>
                        <h3 class="waas-comparison-title">
                            <a href="<?php echo esc_url($this->get_affiliate_link($product)); ?>" target="_blank" rel="nofollow noopener">
                                <?php echo esc_html($product->name); ?>
                            </a>
                        </h3>
                        <?php if ($product->rating): ?>
                            <div class="waas-comparison-rating">
                                <?php echo str_repeat('⭐', intval($product->rating)); ?>
                                <?php if ($product->review_count): ?>
                                    <span class="waas-review-count">(<?php echo number_format_i18n($product->review_count); ?>)</span>
                                <?php endif; ?>
                            </div>
                        <?php endif; ?>
                        <?php if ($product->price): ?>
                            <div class="waas-comparison-price">
                                <strong><?php echo $this->format_german_price($product->price); ?></strong>
                            </div>
                        <?php endif; ?>
                        <a href="<?php echo esc_url($this->get_affiliate_link($product)); ?>" class="waas-button waas-button-comparison" target="_blank" rel="nofollow noopener">
                            <?php echo esc_html($atts['button_text']); ?>
                        </a>
                    </div>
                <?php endforeach; ?>
            </div>
            <?php echo $this->get_price_disclaimer(); ?>
        </div>
        <style>
            .waas-comparison { margin: 20px 0; }
            .waas-comparison-item {
                border: 1px solid #ddd;
                padding: 15px;
                text-align: center;
                background: #fff;
            }
            .waas-comparison-image img {
                max-width: 100%;
                height: auto;
                margin-bottom: 10px;
            }
            .waas-comparison-title {
                font-size: 16px;
                margin: 10px 0;
                min-height: 3em;
            }
            .waas-comparison-title a {
                text-decoration: none;
                color: #333;
            }
            .waas-comparison-rating {
                margin: 10px 0;
                font-size: 14px;
            }
            .waas-comparison-price {
                font-size: 24px;
                color: #B12704;
                margin: 10px 0;
            }
            .waas-button-comparison {
                display: inline-block;
                background: #ff9900;
                color: #000;
                padding: 10px 20px;
                text-decoration: none;
                border-radius: 3px;
                margin-top: 10px;
            }
            .waas-button-comparison:hover {
                background: #ffad33;
            }
        </style>
        <?php
        return ob_get_clean();
    }

    /**
     * Bestseller list with numbers
     * [waas_bestseller_list asins="B001,B002,B003,B004,B005"]
     */
    public function bestseller_list($atts) {
        $atts = shortcode_atts(array(
            'asins' => '',
            'button_text' => 'Auf Amazon anschauen',
            'show_number' => 'yes',
        ), $atts);

        $asins = array_map('trim', explode(',', $atts['asins']));
        $products = array();

        foreach ($asins as $asin) {
            if (!empty($asin)) {
                $product = $this->get_product_by_asin($asin);
                if ($product) {
                    $products[] = $product;
                }
            }
        }

        if (empty($products)) {
            return '<p class="waas-error">No products found</p>';
        }

        ob_start();
        ?>
        <div class="waas-bestseller-list">
            <?php $position = 1; foreach ($products as $product): ?>
                <div class="waas-bestseller-item">
                    <?php if ($atts['show_number'] === 'yes'): ?>
                        <div class="waas-bestseller-number"><?php echo $position; ?></div>
                    <?php endif; ?>
                    <div class="waas-bestseller-image">
                        <a href="<?php echo esc_url($this->get_affiliate_link($product)); ?>" target="_blank" rel="nofollow noopener">
                            <?php if ($product->image_url): ?>
                                <img src="<?php echo esc_url($product->image_url); ?>" alt="<?php echo esc_attr($product->name); ?>" />
                            <?php endif; ?>
                        </a>
                    </div>
                    <div class="waas-bestseller-content">
                        <h3 class="waas-bestseller-title">
                            <a href="<?php echo esc_url($this->get_affiliate_link($product)); ?>" target="_blank" rel="nofollow noopener">
                                <?php echo esc_html($product->name); ?>
                            </a>
                        </h3>
                        <?php if ($product->rating): ?>
                            <div class="waas-bestseller-rating">
                                <?php echo str_repeat('⭐', intval($product->rating)); ?>
                                <?php if ($product->review_count): ?>
                                    <span>(<?php echo number_format_i18n($product->review_count); ?>)</span>
                                <?php endif; ?>
                            </div>
                        <?php endif; ?>
                        <?php if ($product->price): ?>
                            <div class="waas-bestseller-price"><strong><?php echo $this->format_german_price($product->price); ?></strong></div>
                        <?php endif; ?>
                        <a href="<?php echo esc_url($this->get_affiliate_link($product)); ?>" class="waas-button" target="_blank" rel="nofollow noopener">
                            <?php echo esc_html($atts['button_text']); ?>
                        </a>
                    </div>
                </div>
            <?php $position++; endforeach; ?>
            <?php echo $this->get_price_disclaimer(); ?>
        </div>
        <style>
            .waas-bestseller-list { margin: 20px 0; }
            .waas-bestseller-item {
                display: flex;
                margin-bottom: 20px;
                border: 1px solid #ddd;
                padding: 15px;
                background: #fff;
                position: relative;
            }
            .waas-bestseller-number {
                position: absolute;
                top: 10px;
                left: 10px;
                background: #ff9900;
                color: #fff;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 16px;
            }
            .waas-bestseller-image {
                flex: 0 0 150px;
                margin-right: 20px;
            }
            .waas-bestseller-image img {
                max-width: 100%;
                height: auto;
            }
            .waas-bestseller-content {
                flex: 1;
            }
            .waas-bestseller-title {
                margin: 0 0 10px 0;
                font-size: 18px;
            }
            .waas-bestseller-title a {
                text-decoration: none;
                color: #333;
            }
            .waas-bestseller-rating {
                margin: 5px 0;
            }
            .waas-bestseller-price {
                font-size: 20px;
                color: #B12704;
                margin: 10px 0;
            }
        </style>
        <?php
        return ob_get_clean();
    }

    /**
     * Product grid layout
     * [waas_product_grid asins="B001,B002,B003,B004" columns="2"]
     */
    public function product_grid($atts) {
        $atts = shortcode_atts(array(
            'asins' => '',
            'columns' => '3',
            'button_text' => 'Auf Amazon anschauen',
        ), $atts);

        $asins = array_map('trim', explode(',', $atts['asins']));
        $products = array();

        foreach ($asins as $asin) {
            if (!empty($asin)) {
                $product = $this->get_product_by_asin($asin);
                if ($product) {
                    $products[] = $product;
                }
            }
        }

        if (empty($products)) {
            return '<p class="waas-error">No products found</p>';
        }

        $columns = intval($atts['columns']);
        ob_start();
        ?>
        <div class="waas-product-grid" style="display: grid; grid-template-columns: repeat(<?php echo $columns; ?>, 1fr); gap: 20px; margin: 20px 0;">
            <?php foreach ($products as $product): ?>
                <div class="waas-grid-item">
                    <a href="<?php echo esc_url($this->get_affiliate_link($product)); ?>" target="_blank" rel="nofollow noopener">
                        <?php if ($product->image_url): ?>
                            <img src="<?php echo esc_url($product->image_url); ?>" alt="<?php echo esc_attr($product->name); ?>" style="width: 100%; height: auto;" />
                        <?php endif; ?>
                    </a>
                    <h4><a href="<?php echo esc_url($this->get_affiliate_link($product)); ?>" target="_blank" rel="nofollow noopener"><?php echo esc_html($product->name); ?></a></h4>
                    <?php if ($product->price): ?>
                        <div class="waas-grid-price"><strong><?php echo $this->format_german_price($product->price); ?></strong></div>
                    <?php endif; ?>
                    <a href="<?php echo esc_url($this->get_affiliate_link($product)); ?>" class="waas-button" target="_blank" rel="nofollow noopener">
                        <?php echo esc_html($atts['button_text']); ?>
                    </a>
                </div>
            <?php endforeach; ?>
        </div>
        <?php echo $this->get_price_disclaimer(); ?>
        <style>
            .waas-grid-item { border: 1px solid #ddd; padding: 15px; text-align: center; background: #fff; }
            .waas-grid-item h4 { font-size: 16px; margin: 10px 0; min-height: 3em; }
            .waas-grid-item h4 a { text-decoration: none; color: #333; }
            .waas-grid-price { font-size: 20px; color: #B12704; margin: 10px 0; }
        </style>
        <?php
        return ob_get_clean();
    }

    /**
     * Product comparison table
     * [waas_product_table asins="B001,B002,B003" fields="name,price,rating"]
     */
    public function product_table($atts) {
        $atts = shortcode_atts(array(
            'asins' => '',
            'fields' => 'name,price,rating,button',
            'button_text' => 'Auf Amazon anschauen',
        ), $atts);

        $asins = array_map('trim', explode(',', $atts['asins']));
        $fields = array_map('trim', explode(',', $atts['fields']));
        $products = array();

        foreach ($asins as $asin) {
            if (!empty($asin)) {
                $product = $this->get_product_by_asin($asin);
                if ($product) {
                    $products[] = $product;
                }
            }
        }

        if (empty($products)) {
            return '<p class="waas-error">No products found</p>';
        }

        ob_start();
        ?>
        <table class="waas-product-table" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
                <tr>
                    <?php if (in_array('image', $fields)): ?><th>Bild</th><?php endif; ?>
                    <?php if (in_array('name', $fields)): ?><th>Produkt</th><?php endif; ?>
                    <?php if (in_array('price', $fields)): ?><th>Preis</th><?php endif; ?>
                    <?php if (in_array('rating', $fields)): ?><th>Bewertung</th><?php endif; ?>
                    <?php if (in_array('button', $fields)): ?><th>Link</th><?php endif; ?>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($products as $product): ?>
                    <tr>
                        <?php if (in_array('image', $fields)): ?>
                            <td style="text-align: center;">
                                <a href="<?php echo esc_url($this->get_affiliate_link($product)); ?>" target="_blank" rel="nofollow noopener">
                                    <?php if ($product->image_url): ?>
                                        <img src="<?php echo esc_url($product->image_url); ?>" alt="<?php echo esc_attr($product->name); ?>" style="max-width: 100px; height: auto;" />
                                    <?php endif; ?>
                                </a>
                            </td>
                        <?php endif; ?>
                        <?php if (in_array('name', $fields)): ?>
                            <td>
                                <a href="<?php echo esc_url($this->get_affiliate_link($product)); ?>" target="_blank" rel="nofollow noopener">
                                    <?php echo esc_html($product->name); ?>
                                </a>
                            </td>
                        <?php endif; ?>
                        <?php if (in_array('price', $fields)): ?>
                            <td><strong><?php echo $this->format_german_price($product->price); ?></strong></td>
                        <?php endif; ?>
                        <?php if (in_array('rating', $fields)): ?>
                            <td>
                                <?php if ($product->rating): ?>
                                    <?php echo str_repeat('⭐', intval($product->rating)); ?>
                                <?php endif; ?>
                            </td>
                        <?php endif; ?>
                        <?php if (in_array('button', $fields)): ?>
                            <td>
                                <a href="<?php echo esc_url($this->get_affiliate_link($product)); ?>" class="waas-button" target="_blank" rel="nofollow noopener">
                                    <?php echo esc_html($atts['button_text']); ?>
                                </a>
                            </td>
                        <?php endif; ?>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <?php echo $this->get_price_disclaimer(); ?>
        <style>
            .waas-product-table th, .waas-product-table td {
                border: 1px solid #ddd;
                padding: 10px;
                text-align: left;
            }
            .waas-product-table th {
                background: #f5f5f5;
                font-weight: bold;
            }
            .waas-product-table a {
                text-decoration: none;
                color: #333;
            }
        </style>
        <?php
        return ob_get_clean();
    }

    /**
     * Direct Amazon link - shows product box but links directly to Amazon
     * [waas_product_direct asin="B001"]
     */
    public function product_direct($atts) {
        $atts = shortcode_atts(array(
            'asin' => '',
            'template' => 'box',
            'button_text' => 'Jetzt auf Amazon kaufen',
        ), $atts);

        if (empty($atts['asin'])) {
            return '<p class="waas-error">ASIN required</p>';
        }

        $product = $this->get_product_by_asin($atts['asin']);
        if (!$product) {
            return '<p class="waas-error">Product not found</p>';
        }

        $affiliate_link = $this->get_affiliate_link($product);

        ob_start();
        ?>
        <div class="waas-product-direct waas-product-box">
            <div class="waas-product-image">
                <a href="<?php echo esc_url($affiliate_link); ?>" target="_blank" rel="nofollow noopener">
                    <?php if ($product->image_url): ?>
                        <img src="<?php echo esc_url($product->image_url); ?>" alt="<?php echo esc_attr($product->name); ?>" />
                    <?php endif; ?>
                </a>
            </div>
            <h3 class="waas-product-title">
                <a href="<?php echo esc_url($affiliate_link); ?>" target="_blank" rel="nofollow noopener">
                    <?php echo esc_html($product->name); ?>
                </a>
            </h3>
            <?php if ($product->rating): ?>
                <div class="waas-product-rating">
                    <?php echo str_repeat('⭐', intval($product->rating)); ?>
                    <?php if ($product->review_count): ?>
                        <span>(<?php echo number_format_i18n($product->review_count); ?>)</span>
                    <?php endif; ?>
                </div>
            <?php endif; ?>
            <?php if ($product->price): ?>
                <div class="waas-product-price">
                    <strong><?php echo $this->format_german_price($product->price); ?></strong>
                </div>
            <?php endif; ?>
            <a href="<?php echo esc_url($affiliate_link); ?>" class="waas-button waas-button-primary" target="_blank" rel="nofollow noopener">
                <?php echo esc_html($atts['button_text']); ?> →
            </a>
            <?php echo $this->get_price_disclaimer(); ?>
        </div>
        <style>
            .waas-product-direct {
                border: 1px solid #ddd;
                padding: 20px;
                text-align: center;
                max-width: 300px;
                margin: 20px auto;
                background: #fff;
            }
            .waas-product-direct img {
                max-width: 100%;
                height: auto;
            }
            .waas-product-direct h3 {
                margin: 15px 0;
                font-size: 18px;
            }
            .waas-product-direct h3 a {
                text-decoration: none;
                color: #333;
            }
            .waas-product-direct .waas-button-primary {
                display: inline-block;
                background: #ff9900;
                color: #000;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 3px;
                font-weight: bold;
                margin-top: 10px;
            }
            .waas-product-direct .waas-button-primary:hover {
                background: #ffad33;
            }
        </style>
        <?php
        return ob_get_clean();
    }

    /**
     * Direct Amazon button - just a button that links to Amazon
     * [waas_button_direct asin="B001" text="Kaufen"]
     */
    public function button_direct($atts) {
        $atts = shortcode_atts(array(
            'asin' => '',
            'text' => 'Auf Amazon kaufen',
            'style' => 'primary', // primary, secondary
        ), $atts);

        if (empty($atts['asin'])) {
            return '';
        }

        $product = $this->get_product_by_asin($atts['asin']);
        if (!$product) {
            return '';
        }

        $affiliate_link = $this->get_affiliate_link($product);
        $button_class = 'waas-button-' . $atts['style'];

        return sprintf(
            '<a href="%s" class="waas-button %s" target="_blank" rel="nofollow noopener">%s</a>',
            esc_url($affiliate_link),
            esc_attr($button_class),
            esc_html($atts['text'])
        );
    }

    /**
     * Get product by ASIN (v3 — WooCommerce only, no waas_product fallback)
     */
    private function get_product_by_asin($asin) {
        $args = array(
            'post_type' => 'product',
            'meta_query' => array(
                array(
                    'key' => '_waas_asin',
                    'value' => $asin,
                    'compare' => '='
                )
            ),
            'posts_per_page' => 1
        );

        $posts = get_posts($args);
        if (empty($posts)) {
            return null;
        }

        $post = $posts[0];
        $wc_product = wc_get_product($post->ID);

        // Get image from WC product thumbnail, fallback to meta
        $image_url = get_the_post_thumbnail_url($post->ID, 'medium');
        if (empty($image_url)) {
            $image_url = get_post_meta($post->ID, '_waas_image_url', true);
        }

        // Get affiliate link from WC External product URL
        $affiliate_link = '';
        if ($wc_product && method_exists($wc_product, 'get_product_url')) {
            $affiliate_link = $wc_product->get_product_url();
        }
        if (empty($affiliate_link)) {
            $affiliate_link = get_post_meta($post->ID, '_waas_affiliate_link', true);
        }

        return (object) array(
            'id' => $post->ID,
            'asin' => $asin,
            'name' => $post->post_title,
            'image_url' => $image_url,
            'price' => $wc_product ? $wc_product->get_regular_price() : '',
            'affiliate_link' => $affiliate_link,
            'rating' => get_post_meta($post->ID, '_waas_rating', true),
            'review_count' => get_post_meta($post->ID, '_waas_review_count', true),
        );
    }

    /**
     * Get affiliate link with tracking ID
     */
    private function get_affiliate_link($product) {
        $link = $product->affiliate_link;

        // Get tracking ID from settings
        $tracking_id = get_option('waas_pm_amazon_associate_tag', '');

        if (!empty($tracking_id) && !empty($link)) {
            // Add tracking ID to URL
            $separator = (strpos($link, '?') !== false) ? '&' : '?';
            $link .= $separator . 'tag=' . urlencode($tracking_id);
        }

        return $link;
    }

    /**
     * Format price to German style (115,00€ instead of €115.00)
     *
     * @param string $price_string Raw price string
     * @return string Formatted German price with asterisk
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

        // German format: amount THEN currency with space + asterisk
        return $amount . '&nbsp;' . $currency . '<sup style="color: #e74c3c; font-weight: bold;">*</sup>';
    }

    /**
     * Get price disclaimer HTML (German legal compliance)
     * NEW: Simple short version per latest requirements with timestamp
     *
     * @return string Disclaimer HTML
     */
    private function get_price_disclaimer() {
        // Format current timestamp: DD.MM.YYYY, HH:MM Uhr
        $date_str = date('d.m.Y, H:i') . ' Uhr';

        // Simple short disclaimer with timestamp
        $html = '<div class="waas-price-disclaimer-comparison" style="display: block; margin-top: 5px; margin-bottom: 10px; font-size: 0.75em; color: #999; font-style: italic; text-align: center;">';
        $html .= '* inkl. MwSt., ggf. zzgl. Versandkosten<br>';
        $html .= 'Preisstand: ' . esc_html($date_str);
        $html .= '</div>';
        return $html;
    }
}
