<?php
/**
 * LUKO Apply — write the dry-run plan into WordPress.
 *
 * Modes (via ?mode=...):
 *   preview  (default) — show plan + pre-flight, make NO changes
 *   apply              — write terms + assignments (requires &confirm=YES)
 *   rollback           — delete every term created by previous apply runs
 *                        (requires &confirm=YES). Reads the audit log
 *                        stored in option `luko_apply_created_terms`.
 *
 * Required before apply:
 *   1. mu-plugins/luko-filters.php must be uploaded so that material/
 *      anlass/empfaenger/literatur are registered taxonomies.
 *   2. product_brand should already exist (WooCommerce native).
 *
 * Idempotent: re-running apply will not duplicate terms (term_exists
 * gate) and will replace each product's existing assignments in our
 * five taxonomies with the freshly computed plan. Terms newly created
 * are appended to the audit option so rollback can find them later.
 *
 * Other params:
 *   ?limit=N&offset=N    process a slice (default: all published products)
 *   ?download=csv        download the plan CSV after preview
 */

// =============================================================================
// BOOTSTRAP
// =============================================================================
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
	exit( 'wp-load.php not found.' );
}
if ( ! is_user_logged_in() || ! current_user_can( 'manage_options' ) ) {
	http_response_code( 403 );
	exit( 'Forbidden.' );
}
@set_time_limit( 1200 );
ignore_user_abort( true );

$mode    = isset( $_GET['mode'] ) ? (string) $_GET['mode'] : 'preview';
$confirm = isset( $_GET['confirm'] ) && $_GET['confirm'] === 'YES';

// =============================================================================
// DICTIONARIES — keep in sync with luko-scan.php / luko-plan.php
// =============================================================================
function la_kw_material() {
	return array(
		'Kunstleder'     => 'Kunstleder',
		'Echtleder'      => 'Leder',
		'Edelstahl'      => 'Edelstahl',
		'Sterlingsilber' => 'Silber',
		'Eichenholz'     => 'Holz',
		'Buchenholz'     => 'Holz',
		'Olivenholz'     => 'Holz',
		'Filz'           => 'Filz',
		'Leder'          => 'Leder',
		'Holz'           => 'Holz',
		'Metall'         => 'Metall',
		'Silber'         => 'Silber',
		'Vergoldet'      => 'Gold',
		'Gold'           => 'Gold',
		'Porzellan'      => 'Porzellan',
		'Keramik'        => 'Keramik',
		'Glas'           => 'Glas',
		'Baumwolle'      => 'Baumwolle',
		'Polyester'      => 'Polyester',
		'Acryl'          => 'Acryl',
		'Papier'         => 'Papier',
		'Kunststoff'     => 'Kunststoff',
		'Marmor'         => 'Marmor',
		'Stein'          => 'Stein',
		'Wolle'          => 'Wolle',
		'Messing'        => 'Messing',
		'Bronze'         => 'Bronze',
		'Zinn'           => 'Zinn',
		'Stoff'          => 'Stoff',
	);
}
function la_kw_anlass() {
	return array(
		'Erstkommunion*' => 'Erstkommunion',
		'Kommunion*'     => 'Kommunion',
		'Konfirmation*'  => 'Konfirmation',
		'Firmung*'       => 'Firmung',
		'Firmkerze'      => 'Firmung',
		'Firmkreuz'      => 'Firmung',
		'Firmgeschenk'   => 'Firmung',
		'Tauf*'          => 'Taufe',
		'Hochzeit*'      => 'Hochzeit',
		'Trauer*'        => 'Trauer',
		'Beerdigung*'    => 'Trauer',
		'Weihnacht*'     => 'Weihnachten',
		'Oster*'         => 'Ostern',
		'Geburtstag*'    => 'Geburtstag',
		'Jubiläum*'      => 'Jubiläum',
		'Muttertag*'     => 'Muttertag',
		'Vatertag*'      => 'Vatertag',
		'Valentinstag*'  => 'Valentinstag',
		'Geburt'         => 'Geburt',
	);
}
function la_kw_empfaenger() {
	return array(
		'Jugendliche*' => 'Jugendliche',
		'Erwachsene*'  => 'Erwachsene',
		'Senioren*'    => 'Senioren',
		'Mädchen*'     => 'Mädchen',
		'Jungen*'      => 'Jungen',
		'Frauen*'      => 'Frauen',
		'Männer*'      => 'Männer',
		'Damen*'       => 'Frauen',
		'Herren*'      => 'Männer',
		'Kinder*'      => 'Kinder',
		'Baby*'        => 'Baby',
		'Großeltern*'  => 'Großeltern',
		'Oma'          => 'Großeltern',
		'Opa'          => 'Großeltern',
		'Mutter*'      => 'Mutter',
		'Vater*'       => 'Vater',
		'Eltern*'      => 'Eltern',
	);
}
function la_kw_literatur() {
	return array(
		'Erstkommunionbibel' => 'Bibel',
		'Familienbibel'      => 'Bibel',
		'Jugendbibel'        => 'Bibel',
		'Kinderbibel'        => 'Bibel',
		'Bibel*'             => 'Bibel',
		'Jugendkatechismus'  => 'Katechismus',
		'Katechismus*'       => 'Katechismus',
		'YOUCAT*'            => 'YOUCAT',
		'Youcat*'            => 'YOUCAT',
		'Gotteslob*'         => 'Gotteslob',
		'Kantorenbuch'       => 'Gotteslob',
		'Chorbuch'           => 'Gotteslob',
		'Gesangbuch*'        => 'Gesangbuch',
		'Liederbuch*'        => 'Gesangbuch',
		'Gebetbuch*'         => 'Gebetbuch',
		'Stundenbuch*'       => 'Stundenbuch',
		'Brevier*'           => 'Stundenbuch',
		'Andachtsbuch*'      => 'Andachtsbuch',
		'Tagebuch'           => 'Andachtsbuch',
		'Theologie*'         => 'Theologie',
		'Apologetik*'        => 'Theologie',
		'Christentum'        => 'Theologie',
		'christlich*'        => 'Theologie',
		'Glaube'             => 'Theologie',
		'Glauben'            => 'Theologie',
		'Glaubens*'          => 'Theologie',
		'Einführung'         => 'Theologie',
		'Pilger*'            => 'Wallfahrtsführer',
		'Wallfahrt*'         => 'Wallfahrtsführer',
		'Jakobsweg*'         => 'Wallfahrtsführer',
		'Heilige*'           => 'Heiligenleben',
		'Heiliger'           => 'Heiligenleben',
		'Heiligenleben'      => 'Heiligenleben',
		'Marien*'            => 'Marienandacht',
	);
}

