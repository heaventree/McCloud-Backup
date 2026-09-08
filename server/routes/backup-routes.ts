/**
 * Backup API Routes
 *
 * This module defines the API routes for backup management and operations.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { Readable, Transform } from 'stream';
import logger from '../utils/logger';
import { backupService } from '../services/backup-service';
import { pool } from '../db';
import prisma from '../prisma';
import { commonNotificationService } from '../services/common-notification-service';
import { tokenRefreshManager } from '../TokenRefreshManager';
import { uploadFileToGoogleDrive, getGoogleDriveFileSize } from '../providers/google-drive';
import { uploadFileToR2, getR2ObjectSize, R2Credentials } from '../providers/r2';

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

// ---------------------------------------------------------------------------------------------
// Streaming pipeline: WordPress -> Node (in-memory stream only) -> cloud storage.
//
// Nothing below writes a backup byte to local disk. Files are read from the WordPress plugin's
// download route as a live HTTP response stream and handed straight to the storage provider's
// upload call; the VPS only ever holds a few stream buffers' worth of any file at a time.
// ---------------------------------------------------------------------------------------------

/**
 * How long a transfer may go without receiving a single byte from WordPress before it's treated
 * as dead. Deliberately an idle timeout rather than an overall one: a multi-GB files.zip
 * legitimately takes many minutes, so capping total duration would kill healthy transfers, but a
 * socket that has stopped delivering data entirely is never going to recover.
 */
const DOWNLOAD_IDLE_TIMEOUT_MS = 120000;

type WordPressBackupFile = { name: string; type?: string; size: number };

/** One file confirmed on cloud storage, as persisted in backups.metadata.uploadedFiles. */
export interface UploadedFileRecord {
  name: string;
  /** Drive file ID, or the R2 object key. */
  fileId: string;
  folderId: string;
  storagePath: string;
  size: number;
}

/**
 * Shape of the JSON kept in backups.metadata for a native backup. Everything the streaming step
 * needs to resume after a failure lives here rather than in dedicated columns - there is no
 * local file listing to fall back on anymore, so this is the only record of progress.
 */
interface BackupMetadata {
  wpStatus?: { status?: string; files?: WordPressBackupFile[]; error_message?: string; [key: string]: unknown };
  uploadAttempts?: number;
  /** ISO timestamp fixed on the first upload attempt so retries land in the same cloud folder. */
  uploadRunTimestamp?: string;
  uploadedFiles?: UploadedFileRecord[];
  wpDeletedFiles?: string[];
  wpDeleted?: boolean;
  [key: string]: unknown;
}

