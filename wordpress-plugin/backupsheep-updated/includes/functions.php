<?php
/**
 * BackupSheep Helper Functions
 *
 * @package BackupSheep
 */

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

/**
 * Check if string starts with a specific substring
 *
 * @param string $haystack
 * @param string $needle
 * @return bool
 */
function backupsheep_starts_with($haystack, $needle) {
    $length = strlen($needle);
    return substr($haystack, 0, $length) === $needle;
}

/**
 * Check if string ends with a specific substring
 *
 * @param string $haystack
 * @param string $needle
 * @return bool
 */
function backupsheep_ends_with($haystack, $needle) {
    $length = strlen($needle);
    if (!$length) {
        return true;
    }
    return substr($haystack, -$length) === $needle;
}

/**
 * Get human-readable file size
 *
 * @param int $bytes
 * @param int $precision
 * @return string
 */
function backupsheep_format_size($bytes, $precision = 2) {
    if ($bytes > 0) {
        $units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
        $base = log($bytes) / log(1024);
        $power = min(floor($base), count($units) - 1);
        return round(pow(1024, $base - $power), $precision) . ' ' . $units[$power];
    }
    
    return '0 B';
}

/**
 * Generate a unique backup ID
 *
 * @return string
 */
function backupsheep_generate_backup_id() {
    return substr(md5(time() . wp_rand()), 0, 16);
}

/**
 * Check if UpdraftPlus plugin is active
 *
 * @return bool
 */
function backupsheep_is_updraftplus_active() {
    return in_array('updraftplus/updraftplus.php', apply_filters('active_plugins', get_option('active_plugins')));
}

/**
 * Get WordPress plugins list
 *
 * @return array
 */
function backupsheep_get_plugins_list() {
    if (!function_exists('get_plugins')) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
    }
    
    $plugins = [];
    foreach (get_plugins() as $path => $plugin) {
        $is_active = is_plugin_active($path);
        $plugins[] = [
            'name' => $plugin['Name'],
            'version' => $plugin['Version'],
            'active' => $is_active,
        ];
    }
    
    return $plugins;
}

/**
 * Get WordPress themes list
 *
 * @return array
 */
function backupsheep_get_themes_list() {
    $themes = [];
    foreach (wp_get_themes() as $slug => $theme) {
        $themes[] = [
            'name' => $theme->get('Name'),
            'version' => $theme->get('Version'),
            'active' => $slug === wp_get_theme()->get_stylesheet(),
        ];
    }
    
    return $themes;
}

/**
 * Get server information
 *
 * @return array
 */
function backupsheep_get_server_info() {
    global $wpdb;
    
    return [
        'php_version' => phpversion(),
        'mysql_version' => $wpdb->db_version(),
        'web_server' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
        'wordpress_version' => get_bloginfo('version'),
        'wordpress_memory_limit' => WP_MEMORY_LIMIT,
        'wordpress_debug_mode' => defined('WP_DEBUG') && WP_DEBUG,
        'wordpress_multisite' => is_multisite(),
        'max_upload_size' => size_format(wp_max_upload_size()),
    ];
}

/**
 * Check if current user can manage backups
 *
 * @return bool
 */
function backupsheep_current_user_can_manage() {
    return current_user_can('manage_options');
}

/**
 * Get URL to BackupSheep dashboard
 *
 * @return string
 */
function backupsheep_get_dashboard_url() {
    $options = get_option('backupsheep_options', []);
    $site_id = $options['site_id'] ?? '';
    
    if (empty($site_id)) {
        return 'https://app.backupsheep.com/dashboard';
    }
    
    return 'https://app.backupsheep.com/sites/' . $site_id;
}

/**
 * Create no-cache response for REST API
 *
 * @param mixed $data
 * @return WP_REST_Response
 */
function backupsheep_nocache_response($data) {
    $response = new WP_REST_Response($data, 200);
    $response->set_headers(['Cache-Control' => 'no-cache, no-store, must-revalidate']);
    return $response;
}

/**
 * Log message to BackupSheep log file
 *
 * @param string $message
 * @param string $level
 * @return void
 */
function backupsheep_log($message, $level = 'info') {
    // Get upload directory
    $upload_dir = wp_upload_dir();
    $log_dir = $upload_dir['basedir'] . '/backupsheep/logs';
    
    // Create log directory if it doesn't exist
    if (!file_exists($log_dir)) {
        wp_mkdir_p($log_dir);
    }
    
    // Create log file path
    $log_file = $log_dir . '/backupsheep-' . date('Y-m-d') . '.log';
    
    // Format log message
    $timestamp = date('Y-m-d H:i:s');
    $log_message = "[{$timestamp}] [{$level}] {$message}\n";
    
    // Append to log file
    file_put_contents($log_file, $log_message, FILE_APPEND);
}