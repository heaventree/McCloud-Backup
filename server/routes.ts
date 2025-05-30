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
import logger from "./utils/logger";
import dropboxRoutes from "./routes/dropbox";
import { handleOAuthCallback, initiateOAuthFlow } from "./security/oauth";

// Use the default logger instance

export async function registerRoutes(app: Express): Promise<void> {
  // Initialize storage implementation
  let dbStorage: IStorage = storage; // Start with default storage
  
  try {
    // Try to create PostgreSQL storage implementation
    dbStorage = await createStorage();
    logger.info('Storage implementation initialized successfully');
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
      logger.info('Initiating Dropbox OAuth flow via direct route');
      
      // Check if credentials are available - simplified error handling without require
      const clientId = process.env.DROPBOX_CLIENT_ID;
      const clientSecret = process.env.DROPBOX_CLIENT_SECRET;
      const redirectUri = process.env.DROPBOX_REDIRECT_URI;
      
      // Enhanced logging for debugging
      logger.info('Dropbox OAuth environment check:', {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        hasRedirectUri: !!redirectUri,
        requestRedirect: req.query.redirect,
        envRedirectUri: redirectUri
      });
      
      // Check if credentials are available
      if (!clientId || !clientSecret) {
        throw new Error('Dropbox OAuth credentials missing');
      }
      
      // Call the initiateOAuthFlow function imported at the top of the file
      logger.info(`Starting OAuth flow for Dropbox with redirect: ${req.query.redirect || 'default'}`);
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
      logger.info('Handling Dropbox OAuth callback via direct route');
      const code = req.query.code;
      const state = req.query.state;
      const error = req.query.error;
      
      // Enhanced logging for debugging
      logger.info('Dropbox OAuth callback received:', {
        hasCode: !!code,
        codeLength: code ? code.toString().length : 0,
        hasState: !!state,
        hasError: !!error,
        errorMessage: error || 'none',
        allParams: req.query
      });
      
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
      logger.info('Processing Dropbox OAuth callback with handleOAuthCallback');
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
  logger.info('Backup provider routes registered');
  
  // Register Dropbox provider routes
  app.use('/api/dropbox', dropboxRoutes);
  logger.info('Dropbox provider routes registered');
  
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

      const siteData = insertSiteSchema.partial().parse(req.body);
      const site = await dbStorage.updateSite(id, siteData);
      
      if (!site) {
        return res.status(404).json({ message: "Site not found" });
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
      
      logger.info(`Saving OAuth tokens for ${provider} with name ${name}`);
      
      // Create storage provider with token data
      const providerData = {
        name: name,
        type: provider,
        config: JSON.stringify({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || null,
          expires_in: tokenData.expires_in || null,
          token_type: tokenData.token_type || 'bearer',
          expires_at: tokenData.expires_in ? Date.now() + (tokenData.expires_in * 1000) : null
        }),
        enabled: true
      };
      
      const newProvider = await dbStorage.createStorageProvider(providerData);
      
      logger.info(`Successfully created storage provider ${newProvider.id} for ${provider}`);
      
      res.status(201).json(newProvider);
    } catch (err) {
      logger.error('Failed to save OAuth tokens:', {
        error: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      });
      
      res.status(500).json({ message: "Failed to save OAuth tokens" });
    }
  });

  // Storage Providers routes
  app.get("/api/storage-providers", async (_req, res) => {
    try {
      // Log the database query attempt
      logger.info('Fetching storage providers from database');
      
      const providers = await dbStorage.listStorageProviders();
      
      // Log what we got back
      logger.info(`Retrieved ${providers.length} storage providers from database`);
      if (providers.length > 0) {
        logger.info('Storage provider types found:', 
          providers.map(p => ({ id: p.id, name: p.name, type: p.type })));
      }
      
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
      logger.info('Received request to create storage provider:', {
        body: {
          name: req.body.name,
          type: req.body.type,
          config: req.body.config ? {
            configType: typeof req.body.config,
            configKeys: typeof req.body.config === 'object' ? 
              Object.keys(req.body.config) : [],
            configSample: typeof req.body.config === 'string' ? 
              req.body.config.substring(0, 50) + '...' : 
              JSON.stringify(req.body.config).substring(0, 50) + '...'
          } : 'missing',
          enabled: req.body.enabled
        },
        bodyJson: JSON.stringify(req.body).substring(0, 100) + '...'
      });
      
      // Validate body format
      const providerData = insertStorageProviderSchema.parse(req.body);
      
      logger.info('Parsed provider data successfully, creating in database');
      
      // Create in database
      const provider = await dbStorage.createStorageProvider(providerData);
      
      logger.info('Storage provider created successfully:', {
        id: provider.id,
        name: provider.name,
        type: provider.type
      });
      
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

      const providerData = insertStorageProviderSchema.partial().parse(req.body);
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
        type: "incremental",
        parentBackupId: latestFullBackup.id,
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
        validatedData.size, 
        validatedData.error, 
        validatedData.fileCount,
        validatedData.changedFiles
      );
      
      if (!backup) {
        return res.status(404).json({ message: "Backup not found" });
      }

      res.json(backup);
    } catch (err) {
      handleZodError(err, res);
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
