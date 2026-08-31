/**
 * Backup API Routes
 *
 * This module defines the API routes for backup management and operations.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import { backupService } from '../services/backup-service';
import { pool } from '../db';
import prisma from '../prisma';
import { commonNotificationService } from '../services/common-notification-service';
import { tokenRefreshManager } from '../TokenRefreshManager';
import { uploadFileToGoogleDrive } from '../providers/google-drive';

// Use the default logger instance
const router = Router();

/**
 * Normalize a site's stored URL before using it to build a request to the WordPress
 * plugin. Site URLs are sometimes stored without a protocol (e.g. "example.com" instead
 * of "https://example.com") - confirmed live when a scheduled backup crashed with
 * `TypeError: Invalid URL` because axios/Node's URL parser rejects a protocol-less host.
 * Also strips a trailing slash so we don't produce a double slash before the REST path.
 */
function normalizeSiteUrl(url: string): string {
  const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  return withProtocol.replace(/\/+$/, '');
}

/**
 * Extract a diagnosable message from a caught value. Non-Error throws (e.g. WebSocket
 * ErrorEvent from a misconfigured DB driver) used to collapse to a bare "Unknown error" here,
 * which made real failures invisible in both API responses and logs - confirmed live when a
 * driver incompatibility surfaced as nothing but "Unknown error" with no way to diagnose it.
 */
function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

// Validation schemas
const createConfigSchema = z.object({
  provider: z.string(),
  name: z.string().min(1, 'Name is required'),
  active: z.boolean().default(true),
  settings: z.record(z.unknown()),
  schedule: z
    .object({
      frequency: z.enum(['hourly', 'daily', 'weekly', 'monthly', 'custom']),
      hour: z.number().optional(),
      minute: z.number().optional(),
      dayOfWeek: z.number().optional(),
      dayOfMonth: z.number().optional(),
      customExpression: z.string().optional(),
    })
    .optional(),
  retention: z
    .object({
      count: z.number().optional(),
      days: z.number().optional(),
    })
    .optional(),
  filters: z
    .object({
      include: z.array(z.string()).optional(),
      exclude: z.array(z.string()).optional(),
    })
    .optional(),
});

const updateConfigSchema = createConfigSchema.partial();

const createBackupSchema = z.object({
  siteId: z.string().min(1, 'Site ID is required'),
  files: z.array(z.string()),
  database: z.boolean().optional(),
  destinations: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const restoreBackupSchema = z.object({
  destination: z.string().optional(),
  files: z.array(z.string()).optional(),
  database: z.boolean().optional(),
});

// Get all backup providers
router.get('/providers', (req: Request, res: Response) => {
  try {
    const providers = backupService.getAvailableProviders();
    res.json({ success: true, providers });
  } catch (error) {
    logger.error('Error getting backup providers', error);
    res.status(500).json({
      success: false,
      message: 'Error getting backup providers',
      error: errorMessage(error),
    });
  }
});

// Get provider configuration fields
router.get('/providers/:providerId/fields', (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const fields = backupService.getProviderConfigurationFields(providerId);

    if (!fields) {
      return res.status(404).json({
        success: false,
        message: `Provider not found: ${providerId}`,
      });
    }

    res.json({ success: true, fields });
  } catch (error) {
    logger.error(`Error getting provider fields: ${req.params.providerId}`, error);
    res.status(500).json({
      success: false,
      message: 'Error getting provider fields',
      error: errorMessage(error),
    });
  }
});

// Test provider connection
router.post('/providers/test', async (req: Request, res: Response) => {
  try {
    const result = await backupService.testProviderConnection(req.body);
    res.json(result);
  } catch (error) {
    logger.error('Error testing provider connection', error);
    res.status(500).json({
      success: false,
      message: 'Error testing provider connection',
      error: errorMessage(error),
    });
  }
});

// Get all backup configurations
router.get('/configurations', (req: Request, res: Response) => {
  try {
    const configurations = backupService.getAllConfigurations();
    res.json({ success: true, configurations });
  } catch (error) {
    logger.error('Error getting backup configurations', error);
    res.status(500).json({
      success: false,
      message: 'Error getting backup configurations',
      error: errorMessage(error),
    });
  }
});

// Get a backup configuration
router.get('/configurations/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const configuration = backupService.getConfiguration(id);

    if (!configuration) {
      return res.status(404).json({
        success: false,
        message: `Configuration not found: ${id}`,
      });
    }

    res.json({ success: true, configuration });
  } catch (error) {
    logger.error(`Error getting backup configuration: ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      message: 'Error getting backup configuration',
      error: errorMessage(error),
    });
  }
});

// Create a backup configuration
router.post('/configurations', (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = createConfigSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid configuration data',
        errors: validationResult.error.errors,
      });
    }

    // Create configurationnnnn
    const configuration = backupService.createConfiguration(validationResult.data);

    res.status(201).json({ success: true, configuration });
  } catch (error) {
    logger.error('Error creating backup configuration', error);
    res.status(500).json({
      success: false,
      message: 'Error creating backup configuration',
      error: errorMessage(error),
    });
  }
});

// Update a backup configuration
router.patch('/configurations/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate request body
    const validationResult = updateConfigSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid configuration data',
        errors: validationResult.error.errors,
      });
    }
    //stestst
    // Update configuration
    const configuration = backupService.updateConfiguration(id, validationResult.data);

    if (!configuration) {
      return res.status(404).json({
        success: false,
        message: `Configuration not found: ${id}`,
      });
    }

    res.json({ success: true, configuration });
  } catch (error) {
    logger.error(`Error updating backup configuration: ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      message: 'Error updating backup configuration',
      error: errorMessage(error),
    });
  }
});

