<?php
/**
 * WAAS Niche Replace — Standalone MU-Plugin
 *
 * Separate plugin to bypass OPcache issues with waas-direct-publish.php.
 * Provides bulk str_replace across all WordPress database tables.
 *
 * Endpoint: POST /wp-json/waas-niche/v1/replace
 * Auth: Cookie + X-WP-Nonce (same as waas-pipeline endpoints)
 *
 * @version 1.0
 * @date 2026-03-18
 */

if (!defined('ABSPATH')) exit;

add_action('rest_api_init', function() {
    register_rest_route('waas-niche/v1', '/replace', [
        'methods'  => 'POST',
        'callback' => 'waas_niche_replace_handler',
        'permission_callback' => function($request) {
            return current_user_can('manage_options');
        },
    ]);

    // Health check endpoint
    register_rest_route('waas-niche/v1', '/ping', [
        'methods'  => 'GET',
        'callback' => function() {
            return rest_ensure_response([
                'success' => true,
                'plugin'  => 'waas-niche-replace',
                'version' => '1.0',
                'time'    => current_time('mysql'),
            ]);
        },
        'permission_callback' => function() {
            return current_user_can('manage_options');
        },
    ]);

    // Cleanup broken product shortcodes
    register_rest_route('waas-niche/v1', '/cleanup-shortcodes', [
        'methods'  => 'POST',
        'callback' => 'waas_niche_cleanup_shortcodes_handler',
        'permission_callback' => function($request) {
            return current_user_can('manage_options');
        },
    ]);
});

