<?php
/**
 * McCloud Backup - Native Backup Engine
 *
 * Captures a full WordPress site (database + wp-content + wp-config.php) natively,
 * with no dependency on UpdraftPlus or any other third-party backup plugin.
 *
 * Execution is asynchronous: start() schedules a single WP-Cron event and kicks it
 * immediately via spawn_cron(), so the REST request that triggers a backup returns
 * right away instead of blocking for however long the export takes.
 *
 * @package BackupSheep
 */

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

class McCloudBackup_Backup {

    /**
     * Constructor - hook the async worker to its cron event
     */
    public function __construct() {
        add_action('mccloud_backup_run_event', [$this, 'run_backup'], 10, 3);
    }

    /**
     * Get the (protected, .htaccess-locked) directory backup output lives in
     *
     * @return string
     */
    private function get_backup_dir() {
        $upload_dir = wp_upload_dir();
        $dir = trailingslashit($upload_dir['basedir']) . 'backupsheep';

        if (!file_exists($dir)) {
            wp_mkdir_p($dir);
        }

        return $dir;
    }

    /**
     * Start a backup: log it as pending, schedule the async worker, kick cron.
     *
     * @param string $backup_id
     * @param string $type 'full'|'database'|'files'
     * @param string[] $exclusions Extra path substrings to exclude, additive to the site's
     *   own backupsheep_options['exclusions'] - see get_exclusion_patterns().
     * @return true|WP_Error
     */
    public function start($backup_id, $type = 'full', $exclusions = []) {
        global $wpdb;

        if (!is_array($exclusions)) {
            $exclusions = [];
        }

        if (!in_array($type, ['full', 'database', 'files'], true)) {
            $type = 'full';
        }

        $table_name = $wpdb->prefix . 'backupsheep_logs';

        $inserted = $wpdb->insert(
            $table_name,
            [
                'backup_id' => $backup_id,
                'type' => $type,
                'status' => 'pending',
                'start_time' => gmdate('Y-m-d H:i:s'),
            ]
        );

        if (false === $inserted) {
            return new WP_Error('log_insert_failed', __('Failed to create backup log entry', 'backupsheep'));
        }

        backupsheep_log("Scheduled {$type} backup with ID: {$backup_id}");

        // Schedule the actual work as its own cron event so this request can return immediately.
        wp_schedule_single_event(time(), 'mccloud_backup_run_event', [$backup_id, $type, $exclusions]);

        // Nudge WP-Cron to run right away instead of waiting for the next real visitor.
        // Deliberately NOT using spawn_cron() here: it silently no-ops whenever DISABLE_WP_CRON
        // is set, which is the norm on professionally-managed hosts that drive wp-cron.php from
        // a real system cron job instead. That's the right default for routine background tasks,
        // but the site owner just explicitly asked (via this REST call) for a backup to run now -
        // so we fire the same loopback request spawn_cron() would, without its DISABLE_WP_CRON
        // guard, to actually honor that.
        $cron_url = site_url('wp-cron.php?doing_wp_cron=' . microtime(true));
        wp_remote_post($cron_url, [
            'timeout' => 0.5,
            'blocking' => false,
            'sslverify' => apply_filters('https_local_ssl_verify', false),
        ]);

        return true;
    }

    /**
     * The async worker. Runs inside its own WP-Cron request.
     *
     * @param string $backup_id
     * @param string $type
     * @param string[] $exclusions
     * @return void
     */
    public function run_backup($backup_id, $type, $exclusions = []) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'backupsheep_logs';

        if (!is_array($exclusions)) {
            $exclusions = [];
        }

        // Give this a real shot at finishing before PHP's default timeout kicks in.
        if (function_exists('set_time_limit')) {
            @set_time_limit(0);
        }

        $wpdb->update(
            $table_name,
            ['status' => 'running'],
            ['backup_id' => $backup_id]
        );

        backupsheep_log("Starting native {$type} backup: {$backup_id}");

        $files = [];
        $total_size = 0;