// =============================================================================
// HELPERS
// =============================================================================
function la_normalize( $text ) {
	return wp_strip_all_tags( html_entity_decode( (string) $text, ENT_QUOTES | ENT_HTML5, 'UTF-8' ) );
}
function la_match( $haystack, $kw ) {
	$out = array();
	foreach ( $kw as $needle => $canonical ) {
		if ( substr( $needle, -1 ) === '*' ) {
			$stem    = substr( $needle, 0, -1 );
			$pattern = '/\b' . preg_quote( $stem, '/' ) . '[a-zäöüß]*\b/iu';
		} else {
			$pattern = '/\b' . preg_quote( $needle, '/' ) . '\b/iu';
		}
		if ( preg_match( $pattern, $haystack ) ) {
			$out[ $canonical ] = true;
		}
	}
	return array_keys( $out );
}
function la_brand( $pid ) {
	$b = trim( (string) get_post_meta( $pid, '_waas_brand', true ) );
	return $b === '' ? '' : preg_replace( '/\s+/u', ' ', $b );
}
function la_cap_top_n( $matches, $global_freq, $n = 3 ) {
	if ( count( $matches ) <= $n ) {
		return $matches;
	}
	usort( $matches, function ( $a, $b ) use ( $global_freq ) {
		return ( $global_freq[ $b ] ?? 0 ) <=> ( $global_freq[ $a ] ?? 0 );
	} );
	return array_slice( $matches, 0, $n );
}

// Taxonomy targets — slug => human label. Brand uses WC-native product_brand.
$tax_targets = array(
	'product_brand' => 'Marke',
	'material'      => 'Material',
	'anlass'        => 'Anlass',
	'empfaenger'    => 'Empfänger',
	'literatur'     => 'Literatur',
);
function la_slug_to_facet( $slug ) {
	$map = array(
		'product_brand' => 'brand',
		'material'      => 'material',
		'anlass'        => 'anlass',
		'empfaenger'    => 'empfaenger',
		'literatur'     => 'literatur',
	);
	return $map[ $slug ] ?? $slug;
}

// =============================================================================
// PRE-FLIGHT
// =============================================================================
$tax_status = array();
$any_missing = false;
foreach ( $tax_targets as $slug => $label ) {
	$exists = taxonomy_exists( $slug );
	$tax_status[ $slug ] = array(
		'label'  => $label,
		'exists' => $exists,
		'terms'  => $exists ? (int) wp_count_terms( array( 'taxonomy' => $slug, 'hide_empty' => false ) ) : null,
	);
	if ( ! $exists ) {
		$any_missing = true;
	}
}

