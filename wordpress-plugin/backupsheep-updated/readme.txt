=== BackupSheep Advanced Backup Solution ===
Contributors: backupsheep
Tags: backup, restore, backupsheep, database backup, wordpress backup, cloud backup, google drive, dropbox, onedrive, s3, ftp, backups, incremental backup
Stable tag: 2.0.0
Tested up to: 6.4
Requires at least: 5.6
Requires PHP: 7.4
Author URI: https://backupsheep.com
License: GPLv3 or later
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Comprehensive WordPress backup solution that automates backups with smart scheduling and secure cloud storage integration including Google Drive, Dropbox, OneDrive, Amazon S3, and more.

== Description ==

**BackupSheep** is a powerful WordPress backup plugin designed to make website backups easy, reliable, and secure. 

Our plugin integrates with existing backup plugins such as UpdraftPlus (free/paid) and enhances them with advanced features such as incremental backups, smart scheduling, and the ability to push your backups to multiple remote storage accounts.

= Key Features =

* **Easy Integration**: Seamlessly integrates with your existing BackupSheep account
* **Multiple Storage Providers**: Push backups to Google Drive, Dropbox, OneDrive, Amazon S3, FTP, or local storage
* **Incremental Backups**: Save time and storage by only backing up what's changed
* **Smart Scheduling**: Configure backup frequency based on your needs
* **Central Dashboard**: Manage backups for all your sites from one central location
* **Secure Storage**: Your backups are stored securely with encryption
* **One-Click Restore**: Easily restore your website from any backup point
* **Complete Control**: Choose which files and databases to back up

= How It Works =

1. Install the plugin and connect it to your BackupSheep account
2. Configure your backup settings (frequency, storage providers, etc.)
3. BackupSheep will automatically run backups according to your schedule
4. Access and manage your backups from the BackupSheep dashboard

= Premium Features =

Upgrade to a premium plan to unlock:

* **Unlimited Sites**: Add as many sites as you need
* **Multiple Storage Providers**: Use multiple storage providers simultaneously
* **Advanced Scheduling**: More granular control over backup timing
* **Longer Retention**: Store backups for longer periods
* **Priority Support**: Get help when you need it

== Installation ==

1. Upload the plugin files to the `/wp-content/plugins/backupsheep` directory, or install the plugin through the WordPress plugins screen directly.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Go to the BackupSheep settings page to configure your API key and backup settings.
4. Ensure that UpdraftPlus plugin is installed and activated.

== Frequently Asked Questions ==

= Do I need a BackupSheep account? =

Yes, you need to create a BackupSheep account to use this plugin. You can sign up at [https://backupsheep.com](https://backupsheep.com).

= What is an incremental backup? =

An incremental backup only backs up files that have changed since the last full backup. This saves time and storage space.

= How secure are my backups? =

We take security seriously. All backups are encrypted during transfer and storage.

= Can I schedule automatic backups? =

Yes, you can schedule backups to run hourly, twice daily, daily, or weekly.

= What storage options do you support? =

We support Google Drive, Dropbox, OneDrive, Amazon S3, FTP, and local storage.

= Can I restore my website from a backup? =

Yes, you can restore your website from any backup point with just a few clicks.

== Screenshots ==

1. Dashboard Overview
2. Backup Settings
3. Storage Providers
4. Backup History
5. Central Dashboard

== Changelog ==

= 2.0.0 - 2024-04-06 =
* Major Update: Complete plugin redesign with improved UI and functionality
* New Feature: Incremental backups support
* New Feature: Enhanced scheduling options
* New Feature: Improved error handling and reporting
* New Feature: Better integration with BackupSheep dashboard
* New Feature: Support for multiple storage providers
* UI Improvement: Responsive design for mobile and tablet
* Compatibility: Tested with WordPress 6.4

= 1.8 - 2022-12-07 =
* BUG: Added random time to URL param to avoid hitting cache when downloading files.

= 1.7 - 2022-11-23 =
* BUG: Added 'permission_callback' => '__return_true' to register_rest_route to avoid potential errors on some systems

= 1.6 - 2022-10-22 =
* FEATURE: Initial Release

== Upgrade Notice ==
* 2.0.0: Major update with new features including incremental backups, improved UI, and enhanced scheduling options.
* 1.8: Various tweaks and fixes. A recommended update for all.
* 1.7: Various tweaks and fixes. A recommended update for all.