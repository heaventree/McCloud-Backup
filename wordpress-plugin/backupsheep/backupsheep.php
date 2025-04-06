<?php

/**
 * @package             BackupSheep
 * @author              Bilal Ahmed
 * @copyright           2022 BackupSheep Inc.
 * @license             GPLv3 or later
 *
 * Plugin Name:         BackupSheep - Reliable Offsite Backups
 * Plugin URI:          https://support.backupsheep.com/en/articles/6297220-how-to-backup-wordpress
 * Description:         BackupSheep plugin integrates with existing backup plugins such as UpdraftPlus(free/paid) and automates files and database backups using smart scheduling and the ability to push your backups to remote storage accounts.
 * Requires at least:   5.0
 * Requires PHP:        7.4
 * Author:              BackupSheep.Com, Bilal Ahmed
 * Author URI:          https://backupsheep.com/wordpress-backup/
 * Text Domain:         backupsheep
 * Version:             1.8
 * License:             GPLv3 or later
 * License URI:         https://www.gnu.org/licenses/gpl-3.0.html
 */
// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) exit;


function backupsheep_register_route()
{
    register_rest_route('backupsheep/updraftplus', 'validate', array(
            'methods' => 'GET',
            'callback' => 'backupsheep_updraftplus_validate',
            'permission_callback' => '__return_true',
        )
    );
    register_rest_route('backupsheep/updraftplus', 'backup', array(
            'methods' => 'GET',
            'callback' => 'backupsheep_updraftplus_backup',
            'permission_callback' => '__return_true',
        )
    );
    register_rest_route('backupsheep/updraftplus', 'status', array(
            'methods' => 'GET',
            'callback' => 'backupsheep_updraftplus_status',
            'permission_callback' => '__return_true',
        )
    );
    register_rest_route('backupsheep/updraftplus', 'files', array(
            'methods' => 'GET',
            'callback' => 'backupsheep_updraftplus_files',
            'permission_callback' => '__return_true',
        )
    );
    register_rest_route('backupsheep/updraftplus', 'download', array(
            'methods' => 'GET',
            'callback' => 'backupsheep_updraftplus_download',
            'permission_callback' => '__return_true',
        )
    );
    register_rest_route('backupsheep/updraftplus', 'delete', array(
            'methods' => 'GET',
            'callback' => 'backupsheep_updraftplus_delete',
            'permission_callback' => '__return_true',
        )
    );
    register_rest_route('backupsheep/updraftplus', 'uuid', array(
            'methods' => 'GET',
            'callback' => 'backupsheep_updraftplus_uuid',
            'permission_callback' => '__return_true',
        )
    );
    register_rest_route('backupsheep/updraftplus', 'rebuild_history', array(
            'methods' => 'GET',
            'callback' => 'backupsheep_updraftplus_rebuild_history',
            'permission_callback' => '__return_true',
        )
    );
}

/**
 * @param $haystack
 * @param $needle
 * @return bool
 */
function backupsheep_starts_with($haystack, $needle)
{
    $length = strlen($needle);
    return substr($haystack, 0, $length) === $needle;
}

/**
 * @param $haystack
 * @param $needle
 * @return bool
 */
function backupsheep_ends_with($haystack, $needle)
{
    $length = strlen($needle);
    if (!$length) {
        return true;
    }
    return substr($haystack, -$length) === $needle;
}

/**
 * @return bool
 */
function backupsheep_validate_key()
{
    if (isset($_GET['key'])) {
        $key = sanitize_text_field($_GET['key']);
        $backupsheep_options = get_option('backupsheep_option_name'); // Array of All Options
        $bs_wordpress_key_0 = $backupsheep_options['bs_wordpress_key_0']; // Integration Code
        return $bs_wordpress_key_0 == $key;
    } else {
        return false;
    }
}

/**
 * @return WP_REST_Response
 */
function backupsheep_nocache_response($data)
{
    wp_get_nocache_headers();
    return new WP_REST_Response($data, 200);
}

/**
 * @return mixed
 */
function backupsheep_updraftplus_status()
{
    if (backupsheep_validate_key()) {

        global $updraftplus;

        $status = null;

        if (isset($_GET['backup_uuid'])) {
            $backup_uuid = sanitize_key($_GET['backup_uuid']);
            $status = $updraftplus->found_backup_complete_in_logfile($backup_uuid);
        }
        $log_file = str_replace($updraftplus->backups_dir_location() . '/', '', $updraftplus->get_logfile_name($backup_uuid));
        /**
         * Status comes back as false if you run backup with same UUID
         */
        $data = array("status" => $status, "log_file" => $log_file, "version" => 1.8);
    } else {
        $data = array("validate_backupsheep_key" => false);
    }
    return backupsheep_nocache_response($data);
}

/**
 * @return mixed
 */