// Delete a backup configuration
router.delete('/configurations/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = backupService.deleteConfiguration(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: `Configuration not found: ${id}`,
      });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error(`Error deleting backup configuration: ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      message: 'Error deleting backup configuration',
      error: errorMessage(error),
    });
  }
});

// Create a backup
router.post('/configurations/:id/backups', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate request body
    const validationResult = createBackupSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid backup data',
        errors: validationResult.error.errors,
      });
    }

    // Create backup
    const result = await backupService.createBackup(id, validationResult.data);

    if (!result.success) {
      // If it's a configuration not found error
      if (result.message?.includes('Configuration not found')) {
        return res.status(404).json({
          success: false,
          message: result.message,
        });
      }

      // Other errors
      return res.status(400).json({
        success: false,
        message: result.message,
        errors: result.errors,
      });
    }

    res.json(result);
  } catch (error) {
    logger.error(`Error creating backup: ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      message: 'Error creating backup',
      error: errorMessage(error),
    });
  }
});

// List backups
router.get('/configurations/:id/backups', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { siteId, destination, limit, offset, sort, order } = req.query;

    // Parse query parameters
    const options = {
      siteId: typeof siteId === 'string' ? siteId : undefined,
      destination: typeof destination === 'string' ? destination : undefined,
      limit: typeof limit === 'string' ? parseInt(limit, 10) : undefined,
      offset: typeof offset === 'string' ? parseInt(offset, 10) : undefined,
      sort:
        typeof sort === 'string' && ['created', 'size'].includes(sort)
          ? (sort as 'created' | 'size')
          : undefined,
      order:
        typeof order === 'string' && ['asc', 'desc'].includes(order)
          ? (order as 'asc' | 'desc')
          : undefined,
    };

    // List backups
    const result = await backupService.listBackups(id, options);

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`Error listing backups: ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      message: 'Error listing backups',
      error: errorMessage(error),
    });
  }
});

// Get backup details
router.get('/configurations/:configId/backups/:backupId', async (req: Request, res: Response) => {
  try {
    const { configId, backupId } = req.params;

    // Get backup details
    const result = await backupService.getBackupDetails(configId, backupId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found',
      });
    }

    res.json({ success: true, backup: result });
  } catch (error) {
    logger.error(
      `Error getting backup details: ${req.params.configId}/${req.params.backupId}`,
      error
    );
    res.status(500).json({
      success: false,
      message: 'Error getting backup details',
      error: errorMessage(error),
    });
  }
});

// Delete a backup
router.delete(
  '/configurations/:configId/backups/:backupId',
  async (req: Request, res: Response) => {
    try {
      const { configId, backupId } = req.params;

      // Delete backup
      const result = await backupService.deleteBackup(configId, backupId);

      if (!result.success) {
        // If it's a configuration not found error
        if (result.message?.includes('Configuration not found')) {
          return res.status(404).json({
            success: false,
            message: result.message,
          });
        }

        // Other errors
        return res.status(400).json({
          success: false,
          message: result.message,
        });
      }

      res.json(result);
    } catch (error) {
      logger.error(`Error deleting backup: ${req.params.configId}/${req.params.backupId}`, error);
      res.status(500).json({
        success: false,
        message: 'Error deleting backup',
        error: errorMessage(error),
      });
    }
  }
);

// Restore a backup
router.post(
  '/configurations/:configId/backups/:backupId/restore',
  async (req: Request, res: Response) => {
    try {
      const { configId, backupId } = req.params;

      // Validate request body
      const validationResult = restoreBackupSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid restore data',
          errors: validationResult.error.errors,
        });
      }

      // Restore backup
      const result = await backupService.restoreBackup(configId, backupId, validationResult.data);

      if (!result.success) {
        // If it's a configuration not found error
        if (result.message?.includes('Configuration not found')) {
          return res.status(404).json({
            success: false,
            message: result.message,
          });
        }

        // Other errors
        return res.status(400).json({
          success: false,
          message: result.message,
        });
      }

      res.json(result);
    } catch (error) {
      logger.error(`Error restoring backup: ${req.params.configId}/${req.params.backupId}`, error);
      res.status(500).json({
        success: false,
        message: 'Error restoring backup',
        error: errorMessage(error),
      });
    }
  }
);

// Download a file from a backup
router.get(
  '/configurations/:configId/backups/:backupId/files',
  async (req: Request, res: Response) => {
    try {
      const { configId, backupId } = req.params;
      const { path } = req.query;

      if (typeof path !== 'string' || !path) {
        return res.status(400).json({
          success: false,
          message: 'File path is required',
        });
      }

      // Download file
      const result = await backupService.downloadFile(configId, backupId, path);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          message: result.message,
        });
      }

      // Set content type and filename
      const filename = path.split('/').pop() || 'file';
      res.setHeader('Content-Type', result.contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      if (result.content) {
        if (Buffer.isBuffer(result.content)) {
          res.send(result.content);
        } else {
          res.send(result.content);
        }
      } else {
        res.status(404).json({
          success: false,
          message: 'File content not available',
        });
      }
    } catch (error) {
      logger.error(`Error downloading file: ${req.params.configId}/${req.params.backupId}`, error);
      res.status(500).json({
        success: false,
        message: 'Error downloading file',
        error: errorMessage(error),
      });
    }
  }
);

// New endpoint: Start a native full-site backup (files + database) on a WordPress site.
// Capture is intentionally decoupled from any storage/upload destination - storageProviderId
// (if provided) is only recorded on the backup row for the upload phase to pick up later.
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { siteId, storageProviderId } = req.body;

    // Validate required parameters
    if (!siteId) {
      return res.status(400).json({
        success: false,
        message: 'Site ID is required'
      });
    }

    // Get the site details
    const siteResult = await pool.query('SELECT * FROM sites WHERE id = $1', [siteId]);

    if (siteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Site not found'
      });
    }

    const site = siteResult.rows[0];

    if (!site.api_key) {
      return res.status(400).json({
        success: false,
        message: 'Site has no API key configured - cannot authenticate to its WordPress plugin'
      });
    }

    logger.info('Making request to WordPress API to start native backup', { siteId });

    // Kick off a native (no UpdraftPlus) full backup on the site's own WordPress plugin.
    // The plugin runs this asynchronously via WP-Cron and returns immediately.
    const startBody = {
      api_key: site.api_key,
      type: 'full',
      exclusions: Array.isArray(site.file_exclusions) ? site.file_exclusions : []
    };
    const wordpressResponse = await axios.post(
      `${normalizeSiteUrl(site.url)}/index.php?rest_route=%2Fbackupsheep%2Fv3%2Fbackup%2Fstart`,
      startBody,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const wpResponseData = wordpressResponse.data;

    // Validate WordPress response
    if (wpResponseData.status !== 'success' || !wpResponseData.backup_id) {
      return res.status(500).json({
        success: false,
        message: wpResponseData.message || 'Failed to start backup process',
        data: wpResponseData
      });
    }

    // Nudge WP-Cron externally so the scheduled run_backup() actually fires promptly.
    // The plugin also attempts its own internal loopback, but that's unreliable in practice -
    // security plugins/WAFs commonly block a site from looping back into itself (confirmed via
    // live testing: an in-process wp_remote_post() loopback sat un-processed indefinitely, while
    // this exact external request processed it immediately). Node is always an external caller
    // here, so it doesn't hit that restriction. Fire-and-forget: don't let a slow/blocked
    // response here delay the /start response, and don't fail /start if this errors.
    axios
      .get(`${normalizeSiteUrl(site.url)}/wp-cron.php`, { params: { doing_wp_cron: Date.now() / 1000 }, timeout: 5000 })
      .catch(err => {
        logger.warn('External wp-cron.php nudge failed (backup may still run on the site\'s own cron schedule)', {
          siteId,
          error: errorMessage(err)
        });
      });

    // Store the backup process in our database. storageProviderId stays optional/nullable -
    // it's not needed for capture, only recorded for whichever upload phase consumes it later.
    const now = new Date();
    const backupResult = await pool.query(
      `INSERT INTO backups (
        site_id,
        storage_provider_id,
        backup_type,
        status,
        process_id,
        metadata,
        started_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        siteId,
        storageProviderId || null,
        'full',
        'in_progress',
        wpResponseData.backup_id,
        JSON.stringify(wpResponseData),
        now
      ]
    );

    // Track this process for the background scheduler's stuck-process detection/retry
    // (server/scheduler.ts) - independent of and not read by this route's own polling.
    try {
      await prisma.processTracking.create({
        data: {
          processId: wpResponseData.backup_id,
          backupId: backupResult.rows[0].id,
          lastUpdated: now,
          retryCount: 0,
          status: 'active'
        }
      });
    } catch (trackingError) {
      logger.warn('Failed to create process tracking record (non-fatal)', {
        processId: wpResponseData.backup_id,
        error: errorMessage(trackingError)
      });
    }

    // Return success with the process ID and backup record
    return res.status(200).json({
      success: true,
      message: 'Backup process started successfully',
      processId: wpResponseData.backup_id,
      backup: backupResult.rows[0]
    });

  } catch (error) {
    logger.error('Error starting backup', {
      error: errorMessage(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return res.status(500).json({
      success: false,
      message: 'Error starting backup',
      error: errorMessage(error)
    });
  }
});

// Endpoint to fetch backup logs.
// The native capture engine has no UpdraftPlus-style step-by-step log file, so this is now a
// thin compatibility shim for the frontend - it always returns an (empty) logs object rather
// than 404ing, since the UI already tolerates that shape gracefully.
router.get('/status/:processId/logs', async (req: Request, res: Response) => {
  const { processId } = req.params;

  if (!processId) {
    return res.status(400).json({
      success: false,
      message: 'Process ID is required'
    });
  }

  return res.status(200).json({
    success: true,
    logs: {}
  });
});

/**
 * Download a single completed backup file from the WordPress site into server/temp/<backupId>/.
 */
async function downloadBackupFile(
  siteUrl: string,
  apiKey: string,
  backupId: string,
  fileName: string,
  destDir: string
): Promise<{ name: string; path: string; size: number }> {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const destPath = path.join(destDir, fileName);

  const response = await axios.get(
    `${normalizeSiteUrl(siteUrl)}/index.php?rest_route=%2Fbackupsheep%2Fv3%2Fbackup%2Fdownload`,
    {
      params: { api_key: apiKey, backup_id: backupId, file: fileName },
      responseType: 'stream'
    }
  );

  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);
    writer.on('finish', () => resolve());
    writer.on('error', reject);
  });

  const size = fs.statSync(destPath).size;
  return { name: fileName, path: destPath, size };
}

