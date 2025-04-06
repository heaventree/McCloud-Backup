<?php
/**
 * AJAX handlers
 *
 * @package BackupSheep
 */

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

/**
 * Register AJAX handlers
 */
function backupsheep_register_ajax_handlers() {
    // Test connection
    add_action('wp_ajax_backupsheep_test_connection', 'backupsheep_ajax_test_connection');
    
    // Start backup
    add_action('wp_ajax_backupsheep_start_backup', 'backupsheep_ajax_start_backup');
    
    // Get backup status
    add_action('wp_ajax_backupsheep_get_backup_status', 'backupsheep_ajax_get_backup_status');
    
    // Get error details
    add_action('wp_ajax_backupsheep_get_error_details', 'backupsheep_ajax_get_error_details');
    
    // Restore backup
    add_action('wp_ajax_backupsheep_restore_backup', 'backupsheep_ajax_restore_backup');
    
    // Delete backup
    add_action('wp_ajax_backupsheep_delete_backup', 'backupsheep_ajax_delete_backup');
}

/**
 * Test API connection
 */
function backupsheep_ajax_test_connection() {
    // Check nonce
    if (!check_ajax_referer('backupsheep_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => 'Invalid nonce']);
    }
    
    // Get API key
    $options = get_option('backupsheep_options', []);
    $api_key = isset($options['api_key']) ? $options['api_key'] : '';
    
    if (empty($api_key)) {
        wp_send_json_error(['message' => 'API key not set']);
    }
    
    // Test API connection
    $result = backupsheep_test_api_connection($api_key);
    
    if (is_wp_error($result)) {
        wp_send_json_error(['message' => $result->get_error_message()]);
    }
    
    // Save site ID if it's not already set
    if (!empty($result['site_id']) && empty($options['site_id'])) {
        $options['site_id'] = $result['site_id'];
        update_option('backupsheep_options', $options);
    }
    
    wp_send_json_success(['message' => 'API connection successful']);
}

/**
 * Start a backup
 */
function backupsheep_ajax_start_backup() {
    // Check nonce
    if (!check_ajax_referer('backupsheep_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => 'Invalid nonce']);
    }
    
    // Get backup type
    $type = isset($_POST['type']) ? sanitize_text_field($_POST['type']) : 'full';
    
    // Validate backup type
    if (!in_array($type, ['full', 'database', 'files'])) {
        wp_send_json_error(['message' => 'Invalid backup type']);
    }
    
    // Start backup
    $result = backupsheep_start_backup($type);
    
    if (is_wp_error($result)) {
        wp_send_json_error(['message' => $result->get_error_message()]);
    }
    
    wp_send_json_success([
        'message' => 'Backup started successfully',
        'backup_id' => $result['backup_id']
    ]);
}

/**
 * Get backup status
 */
function backupsheep_ajax_get_backup_status() {
    // Check nonce
    if (!check_ajax_referer('backupsheep_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => 'Invalid nonce']);
    }
    
    // Get backup ID
    $backup_id = isset($_POST['backup_id']) ? sanitize_text_field($_POST['backup_id']) : '';
    
    if (empty($backup_id)) {
        wp_send_json_error(['message' => 'Backup ID is required']);
    }
    
    // Get backup status
    $status = backupsheep_get_backup_status($backup_id);
    
    if (is_wp_error($status)) {
        wp_send_json_error(['message' => $status->get_error_message()]);
    }
    
    wp_send_json_success(['status' => $status]);
}

/**
 * Get error details for a backup
 */
function backupsheep_ajax_get_error_details() {
    // Check nonce
    if (!check_ajax_referer('backupsheep_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => 'Invalid nonce']);
    }
    
    // Get backup ID
    $backup_id = isset($_POST['backup_id']) ? sanitize_text_field($_POST['backup_id']) : '';
    
    if (empty($backup_id)) {
        wp_send_json_error(['message' => 'Backup ID is required']);
    }
    
    // Get backup record
    global $wpdb;
    $table_name = $wpdb->prefix . 'backupsheep_logs';
    
    $backup = $wpdb->get_row(
        $wpdb->prepare(
            "SELECT * FROM {$table_name} WHERE backup_id = %s",
            $backup_id
        )
    );
    
    if (!$backup || $backup->status !== 'error') {
        wp_send_json_error(['message' => 'Backup not found or not in error state']);
    }
    
    wp_send_json_success([
        'error' => $backup->error_message ?: 'No detailed error information available'
    ]);
}

/**
 * Restore a backup
 */
function backupsheep_ajax_restore_backup() {
    // Check nonce
    if (!check_ajax_referer('backupsheep_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => 'Invalid nonce']);
    }
    
    // Get backup ID
    $backup_id = isset($_POST['backup_id']) ? sanitize_text_field($_POST['backup_id']) : '';
    
    if (empty($backup_id)) {
        wp_send_json_error(['message' => 'Backup ID is required']);
    }
    
    // Check if backup exists and is completed
    global $wpdb;
    $table_name = $wpdb->prefix . 'backupsheep_logs';
    
    $backup = $wpdb->get_row(
        $wpdb->prepare(
            "SELECT * FROM {$table_name} WHERE backup_id = %s",
            $backup_id
        )
    );
    
    if (!$backup || $backup->status !== 'completed') {
        wp_send_json_error(['message' => 'Backup not found or not completed']);
    }
    
    // Start restore process
    $result = backupsheep_restore_backup($backup_id);
    
    if (is_wp_error($result)) {
        wp_send_json_error(['message' => $result->get_error_message()]);
    }
    
    wp_send_json_success(['message' => 'Backup restored successfully']);
}

/**
 * Delete a backup
 */
function backupsheep_ajax_delete_backup() {
    // Check nonce
    if (!check_ajax_referer('backupsheep_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => 'Invalid nonce']);
    }
    
    // Get backup ID
    $backup_id = isset($_POST['backup_id']) ? sanitize_text_field($_POST['backup_id']) : '';
    
    if (empty($backup_id)) {
        wp_send_json_error(['message' => 'Backup ID is required']);
    }
    
    // Delete backup
    $result = backupsheep_delete_backup($backup_id);
    
    if (is_wp_error($result)) {
        wp_send_json_error(['message' => $result->get_error_message()]);
    }
    
    wp_send_json_success(['message' => 'Backup deleted successfully']);
}