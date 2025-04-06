<?php
/**
 * BackupSheep Backup Class
 *
 * @package BackupSheep
 */

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

/**
 * Backup class
 */
class BackupSheep_Backup {
    /**
     * Constructor
     */
    public function __construct() {
        // Hook into UpdraftPlus completed backup
        add_action('updraftplus_backup_complete', [$this, 'backup_complete'], 10, 2);
        
        // Hook into UpdraftPlus error
        add_action('updraftplus_backup_error', [$this, 'backup_error'], 10, 2);
    }

    /**
     * Start a backup
     *
     * @param string $backup_id
     * @param string $type
     * @return true|WP_Error
     */
    public function start($backup_id, $type = 'full') {
        global $wpdb;
        
        // Check if UpdraftPlus is active
        if (!backupsheep_is_updraftplus_active()) {
            return new WP_Error('updraftplus_missing', __('UpdraftPlus plugin is required but not active', 'backupsheep'));
        }
        
        // Get the global UpdraftPlus object
        global $updraftplus;
        
        if (!$updraftplus) {
            return new WP_Error('updraftplus_not_loaded', __('UpdraftPlus plugin is not loaded', 'backupsheep'));
        }
        
        // Set the backup type
        $backup_options = [
            'nocloud' => 1,            // Don't send to cloud
            'use_timestamp' => 0,       // Don't use timestamp-based naming
            'use_nonce' => $backup_id,  // Use our custom ID
        ];
        
        // Log the backup start in database
        $table_name = $wpdb->prefix . 'backupsheep_logs';
        $wpdb->insert(
            $table_name,
            [
                'backup_id' => $backup_id,
                'type' => $type,
                'status' => 'started',
                'start_time' => gmdate('Y-m-d H:i:s'),
            ]
        );
        
        backupsheep_log("Starting {$type} backup with ID: {$backup_id}");
        
        try {
            switch ($type) {
                case 'database':
                    // Database only backup
                    do_action('updraft_backupnow_backup_database', $backup_options);
                    break;
                    
                case 'files':
                    // Files only backup
                    do_action('updraft_backupnow_backup', $backup_options);
                    break;
                    
                case 'full':
                default:
                    // Full backup (database + files)
                    do_action('updraft_backupnow_backup_all', $backup_options);
                    break;
            }
            
            return true;
        } catch (Exception $e) {
            backupsheep_log("Error starting backup: " . $e->getMessage(), 'error');
            
            // Update backup status to error
            $wpdb->update(
                $table_name,
                [
                    'status' => 'error',
                    'end_time' => gmdate('Y-m-d H:i:s'),
                    'error_message' => $e->getMessage(),
                ],
                ['backup_id' => $backup_id]
            );
            
            return new WP_Error('backup_failed', $e->getMessage());
        }
    }

    /**
     * Get backup status
     *
     * @param string $backup_id
     * @return array
     */
    public function get_status($backup_id) {
        global $wpdb, $updraftplus;
        
        // Get status from database
        $table_name = $wpdb->prefix . 'backupsheep_logs';
        $backup = $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM {$table_name} WHERE backup_id = %s", $backup_id)
        );
        
        if (!$backup) {
            return [
                'status' => 'unknown',
                'message' => __('Backup not found', 'backupsheep'),
            ];
        }
        
        // Get additional info from UpdraftPlus
        $status = false;
        if ($updraftplus) {
            $status = $updraftplus->found_backup_complete_in_logfile($backup_id);
            $log_file = str_replace($updraftplus->backups_dir_location() . '/', '', $updraftplus->get_logfile_name($backup_id));
        }
        
