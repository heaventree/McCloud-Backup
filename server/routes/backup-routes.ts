/**
 * Backup API Routes
 *
 * This module defines the API routes for backup management and operations.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import { backupService } from '../services/backup-service';

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

export default router;
