<?php
/**
 * LUKO Recon — read-only diagnostic for filter project (Marke / Material / Anlass / Empfänger).
 *
 * USAGE:
 *   1. Upload this file to your site root (same folder as wp-load.php), e.g. /public_html/luko-recon.php
 *   2. Log in to WordPress as an administrator.
 *   3. Visit https://YOUR-DOMAIN/luko-recon.php
 *   4. Screenshot the output and paste it back in chat.
 *   5. DELETE this file from the server when done (rm /public_html/luko-recon.php).
 *
 * This script makes ZERO changes. It only reads. Safe to run multiple times.
 */

// --- Bootstrap WordPress ---
$bootstrapped = false;
foreach ( array( __DIR__ . '/wp-load.php', dirname( __DIR__ ) . '/wp-load.php', dirname( __DIR__, 2 ) . '/wp-load.php' ) as $candidate ) {
	if ( file_exists( $candidate ) ) {
		require_once $candidate;
		$bootstrapped = true;
		break;
	}
}
if ( ! $bootstrapped ) {
	http_response_code( 500 );
	exit( 'wp-load.php not found in expected locations.' );
}

// --- AuthZ ---
if ( ! is_user_logged_in() || ! current_user_can( 'manage_options' ) ) {
	http_response_code( 403 );
	exit( 'Forbidden. Log in as an administrator first.' );
}

// --- Helpers ---
function luko_h( $title ) {
	echo '<h2 style="margin-top:2em;border-bottom:2px solid #333;padding-bottom:.3em;font-family:monospace">' . esc_html( $title ) . '</h2>';
}
function luko_kv( $label, $value ) {
	echo '<div style="margin:.3em 0"><strong>' . esc_html( $label ) . ':</strong> <code>' . esc_html( is_scalar( $value ) ? (string) $value : wp_json_encode( $value ) ) . '</code></div>';
}
function luko_pre( $data ) {
	echo '<pre style="background:#f4f4f4;padding:1em;overflow:auto;max-height:400px;font-size:12px">' . esc_html( print_r( $data, true ) ) . '</pre>';
}

// --- Output header ---
echo '<!doctype html><meta charset="utf-8"><title>LUKO Recon</title><style>body{font-family:-apple-system,sans-serif;max-width:1100px;margin:2em auto;padding:0 1em;line-height:1.5}code{background:#eef;padding:2px 6px;border-radius:3px}</style>';
echo '<h1>LUKO Recon — diagnostic snapshot</h1>';
echo '<p>Generated: <code>' . esc_html( current_time( 'mysql' ) ) . '</code> &middot; Site: <code>' . esc_html( home_url() ) . '</code></p>';

// === 1. Core versions ===
luko_h( '1. Core versions' );
global $wp_version;
luko_kv( 'WordPress', $wp_version );
luko_kv( 'PHP', PHP_VERSION );
luko_kv( 'MySQL', $GLOBALS['wpdb']->db_version() );
luko_kv( 'WooCommerce', defined( 'WC_VERSION' ) ? WC_VERSION : 'NOT ACTIVE' );
luko_kv( 'WP_DEBUG', defined( 'WP_DEBUG' ) && WP_DEBUG ? 'true' : 'false' );
luko_kv( 'WP_DEBUG_LOG', defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG ? 'true' : 'false' );

// === 2. Theme (Divi + child) ===
luko_h( '2. Theme — Divi + child theme check' );
$theme = wp_get_theme();
luko_kv( 'Active theme name', $theme->get( 'Name' ) );
luko_kv( 'Active theme version', $theme->get( 'Version' ) );
luko_kv( 'Stylesheet (child or main)', get_stylesheet() );
luko_kv( 'Template (parent)', get_template() );
luko_kv( 'Is child theme?', is_child_theme() ? 'YES' : 'NO' );
if ( is_child_theme() ) {
	luko_kv( 'Child theme dir', get_stylesheet_directory() );
	luko_kv( 'Child theme writable?', is_writable( get_stylesheet_directory() ) ? 'YES' : 'NO' );
} else {
	luko_kv( 'Parent theme dir', get_template_directory() );
}

// === 3. mu-plugins ===
luko_h( '3. mu-plugins location' );
$mu_dir = defined( 'WPMU_PLUGIN_DIR' ) ? WPMU_PLUGIN_DIR : WP_CONTENT_DIR . '/mu-plugins';
luko_kv( 'mu-plugins dir', $mu_dir );
luko_kv( 'mu-plugins exists?', is_dir( $mu_dir ) ? 'YES' : 'NO' );
luko_kv( 'mu-plugins writable?', is_writable( $mu_dir ) ? 'YES' : ( is_dir( $mu_dir ) ? 'NO' : 'N/A (dir missing)' ) );
if ( is_dir( $mu_dir ) ) {
	$mu_files = array_values( array_diff( scandir( $mu_dir ), array( '.', '..' ) ) );
	luko_kv( 'mu-plugins contents', $mu_files );
}

