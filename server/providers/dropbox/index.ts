import axios from 'axios';
import logger from '../../utils/logger';
import { createWriteStream } from 'fs';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { Readable } from 'stream';
import archiver from 'archiver';
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
 * Get actual download size from Dropbox (including compression for directories)
 * @param token The access token (may or may not be encrypted)
 * @param filePath The path of the file to get size for in Dropbox
 * @returns The actual download size and filename (matches what downloadDropboxFile returns)
 */
export async function getDropboxDownloadSize(token: string, filePath: string): Promise<{ size: number; filename: string }> {
  try {
    // Process the token using our utility function (handles HTML entities and JSON parsing)
    const accessToken = processDropboxToken(token);
    
    // Check if it's a directory path - for directories, we need to create the actual ZIP to get real size
    if (filePath.endsWith('/')) {
      logger.info(`Getting actual compressed size for directory: ${filePath}`);
      
      // Use the same logic as downloadDropboxDirectory but only return size
      const downloadResult = await downloadDropboxDirectory(accessToken, filePath);
      
      return {
        size: downloadResult.content.length,
        filename: downloadResult.filename
      };
    } else {
      // Single file - get actual file size
      const response = await axios.post(
        'https://api.dropboxapi.com/2/files/get_metadata',
        {
          path: filePath
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const filename = filePath.split('/').pop() || 'backup.zip';
      
      return {
        size: response.data.size,
        filename
      };
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data ? 
        (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data)) : 
        error.message;
      logger.error(`Error getting download size from Dropbox: ${errorMessage}`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        filePath
      });
      throw new Error(`Failed to get download size from Dropbox: ${errorMessage}`);
    }
    logger.error('Error getting download size from Dropbox:', error);
    throw error;
  }
}

/**
 * Get file metadata from Dropbox (uncompressed sizes for directories)
 * @param token The access token (may or may not be encrypted)
 * @param filePath The path of the file to get metadata for in Dropbox
 * @returns The file metadata including size and filename
 */
export async function getDropboxFileMetadata(token: string, filePath: string): Promise<{ size: number; filename: string }> {
  try {
    // Process the token using our utility function (handles HTML entities and JSON parsing)
    const accessToken = processDropboxToken(token);
    
    // Check if it's a directory path - for directories, we need to list and sum file sizes
    if (filePath.endsWith('/')) {
      const directoryPath = filePath.replace(/\/$/, ''); // Remove trailing slash
      
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
            'Content-Type': 'application/json'
          }
        }
      );

      const files = listResponse.data.entries.filter((entry: any) => entry['.tag'] === 'file');
      const totalSize = files.reduce((sum: number, file: any) => sum + file.size, 0);
      const dirName = directoryPath.split('/').pop() || 'backup';
      
      return {
        size: totalSize,
        filename: `${dirName}-backup.zip`
      };
    } else {
      // Single file metadata
      const response = await axios.post(
        'https://api.dropboxapi.com/2/files/get_metadata',
        {
          path: filePath
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const filename = filePath.split('/').pop() || 'backup.zip';
      
      return {
        size: response.data.size,
        filename
      };
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data ? 
        (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data)) : 
        error.message;
      logger.error(`Error getting metadata from Dropbox: ${errorMessage}`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        filePath
      });
      throw new Error(`Failed to get metadata from Dropbox: ${errorMessage}`);
    }
    logger.error('Error getting metadata from Dropbox:', error);
    throw error;
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

/**
 * Get the total size of the MCCLOUD - BACKUPS folder from Dropbox
 * @param token The access token (may or may not be encrypted)
 * @returns The total size in bytes of all files in the MCCLOUD - BACKUPS folder
 */
export async function fetchDropboxBackupsFolderSize(token: string): Promise<number> {
  try {
    // Process the token using our utility function (handles HTML entities and JSON parsing)
    const accessToken = processDropboxToken(token);
    
    const folderPath = '/MCCLOUD - BACKUPS';
    
    // Get the total size by recursively listing all files in the folder
    return await getDropboxFolderSizeRecursive(accessToken, folderPath);
    
  } catch (error) {
    logger.error(`Error fetching MCCLOUD - BACKUPS folder size:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      folderPath: '/MCCLOUD - BACKUPS'
    });
    throw error;
  }
}

/**
 * Get the total size of a specific Dropbox folder by path
 * @param token The access token (may or may not be encrypted)
 * @param folderPath The specific folder path to get size for
 * @returns The total size in bytes of all files in the specified folder
 */
export async function fetchDropboxFolderSizeByPath(token: string, folderPath: string): Promise<number> {
  try {
    // Process the token using our utility function (handles HTML entities and JSON parsing)
    const accessToken = processDropboxToken(token);
    
    // Get the total size by recursively listing all files in the folder
    return await getDropboxFolderSizeRecursive(accessToken, folderPath);
    
  } catch (error) {
    logger.error(`Error fetching Dropbox folder size:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      folderPath
    });
    throw error;
  }
}

/**
 * Recursively calculate the total size of a Dropbox folder
 * @param accessToken The processed Dropbox access token
 * @param folderPath The path to the folder to calculate size for
 * @returns The total size in bytes
 */
