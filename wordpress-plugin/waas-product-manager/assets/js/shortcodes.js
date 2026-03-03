/**
 * WAAS Product Shortcodes - Frontend JavaScript
 *
 * Image zoom i inne interakcje
 */

(function($) {
    'use strict';

    // Image Zoom Functionality
    class WAASImageZoom {
        constructor() {
            this.modal = null;
            this.init();
        }

        init() {
            this.createModal();
            this.attachEvents();
        }

        createModal() {
            // Create zoom modal if it doesn't exist
            if ($('#waas-zoom-modal').length === 0) {
                $('body').append(`
                    <div id="waas-zoom-modal" class="waas-zoom-modal">
                        <span class="waas-zoom-modal-close">&times;</span>
                        <img src="" alt="" />
                    </div>
                `);
            }

            this.modal = $('#waas-zoom-modal');
            this.modalImg = this.modal.find('img');
            this.closeBtn = this.modal.find('.waas-zoom-modal-close');
        }

        attachEvents() {
            const self = this;

            // Click on image to zoom
            $(document).on('click', '.waas-image-zoom', function(e) {
                e.preventDefault();
                const imgSrc = $(this).attr('src');
                const imgAlt = $(this).attr('alt');

                self.showZoom(imgSrc, imgAlt);
            });

            // Close modal
            this.closeBtn.on('click', function() {
                self.hideZoom();
            });

            // Close on background click
            this.modal.on('click', function(e) {
                if (e.target === this) {
                    self.hideZoom();
                }
            });

            // Close on ESC key
            $(document).on('keyup', function(e) {
                if (e.key === 'Escape' && self.modal.hasClass('active')) {
                    self.hideZoom();
                }
            });
        }

        showZoom(imgSrc, imgAlt) {
            this.modalImg.attr('src', imgSrc);
            this.modalImg.attr('alt', imgAlt);
            this.modal.addClass('active');
            $('body').css('overflow', 'hidden');
        }

        hideZoom() {
            this.modal.removeClass('active');
            $('body').css('overflow', '');
        }
    }

    // Hover Effect for Product Images
    class WAASImageHover {
        constructor() {
            this.init();
        }

        init() {
            // Smooth zoom effect on hover
            $('.waas-product-image img, .waas-product-image-horizontal img').hover(
                function() {
                    $(this).css('transform', 'scale(1.1)');
                },
                function() {
                    $(this).css('transform', 'scale(1)');
                }
            );
        }
    }

    // Track Amazon affiliate link clicks
    class WAASAffiliateTracker {
        constructor() {
            this.init();
        }

        init() {
            $(document).on('click', 'a[rel*="sponsored"], .waas-amazon-button, .waas-button', function(e) {
                const href = $(this).attr('href');

                // Track click event (optional - can be sent to Analytics)
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'affiliate_click', {
                        'event_category': 'Amazon Affiliate',
                        'event_label': href,
                    });
                }

                // Console log for debugging
                console.log('WAAS: Affiliate link clicked -', href);
            });
        }
    }

    // Initialize on document ready
    $(document).ready(function() {
        // Initialize image zoom
        new WAASImageZoom();

        // Initialize hover effects
        new WAASImageHover();

        // Initialize affiliate tracking (optional)
        new WAASAffiliateTracker();

        console.log('WAAS Product Shortcodes: Initialized');
    });

})(jQuery);
