<?php
/**
 * BackupSheep Admin Class
 *
 * @package BackupSheep
 */

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

/**
 * Admin class
 */
class BackupSheep_Admin {
    /**
     * Constructor
     */
    public function __construct() {
        // Register settings
        add_action('admin_init', [$this, 'register_settings']);
        
        // Register AJAX actions
        add_action('wp_ajax_backupsheep_start_backup', [$this, 'ajax_start_backup']);
        add_action('wp_ajax_backupsheep_get_backup_status', [$this, 'ajax_get_backup_status']);
        add_action('wp_ajax_backupsheep_test_connection', [$this, 'ajax_test_connection']);
    }
    
    /**
     * Register settings
     */
    public function register_settings() {
        register_setting(
            'backupsheep_options',
            'backupsheep_options',
            [$this, 'sanitize_options']
        );
        
        add_settings_section(
            'backupsheep_section_general',
            __('General Settings', 'backupsheep'),
            [$this, 'render_section_general'],
            'backupsheep_settings'
        );
        
        add_settings_field(
            'backupsheep_field_api_key',
            __('API Key', 'backupsheep'),
            [$this, 'render_field_api_key'],
            'backupsheep_settings',
            'backupsheep_section_general'
        );
        
        add_settings_field(
            'backupsheep_field_site_id',
            __('Site ID', 'backupsheep'),
            [$this, 'render_field_site_id'],
            'backupsheep_settings',
            'backupsheep_section_general'
        );
        
        add_settings_section(
            'backupsheep_section_backup',
            __('Backup Settings', 'backupsheep'),
            [$this, 'render_section_backup'],
            'backupsheep_settings'
        );
        
        add_settings_field(
            'backupsheep_field_auto_backup',
            __('Automatic Backups', 'backupsheep'),
            [$this, 'render_field_auto_backup'],
            'backupsheep_settings',
            'backupsheep_section_backup'
        );
        
        add_settings_field(
            'backupsheep_field_backup_schedule',
            __('Backup Schedule', 'backupsheep'),
            [$this, 'render_field_backup_schedule'],
            'backupsheep_settings',
            'backupsheep_section_backup'
        );
        
        add_settings_field(
            'backupsheep_field_backup_type',
            __('Backup Type', 'backupsheep'),
            [$this, 'render_field_backup_type'],
            'backupsheep_settings',
            'backupsheep_section_backup'
        );
    }
    
    /**
     * Sanitize options
     *
     * @param array $input
     * @return array
     */
    public function sanitize_options($input) {
        $output = [];
        
        // API Key
        if (isset($input['api_key'])) {
            $output['api_key'] = sanitize_text_field($input['api_key']);
        }
        
        // Site ID (read-only)
        $options = get_option('backupsheep_options', []);
        $output['site_id'] = $options['site_id'] ?? '';
        
        // Auto Backup
        $output['auto_backup'] = isset($input['auto_backup']) ? (bool) $input['auto_backup'] : false;
        
        // Backup Schedule
        if (isset($input['backup_schedule'])) {
            $output['backup_schedule'] = sanitize_text_field($input['backup_schedule']);
        }
        
        // Backup Type
        if (isset($input['backup_type'])) {
            $output['backup_type'] = sanitize_text_field($input['backup_type']);
        }
        
        // If API key changed, try to register with API
        if (isset($input['api_key']) && $input['api_key'] !== ($options['api_key'] ?? '')) {
            $api = new BackupSheep_API();
            $api->register_site();
        }
        
        // Update cron schedules if auto backup or schedule changed
        if (
            $output['auto_backup'] !== ($options['auto_backup'] ?? false) || 
            $output['backup_schedule'] !== ($options['backup_schedule'] ?? 'daily')
        ) {
            $this->update_cron_schedule($output);
        }
        
        return $output;
    }
    
    /**
     * Update cron schedule
     *
     * @param array $options
     */
    private function update_cron_schedule($options) {
        // Clear existing schedule
        wp_clear_scheduled_hook('backupsheep_scheduled_backup');
        
        // Schedule new backup if enabled
        if ($options['auto_backup']) {
            $schedule = $options['backup_schedule'] ?? 'daily';
            wp_schedule_event(time(), $schedule, 'backupsheep_scheduled_backup');
        }
    }
    
    /**
     * Render section general
     */
    public function render_section_general() {
        echo '<p>' . __('Configure your BackupSheep API connection settings here.', 'backupsheep') . '</p>';
    }
    
    /**
     * Render section backup
     */
    public function render_section_backup() {
        echo '<p>' . __('Configure automatic backup settings.', 'backupsheep') . '</p>';
    }
    
    /**
     * Render field API key
     */
    public function render_field_api_key() {
        $options = get_option('backupsheep_options', []);
        $api_key = $options['api_key'] ?? '';
        
        echo '<input type="text" name="backupsheep_options[api_key]" value="' . esc_attr($api_key) . '" class="regular-text">';
        echo '<p class="description">' . __('Enter your BackupSheep API key from your dashboard', 'backupsheep') . '</p>';
        echo '<p><button type="button" class="button" id="backupsheep-test-connection">' . __('Test Connection', 'backupsheep') . '</button></p>';
    }
    
