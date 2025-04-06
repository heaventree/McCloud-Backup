<?php
/**
 * Backup History view
 *
 * @package BackupSheep
 */

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

// Get options
$options = get_option('backupsheep_options', []);

// Get backups with pagination
global $wpdb;
$table_name = $wpdb->prefix . 'backupsheep_logs';

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

<div class="wrap backupsheep-history">
    <h1><?php _e('Backup History', 'backupsheep'); ?></h1>
    
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
    
    <div class="backupsheep-card">
        <div class="backupsheep-card-header">
            <h2><?php _e('Backup History', 'backupsheep'); ?></h2>
        </div>
        <div class="backupsheep-card-body">
            <?php if (empty($backups)): ?>
            <p><?php _e('No backups found. Start your first backup from the dashboard.', 'backupsheep'); ?></p>
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
                        <th><?php _e('Actions', 'backupsheep'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($backups as $backup): ?>
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
                        <td>
                            <?php if ($backup->status === 'completed'): ?>
                            <a href="<?php echo esc_url(backupsheep_get_backup_download_url($backup->backup_id)); ?>" 
                               class="button button-small" 
                               title="<?php _e('Download Backup', 'backupsheep'); ?>">
                                <span class="dashicons dashicons-download"></span>
                            </a>
                            <a href="<?php echo esc_url(backupsheep_get_backup_restore_url($backup->backup_id)); ?>" 
                               class="button button-small backupsheep-restore-btn" 
                               data-backup-id="<?php echo esc_attr($backup->backup_id); ?>"
                               title="<?php _e('Restore Backup', 'backupsheep'); ?>">
                                <span class="dashicons dashicons-backup"></span>
                            </a>
                            <?php elseif ($backup->status === 'error'): ?>
                            <button type="button" 
                                    class="button button-small backupsheep-error-details-btn" 
                                    data-backup-id="<?php echo esc_attr($backup->backup_id); ?>"
                                    title="<?php _e('View Error Details', 'backupsheep'); ?>">
                                <span class="dashicons dashicons-info"></span>
                            </button>
                            <?php endif; ?>
                            
                            <button type="button" 
                                    class="button button-small backupsheep-delete-backup-btn" 
                                    data-backup-id="<?php echo esc_attr($backup->backup_id); ?>"
                                    title="<?php _e('Delete Backup', 'backupsheep'); ?>">
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
                        <?php printf(_n('%s backup', '%s backups', $total_backups, 'backupsheep'), number_format_i18n($total_backups)); ?>
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
<div id="backupsheep-restore-modal" class="backupsheep-modal" style="display: none;">
    <div class="backupsheep-modal-content">
        <span class="backupsheep-modal-close">&times;</span>
        <h3><?php _e('Restore Backup', 'backupsheep'); ?></h3>
        <p><?php _e('Are you sure you want to restore this backup? This will overwrite your current site data.', 'backupsheep'); ?></p>
        <p><strong><?php _e('Warning:', 'backupsheep'); ?></strong> <?php _e('This action cannot be undone.', 'backupsheep'); ?></p>
        <div class="backupsheep-modal-actions">
            <button id="backupsheep-restore-confirm" class="button button-primary"><?php _e('Yes, Restore Backup', 'backupsheep'); ?></button>
            <button id="backupsheep-restore-cancel" class="button button-secondary"><?php _e('Cancel', 'backupsheep'); ?></button>
        </div>
    </div>
</div>

<!-- Delete Confirmation Modal -->
<div id="backupsheep-delete-modal" class="backupsheep-modal" style="display: none;">
    <div class="backupsheep-modal-content">
        <span class="backupsheep-modal-close">&times;</span>
        <h3><?php _e('Delete Backup', 'backupsheep'); ?></h3>
        <p><?php _e('Are you sure you want to delete this backup? This action cannot be undone.', 'backupsheep'); ?></p>
        <div class="backupsheep-modal-actions">
            <button id="backupsheep-delete-confirm" class="button button-primary"><?php _e('Yes, Delete Backup', 'backupsheep'); ?></button>
            <button id="backupsheep-delete-cancel" class="button button-secondary"><?php _e('Cancel', 'backupsheep'); ?></button>
        </div>
    </div>
</div>

<!-- Error Details Modal -->
<div id="backupsheep-error-modal" class="backupsheep-modal" style="display: none;">
    <div class="backupsheep-modal-content">
        <span class="backupsheep-modal-close">&times;</span>
        <h3><?php _e('Error Details', 'backupsheep'); ?></h3>
        <div id="backupsheep-error-content"></div>
        <div class="backupsheep-modal-actions">
            <button id="backupsheep-error-close" class="button button-secondary"><?php _e('Close', 'backupsheep'); ?></button>
        </div>
    </div>
</div>