# WordPress Plugin Integration Guide

This document provides comprehensive documentation for the WordPress plugin component of McCloud Backup, detailing its architecture, installation process, and integration with the main application.

## Overview

The McCloud Backup WordPress plugin enables seamless connection between WordPress sites and the central backup management platform. The plugin handles local backup operations, security scanning, and communication with the main application.

## Plugin Architecture

### File Structure

```
backupsheep/
├── assets/
│   ├── css/
│   │   └── admin.css
│   ├── js/
│   │   └── admin.js
│   └── images/
│       └── logo.svg
├── includes/
│   ├── class-api.php
│   ├── class-auth.php
│   ├── class-backup.php
│   ├── class-settings.php
│   └── class-updater.php
├── languages/
│   └── backupsheep.pot
├── backupsheep.php
├── uninstall.php
└── readme.txt
```

### Core Components

1. **Main Plugin File** (`backupsheep.php`)
   - Plugin initialization
   - Hook registration
   - Dependencies check
   - Class autoloading

2. **API Class** (`class-api.php`)
   - Handles REST API endpoints
   - Communicates with main application
   - Authenticates API requests

3. **Auth Class** (`class-auth.php`)
   - Manages API key generation and validation
   - Secures communication channel

4. **Backup Class** (`class-backup.php`)
   - Performs backup operations
   - Handles file and database exports
   - Manages temporary backup storage

5. **Settings Class** (`class-settings.php`)
   - Manages plugin configuration
   - Provides admin interface
   - Stores settings in WordPress options

6. **Updater Class** (`class-updater.php`)
   - Handles plugin updates
   - Checks for new versions
   - Performs migration when needed

## Installation

### Requirements

- WordPress 5.6 or higher
- PHP 7.4 or higher
- MySQL 5.6 or higher / MariaDB 10.1 or higher
- Write permissions for the `wp-content` directory
- Ability to create WordPress cron jobs

### Manual Installation

1. Download the `backupsheep.zip` file
2. Go to WordPress Admin > Plugins > Add New
3. Click "Upload Plugin" and select the downloaded zip file
4. Click "Install Now"
5. After installation completes, click "Activate"

### Automatic Installation (Future)

1. Go to WordPress Admin > Plugins > Add New
2. Search for "McCloud Backup"
3. Click "Install Now" next to the McCloud Backup plugin
4. After installation completes, click "Activate"

## Configuration

### Initial Setup

1. Go to WordPress Admin > McCloud Backup
2. Click "Connect to McCloud Backup"
3. If you already have a McCloud Backup account:
   - Enter your API key from the McCloud dashboard
   - Click "Connect"
4. If you don't have a McCloud Backup account:
   - Click "Create Account" 
   - Complete the registration process
   - The site will automatically connect

### Backup Settings

Configure backup settings through the WordPress admin interface:

1. **Backup Content**
   - Database: Select specific tables to include/exclude
   - Files: Choose directories to include/exclude
   - Media: Options for handling large media files

2. **Security Settings**
   - Encryption: Enable/disable backup encryption
   - Access Control: Restrict which users can access backup features
   - API Key Management: Rotate or revoke API keys

3. **Performance Settings**
   - Resource Limits: Control memory and CPU usage during backups
   - Scheduling: Set preferred backup windows
   - Throttling: Slow down backups to reduce server load

## WordPress REST API Integration

The plugin adds several REST API endpoints to WordPress for communication with the main application:

### API Endpoints

#### Site Information

```
GET /wp-json/mccloud/v1/site
```

Returns basic information about the WordPress site.

Response:
```json
{
  "name": "My WordPress Site",
  "url": "https://mysite.com",
  "wordpress_version": "6.4.2",
  "php_version": "8.1.0",
  "plugins": [
    {
      "name": "Yoast SEO",
      "version": "20.0",
      "active": true
    },
    {
      "name": "WooCommerce",
      "version": "7.5.1",
      "active": true
    }
  ],
  "themes": [
    {
      "name": "Astra",
      "version": "4.0.2",
      "active": true
    }
  ]
}
```

