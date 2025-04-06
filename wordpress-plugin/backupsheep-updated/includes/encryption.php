<?php
/**
 * Encryption utilities
 *
 * @package BackupSheep
 */

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

/**
 * Generate a secure encryption key
 * 
 * @param int $length Length of the generated key
 * @return string Generated encryption key
 */
function backupsheep_generate_encryption_key($length = 32) {
    // Use random_bytes if available (PHP 7+)
    if (function_exists('random_bytes')) {
        return bin2hex(random_bytes($length / 2));
    } 
    
    // Fallback to openssl_random_pseudo_bytes
    if (function_exists('openssl_random_pseudo_bytes')) {
        return bin2hex(openssl_random_pseudo_bytes($length / 2));
    }
    
    // Last resort, but not cryptographically secure
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}|;:,.<>?';
    $key = '';
    for ($i = 0; $i < $length; $i++) {
        $key .= $chars[mt_rand(0, strlen($chars) - 1)];
    }
    
    return $key;
}

/**
 * Encrypt a file
 * 
 * @param string $source_file Path to the source file
 * @param string $dest_file Path to the destination file
 * @param string $encryption_key Encryption key
 * @param string $method Encryption method
 * @return bool|WP_Error True on success, WP_Error on failure
 */
function backupsheep_encrypt_file($source_file, $dest_file, $encryption_key, $method = 'aes-256-cbc') {
    // Check if source file exists
    if (!file_exists($source_file)) {
        return new WP_Error('encryption_error', 'Source file does not exist');
    }
    
    // Check if OpenSSL is available
    if (!function_exists('openssl_encrypt')) {
        return new WP_Error('encryption_error', 'OpenSSL extension is not available');
    }
    
    // Check if the encryption method is available
    $available_methods = openssl_get_cipher_methods();
    if (!in_array($method, $available_methods)) {
        return new WP_Error('encryption_error', 'Encryption method is not available');
    }
    
    // Generate IV
    $iv_length = openssl_cipher_iv_length($method);
    $iv = openssl_random_pseudo_bytes($iv_length);
    
    // Open file handles
    $source_handle = fopen($source_file, 'rb');
    $dest_handle = fopen($dest_file, 'wb');
    
    if (!$source_handle || !$dest_handle) {
        if ($source_handle) fclose($source_handle);
        if ($dest_handle) fclose($dest_handle);
        return new WP_Error('encryption_error', 'Failed to open file handles');
    }
    
    // Write IV to the beginning of the file
    fwrite($dest_handle, $iv);
    
    // Write file format marker and method
    $marker = 'BSENC'; // BackupSheep Encrypted
    fwrite($dest_handle, $marker);
    fwrite($dest_handle, pack('a16', $method)); // Fixed 16 bytes for method
    
    // Encrypt and write data in chunks
    $chunk_size = 4096; // 4KB chunks
    $success = true;
    
    while (!feof($source_handle)) {
        $plaintext = fread($source_handle, $chunk_size);
        if ($plaintext === false) {
            $success = false;
            break;
        }
        
        $ciphertext = openssl_encrypt($plaintext, $method, $encryption_key, OPENSSL_RAW_DATA, $iv);
        if ($ciphertext === false) {
            $success = false;
            break;
        }
        
        // Write chunk size and encrypted data
        fwrite($dest_handle, pack('N', strlen($ciphertext))); // 4 bytes for chunk size
        fwrite($dest_handle, $ciphertext);
        
        // Update IV for next chunk (CBC mode)
        $iv = substr($ciphertext, -$iv_length);
    }
    
    // Close file handles
    fclose($source_handle);
    fclose($dest_handle);
    
    if (!$success) {
        @unlink($dest_file); // Delete incomplete file
        return new WP_Error('encryption_error', 'Error during file encryption');
    }
    
    return true;
}

/**
 * Decrypt a file
 * 
 * @param string $source_file Path to the source file
 * @param string $dest_file Path to the destination file
 * @param string $encryption_key Encryption key
 * @return bool|WP_Error True on success, WP_Error on failure
 */
