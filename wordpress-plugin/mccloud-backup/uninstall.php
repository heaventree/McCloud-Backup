<?php
/**
 * Uninstall McCloud Backup
 *
 * @package McCloud Backup
 */

// If uninstall not called from WordPress, exit
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// Get the options
$options = get_option('mccloud_backup_options', []);

// Check if we should remove all data
$remove_all_data = isset($options['remove_all_data']) ? (bool) $options['remove_all_data'] : false;

if ($remove_all_data) {
    // Delete options
    delete_option('mccloud_backup_options');
    
    // Delete scheduled events
    wp_clear_scheduled_hook('mccloud_backup_scheduled_backup');
    
    // Drop custom tables
    global $wpdb;
    $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}mccloud_backup_logs");
    
    // Clean up uploads directory
    $upload_dir = wp_upload_dir();
    $mccloud_backup_dir = trailingslashit($upload_dir['basedir']) . 'mccloud-backup';
    
    if (file_exists($mccloud_backup_dir) && is_dir($mccloud_backup_dir)) {
        mccloud_backup_recursive_rmdir($mccloud_backup_dir);
    }
}

/**
 * Recursively remove a directory
 *
 * @param string $dir Directory path
 * @return bool
 */
function mccloud_backup_recursive_rmdir($dir) {
    if (!is_dir($dir)) {
        return false;
    }
    
    $files = array_diff(scandir($dir), ['.', '..']);
    
    foreach ($files as $file) {
        $path = trailingslashit($dir) . $file;
        
        if (is_dir($path)) {
            mccloud_backup_recursive_rmdir($path);
        } else {
            unlink($path);
        }
    }
    
    return rmdir($dir);
}