#### Backup Status

```
GET /wp-json/mccloud/v1/backup/status
```

Returns the status of the current or last backup operation.

Response:
```json
{
  "status": "completed",
  "last_backup": {
    "timestamp": "2025-04-15T00:00:00Z",
    "size": 1562000000,
    "type": "full",
    "files_count": 8542,
    "database_size": 52000000
  },
  "next_scheduled": "2025-04-16T00:00:00Z"
}
```

#### Trigger Backup

```
POST /wp-json/mccloud/v1/backup/start
```

Initiates a backup operation.

Request:
```json
{
  "type": "full",
  "include_database": true,
  "include_files": true,
  "exclude_paths": ["wp-content/cache", "wp-content/uploads/large-files"]
}
```

Response:
```json
{
  "backup_id": "bk_20250415120000",
  "status": "in_progress",
  "estimated_completion": "2025-04-15T12:15:00Z"
}
```

#### Authentication

All API endpoints require authentication using one of two methods:

1. **API Key Authentication**
   - Include the API key in the `X-API-Key` header
   - Example: `X-API-Key: sk_XXXXXXXXXXXXXXXXXXXX`

2. **WordPress Cookie Authentication**
   - For admin-initiated requests from the WordPress dashboard
   - User must have the `manage_options` capability

## Security Considerations

### API Key Management

The API key is the primary means of authentication between the WordPress site and the main application:

1. **Generation**: Keys are generated using a cryptographically secure method
2. **Storage**: Keys are stored in the WordPress database using WordPress's encrypted options
3. **Transmission**: Keys are only transmitted over HTTPS
4. **Rotation**: Keys can be rotated manually or automatically on a schedule
5. **Revocation**: Keys can be immediately revoked if compromised

### Secure Communications

1. **HTTPS Only**: All API communications require HTTPS
2. **Request Signing**: Requests include a signature based on request content and timestamp
3. **Nonce Protection**: Each request includes a unique nonce to prevent replay attacks
4. **IP Restrictions**: Optional restriction of API access to specific IP addresses

## Backup Process

### Backup Creation

1. **Initialization**
   - Create temporary directory for backup files
   - Initialize backup metadata

2. **Database Backup**
   - Connect to MySQL server
   - Export selected database tables to SQL file
   - Compress SQL file

3. **File Backup**
   - Scan WordPress directories
   - Filter files based on inclusion/exclusion rules
   - Create ZIP archive of files

4. **Metadata Generation**
   - Collect plugin and theme information
   - Generate backup manifest
   - Create checksum file

5. **Completion**
   - Package all components into final backup archive
   - Clean up temporary files
   - Update backup status

### Backup Transfer

1. **Direct Upload**
   - For smaller sites, the backup file is uploaded directly to the main application
   - Uses chunked uploads to handle connection issues

2. **Storage Provider Integration**
   - For larger sites, the backup file is uploaded directly to the configured storage provider
   - Main application receives only the metadata and location information

## WordPress Hook Integration

The plugin integrates with WordPress using various hooks:

### Actions

- `admin_menu` - Registers admin pages
- `admin_init` - Initializes admin settings
- `admin_enqueue_scripts` - Loads admin assets
- `wp_ajax_mccloud_backup` - Handles AJAX backup requests
- `mccloud_backup_event` - Scheduled event for automated backups

### Filters

- `mccloud_backup_exclude_files` - Filters excluded file paths
- `mccloud_backup_exclude_tables` - Filters excluded database tables
- `mccloud_backup_before_zip` - Runs before files are zipped
- `mccloud_backup_after_zip` - Runs after files are zipped

## Troubleshooting

### Common Issues

