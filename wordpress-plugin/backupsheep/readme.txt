=== BackupSheep WordPress Backup Plugin===
Contributors: backupsheep
Tags: backup, restore, backupsheep, sql backup, database backup, wordpress backup, cloud backup, s3, dropbox, google drive, onedrive, ftp, backups
Stable tag: 1.8
Tested up to: 6.1
Requires at least: 5.0
Requires PHP: 7.4
Author URI: https://backupsheep.com
License: GPLv3 or later
License URI: https://www.gnu.org/licenses/gpl-3.0.html

BackupSheep plugin integrates with existing backup plugins such as UpdraftPlus(free/paid) and automates files and database backups using smart scheduling and the ability to push your backups to remote storage accounts.

== Frequently Asked Questions ==

= What exactly does BackupSheep do? =

Our free BackupSheep plugin integrates with existing backup plugins such as UpdraftPlus(free/paid) and your BackupSheep account: it performs full, manual or scheduled backups of all your WordPress files, databases, plugins and themes.

== Screenshots ==

1. Configure WordPress Integration

2. Create WordPress Node

3. Schedule Automatic Backups

== Changelog ==

= 1.8 - 07/Dec/2022 =

* BUG: Added random time to URL param to avoid hitting cache when downloading files.

= 1.7 - 23/Nov/2022 =

* BUG: Added 'permission_callback' => '__return_true' to register_rest_route to avoid potential errors on some systems

= 1.6 - 22/Oct/2022 =

* FEATURE: Initial Release

== Upgrade Notice ==
* 1.7: Various tweaks and fixes. A recommended update for all.
* 1.6: Various tweaks and fixes. A recommended update for all.
