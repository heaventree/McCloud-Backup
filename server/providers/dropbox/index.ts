import axios from 'axios';
import logger from '../../utils/logger';
import { decryptData } from '../../security/encryption';

/**
 * Process a token by decoding HTML entities and parsing JSON if needed
 * @param token The raw token string that may be HTML-encoded or a JSON string
 * @returns Processed token ready for API usage
 */
export function processDropboxToken(token: string): string {
  // Early return for empty tokens
  if (!token) return token;
  
  // Log token info
  const logInfo = {
    tokenLength: token.length,
    tokenType: typeof token,
    tokenSample: `${token.substring(0, 5)}...${token.substring(token.length - 5)}`,
    isHtmlEncoded: token.includes('&quot;'),
    isJsonString: false
  };
  
  logger.info('Processing Dropbox token', logInfo);
  
  let processedToken = token;
  
  // Step 1: Decode HTML entities if present
  if (processedToken.includes('&quot;') || 
      processedToken.includes('&amp;') || 
      processedToken.includes('&#39;')) {
    try {
      processedToken = processedToken
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      
      logger.info('Decoded HTML entities in token', {
        originalLength: token.length,
        decodedLength: processedToken.length
      });
    } catch (error) {
      logger.warn('Error decoding HTML entities', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  // Step 2: Parse JSON if token is a JSON string
  try {
    const parsedJson = JSON.parse(processedToken);
    if (parsedJson && typeof parsedJson === 'object') {
      logInfo.isJsonString = true;
      
      // Extract access_token if available
      if (parsedJson.access_token) {
        processedToken = parsedJson.access_token;
        logger.info('Extracted access_token from JSON', {
          tokenLength: processedToken.length
        });
      } else if (parsedJson.token) {
        processedToken = parsedJson.token;
        logger.info('Extracted token from JSON', {
          tokenLength: processedToken.length
        });
      }
    }
  } catch (error) {
    // Not a JSON string, continue with token as-is
  }
  
  return processedToken;
}

/**
 * Fetches the account information from Dropbox
 * @param token The access token (may or may not be encrypted)
 * @returns Account information from Dropbox
 */
export async function fetchDropboxAccountInfo(token: string) {
  try {
    // Process the token using our utility function (handles HTML entities and JSON parsing)
    const accessToken = processDropboxToken(token);
    
    // Log the token information for debugging
    logger.info('Using processed token for Dropbox API call', {
      originalLength: token.length,
      processedLength: accessToken.length,
      tokenSample: `${accessToken.substring(0, 5)}...${accessToken.substring(accessToken.length - 5)}`,
    });

    const response = await axios.post(
      'https://api.dropboxapi.com/2/users/get_current_account',
      null, // no data needed for this endpoint
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info('Successfully fetched Dropbox account info');
    return response.data;
  } catch (error) {
    // logger.error('Error fetching Dropbox account info:', error);
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
    // Log token length and type for debugging
    const logInfo = {
      tokenLength: token ? token.length : 0,
      tokenType: typeof token,
      tokenSample: token
        ? `${token.substring(0, 5)}...${token.substring(token.length - 5)}`
        : 'none',
      isJson: false,
    };

    // Check if token might be a JSON string
    try {
      const parsed = JSON.parse(token);
      if (parsed && typeof parsed === 'object') {
        logInfo.isJson = true;
        // If token is a JSON object with access_token or token field, use that
        if (parsed.access_token) {
          token = parsed.access_token;
          logger.info('Extracted access_token from JSON token', logInfo);
        } else if (parsed.token) {
          token = parsed.token;
          logger.info('Extracted token from JSON token', logInfo);
        }
      }
    } catch (e) {
      // Not JSON, continue with token as-is
    }

    // We don't need to decrypt here - the token should already be decrypted by the time it reaches this function
    // The decryption is done in the routes/dropbox.ts when reading from database
    let accessToken = token;

    // Log the token information for debugging
    logger.info('Using token for Dropbox space usage API call', {
      ...logInfo,
      tokenLength: accessToken.length,
      tokenSample: `${accessToken.substring(0, 5)}...${accessToken.substring(accessToken.length - 5)}`,
    });

    const response = await axios.post(
      'https://api.dropboxapi.com/2/users/get_space_usage',
      null, // no data needed for this endpoint
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info('Successfully fetched Dropbox space usage');
    return response.data;
  } catch (error) {
    // logger.error('Error fetching Dropbox space usage:', error);
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
    // Log token length and type for debugging
    const logInfo = {
      tokenLength: token ? token.length : 0,
      tokenType: typeof token,
      tokenSample: token
        ? `${token.substring(0, 5)}...${token.substring(token.length - 5)}`
        : 'none',
      isJson: false,
    };

    logger.info('Testing Dropbox token validity', logInfo);

    // First check if token is a JSON string and extract the token
    let tokenValue = token;

    try {
      const parsedConfig = JSON.parse(token);
      if (parsedConfig && typeof parsedConfig === 'object') {
        logInfo.isJson = true;
        tokenValue = parsedConfig.token || parsedConfig.access_token || token;
        logger.info('Extracted token from JSON config for validation', {
          ...logInfo,
          hasToken: !!parsedConfig.token,
          hasAccessToken: !!parsedConfig.access_token,
        });
      }
    } catch (e) {
      // Not a JSON string, use token as is
    }

    // Now try to decrypt the token if it's encrypted
    try {
      const decryptedToken = decryptData(tokenValue);
      logger.info('Successfully decrypted token for validation', {
        ...logInfo,
        decryptedLength: decryptedToken.length,
        decryptedSample: `${decryptedToken.substring(0, 5)}...${decryptedToken.substring(decryptedToken.length - 5)}`,
      });
      tokenValue = decryptedToken;
    } catch (decryptError) {
      logger.info('Token validation using non-decrypted token', logInfo);
      // Use token as-is if decryption fails
    }

    // Use the direct API call instead of fetchDropboxAccountInfo to avoid nested decryption attempts
    await axios.post('https://api.dropboxapi.com/2/users/get_current_account', null, {
      headers: {
        Authorization: `Bearer ${tokenValue}`,
        'Content-Type': 'application/json',
      },
    });

    logger.info('Dropbox token is valid');
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Token validation failed: ${errorMessage}`);
    return false;
  }
}