1. **Connection Failures**
   - Check API key validity
   - Verify WordPress site URL matches the URL registered in McCloud Backup
   - Ensure HTTPS is properly configured
   - Check for security plugins blocking API requests

2. **Backup Failures**
   - Check server resource limits (memory, execution time)
   - Verify file permissions
   - Check disk space availability
   - Review excluded paths for critical files

3. **Performance Issues**
   - Enable backup throttling
   - Schedule backups during low-traffic periods
   - Exclude unnecessary large files
   - Increase server resources if possible

### Logging

The plugin includes a comprehensive logging system:

1. **Error Logs**
   - Critical errors are logged to WordPress error log
   - Plugin-specific logs in `wp-content/uploads/mccloud-backup/logs`

2. **Activity Logs**
   - All backup activities are logged with timestamps
   - Admin actions are recorded for security auditing

3. **Debug Mode**
   - Enable with `define('MCCLOUD_DEBUG', true)` in `wp-config.php`
   - Provides detailed operation logs for troubleshooting

## Customization

### Configuration Constants

Define these constants in `wp-config.php`:

```php
// Enable debug logging
define('MCCLOUD_DEBUG', true);

// Custom backup directory
define('MCCLOUD_BACKUP_DIR', '/path/to/custom/directory');

// Set memory limit for backup operations
define('MCCLOUD_MEMORY_LIMIT', '512M');

// Set timeout for backup operations (in seconds)
define('MCCLOUD_TIMEOUT', 600);

// Disable automatic backup notifications
define('MCCLOUD_DISABLE_NOTIFICATIONS', true);
```

### Hooks and Filters

Example: Exclude specific files from backups

```php
add_filter('mccloud_backup_exclude_files', function($excluded_paths) {
  // Add custom paths to exclude
  $excluded_paths[] = 'wp-content/uploads/large-videos';
  $excluded_paths[] = 'wp-content/custom-logs';
  
  return $excluded_paths;
});
```

Example: Perform action before backup starts

```php
add_action('mccloud_before_backup', function($backup_type) {
  // Purge cache before backup
  if (function_exists('wp_cache_flush')) {
    wp_cache_flush();
  }
  
  // Log backup start to custom logging system
  my_custom_logger("Starting {$backup_type} backup");
});
```

## WordPress Plugin Roadmap

### Upcoming Features

1. **Advanced Scheduling**
   - More granular control over backup timing
   - Event-based triggers (e.g., before updates)

2. **Selective Restoration**
   - Restore specific files or database tables
   - Preview content before restoration

3. **Migration Tools**
   - Site migration between hosts
   - Staging site creation

4. **Security Enhancements**
   - Malware scanning integration
   - File integrity monitoring
   - Login security hardening

5. **Performance Optimizations**
   - Improved handling of very large sites
   - Better resource management
   - Incremental backup support

## Compatibility

### Tested Plugins

The McCloud Backup plugin has been tested with the following popular plugins:

- WooCommerce
- Yoast SEO
- Elementor
- Contact Form 7
- Wordfence Security
- WP Super Cache
- W3 Total Cache
- Advanced Custom Fields
- WP Rocket

### Known Compatibility Issues

- **Backup Solutions**: Other backup plugins may conflict; recommended to disable before using McCloud Backup
- **Security Plugins**: Some security plugins may block API requests; whitelist McCloud API endpoints
- **Caching Plugins**: May need configuration to ensure dashboard changes appear immediately

## Support and Resources

- Plugin Documentation: [docs.mccloud-backup.com/wordpress-plugin](https://docs.mccloud-backup.com/wordpress-plugin)
- Support Forum: [support.mccloud-backup.com](https://support.mccloud-backup.com)
- Knowledge Base: [help.mccloud-backup.com](https://help.mccloud-backup.com)
- GitHub Repository: [github.com/mccloud-backup/wordpress-plugin](https://github.com/mccloud-backup/wordpress-plugin)

---

*Last updated: April 15, 2025*