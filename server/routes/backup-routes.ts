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
import { pool } from '../db';
import { processDropboxToken } from '../providers/dropbox';

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
        message: 'Site ID is required' 
      });
    }
    
    if (!storageProviderId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Storage provider ID is required' 
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
    
    // Get the storage provider details
    const providerResult = await pool.query(
      'SELECT * FROM storage_providers WHERE id = $1',
      [storageProviderId]
    );
    
    if (providerResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Storage provider not found' 
      });
    }
    
    const provider = providerResult.rows[0];
    
    // Check if provider is Dropbox (currently only supporting Dropbox)
    if (provider.type !== 'dropbox') {
      return res.status(400).json({
        success: false,
        message: 'Only Dropbox providers are currently supported'
      });
    }
    
    // Parse the provider config to get token
    let parsedConfig;
    try {
      parsedConfig = JSON.parse(provider.config);
    } catch (e) {
      return res.status(500).json({
        success: false,
        message: 'Invalid provider configuration format'
      });
    }
    
    // Extract the token
    const token = parsedConfig.access_token || parsedConfig.token || '';
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'No valid token found for the storage provider'
      });
    }
    
    // Process the token to handle any HTML entity encoding
    const processedToken = processDropboxToken(token);
    
    logger.info('Making request to WordPress API to start backup');
    
    // Make the API call to start a WordPress backup
    const wordpressResponse = await axios.post(
      'https://heaventree2.com/index.php?rest_route=%2Fbacksheep%2Fv1%2Fbackup%2Fstart',
      {
        dropbox_token: processedToken
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Check the response
    if (wordpressResponse.status !== 200) {
      return res.status(500).json({
        success: false,
        message: `WordPress API returned error: ${wordpressResponse.status}`,
        data: wordpressResponse.data
      });
    }
    
    const wpResponseData = wordpressResponse.data;
    
    // Validate WordPress response
    if (wpResponseData.status !== "SUCCESS" || !wpResponseData.process_id) {
      return res.status(500).json({
        success: false,
        message: wpResponseData.message || 'Failed to start backup process',
        data: wpResponseData
      });
    }
    
    // Store the backup process in our database
    const now = new Date();
    const backupResult = await pool.query(
      `INSERT INTO backups (
        site_id, 
        storage_provider_id, 
        type, 
        status, 
        process_id, 
        metadata, 
        started_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        siteId,
        storageProviderId,
        'full',
        'in_progress',
        wpResponseData.process_id,
        JSON.stringify(wpResponseData),
        now
      ]
    );
    
    // Return success with the process ID and backup record
    return res.status(200).json({
      success: true,
      message: 'Backup process started successfully',
      processId: wpResponseData.process_id,
      backup: backupResult.rows[0]
    });
    
  } catch (error) {
    logger.error('Error starting backup', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return res.status(500).json({
      success: false,
      message: 'Error starting backup',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Endpoint to check backup status
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
    
    // Check the status with the WordPress API
    const statusResponse = await axios.post(
      'https://heaventree2.com/index.php?rest_route=%2Fbacksheep%2Fv1%2Fbackup%2Fstatus',
      null, // no body needed
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: `process_id=${processId}`
      }
    );
    
    // Update the backup record with the latest status
    const status = statusResponse.data.state || statusResponse.data.status;
    let dbStatus = 'in_progress';
    
    // Map WordPress status to our status
    if (status === 'COMPLETED' || statusResponse.data.status === 'SUCCESS' || 
        status === 'COMPLETED') {
      dbStatus = 'completed';
      
      // If completed, update the completion time
      await pool.query(
        'UPDATE backups SET status = $1, completed_at = $2, metadata = $3 WHERE process_id = $4',
        [dbStatus, new Date(), JSON.stringify(statusResponse.data), processId]
      );
    } else if (status === 'ERROR' || statusResponse.data.status === 'ERROR' || 
              statusResponse.data.error) {
      dbStatus = 'failed';
      
      // If failed, update with error details
      await pool.query(
        'UPDATE backups SET status = $1, error = $2, metadata = $3 WHERE process_id = $4',
        [
          dbStatus, 
          statusResponse.data.message || 'Backup process failed', 
          JSON.stringify(statusResponse.data), 
          processId
        ]
      );
    } else {
      // Still in progress, just update metadata
      await pool.query(
        'UPDATE backups SET metadata = $1 WHERE process_id = $2',
        [JSON.stringify(statusResponse.data), processId]
      );
    }
    
    // Return the status
    return res.status(200).json({
      success: true,
      status: dbStatus,
      wpStatus: status,
      data: statusResponse.data
    });
    
  } catch (error) {
    logger.error('Error checking backup status', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return res.status(500).json({
      success: false,
      message: 'Error checking backup status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
