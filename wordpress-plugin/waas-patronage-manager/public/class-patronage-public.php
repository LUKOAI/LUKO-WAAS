<?php
/**
 * Patronage Public Functionality
 *
 * @package WAAS_Patronage_Manager
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WAAS Patronage Public Class
 */
class WAAS_Patronage_Public {

    /**
     * Instance of this class
     *
     * @var object
     */
    protected static $instance = null;

    /**
     * Patronage core instance
     *
     * @var object
     */
    private $patronage_core;

    /**
     * Get instance of this class
     *
     * @return object
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructor
     */
    private function __construct() {
        $this->patronage_core = WAAS_Patronage_Core::get_instance();
        $this->init_hooks();
    }

    /**
     * Initialize hooks
     */
    private function init_hooks() {
        // Add patron branding to header
        add_action('wp_head', array($this, 'add_patron_branding_header'), 100);

        // Add patron branding to footer
        add_action('wp_footer', array($this, 'add_patron_branding_footer'), 100);

        // Add body classes
        add_filter('body_class', array($this, 'add_body_classes'));

        // Add shortcode for patron info
        add_shortcode('waas_patron_info', array($this, 'patron_info_shortcode'));
    }

    /**
     * Add patron branding to header
     */
    public function add_patron_branding_header() {
        if (!$this->patronage_core->is_patronage_active()) {
            return;
        }

        if (!$this->patronage_core->is_feature_enabled('logo')) {
            return;
        }

        $patron_data = $this->patronage_core->get_patron_data();

        if (empty($patron_data)) {
            return;
        }

        echo '<!-- WAAS Patronage: Patron Branding -->' . "\n";
        ?>
        <div class="waas-patron-header-branding">
            <div class="waas-patron-container">
                <?php if (!empty($patron_data['logo_url'])): ?>
                    <img src="<?php echo esc_url($patron_data['logo_url']); ?>"
                         alt="<?php echo esc_attr($patron_data['brand_name']); ?>"
                         class="waas-patron-logo">
                <?php endif; ?>
                <div class="waas-patron-powered-by">
                    <?php echo sprintf(__('Powered by %s', 'waas-patronage'), '<strong>' . esc_html($patron_data['brand_name']) . '</strong>'); ?>
                </div>
            </div>
        </div>
        <?php
    }

    /**
     * Add patron branding to footer
     */
    public function add_patron_branding_footer() {
        if (!$this->patronage_core->is_patronage_active()) {
            return;
        }

        $patron_data = $this->patronage_core->get_patron_data();

        if (empty($patron_data)) {
            return;
        }

        $show_contact = $this->patronage_core->is_feature_enabled('contact');
        $show_brand_story = $this->patronage_core->is_feature_enabled('brand_story');

        if (!$show_contact && !$show_brand_story) {
            return;
        }

        ?>
        <div class="waas-patron-footer-branding">
            <div class="waas-patron-container">
                <?php if ($show_brand_story && !empty($patron_data['brand_story'])): ?>
                    <div class="waas-patron-brand-story">
                        <h3><?php echo sprintf(__('About %s', 'waas-patronage'), esc_html($patron_data['brand_name'])); ?></h3>
                        <?php echo wp_kses_post($patron_data['brand_story']); ?>
                    </div>
                <?php endif; ?>

                <?php if ($show_contact): ?>
                    <div class="waas-patron-contact-info">
                        <h4><?php _e('Contact Us', 'waas-patronage'); ?></h4>
                        <ul class="waas-patron-contact-list">
                            <?php if (!empty($patron_data['email'])): ?>
                                <li class="waas-patron-email">
                                    <span class="dashicons dashicons-email"></span>
                                    <a href="mailto:<?php echo esc_attr($patron_data['email']); ?>"><?php echo esc_html($patron_data['email']); ?></a>
                                </li>
                            <?php endif; ?>
                            <?php if (!empty($patron_data['phone'])): ?>
                                <li class="waas-patron-phone">
                                    <span class="dashicons dashicons-phone"></span>
                                    <a href="tel:<?php echo esc_attr(str_replace(' ', '', $patron_data['phone'])); ?>"><?php echo esc_html($patron_data['phone']); ?></a>
                                </li>
                            <?php endif; ?>
                            <?php if (!empty($patron_data['website'])): ?>
                                <li class="waas-patron-website">
                                    <span class="dashicons dashicons-admin-site"></span>
                                    <a href="<?php echo esc_url($patron_data['website']); ?>" target="_blank" rel="noopener"><?php echo esc_html($patron_data['website']); ?></a>
                                </li>
                            <?php endif; ?>
                        </ul>
                    </div>
                <?php endif; ?>
            </div>
        </div>
        <?php
    }

