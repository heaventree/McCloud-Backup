import axios from 'axios';
import logger from '../../utils/logger';

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

      } else if (parsedJson.token) {
        processedToken = parsedJson.token;

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
    // Process the token using our utility function (handles HTML entities and JSON parsing)
    const accessToken = processDropboxToken(token);
    


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
    // Process the token using our utility function (handles HTML entities and JSON parsing)
    const accessToken = processDropboxToken(token);

    // Make a direct API call to validate the token
    await axios.post('https://api.dropboxapi.com/2/users/get_current_account', null, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });


    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Token validation failed: ${errorMessage}`);
    return false;
  }
}
