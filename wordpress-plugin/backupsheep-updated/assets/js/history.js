/**
 * BackupSheep History Page JavaScript
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
        if (!$('#backupsheep-filter-type').length) {
            return;
        }
        
        // Filter by backup type
        $('#backupsheep-filter-type').on('change', function() {
            applyFilters();
        });
        
        // Filter by backup status
        $('#backupsheep-filter-status').on('change', function() {
            applyFilters();
        });
        
        // Filter by date range
        $('#backupsheep-filter-from, #backupsheep-filter-to').on('change', function() {
            applyFilters();
        });
        
        // Reset filters button
        $('#backupsheep-reset-filters').on('click', function(e) {
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
        const type = $('#backupsheep-filter-type').val();
        const status = $('#backupsheep-filter-status').val();
        const from = $('#backupsheep-filter-from').val();
        const to = $('#backupsheep-filter-to').val();
        
        // Build URL with filter parameters
        let url = window.location.pathname + '?page=backupsheep-history';
        
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
        $('#backupsheep-filter-type').val('');
        $('#backupsheep-filter-status').val('');
        $('#backupsheep-filter-from').val('');
        $('#backupsheep-filter-to').val('');
        
        // Redirect to base URL without filters
        window.location.href = window.location.pathname + '?page=backupsheep-history';
    }
    
    /**
     * Load filters from URL parameters
     */
    function loadFiltersFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Set filter form fields from URL parameters
        if (urlParams.has('filter_type')) {
            $('#backupsheep-filter-type').val(urlParams.get('filter_type'));
        }
        
        if (urlParams.has('filter_status')) {
            $('#backupsheep-filter-status').val(urlParams.get('filter_status'));
        }
        
        if (urlParams.has('filter_from')) {
            $('#backupsheep-filter-from').val(urlParams.get('filter_from'));
        }
        
        if (urlParams.has('filter_to')) {
            $('#backupsheep-filter-to').val(urlParams.get('filter_to'));
        }
    }
    
})(jQuery);