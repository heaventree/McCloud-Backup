import axios from 'axios';
import logger from '../../utils/logger';
import { decryptData } from '../../security/encryption';

/**
 * Fetches the account information from Dropbox
 * @param token The access token (may or may not be encrypted)
 * @returns Account information from Dropbox
 */
export async function fetchDropboxAccountInfo(token: string) {
  try {
    // Try to use the token directly first
    let accessToken = token;
    
    // If that fails, try to decrypt it
    try {
      accessToken = decryptData(token);
      logger.info('Successfully decrypted token');
    } catch (decryptError) {
      logger.info('Using token as-is (not encrypted or decryption failed)');
    }
    
    const response = await axios.post(
      'https://api.dropboxapi.com/2/users/get_current_account',
      null, // no data needed for this endpoint
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    logger.info('Successfully fetched Dropbox account info');
    return response.data;
  } catch (error) {
    logger.error('Error fetching Dropbox account info:', error);
    throw error;
  }
}

/**
 * Fetches the space usage information from Dropbox
 * @param token The access token (may or may not be encrypted)
 * @returns Space usage information from Dropbox
 */
export async function fetchDropboxSpaceUsage(token: string) {
  try {
    // Try to use the token directly first
    let accessToken = token;
    
    // If that fails, try to decrypt it
    try {
      accessToken = decryptData(token);
      logger.info('Successfully decrypted token');
    } catch (decryptError) {
      logger.info('Using token as-is (not encrypted or decryption failed)');
    }
    
    const response = await axios.post(
      'https://api.dropboxapi.com/2/users/get_space_usage',
      null, // no data needed for this endpoint
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    logger.info('Successfully fetched Dropbox space usage');
    return response.data;
  } catch (error) {
    logger.error('Error fetching Dropbox space usage:', error);
    throw error;
  }
}

/**
 * Test if the Dropbox token is valid
 * @param token The access token (may or may not be encrypted)
 * @returns Boolean indicating if the token is valid
 */
export async function testDropboxToken(token: string): Promise<boolean> {
  try {
    await fetchDropboxAccountInfo(token);
    return true;
  } catch (error) {
    logger.error('Token validation failed:', error);
    return false;
  }
}