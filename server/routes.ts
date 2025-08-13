import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage, createStorage, IStorage } from "./storage";
import { 
  insertSiteSchema, 
  insertStorageProviderSchema,
  insertBackupScheduleSchema,
  insertBackupSchema,
  insertFeedbackSchema,
  incrementalBackupSchema,
  updateBackupStatusSchema
} from "@shared/schema";
import { ZodError } from "zod";
import { authRouter } from "./auth";
import path from "path";
import fs from "fs";
import backupRoutes from "./routes/backup-routes";
import notificationRoutes from "./routes/notification-routes";
import logger from "./utils/logger";
import dropboxRoutes from "./routes/dropbox";
import { handleOAuthCallback, initiateOAuthFlow } from "./security/oauth";
import { notificationService } from "./services/notification-service";

// Helper function to determine retention count based on backup frequency
function getRetentionCountByFrequency(frequency: string): number {
  switch (frequency) {
    case 'daily':
      return 30; // Keep 30 daily backups (1 month)
    case 'weekly':
      return 12; // Keep 12 weekly backups (3 months)
    case 'monthly':
      return 12; // Keep 12 monthly backups (1 year)
    case 'yearly':
      return 5; // Keep 5 yearly backups
    default:
      return 10; // Default retention
  }
}

// Use the default logger instance

