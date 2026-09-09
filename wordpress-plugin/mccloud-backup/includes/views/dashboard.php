<?php
/**
 * Dashboard view
 *
 * @package McCloud Backup
 */

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

// Get options
$options = get_option('mccloud_backup_options', []);

// Get recent backups
global $wpdb;
$table_name = $wpdb->prefix . 'mccloud_backup_logs';
$recent_backups = $wpdb->get_results(
    "SELECT * FROM {$table_name} ORDER BY start_time DESC LIMIT 5"
);

?>

<div class="wrap mccloud-backup-dashboard">
    <h1><?php _e('McCloud Backup Dashboard', 'mccloud-backup'); ?></h1>
    
    <?php if (empty($options['api_key'])): ?>
    <div class="notice notice-warning">
        <p>
            <?php _e('Please enter your McCloud Backup API key in the settings to fully activate the plugin.', 'mccloud-backup'); ?>
            <a href="<?php echo admin_url('admin.php?page=mccloud-backup-settings'); ?>" class="button button-primary">
                <?php _e('Go to Settings', 'mccloud-backup'); ?>
            </a>
        </p>
    </div>
    <?php endif; ?>
    
    <div class="mccloud-backup-card-grid">
        <!-- Status Card -->
        <div class="mccloud-backup-card">
            <div class="mccloud-backup-card-header">
                <h2><?php _e('Status', 'mccloud-backup'); ?></h2>
            </div>
            <div class="mccloud-backup-card-body">
                <div class="mccloud-backup-status-item">
                    <span class="mccloud-backup-status-label"><?php _e('Site ID:', 'mccloud-backup'); ?></span>
                    <span class="mccloud-backup-status-value"><?php echo esc_html($options['site_id'] ?? __('Not set', 'mccloud-backup')); ?></span>
                </div>
                <div class="mccloud-backup-status-item">
                    <span class="mccloud-backup-status-label"><?php _e('API Connection:', 'mccloud-backup'); ?></span>
                    <span class="mccloud-backup-status-value" id="mccloud-backup-api-status">
                        <?php if (empty($options['api_key'])): ?>
                            <span class="mccloud-backup-status-not-configured"><?php _e('Not Configured', 'mccloud-backup'); ?></span>
                        <?php else: ?>
                            <span class="mccloud-backup-status-checking"><?php _e('Checking...', 'mccloud-backup'); ?></span>
                        <?php endif; ?>
                    </span>
                </div>
                <div class="mccloud-backup-status-item">
                    <span class="mccloud-backup-status-label"><?php _e('UpdraftPlus:', 'mccloud-backup'); ?></span>
                    <span class="mccloud-backup-status-value">
                        <?php if (mccloud_backup_is_updraftplus_active()): ?>
                            <span class="mccloud-backup-status-active"><?php _e('Active', 'mccloud-backup'); ?></span>
                        <?php else: ?>
                            <span class="mccloud-backup-status-error"><?php _e('Not Active', 'mccloud-backup'); ?></span>
                        <?php endif; ?>
                    </span>
                </div>
                <div class="mccloud-backup-status-item">
                    <span class="mccloud-backup-status-label"><?php _e('Auto Backup:', 'mccloud-backup'); ?></span>
                    <span class="mccloud-backup-status-value">
                        <?php if (!empty($options['auto_backup'])): ?>
                            <span class="mccloud-backup-status-active">
                                <?php 
                                $schedule = $options['backup_schedule'] ?? 'daily';
                                $schedule_display = [
                                    'hourly' => __('Hourly', 'mccloud-backup'),
                                    'twicedaily' => __('Twice Daily', 'mccloud-backup'),
                                    'daily' => __('Daily', 'mccloud-backup'),
                                    'weekly' => __('Weekly', 'mccloud-backup'),
                                ];
                                echo sprintf(__('Enabled (%s)', 'mccloud-backup'), $schedule_display[$schedule]);
                                ?>
                            </span>
                        <?php else: ?>
                            <span class="mccloud-backup-status-inactive"><?php _e('Disabled', 'mccloud-backup'); ?></span>
                        <?php endif; ?>
                    </span>
                </div>
            </div>
        </div>
        
        <!-- Quick Actions Card -->
        <div class="mccloud-backup-card">
            <div class="mccloud-backup-card-header">
                <h2><?php _e('Quick Actions', 'mccloud-backup'); ?></h2>
            </div>
            <div class="mccloud-backup-card-body">
                <p><?php _e('Start a new backup with your preferred settings:', 'mccloud-backup'); ?></p>
                
                <div class="mccloud-backup-actions">
                    <button type="button" class="button button-primary start-backup" data-type="full">
                        <?php _e('Full Backup', 'mccloud-backup'); ?>
                    </button>
                    
                    <button type="button" class="button start-backup" data-type="database">
                        <?php _e('Database Only', 'mccloud-backup'); ?>
                    </button>
                    
                    <button type="button" class="button start-backup" data-type="files">
                        <?php _e('Files Only', 'mccloud-backup'); ?>
                    </button>
                </div>
                
                <div id="mccloud-backup-backup-progress" style="display: none;">
                    <div class="mccloud-backup-progress-bar">
                        <div class="mccloud-backup-progress-bar-inner"></div>
                    </div>
                    <p id="mccloud-backup-backup-status"><?php _e('Backup in progress...', 'mccloud-backup'); ?></p>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Recent Backups Card -->
    <div class="mccloud-backup-card mccloud-backup-full-width">
        <div class="mccloud-backup-card-header">
            <h2><?php _e('Recent Backups', 'mccloud-backup'); ?></h2>
        </div>
        <div class="mccloud-backup-card-body">
            <?php if (empty($recent_backups)): ?>
            <p><?php _e('No backups found. Start your first backup using the quick actions above.', 'mccloud-backup'); ?></p>
            <?php else: ?>
            <table class="wp-list-table widefat fixed striped mccloud-backup-backup-table">
                <thead>
                    <tr>
                        <th><?php _e('Backup ID', 'mccloud-backup'); ?></th>
                        <th><?php _e('Type', 'mccloud-backup'); ?></th>
                        <th><?php _e('Status', 'mccloud-backup'); ?></th>
                        <th><?php _e('Started', 'mccloud-backup'); ?></th>
                        <th><?php _e('Completed', 'mccloud-backup'); ?></th>
                        <th><?php _e('Size', 'mccloud-backup'); ?></th>
                        <th><?php _e('Files', 'mccloud-backup'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($recent_backups as $backup): ?>
                    <tr>
                        <td><?php echo esc_html($backup->backup_id); ?></td>
                        <td>
                            <?php 
                            $type_labels = [
                                'full' => __('Full', 'mccloud-backup'),
                                'database' => __('Database', 'mccloud-backup'),
                                'files' => __('Files', 'mccloud-backup'),
                            ];
                            echo esc_html($type_labels[$backup->type] ?? $backup->type); 
                            ?>
                        </td>
                        <td>
                            <span class="mccloud-backup-status mccloud-backup-status-<?php echo esc_attr($backup->status); ?>">
                                <?php 
                                $status_labels = [
                                    'started' => __('In Progress', 'mccloud-backup'),
                                    'completed' => __('Completed', 'mccloud-backup'),
                                    'error' => __('Failed', 'mccloud-backup'),
                                ];
                                echo esc_html($status_labels[$backup->status] ?? $backup->status); 
                                ?>
                            </span>
                        </td>
                        <td><?php echo esc_html(get_date_from_gmt($backup->start_time)); ?></td>
                        <td>
                            <?php 
                            if ($backup->end_time) {
                                echo esc_html(get_date_from_gmt($backup->end_time));
                            } else {
                                echo '–';
                            }
                            ?>
                        </td>
                        <td>
                            <?php 
                            if ($backup->size) {
                                echo esc_html(size_format($backup->size));
                            } else {
                                echo '–';
                            }
                            ?>
                        </td>
                        <td><?php echo esc_html($backup->file_count ?: '–'); ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <?php endif; ?>
            
            <p class="mccloud-backup-view-all">
                <a href="<?php echo admin_url('admin.php?page=mccloud-backup-history'); ?>" class="button">
                    <?php _e('View All Backups', 'mccloud-backup'); ?>
                </a>
                <a href="<?php echo esc_url(mccloud_backup_get_dashboard_url()); ?>" class="button" target="_blank">
                    <?php _e('Open McCloud Backup Dashboard', 'mccloud-backup'); ?>
                </a>
            </p>
        </div>
    </div>
</div>