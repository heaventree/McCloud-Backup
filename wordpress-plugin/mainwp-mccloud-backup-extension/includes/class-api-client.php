<?php
/**
 * Thin client for the McCloud Backup server's account-level MainWP API
 * (server/routes/mainwp.ts), authenticated with a single account-level API
 * key configured once in this extension's settings screen.
 */
if (!defined('ABSPATH')) exit;

class MainWP_McCloud_Backup_Api_Client {

    /** @var string */
    private $base_url;

    /** @var string */
    private $api_key;

    public function __construct() {
        $this->base_url = rtrim(get_option('mccloud_backup_mainwp_api_url', 'https://api.mccloud-backup.com/api/mainwp'), '/');
        $this->api_key  = get_option('mccloud_backup_mainwp_api_key', '');
    }

    public function has_api_key() {
        return !empty($this->api_key);
    }

    /**
     * @return array|WP_Error Decoded JSON body, or WP_Error on transport/HTTP failure.
     */
    private function request($path, $method = 'GET', $body = null) {
        if (empty($this->api_key)) {
            return new WP_Error('missing_api_key', __('McCloud Backup API key is not configured.', 'mainwp-mccloud-backup-extension'));
        }

        $args = [
            'method'  => $method,
            'timeout' => 30,
            'headers' => [
                'Authorization' => 'Bearer ' . $this->api_key,
                'Content-Type'  => 'application/json',
                'Accept'        => 'application/json',
            ],
        ];

        if ($body !== null) {
            $args['body'] = wp_json_encode($body);
        }

        $response = wp_remote_request($this->base_url . '/' . ltrim($path, '/'), $args);

        if (is_wp_error($response)) {
            return $response;
        }

        $code = wp_remote_retrieve_response_code($response);
        $data = json_decode(wp_remote_retrieve_body($response), true);

        if ($code >= 400) {
            $message = $data['message'] ?? __('McCloud Backup API request failed.', 'mainwp-mccloud-backup-extension');
            return new WP_Error('api_error', $message, ['status' => $code]);
        }

        return $data;
    }

    /**
     * @return array|WP_Error List of site statuses: { id, name, url, connected, lastBackup, lastBackupStatus, nextRun }
     */
    public function get_sites_status() {
        $result = $this->request('sites/status', 'GET');
        if (is_wp_error($result)) {
            return $result;
        }
        return $result['sites'] ?? [];
    }

    /**
     * @param int $site_id McCloud Backup's own site id (not the MainWP site id).
     * @return array|WP_Error
     */
    public function run_backup_now($site_id) {
        return $this->request('sites/' . intval($site_id) . '/backup-now', 'POST');
    }
}
