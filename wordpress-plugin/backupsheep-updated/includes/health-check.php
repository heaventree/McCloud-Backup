<?php
/**
 * BackupSheep Health Check Class
 *
 * @package BackupSheep
 */

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

/**
 * Health Check class for monitoring WordPress site performance
 */
class BackupSheep_Health_Check {
    /**
     * Constructor
     */
    public function __construct() {
        // Nothing to initialize
    }
    
    /**
     * Run a comprehensive performance health check
     *
     * @return array Results of the health check
     */
    public function run_health_check() {
        backupsheep_log('Starting performance health check');
        
        $results = [
            'status' => 'success',
            'timestamp' => current_time('mysql'),
            'wordpress' => $this->check_wordpress(),
            'php' => $this->check_php(),
            'database' => $this->check_database(),
            'server' => $this->check_server(),
            'plugins' => $this->check_plugins(),
            'themes' => $this->check_themes(),
            'security' => $this->check_security(),
            'performance' => $this->check_performance(),
        ];
        
        $overall_health = $this->calculate_overall_health($results);
        $results['overall_health'] = $overall_health;
        
        backupsheep_log('Performance health check completed with overall health: ' . $overall_health['score'] . '%');
        
        return $results;
    }
    
    /**
     * Check WordPress configuration and status
     *
     * @return array
     */
    private function check_wordpress() {
        global $wp_version;
        
        $latest_version = $this->get_latest_wordpress_version();
        $is_latest = version_compare($wp_version, $latest_version, '>=');
        
        $check = [
            'version' => $wp_version,
            'latest_version' => $latest_version,
            'is_latest' => $is_latest,
            'updates' => [
                'core' => $this->get_core_updates(),
                'plugins' => $this->get_plugin_updates(),
                'themes' => $this->get_theme_updates(),
            ],
            'constants' => [
                'WP_DEBUG' => defined('WP_DEBUG') && WP_DEBUG,
                'WP_DEBUG_LOG' => defined('WP_DEBUG_LOG') && WP_DEBUG_LOG,
                'WP_DEBUG_DISPLAY' => defined('WP_DEBUG_DISPLAY') && WP_DEBUG_DISPLAY,
                'WP_MEMORY_LIMIT' => WP_MEMORY_LIMIT,
                'WP_MAX_MEMORY_LIMIT' => defined('WP_MAX_MEMORY_LIMIT') ? WP_MAX_MEMORY_LIMIT : 'Not defined',
                'DISALLOW_FILE_EDIT' => defined('DISALLOW_FILE_EDIT') && DISALLOW_FILE_EDIT,
            ],
            'file_permissions' => $this->check_file_permissions(),
            'multisite' => is_multisite(),
        ];
        
        // Add health score
        $check['health_score'] = $this->calculate_wordpress_health_score($check);
        $check['status'] = $this->get_status_from_score($check['health_score']);
        
        return $check;
    }
    
    /**
     * Check PHP configuration and status
     *
     * @return array
     */
    private function check_php() {
        $check = [
            'version' => phpversion(),
            'recommended_version' => '8.0.0',
            'is_supported' => version_compare(phpversion(), '7.4.0', '>='),
            'memory_limit' => ini_get('memory_limit'),
            'max_execution_time' => ini_get('max_execution_time'),
            'post_max_size' => ini_get('post_max_size'),
            'upload_max_filesize' => ini_get('upload_max_filesize'),
            'max_input_vars' => ini_get('max_input_vars'),
            'display_errors' => ini_get('display_errors'),
            'extensions' => [
                'mysql' => extension_loaded('mysql'),
                'mysqli' => extension_loaded('mysqli'),
                'curl' => extension_loaded('curl'),
                'gd' => extension_loaded('gd'),
                'imagick' => extension_loaded('imagick'),
                'json' => extension_loaded('json'),
                'xml' => extension_loaded('xml'),
                'mbstring' => extension_loaded('mbstring'),
                'openssl' => extension_loaded('openssl'),
                'zip' => extension_loaded('zip'),
            ],
        ];
        
        // Add health score
        $check['health_score'] = $this->calculate_php_health_score($check);
        $check['status'] = $this->get_status_from_score($check['health_score']);
        
        return $check;
    }
    
