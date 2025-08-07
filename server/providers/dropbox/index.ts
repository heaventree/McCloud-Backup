import axios from 'axios';
import logger from '../../utils/logger';
import { createWriteStream } from 'fs';
import { promisify } from 'util';
import { pipeline } from 'stream';
const streamPipeline = promisify(pipeline);

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
    
    logger.info(`Attempting to download from Dropbox: ${filePath}`);

    // Check if it's a directory path
    if (filePath.endsWith('/')) {
      return await downloadDropboxDirectory(accessToken, filePath);
    } else {
      return await downloadSingleDropboxFile(accessToken, filePath);
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data ? 
        (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data)) : 
        error.message;
      logger.error(`Error downloading from Dropbox: ${errorMessage}`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        filePath
      });
      throw new Error(`Failed to download from Dropbox: ${errorMessage}`);
    }
    logger.error('Error downloading from Dropbox:', error);
    throw error;
  }
}

async function downloadSingleDropboxFile(accessToken: string, filePath: string): Promise<{ content: Buffer; filename: string; contentType?: string }> {
  const axiosInstance = axios.create({
    timeout: 120000, // 2 minutes timeout for large files
  });

  const response = await axiosInstance.request({
    method: 'POST',
    url: 'https://content.dropboxapi.com/2/files/download',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Dropbox-API-Arg': JSON.stringify({
        path: filePath
      }),
    },
    responseType: 'arraybuffer',
    transformRequest: (data, headers) => {
      delete headers['Content-Type'];
      headers['Content-Type'] = 'application/octet-stream';
      return data;
    },
    data: null,
  });

  const filename = filePath.split('/').pop() || 'backup.zip';
  const contentType = response.headers['content-type'] || 'application/octet-stream';

  logger.info(`Successfully downloaded single file: ${filename}, size: ${response.data.byteLength} bytes`);

  return {
    content: Buffer.from(response.data),
    filename,
    contentType
  };
}

async function downloadDropboxDirectory(accessToken: string, dirPath: string): Promise<{ content: Buffer; filename: string; contentType?: string }> {
  logger.info(`Downloading directory as TAR: ${dirPath}`);

  const directoryPath = dirPath.replace(/\/$/, ''); // Remove trailing slash
  
  // List folder contents
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

  const files = listResponse.data.entries.filter((entry: any) => entry['.tag'] === 'file');
  logger.info(`Found ${files.length} files to include in archive:`, { 
    filenames: files.map((f: any) => f.name) 
  });

  if (files.length === 0) {
    throw new Error('No files found in backup directory');
  }

  // Simple approach: Download all files and concatenate them with headers
  // This creates a simple archive format for backup purposes
  const archiveData: Buffer[] = [];
  
  for (const file of files) {
    try {
      logger.info(`Downloading file for archive: ${file.name}`);
      
      const fileContent = await downloadSingleDropboxFile(accessToken, file.path_display || file.path_lower);
      
      // Add file header with name and size
      const header = `==== FILE: ${file.name} (${fileContent.content.length} bytes) ====\n`;
      const headerBuffer = Buffer.from(header, 'utf8');
      
      archiveData.push(headerBuffer);
      archiveData.push(fileContent.content);
      archiveData.push(Buffer.from('\n==== END FILE ====\n\n', 'utf8'));
      
    } catch (fileError) {
      logger.warn(`Failed to download file ${file.name}, skipping: ${fileError}`);
    }
  }

  const archiveBuffer = Buffer.concat(archiveData);
  
  // Generate filename from directory name
  const dirName = directoryPath.split('/').pop() || 'backup';
  const archiveFilename = `${dirName}-backup.txt`;

  logger.info(`Successfully created backup archive: ${archiveFilename}, size: ${archiveBuffer.length} bytes`);

  return {
    content: archiveBuffer,
    filename: archiveFilename,
    contentType: 'application/octet-stream'
  };
}
