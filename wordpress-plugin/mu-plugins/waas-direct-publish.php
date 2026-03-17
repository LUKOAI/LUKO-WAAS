<?php
/**
 * WAAS Direct Publish — MU-Plugin v1.2
 * 
 * REST endpoints for content pipeline:
 * - POST /waas-pipeline/v1/publish        — Create post/page (direct SQL)
 * - POST /waas-pipeline/v1/update-content  — Update existing post/page
 * - POST /waas-pipeline/v1/update-legal    — Update legal pages (Impressum, Datenschutz, Partnerhinweis)
 * - POST /waas-pipeline/v1/export-category — Create/update WP category
 * - GET  /waas-pipeline/v1/verify/{id}     — Verify encoding
 * - GET  /waas-pipeline/v1/find-page/{slug}— Find page by slug
 * 
 * @version 1.3
 * @date 2026-03-09
 * 
 * FIX v1.3: extract-texts now handles "innerContent" wrapper in Divi 5 blocks
 *           + added subhead/body extraction for fullwidth-header and blurb modules
 */

if (!defined('ABSPATH')) exit;

add_action('rest_api_init', function() {
    $ns = 'waas-pipeline/v1';
    $auth = function() { return current_user_can('publish_posts'); };
    
    register_rest_route($ns, '/publish', [
        'methods' => 'POST', 'callback' => 'waas_pipeline_publish', 'permission_callback' => $auth
    ]);
    register_rest_route($ns, '/update-content', [
        'methods' => 'POST', 'callback' => 'waas_pipeline_update_content', 'permission_callback' => $auth
    ]);
    register_rest_route($ns, '/update-legal', [
        'methods' => 'POST', 'callback' => 'waas_pipeline_update_legal', 'permission_callback' => $auth
    ]);
    register_rest_route($ns, '/export-category', [
        'methods' => 'POST', 'callback' => 'waas_pipeline_export_category', 'permission_callback' => $auth
    ]);
    register_rest_route($ns, '/verify/(?P<id>\d+)', [
        'methods' => 'GET', 'callback' => 'waas_pipeline_verify', 'permission_callback' => $auth
    ]);
    register_rest_route($ns, '/find-page/(?P<slug>[a-z0-9-]+)', [
        'methods' => 'GET', 'callback' => 'waas_pipeline_find_page', 'permission_callback' => $auth
    ]);
    register_rest_route($ns, '/set-branding', [
        'methods' => 'POST', 'callback' => 'waas_pipeline_set_branding', 'permission_callback' => $auth
    ]);
    register_rest_route($ns, '/site-check', [
        'methods' => 'GET', 'callback' => 'waas_pipeline_site_check', 'permission_callback' => $auth
    ]);
    register_rest_route($ns, '/set-menu', [
        'methods' => 'POST', 'callback' => 'waas_pipeline_set_menu', 'permission_callback' => $auth
    ]);
    register_rest_route($ns, '/get-site-structure', [
        'methods' => 'GET', 'callback' => 'waas_pipeline_get_site_structure', 'permission_callback' => $auth
    ]);
    register_rest_route($ns, '/cleanup', [
        'methods' => 'POST', 'callback' => 'waas_pipeline_cleanup', 'permission_callback' => $auth
    ]);
    register_rest_route($ns, '/extract-texts/(?P<id>\d+)', [
        'methods' => 'GET', 'callback' => 'waas_pipeline_extract_texts', 'permission_callback' => $auth
    ]);
    register_rest_route($ns, '/replace-texts', [
        'methods' => 'POST', 'callback' => 'waas_pipeline_replace_texts', 'permission_callback' => $auth
    ]);
});

// ============================================================
// PUBLISH — Create new post OR page
// ============================================================
function waas_pipeline_publish($request) {
    global $wpdb;
    $params = $request->get_json_params();
    
    if (empty($params['title'])) {
        return new WP_Error('missing_title', 'Title is required', ['status' => 400]);
    }
    
    // Determine post type (post or page)
    $post_type = sanitize_text_field($params['post_type'] ?? 'post');
    if (!in_array($post_type, ['post', 'page'])) $post_type = 'post';
    
    // Check if we should UPDATE existing instead of creating new
    $existing_id = intval($params['existing_id'] ?? 0);
    
    if ($existing_id && get_post($existing_id)) {
        // UPDATE existing post/page
        return waas_pipeline_update_existing($existing_id, $params);
    }
    
    // CREATE new
    $post_data = [
        'post_title'   => sanitize_text_field($params['title']),
        'post_name'    => sanitize_title($params['slug'] ?? ''),
        'post_content' => '<!-- waas-pipeline-placeholder -->',
        'post_excerpt' => wp_kses_post($params['excerpt'] ?? ''),
        'post_status'  => sanitize_text_field($params['status'] ?? 'draft'),
        'post_type'    => $post_type,
        'post_author'  => get_current_user_id(),
    ];
    
    // Categories (only for posts)
    if ($post_type === 'post' && !empty($params['categories'])) {
        $cat_ids = [];
        foreach ((array) $params['categories'] as $cat_name) {
            $term = get_term_by('name', $cat_name, 'category');
            if ($term) { $cat_ids[] = $term->term_id; }
            else {
                $new_term = wp_insert_term($cat_name, 'category');
                if (!is_wp_error($new_term)) $cat_ids[] = $new_term['term_id'];
            }
        }
        if (!empty($cat_ids)) $post_data['post_category'] = $cat_ids;
    }
    
    // Parent page (for hierarchical pages)
    if ($post_type === 'page' && !empty($params['parent_id'])) {
        $post_data['post_parent'] = intval($params['parent_id']);
    }
    
    $post_id = wp_insert_post($post_data, true);
    if (is_wp_error($post_id)) {
        return new WP_Error('create_failed', $post_id->get_error_message(), ['status' => 500]);
    }
    
    // Set REAL content via direct SQL
    if (!empty($params['content'])) {
        $content = $params['content'];
        if (!empty($params['illustrations']) && is_array($params['illustrations'])) {
            $content = waas_insert_illustrations($content, $params['illustrations']);
        }
        $wpdb->update($wpdb->posts, ['post_content' => $content], ['ID' => $post_id], ['%s'], ['%d']);
        clean_post_cache($post_id);
    }
    
    // Divi Builder meta (for Divi-based content)
    $use_divi = ($params['use_divi'] ?? true);
    if ($use_divi !== false) {
        update_post_meta($post_id, '_et_pb_use_builder', 'on');
        update_post_meta($post_id, '_et_pb_page_layout', $post_type === 'page' ? 'et_full_width_page' : 'et_right_sidebar');
    }
    
    // RankMath SEO
    if (!empty($params['seo'])) {
        $seo = $params['seo'];
        if (!empty($seo['seo_title'])) update_post_meta($post_id, 'rank_math_title', sanitize_text_field($seo['seo_title']));
        if (!empty($seo['meta_description'])) update_post_meta($post_id, 'rank_math_description', sanitize_text_field($seo['meta_description']));
        if (!empty($seo['focus_keyword'])) update_post_meta($post_id, 'rank_math_focus_keyword', sanitize_text_field($seo['focus_keyword']));
    }
    
    // Featured Image
    if (!empty($params['featured_media'])) {
        set_post_thumbnail($post_id, intval($params['featured_media']));
    }
    
    // Tags (only for posts)
    if ($post_type === 'post' && !empty($params['tags'])) {
        wp_set_post_tags($post_id, $params['tags']);
    }
    
    // Verify encoding
    $saved = $wpdb->get_var($wpdb->prepare("SELECT post_content FROM {$wpdb->posts} WHERE ID = %d", $post_id));
    $encoding_ok = !(strpos($saved, 'u003c') !== false && strpos($saved, '\\u003c') === false);
    
    return rest_ensure_response([
        'success'        => true,
        'post_id'        => $post_id,
        'post_url'       => get_permalink($post_id),
        'post_type'      => $post_type,
        'encoding_ok'    => $encoding_ok,
        'content_length' => strlen($saved),
        'meta_set'       => [
            'divi_builder'   => get_post_meta($post_id, '_et_pb_use_builder', true),
            'rank_math_kw'   => get_post_meta($post_id, 'rank_math_focus_keyword', true) ? true : false,
            'featured_media' => has_post_thumbnail($post_id),
        ],
    ]);
}

// ============================================================
// UPDATE EXISTING post/page
// ============================================================
function waas_pipeline_update_existing($post_id, $params) {
    global $wpdb;
    
    $updates = [];
    if (!empty($params['title'])) $updates['post_title'] = sanitize_text_field($params['title']);
    if (!empty($params['slug'])) $updates['post_name'] = sanitize_title($params['slug']);
    if (!empty($params['excerpt'])) $updates['post_excerpt'] = wp_kses_post($params['excerpt']);
    if (!empty($params['status'])) $updates['post_status'] = sanitize_text_field($params['status']);
    
    // Update basic fields (safe — no content here)
    if (!empty($updates)) {
        $wpdb->update($wpdb->posts, $updates, ['ID' => $post_id], array_fill(0, count($updates), '%s'), ['%d']);
    }
    
    // Update content via direct SQL
    if (!empty($params['content'])) {
        $content = $params['content'];
        if (!empty($params['illustrations']) && is_array($params['illustrations'])) {
            $content = waas_insert_illustrations($content, $params['illustrations']);
        }
        $wpdb->update($wpdb->posts, ['post_content' => $content], ['ID' => $post_id], ['%s'], ['%d']);
    }
    
    clean_post_cache($post_id);
    
    // Meta updates
    if (!empty($params['seo'])) {
        $seo = $params['seo'];
        if (!empty($seo['seo_title'])) update_post_meta($post_id, 'rank_math_title', sanitize_text_field($seo['seo_title']));
        if (!empty($seo['meta_description'])) update_post_meta($post_id, 'rank_math_description', sanitize_text_field($seo['meta_description']));
        if (!empty($seo['focus_keyword'])) update_post_meta($post_id, 'rank_math_focus_keyword', sanitize_text_field($seo['focus_keyword']));
    }
    
    if (!empty($params['featured_media'])) {
        set_post_thumbnail($post_id, intval($params['featured_media']));
    }
    
    $use_divi = ($params['use_divi'] ?? null);
    if ($use_divi === true) {
        update_post_meta($post_id, '_et_pb_use_builder', 'on');
    } elseif ($use_divi === false) {
        delete_post_meta($post_id, '_et_pb_use_builder');
    }
    
    return rest_ensure_response([
        'success'   => true,
        'post_id'   => $post_id,
        'post_url'  => get_permalink($post_id),
        'action'    => 'updated',
    ]);
}