    /**
     * Add body classes for patronage mode
     *
     * @param array $classes Body classes
     * @return array Modified body classes
     */
    public function add_body_classes($classes) {
        if ($this->patronage_core->is_patronage_active()) {
            $classes[] = 'waas-patronage-active';
            $classes[] = 'waas-patron-' . sanitize_html_class($this->patronage_core->get_patron_seller_id());

            // Add feature classes
            $features = $this->patronage_core->get_patronage_features();
            foreach ($features as $feature => $enabled) {
                if ($enabled) {
                    $classes[] = 'waas-feature-' . sanitize_html_class($feature);
                }
            }
        } else {
            $classes[] = 'waas-patronage-inactive';
        }

        return $classes;
    }

    /**
     * Patron info shortcode
     *
     * Usage: [waas_patron_info show="brand_name,logo,email,phone,website,brand_story"]
     *
     * @param array $atts Shortcode attributes
     * @return string HTML output
     */
    public function patron_info_shortcode($atts) {
        if (!$this->patronage_core->is_patronage_active()) {
            return '';
        }

        $atts = shortcode_atts(array(
            'show' => 'brand_name,logo,email,phone,website',
        ), $atts);

        $show_fields = array_map('trim', explode(',', $atts['show']));
        $patron_data = $this->patronage_core->get_patron_data();

        if (empty($patron_data)) {
            return '';
        }

        ob_start();
        ?>
        <div class="waas-patron-info-box">
            <?php if (in_array('logo', $show_fields) && !empty($patron_data['logo_url'])): ?>
                <div class="waas-patron-info-logo">
                    <img src="<?php echo esc_url($patron_data['logo_url']); ?>"
                         alt="<?php echo esc_attr($patron_data['brand_name']); ?>">
                </div>
            <?php endif; ?>

            <?php if (in_array('brand_name', $show_fields)): ?>
                <h3 class="waas-patron-info-brand-name"><?php echo esc_html($patron_data['brand_name']); ?></h3>
            <?php endif; ?>

            <?php if (in_array('brand_story', $show_fields) && !empty($patron_data['brand_story'])): ?>
                <div class="waas-patron-info-brand-story">
                    <?php echo wp_kses_post($patron_data['brand_story']); ?>
                </div>
            <?php endif; ?>

            <?php if (in_array('email', $show_fields) && !empty($patron_data['email'])): ?>
                <p class="waas-patron-info-email">
                    <strong><?php _e('Email:', 'waas-patronage'); ?></strong>
                    <a href="mailto:<?php echo esc_attr($patron_data['email']); ?>"><?php echo esc_html($patron_data['email']); ?></a>
                </p>
            <?php endif; ?>

            <?php if (in_array('phone', $show_fields) && !empty($patron_data['phone'])): ?>
                <p class="waas-patron-info-phone">
                    <strong><?php _e('Phone:', 'waas-patronage'); ?></strong>
                    <a href="tel:<?php echo esc_attr(str_replace(' ', '', $patron_data['phone'])); ?>"><?php echo esc_html($patron_data['phone']); ?></a>
                </p>
            <?php endif; ?>

            <?php if (in_array('website', $show_fields) && !empty($patron_data['website'])): ?>
                <p class="waas-patron-info-website">
                    <strong><?php _e('Website:', 'waas-patronage'); ?></strong>
                    <a href="<?php echo esc_url($patron_data['website']); ?>" target="_blank" rel="noopener"><?php echo esc_html($patron_data['website']); ?></a>
                </p>
            <?php endif; ?>
        </div>
        <?php
        return ob_get_clean();
    }
}