const MAX_UPLOAD_ATTEMPTS = 5;

/**
 * Reconstruct the list of already-downloaded local backup files for a process whose files
 * were captured on an earlier poll - used when retrying just the upload step. WordPress's own
 * copies are deleted immediately after the first successful download, so a retry can't re-fetch
 * from there; it has to work from what's already on local disk.
 */
function listLocalBackupFiles(processId: string): { name: string; path: string; size: number }[] {
  const destDir = path.join(process.cwd(), 'temp', processId);
  if (!fs.existsSync(destDir)) {
    return [];
  }
  return fs
    .readdirSync(destDir)
    .map(name => {
      const filePath = path.join(destDir, name);
      const stat = fs.statSync(filePath);
      return stat.isFile() ? { name, path: filePath, size: stat.size } : null;
    })
    .filter((f): f is { name: string; path: string; size: number } => f !== null);
}

/** Thrown for upload failures a retry can't fix - no point burning through the retry cap on them. */
class PermanentUploadError extends Error {}

/**
 * Attempt to upload a captured backup's local files to its configured storage provider.
 * Pure outcome reporting - does not write to the DB itself, so the caller decides what to
 * persist (including how to advance/exhaust the retry count).
 *
 * `siteName` drives the Google Drive folder layout (McCloud Backups/<Site Name>/<date>/<time>/)
 * - the caller must pass the same Date instance for every file in one attempt, so db.sql.gz and
 * files.zip land in the same HH-MM-SS folder rather than two different ones a few seconds apart
 * (which is why this isn't just computed with `new Date()` inside the per-file loop below).
 */
