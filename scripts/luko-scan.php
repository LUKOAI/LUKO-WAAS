<?php
/**
 * LUKO Scan — read-only parser preview for Marke/Material/Anlass/Empfänger.
 *
 * USAGE:
 *   1. Upload to /public_html/luko-scan.php
 *   2. Log in as admin
 *   3. Visit https://videamut.de/luko-scan.php
 *      Optional params:
 *        ?limit=200       process only first N (default: all)
 *        ?offset=0        skip first N
 *        ?download=csv    force CSV download instead of HTML report
 *   4. Screenshot the summary and review the CSV
 *   5. DELETE this file after use (rm /public_html/luko-scan.php)
 *
 * This script reads only. It writes ONE artifact: a CSV report under
 * /wp-content/uploads/luko-logs/scan-{timestamp}.csv. No DB writes.
 */

// --- Bootstrap WP ---
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

@set_time_limit( 0 );
ignore_user_abort( true );

// =============================================================================
// KEYWORD DICTIONARIES — these drive the matching. Tune after first scan.
// Order matters within each family: longer/more-specific terms FIRST so we
// match "Erstkommunion" before "Kommunion", "Kunstleder" before "Leder", etc.
// =============================================================================

function luko_kw_material() {
	return array(
		// Compound / specific first
		'Kunstleder'    => 'Kunstleder',
		'Echtleder'     => 'Leder',
		'Edelstahl'     => 'Edelstahl',
		'Sterlingsilber'=> 'Silber',
		'Eichenholz'    => 'Holz',
		'Buchenholz'    => 'Holz',
		'Olivenholz'    => 'Holz',
		// Base materials
		'Filz'          => 'Filz',
		'Leder'         => 'Leder',
		'Holz'          => 'Holz',
		'Metall'        => 'Metall',
		'Silber'        => 'Silber',
		'Vergoldet'     => 'Gold',
		'Gold'          => 'Gold',
		'Porzellan'     => 'Porzellan',
		'Keramik'       => 'Keramik',
		'Glas'          => 'Glas',
		'Baumwolle'     => 'Baumwolle',
		'Polyester'     => 'Polyester',
		'Acryl'         => 'Acryl',
		'Papier'        => 'Papier',
		'Kunststoff'    => 'Kunststoff',
		'Marmor'        => 'Marmor',
		'Stein'         => 'Stein',
		'Wolle'         => 'Wolle',
		'Messing'       => 'Messing',
		'Bronze'        => 'Bronze',
		'Zinn'          => 'Zinn',
		'Stoff'         => 'Stoff',
	);
}

