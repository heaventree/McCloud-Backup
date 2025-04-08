import { 
  users, type User, type InsertUser,
  sites, type Site, type InsertSite,
  storageProviders, type StorageProvider, type InsertStorageProvider,
  backupSchedules, type BackupSchedule, type InsertBackupSchedule,
  backups, type Backup, type InsertBackup,
  feedback, type Feedback, type InsertFeedback
} from "@shared/schema";

// Storage interface with CRUD operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Site operations
  getSite(id: number): Promise<Site | undefined>;
  getSiteByUrl(url: string): Promise<Site | undefined>;
  listSites(): Promise<Site[]>;
  createSite(site: InsertSite): Promise<Site>;
  updateSite(id: number, site: Partial<InsertSite>): Promise<Site | undefined>;
  deleteSite(id: number): Promise<boolean>;

  // Storage Provider operations
  getStorageProvider(id: number): Promise<StorageProvider | undefined>;
  listStorageProviders(): Promise<StorageProvider[]>;
  createStorageProvider(provider: InsertStorageProvider): Promise<StorageProvider>;
  updateStorageProvider(id: number, provider: Partial<InsertStorageProvider>): Promise<StorageProvider | undefined>;
  deleteStorageProvider(id: number): Promise<boolean>;

  // Backup Schedule operations
  getBackupSchedule(id: number): Promise<BackupSchedule | undefined>;
  listBackupSchedules(): Promise<BackupSchedule[]>;
  listBackupSchedulesBySiteId(siteId: number): Promise<BackupSchedule[]>;
  createBackupSchedule(schedule: InsertBackupSchedule): Promise<BackupSchedule>;
  updateBackupSchedule(id: number, schedule: Partial<InsertBackupSchedule>): Promise<BackupSchedule | undefined>;
  deleteBackupSchedule(id: number): Promise<boolean>;

  // Backup operations
  getBackup(id: number): Promise<Backup | undefined>;
  listBackups(limit?: number): Promise<Backup[]>;
  listBackupsBySiteId(siteId: number, limit?: number): Promise<Backup[]>;
  listRecentBackups(limit?: number): Promise<Backup[]>;
  createBackup(backup: InsertBackup): Promise<Backup>;
  updateBackupStatus(id: number, status: string, size?: number, error?: string, fileCount?: number, changedFiles?: number): Promise<Backup | undefined>;
  getLatestFullBackup(siteId: number): Promise<Backup | undefined>;
  getBackupChain(backupId: number): Promise<Backup[]>;
  getBackupStats(): Promise<{
    totalSites: number;
    totalStorage: number;
    completedBackups: number;
    failedBackups: number;
  }>;
  getUpcomingBackups(limit?: number): Promise<(BackupSchedule & { site: Site })[]>;

  // Feedback operations
  getFeedback(id: number): Promise<Feedback | undefined>;
  listFeedback(projectId?: string, limit?: number): Promise<Feedback[]>;
  listFeedbackByPage(projectId: string, pagePath: string): Promise<Feedback[]>;
  createFeedback(feedback: InsertFeedback): Promise<Feedback>;
  updateFeedback(id: number, feedback: Partial<InsertFeedback>): Promise<Feedback | undefined>;
  deleteFeedback(id: number): Promise<boolean>;
  getFeedbackStats(projectId?: string): Promise<{
    total: number;
    open: number;
    inProgress: number;
    completed: number;
    byPriority: { low: number; medium: number; high: number };
  }>;
}

export class MemStorage implements IStorage {
  private usersMap: Map<number, User>;
  private sitesMap: Map<number, Site>;
  private storageProvidersMap: Map<number, StorageProvider>;
  private backupSchedulesMap: Map<number, BackupSchedule>;
  private backupsMap: Map<number, Backup>;
  private feedbackMap: Map<number, Feedback>;

  private userId: number = 1;
  private siteId: number = 1;
  private storageProviderId: number = 1;
  private backupScheduleId: number = 1;
  private backupId: number = 1;
  private feedbackId: number = 1;

