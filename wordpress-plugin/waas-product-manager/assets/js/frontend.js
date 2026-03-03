/**
 * WAAS Product Manager - Frontend JavaScript
 *
 * @package WAAS_Product_Manager
 */

(function($) {
    'use strict';

    $(document).ready(function() {
        console.log('WAAS Product Manager: Frontend loaded');

        // DEBUG: Check if product meta data is available
        if (typeof waasProductMeta !== 'undefined') {
            console.log('WAAS: waasProductMeta is defined:', waasProductMeta);
        } else {
            console.log('WAAS: waasProductMeta is NOT defined - product may not be external type or not on product page');
        }

        // Add product meta disclaimer (if data is available)
        if (typeof waasProductMeta !== 'undefined' && waasProductMeta.timestamp) {
            var disclaimerHTML = '<div class="waas-price-disclaimer-meta" style="display: block !important; visibility: visible !important; margin-top: 15px !important; margin-bottom: 15px !important; padding: 10px !important; background-color: #f9f9f9 !important; border-left: 3px solid #e0e0e0 !important; font-size: 0.85em !important; color: #666 !important; font-style: italic !important; line-height: 1.6 !important;">' +
                '<strong>' + waasProductMeta.disclaimer + '</strong><br>' +
                'Preisstand: ' + waasProductMeta.timestamp +
                '</div>';

            if ($('.product_meta').length > 0) {
                $('.product_meta').after(disclaimerHTML);
                console.log('WAAS: Product meta disclaimer inserted after .product_meta');
            } else {
                console.log('WAAS: .product_meta not found, disclaimer not inserted');
            }
        }

        // ============================================
        // FOOTER CUSTOMIZATION
        // ============================================

        // New footer text per user specification
        var newFooterText = '© 2025 Passgenaue LKW-Fußmatten | * Affiliate-Link (Werbung). Preise inkl. MwSt., ggf. zzgl. Versandkosten.<br>' +
            'Als Amazon-Partner verdienen wir an qualifizierten Käufen eine kleine<br>' +
            'Provision, die den Produktpreis nicht beeinflusst.';

        // Footer styling (white background, gray text, smaller font)
        var footerStyles = {
            'background-color': '#ffffff',
            'color': '#888888',
            'font-size': '0.85em',
            'padding': '15px 0',
            'text-align': 'center',
            'line-height': '1.5'
        };

        // Old text pattern to find
        var oldTextPatterns = [
            'Als Amazon-Partner verdienen wir an qualifizierten Verkäufen',
            'Amazon-Partner',
            'qualifizierten Verkäufen'
        ];

        // Function to update footer
        function updateFooter() {
            var footerUpdated = false;

            // Method 1: Try #footer-info (common in many themes)
            if ($('#footer-info').length > 0) {
                $('#footer-info').html(newFooterText).css(footerStyles);
                $('#footer-bottom').css({
                    'background-color': '#ffffff',
                    'padding': '15px 0'
                });
                footerUpdated = true;
                console.log('WAAS: Footer updated via #footer-info');
            }

            // Method 2: Try Divi footer bottom
            if (!footerUpdated && $('#footer-bottom .container').length > 0) {
                $('#footer-bottom .container').html('<div id="footer-info" style="' +
                    'background-color: #ffffff; color: #888888; font-size: 0.85em; ' +
                    'text-align: center; line-height: 1.5;">' + newFooterText + '</div>');
                $('#footer-bottom').css({
                    'background-color': '#ffffff',
                    'padding': '15px 0'
                });
                footerUpdated = true;
                console.log('WAAS: Footer updated via #footer-bottom .container (Divi)');
            }

            // Method 3: Try .footer-bottom (common class name)
            if (!footerUpdated && $('.footer-bottom').length > 0) {
                var $footerBottom = $('.footer-bottom');
                var currentText = $footerBottom.text();

                for (var i = 0; i < oldTextPatterns.length; i++) {
                    if (currentText.indexOf(oldTextPatterns[i]) !== -1) {
                        $footerBottom.html('<div style="' +
                            'background-color: #ffffff; color: #888888; font-size: 0.85em; ' +
                            'text-align: center; line-height: 1.5; padding: 15px;">' +
                            newFooterText + '</div>');
                        footerUpdated = true;
                        console.log('WAAS: Footer updated via .footer-bottom');
                        break;
                    }
                }
            }

            // Method 4: Try #main-footer (Divi specific)
            if (!footerUpdated && $('#main-footer .bottom-nav').length > 0) {
                $('#main-footer .bottom-nav').html(newFooterText);
                $('#main-footer').find('.bottom-nav').parent().css({
                    'background-color': '#ffffff',
                    'color': '#888888',
                    'font-size': '0.85em'
                });
                footerUpdated = true;
                console.log('WAAS: Footer updated via #main-footer .bottom-nav');
            }

            // Method 5: Generic search - look for any element containing the old text
            if (!footerUpdated) {
                $('footer, #footer, .footer, #main-footer').find('*').each(function() {
                    var $elem = $(this);
                    var elemText = $elem.text();

                    // Skip if element has many children (container element)
                    if ($elem.children().length > 2) return true;

                    for (var i = 0; i < oldTextPatterns.length; i++) {
                        if (elemText.indexOf(oldTextPatterns[i]) !== -1) {
                            $elem.html(newFooterText).css(footerStyles);
                            // Also style parent if it's a container
                            $elem.parent().css({
                                'background-color': '#ffffff',
                                'padding': '15px 0'
                            });
                            footerUpdated = true;
                            console.log('WAAS: Footer updated via generic search');
                            return false; // break .each loop
                        }
                    }
                });
            }

            if (!footerUpdated) {
                console.log('WAAS: Footer not found - manual configuration may be needed');
            }
        }

        // Run footer update
        updateFooter();

        // Also run after a small delay (some themes load footer dynamically)
        setTimeout(function() {
            if ($('#footer-info').length === 0 || $('#footer-info').html().indexOf('Provision') === -1) {
                updateFooter();
            }
        }, 1000);
    });

})(jQuery);
