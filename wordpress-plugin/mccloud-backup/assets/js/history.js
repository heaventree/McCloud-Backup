/**
 * McCloud Backup History Page JavaScript
 */
(function($) {
    'use strict';
    
    // Check DOM is ready
    $(document).ready(function() {
        // Error details button click handler is in modals.js
        // Restore button click handler is in modals.js
        // Delete button click handler is in modals.js
        
        // Add filter functionality
        initializeFilters();
    });
    
    /**
     * Initialize filters for backup history
     */
    function initializeFilters() {
        // Check if filters exist
        if (!$('#mccloud-backup-filter-type').length) {
            return;
        }
        
        // Filter by backup type
        $('#mccloud-backup-filter-type').on('change', function() {
            applyFilters();
        });
        
        // Filter by backup status
        $('#mccloud-backup-filter-status').on('change', function() {
            applyFilters();
        });
        
        // Filter by date range
        $('#mccloud-backup-filter-from, #mccloud-backup-filter-to').on('change', function() {
            applyFilters();
        });
        
        // Reset filters button
        $('#mccloud-backup-reset-filters').on('click', function(e) {
            e.preventDefault();
            resetFilters();
        });
        
        // Apply filters on page load if URL has filter parameters
        if (window.location.search.indexOf('filter') > -1) {
            loadFiltersFromURL();
        }
    }
    
    /**
     * Apply filters and reload page
     */
    function applyFilters() {
        const type = $('#mccloud-backup-filter-type').val();
        const status = $('#mccloud-backup-filter-status').val();
        const from = $('#mccloud-backup-filter-from').val();
        const to = $('#mccloud-backup-filter-to').val();
        
        // Build URL with filter parameters
        let url = window.location.pathname + '?page=mccloud-backup-history';
        
        if (type) {
            url += '&filter_type=' + encodeURIComponent(type);
        }
        
        if (status) {
            url += '&filter_status=' + encodeURIComponent(status);
        }
        
        if (from) {
            url += '&filter_from=' + encodeURIComponent(from);
        }
        
        if (to) {
            url += '&filter_to=' + encodeURIComponent(to);
        }
        
        // Redirect to filtered URL
        window.location.href = url;
    }
    
    /**
     * Reset filters
     */
    function resetFilters() {
        // Clear filter form fields
        $('#mccloud-backup-filter-type').val('');
        $('#mccloud-backup-filter-status').val('');
        $('#mccloud-backup-filter-from').val('');
        $('#mccloud-backup-filter-to').val('');
        
        // Redirect to base URL without filters
        window.location.href = window.location.pathname + '?page=mccloud-backup-history';
    }
    
    /**
     * Load filters from URL parameters
     */
    function loadFiltersFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Set filter form fields from URL parameters
        if (urlParams.has('filter_type')) {
            $('#mccloud-backup-filter-type').val(urlParams.get('filter_type'));
        }
        
        if (urlParams.has('filter_status')) {
            $('#mccloud-backup-filter-status').val(urlParams.get('filter_status'));
        }
        
        if (urlParams.has('filter_from')) {
            $('#mccloud-backup-filter-from').val(urlParams.get('filter_from'));
        }
        
        if (urlParams.has('filter_to')) {
            $('#mccloud-backup-filter-to').val(urlParams.get('filter_to'));
        }
    }
    
})(jQuery);