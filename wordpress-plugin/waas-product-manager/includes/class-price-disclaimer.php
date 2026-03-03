<?php
/**
 * Price Disclaimer for Amazon Affiliate Products (German Compliance)
 *
 * Handles legal requirements for price display in Germany:
 * - PAngV (Preisangabenverordnung) - VAT/shipping indication
 * - Amazon Associates Operating Agreement §2i, §5 - Timestamp + disclaimer
 * - UWG §5a / DDG §6 - Affiliate disclosure
 *
 * @package WAAS_Product_Manager
 */

if (!defined('ABSPATH')) exit;

class WAAS_Price_Disclaimer {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        // GERMAN PRICE FORMAT - HIGHEST PRIORITY
        add_filter('wc_price_args', array($this, 'german_price_format'), 999);
        add_filter('woocommerce_price_format', array($this, 'german_price_display_format'), 999);
        add_filter('woocommerce_price_thousand_separator', array($this, 'thousand_separator'), 999);
        add_filter('woocommerce_price_decimal_separator', array($this, 'decimal_separator'), 999);
        add_filter('woocommerce_price_num_decimals', array($this, 'num_decimals'), 999);

        // Asterisk for external products (only asterisk, no disclaimer under price)
        add_filter('woocommerce_get_price_html', array($this, 'add_asterisk_to_price'), 10, 2);

        // NOTE: Short disclaimer removed per user request - only asterisk at price
        // Disclaimer shows only after SKU/Category via add_price_disclaimer_after_meta()

        // Full disclaimer in separate tab
        add_filter('woocommerce_product_tabs', array($this, 'add_price_disclaimer_tab'), 50);

        // Update price timestamp on product save
        add_action('woocommerce_update_product', array($this, 'update_price_timestamp'), 10, 1);

        // DISABLE REVIEWS - MULTIPLE METHODS
        add_filter('woocommerce_product_tabs', array($this, 'remove_reviews_tab'), 999);
        add_filter('woocommerce_product_supports', array($this, 'disable_reviews_support'), 10, 3);
        add_filter('comments_open', array($this, 'disable_comments'), 10, 2);

        // Price disclaimer AFTER product meta (SKU, Category)
        add_action('woocommerce_product_meta_end', array($this, 'add_price_disclaimer_after_meta'));

        // Make Amazon button open in new tab - PHP filters (more reliable than JavaScript)
        add_filter('woocommerce_loop_add_to_cart_link', array($this, 'modify_loop_button_target'), 10, 2);
        add_filter('woocommerce_product_single_add_to_cart_text', array($this, 'button_text_for_external'), 10, 2);
        add_filter('woocommerce_external_add_to_cart_html', array($this, 'modify_external_button_html'), 10, 2);

        // Backup: JavaScript for any buttons not caught by PHP filters
        add_action('wp_footer', array($this, 'amazon_button_new_tab_script'));

