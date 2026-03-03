<?php
/**
 * WAAS Admin Dashboard
 *
 * Features:
 * - Full product list with ASIN, Price, Last Update columns in WAAS Products section
 * - Quick stats
 * - Price sync test function
 *
 * @package WAAS_Product_Manager
 */

if (!defined('ABSPATH')) {
    exit;
}

class WAAS_Admin_Dashboard {

    protected static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
    }

    public function add_admin_menu() {
        // Main menu
        add_menu_page(
            'WAAS Product Manager',
            'WAAS Products',
            'manage_options',
            'waas-pm-dashboard',
            array($this, 'render_dashboard'),
            'dashicons-products',
            30
        );

        // Submenu - Products List
        add_submenu_page(
            'waas-pm-dashboard',
            'Alle Produkte',
            'Alle Produkte',
            'manage_options',
            'waas-pm-products',
            array($this, 'render_products_list')
        );

        // Submenu - Price Sync Test
        add_submenu_page(
            'waas-pm-dashboard',
            'Price Sync Test',
            'Price Sync Test',
            'manage_options',
            'waas-pm-sync-test',
            array($this, 'render_sync_test')
        );
    }

    /**
     * Main Dashboard
     */
    public function render_dashboard() {
        ?>
        <div class="wrap">
            <h1>WAAS Product Manager Dashboard</h1>

            <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-top: 20px;">

                <!-- Quick Stats Card -->
                <div class="card" style="min-width: 300px; max-width: 400px;">
                    <h2>Quick Stats</h2>
                    <?php
                    $wc_count = class_exists('WooCommerce') ? wp_count_posts('product') : null;

                    // Count products with ASIN
                    $products_with_asin = get_posts(array(
                        'post_type' => 'product',
                        'posts_per_page' => -1,
                        'meta_query' => array(
                            array(
                                'key' => '_waas_asin',
                                'value' => '',
                                'compare' => '!='
                            )
                        ),
                        'fields' => 'ids'
                    ));

                    // Count products updated today
                    $today = date('Y-m-d');
                    $products_updated_today = get_posts(array(
                        'post_type' => 'product',
                        'posts_per_page' => -1,
                        'meta_query' => array(
                            array(
                                'key' => '_waas_last_price_sync_date',
                                'value' => $today,
                                'compare' => 'LIKE'
                            )
                        ),
                        'fields' => 'ids'
                    ));
                    ?>
                    <table style="width: 100%; border-collapse: collapse;">
                        <?php if ($wc_count): ?>
                        <tr>
                            <td style="padding: 8px 0;">WooCommerce Products:</td>
                            <td style="padding: 8px 0; text-align: right;"><strong><?php echo $wc_count->publish; ?></strong></td>
                        </tr>
                        <?php endif; ?>
                        <tr>
                            <td style="padding: 8px 0;">Products with ASIN:</td>
                            <td style="padding: 8px 0; text-align: right;"><strong><?php echo count($products_with_asin); ?></strong></td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0;">Updated Today:</td>
                            <td style="padding: 8px 0; text-align: right;"><strong style="color: #2e7d32;"><?php echo count($products_updated_today); ?></strong></td>
                        </tr>
                    </table>
                    <p style="margin-top: 15px;">
                        <a href="<?php echo admin_url('admin.php?page=waas-pm-products'); ?>" class="button button-primary">View All Products</a>
                    </p>
                </div>

                <!-- Quick Links Card -->
                <div class="card" style="min-width: 300px; max-width: 400px;">
                    <h2>Quick Links</h2>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li style="margin-bottom: 10px;">
                            <a href="<?php echo admin_url('admin.php?page=waas-pm-products'); ?>"><strong>Alle Produkte</strong></a> - Lista z ASIN, Price, Last Update
                        </li>
                        <li style="margin-bottom: 10px;">
                            <a href="<?php echo admin_url('admin.php?page=waas-pm-sync-test'); ?>">Price Sync Test</a> - Test synchronizacji cen
                        </li>
                        <li style="margin-bottom: 10px;">
                            <a href="<?php echo admin_url('admin.php?page=waas-pm-settings'); ?>">Plugin Settings</a>
                        </li>
                        <li style="margin-bottom: 10px;">
                            <a href="https://github.com/LUKOAI/LUKO-WAAS" target="_blank">GitHub Repository</a>
                        </li>
                    </ul>
                </div>

            </div>

        </div>
        <?php
    }

    /**
     * Products List with ASIN, Price, Last Update columns
     * Shows ALL external/affiliate products (with or without ASIN)
     */
    public function render_products_list() {
        // Pagination
        $per_page = 20;
        $current_page = isset($_GET['paged']) ? max(1, intval($_GET['paged'])) : 1;
        $offset = ($current_page - 1) * $per_page;

        // Get ALL external products (affiliate products)
        // We show all external products, not just those with ASIN
        $args = array(
            'post_type' => 'product',
            'posts_per_page' => $per_page,
            'offset' => $offset,
            'tax_query' => array(
                array(
                    'taxonomy' => 'product_type',
                    'field'    => 'slug',
                    'terms'    => 'external',
                ),
            ),
            'orderby' => 'modified',
            'order' => 'DESC'
        );

        // Handle sorting
        if (isset($_GET['orderby'])) {
            switch ($_GET['orderby']) {
                case 'asin':
                    $args['meta_key'] = '_waas_asin';
                    $args['orderby'] = 'meta_value';
                    break;
                case 'price':
                    $args['meta_key'] = '_waas_price';
                    $args['orderby'] = 'meta_value_num';
                    break;
                case 'last_update':
                    $args['meta_key'] = '_waas_last_price_update';
                    $args['orderby'] = 'meta_value';
                    break;
            }
            $args['order'] = isset($_GET['order']) && $_GET['order'] === 'asc' ? 'ASC' : 'DESC';
        }

        $products_query = new WP_Query($args);
        $total_products = $products_query->found_posts;
        $total_pages = ceil($total_products / $per_page);

        ?>
        <div class="wrap">
            <h1>WAAS Products - Alle Amazon Produkte</h1>
            <p>Liste aller externen/Affiliate-Produkte mit ASIN, Preis und Letztem Update</p>

            <table class="wp-list-table widefat fixed striped" style="margin-top: 20px;">
                <thead>
                    <tr>
                        <th style="width: 40px;">ID</th>
                        <th style="width: 50px;">Bild</th>
                        <th>Produkt Name</th>
                        <th style="width: 120px;">
                            <a href="<?php echo $this->get_sort_url('asin'); ?>">ASIN</a>
                        </th>
                        <th style="width: 100px;">
                            <a href="<?php echo $this->get_sort_url('price'); ?>">Price</a>
                        </th>
                        <th style="width: 150px;">
                            <a href="<?php echo $this->get_sort_url('last_update'); ?>">Last Price Update</a>
                        </th>
                        <th style="width: 80px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if ($products_query->have_posts()): ?>
                        <?php while ($products_query->have_posts()): $products_query->the_post();
                            $product_id = get_the_ID();
                            $product = wc_get_product($product_id);
                            $asin = get_post_meta($product_id, '_waas_asin', true);
                            $price = get_post_meta($product_id, '_waas_price', true);
                            $price_formatted = get_post_meta($product_id, '_waas_price_formatted', true);
                            $last_update = get_post_meta($product_id, '_waas_last_price_update', true);

                            // Format price
                            $display_price = '';
                            if ($price_formatted) {
                                $display_price = $price_formatted;
                            } elseif ($price) {
                                $display_price = number_format((float)$price, 2, ',', '.') . ' €';
                            } elseif ($product) {
                                $wc_price = $product->get_price();
                                if ($wc_price) {
                                    $display_price = number_format((float)$wc_price, 2, ',', '.') . ' €';
                                }
                            }

                            // Format date
                            $display_date = '—';
                            if ($last_update) {
                                try {
                                    $dt = new DateTime($last_update);
                                    $dt->setTimezone(new DateTimeZone('Europe/Berlin'));
                                    $today = new DateTime('now', new DateTimeZone('Europe/Berlin'));

                                    if ($dt->format('Y-m-d') === $today->format('Y-m-d')) {
                                        $display_date = '<span style="color: #2e7d32; font-weight: bold;">Heute, ' . $dt->format('H:i') . '</span>';
                                    } else {
                                        $display_date = $dt->format('d.m.Y, H:i');
                                    }
                                } catch (Exception $e) {
                                    $display_date = '—';
                                }
                            }

                            // Get thumbnail
                            $thumbnail = '';
                            if ($product) {
                                $thumb_id = $product->get_image_id();
                                if ($thumb_id) {
                                    $thumbnail = wp_get_attachment_image($thumb_id, array(40, 40));
                                }
                            }
                        ?>
                        <tr>
                            <td><?php echo $product_id; ?></td>
                            <td><?php echo $thumbnail ?: '<span style="color: #999;">—</span>'; ?></td>
                            <td>
                                <a href="<?php echo get_edit_post_link($product_id); ?>">
                                    <strong><?php echo esc_html(wp_trim_words(get_the_title(), 8)); ?></strong>
                                </a>
                            </td>
                            <td>
                                <?php if ($asin): ?>
                                    <code style="background: #e8f5e9; padding: 3px 8px; border-radius: 3px; font-size: 12px;"><?php echo esc_html($asin); ?></code>
                                <?php else: ?>
                                    <span style="color: #999;">—</span>
                                <?php endif; ?>
                            </td>
                            <td>
                                <?php if ($display_price): ?>
                                    <strong style="color: #2e7d32;"><?php echo esc_html($display_price); ?></strong>
                                <?php else: ?>
                                    <span style="color: #999;">—</span>
                                <?php endif; ?>
                            </td>
                            <td><?php echo $display_date; ?></td>
                            <td>
                                <a href="<?php echo get_edit_post_link($product_id); ?>" class="button button-small">Edit</a>
                            </td>
                        </tr>
                        <?php endwhile; ?>
                    <?php else: ?>
                        <tr>
                            <td colspan="7" style="text-align: center; padding: 20px;">
                                Keine externen/Affiliate-Produkte gefunden.<br>
                                <small>Importiere Produkte über Google Sheets, um sie hier zu sehen.</small>
                            </td>
                        </tr>
                    <?php endif; ?>
                </tbody>
            </table>

            <?php wp_reset_postdata(); ?>

            <!-- Pagination -->
            <?php if ($total_pages > 1): ?>
            <div class="tablenav bottom" style="margin-top: 15px;">
                <div class="tablenav-pages">
                    <span class="displaying-num"><?php echo $total_products; ?> Produkte</span>
                    <span class="pagination-links">
                        <?php
                        echo paginate_links(array(
                            'base' => add_query_arg('paged', '%#%'),
                            'format' => '',
                            'prev_text' => '&laquo;',
                            'next_text' => '&raquo;',
                            'total' => $total_pages,
                            'current' => $current_page
                        ));
                        ?>
                    </span>
                </div>
            </div>
            <?php endif; ?>

        </div>
        <?php
    }

    /**
     * Get sort URL
     */
    private function get_sort_url($column) {
        $current_orderby = isset($_GET['orderby']) ? $_GET['orderby'] : '';
        $current_order = isset($_GET['order']) ? $_GET['order'] : 'desc';

        $new_order = ($current_orderby === $column && $current_order === 'desc') ? 'asc' : 'desc';

        return add_query_arg(array(
            'orderby' => $column,
            'order' => $new_order
        ));
    }

    /**
     * Price Sync Test Page
     */
    public function render_sync_test() {
        $test_result = null;
        $sheets_sync_result = null;

        // Handle test button click
        if (isset($_POST['test_sync']) && check_admin_referer('waas_sync_test')) {
            $test_result = $this->run_sync_test();
        }

        // Handle Google Sheets sync test
        if (isset($_POST['test_sheets_sync']) && check_admin_referer('waas_sync_test')) {
            $sheets_sync_result = $this->test_google_sheets_sync();
        }

        ?>
        <div class="wrap">
            <h1>Price Sync Test</h1>
            <p>Test synchronizacji cen z Amazon PA-API i Google Sheets.</p>

            <div class="card" style="max-width: 600px; margin-top: 20px;">
                <h2>1. Test połączenia</h2>
                <p>Sprawdza czy webhook jest skonfigurowany i odpowiada poprawnie.</p>

                <form method="post">
                    <?php wp_nonce_field('waas_sync_test'); ?>
                    <p>
                        <input type="submit" name="test_sync" class="button button-primary" value="Run Sync Test">
                    </p>
                </form>

                <?php if ($test_result): ?>
                <div style="margin-top: 20px; padding: 15px; background: <?php echo $test_result['success'] ? '#e8f5e9' : '#ffebee'; ?>; border-radius: 5px;">
                    <h3 style="margin-top: 0;"><?php echo $test_result['success'] ? 'Test Passed' : 'Test Failed'; ?></h3>
                    <pre style="background: white; padding: 10px; overflow-x: auto; font-size: 12px;"><?php echo esc_html($test_result['message']); ?></pre>
                </div>
                <?php endif; ?>
            </div>

            <div class="card" style="max-width: 600px; margin-top: 20px;">
                <h2>2. Test wysłania danych do Google Sheets</h2>
                <p>Wysyła testowy update do Google Sheets. Po kliknięciu sprawdź arkusz - w kolumnie "Last Price Update" powinien pojawić się aktualny timestamp.</p>

                <form method="post">
                    <?php wp_nonce_field('waas_sync_test'); ?>
                    <p>
                        <input type="submit" name="test_sheets_sync" class="button button-secondary" value="Send Test Update to Google Sheets">
                    </p>
                </form>

                <?php if ($sheets_sync_result): ?>
                <div style="margin-top: 20px; padding: 15px; background: <?php echo $sheets_sync_result['success'] ? '#e8f5e9' : '#ffebee'; ?>; border-radius: 5px;">
                    <h3 style="margin-top: 0;"><?php echo $sheets_sync_result['success'] ? '✓ Wysłano!' : '✗ Błąd' ; ?></h3>
                    <pre style="background: white; padding: 10px; overflow-x: auto; font-size: 12px;"><?php echo esc_html($sheets_sync_result['message']); ?></pre>
                    <?php if ($sheets_sync_result['success']): ?>
                    <p style="margin-bottom: 0; color: #2e7d32;">
                        <strong>Teraz sprawdź arkusz Google Sheets!</strong><br>
                        W wierszu z ASIN "<?php echo esc_html($sheets_sync_result['asin'] ?? 'TEST123'); ?>" powinna być aktualizacja w kolumnie "Last Price Update".
                    </p>
                    <?php endif; ?>
                </div>
                <?php endif; ?>
            </div>

            <div class="card" style="max-width: 600px; margin-top: 20px;">
                <h2>Jak działa synchronizacja cen?</h2>
                <ol>
                    <li><strong>Przy wizycie na stronie produktu</strong> - jeśli dzisiaj jeszcze nie było aktualizacji, cena jest pobierana z Amazon PA-API</li>
                    <li><strong>Raz na dobę</strong> - cena jest aktualizowana tylko raz dziennie (oszczędność API calls)</li>
                    <li><strong>Google Sheets sync</strong> - po aktualizacji, nowa cena jest wysyłana do Google Sheets (kolumny: Price, PriceCurrency, PriceFormatted, PriceText, Last Price Update)</li>
                </ol>

                <h3>Wymagane ustawienia:</h3>
                <ul>
                    <li><a href="<?php echo admin_url('admin.php?page=waas-pm-settings'); ?>">Google Sheets Webhook URL</a> - URL z Google Apps Script</li>
                    <li>Amazon PA-API credentials (Access Key, Secret Key, Partner Tag)</li>
                </ul>
            </div>

        </div>
        <?php
    }

    /**
     * Run sync test
     */
    private function run_sync_test() {
        $messages = array();

        // Check webhook URL
        $webhook_url = get_option('waas_pm_sheets_webhook_url', '');
        if (empty($webhook_url)) {
            $messages[] = "WARN: Google Sheets Webhook URL not configured";
            $messages[] = "      Go to Settings > WAAS to configure it";
        } else {
            $messages[] = "OK: Webhook URL configured: " . substr($webhook_url, 0, 50) . "...";
        }

        // Check Amazon API
        if (class_exists('WAAS_Amazon_API')) {
            $messages[] = "OK: WAAS_Amazon_API class exists";
        } else {
            $messages[] = "WARN: WAAS_Amazon_API class not found";
        }

        // Check cron job
        $next_scheduled = wp_next_scheduled('waas_pm_daily_update');
        if ($next_scheduled) {
            $messages[] = "OK: Daily cron job scheduled for: " . date('Y-m-d H:i:s', $next_scheduled);
        } else {
            $messages[] = "WARN: Daily cron job not scheduled";
        }

        // Count products
        $products_with_asin = get_posts(array(
            'post_type' => 'product',
            'posts_per_page' => -1,
            'meta_query' => array(
                array(
                    'key' => '_waas_asin',
                    'value' => '',
                    'compare' => '!='
                )
            ),
            'fields' => 'ids'
        ));
        $messages[] = "INFO: Products with ASIN: " . count($products_with_asin);

        // Test webhook (if configured)
        if (!empty($webhook_url)) {
            // Use GET request for connectivity test
            // (POST has issues with Google Apps Script redirects)
            $response = wp_remote_get($webhook_url, array(
                'timeout' => 30,
                'sslverify' => true
            ));

            if (is_wp_error($response)) {
                $messages[] = "FAIL: Webhook test failed: " . $response->get_error_message();
            } else {
                $code = wp_remote_retrieve_response_code($response);
                $body = wp_remote_retrieve_body($response);
                if ($code === 200) {
                    // Check if response is valid JSON with success status
                    $json = json_decode($body, true);
                    if ($json && isset($json['success']) && $json['success'] === true) {
                        $messages[] = "OK: Webhook is online and responding";
                        $messages[] = "    Status: " . ($json['status'] ?? 'active');
                        $messages[] = "    Message: " . ($json['message'] ?? '');
                    } else {
                        $messages[] = "OK: Webhook returned HTTP 200";
                        $messages[] = "    Response: " . substr($body, 0, 100);
                    }
                } else {
                    $messages[] = "FAIL: Webhook returned HTTP " . $code;
                    $messages[] = "    Response: " . substr($body, 0, 200);

                    // Provide helpful troubleshooting tips
                    if ($code === 400) {
                        $messages[] = "";
                        $messages[] = "TROUBLESHOOTING HTTP 400:";

                        // Check for specific error about doGet
                        if (strpos($body, 'doGet') !== false) {
                            $messages[] = "ERROR: 'Script function not found: doGet'";
                            $messages[] = "";
                            $messages[] = "Das Google Apps Script muss neu deployed werden:";
                            $messages[] = "1. Öffnen Sie Google Apps Script";
                            $messages[] = "2. Kopieren Sie die neueste Version von ProductManager-PRICE-WEBHOOK.gs";
                            $messages[] = "   (enthält jetzt doGet UND doPost Funktionen)";
                            $messages[] = "3. Gehen Sie zu Deploy > Manage deployments";
                            $messages[] = "4. Klicken Sie auf 'New deployment' (NEUES Deployment!)";
                            $messages[] = "5. 'Execute as': Me, 'Who has access': Anyone";
                            $messages[] = "6. Kopieren Sie die NEUE URL und aktualisieren Sie sie hier in den Einstellungen";
                        } else {
                            $messages[] = "1. Stellen Sie sicher, dass das Google Apps Script als Web App deployed ist";
                            $messages[] = "2. In Google Apps Script: Deploy > New deployment > Web app";
                            $messages[] = "3. 'Execute as': Me (Ihre E-Mail)";
                            $messages[] = "4. 'Who has access': Anyone";
                            $messages[] = "5. Kopieren Sie die neue URL und aktualisieren Sie sie in den Einstellungen";
                        }
                    } elseif ($code === 401 || $code === 403) {
                        $messages[] = "";
                        $messages[] = "TROUBLESHOOTING HTTP " . $code . ":";
                        $messages[] = "1. Stellen Sie sicher, dass 'Who has access' auf 'Anyone' gesetzt ist";
                        $messages[] = "2. Re-deployen Sie das Script mit korrekten Berechtigungen";
                    } elseif ($code === 404) {
                        $messages[] = "";
                        $messages[] = "TROUBLESHOOTING HTTP 404:";
                        $messages[] = "1. Die Webhook URL ist ungültig oder das Deployment existiert nicht mehr";
                        $messages[] = "2. Erstellen Sie ein neues Deployment in Google Apps Script";
                    }
                }
            }
        }

        return array(
            'success' => strpos(implode("\n", $messages), 'FAIL') === false,
            'message' => implode("\n", $messages)
        );
    }

    /**
     * Test Google Sheets sync by sending a real update
     */
    private function test_google_sheets_sync() {
        $webhook_url = get_option('waas_pm_sheets_webhook_url', '');

        if (empty($webhook_url)) {
            return array(
                'success' => false,
                'message' => "BŁĄD: Webhook URL nie jest skonfigurowany!\n\nIdź do Settings > WAAS Product Manager i ustaw Google Sheets Webhook URL.",
                'asin' => null
            );
        }

        // Find a product with ASIN to test with
        $products_with_asin = get_posts(array(
            'post_type' => 'product',
            'posts_per_page' => 1,
            'meta_query' => array(
                array(
                    'key' => '_waas_asin',
                    'value' => '',
                    'compare' => '!='
                )
            ),
            'fields' => 'ids'
        ));

        $test_asin = 'TEST_SYNC_' . date('His'); // Fallback if no products
        $test_price = 99.99;

        if (!empty($products_with_asin)) {
            $product_id = $products_with_asin[0];
            $test_asin = get_post_meta($product_id, '_waas_asin', true);
            $product = wc_get_product($product_id);
            if ($product) {
                $test_price = floatval($product->get_price());
            }
        }

        // German timezone timestamp
        $dt = new DateTime('now', new DateTimeZone('Europe/Berlin'));
        $timestamp = $dt->format('d.m.Y H:i');

        $update_data = array(
            array(
                'asin' => $test_asin,
                'price' => $test_price,
                'price_currency' => 'EUR',
                'price_formatted' => number_format($test_price, 2, ',', '.') . ' €',
                'price_text' => '',
                'last_price_update' => $timestamp
            )
        );

        $json_body = json_encode(array(
            'action' => 'update_prices',
            'updates' => $update_data
        ));

        // Send request (handle redirects manually like in class-price-updater.php)
        $response = wp_remote_post($webhook_url, array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => $json_body,
            'timeout' => 30,
            'redirection' => 0
        ));

        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'message' => "BŁĄD połączenia: " . $response->get_error_message(),
                'asin' => $test_asin
            );
        }

        $status_code = wp_remote_retrieve_response_code($response);

        // Handle redirect (302)
        if ($status_code === 302 || $status_code === 307) {
            $redirect_url = wp_remote_retrieve_header($response, 'location');
            if (!empty($redirect_url)) {
                $response = wp_remote_post($redirect_url, array(
                    'headers' => array('Content-Type' => 'application/json'),
                    'body' => $json_body,
                    'timeout' => 30,
                    'redirection' => 0
                ));

                if (is_wp_error($response)) {
                    return array(
                        'success' => false,
                        'message' => "BŁĄD po redirect: " . $response->get_error_message(),
                        'asin' => $test_asin
                    );
                }

                $status_code = wp_remote_retrieve_response_code($response);
            }
        }

        $body = wp_remote_retrieve_body($response);

        if ($status_code === 200) {
            $message = "Wysłano update do Google Sheets!\n\n";
            $message .= "ASIN: {$test_asin}\n";
            $message .= "Cena: " . number_format($test_price, 2, ',', '.') . " €\n";
            $message .= "Timestamp: {$timestamp}\n\n";
            $message .= "Odpowiedź: " . substr($body, 0, 200);

            return array(
                'success' => true,
                'message' => $message,
                'asin' => $test_asin
            );
        } else {
            return array(
                'success' => false,
                'message' => "HTTP {$status_code}\n\nOdpowiedź: " . substr($body, 0, 300),
                'asin' => $test_asin
            );
        }
    }
}
