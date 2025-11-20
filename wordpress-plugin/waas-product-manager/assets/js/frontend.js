/**
 * WAAS Product Manager - Frontend JavaScript
 *
 * @package WAAS_Product_Manager
 * @version 1.0.0
 */

(function($) {
    'use strict';

    /**
     * WAAS Frontend Handler
     */
    const WaasProPM = {

        /**
         * Initialize
         */
        init: function() {
            this.bindEvents();
            this.lazyLoadImages();
        },

        /**
         * Bind events
         */
        bindEvents: function() {
            // Track affiliate link clicks
            $(document).on('click', '.waas-button, .waas-grid-button', this.trackAffiliateClick);

            // Handle dynamic product loading if needed
            this.handleDynamicLoading();
        },

        /**
         * Track affiliate link clicks (for analytics)
         */
        trackAffiliateClick: function(e) {
            const $link = $(this);
            const asin = $link.closest('[data-asin]').attr('data-asin');

            // Send tracking event if analytics is available
            if (typeof ga !== 'undefined') {
                ga('send', 'event', 'Amazon Product', 'Click', asin);
            }

            if (typeof gtag !== 'undefined') {
                gtag('event', 'amazon_product_click', {
                    'event_category': 'Amazon Product',
                    'event_label': asin
                });
            }

            // Log to console for debugging
            console.log('WAAS: Affiliate link clicked for ASIN:', asin);
        },

        /**
         * Lazy load product images
         */
        lazyLoadImages: function() {
            if ('IntersectionObserver' in window) {
                const imageObserver = new IntersectionObserver(function(entries, observer) {
                    entries.forEach(function(entry) {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            img.src = img.dataset.src;
                            img.classList.remove('waas-lazy');
                            imageObserver.unobserve(img);
                        }
                    });
                });

                document.querySelectorAll('.waas-product-image img.waas-lazy, .waas-grid-image img.waas-lazy').forEach(function(img) {
                    imageObserver.observe(img);
                });
            }
        },

        /**
         * Handle dynamic product loading
         */
        handleDynamicLoading: function() {
            // Check if there are any products marked for dynamic loading
            $('.waas-product[data-dynamic-load="true"]').each(function() {
                const $product = $(this);
                const asin = $product.attr('data-asin');

                if (asin) {
                    WaasProPM.loadProductData(asin, $product);
                }
            });
        },

        /**
         * Load product data via AJAX
         */
        loadProductData: function(asin, $container) {
            $container.addClass('waas-loading');

            $.ajax({
                url: waasPM.ajax_url,
                type: 'POST',
                data: {
                    action: 'waas_get_product',
                    nonce: waasPM.nonce,
                    asin: asin
                },
                success: function(response) {
                    if (response.success) {
                        $container.html(response.data.html);
                        $container.removeClass('waas-loading');
                    } else {
                        console.error('WAAS: Failed to load product', asin);
                        $container.removeClass('waas-loading');
                    }
                },
                error: function(xhr, status, error) {
                    console.error('WAAS: AJAX error', error);
                    $container.removeClass('waas-loading');
                }
            });
        },

        /**
         * Refresh product price (for real-time updates)
         */
        refreshPrice: function(asin, $priceContainer) {
            $.ajax({
                url: waasPM.ajax_url,
                type: 'POST',
                data: {
                    action: 'waas_get_product_price',
                    nonce: waasPM.nonce,
                    asin: asin
                },
                success: function(response) {
                    if (response.success && response.data.price) {
                        $priceContainer.html(response.data.price_html);
                    }
                }
            });
        }
    };

    /**
     * Document ready
     */
    $(document).ready(function() {
        WaasProPM.init();
    });

    // Make WaasProPM globally accessible
    window.WaasProPM = WaasProPM;

})(jQuery);
