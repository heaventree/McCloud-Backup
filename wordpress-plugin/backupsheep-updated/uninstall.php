<?php
/**
 * Uninstall BackupSheep
 *
 * @package BackupSheep
 */

// If uninstall not called from WordPress, exit
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// Get the options
$options = get_option('backupsheep_options', []);

// Check if we should remove all data
$remove_all_data = isset($options['remove_all_data']) ? (bool) $options['remove_all_data'] : false;

if ($remove_all_data) {
    // Delete options
    delete_option('backupsheep_options');
    
    // Delete scheduled events
    wp_clear_scheduled_hook('backupsheep_scheduled_backup');
    
    // Drop custom tables
    global $wpdb;
    $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}backupsheep_logs");
    
    // Clean up uploads directory
    $upload_dir = wp_upload_dir();
    $backupsheep_dir = trailingslashit($upload_dir['basedir']) . 'backupsheep';
    
    if (file_exists($backupsheep_dir) && is_dir($backupsheep_dir)) {
        backupsheep_recursive_rmdir($backupsheep_dir);
    }
}

/**
 * Recursively remove a directory
 *
 * @param string $dir Directory path
 * @return bool
 */
function backupsheep_recursive_rmdir($dir) {
    if (!is_dir($dir)) {
        return false;
    }
    
    $files = array_diff(scandir($dir), ['.', '..']);
    
    foreach ($files as $file) {
        $path = trailingslashit($dir) . $file;
        
        if (is_dir($path)) {
            backupsheep_recursive_rmdir($path);
        } else {
            unlink($path);
        }
    }
    
    return rmdir($dir);
}