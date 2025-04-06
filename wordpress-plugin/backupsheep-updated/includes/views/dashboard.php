<?php
/**
 * Dashboard view
 *
 * @package BackupSheep
 */

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

// Get options
$options = get_option('backupsheep_options', []);

// Get recent backups
global $wpdb;
$table_name = $wpdb->prefix . 'backupsheep_logs';
$recent_backups = $wpdb->get_results(
    "SELECT * FROM {$table_name} ORDER BY start_time DESC LIMIT 5"
);

?>

<div class="wrap backupsheep-dashboard">
    <h1><?php _e('BackupSheep Dashboard', 'backupsheep'); ?></h1>
    
    <?php if (empty($options['api_key'])): ?>
    <div class="notice notice-warning">
        <p>
            <?php _e('Please enter your BackupSheep API key in the settings to fully activate the plugin.', 'backupsheep'); ?>
            <a href="<?php echo admin_url('admin.php?page=backupsheep-settings'); ?>" class="button button-primary">
                <?php _e('Go to Settings', 'backupsheep'); ?>
            </a>
        </p>
    </div>
    <?php endif; ?>
    
    <div class="backupsheep-card-grid">
        <!-- Status Card -->
        <div class="backupsheep-card">
            <div class="backupsheep-card-header">
                <h2><?php _e('Status', 'backupsheep'); ?></h2>
            </div>
            <div class="backupsheep-card-body">
                <div class="backupsheep-status-item">
                    <span class="backupsheep-status-label"><?php _e('Site ID:', 'backupsheep'); ?></span>
                    <span class="backupsheep-status-value"><?php echo esc_html($options['site_id'] ?? __('Not set', 'backupsheep')); ?></span>
                </div>
                <div class="backupsheep-status-item">
                    <span class="backupsheep-status-label"><?php _e('API Connection:', 'backupsheep'); ?></span>
                    <span class="backupsheep-status-value" id="backupsheep-api-status">
                        <?php if (empty($options['api_key'])): ?>
                            <span class="backupsheep-status-not-configured"><?php _e('Not Configured', 'backupsheep'); ?></span>
                        <?php else: ?>
                            <span class="backupsheep-status-checking"><?php _e('Checking...', 'backupsheep'); ?></span>
                        <?php endif; ?>
                    </span>
                </div>
                <div class="backupsheep-status-item">
                    <span class="backupsheep-status-label"><?php _e('UpdraftPlus:', 'backupsheep'); ?></span>
                    <span class="backupsheep-status-value">
                        <?php if (backupsheep_is_updraftplus_active()): ?>
                            <span class="backupsheep-status-active"><?php _e('Active', 'backupsheep'); ?></span>
                        <?php else: ?>
                            <span class="backupsheep-status-error"><?php _e('Not Active', 'backupsheep'); ?></span>
                        <?php endif; ?>
                    </span>
                </div>
                <div class="backupsheep-status-item">
                    <span class="backupsheep-status-label"><?php _e('Auto Backup:', 'backupsheep'); ?></span>
                    <span class="backupsheep-status-value">
                        <?php if (!empty($options['auto_backup'])): ?>
                            <span class="backupsheep-status-active">
                                <?php 
                                $schedule = $options['backup_schedule'] ?? 'daily';
                                $schedule_display = [
                                    'hourly' => __('Hourly', 'backupsheep'),
                                    'twicedaily' => __('Twice Daily', 'backupsheep'),
                                    'daily' => __('Daily', 'backupsheep'),
                                    'weekly' => __('Weekly', 'backupsheep'),
                                ];
                                echo sprintf(__('Enabled (%s)', 'backupsheep'), $schedule_display[$schedule]);
                                ?>
                            </span>
                        <?php else: ?>
                            <span class="backupsheep-status-inactive"><?php _e('Disabled', 'backupsheep'); ?></span>
                        <?php endif; ?>
                    </span>
                </div>
            </div>
        </div>
        
        <!-- Quick Actions Card -->
        <div class="backupsheep-card">
            <div class="backupsheep-card-header">
                <h2><?php _e('Quick Actions', 'backupsheep'); ?></h2>
            </div>
            <div class="backupsheep-card-body">
                <p><?php _e('Start a new backup with your preferred settings:', 'backupsheep'); ?></p>
                
                <div class="backupsheep-actions">
                    <button type="button" class="button button-primary start-backup" data-type="full">
                        <?php _e('Full Backup', 'backupsheep'); ?>
                    </button>
                    
                    <button type="button" class="button start-backup" data-type="database">
                        <?php _e('Database Only', 'backupsheep'); ?>
                    </button>
                    
                    <button type="button" class="button start-backup" data-type="files">
                        <?php _e('Files Only', 'backupsheep'); ?>
                    </button>
                </div>
                
                <div id="backupsheep-backup-progress" style="display: none;">
                    <div class="backupsheep-progress-bar">
                        <div class="backupsheep-progress-bar-inner"></div>
                    </div>
                    <p id="backupsheep-backup-status"><?php _e('Backup in progress...', 'backupsheep'); ?></p>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Recent Backups Card -->
    <div class="backupsheep-card backupsheep-full-width">
        <div class="backupsheep-card-header">
            <h2><?php _e('Recent Backups', 'backupsheep'); ?></h2>
        </div>
        <div class="backupsheep-card-body">
            <?php if (empty($recent_backups)): ?>
            <p><?php _e('No backups found. Start your first backup using the quick actions above.', 'backupsheep'); ?></p>
            <?php else: ?>
            <table class="wp-list-table widefat fixed striped backupsheep-backup-table">
                <thead>
                    <tr>
                        <th><?php _e('Backup ID', 'backupsheep'); ?></th>
                        <th><?php _e('Type', 'backupsheep'); ?></th>
                        <th><?php _e('Status', 'backupsheep'); ?></th>
                        <th><?php _e('Started', 'backupsheep'); ?></th>
                        <th><?php _e('Completed', 'backupsheep'); ?></th>
                        <th><?php _e('Size', 'backupsheep'); ?></th>
                        <th><?php _e('Files', 'backupsheep'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($recent_backups as $backup): ?>
                    <tr>
                        <td><?php echo esc_html($backup->backup_id); ?></td>
                        <td>
                            <?php 
                            $type_labels = [
                                'full' => __('Full', 'backupsheep'),
                                'database' => __('Database', 'backupsheep'),
                                'files' => __('Files', 'backupsheep'),
                            ];
                            echo esc_html($type_labels[$backup->type] ?? $backup->type); 
                            ?>
                        </td>
                        <td>
                            <span class="backupsheep-status backupsheep-status-<?php echo esc_attr($backup->status); ?>">
                                <?php 
                                $status_labels = [
                                    'started' => __('In Progress', 'backupsheep'),
                                    'completed' => __('Completed', 'backupsheep'),
                                    'error' => __('Failed', 'backupsheep'),
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
            
            <p class="backupsheep-view-all">
                <a href="<?php echo admin_url('admin.php?page=backupsheep-history'); ?>" class="button">
                    <?php _e('View All Backups', 'backupsheep'); ?>
                </a>
                <a href="<?php echo esc_url(backupsheep_get_dashboard_url()); ?>" class="button" target="_blank">
                    <?php _e('Open BackupSheep Dashboard', 'backupsheep'); ?>
                </a>
            </p>
        </div>
    </div>
</div>