async function attemptCloudUpload(
  storageProviderId: number | null,
  processId: string,
  siteName: string,
  runTimestamp: Date,
  localFiles: { name: string; path: string; size: number }[]
): Promise<
  | { success: true; storageType: string; storagePath: string; files: { fileId: string; folderId: string; name: string; size: number }[] }
  | { success: false; error: string; permanent: boolean }
> {
  if (!storageProviderId) {
    return { success: false, error: 'No storage provider configured for this backup', permanent: true };
  }

  try {
    const providerResult = await pool.query('SELECT * FROM storage_providers WHERE id = $1', [storageProviderId]);
    const provider = providerResult.rows[0];

    if (!provider) {
      throw new PermanentUploadError('Configured storage provider no longer exists');
    }
    if (!provider.enabled) {
      throw new PermanentUploadError(`Storage provider "${provider.name}" is disabled`);
    }

    if (provider.type === 'google') {
      const tokenResult = await tokenRefreshManager.getValidAccessToken(storageProviderId);
      if (!tokenResult.success || !tokenResult.access_token) {
        // Could be a transient refresh hiccup or a genuinely revoked grant - can't tell from
        // here, so let it exhaust the retry cap rather than failing it immediately.
        throw new Error(tokenResult.error || 'Could not get a valid Google Drive access token');
      }

      const uploaded: { fileId: string; folderId: string; storagePath: string; name: string; size: number }[] = [];
      for (const file of localFiles) {
        uploaded.push(
          await uploadFileToGoogleDrive(tokenResult.access_token, file.path, siteName, runTimestamp, file.name)
        );
      }

      return {
        success: true,
        storageType: 'google',
        // Read back from what was actually created rather than re-deriving the path here too -
        // every file in this run resolves to the same folder, so any one of them is accurate.
        storagePath: uploaded[0]?.storagePath ?? '',
        files: uploaded
      };
    }

    // No upload implementation exists for this provider type (e.g. Dropbox never got one -
    // that module only ever reads from Dropbox, nothing writes to it). Not a transient
    // failure, so don't burn retries pretending it might resolve itself.
    throw new PermanentUploadError(`No upload implementation for storage provider type "${provider.type}"`);
  } catch (error) {
    return {
      success: false,
      error: errorMessage(error),
      permanent: error instanceof PermanentUploadError
    };
  }
}

