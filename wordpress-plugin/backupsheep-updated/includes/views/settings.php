<?php
/**
 * Settings view
 *
 * @package BackupSheep
 */

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

// Get options
$options = get_option('backupsheep_options', []);

// Check if form was submitted
$form_submitted = false;
$form_error = '';
$form_success = '';

if (isset($_POST['backupsheep_save_settings']) && wp_verify_nonce($_POST['backupsheep_settings_nonce'], 'backupsheep_save_settings')) {
    $form_submitted = true;
    
    // Process form submission
    $new_options = $options;
    
    // API key
    if (isset($_POST['backupsheep_api_key'])) {
        $new_options['api_key'] = sanitize_text_field($_POST['backupsheep_api_key']);
    }
    
    // Site ID
    if (isset($_POST['backupsheep_site_id'])) {
        $new_options['site_id'] = sanitize_text_field($_POST['backupsheep_site_id']);
    }
    
    // Auto backup
    $new_options['auto_backup'] = isset($_POST['backupsheep_auto_backup']) ? 1 : 0;
    
    // Backup schedule
    if (isset($_POST['backupsheep_backup_schedule'])) {
        $new_options['backup_schedule'] = sanitize_text_field($_POST['backupsheep_backup_schedule']);
    }
    
    // Backup type
    if (isset($_POST['backupsheep_backup_type'])) {
        $new_options['backup_type'] = sanitize_text_field($_POST['backupsheep_backup_type']);
    }
    
    // Exclusions
    if (isset($_POST['backupsheep_exclusions'])) {
        $new_options['exclusions'] = sanitize_textarea_field($_POST['backupsheep_exclusions']);
    }
    
    // Retention count
    if (isset($_POST['backupsheep_retention'])) {
        $new_options['retention'] = intval($_POST['backupsheep_retention']);
    }
    
    // Save options
    update_option('backupsheep_options', $new_options);
    
    // Update schedule
    if ($new_options['auto_backup']) {
        backupsheep_schedule_backups($new_options['backup_schedule']);
    } else {
        backupsheep_clear_scheduled_backups();
    }
    
    $form_success = __('Settings saved successfully.', 'backupsheep');
    $options = $new_options;
}

// Default values
$options = wp_parse_args($options, [
    'api_key' => '',
    'site_id' => '',
    'auto_backup' => 0,
    'backup_schedule' => 'daily',
    'backup_type' => 'full',
    'exclusions' => "cache\ntmp\nwp-content/updraft\nwp-content/backups\nwp-content/cache",
    'retention' => 5
]);

?>