function backupsheep_updraftplus_validate()
{
    if (backupsheep_validate_key()) {
        $backupsheep = false;
        $updraftplus = false;

        if (in_array('backupsheep/backupsheep.php', apply_filters('active_plugins', get_option('active_plugins')))) {
            $backupsheep = true;
        }

        if (in_array('updraftplus/updraftplus.php', apply_filters('active_plugins', get_option('active_plugins')))) {
            $updraftplus = true;
        }
        $data = array("plugins" => array("backupsheep" => $backupsheep, "updraftplus" => $updraftplus));
    } else {
        $data = array("validate_backupsheep_key" => false);
    }
    return backupsheep_nocache_response($data);
}

/**
 * @return mixed
 */
function backupsheep_updraftplus_backup()
{
    if (backupsheep_validate_key()) {
        if (isset($_GET['backup_uuid'])) {
            $include = null;

            $backup_uuid = sanitize_key($_GET["backup_uuid"]);

            /**
             * FULL = 1, "Full (Database + Files)"
             * DATABASE = 2, "Database"
             * FILES = 3, "Files"
             */
            if (sanitize_text_field($_GET['include']) !== null) {
                $include = (int)sanitize_text_field($_GET["include"]);
            }

            /**
             * Only files backup
             */
            if ($include == 3) {
                do_action('updraft_backupnow_backup', array('nocloud' => 1, 'use_timestamp' => 0, 'use_nonce' => $backup_uuid));
            } /**
             * Only database backup
             */
            elseif ($include == 2) {
                do_action('updraft_backupnow_backup_database', array('nocloud' => 1, 'use_timestamp' => 0, 'use_nonce' => $backup_uuid));
            } /**
             * Backup both files and database
             */
            elseif ($include == 1) {
                do_action('updraft_backupnow_backup_all', array('nocloud' => 1, 'use_timestamp' => 0, 'use_nonce' => $backup_uuid));
            } /**
             * Default to full backup
             */
            else {
                do_action('updraft_backupnow_backup_all', array('nocloud' => 1, 'use_timestamp' => 0, 'use_nonce' => $backup_uuid));
            }
            $data = array("backup_uuid" => $backup_uuid);
            return backupsheep_nocache_response($data);
        } else {
            return backupsheep_nocache_response(array("error" => "parameter backup_uuid is missing."));
        }
    } else {
        $data = array("validate_backupsheep_key" => false);
        return backupsheep_nocache_response($data);
    }
}

/**
 * @return mixed
 */
function backupsheep_updraftplus_uuid()
{
    if (backupsheep_validate_key()) {
        $backup_uuid = substr(md5(time() . rand()), 20);
        $site_title = get_bloginfo('name');
        $data = array("uuid" => $backup_uuid, "title" => str_replace(" ", "_", $site_title));
    } else {
        $data = array("validate_backupsheep_key" => false);
    }
    return backupsheep_nocache_response($data);
}

/**
 * @return mixed
 */
function backupsheep_updraftplus_files()
{
    if (backupsheep_validate_key()) {
        if (isset($_GET['backup_uuid'])) {
            global $updraftplus;

            $backup_uuid = sanitize_key($_GET["backup_uuid"]);
            $backupFiles = glob($updraftplus->backups_dir_location() . '/*_' . $backup_uuid . '-*');

            foreach ($backupFiles as &$str) {
                $str = str_replace($updraftplus->backups_dir_location() . '/', '', $str);
            }

            $data = array("files" => $backupFiles);

            return backupsheep_nocache_response($data);
        } else {
            return backupsheep_nocache_response(array("error" => "parameter backup_uuid is missing."));
        }
    } else {
        $data = array("validate_backupsheep_key" => false);
        return backupsheep_nocache_response($data);
    }

}

/**
 * @return void|WP_Error|WP_HTTP_Response|WP_REST_Response
 */
function backupsheep_updraftplus_download()
{
    if (backupsheep_validate_key()) {
        if (isset($_GET['backup_file'])) {
            global $updraftplus;

            $randomTime = time();

            $backup_file = sanitize_text_field($_GET["backup_file"]);

            $updraft_backup_file = $updraftplus->backups_dir_location() . '/' . $backup_file;

            /**
             * Create directory in wp-content folder
             */
            wp_mkdir_p(WP_CONTENT_DIR . "/backupsheep");


            /**
             * Sometime .gz files are sent by server as text. So we will add .zip so we can download it.
             * It will be renamed back to .gz on BackupSheep server.
             * This happens only to database backup files.
             */
            if (backupsheep_ends_with($backup_file, '-db.gz')) {
                $backup_file .= ".zip";
            }

            /**
             * Move file from updraft folder to backupsheep folder, so we can download file.
             */
            $bs_backup_file = WP_CONTENT_DIR . "/backupsheep" . '/' . $backup_file;

            rename($updraft_backup_file, $bs_backup_file);

            /**
             * Redirect request to file we just moved
             */
            header("Location: " . WP_CONTENT_URL . "/backupsheep" . '/' . $backup_file . '?t=' . $randomTime);
            die();
        } else {
            return rest_ensure_response(array("error" => "parameter backup_file is required."));
        }
    } else {
        $data = array("validate_backupsheep_key" => false);
        return rest_ensure_response($data);
    }
}

/**
 * @return mixed
 */