// =============================================================================
// EARLY: handle rollback before scanning anything
// =============================================================================
if ( $mode === 'rollback' ) {
	echo '<!doctype html><meta charset="utf-8"><title>LUKO Apply — rollback</title>';
	echo '<style>body{font-family:-apple-system,sans-serif;max-width:1100px;margin:2em auto;padding:0 1em;line-height:1.5}code{background:#eef;padding:2px 6px;border-radius:3px}.box{background:#fee;padding:1em;border-left:4px solid #c33}</style>';
	echo '<h1>LUKO Apply — rollback</h1>';
	$log = get_option( 'luko_apply_created_terms', array() );
	echo '<p>Audit log: <strong>' . count( $log ) . '</strong> term(s) recorded as created by previous apply runs.</p>';
	if ( ! $confirm ) {
		echo '<div class="box"><strong>Confirm required.</strong> Append <code>&amp;confirm=YES</code> to delete every term in this audit list (and remove their assignments from products).</div>';
		echo '<p>First 20 entries:</p><ul>';
		$shown = 0;
		foreach ( $log as $entry ) {
			if ( $shown++ >= 20 ) { break; }
			printf( '<li><code>%s</code> term_id=<code>%d</code> name=<code>%s</code></li>',
				esc_html( $entry['taxonomy'] ), (int) $entry['term_id'], esc_html( $entry['name'] ) );
		}
		echo '</ul>';
		exit;
	}
	$deleted = 0;
	foreach ( $log as $entry ) {
		$ok = wp_delete_term( (int) $entry['term_id'], $entry['taxonomy'] );
		if ( $ok && ! is_wp_error( $ok ) ) {
			$deleted++;
		}
	}
	delete_option( 'luko_apply_created_terms' );
	echo '<div class="box"><strong>Rollback complete.</strong> Deleted ' . (int) $deleted . ' of ' . count( $log ) . ' terms. Audit log cleared.</div>';
	echo '<p><a href="?">Back to preview</a></p>';
	exit;
}

// =============================================================================
// SCAN + BUILD PLAN (same logic as luko-plan.php)
// =============================================================================
$limit  = isset( $_GET['limit'] ) ? max( 1, (int) $_GET['limit'] ) : -1;
$offset = isset( $_GET['offset'] ) ? max( 0, (int) $_GET['offset'] ) : 0;

$total_published = (int) wp_count_posts( 'product' )->publish;

$ids = ( new WP_Query( array(
	'post_type'              => 'product',
	'post_status'            => 'publish',
	'posts_per_page'         => $limit,
	'offset'                 => $offset,
	'orderby'                => 'ID',
	'order'                  => 'ASC',
	'fields'                 => 'ids',
	'no_found_rows'          => true,
	'update_post_term_cache' => false,
	'update_post_meta_cache' => false,
) ) )->posts;

$kw_mat = la_kw_material();
$kw_anl = la_kw_anlass();
$kw_emp = la_kw_empfaenger();
$kw_lit = la_kw_literatur();
$brand_blacklist = array( 'generisch', 'generic', 'generico', 'generique', 'générique', 'unbekannt', 'unknown' );

$raw  = array();
$freq = array( 'brand' => array(), 'material' => array(), 'anlass' => array(), 'empfaenger' => array(), 'literatur' => array() );

foreach ( $ids as $pid ) {
	$post = get_post( $pid );
	if ( ! $post ) {
		continue;
	}
	$features = (string) get_post_meta( $pid, '_waas_features', true );
	$hay = la_normalize( $post->post_title . "\n" . $post->post_excerpt . "\n" . $post->post_content . "\n" . $features );

	$b = la_brand( $pid );
	if ( $b !== '' && in_array( mb_strtolower( $b ), $brand_blacklist, true ) ) {
		$b = '';
	}
	$m = la_match( $hay, $kw_mat );
	$a = la_match( $hay, $kw_anl );
	$e = la_match( $hay, $kw_emp );
	$l = la_match( $hay, $kw_lit );

	if ( $b !== '' ) { $freq['brand'][ $b ] = ( $freq['brand'][ $b ] ?? 0 ) + 1; }
	foreach ( $m as $t ) { $freq['material'][ $t ]   = ( $freq['material'][ $t ] ?? 0 ) + 1; }
	foreach ( $a as $t ) { $freq['anlass'][ $t ]     = ( $freq['anlass'][ $t ] ?? 0 ) + 1; }
	foreach ( $e as $t ) { $freq['empfaenger'][ $t ] = ( $freq['empfaenger'][ $t ] ?? 0 ) + 1; }
	foreach ( $l as $t ) { $freq['literatur'][ $t ]  = ( $freq['literatur'][ $t ] ?? 0 ) + 1; }

	$raw[ $pid ] = array( 'brand' => $b, 'mat' => $m, 'anl' => $a, 'emp' => $e, 'lit' => $l );
}