    /**
     * Check database configuration and status
     *
     * @return array
     */
    private function check_database() {
        global $wpdb;
        
        $tables = $wpdb->get_results('SHOW TABLE STATUS', ARRAY_A);
        $db_size = 0;
        $table_count = 0;
        
        if ($tables) {
            $table_count = count($tables);
            foreach ($tables as $table) {
                $db_size += $table['Data_length'] + $table['Index_length'];
            }
        }
        
        $check = [
            'version' => $wpdb->db_version(),
            'size' => $db_size,
            'size_formatted' => backupsheep_format_size($db_size),
            'tables_count' => $table_count,
            'prefix' => $wpdb->prefix,
            'charset' => $wpdb->charset,
            'collation' => $wpdb->collate,
            'autoload_size' => $this->get_autoload_size(),
        ];
        
        // Add health score
        $check['health_score'] = $this->calculate_database_health_score($check);
        $check['status'] = $this->get_status_from_score($check['health_score']);
        
        return $check;
    }
    
    /**
     * Check server configuration and status
     *
     * @return array
     */
    private function check_server() {
        $check = [
            'software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
            'php_sapi' => php_sapi_name(),
            'os' => PHP_OS,
            'ssl' => is_ssl(),
            'host_info' => $this->get_host_info(),
            'time' => current_time('mysql'),
            'timezone' => [
                'gmt_offset' => get_option('gmt_offset'),
                'timezone_string' => get_option('timezone_string'),
            ],
            'directory_size' => $this->get_directory_sizes(),
        ];
        
        // Add health score
        $check['health_score'] = $this->calculate_server_health_score($check);
        $check['status'] = $this->get_status_from_score($check['health_score']);
        
        return $check;
    }
    
    /**
     * Check plugins status
     *
     * @return array
     */
    private function check_plugins() {
        $all_plugins = get_plugins();
        $active_plugins = get_option('active_plugins', []);
        $inactive_count = count($all_plugins) - count($active_plugins);
        
        // Get plugins that have updates available
        $plugins_needing_update = $this->get_plugin_updates();
        
        $check = [
            'total' => count($all_plugins),
            'active' => count($active_plugins),
            'inactive' => $inactive_count,
            'updates_needed' => count($plugins_needing_update),
            'recently_activated' => get_option('recently_activated', []),
            'unoptimized' => $this->find_unoptimized_plugins($active_plugins),
        ];
        
        // Add health score
        $check['health_score'] = $this->calculate_plugins_health_score($check);
        $check['status'] = $this->get_status_from_score($check['health_score']);
        
        return $check;
    }
    
    /**
     * Check themes status
     *
     * @return array
     */
    private function check_themes() {
        $all_themes = wp_get_themes();
        $active_theme = wp_get_theme();
        $updates_needed = $this->get_theme_updates();
        
        $check = [
            'total' => count($all_themes),
            'active' => [
                'name' => $active_theme->get('Name'),
                'version' => $active_theme->get('Version'),
                'author' => $active_theme->get('Author'),
            ],
            'updates_needed' => count($updates_needed),
            'child_theme' => is_child_theme(),
        ];
        
        // Add health score
        $check['health_score'] = $this->calculate_themes_health_score($check);
        $check['status'] = $this->get_status_from_score($check['health_score']);
        
        return $check;
    }
    
    /**
     * Check security status
     *
     * @return array
     */
    private function check_security() {
        $check = [
            'file_editing' => !defined('DISALLOW_FILE_EDIT') || !DISALLOW_FILE_EDIT,
            'file_mods' => !defined('DISALLOW_FILE_MODS') || !DISALLOW_FILE_MODS,
            'ssl' => is_ssl(),
            'db_prefix' => $GLOBALS['wpdb']->prefix !== 'wp_',
            'users' => [
                'admin_user_exists' => $this->check_admin_user_exists(),
                'users_with_admin' => $this->count_admin_users(),
            ],
            'vulnerabilities' => $this->check_known_vulnerabilities(),
        ];
        
        // Add health score
        $check['health_score'] = $this->calculate_security_health_score($check);
        $check['status'] = $this->get_status_from_score($check['health_score']);
        
        return $check;
    }
    
