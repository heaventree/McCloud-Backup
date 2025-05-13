import axios from 'axios';
import logger from '../../utils/logger';
import { decryptData } from '../../security/encryption';

/**
 * Fetches the account information from Dropbox
 * @param token The encrypted access token
 * @returns Account information from Dropbox
 */
export async function fetchDropboxAccountInfo(token: string) {
  try {
    // Decrypt the token
    const decryptedToken = decryptData(token);
    
    const response = await axios.post(
      'https://api.dropboxapi.com/2/users/get_current_account',
      null, // no data needed for this endpoint
      {
        headers: {
          'Authorization': `Bearer ${decryptedToken}`,
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
 * @param token The encrypted access token
 * @returns Space usage information from Dropbox
 */
export async function fetchDropboxSpaceUsage(token: string) {
  try {
    // Decrypt the token
    const decryptedToken = decryptData(token);
    
    const response = await axios.post(
      'https://api.dropboxapi.com/2/users/get_space_usage',
      null, // no data needed for this endpoint
      {
        headers: {
          'Authorization': `Bearer ${decryptedToken}`,
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
 * @param token The encrypted access token
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