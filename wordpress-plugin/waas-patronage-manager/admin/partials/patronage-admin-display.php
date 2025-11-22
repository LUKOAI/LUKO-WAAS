<?php
/**
 * Patronage Admin Display
 *
 * @package WAAS_Patronage_Manager
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}
?>

<div class="wrap">
    <h1><?php echo esc_html(get_admin_page_title()); ?></h1>

    <div class="patronage-status-section" style="margin: 20px 0; padding: 15px; background: #f0f0f1; border-left: 4px solid <?php echo $is_active ? '#46b450' : '#dc3232'; ?>;">
        <h2 style="margin-top: 0;">
            <?php _e('Current Status:', 'waas-patronage'); ?>
            <strong style="color: <?php echo $is_active ? '#46b450' : '#dc3232'; ?>;">
                <?php echo $is_active ? __('ACTIVE', 'waas-patronage') : __('INACTIVE', 'waas-patronage'); ?>
            </strong>
        </h2>

        <?php if ($is_active && !empty($patron_data)): ?>
            <div style="margin-top: 15px;">
                <p><strong><?php _e('Brand Name:', 'waas-patronage'); ?></strong> <?php echo esc_html($patron_data['brand_name']); ?></p>
                <p><strong><?php _e('Seller ID:', 'waas-patronage'); ?></strong> <?php echo esc_html($patron_data['seller_id']); ?></p>
                <?php if (!empty($patron_data['logo_url'])): ?>
                    <p><strong><?php _e('Logo:', 'waas-patronage'); ?></strong><br>
                    <img src="<?php echo esc_url($patron_data['logo_url']); ?>" alt="<?php echo esc_attr($patron_data['brand_name']); ?>" style="max-width: 200px; max-height: 100px; margin-top: 5px;"></p>
                <?php endif; ?>
                <?php if (!empty($patron_data['email'])): ?>
                    <p><strong><?php _e('Email:', 'waas-patronage'); ?></strong> <?php echo esc_html($patron_data['email']); ?></p>
                <?php endif; ?>
                <?php if (!empty($patron_data['phone'])): ?>
                    <p><strong><?php _e('Phone:', 'waas-patronage'); ?></strong> <?php echo esc_html($patron_data['phone']); ?></p>
                <?php endif; ?>
                <?php if (!empty($patron_data['website'])): ?>
                    <p><strong><?php _e('Website:', 'waas-patronage'); ?></strong> <a href="<?php echo esc_url($patron_data['website']); ?>" target="_blank"><?php echo esc_html($patron_data['website']); ?></a></p>
                <?php endif; ?>
                <?php if (!empty($patron_data['activated_at'])): ?>
                    <p><strong><?php _e('Activated:', 'waas-patronage'); ?></strong> <?php echo esc_html(date_i18n(get_option('date_format') . ' ' . get_option('time_format'), strtotime($patron_data['activated_at']))); ?></p>
                <?php endif; ?>
            </div>

            <h3><?php _e('Enabled Features:', 'waas-patronage'); ?></h3>
            <ul>
                <?php foreach ($features as $feature => $enabled): ?>
                    <li>
                        <span style="color: <?php echo $enabled ? '#46b450' : '#dc3232'; ?>;">●</span>
                        <?php echo esc_html(ucwords(str_replace('_', ' ', $feature))); ?>
                    </li>
                <?php endforeach; ?>
            </ul>
        <?php endif; ?>
    </div>

    <hr>

    <?php if (!$is_active): ?>
        <!-- Activation Form -->
        <div class="patronage-activation-form">
            <h2><?php _e('Activate Patronage', 'waas-patronage'); ?></h2>
            <p class="description"><?php _e('Fill in the patron information to activate patronage mode. This will filter products to show only those from the specified seller.', 'waas-patronage'); ?></p>

            <form method="post" action="">
                <?php wp_nonce_field('waas_patronage_action', 'waas_patronage_nonce'); ?>
                <input type="hidden" name="waas_patronage_action" value="activate">

                <table class="form-table">
                    <tr>
                        <th scope="row">
                            <label for="seller_id"><?php _e('Seller ID', 'waas-patronage'); ?> <span class="required">*</span></label>
                        </th>
                        <td>
                            <input type="text" id="seller_id" name="seller_id" class="regular-text" required>
                            <p class="description"><?php _e('Amazon Seller ID or UUID (used for product filtering)', 'waas-patronage'); ?></p>
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="brand_name"><?php _e('Brand Name', 'waas-patronage'); ?> <span class="required">*</span></label>
                        </th>
                        <td>
                            <input type="text" id="brand_name" name="brand_name" class="regular-text" required>
                            <p class="description"><?php _e('Company or brand name to display', 'waas-patronage'); ?></p>
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="logo_url"><?php _e('Logo URL', 'waas-patronage'); ?> <span class="required">*</span></label>
                        </th>
                        <td>
                            <input type="url" id="logo_url" name="logo_url" class="regular-text" required>
                            <p class="description"><?php _e('Full URL to brand logo image', 'waas-patronage'); ?></p>
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="email"><?php _e('Contact Email', 'waas-patronage'); ?></label>
                        </th>
                        <td>
                            <input type="email" id="email" name="email" class="regular-text">
                            <p class="description"><?php _e('Contact email (optional)', 'waas-patronage'); ?></p>
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="phone"><?php _e('Contact Phone', 'waas-patronage'); ?></label>
                        </th>
                        <td>
                            <input type="text" id="phone" name="phone" class="regular-text">
                            <p class="description"><?php _e('Contact phone number (optional)', 'waas-patronage'); ?></p>
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="website"><?php _e('Website URL', 'waas-patronage'); ?></label>
                        </th>
                        <td>
                            <input type="url" id="website" name="website" class="regular-text">
                            <p class="description"><?php _e('Brand website URL (optional)', 'waas-patronage'); ?></p>
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="brand_story"><?php _e('Brand Story', 'waas-patronage'); ?></label>
                        </th>
                        <td>
                            <textarea id="brand_story" name="brand_story" rows="5" class="large-text"></textarea>
                            <p class="description"><?php _e('About the brand (HTML allowed, optional)', 'waas-patronage'); ?></p>
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <?php _e('Features to Enable', 'waas-patronage'); ?>
                        </th>
                        <td>
                            <fieldset>
                                <label>
                                    <input type="checkbox" name="feature_logo" value="1" checked>
                                    <?php _e('Display Logo', 'waas-patronage'); ?>
                                </label><br>
                                <label>
                                    <input type="checkbox" name="feature_contact" value="1" checked>
                                    <?php _e('Display Contact Info', 'waas-patronage'); ?>
                                </label><br>
                                <label>
                                    <input type="checkbox" name="feature_brand_story" value="1" checked>
                                    <?php _e('Display Brand Story', 'waas-patronage'); ?>
                                </label><br>
                                <label>
                                    <input type="checkbox" name="feature_exclusive_products" value="1" checked>
                                    <?php _e('Exclusive Products Only', 'waas-patronage'); ?>
                                </label>
                            </fieldset>
                        </td>
                    </tr>
                </table>

                <p class="submit">
                    <input type="submit" name="submit" id="submit" class="button button-primary" value="<?php esc_attr_e('Activate Patronage', 'waas-patronage'); ?>">
                </p>
            </form>
        </div>

    <?php else: ?>
        <!-- Deactivation Form -->
        <div class="patronage-deactivation-form">
            <h2><?php _e('Deactivate Patronage', 'waas-patronage'); ?></h2>
            <p class="description"><?php _e('Deactivate patronage mode to return to showing products from all vendors.', 'waas-patronage'); ?></p>

            <form method="post" action="" onsubmit="return confirm('<?php esc_attr_e('Are you sure you want to deactivate patronage?', 'waas-patronage'); ?>');">
                <?php wp_nonce_field('waas_patronage_action', 'waas_patronage_nonce'); ?>
                <input type="hidden" name="waas_patronage_action" value="deactivate">

                <p class="submit">
                    <input type="submit" name="submit" id="submit" class="button button-secondary" value="<?php esc_attr_e('Deactivate Patronage', 'waas-patronage'); ?>">
                </p>
            </form>
        </div>

        <hr>

        <!-- Update Form -->
        <div class="patronage-update-form">
            <h2><?php _e('Update Patron Data', 'waas-patronage'); ?></h2>
            <p class="description"><?php _e('Update patron information. Leave fields empty to keep existing values.', 'waas-patronage'); ?></p>

            <form method="post" action="">
                <?php wp_nonce_field('waas_patronage_action', 'waas_patronage_nonce'); ?>
                <input type="hidden" name="waas_patronage_action" value="update">

                <table class="form-table">
                    <tr>
                        <th scope="row">
                            <label for="update_brand_name"><?php _e('Brand Name', 'waas-patronage'); ?></label>
                        </th>
                        <td>
                            <input type="text" id="update_brand_name" name="brand_name" class="regular-text" placeholder="<?php echo esc_attr($patron_data['brand_name']); ?>">
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="update_logo_url"><?php _e('Logo URL', 'waas-patronage'); ?></label>
                        </th>
                        <td>
                            <input type="url" id="update_logo_url" name="logo_url" class="regular-text" placeholder="<?php echo esc_attr($patron_data['logo_url']); ?>">
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="update_email"><?php _e('Contact Email', 'waas-patronage'); ?></label>
                        </th>
                        <td>
                            <input type="email" id="update_email" name="email" class="regular-text" placeholder="<?php echo esc_attr(!empty($patron_data['email']) ? $patron_data['email'] : ''); ?>">
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="update_phone"><?php _e('Contact Phone', 'waas-patronage'); ?></label>
                        </th>
                        <td>
                            <input type="text" id="update_phone" name="phone" class="regular-text" placeholder="<?php echo esc_attr(!empty($patron_data['phone']) ? $patron_data['phone'] : ''); ?>">
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="update_website"><?php _e('Website URL', 'waas-patronage'); ?></label>
                        </th>
                        <td>
                            <input type="url" id="update_website" name="website" class="regular-text" placeholder="<?php echo esc_attr(!empty($patron_data['website']) ? $patron_data['website'] : ''); ?>">
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="update_brand_story"><?php _e('Brand Story', 'waas-patronage'); ?></label>
                        </th>
                        <td>
                            <textarea id="update_brand_story" name="brand_story" rows="5" class="large-text" placeholder="<?php echo esc_attr(!empty($patron_data['brand_story']) ? wp_strip_all_tags($patron_data['brand_story']) : ''); ?>"></textarea>
                        </td>
                    </tr>
                </table>

                <p class="submit">
                    <input type="submit" name="submit" id="submit" class="button button-primary" value="<?php esc_attr_e('Update Patron Data', 'waas-patronage'); ?>">
                </p>
            </form>
        </div>
    <?php endif; ?>

    <hr>

    <div class="patronage-api-info">
        <h2><?php _e('REST API Endpoints', 'waas-patronage'); ?></h2>
        <p class="description"><?php _e('Use these endpoints for external integrations (Stripe webhooks, etc.)', 'waas-patronage'); ?></p>

        <table class="widefat">
            <thead>
                <tr>
                    <th><?php _e('Endpoint', 'waas-patronage'); ?></th>
                    <th><?php _e('Method', 'waas-patronage'); ?></th>
                    <th><?php _e('Description', 'waas-patronage'); ?></th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><code><?php echo esc_html(rest_url('waas/v1/patronage/activate')); ?></code></td>
                    <td><strong>POST</strong></td>
                    <td><?php _e('Activate patronage', 'waas-patronage'); ?></td>
                </tr>
                <tr>
                    <td><code><?php echo esc_html(rest_url('waas/v1/patronage/deactivate')); ?></code></td>
                    <td><strong>POST</strong></td>
                    <td><?php _e('Deactivate patronage', 'waas-patronage'); ?></td>
                </tr>
                <tr>
                    <td><code><?php echo esc_html(rest_url('waas/v1/patronage/status')); ?></code></td>
                    <td><strong>GET</strong></td>
                    <td><?php _e('Get patronage status', 'waas-patronage'); ?></td>
                </tr>
                <tr>
                    <td><code><?php echo esc_html(rest_url('waas/v1/patronage/update')); ?></code></td>
                    <td><strong>POST</strong></td>
                    <td><?php _e('Update patron data', 'waas-patronage'); ?></td>
                </tr>
                <tr>
                    <td><code><?php echo esc_html(rest_url('waas/v1/patronage/stats')); ?></code></td>
                    <td><strong>GET</strong></td>
                    <td><?php _e('Get statistics', 'waas-patronage'); ?></td>
                </tr>
                <tr>
                    <td><code><?php echo esc_html(rest_url('waas/v1/patronage/logs')); ?></code></td>
                    <td><strong>GET</strong></td>
                    <td><?php _e('Get activity logs', 'waas-patronage'); ?></td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<style>
.patronage-status-section h2 {
    margin-bottom: 10px;
}
.required {
    color: #dc3232;
}
</style>
