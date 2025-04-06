/**
 * BackupSheep Admin JavaScript
 */
(function($) {
    'use strict';
    
    // Check DOM is ready
    $(document).ready(function() {
        // Test API connection if API key is set
        if (backupsheepData.api_key) {
            testApiConnection();
        }
        
        // Test connection button
        $('#backupsheep-test-connection').on('click', function(e) {
            e.preventDefault();
            testApiConnection();
        });
        
        // Start backup buttons
        $('.start-backup').on('click', function() {
            var backupType = $(this).data('type');
            startBackup(backupType);
        });
    });
    
    /**
     * Test API connection
     */
    function testApiConnection() {
        var $statusEl = $('#backupsheep-api-status');
        $statusEl.html('<span class="backupsheep-status-checking">' + 'Testing connection...' + '</span>');
        
        $.ajax({
            url: backupsheepData.ajax_url,
            type: 'POST',
            data: {
                action: 'backupsheep_test_connection',
                nonce: backupsheepData.nonce
            },
            success: function(response) {
                if (response.success) {
                    $statusEl.html('<span class="backupsheep-status-active">' + 'Connected' + '</span>');
                } else {
                    $statusEl.html('<span class="backupsheep-status-error">' + (response.data.message || 'Connection failed') + '</span>');
                }
            },
            error: function() {
                $statusEl.html('<span class="backupsheep-status-error">' + 'Connection failed' + '</span>');
            }
        });
    }
    
    /**
     * Start a backup
     * 
     * @param {string} type - Backup type (full, database, files)
     */
    function startBackup(type) {
        // Show progress container
        $('#backupsheep-backup-progress').show();
        
        // Disable backup buttons
        $('.start-backup').prop('disabled', true);
        
        // Set initial progress
        updateProgress(0, 'Starting backup...');
        
        // Make AJAX request to start backup
        $.ajax({
            url: backupsheepData.ajax_url,
            type: 'POST',
            data: {
                action: 'backupsheep_start_backup',
                nonce: backupsheepData.nonce,
                type: type
            },
            success: function(response) {
                if (response.success) {
                    // Update progress
                    updateProgress(10, 'Backup started');
                    
                    // Start polling for backup status
                    var backupId = response.data.backup_id;
                    pollBackupStatus(backupId);
                } else {
                    // Show error
                    updateProgress(0, 'Error: ' + (response.data.message || 'Failed to start backup'));
                    
                    // Re-enable backup buttons
                    $('.start-backup').prop('disabled', false);
                }
            },
            error: function() {
                // Show error
                updateProgress(0, 'Error: Failed to start backup');
                
                // Re-enable backup buttons
                $('.start-backup').prop('disabled', false);
            }
        });
    }
    
    /**
     * Poll backup status
     * 
     * @param {string} backupId - Backup ID
     * @param {number} attempt - Current polling attempt
     */
    function pollBackupStatus(backupId, attempt) {
        attempt = attempt || 1;
        
        // Make AJAX request to get backup status
        $.ajax({
            url: backupsheepData.ajax_url,
            type: 'POST',
            data: {
                action: 'backupsheep_get_backup_status',
                nonce: backupsheepData.nonce,
                backup_id: backupId
            },
            success: function(response) {
                if (response.success) {
                    var status = response.data.status;
                    
                    // Calculate progress based on status
                    var progress = 10; // Start at 10%
                    var message = 'Backup in progress...';
                    
                    if (status.status === 'completed') {
                        progress = 100;
                        message = 'Backup completed successfully';
                        
                        // Reload page after a short delay
                        setTimeout(function() {
                            location.reload();
                        }, 2000);
                    } else if (status.status === 'error') {
                        progress = 100;
                        message = 'Backup failed: ' + (status.error_message || 'Unknown error');
                        
                        // Re-enable backup buttons
                        $('.start-backup').prop('disabled', false);
                    } else {
                        // Increment progress based on attempt (max 90%)
                        progress = Math.min(10 + (attempt * 5), 90);
                        
                        // Continue polling
                        setTimeout(function() {
                            pollBackupStatus(backupId, attempt + 1);
                        }, 2000);
                    }
                    
                    // Update progress
                    updateProgress(progress, message);
                } else {
                    // Error getting status
                    updateProgress(0, 'Error checking backup status');
                    
                    // Re-enable backup buttons
                    $('.start-backup').prop('disabled', false);
                }
            },
            error: function() {
                // Continue polling despite error (might be temporary)
                if (attempt < 10) {
                    setTimeout(function() {
                        pollBackupStatus(backupId, attempt + 1);
                    }, 3000);
                } else {
                    // Give up after 10 attempts
                    updateProgress(0, 'Error checking backup status');
                    
                    // Re-enable backup buttons
                    $('.start-backup').prop('disabled', false);
                }
            }
        });
    }
    
    /**
     * Update progress bar and status message
     * 
     * @param {number} percent - Progress percentage
     * @param {string} message - Status message
     */
    function updateProgress(percent, message) {
        $('.backupsheep-progress-bar-inner').css('width', percent + '%');
        $('#backupsheep-backup-status').text(message);
    }
    
})(jQuery);