export interface UploadOutcome {
  success: boolean;
  status: string; // legacy-style: 'SUCCESS' | 'ERROR' | 'IN_PROGRESS' | 'SKIPPED'
  state: string; // 'BACKUP_COMPLETED' | 'UPLOAD_FAILED' | 'UPLOADING' | 'SKIPPED'
  message: string;
}

/**
 * Attempt (or resume) the cloud upload for a backup that's finished local WordPress capture,
 * and persist the real outcome. Self-contained and safe to call from anywhere - the HTTP
 * status-poll route below, or the scheduler's periodic sweep for stuck uploads - because it
 * starts by atomically claiming the backup (flipping 'captured' -> 'uploading' in one
 * conditional UPDATE ... WHERE status = 'captured'). If two callers race for the same backup
 * (a client poll and a scheduler tick landing at nearly the same moment), only one wins the
 * claim; the other gets a 'SKIPPED' outcome and does nothing further, so the same local files
 * never get uploaded twice. A backup is only ever marked 'completed' from in here, once the
 * upload has actually been confirmed - never at capture time.
 */
export async function finalizeUploadResult(backupId: number): Promise<UploadOutcome> {
  const claim = await pool.query(
    `UPDATE backups SET status = 'uploading' WHERE id = $1 AND status = 'captured' RETURNING *`,
    [backupId]
  );

  if (claim.rows.length === 0) {
    return {
      success: false,
      status: 'SKIPPED',
      state: 'SKIPPED',
      message: 'Not claimable - already being processed elsewhere, or not in a retryable state'
    };
  }

  const backup = claim.rows[0];
  const siteResult = await pool.query('SELECT name FROM sites WHERE id = $1', [backup.site_id]);
  const siteName = siteResult.rows[0]?.name || 'Unknown site';

  const localFiles = listLocalBackupFiles(backup.process_id);
  const metadata = (() => {
    try {
      return JSON.parse(backup.metadata || '{}');
    } catch {
      return {};
    }
  })();
  const attemptNumber = (metadata.uploadAttempts || 0) + 1;

  if (localFiles.length === 0) {
    // Nothing left on disk to upload (retention swept it, or it was never written). Not
    // retryable - there's nothing left to retry with.
    await pool.query(
      `UPDATE backups SET status = 'upload_failed', error = $1, metadata = $2 WHERE id = $3`,
      [
        'Local backup files are missing - cannot upload',
        JSON.stringify({ ...metadata, uploadAttempts: attemptNumber }),
        backup.id
      ]
    );
    return { success: false, status: 'ERROR', state: 'UPLOAD_FAILED', message: 'Local backup files are missing - cannot upload' };
  }

  const result = await attemptCloudUpload(
    backup.storage_provider_id,
    backup.process_id,
    siteName,
    new Date(),
    localFiles
  );

  if (result.success) {
    const totalSize = localFiles.reduce((sum, f) => sum + f.size, 0);
    await pool.query(
      `UPDATE backups
       SET status = 'completed', completed_at = $1, filesize = $2, storage_type = $3, storage_path = $4, metadata = $5
       WHERE id = $6`,
      [
        new Date(),
        totalSize,
        result.storageType,
        result.storagePath,
        JSON.stringify({ ...metadata, uploadAttempts: attemptNumber, uploadedFiles: result.files }),
        backup.id
      ]
    );

    logger.info(`Backup ${backup.process_id} fully completed - uploaded to ${result.storageType}`, {
      storagePath: result.storagePath
    });

    try {
      await commonNotificationService.sendBackupCompletionNotification(backup.site_id, siteName, {
        backupId: backup.id,
        processId: backup.process_id,
        filesize: totalSize
      });
    } catch (notifyError) {
      logger.warn(`Failed to send backup completion notification for ${backup.process_id}`, {
        error: errorMessage(notifyError)
      });
    }

    return { success: true, status: 'SUCCESS', state: 'BACKUP_COMPLETED', message: 'Backup completed and uploaded successfully' };
  }

  // Upload failed this attempt - give up immediately for permanent errors (retrying won't fix
  // a missing implementation or a deleted provider); otherwise release the claim back to
  // 'captured' so the next poll or scheduler tick retries it, until the attempt cap is hit.
  const giveUp = result.permanent || attemptNumber >= MAX_UPLOAD_ATTEMPTS;
  const finalStatus = giveUp ? 'upload_failed' : 'captured';

  logger.warn(
    `Backup ${backup.process_id} upload attempt ${attemptNumber} failed${giveUp ? ' - giving up' : ', will retry'}`,
    { error: result.error, permanent: result.permanent }
  );

  await pool.query(`UPDATE backups SET status = $1, error = $2, metadata = $3 WHERE id = $4`, [
    finalStatus,
    result.error,
    JSON.stringify({ ...metadata, uploadAttempts: attemptNumber }),
    backup.id
  ]);

  if (giveUp) {
    try {
      await commonNotificationService.sendBackupFailureNotification(backup.site_id, siteName, result.error, {
        backupId: backup.id,
        processId: backup.process_id
      });
    } catch (notifyError) {
      logger.warn(`Failed to send upload failure notification for ${backup.process_id}`, {
        error: errorMessage(notifyError)
      });
    }
  }

  return {
    success: false,
    status: giveUp ? 'ERROR' : 'IN_PROGRESS',
    state: giveUp ? 'UPLOAD_FAILED' : 'UPLOADING',
    message: giveUp
      ? `Backup captured locally but upload failed: ${result.error}`
      : `Upload attempt ${attemptNumber}/${MAX_UPLOAD_ATTEMPTS} failed, retrying: ${result.error}`
  };
}

