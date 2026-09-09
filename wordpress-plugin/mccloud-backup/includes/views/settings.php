<?php
/**
 * Settings view
 *
 * @package McCloud Backup
 */

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

// Get options
$options = get_option('mccloud_backup_options', []);

// Check if form was submitted
$form_submitted = false;
$form_error = '';
$form_success = '';

if (isset($_POST['mccloud_backup_save_settings']) && wp_verify_nonce($_POST['mccloud_backup_settings_nonce'], 'mccloud_backup_save_settings')) {
    $form_submitted = true;
    
    // Process form submission
    $new_options = $options;
    
    // API key
    if (isset($_POST['mccloud_backup_api_key'])) {
        $new_options['api_key'] = sanitize_text_field($_POST['mccloud_backup_api_key']);
    }
    
    // Site ID
    if (isset($_POST['mccloud_backup_site_id'])) {
        $new_options['site_id'] = sanitize_text_field($_POST['mccloud_backup_site_id']);
    }
    
    // Auto backup
    $new_options['auto_backup'] = isset($_POST['mccloud_backup_auto_backup']) ? 1 : 0;
    
    // Backup schedule
    if (isset($_POST['mccloud_backup_backup_schedule'])) {
        $new_options['backup_schedule'] = sanitize_text_field($_POST['mccloud_backup_backup_schedule']);
    }
    
    // Backup type
    if (isset($_POST['mccloud_backup_backup_type'])) {
        $new_options['backup_type'] = sanitize_text_field($_POST['mccloud_backup_backup_type']);
    }
    
    // Exclusions
    if (isset($_POST['mccloud_backup_exclusions'])) {
        $new_options['exclusions'] = sanitize_textarea_field($_POST['mccloud_backup_exclusions']);
    }
    
    // Retention count
    if (isset($_POST['mccloud_backup_retention'])) {
        $new_options['retention'] = intval($_POST['mccloud_backup_retention']);
    }
    
    // Encryption settings
    $new_options['enable_encryption'] = isset($_POST['mccloud_backup_enable_encryption']) ? 1 : 0;
    
    if (isset($_POST['mccloud_backup_encryption_method'])) {
        $new_options['encryption_method'] = sanitize_text_field($_POST['mccloud_backup_encryption_method']);
    }
    
    // Handle encryption key
    if (isset($_POST['mccloud_backup_encryption_key_action'])) {
        if ($_POST['mccloud_backup_encryption_key_action'] === 'generate') {
            // Generate a new key
            $new_options['encryption_key'] = mccloud_backup_generate_encryption_key();
        } elseif ($_POST['mccloud_backup_encryption_key_action'] === 'manual' && !empty($_POST['mccloud_backup_encryption_key'])) {
            // Use manually entered key
            $new_options['encryption_key'] = sanitize_text_field($_POST['mccloud_backup_encryption_key']);
        } elseif ($_POST['mccloud_backup_encryption_key_action'] === 'keep' && !empty($options['encryption_key'])) {
            // Keep existing key
            $new_options['encryption_key'] = $options['encryption_key'];
        }
        
        // Test the encryption key if enabled
        if ($new_options['enable_encryption'] && !empty($new_options['encryption_key'])) {
            $test_result = mccloud_backup_test_encryption_key($new_options['encryption_key']);
            if (is_wp_error($test_result)) {
                $form_error = sprintf(__('Encryption key validation failed: %s', 'mccloud-backup'), $test_result->get_error_message());
                $form_success = '';
                $new_options['enable_encryption'] = 0; // Disable encryption if key is invalid
            }
        }
    }
    
    // Save options
    update_option('mccloud_backup_options', $new_options);
    
    // Update schedule
    if ($new_options['auto_backup']) {
        mccloud_backup_schedule_backups($new_options['backup_schedule']);
    } else {
        mccloud_backup_clear_scheduled_backups();
    }
    
    $form_success = __('Settings saved successfully.', 'mccloud-backup');
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
    'retention' => 5,
    'enable_encryption' => 0,
    'encryption_method' => 'aes-256-cbc',
    'encryption_key' => ''
]);

?>

