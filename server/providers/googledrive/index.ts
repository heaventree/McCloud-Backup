import axios from 'axios';
import logger from '../../utils/logger';

export function processGoogleDriveToken(token: string): string {
  if (!token) return token;
  
  let processedToken = token;
  
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
  
  try {
    const parsedJson = JSON.parse(processedToken);
    if (parsedJson && typeof parsedJson === 'object') {
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

export async function fetchGoogleDriveAccountInfo(token: string) {
  try {
    const accessToken = processGoogleDriveToken(token);
    
    const response = await axios.get(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    logger.error('Error fetching Google Drive account info:', error);
    throw error;
  }
}

export async function fetchGoogleDriveSpaceUsage(token: string) {
  try {
    const accessToken = processGoogleDriveToken(token);
    
    const response = await axios.get(
      'https://www.googleapis.com/drive/v3/about',
      {
        params: {
          fields: 'storageQuota'
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const quota = response.data.storageQuota;
    return {
      used: parseInt(quota.usage || '0'),
      allocation: {
        allocated: parseInt(quota.limit || '0')
      }
    };
  } catch (error) {
    logger.error('Error fetching Google Drive space usage:', error);
    throw error;
  }
}

export async function testGoogleDriveToken(token: string): Promise<boolean> {
  try {
    const accessToken = processGoogleDriveToken(token);

    await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Google Drive token validation failed: ${errorMessage}`);
    return false;
  }
}

export async function createGoogleDriveFolder(token: string, folderName: string, parentId?: string): Promise<string> {
  try {
    const accessToken = processGoogleDriveToken(token);
    
    const metadata: any = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };
    
    if (parentId) {
      metadata.parents = [parentId];
    }
    
    const response = await axios.post(
      'https://www.googleapis.com/drive/v3/files',
      metadata,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.id;
  } catch (error) {
    logger.error('Error creating Google Drive folder:', error);
    throw error;
  }
}

export async function findOrCreateBackupFolder(token: string, siteName: string): Promise<string> {
  try {
    const accessToken = processGoogleDriveToken(token);
    
    const backupFolderName = 'McCloud Backups';
    const siteFolderName = siteName.replace(/[^a-zA-Z0-9-_]/g, '_');
    
    let backupFolderId = await findFolderByName(accessToken, backupFolderName);
    if (!backupFolderId) {
      backupFolderId = await createGoogleDriveFolder(accessToken, backupFolderName);
    }
    
    let siteFolderId = await findFolderByName(accessToken, siteFolderName, backupFolderId);
    if (!siteFolderId) {
      siteFolderId = await createGoogleDriveFolder(accessToken, siteFolderName, backupFolderId);
    }
    
    return siteFolderId;
  } catch (error) {
    logger.error('Error finding or creating backup folder:', error);
    throw error;
  }
}

async function findFolderByName(token: string, folderName: string, parentId?: string): Promise<string | null> {
  try {
    let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }
    
    const response = await axios.get(
      'https://www.googleapis.com/drive/v3/files',
      {
        params: {
          q: query,
          fields: 'files(id, name)',
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id;
    }
    
    return null;
  } catch (error) {
    logger.error('Error finding folder by name:', error);
    return null;
  }
}

export async function uploadToGoogleDrive(
  token: string,
  fileBuffer: Buffer,
  fileName: string,
  folderId: string,
  mimeType: string = 'application/zip'
): Promise<{ fileId: string; webViewLink: string }> {
  try {
    const accessToken = processGoogleDriveToken(token);
    
    const metadata = {
      name: fileName,
      parents: [folderId],
    };
    
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;
    
    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n` +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      fileBuffer.toString('base64') +
      closeDelimiter;
    
    const response = await axios.post(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      multipartRequestBody,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    return {
      fileId: response.data.id,
      webViewLink: response.data.webViewLink || `https://drive.google.com/file/d/${response.data.id}/view`,
    };
  } catch (error) {
    logger.error('Error uploading to Google Drive:', error);
    throw error;
  }
}

export async function downloadFromGoogleDrive(token: string, fileId: string): Promise<Buffer> {
  try {
    const accessToken = processGoogleDriveToken(token);
    
    const response = await axios.get(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        params: {
          alt: 'media',
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        responseType: 'arraybuffer',
      }
    );

    return Buffer.from(response.data);
  } catch (error) {
    logger.error('Error downloading from Google Drive:', error);
    throw error;
  }
}

export async function deleteFromGoogleDrive(token: string, fileId: string): Promise<void> {
  try {
    const accessToken = processGoogleDriveToken(token);
    
    await axios.delete(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
  } catch (error) {
    logger.error('Error deleting from Google Drive:', error);
    throw error;
  }
}

export async function listGoogleDriveBackups(token: string, folderId: string): Promise<any[]> {
  try {
    const accessToken = processGoogleDriveToken(token);
    
    const response = await axios.get(
      'https://www.googleapis.com/drive/v3/files',
      {
        params: {
          q: `'${folderId}' in parents and trashed=false`,
          fields: 'files(id, name, size, createdTime, modifiedTime)',
          orderBy: 'createdTime desc',
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.data.files || [];
  } catch (error) {
    logger.error('Error listing Google Drive backups:', error);
    throw error;
  }
}

export async function refreshGoogleDriveToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  token_type: string;
}> {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }
    
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('refresh_token', refreshToken);
    params.append('grant_type', 'refresh_token');
    
    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return {
      access_token: response.data.access_token,
      expires_in: response.data.expires_in,
      token_type: response.data.token_type,
    };
  } catch (error) {
    logger.error('Error refreshing Google Drive token:', error);
    throw error;
  }
}
