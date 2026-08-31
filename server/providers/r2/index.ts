/**
 * Cloudflare R2 storage provider - file operations.
 *
 * R2 is S3-API-compatible, so this uses the standard AWS SDK (@aws-sdk/client-s3) pointed at
 * R2's endpoint (https://<accountId>.r2.cloudflarestorage.com, region "auto"). Modeled on
 * server/providers/google-drive/index.ts's function-based style, not the BackupProvider class
 * interface in server/providers/types.ts - same reasoning as that module: every real
 * backup-file operation in this codebase is driven ad hoc as plain functions, not through that
 * registry.
 *
 * Unlike Google Drive, R2 credentials are static (accountId/accessKeyId/secretAccessKey/
 * bucketName) - no OAuth, no token exchange, no tokenRefreshManager involvement at all. The
 * caller reads them straight out of storage_providers.config and passes them in here.
 */

import { S3Client, PutObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import fs from 'fs';
import logger from '../../utils/logger';

export interface R2Credentials {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

const ROOT_PREFIX = 'McCloud Backups';

function getR2Client(credentials: R2Credentials): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${credentials.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
  });
}

// Same helpers as google-drive/index.ts's sanitizeFolderName/formatUtcDateTimeSegments/
// stripProcessIdPrefix, duplicated rather than shared - they're small and provider-specific
// enough (R2 keys vs. Drive folder names have different real constraints) that a shared util
// would be more indirection than it's worth for two call sites right now.
function sanitizeKeySegment(name: string): string {
  const cleaned = name.replace(/[\\/]+/g, '-').trim();
  return cleaned || 'Untitled Site';
}

function formatUtcDateTimeSegments(timestamp: Date): { dateSegment: string; timeSegment: string } {
  const iso = timestamp.toISOString(); // "2026-08-27T14:32:10.123Z"
  return {
    dateSegment: iso.slice(0, 10),
    timeSegment: iso.slice(11, 19).replace(/:/g, '-'),
  };
}

function stripProcessIdPrefix(fileName: string): string {
  const match = fileName.match(/-(db\.sql\.gz|files\.zip)$/);
  return match ? match[1] : fileName;
}

export interface UploadedR2File {
  key: string;
  storagePath: string;
  name: string;
  size: number;
}

/**
 * Upload one local file to the R2 object key
 * "McCloud Backups/<Site Name>/<YYYY-MM-DD>/<HH-MM-SS>/<fileName>" - matches the Google Drive
 * folder layout visually (R2/S3 don't have real folders, just key prefixes, but any S3-compatible
 * browser renders "/"-delimited keys as folders, so this keeps the two providers' layouts
 * equivalent to look at). Streams from disk rather than buffering the whole file in memory, same
 * reasoning as the Drive provider - backups here have run up to ~4GB+.
 *
 * `timestamp` should be the same Date instance across every file in one backup run, so they all
 * resolve to the same HH-MM-SS "folder" rather than each getting their own.
 */
export async function uploadFileToR2(
  credentials: R2Credentials,
  localFilePath: string,
  siteName: string,
  timestamp: Date,
  fileName: string
): Promise<UploadedR2File> {
  const client = getR2Client(credentials);
  const safeSiteName = sanitizeKeySegment(siteName);
  const { dateSegment, timeSegment } = formatUtcDateTimeSegments(timestamp);
  const objectFileName = stripProcessIdPrefix(fileName);

  const storagePath = `${ROOT_PREFIX}/${safeSiteName}/${dateSegment}/${timeSegment}`;
  const key = `${storagePath}/${objectFileName}`;

  const stat = await fs.promises.stat(localFilePath);

  await client.send(
    new PutObjectCommand({
      Bucket: credentials.bucketName,
      Key: key,
      Body: fs.createReadStream(localFilePath),
      ContentLength: stat.size,
    })
  );

  return {
    key,
    storagePath,
    name: objectFileName,
    size: stat.size,
  };
}

/**
 * Delete every object under a stored storage_path prefix - used by the retention job, mirroring
 * deleteGoogleDriveBackupFolder()'s purpose for Drive. R2/S3 has no single "delete this prefix"
 * call, so this lists everything under the prefix first, then batch-deletes.
 */
export async function deleteR2BackupFolder(credentials: R2Credentials, storagePath: string): Promise<void> {
  if (!storagePath) {
    logger.debug('R2: empty storage path, nothing to delete');
    return;
  }

  const client = getR2Client(credentials);
  const prefix = storagePath.endsWith('/') ? storagePath : `${storagePath}/`;

  const allKeys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const listed = await client.send(
      new ListObjectsV2Command({
        Bucket: credentials.bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    for (const obj of listed.Contents || []) {
      if (obj.Key) {
        allKeys.push(obj.Key);
      }
    }

    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);

  if (allKeys.length === 0) {
    logger.debug(`R2: no objects found under prefix "${prefix}", nothing to delete`);
    return;
  }

  // DeleteObjectsCommand caps at 1000 keys per request - chunk in case one run's objects
  // somehow exceed that (they won't in practice for two files per run, but cheap to be safe).
  for (let i = 0; i < allKeys.length; i += 1000) {
    const chunk = allKeys.slice(i, i + 1000);
    await client.send(
      new DeleteObjectsCommand({
        Bucket: credentials.bucketName,
        Delete: { Objects: chunk.map(Key => ({ Key })) },
      })
    );
  }
}

/**
 * Basic reachability/permission check - lists at most one object in the bucket to confirm the
 * credentials actually work. Used the same way testGoogleDriveToken()/testDropboxToken() are:
 * confirm credentials work before relying on them for a real upload.
 */
export async function testR2Credentials(credentials: R2Credentials): Promise<{ valid: boolean; error?: string }> {
  try {
    const client = getR2Client(credentials);
    await client.send(new ListObjectsV2Command({ Bucket: credentials.bucketName, MaxKeys: 1 }));
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