// ============================================================
// UPDATE LEGAL PAGES — Impressum, Datenschutz, Partnerhinweis
// ============================================================
function waas_pipeline_update_legal($request) {
    global $wpdb;
    $params = $request->get_json_params();
    
    $results = [];
    $site_name = sanitize_text_field($params['site_name'] ?? get_bloginfo('name'));
    $site_domain = sanitize_text_field($params['site_domain'] ?? $_SERVER['HTTP_HOST']);
    $niche_description = sanitize_text_field($params['niche_description'] ?? '');
    $partner_tag = sanitize_text_field($params['partner_tag'] ?? '');
    
    // Company data (same for all sites)
    $company = [
        'name'     => 'NETANALIZA LTD',
        'address'  => '71-75 Shelton Street, Covent Garden',
        'city'     => 'London WC2H 9JQ',
        'country'  => 'United Kingdom',
        'number'   => '16499220',
        'person'   => 'Sylwia Koronczok',
        'phone'    => '+48 795 055 173',
        'email'    => 'support@netanaliza.com',
    ];
    
    // Override with params if provided
    foreach (['name','address','city','country','number','person','phone','email'] as $key) {
        if (!empty($params['company_' . $key])) {
            $company[$key] = sanitize_text_field($params['company_' . $key]);
        }
    }
    
    // Process each legal page type
    $pages_to_update = $params['pages'] ?? ['impressum', 'datenschutz', 'partnerhinweis'];
    
    foreach ((array)$pages_to_update as $page_type) {
        $result = waas_update_single_legal_page($page_type, $company, $site_name, $site_domain, $niche_description, $partner_tag);
        $results[$page_type] = $result;
    }
    
    // ================================================================
    // FULL SITE IDENTITY FIX — fixes EVERYTHING in one shot
    // ================================================================
    $year = date('Y');
    $footer_text = '© ' . $year . ' ' . $site_name . ' | * Affiliate-Link (Werbung). Preise inkl. MwSt., ggf. zzgl. Versandkosten. Als Amazon-Partner verdienen wir an qualifizierten Käufen eine kleine Provision, die den Produktpreis nicht beeinflusst.';
    
    // Old names from cloning (search for ALL possible remnants)
    $old_names = ['MeißelTechnik', 'Meisseltechnik', 'MeisselTechnik', 'Meißeltechnik',
                  'Passgenaue LKW-Fußmatten', 'Passgenaue LKW-Fussmatten', 'LKW-Fußmatten',
                  'SägeblattTechnik', 'Saegeblatttechnik', 'BetonBohrTechnik', 'ErdlochBohren',
                  'KernbohrungTechnik', 'BohradapterTechnik', 'AbwasserrohrTechnik'];
    
    // Slug of THIS site (for domain-specific replacements)
    $site_slug = explode('.', $site_domain)[0]; // e.g. "reservekanister"
    $partner_tag_value = !empty($partner_tag) ? $partner_tag : $site_slug . '-21';
    
    // --- FIX 1: WordPress Site Title ---
    update_option('blogname', $site_name);
    $results['blogname'] = $site_name;
    
    // --- FIX 2: Divi et_divi option (footer_credits + custom_css) ---
    $et_divi = get_option('et_divi', []);
    if (is_array($et_divi)) {
        $et_divi['footer_credits'] = $footer_text;
        $et_divi['custom_footer_credits'] = $footer_text;
        
        // Fix Custom CSS (Eigene CSS) — #footer-info::after content
        if (!empty($et_divi['custom_css'])) {
            $css = $et_divi['custom_css'];
            foreach ($old_names as $old) {
                $css = str_replace($old, $site_name, $css);
            }
            $css = preg_replace('/© \d{4}/', '© ' . $year, $css);
            $et_divi['custom_css'] = $css;
        }
        
        update_option('et_divi', $et_divi);
        $results['et_divi'] = 'fixed';
    }
    
    // --- FIX 3: Theme Customizer (theme_mods_Divi) ---
    $theme_mods = get_option('theme_mods_Divi', []);
    if (is_array($theme_mods)) {
        $theme_mods['footer_credits'] = $footer_text;
        $theme_mods['custom_footer_credits'] = $footer_text;
        
        // Fix custom_css in Customizer too
        if (!empty($theme_mods['custom_css_post_id'])) {
            // Customizer stores CSS in a special post
            $css_post_id = intval($theme_mods['custom_css_post_id']);
            if ($css_post_id > 0) {
                $css_content = $wpdb->get_var($wpdb->prepare(
                    "SELECT post_content FROM {$wpdb->posts} WHERE ID = %d", $css_post_id
                ));
                if ($css_content) {
                    $new_css = $css_content;
                    foreach ($old_names as $old) {
                        $new_css = str_replace($old, $site_name, $new_css);
                    }
                    $new_css = preg_replace('/© \d{4}/', '© ' . $year, $new_css);
                    if ($new_css !== $css_content) {
                        $wpdb->update($wpdb->posts, ['post_content' => $new_css], ['ID' => $css_post_id]);
                        clean_post_cache($css_post_id);
                    }
                }
            }
        }
        
        update_option('theme_mods_Divi', $theme_mods);
        $results['theme_mods'] = 'fixed';
    }
    
    // --- FIX 3b: WordPress Customizer CSS post (custom_css type) ---
    $custom_css_posts = $wpdb->get_results("
        SELECT ID, post_content FROM {$wpdb->posts} 
        WHERE post_type = 'custom_css' AND post_status = 'publish'
    ");
    foreach ($custom_css_posts as $cp) {
        $new_css = $cp->post_content;
        foreach ($old_names as $old) {
            $new_css = str_replace($old, $site_name, $new_css);
        }
        $new_css = preg_replace('/© \d{4}/', '© ' . $year, $new_css);
        if ($new_css !== $cp->post_content) {
            $wpdb->update($wpdb->posts, ['post_content' => $new_css], ['ID' => $cp->ID]);
            clean_post_cache($cp->ID);
            $results['custom_css_post'] = 'fixed (ID: ' . $cp->ID . ')';
        }
    }
    
    // --- FIX 4: Amazon Partner Tag ---
    $old_tag = get_option('waas_pm_amazon_partner_tag', '');
    if ($old_tag !== $partner_tag_value) {
        update_option('waas_pm_amazon_partner_tag', $partner_tag_value);
        $results['partner_tag'] = $old_tag . ' → ' . $partner_tag_value;
    }
    
    $api_settings = get_option('waas_pm_amazon_api_settings', []);
    if (is_array($api_settings) && isset($api_settings['partner_tag'])) {
        if ($api_settings['partner_tag'] !== $partner_tag_value) {
            $api_settings['partner_tag'] = $partner_tag_value;
            update_option('waas_pm_amazon_api_settings', $api_settings);
            $results['api_partner_tag'] = $partner_tag_value;
        }
    }
    
    // --- FIX 5: WooCommerce Store Name ---
    $wc_store = get_option('woocommerce_pos_store_name', '');
    if ($wc_store && $wc_store !== $site_name) {
        update_option('woocommerce_pos_store_name', $site_name);
        $results['wc_store_name'] = $site_name;
    }
    
    // --- FIX 6: RankMath SEO site-wide ---
    $rm_titles = get_option('rank-math-options-titles', []);
    if (is_array($rm_titles)) {
        $rm_titles['knowledgegraph_name'] = $site_name;
        $rm_titles['website_name'] = $site_name;
        if (!empty($niche_description)) {
            $rm_titles['knowledgegraph_description'] = $niche_description;
        }
        $rm_titles['homepage_title'] = $site_name . ' — ' . ($niche_description ?: 'Ihr Experte auf Amazon.de');
        update_option('rank-math-options-titles', $rm_titles);
        $results['rankmath'] = 'fixed';
    }
    
    // --- FIX 7: Postmeta — rank_math_description with old names ---
    $old_meta = $wpdb->get_results("
        SELECT post_id, meta_key, meta_value FROM {$wpdb->postmeta}
        WHERE meta_key IN ('rank_math_description', 'rank_math_title', '_wp_attachment_image_alt')
        AND (" . implode(' OR ', array_map(function($old) use ($wpdb) {
            return "meta_value LIKE '%" . $wpdb->esc_like($old) . "%'";
        }, $old_names)) . ")
    ");
    $meta_fixes = 0;
    foreach ($old_meta as $m) {
        $new_val = $m->meta_value;
        foreach ($old_names as $old) {
            $new_val = str_replace($old, $site_name, $new_val);
        }
        if ($new_val !== $m->meta_value) {
            update_post_meta($m->post_id, $m->meta_key, $new_val);
            $meta_fixes++;
        }
    }
    $results['postmeta_fixes'] = $meta_fixes;
    
    // --- FIX 8: Scan ALL options for old names (catch-all) ---
    $option_fixes = 0;
    foreach ($old_names as $old) {
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT option_name FROM {$wpdb->options} 
             WHERE option_value LIKE %s 
             AND option_name NOT LIKE '_transient%%'
             AND option_name NOT LIKE '_site_transient%%'
             AND LENGTH(option_value) < 50000",
            '%' . $wpdb->esc_like($old) . '%'
        ));
        foreach ($rows as $row) {
            $val = get_option($row->option_name);
            if (is_string($val)) {
                $new_val = str_replace($old, $site_name, $val);
                $new_val = preg_replace('/© \d{4}/', '© ' . $year, $new_val);
                if ($new_val !== $val) { update_option($row->option_name, $new_val); $option_fixes++; }
            } elseif (is_array($val)) {
                $json = json_encode($val);
                $new_json = str_replace($old, $site_name, $json);
                $new_json = preg_replace('/© \d{4}/', '© ' . $year, $new_json);
                if ($new_json !== $json) {
                    $decoded = json_decode($new_json, true);
                    if ($decoded !== null) { update_option($row->option_name, $decoded); $option_fixes++; }
                }
            }
        }
    }
    $results['option_scan_fixes'] = $option_fixes;
    
    // --- FIX 9: waas-product-manager.php footer (file on disk) ---
    $pm_path = ABSPATH . 'wp-content/plugins/waas-product-manager-v3/waas-product-manager.php';
    if (file_exists($pm_path)) {
        $pm_content = file_get_contents($pm_path);
        $pm_new = $pm_content;
        foreach ($old_names as $old) {
            $pm_new = str_replace($old, $site_name, $pm_new);
        }
        $pm_new = preg_replace('/© \d{4}/', '© ' . $year, $pm_new);
        if ($pm_new !== $pm_content) {
            file_put_contents($pm_path, $pm_new);
            $results['product_manager_php'] = 'fixed';
        }
    }
    
    // --- FIX 10: schema mu-plugin (meisseltechnik-schema.php) ---
    $schema_path = ABSPATH . 'wp-content/mu-plugins/meisseltechnik-schema.php';
    if (file_exists($schema_path)) {
        $sc_content = file_get_contents($schema_path);
        $sc_new = $sc_content;
        foreach ($old_names as $old) {
            $sc_new = str_replace($old, $site_name, $sc_new);
        }
        // Also fix lowercase domain references
        $sc_new = str_replace('meisseltechnik.lk24.shop', $site_domain, $sc_new);
        if ($sc_new !== $sc_content) {
            file_put_contents($schema_path, $sc_new);
            $results['schema_plugin'] = 'fixed';
        }
    }
    
    // --- FIX 11: Clear ALL caches ---
    // Divi static CSS
    $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '%et_divi_static%'");
    // WordPress transients
    $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient%'");
    // Divi cache function
    if (function_exists('et_core_clear_wp_cache')) et_core_clear_wp_cache();
    // WordPress object cache
    if (function_exists('wp_cache_flush')) wp_cache_flush();
    // LiteSpeed Cache
    if (class_exists('LiteSpeed_Cache_API')) {
        LiteSpeed_Cache_API::purge_all();
    } elseif (function_exists('litespeed_purge_all')) {
        litespeed_purge_all();
    }
    // Try LiteSpeed via do_action
    do_action('litespeed_purge_all');
    
    $results['cache_cleared'] = true;
    
    return rest_ensure_response([
        'success' => true,
        'site_name' => $site_name,
        'partner_tag' => $partner_tag_value,
        'results' => $results,
    ]);
}