$BRAND_MIN = 2;
$brands_kept_set = array_flip( array_keys( array_filter( $freq['brand'], function ( $n ) use ( $BRAND_MIN ) {
	return $n >= $BRAND_MIN;
} ) ) );

$plan = array();
foreach ( $raw as $pid => $r ) {
	$p = array( 'brand' => array(), 'material' => array(), 'anlass' => array(), 'empfaenger' => array(), 'literatur' => array() );
	if ( $r['brand'] !== '' && isset( $brands_kept_set[ $r['brand'] ] ) ) {
		$p['brand'][] = $r['brand'];
	}
	foreach ( array( 'material' => 'mat', 'anlass' => 'anl', 'empfaenger' => 'emp', 'literatur' => 'lit' ) as $facet => $key ) {
		$p[ $facet ] = la_cap_top_n( $r[ $key ], $freq[ $facet ], 3 );
	}
	$plan[ $pid ] = $p;
}

// Aggregate term lists
$unique_terms = array();
foreach ( $tax_targets as $slug => $_ ) {
	$facet = la_slug_to_facet( $slug );
	$set = array();
	foreach ( $plan as $p ) {
		foreach ( $p[ $facet ] as $t ) {
			$set[ $t ] = true;
		}
	}
	$unique_terms[ $slug ] = array_keys( $set );
}

// =============================================================================
// HTML HEADER
// =============================================================================
echo '<!doctype html><meta charset="utf-8"><title>LUKO Apply (' . esc_html( $mode ) . ')</title>';
echo '<style>body{font-family:-apple-system,sans-serif;max-width:1100px;margin:2em auto;padding:0 1em;line-height:1.5}code{background:#eef;padding:2px 6px;border-radius:3px}.box{background:#f4f4f4;padding:1em;margin:1em 0;border-left:4px solid #5b6}.warn{border-left-color:#e80;background:#fff8ec}.err{border-left-color:#c33;background:#fee}.ok{border-left-color:#393;background:#efe}table{border-collapse:collapse;font-family:monospace;font-size:13px;margin:1em 0}th,td{padding:3px 12px;border-bottom:1px solid #ddd}th{text-align:left;background:#f4f4f4}</style>';
echo '<h1>LUKO Apply &mdash; mode: <code>' . esc_html( $mode ) . '</code></h1>';
echo '<p>Processed: <strong>' . count( $ids ) . '</strong> of ' . $total_published . ' published products</p>';

echo '<h2>Pre-flight: target taxonomies</h2>';
echo '<table><tr><th>taxonomy</th><th>label</th><th>registered?</th><th>existing terms</th></tr>';
foreach ( $tax_status as $slug => $info ) {
	printf(
		'<tr><td><code>%s</code></td><td>%s</td><td>%s</td><td>%s</td></tr>',
		esc_html( $slug ), esc_html( $info['label'] ),
		$info['exists'] ? '<span style="color:#393">YES</span>' : '<span style="color:#c33">NO</span>',
		$info['exists'] ? (int) $info['terms'] : '—'
	);
}
echo '</table>';

if ( $any_missing ) {
	echo '<div class="box err"><strong>Cannot proceed.</strong> One or more taxonomies are not registered. Upload <code>mu-plugins/luko-filters.php</code> to <code>/wp-content/mu-plugins/</code> first, then reload this page.</div>';
	echo '<p>The MU-plugin registers <code>material</code>, <code>anlass</code>, <code>empfaenger</code>, and <code>literatur</code> for the <code>product</code> post type. <code>product_brand</code> comes from WooCommerce.</p>';
	exit;
}

