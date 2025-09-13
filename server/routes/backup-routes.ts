/**
 * Backup API Routes
 *
 * This module defines the API routes for backup management and operations.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import axios from 'axios';
import logger from '../utils/logger';
import { backupService } from '../services/backup-service';
import prisma from '../prisma';
import {
  processDropboxToken,
  fetchDropboxSpaceUsage,
  fetchDropboxBackupsFolderSize,
  fetchDropboxFolderSizeByPath,
} from '../providers/dropbox';
import { tokenRefreshManager } from '../TokenRefreshManager';
import { commonNotificationService } from '../services/common-notification-service';

// Use the default logger instance
const router = Router();

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

const webhookStatusUpdateSchema = z.object({
  processId: z.string().min(1, 'Process ID is required'),
});

const webhookFailureUpdateSchema = z.object({
  processId: z.string().min(1, 'Process ID is required'),
  status: z.string().min(1, 'Status is required'),
  message: z.string().min(1, 'Message is required'),
});

const webhookProcessUpdateSchema = z.object({
  processId: z.string().min(1, 'Process ID is required'),
  status: z.string().min(1, 'Status is required'),
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
      error: error instanceof Error ? error.message : 'Unknown error',
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
      error: error instanceof Error ? error.message : 'Unknown error',
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
      error: error instanceof Error ? error.message : 'Unknown error',
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
      error: error instanceof Error ? error.message : 'Unknown error',
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
      error: error instanceof Error ? error.message : 'Unknown error',
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
      error: error instanceof Error ? error.message : 'Unknown error',
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
      error: error instanceof Error ? error.message : 'Unknown error',
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
      error: error instanceof Error ? error.message : 'Unknown error',
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
      error: error instanceof Error ? error.message : 'Unknown error',
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
      error: error instanceof Error ? error.message : 'Unknown error',
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
      error: error instanceof Error ? error.message : 'Unknown error',
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
        error: error instanceof Error ? error.message : 'Unknown error',
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
        error: error instanceof Error ? error.message : 'Unknown error',
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
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// New endpoint: Start a WordPress backup using a storage provider
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { siteId, storageProviderId } = req.body;

    // Validate required parameters
    if (!siteId) {
      return res.status(400).json({
        success: false,
        message: 'Site ID is required',
      });
    }

    if (!storageProviderId) {
      return res.status(400).json({
        success: false,
        message: 'Storage provider ID is required',
      });
    }

    // Get the site details
    const site = await prisma.site.findUnique({
      where: { id: parseInt(siteId) },
    });

    if (!site) {
      return res.status(404).json({
        success: false,
        message: 'Site not found',
      });
    }

    // Get the storage provider details
    const provider = await prisma.storageProvider.findUnique({
      where: { id: storageProviderId },
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Storage provider not found',
      });
    }

    // Check if provider is Dropbox (currently only supporting Dropbox)
    if (provider.type !== 'dropbox') {
      return res.status(400).json({
        success: false,
        message: 'Only Dropbox providers are currently supported',
      });
    }

    // Validate Dropbox token and check storage space
    // This ensures the token is valid and checks storage availability before starting the backup process
    let validatedToken: string;

    try {
      logger.info('Validating Dropbox token and checking storage space', {
        storageProviderId,
        siteId,
      });

      // Use makeDropboxApiCall to validate token with automatic refresh on 401
      const [accountInfo, spaceUsage] = await Promise.all([
        tokenRefreshManager.makeDropboxApiCall(storageProviderId, async (accessToken: string) => {
          // Make a simple API call to Dropbox to validate the token
          const response = await axios.post(
            'https://api.dropboxapi.com/2/users/get_current_account',
            null,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              timeout: 30000, // 30 second timeout
            }
          );
          return {
            valid: true,
            accessToken,
            accountInfo: response.data,
          };
        }),
        // Simultaneously check storage space usage
        tokenRefreshManager.makeDropboxApiCall(storageProviderId, (accessToken: string) =>
          fetchDropboxSpaceUsage(accessToken)
        ),
      ]);

      validatedToken = accountInfo.accessToken;
      logger.info('Dropbox token validation successful', {
        storageProviderId,
        accountId: accountInfo.accountInfo?.account_id?.substring(0, 8) + '...',
      });

      // Check storage space - trigger critical notification if less than 10% free
      const usedSpace = spaceUsage.used;
      const totalSpace = spaceUsage.allocation.allocated;
      const usedPercentage = (usedSpace / totalSpace) * 100;
      const freePercentage = 100 - usedPercentage;

      logger.info('Dropbox storage space check', {
        storageProviderId,
        usedSpace,
        totalSpace,
        usedPercentage: usedPercentage.toFixed(1),
        freePercentage: freePercentage.toFixed(1),
      });

      // Send critical notification if less than 10% free space
      if (freePercentage < 10) {
        logger.warn('Critical storage space warning triggered', {
          storageProviderId,
          siteId,
          freePercentage: freePercentage.toFixed(1),
        });

        // Send notification asynchronously (don't block backup process)
        commonNotificationService
          .sendStorageSpaceWarning(
            site.id,
            site.name,
            'Dropbox',
            usedPercentage,
            usedSpace,
            totalSpace
          )
          .catch((notificationError) => {
            logger.error('Failed to send storage space warning notification', {
              storageProviderId,
              siteId,
              error:
                notificationError instanceof Error ? notificationError.message : 'Unknown error',
            });
          });
      }
    } catch (error) {
      logger.error('Dropbox token validation failed', {
        storageProviderId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return res.status(401).json({
        success: false,
        message: 'Dropbox token validation failed. Please re-authenticate your Dropbox connection.',
        error: error instanceof Error ? error.message : 'Token validation failed',
      });
    }

    // Process the validated token to handle HTML entity encoding and JSON parsing
    const processedToken = processDropboxToken(validatedToken);

    // Ensure the site URL has a protocol
    let siteUrl = site.url;
    if (!siteUrl.startsWith('http://') && !siteUrl.startsWith('https://')) {
      siteUrl = `https://${siteUrl}`;
    }

    // Map backup mode to WordPress plugin format
    // ALL = 1 (both files and database)
    // DB = 2 (database only)
    // FILES = 3 (files only)
    const siteBackupMode = site.backupMode || 'ALL'; // Use site's backup mode or default to ALL
    let backupModeValue = 1; // default to ALL
    if (siteBackupMode === 'DB') {
      backupModeValue = 2;
    } else if (siteBackupMode === 'FILES') {
      backupModeValue = 3;
    }

    // Step 1: First call to start backup with dropbox_token and mode
    const firstCallPayload = {
      dropbox_token: processedToken,
      mode: siteBackupMode,
    };
    logger.info('🔄 Making first WordPress plugin API call to start backup with token and mode', {
      siteUrl,
      endpoint: `${siteUrl}/index.php?rest_route=%2Fbacksheep%2Fv1%2Fbackup%2Fstart`,
      payload: firstCallPayload,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000,
    });

    const firstResponse = await axios.post(
      `${siteUrl}/index.php?rest_route=%2Fbacksheep%2Fv1%2Fbackup%2Fstart`,
      firstCallPayload,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 120000, // 2 minute timeout for backup operations
      }
    );

    // Check the first response
    if (firstResponse.status !== 200) {
      logger.error('WordPress backup start API (first call) failed', {
        status: firstResponse.status,
        data: firstResponse.data,
        siteUrl: siteUrl,
      });
      return res.status(500).json({
        success: false,
        message: `WordPress API returned error: ${firstResponse.status}`,
        data: firstResponse.data,
      });
    }

    const firstResponseData = firstResponse.data;

    // Validate first response and get site token
    if (firstResponseData.status !== 'SUCCESS' || !firstResponseData.token) {
      logger.error('WordPress backup start API (first call) returned invalid response', {
        status: firstResponseData.status,
        token: firstResponseData.token,
        message: firstResponseData.message,
        fullResponse: firstResponseData,
      });
      return res.status(500).json({
        success: false,
        message: firstResponseData.message || 'Failed to get site token',
        data: firstResponseData,
      });
    }

    // Step 2: Verify the received token against the site's API key
    const receivedToken = firstResponseData.token;
    const siteApiKey = site.apiKey; // The API key stored when site was added

    if (!siteApiKey) {
      logger.error('Site API key not found for verification', {
        siteId: site.id,
        siteUrl: siteUrl,
      });
      return res.status(500).json({
        success: false,
        message: 'Site API key not configured for token verification',
        error_code: 'MISSING_API_KEY',
      });
    }

    // Verify the received token matches the site's API key
    if (receivedToken !== siteApiKey) {
      logger.error('Token verification failed - mismatch with site API key', {
        siteId: site.id,
        siteUrl: siteUrl,
        tokenReceived: !!receivedToken,
        apiKeyConfigured: !!siteApiKey,
      });
      return res.status(401).json({
        success: false,
        message: 'Token verification failed - site token does not match configured API key',
        error_code: 'TOKEN_VERIFICATION_FAILED',
      });
    }

    // Step 3: Token verified successfully, use the process_id from first response
    const wpResponseData = firstResponseData;

    logger.info('Token verification successful', {
      siteId: site.id,
      siteUrl: siteUrl,
      processId: wpResponseData.process_id,
    });

    // Map mode to backup type for database storage
    // Use the site's backup mode directly instead of translating to old values
    let backupType = siteBackupMode; // Preserve original values: DB, THEME, PLUGIN, ALL

    // Make the second API call to run the backup with only process_id

    // Fire and forget - send backup/run request without waiting for response
    const formData = new URLSearchParams();
    formData.append('process_id', wpResponseData.process_id);

    // Log the payload being sent to the WordPress plugin
    const secondCallPayload = {
      process_id: wpResponseData.process_id,
    };
    logger.info('🚀 Making second WordPress plugin API call to run backup', {
      siteUrl,
      endpoint: `${siteUrl}/index.php?rest_route=%2Fbacksheep%2Fv1%2Fbackup%2Frun`,
      payload: secondCallPayload,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 120000,
    });

    // Send the request asynchronously without blocking
    axios
      .post(`${siteUrl}/index.php?rest_route=%2Fbacksheep%2Fv1%2Fbackup%2Frun`, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 120000, // 2 minute timeout for backup operations
      })
      .then((runResponse) => {
        logger.info('WordPress backup run API call succeeded><><><><><><><><><><><>');
      })
      .catch((runError) => {
        // Log error but don't fail the API response since backup may still proceed
        logger.warn('WordPress backup run API call failed, but backup may still be processing', {
          error: runError.message,
          status: runError.response?.status,
          data: runError.response?.data,
          process_id: wpResponseData.process_id,
          siteUrl: siteUrl,
        });
      });

    // Store the backup process in our database
    const backup = await prisma.backup.create({
      data: {
        siteId: parseInt(siteId),
        storageProviderId: storageProviderId,
        backupType: backupType,
        status: 'in_progress',
        storageType: provider.type, // Save the storage provider type (e.g., 'dropbox')
        storagePath: wpResponseData.path || wpResponseData.backup_path || null, // Save the backup path from WordPress response
        processId: wpResponseData.process_id,
        metadata: JSON.stringify({
          ...wpResponseData,
          backup_path: wpResponseData.path || wpResponseData.backup_path, // Save the backup path from WordPress response
          dropbox_token_provided: !!processedToken,
          backup_run_initiated: true,
        }),
        startedAt: new Date(),
      },
    });

    // Return success with the process ID and backup record
    return res.status(200).json({
      success: true,
      message: 'Backup process started successfully',
      processId: wpResponseData.process_id,
      backup: backup,
    });
  } catch (error) {
    logger.error('Error starting backup', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return res.status(500).json({
      success: false,
      message: 'Error starting backup',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Endpoint to fetch backup logs
router.get('/status/:processId/logs', async (req: Request, res: Response) => {
  try {
    const { processId } = req.params;

    if (!processId) {
      return res.status(400).json({
        success: false,
        message: 'Process ID is required',
      });
    }

    // Check if the process exists in our database
    const backup = await prisma.backup.findFirst({
      where: { processId: processId },
      include: { site: true },
    });

    if (!backup) {
      return res.status(404).json({
        success: false,
        message: 'Backup process not found',
      });
    }

    // Create form data for the request
    const formData = new URLSearchParams();
    formData.append('process_id', processId);

    if (!backup.site) {
      return res.status(404).json({
        success: false,
        message: 'Site not found for this backup process',
      });
    }

    // Ensure the site URL has a protocol
    let siteUrl = backup.site.url;
    if (!siteUrl.startsWith('http://') && !siteUrl.startsWith('https://')) {
      siteUrl = `https://${siteUrl}`;
    }

    // Get the detailed logs from WordPress API using the site's URL
    const logsResponse = await axios.post(
      `${siteUrl}/index.php?rest_route=%2Fbacksheep%2Fv1%2Fbackup%2Fstatus%2Flog`,
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    // Return the logs to the client
    return res.status(200).json({
      success: true,
      logs: logsResponse.data.log || {},
      status: logsResponse.data.status,
      state: logsResponse.data.state,
      message: logsResponse.data.message,
    });
  } catch (error) {
    logger.error('Error fetching backup logs', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return res.status(500).json({
      success: false,
      message: 'Error fetching backup logs',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Endpoint to check backup status with detailed logs
router.get('/status/:processId', async (req: Request, res: Response) => {
  try {
    const { processId } = req.params;

    if (!processId) {
      return res.status(400).json({
        success: false,
        message: 'Process ID is required',
      });
    }

    // Check if the process exists in our database
    const backup = await prisma.backup.findFirst({
      where: { processId: processId },
      include: { site: true },
    });

    if (!backup) {
      return res.status(404).json({
        success: false,
        message: 'Backup process not found',
      });
    }

    if (!backup.site) {
      return res.status(404).json({
        success: false,
        message: 'Site not found for this backup process',
      });
    }

    // Ensure the site URL has a protocol
    let siteUrl = backup.site.url;
    if (!siteUrl.startsWith('http://') && !siteUrl.startsWith('https://')) {
      siteUrl = `https://${siteUrl}`;
    }

    // Check the status with the WordPress API
    // Create form data for the request
    const formData = new URLSearchParams();
    formData.append('process_id', processId);

    // Make the API call with the process_id as form data using the site's URL
    const statusResponse = await axios.post(
      `${siteUrl}/index.php?rest_route=%2Fbacksheep%2Fv1%2Fbackup%2Fstatus`,
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    // Now also get the detailed logs to include in our response
    let logsData = null;
    let latestLogEntry = null;

    try {
      // Fetch detailed logs separately using the site's URL
      const logsResponse = await axios.post(
        `${siteUrl}/index.php?rest_route=%2Fbacksheep%2Fv1%2Fbackup%2Fstatus%2Flog`,
        formData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      // Get the log data
      logsData = logsResponse.data.log || {};

      // Find the latest log entry (for latest status)
      if (logsResponse.data.log && Object.keys(logsResponse.data.log).length > 0) {
        // Sort keys to get the latest timestamp
        const sortedKeys = Object.keys(logsResponse.data.log).sort().reverse();
        latestLogEntry = logsResponse.data.log[sortedKeys[0]];
      }
    } catch (logError) {
      logger.warn('Failed to fetch backup logs:', {
        error: logError instanceof Error ? logError.message : 'Unknown error',
      });
      // Continue with just the status data
    }

    // Update the backup record with the latest status
    const status = statusResponse.data.state || statusResponse.data.status;
    let dbStatus = 'in_progress';

    // Map WordPress status to our status
    if (
      status === 'COMPLETED' ||
      statusResponse.data.status === 'SUCCESS' ||
      status === 'COMPLETED'
    ) {
      dbStatus = 'completed';

      // If completed, update the completion time
      await prisma.backup.update({
        where: { id: backup.id },
        data: {
          status: dbStatus,
          completedAt: new Date(),
          metadata: JSON.stringify(statusResponse.data),
        },
      });
    } else if (
      status === 'ERROR' ||
      statusResponse.data.status === 'ERROR' ||
      statusResponse.data.error
    ) {
      dbStatus = 'failed';

      // If failed, update with error details
      await prisma.backup.update({
        where: { id: backup.id },
        data: {
          status: dbStatus,
          error: statusResponse.data.message || 'Backup process failed',
          metadata: JSON.stringify(statusResponse.data),
        },
      });
    } else {
      // Still in progress, just update metadata
      await prisma.backup.update({
        where: { id: backup.id },
        data: {
          metadata: JSON.stringify(statusResponse.data),
        },
      });
    }

    // Return the status along with logs if available
    return res.status(200).json({
      success: true,
      status: dbStatus,
      state: statusResponse.data.state,
      message: statusResponse.data.message || (latestLogEntry ? latestLogEntry.message : ''),
      wpStatus: statusResponse.data.status,
      data: statusResponse.data,
      logs: logsData,
      latestLog: latestLogEntry,
    });
  } catch (error) {
    logger.error('Error checking backup status', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return res.status(500).json({
      success: false,
      message: 'Error checking backup status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Webhook endpoint for backup completion notification from WordPress plugin
router.post('/webhook/status-update', async (req: Request, res: Response) => {
  try {
    // Validate request body using schema
    const validationResult = webhookStatusUpdateSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook request data',
        errors: validationResult.error.errors,
      });
    }

    const { processId } = validationResult.data;

    logger.info(`Received completion webhook for process ${processId}`, {
      processId,
    });

    // Find the backup record by processId
    const backup = await prisma.backup.findFirst({
      where: { processId: processId },
      include: { site: true },
    });

    if (!backup) {
      logger.warn(`No backup found for process ID: ${processId}`);
      return res.status(404).json({
        success: false,
        message: 'Backup not found',
        error: `No backup record found for process ID: ${processId}`,
      });
    }

    // Get the actual backup folder size using the storage_path
    let backupFolderSize: number | null = null;

    if (backup.storageProviderId && backup.storagePath) {
      try {
        backupFolderSize = await tokenRefreshManager.makeDropboxApiCall(
          backup.storageProviderId,
          (accessToken: string) => fetchDropboxFolderSizeByPath(accessToken, backup.storagePath!)
        );

        logger.info('Successfully retrieved backup folder size from storage path', {
          processId,
          backupId: backup.id,
          storagePath: backup.storagePath,
          backupFolderSize,
        });
      } catch (error) {
        logger.warn('Failed to get backup folder size from Dropbox', {
          processId,
          backupId: backup.id,
          storagePath: backup.storagePath,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue without backup size if retrieval fails
      }
    }

    // Mark backup as completed since WordPress plugin called the webhook
    const updateData = {
      status: 'completed',
      completedAt: new Date(),
      filesize: backupFolderSize, // Use actual backup folder size directly
      metadata: JSON.stringify({
        webhookReceived: true,
        completedViaWebhook: true,
        webhookTimestamp: new Date().toISOString(),
        storagePath: backup.storagePath,
        backupFolderSize: backupFolderSize,
      }),
    };

    // Update the backup record
    const updatedBackup = await prisma.backup.update({
      where: { id: backup.id },
      data: updateData,
      include: { site: true },
    });

    logger.info(`Marked backup as completed via webhook for process ${processId}`, {
      backupId: backup.id,
      siteId: backup.siteId,
      siteName: backup.site?.name,
      oldStatus: backup.status,
      newStatus: 'completed',
      processId,
    });

    // Update the site's lastBackup timestamp
    await prisma.site.update({
      where: { id: backup.siteId },
      data: { lastBackup: new Date() },
    });

    // Send backup completion notification
    try {
      await commonNotificationService.sendBackupCompletionNotification(
        backup.siteId,
        backup.site?.name || 'Unknown Site',
        {
          backupId: updatedBackup.id,
          processId: updatedBackup.processId,
          backupType: updatedBackup.backupType,
          completedViaWebhook: true,
          filesize: updatedBackup.filesize,
          storagePath: updatedBackup.storagePath,
        }
      );

      logger.info('Backup completion notification sent', {
        backupId: updatedBackup.id,
        siteId: backup.siteId,
      });
    } catch (notificationError) {
      // Don't fail the webhook if notification sending fails
      logger.error('Failed to send backup completion notification', {
        error: notificationError instanceof Error ? notificationError.message : 'Unknown error',
        backupId: updatedBackup.id,
        siteId: backup.siteId,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Backup marked as completed successfully',
      data: {
        backupId: updatedBackup.id,
        processId: updatedBackup.processId,
        status: updatedBackup.status,
        siteName: updatedBackup.site?.name,
        completedAt: updatedBackup.completedAt,
      },
    });
  } catch (error) {
    logger.error('Error updating backup status via webhook', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processId: req.body.processId,
    });

    return res.status(500).json({
      success: false,
      message: 'Error updating backup status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Webhook endpoint for backup failure notification from WordPress plugin
router.post('/webhook/status-update/fail', async (req: Request, res: Response) => {
  try {
    // Validate request body using schema
    const validationResult = webhookFailureUpdateSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook request data',
        errors: validationResult.error.errors,
      });
    }

    const { processId, status, message } = validationResult.data;

    logger.info(`Received failure webhook for process ${processId}`, {
      processId,
      status,
      message,
    });

    // Find the backup record by processId
    const backup = await prisma.backup.findFirst({
      where: { processId: processId },
      include: { site: true },
    });

    if (!backup) {
      logger.warn(`No backup found for process ID: ${processId}`);
      return res.status(404).json({
        success: false,
        message: 'Backup not found',
        error: `No backup record found for process ID: ${processId}`,
      });
    }

    // Get the backup folder size using storage_path if available (for partially completed backups)
    let backupFolderSize: number | null = null;

    if (backup.storageProviderId && backup.storagePath) {
      try {
        backupFolderSize = await tokenRefreshManager.makeDropboxApiCall(
          backup.storageProviderId,
          (accessToken: string) => fetchDropboxFolderSizeByPath(accessToken, backup.storagePath!)
        );

        logger.info('Successfully retrieved backup folder size for failed backup', {
          processId,
          backupId: backup.id,
          storagePath: backup.storagePath,
          backupFolderSize,
        });
      } catch (error) {
        logger.warn('Failed to get backup folder size from Dropbox for failed backup', {
          processId,
          backupId: backup.id,
          storagePath: backup.storagePath,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue without backup size if retrieval fails (folder might not exist if backup failed early)
      }
    } else {
      logger.info(
        'No storage path available for failed backup (backup likely failed before folder creation)',
        {
          processId,
          backupId: backup.id,
          hasStorageProvider: !!backup.storageProviderId,
          hasStoragePath: !!backup.storagePath,
        }
      );
    }

    // Mark backup as failed and store the failure reason
    const updateData = {
      status: 'failed',
      completedAt: new Date(),
      error: message, // Store the failure message in the error field
      filesize: backupFolderSize, // Store the backup folder size if available (for partial backups)
      metadata: JSON.stringify({
        webhookReceived: true,
        failedViaWebhook: true,
        webhookTimestamp: new Date().toISOString(),
        failureStatus: status,
        failureMessage: message,
        storagePath: backup.storagePath,
        backupFolderSize: backupFolderSize,
      }),
    };

    // Update the backup record
    const updatedBackup = await prisma.backup.update({
      where: { id: backup.id },
      data: updateData,
      include: { site: true },
    });

    logger.info(`Marked backup as failed via webhook for process ${processId}`, {
      backupId: backup.id,
      siteId: backup.siteId,
      siteName: backup.site?.name,
      oldStatus: backup.status,
      newStatus: 'failed',
      processId,
      failureReason: message,
    });

    // Send backup failure notification
    try {
      await commonNotificationService.sendBackupFailureNotification(
        backup.siteId,
        backup.site?.name || 'Unknown Site',
        message,
        {
          backupId: updatedBackup.id,
          processId: updatedBackup.processId,
          backupType: updatedBackup.backupType,
          failedViaWebhook: true,
          failureStatus: status,
        }
      );

      logger.info('Backup failure notification sent', {
        backupId: updatedBackup.id,
        siteId: backup.siteId,
      });
    } catch (notificationError) {
      // Don't fail the webhook if notification sending fails
      logger.error('Failed to send backup failure notification', {
        error: notificationError instanceof Error ? notificationError.message : 'Unknown error',
        backupId: updatedBackup.id,
        siteId: backup.siteId,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Backup marked as failed successfully',
      data: {
        backupId: updatedBackup.id,
        processId: updatedBackup.processId,
        status: updatedBackup.status,
        siteName: updatedBackup.site?.name,
        completedAt: updatedBackup.completedAt,
        error: updatedBackup.error,
      },
    });
  } catch (error) {
    logger.error('Error updating backup status via failure webhook', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processId: req.body.processId,
    });

    return res.status(500).json({
      success: false,
      message: 'Error updating backup status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Webhook endpoint to process updates and trigger WordPress plugin run
router.post('/webhook/process-update', async (req: Request, res: Response) => {
  try {
    // Validate request body using schema
    const validationResult = webhookProcessUpdateSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook request data',
        errors: validationResult.error.errors,
      });
    }

    const { processId, status } = validationResult.data;

    logger.info(`Received process-update webhook for process ${processId}`, {
      processId,
      status,
    });

    // Find the backup record by processId with site information
    const backup = await prisma.backup.findFirst({
      where: { processId: processId },
      include: { site: true },
    });

    if (!backup) {
      logger.warn(`No backup found for process ID: ${processId}`);
      return res.status(404).json({
        success: false,
        message: 'Backup not found',
        error: `No backup record found for process ID: ${processId}`,
      });
    }

    if (!backup.site) {
      logger.error(`Backup found but no site associated for process ID: ${processId}`, {
        backupId: backup.id,
        processId,
      });
      return res.status(400).json({
        success: false,
        message: 'Site not found for backup',
        error: `No site associated with backup for process ID: ${processId}`,
      });
    }

    // Ensure the site URL has a protocol
    let siteUrl = backup.site.url;
    if (!siteUrl.startsWith('http://') && !siteUrl.startsWith('https://')) {
      siteUrl = `https://${siteUrl}`;
    }

    logger.info(`Making WordPress plugin /run API call for process ${processId}`, {
      processId,
      status,
      siteUrl: siteUrl,
      backupId: backup.id,
    });

    // Call the WordPress plugin's /run endpoint internally
    const formData = new URLSearchParams();
    formData.append('process_id', processId);

    // Log the payload being sent to the WordPress plugin
    const runPayload = {
      process_id: processId,
    };

    logger.info('🚀 Making WordPress plugin API call to run backup via process-update webhook', {
      siteUrl,
      endpoint: `${siteUrl}/index.php?rest_route=%2Fbacksheep%2Fv1%2Fbackup%2Frun`,
      payload: runPayload,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 120000,
      originalStatus: status,
      triggeredBy: 'process-update-webhook',
    });

    // Send the request asynchronously without blocking (fire and forget)
    axios
      .post(`${siteUrl}/index.php?rest_route=%2Fbacksheep%2Fv1%2Fbackup%2Frun`, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 120000, // 2 minute timeout for backup operations
      })
      .then((runResponse) => {
        logger.info('WordPress backup run API call succeeded via process-update webhook', {
          processId,
          siteUrl,
          status: runResponse.status,
          statusText: runResponse.statusText,
        });
      })
      .catch((runError) => {
        // Log error but don't fail the webhook response since backup may still proceed
        logger.warn(
          'WordPress backup run API call failed via process-update webhook, but backup may still be processing',
          {
            error: runError.message,
            status: runError.response?.status,
            data: runError.response?.data,
            process_id: processId,
            siteUrl: siteUrl,
          }
        );
      });

    // Return successful response immediately (don't wait for WordPress API call)
    return res.status(200).json({
      success: true,
      message: 'Process update webhook received and run request initiated',
      data: {
        processId: processId,
        status: status,
        backupId: backup.id,
        siteName: backup.site.name,
        siteUrl: siteUrl,
        runInitiated: true,
      },
    });
  } catch (error) {
    logger.error('Error processing process-update webhook', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processId: req.body.processId,
    });

    return res.status(500).json({
      success: false,
      message: 'Error processing process update webhook',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Test endpoint to simulate webhook calls (for testing purposes)
router.post('/webhook/test', async (req: Request, res: Response) => {
  try {
    // This is just for testing the webhook functionality
    const testData = {
      processId: req.body.processId || 'test-process-123',
    };

    logger.info('Test webhook called with data:', testData);

    return res.status(200).json({
      success: true,
      message: 'Test webhook received successfully',
      received: testData,
      webhookUrl: '/api/backup/webhook/status-update',
      instructions:
        'The webhook only needs processId in the JSON payload. It will automatically check the WordPress API to get the current status.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Test webhook error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