function waas_update_single_legal_page($type, $company, $site_name, $site_domain, $niche_desc, $partner_tag) {
    global $wpdb;
    
    // Find existing page by slug
    $slugs = [
        'impressum'       => ['impressum'],
        'datenschutz'     => ['datenschutzerklaerung', 'datenschutzerklarung', 'datenschutz'],
        'partnerhinweis'  => ['amazon-partnerhinweis', 'partnerhinweis', 'transparenzhinweis', 'affiliate-hinweis'],
    ];
    
    $page_id = null;
    foreach ($slugs[$type] ?? [] as $slug) {
        $page = get_page_by_path($slug);
        if ($page) { $page_id = $page->ID; break; }
    }
    
    if (!$page_id) {
        return ['success' => false, 'error' => 'Page not found for: ' . $type];
    }
    
    // Generate content from template
    $content = waas_legal_template($type, $company, $site_name, $site_domain, $niche_desc, $partner_tag);
    
    // Direct SQL update — no Divi, classic HTML
    $wpdb->update(
        $wpdb->posts,
        ['post_content' => $content],
        ['ID' => $page_id],
        ['%s'], ['%d']
    );
    
    // Disable Divi Builder for legal pages (classic editor)
    delete_post_meta($page_id, '_et_pb_use_builder');
    update_post_meta($page_id, '_et_pb_page_layout', 'et_no_sidebar');
    
    // RankMath for legal pages
    $titles = [
        'impressum'      => 'Impressum — ' . $site_name,
        'datenschutz'    => 'Datenschutzerklärung — ' . $site_name,
        'partnerhinweis' => 'Amazon-Partnerhinweis — ' . $site_name,
    ];
    update_post_meta($page_id, 'rank_math_title', $titles[$type] ?? '');
    
    clean_post_cache($page_id);
    
    return ['success' => true, 'page_id' => $page_id, 'slug' => get_post_field('post_name', $page_id)];
}