        try {
            if ($type === 'full' || $type === 'database') {
                $db_result = $this->export_database($backup_id);
                $files[] = $db_result;
                $total_size += $db_result['size'];
            }

            if ($type === 'full' || $type === 'files') {
                $files_result = $this->export_files($backup_id, $exclusions);
                $files[] = $files_result;
                $total_size += $files_result['size'];
            }

            // Optionally encrypt each output file, matching the plugin's existing encryption setting.
            $options = get_option('backupsheep_options', []);
            $encrypted = false;

            if (!empty($options['enable_encryption']) && !empty($options['encryption_key'])) {
                foreach ($files as &$file) {
                    $full_path = $this->get_backup_dir() . '/' . $file['name'];
                    $result = backupsheep_encrypt_backup($full_path, $options['encryption_key']);

                    if (!is_wp_error($result)) {
                        $file['name'] = basename($result);
                        $file['size'] = filesize($result);
                        $encrypted = true;
                    } else {
                        backupsheep_log("Encryption failed for {$file['name']}: " . $result->get_error_message(), 'error');
                    }
                }
                unset($file);
            }

            $update = [
                'status' => 'completed',
                'end_time' => gmdate('Y-m-d H:i:s'),
                'size' => $total_size,
                'file_count' => count($files),
                'files' => wp_json_encode($files),
            ];

            if ($encrypted) {
                $update['encrypted'] = 1;
                $update['encryption_method'] = !empty($options['encryption_method']) ? $options['encryption_method'] : 'aes-256-cbc';
            }

            $wpdb->update($table_name, $update, ['backup_id' => $backup_id]);

            backupsheep_log("Backup completed: {$backup_id} (" . backupsheep_format_size($total_size) . ")");
        } catch (Exception $e) {
            backupsheep_log("Backup failed: {$backup_id} - " . $e->getMessage(), 'error');

            $wpdb->update(
                $table_name,
                [
                    'status' => 'error',
                    'end_time' => gmdate('Y-m-d H:i:s'),
                    'error_message' => $e->getMessage(),
                ],
                ['backup_id' => $backup_id]
            );
        }
    }

    /**
     * Export the full database to a gzipped SQL file using $wpdb directly.
     * No shell_exec/mysqldump dependency, so this works on locked-down shared hosting too.
     *
     * @param string $backup_id
     * @return array{name: string, type: string, size: int}
     * @throws Exception
     */
    private function export_database($backup_id) {
        global $wpdb;

        $filename = "{$backup_id}-db.sql.gz";
        $path = $this->get_backup_dir() . '/' . $filename;

        $gz = gzopen($path, 'wb9');
        if (!$gz) {
            throw new Exception('Could not open database export file for writing');
        }

        gzwrite($gz, "-- McCloud Backup native database export\n");
        gzwrite($gz, "-- Site: " . site_url() . "\n");
        gzwrite($gz, "-- Generated: " . gmdate('Y-m-d H:i:s') . " UTC\n\n");
        gzwrite($gz, "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n\n");

        $tables = $wpdb->get_col('SHOW TABLES');

        foreach ($tables as $table) {
            // Schema
            $create = $wpdb->get_row("SHOW CREATE TABLE `{$table}`", ARRAY_N);
            if (!$create || empty($create[1])) {
                continue;
            }

            gzwrite($gz, "\n--\n-- Table: {$table}\n--\n\n");
            gzwrite($gz, "DROP TABLE IF EXISTS `{$table}`;\n");
            gzwrite($gz, $create[1] . ";\n\n");

            // Data, chunked so large tables don't blow memory
            $row_count = (int) $wpdb->get_var("SELECT COUNT(*) FROM `{$table}`");
            $chunk_size = 500;

            for ($offset = 0; $offset < $row_count; $offset += $chunk_size) {
                $rows = $wpdb->get_results("SELECT * FROM `{$table}` LIMIT {$chunk_size} OFFSET {$offset}", ARRAY_A);

                if (empty($rows)) {
                    continue;
                }

                $columns = array_keys($rows[0]);
                $column_list = '`' . implode('`, `', $columns) . '`';

                $value_groups = [];
                foreach ($rows as $row) {
                    $values = array_map(function ($value) use ($wpdb) {
                        if (is_null($value)) {
                            return 'NULL';
                        }
                        return "'" . $wpdb->_real_escape($value) . "'";
                    }, array_values($row));

                    $value_groups[] = '(' . implode(', ', $values) . ')';
                }

                gzwrite($gz, "INSERT INTO `{$table}` ({$column_list}) VALUES\n" . implode(",\n", $value_groups) . ";\n");
            }
        }

        gzwrite($gz, "\nSET FOREIGN_KEY_CHECKS=1;\n");
        gzclose($gz);

        return [
            'name' => $filename,
            'type' => 'database',
            'size' => filesize($path),
        ];
    }

    /**
     * Zip wp-content/{themes,plugins,uploads} plus root wp-config.php.
     *
     * @param string $backup_id
     * @param string[] $request_exclusions Extra exclusions from the /start request (e.g. the
     *   dashboard's per-site "exclude uploads" setting), additive to the local plugin option.
     * @return array{name: string, type: string, size: int}
     * @throws Exception
     */
    private function export_files($backup_id, $request_exclusions = []) {
        if (!class_exists('ZipArchive')) {
            throw new Exception('PHP ZipArchive extension is not available on this server');
        }

        $filename = "{$backup_id}-files.zip";
        $path = $this->get_backup_dir() . '/' . $filename;

        $zip = new ZipArchive();
        if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new Exception('Could not create files archive');
        }

        $exclusions = $this->get_exclusion_patterns($request_exclusions);

        // wp-content/{themes,plugins,uploads}
        foreach (['themes', 'plugins', 'uploads'] as $subdir) {
            $source = trailingslashit(WP_CONTENT_DIR) . $subdir;
            if (is_dir($source)) {
                $this->add_dir_to_zip($zip, $source, 'wp-content/' . $subdir, $exclusions);
            }
        }

        // wp-config.php (lives one level above ABSPATH's content, at the site root)
        $wp_config_path = ABSPATH . 'wp-config.php';
        if (!file_exists($wp_config_path)) {
            // Some setups keep it one directory above ABSPATH
            $wp_config_path = dirname(ABSPATH) . '/wp-config.php';
        }
        if (file_exists($wp_config_path)) {
            $zip->addFile($wp_config_path, 'wp-config.php');
        }

        $zip->close();

        return [
            'name' => $filename,
            'type' => 'files',
            'size' => filesize($path),
        ];
    }

    /**
     * Build the list of relative-path substrings to exclude from the files archive: the
     * plugin's local option, plus any request-supplied exclusions (e.g. the dashboard's
     * per-site "exclude uploads" toggle) - additive, never a replacement, so the site's own
     * junk-directory defaults (cache/tmp/updraft leftovers) always still apply.
     *
     * @param string[] $request_exclusions
     * @return string[]
     */
    private function get_exclusion_patterns($request_exclusions = []) {
        $options = get_option('backupsheep_options', []);
        $exclusions = [];

        if (!empty($options['exclusions'])) {
            foreach (preg_split('/\r\n|\r|\n/', $options['exclusions']) as $line) {
                $line = trim($line);
                if ($line !== '') {
                    $exclusions[] = $line;
                }
            }
        }

        if (is_array($request_exclusions)) {
            foreach ($request_exclusions as $pattern) {
                $pattern = is_string($pattern) ? trim($pattern) : '';
                if ($pattern !== '') {
                    $exclusions[] = $pattern;
                }
            }
        }

        // Never zip our own output directory, no matter what the user configured.
        $exclusions[] = 'wp-content/uploads/backupsheep';

        return array_unique($exclusions);
    }

    /**
     * Recursively add a directory to a ZipArchive, skipping excluded paths.
     *
     * @param ZipArchive $zip
     * @param string $source Absolute filesystem path to add
     * @param string $zip_path Path prefix to use inside the archive
     * @param string[] $exclusions
     * @return void
     */
    private function add_dir_to_zip($zip, $source, $zip_path, $exclusions) {
        $source = rtrim($source, '/\\');

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($source, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($iterator as $item) {
            $relative = $zip_path . '/' . substr($item->getPathname(), strlen($source) + 1);
            $relative = str_replace('\\', '/', $relative);

            if ($this->is_excluded($relative, $exclusions)) {
                continue;
            }

            if ($item->isDir()) {
                $zip->addEmptyDir($relative);
            } else {
                $zip->addFile($item->getPathname(), $relative);
            }
        }
    }

    /**
     * Check a relative in-archive path against the exclusion list.
     *
     * @param string $relative_path
     * @param string[] $exclusions
     * @return bool
     */
    private function is_excluded($relative_path, $exclusions) {
        foreach ($exclusions as $pattern) {
            $pattern = trim($pattern, '/');
            if ($pattern !== '' && strpos($relative_path, $pattern) !== false) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get backup status
     *
     * @param string $backup_id
     * @return array
     */
    public function get_status($backup_id) {
        global $wpdb;

        $table_name = $wpdb->prefix . 'backupsheep_logs';
        $backup = $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM {$table_name} WHERE backup_id = %s", $backup_id)
        );

        if (!$backup) {
            return [
                'status' => 'unknown',
                'message' => __('Backup not found', 'backupsheep'),
            ];
        }

        $files = [];
        if (!empty($backup->files)) {
            $decoded = json_decode($backup->files, true);
            if (is_array($decoded)) {
                $files = $decoded;
            }
        }

        return [
            'id' => $backup_id,
            'status' => $backup->status,
            'type' => $backup->type,
            'start_time' => $backup->start_time,
            'end_time' => $backup->end_time,
            'size' => $backup->size,
            'file_count' => $backup->file_count,
            'error_message' => $backup->error_message,
            'encrypted' => !empty($backup->encrypted),
            'files' => $files,
        ];
    }

    /**
     * Get backup files (name/type/size) for a given backup ID
     *
     * @param string $backup_id
     * @return array
     */
    public function get_files($backup_id) {
        $status = $this->get_status($backup_id);
        return $status['files'] ?? [];
    }

    /**
     * Resolve a requested filename to a safe, verified path inside the backup directory
     * for a specific backup_id. Returns null if the file doesn't belong to that backup
     * or would escape the backup directory.
     *
     * @param string $backup_id
     * @param string $file
     * @return string|null
     */
    private function resolve_backup_file($backup_id, $file) {
        $file = basename($file); // strip any path components outright

        if (strpos($file, $backup_id) !== 0) {
            return null; // filename must belong to this backup_id
        }

        $dir = realpath($this->get_backup_dir());
        $candidate = realpath($dir . '/' . $file);

        if ($candidate === false || strpos($candidate, $dir) !== 0) {
            return null;
        }

        return $candidate;
    }

    /**
     * Stream a backup file to the client. Exits the request on success.
     *
     * @param string $file
     * @param string $backup_id
     * @return void
     */
    public function download_file($file, $backup_id) {
        $path = $this->resolve_backup_file($backup_id, $file);

        if (!$path || !file_exists($path)) {
            return;
        }

        header('Content-Description: File Transfer');
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . basename($path) . '"');
        header('Expires: 0');
        header('Cache-Control: must-revalidate');
        header('Pragma: public');
        header('Content-Length: ' . filesize($path));
        readfile($path);
        exit;
    }

    /**
     * Delete a backup output file
     *
     * @param string $file
     * @param string $backup_id
     * @return true|WP_Error
     */
    public function delete_file($file, $backup_id) {
        $path = $this->resolve_backup_file($backup_id, $file);

        if (!$path || !file_exists($path)) {
            return new WP_Error('file_not_found', __('File not found', 'backupsheep'));
        }

        unlink($path);
        backupsheep_log("Deleted local backup file: " . basename($path));

        return true;
    }
}