    /**
     * Check performance status
     *
     * @return array
     */
    private function check_performance() {
        $check = [
            'transients' => $this->count_transients(),
            'post_revisions' => $this->count_post_revisions(),
            'auto_drafts' => $this->count_auto_drafts(),
            'trash_posts' => $this->count_trash_posts(),
            'spam_comments' => $this->count_spam_comments(),
            'cron_jobs' => $this->get_cron_jobs(),
            'cache' => [
                'object_cache' => wp_using_ext_object_cache(),
                'page_cache' => $this->detect_page_cache(),
            ],
        ];
        
        // Add health score
        $check['health_score'] = $this->calculate_performance_health_score($check);
        $check['status'] = $this->get_status_from_score($check['health_score']);
        
        return $check;
    }
    
    /**
     * Calculate overall health score based on all component scores
     *
     * @param array $results
     * @return array
     */
    private function calculate_overall_health($results) {
        $components = [
            'wordpress' => [
                'score' => $results['wordpress']['health_score'],
                'weight' => 15,
            ],
            'php' => [
                'score' => $results['php']['health_score'],
                'weight' => 15,
            ],
            'database' => [
                'score' => $results['database']['health_score'],
                'weight' => 15,
            ],
            'server' => [
                'score' => $results['server']['health_score'],
                'weight' => 10,
            ],
            'plugins' => [
                'score' => $results['plugins']['health_score'],
                'weight' => 15,
            ],
            'themes' => [
                'score' => $results['themes']['health_score'],
                'weight' => 5,
            ],
            'security' => [
                'score' => $results['security']['health_score'],
                'weight' => 15,
            ],
            'performance' => [
                'score' => $results['performance']['health_score'],
                'weight' => 10,
            ],
        ];
        
        $total_score = 0;
        $total_weight = 0;
        
        foreach ($components as $component => $data) {
            $total_score += $data['score'] * $data['weight'];
            $total_weight += $data['weight'];
        }
        
        $overall_score = $total_weight > 0 ? round($total_score / $total_weight) : 0;
        
        return [
            'score' => $overall_score,
            'status' => $this->get_status_from_score($overall_score),
            'components' => $components,
        ];
    }
    
    /**
     * Calculate WordPress health score
     *
     * @param array $data
     * @return int
     */
    private function calculate_wordpress_health_score($data) {
        $score = 100;
        
        // Version check
        if (!$data['is_latest']) {
            $score -= 15;
        }
        
        // Updates check
        if (count($data['updates']['core']) > 0) {
            $score -= 15;
        }
        
        if (count($data['updates']['plugins']) > 0) {
            $score -= 10;
        }
        
        if (count($data['updates']['themes']) > 0) {
            $score -= 5;
        }
        
        // File permissions check
        if (!empty($data['file_permissions']['issues'])) {
            $score -= min(count($data['file_permissions']['issues']) * 5, 20);
        }
        
        // Debug settings in production
        if ($data['constants']['WP_DEBUG'] && $data['constants']['WP_DEBUG_DISPLAY']) {
            $score -= 10;
        }
        
        return max(0, min(100, $score));
    }
    
    /**
     * Calculate PHP health score
     *
     * @param array $data
     * @return int
     */
    private function calculate_php_health_score($data) {
        $score = 100;
        
        // Version check
        if (!$data['is_supported']) {
            $score -= 30;
        } elseif (version_compare($data['version'], $data['recommended_version'], '<')) {
            $score -= 15;
        }
        
        // PHP settings
        if (ini_get('display_errors') == '1') {
            $score -= 10;
        }
        
        // Memory limit
        $memory = $this->parse_size($data['memory_limit']);
        if ($memory < 128 * 1024 * 1024) {
            $score -= 10;
        }
        
        // Max execution time
        if ($data['max_execution_time'] < 30 && $data['max_execution_time'] != 0) {
            $score -= 10;
        }
        
        // Critical extensions
        $critical_extensions = ['mysqli', 'curl', 'json', 'xml', 'openssl'];
        foreach ($critical_extensions as $ext) {
            if (empty($data['extensions'][$ext])) {
                $score -= 10;
            }
        }
        
        return max(0, min(100, $score));
    }
    
    /**
     * Calculate database health score
     *
     * @param array $data
     * @return int
     */
    private function calculate_database_health_score($data) {
        $score = 100;
        
        // Database size
        if ($data['size'] > 500 * 1024 * 1024) {
            $score -= 10;
        }
        
        // Autoloaded data
        if ($data['autoload_size'] > 5 * 1024 * 1024) {
            $score -= 15;
        } elseif ($data['autoload_size'] > 1 * 1024 * 1024) {
            $score -= 5;
        }
        
        // Table prefix
        if ($data['prefix'] === 'wp_') {
            $score -= 5;
        }
        
        return max(0, min(100, $score));
    }
    
