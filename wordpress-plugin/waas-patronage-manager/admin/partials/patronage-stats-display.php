<?php
/**
 * Patronage Statistics Display
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

    <div class="patronage-stats-dashboard" style="margin: 20px 0;">

        <div class="patronage-stats-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px;">

            <!-- Status Card -->
            <div class="stats-card" style="background: #fff; padding: 20px; border-left: 4px solid <?php echo $stats['is_active'] ? '#46b450' : '#dc3232'; ?>; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #666;"><?php _e('Patronage Status', 'waas-patronage'); ?></h3>
                <p style="margin: 0; font-size: 28px; font-weight: bold; color: <?php echo $stats['is_active'] ? '#46b450' : '#dc3232'; ?>;">
                    <?php echo $stats['is_active'] ? __('ACTIVE', 'waas-patronage') : __('INACTIVE', 'waas-patronage'); ?>
                </p>
            </div>

            <!-- Patron Products Card -->
            <div class="stats-card" style="background: #fff; padding: 20px; border-left: 4px solid #0073aa; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #666;"><?php _e('Patron Products', 'waas-patronage'); ?></h3>
                <p style="margin: 0; font-size: 28px; font-weight: bold; color: #0073aa;">
                    <?php echo number_format_i18n($stats['patron_product_count']); ?>
                </p>
                <p style="margin: 5px 0 0 0; font-size: 12px; color: #999;">
                    <?php echo sprintf(__('%s%% of total', 'waas-patronage'), number_format_i18n($stats['patron_percentage'], 2)); ?>
                </p>
            </div>

            <!-- Total Products Card -->
            <div class="stats-card" style="background: #fff; padding: 20px; border-left: 4px solid #826eb4; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #666;"><?php _e('Total Products', 'waas-patronage'); ?></h3>
                <p style="margin: 0; font-size: 28px; font-weight: bold; color: #826eb4;">
                    <?php echo number_format_i18n($stats['total_product_count']); ?>
                </p>
            </div>

        </div>

        <?php if ($stats['is_active']): ?>
            <div class="patronage-patron-info" style="background: #fff; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px;">
                <h2 style="margin-top: 0;"><?php _e('Current Patron Information', 'waas-patronage'); ?></h2>

                <table class="widefat">
                    <tbody>
                        <tr>
                            <th style="width: 200px;"><?php _e('Seller ID', 'waas-patronage'); ?></th>
                            <td><code><?php echo esc_html($stats['patron_seller_id']); ?></code></td>
                        </tr>
                        <tr>
                            <th><?php _e('Brand Name', 'waas-patronage'); ?></th>
                            <td><?php echo esc_html($stats['patron_data']['brand_name']); ?></td>
                        </tr>
                        <?php if (!empty($stats['patron_data']['logo_url'])): ?>
                        <tr>
                            <th><?php _e('Logo', 'waas-patronage'); ?></th>
                            <td><img src="<?php echo esc_url($stats['patron_data']['logo_url']); ?>" alt="Logo" style="max-width: 200px; max-height: 80px;"></td>
                        </tr>
                        <?php endif; ?>
                        <?php if (!empty($stats['patron_data']['email'])): ?>
                        <tr>
                            <th><?php _e('Email', 'waas-patronage'); ?></th>
                            <td><?php echo esc_html($stats['patron_data']['email']); ?></td>
                        </tr>
                        <?php endif; ?>
                        <?php if (!empty($stats['patron_data']['phone'])): ?>
                        <tr>
                            <th><?php _e('Phone', 'waas-patronage'); ?></th>
                            <td><?php echo esc_html($stats['patron_data']['phone']); ?></td>
                        </tr>
                        <?php endif; ?>
                        <?php if (!empty($stats['patron_data']['website'])): ?>
                        <tr>
                            <th><?php _e('Website', 'waas-patronage'); ?></th>
                            <td><a href="<?php echo esc_url($stats['patron_data']['website']); ?>" target="_blank"><?php echo esc_html($stats['patron_data']['website']); ?></a></td>
                        </tr>
                        <?php endif; ?>
                        <?php if (!empty($stats['patron_data']['activated_at'])): ?>
                        <tr>
                            <th><?php _e('Activated On', 'waas-patronage'); ?></th>
                            <td><?php echo esc_html(date_i18n(get_option('date_format') . ' ' . get_option('time_format'), strtotime($stats['patron_data']['activated_at']))); ?></td>
                        </tr>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>

            <div class="patronage-features-info" style="background: #fff; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h2 style="margin-top: 0;"><?php _e('Enabled Features', 'waas-patronage'); ?></h2>

                <table class="widefat">
                    <thead>
                        <tr>
                            <th><?php _e('Feature', 'waas-patronage'); ?></th>
                            <th><?php _e('Status', 'waas-patronage'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($stats['features'] as $feature => $enabled): ?>
                        <tr>
                            <td><?php echo esc_html(ucwords(str_replace('_', ' ', $feature))); ?></td>
                            <td>
                                <span style="color: <?php echo $enabled ? '#46b450' : '#dc3232'; ?>; font-weight: bold;">
                                    <?php echo $enabled ? '✓ ' . __('Enabled', 'waas-patronage') : '✗ ' . __('Disabled', 'waas-patronage'); ?>
                                </span>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        <?php else: ?>
            <div class="patronage-inactive-notice" style="background: #fff; padding: 20px; border-left: 4px solid #ffb900; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h2 style="margin-top: 0;"><?php _e('Patronage is Not Active', 'waas-patronage'); ?></h2>
                <p><?php _e('Activate patronage to start filtering products and displaying patron branding.', 'waas-patronage'); ?></p>
                <p><a href="<?php echo admin_url('admin.php?page=waas-patronage'); ?>" class="button button-primary"><?php _e('Activate Patronage', 'waas-patronage'); ?></a></p>
            </div>
        <?php endif; ?>

    </div>
</div>