        error_log('WAAS Price Disclaimer: Initialized with all hooks');
    }

    /**
     * German price format - comma instead of dot
     */
    public function german_price_format($args) {
        $args['decimal_separator'] = ',';
        $args['thousand_separator'] = '.';
        $args['decimals'] = 2;
        return $args;
    }

    /**
     * German price display format
     */
    public function german_price_display_format($format) {
        // %1$s = currency symbol, %2$s = price
        return '%2$s&nbsp;%1$s'; // Price then symbol: 115,00 €
    }

    /**
     * Thousand separator
     */
    public function thousand_separator() {
        return '.';
    }

    /**
     * Decimal separator
     */
    public function decimal_separator() {
        return ',';
    }

    /**
     * Number of decimals
     */
    public function num_decimals() {
        return 2;
    }

    /**
     * Add asterisk (*) to price for affiliate products
     */
    public function add_asterisk_to_price($price, $product) {
        if ($product && $product->is_type('external')) {
            return $price . '<sup class="waas-price-asterisk" style="color: #666;">*</sup>';
        }
        return $price;
    }

    /**
     * Short disclaimer under price with timestamp
     */
    public function add_short_disclaimer() {
        global $product;

        if (!$product) {
            error_log('WAAS Price Disclaimer: No product object in global scope');
            return;
        }

        // DEBUG: Check product type
        $product_type = $product->get_type();
        error_log("WAAS Price Disclaimer: Product ID {$product->get_id()}, Type: {$product_type}");

        if (!$product->is_type('external')) {
            error_log('WAAS Price Disclaimer: Product is not external type, skipping disclaimer');
            return;
        }

        // Get last update time
        $last_update = get_post_meta($product->get_id(), '_waas_price_updated', true);
        if (!$last_update) {
            $last_update = current_time('timestamp');
            update_post_meta($product->get_id(), '_waas_price_updated', $last_update);
            error_log("WAAS Price Disclaimer: Created new timestamp for product #{$product->get_id()}");
        }

        // Format: DD.MM.YYYY HH:MM
        $date_time = new DateTime();
        $date_time->setTimestamp($last_update);
        $date_time->setTimezone(new DateTimeZone('Europe/Berlin'));
        $date = $date_time->format('d.m.Y');
        $time = $date_time->format('H:i');

        error_log("WAAS Price Disclaimer: Rendering short disclaimer for product #{$product->get_id()}, Date: {$date} {$time}");

        ?>
        <div class="waas-price-disclaimer-short" style="font-size: 0.85em; color: #666; margin: 5px 0 15px 0; line-height: 1.5;">
            <span style="color: #e74c3c; font-weight: bold;">*</span> inkl. MwSt., ggf. zzgl. Versandkosten<br>
            <span style="font-style: italic;">Preisstand: <?php echo esc_html($date); ?>, <?php echo esc_html($time); ?> Uhr</span>
        </div>
        <?php
    }

    /**
     * Add price disclaimer in product loop (shop/category pages)
     * Shows under each product price on archive pages
     */
    public function add_loop_price_disclaimer() {
        global $product;

        if (!$product || !$product->is_type('external')) {
            return;
        }

        // Get last update time
        $last_update = get_post_meta($product->get_id(), '_waas_last_price_update', true);

        // Format timestamp
        $date_str = '';
        if (!empty($last_update)) {
            try {
                $dt = new DateTime($last_update);
                $dt->setTimezone(new DateTimeZone('Europe/Berlin'));
                $date_str = $dt->format('d.m.Y, H:i') . ' Uhr';
            } catch (Exception $e) {
                $date_str = date('d.m.Y, H:i') . ' Uhr';
            }
        } else {
            $date_str = date('d.m.Y, H:i') . ' Uhr';
        }

        ?>
        <div class="waas-loop-price-disclaimer" style="font-size: 0.75em; color: #888; text-align: center; margin-top: 5px; line-height: 1.3;">
            <span style="color: #e74c3c;">*</span> inkl. MwSt., ggf. zzgl. Versandkosten<br>
            <span style="font-style: italic;">Preisstand: <?php echo esc_html($date_str); ?></span>
        </div>
        <?php
    }

    /**
     * Full disclaimer tab
     * NEW: Renamed to "Formelle Hinweise" per user requirements
     */
    public function add_price_disclaimer_tab($tabs) {
        global $product;

        if (!$product || !$product->is_type('external')) {
            return $tabs;
        }

        $tabs['formelle_hinweise'] = array(
            'title'    => 'Formelle Hinweise',
            'priority' => 60,
            'callback' => array($this, 'render_disclaimer_tab')
        );

        return $tabs;
    }

    /**
     * Render disclaimer tab content
     */
    public function render_disclaimer_tab() {
        ?>
        <div class="waas-formelle-hinweise" style="font-size: 0.95em; line-height: 1.8; color: #444;">

            <p style="margin-bottom: 20px;">
                <strong>🔸 Wir sind nicht der Verkäufer</strong><br>
                Wir verkaufen dieses Produkt nicht selbst. Wir sind weder Hersteller, Händler noch Distributor.
                Unsere Website dient der Information und Empfehlung von Produkten, die bei Amazon.de erhältlich sind.
            </p>

            <p style="margin-bottom: 20px;">
                <strong>🔸 Keine Bestellannahme</strong><br>
                Wir nehmen keine Bestellungen entgegen. Der Kauf erfolgt ausschließlich über Amazon.de.
                Zahlungen werden nicht an uns gesendet.
            </p>

            <p style="margin-bottom: 20px;">
                <strong>🔸 Produktfragen und Verfügbarkeit</strong><br>
                Wir können keine Fragen zur Produktverfügbarkeit, Lieferzeit oder Funktionen beantworten.
                Bitte wenden Sie sich an:<br>
                • Den Verkäufer auf Amazon (sichtbar beim "In den Einkaufswagen"-Button)<br>
                • Den Hersteller des Produkts
            </p>

            <p style="margin-bottom: 20px;">
                <strong>🔸 Reklamationen und Retouren</strong><br>
                Wir können keine Reklamationen, Retouren oder Streitigkeiten bearbeiten.
                Wenden Sie sich bei Problemen direkt an Amazon oder den Verkäufer.
            </p>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">

            <p style="margin-bottom: 20px;">
                <strong>🔸 Preisinformationen</strong><br>
                Preise und Verfügbarkeit entsprechen dem angegebenen Stand und können sich ändern.
                Maßgeblich ist der Preis auf Amazon.de zum Kaufzeitpunkt.
            </p>

            <p style="margin-bottom: 20px;">
                <strong>🔸 Versandkosten</strong><br>
                Preise inkl. MwSt., ggf. zzgl. Versandkosten. Prime-Mitglieder erhalten oft kostenfreien Versand.
                Mehr Infos: <a href="<?php echo esc_url(home_url('/amazon-vorteile/')); ?>" style="color: #0073aa; text-decoration: underline;">amazon-vorteile</a>
            </p>

        </div>
        <?php
    }

    /**
     * Update price timestamp
     */
    public function update_price_timestamp($product_id) {
        if (!function_exists('wc_get_product')) {
            return;
        }

        $product = wc_get_product($product_id);

        if ($product && $product->is_type('external')) {
            update_post_meta($product_id, '_waas_price_updated', current_time('timestamp'));
        }
    }

    /**
     * Remove reviews tab
     */
    public function remove_reviews_tab($tabs) {
        global $product;

        if ($product && $product->is_type('external')) {
            unset($tabs['reviews']);
        }

        return $tabs;
    }

    /**
     * Disable reviews support for external products
     */
    public function disable_reviews_support($supports, $feature, $product) {
        if ($feature === 'reviews' && $product && $product->is_type('external')) {
            return false;
        }
        return $supports;
    }

    /**
     * Disable comments for external products
     */
    public function disable_comments($open, $post_id) {
        if (!function_exists('wc_get_product')) {
            return $open;
        }

        $product = wc_get_product($post_id);
        if ($product && $product->is_type('external')) {
            return false;
        }
        return $open;
    }

    /**
     * Add price disclaimer AFTER product meta (SKU, Category)
     */
    public function add_price_disclaimer_after_meta() {
        global $product;

        if (!$product || !$product->is_type('external')) {
            return;
        }

        // Get last update time - use German timezone
        $last_update = get_post_meta($product->get_id(), '_waas_last_price_update', true);
        if (empty($last_update)) {
            $last_update = get_post_meta($product->get_id(), '_waas_price_updated', true);
        }

        // Format timestamp with German timezone
        $dt = new DateTime('now', new DateTimeZone('Europe/Berlin'));
        if (!empty($last_update)) {
            if (is_numeric($last_update)) {
                $dt->setTimestamp($last_update);
            } else {
                try {
                    $dt = new DateTime($last_update, new DateTimeZone('Europe/Berlin'));
                } catch (Exception $e) {
                    // Keep current time if parsing fails
                }
            }
        }
        $date_str = $dt->format('d.m.Y, H:i') . ' Uhr';

        ?>
        <div class="waas-price-meta-disclaimer" style="margin-top: 15px; padding: 10px; background: #f9f9f9; font-size: 0.85em; color: #666;">
            <span style="color: #666;">*</span> inkl. MwSt., ggf. zzgl. Versandkosten<br>
            <span style="font-style: italic;">Preisstand: <?php echo esc_html($date_str); ?></span>
        </div>
        <?php
    }

    /**
     * Modify loop (archive/category) button to open in new tab
     *
     * @param string $link Button HTML
     * @param WC_Product $product Product object
     * @return string Modified button HTML
     */
    public function modify_loop_button_target($link, $product) {
        if ($product && $product->is_type('external')) {
            // Add target="_blank" and rel attributes
            $link = str_replace('<a ', '<a target="_blank" rel="noopener noreferrer sponsored" ', $link);
        }
        return $link;
    }

    /**
     * Modify single product external button HTML to open in new tab
     * This is the PRIMARY method for making single product Amazon buttons open in new tab
     *
     * @param string $html Button HTML
     * @param WC_Product $product Product object
     * @return string Modified button HTML
     */
    public function modify_external_button_html($html, $product) {
        // Get product URL
        $product_url = $product->get_product_url();

        // Build new button with target="_blank"
        $button_text = $product->get_button_text();
        if (empty($button_text)) {
            $button_text = 'Auf Amazon anschauen';
        }

        // Return properly formatted button with target="_blank"
        return sprintf(
            '<a href="%s" class="single_add_to_cart_button button alt external" target="_blank" rel="noopener noreferrer sponsored">%s</a>',
            esc_url($product_url),
            esc_html($button_text)
        );
    }

    /**
     * Button text for external products
     *
     * @param string $text Button text
     * @param WC_Product $product Product object
     * @return string Modified button text
     */
    public function button_text_for_external($text, $product = null) {
        if ($product && $product->is_type('external')) {
            return 'Auf Amazon anschauen';
        }
        return $text;
    }

    /**
     * JavaScript to make Amazon button open in new tab
     * This is the MAIN solution - works with any theme, forms, and links
     */
    public function amazon_button_new_tab_script() {
        // Run on ALL pages (not just WooCommerce) to catch all Amazon links
        ?>
        <script>
        (function() {
            'use strict';

            function makeAmazonLinksOpenNewTab() {
                // 1. Handle direct links (a tags)
                var linkSelectors = [
                    'a.single_add_to_cart_button',
                    'a.button[href*="amazon"]',
                    'a.button[href*="amzn"]',
                    'a.product_type_external',
                    'a.external',
                    'a.alt[href*="amazon"]',
                    'a[href*="amazon.de"]',
                    'a[href*="amazon.com"]',
                    'a[href*="amzn.to"]',
                    '.summary a.button',
                    '.woocommerce-product-details__add-to-cart a',
                    'form.cart a.button'
                ];

                linkSelectors.forEach(function(selector) {
                    document.querySelectorAll(selector).forEach(function(link) {
                        if (!link.hasAttribute('data-waas-target')) {
                            link.setAttribute('target', '_blank');
                            link.setAttribute('rel', 'noopener noreferrer sponsored');
                            link.setAttribute('data-waas-target', 'done');
                        }
                    });
                });

                // 2. Handle forms with Amazon action URLs (some themes use form instead of link)
                document.querySelectorAll('form.cart').forEach(function(form) {
                    var action = form.getAttribute('action') || '';
                    if (action.indexOf('amazon') !== -1 || action.indexOf('amzn') !== -1) {
                        if (!form.hasAttribute('data-waas-form')) {
                            form.setAttribute('target', '_blank');
                            form.setAttribute('data-waas-form', 'done');
                        }
                    }
                });

                // 3. Handle submit buttons inside forms - convert to links
                document.querySelectorAll('form.cart button.single_add_to_cart_button').forEach(function(btn) {
                    var form = btn.closest('form');
                    if (!form) return;

                    var action = form.getAttribute('action') || '';
                    if ((action.indexOf('amazon') !== -1 || action.indexOf('amzn') !== -1) && !btn.hasAttribute('data-waas-btn')) {
                        // Intercept click and open in new tab
                        btn.setAttribute('data-waas-btn', 'done');
                        btn.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            window.open(action, '_blank', 'noopener,noreferrer');
                            return false;
                        });
                    }
                });
            }

            // Run immediately and on various load events
            makeAmazonLinksOpenNewTab();

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', makeAmazonLinksOpenNewTab);
            }

            window.addEventListener('load', makeAmazonLinksOpenNewTab);

            // Run periodically for 3 seconds after page load (catch lazy-loaded content)
            var checkCount = 0;
            var checker = setInterval(function() {
                makeAmazonLinksOpenNewTab();
                checkCount++;
                if (checkCount >= 6) {
                    clearInterval(checker);
                }
            }, 500);

            // MutationObserver for dynamic content
            if (typeof MutationObserver !== 'undefined') {
                var observer = new MutationObserver(function() {
                    makeAmazonLinksOpenNewTab();
                });

                if (document.body) {
                    observer.observe(document.body, { childList: true, subtree: true });
                } else {
                    document.addEventListener('DOMContentLoaded', function() {
                        observer.observe(document.body, { childList: true, subtree: true });
                    });
                }
            }
        })();
        </script>
        <?php
    }
}

// NOTE: Initialization happens in waas-product-manager.php via get_instance()
