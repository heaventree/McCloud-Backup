/**
 * Encryption Utilities
 * 
 * This module provides functions for encrypting and decrypting sensitive data
 * such as OAuth tokens and API keys.
 */
import crypto from 'crypto';
import { createLogger } from '../utils/logger';

const logger = createLogger('encryption');

// Constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES-256-GCM, IV length is 12 bytes (96 bits), but we use 16 for compatibility
const KEY_LENGTH = 32; // 256 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64;
const KEY_ITERATIONS = 100000;
const KEY_DIGEST = 'sha512';

// Get encryption key from environment or generate one
let encryptionKey: Buffer;

/**
 * Initialize encryption key from environment or generate a new one
 * In production, this should always come from a secure environment variable
 */
function initializeEncryptionKey(): void {
  const envKey = process.env.ENCRYPTION_KEY;
  
  if (envKey) {
    try {
      // If hexadecimal string is provided in env
      encryptionKey = Buffer.from(envKey, 'hex');
      if (encryptionKey.length !== KEY_LENGTH) {
        throw new Error(`Encryption key must be ${KEY_LENGTH * 2} hex characters`);
      }
    } catch (error) {
      logger.error('Failed to initialize encryption key from environment', error);
      throw error;
    }
  } else {
    // For development only - in production, key should never be generated
    if (process.env.NODE_ENV === 'production') {
      logger.error('Missing ENCRYPTION_KEY in production environment');
      throw new Error('Missing ENCRYPTION_KEY in production environment');
    }
    
    logger.warn('Generating temporary encryption key - NOT SECURE FOR PRODUCTION');
    encryptionKey = crypto.randomBytes(KEY_LENGTH);
    
    // Log key in development for debugging
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`Generated encryption key: ${encryptionKey.toString('hex')}`);
    }
  }
}

// Initialize key on module load
initializeEncryptionKey();

/**
 * Derive a key from a password and salt
 * @param password Password to derive key from
 * @param salt Salt for key derivation
 * @returns Derived key
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    password, 
    salt, 
    KEY_ITERATIONS, 
    KEY_LENGTH, 
    KEY_DIGEST
  );
}

/**
 * Encrypt data using AES-256-GCM
 * @param data Data to encrypt (string)
 * @returns Encrypted data as hex string
 */
export function encryptData(data: string): string {
  try {
    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher with key, IV, and auth tag length
    const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv, {
      authTagLength: AUTH_TAG_LENGTH
    });
    
    // Encrypt data
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag
    const authTag = cipher.getAuthTag();
    
    // Combine IV, encrypted data, and authentication tag
    // Format: iv (hex) + authTag (hex) + encrypted (hex)
    return iv.toString('hex') + authTag.toString('hex') + encrypted;
  } catch (error) {
    logger.error('Encryption failed', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data using AES-256-GCM
 * @param encryptedData Encrypted data (hex string)
 * @returns Decrypted data as string
 */
export function decryptData(encryptedData: string): string {
  try {
    // Extract IV, auth tag, and encrypted data
    const ivHex = encryptedData.slice(0, IV_LENGTH * 2);
    const authTagHex = encryptedData.slice(IV_LENGTH * 2, (IV_LENGTH + AUTH_TAG_LENGTH) * 2);
    const encryptedHex = encryptedData.slice((IV_LENGTH + AUTH_TAG_LENGTH) * 2);
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv, {
      authTagLength: AUTH_TAG_LENGTH
    });
    
    // Set auth tag
    decipher.setAuthTag(authTag);
    
    // Decrypt data
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Decryption failed', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Generate a random API key
 * @param length Length of API key in bytes (default 32)
 * @returns Random API key as base64 string
 */
export function generateApiKey(length = 32): string {
  return crypto.randomBytes(length).toString('base64');
}

/**
 * Hash a password for storage
 * @param password Password to hash
 * @returns Object containing hash and salt
 */
export function hashPassword(password: string): { hash: string, salt: string } {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const hash = deriveKey(password, salt);
  
  return {
    hash: hash.toString('hex'),
    salt: salt.toString('hex')
  };
}

/**
 * Verify a password against a stored hash
 * @param password Password to verify
 * @param storedHash Stored password hash
 * @param storedSalt Stored salt
 * @returns True if password matches
 */
export function verifyPassword(password: string, storedHash: string, storedSalt: string): boolean {
  const salt = Buffer.from(storedSalt, 'hex');
  const hash = deriveKey(password, salt);
  
  return crypto.timingSafeEqual(
    Buffer.from(storedHash, 'hex'),
    hash
  );
}