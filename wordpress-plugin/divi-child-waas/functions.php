<?php
/**
 * Divi Child Theme - WAAS Functions
 *
 * @package Divi_Child_WAAS
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Enqueue parent and child theme styles
 */
function divi_child_waas_enqueue_styles() {
    // Enqueue parent theme stylesheet
    wp_enqueue_style('divi-parent-style', get_template_directory_uri() . '/style.css');

    // Enqueue child theme stylesheet
    wp_enqueue_style(
        'divi-child-waas-style',
        get_stylesheet_directory_uri() . '/style.css',
        array('divi-parent-style'),
        wp_get_theme()->get('Version')
    );
}
add_action('wp_enqueue_scripts', 'divi_child_waas_enqueue_styles');

/**
 * Add conditional header branding based on patronage status
 */
function divi_child_waas_conditional_header() {
    // Check if WAAS Patronage Manager is active
    if (!function_exists('waas_patronage_init')) {
        return;
    }

    // Get patronage core
    if (!class_exists('WAAS_Patronage_Core')) {
        return;
    }

    $patronage_core = WAAS_Patronage_Core::get_instance();

    if (!$patronage_core->is_patronage_active()) {
        // Standard mode - show default branding
        return;
    }

    // Patronage mode - modify header
    if (!$patronage_core->is_feature_enabled('logo')) {
        return;
    }

    $patron_data = $patronage_core->get_patron_data();

    if (empty($patron_data)) {
        return;
    }

    // Replace logo with JavaScript (runs after page load)
    ?>
    <script>
    document.addEventListener('DOMContentLoaded', function() {
        var logo = document.querySelector('#logo img');
        if (logo) {
            logo.src = <?php echo json_encode($patron_data['logo_url']); ?>;
            logo.alt = <?php echo json_encode($patron_data['brand_name']); ?>;
        }
    });
    </script>
    <?php
}
add_action('wp_head', 'divi_child_waas_conditional_header', 999);

/**
 * Add conditional footer branding
 */
function divi_child_waas_conditional_footer() {
    // Check if WAAS Patronage Manager is active
    if (!function_exists('waas_patronage_init')) {
        return;
    }

    if (!class_exists('WAAS_Patronage_Core')) {
        return;
    }

    $patronage_core = WAAS_Patronage_Core::get_instance();

    if (!$patronage_core->is_patronage_active()) {
        return;
    }

    // Footer branding is handled by WAAS_Patronage_Public class
    // This hook is here for additional customizations if needed
}
add_action('wp_footer', 'divi_child_waas_conditional_footer', 1);

/**
 * Modify product query for patronage filtering
 * This ensures Divi modules respect patronage filtering
 */
function divi_child_waas_modify_divi_product_query($args) {
    // Check if WAAS Patronage Manager is active
    if (!function_exists('waas_patronage_init')) {
        return $args;
    }

    if (!class_exists('WAAS_Patronage_Product_Filter')) {
        return $args;
    }

    // Get product filter instance
    $product_filter = WAAS_Patronage_Product_Filter::get_instance();

    // Check if this is a waas_product query
    if (isset($args['post_type']) && $args['post_type'] === 'waas_product') {
        // Apply patronage filter
        $args = apply_filters('waas_product_query_args', $args);
    }

    return $args;
}
add_filter('et_builder_get_posts_args', 'divi_child_waas_modify_divi_product_query', 10, 1);

/**
 * Add custom single product template
 */
function divi_child_waas_product_template($template) {
    if (is_singular('waas_product')) {
        $child_template = get_stylesheet_directory() . '/single-waas_product.php';

        if (file_exists($child_template)) {
            return $child_template;
        }
    }

    return $template;
}
add_filter('template_include', 'divi_child_waas_product_template');

/**
 * Register custom widget area for patron info
 */
function divi_child_waas_register_widget_areas() {
    register_sidebar(array(
        'name' => __('Patron Info Sidebar', 'divi-child-waas'),
        'id' => 'patron-info-sidebar',
        'description' => __('Sidebar for displaying patron information', 'divi-child-waas'),
        'before_widget' => '<div id="%1$s" class="widget %2$s">',
        'after_widget' => '</div>',
        'before_title' => '<h4 class="widgettitle">',
        'after_title' => '</h4>',
    ));
}
add_action('widgets_init', 'divi_child_waas_register_widget_areas');

/**
 * Add helper function to check if patronage is active
 */
function is_waas_patronage_active() {
    if (!function_exists('waas_patronage_init') || !class_exists('WAAS_Patronage_Core')) {
        return false;
    }

    $patronage_core = WAAS_Patronage_Core::get_instance();
    return $patronage_core->is_patronage_active();
}

/**
 * Get patron data helper function
 */
function get_waas_patron_data() {
    if (!is_waas_patronage_active()) {
        return array();
    }

    $patronage_core = WAAS_Patronage_Core::get_instance();
    return $patronage_core->get_patron_data();
}

/**
 * Check if patron feature is enabled
 */
function is_waas_patron_feature_enabled($feature) {
    if (!is_waas_patronage_active()) {
        return false;
    }

    $patronage_core = WAAS_Patronage_Core::get_instance();
    return $patronage_core->is_feature_enabled($feature);
}