function parseMetadata(raw: string | null | undefined): BackupMetadata {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function wordPressFilesFromMetadata(metadata: BackupMetadata): WordPressBackupFile[] {
  const files = metadata.wpStatus?.files;
  if (!Array.isArray(files)) {
    return [];
  }
  return files.filter(
    (f): f is WordPressBackupFile => !!f && typeof f.name === 'string' && typeof f.size === 'number'
  );
}

/**
 * Open a single backup file on the WordPress site as a Readable stream, ready to be handed to a
 * storage provider's upload call. The returned stream is a guard Transform sitting on top of the
 * HTTP response, adding two things the raw response lacks:
 *
 * - An idle watchdog: no bytes for DOWNLOAD_IDLE_TIMEOUT_MS destroys the stream with an error.
 * - A byte count check: if the stream ends having delivered anything other than exactly
 *   `expectedSize` bytes (the size WordPress itself reported for the file), it ends with an error
 *   instead of a clean 'end'. Node normally errors on a short body when Content-Length was
 *   declared, but the plugin's read loop can also stop early after a failed fread() and exit
 *   cleanly, so this does not rely on the HTTP layer alone. A truncated archive that uploads as a
 *   successful backup only reveals itself at restore time - never let one through.
 *
 * Errors from the underlying response are forwarded explicitly: Node's pipe() does not propagate
 * source errors to the destination, so without this a socket hang-up mid-transfer would leave
 * the consumer waiting forever.
 */
async function openWordPressFileStream(
  siteUrl: string,
  apiKey: string,
  backupId: string,
  fileName: string,
  expectedSize: number
): Promise<Readable> {
  const response = await axios.get(
    `${normalizeSiteUrl(siteUrl)}/index.php?rest_route=%2Fbackupsheep%2Fv3%2Fbackup%2Fdownload`,
    {
      params: { api_key: apiKey, backup_id: backupId, file: fileName },
      responseType: 'stream',
      timeout: 0,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    }
  );

  const source: Readable = response.data;
  let received = 0;
  let idleTimer: NodeJS.Timeout | null = null;

  const clearIdle = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  const guard = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      resetIdle();
      callback(null, chunk);
    },
    flush(callback) {
      clearIdle();
      if (received !== expectedSize) {
        callback(
          new Error(
            `Stream of ${fileName} for ${backupId} ended at ${received} bytes but WordPress reported ${expectedSize} - treated as truncated`
          )
        );
        return;
      }
      callback();
    }
  });

  const fail = (error: Error) => {
    clearIdle();
    if (!guard.destroyed) {
      guard.destroy(error);
    }
    if (!source.destroyed) {
      source.destroy();
    }
  };

  const resetIdle = () => {
    clearIdle();
    idleTimer = setTimeout(
      () => fail(new Error(`Stream of ${fileName} for ${backupId} stalled - no data for ${DOWNLOAD_IDLE_TIMEOUT_MS}ms`)),
      DOWNLOAD_IDLE_TIMEOUT_MS
    );
  };

  source.on('error', error => fail(error instanceof Error ? error : new Error(String(error))));
  // Older Node versions emit 'aborted' (without 'error') when the server closes early.
  source.on('aborted', () => fail(new Error(`Stream of ${fileName} for ${backupId} was aborted by the remote side`)));
  guard.on('close', () => {
    clearIdle();
    if (!source.destroyed) {
      source.destroy();
    }
  });

  resetIdle();
  source.pipe(guard);
  return guard;
}

/**
 * Tell the WordPress plugin to remove one of its local backup files. Returns true when the file
 * is gone - either deleted now, or already absent (the plugin reports a missing file as an
 * error, which for our purposes is the desired end state, not a failure). Returns false on
 * anything else (network failure, auth failure), leaving the file to be retried later.
 */