    /**
     * Calculate server health score
     *
     * @param array $data
     * @return int
     */
    private function calculate_server_health_score($data) {
        $score = 100;
        
        // SSL
        if (!$data['ssl']) {
            $score -= 15;
        }
        
        // Directory sizes
        if ($data['directory_size']['uploads'] > 1024 * 1024 * 1024) {
            $score -= 10;
        }
        
        return max(0, min(100, $score));
    }
    
    /**
     * Calculate plugins health score
     *
     * @param array $data
     * @return int
     */
    private function calculate_plugins_health_score($data) {
        $score = 100;
        
        // Too many plugins
        if ($data['total'] > 30) {
            $score -= 15;
        } elseif ($data['total'] > 20) {
            $score -= 5;
        }
        
        // Too many active plugins
        if ($data['active'] > 20) {
            $score -= 15;
        } elseif ($data['active'] > 15) {
            $score -= 10;
        } elseif ($data['active'] > 10) {
            $score -= 5;
        }
        
        // Updates needed
        if ($data['updates_needed'] > 5) {
            $score -= 15;
        } elseif ($data['updates_needed'] > 0) {
            $score -= 10;
        }
        
        // Unoptimized plugins
        if (count($data['unoptimized']) > 3) {
            $score -= 15;
        } elseif (count($data['unoptimized']) > 0) {
            $score -= 5 * count($data['unoptimized']);
        }
        
        return max(0, min(100, $score));
    }
    
    /**
     * Calculate themes health score
     *
     * @param array $data
     * @return int
     */
    private function calculate_themes_health_score($data) {
        $score = 100;
        
        // Too many themes
        if ($data['total'] > 10) {
            $score -= 10;
        } elseif ($data['total'] > 5) {
            $score -= 5;
        }
        
        // Updates needed
        if ($data['updates_needed'] > 0) {
            $score -= 10;
        }
        
        // Child theme
        if (!$data['child_theme']) {
            $score -= 5;
        }
        
        return max(0, min(100, $score));
    }
    
    /**
     * Calculate security health score
     *
     * @param array $data
     * @return int
     */
    private function calculate_security_health_score($data) {
        $score = 100;
        
        // File editing
        if ($data['file_editing']) {
            $score -= 10;
        }
        
        // SSL
        if (!$data['ssl']) {
            $score -= 15;
        }
        
        // Database prefix
        if (!$data['db_prefix']) {
            $score -= 5;
        }
        
        // Admin users
        if ($data['users']['admin_user_exists']) {
            $score -= 15;
        }
        
        if ($data['users']['users_with_admin'] > 2) {
            $score -= 10;
        }
        
        // Vulnerabilities
        if ($data['vulnerabilities']['total'] > 0) {
            $score -= min($data['vulnerabilities']['total'] * 10, 30);
        }
        
        return max(0, min(100, $score));
    }
    
    /**
     * Calculate performance health score
     *
     * @param array $data
     * @return int
     */
    private function calculate_performance_health_score($data) {
        $score = 100;
        
        // Transients
        if ($data['transients'] > 1000) {
            $score -= 10;
        } elseif ($data['transients'] > 500) {
            $score -= 5;
        }
        
        // Post revisions
        if ($data['post_revisions'] > 1000) {
            $score -= 15;
        } elseif ($data['post_revisions'] > 500) {
            $score -= 10;
        } elseif ($data['post_revisions'] > 100) {
            $score -= 5;
        }
        
        // Auto drafts
        if ($data['auto_drafts'] > 50) {
            $score -= 5;
        }
        
        // Trash posts
        if ($data['trash_posts'] > 100) {
            $score -= 5;
        }
        
        // Spam comments
        if ($data['spam_comments'] > 1000) {
            $score -= 10;
        } elseif ($data['spam_comments'] > 100) {
            $score -= 5;
        }
        
        // Cron jobs
        if (count($data['cron_jobs']) > 50) {
            $score -= 10;
        }
        
        // Object cache
        if (!$data['cache']['object_cache']) {
            $score -= 10;
        }
        
        // Page cache
        if (!$data['cache']['page_cache']) {
            $score -= 10;
        }
        
        return max(0, min(100, $score));
    }
    
