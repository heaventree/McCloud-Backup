/**
 * BackupSheep Modals JavaScript
 */
(function($) {
    'use strict';
    
    // Cache DOM elements
    let $restoreModal, $deleteModal, $errorModal;
    let currentBackupId = null;
    
    // Check DOM is ready
    $(document).ready(function() {
        // Cache modal elements
        $restoreModal = $('#backupsheep-restore-modal');
        $deleteModal = $('#backupsheep-delete-modal');
        $errorModal = $('#backupsheep-error-modal');
        
        // Restore button click
        $('.backupsheep-restore-btn').on('click', function(e) {
            e.preventDefault();
            currentBackupId = $(this).data('backup-id');
            openModal($restoreModal);
        });
        
        // Delete button click
        $('.backupsheep-delete-backup-btn').on('click', function(e) {
            e.preventDefault();
            currentBackupId = $(this).data('backup-id');
            openModal($deleteModal);
        });
        
        // Error details button click
        $('.backupsheep-error-details-btn').on('click', function(e) {
            e.preventDefault();
            const backupId = $(this).data('backup-id');
            getErrorDetails(backupId);
        });
        
        // Close modal buttons and links
        $('.backupsheep-modal-close, #backupsheep-restore-cancel, #backupsheep-delete-cancel, #backupsheep-error-close').on('click', function() {
            closeAllModals();
        });
        
        // Close modal on background click
        $('.backupsheep-modal').on('click', function(e) {
            if (e.target === this) {
                closeAllModals();
            }
        });
        
        // Confirm restore button
        $('#backupsheep-restore-confirm').on('click', function() {
            restoreBackup(currentBackupId);
        });
        
        // Confirm delete button
        $('#backupsheep-delete-confirm').on('click', function() {
            deleteBackup(currentBackupId);
        });
        
        // Close on ESC key
        $(document).on('keydown', function(e) {
            if (e.keyCode === 27) { // ESC key
                closeAllModals();
            }
        });
    });
    
    /**
     * Open a modal
     * 
     * @param {jQuery} $modal - The modal to open
     */
    function openModal($modal) {
        closeAllModals();
        $modal.show();
        $('body').addClass('modal-open');
    }
    
    /**
     * Close all modals
     */
    function closeAllModals() {
        $('.backupsheep-modal').hide();
        $('body').removeClass('modal-open');
    }
    
    /**
     * Get error details for a backup
     * 
     * @param {string} backupId - The backup ID
     */
    function getErrorDetails(backupId) {
        // Show loading in error content
        $('#backupsheep-error-content').html('<p>Loading error details...</p>');
        openModal($errorModal);
        
        // Make AJAX request to get error details
        $.ajax({
            url: backupsheepData.ajax_url,
            type: 'POST',
            data: {
                action: 'backupsheep_get_error_details',
                nonce: backupsheepData.nonce,
                backup_id: backupId
            },
            success: function(response) {
                if (response.success) {
                    $('#backupsheep-error-content').html(response.data.error || 'No error details available.');
                } else {
                    $('#backupsheep-error-content').html('Failed to retrieve error details.');
                }
            },
            error: function() {
                $('#backupsheep-error-content').html('An error occurred while retrieving the details.');
            }
        });
    }
    
    /**
     * Restore a backup
     * 
     * @param {string} backupId - The backup ID
     */
    function restoreBackup(backupId) {
        // Close modal and show notice
        closeAllModals();
        showAdminNotice('info', 'Restoring backup... This may take a while. Please do not close this page.');
        
        // Make AJAX request to restore backup
        $.ajax({
            url: backupsheepData.ajax_url,
            type: 'POST',
            data: {
                action: 'backupsheep_restore_backup',
                nonce: backupsheepData.nonce,
                backup_id: backupId
            },
            success: function(response) {
                if (response.success) {
                    showAdminNotice('success', 'Backup restored successfully! Reloading page...');
                    setTimeout(function() {
                        location.reload();
                    }, 2000);
                } else {
                    showAdminNotice('error', 'Failed to restore backup: ' + (response.data.message || 'Unknown error'));
                }
            },
            error: function() {
                showAdminNotice('error', 'An error occurred while restoring the backup.');
            }
        });
    }
    
    /**
     * Delete a backup
     * 
     * @param {string} backupId - The backup ID
     */
    function deleteBackup(backupId) {
        // Close modal and show notice
        closeAllModals();
        showAdminNotice('info', 'Deleting backup...');
        
        // Make AJAX request to delete backup
        $.ajax({
            url: backupsheepData.ajax_url,
            type: 'POST',
            data: {
                action: 'backupsheep_delete_backup',
                nonce: backupsheepData.nonce,
                backup_id: backupId
            },
            success: function(response) {
                if (response.success) {
                    showAdminNotice('success', 'Backup deleted successfully! Reloading page...');
                    setTimeout(function() {
                        location.reload();
                    }, 1500);
                } else {
                    showAdminNotice('error', 'Failed to delete backup: ' + (response.data.message || 'Unknown error'));
                }
            },
            error: function() {
                showAdminNotice('error', 'An error occurred while deleting the backup.');
            }
        });
    }
    
    /**
     * Show admin notice
     * 
     * @param {string} type - Notice type (success, error, info, warning)
     * @param {string} message - Notice message
     */
    function showAdminNotice(type, message) {
        // Remove existing notices
        $('.backupsheep-admin-notice').remove();
        
        // Create notice
        const $notice = $('<div class="notice backupsheep-admin-notice notice-' + type + ' is-dismissible"><p>' + message + '</p></div>');
        
        // Add notice to the top of the page
        $('.wrap:first').prepend($notice);
        
        // Setup dismiss button
        if (wp && wp.updates && wp.updates.addAdminNotice) {
            wp.updates.addAdminNotice($notice);
        } else {
            // Fallback for WP < 4.6
            $notice.append('<button type="button" class="notice-dismiss"><span class="screen-reader-text">Dismiss this notice.</span></button>');
            $notice.find('.notice-dismiss').on('click', function() {
                $(this).closest('.notice').remove();
            });
        }
    }
    
})(jQuery);