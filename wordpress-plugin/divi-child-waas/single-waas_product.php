<?php
/**
 * Single Amazon Product Template
 *
 * Template for displaying single waas_product posts
 * with conditional patronage branding
 *
 * @package Divi_Child_WAAS
 */

get_header();

// Check if patronage is active
$is_patronage = is_waas_patronage_active();
$patron_data = get_waas_patron_data();
?>

<div id="main-content">
    <div class="container">
        <div id="content-area" class="clearfix">
            <div id="left-area">

                <?php while (have_posts()) : the_post(); ?>

                    <article id="post-<?php the_ID(); ?>" <?php post_class('et_pb_post'); ?>>

                        <?php
                        // Get product meta data
                        $asin = get_post_meta(get_the_ID(), '_waas_asin', true);
                        $price = get_post_meta(get_the_ID(), '_waas_price', true);
                        $savings = get_post_meta(get_the_ID(), '_waas_savings', true);
                        $brand = get_post_meta(get_the_ID(), '_waas_brand', true);
                        $features = get_post_meta(get_the_ID(), '_waas_features', true);
                        $image_url = get_post_meta(get_the_ID(), '_waas_image_url', true);
                        $affiliate_link = get_post_meta(get_the_ID(), '_waas_affiliate_link', true);
                        $prime_eligible = get_post_meta(get_the_ID(), '_waas_prime_eligible', true);
                        $availability = get_post_meta(get_the_ID(), '_waas_availability', true);
                        $seller_id = get_post_meta(get_the_ID(), '_waas_seller_id', true);
                        ?>

                        <!-- Patronage Branding (if active) -->
                        <?php if ($is_patronage && !empty($patron_data)): ?>
                            <div class="waas-product-patron-badge" style="background: #f8f9fa; padding: 15px; margin-bottom: 20px; border-left: 4px solid #0073aa; border-radius: 4px;">
                                <p style="margin: 0; display: flex; align-items: center; gap: 10px;">
                                    <?php if (!empty($patron_data['logo_url'])): ?>
                                        <img src="<?php echo esc_url($patron_data['logo_url']); ?>"
                                             alt="<?php echo esc_attr($patron_data['brand_name']); ?>"
                                             style="max-width: 100px; max-height: 40px;">
                                    <?php endif; ?>
                                    <span style="color: #0073aa; font-weight: 600;">
                                        <?php echo sprintf(__('Official Product from %s', 'divi-child-waas'), esc_html($patron_data['brand_name'])); ?>
                                    </span>
                                </p>
                            </div>
                        <?php endif; ?>

                        <!-- Breadcrumbs -->
                        <?php if (function_exists('et_get_breadcrumbs')): ?>
                            <div class="et-breadcrumbs">
                                <?php et_get_breadcrumbs(); ?>
                            </div>
                        <?php endif; ?>

                        <!-- Product Title -->
                        <h1 class="entry-title"><?php the_title(); ?></h1>

                        <!-- Product Brand -->
                        <?php if ($brand): ?>
                            <p class="waas-product-brand" style="font-size: 16px; color: #666; margin: 10px 0 20px;">
                                <?php echo sprintf(__('by %s', 'divi-child-waas'), '<strong>' . esc_html($brand) . '</strong>'); ?>
                            </p>
                        <?php endif; ?>

                        <!-- Product Container -->
                        <div class="waas-product-single-container">

                            <!-- Left Column: Image -->
                            <div class="waas-product-image-gallery">
                                <?php if ($image_url): ?>
                                    <img src="<?php echo esc_url($image_url); ?>"
                                         alt="<?php echo esc_attr(get_the_title()); ?>"
                                         style="width: 100%; height: auto; border: 1px solid #ddd; border-radius: 8px;">
                                <?php endif; ?>
                            </div>

                            <!-- Right Column: Details -->
                            <div class="waas-product-details">

                                <!-- Price -->
                                <?php if ($price): ?>
                                    <div class="waas-product-price" style="font-size: 32px; color: #B12704; font-weight: 700; margin: 20px 0;">
                                        <?php echo esc_html($price); ?>
                                        <?php if ($savings): ?>
                                            <span style="font-size: 18px; color: #007600; font-weight: 400; margin-left: 10px;">
                                                <?php echo sprintf(__('-%s%%', 'divi-child-waas'), esc_html($savings)); ?>
                                            </span>
                                        <?php endif; ?>
                                    </div>
                                <?php endif; ?>

                                <!-- Prime Badge -->
                                <?php if ($prime_eligible): ?>
                                    <div class="waas-prime-badge" style="background: #00a8e1; color: #fff; display: inline-block; padding: 5px 12px; border-radius: 4px; font-size: 14px; font-weight: 600; margin-bottom: 15px;">
                                        ⚡ <?php _e('Prime Eligible', 'divi-child-waas'); ?>
                                    </div>
                                <?php endif; ?>

                                <!-- Availability -->
                                <?php if ($availability): ?>
                                    <?php
                                    $availability_colors = array(
                                        'in_stock' => '#007600',
                                        'out_of_stock' => '#dc3232',
                                        'limited' => '#ff9900',
                                    );
                                    $color = isset($availability_colors[$availability]) ? $availability_colors[$availability] : '#666';
                                    ?>
                                    <p style="color: <?php echo esc_attr($color); ?>; font-weight: 600; margin-bottom: 15px;">
                                        <?php
                                        switch ($availability) {
                                            case 'in_stock':
                                                _e('In Stock', 'divi-child-waas');
                                                break;
                                            case 'out_of_stock':
                                                _e('Out of Stock', 'divi-child-waas');
                                                break;
                                            case 'limited':
                                                _e('Limited Availability', 'divi-child-waas');
                                                break;
                                        }
                                        ?>
                                    </p>
                                <?php endif; ?>

                                <!-- Amazon CTA Button -->
                                <?php if ($affiliate_link): ?>
                                    <a href="<?php echo esc_url($affiliate_link); ?>"
                                       target="_blank"
                                       rel="nofollow noopener sponsored"
                                       class="et_pb_button waas-amazon-button"
                                       style="background: #ff9900; color: #fff; padding: 12px 30px; font-size: 18px; font-weight: 600; border-radius: 8px; text-decoration: none; display: inline-block; margin: 20px 0; transition: background 0.2s ease;">
                                        <?php _e('View on Amazon', 'divi-child-waas'); ?> →
                                    </a>
                                <?php endif; ?>

                                <!-- Features List -->
                                <?php if ($features): ?>
                                    <div class="waas-product-features" style="margin: 30px 0;">
                                        <h3 style="font-size: 20px; font-weight: 600; margin-bottom: 15px;">
                                            <?php _e('Key Features', 'divi-child-waas'); ?>
                                        </h3>
                                        <ul style="list-style: none; padding: 0; margin: 0;">
                                            <?php
                                            $features_array = explode("\n", $features);
                                            foreach ($features_array as $feature):
                                                if (trim($feature)):
                                            ?>
                                                <li style="padding: 8px 0; padding-left: 25px; position: relative; line-height: 1.6;">
                                                    <span style="position: absolute; left: 0; color: #0073aa;">✓</span>
                                                    <?php echo esc_html(trim($feature)); ?>
                                                </li>
                                            <?php
                                                endif;
                                            endforeach;
                                            ?>
                                        </ul>
                                    </div>
                                <?php endif; ?>

                                <!-- Patron Contact (if patronage active and contact enabled) -->
                                <?php if ($is_patronage && is_waas_patron_feature_enabled('contact')): ?>
                                    <div class="waas-patron-contact-box" style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 30px;">
                                        <h4 style="margin-top: 0; color: #212529;">
                                            <?php echo sprintf(__('Questions about this product? Contact %s', 'divi-child-waas'), esc_html($patron_data['brand_name'])); ?>
                                        </h4>
                                        <?php if (!empty($patron_data['email'])): ?>
                                            <p style="margin: 5px 0;">
                                                <strong><?php _e('Email:', 'divi-child-waas'); ?></strong>
                                                <a href="mailto:<?php echo esc_attr($patron_data['email']); ?>"><?php echo esc_html($patron_data['email']); ?></a>
                                            </p>
                                        <?php endif; ?>
                                        <?php if (!empty($patron_data['phone'])): ?>
                                            <p style="margin: 5px 0;">
                                                <strong><?php _e('Phone:', 'divi-child-waas'); ?></strong>
                                                <a href="tel:<?php echo esc_attr(str_replace(' ', '', $patron_data['phone'])); ?>"><?php echo esc_html($patron_data['phone']); ?></a>
                                            </p>
                                        <?php endif; ?>
                                        <?php if (!empty($patron_data['website'])): ?>
                                            <p style="margin: 5px 0;">
                                                <strong><?php _e('Website:', 'divi-child-waas'); ?></strong>
                                                <a href="<?php echo esc_url($patron_data['website']); ?>" target="_blank" rel="noopener"><?php echo esc_html($patron_data['website']); ?></a>
                                            </p>
                                        <?php endif; ?>
                                    </div>
                                <?php endif; ?>

                            </div>

                        </div>

                        <!-- Product Description (Content) -->
                        <div class="entry-content" style="margin-top: 40px;">
                            <?php the_content(); ?>
                        </div>

                        <!-- Amazon Disclosure -->
                        <div class="waas-amazon-disclosure" style="background: #f0f0f1; padding: 15px; border-radius: 4px; font-size: 12px; color: #666; margin-top: 30px;">
                            <?php
                            echo sprintf(
                                __('As an Amazon Associate we earn from qualifying purchases. Product prices and availability are accurate as of the date/time indicated and are subject to change. Any price and availability information displayed on Amazon.com at the time of purchase will apply to the purchase of this product. Last updated on %s', 'divi-child-waas'),
                                date_i18n(get_option('date_format') . ' ' . get_option('time_format'))
                            );
                            ?>
                        </div>

                    </article>

                <?php endwhile; ?>

            </div> <!-- #left-area -->

            <?php get_sidebar(); ?>

        </div> <!-- #content-area -->
    </div> <!-- .container -->
</div> <!-- #main-content -->

<?php get_footer(); ?>