// Endpoint to check backup status. On completion, pulls the finished file(s) down into
// server/temp/<backupId>/, tells the WordPress plugin to delete its local copies, and drives
// the upload-to-storage-provider step (including retrying it on later polls, and racing safely
// against the scheduler's own retry sweep) via finalizeUploadResult(). A backup only reaches
// 'completed' once that upload is actually confirmed.
router.get('/status/:processId', async (req: Request, res: Response) => {
  try {
    const { processId } = req.params;

    if (!processId) {
      return res.status(400).json({
        success: false,
        message: 'Process ID is required'
      });
    }

    // Check if the process exists in our database
    const backupResult = await pool.query(
      'SELECT * FROM backups WHERE process_id = $1',
      [processId]
    );

    if (backupResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Backup process not found'
      });
    }

    const backup = backupResult.rows[0];
    const siteResult = await pool.query('SELECT * FROM sites WHERE id = $1', [backup.site_id]);

    if (siteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Site not found for this backup process'
      });
    }

    const site = siteResult.rows[0];

    // If this backup already got past WordPress capture on an earlier poll, don't hit
    // WordPress again - its copies were deleted right after the first successful download.
    // 'captured' means the local files exist but the upload hasn't succeeded yet (or is being
    // retried); resume straight into the upload step from what's already on disk. The scheduler
    // may be doing the same thing concurrently - finalizeUploadResult's atomic claim handles that.
    if (backup.status === 'captured') {
      const outcome = await finalizeUploadResult(backup.id);
      return res.status(200).json({ success: outcome.success, status: outcome.status, state: outcome.state, message: outcome.message });
    }
    if (backup.status === 'uploading') {
      // Someone else (the scheduler's periodic sweep, most likely) is actively uploading this
      // one right now - just report in-progress rather than trying to claim it too.
      return res.status(200).json({
        success: true,
        status: 'IN_PROGRESS',
        state: 'UPLOADING',
        message: 'Upload in progress'
      });
    }
    if (backup.status === 'completed') {
      return res.status(200).json({
        success: true,
        status: 'SUCCESS',
        state: 'BACKUP_COMPLETED',
        message: 'Backup completed and uploaded successfully'
      });
    }
    if (backup.status === 'upload_failed') {
      return res.status(200).json({
        success: true,
        status: 'ERROR',
        state: 'UPLOAD_FAILED',
        message: backup.error || 'Backup captured locally but upload failed'
      });
    }
    if (backup.status === 'failed') {
      return res.status(200).json({
        success: true,
        status: 'ERROR',
        state: 'ERROR',
        message: backup.error || 'Backup process failed'
      });
    }

    // Poll native backup status on the WordPress site
    const statusResponse = await axios.get(
      `${normalizeSiteUrl(site.url)}/index.php?rest_route=%2Fbackupsheep%2Fv3%2Fbackup%2Fstatus`,
      { params: { api_key: site.api_key, backup_id: processId } }
    );

    const backupStatus = statusResponse.data.backup_status || {};

    logger.info('Backup status check response:', {
      processId,
      wpStatus: backupStatus.status,
      fileCount: Array.isArray(backupStatus.files) ? backupStatus.files.length : 0
    });

    let dbStatus = 'in_progress';
    let legacyStatus = 'in_progress';
    let legacyState = (backupStatus.status || 'pending').toUpperCase();
    let localFiles: { name: string; path: string; size: number }[] = [];

    if (backupStatus.status === 'completed') {
      // Download each completed file into server/temp/<backupId>/, matching the pattern the
      // GitHub provider already uses for its own temp files.
      const destDir = path.join(process.cwd(), 'temp', processId);
      const files: { name: string; type: string; size: number }[] = backupStatus.files || [];

      try {
        for (const file of files) {
          const downloaded = await downloadBackupFile(
            site.url,
            site.api_key,
            processId,
            file.name,
            destDir
          );
          localFiles.push(downloaded);
        }

        logger.info(`Backup ${processId} downloaded to local temp storage`, {
          destDir,
          files: localFiles.map(f => ({ name: f.name, size: f.size }))
        });

        // Now that Node has the files locally, tell the WordPress plugin to remove its copies.
        for (const file of files) {
          try {
            await axios.post(
              `${normalizeSiteUrl(site.url)}/index.php?rest_route=%2Fbackupsheep%2Fv3%2Fbackup%2Fdelete`,
              { api_key: site.api_key, backup_id: processId, file: file.name },
              { headers: { 'Content-Type': 'application/json' } }
            );
          } catch (deleteError) {
            logger.warn(`Failed to delete remote backup file ${file.name} for ${processId}`, {
              error: errorMessage(deleteError)
            });
          }
        }

        // Local capture is done and safe on disk - mark it 'captured' (not 'completed': that
        // now means the upload has actually succeeded, decided inside finalizeUpload) and hand
        // off to it to attempt the real upload, including notifications and retry bookkeeping.
        await pool.query(`UPDATE backups SET status = 'captured', metadata = $1 WHERE process_id = $2`, [
          JSON.stringify({ wpStatus: backupStatus, localFiles }),
          processId
        ]);

        logger.info(`Backup ${processId} captured locally. Files are in: ${destDir}`);

        const outcome = await finalizeUploadResult(backup.id);
        return res.status(200).json({ success: outcome.success, status: outcome.status, state: outcome.state, message: outcome.message });
      } catch (downloadError) {
        // Downloading failed - don't mark the backup completed, leave it in_progress so a
        // future poll (or manual retry) can pick the files up rather than losing them silently.
        dbStatus = 'in_progress';
        legacyStatus = 'in_progress';
        legacyState = 'DOWNLOADING';

        logger.error(`Failed to download completed backup files for ${processId}`, {
          error: errorMessage(downloadError)
        });
      }
    } else if (backupStatus.status === 'error') {
      dbStatus = 'failed';
      legacyStatus = 'ERROR';
      legacyState = 'ERROR';

      await pool.query(
        'UPDATE backups SET status = $1, error = $2, metadata = $3 WHERE process_id = $4',
        [
          dbStatus,
          backupStatus.error_message || 'Backup process failed',
          JSON.stringify({ wpStatus: backupStatus }),
          processId
        ]
      );

      try {
        await commonNotificationService.sendBackupFailureNotification(
          backup.site_id,
          site.name,
          backupStatus.error_message || 'Backup process failed',
          { backupId: backup.id, processId }
        );
      } catch (notifyError) {
        logger.warn(`Failed to send backup failure notification for ${processId}`, {
          error: errorMessage(notifyError)
        });
      }
    } else {
      // pending/running - just record the latest status
      await pool.query(
        'UPDATE backups SET metadata = $1 WHERE process_id = $2',
        [JSON.stringify({ wpStatus: backupStatus }), processId]
      );
    }

    return res.status(200).json({
      success: true,
      status: legacyStatus,
      state: legacyState,
      message: backupStatus.error_message || `Backup ${backupStatus.status || 'pending'}`,
      wpStatus: backupStatus.status,
      data: { status: legacyStatus, state: legacyState, message: backupStatus.error_message || '' },
      logs: {},
      latestLog: null,
      localFiles: localFiles.length > 0 ? localFiles : undefined
    });

  } catch (error) {
    logger.error('Error checking backup status', {
      error: errorMessage(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return res.status(500).json({
      success: false,
      message: 'Error checking backup status',
      error: errorMessage(error)
    });
  }
});

export default router;