function waas_legal_template($type, $co, $site_name, $domain, $niche, $tag) {
    $templates = [];
    
    // ---- IMPRESSUM ----
    $templates['impressum'] = '<h2>Impressum</h2>
<h3>Angaben gemäß § 5 DDG</h3>
<p><strong>' . esc_html($co['name']) . '</strong><br>
' . esc_html($co['address']) . '<br>
' . esc_html($co['city']) . '<br>
' . esc_html($co['country']) . '</p>
<p>Company Number: ' . esc_html($co['number']) . '</p>
<p><strong>Vertreten durch:</strong> ' . esc_html($co['person']) . '</p>

<h3>Kontakt</h3>
<p>Telefon: ' . esc_html($co['phone']) . '<br>
E-Mail: <a href="mailto:' . esc_attr($co['email']) . '">' . esc_html($co['email']) . '</a></p>

<h3>Verantwortlich für den Inhalt gemäß § 18 Abs. 2 MStV</h3>
<p>' . esc_html($co['person']) . '<br>' . esc_html($co['address']) . '<br>' . esc_html($co['city']) . '<br>' . esc_html($co['country']) . '</p>

<h3>EU-Streitschlichtung</h3>
<p>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener">https://ec.europa.eu/consumers/odr/</a><br>
Unsere E-Mail-Adresse finden Sie oben im Impressum.</p>
<p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>

<h3>Haftungsausschluss</h3>
<h4>Haftung für Inhalte</h4>
<p>Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen. Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen.</p>

<h4>Haftung für Links</h4>
<p>Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.</p>

<h4>Urheberrecht</h4>
<p>Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.</p>

<h3>Amazon-Partnerprogramm</h3>
<p>' . esc_html($site_name) . ' (' . esc_html($domain) . ') ist Teilnehmer des Amazon EU-Partnerprogramms, einem Affiliate-Werbeprogramm, das zur Bereitstellung eines Mediums für Webseiten konzipiert wurde, mittels dessen durch die Platzierung von Werbeanzeigen und Links zu amazon.de Werbekostenerstattungen verdient werden können.</p>
<p><strong>Als Amazon-Partner verdienen wir an qualifizierten Verkäufen.</strong></p>';

    // ---- DATENSCHUTZ ----
    $templates['datenschutz'] = '<h2>Datenschutzerklärung</h2>

<h3>Datenschutz auf einen Blick</h3>
<h4>Allgemeine Hinweise</h4>
<p>Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.</p>

<h4>Datenerfassung auf dieser Website</h4>
<p><strong>Wer ist verantwortlich für die Datenerfassung auf dieser Website?</strong></p>
<p>Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber:</p>
<p>' . esc_html($co['name']) . '<br>
' . esc_html($co['address']) . '<br>
' . esc_html($co['city']) . '<br>
' . esc_html($co['country']) . '<br>
Company Number: ' . esc_html($co['number']) . '</p>
<p>Vertreten durch: ' . esc_html($co['person']) . '<br>
E-Mail: <a href="mailto:' . esc_attr($co['email']) . '">' . esc_html($co['email']) . '</a><br>
Telefon: ' . esc_html($co['phone']) . '</p>

<p><strong>Wie erfassen wir Ihre Daten?</strong></p>
<p>Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese mitteilen. Andere Daten werden automatisch oder nach Ihrer Einwilligung beim Besuch der Website durch unsere IT-Systeme erfasst (z.B. Internetbrowser, Betriebssystem, Uhrzeit des Seitenaufrufs).</p>

<p><strong>Wofür nutzen wir Ihre Daten?</strong></p>
<p>Ein Teil der Daten wird erhoben, um eine fehlerfreie Bereitstellung der Website zu gewährleisten. Andere Daten können zur Analyse Ihres Nutzerverhaltens verwendet werden.</p>

<p><strong>Welche Rechte haben Sie bezüglich Ihrer Daten?</strong></p>
<p>Sie haben jederzeit das Recht auf unentgeltliche Auskunft über Herkunft, Empfänger und Zweck Ihrer gespeicherten personenbezogenen Daten. Sie haben außerdem ein Recht auf Berichtigung oder Löschung dieser Daten.</p>

<h3>Hosting</h3>
<h4>Hostinger</h4>
<p>Wir hosten unsere Website bei Hostinger. Anbieter ist die Hostinger International Ltd., 61 Lordou Vironos str., 6023 Larnaca, Zypern.</p>
<p>Details entnehmen Sie der Datenschutzerklärung von Hostinger: <a href="https://www.hostinger.de/datenschutzrichtlinie" target="_blank" rel="noopener">https://www.hostinger.de/datenschutzrichtlinie</a></p>

<h3>Allgemeine Hinweise und Pflichtinformationen</h3>
<h4>Datenschutz</h4>
<p>Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend den gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.</p>

<h4>Hinweis zur verantwortlichen Stelle</h4>
<p>Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:</p>
<p>' . esc_html($co['name']) . '<br>
' . esc_html($co['person']) . '<br>
' . esc_html($co['address']) . '<br>
' . esc_html($co['city']) . '<br>
' . esc_html($co['country']) . '</p>
<p>E-Mail: ' . esc_html($co['email']) . '</p>

<h4>Widerruf Ihrer Einwilligung zur Datenverarbeitung</h4>
<p>Viele Datenverarbeitungsvorgänge sind nur mit Ihrer ausdrücklichen Einwilligung möglich. Sie können eine bereits erteilte Einwilligung jederzeit widerrufen. Die Rechtmäßigkeit der bis zum Widerruf erfolgten Datenverarbeitung bleibt vom Widerruf unberührt.</p>

<h4>Beschwerderecht bei der zuständigen Aufsichtsbehörde</h4>
<p>Im Falle von Verstößen gegen die DSGVO steht den Betroffenen ein Beschwerderecht bei einer Aufsichtsbehörde zu.</p>

<h4>Recht auf Datenübertragbarkeit</h4>
<p>Sie haben das Recht, Daten, die wir auf Grundlage Ihrer Einwilligung oder in Erfüllung eines Vertrags automatisiert verarbeiten, an sich oder an einen Dritten in einem gängigen, maschinenlesbaren Format aushändigen zu lassen.</p>

<h4>SSL- bzw. TLS-Verschlüsselung</h4>
<p>Diese Seite nutzt aus Sicherheitsgründen eine SSL- bzw. TLS-Verschlüsselung. Eine verschlüsselte Verbindung erkennen Sie daran, dass die Adresszeile des Browsers von „http://" auf „https://" wechselt.</p>

<h3>Datenerfassung auf dieser Website</h3>
<h4>Cookies</h4>
<p>Unsere Internetseiten verwenden so genannte „Cookies". Cookies sind kleine Datenpakete und richten auf Ihrem Endgerät keinen Schaden an. Sie werden entweder vorübergehend für die Dauer einer Sitzung (Session-Cookies) oder dauerhaft (permanente Cookies) auf Ihrem Endgerät gespeichert.</p>

<h4>Server-Log-Dateien</h4>
<p>Der Provider der Seiten erhebt und speichert automatisch Informationen in so genannten Server-Log-Dateien, die Ihr Browser automatisch an uns übermittelt (Browsertyp/-version, Betriebssystem, Referrer URL, Hostname, Uhrzeit der Serveranfrage, IP-Adresse).</p>

<h3>Plugins und Tools</h3>
<h4>Amazon-Partnerprogramm</h4>
<p>Die Betreiber dieser Seiten nehmen am Amazon EU-Partnerprogramm teil. Auf unseren Seiten werden durch Amazon Werbeanzeigen und Links zur Seite von Amazon.de eingebunden, an denen wir über Werbekostenerstattung Geld verdienen können.</p>
<p>Amazon setzt dazu Cookies ein, um die Herkunft der Bestellungen nachvollziehen zu können. Dadurch kann Amazon erkennen, dass Sie den Partnerlink auf unserer Website geklickt haben.</p>
<p>Die Speicherung von „Amazon-Cookies" erfolgt auf Grundlage von Art. 6 lit. f DSGVO. Der Websitebetreiber hat hieran ein berechtigtes Interesse, da nur durch die Cookies die Höhe seiner Affiliate-Vergütung feststellbar ist.</p>
<p>Weitere Informationen zur Datennutzung durch Amazon erhalten Sie in der <a href="https://www.amazon.de/gp/help/customer/display.html/ref=footer_privacy?ie=UTF8&nodeId=3312401" target="_blank" rel="noopener">Datenschutzerklärung von Amazon</a>.</p>

<h4>WooCommerce</h4>
<p>Auf dieser Website nutzen wir WooCommerce zur Produktdarstellung. WooCommerce ist ein Plugin der Automattic Inc., 60 29th Street #343, San Francisco, CA 94110-4929, USA.</p>';

    // ---- PARTNERHINWEIS ----
    $templates['partnerhinweis'] = '<h2>Transparenzhinweis</h2>
<p>Diese Website enthält Affiliate-Links zu Produkten auf Amazon.de.</p>

<h3>Was bedeutet das?</h3>
<p>Wenn Sie auf einen unserer Links klicken und anschließend ein Produkt auf Amazon kaufen, erhalten wir eine kleine Provision von Amazon.</p>
<p><strong>Für Sie entstehen dabei KEINE zusätzlichen Kosten</strong> – der Preis bleibt exakt gleich. Die Provision zahlt Amazon aus seinem eigenen Budget, nicht aus Ihrer Tasche.</p>

<h3>Warum Affiliate-Links?</h3>
<p>Die Einnahmen aus dem Amazon Partnerprogramm helfen uns, diese Website zu betreiben und regelmäßig mit neuen Ratgebern, Anleitungen und Produktvergleichen zu versorgen. Ohne diese Einnahmen wäre der kostenlose Zugang zu unseren Inhalten nicht möglich.</p>

<h3>Unsere Verpflichtung</h3>
<p>Affiliate-Links beeinflussen unsere Bewertungen NICHT. Wir empfehlen nur Produkte, von denen wir überzeugt sind und die wir für praxistauglich halten.</p>
' . ($niche ? '<p>Diese Website konzentriert sich auf ' . esc_html($niche) . '.</p>' : '') . '

<h3>Kennzeichnung</h3>
<p>Alle Links zu Amazon.de sind Affiliate-Links. Wenn Sie einen Link sehen, der zu Amazon führt, handelt es sich um einen Affiliate-Link.</p>

<h3>Amazon Partnerprogramm</h3>
<p>Wir sind offizieller Teilnehmer am Amazon EU-Partnerprogramm:</p>
<p><em>„Als Amazon-Partner verdienen wir an qualifizierten Verkäufen."</em></p>
<p>Weitere Informationen: <a href="https://partnernet.amazon.de/help/operating/agreement" target="_blank" rel="noopener">Amazon Partnerprogramm Teilnahmebedingungen</a></p>

<h3>Unabhängigkeit und Markenrechte</h3>
<p>Diese Website steht in keiner geschäftlichen Verbindung zu den genannten Produktherstellern. Alle genannten Marken sind eingetragene Warenzeichen der jeweiligen Hersteller. Die Verwendung der Markennamen erfolgt ausschließlich zur Beschreibung und Identifikation der vorgestellten Produkte.</p>

<h3>Fragen?</h3>
<p>Bei Fragen zu unserer Affiliate-Partnerschaft kontaktieren Sie uns unter: <a href="mailto:' . esc_attr($co['email']) . '">' . esc_html($co['email']) . '</a></p>';

    return $templates[$type] ?? '';
}

// ============================================================
// EXPORT CATEGORY
// ============================================================
function waas_pipeline_export_category($request) {
    $params = $request->get_json_params();
    
    $name = sanitize_text_field($params['name'] ?? '');
    $slug = sanitize_title($params['slug'] ?? '');
    $description = wp_kses_post($params['description'] ?? '');
    $parent_slug = sanitize_title($params['parent_slug'] ?? '');
    
    if (!$name) {
        return new WP_Error('missing_name', 'Category name required', ['status' => 400]);
    }
    
    $parent_id = 0;
    if ($parent_slug) {
        $parent = get_term_by('slug', $parent_slug, 'category');
        if ($parent) $parent_id = $parent->term_id;
    }
    
    // Check if exists
    $existing = get_term_by('slug', $slug ?: sanitize_title($name), 'category');
    
    if ($existing) {
        // Update
        wp_update_term($existing->term_id, 'category', [
            'name'        => $name,
            'slug'        => $slug,
            'description' => $description,
            'parent'      => $parent_id,
        ]);
        
        // RankMath for category
        if (!empty($params['seo_title'])) update_term_meta($existing->term_id, 'rank_math_title', sanitize_text_field($params['seo_title']));
        if (!empty($params['seo_description'])) update_term_meta($existing->term_id, 'rank_math_description', sanitize_text_field($params['seo_description']));
        
        return rest_ensure_response([
            'success' => true, 'action' => 'updated',
            'term_id' => $existing->term_id, 'slug' => $existing->slug,
        ]);
    } else {
        // Create
        $result = wp_insert_term($name, 'category', [
            'slug'        => $slug,
            'description' => $description,
            'parent'      => $parent_id,
        ]);
        
        if (is_wp_error($result)) {
            return new WP_Error('create_failed', $result->get_error_message(), ['status' => 500]);
        }
        
        if (!empty($params['seo_title'])) update_term_meta($result['term_id'], 'rank_math_title', sanitize_text_field($params['seo_title']));
        if (!empty($params['seo_description'])) update_term_meta($result['term_id'], 'rank_math_description', sanitize_text_field($params['seo_description']));
        
        return rest_ensure_response([
            'success' => true, 'action' => 'created',
            'term_id' => $result['term_id'], 'slug' => $slug,
        ]);
    }
}

// ============================================================
// FIND PAGE BY SLUG
// ============================================================
function waas_pipeline_find_page($request) {
    $slug = sanitize_title($request['slug']);
    $page = get_page_by_path($slug);
    
    if (!$page) {
        return rest_ensure_response(['found' => false, 'slug' => $slug]);
    }
    
    return rest_ensure_response([
        'found'    => true,
        'page_id'  => $page->ID,
        'title'    => $page->post_title,
        'slug'     => $page->post_name,
        'status'   => $page->post_status,
        'type'     => $page->post_type,
        'url'      => get_permalink($page->ID),
    ]);
}

// ============================================================
// INSERT ILLUSTRATIONS
// ============================================================
function waas_insert_illustrations($content, $illustrations) {
    $endTag = '<!-- /wp:divi/section -->';
    $positions = [];
    $offset = 0;
    while (($pos = strpos($content, $endTag, $offset)) !== false) {
        $positions[] = $pos + strlen($endTag);
        $offset = $pos + strlen($endTag);
    }
    
    $total = count($positions);
    if ($total < 2) return $content;
    
    $inserts = [];
    foreach ($illustrations as $i => $ill) {
        $idx = ($i === 0) ? max(1, intval($total * 0.33)) : max(2, intval($total * 0.66));
        $idx = min($idx, $total - 1);
        
        $block = "\n\n<!-- wp:image {\"id\":" . intval($ill['wp_media_id']) . ",\"sizeSlug\":\"large\",\"linkDestination\":\"none\"} -->\n" .
            "<figure class=\"wp-block-image size-large\">" .
            "<img src=\"" . esc_url($ill['url']) . "\" alt=\"" . esc_attr($ill['alt'] ?? '') . "\" class=\"wp-image-" . intval($ill['wp_media_id']) . "\"/>" .
            (!empty($ill['caption']) ? "<figcaption class=\"wp-element-caption\">" . esc_html($ill['caption']) . "</figcaption>" : '') .
            "</figure>\n<!-- /wp:image -->\n\n";
        
        $inserts[] = ['pos' => $positions[$idx - 1], 'block' => $block];
    }
    
    usort($inserts, function($a, $b) { return $b['pos'] - $a['pos']; });
    foreach ($inserts as $ins) {
        $content = substr($content, 0, $ins['pos']) . $ins['block'] . substr($content, $ins['pos']);
    }
    return $content;
}