<div class="wrap mccloud-backup-settings">
    <h1><?php _e('McCloud Backup Settings', 'mccloud-backup'); ?></h1>
    
    <?php if (empty($options['api_key'])): ?>
    <div class="notice notice-warning">
        <p>
            <?php _e('To get started with McCloud Backup, please enter your API key from your McCloud Backup account.', 'mccloud-backup'); ?>
            <a href="https://mccloud-backup.com/account" target="_blank"><?php _e('Get your API key', 'mccloud-backup'); ?></a>
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
    
    <div class="mccloud-backup-settings-help">
        <p>
            <?php _e('McCloud Backup helps you backup and secure your WordPress site.', 'mccloud-backup'); ?>
            <?php _e('Configure your settings below to start backing up your site to the cloud.', 'mccloud-backup'); ?>
        </p>
    </div>
    
    <form method="post" action="">
        <?php wp_nonce_field('mccloud_backup_save_settings', 'mccloud_backup_settings_nonce'); ?>
        
        <div class="mccloud-backup-card-grid">
            <!-- API Configuration Card -->
            <div class="mccloud-backup-card">
                <div class="mccloud-backup-card-header">
                    <h2><?php _e('API Configuration', 'mccloud-backup'); ?></h2>
                </div>
                <div class="mccloud-backup-card-body">
                    <table class="form-table">
                        <tbody>
                            <tr>
                                <th scope="row">
                                    <label for="mccloud_backup_api_key"><?php _e('API Key', 'mccloud-backup'); ?></label>
                                </th>
                                <td>
                                    <input type="text" 
                                           name="mccloud_backup_api_key" 
                                           id="mccloud_backup_api_key" 
                                           value="<?php echo esc_attr($options['api_key']); ?>" 
                                           class="regular-text" 
                                           placeholder="<?php _e('Enter your McCloud Backup API key', 'mccloud-backup'); ?>"
                                    />
                                    <p class="description">
                                        <?php _e('Your API key connects this site to your McCloud Backup account.', 'mccloud-backup'); ?>
                                        <a href="https://mccloud-backup.com/account" target="_blank"><?php _e('Get your API key', 'mccloud-backup'); ?></a>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">
                                    <label for="mccloud_backup_site_id"><?php _e('Site ID', 'mccloud-backup'); ?></label>
                                </th>
                                <td>
                                    <input type="text" 
                                           name="mccloud_backup_site_id" 
                                           id="mccloud_backup_site_id" 
                                           value="<?php echo esc_attr($options['site_id']); ?>" 
                                           class="regular-text" 
                                           placeholder="<?php _e('Site ID will be generated automatically', 'mccloud-backup'); ?>"
                                           readonly
                                    />
                                    <p class="description">
                                        <?php _e('Your site ID is generated automatically when you connect to the API.', 'mccloud-backup'); ?>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row"></th>
                                <td>
                                    <button type="button" id="mccloud-backup-test-connection" class="button button-secondary">
                                        <?php _e('Test Connection', 'mccloud-backup'); ?>
                                    </button>
                                    <span id="mccloud-backup-api-status-settings"></span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Backup Settings Card -->
            <div class="mccloud-backup-card">
                <div class="mccloud-backup-card-header">
                    <h2><?php _e('Backup Settings', 'mccloud-backup'); ?></h2>
                </div>
                <div class="mccloud-backup-card-body">
                    <table class="form-table">
                        <tbody>
                            <tr>
                                <th scope="row">
                                    <label for="mccloud_backup_auto_backup"><?php _e('Auto Backup', 'mccloud-backup'); ?></label>
                                </th>
                                <td>
                                    <label>
                                        <input type="checkbox" 
                                               name="mccloud_backup_auto_backup" 
                                               id="mccloud_backup_auto_backup" 
                                               value="1" 
                                               <?php checked($options['auto_backup'], 1); ?>
                                        />
                                        <?php _e('Enable automatic backups', 'mccloud-backup'); ?>
                                    </label>
                                    <p class="description">
                                        <?php _e('When enabled, McCloud Backup will automatically backup your site according to the schedule.', 'mccloud-backup'); ?>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">
                                    <label for="mccloud_backup_backup_schedule"><?php _e('Backup Schedule', 'mccloud-backup'); ?></label>
                                </th>
                                <td>
                                    <select name="mccloud_backup_backup_schedule" id="mccloud_backup_backup_schedule" class="regular-text">
                                        <option value="hourly" <?php selected($options['backup_schedule'], 'hourly'); ?>><?php _e('Hourly', 'mccloud-backup'); ?></option>
                                        <option value="twicedaily" <?php selected($options['backup_schedule'], 'twicedaily'); ?>><?php _e('Twice Daily', 'mccloud-backup'); ?></option>
                                        <option value="daily" <?php selected($options['backup_schedule'], 'daily'); ?>><?php _e('Daily', 'mccloud-backup'); ?></option>
                                        <option value="weekly" <?php selected($options['backup_schedule'], 'weekly'); ?>><?php _e('Weekly', 'mccloud-backup'); ?></option>
                                    </select>
                                    <p class="description">
                                        <?php _e('How often should backups be performed?', 'mccloud-backup'); ?>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">
                                    <label for="mccloud_backup_backup_type"><?php _e('Backup Type', 'mccloud-backup'); ?></label>
                                </th>
                                <td>
                                    <select name="mccloud_backup_backup_type" id="mccloud_backup_backup_type" class="regular-text">
                                        <option value="full" <?php selected($options['backup_type'], 'full'); ?>><?php _e('Full Backup (Files and Database)', 'mccloud-backup'); ?></option>
                                        <option value="database" <?php selected($options['backup_type'], 'database'); ?>><?php _e('Database Only', 'mccloud-backup'); ?></option>
                                        <option value="files" <?php selected($options['backup_type'], 'files'); ?>><?php _e('Files Only', 'mccloud-backup'); ?></option>
                                    </select>
                                    <p class="description">
                                        <?php _e('What should be included in the automatic backups?', 'mccloud-backup'); ?>
                                    </p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Encryption Settings Card -->
            <div class="mccloud-backup-card">
                <div class="mccloud-backup-card-header">
                    <h2><?php _e('Encryption Settings', 'mccloud-backup'); ?></h2>
                </div>
                <div class="mccloud-backup-card-body">
                    <table class="form-table">
                        <tbody>
                            <tr>
                                <th scope="row">
                                    <label for="mccloud_backup_enable_encryption"><?php _e('Enable Encryption', 'mccloud-backup'); ?></label>
                                </th>
                                <td>
                                    <label>
                                        <input type="checkbox" 
                                               name="mccloud_backup_enable_encryption" 
                                               id="mccloud_backup_enable_encryption" 
                                               value="1" 
                                               <?php checked($options['enable_encryption'], 1); ?>
                                        />
                                        <?php _e('Encrypt backup files', 'mccloud-backup'); ?>
                                    </label>
                                    <p class="description">
                                        <?php _e('When enabled, all backup files will be encrypted before being stored.', 'mccloud-backup'); ?>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">
                                    <label for="mccloud_backup_encryption_method"><?php _e('Encryption Method', 'mccloud-backup'); ?></label>
                                </th>
                                <td>
                                    <select name="mccloud_backup_encryption_method" id="mccloud_backup_encryption_method" class="regular-text">
                                        <option value="aes-256-cbc" <?php selected($options['encryption_method'], 'aes-256-cbc'); ?>><?php _e('AES-256-CBC (Recommended)', 'mccloud-backup'); ?></option>
                                        <option value="aes-128-cbc" <?php selected($options['encryption_method'], 'aes-128-cbc'); ?>><?php _e('AES-128-CBC', 'mccloud-backup'); ?></option>
                                    </select>
                                    <p class="description">
                                        <?php _e('The encryption algorithm to use for securing your backups.', 'mccloud-backup'); ?>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">
                                    <label for="mccloud_backup_encryption_key"><?php _e('Encryption Key', 'mccloud-backup'); ?></label>
                                </th>
                                <td>
                                    <div class="mccloud-backup-encryption-key-container">
                                        <div class="mccloud-backup-encryption-key-options">
                                            <label>
                                                <input type="radio" 
                                                       name="mccloud_backup_encryption_key_action" 
                                                       value="generate" 
                                                       <?php echo empty($options['encryption_key']) ? 'checked' : ''; ?> 
                                                />
                                                <?php _e('Generate a new encryption key', 'mccloud-backup'); ?>
                                            </label>
                                            <br>
                                            <label>
                                                <input type="radio" 
                                                       name="mccloud_backup_encryption_key_action" 
                                                       value="manual" 
                                                />
                                                <?php _e('Enter encryption key manually', 'mccloud-backup'); ?>
                                            </label>
                                            <br>
                                            <?php if (!empty($options['encryption_key'])): ?>
                                            <label>
                                                <input type="radio" 
                                                       name="mccloud_backup_encryption_key_action" 
                                                       value="keep" 
                                                       checked 
                                                />
                                                <?php _e('Keep existing encryption key', 'mccloud-backup'); ?>
                                            </label>
                                            <?php endif; ?>
                                        </div>
                                        
                                        <div class="mccloud-backup-encryption-key-input" style="margin-top: 10px;">
                                            <input type="text" 
                                                   name="mccloud_backup_encryption_key" 
                                                   id="mccloud_backup_encryption_key" 
                                                   value="" 
                                                   class="regular-text" 
                                                   placeholder="<?php _e('Enter encryption key', 'mccloud-backup'); ?>"
                                                   style="display: none;"
                                            />
                                        </div>
                                        
                                        <?php if (!empty($options['encryption_key'])): ?>
                                        <div class="mccloud-backup-current-key">
                                            <p>
                                                <strong><?php _e('Current key:', 'mccloud-backup'); ?></strong> 
                                                <span class="mccloud-backup-masked-key">••••••••••••••••</span>
                                                <button type="button" class="button button-secondary mccloud-backup-show-key">
                                                    <?php _e('Show', 'mccloud-backup'); ?>
                                                </button>
                                                <span class="mccloud-backup-key-actual" style="display: none;"><?php echo esc_html($options['encryption_key']); ?></span>
                                            </p>
                                        </div>
                                        <?php endif; ?>
                                    </div>
                                    
                                    <p class="description">
                                        <?php _e('The encryption key is used to secure your backups. Store this key safely - if lost, you won\'t be able to recover your backups.', 'mccloud-backup'); ?>
                                    </p>
                                    <p class="description mccloud-backup-warning">
                                        <strong><?php _e('Warning:', 'mccloud-backup'); ?></strong>
                                        <?php _e('If you change or lose your encryption key, you won\'t be able to restore previously encrypted backups.', 'mccloud-backup'); ?>
                                    </p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Advanced Settings Card -->
            <div class="mccloud-backup-card mccloud-backup-full-width">
                <div class="mccloud-backup-card-header">
                    <h2><?php _e('Advanced Settings', 'mccloud-backup'); ?></h2>
                </div>
                <div class="mccloud-backup-card-body">
                    <table class="form-table">
                        <tbody>
                            <tr>
                                <th scope="row">
                                    <label for="mccloud_backup_exclusions"><?php _e('Exclusions', 'mccloud-backup'); ?></label>
                                </th>
                                <td>
                                    <textarea name="mccloud_backup_exclusions" 
                                              id="mccloud_backup_exclusions" 
                                              rows="5" 
                                              class="large-text code"
                                    ><?php echo esc_textarea($options['exclusions']); ?></textarea>
                                    <p class="description">
                                        <?php _e('Enter one directory/file per line to exclude from backups (relative to site root).', 'mccloud-backup'); ?>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">
                                    <label for="mccloud_backup_retention"><?php _e('Backup Retention', 'mccloud-backup'); ?></label>
                                </th>
                                <td>
                                    <input type="number" 
                                           name="mccloud_backup_retention" 
                                           id="mccloud_backup_retention" 
                                           value="<?php echo esc_attr($options['retention']); ?>" 
                                           class="small-text" 
                                           min="1" 
                                           max="100"
                                    />
                                    <p class="description">
                                        <?php _e('Number of backups to keep before removing older ones.', 'mccloud-backup'); ?>
                                    </p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <p class="submit">
            <input type="submit" name="mccloud_backup_save_settings" class="button button-primary" value="<?php _e('Save Settings', 'mccloud-backup'); ?>" />
        </p>
    </form>
</div>