export async function registerRoutes(app: Express): Promise<void> {
  // Initialize storage implementation
  let dbStorage: IStorage = storage; // Start with default storage
  
  try {
    // Try to create PostgreSQL storage implementation
    dbStorage = await createStorage();

  } catch (error) {
    logger.error('Failed to initialize database storage, using fallback in-memory storage', { error });
  }
  
  // API information route
  app.get('/api', (req, res) => {
    res.json({
      name: "WordPress Backup & Feedback API",
      version: "1.0.0",
      endpoints: {
        api: "/api",
        auth: "/api/auth",
        backup: "/api/backup",
        sites: "/api/sites",
        healthCheck: "/health"
      },
      status: "healthy",
      timestamp: new Date().toISOString()
    });
  });
  
  // Add direct routes for Dropbox OAuth that match registered redirect URIs
  // These should match what's registered in the Dropbox developer console
  
  // Authorization endpoint
  app.get('/auth/dropbox/authorize', (req, res) => {
    try {

      
      // Check if credentials are available - simplified error handling without require
      const clientId = process.env.DROPBOX_CLIENT_ID;
      const clientSecret = process.env.DROPBOX_CLIENT_SECRET;
      const redirectUri = process.env.DROPBOX_REDIRECT_URI;
      

      
      // Check if credentials are available
      if (!clientId || !clientSecret) {
        throw new Error('Dropbox OAuth credentials missing');
      }
      
      // Call the initiateOAuthFlow function imported at the top of the file
      initiateOAuthFlow(req, res, 'dropbox', req.query.redirect as string);
    } catch (error) {
      // More detailed error logging
      logger.error('Failed to initiate Dropbox OAuth flow', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      res.status(500).json({ error: 'Failed to initiate authentication' });
    }
  });
  
  // Callback endpoint
  app.get('/auth/dropbox/callback', async (req, res) => {
    try {
      const code = req.query.code;
      const state = req.query.state;
      const error = req.query.error;
      
      // Check if we have an error from Dropbox
      if (error) {
        logger.error(`Dropbox returned error: ${error}`);
        return res.redirect(`/auth/error?error=${encodeURIComponent(error.toString())}`);
      }
      
      // Check if we have the required parameters
      if (!code || !state) {
        logger.error('Missing code or state in Dropbox callback');
        return res.redirect('/auth/error?error=missing_parameters');
      }
      
      // No encryption key required - tokens are stored as plain text
      
      // Handle the callback with the function imported at the top of the file
      await handleOAuthCallback(req, res);
    } catch (error) {
      logger.error('Failed to handle Dropbox OAuth callback', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Send to error page with details instead of just JSON response
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return res.redirect(`/auth/error?error=${encodeURIComponent(errorMsg)}`);
    }
  });

  // Register auth routes
  app.use('/api/auth', authRouter);
  
  // Register backup provider routes
  app.use('/api/backup', backupRoutes);
  app.use('/api/backups', backupRoutes); // Also register under 'backups' endpoint for frontend compatibility
  
  // Register Dropbox provider routes
  app.use('/api/dropbox', dropboxRoutes);
  
  // Register notification routes
  app.use('/api/notifications', notificationRoutes);
  
  // Error handling middleware for Zod validation errors
  const handleZodError = (err: unknown, res: Response) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ 
        message: "Validation error", 
        errors: err.errors 
      });
    }
    
    return res.status(500).json({ 
      message: err instanceof Error ? err.message : "An unexpected error occurred" 
    });
  };

  // Sites routes
  app.get("/api/sites", async (_req, res) => {
    try {
      const sites = await dbStorage.listSites();
      res.json(sites);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch sites" });
    }
  });

  app.get("/api/sites/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid site ID" });
      }

      const site = await dbStorage.getSite(id);
      if (!site) {
        return res.status(404).json({ message: "Site not found" });
      }

      res.json(site);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch site" });
    }
  });

  app.post("/api/sites", async (req, res) => {
    try {
      const siteData = insertSiteSchema.parse(req.body);
      const site = await dbStorage.createSite(siteData);

      // Create backup schedule automatically if frequency is not 'ondemand'
      if (siteData.backupFrequency && siteData.backupFrequency !== 'ondemand') {
        try {
          // Create a basic backup schedule with default settings
          const scheduleData = {
            siteId: site.id,
            storageProviderId: siteData.storageProviderId || 1, // Use selected storage provider or fallback to first
            frequency: siteData.backupFrequency,
            dayOfWeek: siteData.backupFrequency === 'weekly' ? 0 : undefined, // Sunday for weekly
            hourOfDay: 2, // 2 AM default
            minuteOfHour: 0,
            backupType: 'full',
            retentionCount: getRetentionCountByFrequency(siteData.backupFrequency),
            enabled: true,
          };

          await dbStorage.createBackupSchedule(scheduleData);
        } catch (scheduleError) {
          logger.warn(`Failed to create backup schedule for site ${site.name}:`, scheduleError);
          // Continue without failing the site creation
        }
      }

      res.status(201).json(site);
    } catch (err) {
      handleZodError(err, res);
    }
  });

  app.put("/api/sites/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid site ID" });
      }

      // Get the current site data to compare changes
      const currentSite = await dbStorage.getSite(id);
      if (!currentSite) {
        return res.status(404).json({ message: "Site not found" });
      }

      const siteData = insertSiteSchema.partial().parse(req.body);
      const site = await dbStorage.updateSite(id, siteData);
      
      if (!site) {
        return res.status(404).json({ message: "Site not found" });
      }

      // Check for changes in backup settings and create notification if needed
      try {
        const changes: any = {};
        let hasChanges = false;
        
        if (siteData.backupFrequency && siteData.backupFrequency !== currentSite.backupFrequency) {
          changes.backupFrequency = {
            old: currentSite.backupFrequency,
            new: siteData.backupFrequency
          };
          hasChanges = true;
        }
        
        if (siteData.backupMode && siteData.backupMode !== currentSite.backupMode) {
          changes.backupMode = {
            old: currentSite.backupMode,
            new: siteData.backupMode
          };
          hasChanges = true;
        }
        
        if (siteData.storageProviderId !== undefined && siteData.storageProviderId !== currentSite.storageProviderId) {
          // Get storage provider names for better notification messages
          let oldProviderName = null;
          let newProviderName = null;
          
          if (currentSite.storageProviderId) {
            const oldProvider = await dbStorage.getStorageProvider(currentSite.storageProviderId);
            oldProviderName = oldProvider ? `${oldProvider.name} (${oldProvider.type})` : `Provider ${currentSite.storageProviderId}`;
          }
          
          if (siteData.storageProviderId) {
            const newProvider = await dbStorage.getStorageProvider(siteData.storageProviderId);
            newProviderName = newProvider ? `${newProvider.name} (${newProvider.type})` : `Provider ${siteData.storageProviderId}`;
          }
          
          changes.storageProvider = {
            old: oldProviderName,
            new: newProviderName
          };
          hasChanges = true;
        }
        
        if (hasChanges) {
          await notificationService.createSiteSettingsChangeNotification(
            id,
            site.name,
            changes
          );
        }
      } catch (notificationError) {
        logger.error('Failed to create site settings change notification', notificationError);
        // Don't fail the site update if notification creation fails
      }

      res.json(site);
    } catch (err) {
      handleZodError(err, res);
    }
  });

  app.delete("/api/sites/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid site ID" });
      }

      const deleted = await dbStorage.deleteSite(id);
      if (!deleted) {
        return res.status(404).json({ message: "Site not found" });
      }

      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete site" });
    }
  });

  // Direct OAuth token to storage provider API route
  app.post("/api/oauth-tokens/save", async (req, res) => {
    try {
      const { provider, name, tokenData } = req.body;
      
      if (!provider || !name || !tokenData || !tokenData.access_token) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      

      
      // Calculate expires_at timestamp if expires_in is provided
      const expiresAt = tokenData.expires_in ? Date.now() + (tokenData.expires_in * 1000) : null;
      
      // Create storage provider with token data
      const providerData = {
        name: name,
        type: provider,
        config: JSON.stringify({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || null,
          expires_in: tokenData.expires_in || null,
          token_type: tokenData.token_type || 'bearer',
          expires_at: expiresAt
        }),
        enabled: true
      };


      
      const newProvider = await dbStorage.createStorageProvider(providerData);
      
      res.status(201).json(newProvider);
    } catch (err) {
      logger.error('Failed to save OAuth tokens:', {
        error: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      });
      
      res.status(500).json({ message: "Failed to save OAuth tokens" });
    }
  });

  // Test endpoint for token refresh functionality
  app.post("/api/test-token-refresh/:providerId", async (req, res) => {
    try {
      const providerId = parseInt(req.params.providerId);
      if (isNaN(providerId)) {
        return res.status(400).json({ message: "Invalid provider ID" });
      }


      
      const tokenResult = await import('./TokenRefreshManager').then(m => 
        m.tokenRefreshManager.getValidAccessToken(providerId)
      );
      
      if (tokenResult.success) {
        res.json({
          success: true,
          message: "Token refresh test successful",
          hasValidToken: true
        });
      } else {
        res.status(400).json({
          success: false,
          message: tokenResult.error || "Token refresh failed",
          hasValidToken: false
        });
      }
    } catch (error) {
      logger.error('Token refresh test error:', error);
      res.status(500).json({ 
        success: false,
        message: "Internal server error during token refresh test" 
      });
    }
  });

  // Storage Providers routes
  app.get("/api/storage-providers", async (_req, res) => {
    try {
      const providers = await dbStorage.listStorageProviders();
      
      res.json(providers);
    } catch (err) {
      const error = err as Error;
      logger.error('Failed to fetch storage providers', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({ message: "Failed to fetch storage providers" });
    }
  });

  app.get("/api/storage-providers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid storage provider ID" });
      }

      const provider = await dbStorage.getStorageProvider(id);
      if (!provider) {
        return res.status(404).json({ message: "Storage provider not found" });
      }

      res.json(provider);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch storage provider" });
    }
  });

  app.post("/api/storage-providers", async (req, res) => {
    try {

      
      // Transform the config field if it's an object to a JSON string
      const requestBody = { ...req.body };
      if (requestBody.config && typeof requestBody.config === 'object') {
        requestBody.config = JSON.stringify(requestBody.config);
      }
      
      // Validate body format
      const providerData = insertStorageProviderSchema.parse(requestBody);
      
      // Create in database
      const provider = await dbStorage.createStorageProvider(providerData);
      
      res.status(201).json(provider);
    } catch (err) {
      logger.error('Failed to create storage provider:', {
        error: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      });
      
      handleZodError(err, res);
    }
  });

  app.put("/api/storage-providers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid storage provider ID" });
      }

      // Transform the config field if it's an object to a JSON string
      const requestBody = { ...req.body };
      if (requestBody.config && typeof requestBody.config === 'object') {
        requestBody.config = JSON.stringify(requestBody.config);

      }

      const providerData = insertStorageProviderSchema.partial().parse(requestBody);
      const provider = await dbStorage.updateStorageProvider(id, providerData);
      
      if (!provider) {
        return res.status(404).json({ message: "Storage provider not found" });
      }

      res.json(provider);
    } catch (err) {
      handleZodError(err, res);
    }
  });

  app.delete("/api/storage-providers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid storage provider ID" });
      }

      const deleted = await dbStorage.deleteStorageProvider(id);
      if (!deleted) {
        return res.status(404).json({ message: "Storage provider not found" });
      }

      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete storage provider" });
    }
  });

  // Backup Schedules routes
  app.get("/api/backup-schedules", async (_req, res) => {
    try {
      const schedules = await dbStorage.listBackupSchedules();
      res.json(schedules);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch backup schedules" });
    }
  });

  app.get("/api/backup-schedules/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid backup schedule ID" });
      }

      const schedule = await dbStorage.getBackupSchedule(id);
      if (!schedule) {
        return res.status(404).json({ message: "Backup schedule not found" });
      }

      res.json(schedule);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch backup schedule" });
    }
  });

  app.get("/api/sites/:siteId/backup-schedules", async (req, res) => {
    try {
      const siteId = parseInt(req.params.siteId);
      if (isNaN(siteId)) {
        return res.status(400).json({ message: "Invalid site ID" });
      }

      const schedules = await dbStorage.listBackupSchedulesBySiteId(siteId);
      res.json(schedules);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch backup schedules" });
    }
  });

  app.post("/api/backup-schedules", async (req, res) => {
    try {
      const scheduleData = insertBackupScheduleSchema.parse(req.body);
      const schedule = await dbStorage.createBackupSchedule(scheduleData);
      res.status(201).json(schedule);
    } catch (err) {
      handleZodError(err, res);
    }
  });

  app.put("/api/backup-schedules/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid backup schedule ID" });
      }

      const scheduleData = insertBackupScheduleSchema.partial().parse(req.body);
      const schedule = await dbStorage.updateBackupSchedule(id, scheduleData);
      
      if (!schedule) {
        return res.status(404).json({ message: "Backup schedule not found" });
      }

      res.json(schedule);
    } catch (err) {
      handleZodError(err, res);
    }
  });

  app.delete("/api/backup-schedules/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid backup schedule ID" });
      }

      const deleted = await dbStorage.deleteBackupSchedule(id);
      if (!deleted) {
        return res.status(404).json({ message: "Backup schedule not found" });
      }

      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete backup schedule" });
    }
  });

  // Backups routes
  app.get("/api/backups", async (_req, res) => {
    try {
      const backups = await dbStorage.listBackups();
      res.json(backups);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch backups" });
    }
  });

  app.get("/api/backups/recent", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const backups = await dbStorage.listRecentBackups(limit);
      res.json(backups);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch recent backups" });
    }
  });

  app.get("/api/sites/:siteId/backups", async (req, res) => {
    try {
      const siteId = parseInt(req.params.siteId);
      if (isNaN(siteId)) {
        return res.status(400).json({ message: "Invalid site ID" });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const backups = await dbStorage.listBackupsBySiteId(siteId, limit);
      res.json(backups);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch backups" });
    }
  });

  app.post("/api/backups", async (req, res) => {
    try {
      const backupData = insertBackupSchema.parse(req.body);
      const backup = await dbStorage.createBackup(backupData);
      res.status(201).json(backup);
    } catch (err) {
      handleZodError(err, res);
    }
  });
  
  // Incremental backup endpoints
  app.post("/api/backups/incremental", async (req, res) => {
    try {
      // Validate the request body using the schema
      const validatedData = incrementalBackupSchema.parse(req.body);
      
      // First, get the latest full backup for the site
      const latestFullBackup = await dbStorage.getLatestFullBackup(validatedData.siteId);
      
      if (!latestFullBackup) {
        return res.status(400).json({
          message: "No full backup found for this site. Please perform a full backup first."
        });
      }
      
      // Create an incremental backup with reference to the full backup
      const backup = await dbStorage.createBackup({
        siteId: validatedData.siteId,
        storageProviderId: validatedData.storageProviderId,
        status: "pending",
        backupType: "incremental",
        startedAt: new Date()
      });
      
      res.status(201).json(backup);
    } catch (err) {
      handleZodError(err, res);
    }
  });
  
  // Get backup chain (full backup + all incremental backups)
  app.get("/api/backups/:id/chain", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid backup ID" });
      }
      
      const backupChain = await dbStorage.getBackupChain(id);
      if (!backupChain.length) {
        return res.status(404).json({ message: "Backup not found" });
      }
      
      res.json(backupChain);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch backup chain" });
    }
  });

  app.put("/api/backups/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid backup ID" });
      }

      // Validate the request body using the schema
      const validatedData = updateBackupStatusSchema.parse(req.body);

      const backup = await dbStorage.updateBackupStatus(
        id, 
        validatedData.status, 
        validatedData.filesize, 
        validatedData.error
      );
      
      if (!backup) {
        return res.status(404).json({ message: "Backup not found" });
      }

      res.json(backup);
    } catch (err) {
      handleZodError(err, res);
    }
  });

  // Delete backup endpoint
  app.delete("/api/backups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Get backup details before deletion for cleanup
      const backup = await dbStorage.getBackup(id);
      if (!backup) {
        return res.status(404).json({ message: "Backup not found" });
      }

      // Delete backup record from database
      await dbStorage.deleteBackup(id);
      
      // TODO: Add logic here to also delete the actual backup file from storage provider
      // This would require implementing storage provider-specific deletion logic
      
      res.json({ message: "Backup deleted successfully" });
    } catch (err) {
      logger.error("Failed to delete backup", { backupId: req.params.id, error: err });
      res.status(500).json({ message: "Failed to delete backup" });
    }
  });

  // Retry backup endpoint
  app.post("/api/backups/:id/retry", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Get the original backup to retry
      const originalBackup = await dbStorage.getBackup(id);
      if (!originalBackup) {
        return res.status(404).json({ message: "Backup not found" });
      }

      // Create a new backup with the same configuration
      const newBackupData = {
        siteId: originalBackup.siteId,
        storageProviderId: originalBackup.storageProviderId || undefined,
        backupType: originalBackup.backupType,
        status: "pending",
        startedAt: new Date(),
      };

      const newBackup = await dbStorage.createBackup(newBackupData);
      
      // TODO: Add logic here to initiate the actual backup process
      // This would trigger the backup workflow on the WordPress site
      
      res.json({ 
        message: "Backup retry initiated successfully", 
        newBackupId: newBackup.id 
      });
    } catch (err) {
      logger.error("Failed to retry backup", { backupId: req.params.id, error: err });
      res.status(500).json({ message: "Failed to retry backup" });
    }
  });

  // Get backup file size endpoint
  app.get("/api/backups/:id/size", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Get backup details
      const backup = await dbStorage.getBackup(id);
      if (!backup) {
        return res.status(404).json({ message: "Backup not found" });
      }

      if (!backup.storagePath || !backup.storageProviderId) {
        return res.status(400).json({ message: "Backup file path or storage provider not found" });
      }

      // Get storage provider configuration
      const storageProvider = await dbStorage.getStorageProvider(backup.storageProviderId);
      if (!storageProvider) {
        return res.status(400).json({ message: "Storage provider not found" });
      }

      // Get file size from storage provider
      if (storageProvider.type === 'dropbox') {
        try {
          const { getDropboxFileMetadata } = await import('./providers/dropbox');
          const { tokenRefreshManager } = await import('./TokenRefreshManager');
          
          // Get valid access token using token refresh manager
          const tokenResult = await tokenRefreshManager.getValidAccessToken(backup.storageProviderId);
          
          if (!tokenResult.success) {
            logger.error(`Failed to get valid access token for provider ${backup.storageProviderId}: ${tokenResult.error}`);
            return res.status(401).json({ 
              message: 'Authentication failed. Please re-authenticate your storage provider.',
              error: tokenResult.error
            });
          }
          
          const validToken = tokenResult.access_token!;
          
          // Get file metadata from Dropbox
          const metadata = await getDropboxFileMetadata(validToken, backup.storagePath);
          
          res.json({
            size: metadata.size,
            filename: metadata.filename,
            path: backup.storagePath
          });
          
        } catch (error) {
          logger.error(`Failed to get backup file metadata from Dropbox: ${error instanceof Error ? error.message : 'Unknown error'}`, {
            backupId: id,
            storagePath: backup.storagePath,
            error: error instanceof Error ? error.stack : error
          });
          
          return res.status(500).json({ 
            message: `Failed to get backup file metadata from Dropbox: ${error instanceof Error ? error.message : 'Unknown error'}` 
          });
        }
      } else {
        // Other storage providers not yet implemented
        return res.status(501).json({ 
          message: `File size check not yet implemented for ${storageProvider.type} storage provider`,
          provider: storageProvider.type
        });
      }

    } catch (err) {
      logger.error("Failed to get backup file size", { backupId: req.params.id, error: err });
      res.status(500).json({ message: "Failed to get backup file size" });
    }
  });

  // Download backup endpoint
  app.get("/api/backups/:id/download", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Get backup details
      const backup = await dbStorage.getBackup(id);
      if (!backup) {
        return res.status(404).json({ message: "Backup not found" });
      }

      if (!backup.storagePath || !backup.storageProviderId) {
        return res.status(400).json({ message: "Backup file path or storage provider not found" });
      }

      // Get storage provider configuration
      const storageProvider = await dbStorage.getStorageProvider(backup.storageProviderId);
      if (!storageProvider) {
        return res.status(400).json({ message: "Storage provider not found" });
      }

      // Implement storage provider-specific download logic
      if (storageProvider.type === 'dropbox') {
        try {
          // Import the downloadDropboxFile function
          const { downloadDropboxFile, processDropboxToken } = await import('./providers/dropbox');
          const { tokenRefreshManager } = await import('./TokenRefreshManager');
          
          // Get valid access token using token refresh manager
          const tokenResult = await tokenRefreshManager.getValidAccessToken(backup.storageProviderId);
          
          if (!tokenResult.success) {
            logger.error(`Failed to get valid access token for provider ${backup.storageProviderId}: ${tokenResult.error}`);
            return res.status(401).json({ 
              message: 'Authentication failed. Please re-authenticate your storage provider.',
              error: tokenResult.error
            });
          }
          
          const validToken = tokenResult.access_token!;
          
          // Download the file from Dropbox
          const downloadResult = await downloadDropboxFile(validToken, backup.storagePath);
          
          // Set appropriate headers for file download
          res.setHeader('Content-Type', downloadResult.contentType || 'application/zip');
          res.setHeader('Content-Disposition', `attachment; filename="${downloadResult.filename}"`);
          res.setHeader('Content-Length', downloadResult.content.length.toString());
          
          // Send the file content
          res.send(downloadResult.content);
          
        } catch (error) {
          logger.error(`Failed to download backup from Dropbox: ${error instanceof Error ? error.message : 'Unknown error'}`, {
            backupId: id,
            storagePath: backup.storagePath,
            error: error instanceof Error ? error.stack : error
          });
          
          return res.status(500).json({ 
            message: `Failed to download backup from Dropbox: ${error instanceof Error ? error.message : 'Unknown error'}` 
          });
        }
      } else {
        // Other storage providers not yet implemented
        return res.status(501).json({ 
          message: `Download functionality not yet implemented for ${storageProvider.type} storage provider`,
          provider: storageProvider.type,
          path: backup.storagePath 
        });
      }

    } catch (err) {
      logger.error("Failed to download backup", { backupId: req.params.id, error: err });
      res.status(500).json({ message: "Failed to download backup" });
    }
  });

  // Export backup history as PDF
  app.get("/api/backups/export-pdf", async (req, res) => {
    try {
      // Import the PDF service
      const { pdfService } = await import('./services/pdf-service');
      
      // Get all data needed for the PDF - Note: using individual get methods for each item
      // TODO: Add getAllBackups, getAllSites, getAllStorageProviders methods to storage interface
      const backups: any[] = []; // Placeholder until proper storage methods are implemented
      const sites: any[] = [];
      const storageProviders: any[] = [];
      
      // Generate PDF
      const pdfBuffer = await pdfService.generateBackupHistoryPDF({
        backups,
        sites,
        storageProviders
      });
      
      // Set headers for PDF download
      const filename = `backup-history-${new Date().toISOString().split('T')[0]}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length.toString());
      
      // Send the PDF
      res.send(pdfBuffer);
      
    } catch (err) {
      logger.error("Failed to generate PDF export", { error: err });
      res.status(500).json({ message: "Failed to generate PDF export" });
    }
  });

  // Stream backup download with progress tracking
  app.get("/api/backups/:id/stream", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Get backup details
      const backup = await dbStorage.getBackup(id);
      if (!backup) {
        return res.status(404).json({ message: "Backup not found" });
      }

      if (!backup.storagePath || !backup.storageProviderId) {
        return res.status(400).json({ message: "Backup file path or storage provider not found" });
      }

      // Get storage provider configuration
      const storageProvider = await dbStorage.getStorageProvider(backup.storageProviderId);
      if (!storageProvider) {
        return res.status(400).json({ message: "Storage provider not found" });
      }

      // Handle streaming for different providers
      if (storageProvider.type === 'dropbox') {
        try {
          // Import Dropbox functions
          const { processDropboxToken } = await import('./providers/dropbox');
          const { tokenRefreshManager } = await import('./TokenRefreshManager');
          
          // Get valid access token
          const tokenResult = await tokenRefreshManager.getValidAccessToken(backup.storageProviderId);
          
          if (!tokenResult.success) {
            logger.error(`Failed to get valid access token for provider ${backup.storageProviderId}: ${tokenResult.error}`);
            return res.status(401).json({ 
              message: 'Authentication failed. Please re-authenticate your storage provider.',
              error: tokenResult.error
            });
          }
          
          const validToken = tokenResult.access_token!;
          const processedToken = processDropboxToken(validToken);
          
          // Import axios for streaming
          const axios = (await import('axios')).default;
          
          // Make streaming request to Dropbox
          const axiosInstance = axios.create({
            timeout: 300000, // 5 minutes for large files
          });
          
          const dropboxResponse = await axiosInstance.request({
            method: 'POST',
            url: 'https://content.dropboxapi.com/2/files/download',
            headers: {
              'Authorization': `Bearer ${processedToken}`,
              'Dropbox-API-Arg': JSON.stringify({
                path: backup.storagePath
              }),
            },
            responseType: 'stream',
            transformRequest: (data, headers) => {
              delete headers['Content-Type'];
              headers['Content-Type'] = 'application/octet-stream';
              return data;
            },
            data: null,
          });
          
          // Set response headers
          const filename = backup.filename || backup.storagePath.split('/').pop() || 'backup.zip';
          const contentType = dropboxResponse.headers['content-type'] || 'application/zip';
          const contentLength = dropboxResponse.headers['content-length'];
          
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          if (contentLength) {
            res.setHeader('Content-Length', contentLength);
          }
          
          // Enable CORS for progress tracking
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Expose-Headers', 'Content-Length');
          
          // Pipe the stream with progress tracking
          let downloadedBytes = 0;
          const totalBytes = contentLength ? parseInt(contentLength, 10) : null;
          
          dropboxResponse.data.on('data', (chunk: Buffer) => {
            downloadedBytes += chunk.length;
            if (totalBytes) {
              const progress = (downloadedBytes / totalBytes * 100).toFixed(1);
              logger.info(`Download progress for backup ${id}: ${progress}% (${downloadedBytes}/${totalBytes} bytes)`);
            }
          });
          
          dropboxResponse.data.on('error', (error: Error) => {
            logger.error(`Stream error for backup ${id}:`, error);
            if (!res.headersSent) {
              res.status(500).json({ message: 'Download stream error' });
            }
          });
          
          // Pipe the response
          dropboxResponse.data.pipe(res);
          
        } catch (error) {
          logger.error(`Failed to stream backup from Dropbox: ${error instanceof Error ? error.message : 'Unknown error'}`, {
            backupId: id,
            storagePath: backup.storagePath,
            error: error instanceof Error ? error.stack : error
          });
          
          if (!res.headersSent) {
            return res.status(500).json({ 
              message: `Failed to stream backup from Dropbox: ${error instanceof Error ? error.message : 'Unknown error'}` 
            });
          }
        }
      } else {
        // Other storage providers not yet implemented
        return res.status(501).json({ 
          message: `Streaming download not yet implemented for ${storageProvider.type} storage provider`,
          provider: storageProvider.type,
          path: backup.storagePath 
        });
      }

    } catch (err) {
      logger.error("Failed to stream backup download", { backupId: req.params.id, error: err });
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to stream backup download" });
      }
    }
  });

  // Dashboard statistics
  app.get("/api/dashboard/stats", async (_req, res) => {
    try {
      const stats = await dbStorage.getBackupStats();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });
  
  // Health Check route
  app.get("/api/sites/:id/health-check", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid site ID" });
      }
      
      const site = await dbStorage.getSite(id);
      if (!site) {
        return res.status(404).json({ message: "Site not found" });
      }
      
      // In a real implementation, this would call the WordPress plugin's health check API
      // For now, return simulated data that matches our HealthCheckResult interface
      const healthCheckResult = {
        status: "success",
        timestamp: new Date().toISOString(),
        overall_health: {
          score: 87,
          status: "good",
          components: {
            wordpress: { score: 90, weight: 15 },
            php: { score: 95, weight: 15 },
            database: { score: 85, weight: 15 },
            server: { score: 80, weight: 10 },
            plugins: { score: 75, weight: 15 },
            themes: { score: 95, weight: 5 },
            security: { score: 85, weight: 15 },
            performance: { score: 90, weight: 10 }
          }
        },
        wordpress: {
          version: "6.3.1",
          latest_version: "6.3.1",
          is_latest: true,
          updates: {
            core: [],
            plugins: [{ name: "Contact Form 7", slug: "contact-form-7" }],
            themes: []
          },
          constants: {
            WP_DEBUG: false,
            WP_DEBUG_LOG: false,
            WP_DEBUG_DISPLAY: false,
            WP_MEMORY_LIMIT: "256M",
            WP_MAX_MEMORY_LIMIT: "512M",
            DISALLOW_FILE_EDIT: true
          },
          file_permissions: {
            issues: []
          },
          multisite: false,
          health_score: 90,
          status: "excellent"
        },
        php: {
          version: "8.0.28",
          recommended_version: "8.0.0",
          is_supported: true,
          memory_limit: "256M",
          max_execution_time: "120",
          extensions: {
            mysql: false,
            mysqli: true,
            curl: true,
            gd: true,
            imagick: true,
            json: true,
            xml: true,
            mbstring: true,
            openssl: true,
            zip: true
          },
          health_score: 95,
          status: "excellent"
        },
        database: {
          version: "10.5.20-MariaDB",
          size: 52428800,
          size_formatted: "50 MB",
          tables_count: 12,
          prefix: "wp_",
          autoload_size: 524288,
          health_score: 85,
          status: "good"
        },
        server: {
          software: "Apache/2.4.56 (Unix) OpenSSL/1.1.1t PHP/8.0.28",
          php_sapi: "apache2handler",
          os: "Linux",
          ssl: true,
          host_info: {
            provider: "DigitalOcean"
          },
          time: new Date().toISOString(),
          directory_size: {
            wordpress: 209715200,
            "wp-content": 157286400,
            uploads: 104857600,
            plugins: 41943040,
            themes: 20971520
          },
          health_score: 80,
          status: "good"
        },
        plugins: {
          total: 12,
          active: 9,
          inactive: 3,
          updates_needed: 2,
          unoptimized: [
            {
              name: "WP Statistics",
              slug: "wp-statistics/wp-statistics.php",
              reason: "Statistics plugin with database overhead"
            }
          ],
          health_score: 75,
          status: "fair"
        },
        themes: {
          total: 3,
          active: {
            name: "Twenty Twenty-Three",
            version: "1.2",
            author: "WordPress.org"
          },
          updates_needed: 0,
          child_theme: false,
          health_score: 95,
          status: "excellent"
        },
        security: {
          file_editing: false,
          file_mods: true,
          ssl: true,
          db_prefix: false,
          users: {
            admin_user_exists: false,
            users_with_admin: 2
          },
          vulnerabilities: {
            total: 0,
            items: []
          },
          health_score: 85,
          status: "good"
        },
        performance: {
          transients: 135,
          post_revisions: 47,
          auto_drafts: 3,
          trash_posts: 8,
          spam_comments: 24,
          cron_jobs: [
            {
              hook: "wp_version_check",
              time: new Date().getTime() + 43200000,
              schedule: "twicedaily",
              interval: 43200
            },
            {
              hook: "wp_update_plugins",
              time: new Date().getTime() + 43200000,
              schedule: "twicedaily",
              interval: 43200
            }
          ],
          cache: {
            object_cache: false,
            page_cache: true
          },
          health_score: 90,
          status: "excellent"
        }
      };
      
      res.json(healthCheckResult);
    } catch (err) {
      console.error("Health check error:", err);
      res.status(500).json({ message: "Failed to perform health check" });
    }
  });

  // Upcoming backups
  app.get("/api/dashboard/upcoming-backups", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      const upcomingBackups = await dbStorage.getUpcomingBackups(limit);
      res.json(upcomingBackups);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch upcoming backups" });
    }
  });

  // Plugin download endpoints
  app.get("/api/plugins/wordpress", (req, res) => {
    try {
      // Adjust path for Replit environment - first try in the project root, then in the server directory
      let pluginPath = path.resolve(process.cwd(), "attached_assets/backupsheep.1.8.zip");
      
      if (!fs.existsSync(pluginPath)) {
        // Try in the server directory
        pluginPath = path.resolve(__dirname, "../attached_assets/backupsheep.1.8.zip");
      }
      
      if (!fs.existsSync(pluginPath)) {
        console.error("Plugin file not found at paths:", {
          rootPath: path.resolve(process.cwd(), "attached_assets/backupsheep.1.8.zip"),
          secondaryPath: path.resolve(__dirname, "../attached_assets/backupsheep.1.8.zip")
        });
        return res.status(404).json({ message: "WordPress plugin file not found" });
      }
      
      // Send as McCloud Backup plugin, even though the file is still backupsheep.zip
      res.setHeader('Content-Disposition', 'attachment; filename=mccloud-backup.1.8.zip');
      res.setHeader('Content-Type', 'application/zip');
      
      const fileStream = fs.createReadStream(pluginPath);
      fileStream.pipe(res);
    } catch (err) {
      console.error("Plugin download error:", err);
      res.status(500).json({ 
        message: "Failed to download plugin",
        error: err instanceof Error ? err.message : "Unknown error"
      });
    }
  });

  // Feedback routes
  app.get("/api/feedback", async (req, res) => {
    try {
      const projectId = req.query.projectId as string | undefined;
      // Convert projectId to number if present
      const projectIdNum = projectId ? parseInt(projectId, 10) : undefined;
      // Convert limit to number
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
      
      const feedbackItems = await dbStorage.listFeedback(projectIdNum, limit);
      res.json(feedbackItems);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch feedback items" });
    }
  });

  app.get("/api/feedback/stats", async (req, res) => {
    try {
      const projectId = req.query.projectId as string | undefined;
      // Convert projectId to number if present, otherwise pass undefined
      const projectIdNum = projectId ? parseInt(projectId, 10) : undefined;
      const stats = await dbStorage.getFeedbackStats(projectIdNum);
      res.json(stats);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch feedback stats" });
    }
  });

  app.get("/api/feedback/page", async (req, res) => {
    try {
      const { projectId, pagePath } = req.query;
      
      if (!projectId || !pagePath) {
        return res.status(400).json({ message: "projectId and pagePath are required" });
      }
      
      // Convert projectId from string to number
      const projectIdNum = parseInt(projectId as string, 10);
      
      const feedbackItems = await dbStorage.listFeedbackByPage(
        projectIdNum,
        pagePath as string
      );
      
      res.json(feedbackItems);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch feedback items for page" });
    }
  });

  app.get("/api/feedback/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid feedback ID" });
      }

      const feedback = await dbStorage.getFeedback(id);
      if (!feedback) {
        return res.status(404).json({ message: "Feedback not found" });
      }

      res.json(feedback);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  app.post("/api/feedback", async (req, res) => {
    try {
      const feedbackData = insertFeedbackSchema.parse(req.body);
      const feedback = await dbStorage.createFeedback(feedbackData);
      res.status(201).json(feedback);
    } catch (err) {
      handleZodError(err, res);
    }
  });

  app.put("/api/feedback/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid feedback ID" });
      }

      const feedbackData = insertFeedbackSchema.partial().parse(req.body);
      const feedback = await dbStorage.updateFeedback(id, feedbackData);
      
      if (!feedback) {
        return res.status(404).json({ message: "Feedback not found" });
      }

      res.json(feedback);
    } catch (err) {
      handleZodError(err, res);
    }
  });

  app.delete("/api/feedback/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid feedback ID" });
      }

      const deleted = await dbStorage.deleteFeedback(id);
      if (!deleted) {
        return res.status(404).json({ message: "Feedback not found" });
      }

      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete feedback" });
    }
  });

  // Serve the standalone feedback widget demo HTML
  app.get('/standalone.html', (req, res) => {
    const standalonePath = path.resolve(process.cwd(), 'client/src/components/feedback/standalone.html');
    res.sendFile(standalonePath);
  });
  
  // No longer creating server here - it's created in index.ts
}