// === 4. Active plugins ===
luko_h( '4. Active plugins (looking for WAAS)' );
$active = get_option( 'active_plugins', array() );
$waas_found = array();
foreach ( $active as $p ) {
	if ( stripos( $p, 'waas' ) !== false ) {
		$waas_found[] = $p;
	}
}
luko_kv( 'Active plugins count', count( $active ) );
luko_kv( 'WAAS plugins active', $waas_found ?: 'NONE' );
luko_pre( $active );

// === 5. Product counts (DYNAMIC — never hardcode) ===
luko_h( '5. Product counts (dynamic)' );
if ( post_type_exists( 'product' ) ) {
	$counts = wp_count_posts( 'product' );
	luko_kv( 'WC product totals', (array) $counts );
}
if ( post_type_exists( 'waas_product' ) ) {
	$counts2 = wp_count_posts( 'waas_product' );
	luko_kv( 'waas_product totals', (array) $counts2 );
}

// === 6. Product taxonomies registered ===
luko_h( '6. Product taxonomies (existing filter targets?)' );
$product_taxes = array();
foreach ( get_object_taxonomies( 'product', 'objects' ) as $tx ) {
	$product_taxes[ $tx->name ] = array(
		'label'    => $tx->label,
		'public'   => $tx->public,
		'terms'    => wp_count_terms( array( 'taxonomy' => $tx->name, 'hide_empty' => false ) ),
	);
}
luko_pre( $product_taxes );

// === 7. Sample product meta keys (5 newest products) ===
luko_h( '7. Sample meta keys on 5 newest products' );
$sample_pt = post_type_exists( 'product' ) ? 'product' : ( post_type_exists( 'waas_product' ) ? 'waas_product' : null );
if ( $sample_pt ) {
	$sample_ids = get_posts( array(
		'post_type'      => $sample_pt,
		'posts_per_page' => 5,
		'orderby'        => 'date',
		'order'          => 'DESC',
		'fields'         => 'ids',
		'post_status'    => array( 'publish', 'draft', 'pending' ),
	) );
	luko_kv( 'Sampled post_type', $sample_pt );
	luko_kv( 'Sampled IDs', $sample_ids );
	foreach ( $sample_ids as $pid ) {
		$meta = get_post_meta( $pid );
		$keys = array_keys( $meta );
		sort( $keys );
		echo '<h3>Post #' . (int) $pid . ' — ' . esc_html( get_the_title( $pid ) ) . '</h3>';
		luko_kv( 'Meta keys', $keys );
		// First 200 chars of excerpt + content for parsing preview
		$post = get_post( $pid );
		luko_kv( 'post_excerpt (first 300c)', mb_substr( (string) $post->post_excerpt, 0, 300 ) );
		luko_kv( 'post_content (first 300c)', mb_substr( wp_strip_all_tags( (string) $post->post_content ), 0, 300 ) );
		// Categories (raw names as imported)
		$cats = wp_get_post_terms( $pid, 'product_cat', array( 'fields' => 'names' ) );
		if ( ! is_wp_error( $cats ) ) {
			luko_kv( 'product_cat names', $cats );
		}
	}
} else {
	echo '<p><em>No product post type found.</em></p>';
}

// === 8. WAAS hooks discovery ===
luko_h( '8. WAAS hook discovery (grep do_action / apply_filters in plugin files)' );
$waas_plugin_dir = WP_PLUGIN_DIR . '/waas-product-manager';
if ( is_dir( $waas_plugin_dir ) ) {
	$hits = array();
	$it = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $waas_plugin_dir ) );
	foreach ( $it as $file ) {
		if ( $file->isFile() && substr( $file->getFilename(), -4 ) === '.php' ) {
			$lines = @file( $file->getPathname() );
			if ( ! $lines ) {
				continue;
			}
			foreach ( $lines as $n => $line ) {
				if ( preg_match( '/\b(do_action|apply_filters)\s*\(/', $line ) ) {
					$hits[] = str_replace( $waas_plugin_dir, '', $file->getPathname() ) . ':' . ( $n + 1 ) . '  ' . trim( $line );
				}
			}
		}
	}
	luko_kv( 'Hook count', count( $hits ) );
	luko_pre( $hits );
} else {
	luko_kv( 'waas-product-manager dir', 'NOT FOUND at ' . $waas_plugin_dir );
}

echo '<hr><p style="margin-top:2em;color:#666"><strong>Done.</strong> Screenshot this whole page and paste into chat. Then <code>rm</code> this file from the server.</p>';
