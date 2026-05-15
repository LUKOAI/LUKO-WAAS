<?php
/**
 * Plugin Name: LUKO Filters — taxonomies
 * Description: Registers the three custom taxonomies (Material, Anlass, Empfänger) that power the front-end product filters. Marke uses the existing WooCommerce `product_brand` taxonomy and is not registered here.
 * Author: LUKO
 * Version: 1.0.0
 *
 * Phase 1 of the LUKO filter project. This file ONLY registers structure.
 * It does NOT assign terms, does NOT parse content, and does NOT touch
 * existing products. Idempotent — safe to load on every request.
 *
 * Install: upload to /wp-content/mu-plugins/luko-filters.php
 * Uninstall: delete the file. Registered taxonomies will simply disappear
 * from the admin UI; any terms that were created will remain in the DB
 * under their taxonomy slugs and can be re-exposed by re-installing.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Taxonomy definitions — single source of truth.
 *
 * slug      => internal taxonomy name (used in get_terms, wp_set_object_terms)
 * singular  => admin label, singular
 * plural    => admin label, plural (German)
 * rewrite   => front-end URL segment
 */
function luko_filters_taxonomy_defs() {
	return array(
		'material' => array(
			'singular' => 'Material',
			'plural'   => 'Materialien',
			'rewrite'  => 'material',
		),
		'anlass' => array(
			'singular' => 'Anlass',
			'plural'   => 'Anlässe',
			'rewrite'  => 'anlass',
		),
		'empfaenger' => array(
			'singular' => 'Empfänger',
			'plural'   => 'Empfänger',
			'rewrite'  => 'empfaenger',
		),
	);
}

add_action( 'init', 'luko_filters_register_taxonomies', 20 );
function luko_filters_register_taxonomies() {
	foreach ( luko_filters_taxonomy_defs() as $slug => $def ) {
		$labels = array(
			'name'                       => $def['plural'],
			'singular_name'              => $def['singular'],
			'menu_name'                  => $def['plural'],
			'all_items'                  => 'Alle ' . $def['plural'],
			'edit_item'                  => $def['singular'] . ' bearbeiten',
			'view_item'                  => $def['singular'] . ' ansehen',
			'update_item'                => $def['singular'] . ' aktualisieren',
			'add_new_item'               => 'Neue/n ' . $def['singular'] . ' hinzufügen',
			'new_item_name'              => 'Name des neuen ' . $def['singular'],
			'search_items'               => $def['plural'] . ' suchen',
			'not_found'                  => 'Keine ' . $def['plural'] . ' gefunden',
			'separate_items_with_commas' => $def['plural'] . ' mit Kommas trennen',
			'add_or_remove_items'        => $def['plural'] . ' hinzufügen oder entfernen',
			'choose_from_most_used'      => 'Aus häufig genutzten ' . $def['plural'] . ' wählen',
		);

		register_taxonomy(
			$slug,
			array( 'product' ),
			array(
				'hierarchical'      => false,
				'labels'            => $labels,
				'public'            => true,
				'publicly_queryable'=> true,
				'show_ui'           => true,
				'show_admin_column' => true,
				'show_in_rest'      => true,
				'show_in_nav_menus' => true,
				'query_var'         => true,
				'rewrite'           => array(
					'slug'         => $def['rewrite'],
					'with_front'   => false,
					'hierarchical' => false,
				),
				'capabilities'      => array(
					'manage_terms' => 'manage_product_terms',
					'edit_terms'   => 'edit_product_terms',
					'delete_terms' => 'delete_product_terms',
					'assign_terms' => 'assign_product_terms',
				),
			)
		);
	}
}

/**
 * Admin diagnostic: list registered taxonomies + term counts when admin appends
 * ?luko_filters_status=1 to any admin page. Read-only.
 */
add_action( 'admin_notices', 'luko_filters_admin_status_notice' );
function luko_filters_admin_status_notice() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	if ( empty( $_GET['luko_filters_status'] ) ) {
		return;
	}
	echo '<div class="notice notice-info"><p><strong>LUKO Filters — taxonomy status</strong></p><ul style="margin-left:1.5em;list-style:disc">';
	foreach ( array_keys( luko_filters_taxonomy_defs() ) as $slug ) {
		$registered = taxonomy_exists( $slug );
		$count      = $registered ? wp_count_terms( array( 'taxonomy' => $slug, 'hide_empty' => false ) ) : 0;
		printf(
			'<li><code>%s</code> &mdash; registered: <strong>%s</strong> &mdash; terms: <strong>%d</strong></li>',
			esc_html( $slug ),
			$registered ? 'YES' : 'NO',
			(int) ( is_wp_error( $count ) ? 0 : $count )
		);
	}
	$brand_count = taxonomy_exists( 'product_brand' ) ? wp_count_terms( array( 'taxonomy' => 'product_brand', 'hide_empty' => false ) ) : 0;
	printf(
		'<li><code>product_brand</code> (WC native, for Marke) &mdash; terms: <strong>%d</strong></li>',
		(int) ( is_wp_error( $brand_count ) ? 0 : $brand_count )
	);
	echo '</ul></div>';
}