async function getDropboxFolderSizeRecursive(accessToken: string, folderPath: string): Promise<number> {
  try {
    let totalSize = 0;
    let hasMore = true;
    let cursor: string | undefined;

    // Handle pagination for large folders
    while (hasMore) {
      const listResponse = await axios.post(
        cursor ? 'https://api.dropboxapi.com/2/files/list_folder/continue' : 'https://api.dropboxapi.com/2/files/list_folder',
        cursor ? { cursor } : {
          path: folderPath,
          recursive: true // Get all files and subfolders recursively
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const { entries, has_more, cursor: nextCursor } = listResponse.data;
      
      // Sum up file sizes (folders don't have size)
      for (const entry of entries) {
        if (entry['.tag'] === 'file' && entry.size) {
          totalSize += entry.size;
        }
      }

      hasMore = has_more;
      cursor = nextCursor;
    }

    logger.info(`Total size calculated for ${folderPath}: ${totalSize} bytes`);
    return totalSize;
    
  } catch (error) {
    // If folder doesn't exist, return 0
    if (error instanceof Error && error.message.includes('not_found')) {
      logger.info(`Folder ${folderPath} not found, returning size 0`);
      return 0;
    }
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
  logger.info(`Downloading directory as ZIP: ${dirPath}`);

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
    meta: {
      filenames: files.map((f: any) => f.name)
    }
  });

  if (files.length === 0) {
    throw new Error('No files found in backup directory');
  }

  // Create a proper ZIP archive using archiver
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    const chunks: Buffer[] = [];
    
    // Collect archive data
    archive.on('data', (chunk) => {
      chunks.push(chunk);
    });

    // Handle archive completion
    archive.on('end', () => {
      const archiveBuffer = Buffer.concat(chunks);
      
      // Generate filename from directory name
      const dirName = directoryPath.split('/').pop() || 'backup';
      const archiveFilename = `${dirName}-backup.zip`;

      logger.info(`Successfully created backup archive: ${archiveFilename}, size: ${archiveBuffer.length} bytes`);

      resolve({
        content: archiveBuffer,
        filename: archiveFilename,
        contentType: 'application/zip'
      });
    });

    // Handle errors
    archive.on('error', (err) => {
      logger.error('Archive creation error:', err);
      reject(err);
    });

    // Download and add each file to the archive
    (async () => {
      try {
        for (const file of files) {
          try {
            logger.info(`Downloading file for archive: ${file.name}`);
            
            const fileContent = await downloadSingleDropboxFile(accessToken, file.path_display || file.path_lower);
            
            // Add file to archive with its original name
            archive.append(fileContent.content, { name: file.name });
            
          } catch (fileError) {
            logger.warn(`Failed to download file ${file.name}, skipping: ${fileError}`);
          }
        }

        // Finalize the archive
        archive.finalize();
        
      } catch (error) {
        logger.error('Error during archive creation:', error);
        reject(error);
      }
    })();
  });
}

/**
 * Get a readable stream for a single file from Dropbox
 * @param accessToken The processed Dropbox access token
 * @param filePath The path of the file in Dropbox
 * @returns A readable stream for the file content
 */
async function getDropboxFileStream(accessToken: string, filePath: string): Promise<Readable> {
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
      'Content-Type': 'application/octet-stream'
    },
    responseType: 'stream',
    data: null,
  });

  return response.data;
}

/**
 * Stream a Dropbox directory as a ZIP archive directly to a writable stream
 * @param token The access token (may or may not be encrypted)
 * @param filePath The directory path in Dropbox
 * @param outputStream The writable stream to pipe the ZIP to (e.g., response)
 * @returns Promise that resolves when streaming is complete, with filename info
 */
export async function streamDropboxDirectoryAsZip(
  token: string,
  filePath: string,
  outputStream: NodeJS.WritableStream
): Promise<{ filename: string }> {
  const accessToken = processDropboxToken(token);
  
  logger.info(`Streaming directory as ZIP: ${filePath}`);

  const directoryPath = filePath.replace(/\/$/, ''); // Remove trailing slash
  
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
  logger.info(`Found ${files.length} files to stream in archive:`, { 
    meta: {
      filenames: files.map((f: any) => f.name)
    }
  });

  if (files.length === 0) {
    throw new Error('No files found in backup directory');
  }

  // Create ZIP archive and pipe it to output stream
  const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
  });

  // Handle errors
  archive.on('error', (err) => {
    logger.error('Archive streaming error:', err);
    throw err;
  });

  // Pipe archive to output stream
  archive.pipe(outputStream);

  // Add each file to archive by streaming from Dropbox
  for (const file of files) {
    try {
      logger.info(`Streaming file to archive: ${file.name}`);
      
      // Get stream for this file
      const fileStream = await getDropboxFileStream(accessToken, file.path_display || file.path_lower);
      
      // Add stream to archive with original filename
      archive.append(fileStream, { name: file.name });
      
    } catch (fileError) {
      logger.warn(`Failed to stream file ${file.name}, skipping: ${fileError}`);
    }
  }

  // Finalize the archive (this will trigger the 'end' event on the output stream)
  archive.finalize();

  // Generate filename from directory name
  const dirName = directoryPath.split('/').pop() || 'backup';
  const filename = `${dirName}-backup.zip`;

  logger.info(`Successfully started streaming backup archive: ${filename}`);

  return { filename };
}

/**
 * Stream a single file from Dropbox directly to a writable stream
 * @param token The access token (may or may not be encrypted)
 * @param filePath The file path in Dropbox
 * @param outputStream The writable stream to pipe the file to
 * @returns Promise that resolves when streaming is complete, with filename info
 */
export async function streamDropboxFile(
  token: string,
  filePath: string,
  outputStream: NodeJS.WritableStream
): Promise<{ filename: string }> {
  const accessToken = processDropboxToken(token);
  
  logger.info(`Streaming single file from Dropbox: ${filePath}`);

  const fileStream = await getDropboxFileStream(accessToken, filePath);
  
  // Pipe file stream directly to output
  fileStream.pipe(outputStream);

  const filename = filePath.split('/').pop() || 'backup.zip';

  logger.info(`Successfully started streaming file: ${filename}`);

  return { filename };
}
