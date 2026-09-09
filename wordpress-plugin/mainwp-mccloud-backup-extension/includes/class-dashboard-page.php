<?php
/**
 * Main extension page: one table listing every McCloud Backup-connected
 * site's status (connected/not, last backup time, next scheduled backup)
 * with a one-click "run backup now" button per site.
 */
if (!defined('ABSPATH')) exit;

class MainWP_McCloud_Backup_Dashboard_Page {

    public static function render() {
        if (!current_user_can('read')) {
            return;
        }

        if (isset($_POST['mccloud_backup_run_now']) && check_admin_referer('mccloud_backup_run_now_action')) {
            $site_id = intval($_POST['mccloud_backup_run_now']);
            $client = new MainWP_McCloud_Backup_Api_Client();
            $result = $client->run_backup_now($site_id);

            if (is_wp_error($result)) {
                echo '<div class="notice notice-error"><p>' . esc_html($result->get_error_message()) . '</p></div>';
            } else {
                echo '<div class="notice notice-success"><p>' . esc_html__('Backup triggered.', 'mainwp-mccloud-backup-extension') . '</p></div>';
            }
        }

        $client = new MainWP_McCloud_Backup_Api_Client();

        if (!$client->has_api_key()) {
            printf(
                '<div class="wrap"><h1>%s</h1><p>%s <a href="%s">%s</a></p></div>',
                esc_html__('McCloud Backup', 'mainwp-mccloud-backup-extension'),
                esc_html__('No API key configured yet.', 'mainwp-mccloud-backup-extension'),
                esc_url(admin_url('admin.php?page=mainwp-mccloud-backup-extension-settings')),
                esc_html__('Go to Settings', 'mainwp-mccloud-backup-extension')
            );
            return;
        }

        $sites = $client->get_sites_status();
        ?>
        <div class="wrap">
            <h1><?php esc_html_e('McCloud Backup', 'mainwp-mccloud-backup-extension'); ?></h1>

            <?php if (is_wp_error($sites)) : ?>
                <div class="notice notice-error"><p><?php echo esc_html($sites->get_error_message()); ?></p></div>
            <?php elseif (empty($sites)) : ?>
                <p><?php esc_html_e('No sites found yet.', 'mainwp-mccloud-backup-extension'); ?></p>
            <?php else : ?>
                <table class="wp-list-table widefat fixed striped">
                    <thead>
                        <tr>
                            <th><?php esc_html_e('Site', 'mainwp-mccloud-backup-extension'); ?></th>
                            <th><?php esc_html_e('Status', 'mainwp-mccloud-backup-extension'); ?></th>
                            <th><?php esc_html_e('Last Backup', 'mainwp-mccloud-backup-extension'); ?></th>
                            <th><?php esc_html_e('Last Backup Status', 'mainwp-mccloud-backup-extension'); ?></th>
                            <th><?php esc_html_e('Next Scheduled Backup', 'mainwp-mccloud-backup-extension'); ?></th>
                            <th><?php esc_html_e('Action', 'mainwp-mccloud-backup-extension'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                    <?php foreach ($sites as $site) : ?>
                        <tr>
                            <td>
                                <strong><?php echo esc_html($site['name'] ?? $site['url']); ?></strong><br />
                                <a href="<?php echo esc_url($site['url']); ?>" target="_blank" rel="noopener"><?php echo esc_html($site['url']); ?></a>
                            </td>
                            <td>
                                <?php if (!empty($site['connected'])) : ?>
                                    <span style="color:#1a7f37;">&#9679; <?php esc_html_e('Connected', 'mainwp-mccloud-backup-extension'); ?></span>
                                <?php else : ?>
                                    <span style="color:#b32d2e;">&#9679; <?php esc_html_e('Not connected', 'mainwp-mccloud-backup-extension'); ?></span>
                                <?php endif; ?>
                            </td>
                            <td><?php echo esc_html(!empty($site['lastBackup']) ? $site['lastBackup'] : __('Never', 'mainwp-mccloud-backup-extension')); ?></td>
                            <td><?php echo esc_html($site['lastBackupStatus'] ?? '—'); ?></td>
                            <td><?php echo esc_html(!empty($site['nextRun']) ? $site['nextRun'] : __('Not scheduled', 'mainwp-mccloud-backup-extension')); ?></td>
                            <td>
                                <form method="post" style="display:inline;">
                                    <?php wp_nonce_field('mccloud_backup_run_now_action'); ?>
                                    <button type="submit" name="mccloud_backup_run_now" value="<?php echo esc_attr($site['id']); ?>" class="button button-primary">
                                        <?php esc_html_e('Run backup now', 'mainwp-mccloud-backup-extension'); ?>
                                    </button>
                                </form>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </div>
        <?php
    }
}
