<?php
/**
 * Plugin Name: WAAS Settings API
 * Plugin URI:  https://github.com/LUKOAI/LUKO-WAAS
 * Description: REST API for WAAS SEO/Migration automation. Works alongside WAAS Product Manager (waas/v1 namespace).
 * Version:     2.0.0
 * Author:      LUKO AI
 * License:     GPL v2+
 * Requires PHP: 7.4
 *
 * NAMESPACE: waas-settings/v1  (separate from waas/v1 to avoid conflicts)
 *
 * ENDPOINTS:
 *   GET|PUT  /option              — Read/write any wp_option
 *   GET|PUT  /divi                — Shortcut for et_divi options
 *   GET|PUT  /postmeta/{id}       — Post meta (RankMath SEO fields)
 *   POST     /bulk-replace        — Search-replace in DB with preview
 *   POST     /bulk-meta           — Mass deploy meta descriptions
 *   GET      /diagnostics         — SEO health scan
 *   POST     /flush-cache         — Clear all caches
 *   POST     /deploy-mu-plugin    — Deploy mu-plugin file
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'WAAS_SETTINGS_VERSION', '2.0.0' );

// ============================================================
// REST API REGISTRATION
// ============================================================

add_action( 'rest_api_init', function() {
    $ns = 'waas-settings/v1';

    register_rest_route( $ns, '/option', [
        [ 'methods' => 'GET',  'callback' => 'waas_set_get_option',  'permission_callback' => 'waas_set_perm', 'args' => [ 'option_name' => [ 'required' => true ] ] ],
        [ 'methods' => 'PUT',  'callback' => 'waas_set_put_option',  'permission_callback' => 'waas_set_perm' ],
    ]);

    register_rest_route( $ns, '/divi', [
        [ 'methods' => 'GET', 'callback' => 'waas_set_get_divi', 'permission_callback' => 'waas_set_perm' ],
        [ 'methods' => 'PUT', 'callback' => 'waas_set_put_divi', 'permission_callback' => 'waas_set_perm' ],
    ]);

    register_rest_route( $ns, '/postmeta/(?P<id>\d+)', [
        [ 'methods' => 'GET', 'callback' => 'waas_set_get_postmeta', 'permission_callback' => 'waas_set_perm' ],
        [ 'methods' => 'PUT', 'callback' => 'waas_set_put_postmeta', 'permission_callback' => 'waas_set_perm' ],
    ]);

    register_rest_route( $ns, '/bulk-replace', [
        'methods' => 'POST', 'callback' => 'waas_set_bulk_replace', 'permission_callback' => 'waas_set_perm',
    ]);

    register_rest_route( $ns, '/bulk-meta', [
        'methods' => 'POST', 'callback' => 'waas_set_bulk_meta', 'permission_callback' => 'waas_set_perm',
    ]);

    register_rest_route( $ns, '/diagnostics', [
        'methods' => 'GET', 'callback' => 'waas_set_diagnostics', 'permission_callback' => 'waas_set_perm',
    ]);

    register_rest_route( $ns, '/flush-cache', [
        'methods' => 'POST', 'callback' => 'waas_set_flush_cache', 'permission_callback' => 'waas_set_perm',
    ]);

    register_rest_route( $ns, '/deploy-mu-plugin', [
        'methods' => 'POST', 'callback' => 'waas_set_deploy_mu_plugin', 'permission_callback' => 'waas_set_perm',
    ]);
});

// Register RankMath meta for REST API access
add_action( 'init', function() {
    foreach ( [ 'post', 'page', 'product' ] as $pt ) {
        foreach ( [ 'rank_math_title', 'rank_math_description', 'rank_math_focus_keyword', 'rank_math_robots' ] as $key ) {
            register_post_meta( $pt, $key, [
                'show_in_rest'  => true,
                'single'        => true,
                'type'          => 'string',
                'auth_callback' => function() { return current_user_can( 'manage_options' ); },
            ]);
        }
    }
});


// ============================================================
// PERMISSION
// ============================================================

function waas_set_perm() {
    return current_user_can( 'manage_options' );
}


// ============================================================
// 1. OPTION READ/WRITE
// ============================================================

function waas_set_get_option( $request ) {
    $name  = sanitize_text_field( $request->get_param( 'option_name' ) );
    return rest_ensure_response( [ 'option_name' => $name, 'value' => get_option( $name, null ) ] );
}

function waas_set_put_option( $request ) {
    $body  = $request->get_json_params();
    $name  = sanitize_text_field( $body['option_name'] ?? '' );
    $value = $body['option_value'] ?? null;

    if ( ! $name || $value === null ) {
        return new WP_Error( 'missing', 'option_name and option_value required', [ 'status' => 400 ] );
    }

    // Smart merge: arrays are merged, not overwritten
    $existing = get_option( $name );
    if ( is_array( $existing ) && is_array( $value ) ) {
        $value = array_merge( $existing, $value );
    }

    update_option( $name, $value );
    return rest_ensure_response( [ 'success' => true, 'option_name' => $name, 'value' => get_option( $name ) ] );
}


// ============================================================
// 2. DIVI SHORTCUT
// ============================================================

function waas_set_get_divi() {
    return rest_ensure_response( [ 'value' => get_option( 'et_divi', [] ) ] );
}

function waas_set_put_divi( $request ) {
    $body    = $request->get_json_params();
    $current = get_option( 'et_divi', [] );
    if ( is_array( $current ) && is_array( $body ) ) $current = array_merge( $current, $body );
    update_option( 'et_divi', $current );
    return rest_ensure_response( [ 'success' => true ] );
}


// ============================================================
// 3. POST META (RankMath)
// ============================================================

function waas_set_get_postmeta( $request ) {
    $id = (int) $request['id'];
    if ( ! get_post( $id ) ) return new WP_Error( 'not_found', 'Post not found', [ 'status' => 404 ] );

    return rest_ensure_response([
        'post_id'                   => $id,
        'rank_math_title'           => get_post_meta( $id, 'rank_math_title', true ),
        'rank_math_description'     => get_post_meta( $id, 'rank_math_description', true ),
        'rank_math_focus_keyword'   => get_post_meta( $id, 'rank_math_focus_keyword', true ),
        'rank_math_robots'          => get_post_meta( $id, 'rank_math_robots', true ),
    ]);
}

function waas_set_put_postmeta( $request ) {
    $id = (int) $request['id'];
    if ( ! get_post( $id ) ) return new WP_Error( 'not_found', 'Post not found', [ 'status' => 404 ] );

    $body    = $request->get_json_params();
    $fields  = [ 'rank_math_title', 'rank_math_description', 'rank_math_focus_keyword', 'rank_math_robots' ];
    $updated = [];

    foreach ( $fields as $key ) {
        if ( isset( $body[ $key ] ) ) {
            update_post_meta( $id, $key, sanitize_text_field( $body[ $key ] ) );
            $updated[] = $key;
        }
    }

    return rest_ensure_response( [ 'success' => true, 'post_id' => $id, 'updated' => $updated ] );
}


// ============================================================
// 4. BULK REPLACE
// ============================================================

function waas_set_bulk_replace( $request ) {
    global $wpdb;
    $body    = $request->get_json_params();
    $old     = $body['old'] ?? '';
    $new     = $body['new'] ?? '';
    $targets = $body['targets'] ?? [ 'posts_content' ];
    $preview = $body['preview'] ?? true;

    if ( ! $old ) return new WP_Error( 'missing', '"old" string required', [ 'status' => 400 ] );

    $results = [];
    $target_map = [
        'posts_content' => [ $wpdb->posts, 'post_content' ],
        'posts_excerpt' => [ $wpdb->posts, 'post_excerpt' ],
        'postmeta'      => [ $wpdb->postmeta, 'meta_value' ],
        'options'        => [ $wpdb->options, 'option_value' ],
    ];

    foreach ( $targets as $target ) {
        if ( ! isset( $target_map[ $target ] ) ) continue;
        list( $table, $col ) = $target_map[ $target ];

        $count = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM `{$table}` WHERE `{$col}` LIKE %s",
            '%' . $wpdb->esc_like( $old ) . '%'
        ));

        if ( ! $preview && $count > 0 ) {
            $wpdb->query( $wpdb->prepare(
                "UPDATE `{$table}` SET `{$col}` = REPLACE(`{$col}`, %s, %s) WHERE `{$col}` LIKE %s",
                $old, $new, '%' . $wpdb->esc_like( $old ) . '%'
            ));
        }

        $results[ $target ] = [ 'matches' => $count, 'replaced' => $preview ? 0 : $count ];
    }

    return rest_ensure_response( [ 'preview' => $preview, 'results' => $results ] );
}


// ============================================================
// 5. BULK META
// ============================================================

function waas_set_bulk_meta( $request ) {
    $body    = $request->get_json_params();
    $items   = $body['items'] ?? [];
    $preview = $body['preview'] ?? true;

    $results = [ 'updated' => 0, 'skipped' => 0, 'failed' => 0 ];

    foreach ( $items as $item ) {
        $post_id = $item['post_id'] ?? 0;
        if ( ! $post_id || ! get_post( $post_id ) ) {
            $results['failed']++;
            continue;
        }

        $existing = get_post_meta( $post_id, 'rank_math_description', true );
        if ( ! empty( $existing ) && strlen( $existing ) > 30 && empty( $item['force'] ) ) {
            $results['skipped']++;
            continue;
        }

        if ( ! $preview ) {
            if ( ! empty( $item['description'] ) ) {
                update_post_meta( $post_id, 'rank_math_description', sanitize_text_field( $item['description'] ) );
            }
            if ( ! empty( $item['focus_keyword'] ) ) {
                update_post_meta( $post_id, 'rank_math_focus_keyword', sanitize_text_field( $item['focus_keyword'] ) );
            }
            if ( ! empty( $item['title'] ) ) {
                update_post_meta( $post_id, 'rank_math_title', sanitize_text_field( $item['title'] ) );
            }
        }

        $results['updated']++;
    }

    return rest_ensure_response( [ 'preview' => $preview, 'results' => $results ] );
}


// ============================================================
// 6. DIAGNOSTICS
// ============================================================

function waas_set_diagnostics() {
    $checks = [];

    // WordPress version
    $checks['wordpress_version'] = get_bloginfo( 'version' );

    // PHP version
    $checks['php_version'] = phpversion();

    // Active theme
    $theme = wp_get_theme();
    $checks['theme'] = $theme->get( 'Name' ) . ' ' . $theme->get( 'Version' );

    // Rank Math
    $checks['rank_math_active'] = is_plugin_active( 'seo-by-rank-math/rank-math.php' );

    // WAAS Product Manager
    $checks['waas_pm_active'] = is_plugin_active( 'waas-product-manager/waas-product-manager.php' );
    $checks['waas_pm_version'] = defined( 'WAAS_PM_VERSION' ) ? WAAS_PM_VERSION : 'unknown';

    // WooCommerce
    $checks['woocommerce_active'] = is_plugin_active( 'woocommerce/woocommerce.php' );

    // Partner tag — check both formats
    $partner_tag = get_option( 'waas_pm_amazon_partner_tag', '' );
    if ( empty( $partner_tag ) ) {
        $pm_settings = get_option( 'waas_pm_settings', [] );
        $partner_tag = is_array( $pm_settings ) ? ( $pm_settings['amazon_partner_tag'] ?? '' ) : '';
    }
    $checks['partner_tag'] = $partner_tag;

    // Sitemap
    $sitemap_url = home_url( '/sitemap_index.xml' );
    $sitemap_check = wp_remote_head( $sitemap_url, [ 'timeout' => 5 ] );
    $checks['sitemap_accessible'] = ! is_wp_error( $sitemap_check ) && wp_remote_retrieve_response_code( $sitemap_check ) === 200;

    // Posts & products count
    $checks['post_count'] = wp_count_posts( 'post' )->publish;
    $checks['page_count'] = wp_count_posts( 'page' )->publish;
    $checks['product_count'] = post_type_exists( 'product' ) ? wp_count_posts( 'product' )->publish : 0;

    // Meta coverage (sample 50 products)
    $meta_args = [ 'post_type' => 'product', 'posts_per_page' => 50, 'post_status' => 'publish', 'fields' => 'ids' ];
    $product_ids = get_posts( $meta_args );
    $with_meta = 0;
    foreach ( $product_ids as $pid ) {
        $desc = get_post_meta( $pid, 'rank_math_description', true );
        if ( ! empty( $desc ) && strlen( $desc ) > 20 ) $with_meta++;
    }
    $checks['products_with_meta'] = $with_meta;
    $checks['products_checked'] = count( $product_ids );
    $checks['meta_coverage_pct'] = count( $product_ids ) > 0 ? round( ( $with_meta / count( $product_ids ) ) * 100 ) : 100;

    // SSL
    $checks['ssl'] = is_ssl();

    // REST API
    $checks['rest_url'] = get_rest_url();

    // Plugin version
    $checks['waas_settings_version'] = WAAS_SETTINGS_VERSION;

    return rest_ensure_response( $checks );
}


// ============================================================
// 7. FLUSH CACHE
// ============================================================

function waas_set_flush_cache() {
    // WordPress object cache
    wp_cache_flush();

    // WP Rocket
    if ( function_exists( 'rocket_clean_domain' ) ) {
        rocket_clean_domain();
    }

    // LiteSpeed
    if ( class_exists( 'LiteSpeed_Cache_API' ) ) {
        LiteSpeed_Cache_API::purge_all();
    }

    // WP Super Cache
    if ( function_exists( 'wp_cache_clear_cache' ) ) {
        wp_cache_clear_cache();
    }

    // Divi cache
    if ( function_exists( 'et_core_clear_cache' ) ) {
        et_core_clear_cache();
    }

    return rest_ensure_response( [ 'success' => true, 'message' => 'All caches flushed' ] );
}


// ============================================================
// 8. DEPLOY MU-PLUGIN
// ============================================================

function waas_set_deploy_mu_plugin( $request ) {
    $body     = $request->get_json_params();
    $filename = sanitize_file_name( $body['filename'] ?? 'custom-plugin.php' );
    $content  = $body['content'] ?? '';

    if ( empty( $content ) ) {
        return new WP_Error( 'missing', 'content is required', [ 'status' => 400 ] );
    }

    // Ensure mu-plugins directory exists
    $mu_dir = WPMU_PLUGIN_DIR;
    if ( ! is_dir( $mu_dir ) ) {
        wp_mkdir_p( $mu_dir );
    }

    $filepath = $mu_dir . '/' . $filename;
    $written  = file_put_contents( $filepath, $content );

    if ( $written === false ) {
        return new WP_Error( 'write_failed', 'Could not write mu-plugin file', [ 'status' => 500 ] );
    }

    return rest_ensure_response( [
        'success'  => true,
        'file'     => $filepath,
        'size'     => $written,
        'filename' => $filename,
    ]);
}
