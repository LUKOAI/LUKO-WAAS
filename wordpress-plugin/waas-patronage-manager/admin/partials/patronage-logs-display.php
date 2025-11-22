<?php
/**
 * Patronage Logs Display
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

    <div class="patronage-logs-section" style="margin: 20px 0;">

        <?php if (!empty($logs)): ?>
            <div style="background: #fff; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h2 style="margin-top: 0;"><?php _e('Recent Activity', 'waas-patronage'); ?></h2>
                <p class="description"><?php echo sprintf(__('Showing last %d log entries', 'waas-patronage'), count($logs)); ?></p>

                <table class="widefat striped">
                    <thead>
                        <tr>
                            <th style="width: 150px;"><?php _e('Date/Time', 'waas-patronage'); ?></th>
                            <th style="width: 120px;"><?php _e('Event', 'waas-patronage'); ?></th>
                            <th><?php _e('Details', 'waas-patronage'); ?></th>
                            <th style="width: 100px;"><?php _e('User', 'waas-patronage'); ?></th>
                            <th style="width: 130px;"><?php _e('IP Address', 'waas-patronage'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach (array_reverse($logs) as $log): ?>
                        <tr>
                            <td>
                                <?php echo esc_html(date_i18n(get_option('date_format') . ' ' . get_option('time_format'), strtotime($log['timestamp']))); ?>
                            </td>
                            <td>
                                <?php
                                $event_labels = array(
                                    'activate' => '<span style="color: #46b450;">●</span> ' . __('Activated', 'waas-patronage'),
                                    'deactivate' => '<span style="color: #dc3232;">●</span> ' . __('Deactivated', 'waas-patronage'),
                                    'update' => '<span style="color: #0073aa;">●</span> ' . __('Updated', 'waas-patronage'),
                                );
                                echo isset($event_labels[$log['event']]) ? $event_labels[$log['event']] : esc_html($log['event']);
                                ?>
                            </td>
                            <td>
                                <?php
                                $details = array();
                                if (!empty($log['data']['seller_id'])) {
                                    $details[] = '<strong>' . __('Seller ID:', 'waas-patronage') . '</strong> <code>' . esc_html($log['data']['seller_id']) . '</code>';
                                }
                                if (!empty($log['data']['brand_name'])) {
                                    $details[] = '<strong>' . __('Brand:', 'waas-patronage') . '</strong> ' . esc_html($log['data']['brand_name']);
                                }
                                echo implode(' | ', $details);
                                ?>
                            </td>
                            <td>
                                <?php
                                if (!empty($log['user_id'])) {
                                    $user = get_userdata($log['user_id']);
                                    echo $user ? esc_html($user->display_name) : __('Unknown', 'waas-patronage');
                                } else {
                                    echo __('System', 'waas-patronage');
                                }
                                ?>
                            </td>
                            <td>
                                <code><?php echo esc_html(!empty($log['ip_address']) ? $log['ip_address'] : 'N/A'); ?></code>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        <?php else: ?>
            <div style="background: #fff; padding: 20px; border-left: 4px solid #ffb900; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h2 style="margin-top: 0;"><?php _e('No Logs Available', 'waas-patronage'); ?></h2>
                <p><?php _e('No patronage activity has been logged yet. Logs will appear here when you activate, deactivate, or update patronage settings.', 'waas-patronage'); ?></p>
            </div>
        <?php endif; ?>

    </div>
</div>
