/**
 * Unit Tests for Encryption Utilities
 * 
 * Tests the encryption and decryption functionality in the security/encryption module.
 */
import { encryptData, decryptData, generateApiKey, hashPassword, verifyPassword } from '../../../server/security/encryption';

describe('Encryption Utilities', () => {
  describe('encryptData and decryptData', () => {
    it('should correctly encrypt and decrypt data', () => {
      const testData = 'This is sensitive information';
      
      // Encrypt data
      const encrypted = encryptData(testData);
      
      // Verify encrypted data is different from original
      expect(encrypted).not.toEqual(testData);
      
      // Decrypt data
      const decrypted = decryptData(encrypted);
      
      // Verify decrypted data matches original
      expect(decrypted).toEqual(testData);
    });
    
    it('should handle empty strings', () => {
      const testData = '';
      
      // Encrypt data
      const encrypted = encryptData(testData);
      
      // Verify encrypted data is different from original
      expect(encrypted).not.toEqual(testData);
      
      // Decrypt data
      const decrypted = decryptData(encrypted);
      
      // Verify decrypted data matches original
      expect(decrypted).toEqual(testData);
    });
    
    it('should handle special characters', () => {
      const testData = 'Special @#$%^&*()_+ characters!';
      
      // Encrypt data
      const encrypted = encryptData(testData);
      
      // Verify encrypted data is different from original
      expect(encrypted).not.toEqual(testData);
      
      // Decrypt data
      const decrypted = decryptData(encrypted);
      
      // Verify decrypted data matches original
      expect(decrypted).toEqual(testData);
    });
    
    it('should produce different ciphertext for the same plaintext', () => {
      const testData = 'Same plaintext';
      
      // Encrypt data twice
      const encrypted1 = encryptData(testData);
      const encrypted2 = encryptData(testData);
      
      // Verify encryptions are different (due to random IV)
      expect(encrypted1).not.toEqual(encrypted2);
      
      // Decrypt both encryptions
      const decrypted1 = decryptData(encrypted1);
      const decrypted2 = decryptData(encrypted2);
      
      // Verify both decryptions match original
      expect(decrypted1).toEqual(testData);
      expect(decrypted2).toEqual(testData);
    });
  });
  
  describe('generateApiKey', () => {
    it('should generate an API key of default length', () => {
      const apiKey = generateApiKey();
      
      // Verify API key is a non-empty string
      expect(typeof apiKey).toBe('string');
      expect(apiKey.length).toBeGreaterThan(0);
      
      // Base64 encoding uses 4 characters for every 3 bytes
      // So for default 32 bytes, expect around 44 characters
      // (exact length depends on padding)
      expect(apiKey.length).toBeGreaterThanOrEqual(42);
    });
    
    it('should generate an API key of specified length', () => {
      const length = 16;
      const apiKey = generateApiKey(length);
      
      // Verify API key is a non-empty string
      expect(typeof apiKey).toBe('string');
      expect(apiKey.length).toBeGreaterThan(0);
      
      // For 16 bytes, expect around 22-24 characters in base64
      expect(apiKey.length).toBeGreaterThanOrEqual(20);
    });
    
    it('should generate different API keys on each call', () => {
      const apiKey1 = generateApiKey();
      const apiKey2 = generateApiKey();
      
      // Verify API keys are different
      expect(apiKey1).not.toEqual(apiKey2);
    });
  });
  
  describe('hashPassword and verifyPassword', () => {
    it('should correctly hash and verify passwords', () => {
      const password = 'secure-password-123';
      
      // Hash password
      const { hash, salt } = hashPassword(password);
      
      // Verify hash and salt are non-empty strings
      expect(typeof hash).toBe('string');
      expect(typeof salt).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
      expect(salt.length).toBeGreaterThan(0);
      
      // Verify password with correct hash and salt
      const isValid = verifyPassword(password, hash, salt);
      
      // Verify verification returns true
      expect(isValid).toBe(true);
    });
    
    it('should reject incorrect passwords', () => {
      const password = 'secure-password-123';
      const wrongPassword = 'wrong-password-456';
      
      // Hash password
      const { hash, salt } = hashPassword(password);
      
      // Verify wrong password with correct hash and salt
      const isValid = verifyPassword(wrongPassword, hash, salt);
      
      // Verify verification returns false
      expect(isValid).toBe(false);
    });
    
    it('should generate different hashes for the same password', () => {
      const password = 'same-password-twice';
      
      // Hash password twice
      const result1 = hashPassword(password);
      const result2 = hashPassword(password);
      
      // Verify hashes and salts are different
      expect(result1.hash).not.toEqual(result2.hash);
      expect(result1.salt).not.toEqual(result2.salt);
      
      // Verify both hashes work with the correct password
      expect(verifyPassword(password, result1.hash, result1.salt)).toBe(true);
      expect(verifyPassword(password, result2.hash, result2.salt)).toBe(true);
    });
  });
});