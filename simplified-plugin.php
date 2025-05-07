<?php
/**
 * Plugin Name: McCloud Backup Connector
 * Description: Simple connector to enable backups with McCloud Backup system
 * Version: 1.0.0
 * Author: McCloud Backup
 */

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

// Add admin menu
add_action('admin_menu', 'mccloud_backup_menu');

function mccloud_backup_menu() {
    add_menu_page(
        'McCloud Backup', 
        'McCloud Backup', 
        'manage_options', 
        'mccloud-backup', 
        'mccloud_backup_page', 
        'dashicons-backup'
    );
}

// Admin page content
function mccloud_backup_page() {
    // Save settings
    if (isset($_POST['mccloud_backup_save_settings'])) {
        check_admin_referer('mccloud_backup_save_settings');
        
        // Save API key if provided
        if (isset($_POST['mccloud_backup_api_key'])) {
            update_option('mccloud_backup_api_key', sanitize_text_field($_POST['mccloud_backup_api_key']));
        }
        
        echo '<div class="notice notice-success"><p>Settings saved successfully!</p></div>';
    }
    
    // Generate API key if requested
    if (isset($_POST['mccloud_backup_generate_key'])) {
        check_admin_referer('mccloud_backup_generate_key');
        
        // Generate random API key
        $api_key = 'mccloud_' . bin2hex(random_bytes(16));
        update_option('mccloud_backup_api_key', $api_key);
        
        echo '<div class="notice notice-success"><p>New API key generated!</p></div>';
    }
    
    // Get current API key
    $api_key = get_option('mccloud_backup_api_key', '');
    
    // Admin page HTML
    ?>
    <div class="wrap">
        <h1>McCloud Backup Connector</h1>
        
        <div class="card">
            <h2>API Settings</h2>
            <p>This API key connects your WordPress site to the McCloud Backup system.</p>
            
            <form method="post" action="">
                <?php wp_nonce_field('mccloud_backup_save_settings'); ?>
                <table class="form-table">
                    <tr>
                        <th><label for="mccloud_backup_api_key">API Key</label></th>
                        <td>
                            <input type="text" id="mccloud_backup_api_key" name="mccloud_backup_api_key" 
                                   value="<?php echo esc_attr($api_key); ?>" class="regular-text" />
                            <p class="description">Use this API key when adding this site to your McCloud Backup system.</p>
                        </td>
                    </tr>
                </table>
                
                <p class="submit">
                    <input type="submit" name="mccloud_backup_save_settings" class="button-primary" 
                           value="Save Settings" />
                </p>
            </form>
            
            <form method="post" action="">
                <?php wp_nonce_field('mccloud_backup_generate_key'); ?>
                <p>
                    <input type="submit" name="mccloud_backup_generate_key" class="button-secondary" 
                           value="Generate New API Key" />
                </p>
            </form>
        </div>
        
        <div class="card" style="margin-top: 20px;">
            <h2>API Endpoints</h2>
            <p>The following endpoints are available for the McCloud Backup system:</p>
            
            <table class="widefat" style="margin-top: 10px;">
                <thead>
                    <tr>
                        <th>Endpoint</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><code><?php echo esc_url(rest_url('mccloud-backup/v1/info')); ?></code></td>
                        <td>Get site information</td>
                    </tr>
                    <tr>
                        <td><code><?php echo esc_url(rest_url('mccloud-backup/v1/files')); ?></code></td>
                        <td>List files for backup</td>
                    </tr>
                    <tr>
                        <td><code><?php echo esc_url(rest_url('mccloud-backup/v1/db')); ?></code></td>
                        <td>Database backup endpoint</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    <?php
}

// Register REST API endpoints
add_action('rest_api_init', 'mccloud_backup_register_endpoints');

function mccloud_backup_register_endpoints() {
    // Info endpoint - Returns basic site information
    register_rest_route('mccloud-backup/v1', '/info', array(
        'methods' => 'GET',
        'callback' => 'mccloud_backup_info_endpoint',
        'permission_callback' => 'mccloud_backup_api_permission'
    ));
    
    // Files endpoint - Lists all files
    register_rest_route('mccloud-backup/v1', '/files', array(
        'methods' => 'GET',
        'callback' => 'mccloud_backup_files_endpoint',
        'permission_callback' => 'mccloud_backup_api_permission'
    ));
    
    // Database endpoint - Database backup
    register_rest_route('mccloud-backup/v1', '/db', array(
        'methods' => 'GET',
        'callback' => 'mccloud_backup_db_endpoint',
        'permission_callback' => 'mccloud_backup_api_permission'
    ));
}

// API permission callback
function mccloud_backup_api_permission(WP_REST_Request $request) {
    $stored_api_key = get_option('mccloud_backup_api_key', '');
    
    // If no API key is set, deny access
    if (empty($stored_api_key)) {
        return false;
    }
    
    // Get API key from request header
    $api_key = $request->get_header('X-McCloud-API-Key');
    
    // Check if API key matches
    return $api_key === $stored_api_key;
}

// Info endpoint callback
function mccloud_backup_info_endpoint() {
    global $wpdb;
    
    return array(
        'name' => get_bloginfo('name'),
        'url' => get_home_url(),
        'version' => get_bloginfo('version'),
        'php_version' => phpversion(),
        'db_version' => $wpdb->db_version(),
        'plugin_version' => '1.0.0',
        'timezone' => wp_timezone_string(),
        'timestamp' => current_time('timestamp'),
    );
}

// Files endpoint callback
function mccloud_backup_files_endpoint() {
    $wp_root = ABSPATH;
    $wp_content = WP_CONTENT_DIR;
    
    // Just return directory structure for now
    return array(
        'wp_root' => $wp_root,
        'wp_content' => $wp_content,
        'uploads' => wp_upload_dir()['basedir'],
        'plugins' => WP_PLUGIN_DIR,
        'themes' => get_theme_root(),
    );
}

// Database endpoint callback
function mccloud_backup_db_endpoint() {
    global $wpdb;
    
    // Get list of tables
    $tables = $wpdb->get_results('SHOW TABLES', ARRAY_N);
    $table_list = array();
    
    foreach ($tables as $table) {
        $table_list[] = $table[0];
    }
    
    return array(
        'db_name' => DB_NAME,
        'db_prefix' => $wpdb->prefix,
        'tables' => $table_list,
        'table_count' => count($table_list),
    );
}

// Add basic authentication
add_filter('determine_current_user', 'mccloud_basic_auth', 20);
function mccloud_basic_auth($user) {
    if (!empty($user)) {
        return $user;
    }
    
    // Only for REST API requests
    if (!defined('REST_REQUEST') || !REST_REQUEST) {
        return $user;
    }
    
    // Check if authorization header exists
    if (!isset($_SERVER['HTTP_AUTHORIZATION']) && !isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        return $user;
    }
    
    $authorization = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    
    // Check if Basic auth header
    if (strpos($authorization, 'Basic ') !== 0) {
        return $user;
    }
    
    // Get credentials
    $auth_string = base64_decode(substr($authorization, 6));
    list($username, $password) = explode(':', $auth_string, 2);
    
    // Check credentials against API key
    $api_key = get_option('mccloud_backup_api_key', '');
    if ($username === 'mccloud' && $password === $api_key) {
        return 1; // Return user ID 1 (admin)
    }
    
    return $user;
}