function backupsheep_decrypt_file($source_file, $dest_file, $encryption_key) {
    // Check if source file exists
    if (!file_exists($source_file)) {
        return new WP_Error('decryption_error', 'Source file does not exist');
    }
    
    // Check if OpenSSL is available
    if (!function_exists('openssl_decrypt')) {
        return new WP_Error('decryption_error', 'OpenSSL extension is not available');
    }
    
    // Open file handles
    $source_handle = fopen($source_file, 'rb');
    $dest_handle = fopen($dest_file, 'wb');
    
    if (!$source_handle || !$dest_handle) {
        if ($source_handle) fclose($source_handle);
        if ($dest_handle) fclose($dest_handle);
        return new WP_Error('decryption_error', 'Failed to open file handles');
    }
    
    // Read IV from the beginning of the file
    $method = 'aes-256-cbc'; // Default method
    $iv_length = openssl_cipher_iv_length($method);
    $iv = fread($source_handle, $iv_length);
    
    // Read and verify file format marker
    $marker = fread($source_handle, 5);
    if ($marker !== 'BSENC') {
        fclose($source_handle);
        fclose($dest_handle);
        @unlink($dest_file);
        return new WP_Error('decryption_error', 'Invalid encrypted file format');
    }
    
    // Read the encryption method
    $method_data = fread($source_handle, 16);
    $method = rtrim($method_data); // Remove padding
    
    // Verify method is available
    $available_methods = openssl_get_cipher_methods();
    if (!in_array($method, $available_methods)) {
        fclose($source_handle);
        fclose($dest_handle);
        @unlink($dest_file);
        return new WP_Error('decryption_error', 'Encryption method is not available');
    }
    
    // Decrypt and write data in chunks
    $success = true;
    
    while (!feof($source_handle)) {
        // Read chunk size
        $chunk_size_data = fread($source_handle, 4);
        if (strlen($chunk_size_data) < 4) {
            // End of file
            break;
        }
        
        $chunk_size = unpack('N', $chunk_size_data)[1];
        
        // Read encrypted chunk
        $ciphertext = fread($source_handle, $chunk_size);
        if (strlen($ciphertext) < $chunk_size) {
            $success = false;
            break;
        }
        
        // Decrypt chunk
        $plaintext = openssl_decrypt($ciphertext, $method, $encryption_key, OPENSSL_RAW_DATA, $iv);
        if ($plaintext === false) {
            $success = false;
            break;
        }
        
        // Write decrypted data
        fwrite($dest_handle, $plaintext);
        
        // Update IV for next chunk (CBC mode)
        $iv = substr($ciphertext, -$iv_length);
    }
    
    // Close file handles
    fclose($source_handle);
    fclose($dest_handle);
    
    if (!$success) {
        @unlink($dest_file); // Delete incomplete file
        return new WP_Error('decryption_error', 'Error during file decryption');
    }
    
    return true;
}

/**
 * Test encryption key
 * 
 * @param string $encryption_key Encryption key to test
 * @return bool|WP_Error True if key is valid, WP_Error on failure
 */
function backupsheep_test_encryption_key($encryption_key) {
    // Create test data
    $test_data = 'BackupSheep encryption test data: ' . wp_generate_password(32, true, true);
    
    // Create temporary files
    $upload_dir = wp_upload_dir();
    $backupsheep_dir = trailingslashit($upload_dir['basedir']) . 'backupsheep/temp';
    
    // Ensure temp directory exists
    if (!file_exists($backupsheep_dir)) {
        wp_mkdir_p($backupsheep_dir);
    }
    
    $plaintext_file = trailingslashit($backupsheep_dir) . 'test_plaintext_' . time() . '.txt';
    $encrypted_file = trailingslashit($backupsheep_dir) . 'test_encrypted_' . time() . '.enc';
    $decrypted_file = trailingslashit($backupsheep_dir) . 'test_decrypted_' . time() . '.txt';
    
    // Write test data to file
    file_put_contents($plaintext_file, $test_data);
    
    // Encrypt file
    $encrypt_result = backupsheep_encrypt_file($plaintext_file, $encrypted_file, $encryption_key);
    if (is_wp_error($encrypt_result)) {
        @unlink($plaintext_file);
        return $encrypt_result;
    }
    
    // Decrypt file
    $decrypt_result = backupsheep_decrypt_file($encrypted_file, $decrypted_file, $encryption_key);
    if (is_wp_error($decrypt_result)) {
        @unlink($plaintext_file);
        @unlink($encrypted_file);
        return $decrypt_result;
    }
    
    // Verify decrypted data matches original
    $decrypted_data = file_get_contents($decrypted_file);
    $is_valid = ($decrypted_data === $test_data);
    
    // Clean up temporary files
    @unlink($plaintext_file);
    @unlink($encrypted_file);
    @unlink($decrypted_file);
    
    if (!$is_valid) {
        return new WP_Error('encryption_test_failed', 'Encryption test failed: decrypted data does not match original');
    }
    
    return true;
}

/**
 * Encrypt backup file
 * 
 * @param string $backup_file Path to the backup file
 * @param string $encryption_key Encryption key
 * @return string|WP_Error Path to encrypted file or WP_Error on failure
 */
function backupsheep_encrypt_backup($backup_file, $encryption_key) {
    // Check if file exists
    if (!file_exists($backup_file)) {
        return new WP_Error('encrypt_backup_error', 'Backup file does not exist');
    }
    
    // Generate encrypted file path
    $encrypted_file = $backup_file . '.enc';
    
    // Encrypt file
    $result = backupsheep_encrypt_file($backup_file, $encrypted_file, $encryption_key);
    if (is_wp_error($result)) {
        return $result;
    }
    
    // Delete original file after successful encryption
    @unlink($backup_file);
    
    return $encrypted_file;
}

/**
 * Decrypt backup file
 * 
 * @param string $encrypted_file Path to the encrypted backup file
 * @param string $encryption_key Encryption key
 * @return string|WP_Error Path to decrypted file or WP_Error on failure
 */
function backupsheep_decrypt_backup($encrypted_file, $encryption_key) {
    // Check if file exists
    if (!file_exists($encrypted_file)) {
        return new WP_Error('decrypt_backup_error', 'Encrypted backup file does not exist');
    }
    
    // Generate decrypted file path
    $decrypted_file = preg_replace('/\.enc$/', '', $encrypted_file);
    if ($decrypted_file === $encrypted_file) {
        $decrypted_file .= '.decrypted';
    }
    
    // Decrypt file
    $result = backupsheep_decrypt_file($encrypted_file, $decrypted_file, $encryption_key);
    if (is_wp_error($result)) {
        return $result;
    }
    
    return $decrypted_file;
}