<div class="wrap backupsheep-settings">
    <h1><?php _e('BackupSheep Settings', 'backupsheep'); ?></h1>
    
    <?php if (empty($options['api_key'])): ?>
    <div class="notice notice-warning">
        <p>
            <?php _e('To get started with BackupSheep, please enter your API key from your BackupSheep account.', 'backupsheep'); ?>
            <a href="https://backupsheep.com/account" target="_blank"><?php _e('Get your API key', 'backupsheep'); ?></a>
        </p>
    </div>
    <?php endif; ?>
    
    <?php if ($form_submitted && $form_success): ?>
    <div class="notice notice-success">
        <p><?php echo esc_html($form_success); ?></p>
    </div>
    <?php endif; ?>
    
    <?php if ($form_submitted && $form_error): ?>
    <div class="notice notice-error">
        <p><?php echo esc_html($form_error); ?></p>
    </div>
    <?php endif; ?>
    
    <div class="backupsheep-settings-help">
        <p>
            <?php _e('BackupSheep helps you backup and secure your WordPress site.', 'backupsheep'); ?>
            <?php _e('Configure your settings below to start backing up your site to the cloud.', 'backupsheep'); ?>
        </p>
    </div>
    
    <form method="post" action="">
        <?php wp_nonce_field('backupsheep_save_settings', 'backupsheep_settings_nonce'); ?>
        
        <div class="backupsheep-card-grid">
            <!-- API Configuration Card -->
            <div class="backupsheep-card">
                <div class="backupsheep-card-header">
                    <h2><?php _e('API Configuration', 'backupsheep'); ?></h2>
                </div>
                <div class="backupsheep-card-body">
                    <table class="form-table">
                        <tbody>
                            <tr>
                                <th scope="row">
                                    <label for="backupsheep_api_key"><?php _e('API Key', 'backupsheep'); ?></label>
                                </th>
                                <td>
                                    <input type="text" 
                                           name="backupsheep_api_key" 
                                           id="backupsheep_api_key" 
                                           value="<?php echo esc_attr($options['api_key']); ?>" 
                                           class="regular-text" 
                                           placeholder="<?php _e('Enter your BackupSheep API key', 'backupsheep'); ?>"
                                    />
                                    <p class="description">
                                        <?php _e('Your API key connects this site to your BackupSheep account.', 'backupsheep'); ?>
                                        <a href="https://backupsheep.com/account" target="_blank"><?php _e('Get your API key', 'backupsheep'); ?></a>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">
                                    <label for="backupsheep_site_id"><?php _e('Site ID', 'backupsheep'); ?></label>
                                </th>
                                <td>
                                    <input type="text" 
                                           name="backupsheep_site_id" 
                                           id="backupsheep_site_id" 
                                           value="<?php echo esc_attr($options['site_id']); ?>" 
                                           class="regular-text" 
                                           placeholder="<?php _e('Site ID will be generated automatically', 'backupsheep'); ?>"
                                           readonly
                                    />
                                    <p class="description">
                                        <?php _e('Your site ID is generated automatically when you connect to the API.', 'backupsheep'); ?>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row"></th>
                                <td>
                                    <button type="button" id="backupsheep-test-connection" class="button button-secondary">
                                        <?php _e('Test Connection', 'backupsheep'); ?>
                                    </button>
                                    <span id="backupsheep-api-status-settings"></span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Backup Settings Card -->
            <div class="backupsheep-card">
                <div class="backupsheep-card-header">
                    <h2><?php _e('Backup Settings', 'backupsheep'); ?></h2>
                </div>
                <div class="backupsheep-card-body">
                    <table class="form-table">
                        <tbody>
                            <tr>
                                <th scope="row">
                                    <label for="backupsheep_auto_backup"><?php _e('Auto Backup', 'backupsheep'); ?></label>
                                </th>
                                <td>
                                    <label>
                                        <input type="checkbox" 
                                               name="backupsheep_auto_backup" 
                                               id="backupsheep_auto_backup" 
                                               value="1" 
                                               <?php checked($options['auto_backup'], 1); ?>
                                        />
                                        <?php _e('Enable automatic backups', 'backupsheep'); ?>
                                    </label>
                                    <p class="description">
                                        <?php _e('When enabled, BackupSheep will automatically backup your site according to the schedule.', 'backupsheep'); ?>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">
                                    <label for="backupsheep_backup_schedule"><?php _e('Backup Schedule', 'backupsheep'); ?></label>
                                </th>
                                <td>
                                    <select name="backupsheep_backup_schedule" id="backupsheep_backup_schedule" class="regular-text">
                                        <option value="hourly" <?php selected($options['backup_schedule'], 'hourly'); ?>><?php _e('Hourly', 'backupsheep'); ?></option>
                                        <option value="twicedaily" <?php selected($options['backup_schedule'], 'twicedaily'); ?>><?php _e('Twice Daily', 'backupsheep'); ?></option>
                                        <option value="daily" <?php selected($options['backup_schedule'], 'daily'); ?>><?php _e('Daily', 'backupsheep'); ?></option>
                                        <option value="weekly" <?php selected($options['backup_schedule'], 'weekly'); ?>><?php _e('Weekly', 'backupsheep'); ?></option>
                                    </select>
                                    <p class="description">
                                        <?php _e('How often should backups be performed?', 'backupsheep'); ?>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">
                                    <label for="backupsheep_backup_type"><?php _e('Backup Type', 'backupsheep'); ?></label>
                                </th>
                                <td>
                                    <select name="backupsheep_backup_type" id="backupsheep_backup_type" class="regular-text">
                                        <option value="full" <?php selected($options['backup_type'], 'full'); ?>><?php _e('Full Backup (Files and Database)', 'backupsheep'); ?></option>
                                        <option value="database" <?php selected($options['backup_type'], 'database'); ?>><?php _e('Database Only', 'backupsheep'); ?></option>
                                        <option value="files" <?php selected($options['backup_type'], 'files'); ?>><?php _e('Files Only', 'backupsheep'); ?></option>
                                    </select>
                                    <p class="description">
                                        <?php _e('What should be included in the automatic backups?', 'backupsheep'); ?>
                                    </p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Advanced Settings Card -->
            <div class="backupsheep-card backupsheep-full-width">
                <div class="backupsheep-card-header">
                    <h2><?php _e('Advanced Settings', 'backupsheep'); ?></h2>
                </div>
                <div class="backupsheep-card-body">
                    <table class="form-table">
                        <tbody>
                            <tr>
                                <th scope="row">
                                    <label for="backupsheep_exclusions"><?php _e('Exclusions', 'backupsheep'); ?></label>
                                </th>
                                <td>
                                    <textarea name="backupsheep_exclusions" 
                                              id="backupsheep_exclusions" 
                                              rows="5" 
                                              class="large-text code"
                                    ><?php echo esc_textarea($options['exclusions']); ?></textarea>
                                    <p class="description">
                                        <?php _e('Enter one directory/file per line to exclude from backups (relative to site root).', 'backupsheep'); ?>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">
                                    <label for="backupsheep_retention"><?php _e('Backup Retention', 'backupsheep'); ?></label>
                                </th>
                                <td>
                                    <input type="number" 
                                           name="backupsheep_retention" 
                                           id="backupsheep_retention" 
                                           value="<?php echo esc_attr($options['retention']); ?>" 
                                           class="small-text" 
                                           min="1" 
                                           max="100"
                                    />
                                    <p class="description">
                                        <?php _e('Number of backups to keep before removing older ones.', 'backupsheep'); ?>
                                    </p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <p class="submit">
            <input type="submit" name="backupsheep_save_settings" class="button button-primary" value="<?php _e('Save Settings', 'backupsheep'); ?>" />
        </p>
    </form>
</div>