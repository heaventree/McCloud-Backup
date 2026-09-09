/**
 * McCloud Backup Modals JavaScript
 */
(function($) {
    'use strict';
    
    // Cache DOM elements
    let $restoreModal, $deleteModal, $errorModal;
    let currentBackupId = null;
    
    // Check DOM is ready
    $(document).ready(function() {
        // Cache modal elements
        $restoreModal = $('#mccloud-backup-restore-modal');
        $deleteModal = $('#mccloud-backup-delete-modal');
        $errorModal = $('#mccloud-backup-error-modal');
        
        // Restore button click
        $('.mccloud-backup-restore-btn').on('click', function(e) {
            e.preventDefault();
            currentBackupId = $(this).data('backup-id');
            openModal($restoreModal);
        });
        
        // Delete button click
        $('.mccloud-backup-delete-backup-btn').on('click', function(e) {
            e.preventDefault();
            currentBackupId = $(this).data('backup-id');
            openModal($deleteModal);
        });
        
        // Error details button click
        $('.mccloud-backup-error-details-btn').on('click', function(e) {
            e.preventDefault();
            const backupId = $(this).data('backup-id');
            getErrorDetails(backupId);
        });
        
        // Close modal buttons and links
        $('.mccloud-backup-modal-close, #mccloud-backup-restore-cancel, #mccloud-backup-delete-cancel, #mccloud-backup-error-close').on('click', function() {
            closeAllModals();
        });
        
        // Close modal on background click
        $('.mccloud-backup-modal').on('click', function(e) {
            if (e.target === this) {
                closeAllModals();
            }
        });
        
        // Confirm restore button
        $('#mccloud-backup-restore-confirm').on('click', function() {
            restoreBackup(currentBackupId);
        });
        
        // Confirm delete button
        $('#mccloud-backup-delete-confirm').on('click', function() {
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
        $('.mccloud-backup-modal').hide();
        $('body').removeClass('modal-open');
    }
    
    /**
     * Get error details for a backup
     * 
     * @param {string} backupId - The backup ID
     */
    function getErrorDetails(backupId) {
        // Show loading in error content
        $('#mccloud-backup-error-content').html('<p>Loading error details...</p>');
        openModal($errorModal);
        
        // Make AJAX request to get error details
        $.ajax({
            url: mccloudBackupData.ajax_url,
            type: 'POST',
            data: {
                action: 'mccloud_backup_get_error_details',
                nonce: mccloudBackupData.nonce,
                backup_id: backupId
            },
            success: function(response) {
                if (response.success) {
                    $('#mccloud-backup-error-content').html(response.data.error || 'No error details available.');
                } else {
                    $('#mccloud-backup-error-content').html('Failed to retrieve error details.');
                }
            },
            error: function() {
                $('#mccloud-backup-error-content').html('An error occurred while retrieving the details.');
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
            url: mccloudBackupData.ajax_url,
            type: 'POST',
            data: {
                action: 'mccloud_backup_restore_backup',
                nonce: mccloudBackupData.nonce,
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
            url: mccloudBackupData.ajax_url,
            type: 'POST',
            data: {
                action: 'mccloud_backup_delete_backup',
                nonce: mccloudBackupData.nonce,
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
        $('.mccloud-backup-admin-notice').remove();
        
        // Create notice
        const $notice = $('<div class="notice mccloud-backup-admin-notice notice-' + type + ' is-dismissible"><p>' + message + '</p></div>');
        
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