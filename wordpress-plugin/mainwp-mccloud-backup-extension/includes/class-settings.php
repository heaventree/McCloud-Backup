<?php
/**
 * Settings screen: a single account-level API key, configured once, used for
 * every call this extension makes to the McCloud Backup server.
 */
if (!defined('ABSPATH')) exit;

class MainWP_McCloud_Backup_Settings {

    const OPTION_GROUP = 'mccloud_backup_mainwp_settings';

    public static function register_settings() {
        register_setting(self::OPTION_GROUP, 'mccloud_backup_mainwp_api_key', ['sanitize_callback' => 'sanitize_text_field']);
        register_setting(self::OPTION_GROUP, 'mccloud_backup_mainwp_api_url', ['sanitize_callback' => 'esc_url_raw']);
    }

    public static function render() {
        if (!current_user_can('manage_options')) {
            return;
        }

        $api_key = get_option('mccloud_backup_mainwp_api_key', '');
        $api_url = get_option('mccloud_backup_mainwp_api_url', 'https://api.mccloud-backup.com/api/mainwp');
        ?>
        <div class="wrap">
            <h1><?php esc_html_e('McCloud Backup Settings', 'mainwp-mccloud-backup-extension'); ?></h1>
            <p><?php esc_html_e('Enter the account-level API key from your McCloud Backup dashboard (Settings > API Keys). This single key authenticates every site status check and backup trigger made from this extension.', 'mainwp-mccloud-backup-extension'); ?></p>
            <form method="post" action="options.php">
                <?php settings_fields(self::OPTION_GROUP); ?>
                <table class="form-table">
                    <tr>
                        <th scope="row"><label for="mccloud_backup_mainwp_api_key"><?php esc_html_e('API Key', 'mainwp-mccloud-backup-extension'); ?></label></th>
                        <td>
                            <input type="password" id="mccloud_backup_mainwp_api_key" name="mccloud_backup_mainwp_api_key" value="<?php echo esc_attr($api_key); ?>" class="regular-text" autocomplete="off" />
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="mccloud_backup_mainwp_api_url"><?php esc_html_e('API URL', 'mainwp-mccloud-backup-extension'); ?></label></th>
                        <td>
                            <input type="url" id="mccloud_backup_mainwp_api_url" name="mccloud_backup_mainwp_api_url" value="<?php echo esc_attr($api_url); ?>" class="regular-text" />
                            <p class="description"><?php esc_html_e('Only change this if you are self-hosting McCloud Backup.', 'mainwp-mccloud-backup-extension'); ?></p>
                        </td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }
}