async function deleteWordPressBackupFile(
  siteUrl: string,
  apiKey: string,
  processId: string,
  fileName: string
): Promise<boolean> {
  try {
    await axios.post(
      `${normalizeSiteUrl(siteUrl)}/index.php?rest_route=%2Fbackupsheep%2Fv3%2Fbackup%2Fdelete`,
      { api_key: apiKey, backup_id: processId, file: fileName },
      { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
    );
    return true;
  } catch (error) {
    const responseMessage = axios.isAxiosError(error)
      ? String(error.response?.data?.message || '')
      : '';
    if (/file not found/i.test(responseMessage)) {
      return true;
    }
    logger.warn(`Failed to delete remote backup file ${fileName} for ${processId}`, {
      error: errorMessage(error)
    });
    return false;
  }
}

/**
 * Remove every file of a backup run from the WordPress site that hasn't been confirmed removed
 * yet, and record progress in metadata (wpDeletedFiles / wpDeleted). Safe to call repeatedly:
 * files already recorded as deleted are skipped, and a file the plugin no longer has counts as
 * deleted. Called after a backup reaches a terminal state ('completed', 'upload_failed'), and
 * again from the daily retention job for any row still lacking wpDeleted, so a delete call lost
 * to a network blip is retried rather than leaving the file on the client's host indefinitely.
 *
 * WordPress's copy is the only source a retry can stream from, so this must never run before the
 * backup is terminal.
 */
export async function deleteWordPressBackupFiles(backupId: number): Promise<{ deleted: string[]; remaining: string[] }> {
  const backupResult = await pool.query('SELECT * FROM backups WHERE id = $1', [backupId]);
  const backup = backupResult.rows[0];
  if (!backup || !backup.process_id) {
    return { deleted: [], remaining: [] };
  }

  const siteResult = await pool.query('SELECT url, api_key FROM sites WHERE id = $1', [backup.site_id]);
  const site = siteResult.rows[0];
  if (!site || !site.api_key) {
    return { deleted: [], remaining: [] };
  }

  const metadata = parseMetadata(backup.metadata);
  const files = wordPressFilesFromMetadata(metadata);
  const alreadyDeleted = new Set(Array.isArray(metadata.wpDeletedFiles) ? metadata.wpDeletedFiles : []);
  const remaining: string[] = [];

  for (const file of files) {
    if (alreadyDeleted.has(file.name)) {
      continue;
    }
    const ok = await deleteWordPressBackupFile(site.url, site.api_key, backup.process_id, file.name);
    if (ok) {
      alreadyDeleted.add(file.name);
    } else {
      remaining.push(file.name);
    }
  }

  const updated: BackupMetadata = {
    ...metadata,
    wpDeletedFiles: Array.from(alreadyDeleted),
    wpDeleted: remaining.length === 0
  };
  await pool.query('UPDATE backups SET metadata = $1 WHERE id = $2', [JSON.stringify(updated), backupId]);

  return { deleted: Array.from(alreadyDeleted), remaining };
}

const MAX_UPLOAD_ATTEMPTS = 5;

/** Thrown for upload failures a retry can't fix - no point burning through the retry cap on them. */
class PermanentUploadError extends Error {}

interface CloudUploadContext {
  storageProviderId: number | null;
  processId: string;
  siteName: string;
  siteUrl: string;
  apiKey: string;
  /** Fixed per run (persisted in metadata) so every attempt resolves to the same cloud folder. */
  runTimestamp: Date;
  files: WordPressBackupFile[];
  /** Files already confirmed on cloud storage by an earlier attempt. */
  uploadedFiles: UploadedFileRecord[];
  /** Called after each file is confirmed, so progress survives a failure on a later file. */
  onFileUploaded: (record: UploadedFileRecord) => Promise<void>;
}

/**
 * Stream every file of a backup run from WordPress to its configured storage provider, one at a
 * time. Pure outcome reporting - does not decide the backup's status itself; the caller persists
 * the result (including how to advance/exhaust the retry count).
 *
 * Retry is per file, not per run: a file recorded in `uploadedFiles` is checked against the
 * provider (still there, right size) and skipped, so a failure on the multi-GB files.zip never
 * causes db.sql.gz to be transferred again. A file that fails is simply re-streamed from byte 0
 * on the next attempt - WordPress still has it, and its download route always serves from the
 * start (no Range support), so there is nothing to resume from anyway.
 */
async function attemptCloudUpload(
  ctx: CloudUploadContext
): Promise<
  | { success: true; storageType: string; storagePath: string; files: UploadedFileRecord[] }
  | { success: false; error: string; permanent: boolean }
> {
  if (!ctx.storageProviderId) {
    return { success: false, error: 'No storage provider configured for this backup', permanent: true };
  }

  try {
    const providerResult = await pool.query('SELECT * FROM storage_providers WHERE id = $1', [ctx.storageProviderId]);
    const provider = providerResult.rows[0];

    if (!provider) {
      throw new PermanentUploadError('Configured storage provider no longer exists');
    }
    if (!provider.enabled) {
      throw new PermanentUploadError(`Storage provider "${provider.name}" is disabled`);
    }

    const previouslyUploaded = (name: string) => ctx.uploadedFiles.find(f => f.name === name);

    if (provider.type === 'google') {
      const tokenResult = await tokenRefreshManager.getValidAccessToken(ctx.storageProviderId);
      if (!tokenResult.success || !tokenResult.access_token) {
        // Could be a transient refresh hiccup or a genuinely revoked grant - can't tell from
        // here, so let it exhaust the retry cap rather than failing it immediately.
        throw new Error(tokenResult.error || 'Could not get a valid Google Drive access token');
      }
      const accessToken = tokenResult.access_token;

      const uploaded: UploadedFileRecord[] = [];
      for (const file of ctx.files) {
        const existing = previouslyUploaded(file.name);
        if (existing && (await getGoogleDriveFileSize(accessToken, existing.fileId)) === file.size) {
          logger.info(`Skipping ${file.name} for ${ctx.processId} - already on Google Drive from an earlier attempt`);
          uploaded.push(existing);
          continue;
        }

        const body = await openWordPressFileStream(ctx.siteUrl, ctx.apiKey, ctx.processId, file.name, file.size);
        const result = await uploadFileToGoogleDrive(accessToken, body, file.size, ctx.siteName, ctx.runTimestamp, file.name);
        const record: UploadedFileRecord = {
          name: file.name,
          fileId: result.fileId,
          folderId: result.folderId,
          storagePath: result.storagePath,
          size: result.size
        };
        uploaded.push(record);
        await ctx.onFileUploaded(record);
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

    if (provider.type === 'r2') {
      // R2 credentials are static (no OAuth, no token to refresh) - read straight out of
      // config, which is stored flat (not the nested {token: "..."} shape OAuth providers use,
      // since there's no token exchange here to wrap).
      let rawConfig: Record<string, unknown>;
      try {
        rawConfig = JSON.parse(provider.config);
      } catch {
        throw new PermanentUploadError('Invalid R2 provider configuration format');
      }

      const { accountId, accessKeyId, secretAccessKey, bucketName } = rawConfig as Record<string, string>;
      if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
        // A misconfigured provider won't fix itself on retry.
        throw new PermanentUploadError('R2 provider is missing required credentials (accountId/accessKeyId/secretAccessKey/bucketName)');
      }

      const credentials: R2Credentials = { accountId, accessKeyId, secretAccessKey, bucketName };

      const uploaded: UploadedFileRecord[] = [];
      for (const file of ctx.files) {
        const existing = previouslyUploaded(file.name);
        if (existing && (await getR2ObjectSize(credentials, existing.fileId)) === file.size) {
          logger.info(`Skipping ${file.name} for ${ctx.processId} - already on R2 from an earlier attempt`);
          uploaded.push(existing);
          continue;
        }

        const body = await openWordPressFileStream(ctx.siteUrl, ctx.apiKey, ctx.processId, file.name, file.size);
        const result = await uploadFileToR2(credentials, body, file.size, ctx.siteName, ctx.runTimestamp, file.name);
        const record: UploadedFileRecord = {
          name: file.name,
          fileId: result.key,
          folderId: result.storagePath,
          storagePath: result.storagePath,
          size: result.size
        };
        uploaded.push(record);
        await ctx.onFileUploaded(record);
      }

      return {
        success: true,
        storageType: 'r2',
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
 * Stream (or resume streaming) a backup whose WordPress-side capture has finished to its cloud
 * storage provider, and persist the real outcome. Self-contained and safe to call from anywhere -
 * the HTTP status-poll route below, or the scheduler's periodic sweep - because it starts by
 * atomically claiming the backup (flipping 'ready' -> 'streaming' in one conditional
 * UPDATE ... WHERE status = 'ready'). If two callers race for the same backup (a client poll and
 * a scheduler tick landing at nearly the same moment), only one wins the claim; the other gets a
 * 'SKIPPED' outcome and does nothing further, so the same file is never streamed twice at once.
 *
 * A backup is only ever marked 'completed' from in here, once every file is confirmed on the
 * cloud - never at capture time. Only then are the WordPress-side copies deleted: they are the
 * sole retry source, since nothing is kept on this server.
 */
export async function streamBackupToCloud(backupId: number): Promise<UploadOutcome> {
  const claim = await pool.query(
    `UPDATE backups SET status = 'streaming' WHERE id = $1 AND status = 'ready' RETURNING *`,
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
  const siteResult = await pool.query('SELECT name, url, api_key FROM sites WHERE id = $1', [backup.site_id]);
  const site = siteResult.rows[0];
  const siteName = site?.name || 'Unknown site';

  const metadata = parseMetadata(backup.metadata);
  const files = wordPressFilesFromMetadata(metadata);
  const attemptNumber = (metadata.uploadAttempts || 0) + 1;

  const failPermanently = async (error: string): Promise<UploadOutcome> => {
    await pool.query(`UPDATE backups SET status = 'upload_failed', error = $1, metadata = $2 WHERE id = $3`, [
      error,
      JSON.stringify({ ...metadata, uploadAttempts: attemptNumber }),
      backup.id
    ]);
    return { success: false, status: 'ERROR', state: 'UPLOAD_FAILED', message: error };
  };

  if (!site || !site.api_key) {
    return failPermanently('Site no longer exists or has no API key - cannot stream its backup');
  }
  if (files.length === 0) {
    // WordPress reported completion without a file list - nothing to stream, and nothing a
    // retry could do about it.
    return failPermanently('WordPress reported no backup files for this run - cannot upload');
  }

  // Fix the run timestamp on the first attempt and reuse it afterwards, so a retry lands its
  // remaining files in the same cloud folder as the ones already uploaded.
  const runTimestamp = metadata.uploadRunTimestamp ? new Date(metadata.uploadRunTimestamp) : new Date();
  metadata.uploadRunTimestamp = runTimestamp.toISOString();
  metadata.uploadAttempts = attemptNumber;
  metadata.uploadedFiles = Array.isArray(metadata.uploadedFiles) ? metadata.uploadedFiles : [];
  await pool.query('UPDATE backups SET metadata = $1 WHERE id = $2', [JSON.stringify(metadata), backup.id]);

  const result = await attemptCloudUpload({
    storageProviderId: backup.storage_provider_id,
    processId: backup.process_id,
    siteName,
    siteUrl: site.url,
    apiKey: site.api_key,
    runTimestamp,
    files,
    uploadedFiles: metadata.uploadedFiles,
    onFileUploaded: async record => {
      // Persist per-file progress immediately - if the next file fails, this one is skipped on
      // the retry instead of being transferred again.
      metadata.uploadedFiles = [...(metadata.uploadedFiles || []).filter(f => f.name !== record.name), record];
      await pool.query('UPDATE backups SET metadata = $1 WHERE id = $2', [JSON.stringify(metadata), backup.id]);
    }
  });

  if (result.success) {
    const totalSize = result.files.reduce((sum, f) => sum + f.size, 0);
    await pool.query(
      `UPDATE backups
       SET status = 'completed', completed_at = $1, filesize = $2, storage_type = $3, storage_path = $4, metadata = $5, error = NULL
       WHERE id = $6`,
      [
        new Date(),
        totalSize,
        result.storageType,
        result.storagePath,
        JSON.stringify({ ...metadata, uploadedFiles: result.files }),
        backup.id
      ]
    );

    logger.info(`Backup ${backup.process_id} fully completed - streamed to ${result.storageType}`, {
      storagePath: result.storagePath,
      files: result.files.map(f => ({ name: f.name, size: f.size }))
    });

    // Cloud copy is confirmed - WordPress no longer needs to hold its own. Best-effort: a failure
    // here is retried by the retention job, never a reason to un-complete the backup.
    try {
      const deletion = await deleteWordPressBackupFiles(backup.id);
      if (deletion.remaining.length > 0) {
        logger.warn(`Backup ${backup.process_id}: ${deletion.remaining.length} file(s) still on WordPress after delete attempt - will retry later`, {
          remaining: deletion.remaining
        });
      }
    } catch (deleteError) {
      logger.warn(`Backup ${backup.process_id}: failed to delete WordPress-side files after completion`, {
        error: errorMessage(deleteError)
      });
    }

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
  // 'ready' so the next poll or scheduler tick retries it, until the attempt cap is hit.
  const giveUp = result.permanent || attemptNumber >= MAX_UPLOAD_ATTEMPTS;
  const finalStatus = giveUp ? 'upload_failed' : 'ready';

  logger.warn(
    `Backup ${backup.process_id} upload attempt ${attemptNumber} failed${giveUp ? ' - giving up' : ', will retry'}`,
    { error: result.error, permanent: result.permanent }
  );

  await pool.query(`UPDATE backups SET status = $1, error = $2, metadata = $3 WHERE id = $4`, [
    finalStatus,
    result.error,
    JSON.stringify(metadata),
    backup.id
  ]);

  if (giveUp) {
    // Nothing will ever stream these files now - don't leave them occupying the client's host.
    try {
      await deleteWordPressBackupFiles(backup.id);
    } catch (deleteError) {
      logger.warn(`Backup ${backup.process_id}: failed to delete WordPress-side files after giving up`, {
        error: errorMessage(deleteError)
      });
    }

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
      ? `Backup built on WordPress but upload failed: ${result.error}`
      : `Upload attempt ${attemptNumber}/${MAX_UPLOAD_ATTEMPTS} failed, retrying: ${result.error}`
  };
}

export type CaptureResult =
  | { state: 'ready'; wpStatus: any; message: string }
  | { state: 'pending'; wpStatus: any; message: string }
  | { state: 'failed'; wpStatus: any; message: string }
  | { state: 'not_applicable'; wpStatus: null; message: string };

/**
 * Ask the WordPress plugin whether a still-in-progress backup has finished building and, if it
 * has, record its file list (names and sizes) and advance the row to 'ready'. Nothing is
 * transferred here - that's streamBackupToCloud()'s job - so this is quick and cheap to call
 * from both the status route and the scheduler's capture sweep.
 *
 * This was previously inlined in GET /status/:processId, whose only caller is the browser-side
 * backup wizard. That made a browser tab the sole thing in the system able to move a backup out
 * of 'in_progress': close the tab and the backup sat in_progress forever while WordPress had long
 * since finished. Meanwhile the stuck-process sweep, seeing Node's stale 'in_progress', kept
 * re-nudging wp-cron - re-running a backup that had already succeeded on a live client site.
 * Extracted so the scheduler can call it directly, in-process.
 */
export async function captureBackupFromWordPress(backupId: number): Promise<CaptureResult> {
  const backupResult = await pool.query('SELECT * FROM backups WHERE id = $1', [backupId]);
  const backup = backupResult.rows[0];

  if (!backup) {
    return { state: 'not_applicable', wpStatus: null, message: 'Backup not found' };
  }
  if (backup.status !== 'in_progress') {
    return { state: 'not_applicable', wpStatus: null, message: 'Backup is not awaiting capture' };
  }

  const siteResult = await pool.query('SELECT * FROM sites WHERE id = $1', [backup.site_id]);
  const site = siteResult.rows[0];

  if (!site) {
    return { state: 'not_applicable', wpStatus: null, message: 'Site not found for this backup' };
  }

  const processId = backup.process_id;

  const statusResponse = await axios.get(
    `${normalizeSiteUrl(site.url)}/index.php?rest_route=%2Fbackupsheep%2Fv3%2Fbackup%2Fstatus`,
    { params: { api_key: site.api_key, backup_id: processId }, timeout: 30000 }
  );

  const backupStatus = statusResponse.data.backup_status || {};

  logger.info('Backup status check response:', {
    processId,
    wpStatus: backupStatus.status,
    fileCount: Array.isArray(backupStatus.files) ? backupStatus.files.length : 0
  });

  if (backupStatus.status === 'error') {
    await pool.query('UPDATE backups SET status = $1, error = $2, metadata = $3 WHERE id = $4', [
      'failed',
      backupStatus.error_message || 'Backup process failed',
      JSON.stringify({ wpStatus: backupStatus }),
      backupId
    ]);

    try {
      await commonNotificationService.sendBackupFailureNotification(
        backup.site_id,
        site.name,
        backupStatus.error_message || 'Backup process failed',
        { backupId, processId }
      );
    } catch (notifyError) {
      logger.warn(`Failed to send backup failure notification for ${processId}`, {
        error: errorMessage(notifyError)
      });
    }

    return { state: 'failed', wpStatus: backupStatus, message: backupStatus.error_message || 'Backup process failed' };
  }

  if (backupStatus.status !== 'completed') {
    await pool.query('UPDATE backups SET metadata = $1 WHERE id = $2', [
      JSON.stringify({ wpStatus: backupStatus }),
      backupId
    ]);
    return { state: 'pending', wpStatus: backupStatus, message: `Backup ${backupStatus.status || 'pending'}` };
  }

  // WordPress is done. Advance to 'ready' conditionally on still being 'in_progress' - the
  // scheduler sweep and a browser poll can land on the same backup at the same moment, and only
  // one of them should record the transition. Whoever loses simply reports 'not_applicable'.
  const advanced = await pool.query(
    `UPDATE backups SET status = 'ready', metadata = $1 WHERE id = $2 AND status = 'in_progress' RETURNING id`,
    [JSON.stringify({ wpStatus: backupStatus }), backupId]
  );

  if (advanced.rowCount === 0) {
    return { state: 'not_applicable', wpStatus: null, message: 'Backup was advanced by another worker' };
  }

  // Retire the process-tracking row too. Left 'active', the stuck-process sweep would keep
  // re-nudging wp-cron for a run WordPress has already finished.
  try {
    await prisma.processTracking.updateMany({ where: { processId }, data: { status: 'completed' } });
  } catch (trackingError) {
    logger.warn(`Failed to mark process tracking completed for ${processId}`, {
      error: errorMessage(trackingError)
    });
  }

  logger.info(`Backup ${processId} ready on WordPress - awaiting stream to cloud storage`, {
    files: Array.isArray(backupStatus.files)
      ? backupStatus.files.map((f: WordPressBackupFile) => ({ name: f.name, size: f.size }))
      : []
  });

  return { state: 'ready', wpStatus: backupStatus, message: 'Backup ready on WordPress' };
}

// Endpoint to check backup status. On WordPress completion, advances the backup to 'ready' and
// drives the stream-to-cloud step (including retrying it on later polls, and racing safely
// against the scheduler's own sweep) via streamBackupToCloud(). A backup only reaches
// 'completed' once every file is confirmed on cloud storage.
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

    // 'ready' means WordPress has the files and no upload has succeeded yet (or it's being
    // retried); go straight to the streaming step. The scheduler may be doing the same thing
    // concurrently - streamBackupToCloud's atomic claim handles that.
    if (backup.status === 'ready') {
      const outcome = await streamBackupToCloud(backup.id);
      return res.status(200).json({ success: outcome.success, status: outcome.status, state: outcome.state, message: outcome.message });
    }
    if (backup.status === 'streaming') {
      // Someone else (the scheduler's periodic sweep, most likely) is actively streaming this
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
        message: backup.error || 'Backup built on WordPress but upload failed'
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

    // Polling WordPress and advancing to 'ready' lives in captureBackupFromWordPress() now, so
    // the scheduler can drive the identical path in-process. This route is one of two callers
    // rather than the only thing in the system capable of moving a backup out of 'in_progress'.
    const capture = await captureBackupFromWordPress(backup.id);

    if (capture.state === 'ready') {
      const outcome = await streamBackupToCloud(backup.id);
      return res.status(200).json({ success: outcome.success, status: outcome.status, state: outcome.state, message: outcome.message });
    }

    if (capture.state === 'failed') {
      return res.status(200).json({
        success: true,
        status: 'ERROR',
        state: 'ERROR',
        message: capture.message
      });
    }

    // 'pending' (WordPress still working) or 'not_applicable' (another worker advanced it in the
    // meantime). Neither is terminal - the next poll or scheduler tick moves it on.
    const legacyState = (capture.wpStatus?.status || 'pending').toUpperCase();

    return res.status(200).json({
      success: true,
      status: 'in_progress',
      state: legacyState,
      message: capture.message,
      wpStatus: capture.wpStatus?.status,
      data: { status: 'in_progress', state: legacyState, message: capture.wpStatus?.error_message || '' },
      logs: {},
      latestLog: null
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
