/**
 * Data Encryption Utilities
 *
 * This module provides encryption and decryption utilities for sensitive data,
 * using industry-standard algorithms and practices.
 */
import { createCipheriv, createDecipheriv, randomBytes, scrypt, createHash } from 'crypto';
import { promisify } from 'util';
import logger from '../utils/logger';

// Use the default logger instance

// Encryption constants
const ALGORITHM = 'aes-256-gcm';
const ENCODING = 'hex';
const IV_LENGTH = 16; // For AES, this is always 16 bytes
const AUTH_TAG_LENGTH = 16; // For GCM mode, 16 bytes is recommended
const SCRYPT_KEYLEN = 32; // 256 bits for AES-256
const SCRYPT_SALT_LENGTH = 32;
// Minimal memory requirements for constrained environments like Replit
const SCRYPT_OPTIONS = { N: 4096, r: 4, p: 1 };

// Promisify scrypt
const scryptAsync = promisify(scrypt);

/**
 * Get the encryption key
 *
 * @returns Encryption key from environment variables
 * @throws Error if encryption key is not set
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    logger.error('Encryption key not set in environment variables');
    throw new Error('Encryption key not set in environment variables');
  }

  return key;
}

/**
 * Derive an encryption key from a password and salt
 * Using more lightweight crypto to avoid memory issues
 *
 * @param password - Password to derive key from
 * @param salt - Salt for key derivation
 * @returns Derived key
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  try {
    // Use a simpler key derivation to avoid memory issues
    // Note: createHash is from the crypto module not from crypto object
    const hash = createHash('sha256').update(password).update(salt).digest();

    return hash;
  } catch (error) {
    logger.error('Failed to derive encryption key', error);
    throw error;
  }
}

/**
 * Encrypt data
 *
 * @param data - Data to encrypt
 * @returns Encrypted data
 */
export async function encrypt(data: string): Promise<string> {
  try {
    // Get encryption key
    const password = getEncryptionKey();

    // Generate random salt and IV
    const salt = randomBytes(SCRYPT_SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);

    // Derive key from password and salt
    const key = await deriveKey(password, salt);

    // Create cipher
    const cipher = createCipheriv(ALGORITHM, key, iv);

    // Encrypt data
    let encrypted = cipher.update(data, 'utf8', ENCODING);
    encrypted += cipher.final(ENCODING);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Format: salt:iv:authTag:encryptedData
    const result = [
      salt.toString(ENCODING),
      iv.toString(ENCODING),
      authTag.toString(ENCODING),
      encrypted,
    ].join(':');

    return result;
  } catch (error) {
    logger.error('Encryption failed', error);
    throw error;
  }
}

/**
 * Decrypt data
 *
 * @param encryptedData - Data to decrypt
 * @returns Decrypted data
 */
export async function decrypt(encryptedData: string): Promise<string> {
  try {
    // Get encryption key
    const password = getEncryptionKey();

    // Split encrypted data into components
    const [saltHex, ivHex, authTagHex, encryptedHex] = encryptedData.split(':');

    if (!saltHex || !ivHex || !authTagHex || !encryptedHex) {
      throw new Error('Invalid encrypted data format');
    }

    // Convert components from hex to buffers
    const salt = Buffer.from(saltHex, ENCODING);
    const iv = Buffer.from(ivHex, ENCODING);
    const authTag = Buffer.from(authTagHex, ENCODING);

    // Derive key from password and salt
    const key = await deriveKey(password, salt);

    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt data
    let decrypted = decipher.update(encryptedHex, ENCODING, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('Decryption failed', error);
    throw error;
  }
}

/**
 * Encrypt an object
 *
 * @param obj - Object to encrypt
 * @returns Encrypted object as string
 */
export async function encryptObject<T>(obj: T): Promise<string> {
  try {
    const jsonStr = JSON.stringify(obj);
    return await encrypt(jsonStr);
  } catch (error) {
    logger.error('Object encryption failed', error);
    throw error;
  }
}

/**
 * Decrypt an object
 *
 * @param encryptedData - Encrypted object string
 * @returns Decrypted object
 */
export async function decryptObject<T>(encryptedData: string): Promise<T> {
  try {
    const jsonStr = await decrypt(encryptedData);
    return JSON.parse(jsonStr) as T;
  } catch (error) {
    logger.error('Object decryption failed', error);
    throw error;
  }
}

/**
 * Generate a secure random token
 *
 * @param length - Length of the token in bytes (default: 32)
 * @returns Random token as hex string
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Simple synchronous encryption for sensitive data
 * Uses AES encryption from crypto-js for session token storage
 *
 * @param data - Data to encrypt
 * @returns Encrypted data as string
 */
export function encryptData(data: string): string {
  try {
    // Use a simpler approach for session tokens
    const password = getEncryptionKey();
    const CryptoJS = require('crypto-js');
    return CryptoJS.AES.encrypt(data, password).toString();
  } catch (error) {
    logger.error('Encryption failed', error);
    throw error;
  }
}

/**
 * Simple synchronous decryption for sensitive data
 * Uses AES decryption from crypto-js for session token storage
 *
 * @param encryptedData - Data to decrypt
 * @returns Decrypted data as string
 */
export function decryptData(encryptedData: string): string {
  try {
    const password = getEncryptionKey();
    const CryptoJS = require('crypto-js');
    const bytes = CryptoJS.AES.decrypt(encryptedData, password);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    logger.error('Decryption failed');
    throw error;
  }
}

/**
 * Hash a value with a salt
 *
 * @param value - Value to hash
 * @param salt - Salt to use (if not provided, a random salt will be generated)
 * @returns Hashed value and salt
 */
export function hashValue(value: string, salt?: string): { hash: string; salt: string } {
  try {
    // Generate salt if not provided
    const useSalt = salt || randomBytes(SCRYPT_SALT_LENGTH).toString(ENCODING);

    // Hash the value using a simpler method
    const hash = createHash('sha256').update(value).update(useSalt).digest().toString(ENCODING);

    return {
      hash,
      salt: useSalt,
    };
  } catch (error) {
    logger.error('Value hashing failed', error);
    throw error;
  }
}

/**
 * Verify a value against a hash
 *
 * @param value - Value to verify
 * @param hash - Hash to verify against
 * @param salt - Salt used for the hash
 * @returns True if the value matches the hash, false otherwise
 */
export function verifyHash(value: string, hash: string, salt: string): boolean {
  try {
    // Hash the value with the provided salt
    const { hash: computedHash } = hashValue(value, salt);

    // Compare the hashes (using constant-time comparison)
    return timingSafeEqual(computedHash, hash);
  } catch (error) {
    logger.error('Hash verification failed', error);
    return false;
  }
}

/**
 * Constant-time comparison of two strings
 *
 * @param a - First string
 * @param b - Second string
 * @returns True if the strings are equal, false otherwise
 */
function timingSafeEqual(a: string, b: string): boolean {
  // If lengths are different, return false
  // (but still do the comparison to prevent timing attacks)
  const equal = a.length === b.length;

  // Fixed-time comparison
  let result = equal;
  const len = Math.max(a.length, b.length);

  for (let i = 0; i < len; i++) {
    result = result && (i >= a.length || i >= b.length || a[i] === b[i]);
  }

  return result;
}
