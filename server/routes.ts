import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertSiteSchema, 
  insertStorageProviderSchema,
  insertBackupScheduleSchema,
  insertBackupSchema
} from "@shared/schema";
import { ZodError } from "zod";
import { authRouter } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register auth routes
  app.use('/api/auth', authRouter);
  
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
      const sites = await storage.listSites();
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

      const site = await storage.getSite(id);
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
      const site = await storage.createSite(siteData);
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
      const site = await storage.updateSite(id, siteData);
      
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

      const deleted = await storage.deleteSite(id);
      if (!deleted) {
        return res.status(404).json({ message: "Site not found" });
      }

      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete site" });
    }
  });

  // Storage Providers routes
  app.get("/api/storage-providers", async (_req, res) => {
    try {
      const providers = await storage.listStorageProviders();
      res.json(providers);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch storage providers" });
    }
  });

  app.get("/api/storage-providers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid storage provider ID" });
      }

      const provider = await storage.getStorageProvider(id);
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
      const providerData = insertStorageProviderSchema.parse(req.body);
      const provider = await storage.createStorageProvider(providerData);
      res.status(201).json(provider);
    } catch (err) {
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
      const provider = await storage.updateStorageProvider(id, providerData);
      
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

      const deleted = await storage.deleteStorageProvider(id);
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
      const schedules = await storage.listBackupSchedules();
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

      const schedule = await storage.getBackupSchedule(id);
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

      const schedules = await storage.listBackupSchedulesBySiteId(siteId);
      res.json(schedules);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch backup schedules" });
    }
  });

  app.post("/api/backup-schedules", async (req, res) => {
    try {
      const scheduleData = insertBackupScheduleSchema.parse(req.body);
      const schedule = await storage.createBackupSchedule(scheduleData);
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
      const schedule = await storage.updateBackupSchedule(id, scheduleData);
      
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

      const deleted = await storage.deleteBackupSchedule(id);
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
      const backups = await storage.listBackups();
      res.json(backups);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch backups" });
    }
  });

  app.get("/api/backups/recent", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const backups = await storage.listRecentBackups(limit);
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
      const backups = await storage.listBackupsBySiteId(siteId, limit);
      res.json(backups);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch backups" });
    }
  });

  app.post("/api/backups", async (req, res) => {
    try {
      const backupData = insertBackupSchema.parse(req.body);
      const backup = await storage.createBackup(backupData);
      res.status(201).json(backup);
    } catch (err) {
      handleZodError(err, res);
    }
  });
  
  // Incremental backup endpoints
  app.post("/api/backups/incremental", async (req, res) => {
    try {
      const { siteId, storageProviderId } = req.body;
      if (!siteId || !storageProviderId) {
        return res.status(400).json({ message: "siteId and storageProviderId are required" });
      }
      
      // First, get the latest full backup for the site
      const latestFullBackup = await storage.getLatestFullBackup(parseInt(siteId));
      
      if (!latestFullBackup) {
        return res.status(400).json({
          message: "No full backup found for this site. Please perform a full backup first."
        });
      }
      
      // Create an incremental backup with reference to the full backup
      const backup = await storage.createBackup({
        siteId: parseInt(siteId),
        storageProviderId: parseInt(storageProviderId),
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
      
      const backupChain = await storage.getBackupChain(id);
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

      const { status, size, error, fileCount, changedFiles } = req.body;
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }

      const backup = await storage.updateBackupStatus(
        id, 
        status, 
        size, 
        error, 
        fileCount,
        changedFiles
      );
      
      if (!backup) {
        return res.status(404).json({ message: "Backup not found" });
      }

      res.json(backup);
    } catch (err) {
      res.status(500).json({ message: "Failed to update backup status" });
    }
  });

  // Dashboard statistics
  app.get("/api/dashboard/stats", async (_req, res) => {
    try {
      const stats = await storage.getBackupStats();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Upcoming backups
  app.get("/api/dashboard/upcoming-backups", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      const upcomingBackups = await storage.getUpcomingBackups(limit);
      res.json(upcomingBackups);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch upcoming backups" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
