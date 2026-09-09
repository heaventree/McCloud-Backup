<?php
/**
 * McCloud Backup Admin Class
 *
 * @package McCloud Backup
 */

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

/**
 * Admin class
 */
class McCloud_Backup_Admin {
    /**
     * Constructor
     */
    public function __construct() {
        // Register settings
        add_action('admin_init', [$this, 'register_settings']);
        
        // Register AJAX actions
        add_action('wp_ajax_mccloud_backup_start_backup', [$this, 'ajax_start_backup']);
        add_action('wp_ajax_mccloud_backup_get_backup_status', [$this, 'ajax_get_backup_status']);
        add_action('wp_ajax_mccloud_backup_test_connection', [$this, 'ajax_test_connection']);
    }
    
    /**
     * Register settings
     */
    public function register_settings() {
        register_setting(
            'mccloud_backup_options',
            'mccloud_backup_options',
            [$this, 'sanitize_options']
        );
        
        add_settings_section(
            'mccloud_backup_section_general',
            __('General Settings', 'mccloud-backup'),
            [$this, 'render_section_general'],
            'mccloud_backup_settings'
        );
        
        add_settings_field(
            'mccloud_backup_field_api_key',
            __('API Key', 'mccloud-backup'),
            [$this, 'render_field_api_key'],
            'mccloud_backup_settings',
            'mccloud_backup_section_general'
        );
        
        add_settings_field(
            'mccloud_backup_field_site_id',
            __('Site ID', 'mccloud-backup'),
            [$this, 'render_field_site_id'],
            'mccloud_backup_settings',
            'mccloud_backup_section_general'
        );
        
        add_settings_section(
            'mccloud_backup_section_backup',
            __('Backup Settings', 'mccloud-backup'),
            [$this, 'render_section_backup'],
            'mccloud_backup_settings'
        );
        
        add_settings_field(
            'mccloud_backup_field_auto_backup',
            __('Automatic Backups', 'mccloud-backup'),
            [$this, 'render_field_auto_backup'],
            'mccloud_backup_settings',
            'mccloud_backup_section_backup'
        );
        
        add_settings_field(
            'mccloud_backup_field_backup_schedule',
            __('Backup Schedule', 'mccloud-backup'),
            [$this, 'render_field_backup_schedule'],
            'mccloud_backup_settings',
            'mccloud_backup_section_backup'
        );
        
        add_settings_field(
            'mccloud_backup_field_backup_type',
            __('Backup Type', 'mccloud-backup'),
            [$this, 'render_field_backup_type'],
            'mccloud_backup_settings',
            'mccloud_backup_section_backup'
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
        $options = get_option('mccloud_backup_options', []);
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
            $api = new McCloud_Backup_API();
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
        wp_clear_scheduled_hook('mccloud_backup_scheduled_backup');
        
        // Schedule new backup if enabled
        if ($options['auto_backup']) {
            $schedule = $options['backup_schedule'] ?? 'daily';
            wp_schedule_event(time(), $schedule, 'mccloud_backup_scheduled_backup');
        }
    }
    
    /**
     * Render section general
     */
    public function render_section_general() {
        echo '<p>' . __('Configure your McCloud Backup API connection settings here.', 'mccloud-backup') . '</p>';
    }
    
    /**
     * Render section backup
     */
    public function render_section_backup() {
        echo '<p>' . __('Configure automatic backup settings.', 'mccloud-backup') . '</p>';
    }
    
    /**
     * Render field API key
     */
    public function render_field_api_key() {
        $options = get_option('mccloud_backup_options', []);
        $api_key = $options['api_key'] ?? '';
        
        echo '<input type="text" name="mccloud_backup_options[api_key]" value="' . esc_attr($api_key) . '" class="regular-text">';
        echo '<p class="description">' . __('Enter your McCloud Backup API key from your dashboard', 'mccloud-backup') . '</p>';
        echo '<p><button type="button" class="button" id="mccloud-backup-test-connection">' . __('Test Connection', 'mccloud-backup') . '</button></p>';
    }
    
    /**
     * Render field site ID
     */
    public function render_field_site_id() {
        $options = get_option('mccloud_backup_options', []);
        $site_id = $options['site_id'] ?? '';
        
        echo '<input type="text" value="' . esc_attr($site_id) . '" class="regular-text" readonly>';
        echo '<p class="description">' . __('Your unique site identifier (used by McCloud Backup dashboard)', 'mccloud-backup') . '</p>';
    }
    
    /**
     * Render field auto backup
     */
    public function render_field_auto_backup() {
        $options = get_option('mccloud_backup_options', []);
        $auto_backup = $options['auto_backup'] ?? false;
        
        echo '<label>';
        echo '<input type="checkbox" name="mccloud_backup_options[auto_backup]" value="1" ' . checked($auto_backup, true, false) . '>';
        echo __('Enable automatic backups', 'mccloud-backup');
        echo '</label>';
    }
    
    /**
     * Render field backup schedule
     */
    public function render_field_backup_schedule() {
        $options = get_option('mccloud_backup_options', []);
        $schedule = $options['backup_schedule'] ?? 'daily';
        
        echo '<select name="mccloud_backup_options[backup_schedule]">';
        echo '<option value="hourly" ' . selected($schedule, 'hourly', false) . '>' . __('Hourly', 'mccloud-backup') . '</option>';
        echo '<option value="twicedaily" ' . selected($schedule, 'twicedaily', false) . '>' . __('Twice Daily', 'mccloud-backup') . '</option>';
        echo '<option value="daily" ' . selected($schedule, 'daily', false) . '>' . __('Daily', 'mccloud-backup') . '</option>';
        echo '<option value="weekly" ' . selected($schedule, 'weekly', false) . '>' . __('Weekly', 'mccloud-backup') . '</option>';
        echo '</select>';
    }
    
    /**
     * Render field backup type
     */
    public function render_field_backup_type() {
        $options = get_option('mccloud_backup_options', []);
        $type = $options['backup_type'] ?? 'full';
        
        echo '<select name="mccloud_backup_options[backup_type]">';
        echo '<option value="full" ' . selected($type, 'full', false) . '>' . __('Full (Database + Files)', 'mccloud-backup') . '</option>';
        echo '<option value="database" ' . selected($type, 'database', false) . '>' . __('Database Only', 'mccloud-backup') . '</option>';
        echo '<option value="files" ' . selected($type, 'files', false) . '>' . __('Files Only', 'mccloud-backup') . '</option>';
        echo '</select>';
    }
    
    /**
     * AJAX start backup
     */
    public function ajax_start_backup() {
        // Check if user can manage backups
        if (!mccloud_backup_current_user_can_manage()) {
            wp_send_json_error(['message' => __('You do not have permission to perform this action', 'mccloud-backup')]);
        }
        
        // Check nonce
        if (!check_ajax_referer('mccloud-backup-nonce', 'nonce', false)) {
            wp_send_json_error(['message' => __('Security check failed', 'mccloud-backup')]);
        }
        
        // Get backup type
        $type = sanitize_text_field($_POST['type'] ?? 'full');
        
        // Generate backup ID
        $backup_id = mccloud_backup_generate_backup_id();
        
        // Start backup
        $backup = new McCloud_Backup_Backup();
        $result = $backup->start($backup_id, $type);
        
        if (is_wp_error($result)) {
            wp_send_json_error([
                'message' => $result->get_error_message(),
            ]);
        }
        
        wp_send_json_success([
            'backup_id' => $backup_id,
            'message' => __('Backup started successfully', 'mccloud-backup'),
        ]);
    }
    
    /**
     * AJAX get backup status
     */
    public function ajax_get_backup_status() {
        // Check if user can manage backups
        if (!mccloud_backup_current_user_can_manage()) {
            wp_send_json_error(['message' => __('You do not have permission to perform this action', 'mccloud-backup')]);
        }
        
        // Check nonce
        if (!check_ajax_referer('mccloud-backup-nonce', 'nonce', false)) {
            wp_send_json_error(['message' => __('Security check failed', 'mccloud-backup')]);
        }
        
        // Get backup ID
        $backup_id = sanitize_text_field($_POST['backup_id'] ?? '');
        
        if (empty($backup_id)) {
            wp_send_json_error(['message' => __('Backup ID is required', 'mccloud-backup')]);
        }
        
        // Get backup status
        $backup = new McCloud_Backup_Backup();
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
        if (!mccloud_backup_current_user_can_manage()) {
            wp_send_json_error(['message' => __('You do not have permission to perform this action', 'mccloud-backup')]);
        }
        
        // Check nonce
        if (!check_ajax_referer('mccloud-backup-nonce', 'nonce', false)) {
            wp_send_json_error(['message' => __('Security check failed', 'mccloud-backup')]);
        }
        
        // Test connection
        $api = new McCloud_Backup_API();
        $result = $api->test_connection();
        
        if (is_wp_error($result)) {
            wp_send_json_error([
                'message' => $result->get_error_message(),
            ]);
        }
        
        wp_send_json_success([
            'message' => __('Connection successful!', 'mccloud-backup'),
        ]);
    }
}