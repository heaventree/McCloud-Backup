<?php
/**
 * BackupSheep Installer
 *
 * This file handles the installation and table creation for BackupSheep.
 *
 * @package BackupSheep
 */

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

/**
 * Run the installer
 */
function backupsheep_run_installer() {
    // Create required tables
    backupsheep_create_tables();
    
    // Create uploads directory
    backupsheep_create_uploads_directory();
    
    // Set default options
    backupsheep_set_default_options();
    
    // Store version number
    update_option('backupsheep_version', BACKUPSHEEP_VERSION);
}

/**
 * Create the required database tables
 */
function backupsheep_create_tables() {
    global $wpdb;
    
    $charset_collate = $wpdb->get_charset_collate();
    
    // Create logs table
    $table_name = $wpdb->prefix . 'backupsheep_logs';
    
    $sql = "CREATE TABLE $table_name (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        backup_id varchar(36) NOT NULL,
        type varchar(20) NOT NULL,
        status varchar(20) NOT NULL,
        storage_id varchar(255) DEFAULT NULL,
        parent_backup_id varchar(36) DEFAULT NULL,
        start_time datetime NOT NULL,
        end_time datetime DEFAULT NULL,
        size bigint(20) unsigned DEFAULT NULL,
        file_count int(11) DEFAULT NULL,
        changed_files int(11) DEFAULT NULL,
        error_message text DEFAULT NULL,
        PRIMARY KEY  (id),
        KEY backup_id (backup_id),
        KEY status (status),
        KEY type (type),
        KEY start_time (start_time)
    ) $charset_collate;";
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
}

/**
 * Create the uploads directory for BackupSheep
 */
function backupsheep_create_uploads_directory() {
    $upload_dir = wp_upload_dir();
    $backupsheep_dir = trailingslashit($upload_dir['basedir']) . 'backupsheep';
    
    // Create directory if it doesn't exist
    if (!file_exists($backupsheep_dir)) {
        wp_mkdir_p($backupsheep_dir);
    }
    
    // Create .htaccess file to prevent direct access
    $htaccess_file = trailingslashit($backupsheep_dir) . '.htaccess';
    if (!file_exists($htaccess_file)) {
        $htaccess_content = "# Prevent directory listing\nOptions -Indexes\n\n# Prevent direct access to files\n<FilesMatch \"\.(zip|sql|txt|log)$\">\nOrder allow,deny\nDeny from all\n</FilesMatch>";
        file_put_contents($htaccess_file, $htaccess_content);
    }
    
    // Create index.php file to prevent directory listing
    $index_file = trailingslashit($backupsheep_dir) . 'index.php';
    if (!file_exists($index_file)) {
        $index_content = "<?php\n// Silence is golden.";
        file_put_contents($index_file, $index_content);
    }
    
    // Create temp directory for temporary files
    $temp_dir = trailingslashit($backupsheep_dir) . 'temp';
    if (!file_exists($temp_dir)) {
        wp_mkdir_p($temp_dir);
    }
}

/**
 * Set default options
 */
function backupsheep_set_default_options() {
    $options = get_option('backupsheep_options', []);
    
    // Default options
    $defaults = [
        'api_key' => '',
        'site_id' => '',
        'auto_backup' => 0,
        'backup_schedule' => 'daily',
        'backup_type' => 'full',
        'exclusions' => "cache\ntmp\nwp-content/updraft\nwp-content/backups\nwp-content/cache",
        'retention' => 5,
        'remove_all_data' => 0,
    ];
    
    // Merge defaults with existing options
    $options = wp_parse_args($options, $defaults);
    
    // Save options
    update_option('backupsheep_options', $options);
}