function luko_kw_anlass() {
	// Trailing `*` enables prefix-mode: matches the stem plus any German
	// lowercase suffix, so "Kommunion*" catches "Kommunionkerze",
	// "Kommunionsbild", "Kommunionsgeschenk", etc.
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

function luko_kw_literatur() {
	return array(
		// Bibel
		'Erstkommunionbibel' => 'Bibel',
		'Familienbibel'      => 'Bibel',
		'Jugendbibel'        => 'Bibel',
		'Kinderbibel'        => 'Bibel',
		'Bibel*'             => 'Bibel',
		// Katechismus
		'Jugendkatechismus'  => 'Katechismus',
		'Katechismus*'       => 'Katechismus',
		'YOUCAT*'            => 'YOUCAT',
		'Youcat*'            => 'YOUCAT',
		// Gesangbuch / Liederbuch
		'Gotteslob*'         => 'Gotteslob',
		'Kantorenbuch'       => 'Gotteslob',
		'Chorbuch'           => 'Gotteslob',
		'Gesangbuch*'        => 'Gesangbuch',
		'Liederbuch*'        => 'Gesangbuch',
		// Gebetbuch
		'Gebetbuch*'         => 'Gebetbuch',
		'Stundenbuch*'       => 'Stundenbuch',
		'Brevier*'           => 'Stundenbuch',
		'Andachtsbuch*'      => 'Andachtsbuch',
		'Tagebuch'           => 'Andachtsbuch',
		// Theologie
		'Theologie*'         => 'Theologie',
		'Apologetik*'        => 'Theologie',
		'Christentum'        => 'Theologie',
		'christlich*'        => 'Theologie',
		'Glaube'             => 'Theologie',
		'Glauben'            => 'Theologie',
		'Glaubens*'          => 'Theologie',
		'Einführung'         => 'Theologie',
		// Wallfahrt / Pilger
		'Pilger*'            => 'Wallfahrtsführer',
		'Wallfahrt*'         => 'Wallfahrtsführer',
		'Jakobsweg*'         => 'Wallfahrtsführer',
		// Heiligenleben (biographies of saints)
		'Heilige*'           => 'Heiligenleben',
		'Heiliger'           => 'Heiligenleben',
		'Heiligenleben'      => 'Heiligenleben',
		// Marian literature
		'Marien*'            => 'Marienandacht',
	);
}

function luko_kw_empfaenger() {
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

// =============================================================================
// MATCHING
// =============================================================================

function luko_normalize_text( $text ) {
	$text = (string) $text;
	$text = html_entity_decode( $text, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
	$text = wp_strip_all_tags( $text );
	return $text;
}

function luko_match_keywords( $haystack, $keywords ) {
	// A trailing `*` on the needle enables prefix mode: the stem may be
	// followed by any run of German lowercase letters before the right
	// word boundary. This handles compound nouns like "Kommunionkerze",
	// "Bibelvers", "Heiligenleben", "Wallfahrtsort" that an exact
	// `\bX\b` match would miss.
	$matches = array();
	foreach ( $keywords as $needle => $canonical ) {
		if ( substr( $needle, -1 ) === '*' ) {
			$stem    = substr( $needle, 0, -1 );
			$pattern = '/\b' . preg_quote( $stem, '/' ) . '[a-zäöüß]*\b/iu';
		} else {
			$pattern = '/\b' . preg_quote( $needle, '/' ) . '\b/iu';
		}
		if ( preg_match( $pattern, $haystack ) ) {
			$matches[ $canonical ] = true;
		}
	}
	return array_keys( $matches );
}

function luko_match_explicit_material( $haystack ) {
	// Capture "Material: X" up to | or newline or end. Multiple occurrences.
	$out = array();
	if ( preg_match_all( '/Material\s*:\s*([^|\n\r]+)/iu', $haystack, $m ) ) {
		foreach ( $m[1] as $raw ) {
			$raw = trim( $raw );
			// Split on common separators ("Filz Polyester", "Holz, Metall")
			$parts = preg_split( '/[\s,;\/]+/u', $raw );
			foreach ( $parts as $p ) {
				$p = trim( $p );
				if ( $p === '' || mb_strlen( $p ) > 30 ) {
					continue;
				}
				$out[] = $p;
			}
		}
	}
	return array_values( array_unique( $out ) );
}

function luko_extract_brand( $post_id ) {
	$brand = trim( (string) get_post_meta( $post_id, '_waas_brand', true ) );
	if ( $brand === '' ) {
		return '';
	}
	// Normalize whitespace
	$brand = preg_replace( '/\s+/u', ' ', $brand );
	return $brand;
}

// =============================================================================
// MAIN
// =============================================================================

$limit  = isset( $_GET['limit'] ) ? max( 1, (int) $_GET['limit'] ) : -1;
$offset = isset( $_GET['offset'] ) ? max( 0, (int) $_GET['offset'] ) : 0;
$dl_csv = ! empty( $_GET['download'] ) && $_GET['download'] === 'csv';

$total_published = (int) wp_count_posts( 'product' )->publish;

$query = new WP_Query( array(
	'post_type'      => 'product',
	'post_status'    => 'publish',
	'posts_per_page' => $limit,
	'offset'         => $offset,
	'orderby'        => 'ID',
	'order'          => 'ASC',
	'fields'         => 'ids',
	'no_found_rows'  => true,
	'update_post_term_cache' => false,
	'update_post_meta_cache' => false,
) );

$ids = $query->posts;

// Prepare CSV output
$upload_dir = wp_upload_dir();
$log_dir    = trailingslashit( $upload_dir['basedir'] ) . 'luko-logs';
if ( ! is_dir( $log_dir ) ) {
	wp_mkdir_p( $log_dir );
}
$csv_name = 'scan-' . gmdate( 'Ymd-His' ) . '.csv';
$csv_path = $log_dir . '/' . $csv_name;
$csv_url  = trailingslashit( $upload_dir['baseurl'] ) . 'luko-logs/' . $csv_name;

$fp = fopen( $csv_path, 'w' );
if ( ! $fp ) {
	exit( 'Cannot write to ' . esc_html( $csv_path ) );
}
fputcsv( $fp, array( 'post_id', 'asin', 'title', 'brand', 'material_kw', 'material_explicit', 'anlass', 'empfaenger', 'literatur', 'content_length' ) );

$kw_mat = luko_kw_material();
$kw_anl = luko_kw_anlass();
$kw_emp = luko_kw_empfaenger();
$kw_lit = luko_kw_literatur();

$freq_brand    = array();
$freq_material = array();
$freq_anlass   = array();
$freq_empf     = array();
$freq_lit      = array();
$zero_match    = array();
$noisy         = array();

foreach ( $ids as $pid ) {
	$post = get_post( $pid );
	if ( ! $post ) {
		continue;
	}

	$features = (string) get_post_meta( $pid, '_waas_features', true );
	$asin     = (string) get_post_meta( $pid, '_waas_asin', true );

	$haystack = luko_normalize_text(
		$post->post_title . "\n" . $post->post_excerpt . "\n" . $post->post_content . "\n" . $features
	);

	$brand     = luko_extract_brand( $pid );
	$mat_kw    = luko_match_keywords( $haystack, $kw_mat );
	$mat_xpl   = luko_match_explicit_material( $haystack );
	$anlass    = luko_match_keywords( $haystack, $kw_anl );
	$empf      = luko_match_keywords( $haystack, $kw_emp );
	$lit       = luko_match_keywords( $haystack, $kw_lit );

	// Frequency tracking — blacklist locale-specific "unknown brand" placeholders.
	$brand_blacklist = array( 'generisch', 'generic', 'generico', 'generique', 'générique', 'unbekannt', 'unknown' );
	$brand_for_freq  = ( $brand !== '' && ! in_array( mb_strtolower( $brand ), $brand_blacklist, true ) ) ? $brand : '';
	if ( $brand_for_freq !== '' ) {
		$freq_brand[ $brand_for_freq ] = ( $freq_brand[ $brand_for_freq ] ?? 0 ) + 1;
	}
	foreach ( $mat_kw as $m ) { $freq_material[ $m ] = ( $freq_material[ $m ] ?? 0 ) + 1; }
	foreach ( $anlass as $a ) { $freq_anlass[ $a ]   = ( $freq_anlass[ $a ] ?? 0 ) + 1; }
	foreach ( $empf as $e )   { $freq_empf[ $e ]     = ( $freq_empf[ $e ] ?? 0 ) + 1; }
	foreach ( $lit as $l )    { $freq_lit[ $l ]      = ( $freq_lit[ $l ] ?? 0 ) + 1; }

	if ( ! $brand_for_freq && ! $mat_kw && ! $anlass && ! $empf && ! $lit ) {
		$zero_match[] = array( $pid, $asin, $post->post_title );
	}
	if ( count( $mat_kw ) > 5 || count( $anlass ) > 5 || count( $empf ) > 5 ) {
		$noisy[] = array( $pid, $asin, $post->post_title, count( $mat_kw ), count( $anlass ), count( $empf ) );
	}

	fputcsv( $fp, array(
		$pid,
		$asin,
		$post->post_title,
		$brand,
		implode( '|', $mat_kw ),
		implode( '|', $mat_xpl ),
		implode( '|', $anlass ),
		implode( '|', $empf ),
		implode( '|', $lit ),
		mb_strlen( $haystack ),
	) );
}
fclose( $fp );

$processed = count( $ids );

if ( $dl_csv ) {
	header( 'Content-Type: text/csv; charset=utf-8' );
	header( 'Content-Disposition: attachment; filename="' . $csv_name . '"' );
	readfile( $csv_path );
	exit;
}

// --- HTML report ---
function luko_render_freq( $title, $freq, $top = 30 ) {
	arsort( $freq );
	$total = array_sum( $freq );
	echo '<h3 style="margin-top:1.5em">' . esc_html( $title ) . ' &mdash; <small>' . count( $freq ) . ' unique, ' . $total . ' assignments</small></h3>';
	echo '<table style="border-collapse:collapse;font-family:monospace;font-size:13px"><tr><th style="text-align:left;padding:2px 12px;border-bottom:1px solid #ccc">term</th><th style="text-align:right;padding:2px 12px;border-bottom:1px solid #ccc">count</th></tr>';
	$i = 0;
	foreach ( $freq as $term => $n ) {
		if ( $i++ >= $top ) {
			break;
		}
		echo '<tr><td style="padding:1px 12px">' . esc_html( $term ) . '</td><td style="text-align:right;padding:1px 12px">' . (int) $n . '</td></tr>';
	}
	echo '</table>';
	if ( count( $freq ) > $top ) {
		echo '<p><em>+ ' . ( count( $freq ) - $top ) . ' more (see CSV)</em></p>';
	}
}

echo '<!doctype html><meta charset="utf-8"><title>LUKO Scan</title><style>body{font-family:-apple-system,sans-serif;max-width:1100px;margin:2em auto;padding:0 1em;line-height:1.5}code{background:#eef;padding:2px 6px;border-radius:3px}.box{background:#f4f4f4;padding:1em;margin:1em 0;border-left:4px solid #5b6}</style>';
echo '<h1>LUKO Scan — parse preview</h1>';
echo '<p>Generated: <code>' . esc_html( current_time( 'mysql' ) ) . '</code></p>';

echo '<div class="box"><strong>Processed:</strong> ' . $processed . ' of ' . $total_published . ' published products';
if ( $offset > 0 || ( $limit > 0 && $limit < $total_published ) ) {
	echo ' (slice: offset=' . $offset . ', limit=' . $limit . ')';
}
echo '<br><strong>CSV written to:</strong> <code>' . esc_html( $csv_path ) . '</code>';
echo '<br><strong>Download:</strong> <a href="?download=csv' . ( $offset ? '&offset=' . $offset : '' ) . ( $limit > 0 ? '&limit=' . $limit : '' ) . '">scan.csv</a> &middot; or fetch directly: <code>' . esc_html( $csv_url ) . '</code>';
echo '</div>';

echo '<h2>Frequency distributions</h2>';
luko_render_freq( 'Brand (Marke) — from _waas_brand meta, excluding placeholder values', $freq_brand );
luko_render_freq( 'Material — keyword matches', $freq_material );
luko_render_freq( 'Anlass — keyword matches', $freq_anlass );
luko_render_freq( 'Empfänger — keyword matches', $freq_empf );
luko_render_freq( 'Literatur — religious literature category', $freq_lit );

echo '<h2>Quality flags</h2>';
echo '<div class="box"><strong>Products with ZERO matches across all 5 facets:</strong> ' . count( $zero_match ) . ' of ' . $processed . ' (' . ( $processed ? round( 100 * count( $zero_match ) / $processed, 1 ) : 0 ) . '%)</div>';
if ( $zero_match ) {
	echo '<details><summary>Show first 30 zero-match products (review titles for missed keywords)</summary><ul style="font-size:12px">';
	foreach ( array_slice( $zero_match, 0, 30 ) as $row ) {
		printf( '<li>#%d [%s] %s</li>', $row[0], esc_html( $row[1] ), esc_html( $row[2] ) );
	}
	echo '</ul></details>';
}

echo '<div class="box"><strong>Noisy products (>5 matches in one facet — possible false positives):</strong> ' . count( $noisy ) . '</div>';
if ( $noisy ) {
	echo '<details><summary>Show noisy products</summary><ul style="font-size:12px">';
	foreach ( array_slice( $noisy, 0, 30 ) as $row ) {
		printf( '<li>#%d [%s] mat=%d anl=%d emp=%d &mdash; %s</li>', $row[0], esc_html( $row[1] ), $row[3], $row[4], $row[5], esc_html( $row[2] ) );
	}
	echo '</ul></details>';
}

echo '<hr><p style="margin-top:2em;color:#666"><strong>Done.</strong> Review CSV + frequency tables. If distributions look sane, we proceed to DRY-RUN (Phase 3). Then <code>rm</code> this file from the server.</p>';