function waas_niche_cleanup_shortcodes_handler($request) {
    global $wpdb;

    $params  = $request->get_json_params();
    $dry_run = !empty($params['dry_run']);

    // Find posts with waas_product shortcodes
    $posts_with_shortcodes = $wpdb->get_results(
        "SELECT ID, post_title FROM {$wpdb->posts} WHERE post_content LIKE '%[waas_product%' AND post_status IN ('publish','draft')"
    );

    $affected = count($posts_with_shortcodes);

    if (!$dry_run && $affected > 0) {
        // Remove all [waas_product ...] shortcodes (any attributes)
        // MySQL REGEXP_REPLACE available in MySQL 8+ / MariaDB 10.0.5+
        $wpdb->query(
            "UPDATE {$wpdb->posts} SET post_content = REGEXP_REPLACE(post_content, '\\\\[waas_product[^\\\\]]*\\\\]', '') WHERE post_content LIKE '%[waas_product%'"
        );

        // Also clean up empty paragraphs left behind
        $wpdb->query(
            "UPDATE {$wpdb->posts} SET post_content = REPLACE(post_content, '<p></p>', '') WHERE post_content LIKE '%<p></p>%'"
        );

        // Clear caches
        $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '%et_divi_static%'");
        $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient%'");
        do_action('litespeed_purge_all');
        wp_cache_flush();
    }

    $post_titles = array_map(function($p) { return $p->post_title; }, $posts_with_shortcodes);

    return rest_ensure_response([
        'success'  => true,
        'results'  => [
            'affected_posts' => $affected,
            'post_titles'    => $post_titles,
            'dry_run'        => $dry_run,
        ],
    ]);
}
    global $wpdb;

    $params  = $request->get_json_params();
    $pairs   = $params['pairs'] ?? [];
    $dry_run = !empty($params['dry_run']);

    if (empty($pairs)) {
        return rest_ensure_response([
            'success' => true,
            'results' => ['pairs_processed' => 0, 'stats' => [], 'dry_run' => $dry_run],
        ]);
    }

    // Sort longest-first to avoid partial matches
    usort($pairs, function($a, $b) {
        return strlen($b['old']) - strlen($a['old']);
    });

    $stats = [];

    foreach ($pairs as $pair) {
        $old = $pair['old'] ?? '';
        $new = $pair['new'] ?? '';
        if (empty($old) || $old === $new) continue;

        $pair_stat = ['old' => $old, 'new' => $new, 'hits' => 0];

        // JSON-encoded versions for Divi 5 block attributes
        $old_enc = substr(json_encode($old), 1, -1);
        $new_enc = substr(json_encode($new), 1, -1);

        // Slug versions
        $old_slug = sanitize_title($old);
        $new_slug = sanitize_title($new);

        if ($dry_run) {
            // Count hits only
            $pair_stat['hits'] += intval($wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_content LIKE %s OR post_title LIKE %s OR post_excerpt LIKE %s",
                '%' . $wpdb->esc_like($old) . '%',
                '%' . $wpdb->esc_like($old) . '%',
                '%' . $wpdb->esc_like($old) . '%'
            )));
            $pair_stat['hits'] += intval($wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE meta_value LIKE %s AND LENGTH(meta_value) < 50000",
                '%' . $wpdb->esc_like($old) . '%'
            )));
            $pair_stat['hits'] += intval($wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->options} WHERE option_value LIKE %s AND option_name NOT LIKE '_transient%%' AND LENGTH(option_value) < 50000",
                '%' . $wpdb->esc_like($old) . '%'
            )));
            $pair_stat['hits'] += intval($wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->terms} WHERE name LIKE %s OR slug LIKE %s",
                '%' . $wpdb->esc_like($old) . '%',
                '%' . $wpdb->esc_like($old_slug) . '%'
            )));
        } else {
            // 1. wp_posts: post_content — encoded pass first, then plain
            if ($old_enc !== $old) {
                $wpdb->query($wpdb->prepare(
                    "UPDATE {$wpdb->posts} SET post_content = REPLACE(post_content, %s, %s) WHERE post_content LIKE %s",
                    $old_enc, $new_enc, '%' . $wpdb->esc_like($old_enc) . '%'
                ));
            }
            $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->posts} SET post_content = REPLACE(post_content, %s, %s) WHERE post_content LIKE %s",
                $old, $new, '%' . $wpdb->esc_like($old) . '%'
            ));

            // 2. wp_posts: post_title
            $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->posts} SET post_title = REPLACE(post_title, %s, %s) WHERE post_title LIKE %s",
                $old, $new, '%' . $wpdb->esc_like($old) . '%'
            ));

            // 3. wp_posts: post_excerpt
            $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->posts} SET post_excerpt = REPLACE(post_excerpt, %s, %s) WHERE post_excerpt LIKE %s",
                $old, $new, '%' . $wpdb->esc_like($old) . '%'
            ));

            // 4. wp_postmeta — encoded pass first, then plain
            if ($old_enc !== $old) {
                $wpdb->query($wpdb->prepare(
                    "UPDATE {$wpdb->postmeta} SET meta_value = REPLACE(meta_value, %s, %s) WHERE meta_value LIKE %s AND LENGTH(meta_value) < 50000",
                    $old_enc, $new_enc, '%' . $wpdb->esc_like($old_enc) . '%'
                ));
            }
            $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->postmeta} SET meta_value = REPLACE(meta_value, %s, %s) WHERE meta_value LIKE %s AND LENGTH(meta_value) < 50000",
                $old, $new, '%' . $wpdb->esc_like($old) . '%'
            ));

            // 5. wp_options — iterate with PHP str_replace (handles arrays/JSON)
            $opt_rows = $wpdb->get_results($wpdb->prepare(
                "SELECT option_name FROM {$wpdb->options} WHERE option_value LIKE %s AND option_name NOT LIKE '_transient%%' AND LENGTH(option_value) < 50000",
                '%' . $wpdb->esc_like($old) . '%'
            ));
            foreach ($opt_rows as $opt_row) {
                $val = get_option($opt_row->option_name);
                if (is_string($val)) {
                    $new_val = str_replace($old, $new, $val);
                    if ($new_val !== $val) { update_option($opt_row->option_name, $new_val); $pair_stat['hits']++; }
                } elseif (is_array($val)) {
                    $json = json_encode($val);
                    $new_json = str_replace($old, $new, $json);
                    if ($new_json !== $json) {
                        $decoded = json_decode($new_json, true);
                        if ($decoded !== null) { update_option($opt_row->option_name, $decoded); $pair_stat['hits']++; }
                    }
                }
            }

            // 6. wp_terms: name
            $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->terms} SET name = REPLACE(name, %s, %s) WHERE name LIKE %s",
                $old, $new, '%' . $wpdb->esc_like($old) . '%'
            ));

            // 7. wp_terms: slug
            if ($old_slug !== $new_slug && !empty($old_slug)) {
                $wpdb->query($wpdb->prepare(
                    "UPDATE {$wpdb->terms} SET slug = REPLACE(slug, %s, %s) WHERE slug LIKE %s",
                    $old_slug, $new_slug, '%' . $wpdb->esc_like($old_slug) . '%'
                ));
            }

            // 8. wp_term_taxonomy: description
            $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->term_taxonomy} SET description = REPLACE(description, %s, %s) WHERE description LIKE %s",
                $old, $new, '%' . $wpdb->esc_like($old) . '%'
            ));
        }

        $stats[] = $pair_stat;
    }

    if (!$dry_run) {
        // Clear caches
        $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '%et_divi_static%'");
        $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient%'");
        do_action('litespeed_purge_all');
        wp_cache_flush();
    }

    return rest_ensure_response([
        'success' => true,
        'results' => [
            'pairs_processed' => count($stats),
            'stats'           => $stats,
            'dry_run'         => $dry_run,
        ],
    ]);
}
