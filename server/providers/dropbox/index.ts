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

/**
 * Download a file from Dropbox
 * @param token The access token (may or may not be encrypted)
 * @param filePath The path of the file to download in Dropbox
 * @returns The file content as a buffer
 */
export async function downloadDropboxFile(token: string, filePath: string): Promise<{ content: Buffer; filename: string; contentType?: string }> {
  try {
    // Process the token using our utility function (handles HTML entities and JSON parsing)
    const accessToken = processDropboxToken(token);
    
    logger.info(`Attempting to download file from Dropbox: ${filePath}`);

    let actualFilePath = filePath;

    // If the path ends with '/', it's likely a directory - we need to find the actual file
    if (filePath.endsWith('/')) {
      logger.info(`Path appears to be a directory, listing contents to find backup file: ${filePath}`);
      
      try {
        const directoryPath = filePath.replace(/\/$/, ''); // Remove trailing slash
        logger.info(`Listing directory: ${directoryPath}`);
        
        // List folder contents to find the backup file
        const listResponse = await axios.post(
          'https://api.dropboxapi.com/2/files/list_folder',
          {
            path: directoryPath,
            recursive: false
          },
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        logger.info(`Directory listing response:`, { entries: listResponse.data.entries.length });
        
        // Log all files for debugging
        const allFiles = listResponse.data.entries.filter((entry: any) => entry['.tag'] === 'file');
        logger.info(`Found ${allFiles.length} files:`, { 
          filenames: allFiles.map((f: any) => f.name) 
        });

        const files = listResponse.data.entries.filter((entry: any) => 
          entry['.tag'] === 'file' && 
          (entry.name.endsWith('.zip') || 
           entry.name.endsWith('.tar.gz') || 
           entry.name.endsWith('.gz') ||
           entry.name.endsWith('.sql') ||
           entry.name.endsWith('.tar') ||
           entry.name.includes('backup') ||
           entry.name.includes('dump') ||
           entry.name.includes('export'))
        );

        logger.info(`Filtered backup files:`, { 
          count: files.length,
          filenames: files.map((f: any) => f.name) 
        });

        if (files.length === 0) {
          // If no specific backup files found, try to get any file (fallback)
          if (allFiles.length > 0) {
            logger.info('No specific backup files found, using first available file as fallback');
            files.push(allFiles[0]);
          } else {
            throw new Error('No files found in directory');
          }
        }

        // Use the first backup file found (prioritize .zip files)
        const backupFile = files.find((f: any) => f.name.endsWith('.zip')) || files[0];
        actualFilePath = backupFile.path_display || backupFile.path_lower;
        logger.info(`Found backup file: ${actualFilePath}`);
        
      } catch (listError) {
        logger.warn(`Failed to list directory contents, trying direct download: ${listError}`);
        // If listing fails, try appending a common backup filename
        actualFilePath = filePath.replace(/\/$/, '') + '/backup.zip';
      }
    }

    // Create a custom axios instance with specific configuration
    const axiosInstance = axios.create({
      timeout: 120000, // 2 minutes timeout for large files
    });

    // Download the actual file
    const response = await axiosInstance.request({
      method: 'POST',
      url: 'https://content.dropboxapi.com/2/files/download',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({
          path: actualFilePath
        }),
      },
      responseType: 'arraybuffer',
      // Override any default transforms
      transformRequest: (data, headers) => {
        // Delete any content-type header that axios might set
        delete headers['Content-Type'];
        // Set it explicitly to a value Dropbox accepts
        headers['Content-Type'] = 'application/octet-stream';
        return data;
      },
      // Send empty data
      data: null,
    });

    // Extract filename from the actual file path
    const filename = actualFilePath.split('/').pop() || 'backup.zip';
    
    // Get content type from response headers
    const contentType = response.headers['content-type'] || 'application/octet-stream';

    logger.info(`Successfully downloaded file from Dropbox: ${filename}, size: ${response.data.byteLength} bytes`);

    return {
      content: Buffer.from(response.data),
      filename,
      contentType
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data ? 
        (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data)) : 
        error.message;
      logger.error(`Error downloading file from Dropbox: ${errorMessage}`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        filePath
      });
      throw new Error(`Failed to download file from Dropbox: ${errorMessage}`);
    }
    logger.error('Error downloading file from Dropbox:', error);
    throw error;
  }
}