// ============================================================
// VERIFY ENCODING
// ============================================================
function waas_pipeline_verify($request) {
    global $wpdb;
    $post_id = intval($request['id']);
    $post = get_post($post_id);
    if (!$post) return new WP_Error('not_found', 'Post not found', ['status' => 404]);
    
    $content = $wpdb->get_var($wpdb->prepare("SELECT post_content FROM {$wpdb->posts} WHERE ID = %d", $post_id));
    
    return rest_ensure_response([
        'post_id'          => $post_id,
        'title'            => $post->post_title,
        'post_type'        => $post->post_type,
        'content_length'   => strlen($content),
        'has_divi_blocks'  => strpos($content, 'wp:divi/') !== false,
        'encoding_proper'  => strpos($content, '\\u003c') !== false,
        'encoding_broken'  => (bool) preg_match('/(?<!\\\\)u003c/', $content),
        'has_shortcodes'   => strpos($content, '[waas_product') !== false,
        'featured_image'   => has_post_thumbnail($post_id),
        'rank_math_kw'     => get_post_meta($post_id, 'rank_math_focus_keyword', true) ?: null,
    ]);
}

// ============================================================
// UPDATE CONTENT (standalone)
// ============================================================
function waas_pipeline_update_content($request) {
    global $wpdb;
    $params = $request->get_json_params();
    $post_id = intval($params['post_id'] ?? 0);
    if (!$post_id || !get_post($post_id)) {
        return new WP_Error('invalid_post', 'Post not found', ['status' => 404]);
    }
    if (!empty($params['content'])) {
        $wpdb->update($wpdb->posts, ['post_content' => $params['content']], ['ID' => $post_id], ['%s'], ['%d']);
        clean_post_cache($post_id);
    }
    if (!empty($params['meta'])) {
        foreach ($params['meta'] as $key => $value) update_post_meta($post_id, $key, $value);
    }
    return rest_ensure_response(['success' => true, 'post_id' => $post_id]);
}


// ============================================================
// SET BRANDING — Logo + Favicon via Divi options
// ============================================================
function waas_pipeline_set_branding($request) {
    $params = $request->get_json_params();
    $results = [];
    
    // Logo — upload media ID or URL
    $logo_media_id = intval($params['logo_media_id'] ?? 0);
    $logo_url = sanitize_url($params['logo_url'] ?? '');
    
    if ($logo_media_id) {
        $logo_url = wp_get_attachment_url($logo_media_id);
    }
    
    if ($logo_url) {
        // Divi stores logo in et_divi option
        $et_divi = get_option('et_divi', []);
        if (is_array($et_divi)) {
            $et_divi['divi_logo'] = $logo_url;
            $et_divi['divi_logo_alt'] = sanitize_text_field($params['logo_alt'] ?? get_option('blogname'));
            update_option('et_divi', $et_divi);
            $results['logo'] = ['success' => true, 'url' => $logo_url];
        }
        
        // Also set in theme_mods
        set_theme_mod('custom_logo', $logo_media_id ?: 0);
    }
    
    // Favicon
    $favicon_media_id = intval($params['favicon_media_id'] ?? 0);
    $favicon_url = sanitize_url($params['favicon_url'] ?? '');
    
    if ($favicon_media_id) {
        update_option('site_icon', $favicon_media_id);
        $results['favicon'] = ['success' => true, 'media_id' => $favicon_media_id];
    } elseif ($favicon_url) {
        // Need to download and set as attachment first
        $results['favicon'] = ['success' => false, 'error' => 'favicon_media_id required (upload first)'];
    }
    
    // Primary color (Divi accent)
    $primary_color = sanitize_hex_color($params['primary_color'] ?? '');
    if ($primary_color) {
        $et_divi = get_option('et_divi', []);
        if (is_array($et_divi)) {
            $et_divi['accent_color'] = $primary_color;
            update_option('et_divi', $et_divi);
            $results['primary_color'] = $primary_color;
        }
    }
    
    // Clear caches
    global $wpdb;
    $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '%et_divi_static%'");
    $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient%'");
    do_action('litespeed_purge_all');
    
    return rest_ensure_response(['success' => true, 'results' => $results]);
}


// ============================================================
// SITE CHECK — Comprehensive verification
// ============================================================
function waas_pipeline_site_check($request) {
    global $wpdb;
    
    $site_name = get_option('blogname', '');
    $site_url = home_url();
    $checks = [];
    
    // 1. Site title — not default/clone name
    $old_names = ['MeißelTechnik', 'Meisseltechnik', 'WordPress', 'Starter', 'template-standard'];
    $title_ok = !in_array($site_name, $old_names) && !empty($site_name);
    $checks['site_title'] = ['ok' => $title_ok, 'value' => $site_name];
    
    // 2. Legal pages exist
    $legal_slugs = [
        'impressum' => ['impressum'],
        'datenschutz' => ['datenschutzerklaerung', 'datenschutz'],
        'partnerhinweis' => ['amazon-partnerhinweis', 'partnerhinweis', 'transparenzhinweis'],
    ];
    foreach ($legal_slugs as $name => $slugs) {
        $found = false;
        foreach ($slugs as $slug) {
            $page = get_page_by_path($slug);
            if ($page && $page->post_status === 'publish') { $found = true; break; }
        }
        $checks['legal_' . $name] = ['ok' => $found];
    }
    
    // 3. Footer CSS — no old names
    $et_divi = get_option('et_divi', []);
    $custom_css = is_array($et_divi) ? ($et_divi['custom_css'] ?? '') : '';
    $footer_clean = true;
    foreach ($old_names as $old) {
        if (stripos($custom_css, $old) !== false) { $footer_clean = false; break; }
    }
    $checks['footer_css'] = ['ok' => $footer_clean, 'has_custom_css' => !empty($custom_css)];
    
    // 4. Logo — not Divi default
    $logo_url = is_array($et_divi) ? ($et_divi['divi_logo'] ?? '') : '';
    $has_logo = !empty($logo_url) && strpos($logo_url, 'logo.png') === false;
    $checks['logo'] = ['ok' => $has_logo, 'url' => $logo_url];
    
    // 5. Favicon
    $favicon_id = get_option('site_icon', 0);
    $checks['favicon'] = ['ok' => $favicon_id > 0, 'media_id' => $favicon_id];
    
    // 6. Posts count
    $posts_count = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type='post' AND post_status='publish'");
    $checks['posts'] = ['ok' => $posts_count >= 3, 'count' => intval($posts_count)];
    
    // 7. Products count
    $products_count = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type='product' AND post_status='publish'");
    $checks['products'] = ['ok' => $products_count >= 1, 'count' => intval($products_count)];
    
    // 8. Categories with descriptions
    $cats = get_categories(['hide_empty' => false]);
    $cats_with_desc = 0;
    foreach ($cats as $cat) {
        if (!empty($cat->description) && $cat->slug !== 'uncategorized') $cats_with_desc++;
    }
    $checks['categories'] = ['ok' => $cats_with_desc >= 1, 'with_description' => $cats_with_desc, 'total' => count($cats)];
    
    // 9. Partner tag
    $partner_tag = get_option('waas_pm_amazon_partner_tag', '');
    $tag_ok = !empty($partner_tag) && strpos($partner_tag, 'meisseltechnik') === false;
    $checks['partner_tag'] = ['ok' => $tag_ok, 'value' => $partner_tag];
    
    // 10. RankMath homepage title
    $rm = get_option('rank-math-options-titles', []);
    $hp_title = is_array($rm) ? ($rm['homepage_title'] ?? '') : '';
    $rm_ok = !empty($hp_title) && stripos($hp_title, 'MeißelTechnik') === false;
    $checks['rankmath_homepage'] = ['ok' => $rm_ok, 'title' => $hp_title];
    
    // 11. Old names in DB (quick scan)
    $old_count = 0;
    foreach (['MeißelTechnik', 'Passgenaue LKW'] as $old) {
        $c = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->options} WHERE option_value LIKE %s AND option_name NOT LIKE '_transient%%'",
            '%' . $wpdb->esc_like($old) . '%'
        ));
        $old_count += intval($c);
    }
    $checks['old_names_in_db'] = ['ok' => $old_count === 0, 'count' => $old_count];
    
    // 12. Pages structure
    $required_pages = ['homepage', 'shop', 'impressum'];
    $optional_pages = ['werkzeug-welt', 'markenprofil', 'ueber-uns', 'about'];
    
    $pages_found = [];
    $all_pages = get_pages(['post_status' => 'publish']);
    foreach ($all_pages as $p) $pages_found[] = $p->post_name;
    
    $missing_required = [];
    foreach ($required_pages as $rp) {
        if (!in_array($rp, $pages_found)) $missing_required[] = $rp;
    }
    
    $has_optional = [];
    foreach ($optional_pages as $op) {
        foreach ($pages_found as $pf) {
            if (strpos($pf, $op) !== false) { $has_optional[] = $op; break; }
        }
    }
    
    $checks['pages'] = [
        'ok' => empty($missing_required),
        'total' => count($all_pages),
        'missing_required' => $missing_required,
        'has_optional' => $has_optional,
        'all_slugs' => $pages_found,
    ];
    
    // 13. Menu exists
    $menus = wp_get_nav_menus();
    $checks['menu'] = ['ok' => count($menus) > 0, 'count' => count($menus)];
    
    // 14. SSL
    $checks['ssl'] = ['ok' => is_ssl() || strpos($site_url, 'https') === 0];
    
    // 15. Sitemap
    $sitemap_url = home_url('/sitemap_index.xml');
    $sitemap_resp = wp_remote_head($sitemap_url, ['timeout' => 5, 'sslverify' => false]);
    $sitemap_ok = !is_wp_error($sitemap_resp) && wp_remote_retrieve_response_code($sitemap_resp) === 200;
    $checks['sitemap'] = ['ok' => $sitemap_ok];
    
    // Score
    $total = count($checks);
    $passed = 0;
    foreach ($checks as $c) { if ($c['ok']) $passed++; }
    
    return rest_ensure_response([
        'site' => $site_url,
        'name' => $site_name,
        'score' => $passed . '/' . $total,
        'percent' => round($passed / $total * 100),
        'checks' => $checks,
    ]);
}


