<?php
/**
 * BackupSheep API Class
 *
 * @package BackupSheep
 */

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

/**
 * API class for communicating with the BackupSheep API
 */
class BackupSheep_API {
    /**
     * API URL
     *
     * @var string
     */
    private $api_url;
    
    /**
     * API key
     *
     * @var string
     */
    private $api_key;
    
    /**
     * Site ID
     *
     * @var string
     */
    private $site_id;
    
    /**
     * Constructor
     */
    public function __construct() {
        $options = get_option('backupsheep_options', []);
        
        $this->api_url = defined('BACKUPSHEEP_API_URL') ? BACKUPSHEEP_API_URL : 'https://api.backupsheep.com/v2';
        $this->api_key = $options['api_key'] ?? '';
        $this->site_id = $options['site_id'] ?? '';
    }
    
    /**
     * Send request to API
     *
     * @param string $endpoint
     * @param array $data
     * @param string $method
     * @return array|WP_Error
     */
    public function send($endpoint, $data = [], $method = 'POST') {
        // Check if API key and site ID are set
        if (empty($this->api_key) || empty($this->site_id)) {
            return new WP_Error('missing_credentials', __('API key or site ID is missing', 'backupsheep'));
        }
        
        // Prepare URL
        $url = rtrim($this->api_url, '/') . '/' . ltrim($endpoint, '/');
        
        // Add common data
        $data = array_merge($data, [
            'site_id' => $this->site_id,
            'plugin_version' => BACKUPSHEEP_VERSION,
            'wordpress_version' => get_bloginfo('version'),
        ]);
        
        // Prepare request arguments
        $args = [
            'method' => $method,
            'timeout' => 30,
            'redirection' => 5,
            'httpversion' => '1.1',
            'blocking' => true,
            'headers' => [
                'Authorization' => 'Bearer ' . $this->api_key,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
                'User-Agent' => 'BackupSheep/' . BACKUPSHEEP_VERSION . '; WordPress/' . get_bloginfo('version'),
            ],
            'body' => json_encode($data),
        ];
        
        // Send request
        $response = wp_remote_request($url, $args);
        
        // Check for errors
        if (is_wp_error($response)) {
            backupsheep_log('API request error: ' . $response->get_error_message(), 'error');
            return $response;
        }
        
        // Get response code
        $response_code = wp_remote_retrieve_response_code($response);
        
        // Parse response body
        $body = wp_remote_retrieve_body($response);
        $result = json_decode($body, true);
        
        // Handle error responses
        if ($response_code >= 400) {
            $error_message = isset($result['message']) ? $result['message'] : __('Unknown API error', 'backupsheep');
            backupsheep_log("API request failed ({$response_code}): {$error_message}", 'error');
            return new WP_Error('api_error', $error_message, ['status' => $response_code]);
        }
        
        return $result;
    }
    
    /**
     * Test API connection
     *
     * @return bool|WP_Error
     */
    public function test_connection() {
        $result = $this->send('site/ping', [], 'GET');
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        if (isset($result['status']) && $result['status'] === 'success') {
            return true;
        }
        
        return new WP_Error('api_error', __('API connection test failed', 'backupsheep'));
    }
    
    /**
     * Register site with BackupSheep API
     *
     * @return array|WP_Error
     */
    public function register_site() {
        $data = [
            'site_id' => $this->site_id,
            'name' => get_bloginfo('name'),
            'url' => site_url(),
            'admin_email' => get_option('admin_email'),
            'is_multisite' => is_multisite(),
            'server_info' => backupsheep_get_server_info(),
            'plugins' => backupsheep_get_plugins_list(),
            'themes' => backupsheep_get_themes_list(),
        ];
        
        return $this->send('site/register', $data);
    }
    
    /**
     * Update site information
     *
     * @return array|WP_Error
     */
    public function update_site_info() {
        $data = [
            'name' => get_bloginfo('name'),
            'url' => site_url(),
            'admin_email' => get_option('admin_email'),
            'is_multisite' => is_multisite(),
            'server_info' => backupsheep_get_server_info(),
            'plugins' => backupsheep_get_plugins_list(),
            'themes' => backupsheep_get_themes_list(),
        ];
        
        return $this->send('site/update', $data);
    }
    
    /**
     * Get backup history from API
     *
     * @param int $limit
     * @return array|WP_Error
     */
    public function get_backup_history($limit = 20) {
        return $this->send('backup/history?limit=' . $limit, [], 'GET');
    }
    
    /**
     * Get storage providers from API
     *
     * @return array|WP_Error
     */
    public function get_storage_providers() {
        return $this->send('storage/providers', [], 'GET');
    }
}