        return [
            'id' => $backup_id,
            'status' => $backup->status,
            'type' => $backup->type,
            'start_time' => $backup->start_time,
            'end_time' => $backup->end_time,
            'size' => $backup->size,
            'file_count' => $backup->file_count,
            'error_message' => $backup->error_message,
            'updraft_status' => $status,
            'updraft_log' => $log_file ?? null,
        ];
    }

    /**
     * Get backup files
     *
     * @param string $backup_id
     * @return array
     */
    public function get_files($backup_id) {
        global $updraftplus;
        
        if (!$updraftplus) {
            return [];
        }
        
        // Get all backup files for this backup ID
        $backup_files = glob($updraftplus->backups_dir_location() . '/*_' . $backup_id . '-*');
        
        // Remove path prefix for clean output
        foreach ($backup_files as &$file) {
            $file = str_replace($updraftplus->backups_dir_location() . '/', '', $file);
        }
        
        return $backup_files;
    }

    /**
     * Download backup file
     *
     * @param string $file
     * @return void
     */
    public function download_file($file) {
        global $updraftplus;
        
        if (!$updraftplus) {
            return;
        }
        
        // Get the full path to the backup file
        $file_path = $updraftplus->backups_dir_location() . '/' . $file;
        
        // Check if file exists
        if (!file_exists($file_path)) {
            // Try in backupsheep directory
            $upload_dir = wp_upload_dir();
            $bs_file_path = $upload_dir['basedir'] . '/backupsheep/' . $file;
            
            if (!file_exists($bs_file_path)) {
                return;
            }
            
            $file_path = $bs_file_path;
        }
        
        // Create backupsheep directory if needed
        $upload_dir = wp_upload_dir();
        $bs_dir = $upload_dir['basedir'] . '/backupsheep';
        wp_mkdir_p($bs_dir);
        
        // Sometimes DB files need special handling
        if (backupsheep_ends_with($file, '-db.gz')) {
            $zip_file = $file . '.zip';
            $zip_path = $bs_dir . '/' . $zip_file;
            
            // Copy file
            copy($file_path, $bs_dir . '/' . $file);
            
            // Download the file
            header('Content-Description: File Transfer');
            header('Content-Type: application/octet-stream');
            header('Content-Disposition: attachment; filename=' . basename($file));
            header('Expires: 0');
            header('Cache-Control: must-revalidate');
            header('Pragma: public');
            header('Content-Length: ' . filesize($file_path));
            readfile($file_path);
            exit;
        }
        
        // Move file to backupsheep directory
        $bs_file_path = $bs_dir . '/' . $file;
        copy($file_path, $bs_file_path);
        
        // Redirect to file for download
        $random_time = time();
        header('Location: ' . $upload_dir['baseurl'] . '/backupsheep/' . $file . '?t=' . $random_time);
        exit;
    }

    /**
     * Delete backup file
     *
     * @param string $file
     * @param string $backup_id
     * @return true|WP_Error
     */
    public function delete_file($file, $backup_id) {
        // Try in backupsheep directory
        $upload_dir = wp_upload_dir();
        $bs_file_path = $upload_dir['basedir'] . '/backupsheep/' . $file;
        
        if (file_exists($bs_file_path)) {
            unlink($bs_file_path);
            backupsheep_log("Deleted temporary file: {$file}");
            return true;
        }
        
        return new WP_Error('file_not_found', __('File not found', 'backupsheep'));
    }

    /**
     * Handle backup complete
     *
     * @param array $backup_history
     * @param string $backup_id
     * @return void
     */
    public function backup_complete($backup_history, $backup_id) {
        global $wpdb;
        
        backupsheep_log("Backup completed for ID: {$backup_id}");
        
        // Calculate size and file count
        $size = 0;
        $file_count = 0;
        
        if (isset($backup_history[$backup_id])) {
            foreach ($backup_history[$backup_id] as $entity => $info) {
                if (is_array($info) && isset($info['size'])) {
                    $size += $info['size'];
                    $file_count++;
                }
            }
        }
        
        // Handle encryption if enabled
        $options = get_option('backupsheep_options', []);
        $encrypt_backup = false;
        $encryption_error = '';
        
        if (!empty($options['enable_encryption']) && !empty($options['encryption_key'])) {
            backupsheep_log("Encryption enabled for backup ID: {$backup_id}");
            
            // Get backup files
            global $updraftplus;
            $backup_dir = $updraftplus->backups_dir_location();
            $backup_files = [];
            
            if (isset($backup_history[$backup_id])) {
                foreach ($backup_history[$backup_id] as $entity => $info) {
                    if (is_array($info) && isset($info['size'])) {
                        if (is_string($entity) && !is_numeric($entity)) {
                            // For normal backups, entity is db/plugins/themes etc.
                            foreach ($info as $key => $value) {
                                if ('size' != $key && 'timestamp' != $key) {
                                    $backup_files[] = $backup_dir . '/' . $value;
                                }
                            }
                        } else {
                            // Legacy format where entity is 0, 1, etc.
                            $backup_files[] = $backup_dir . '/' . $info['path'];
                        }
                    }
                }
            }
            
            // Encrypt each backup file
            if (!empty($backup_files)) {
                try {
                    $encryption_key = $options['encryption_key'];
                    $encryption_method = !empty($options['encryption_method']) ? $options['encryption_method'] : 'aes-256-cbc';
                    $encrypt_backup = true;
                    
                    foreach ($backup_files as $file) {
                        if (file_exists($file)) {
                            backupsheep_log("Encrypting backup file: " . basename($file));
                            
                            // Encrypt the file
                            $result = backupsheep_encrypt_backup($file, $encryption_key);
                            
                            if (is_wp_error($result)) {
                                throw new Exception($result->get_error_message());
                            }
                            
                            backupsheep_log("Encrypted backup file: " . basename($result));
                        }
                    }
                } catch (Exception $e) {
                    $encrypt_backup = false;
                    $encryption_error = $e->getMessage();
                    backupsheep_log("Encryption error: " . $encryption_error, 'error');
                }
            } else {
                backupsheep_log("No backup files found to encrypt", 'warning');
            }
        }
        
        // Update backup status in database
        $table_name = $wpdb->prefix . 'backupsheep_logs';
        $update_data = [
            'status' => 'completed',
            'end_time' => gmdate('Y-m-d H:i:s'),
            'size' => $size,
            'file_count' => $file_count,
        ];
        
        // Add encryption info if applicable
        if ($encrypt_backup) {
            $update_data['encrypted'] = 1;
            $update_data['encryption_method'] = $options['encryption_method'];
        } elseif (!empty($encryption_error)) {
            $update_data['error_message'] = 'Backup completed but encryption failed: ' . $encryption_error;
        }
        
        $wpdb->update(
            $table_name,
            $update_data,
            ['backup_id' => $backup_id]
        );
        
        // Notify BackupSheep API about completed backup
        $this->notify_backup_complete($backup_id, $size, $file_count);
    }

    /**
     * Handle backup error
     *
     * @param string $error_message
     * @param string $backup_id
     * @return void
     */
    public function backup_error($error_message, $backup_id) {
        global $wpdb;
        
        backupsheep_log("Backup error for ID {$backup_id}: {$error_message}", 'error');
        
        // Update backup status in database
        $table_name = $wpdb->prefix . 'backupsheep_logs';
        $wpdb->update(
            $table_name,
            [
                'status' => 'error',
                'end_time' => gmdate('Y-m-d H:i:s'),
                'error_message' => $error_message,
            ],
            ['backup_id' => $backup_id]
        );
        
        // Notify BackupSheep API about backup error
        $this->notify_backup_error($backup_id, $error_message);
    }

    /**
     * Notify BackupSheep API about completed backup
     *
     * @param string $backup_id
     * @param int $size
     * @param int $file_count
     * @return void
     */
    private function notify_backup_complete($backup_id, $size, $file_count) {
        $options = get_option('backupsheep_options', []);
        
        // Only notify if API key is set
        if (empty($options['api_key'])) {
            return;
        }
        
        // Get backup files
        $files = $this->get_files($backup_id);
        
        // Prepare data for API
        $data = [
            'site_id' => $options['site_id'],
            'backup_id' => $backup_id,
            'status' => 'completed',
            'size' => $size,
            'file_count' => $file_count,
            'files' => $files,
            'completed_at' => gmdate('Y-m-d H:i:s'),
        ];
        
        // Send to API
        $api = new BackupSheep_API();
        $api->send('backup/complete', $data);
    }

    /**
     * Notify BackupSheep API about backup error
     *
     * @param string $backup_id
     * @param string $error_message
     * @return void
     */
    private function notify_backup_error($backup_id, $error_message) {
        $options = get_option('backupsheep_options', []);
        
        // Only notify if API key is set
        if (empty($options['api_key'])) {
            return;
        }
        
        // Prepare data for API
        $data = [
            'site_id' => $options['site_id'],
            'backup_id' => $backup_id,
            'status' => 'error',
            'error_message' => $error_message,
            'failed_at' => gmdate('Y-m-d H:i:s'),
        ];
        
        // Send to API
        $api = new BackupSheep_API();
        $api->send('backup/error', $data);
    }
}