    /**
     * Render field site ID
     */
    public function render_field_site_id() {
        $options = get_option('backupsheep_options', []);
        $site_id = $options['site_id'] ?? '';
        
        echo '<input type="text" value="' . esc_attr($site_id) . '" class="regular-text" readonly>';
        echo '<p class="description">' . __('Your unique site identifier (used by BackupSheep dashboard)', 'backupsheep') . '</p>';
    }
    
    /**
     * Render field auto backup
     */
    public function render_field_auto_backup() {
        $options = get_option('backupsheep_options', []);
        $auto_backup = $options['auto_backup'] ?? false;
        
        echo '<label>';
        echo '<input type="checkbox" name="backupsheep_options[auto_backup]" value="1" ' . checked($auto_backup, true, false) . '>';
        echo __('Enable automatic backups', 'backupsheep');
        echo '</label>';
    }
    
    /**
     * Render field backup schedule
     */
    public function render_field_backup_schedule() {
        $options = get_option('backupsheep_options', []);
        $schedule = $options['backup_schedule'] ?? 'daily';
        
        echo '<select name="backupsheep_options[backup_schedule]">';
        echo '<option value="hourly" ' . selected($schedule, 'hourly', false) . '>' . __('Hourly', 'backupsheep') . '</option>';
        echo '<option value="twicedaily" ' . selected($schedule, 'twicedaily', false) . '>' . __('Twice Daily', 'backupsheep') . '</option>';
        echo '<option value="daily" ' . selected($schedule, 'daily', false) . '>' . __('Daily', 'backupsheep') . '</option>';
        echo '<option value="weekly" ' . selected($schedule, 'weekly', false) . '>' . __('Weekly', 'backupsheep') . '</option>';
        echo '</select>';
    }
    
    /**
     * Render field backup type
     */
    public function render_field_backup_type() {
        $options = get_option('backupsheep_options', []);
        $type = $options['backup_type'] ?? 'full';
        
        echo '<select name="backupsheep_options[backup_type]">';
        echo '<option value="full" ' . selected($type, 'full', false) . '>' . __('Full (Database + Files)', 'backupsheep') . '</option>';
        echo '<option value="database" ' . selected($type, 'database', false) . '>' . __('Database Only', 'backupsheep') . '</option>';
        echo '<option value="files" ' . selected($type, 'files', false) . '>' . __('Files Only', 'backupsheep') . '</option>';
        echo '</select>';
    }
    
    /**
     * AJAX start backup
     */
    public function ajax_start_backup() {
        // Check if user can manage backups
        if (!backupsheep_current_user_can_manage()) {
            wp_send_json_error(['message' => __('You do not have permission to perform this action', 'backupsheep')]);
        }
        
        // Check nonce
        if (!check_ajax_referer('backupsheep-nonce', 'nonce', false)) {
            wp_send_json_error(['message' => __('Security check failed', 'backupsheep')]);
        }
        
        // Get backup type
        $type = sanitize_text_field($_POST['type'] ?? 'full');
        
        // Generate backup ID
        $backup_id = backupsheep_generate_backup_id();
        
        // Start backup
        $backup = new BackupSheep_Backup();
        $result = $backup->start($backup_id, $type);
        
        if (is_wp_error($result)) {
            wp_send_json_error([
                'message' => $result->get_error_message(),
            ]);
        }
        
        wp_send_json_success([
            'backup_id' => $backup_id,
            'message' => __('Backup started successfully', 'backupsheep'),
        ]);
    }
    
    /**
     * AJAX get backup status
     */
    public function ajax_get_backup_status() {
        // Check if user can manage backups
        if (!backupsheep_current_user_can_manage()) {
            wp_send_json_error(['message' => __('You do not have permission to perform this action', 'backupsheep')]);
        }
        
        // Check nonce
        if (!check_ajax_referer('backupsheep-nonce', 'nonce', false)) {
            wp_send_json_error(['message' => __('Security check failed', 'backupsheep')]);
        }
        
        // Get backup ID
        $backup_id = sanitize_text_field($_POST['backup_id'] ?? '');
        
        if (empty($backup_id)) {
            wp_send_json_error(['message' => __('Backup ID is required', 'backupsheep')]);
        }
        
        // Get backup status
        $backup = new BackupSheep_Backup();
        $status = $backup->get_status($backup_id);
        
        wp_send_json_success([
            'status' => $status,
        ]);
    }
    
    /**
     * AJAX test connection
     */
    public function ajax_test_connection() {
        // Check if user can manage backups
        if (!backupsheep_current_user_can_manage()) {
            wp_send_json_error(['message' => __('You do not have permission to perform this action', 'backupsheep')]);
        }
        
        // Check nonce
        if (!check_ajax_referer('backupsheep-nonce', 'nonce', false)) {
            wp_send_json_error(['message' => __('Security check failed', 'backupsheep')]);
        }
        
        // Test connection
        $api = new BackupSheep_API();
        $result = $api->test_connection();
        
        if (is_wp_error($result)) {
            wp_send_json_error([
                'message' => $result->get_error_message(),
            ]);
        }
        
        wp_send_json_success([
            'message' => __('Connection successful!', 'backupsheep'),
        ]);
    }
}