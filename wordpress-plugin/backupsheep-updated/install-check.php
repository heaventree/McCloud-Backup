<?php
/**
 * BackupSheep Installation Compatibility Checker
 *
 * @package BackupSheep
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    die('Direct access not allowed.');
}

/**
 * Check if the server meets the requirements for BackupSheep
 *
 * @return array Array of requirements with pass/fail status
 */
function backupsheep_check_requirements() {
    $requirements = array();
    
    // PHP Version
    $php_version = phpversion();
    $php_min_version = '7.4';
    $php_check = version_compare($php_version, $php_min_version, '>=');
    $requirements['php_version'] = array(
        'name' => sprintf('PHP %s+', $php_min_version),
        'current' => $php_version,
        'pass' => $php_check,
        'required' => true,
        'message' => $php_check ? 'OK' : sprintf('Your PHP version (%s) is too old. BackupSheep requires PHP %s or higher.', $php_version, $php_min_version)
    );
    
    // MySQL/MariaDB Version
    global $wpdb;
    $mysql_version = $wpdb->db_version();
    $mysql_min_version = '5.6';
    $mysql_check = version_compare($mysql_version, $mysql_min_version, '>=');
    $requirements['mysql_version'] = array(
        'name' => sprintf('MySQL/MariaDB %s+', $mysql_min_version),
        'current' => $mysql_version,
        'pass' => $mysql_check,
        'required' => true,
        'message' => $mysql_check ? 'OK' : sprintf('Your database version (%s) is too old. BackupSheep requires MySQL %s or higher.', $mysql_version, $mysql_min_version)
    );
    
    // WordPress Version
    $wp_version = get_bloginfo('version');
    $wp_min_version = '5.6';
    $wp_check = version_compare($wp_version, $wp_min_version, '>=');
    $requirements['wp_version'] = array(
        'name' => sprintf('WordPress %s+', $wp_min_version),
        'current' => $wp_version,
        'pass' => $wp_check,
        'required' => true,
        'message' => $wp_check ? 'OK' : sprintf('Your WordPress version (%s) is too old. BackupSheep requires WordPress %s or higher.', $wp_version, $wp_min_version)
    );
    
    // PHP Extensions
    $required_extensions = array(
        'curl' => 'Required for API communication',
        'json' => 'Required for API communication',
        'zip' => 'Required for creating backup archives',
        'openssl' => 'Required for secure connections'
    );
    
    foreach ($required_extensions as $ext => $desc) {
        $loaded = extension_loaded($ext);
        $requirements['ext_' . $ext] = array(
            'name' => 'PHP Extension: ' . $ext,
            'current' => $loaded ? 'Loaded' : 'Not loaded',
            'pass' => $loaded,
            'required' => true,
            'message' => $loaded ? 'OK' : sprintf('PHP extension "%s" is not loaded. %s', $ext, $desc)
        );
    }
    
    // WordPress File Permissions
    $wp_upload_dir = wp_upload_dir();
    $upload_base_dir = $wp_upload_dir['basedir'];
    $is_writable = wp_is_writable($upload_base_dir);
    $requirements['upload_permissions'] = array(
        'name' => 'WordPress Uploads Directory Writable',
        'current' => $is_writable ? 'Writable' : 'Not writable',
        'pass' => $is_writable,
        'required' => true,
        'message' => $is_writable ? 'OK' : sprintf('The WordPress uploads directory (%s) is not writable. BackupSheep needs to write to this directory.', $upload_base_dir)
    );
    
    // UpdraftPlus
    $updraftplus_active = is_plugin_active('updraftplus/updraftplus.php');
    $requirements['updraftplus'] = array(
        'name' => 'UpdraftPlus Plugin',
        'current' => $updraftplus_active ? 'Active' : 'Not active',
        'pass' => $updraftplus_active,
        'required' => false,
        'message' => $updraftplus_active ? 'OK' : 'UpdraftPlus plugin is recommended for the best backup experience with BackupSheep.'
    );
    
    // PHP Memory Limit
    $memory_limit = ini_get('memory_limit');
    $memory_limit_bytes = wp_convert_hr_to_bytes($memory_limit);
    $min_memory = 64 * 1024 * 1024; // 64MB
    $memory_check = $memory_limit_bytes >= $min_memory;
    $requirements['memory_limit'] = array(
        'name' => 'PHP Memory Limit (64MB+)',
        'current' => $memory_limit,
        'pass' => $memory_check,
        'required' => false,
        'message' => $memory_check ? 'OK' : sprintf('Your PHP memory limit (%s) is low. BackupSheep recommends at least 64MB.', $memory_limit)
    );
    
    // PHP Max Execution Time
    $execution_time = ini_get('max_execution_time');
    $min_execution = 30;
    $execution_check = ($execution_time >= $min_execution || $execution_time == 0); // 0 = unlimited
    $requirements['execution_time'] = array(
        'name' => 'PHP Max Execution Time (30s+)',
        'current' => $execution_time == 0 ? 'unlimited' : $execution_time . 's',
        'pass' => $execution_check,
        'required' => false,
        'message' => $execution_check ? 'OK' : sprintf('Your PHP max execution time (%s seconds) is low. BackupSheep recommends at least 30 seconds.', $execution_time)
    );
    
    // WP Cron
    $cron_disabled = defined('DISABLE_WP_CRON') && DISABLE_WP_CRON;
    $cron_check = !$cron_disabled;
    $requirements['wp_cron'] = array(
        'name' => 'WordPress Cron Enabled',
        'current' => $cron_check ? 'Enabled' : 'Disabled',
        'pass' => $cron_check,
        'required' => false,
        'message' => $cron_check ? 'OK' : 'WordPress Cron appears to be disabled. BackupSheep uses WordPress Cron for scheduled backups.'
    );
    
    return $requirements;
}

