/**
 * WAAS Product Manager - Admin JavaScript
 *
 * @package WAAS_Product_Manager
 * @version 1.0.0
 */

(function($) {
    'use strict';

    /**
     * WAAS Admin Handler
     */
    const WaasAdmin = {

        /**
         * Initialize
         */
        init: function() {
            this.bindEvents();
            this.initPasswordToggles();
        },

        /**
         * Bind events
         */
        bindEvents: function() {
            // Import products
            $('#waas-import-form').on('submit', this.handleImport);

            // Sync single product
            $(document).on('click', '.waas-sync-product', this.handleSyncProduct);
            $(document).on('click', '#waas_sync_now', this.handleSyncCurrentProduct);

            // Update all products
            $('#waas-update-all-products').on('click', this.handleUpdateAllProducts);

            // Cache management
            $('#waas-clean-cache').on('click', this.handleCleanCache);
            $('#waas-refresh-stats').on('click', this.handleRefreshStats);

            // Fetch from Amazon button in edit post
            $('#waas_fetch_from_amazon').on('click', this.handleFetchFromAmazon);
        },

        /**
         * Initialize password field toggles
         */
        initPasswordToggles: function() {
            $('.waas-toggle-password').on('click', function() {
                const $button = $(this);
                const targetId = $button.attr('data-target');
                const $input = $('#' + targetId);

                if ($input.attr('type') === 'password') {
                    $input.attr('type', 'text');
                    $button.text(waasPMAdmin.i18n?.hide || 'Hide');
                } else {
                    $input.attr('type', 'password');
                    $button.text(waasPMAdmin.i18n?.show || 'Show');
                }
            });
        },

        /**
         * Handle product import
         */
        handleImport: function(e) {
            e.preventDefault();

            const $form = $(this);
            const $button = $form.find('button[type="submit"]');
            const $spinner = $form.find('.spinner');
            const $results = $('#waas-import-results');
            const $resultsContent = $('#waas-import-results-content');

            const asins = $('#waas_import_asins').val();
            const category = $('#waas_import_category').val();

            if (!asins.trim()) {
                alert(waasPMAdmin.i18n?.no_asins || 'Please enter at least one ASIN');
                return;
            }

            $button.prop('disabled', true);
            $spinner.addClass('is-active');
            $results.hide();

            $.ajax({
                url: waasPMAdmin.ajax_url,
                type: 'POST',
                data: {
                    action: 'waas_import_products',
                    nonce: waasPMAdmin.nonce,
                    asins: asins,
                    category: category
                },
                success: function(response) {
                    if (response.success) {
                        WaasAdmin.displayImportResults(response.data, $resultsContent);
                        $results.show();
                        $('#waas_import_asins').val('');
                    } else {
                        alert(response.data.message || 'Import failed');
                    }
                },
                error: function(xhr, status, error) {
                    alert('Error: ' + error);
                },
                complete: function() {
                    $button.prop('disabled', false);
                    $spinner.removeClass('is-active');
                }
            });
        },

        /**
         * Display import results
         */
        displayImportResults: function(data, $container) {
            let html = '<div class="waas-import-summary">';
            html += '<p><strong>Import Summary:</strong></p>';
            html += '<ul>';
            html += '<li>Imported: <strong>' + data.imported + '</strong></li>';
            html += '<li>Updated: <strong>' + data.updated + '</strong></li>';
            html += '<li>Errors: <strong>' + data.errors + '</strong></li>';
            html += '</ul>';
            html += '</div>';

            if (data.details && data.details.length > 0) {
                html += '<div class="waas-import-details">';
                html += '<p><strong>Details:</strong></p>';
                data.details.forEach(function(item) {
                    const statusClass = item.status === 'success' ? 'success' : 'error';
                    html += '<div class="waas-import-result-item ' + statusClass + '">';
                    html += '<strong>ASIN:</strong> ' + item.asin;
                    if (item.post_id) {
                        html += ' - <a href="post.php?post=' + item.post_id + '&action=edit">Edit Product</a>';
                    }
                    html += '</div>';
                });
                html += '</div>';
            }

            $container.html(html);
        },

        /**
         * Handle sync single product
         */
        handleSyncProduct: function(e) {
            e.preventDefault();

            const $button = $(this);
            const asin = $button.attr('data-asin');

            if (!asin) {
                return;
            }

            $button.addClass('loading').prop('disabled', true);

            $.ajax({
                url: waasPMAdmin.ajax_url,
                type: 'POST',
                data: {
                    action: 'waas_sync_product',
                    nonce: waasPMAdmin.nonce,
                    asin: asin
                },
                success: function(response) {
                    if (response.success) {
                        location.reload();
                    } else {
                        alert(response.data.message || 'Sync failed');
                        $button.removeClass('loading').prop('disabled', false);
                    }
                },
                error: function() {
                    alert('Error syncing product');
                    $button.removeClass('loading').prop('disabled', false);
                }
            });
        },

        /**
         * Handle sync current product (edit post page)
         */
        handleSyncCurrentProduct: function(e) {
            e.preventDefault();

            const $button = $(this);
            const postId = $('#post_ID').val();
            const asin = $('#waas_asin').val();

            if (!asin) {
                alert(waasPMAdmin.i18n?.enter_asin || 'Please enter an ASIN first');
                return;
            }

            $button.prop('disabled', true).next('.spinner').addClass('is-active');

            $.ajax({
                url: waasPMAdmin.ajax_url,
                type: 'POST',
                data: {
                    action: 'waas_sync_product',
                    nonce: waasPMAdmin.nonce,
                    asin: asin
                },
                success: function(response) {
                    if (response.success) {
                        $('#waas_fetch_status').html('<span style="color: green;">✓ Synced successfully! Please refresh the page.</span>');
                        setTimeout(function() {
                            location.reload();
                        }, 1500);
                    } else {
                        $('#waas_fetch_status').html('<span style="color: red;">✗ ' + (response.data.message || 'Sync failed') + '</span>');
                    }
                },
                error: function() {
                    $('#waas_fetch_status').html('<span style="color: red;">✗ Error syncing product</span>');
                },
                complete: function() {
                    $button.prop('disabled', false).next('.spinner').removeClass('is-active');
                }
            });
        },

        /**
         * Handle update all products
         */
        handleUpdateAllProducts: function(e) {
            e.preventDefault();

            if (!confirm(waasPMAdmin.i18n?.confirm_update_all || 'Update all products? This may take a while.')) {
                return;
            }

            const $button = $(this);
            $button.addClass('loading').prop('disabled', true);

            $.ajax({
                url: waasPMAdmin.rest_url + 'products/update',
                type: 'POST',
                beforeSend: function(xhr) {
                    xhr.setRequestHeader('X-WP-Nonce', waasPMAdmin.rest_nonce);
                },
                data: {},
                success: function(response) {
                    if (response.success) {
                        alert('Products updated: ' + response.data.updated + '\nErrors: ' + response.data.errors);
                        location.reload();
                    }
                },
                error: function() {
                    alert('Error updating products');
                },
                complete: function() {
                    $button.removeClass('loading').prop('disabled', false);
                }
            });
        },

        /**
         * Handle clean cache
         */
        handleCleanCache: function(e) {
            e.preventDefault();

            if (!confirm(waasPMAdmin.i18n?.confirm_clean_cache || 'Clean expired cache entries?')) {
                return;
            }

            const $button = $(this);
            $button.addClass('loading').prop('disabled', true);

            $.ajax({
                url: waasPMAdmin.ajax_url,
                type: 'POST',
                data: {
                    action: 'waas_clean_cache',
                    nonce: waasPMAdmin.nonce
                },
                success: function(response) {
                    if (response.success) {
                        alert('Cleaned ' + response.data.cleaned + ' expired cache entries');
                        location.reload();
                    }
                },
                error: function() {
                    alert('Error cleaning cache');
                },
                complete: function() {
                    $button.removeClass('loading').prop('disabled', false);
                }
            });
        },

        /**
         * Handle refresh stats
         */
        handleRefreshStats: function(e) {
            e.preventDefault();

            const $button = $(this);
            $button.addClass('loading').prop('disabled', true);

            $.ajax({
                url: waasPMAdmin.ajax_url,
                type: 'POST',
                data: {
                    action: 'waas_get_cache_stats',
                    nonce: waasPMAdmin.nonce
                },
                success: function(response) {
                    if (response.success) {
                        location.reload();
                    }
                },
                error: function() {
                    alert('Error refreshing stats');
                },
                complete: function() {
                    $button.removeClass('loading').prop('disabled', false);
                }
            });
        },

        /**
         * Handle fetch from Amazon button
         */
        handleFetchFromAmazon: function(e) {
            e.preventDefault();

            const $button = $(this);
            const asin = $('#waas_asin').val();

            if (!asin) {
                alert(waasPMAdmin.i18n?.enter_asin || 'Please enter an ASIN first');
                return;
            }

            $button.prop('disabled', true);
            $button.next('.spinner').addClass('is-active');
            $('#waas_fetch_status').html('');

            $.ajax({
                url: waasPMAdmin.rest_url + 'products/sync/' + asin,
                type: 'POST',
                beforeSend: function(xhr) {
                    xhr.setRequestHeader('X-WP-Nonce', waasPMAdmin.rest_nonce);
                },
                success: function(response) {
                    if (response.success && response.data) {
                        WaasAdmin.populateProductFields(response.data);
                        $('#waas_fetch_status').html('<span style="color: green;">✓ Product data fetched successfully!</span>');
                    } else {
                        $('#waas_fetch_status').html('<span style="color: red;">✗ Failed to fetch product data</span>');
                    }
                },
                error: function(xhr) {
                    let message = 'Error fetching product data';
                    if (xhr.responseJSON && xhr.responseJSON.message) {
                        message = xhr.responseJSON.message;
                    }
                    $('#waas_fetch_status').html('<span style="color: red;">✗ ' + message + '</span>');
                },
                complete: function() {
                    $button.prop('disabled', false);
                    $button.next('.spinner').removeClass('is-active');
                }
            });
        },

        /**
         * Populate product fields with fetched data
         */
        populateProductFields: function(data) {
            if (data.title) {
                $('#title').val(data.title);
            }
            if (data.brand) {
                $('#waas_brand').val(data.brand);
            }
            if (data.affiliate_link) {
                $('#waas_affiliate_link').val(data.affiliate_link);
            }
            if (data.image_url) {
                $('#waas_image_url').val(data.image_url);
            }
            if (data.features && Array.isArray(data.features)) {
                $('#waas_features').val(data.features.join('\n'));
            }
            if (data.price) {
                $('#waas_price').val(data.price);
            }
            if (data.savings_percentage) {
                $('#waas_savings').val(data.savings_percentage);
            }
            if (data.availability) {
                const availabilityMap = {
                    'Available': 'in_stock',
                    'InStock': 'in_stock',
                    'OutOfStock': 'out_of_stock'
                };
                const mappedAvailability = availabilityMap[data.availability] || 'in_stock';
                $('#waas_availability').val(mappedAvailability);
            }
            if (typeof data.prime_eligible !== 'undefined') {
                $('#waas_prime_eligible').prop('checked', data.prime_eligible);
            }
        }
    };

    /**
     * Document ready
     */
    $(document).ready(function() {
        WaasAdmin.init();
    });

})(jQuery);
