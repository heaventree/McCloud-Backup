<?php

/**
 * @package             McCloud Backup
 * @author              McCloud Backup Team
 * @copyright           2024 McCloud Backup Inc.
 * @license             GPLv3 or later
 *
 * Plugin Name:         McCloud Backup - Advanced Backup Solution
 * Plugin URI:          https://mccloudbackup.com/wordpress-backup/
 * Description:         Comprehensive WordPress backup solution that automates files and database backups with smart scheduling and secure cloud storage integration. Supports multiple storage providers including Google Drive, Dropbox, OneDrive, Amazon S3, FTP, and local storage.
 * Version:             2.0.0
 * Requires at least:   5.6
 * Requires PHP:        7.4
 * Author:              McCloud Backup
 * Author URI:          https://mccloudbackup.com/
 * Text Domain:         mccloud-backup
 * Domain Path:         /languages
 * License:             GPLv3 or later
 * License URI:         https://www.gnu.org/licenses/gpl-3.0.html
 */

// Exit if accessed directly.
if (!defined('ABSPATH')) exit;

// Define plugin constants
define('MCCLOUD_BACKUP_VERSION', '2.0.0');
define('MCCLOUD_BACKUP_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('MCCLOUD_BACKUP_PLUGIN_URL', plugin_dir_url(__FILE__));
define('MCCLOUD_BACKUP_PLUGIN_FILE', __FILE__);
define('MCCLOUD_BACKUP_API_URL', 'https://api.mccloudbackup.com/v2');

/**
 * Main McCloud Backup class
 */
class McCloudBackup {
    /**
     * Plugin instance
     *
     * @var McCloudBackup
     */
    private static $instance = null;

    /**
     * Plugin options
     *
     * @var array
     */
    private $options = [];

    /**
     * Get plugin instance
     *
     * @return McCloudBackup
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructor
     */
    private function __construct() {
        // Load plugin options
        $this->options = get_option('mccloud_backup_options', []);

        // Register activation and deactivation hooks
        register_activation_hook(MCCLOUD_BACKUP_PLUGIN_FILE, [$this, 'activate']);
        register_deactivation_hook(MCCLOUD_BACKUP_PLUGIN_FILE, [$this, 'deactivate']);

        // Load required files
        $this->load_dependencies();

        // Register REST API routes
        add_action('rest_api_init', [$this, 'register_routes']);

        // Register admin menu
        add_action('admin_menu', [$this, 'register_admin_menu']);

        // Register admin assets
        add_action('admin_enqueue_scripts', [$this, 'register_admin_assets']);

        // Set up the cron job for scheduled backups
        add_action('mccloud_backup_scheduled_backup', [$this, 'run_scheduled_backup']);
    }

    /**
     * Load required dependencies
     */
    private function load_dependencies() {
        // Include helper functions
        require_once MCCLOUD_BACKUP_PLUGIN_DIR . 'includes/functions.php';

        // Include API class
        require_once MCCLOUD_BACKUP_PLUGIN_DIR . 'includes/api.php';

        // Include backup class
        require_once MCCLOUD_BACKUP_PLUGIN_DIR . 'includes/backup.php';

        // Include admin class
        require_once MCCLOUD_BACKUP_PLUGIN_DIR . 'includes/admin.php';
        
        // Include encryption utilities
        require_once MCCLOUD_BACKUP_PLUGIN_DIR . 'includes/encryption.php';
        
        // Include health check class
        require_once MCCLOUD_BACKUP_PLUGIN_DIR . 'includes/health-check.php';
    }

    /**
     * Plugin activation
     */
    public function activate() {
        // Check if UpdraftPlus plugin is active
        if (!in_array('updraftplus/updraftplus.php', apply_filters('active_plugins', get_option('active_plugins')))) {
            // Stop activation and show error
            wp_die('McCloud Backup requires the UpdraftPlus plugin (free or paid) to be installed and active. <a href="https://wordpress.org/plugins/updraftplus/" target="_blank">Get it here</a>. <br><a href="' . admin_url('plugins.php') . '">&laquo; Return to Plugins</a>');
        }

        // Create backup directory
        $upload_dir = wp_upload_dir();
        $backup_dir = $upload_dir['basedir'] . '/mccloud-backup';
        wp_mkdir_p($backup_dir);

        // Create .htaccess file to protect backups
        $htaccess_file = $backup_dir . '/.htaccess';
        if (!file_exists($htaccess_file)) {
            $htaccess_content = "# McCloud Backup protection\nDeny from all";
            file_put_contents($htaccess_file, $htaccess_content);
        }

        // Generate unique site ID if it doesn't exist
        if (!isset($this->options['site_id'])) {
            $this->options['site_id'] = $this->generate_site_id();
            update_option('mccloud_backup_options', $this->options);
        }

        // Schedule default backup if not already scheduled
        if (!wp_next_scheduled('mccloud_backup_scheduled_backup')) {
            wp_schedule_event(time(), 'daily', 'mccloud_backup_scheduled_backup');
        }

        // Create necessary database tables
        $this->create_db_tables();
    }

    /**
     * Plugin deactivation
     */
    public function deactivate() {
        // Clear scheduled backup
        wp_clear_scheduled_hook('mccloud_backup_scheduled_backup');
    }

    /**
     * Generate a unique site ID
     *
     * @return string
     */
    private function generate_site_id() {
        return md5(site_url() . time() . wp_rand());
    }

    /**
     * Create database tables
     */
    private function create_db_tables() {
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();
        
        // Table for backup logs
        $table_name = $wpdb->prefix . 'mccloud_backup_logs';
        
        $sql = "CREATE TABLE IF NOT EXISTS $table_name (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            backup_id varchar(36) NOT NULL,
            type varchar(50) NOT NULL,
            status varchar(50) NOT NULL,
            start_time datetime NOT NULL,
            end_time datetime DEFAULT NULL,
            file_count int(11) DEFAULT 0,
            size bigint(20) DEFAULT 0,
            error_message text DEFAULT NULL,
            storage_providers longtext DEFAULT NULL,
            PRIMARY KEY  (id),
            KEY backup_id (backup_id),
            KEY status (status),
            KEY type (type)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }

    /**
     * Register REST API routes
     */
    public function register_routes() {
        // Core routes
        register_rest_route('mccloud-backup/v2', '/validate', [
            'methods' => 'GET',
            'callback' => [$this, 'validate_api'],
            'permission_callback' => [$this, 'check_api_permission'],
        ]);

        // Backup routes
        register_rest_route('mccloud-backup/v2', '/backup', [
            'methods' => 'GET',
            'callback' => [$this, 'start_backup'],
            'permission_callback' => [$this, 'check_api_permission'],
        ]);

        register_rest_route('mccloud-backup/v2', '/backup/status', [
            'methods' => 'GET',
            'callback' => [$this, 'backup_status'],
            'permission_callback' => [$this, 'check_api_permission'],
        ]);

        register_rest_route('mccloud-backup/v2', '/backup/files', [
            'methods' => 'GET',
            'callback' => [$this, 'backup_files'],
            'permission_callback' => [$this, 'check_api_permission'],
        ]);

        register_rest_route('mccloud-backup/v2', '/backup/download', [
            'methods' => 'GET',
            'callback' => [$this, 'download_backup'],
            'permission_callback' => [$this, 'check_api_permission'],
        ]);
        
        register_rest_route('mccloud-backup/v2', '/backup/delete', [
            'methods' => 'GET',
            'callback' => [$this, 'delete_backup'],
            'permission_callback' => [$this, 'check_api_permission'],
        ]);

        // Site information
        register_rest_route('mccloud-backup/v2', '/site/info', [
            'methods' => 'GET',
            'callback' => [$this, 'get_site_info'],
            'permission_callback' => [$this, 'check_api_permission'],
        ]);
        
        // Health check
        register_rest_route('mccloud-backup/v2', '/site/health-check', [
            'methods' => 'GET',
            'callback' => [$this, 'run_health_check'],
            'permission_callback' => [$this, 'check_api_permission'],
        ]);
    }

    /**
     * Check API permission
     *
     * @param WP_REST_Request $request
     * @return bool
     */
    public function check_api_permission($request) {
        // Check if API key is valid
        $api_key = $request->get_param('api_key');
        
        if (!$api_key) {
            return false;
        }
        
        // Verify API key from options
        return isset($this->options['api_key']) && $this->options['api_key'] === $api_key;
    }

    /**
     * Validate API endpoint
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function validate_api($request) {
        $data = [
            'status' => 'success',
            'version' => MCCLOUD_BACKUP_VERSION,
            'site_id' => $this->options['site_id'],
            'wordpress_version' => get_bloginfo('version'),
            'php_version' => phpversion(),
            'plugins' => [
                'mccloud-backup' => true,
                'updraftplus' => $this->is_updraftplus_active(),
            ],
        ];
        
        return new WP_REST_Response($data, 200);
    }

    /**
     * Start backup endpoint
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function start_backup($request) {
        $backup_id = $request->get_param('backup_id') ?: md5(time() . wp_rand());
        $type = $request->get_param('type') ?: 'full';
        
        // Instantiate backup class
        $backup = new McCloud_Backup_Backup();
        $result = $backup->start($backup_id, $type);
        
        if (is_wp_error($result)) {
            return new WP_REST_Response([
                'status' => 'error',
                'message' => $result->get_error_message(),
            ], 500);
        }
        
        return new WP_REST_Response([
            'status' => 'success',
            'backup_id' => $backup_id,
            'message' => 'Backup started successfully',
        ], 200);
    }

    /**
     * Get backup status endpoint
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function backup_status($request) {
        $backup_id = $request->get_param('backup_id');
        
        if (!$backup_id) {
            return new WP_REST_Response([
                'status' => 'error',
                'message' => 'Backup ID is required',
            ], 400);
        }
        
        // Get backup status
        $backup = new McCloud_Backup_Backup();
        $status = $backup->get_status($backup_id);
        
        return new WP_REST_Response([
            'status' => 'success',
            'backup_status' => $status,
        ], 200);
    }

    /**
     * Get backup files endpoint
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function backup_files($request) {
        $backup_id = $request->get_param('backup_id');
        
        if (!$backup_id) {
            return new WP_REST_Response([
                'status' => 'error',
                'message' => 'Backup ID is required',
            ], 400);
        }
        
        // Get backup files
        $backup = new McCloud_Backup_Backup();
        $files = $backup->get_files($backup_id);
        
        return new WP_REST_Response([
            'status' => 'success',
            'files' => $files,
        ], 200);
    }

    /**
     * Download backup file endpoint
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response|void
     */
    public function download_backup($request) {
        $file = $request->get_param('file');
        
        if (!$file) {
            return new WP_REST_Response([
                'status' => 'error',
                'message' => 'File parameter is required',
            ], 400);
        }
        
        // Download file
        $backup = new McCloud_Backup_Backup();
        $backup->download_file($file);
        
        // If we get here, download failed
        return new WP_REST_Response([
            'status' => 'error',
            'message' => 'File not found or could not be downloaded',
        ], 404);
    }

    /**
     * Delete backup file endpoint
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function delete_backup($request) {
        $file = $request->get_param('file');
        $backup_id = $request->get_param('backup_id');
        
        if (!$file || !$backup_id) {
            return new WP_REST_Response([
                'status' => 'error',
                'message' => 'File and backup_id parameters are required',
            ], 400);
        }
        
        // Delete file
        $backup = new McCloud_Backup_Backup();
        $result = $backup->delete_file($file, $backup_id);
        
        if (is_wp_error($result)) {
            return new WP_REST_Response([
                'status' => 'error',
                'message' => $result->get_error_message(),
            ], 500);
        }
        
        return new WP_REST_Response([
            'status' => 'success',
            'message' => 'File deleted successfully',
        ], 200);
    }

    /**
     * Get site information endpoint
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function get_site_info($request) {
        // Get site information
        $info = [
            'name' => get_bloginfo('name'),
            'url' => site_url(),
            'admin_url' => admin_url(),
            'admin_email' => get_option('admin_email'),
            'version' => get_bloginfo('version'),
            'timezone' => wp_timezone_string(),
            'language' => get_locale(),
            'site_id' => $this->options['site_id'],
            'plugin_version' => MCCLOUD_BACKUP_VERSION,
        ];
        
        return new WP_REST_Response([
            'status' => 'success',
            'site_info' => $info,
        ], 200);
    }

    /**
     * Register admin menu
     */
    public function register_admin_menu() {
        add_menu_page(
            __('McCloud Backup', 'mccloud-backup'),
            __('McCloud Backup', 'mccloud-backup'),
            'manage_options',
            'mccloud-backup',
            [$this, 'render_admin_page'],
            'dashicons-backup',
            100
        );
        
        add_submenu_page(
            'mccloud-backup',
            __('Dashboard', 'mccloud-backup'),
            __('Dashboard', 'mccloud-backup'),
            'manage_options',
            'mccloud-backup',
            [$this, 'render_admin_page']
        );
        
        add_submenu_page(
            'mccloud-backup',
            __('Settings', 'mccloud-backup'),
            __('Settings', 'mccloud-backup'),
            'manage_options',
            'mccloud-backup-settings',
            [$this, 'render_settings_page']
        );
        
        add_submenu_page(
            'mccloud-backup',
            __('Backup History', 'mccloud-backup'),
            __('Backup History', 'mccloud-backup'),
            'manage_options',
            'mccloud-backup-history',
            [$this, 'render_history_page']
        );
    }

    /**
     * Register admin assets
     */
    public function register_admin_assets($hook) {
        // Only load on plugin pages
        if (strpos($hook, 'mccloud-backup') === false) {
            return;
        }
        
        // CSS
        wp_enqueue_style(
            'mccloud-backup-admin',
            MCCLOUD_BACKUP_PLUGIN_URL . 'assets/css/admin.css',
            [],
            MCCLOUD_BACKUP_VERSION
        );
        
        // JS
        wp_enqueue_script(
            'mccloud-backup-admin',
            MCCLOUD_BACKUP_PLUGIN_URL . 'assets/js/admin.js',
            ['jquery'],
            MCCLOUD_BACKUP_VERSION,
            true
        );
        
        // Localize script with data
        wp_localize_script(
            'mccloud-backup-admin',
            'mccloudBackupData',
            [
                'ajax_url' => admin_url('admin-ajax.php'),
                'nonce' => wp_create_nonce('mccloud-backup-nonce'),
                'site_id' => $this->options['site_id'],
                'api_key' => $this->options['api_key'] ?? '',
                'i18n' => [
                    'backup_started' => __('Backup started successfully!', 'mccloud-backup'),
                    'backup_error' => __('Error starting backup', 'mccloud-backup'),
                    'confirm_delete' => __('Are you sure you want to delete this backup?', 'mccloud-backup'),
                ],
            ]
        );
    }

    /**
     * Render admin page
     */
    public function render_admin_page() {
        if (file_exists(MCCLOUD_BACKUP_PLUGIN_DIR . 'includes/views/dashboard.php')) {
            include MCCLOUD_BACKUP_PLUGIN_DIR . 'includes/views/dashboard.php';
        } else {
            echo '<div class="wrap"><h1>' . __('McCloud Backup Dashboard', 'mccloud-backup') . '</h1>';
            echo '<p>' . __('Welcome to McCloud Backup! Configure your settings to get started.', 'mccloud-backup') . '</p>';
            echo '</div>';
        }
    }

    /**
     * Render settings page
     */
    public function render_settings_page() {
        if (file_exists(MCCLOUD_BACKUP_PLUGIN_DIR . 'includes/views/settings.php')) {
            include MCCLOUD_BACKUP_PLUGIN_DIR . 'includes/views/settings.php';
        } else {
            echo '<div class="wrap"><h1>' . __('McCloud Backup Settings', 'mccloud-backup') . '</h1>';
            echo '<p>' . __('Configure your McCloud Backup settings here.', 'mccloud-backup') . '</p>';
            
            // Basic settings form
            echo '<form method="post" action="options.php">';
            settings_fields('mccloud_backup_options');
            
            echo '<table class="form-table" role="presentation">';
            echo '<tr>';
            echo '<th scope="row"><label for="mccloud_backup_api_key">' . __('API Key', 'mccloud-backup') . '</label></th>';
            echo '<td><input name="mccloud_backup_options[api_key]" type="text" id="mccloud_backup_api_key" value="' . esc_attr($this->options['api_key'] ?? '') . '" class="regular-text">';
            echo '<p class="description">' . __('Enter your McCloud Backup API key from your dashboard', 'mccloud-backup') . '</p></td>';
            echo '</tr>';
            
            echo '<tr>';
            echo '<th scope="row"><label for="mccloud_backup_site_id">' . __('Site ID', 'mccloud-backup') . '</label></th>';
            echo '<td><input name="mccloud_backup_options[site_id]" type="text" id="mccloud_backup_site_id" value="' . esc_attr($this->options['site_id'] ?? '') . '" class="regular-text" readonly>';
            echo '<p class="description">' . __('Your unique site identifier (used by McCloud Backup dashboard)', 'mccloud-backup') . '</p></td>';
            echo '</tr>';
            
            echo '</table>';
            
            submit_button();
            echo '</form>';
            
            echo '</div>';
        }
    }

    /**
     * Render history page
     */
    public function render_history_page() {
        if (file_exists(MCCLOUD_BACKUP_PLUGIN_DIR . 'includes/views/history.php')) {
            include MCCLOUD_BACKUP_PLUGIN_DIR . 'includes/views/history.php';
        } else {
            echo '<div class="wrap"><h1>' . __('Backup History', 'mccloud-backup') . '</h1>';
            echo '<p>' . __('View your backup history here.', 'mccloud-backup') . '</p>';
            
            // Get backup logs
            global $wpdb;
            $table_name = $wpdb->prefix . 'mccloud_backup_logs';
            $logs = $wpdb->get_results("SELECT * FROM $table_name ORDER BY start_time DESC LIMIT 20");
            
            if (empty($logs)) {
                echo '<p>' . __('No backup history found.', 'mccloud-backup') . '</p>';
            } else {
                echo '<table class="wp-list-table widefat fixed striped">';
                echo '<thead><tr>';
                echo '<th>' . __('Backup ID', 'mccloud-backup') . '</th>';
                echo '<th>' . __('Type', 'mccloud-backup') . '</th>';
                echo '<th>' . __('Status', 'mccloud-backup') . '</th>';
                echo '<th>' . __('Started', 'mccloud-backup') . '</th>';
                echo '<th>' . __('Completed', 'mccloud-backup') . '</th>';
                echo '<th>' . __('Size', 'mccloud-backup') . '</th>';
                echo '<th>' . __('Files', 'mccloud-backup') . '</th>';
                echo '</tr></thead>';
                
                echo '<tbody>';
                foreach ($logs as $log) {
                    echo '<tr>';
                    echo '<td>' . esc_html($log->backup_id) . '</td>';
                    echo '<td>' . esc_html($log->type) . '</td>';
                    echo '<td>' . esc_html($log->status) . '</td>';
                    echo '<td>' . esc_html(get_date_from_gmt($log->start_time)) . '</td>';
                    echo '<td>' . ($log->end_time ? esc_html(get_date_from_gmt($log->end_time)) : __('In Progress', 'mccloud-backup')) . '</td>';
                    echo '<td>' . esc_html(size_format($log->size)) . '</td>';
                    echo '<td>' . esc_html($log->file_count) . '</td>';
                    echo '</tr>';
                }
                echo '</tbody>';
                echo '</table>';
            }
            
            echo '</div>';
        }
    }

    /**
     * Run scheduled backup
     */
    public function run_scheduled_backup() {
        // Check if automatic backups are enabled
        if (isset($this->options['auto_backup']) && $this->options['auto_backup']) {
            $backup = new McCloud_Backup_Backup();
            $backup_id = md5(time() . wp_rand());
            $backup->start($backup_id, $this->options['auto_backup_type'] ?? 'full');
            
            // Log scheduled backup
            error_log('McCloud Backup: Scheduled backup started with ID ' . $backup_id);
        }
    }

    /**
     * Check if UpdraftPlus is active
     *
     * @return bool
     */
    private function is_updraftplus_active() {
        return in_array('updraftplus/updraftplus.php', apply_filters('active_plugins', get_option('active_plugins')));
    }
}

// Initialize the plugin
function mccloud_backup_init() {
    McCloudBackup::get_instance();
}
add_action('plugins_loaded', 'mccloud_backup_init');