  constructor() {
    this.usersMap = new Map();
    this.sitesMap = new Map();
    this.storageProvidersMap = new Map();
    this.backupSchedulesMap = new Map();
    this.backupsMap = new Map();
    this.feedbackMap = new Map();

    // Add admin user
    this.createUser({
      username: "admin",
      password: "password" // In a real app, this would be hashed
    });

    // Initialize with some sample data
    (async () => {
      try {
        await this.initializeSampleData();
      } catch (error) {
        console.error("Error initializing sample data:", error);
      }
    })();
  }

  private async initializeSampleData() {
    try {
      // Create sample sites
      const site1 = await this.createSite({
        name: "Main Website",
        url: "example.com",
        apiKey: "site1_api_key"
      });

      const site2 = await this.createSite({
        name: "Blog",
        url: "blog.example.com",
        apiKey: "site2_api_key"
      });

      const site3 = await this.createSite({
        name: "Shop",
        url: "shop.example.com",
        apiKey: "site3_api_key"
      });

      // Create sample storage providers
      const provider1 = await this.createStorageProvider({
        name: "Google Drive",
        type: "google_drive",
        credentials: { token: "sample_token" },
        quota: 1099511627776 // 1 TB
      });

      const provider2 = await this.createStorageProvider({
        name: "Dropbox",
        type: "dropbox",
        credentials: { token: "sample_token" },
        quota: 536870912000 // 500 GB
      });

      const provider3 = await this.createStorageProvider({
        name: "Amazon S3",
        type: "s3",
        credentials: { 
          accessKey: "sample_access_key",
          secretKey: "sample_secret_key",
          bucket: "sample-bucket"
        },
        quota: 2199023255552 // 2 TB
      });
      
      const provider4 = await this.createStorageProvider({
        name: "Microsoft OneDrive",
        type: "onedrive",
        credentials: { 
          clientId: "sample_client_id",
          clientSecret: "sample_client_secret",
          token: "sample_token",
          refreshToken: "sample_refresh_token"
        },
        quota: 1073741824000 // 1 TB
      });

      // Create sample backup schedules
      await this.createBackupSchedule({
        siteId: site1.id,
        storageProviderId: provider1.id,
        frequency: "daily",
        hourOfDay: 18,
        minuteOfHour: 0,
        backupType: "full",
        enabled: true
      });

      await this.createBackupSchedule({
        siteId: site2.id,
        storageProviderId: provider2.id,
        frequency: "daily",
        hourOfDay: 22,
        minuteOfHour: 0,
        backupType: "incremental",
        fullBackupFrequency: 7,
        enabled: true
      });

      await this.createBackupSchedule({
        siteId: site3.id,
        storageProviderId: provider3.id,
        frequency: "daily",
        hourOfDay: 3,
        minuteOfHour: 0,
        backupType: "full",
        enabled: true
      });

      // Create sample backups
      const backup1 = await this.createBackup({
        siteId: site1.id,
        storageProviderId: provider1.id,
        status: "completed",
        size: 256901120, // 245 MB
        startedAt: new Date()
      });

      const backup2 = await this.createBackup({
        siteId: site2.id,
        storageProviderId: provider2.id,
        status: "failed",
        startedAt: new Date()
      });
      
      await this.updateBackupStatus(backup2.id, "failed", undefined, "Connection error");

      await this.createBackup({
        siteId: site3.id,
        storageProviderId: provider3.id,
        status: "completed",
        size: 1288490188, // 1.2 GB
        startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
      });
      
      // Create a sample backup for OneDrive
      await this.createBackup({
        siteId: site1.id,
        storageProviderId: provider4.id,
        status: "completed",
        size: 524288000, // 500 MB
        startedAt: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
      });

      // Create some sample feedback items
      await this.createFeedback({
        projectId: "default",
        pagePath: "/dashboard",
        x: 25.5,
        y: 45.2,
        comment: "The dashboard loads slowly on my mobile device",
        status: "open",
        priority: "medium"
      });

      await this.createFeedback({
        projectId: "default",
        pagePath: "/sites",
        x: 80.1,
        y: 35.8,
        comment: "I love the new site management interface!",
        status: "completed",
        priority: "low"
      });

      await this.createFeedback({
        projectId: "default",
        pagePath: "/settings",
        x: 65.3,
        y: 28.7,
        comment: "The storage provider setup is confusing. Can we add tooltips?",
        status: "in-progress",
        priority: "high"
      });
    } catch (error) {
      console.error("Error initializing sample data:", error);
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.usersMap.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.usersMap.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.userId++;
    const newUser: User = { ...user, id };
    this.usersMap.set(id, newUser);
    return newUser;
  }

  // Site operations
  async getSite(id: number): Promise<Site | undefined> {
    return this.sitesMap.get(id);
  }

  async getSiteByUrl(url: string): Promise<Site | undefined> {
    return Array.from(this.sitesMap.values()).find(
      (site) => site.url === url
    );
  }

  async listSites(): Promise<Site[]> {
    return Array.from(this.sitesMap.values());
  }

  async createSite(site: InsertSite): Promise<Site> {
    const id = this.siteId++;
    const newSite: Site = { 
      ...site, 
      id, 
      createdAt: new Date()
    };
    this.sitesMap.set(id, newSite);
    return newSite;
  }

  async updateSite(id: number, site: Partial<InsertSite>): Promise<Site | undefined> {
    const existingSite = this.sitesMap.get(id);
    if (!existingSite) return undefined;

    const updatedSite: Site = { ...existingSite, ...site };
    this.sitesMap.set(id, updatedSite);
    return updatedSite;
  }

  async deleteSite(id: number): Promise<boolean> {
    return this.sitesMap.delete(id);
  }

  // Storage Provider operations
  async getStorageProvider(id: number): Promise<StorageProvider | undefined> {
    return this.storageProvidersMap.get(id);
  }

  async listStorageProviders(): Promise<StorageProvider[]> {
    return Array.from(this.storageProvidersMap.values());
  }

  async createStorageProvider(provider: InsertStorageProvider): Promise<StorageProvider> {
    const id = this.storageProviderId++;
    const newProvider: StorageProvider = { 
      ...provider, 
      id, 
      quota: provider.quota || null,
      createdAt: new Date() 
    };
    this.storageProvidersMap.set(id, newProvider);
    return newProvider;
  }

  async updateStorageProvider(id: number, provider: Partial<InsertStorageProvider>): Promise<StorageProvider | undefined> {
    const existingProvider = this.storageProvidersMap.get(id);
    if (!existingProvider) return undefined;

    const updatedProvider: StorageProvider = { ...existingProvider, ...provider };
    this.storageProvidersMap.set(id, updatedProvider);
    return updatedProvider;
  }

  async deleteStorageProvider(id: number): Promise<boolean> {
    return this.storageProvidersMap.delete(id);
  }

  // Backup Schedule operations
  async getBackupSchedule(id: number): Promise<BackupSchedule | undefined> {
    return this.backupSchedulesMap.get(id);
  }

  async listBackupSchedules(): Promise<BackupSchedule[]> {
    return Array.from(this.backupSchedulesMap.values());
  }

  async listBackupSchedulesBySiteId(siteId: number): Promise<BackupSchedule[]> {
    return Array.from(this.backupSchedulesMap.values()).filter(
      (schedule) => schedule.siteId === siteId
    );
  }

  async createBackupSchedule(schedule: InsertBackupSchedule): Promise<BackupSchedule> {
    const id = this.backupScheduleId++;
    
    // Calculate next run
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setHours(schedule.hourOfDay);
    nextRun.setMinutes(schedule.minuteOfHour);
    nextRun.setSeconds(0);
    nextRun.setMilliseconds(0);
    
    if (nextRun <= now) {
      // If the scheduled time for today has already passed, schedule for tomorrow
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    const newSchedule: BackupSchedule = { 
      ...schedule, 
      id, 
      enabled: schedule.enabled ?? true,
      dayOfWeek: schedule.dayOfWeek || null,
      backupType: schedule.backupType || 'full',
      fullBackupFrequency: schedule.fullBackupFrequency || null,
      retentionCount: schedule.retentionCount || null,
      lastRun: null,
      nextRun,
      createdAt: new Date() 
    };
    
    this.backupSchedulesMap.set(id, newSchedule);
    return newSchedule;
  }

  async updateBackupSchedule(id: number, schedule: Partial<InsertBackupSchedule>): Promise<BackupSchedule | undefined> {
    const existingSchedule = this.backupSchedulesMap.get(id);
    if (!existingSchedule) return undefined;

    // Recalculate next run if schedule timing changed
    let nextRun = existingSchedule.nextRun;
    if (schedule.hourOfDay !== undefined || schedule.minuteOfHour !== undefined) {
      const hourOfDay = schedule.hourOfDay ?? existingSchedule.hourOfDay;
      const minuteOfHour = schedule.minuteOfHour ?? existingSchedule.minuteOfHour;
      
      const now = new Date();
      nextRun = new Date(now);
      nextRun.setHours(hourOfDay);
      nextRun.setMinutes(minuteOfHour);
      nextRun.setSeconds(0);
      nextRun.setMilliseconds(0);
      
      if (nextRun <= now) {
        // If the scheduled time for today has already passed, schedule for tomorrow
        nextRun.setDate(nextRun.getDate() + 1);
      }
    }

    const updatedSchedule: BackupSchedule = { 
      ...existingSchedule, 
      ...schedule,
      nextRun 
    };
    
    this.backupSchedulesMap.set(id, updatedSchedule);
    return updatedSchedule;
  }

  async deleteBackupSchedule(id: number): Promise<boolean> {
    return this.backupSchedulesMap.delete(id);
  }

  // Backup operations
  async getBackup(id: number): Promise<Backup | undefined> {
    return this.backupsMap.get(id);
  }

  async listBackups(limit: number = 100): Promise<Backup[]> {
    return Array.from(this.backupsMap.values())
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  }

  async listBackupsBySiteId(siteId: number, limit: number = 100): Promise<Backup[]> {
    return Array.from(this.backupsMap.values())
      .filter((backup) => backup.siteId === siteId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  }

  async listRecentBackups(limit: number = 10): Promise<Backup[]> {
    return this.listBackups(limit);
  }

  async createBackup(backup: InsertBackup): Promise<Backup> {
    const id = this.backupId++;
    
    // Initialize additional fields for incremental backups
    const newBackup: Backup = { 
      ...backup,
      id, 
      type: backup.type || 'full',
      parentBackupId: backup.parentBackupId || null,
      size: backup.size || null,
      fileCount: backup.fileCount || 0,
      changedFiles: backup.changedFiles || 0,
      startedAt: backup.startedAt || new Date(),
      completedAt: null,
      error: null
    };
    
    this.backupsMap.set(id, newBackup);
    return newBackup;
  }
  
  // Get the most recent successful full backup for a site (for incremental backup parent reference)
  async getLatestFullBackup(siteId: number): Promise<Backup | undefined> {
    const backups = Array.from(this.backupsMap.values())
      .filter(backup => 
        backup.siteId === siteId && 
        backup.status === 'completed' && 
        backup.type === 'full'
      )
      .sort((a, b) => 
        new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
      );
    
    return backups.length > 0 ? backups[0] : undefined;
  }
  
  // Get backup chain - returns the full backup and all incremental backups that depend on it
  async getBackupChain(backupId: number): Promise<Backup[]> {
    const backup = this.backupsMap.get(backupId);
    if (!backup) return [];
    
    // For full backups, find all incremental backups that have this as parent
    if (backup.type === 'full') {
      const incrementals = Array.from(this.backupsMap.values())
        .filter(b => b.parentBackupId === backupId)
        .sort((a, b) => 
          new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
        );
      
      return [backup, ...incrementals];
    }
    
    // For incremental backups, find the parent full backup and all related incrementals
    if (backup.type === 'incremental' && backup.parentBackupId) {
      return this.getBackupChain(backup.parentBackupId);
    }
    
    // Fallback - just return the requested backup
    return [backup];
  }

  async updateBackupStatus(
    id: number, 
    status: string, 
    size?: number, 
    error?: string, 
    fileCount?: number, 
    changedFiles?: number
  ): Promise<Backup | undefined> {
    const existingBackup = this.backupsMap.get(id);
    if (!existingBackup) return undefined;

    const completedAt = ['completed', 'failed'].includes(status) ? new Date() : existingBackup.completedAt;

    const updatedBackup: Backup = { 
      ...existingBackup, 
      status,
      ...(size !== undefined && { size }),
      ...(fileCount !== undefined && { fileCount }),
      ...(changedFiles !== undefined && { changedFiles }),
      ...(error !== undefined && { error }),
      completedAt
    };
    
    this.backupsMap.set(id, updatedBackup);
    return updatedBackup;
  }

  async getBackupStats(): Promise<{
    totalSites: number;
    totalStorage: number;
    completedBackups: number;
    failedBackups: number;
  }> {
    const backups = Array.from(this.backupsMap.values());
    
    const completedBackups = backups.filter(b => b.status === 'completed').length;
    const failedBackups = backups.filter(b => b.status === 'failed').length;
    
    let totalStorage = 0;
    backups.forEach(backup => {
      if (backup.size) {
        totalStorage += backup.size;
      }
    });

    return {
      totalSites: this.sitesMap.size,
      totalStorage,
      completedBackups,
      failedBackups
    };
  }

  async getUpcomingBackups(limit: number = 5): Promise<(BackupSchedule & { site: Site })[]> {
    const schedules = Array.from(this.backupSchedulesMap.values())
      .filter(schedule => schedule.enabled)
      .sort((a, b) => new Date(a.nextRun!).getTime() - new Date(b.nextRun!).getTime())
      .slice(0, limit);
    
    return schedules.map(schedule => {
      const site = this.sitesMap.get(schedule.siteId)!;
      return { ...schedule, site };
    });
  }

  // Feedback operations
  async getFeedback(id: number): Promise<Feedback | undefined> {
    return this.feedbackMap.get(id);
  }

  async listFeedback(projectId?: string, limit: number = 100): Promise<Feedback[]> {
    let feedbackItems = Array.from(this.feedbackMap.values());
    
    if (projectId) {
      feedbackItems = feedbackItems.filter(item => item.projectId === projectId);
    }
    
    return feedbackItems
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async listFeedbackByPage(projectId: string, pagePath: string): Promise<Feedback[]> {
    return Array.from(this.feedbackMap.values())
      .filter(item => item.projectId === projectId && item.pagePath === pagePath)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createFeedback(feedback: InsertFeedback): Promise<Feedback> {
    const id = this.feedbackId++;
    
    // Ensure required fields are set with defaults if missing
    const newFeedback: Feedback = {
      ...feedback,
      id,
      status: feedback.status || 'open',
      priority: feedback.priority || 'medium',
      submittedBy: feedback.submittedBy || null,
      screenshot: feedback.screenshot || null,
      elementPath: feedback.elementPath || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.feedbackMap.set(id, newFeedback);
    return newFeedback;
  }

  async updateFeedback(id: number, feedback: Partial<InsertFeedback>): Promise<Feedback | undefined> {
    const existingFeedback = this.feedbackMap.get(id);
    if (!existingFeedback) return undefined;

    const updatedFeedback: Feedback = {
      ...existingFeedback,
      ...feedback,
      updatedAt: new Date()
    };
    
    this.feedbackMap.set(id, updatedFeedback);
    return updatedFeedback;
  }

  async deleteFeedback(id: number): Promise<boolean> {
    return this.feedbackMap.delete(id);
  }

  async getFeedbackStats(projectId?: string): Promise<{
    total: number;
    open: number;
    inProgress: number;
    completed: number;
    byPriority: { low: number; medium: number; high: number };
  }> {
    let feedbackItems = Array.from(this.feedbackMap.values());
    
    if (projectId) {
      feedbackItems = feedbackItems.filter(item => item.projectId === projectId);
    }
    
    const open = feedbackItems.filter(item => item.status === 'open').length;
    const inProgress = feedbackItems.filter(item => item.status === 'in-progress').length;
    const completed = feedbackItems.filter(item => item.status === 'completed').length;
    
    const low = feedbackItems.filter(item => item.priority === 'low').length;
    const medium = feedbackItems.filter(item => item.priority === 'medium').length;
    const high = feedbackItems.filter(item => item.priority === 'high').length;
    
    return {
      total: feedbackItems.length,
      open,
      inProgress,
      completed,
      byPriority: { low, medium, high }
    };
  }
}

export const storage = new MemStorage();
