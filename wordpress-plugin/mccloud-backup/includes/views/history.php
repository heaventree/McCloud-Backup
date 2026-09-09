<?php
/**
 * Backup History view
 *
 * @package McCloud Backup
 */

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

// Get options
$options = get_option('mccloud_backup_options', []);

// Get backups with pagination
global $wpdb;
$table_name = $wpdb->prefix . 'mccloud_backup_logs';

// Pagination
$per_page = 20;
$current_page = isset($_GET['paged']) ? max(1, intval($_GET['paged'])) : 1;
$offset = ($current_page - 1) * $per_page;

// Get total count
$total_backups = $wpdb->get_var("SELECT COUNT(*) FROM {$table_name}");
$total_pages = ceil($total_backups / $per_page);

// Get backups
$backups = $wpdb->get_results(
    $wpdb->prepare(
        "SELECT * FROM {$table_name} ORDER BY start_time DESC LIMIT %d OFFSET %d",
        $per_page,
        $offset
    )
);

?>

<div class="wrap mccloud-backup-history">
    <h1><?php _e('Backup History', 'mccloud-backup'); ?></h1>
    
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
    
    <div class="mccloud-backup-card">
        <div class="mccloud-backup-card-header">
            <h2><?php _e('Backup History', 'mccloud-backup'); ?></h2>
        </div>
        <div class="mccloud-backup-card-body">
            <?php if (empty($backups)): ?>
            <p><?php _e('No backups found. Start your first backup from the dashboard.', 'mccloud-backup'); ?></p>
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
                        <th><?php _e('Actions', 'mccloud-backup'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($backups as $backup): ?>
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
                        <td>
                            <?php if ($backup->status === 'completed'): ?>
                            <a href="<?php echo esc_url(mccloud_backup_get_backup_download_url($backup->backup_id)); ?>" 
                               class="button button-small" 
                               title="<?php _e('Download Backup', 'mccloud-backup'); ?>">
                                <span class="dashicons dashicons-download"></span>
                            </a>
                            <a href="<?php echo esc_url(mccloud_backup_get_backup_restore_url($backup->backup_id)); ?>" 
                               class="button button-small mccloud-backup-restore-btn" 
                               data-backup-id="<?php echo esc_attr($backup->backup_id); ?>"
                               title="<?php _e('Restore Backup', 'mccloud-backup'); ?>">
                                <span class="dashicons dashicons-backup"></span>
                            </a>
                            <?php elseif ($backup->status === 'error'): ?>
                            <button type="button" 
                                    class="button button-small mccloud-backup-error-details-btn" 
                                    data-backup-id="<?php echo esc_attr($backup->backup_id); ?>"
                                    title="<?php _e('View Error Details', 'mccloud-backup'); ?>">
                                <span class="dashicons dashicons-info"></span>
                            </button>
                            <?php endif; ?>
                            
                            <button type="button" 
                                    class="button button-small mccloud-backup-delete-backup-btn" 
                                    data-backup-id="<?php echo esc_attr($backup->backup_id); ?>"
                                    title="<?php _e('Delete Backup', 'mccloud-backup'); ?>">
                                <span class="dashicons dashicons-trash"></span>
                            </button>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            
            <?php if ($total_pages > 1): ?>
            <div class="tablenav bottom">
                <div class="tablenav-pages">
                    <span class="displaying-num">
                        <?php printf(_n('%s backup', '%s backups', $total_backups, 'mccloud-backup'), number_format_i18n($total_backups)); ?>
                    </span>
                    <span class="pagination-links">
                        <?php
                        echo paginate_links(array(
                            'base' => add_query_arg('paged', '%#%'),
                            'format' => '',
                            'prev_text' => '&laquo;',
                            'next_text' => '&raquo;',
                            'total' => $total_pages,
                            'current' => $current_page,
                        ));
                        ?>
                    </span>
                </div>
            </div>
            <?php endif; ?>
            
            <?php endif; ?>
        </div>
    </div>
</div>

<!-- Restore Confirmation Modal -->
<div id="mccloud-backup-restore-modal" class="mccloud-backup-modal" style="display: none;">
    <div class="mccloud-backup-modal-content">
        <span class="mccloud-backup-modal-close">&times;</span>
        <h3><?php _e('Restore Backup', 'mccloud-backup'); ?></h3>
        <p><?php _e('Are you sure you want to restore this backup? This will overwrite your current site data.', 'mccloud-backup'); ?></p>
        <p><strong><?php _e('Warning:', 'mccloud-backup'); ?></strong> <?php _e('This action cannot be undone.', 'mccloud-backup'); ?></p>
        <div class="mccloud-backup-modal-actions">
            <button id="mccloud-backup-restore-confirm" class="button button-primary"><?php _e('Yes, Restore Backup', 'mccloud-backup'); ?></button>
            <button id="mccloud-backup-restore-cancel" class="button button-secondary"><?php _e('Cancel', 'mccloud-backup'); ?></button>
        </div>
    </div>
</div>

<!-- Delete Confirmation Modal -->
<div id="mccloud-backup-delete-modal" class="mccloud-backup-modal" style="display: none;">
    <div class="mccloud-backup-modal-content">
        <span class="mccloud-backup-modal-close">&times;</span>
        <h3><?php _e('Delete Backup', 'mccloud-backup'); ?></h3>
        <p><?php _e('Are you sure you want to delete this backup? This action cannot be undone.', 'mccloud-backup'); ?></p>
        <div class="mccloud-backup-modal-actions">
            <button id="mccloud-backup-delete-confirm" class="button button-primary"><?php _e('Yes, Delete Backup', 'mccloud-backup'); ?></button>
            <button id="mccloud-backup-delete-cancel" class="button button-secondary"><?php _e('Cancel', 'mccloud-backup'); ?></button>
        </div>
    </div>
</div>

<!-- Error Details Modal -->
<div id="mccloud-backup-error-modal" class="mccloud-backup-modal" style="display: none;">
    <div class="mccloud-backup-modal-content">
        <span class="mccloud-backup-modal-close">&times;</span>
        <h3><?php _e('Error Details', 'mccloud-backup'); ?></h3>
        <div id="mccloud-backup-error-content"></div>
        <div class="mccloud-backup-modal-actions">
            <button id="mccloud-backup-error-close" class="button button-secondary"><?php _e('Close', 'mccloud-backup'); ?></button>
        </div>
    </div>
</div>