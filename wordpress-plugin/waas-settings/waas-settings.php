<?php
/**
 * Plugin Name: WAAS Settings
 * Plugin URI: https://github.com/LUKOAI/LUKO-WAAS
 * Description: WAAS System Settings REST API — site configuration, cleanup, branding, search engine verification
 * Version: 2.0.0
 * Author: LUKO AI
 * Author URI: https://github.com/LUKOAI
 * License: GPL v2 or later
 * Text Domain: waas-settings
 *
 * Provides REST API endpoints under waas-settings/v1 namespace:
 * - GET/PUT /option — Read/write WordPress options
 * - POST /divi — Divi theme operations
 * - POST /postmeta — Post meta operations
 * - POST /bulk-replace — Bulk search & replace
 * - POST /bulk-meta — Bulk meta operations
 * - GET /diagnostics — System diagnostics
 * - POST /flush-cache — Flush all caches
 * - POST /deploy-mu-plugin — Deploy MU plugin
 * - POST /cleanup — Site cleanup (v3)
 * - PUT /branding — Update site title/tagline (v3)
 * - GET /site-info — Full site information (v3)
 * - POST /gsc-verify — Google Search Console verification (v3)
 * - POST /bing-verify — Bing Webmaster verification (v3)
 * - POST /price-sync — Trigger price sync on demand (v3 Phase F)
 *
 * @package WAAS_Settings
 */

if (!defined('ABSPATH')) {
    exit;
}

define('WAAS_SETTINGS_VERSION', '2.1.0');

// =============================================================================
// HOSTING AUTH FIX — runs BEFORE WordPress auth, fixes stripped Authorization header
// =============================================================================
add_action('plugins_loaded', 'waas_fix_authorization_header', 1);
function waas_fix_authorization_header() {
    // Many shared hosts (Hostinger, some Apache/LiteSpeed configs) strip the
    // Authorization header. .htaccess rules convert it to REDIRECT_HTTP_AUTHORIZATION.
    // This code restores it so WordPress Application Passwords work.
    if (!isset($_SERVER['PHP_AUTH_USER']) && !isset($_SERVER['HTTP_AUTHORIZATION'])) {
        if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $_SERVER['HTTP_AUTHORIZATION'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        } elseif (isset($_SERVER['REDIRECT_REDIRECT_HTTP_AUTHORIZATION'])) {
            $_SERVER['HTTP_AUTHORIZATION'] = $_SERVER['REDIRECT_REDIRECT_HTTP_AUTHORIZATION'];
        }
    }
    // Parse Basic Auth from HTTP_AUTHORIZATION if PHP_AUTH_USER is missing
    if (!isset($_SERVER['PHP_AUTH_USER']) && isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $auth = $_SERVER['HTTP_AUTHORIZATION'];
        if (stripos($auth, 'Basic ') === 0) {
            $decoded = base64_decode(substr($auth, 6));
            if ($decoded && strpos($decoded, ':') !== false) {
                list($_SERVER['PHP_AUTH_USER'], $_SERVER['PHP_AUTH_PW']) = explode(':', $decoded, 2);
            }
        }
    }
}

// =============================================================================
// ACTIVATION HOOK — fix .htaccess for Authorization header passthrough
// =============================================================================
register_activation_hook(__FILE__, 'waas_settings_activate');
function waas_settings_activate() {
    waas_fix_htaccess();
    // Ensure Application Passwords are enabled
    if (!defined('WP_APPLICATION_PASSWORDS')) {
        // Try to add to wp-config.php
        waas_ensure_app_passwords_enabled();
    }
}

function waas_fix_htaccess() {
    $htaccess_file = ABSPATH . '.htaccess';
    $marker_start = '# BEGIN WAAS Auth Fix';
    $marker_end = '# END WAAS Auth Fix';
    $rules = <<<HTACCESS

# BEGIN WAAS Auth Fix
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteCond %{HTTP:Authorization} ^(.*)
RewriteRule .* - [E=HTTP_AUTHORIZATION:%1]
</IfModule>
<IfModule mod_setenvif.c>
SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=\$1
</IfModule>
# END WAAS Auth Fix
HTACCESS;

    if (!file_exists($htaccess_file)) {
        @file_put_contents($htaccess_file, $rules . "\n");
        return;
    }

    $content = file_get_contents($htaccess_file);
    if (strpos($content, $marker_start) !== false) {
        return; // Already fixed
    }

    // Insert before WordPress rules
    $wp_marker = '# BEGIN WordPress';
    if (strpos($content, $wp_marker) !== false) {
        $content = str_replace($wp_marker, $rules . "\n\n" . $wp_marker, $content);
    } else {
        $content = $rules . "\n\n" . $content;
    }
    @file_put_contents($htaccess_file, $content);
}

