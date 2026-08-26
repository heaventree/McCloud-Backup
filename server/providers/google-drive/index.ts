/**
 * Google Drive storage provider - file operations.
 *
 * Modeled on server/providers/dropbox/index.ts's function-based style (not the
 * BackupProvider/BackupProviderFactory class interface in server/providers/types.ts, which only
 * GitHub actually implements) - every real backup-file operation in this codebase (Dropbox
 * included) is driven ad hoc as plain functions taking a bearer access token, not through that
 * registry, so this follows the pattern that's actually proven in production rather than the
 * aspirational one.
 *
 * Every function here takes a raw OAuth access token (the caller is expected to obtain a valid
 * one via tokenRefreshManager.getValidAccessToken(storageProviderId) first, same as the Dropbox
 * call sites do) rather than managing its own refresh - keeps this module a thin, stateless
 * wrapper around the Drive v3 API.
 */

import { google, drive_v3 } from 'googleapis';
import fs from 'fs';
import logger from '../../utils/logger';

const ROOT_FOLDER_NAME = 'McCloud Backups';

function getDriveClient(accessToken: string): drive_v3.Drive {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth });
}

/**
 * Find a folder by name under a given parent (or at Drive root if parentId is undefined),
 * creating it if it doesn't exist. Drive allows duplicate folder names, so this always searches
 * first rather than blindly creating - repeated calls converge on the same folder instead of
 * multiplying it.
 */
async function findOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId?: string
): Promise<string> {
  const parentClause = parentId ? `and '${parentId}' in parents` : `and 'root' in parents`;
  const query = `mimeType = 'application/vnd.google-apps.folder' and name = '${name.replace(/'/g, "\\'")}' and trashed = false ${parentClause}`;

  const existing = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (existing.data.files && existing.data.files.length > 0 && existing.data.files[0].id) {
    return existing.data.files[0].id;
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id',
  });

  if (!created.data.id) {
    throw new Error(`Failed to create Google Drive folder "${name}"`);
  }

  return created.data.id;
}

/**
 * Ensure the "McCloud Backups/<processId>/" folder path exists, returning the inner folder's
 * ID. Every file for one backup run lives together in that one processId-named folder.
 */
async function ensureBackupFolder(drive: drive_v3.Drive, processId: string): Promise<string> {
  const rootId = await findOrCreateFolder(drive, ROOT_FOLDER_NAME);
  return findOrCreateFolder(drive, processId, rootId);
}

export interface UploadedDriveFile {
  fileId: string;
  folderId: string;
  name: string;
  size: number;
  webViewLink?: string;
}

/**
 * Upload one local file into "McCloud Backups/<processId>/<fileName>" on Google Drive.
 * Streams from disk rather than buffering the whole file in memory - backups here have run up
 * to ~4GB+ in this session, so buffering the whole thing would be a real memory risk.
 */
export async function uploadFileToGoogleDrive(
  accessToken: string,
  localFilePath: string,
  processId: string,
  fileName: string
): Promise<UploadedDriveFile> {
  const drive = getDriveClient(accessToken);
  const folderId = await ensureBackupFolder(drive, processId);

  const stat = await fs.promises.stat(localFilePath);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      body: fs.createReadStream(localFilePath),
    },
    fields: 'id, name, size, webViewLink',
  });

  if (!response.data.id) {
    throw new Error(`Google Drive upload for ${fileName} did not return a file ID`);
  }

  return {
    fileId: response.data.id,
    folderId,
    name: response.data.name || fileName,
    size: response.data.size ? parseInt(response.data.size, 10) : stat.size,
    webViewLink: response.data.webViewLink || undefined,
  };
}

/**
 * Download a single Drive file to a local path, streaming rather than buffering.
 */
export async function downloadFileFromGoogleDrive(
  accessToken: string,
  fileId: string,
  destPath: string
): Promise<void> {
  const drive = getDriveClient(accessToken);

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );

  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(destPath);
    (response.data as NodeJS.ReadableStream).pipe(writer);
    writer.on('finish', () => resolve());
    writer.on('error', reject);
    (response.data as NodeJS.ReadableStream).on('error', reject);
  });
}

/**
 * Sum the size of every file directly inside "McCloud Backups/<processId>/", paginating through
 * Drive's file listing. Mirrors fetchDropboxFolderSizeByPath's purpose for the Dropbox provider.
 */
export async function getGoogleDriveFolderSize(
  accessToken: string,
  processId: string
): Promise<number> {
  const drive = getDriveClient(accessToken);
  const rootId = await findOrCreateFolder(drive, ROOT_FOLDER_NAME);
  const folderId = await findOrCreateFolder(drive, processId, rootId);

  let total = 0;
  let pageToken: string | undefined;

  do {
    const page = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, size)',
      pageSize: 1000,
      pageToken,
    });

    for (const file of page.data.files || []) {
      total += file.size ? parseInt(file.size, 10) : 0;
    }

    pageToken = page.data.nextPageToken || undefined;
  } while (pageToken);

  return total;
}

/**
 * Delete the entire "McCloud Backups/<processId>/" folder (and everything in it) from Drive.
 * Used by the retention job - deleting the folder is one API call and takes every file in it
 * with it, rather than listing and deleting files one at a time.
 */
export async function deleteGoogleDriveBackupFolder(
  accessToken: string,
  processId: string
): Promise<void> {
  const drive = getDriveClient(accessToken);
  const rootId = await findOrCreateFolder(drive, ROOT_FOLDER_NAME);

  const existing = await drive.files.list({
    q: `mimeType = 'application/vnd.google-apps.folder' and name = '${processId.replace(/'/g, "\\'")}' and trashed = false and '${rootId}' in parents`,
    fields: 'files(id)',
  });

  const folder = existing.data.files?.[0];
  if (!folder?.id) {
    // Nothing to delete - already gone or never uploaded. Not an error.
    logger.debug(`Google Drive: no backup folder found for ${processId}, nothing to delete`);
    return;
  }

  await drive.files.delete({ fileId: folder.id });
}

/**
 * Basic reachability/permission check - lists the caller's Drive "About" info. Used the same
 * way testDropboxToken() is used for Dropbox: confirm a token actually works before relying on
 * it for a real upload.
 */
export async function testGoogleDriveToken(accessToken: string): Promise<{
  valid: boolean;
  email?: string;
  error?: string;
}> {
  try {
    const drive = getDriveClient(accessToken);
    const about = await drive.about.get({ fields: 'user' });
    return { valid: true, email: about.data.user?.emailAddress || undefined };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