// =============================================================================
// PREVIEW MODE — just show what would happen
// =============================================================================
if ( $mode === 'preview' ) {
	echo '<div class="box"><strong>Preview only.</strong> No database writes performed. To execute, append <code>?mode=apply&amp;confirm=YES</code>.</div>';

	$total_existing = 0;
	$total_to_create = 0;
	echo '<h2>Term creation plan</h2>';
	echo '<table><tr><th>taxonomy</th><th>terms in plan</th><th>already exist</th><th>to create</th></tr>';
	foreach ( $tax_targets as $slug => $label ) {
		$exist = 0; $todo = 0;
		foreach ( $unique_terms[ $slug ] as $t ) {
			if ( term_exists( $t, $slug ) ) { $exist++; } else { $todo++; }
		}
		$total_existing += $exist;
		$total_to_create += $todo;
		printf( '<tr><td><code>%s</code></td><td>%d</td><td>%d</td><td>%d</td></tr>',
			esc_html( $slug ), count( $unique_terms[ $slug ] ), $exist, $todo );
	}
	echo '</table>';
	echo '<p>Total terms to create: <strong>' . $total_to_create . '</strong>; already in DB: ' . $total_existing . '</p>';

	$total_assignments = 0;
	foreach ( $plan as $p ) {
		foreach ( $p as $terms ) {
			$total_assignments += count( $terms );
		}
	}
	echo '<p>Total product&rarr;term assignments to write: <strong>' . $total_assignments . '</strong></p>';

	echo '<div class="box warn"><strong>Once you click apply, every product will have its terms in these 5 taxonomies <em>replaced</em> by the computed plan.</strong> Pre-existing assignments in these taxonomies will be overwritten. Rollback is available via <code>?mode=rollback&amp;confirm=YES</code> (deletes only terms created by apply).</div>';
	echo '<p style="margin-top:2em"><a href="?mode=apply&amp;confirm=YES" style="display:inline-block;padding:.7em 1.5em;background:#c33;color:white;text-decoration:none;border-radius:4px;font-weight:bold">EXECUTE APPLY &rarr;</a></p>';
	exit;
}

// =============================================================================
// APPLY MODE — write everything
// =============================================================================
if ( $mode !== 'apply' ) {
	echo '<div class="box err">Unknown mode: ' . esc_html( $mode ) . '. Use preview, apply, or rollback.</div>';
	exit;
}
if ( ! $confirm ) {
	echo '<div class="box err"><strong>Confirm required.</strong> Append <code>&amp;confirm=YES</code> to actually write changes.</div>';
	exit;
}

// Step 1: ensure terms exist. Audit any new ones.
$audit = get_option( 'luko_apply_created_terms', array() );
$created_now = 0;
$slug_to_termname_to_id = array();
foreach ( $tax_targets as $slug => $_ ) {
	$slug_to_termname_to_id[ $slug ] = array();
	foreach ( $unique_terms[ $slug ] as $name ) {
		$existing = term_exists( $name, $slug );
		if ( $existing ) {
			$tid = is_array( $existing ) ? (int) $existing['term_id'] : (int) $existing;
		} else {
			$res = wp_insert_term( $name, $slug );
			if ( is_wp_error( $res ) ) {
				echo '<div class="box err">Failed to create term <code>' . esc_html( $name ) . '</code> in <code>' . esc_html( $slug ) . '</code>: ' . esc_html( $res->get_error_message() ) . '</div>';
				continue;
			}
			$tid = (int) $res['term_id'];
			$audit[] = array( 'taxonomy' => $slug, 'term_id' => $tid, 'name' => $name, 'created_at' => current_time( 'mysql' ) );
			$created_now++;
		}
		$slug_to_termname_to_id[ $slug ][ $name ] = $tid;
	}
}
update_option( 'luko_apply_created_terms', $audit, false );

// Step 2: assign terms to products (replace within each taxonomy).
$products_updated = 0;
$assign_errors    = 0;
foreach ( $plan as $pid => $p ) {
	foreach ( $tax_targets as $slug => $_ ) {
		$facet = la_slug_to_facet( $slug );
		$ids_to_set = array();
		foreach ( $p[ $facet ] as $name ) {
			if ( isset( $slug_to_termname_to_id[ $slug ][ $name ] ) ) {
				$ids_to_set[] = (int) $slug_to_termname_to_id[ $slug ][ $name ];
			}
		}
		$res = wp_set_object_terms( $pid, $ids_to_set, $slug, false );
		if ( is_wp_error( $res ) ) {
			$assign_errors++;
		}
	}
	$products_updated++;
}

echo '<div class="box ok"><strong>Apply complete.</strong></div>';
echo '<ul>';
echo '<li>Terms created this run: <strong>' . $created_now . '</strong> (total audited across all runs: ' . count( $audit ) . ')</li>';
echo '<li>Products updated: <strong>' . $products_updated . '</strong></li>';
echo '<li>Assignment errors: ' . $assign_errors . '</li>';
echo '</ul>';
echo '<p>To roll back: <code>?mode=rollback&amp;confirm=YES</code></p>';
echo '<p>Verify in admin: <code>?luko_filters_status=1</code> on any admin page (works after MU-plugin loaded), or visit Products &rarr; Filters in the admin sidebar.</p>';