function waas_ensure_app_passwords_enabled() {
    $config_file = ABSPATH . 'wp-config.php';
    if (!file_exists($config_file) || !is_writable($config_file)) return;
    
    $content = file_get_contents($config_file);
    if (strpos($content, 'WP_APPLICATION_PASSWORDS') !== false) return;
    
    $content = str_replace(
        "/* That's all, stop editing!",
        "define( 'WP_APPLICATION_PASSWORDS', true );\n\n/* That's all, stop editing!",
        $content
    );
    @file_put_contents($config_file, $content);
}

class WAAS_Settings_API {

    protected static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('rest_api_init', array($this, 'register_routes'));
        add_action('wp_head', array($this, 'output_verification_tags'));

        // Add admin menu page so plugin is visible in WP admin
        add_action('admin_menu', array($this, 'add_admin_menu'));
        
        // Ensure .htaccess fix is present (self-healing)
        if (is_admin() && !wp_doing_ajax()) {
            add_action('admin_init', function() {
                // Check once per day
                $last_check = get_option('waas_htaccess_check', 0);
                if (time() - $last_check > 86400) {
                    waas_fix_htaccess();
                    update_option('waas_htaccess_check', time());
                }
            });
        }
    }

    /**
     * Add admin menu page for visibility
     */
    public function add_admin_menu() {
        add_options_page(
            'WAAS Settings',
            'WAAS Settings',
            'manage_options',
            'waas-settings',
            array($this, 'render_admin_page')
        );
    }

    /**
     * Render admin settings page
     */
    public function render_admin_page() {
        $gsc = get_option('waas_gsc_verification', '');
        $bing = get_option('waas_bing_verification', '');
        ?>
        <div class="wrap">
            <h1>WAAS Settings</h1>
            <p>This plugin provides REST API endpoints for the WAAS automation system.</p>
            <h2>API Namespace</h2>
            <code>waas-settings/v1</code>
            <h2>Verification Tags</h2>
            <table class="form-table">
                <tr>
                    <th>Google Search Console</th>
                    <td><?php echo $gsc ? '<code>' . esc_html($gsc) . '</code>' : '<em>Not configured</em>'; ?></td>
                </tr>
                <tr>
                    <th>Bing Webmaster</th>
                    <td><?php echo $bing ? '<code>' . esc_html($bing) . '</code>' : '<em>Not configured</em>'; ?></td>
                </tr>
            </table>
            <h2>Available Endpoints</h2>
            <ul>
                <li><code>GET/PUT /waas-settings/v1/option</code> — Read/write options</li>
                <li><code>POST /waas-settings/v1/divi</code> — Divi operations</li>
                <li><code>POST /waas-settings/v1/postmeta</code> — Post meta operations</li>
                <li><code>POST /waas-settings/v1/bulk-replace</code> — Bulk search &amp; replace</li>
                <li><code>POST /waas-settings/v1/bulk-meta</code> — Bulk meta operations</li>
                <li><code>GET /waas-settings/v1/diagnostics</code> — System diagnostics</li>
                <li><code>POST /waas-settings/v1/flush-cache</code> — Flush caches</li>
                <li><code>POST /waas-settings/v1/deploy-mu-plugin</code> — Deploy MU plugin</li>
                <li><code>POST /waas-settings/v1/cleanup</code> — Site cleanup</li>
                <li><code>PUT /waas-settings/v1/branding</code> — Update branding</li>
                <li><code>GET /waas-settings/v1/site-info</code> — Full site info</li>
                <li><code>POST /waas-settings/v1/gsc-verify</code> — GSC verification</li>
                <li><code>POST /waas-settings/v1/bing-verify</code> — Bing verification</li>
                <li><code>POST /waas-settings/v1/price-sync</code> — Trigger price sync</li>
            </ul>
            <p><strong>Version:</strong> <?php echo WAAS_SETTINGS_VERSION; ?></p>
        </div>
        <?php
    }

    /**
     * Output verification meta tags in <head>
     */
    public function output_verification_tags() {
        $gsc = get_option('waas_gsc_verification', '');
        if ($gsc) {
            echo '<meta name="google-site-verification" content="' . esc_attr($gsc) . '" />' . "\n";
        }
        $bing = get_option('waas_bing_verification', '');
        if ($bing) {
            echo '<meta name="msvalidate.01" content="' . esc_attr($bing) . '" />' . "\n";
        }
    }

    /**
     * Register all REST API routes
     */
    public function register_routes() {
        $ns = 'waas-settings/v1';

        // =====================================================================
        // EXISTING ENDPOINTS (v1)
        // =====================================================================

        // GET/PUT /option — Read/write WordPress options
        register_rest_route($ns, '/option', array(
            array(
                'methods' => 'GET',
                'callback' => array($this, 'get_option_value'),
                'permission_callback' => array($this, 'check_admin_permission'),
                'args' => array(
                    'name' => array('required' => true, 'type' => 'string'),
                ),
            ),
            array(
                'methods' => 'PUT',
                'callback' => array($this, 'set_option_value'),
                'permission_callback' => array($this, 'check_admin_permission'),
                'args' => array(
                    'name' => array('required' => true, 'type' => 'string'),
                    'value' => array('required' => true),
                ),
            ),
        ));

        // POST /divi — Divi theme operations
        register_rest_route($ns, '/divi', array(
            'methods' => 'POST',
            'callback' => array($this, 'divi_operations'),
            'permission_callback' => array($this, 'check_admin_permission'),
        ));

        // POST /postmeta — Post meta operations
        register_rest_route($ns, '/postmeta', array(
            'methods' => 'POST',
            'callback' => array($this, 'postmeta_operations'),
            'permission_callback' => array($this, 'check_admin_permission'),
        ));

        // POST /bulk-replace — Bulk search & replace in content
        register_rest_route($ns, '/bulk-replace', array(
            'methods' => 'POST',
            'callback' => array($this, 'bulk_replace'),
            'permission_callback' => array($this, 'check_admin_permission'),
        ));

        // POST /bulk-meta — Bulk meta operations
        register_rest_route($ns, '/bulk-meta', array(
            'methods' => 'POST',
            'callback' => array($this, 'bulk_meta'),
            'permission_callback' => array($this, 'check_admin_permission'),
        ));

        // GET /diagnostics — System diagnostics
        register_rest_route($ns, '/diagnostics', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_diagnostics'),
            'permission_callback' => array($this, 'check_admin_permission'),
        ));

        // POST /flush-cache — Flush all caches
        register_rest_route($ns, '/flush-cache', array(
            'methods' => 'POST',
            'callback' => array($this, 'flush_cache'),
            'permission_callback' => array($this, 'check_admin_permission'),
        ));

        // POST /deploy-mu-plugin — Deploy MU plugin
        register_rest_route($ns, '/deploy-mu-plugin', array(
            'methods' => 'POST',
            'callback' => array($this, 'deploy_mu_plugin'),
            'permission_callback' => array($this, 'check_admin_permission'),
        ));

        // =====================================================================
        // NEW ENDPOINTS (v3 — Phase D+E)
        // =====================================================================

        // POST /cleanup — Site cleanup after cloning
        register_rest_route($ns, '/cleanup', array(
            'methods' => 'POST',
            'callback' => array($this, 'cleanup_site'),
            'permission_callback' => array($this, 'check_admin_permission'),
            'args' => array(
                'targets' => array(
                    'type' => 'array',
                    'default' => array('products', 'posts', 'waas_products', 'taxonomies'),
                    'description' => 'What to clean: products, posts, waas_products, taxonomies, media',
                ),
                'dry_run' => array(
                    'type' => 'boolean',
                    'default' => false,
                    'description' => 'If true, only count without deleting',
                ),
            ),
        ));

        // PUT /branding — Update site title, tagline
        register_rest_route($ns, '/branding', array(
            'methods' => 'PUT',
            'callback' => array($this, 'update_branding'),
            'permission_callback' => array($this, 'check_admin_permission'),
            'args' => array(
                'site_title' => array('type' => 'string'),
                'tagline' => array('type' => 'string'),
                'blog_name' => array('type' => 'string'),
            ),
        ));

        // GET /site-info — Full site information for launch report
        register_rest_route($ns, '/site-info', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_site_info'),
            'permission_callback' => array($this, 'check_admin_permission'),
        ));

        // POST /gsc-verify — Google Search Console verification tag
        register_rest_route($ns, '/gsc-verify', array(
            'methods' => 'POST',
            'callback' => array($this, 'gsc_verify'),
            'permission_callback' => array($this, 'check_admin_permission'),
            'args' => array(
                'verification_code' => array('required' => true, 'type' => 'string'),
            ),
        ));

        // POST /bing-verify — Bing Webmaster verification tag
        register_rest_route($ns, '/bing-verify', array(
            'methods' => 'POST',
            'callback' => array($this, 'bing_verify'),
            'permission_callback' => array($this, 'check_admin_permission'),
            'args' => array(
                'verification_code' => array('required' => true, 'type' => 'string'),
            ),
        ));

        // POST /price-sync — Trigger price sync on demand (v3 Phase F)
        register_rest_route($ns, '/price-sync', array(
            'methods' => 'POST',
            'callback' => array($this, 'trigger_price_sync'),
            'permission_callback' => array($this, 'check_admin_permission'),
        ));

        // =====================================================================
        // AUTH SETUP ENDPOINT (v2.1 — auto-generates Application Password)
        // =====================================================================
        
        // POST /auth-setup — Create Application Password + fix .htaccess
        // Works with Cookie auth (wp-admin login) even when Basic Auth is broken
        register_rest_route($ns, '/auth-setup', array(
            'methods' => 'POST',
            'callback' => array($this, 'auth_setup'),
            'permission_callback' => array($this, 'check_admin_permission'),
            'args' => array(
                'app_name' => array(
                    'type' => 'string',
                    'default' => 'WAAS',
                ),
            ),
        ));

        // GET /auth-test — Quick auth verification (returns user info if authenticated)
        register_rest_route($ns, '/auth-test', array(
            'methods' => 'GET',
            'callback' => array($this, 'auth_test'),
            'permission_callback' => array($this, 'check_admin_permission'),
        ));
    }

    // =========================================================================
    // EXISTING ENDPOINT CALLBACKS (v1)
    // =========================================================================

    public function get_option_value($request) {
        $name = sanitize_text_field($request->get_param('name'));
        $value = get_option($name, null);
        return new WP_REST_Response(array(
            'success' => true,
            'name' => $name,
            'value' => $value,
        ), 200);
    }

    public function set_option_value($request) {
        $name = sanitize_text_field($request->get_param('name'));
        $value = $request->get_param('value');
        $updated = update_option($name, $value);
        return new WP_REST_Response(array(
            'success' => true,
            'name' => $name,
            'updated' => $updated,
        ), 200);
    }

    public function divi_operations($request) {
        $action = sanitize_text_field($request->get_param('action'));
        $data = $request->get_json_params();

        switch ($action) {
            case 'get_layouts':
                $layouts = get_posts(array(
                    'post_type' => 'et_pb_layout',
                    'posts_per_page' => -1,
                    'post_status' => 'publish',
                ));
                return new WP_REST_Response(array('success' => true, 'layouts' => $layouts), 200);

            case 'import_layout':
                return new WP_REST_Response(array('success' => true, 'message' => 'Layout import handled'), 200);

            default:
                return new WP_REST_Response(array('success' => true, 'action' => $action), 200);
        }
    }

    public function postmeta_operations($request) {
        $action = sanitize_text_field($request->get_param('action'));
        $post_id = absint($request->get_param('post_id'));
        $meta_key = sanitize_text_field($request->get_param('meta_key'));
        $meta_value = $request->get_param('meta_value');

        if ($action === 'get') {
            $value = get_post_meta($post_id, $meta_key, true);
            return new WP_REST_Response(array('success' => true, 'value' => $value), 200);
        }

        if ($action === 'set' || $action === 'update') {
            update_post_meta($post_id, $meta_key, $meta_value);
            return new WP_REST_Response(array('success' => true), 200);
        }

        if ($action === 'delete') {
            delete_post_meta($post_id, $meta_key);
            return new WP_REST_Response(array('success' => true), 200);
        }

        return new WP_Error('invalid_action', 'Invalid action', array('status' => 400));
    }

    public function bulk_replace($request) {
        global $wpdb;
        $search = $request->get_param('search');
        $replace = $request->get_param('replace');
        $post_types = $request->get_param('post_types') ?: array('post', 'page');
        $dry_run = $request->get_param('dry_run') ?: false;

        if (empty($search)) {
            return new WP_Error('missing_search', 'Search string is required', array('status' => 400));
        }

        $placeholders = implode(',', array_fill(0, count($post_types), '%s'));
        $query_args = array_merge($post_types, array('%' . $wpdb->esc_like($search) . '%'));

        $affected = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type IN ({$placeholders}) AND post_content LIKE %s",
            ...$query_args
        ));

        if (!$dry_run && !empty($replace)) {
            $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->posts} SET post_content = REPLACE(post_content, %s, %s) WHERE post_type IN ({$placeholders}) AND post_content LIKE %s",
                $search, $replace, ...$query_args
            ));
        }

        return new WP_REST_Response(array(
            'success' => true,
            'affected_posts' => (int) $affected,
            'dry_run' => $dry_run,
        ), 200);
    }

    public function bulk_meta($request) {
        $action = sanitize_text_field($request->get_param('action'));
        $post_type = sanitize_text_field($request->get_param('post_type') ?: 'post');
        $meta_key = sanitize_text_field($request->get_param('meta_key'));
        $meta_value = $request->get_param('meta_value');

        $posts = get_posts(array(
            'post_type' => $post_type,
            'posts_per_page' => -1,
            'fields' => 'ids',
        ));

        $updated = 0;
        foreach ($posts as $post_id) {
            if ($action === 'set') {
                update_post_meta($post_id, $meta_key, $meta_value);
                $updated++;
            } elseif ($action === 'delete') {
                delete_post_meta($post_id, $meta_key);
                $updated++;
            }
        }

        return new WP_REST_Response(array(
            'success' => true,
            'updated' => $updated,
            'total_posts' => count($posts),
        ), 200);
    }

    public function get_diagnostics($request) {
        global $wpdb;
        $theme = wp_get_theme();

        return new WP_REST_Response(array(
            'success' => true,
            'wp_version' => get_bloginfo('version'),
            'php_version' => phpversion(),
            'mysql_version' => $wpdb->db_version(),
            'site_url' => get_site_url(),
            'home_url' => get_home_url(),
            'theme' => $theme->get('Name') . ' ' . $theme->get('Version'),
            'active_plugins' => get_option('active_plugins', array()),
            'memory_limit' => ini_get('memory_limit'),
            'max_execution_time' => ini_get('max_execution_time'),
            'waas_settings_version' => WAAS_SETTINGS_VERSION,
        ), 200);
    }

    public function flush_cache($request) {
        $flushed = array();

        // WordPress object cache
        wp_cache_flush();
        $flushed[] = 'object_cache';

        // Transients
        global $wpdb;
        $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_%'");
        $flushed[] = 'transients';

        // Rewrite rules
        flush_rewrite_rules();
        $flushed[] = 'rewrite_rules';

        // WooCommerce transients
        if (class_exists('WooCommerce')) {
            wc_delete_product_transients();
            $flushed[] = 'woocommerce_transients';
        }

        return new WP_REST_Response(array(
            'success' => true,
            'flushed' => $flushed,
        ), 200);
    }

    public function deploy_mu_plugin($request) {
        $plugin_content = $request->get_param('content');
        $filename = sanitize_file_name($request->get_param('filename') ?: 'waas-mu-plugin.php');

        $mu_dir = WPMU_PLUGIN_DIR;
        if (!is_dir($mu_dir)) {
            wp_mkdir_p($mu_dir);
        }

        $file_path = $mu_dir . '/' . $filename;
        $result = file_put_contents($file_path, $plugin_content);

        return new WP_REST_Response(array(
            'success' => $result !== false,
            'path' => $file_path,
            'bytes' => $result,
        ), 200);
    }

    // =========================================================================
    // NEW ENDPOINT CALLBACKS (v3 — Phase D+E)
    // =========================================================================

    /**
     * POST /cleanup — Clean site after cloning
     *
     * Supports dry_run mode (count without deleting).
     * Targets: products, posts, waas_products, taxonomies, media
     */
    public function cleanup_site($request) {
        $start = microtime(true);
        $targets = $request->get_param('targets');
        $dry_run = (bool) $request->get_param('dry_run');

        if (empty($targets) || !is_array($targets)) {
            $targets = array('products', 'posts', 'waas_products', 'taxonomies');
        }

        $deleted = array();

        // --- products: WooCommerce products + variations ---
        if (in_array('products', $targets)) {
            $product_ids = get_posts(array(
                'post_type' => array('product', 'product_variation'),
                'posts_per_page' => -1,
                'fields' => 'ids',
                'post_status' => 'any',
            ));
            $deleted['products'] = count($product_ids);
            if (!$dry_run) {
                foreach ($product_ids as $id) {
                    wp_delete_post($id, true);
                }
            }
        }

        // --- posts: blog posts only (NOT pages) ---
        if (in_array('posts', $targets)) {
            $post_ids = get_posts(array(
                'post_type' => 'post',
                'posts_per_page' => -1,
                'fields' => 'ids',
                'post_status' => 'any',
            ));
            $deleted['posts'] = count($post_ids);
            if (!$dry_run) {
                foreach ($post_ids as $id) {
                    wp_delete_post($id, true);
                }
            }
        }

        // --- waas_products: legacy custom post type ---
        if (in_array('waas_products', $targets)) {
            $waas_ids = get_posts(array(
                'post_type' => 'waas_product',
                'posts_per_page' => -1,
                'fields' => 'ids',
                'post_status' => 'any',
            ));
            $deleted['waas_products'] = count($waas_ids);
            if (!$dry_run) {
                foreach ($waas_ids as $id) {
                    wp_delete_post($id, true);
                }
            }
        }

        // --- taxonomies: product_cat, product_tag, pa_*, post_tag, category ---
        if (in_array('taxonomies', $targets)) {
            $tax_deleted = array();

            // WooCommerce taxonomies
            $wc_taxonomies = array('product_cat', 'product_tag', 'product_shipping_class');
            foreach ($wc_taxonomies as $tax) {
                if (!taxonomy_exists($tax)) continue;
                $terms = get_terms(array('taxonomy' => $tax, 'hide_empty' => false, 'fields' => 'ids'));
                if (is_wp_error($terms)) continue;
                $tax_deleted[$tax] = count($terms);
                if (!$dry_run) {
                    foreach ($terms as $term_id) {
                        wp_delete_term($term_id, $tax);
                    }
                }
            }

            // WooCommerce attribute taxonomies (pa_*)
            if (function_exists('wc_get_attribute_taxonomies')) {
                $attributes = wc_get_attribute_taxonomies();
                foreach ($attributes as $attribute) {
                    $tax_name = 'pa_' . $attribute->attribute_name;
                    if (!taxonomy_exists($tax_name)) continue;
                    $terms = get_terms(array('taxonomy' => $tax_name, 'hide_empty' => false, 'fields' => 'ids'));
                    if (is_wp_error($terms)) continue;
                    $tax_deleted[$tax_name] = count($terms);
                    if (!$dry_run) {
                        foreach ($terms as $term_id) {
                            wp_delete_term($term_id, $tax_name);
                        }
                    }
                }
            }

            // WordPress taxonomies: post_tag, category (preserve Uncategorized)
            foreach (array('post_tag', 'category') as $tax) {
                $terms = get_terms(array('taxonomy' => $tax, 'hide_empty' => false));
                if (is_wp_error($terms)) continue;
                $count = 0;
                foreach ($terms as $term) {
                    // Preserve "Uncategorized" default category
                    if ($tax === 'category' && $term->slug === 'uncategorized') continue;
                    $count++;
                    if (!$dry_run) {
                        wp_delete_term($term->term_id, $tax);
                    }
                }
                if ($count > 0) {
                    $tax_deleted[$tax] = $count;
                }
            }

            $deleted['taxonomies'] = $tax_deleted;
        }

        // --- media: all attachments ---
        if (in_array('media', $targets)) {
            $media_ids = get_posts(array(
                'post_type' => 'attachment',
                'posts_per_page' => -1,
                'fields' => 'ids',
                'post_status' => 'any',
            ));
            $deleted['media'] = count($media_ids);
            if (!$dry_run) {
                foreach ($media_ids as $id) {
                    wp_delete_attachment($id, true);
                }
            }
        }

        $duration = round(microtime(true) - $start, 2);

        return new WP_REST_Response(array(
            'success' => true,
            'dry_run' => $dry_run,
            'deleted' => $deleted,
            'duration_seconds' => $duration,
        ), 200);
    }

    /**
     * PUT /branding — Update site title and tagline
     */
    public function update_branding($request) {
        $updated = array();

        $site_title = $request->get_param('site_title');
        $blog_name = $request->get_param('blog_name');
        $tagline = $request->get_param('tagline');

        // site_title and blog_name both map to blogname
        $title = $site_title ?: $blog_name;
        if ($title) {
            update_option('blogname', sanitize_text_field($title));
            $updated['blogname'] = $title;
        }

        if ($tagline !== null) {
            update_option('blogdescription', sanitize_text_field($tagline));
            $updated['blogdescription'] = $tagline;
        }

        return new WP_REST_Response(array(
            'success' => true,
            'updated' => $updated,
        ), 200);
    }

    /**
     * GET /site-info — Full site information for launch report
     */
    public function get_site_info($request) {
        global $wpdb;

        // Theme info
        $theme = wp_get_theme();
        $parent_theme = $theme->parent();
        $theme_info = array(
            'name' => $parent_theme ? $parent_theme->get('Name') : $theme->get('Name'),
            'version' => $parent_theme ? $parent_theme->get('Version') : $theme->get('Version'),
            'child' => $parent_theme ? $theme->get_stylesheet() : null,
        );

        // Active plugins
        $active_plugins = get_option('active_plugins', array());
        $plugins_info = array();
        $all_plugins = function_exists('get_plugins') ? get_plugins() : array();
        foreach ($active_plugins as $plugin_file) {
            $plugin_data = isset($all_plugins[$plugin_file]) ? $all_plugins[$plugin_file] : array();
            $plugins_info[] = array(
                'name' => $plugin_data['Name'] ?? basename($plugin_file, '.php'),
                'slug' => $plugin_file,
                'active' => true,
                'version' => $plugin_data['Version'] ?? 'unknown',
            );
        }

        // Post counts
        $counts = array(
            'products' => (int) wp_count_posts('product')->publish,
            'posts' => (int) wp_count_posts('post')->publish,
            'pages' => (int) wp_count_posts('page')->publish,
            'media' => (int) wp_count_posts('attachment')->inherit,
            'waas_products' => post_type_exists('waas_product') ? (int) (wp_count_posts('waas_product')->publish ?? 0) : 0,
        );

        // WooCommerce info
        $wc_info = array(
            'active' => class_exists('WooCommerce'),
            'currency' => class_exists('WooCommerce') ? get_woocommerce_currency() : null,
            'product_count' => $counts['products'],
            'categories' => 0,
        );
        if (taxonomy_exists('product_cat')) {
            $wc_info['categories'] = (int) wp_count_terms(array('taxonomy' => 'product_cat', 'hide_empty' => false));
        }

        // SEO info
        $rank_math_active = is_plugin_active('seo-by-rank-math/rank-math.php');
        $sitemap_url = get_home_url() . '/sitemap_index.xml';
        $seo_info = array(
            'rank_math_active' => $rank_math_active,
            'sitemap_url' => $sitemap_url,
        );

        // WAAS info
        $waas_info = array(
            'partner_tag' => get_option('waas_pm_amazon_partner_tag', ''),
            'product_manager_version' => defined('WAAS_PM_VERSION') ? WAAS_PM_VERSION : null,
            'settings_version' => WAAS_SETTINGS_VERSION,
            'patronage_active' => is_plugin_active('waas-patronage-manager/waas-patronage-manager.php'),
        );

        return new WP_REST_Response(array(
            'success' => true,
            'wp_version' => get_bloginfo('version'),
            'site_title' => get_bloginfo('name'),
            'tagline' => get_bloginfo('description'),
            'url' => get_home_url(),
            'admin_email' => get_option('admin_email'),
            'theme' => $theme_info,
            'plugins' => $plugins_info,
            'counts' => $counts,
            'woocommerce' => $wc_info,
            'seo' => $seo_info,
            'waas' => $waas_info,
        ), 200);
    }

    /**
     * POST /gsc-verify — Add Google Search Console verification meta tag
     */
    public function gsc_verify($request) {
        $code = sanitize_text_field($request->get_param('verification_code'));

        if (empty($code)) {
            return new WP_Error('missing_code', 'Verification code is required', array('status' => 400));
        }

        update_option('waas_gsc_verification', $code);

        return new WP_REST_Response(array(
            'success' => true,
            'message' => 'Google Search Console verification tag saved',
            'code' => $code,
        ), 200);
    }

    /**
     * POST /bing-verify — Add Bing Webmaster verification meta tag
     */
    public function bing_verify($request) {
        $code = sanitize_text_field($request->get_param('verification_code'));

        if (empty($code)) {
            return new WP_Error('missing_code', 'Verification code is required', array('status' => 400));
        }

        update_option('waas_bing_verification', $code);

        return new WP_REST_Response(array(
            'success' => true,
            'message' => 'Bing Webmaster verification tag saved',
            'code' => $code,
        ), 200);
    }

    // =========================================================================
    // PRICE SYNC (v3 — Phase F)
    // =========================================================================

    /**
     * POST /price-sync — Trigger daily price update on demand
     *
     * Calls WAAS_Price_Updater::run_daily_update() which returns summary.
     * Requires waas-product-manager plugin to be active.
     */
    public function trigger_price_sync($request) {
        // Check if WAAS Product Manager is active
        if (!class_exists('WAAS_Price_Updater')) {
            return new WP_Error(
                'plugin_not_active',
                'WAAS Product Manager plugin is not active or WooCommerce is not loaded',
                array('status' => 400)
            );
        }

        error_log('WAAS Settings: Price sync triggered via REST API');

        $updater = WAAS_Price_Updater::get_instance();
        $result = $updater->run_daily_update();

        return new WP_REST_Response(array(
            'success' => true,
            'updated' => $result['updated'] ?? 0,
            'failed' => $result['failed'] ?? 0,
            'skipped' => $result['skipped'] ?? 0,
            'total' => $result['total'] ?? 0,
            'source_stats' => $result['source_stats'] ?? array(),
            'duration_seconds' => $result['duration_seconds'] ?? 0,
            'price_source_config' => get_option('waas_pm_price_source', 'auto'),
        ), 200);
    }

    // =========================================================================
    // AUTH SETUP CALLBACKS (v2.1)
    // =========================================================================

    /**
     * POST /auth-setup — Create Application Password and fix hosting auth
     * Called by GAS pipeline using cookie auth (wp-admin login session)
     */
    public function auth_setup($request) {
        $app_name = sanitize_text_field($request->get_param('app_name'));
        $result = array('success' => true, 'actions' => array());

        // Step 1: Fix .htaccess
        waas_fix_htaccess();
        $result['actions'][] = 'htaccess_fixed';

        // Step 2: Ensure Application Passwords are enabled
        if (!class_exists('WP_Application_Passwords')) {
            return new WP_Error('app_passwords_unavailable',
                'Application Passwords not available in this WordPress version',
                array('status' => 500));
        }

        // Step 3: Delete existing WAAS app password (if any)
        $user = wp_get_current_user();
        $existing = WP_Application_Passwords::get_user_application_passwords($user->ID);
        foreach ($existing as $pass) {
            if ($pass['name'] === $app_name) {
                WP_Application_Passwords::delete_application_password($user->ID, $pass['uuid']);
                $result['actions'][] = 'old_password_deleted';
            }
        }

        // Step 4: Create new Application Password
        $new_pass = WP_Application_Passwords::create_new_application_password(
            $user->ID,
            array('name' => $app_name)
        );

        if (is_wp_error($new_pass)) {
            return new WP_Error('password_creation_failed',
                $new_pass->get_error_message(),
                array('status' => 500));
        }

        $result['app_password'] = $new_pass[0]; // Raw password (only shown once)
        $result['user'] = $user->user_login;
        $result['user_id'] = $user->ID;
        $result['actions'][] = 'password_created';
        $result['wp_version'] = get_bloginfo('version');
        $result['site_url'] = get_site_url();

        return new WP_REST_Response($result, 200);
    }

    /**
     * GET /auth-test — Verify authentication works
     */
    public function auth_test($request) {
        $user = wp_get_current_user();
        return new WP_REST_Response(array(
            'success' => true,
            'user' => $user->user_login,
            'user_id' => $user->ID,
            'roles' => $user->roles,
            'wp_version' => get_bloginfo('version'),
            'site_title' => get_bloginfo('name'),
            'site_url' => get_site_url(),
            'plugin_version' => WAAS_SETTINGS_VERSION,
            'htaccess_fixed' => file_exists(ABSPATH . '.htaccess') && 
                strpos(file_get_contents(ABSPATH . '.htaccess'), 'WAAS Auth Fix') !== false,
            'app_passwords_enabled' => class_exists('WP_Application_Passwords'),
        ), 200);
    }

    // =========================================================================
    // PERMISSION CHECK
    // =========================================================================

    public function check_admin_permission() {
        return current_user_can('manage_options');
    }
}

// Initialize plugin
function waas_settings_init() {
    // Load get_plugins() function if not already available
    if (!function_exists('get_plugins')) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
    }
    return WAAS_Settings_API::get_instance();
}
add_action('plugins_loaded', 'waas_settings_init');