/**
 * Check if the installation passes all required checks
 *
 * @param array $requirements Requirements array
 * @return bool True if all required checks pass
 */
function backupsheep_installation_passes($requirements) {
    foreach ($requirements as $requirement) {
        if ($requirement['required'] && !$requirement['pass']) {
            return false;
        }
    }
    
    return true;
}

/**
 * Display installation requirements check
 *
 * @return void
 */
function backupsheep_display_installation_check() {
    $requirements = backupsheep_check_requirements();
    $installation_passes = backupsheep_installation_passes($requirements);
    
    ?>
    <div class="backupsheep-requirements-check">
        <h2><?php _e('System Requirements Check', 'backupsheep'); ?></h2>
        
        <?php if ($installation_passes): ?>
            <div class="notice notice-success inline">
                <p><strong><?php _e('Good news!', 'backupsheep'); ?></strong> <?php _e('Your server meets all the required system requirements for BackupSheep.', 'backupsheep'); ?></p>
            </div>
        <?php else: ?>
            <div class="notice notice-error inline">
                <p><strong><?php _e('Attention!', 'backupsheep'); ?></strong> <?php _e('Your server does not meet all the requirements for BackupSheep. Please fix the issues below.', 'backupsheep'); ?></p>
            </div>
        <?php endif; ?>
        
        <table class="widefat backupsheep-requirements-table" cellspacing="0">
            <thead>
                <tr>
                    <th><?php _e('Requirement', 'backupsheep'); ?></th>
                    <th><?php _e('Current', 'backupsheep'); ?></th>
                    <th><?php _e('Status', 'backupsheep'); ?></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($requirements as $requirement): ?>
                    <tr>
                        <td>
                            <?php echo esc_html($requirement['name']); ?>
                            <?php if ($requirement['required']): ?>
                                <span class="backupsheep-required"><?php _e('(Required)', 'backupsheep'); ?></span>
                            <?php else: ?>
                                <span class="backupsheep-recommended"><?php _e('(Recommended)', 'backupsheep'); ?></span>
                            <?php endif; ?>
                        </td>
                        <td><?php echo esc_html($requirement['current']); ?></td>
                        <td>
                            <?php if ($requirement['pass']): ?>
                                <span class="backupsheep-status-ok"><?php _e('OK', 'backupsheep'); ?></span>
                            <?php else: ?>
                                <span class="backupsheep-status-error"><?php echo esc_html($requirement['message']); ?></span>
                            <?php endif; ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        
        <?php if (!$installation_passes): ?>
            <p class="backupsheep-help">
                <?php _e('Please resolve the required issues above to use BackupSheep. If you need assistance, please contact your hosting provider or the BackupSheep support team.', 'backupsheep'); ?>
            </p>
        <?php endif; ?>
    </div>
    <?php
}