function backupsheep_updraftplus_delete()
{
    if (backupsheep_validate_key()) {
        if (isset($_GET['backup_file']) && isset($_GET['backup_uuid'])) {
            global $updraftplus;

            $backup_file = sanitize_text_field($_GET["backup_file"]);
            $backup_uuid = sanitize_key($_GET["backup_uuid"]);

            /**
             * Sometime .gz files are sent by server as text. So we will add .zip so we can download it.
             * It will be renamed back to .gz on BackupSheep server.
             * This happens only to database backup files.
             */
            if (backupsheep_ends_with($backup_file, '-db.gz')) {
                $backup_file .= ".zip";
            }

            $file = WP_CONTENT_DIR . "/backupsheep" . '/' . $backup_file;

            if (is_file($file)) {
                unlink($file);
                return rest_ensure_response(array("deleted" => true, "file" => $file));
            } else {
                return rest_ensure_response(array("deleted" => false, "file" => $file));
            }
        } else {
            return rest_ensure_response(array("error" => "parameter backup_file & backup_uuid are required."));
        }
    } else {
        $data = array("validate_backupsheep_key" => false);
        return rest_ensure_response($data);
    }
}

/**
 * @return mixed
 */
function backupsheep_updraftplus_rebuild_history()
{
    if (backupsheep_validate_key()) {
        UpdraftPlus_Backup_History::rebuild(false, false, false);
        return rest_ensure_response(array("rebuild_history" => true));
    } else {
        $data = array("validate_backupsheep_key" => false);
        return rest_ensure_response($data);
    }
}

/**
 * Register with WordPress rest API
 */
add_action('rest_api_init', 'backupsheep_register_route');

/**
 * Activation hook to check if Updraft plugin is installed.
 */
register_activation_hook(__FILE__, 'backupsheep_plugin_activate');
function backupsheep_plugin_activate()
{

    if (!in_array('updraftplus/updraftplus.php', apply_filters('active_plugins', get_option('active_plugins')))) {
        // Stop activation redirect and show error
        wp_die('Sorry, but this plugin requires the Updraftplus (free/paid) Plugin to be installed and active. You don\'t need to make any changes in Updraft plugin. <a target="_blank" href="https://support.backupsheep.com/en/articles/6297220-how-to-backup-wordpress">BackupSheep WordPress Guide.</a> <br><a href="' . admin_url('plugins.php') . '">&laquo; Return to Plugins</a>');
    }
}

class BackupSheep
{
    private $backupsheep_options;

    public function __construct()
    {
        add_action('admin_menu', array($this, 'backupsheep_add_plugin_page'));
        add_action('admin_init', array($this, 'backupsheep_page_init'));
    }

    public function backupsheep_add_plugin_page()
    {
        add_options_page(
            'BackupSheep', // page_title
            'BackupSheep', // menu_title
            'manage_options', // capability
            'backupsheep', // menu_slug
            array($this, 'backupsheep_create_admin_page') // function
        );
    }

    public function backupsheep_create_admin_page()
    {
        $this->backupsheep_options = get_option('backupsheep_option_name'); ?>

        <div class="wrap">
            <h2>BackupSheep</h2>
            <p>When you configure WordPress integration in your BackupSheep account then copy the WordPress Key and
                add it into WordPress Key box bellow. <a href="https://support.backupsheep.com/en/articles/6297220-how-to-backup-wordpress" target="_blank">Learn More.</a> </p>
            <?php settings_errors(); ?>

            <form method="post" action="options.php">
                <?php
                settings_fields('backupsheep_option_group');
                do_settings_sections('backupsheep-admin');
                submit_button();
                ?>
            </form>
        </div>
    <?php }

    public function backupsheep_page_init()
    {
        register_setting(
            'backupsheep_option_group', // option_group
            'backupsheep_option_name', // option_name
            array($this, 'backupsheep_sanitize') // sanitize_callback
        );

        add_settings_section(
            'backupsheep_setting_section', // id
            'Settings', // title
            array($this, 'backupsheep_section_info'), // callback
            'backupsheep-admin' // page
        );

        add_settings_field(
            'bs_wordpress_key_0', // id
            'WordPress Key', // title
            array($this, 'bs_wordpress_key_0_callback'), // callback
            'backupsheep-admin', // page
            'backupsheep_setting_section' // section
        );
    }

    public function backupsheep_sanitize($input)
    {
        $sanitary_values = array();
        if (isset($input['bs_wordpress_key_0'])) {
            $sanitary_values['bs_wordpress_key_0'] = sanitize_text_field($input['bs_wordpress_key_0']);
        }

        return $sanitary_values;
    }

    public function backupsheep_section_info()
    {

    }

    public function bs_wordpress_key_0_callback()
    {
        printf(
            '<input class="regular-text" type="text" name="backupsheep_option_name[bs_wordpress_key_0]" id="bs_wordpress_key_0" value="%s">',
            isset($this->backupsheep_options['bs_wordpress_key_0']) ? esc_attr($this->backupsheep_options['bs_wordpress_key_0']) : ''
        );
    }

}

if (is_admin()) {
    $backupsheep = new BackupSheep();
}