    /**
     * Get status text from score
     *
     * @param int $score
     * @return string
     */
    private function get_status_from_score($score) {
        if ($score >= 90) {
            return 'excellent';
        } elseif ($score >= 75) {
            return 'good';
        } elseif ($score >= 50) {
            return 'fair';
        } elseif ($score >= 25) {
            return 'poor';
        } else {
            return 'critical';
        }
    }
    
    /**
     * Get latest WordPress version from API
     *
     * @return string
     */
    private function get_latest_wordpress_version() {
        $version_check = get_site_transient('update_core');
        
        if (isset($version_check->updates[0]->version)) {
            return $version_check->updates[0]->version;
        }
        
        return get_bloginfo('version');
    }
    
    /**
     * Get available core updates
     *
     * @return array
     */
    private function get_core_updates() {
        $version_check = get_site_transient('update_core');
        
        if (!isset($version_check->updates)) {
            return [];
        }
        
        return array_filter($version_check->updates, function($update) {
            return $update->response === 'upgrade';
        });
    }
    
    /**
     * Get available plugin updates
     *
     * @return array
     */
    private function get_plugin_updates() {
        $update_plugins = get_site_transient('update_plugins');
        
        if (!isset($update_plugins->response) || !is_array($update_plugins->response)) {
            return [];
        }
        
        return $update_plugins->response;
    }
    
    /**
     * Get available theme updates
     *
     * @return array
     */
    private function get_theme_updates() {
        $update_themes = get_site_transient('update_themes');
        
        if (!isset($update_themes->response) || !is_array($update_themes->response)) {
            return [];
        }
        
        return $update_themes->response;
    }
    
    /**
     * Check file permissions
     *
     * @return array
     */
    private function check_file_permissions() {
        $issues = [];
        $paths_to_check = [
            ABSPATH => '750',
            ABSPATH . 'wp-admin/' => '750',
            ABSPATH . 'wp-includes/' => '750',
            WP_CONTENT_DIR => '755',
            get_theme_root() => '755',
            WP_PLUGIN_DIR => '755',
            ABSPATH . 'wp-config.php' => '600',
        ];
        
        foreach ($paths_to_check as $path => $recommended) {
            if (!file_exists($path)) {
                continue;
            }
            
            $actual = substr(sprintf('%o', fileperms($path)), -3);
            
            if ($this->is_permission_too_permissive($actual, $recommended)) {
                $issues[] = [
                    'path' => $path,
                    'actual' => $actual,
                    'recommended' => $recommended,
                ];
            }
        }
        
        return [
            'issues' => $issues,
        ];
    }
    
    /**
     * Check if a file permission is too permissive
     *
     * @param string $actual
     * @param string $recommended
     * @return bool
     */
    private function is_permission_too_permissive($actual, $recommended) {
        // Convert octal strings to integers
        $actual_int = intval($actual, 8);
        $recommended_int = intval($recommended, 8);
        
        // Check if actual permissions are more permissive than recommended
        return $actual_int > $recommended_int;
    }
    
    /**
     * Get size of autoloaded options
     *
     * @return int
     */
    private function get_autoload_size() {
        global $wpdb;
        
        $autoload_size = $wpdb->get_var($wpdb->prepare(
            "SELECT SUM(LENGTH(option_value)) FROM $wpdb->options WHERE autoload = %s",
            'yes'
        ));
        
        return $autoload_size ? (int) $autoload_size : 0;
    }
    
    /**
     * Get host information
     *
     * @return array
     */
    private function get_host_info() {
        $host_info = [];
        
        // Check if site is running on a known hosting provider
        $host_info['provider'] = $this->detect_hosting_provider();
        
        return $host_info;
    }
    