// ============================================================
// SET MENU — Create/replace primary navigation menu
// ============================================================
function waas_pipeline_set_menu($request) {
    $params = $request->get_json_params();
    $menu_name = sanitize_text_field($params['menu_name'] ?? 'Hauptmenü');
    $items = $params['items'] ?? [];
    
    if (empty($items)) {
        return new WP_Error('no_items', 'Menu items required', ['status' => 400]);
    }
    
    // Find or create menu
    $menu = wp_get_nav_menu_object($menu_name);
    if ($menu) {
        // Delete all existing items
        $menu_items = wp_get_nav_menu_items($menu->term_id);
        if ($menu_items) {
            foreach ($menu_items as $item) {
                wp_delete_post($item->ID, true);
            }
        }
        $menu_id = $menu->term_id;
    } else {
        $menu_id = wp_create_nav_menu($menu_name);
        if (is_wp_error($menu_id)) {
            return new WP_Error('menu_create_failed', $menu_id->get_error_message(), ['status' => 500]);
        }
    }
    
    $created = [];
    $order = 0;
    
    foreach ($items as $item) {
        $order += 10;
        $type = sanitize_text_field($item['type'] ?? 'custom');
        $title = sanitize_text_field($item['title'] ?? '');
        $url = esc_url_raw($item['url'] ?? '');
        $parent_title = sanitize_text_field($item['parent'] ?? '');
        $object_id = intval($item['object_id'] ?? 0);
        $object_type = sanitize_text_field($item['object_type'] ?? '');
        
        $args = [
            'menu-item-title'    => $title,
            'menu-item-position' => $order,
            'menu-item-status'   => 'publish',
        ];
        
        // Find parent menu item ID
        $parent_id = 0;
        if ($parent_title) {
            foreach ($created as $c) {
                if ($c['title'] === $parent_title) { $parent_id = $c['id']; break; }
            }
        }
        $args['menu-item-parent-id'] = $parent_id;
        
        if ($type === 'page' && $object_id) {
            $args['menu-item-type'] = 'post_type';
            $args['menu-item-object'] = 'page';
            $args['menu-item-object-id'] = $object_id;
        } elseif ($type === 'category') {
            // Find category by slug
            $cat_slug = sanitize_text_field($item['slug'] ?? '');
            $cat = get_category_by_slug($cat_slug);
            if ($cat) {
                $args['menu-item-type'] = 'taxonomy';
                $args['menu-item-object'] = 'category';
                $args['menu-item-object-id'] = $cat->term_id;
            } else {
                // Create category if doesn't exist
                $new_cat = wp_insert_term($title, 'category', ['slug' => $cat_slug]);
                if (!is_wp_error($new_cat)) {
                    $args['menu-item-type'] = 'taxonomy';
                    $args['menu-item-object'] = 'category';
                    $args['menu-item-object-id'] = $new_cat['term_id'];
                } else {
                    $args['menu-item-type'] = 'custom';
                    $args['menu-item-url'] = $url ?: home_url('/category/' . $cat_slug . '/');
                }
            }
        } elseif ($type === 'post' && $object_id) {
            $args['menu-item-type'] = 'post_type';
            $args['menu-item-object'] = 'post';
            $args['menu-item-object-id'] = $object_id;
        } else {
            // Custom link
            $args['menu-item-type'] = 'custom';
            $args['menu-item-url'] = $url ?: '#';
        }
        
        $item_id = wp_update_nav_menu_item($menu_id, 0, $args);
        
        if (!is_wp_error($item_id)) {
            $created[] = ['id' => $item_id, 'title' => $title, 'type' => $type];
        }
    }
    
    // Assign menu to Divi primary location
    $locations = get_theme_mod('nav_menu_locations', []);
    $locations['primary-menu'] = $menu_id;
    set_theme_mod('nav_menu_locations', $locations);
    
    // Also try Divi-specific header menu
    $et_divi = get_option('et_divi', []);
    if (is_array($et_divi)) {
        $et_divi['divi_header_menu'] = $menu_id;
        update_option('et_divi', $et_divi);
    }
    
    // Clear caches
    global $wpdb;
    $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient%'");
    do_action('litespeed_purge_all');
    
    return rest_ensure_response([
        'success' => true,
        'menu_id' => $menu_id,
        'menu_name' => $menu_name,
        'items_created' => count($created),
        'items' => $created,
    ]);
}


// ============================================================
// GET SITE STRUCTURE — Returns pages, categories, posts for menu building
// ============================================================
function waas_pipeline_get_site_structure($request) {
    global $wpdb;
    
    // Pages
    $pages = [];
    $all_pages = get_pages(['post_status' => 'publish', 'sort_column' => 'menu_order']);
    foreach ($all_pages as $p) {
        $pages[] = [
            'id' => $p->ID,
            'title' => $p->post_title,
            'slug' => $p->post_name,
            'url' => get_permalink($p->ID),
        ];
    }
    
    // Categories
    $categories = [];
    $cats = get_categories(['hide_empty' => false, 'exclude' => [1]]);
    foreach ($cats as $c) {
        $categories[] = [
            'id' => $c->term_id,
            'name' => $c->name,
            'slug' => $c->slug,
            'count' => $c->count,
            'url' => get_category_link($c->term_id),
        ];
    }
    
    // Recent posts
    $posts = [];
    $recent = get_posts(['numberposts' => 20, 'post_status' => 'publish']);
    foreach ($recent as $p) {
        $cats_list = wp_get_post_categories($p->ID, ['fields' => 'names']);
        $posts[] = [
            'id' => $p->ID,
            'title' => $p->post_title,
            'slug' => $p->post_name,
            'url' => get_permalink($p->ID),
            'categories' => $cats_list,
        ];
    }
    
    // Current menus
    $menus = [];
    $nav_menus = wp_get_nav_menus();
    foreach ($nav_menus as $m) {
        $items = wp_get_nav_menu_items($m->term_id);
        $menu_items = [];
        if ($items) {
            foreach ($items as $i) {
                $menu_items[] = [
                    'id' => $i->ID,
                    'title' => $i->title,
                    'url' => $i->url,
                    'parent' => $i->menu_item_parent,
                    'order' => $i->menu_order,
                    'type' => $i->type,
                ];
            }
        }
        $menus[] = [
            'id' => $m->term_id,
            'name' => $m->name,
            'count' => count($menu_items),
            'items' => $menu_items,
        ];
    }
    
    return rest_ensure_response([
        'site' => home_url(),
        'name' => get_option('blogname'),
        'pages' => $pages,
        'categories' => $categories,
        'posts' => $posts,
        'menus' => $menus,
    ]);
}

// Helper: check if text already extracted (avoid duplicates)
function _waas_text_exists($texts, $plain) {
    foreach ($texts as $t) {
        if ($t['text'] === $plain) return true;
    }
    return false;
}

