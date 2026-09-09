<?php
/**
 * Plugin Name:       MainWP McCloud Backup Extension
 * Plugin URI:        https://mccloud-backup.com/mainwp-extension/
 * Description:       MainWP extension that shows McCloud Backup status for every connected child site and lets you trigger a backup for any of them from the MainWP dashboard.
 * Version:           1.0.0
 * Author:            McCloud Backup
 * Author URI:        https://mccloud-backup.com/
 * Text Domain:        mainwp-mccloud-backup-extension
 * Requires PHP:      7.4
 *
 * @package MainWP_McCloud_Backup_Extension
 */

if (!defined('ABSPATH')) exit;

define('MAINWP_MCCLOUD_BACKUP_EXT_VERSION', '1.0.0');
define('MAINWP_MCCLOUD_BACKUP_EXT_FILE', __FILE__);
define('MAINWP_MCCLOUD_BACKUP_EXT_DIR', plugin_dir_path(__FILE__));
define('MAINWP_MCCLOUD_BACKUP_EXT_URL', plugin_dir_url(__FILE__));

require_once MAINWP_MCCLOUD_BACKUP_EXT_DIR . 'includes/class-api-client.php';
require_once MAINWP_MCCLOUD_BACKUP_EXT_DIR . 'includes/class-settings.php';
require_once MAINWP_MCCLOUD_BACKUP_EXT_DIR . 'includes/class-dashboard-page.php';

/**
 * Main extension bootstrap class.
 *
 * Registers with MainWP the standard way: any plugin can become a MainWP
 * Extension by hooking `mainwp_getextensions` (to appear in the MainWP
 * Extensions list, with an activation callback) and by hooking
 * `mainwp-connect-extension` (fired by MainWP once it verifies the extension
 * on every admin_init) to build the extension's own admin submenu.
 */
class MainWP_McCloud_Backup_Extension {

    /** @var MainWP_McCloud_Backup_Extension|null */
    private static $instance = null;

    /** @var string Set by MainWP via mainwp-connect-extension so links point at the right admin page. */
    public $plugin_url;

    /** @var string */
    public $plugin_dir = MAINWP_MCCLOUD_BACKUP_EXT_DIR;

    public static function instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->plugin_url = plugin_dir_url(__FILE__);

        add_filter('mainwp_getextensions', [$this, 'get_extension']);
        add_action('mainwp-connect-extension', [$this, 'connect_extension']);

        add_action('admin_init', [MainWP_McCloud_Backup_Settings::class, 'register_settings']);
    }

    /**
     * Tells MainWP core that this extension exists, so it shows up under
     * MainWP > Extensions with an "Activate" button.
     */
    public function get_extension($values) {
        $values[] = [
            'plugin'      => MAINWP_MCCLOUD_BACKUP_EXT_FILE,
            'api'         => 'mainwp-mccloud-backup-extension',
            'mainwp'      => true,
            'callback'    => [$this, 'connect_extension'],
            'apiKey'      => '',
        ];
        return $values;
    }

    /**
     * Fired by MainWP once per admin_init after it has verified this is a
     * real, activated MainWP extension. This is where the extension builds
     * its own admin submenu under the main MainWP menu.
     */
    public function connect_extension($values = []) {
        add_action('admin_menu', [$this, 'add_menu'], 20);

        return [
            'url'  => $this->plugin_url,
            'dir'  => $this->plugin_dir,
            'name' => 'McCloud Backup',
        ];
    }

    /**
     * Registers the extension's page under the MainWP menu (mainwp_tab).
     * MainWP itself creates the top-level "MainWP" admin menu; extensions
     * add themselves as submenu pages under it using this slug convention.
     */
    public function add_menu() {
        add_submenu_page(
            'mainwp_tab',
            __('McCloud Backup', 'mainwp-mccloud-backup-extension'),
            __('McCloud Backup', 'mainwp-mccloud-backup-extension'),
            'read',
            'mainwp-mccloud-backup-extension',
            [MainWP_McCloud_Backup_Dashboard_Page::class, 'render']
        );

        add_submenu_page(
            'mainwp_tab',
            __('McCloud Backup Settings', 'mainwp-mccloud-backup-extension'),
            __('McCloud Backup Settings', 'mainwp-mccloud-backup-extension'),
            'manage_options',
            'mainwp-mccloud-backup-extension-settings',
            [MainWP_McCloud_Backup_Settings::class, 'render']
        );
    }
}

add_action('plugins_loaded', function () {
    // Only initialize once MainWP itself is present - this is a MainWP
    // extension, not a standalone plugin.
    if (defined('MAINWP_PLUGIN_FILE') || class_exists('MainWP_System')) {
        MainWP_McCloud_Backup_Extension::instance();
    }
});