    /**
     * Detect hosting provider based on server environment
     *
     * @return string
     */
    private function detect_hosting_provider() {
        $provider = 'Unknown';
        $server_addr = $_SERVER['SERVER_ADDR'] ?? '';
        $server_name = $_SERVER['SERVER_NAME'] ?? '';
        $server_software = $_SERVER['SERVER_SOFTWARE'] ?? '';
        
        // Check for known hosting providers
        if (defined('WPE_APIKEY')) {
            $provider = 'WP Engine';
        } elseif (defined('PAGELYBIN')) {
            $provider = 'Pagely';
        } elseif (function_exists('is_wpe') && is_wpe()) {
            $provider = 'WP Engine';
        } elseif (strpos($server_name, '.wpengine.com') !== false) {
            $provider = 'WP Engine';
        } elseif (strpos($server_name, '.pantheonsite.io') !== false) {
            $provider = 'Pantheon';
        } elseif (strpos($server_name, '.kinsta.com') !== false) {
            $provider = 'Kinsta';
        } elseif (strpos($server_software, 'LiteSpeed') !== false) {
            $provider = 'LiteSpeed';
        } elseif (file_exists('/etc/cloudlinux-release')) {
            $provider = 'CloudLinux';
        } elseif (file_exists('/etc/plesk-release')) {
            $provider = 'Plesk';
        } elseif (file_exists('/etc/cpanel-release')) {
            $provider = 'cPanel';
        } elseif (getenv('FLYWHEEL_SITE_DIR')) {
            $provider = 'Flywheel';
        } elseif (getenv('IS_WPE')) {
            $provider = 'WP Engine';
        }
        
        return $provider;
    }
    
    /**
     * Get directory sizes
     *
     * @return array
     */
    private function get_directory_sizes() {
        $sizes = [
            'wordpress' => $this->get_directory_size(ABSPATH),
            'wp-content' => $this->get_directory_size(WP_CONTENT_DIR),
            'uploads' => $this->get_directory_size(wp_upload_dir()['basedir']),
            'plugins' => $this->get_directory_size(WP_PLUGIN_DIR),
            'themes' => $this->get_directory_size(get_theme_root()),
        ];
        
        return $sizes;
    }
    