// ============================================================
// EXTRACT TEXTS — Pull all visible text from a Divi page
// ============================================================
function waas_pipeline_extract_texts($request) {
    global $wpdb;
    $post_id = intval($request['id']);
    $post = get_post($post_id);
    if (!$post) return new WP_Error('not_found', 'Post not found', ['status' => 404]);
    
    $content = $wpdb->get_var($wpdb->prepare(
        "SELECT post_content FROM {$wpdb->posts} WHERE ID = %d", $post_id
    ));
    
    $texts = [];
    $idx = 0;
    
    // Extract text from Divi block attributes (content fields with \u003c encoded HTML)
    // Pattern: "content":{"innerContent":{"desktop":{"value":"..."}}} (Divi 5)
    // OR:      "content":{"desktop":{"value":"..."}} (some modules)
    preg_match_all('/"content"\s*:\s*\{(?:\s*"innerContent"\s*:\s*\{)?\s*"desktop"\s*:\s*\{\s*"value"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/s', $content, $matches);
    foreach ($matches[1] as $encoded) {
        $decoded = json_decode('"' . $encoded . '"');
        if ($decoded) {
            $plain = strip_tags(html_entity_decode($decoded));
            $plain = trim(preg_replace('/\s+/', ' ', $plain));
            if (strlen($plain) > 3) {
                $texts[] = [
                    'idx' => $idx++,
                    'type' => 'content',
                    'text' => $plain,
                    'html' => $decoded,
                    'raw_encoded' => $encoded,
                ];
            }
        }
    }
    
    // Extract headings (title fields) — with optional innerContent wrapper
    preg_match_all('/"title"\s*:\s*\{(?:\s*"innerContent"\s*:\s*\{)?\s*"desktop"\s*:\s*\{\s*"value"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/s', $content, $matches);
    foreach ($matches[1] as $encoded) {
        $decoded = json_decode('"' . $encoded . '"');
        if ($decoded) {
            $plain = strip_tags(html_entity_decode($decoded));
            $plain = trim(preg_replace('/\s+/', ' ', $plain));
            if (strlen($plain) > 2) {
                $texts[] = [
                    'idx' => $idx++,
                    'type' => 'heading',
                    'text' => $plain,
                    'html' => $decoded,
                    'raw_encoded' => $encoded,
                ];
            }
        }
    }
    
    // Extract button texts — with optional innerContent wrapper
    preg_match_all('/"button(?:_text|Text)"\s*:\s*\{(?:\s*"innerContent"\s*:\s*\{)?\s*"desktop"\s*:\s*\{\s*"value"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/s', $content, $matches);
    foreach ($matches[1] as $encoded) {
        $decoded = json_decode('"' . $encoded . '"');
        if ($decoded && strlen(trim($decoded)) > 1) {
            $texts[] = [
                'idx' => $idx++,
                'type' => 'button',
                'text' => trim($decoded),
                'raw_encoded' => $encoded,
            ];
        }
    }
    
    // Extract subhead (fullwidth-header) — with optional innerContent wrapper
    preg_match_all('/"subhead"\s*:\s*\{(?:\s*"innerContent"\s*:\s*\{)?\s*"desktop"\s*:\s*\{\s*"value"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/s', $content, $matches);
    foreach ($matches[1] as $encoded) {
        $decoded = json_decode('"' . $encoded . '"');
        if ($decoded) {
            $plain = strip_tags(html_entity_decode($decoded));
            $plain = trim(preg_replace('/\s+/', ' ', $plain));
            if (strlen($plain) > 3) {
                $texts[] = [
                    'idx' => $idx++,
                    'type' => 'subheading',
                    'text' => $plain,
                    'html' => $decoded,
                    'raw_encoded' => $encoded,
                ];
            }
        }
    }
    
    // Extract body/description (blurb modules) — with optional innerContent wrapper
    preg_match_all('/"(?:body|description)"\s*:\s*\{(?:\s*"innerContent"\s*:\s*\{)?\s*"desktop"\s*:\s*\{\s*"value"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/s', $content, $matches);
    foreach ($matches[1] as $encoded) {
        $decoded = json_decode('"' . $encoded . '"');
        if ($decoded) {
            $plain = strip_tags(html_entity_decode($decoded));
            $plain = trim(preg_replace('/\s+/', ' ', $plain));
            if (strlen($plain) > 5 && !_waas_text_exists($texts, $plain)) {
                $texts[] = [
                    'idx' => $idx++,
                    'type' => 'content',
                    'text' => $plain,
                    'html' => $decoded,
                    'raw_encoded' => $encoded,
                ];
            }
        }
    }
    
    // ============================================
    // DIVI CLASSIC: Extract from shortcodes
    // ============================================
    
    // If no Divi 5 texts found, try Divi Classic format
    if ($idx === 0) {
        
        // Extract text from [et_pb_text ...] HTML content [/et_pb_text]
        preg_match_all('/\[et_pb_text[^\]]*\](.*?)\[\/et_pb_text\]/si', $content, $text_blocks);
        foreach ($text_blocks[1] as $block) {
            // Get headings inside
            preg_match_all('/<h[1-6][^>]*>(.*?)<\/h[1-6]>/si', $block, $headings);
            foreach ($headings[1] as $h) {
                $plain = trim(strip_tags(html_entity_decode($h)));
                if (strlen($plain) > 2 && !_waas_text_exists($texts, $plain)) {
                    $texts[] = ['idx' => $idx++, 'type' => 'heading', 'text' => $plain, 'html' => trim($h)];
                }
            }
            // Get paragraphs inside
            preg_match_all('/<p[^>]*>(.*?)<\/p>/si', $block, $paras);
            foreach ($paras[1] as $p) {
                $plain = trim(strip_tags(html_entity_decode($p)));
                if (strlen($plain) > 5 && !_waas_text_exists($texts, $plain)) {
                    $texts[] = ['idx' => $idx++, 'type' => 'content', 'text' => $plain, 'html' => trim($p)];
                }
            }
            // Get list items
            preg_match_all('/<li[^>]*>(.*?)<\/li>/si', $block, $lis);
            foreach ($lis[1] as $li) {
                $plain = trim(strip_tags(html_entity_decode($li)));
                if (strlen($plain) > 5 && !_waas_text_exists($texts, $plain)) {
                    $texts[] = ['idx' => $idx++, 'type' => 'list_item', 'text' => $plain];
                }
            }
            // If no sub-elements found, get entire block text
            if (empty($headings[1]) && empty($paras[1])) {
                $plain = trim(strip_tags(html_entity_decode($block)));
                $plain = trim(preg_replace('/\s+/', ' ', $plain));
                if (strlen($plain) > 5 && !_waas_text_exists($texts, $plain)) {
                    $texts[] = ['idx' => $idx++, 'type' => 'content', 'text' => $plain, 'html' => trim($block)];
                }
            }
        }
        
        // Extract button text from [et_pb_button button_text="..." ...]
        preg_match_all('/\[et_pb_button[^\]]*button_text="([^"]+)"/si', $content, $buttons);
        foreach ($buttons[1] as $btn) {
            $plain = trim(html_entity_decode($btn));
            if (strlen($plain) > 1 && !_waas_text_exists($texts, $plain)) {
                $texts[] = ['idx' => $idx++, 'type' => 'button', 'text' => $plain];
            }
        }
        
        // Extract blurb titles from [et_pb_blurb title="..." ...]
        preg_match_all('/\[et_pb_blurb[^\]]*title="([^"]+)"/si', $content, $blurb_titles);
        foreach ($blurb_titles[1] as $bt) {
            $plain = trim(html_entity_decode($bt));
            if (strlen($plain) > 2 && !_waas_text_exists($texts, $plain)) {
                $texts[] = ['idx' => $idx++, 'type' => 'blurb_title', 'text' => $plain];
            }
        }
        
        // Extract blurb content from inside [et_pb_blurb ...] ... [/et_pb_blurb]
        preg_match_all('/\[et_pb_blurb[^\]]*\](.*?)\[\/et_pb_blurb\]/si', $content, $blurb_contents);
        foreach ($blurb_contents[1] as $bc) {
            $plain = trim(strip_tags(html_entity_decode($bc)));
            $plain = trim(preg_replace('/\s+/', ' ', $plain));
            if (strlen($plain) > 5 && !_waas_text_exists($texts, $plain)) {
                $texts[] = ['idx' => $idx++, 'type' => 'blurb_content', 'text' => $plain];
            }
        }
        
        // Extract CTA/fullwidth header text
        preg_match_all('/\[et_pb_fullwidth_header[^\]]*title="([^"]+)"/si', $content, $fw_titles);
        foreach ($fw_titles[1] as $ft) {
            $plain = trim(html_entity_decode($ft));
            if (strlen($plain) > 2 && !_waas_text_exists($texts, $plain)) {
                $texts[] = ['idx' => $idx++, 'type' => 'heading', 'text' => $plain];
            }
        }
        preg_match_all('/\[et_pb_fullwidth_header[^\]]*subhead="([^"]+)"/si', $content, $fw_subs);
        foreach ($fw_subs[1] as $fs) {
            $plain = trim(html_entity_decode($fs));
            if (strlen($plain) > 5 && !_waas_text_exists($texts, $plain)) {
                $texts[] = ['idx' => $idx++, 'type' => 'subheading', 'text' => $plain];
            }
        }
        preg_match_all('/\[et_pb_fullwidth_header[^\]]*button_one_text="([^"]+)"/si', $content, $fw_btns);
        foreach ($fw_btns[1] as $fb) {
            $plain = trim(html_entity_decode($fb));
            if (strlen($plain) > 1 && !_waas_text_exists($texts, $plain)) {
                $texts[] = ['idx' => $idx++, 'type' => 'button', 'text' => $plain];
            }
        }
    }
    
    // ============================================
    // LAST RESORT: Use rendered HTML if still nothing
    // ============================================
    if ($idx === 0) {
        // Apply shortcodes to get rendered HTML
        $rendered = do_shortcode($content);
        $rendered = apply_filters('the_content', $content);
        
        preg_match_all('/<h[1-6][^>]*>(.*?)<\/h[1-6]>/si', $rendered, $matches);
        foreach ($matches[1] as $h) {
            $plain = trim(strip_tags(html_entity_decode($h)));
            if (strlen($plain) > 2 && !_waas_text_exists($texts, $plain)) {
                $texts[] = ['idx' => $idx++, 'type' => 'heading', 'text' => $plain];
            }
        }
        
        preg_match_all('/<p[^>]*>(.*?)<\/p>/si', $rendered, $matches);
        foreach ($matches[1] as $p) {
            $plain = trim(strip_tags(html_entity_decode($p)));
            if (strlen($plain) > 5 && !_waas_text_exists($texts, $plain)) {
                $texts[] = ['idx' => $idx++, 'type' => 'content', 'text' => $plain];
            }
        }
    }
    
    // Post title and meta
    $meta_texts = [
        'post_title' => $post->post_title,
        'rank_math_title' => get_post_meta($post_id, 'rank_math_title', true) ?: '',
        'rank_math_description' => get_post_meta($post_id, 'rank_math_description', true) ?: '',
        'rank_math_focus_keyword' => get_post_meta($post_id, 'rank_math_focus_keyword', true) ?: '',
    ];
    
    return rest_ensure_response([
        'post_id' => $post_id,
        'post_title' => $post->post_title,
        'post_slug' => $post->post_name,
        'content_length' => strlen($content),
        'texts_found' => count($texts),
        'texts' => $texts,
        'meta' => $meta_texts,
    ]);
}


