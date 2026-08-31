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
 * Drive folder names can technically contain almost anything (Drive isn't a POSIX filesystem -
 * a "/" in a folder's `name` property doesn't create a nested path there), but this module also
 * builds and later re-parses slash-delimited storage_path strings to represent that nesting for
 * our own bookkeeping (retention lookups walk it segment by segment), so a "/" or "\" in a site
 * name would make that string ambiguous to split back apart correctly. Replace them; leave
 * every other character as-is - findOrCreateFolder already escapes single quotes for the query.
 */
function sanitizeFolderName(name: string): string {
  const cleaned = name.replace(/[\\/]+/g, '-').trim();
  return cleaned || 'Untitled Site';
}

/**
 * Format a shared run timestamp into the UTC date/time folder segments used below - matches how
 * timestamps are logged elsewhere in this codebase (UTC, to avoid local-timezone ambiguity
 * across sites/servers), rendered as YYYY-MM-DD and HH-MM-SS (dashes, not colons, since folder
 * names end up as path segments in storage_path).
 */
function formatUtcDateTimeSegments(timestamp: Date): { dateSegment: string; timeSegment: string } {
  const iso = timestamp.toISOString(); // "2026-08-27T14:32:10.123Z"
  return {
    dateSegment: iso.slice(0, 10),
    timeSegment: iso.slice(11, 19).replace(/:/g, '-'),
  };
}

/**
 * Strip the "<processId>-" prefix the WordPress plugin bakes into local backup filenames (e.g.
 * "a1b2c3-db.sql.gz") - redundant once the file lives in a site/date/time-scoped Drive folder,
 * so drop it rather than carry an opaque ID into every file name on Drive too. Recognizes the
 * two suffixes the plugin's export_database()/export_files() actually produce; anything else is
 * left untouched rather than guessed at.
 */
function stripProcessIdPrefix(fileName: string): string {
  const match = fileName.match(/-(db\.sql\.gz|files\.zip)$/);
  return match ? match[1] : fileName;
}

/**
 * Ensure the "McCloud Backups/<Site Name>/<YYYY-MM-DD>/<HH-MM-SS>/" folder path exists for one
 * backup run, returning the innermost folder's ID plus the storage_path string that represents
 * it. Every file for that run shares this same folder - callers must pass the same `timestamp`
 * for every file in one run (compute it once per backup, not per-file), or db.sql.gz and
 * files.zip would land in two different HH-MM-SS folders a few seconds apart.
 */
async function ensureBackupFolder(
  drive: drive_v3.Drive,
  siteName: string,
  timestamp: Date
): Promise<{ folderId: string; storagePath: string }> {
  const safeSiteName = sanitizeFolderName(siteName);
  const { dateSegment, timeSegment } = formatUtcDateTimeSegments(timestamp);

  const rootId = await findOrCreateFolder(drive, ROOT_FOLDER_NAME);
  const siteId = await findOrCreateFolder(drive, safeSiteName, rootId);
  const dateId = await findOrCreateFolder(drive, dateSegment, siteId);
  const timeId = await findOrCreateFolder(drive, timeSegment, dateId);

  return {
    folderId: timeId,
    storagePath: `${ROOT_FOLDER_NAME}/${safeSiteName}/${dateSegment}/${timeSegment}`,
  };
}

export interface UploadedDriveFile {
  fileId: string;
  folderId: string;
  storagePath: string;
  name: string;
  size: number;
  webViewLink?: string;
}

/**
 * Upload one local file into "McCloud Backups/<Site Name>/<YYYY-MM-DD>/<HH-MM-SS>/<fileName>"
 * on Google Drive. Streams from disk rather than buffering the whole file in memory - backups
 * here have run up to ~4GB+ in this session, so buffering the whole thing would be a real memory
 * risk. `timestamp` should be the same Date instance across every file in one backup run, so
 * they all resolve to the same HH-MM-SS folder rather than each getting their own.
 */
export async function uploadFileToGoogleDrive(
  accessToken: string,
  localFilePath: string,
  siteName: string,
  timestamp: Date,
  fileName: string
): Promise<UploadedDriveFile> {
  const drive = getDriveClient(accessToken);
  const { folderId, storagePath } = await ensureBackupFolder(drive, siteName, timestamp);
  const driveFileName = stripProcessIdPrefix(fileName);

  const stat = await fs.promises.stat(localFilePath);

  const response = await drive.files.create({
    requestBody: {
      name: driveFileName,
      parents: [folderId],
    },
    media: {
      body: fs.createReadStream(localFilePath),
    },
    fields: 'id, name, size, webViewLink',
  });

  if (!response.data.id) {
    throw new Error(`Google Drive upload for ${driveFileName} did not return a file ID`);
  }

  return {
    fileId: response.data.id,
    folderId,
    storagePath,
    name: response.data.name || driveFileName,
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
 * Delete the deepest folder in a stored storage_path (and everything in it) from Drive - one
 * API call takes every file in it with it, rather than listing and deleting files one at a
 * time. Used by the retention job.
 *
 * Takes the full path exactly as stored on backups.storage_path (e.g.
 * "McCloud Backups/Site Name/2026-08-27/14-32-10") and walks it segment by segment via plain
 * lookups (not findOrCreateFolder - nothing should be created while deleting). This works
 * uniformly for both the current per-run nested layout and the flat "McCloud Backups/<processId>"
 * paths already stored on backups uploaded before this structure changed - both are just
 * slash-delimited segments from Drive's root either way, so there's no need to special-case
 * which shape a given row's path is in.
 *
 * Known minor side effect: this only deletes the deepest (leaf) folder for a run, not any now-
 * empty parent date/site folders left behind once every run under them has aged out - Drive
 * doesn't auto-prune those, and safely detecting "is this parent folder now empty, and is it
 * safe to remove" is more than this function needs to do. Empty date/site folders may
 * accumulate slowly over time; not a functional problem, just a minor cosmetic one.
 */
export async function deleteGoogleDriveBackupFolder(
  accessToken: string,
  storagePath: string
): Promise<void> {
  const drive = getDriveClient(accessToken);
  const segments = storagePath.split('/').filter(Boolean);

  if (segments.length === 0) {
    logger.debug(`Google Drive: empty storage path, nothing to delete`);
    return;
  }

  let parentId: string | undefined;
  let folderId: string | undefined;

  for (const segment of segments) {
    const parentClause = parentId ? `and '${parentId}' in parents` : `and 'root' in parents`;
    const existing = await drive.files.list({
      q: `mimeType = 'application/vnd.google-apps.folder' and name = '${segment.replace(/'/g, "\\'")}' and trashed = false ${parentClause}`,
      fields: 'files(id)',
    });

    const found = existing.data.files?.[0];
    if (!found?.id) {
      // Nothing to delete - already gone, or never uploaded. Not an error.
      logger.debug(`Google Drive: folder segment "${segment}" not found while resolving "${storagePath}", nothing to delete`);
      return;
    }

    parentId = found.id;
    folderId = found.id;
  }

  if (!folderId) {
    return;
  }

  await drive.files.delete({ fileId: folderId });
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
