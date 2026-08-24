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
 * Text Domain:         backupsheep
 * Domain Path:         /languages
 * License:             GPLv3 or later
 * License URI:         https://www.gnu.org/licenses/gpl-3.0.html
 */

// Exit if accessed directly.
if (!defined('ABSPATH')) exit;

// Define plugin constants
define('BACKUPSHEEP_VERSION', '2.0.0');
define('BACKUPSHEEP_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('BACKUPSHEEP_PLUGIN_URL', plugin_dir_url(__FILE__));
define('BACKUPSHEEP_PLUGIN_FILE', __FILE__);
define('BACKUPSHEEP_API_URL', 'https://api.mccloudbackup.com/v2');

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
        $this->options = get_option('backupsheep_options', []);

        // NOTE: activation/deactivation hooks are NOT registered here - see the bottom of this
        // file. register_activation_hook() only works if called unconditionally while the
        // plugin's main file is loaded; this constructor only runs via plugins_loaded, which
        // has already fired by the time a not-yet-active plugin gets activated, so a callback
        // added to it here would never run and activate() would silently never fire.

        // Load required files
        $this->load_dependencies();

        // Register REST API routes
        add_action('rest_api_init', [$this, 'register_routes']);

        // Register admin menu
        add_action('admin_menu', [$this, 'register_admin_menu']);

        // Register admin assets
        add_action('admin_enqueue_scripts', [$this, 'register_admin_assets']);

        // Set up the cron job for scheduled backups
        add_action('backupsheep_scheduled_backup', [$this, 'run_scheduled_backup']);
    }

    /**
     * Load required dependencies
     */
    private function load_dependencies() {
        // Include helper functions
        require_once BACKUPSHEEP_PLUGIN_DIR . 'includes/functions.php';

        // Include API class
        require_once BACKUPSHEEP_PLUGIN_DIR . 'includes/api.php';

        // Include backup class
        require_once BACKUPSHEEP_PLUGIN_DIR . 'includes/backup.php';

        // Include admin class
        require_once BACKUPSHEEP_PLUGIN_DIR . 'includes/admin.php';
        
        // Include encryption utilities
        require_once BACKUPSHEEP_PLUGIN_DIR . 'includes/encryption.php';
        
        // Include health check class
        require_once BACKUPSHEEP_PLUGIN_DIR . 'includes/health-check.php';
    }

    /**
     * Plugin activation
     */
    public function activate() {
        // Backup capture is native as of v2.0 - no third-party backup plugin required.

        // Create backup directory
        $upload_dir = wp_upload_dir();
        $backup_dir = $upload_dir['basedir'] . '/backupsheep';
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
            update_option('backupsheep_options', $this->options);
        }

        // Schedule default backup if not already scheduled
        if (!wp_next_scheduled('backupsheep_scheduled_backup')) {
            wp_schedule_event(time(), 'daily', 'backupsheep_scheduled_backup');
        }

        // Create necessary database tables
        $this->create_db_tables();
    }

    /**
     * Plugin deactivation
     */
    public function deactivate() {
        // Clear scheduled backup
        wp_clear_scheduled_hook('backupsheep_scheduled_backup');
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
        $table_name = $wpdb->prefix . 'backupsheep_logs';
        
        // NOTE: dbDelta() does NOT support "IF NOT EXISTS" - its table-name regex expects
        // "CREATE TABLE <name>" exactly and will misparse "IF" as the table name, silently
        // creating a garbage table called `IF` instead of this one. dbDelta is idempotent on
        // its own (diffs against the existing table), so plain CREATE TABLE is correct here.
        $sql = "CREATE TABLE $table_name (
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
            encrypted tinyint(1) DEFAULT 0,
            encryption_method varchar(50) DEFAULT NULL,
            files text DEFAULT NULL,
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
        register_rest_route('backupsheep/v3', '/validate', [
            'methods' => 'GET',
            'callback' => [$this, 'validate_api'],
            'permission_callback' => [$this, 'check_api_permission'],
        ]);

        // Backup routes - start/delete are state-changing, so they're POST;
        // status/download are read-only, so they stay GET (download needs a plain URL anyway).
        register_rest_route('backupsheep/v3', '/backup/start', [
            'methods' => 'POST',
            'callback' => [$this, 'start_backup'],
            'permission_callback' => [$this, 'check_api_permission'],
        ]);

        register_rest_route('backupsheep/v3', '/backup/status', [
            'methods' => 'GET',
            'callback' => [$this, 'backup_status'],
            'permission_callback' => [$this, 'check_api_permission'],
        ]);

        register_rest_route('backupsheep/v3', '/backup/files', [
            'methods' => 'GET',
            'callback' => [$this, 'backup_files'],
            'permission_callback' => [$this, 'check_api_permission'],
        ]);

        register_rest_route('backupsheep/v3', '/backup/download', [
            'methods' => 'GET',
            'callback' => [$this, 'download_backup'],
            'permission_callback' => [$this, 'check_api_permission'],
        ]);

        register_rest_route('backupsheep/v3', '/backup/delete', [
            'methods' => 'POST',
            'callback' => [$this, 'delete_backup'],
            'permission_callback' => [$this, 'check_api_permission'],
        ]);

        // Site information
        register_rest_route('backupsheep/v3', '/site/info', [
            'methods' => 'GET',
            'callback' => [$this, 'get_site_info'],
            'permission_callback' => [$this, 'check_api_permission'],
        ]);

        // Health check
        register_rest_route('backupsheep/v3', '/site/health-check', [
            'methods' => 'GET',
            'callback' => [$this, 'run_health_check'],
            'permission_callback' => [$this, 'check_api_permission'],
        ]);

        // V1 API routes for external backup system integration
        register_rest_route('backupsheep/v1', '/backup/start', [
            'methods' => 'POST',
            'callback' => [$this, 'backup_start_v1'],
            'permission_callback' => '__return_true', // No authentication required for token verification
        ]);

        register_rest_route('backupsheep/v1', '/backup/run', [
            'methods' => 'POST',
            'callback' => [$this, 'backup_run_v1'],
            'permission_callback' => '__return_true', // Token verification handled internally
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
            'version' => BACKUPSHEEP_VERSION,
            'site_id' => $this->options['site_id'],
            'wordpress_version' => get_bloginfo('version'),
            'php_version' => phpversion(),
            'plugins' => [
                'backupsheep' => true,
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
        $exclusions = $request->get_param('exclusions');
        $exclusions = is_array($exclusions) ? $exclusions : [];

        // Instantiate backup class
        $backup = new McCloudBackup_Backup();
        $result = $backup->start($backup_id, $type, $exclusions);
        
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
        $backup = new McCloudBackup_Backup();
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
        $backup = new McCloudBackup_Backup();
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
        $backup_id = $request->get_param('backup_id');

        if (!$file || !$backup_id) {
            return new WP_REST_Response([
                'status' => 'error',
                'message' => 'File and backup_id parameters are required',
            ], 400);
        }

        // Download file
        $backup = new McCloudBackup_Backup();
        $backup->download_file($file, $backup_id);
        
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
        $backup = new McCloudBackup_Backup();
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
            'plugin_version' => BACKUPSHEEP_VERSION,
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
            __('McCloud Backup', 'backupsheep'),
            __('McCloud Backup', 'backupsheep'),
            'manage_options',
            'backupsheep',
            [$this, 'render_admin_page'],
            'dashicons-backup',
            100
        );
        
        add_submenu_page(
            'backupsheep',
            __('Dashboard', 'backupsheep'),
            __('Dashboard', 'backupsheep'),
            'manage_options',
            'backupsheep',
            [$this, 'render_admin_page']
        );
        
        add_submenu_page(
            'backupsheep',
            __('Settings', 'backupsheep'),
            __('Settings', 'backupsheep'),
            'manage_options',
            'backupsheep-settings',
            [$this, 'render_settings_page']
        );
        
        add_submenu_page(
            'backupsheep',
            __('Backup History', 'backupsheep'),
            __('Backup History', 'backupsheep'),
            'manage_options',
            'backupsheep-history',
            [$this, 'render_history_page']
        );
    }

    /**
     * Register admin assets
     */
    public function register_admin_assets($hook) {
        // Only load on plugin pages
        if (strpos($hook, 'backupsheep') === false) {
            return;
        }
        
        // CSS
        wp_enqueue_style(
            'backupsheep-admin',
            BACKUPSHEEP_PLUGIN_URL . 'assets/css/admin.css',
            [],
            BACKUPSHEEP_VERSION
        );
        
        // JS
        wp_enqueue_script(
            'backupsheep-admin',
            BACKUPSHEEP_PLUGIN_URL . 'assets/js/admin.js',
            ['jquery'],
            BACKUPSHEEP_VERSION,
            true
        );
        
        // Localize script with data
        wp_localize_script(
            'backupsheep-admin',
            'backupsheepData',
            [
                'ajax_url' => admin_url('admin-ajax.php'),
                'nonce' => wp_create_nonce('backupsheep-nonce'),
                'site_id' => $this->options['site_id'],
                'api_key' => $this->options['api_key'] ?? '',
                'i18n' => [
                    'backup_started' => __('Backup started successfully!', 'backupsheep'),
                    'backup_error' => __('Error starting backup', 'backupsheep'),
                    'confirm_delete' => __('Are you sure you want to delete this backup?', 'backupsheep'),
                ],
            ]
        );
    }

    /**
     * Render admin page
     */
    public function render_admin_page() {
        if (file_exists(BACKUPSHEEP_PLUGIN_DIR . 'includes/views/dashboard.php')) {
            include BACKUPSHEEP_PLUGIN_DIR . 'includes/views/dashboard.php';
        } else {
            echo '<div class="wrap"><h1>' . __('McCloud Backup Dashboard', 'backupsheep') . '</h1>';
            echo '<p>' . __('Welcome to McCloud Backup! Configure your settings to get started.', 'backupsheep') . '</p>';
            echo '</div>';
        }
    }

    /**
     * Render settings page
     */
    public function render_settings_page() {
        if (file_exists(BACKUPSHEEP_PLUGIN_DIR . 'includes/views/settings.php')) {
            include BACKUPSHEEP_PLUGIN_DIR . 'includes/views/settings.php';
        } else {
            echo '<div class="wrap"><h1>' . __('McCloud Backup Settings', 'backupsheep') . '</h1>';
            echo '<p>' . __('Configure your McCloud Backup settings here.', 'backupsheep') . '</p>';
            
            // Basic settings form
            echo '<form method="post" action="options.php">';
            settings_fields('backupsheep_options');
            
            echo '<table class="form-table" role="presentation">';
            echo '<tr>';
            echo '<th scope="row"><label for="backupsheep_api_key">' . __('API Key', 'backupsheep') . '</label></th>';
            echo '<td><input name="backupsheep_options[api_key]" type="text" id="backupsheep_api_key" value="' . esc_attr($this->options['api_key'] ?? '') . '" class="regular-text">';
            echo '<p class="description">' . __('Enter your McCloud Backup API key from your dashboard', 'backupsheep') . '</p></td>';
            echo '</tr>';
            
            echo '<tr>';
            echo '<th scope="row"><label for="backupsheep_site_id">' . __('Site ID', 'backupsheep') . '</label></th>';
            echo '<td><input name="backupsheep_options[site_id]" type="text" id="backupsheep_site_id" value="' . esc_attr($this->options['site_id'] ?? '') . '" class="regular-text" readonly>';
            echo '<p class="description">' . __('Your unique site identifier (used by McCloud Backup dashboard)', 'backupsheep') . '</p></td>';
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
        if (file_exists(BACKUPSHEEP_PLUGIN_DIR . 'includes/views/history.php')) {
            include BACKUPSHEEP_PLUGIN_DIR . 'includes/views/history.php';
        } else {
            echo '<div class="wrap"><h1>' . __('Backup History', 'backupsheep') . '</h1>';
            echo '<p>' . __('View your backup history here.', 'backupsheep') . '</p>';
            
            // Get backup logs
            global $wpdb;
            $table_name = $wpdb->prefix . 'backupsheep_logs';
            $logs = $wpdb->get_results("SELECT * FROM $table_name ORDER BY start_time DESC LIMIT 20");
            
            if (empty($logs)) {
                echo '<p>' . __('No backup history found.', 'backupsheep') . '</p>';
            } else {
                echo '<table class="wp-list-table widefat fixed striped">';
                echo '<thead><tr>';
                echo '<th>' . __('Backup ID', 'backupsheep') . '</th>';
                echo '<th>' . __('Type', 'backupsheep') . '</th>';
                echo '<th>' . __('Status', 'backupsheep') . '</th>';
                echo '<th>' . __('Started', 'backupsheep') . '</th>';
                echo '<th>' . __('Completed', 'backupsheep') . '</th>';
                echo '<th>' . __('Size', 'backupsheep') . '</th>';
                echo '<th>' . __('Files', 'backupsheep') . '</th>';
                echo '</tr></thead>';
                
                echo '<tbody>';
                foreach ($logs as $log) {
                    echo '<tr>';
                    echo '<td>' . esc_html($log->backup_id) . '</td>';
                    echo '<td>' . esc_html($log->type) . '</td>';
                    echo '<td>' . esc_html($log->status) . '</td>';
                    echo '<td>' . esc_html(get_date_from_gmt($log->start_time)) . '</td>';
                    echo '<td>' . ($log->end_time ? esc_html(get_date_from_gmt($log->end_time)) : __('In Progress', 'backupsheep')) . '</td>';
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
            $backup = new McCloudBackup_Backup();
            $backup_id = md5(time() . wp_rand());
            $backup->start($backup_id, $this->options['auto_backup_type'] ?? 'full');
            
            // Log scheduled backup
            error_log('McCloud Backup: Scheduled backup started with ID ' . $backup_id);
        }
    }

    /**
     * Backup start endpoint for v1 API (with token verification)
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function backup_start_v1($request) {
        // Get the token from the request
        $received_token = $request->get_param('token');
        
        // If no token provided, generate a process ID and return it
        if (empty($received_token)) {
            $process_id = 'backup_' . time() . '_' . wp_rand(1000, 9999);
            
            // Store the process ID temporarily for verification
            set_transient('backupsheep_process_' . $process_id, [
                'created_at' => time(),
                'status' => 'pending_verification',
                'site_token' => $this->get_site_token()
            ], 300); // 5 minutes expiry
            
            return new WP_REST_Response([
                'status' => 'SUCCESS',
                'process_id' => $process_id,
                'message' => 'Process initialized, awaiting token verification',
                'token' => $this->get_api_key() // Send our API key for verification
            ], 200);
        }
        
        // If token is provided, verify it against our API key
        $api_key = $this->get_api_key();
        
        if ($received_token !== $api_key) {
            return new WP_REST_Response([
                'status' => 'ERROR',
                'message' => 'Token verification failed - invalid token provided',
                'error_code' => 'INVALID_TOKEN'
            ], 401);
        }
        
        // Token verified successfully, proceed with backup initialization
        $process_id = 'backup_' . time() . '_' . wp_rand(1000, 9999);
        
        // Store the verified process for the run endpoint
        set_transient('backupsheep_verified_' . $process_id, [
            'created_at' => time(),
            'status' => 'verified',
            'token_verified' => true
        ], 600); // 10 minutes expiry
        
        return new WP_REST_Response([
            'status' => 'SUCCESS',
            'process_id' => $process_id,
            'message' => 'Token verified successfully, ready for backup',
            'path' => '/wp-content/uploads/backupsheep/' . $process_id
        ], 200);
    }

    /**
     * Backup run endpoint for v1 API (executes backup after token verification)
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function backup_run_v1($request) {
        $process_id = $request->get_param('process_id');
        $dropbox_token = $request->get_param('dropbox_token');
        $mode = $request->get_param('mode') ?: '1'; // Default to full backup
        
        if (empty($process_id)) {
            return new WP_REST_Response([
                'status' => 'ERROR',
                'message' => 'Process ID is required',
                'error_code' => 'MISSING_PROCESS_ID'
            ], 400);
        }
        
        // Check if this process was verified
        $verified_process = get_transient('backupsheep_verified_' . $process_id);
        
        if (!$verified_process || !$verified_process['token_verified']) {
            return new WP_REST_Response([
                'status' => 'ERROR',
                'message' => 'Process not found or token not verified',
                'error_code' => 'PROCESS_NOT_VERIFIED'
            ], 401);
        }
        
        // Clean up the verification transient
        delete_transient('backupsheep_verified_' . $process_id);
        
        // Determine backup type from mode
        $backup_type = 'full';
        switch ($mode) {
            case '2':
                $backup_type = 'database';
                break;
            case '3':
                $backup_type = 'files';
                break;
            default:
                $backup_type = 'full';
                break;
        }
        
        // Start the backup process
        try {
            $backup = new McCloudBackup_Backup();
            $result = $backup->start($process_id, $backup_type);
            
            if (is_wp_error($result)) {
                return new WP_REST_Response([
                    'status' => 'ERROR',
                    'message' => $result->get_error_message(),
                    'error_code' => 'BACKUP_START_FAILED'
                ], 500);
            }
            
            // Store dropbox token for later use if provided
            if (!empty($dropbox_token)) {
                update_option('backupsheep_temp_dropbox_token_' . $process_id, $dropbox_token);
            }
            
            return new WP_REST_Response([
                'status' => 'SUCCESS',
                'process_id' => $process_id,
                'backup_type' => $backup_type,
                'message' => 'Backup process started successfully'
            ], 200);
            
        } catch (Exception $e) {
            return new WP_REST_Response([
                'status' => 'ERROR',
                'message' => 'Failed to start backup: ' . $e->getMessage(),
                'error_code' => 'BACKUP_EXCEPTION'
            ], 500);
        }
    }

    /**
     * Get the configured API key for verification
     *
     * @return string
     */
    private function get_api_key() {
        return isset($this->options['api_key']) ? $this->options['api_key'] : '';
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
function backupsheep_init() {
    McCloudBackup::get_instance();
}
add_action('plugins_loaded', 'backupsheep_init');

// Activation/deactivation hooks MUST be registered unconditionally, right here at file scope -
// not from inside a plugins_loaded-gated constructor (see the note in __construct() above).
// WordPress only recognizes register_activation_hook() calls made while it directly includes
// this file during the activation request itself.
register_activation_hook(__FILE__, function () {
    McCloudBackup::get_instance()->activate();
});
register_deactivation_hook(__FILE__, function () {
    McCloudBackup::get_instance()->deactivate();
});