// ============================================================
// REPLACE TEXTS — Find-replace text in Divi page content
// ============================================================
function waas_pipeline_replace_texts($request) {
    global $wpdb;
    $params = $request->get_json_params();
    
    $post_id = intval($params['post_id'] ?? 0);
    $replacements = $params['replacements'] ?? [];
    $meta_replacements = $params['meta'] ?? [];
    $new_title = sanitize_text_field($params['new_title'] ?? '');
    $new_slug = sanitize_title($params['new_slug'] ?? '');
    
    if (!$post_id || !get_post($post_id)) {
        return new WP_Error('invalid_post', 'Post not found', ['status' => 404]);
    }
    
    $content = $wpdb->get_var($wpdb->prepare(
        "SELECT post_content FROM {$wpdb->posts} WHERE ID = %d", $post_id
    ));
    
    $original_length = strlen($content);
    $replacements_made = 0;
    
    // Apply text replacements
    foreach ($replacements as $r) {
        $old = $r['old'] ?? '';
        $new = $r['new'] ?? '';
        if (!$old || !$new) continue;
        
        // Replace in raw content (handles both encoded and decoded forms)
        $old_encoded = json_encode($old);
        $old_encoded = substr($old_encoded, 1, -1); // Remove quotes
        $new_encoded = json_encode($new);
        $new_encoded = substr($new_encoded, 1, -1);
        
        // Replace encoded version (inside Divi JSON attributes)
        $before = $content;
        $content = str_replace($old_encoded, $new_encoded, $content);
        
        // Replace plain HTML version
        $content = str_replace($old, $new, $content);
        
        if ($content !== $before) $replacements_made++;
    }
    
    // Write back via direct SQL (encoding safe)
    if ($replacements_made > 0) {
        $wpdb->update($wpdb->posts, ['post_content' => $content], ['ID' => $post_id], ['%s'], ['%d']);
    }
    
    // Update title and slug
    $updates = [];
    if ($new_title) $updates['post_title'] = $new_title;
    if ($new_slug) $updates['post_name'] = $new_slug;
    if (!empty($updates)) {
        $wpdb->update($wpdb->posts, $updates, ['ID' => $post_id], array_fill(0, count($updates), '%s'), ['%d']);
    }
    
    // Update meta
    foreach ($meta_replacements as $key => $value) {
        if (in_array($key, ['rank_math_title', 'rank_math_description', 'rank_math_focus_keyword'])) {
            update_post_meta($post_id, $key, sanitize_text_field($value));
        }
    }
    
    clean_post_cache($post_id);
    
    // Clear caches
    $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '%et_divi_static%'");
    do_action('litespeed_purge_all');
    
    return rest_ensure_response([
        'success' => true,
        'post_id' => $post_id,
        'replacements_made' => $replacements_made,
        'content_length' => strlen($content),
        'original_length' => $original_length,
    ]);
}

// ============================================================
// CLEANUP — Delete old clone content, scan remnants
// ============================================================
function waas_pipeline_cleanup($request) {
    global $wpdb;
    $params = $request->get_json_params();
    $action = sanitize_text_field($params['action'] ?? '');
    $results = [];
    
    switch ($action) {
        
        // --- DELETE OLD POSTS ---
        case 'delete_posts':
            $exclude_ids = array_map('intval', $params['exclude_ids'] ?? []);
            $posts = get_posts(['numberposts' => -1, 'post_status' => 'any', 'post_type' => 'post']);
            $deleted = 0;
            foreach ($posts as $p) {
                if (in_array($p->ID, $exclude_ids)) continue;
                wp_delete_post($p->ID, true);
                $deleted++;
            }
            $results = ['deleted_posts' => $deleted, 'kept' => count($exclude_ids)];
            break;
            
        // --- DELETE OLD PRODUCTS ---
        case 'delete_products':
            $exclude_ids = array_map('intval', $params['exclude_ids'] ?? []);
            $products = get_posts(['numberposts' => -1, 'post_status' => 'any', 'post_type' => 'product']);
            $deleted = 0;
            foreach ($products as $p) {
                if (in_array($p->ID, $exclude_ids)) continue;
                wp_delete_post($p->ID, true);
                $deleted++;
            }
            $results = ['deleted_products' => $deleted];
            break;
            
        // --- DELETE OLD CATEGORIES (keep Uncategorized + Blog) ---
        case 'delete_categories':
            $keep_slugs = array_merge(['uncategorized', 'blog'], $params['keep_slugs'] ?? []);
            $cats = get_categories(['hide_empty' => false]);
            $deleted = 0;
            foreach ($cats as $cat) {
                if (in_array($cat->slug, $keep_slugs)) continue;
                wp_delete_category($cat->term_id);
                $deleted++;
            }
            $results = ['deleted_categories' => $deleted, 'kept_slugs' => $keep_slugs];
            break;
            
        // --- DELETE OLD TAGS ---
        case 'delete_tags':
            $tags = get_tags(['hide_empty' => false]);
            $deleted = 0;
            foreach ($tags as $tag) {
                wp_delete_term($tag->term_id, 'post_tag');
                $deleted++;
            }
            $results = ['deleted_tags' => $deleted];
            break;
        
        // --- DELETE OLD MEDIA (uploaded before cutoff date) ---
        case 'delete_old_media':
            $before_date = sanitize_text_field($params['before_date'] ?? '');
            $exclude_ids = array_map('intval', $params['exclude_ids'] ?? []);
            if (!$before_date) {
                return new WP_Error('no_date', 'before_date required (YYYY-MM-DD)', ['status' => 400]);
            }
            $attachments = get_posts([
                'post_type' => 'attachment',
                'numberposts' => -1,
                'date_query' => [['before' => $before_date]],
            ]);
            $deleted = 0;
            foreach ($attachments as $a) {
                if (in_array($a->ID, $exclude_ids)) continue;
                wp_delete_attachment($a->ID, true);
                $deleted++;
            }
            $results = ['deleted_media' => $deleted, 'before' => $before_date];
            break;
            
        // --- SCAN REMNANTS — find old site name in DB ---
        case 'scan_remnants':
            $old_names = $params['old_names'] ?? ['MeißelTechnik', 'Meisseltechnik', 'Passgenaue LKW'];
            $found = [];
            foreach ($old_names as $old) {
                $count = $wpdb->get_var($wpdb->prepare(
                    "SELECT COUNT(*) FROM {$wpdb->options} WHERE option_value LIKE %s AND option_name NOT LIKE '_transient%%'",
                    '%' . $wpdb->esc_like($old) . '%'
                ));
                $meta_count = $wpdb->get_var($wpdb->prepare(
                    "SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE meta_value LIKE %s",
                    '%' . $wpdb->esc_like($old) . '%'
                ));
                $post_count = $wpdb->get_var($wpdb->prepare(
                    "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_content LIKE %s OR post_title LIKE %s",
                    '%' . $wpdb->esc_like($old) . '%', '%' . $wpdb->esc_like($old) . '%'
                ));
                if ($count > 0 || $meta_count > 0 || $post_count > 0) {
                    $found[$old] = ['options' => intval($count), 'postmeta' => intval($meta_count), 'posts' => intval($post_count)];
                }
            }
            $results = ['remnants' => $found, 'clean' => empty($found)];
            break;
            
        // --- CLEAN REMNANTS — replace old names everywhere ---
        case 'clean_remnants':
            $old_names = $params['old_names'] ?? [];
            $new_name = sanitize_text_field($params['new_name'] ?? get_option('blogname'));
            $fixed = 0;
            
            foreach ($old_names as $old) {
                // Options
                $rows = $wpdb->get_results($wpdb->prepare(
                    "SELECT option_name FROM {$wpdb->options} WHERE option_value LIKE %s AND option_name NOT LIKE '_transient%%' AND LENGTH(option_value) < 50000",
                    '%' . $wpdb->esc_like($old) . '%'
                ));
                foreach ($rows as $row) {
                    $val = get_option($row->option_name);
                    if (is_string($val)) {
                        $new_val = str_replace($old, $new_name, $val);
                        if ($new_val !== $val) { update_option($row->option_name, $new_val); $fixed++; }
                    } elseif (is_array($val)) {
                        $json = json_encode($val);
                        $new_json = str_replace($old, $new_name, $json);
                        if ($new_json !== $json) {
                            $decoded = json_decode($new_json, true);
                            if ($decoded !== null) { update_option($row->option_name, $decoded); $fixed++; }
                        }
                    }
                }
                
                // Post content
                $wpdb->query($wpdb->prepare(
                    "UPDATE {$wpdb->posts} SET post_content = REPLACE(post_content, %s, %s) WHERE post_content LIKE %s",
                    $old, $new_name, '%' . $wpdb->esc_like($old) . '%'
                ));
                
                // Post titles
                $wpdb->query($wpdb->prepare(
                    "UPDATE {$wpdb->posts} SET post_title = REPLACE(post_title, %s, %s) WHERE post_title LIKE %s",
                    $old, $new_name, '%' . $wpdb->esc_like($old) . '%'
                ));
                
                // Postmeta
                $wpdb->query($wpdb->prepare(
                    "UPDATE {$wpdb->postmeta} SET meta_value = REPLACE(meta_value, %s, %s) WHERE meta_value LIKE %s AND LENGTH(meta_value) < 10000",
                    $old, $new_name, '%' . $wpdb->esc_like($old) . '%'
                ));
            }
            
            // Clear caches
            $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '%et_divi_static%'");
            $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient%'");
            do_action('litespeed_purge_all');
            wp_cache_flush();
            
            $results = ['fixed' => $fixed, 'new_name' => $new_name];
            break;
            
        // --- NICHE REPLACE — bulk str_replace with multiple pairs ---
        case 'niche_replace':
            $pairs = $params['pairs'] ?? [];
            $dry_run = !empty($params['dry_run']);

            if (empty($pairs)) {
                $results = ['pairs_processed' => 0, 'stats' => [], 'dry_run' => $dry_run];
                break;
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

            $results = ['pairs_processed' => count($stats), 'stats' => $stats, 'dry_run' => $dry_run];
            break;

        // --- GET INVENTORY — count all content ---
        case 'inventory':
            $results = [
                'posts' => intval($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type='post' AND post_status IN ('publish','draft')")),
                'pages' => intval($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type='page' AND post_status='publish'")),
                'products' => intval($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type='product' AND post_status IN ('publish','draft')")),
                'media' => intval($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type='attachment'")),
                'categories' => intval($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->term_taxonomy} WHERE taxonomy='category'")),
                'tags' => intval($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->term_taxonomy} WHERE taxonomy='post_tag'")),
                'menus' => count(wp_get_nav_menus()),
            ];
            break;
            
        default:
            return new WP_Error('unknown_action', 'Unknown cleanup action: ' . $action, ['status' => 400]);
    }
    
    return rest_ensure_response(['success' => true, 'action' => $action, 'results' => $results]);
}
