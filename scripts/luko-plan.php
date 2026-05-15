<?php
/**
 * LUKO Plan — DRY-RUN report for taxonomy assignment.
 *
 * READ-ONLY. Makes ZERO database writes. Computes exactly which terms WOULD
 * be assigned to each product if Phase 3 were applied, and emits a CSV plan
 * + HTML summary. Use this to review the plan before running luko-apply.php.
 *
 * USAGE:
 *   1. Upload to /public_html/luko-plan.php
 *   2. Visit https://YOUR-DOMAIN/luko-plan.php (admin only)
 *   3. Review report + download plan.csv
 *   4. DELETE the file when done.
 *
 * Query params:
 *   ?limit=N&offset=N    process slice (default: all published products)
 *   ?download=csv        download the plan CSV
 *
 * Rules applied:
 *   - Brand: kept only if its global frequency >= 2 AND not in placeholder blacklist
 *   - Material/Anlass/Empfänger/Literatur: cap to top-3 per facet, ranked by global frequency
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
@set_time_limit( 600 );

// =============================================================================
// DICTIONARIES — keep in sync with luko-scan.php
// =============================================================================
// Keyword convention: trailing `*` enables prefix mode (matches stem +
// any German lowercase suffix). Keep in sync with luko-scan.php.
function lp_kw_material() {
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
function lp_kw_anlass() {
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
function lp_kw_empfaenger() {
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
function lp_kw_literatur() {
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
// MATCHING HELPERS
// =============================================================================
function lp_normalize( $text ) {
	return wp_strip_all_tags( html_entity_decode( (string) $text, ENT_QUOTES | ENT_HTML5, 'UTF-8' ) );
}
function lp_match( $haystack, $kw ) {
	// Trailing `*` = prefix mode (stem + any German lowercase suffix),
	// to catch compound nouns like "Kommunionkerze" or "Heiligenleben".
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
function lp_brand( $pid ) {
	$b = trim( (string) get_post_meta( $pid, '_waas_brand', true ) );
	return $b === '' ? '' : preg_replace( '/\s+/u', ' ', $b );
}
function lp_cap_top_n( $matches, $global_freq, $n = 3 ) {
	if ( count( $matches ) <= $n ) {
		return $matches;
	}
	usort( $matches, function ( $a, $b ) use ( $global_freq ) {
		return ( $global_freq[ $b ] ?? 0 ) <=> ( $global_freq[ $a ] ?? 0 );
	} );
	return array_slice( $matches, 0, $n );
}

// =============================================================================
// PRE-FLIGHT — taxonomy targets
// =============================================================================
$tax_targets = array(
	'product_brand'      => 'Marke (Brand)',
	'product_material'   => 'Material',
	'product_anlass'     => 'Anlass',
	'product_empfaenger' => 'Empfänger',
	'product_literatur'  => 'Literatur',
);
$tax_status = array();
foreach ( $tax_targets as $slug => $label ) {
	$exists = taxonomy_exists( $slug );
	$tax_status[ $slug ] = array(
		'label'  => $label,
		'exists' => $exists,
		'terms'  => $exists ? (int) wp_count_terms( array( 'taxonomy' => $slug, 'hide_empty' => false ) ) : null,
	);
}

// =============================================================================
// PASS 1 — collect all matches and global frequencies
// =============================================================================
$limit  = isset( $_GET['limit'] ) ? max( 1, (int) $_GET['limit'] ) : -1;
$offset = isset( $_GET['offset'] ) ? max( 0, (int) $_GET['offset'] ) : 0;
$dl_csv = ! empty( $_GET['download'] ) && $_GET['download'] === 'csv';

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

$kw_mat = lp_kw_material();
$kw_anl = lp_kw_anlass();
$kw_emp = lp_kw_empfaenger();
$kw_lit = lp_kw_literatur();

$brand_blacklist = array( 'generisch', 'generic', 'generico', 'generique', 'générique', 'unbekannt', 'unknown' );

$raw = array(); // pid => [brand, mat[], anl[], emp[], lit[], asin, title]
$freq = array(
	'brand' => array(), 'material' => array(), 'anlass' => array(), 'empfaenger' => array(), 'literatur' => array(),
);

foreach ( $ids as $pid ) {
	$post = get_post( $pid );
	if ( ! $post ) {
		continue;
	}
	$features = (string) get_post_meta( $pid, '_waas_features', true );
	$asin     = (string) get_post_meta( $pid, '_waas_asin', true );
	$hay      = lp_normalize( $post->post_title . "\n" . $post->post_excerpt . "\n" . $post->post_content . "\n" . $features );

	$b = lp_brand( $pid );
	if ( $b !== '' && in_array( mb_strtolower( $b ), $brand_blacklist, true ) ) {
		$b = '';
	}
	$m = lp_match( $hay, $kw_mat );
	$a = lp_match( $hay, $kw_anl );
	$e = lp_match( $hay, $kw_emp );
	$l = lp_match( $hay, $kw_lit );

	if ( $b !== '' ) { $freq['brand'][ $b ] = ( $freq['brand'][ $b ] ?? 0 ) + 1; }
	foreach ( $m as $t ) { $freq['material'][ $t ]   = ( $freq['material'][ $t ] ?? 0 ) + 1; }
	foreach ( $a as $t ) { $freq['anlass'][ $t ]     = ( $freq['anlass'][ $t ] ?? 0 ) + 1; }
	foreach ( $e as $t ) { $freq['empfaenger'][ $t ] = ( $freq['empfaenger'][ $t ] ?? 0 ) + 1; }
	foreach ( $l as $t ) { $freq['literatur'][ $t ]  = ( $freq['literatur'][ $t ] ?? 0 ) + 1; }

	$raw[ $pid ] = array(
		'asin'  => $asin,
		'title' => $post->post_title,
		'brand' => $b,
		'mat'   => $m,
		'anl'   => $a,
		'emp'   => $e,
		'lit'   => $l,
	);
}

// =============================================================================
// PASS 2 — apply rules to build the assignment plan
// =============================================================================
$BRAND_MIN = 2;
$brands_kept = array_keys( array_filter( $freq['brand'], function ( $n ) use ( $BRAND_MIN ) {
	return $n >= $BRAND_MIN;
} ) );
$brands_kept_set = array_flip( $brands_kept );

$plan       = array();
$facet_assignments = array( 'brand' => 0, 'material' => 0, 'anlass' => 0, 'empfaenger' => 0, 'literatur' => 0 );
$products_with_n_facets = array_fill( 0, 6, 0 ); // 0..5
$dropped_brands = array(); // brand => count (those filtered out by min threshold)
$capped_count = 0; // count of facets capped from >3 to 3

foreach ( $raw as $pid => $r ) {
	$p = array( 'brand' => array(), 'material' => array(), 'anlass' => array(), 'empfaenger' => array(), 'literatur' => array() );

	if ( $r['brand'] !== '' ) {
		if ( isset( $brands_kept_set[ $r['brand'] ] ) ) {
			$p['brand'][] = $r['brand'];
		} else {
			$dropped_brands[ $r['brand'] ] = ( $dropped_brands[ $r['brand'] ] ?? 0 ) + 1;
		}
	}

	foreach ( array( 'material' => 'mat', 'anlass' => 'anl', 'empfaenger' => 'emp', 'literatur' => 'lit' ) as $facet => $key ) {
		$src = $r[ $key ];
		if ( count( $src ) > 3 ) {
			$capped_count++;
		}
		$p[ $facet ] = lp_cap_top_n( $src, $freq[ $facet ], 3 );
	}

	$plan[ $pid ] = $p;
	$facets_used  = 0;
	foreach ( $p as $facet => $terms ) {
		$facet_assignments[ $facet ] += count( $terms );
		if ( count( $terms ) > 0 ) {
			$facets_used++;
		}
	}
	$products_with_n_facets[ $facets_used ]++;
}

// Unique terms per taxonomy (the "would create" set)
$unique_terms = array();
foreach ( $tax_targets as $slug => $_ ) {
	$facet = str_replace( 'product_', '', $slug );
	$set   = array();
	foreach ( $plan as $p ) {
		foreach ( $p[ $facet ] as $t ) {
			$set[ $t ] = true;
		}
	}
	$unique_terms[ $slug ] = array_keys( $set );
}

// =============================================================================
// CSV
// =============================================================================
$upload_dir = wp_upload_dir();
$log_dir    = trailingslashit( $upload_dir['basedir'] ) . 'luko-logs';
if ( ! is_dir( $log_dir ) ) {
	wp_mkdir_p( $log_dir );
}
$csv_name = 'plan-' . gmdate( 'Ymd-His' ) . '.csv';
$csv_path = $log_dir . '/' . $csv_name;
$csv_url  = trailingslashit( $upload_dir['baseurl'] ) . 'luko-logs/' . $csv_name;
$fp = fopen( $csv_path, 'w' );
fputcsv( $fp, array( 'post_id', 'asin', 'title', 'plan_brand', 'plan_material', 'plan_anlass', 'plan_empfaenger', 'plan_literatur', 'facets_used' ) );
foreach ( $plan as $pid => $p ) {
	$used = 0;
	foreach ( $p as $terms ) { if ( $terms ) { $used++; } }
	fputcsv( $fp, array(
		$pid,
		$raw[ $pid ]['asin'],
		$raw[ $pid ]['title'],
		implode( '|', $p['brand'] ),
		implode( '|', $p['material'] ),
		implode( '|', $p['anlass'] ),
		implode( '|', $p['empfaenger'] ),
		implode( '|', $p['literatur'] ),
		$used,
	) );
}
fclose( $fp );

if ( $dl_csv ) {
	header( 'Content-Type: text/csv; charset=utf-8' );
	header( 'Content-Disposition: attachment; filename="' . $csv_name . '"' );
	readfile( $csv_path );
	exit;
}

// =============================================================================
// HTML REPORT
// =============================================================================
$processed = count( $ids );

echo '<!doctype html><meta charset="utf-8"><title>LUKO Plan (DRY-RUN)</title>';
echo '<style>body{font-family:-apple-system,sans-serif;max-width:1100px;margin:2em auto;padding:0 1em;line-height:1.5}code{background:#eef;padding:2px 6px;border-radius:3px}.box{background:#f4f4f4;padding:1em;margin:1em 0;border-left:4px solid #5b6}.warn{border-left-color:#e80}table{border-collapse:collapse;font-family:monospace;font-size:13px;margin:1em 0}th,td{padding:3px 12px;border-bottom:1px solid #ddd}th{text-align:left;background:#f4f4f4}</style>';
echo '<h1>LUKO Plan — DRY-RUN (no changes made)</h1>';
echo '<p>Generated: <code>' . esc_html( current_time( 'mysql' ) ) . '</code></p>';

echo '<div class="box"><strong>Processed:</strong> ' . $processed . ' of ' . $total_published . ' published products';
if ( $offset > 0 || ( $limit > 0 && $limit < $total_published ) ) {
	echo ' (slice: offset=' . $offset . ', limit=' . $limit . ')';
}
echo '<br><strong>Plan CSV:</strong> <a href="?download=csv' . ( $offset ? '&offset=' . $offset : '' ) . ( $limit > 0 ? '&limit=' . $limit : '' ) . '">plan.csv</a> &middot; <code>' . esc_html( $csv_url ) . '</code>';
echo '<br><strong>Rules:</strong> brand kept iff freq &ge; ' . $BRAND_MIN . ' &amp; not placeholder &middot; material/anlass/empfänger/literatur capped to top-3 by global frequency';
echo '</div>';

echo '<h2>Pre-flight: target taxonomies</h2>';
echo '<table><tr><th>taxonomy</th><th>label</th><th>exists?</th><th>existing terms</th><th>action needed</th></tr>';
$any_missing = false;
foreach ( $tax_status as $slug => $info ) {
	$action = $info['exists'] ? 'register-only (use existing)' : '<strong style="color:#c33">CREATE taxonomy + terms</strong>';
	if ( ! $info['exists'] ) { $any_missing = true; }
	printf(
		'<tr><td><code>%s</code></td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>',
		esc_html( $slug ), esc_html( $info['label'] ),
		$info['exists'] ? '<span style="color:#393">YES</span>' : '<span style="color:#c33">NO</span>',
		$info['exists'] ? (int) $info['terms'] : '—',
		$action
	);
}
echo '</table>';
if ( $any_missing ) {
	echo '<div class="box warn">⚠ Some target taxonomies do not yet exist. <code>luko-apply.php</code> will need to register them (and ship a permanent MU-plugin so they survive).</div>';
}

echo '<h2>Assignment plan summary</h2>';
echo '<table><tr><th>facet</th><th>unique terms to ensure</th><th>total assignments</th><th>avg per product</th></tr>';
foreach ( array( 'brand' => 'product_brand', 'material' => 'product_material', 'anlass' => 'product_anlass', 'empfaenger' => 'product_empfaenger', 'literatur' => 'product_literatur' ) as $facet => $slug ) {
	printf(
		'<tr><td>%s</td><td>%d</td><td>%d</td><td>%.2f</td></tr>',
		esc_html( $facet ),
		count( $unique_terms[ $slug ] ),
		$facet_assignments[ $facet ],
		$processed ? $facet_assignments[ $facet ] / $processed : 0
	);
}
echo '</table>';

echo '<h2>Tag depth distribution (facets per product)</h2>';
echo '<table><tr><th>facets used</th><th>products</th><th>%</th></tr>';
for ( $i = 0; $i <= 5; $i++ ) {
	printf(
		'<tr><td>%d facet%s</td><td>%d</td><td>%.1f%%</td></tr>',
		$i, $i === 1 ? '' : 's',
		$products_with_n_facets[ $i ],
		$processed ? 100 * $products_with_n_facets[ $i ] / $processed : 0
	);
}
echo '</table>';
echo '<p><em>Capped facets (had &gt;3 raw matches, trimmed to top-3): <strong>' . $capped_count . '</strong></em></p>';

echo '<h2>Brands dropped (frequency &lt; ' . $BRAND_MIN . ')</h2>';
echo '<p>' . count( $dropped_brands ) . ' unique brands appearing only on 1 product → skipped (no value as a filter).</p>';
arsort( $dropped_brands );
echo '<details><summary>Show all dropped brands (each appears on 1 product)</summary><table><tr><th>brand</th><th>occurrences</th></tr>';
$shown = 0;
foreach ( $dropped_brands as $b => $n ) {
	if ( $shown++ >= 50 ) { echo '<tr><td colspan="2"><em>+ ' . ( count( $dropped_brands ) - 50 ) . ' more (see CSV)</em></td></tr>'; break; }
	printf( '<tr><td>%s</td><td>%d</td></tr>', esc_html( $b ), $n );
}
echo '</table></details>';

foreach ( $tax_targets as $slug => $label ) {
	$facet = str_replace( 'product_', '', $slug );
	$terms = $unique_terms[ $slug ];
	echo '<h3>' . esc_html( $label ) . ' &mdash; <code>' . esc_html( $slug ) . '</code> &mdash; ' . count( $terms ) . ' terms</h3>';
	echo '<table><tr><th>term</th><th>products tagged</th></tr>';
	$rows = array();
	foreach ( $terms as $t ) {
		$count = 0;
		foreach ( $plan as $p ) {
			if ( in_array( $t, $p[ $facet ], true ) ) { $count++; }
		}
		$rows[] = array( $t, $count );
	}
	usort( $rows, function ( $a, $b ) { return $b[1] <=> $a[1]; } );
	$shown = 0;
	foreach ( $rows as $row ) {
		if ( $shown++ >= 30 ) { echo '<tr><td colspan="2"><em>+ ' . ( count( $rows ) - 30 ) . ' more (see CSV)</em></td></tr>'; break; }
		printf( '<tr><td>%s</td><td>%d</td></tr>', esc_html( $row[0] ), $row[1] );
	}
	echo '</table>';
}

echo '<h2>Sample: first 20 products with their plan</h2>';
echo '<table><tr><th>#</th><th>title</th><th>brand</th><th>material</th><th>anlass</th><th>empfänger</th><th>literatur</th></tr>';
$shown = 0;
foreach ( $plan as $pid => $p ) {
	if ( $shown++ >= 20 ) { break; }
	printf(
		'<tr><td>%d</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>',
		$pid,
		esc_html( mb_substr( $raw[ $pid ]['title'], 0, 80 ) ),
		esc_html( implode( ', ', $p['brand'] ) ),
		esc_html( implode( ', ', $p['material'] ) ),
		esc_html( implode( ', ', $p['anlass'] ) ),
		esc_html( implode( ', ', $p['empfaenger'] ) ),
		esc_html( implode( ', ', $p['literatur'] ) )
	);
}
echo '</table>';

echo '<hr><p><em>This was a DRY-RUN. No database writes were performed. Review the plan, then ask Claude to generate <code>luko-apply.php</code> to execute it.</em></p>';