    /**
     * Get the size of a directory in bytes
     *
     * @param string $path
     * @return int
     */
    private function get_directory_size($path) {
        $size = 0;
        
        // Use a quick estimate for performance reasons
        if (function_exists('exec') && exec('command -v du')) {
            $output = [];
            exec('du -sk ' . escapeshellarg($path), $output);
            
            if (isset($output[0])) {
                $size = preg_replace('/[^\d]/', '', $output[0]) * 1024;
            }
        } else {
            // Fallback to a PHP implementation - but be careful with large directories
            $size = 0;
            
            // Set a time limit to avoid timeouts
            $time_limit = 5; // seconds
            $start_time = microtime(true);
            
            foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS)) as $file) {
                $size += $file->getSize();
                
                // Check if we're approaching the time limit
                if (microtime(true) - $start_time > $time_limit) {
                    // Mark the result as an estimate
                    $size = -$size; // negative value indicates estimate
                    break;
                }
            }
        }
        
        return $size;
    }
    
    /**
     * Find plugins that might cause performance issues
     *
     * @param array $active_plugins
     * @return array
     */
    private function find_unoptimized_plugins($active_plugins) {
        $problematic_plugins = [];
        $all_plugins = get_plugins();
        
        // List of plugin slugs known to impact performance
        $known_heavy_plugins = [
            'wordfence/wordfence.php' => 'Security plugin with high resource usage',
            'wp-statistics/wp-statistics.php' => 'Statistics plugin with database overhead',
            'broken-link-checker/broken-link-checker.php' => 'Constant background scanning',
            'hello-dolly/hello.php' => 'Unnecessary plugin',
            'woocommerce-checkout-field-editor/woocommerce-checkout-field-editor.php' => 'Heavy WooCommerce addon',
            'woocommerce-product-addons/woocommerce-product-addons.php' => 'Complex product configurations',
            'woocommerce-advanced-shipping/woocommerce-advanced-shipping.php' => 'Complex shipping rules',
            'mailchimp-for-woocommerce/mailchimp-woocommerce.php' => 'Background syncing',
            'jetpack/jetpack.php' => 'Multiple modules',
            'sitepress-multilingual-cms/sitepress.php' => 'Translation overhead',
        ];
        
        foreach ($active_plugins as $plugin) {
            if (array_key_exists($plugin, $known_heavy_plugins)) {
                $plugin_data = $all_plugins[$plugin];
                $problematic_plugins[] = [
                    'name' => $plugin_data['Name'],
                    'slug' => $plugin,
                    'reason' => $known_heavy_plugins[$plugin],
                ];
            }
        }
        
        return $problematic_plugins;
    }
    
    /**
     * Check if admin user exists
     *
     * @return bool
     */
    private function check_admin_user_exists() {
        $user = get_user_by('login', 'admin');
        return $user !== false;
    }
    
    /**
     * Count users with administrator role
     *
     * @return int
     */
    private function count_admin_users() {
        $args = [
            'role' => 'administrator',
            'fields' => ['ID'],
        ];
        
        $users = get_users($args);
        return count($users);
    }
    
    /**
     * Check for known vulnerabilities (basic version)
     *
     * @return array
     */
    private function check_known_vulnerabilities() {
        // In a real implementation, this would check against a vulnerability database
        // For now, we'll return a placeholder result
        return [
            'total' => 0,
            'items' => [],
        ];
    }
    
    /**
     * Count transients in the database
     *
     * @return int
     */
    private function count_transients() {
        global $wpdb;
        
        $count = $wpdb->get_var("
            SELECT COUNT(*)
            FROM $wpdb->options
            WHERE option_name LIKE '%_transient_%'
        ");
        
        return $count ? (int) $count : 0;
    }
    
    /**
     * Count post revisions
     *
     * @return int
     */
    private function count_post_revisions() {
        global $wpdb;
        
        $count = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $wpdb->posts WHERE post_type = %s",
            'revision'
        ));
        
        return $count ? (int) $count : 0;
    }
    
    /**
     * Count auto drafts
     *
     * @return int
     */
    private function count_auto_drafts() {
        global $wpdb;
        
        $count = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $wpdb->posts WHERE post_status = %s",
            'auto-draft'
        ));
        
        return $count ? (int) $count : 0;
    }
    
    /**
     * Count trash posts
     *
     * @return int
     */
    private function count_trash_posts() {
        global $wpdb;
        
        $count = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $wpdb->posts WHERE post_status = %s",
            'trash'
        ));
        
        return $count ? (int) $count : 0;
    }
    
    /**
     * Count spam comments
     *
     * @return int
     */
    private function count_spam_comments() {
        global $wpdb;
        
        $count = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $wpdb->comments WHERE comment_approved = %s",
            'spam'
        ));
        
        return $count ? (int) $count : 0;
    }
    
    /**
     * Get cron jobs
     *
     * @return array
     */
    private function get_cron_jobs() {
        $crons = _get_cron_array();
        $jobs = [];
        
        if (is_array($crons)) {
            foreach ($crons as $time => $hooks) {
                foreach ($hooks as $hook => $data) {
                    foreach ($data as $key => $event) {
                        $jobs[] = [
                            'hook' => $hook,
                            'time' => $time,
                            'schedule' => $event['schedule'] ?? 'single',
                            'interval' => isset($event['interval']) ? $event['interval'] : 0,
                        ];
                    }
                }
            }
        }
        
        return $jobs;
    }
    
    /**
     * Detect if a page cache is being used
     *
     * @return bool
     */
    private function detect_page_cache() {
        // Check for common page caching plugins/features
        if (defined('WP_CACHE') && WP_CACHE) {
            return true;
        }
        
        $caching_plugins = [
            'wp-super-cache/wp-cache.php',
            'w3-total-cache/w3-total-cache.php',
            'litespeed-cache/litespeed-cache.php',
            'wp-fastest-cache/wpFastestCache.php',
            'autoptimize/autoptimize.php',
            'cache-enabler/cache-enabler.php',
            'redis-cache/redis-cache.php',
            'wp-redis/wp-redis.php',
        ];
        
        foreach ($caching_plugins as $plugin) {
            if (is_plugin_active($plugin)) {
                return true;
            }
        }
        
        // Check for server-level caching
        $server_software = $_SERVER['SERVER_SOFTWARE'] ?? '';
        if (
            strpos($server_software, 'LiteSpeed') !== false ||
            strpos($server_software, 'Nginx') !== false ||
            strpos($server_software, 'Varnish') !== false
        ) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Parse PHP size value
     *
     * @param string $size
     * @return int
     */
    private function parse_size($size) {
        $unit = preg_replace('/[^bkmgtpezy]/i', '', $size);
        $size = preg_replace('/[^0-9\.]/', '', $size);
        
        if ($unit) {
            return round($size * pow(1024, stripos('bkmgtpezy', $unit[0])));
        }
        
        return round($size);
    }
}