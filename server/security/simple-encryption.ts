/**
 * Simple Encryption Utilities
 * 
 * This module provides lightweight encryption and decryption utilities
 * that work in memory-constrained environments like Replit.
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import logger from '../utils/logger';

// Encryption constants
const ALGORITHM = 'aes-256-cbc'; // Using CBC mode which requires less memory
const ENCODING = 'hex';
const IV_LENGTH = 16; // For AES, this is always 16 bytes
const KEY_LENGTH = 32; // 256 bits for AES-256

/**
 * Get the encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    logger.error('Encryption key not set in environment variables');
    throw new Error('Encryption key not set in environment variables');
  }
  
  // Derive a fixed-length key using SHA-256 (low memory usage)
  return createHash('sha256')
    .update(key)
    .digest()
    .slice(0, KEY_LENGTH);
}

/**
 * Encrypt sensitive data
 * @param data - String data to encrypt
 * @returns Encrypted string in format: iv:encryptedData
 */
export function encrypt(data: string): string {
  try {
    // Get encryption key derived from environment variable
    const key = getEncryptionKey();
    
    // Generate random IV
    const iv = randomBytes(IV_LENGTH);
    
    // Create cipher and encrypt
    const cipher = createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(data, 'utf8', ENCODING);
    encrypted += cipher.final(ENCODING);
    
    // Return IV and encrypted data
    return `${iv.toString(ENCODING)}:${encrypted}`;
  } catch (error) {
    logger.error('Encryption failed', error);
    throw error;
  }
}

/**
 * Decrypt sensitive data
 * @param encryptedData - Encrypted string in format: iv:encryptedData
 * @returns Decrypted string
 */
export function decrypt(encryptedData: string): string {
  try {
    // Get encryption key
    const key = getEncryptionKey();
    
    // Split components
    const [ivHex, encryptedHex] = encryptedData.split(':');
    
    if (!ivHex || !encryptedHex) {
      throw new Error('Invalid encrypted data format');
    }
    
    // Convert from hex
    const iv = Buffer.from(ivHex, ENCODING);
    
    // Create decipher and decrypt
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedHex, ENCODING, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Decryption failed', error);
    throw error;
  }
}

/**
 * Generate a secure random token
 * @param length - Length of the token in bytes (default: 32)
 * @returns Random token as hex string
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Hash a value for secure storage
 * @param value - Value to hash
 * @returns Hashed value
 */
export function hashValue(value: string): string {
  return createHash('sha256')
    .update(value)
    .digest('hex');
}