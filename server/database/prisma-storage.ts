import prisma from '../prisma';
import logger from '../utils/logger';
import type { 
  IStorage, 
  Backup, InsertBackup, 
  BackupSchedule, InsertBackupSchedule, 
  Feedback, InsertFeedback, 
  Site, InsertSite, 
  StorageProvider, InsertStorageProvider, 
  User, InsertUser
} from '../storage';

export class PrismaStorage implements IStorage {
  constructor() {
    logger.info('Using Prisma storage implementation');
  }

  // Site operations
  async getSite(id: number): Promise<Site | undefined> {
    try {
      const site = await prisma.site.findUnique({
        where: { id }
      });
      return site || undefined;
    } catch (error) {
      logger.error('Error getting site', { error });
      throw error;
    }
  }

  async getSiteByUrl(url: string): Promise<Site | undefined> {
    try {
      const site = await prisma.site.findFirst({
        where: { url }
      });
      return site || undefined;
    } catch (error) {
      logger.error('Error getting site by URL', { error });
      throw error;
    }
  }

  async listSites(): Promise<Site[]> {
    try {
      return await prisma.site.findMany({
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      logger.error('Error listing sites', { error });
      throw error;
    }
  }

  async createSite(site: InsertSite): Promise<Site> {
    try {
      return await prisma.site.create({
        data: site as any
      });
    } catch (error) {
      logger.error('Error creating site', { error });
      throw error;
    }
  }

  async updateSite(id: number, site: Partial<InsertSite>): Promise<Site | undefined> {
    try {
      return await prisma.site.update({
        where: { id },
        data: site as any
      });
    } catch (error) {
      logger.error('Error updating site', { error });
      throw error;
    }
  }

  async deleteSite(id: number): Promise<boolean> {
    try {
      // Delete related records first due to foreign key constraints
      await prisma.backup.deleteMany({ where: { siteId: id } });
      await prisma.feedback.deleteMany({ where: { siteId: id } });
      
      await prisma.site.delete({
        where: { id }
      });
      return true;
    } catch (error) {
      logger.error('Error deleting site', { error });
      return false;
    }
  }

  // Storage Provider operations
  async getStorageProvider(id: number): Promise<StorageProvider | undefined> {
    try {
      const provider = await prisma.storageProvider.findUnique({
        where: { id }
      });
      return provider || undefined;
    } catch (error) {
      logger.error('Error getting storage provider', { error });
      throw error;
    }
  }

  async listStorageProviders(): Promise<StorageProvider[]> {
    try {
      return await prisma.storageProvider.findMany({
        orderBy: { name: 'asc' }
      });
    } catch (error) {
      logger.error('Error listing storage providers', { error });
      throw error;
    }
  }

  async createStorageProvider(provider: InsertStorageProvider): Promise<StorageProvider> {
    try {
      logger.info('Creating storage provider:', { 
        name: provider.name, 
        type: provider.type,
        credentialsPresent: !!provider.credentials,
        credentialsType: provider.credentials ? typeof provider.credentials : 'undefined'
      });
      
      // The schema expects "credentials" as a jsonb, not "config"
      const data = {
        name: provider.name,
        type: provider.type,
        credentials: provider.credentials,
        quota: provider.quota,
        createdAt: new Date() // Ensure createdAt is set
      };
      
      logger.info('Saving storage provider to database with data structure:', {
        hasName: !!data.name,
        nameValue: data.name,
        hasType: !!data.type,
        typeValue: data.type,
        hasCredentials: !!data.credentials,
        credentialsType: typeof data.credentials,
        quotaValue: data.quota
      });
      
      const createdProvider = await prisma.storageProvider.create({
        data: data
      });
      
      logger.info('Storage provider created successfully:', { 
        id: createdProvider.id,
        name: createdProvider.name,
        type: createdProvider.type
      });
      
      return createdProvider;
    } catch (error) {
      const err = error as Error;
      logger.error('Error creating storage provider:', { 
        message: err.message,
        stack: err.stack 
      });
      throw error;
    }
  }

  async updateStorageProvider(id: number, provider: Partial<InsertStorageProvider>): Promise<StorageProvider | undefined> {
    try {
      // Prepare data - ensure we're working with credentials not config
      const data: any = {
        ...(provider.name !== undefined && { name: provider.name }),
        ...(provider.type !== undefined && { type: provider.type }),
        ...(provider.credentials !== undefined && { credentials: provider.credentials }),
        ...(provider.quota !== undefined && { quota: provider.quota })
      };
      
      logger.info(`Updating storage provider ${id}:`, {
        fieldCount: Object.keys(data).length,
        fields: Object.keys(data),
        hasCredentials: 'credentials' in data
      });
      
      const updatedProvider = await prisma.storageProvider.update({
        where: { id },
        data
      });
      
      logger.info(`Storage provider ${id} updated successfully:`, {
        id: updatedProvider.id, 
        name: updatedProvider.name
      });
      
      return updatedProvider;
    } catch (error) {
      const err = error as Error;
      logger.error(`Error updating storage provider ${id}:`, {
        message: err.message,
        stack: err.stack
      });
      throw error;
    }
  }

  async deleteStorageProvider(id: number): Promise<boolean> {
    try {
      await prisma.storageProvider.delete({
        where: { id }
      });
      return true;
    } catch (error) {
      logger.error('Error deleting storage provider', { error });
      return false;
    }
  }

  // Backup Schedule operations
  async getBackupSchedule(id: number): Promise<BackupSchedule | undefined> {
    try {
      // Backup schedules are not implemented in Prisma yet
      return undefined;
    } catch (error) {
      logger.error('Error getting backup schedule', { error });
      throw error;
    }
  }

  async listBackupSchedules(): Promise<BackupSchedule[]> {
    try {
      // Backup schedules are not implemented in Prisma yet
      return [];
    } catch (error) {
      logger.error('Error listing backup schedules', { error });
      throw error;
    }
  }

  async listBackupSchedulesBySiteId(siteId: number): Promise<BackupSchedule[]> {
    try {
      // Backup schedules are not implemented in Prisma yet
      return [];
    } catch (error) {
      logger.error('Error listing backup schedules by site ID', { error });
      throw error;
    }
  }

  async createBackupSchedule(schedule: InsertBackupSchedule): Promise<BackupSchedule> {
    try {
      // Backup schedules are not implemented in Prisma yet
      throw new Error('Backup schedules not implemented');
    } catch (error) {
      logger.error('Error creating backup schedule', { error });
      throw error;
    }
  }

  async updateBackupSchedule(id: number, schedule: Partial<InsertBackupSchedule>): Promise<BackupSchedule | undefined> {
    try {
      // Backup schedules are not implemented in Prisma yet
      return undefined;
    } catch (error) {
      logger.error('Error updating backup schedule', { error });
      throw error;
    }
  }

  async deleteBackupSchedule(id: number): Promise<boolean> {
    try {
      // Backup schedules are not implemented in Prisma yet
      return false;
    } catch (error) {
      logger.error('Error deleting backup schedule', { error });
      return false;
    }
  }

  // Backup operations
  async getBackup(id: number): Promise<Backup | undefined> {
    try {
      const backup = await prisma.backup.findUnique({
        where: { id },
        include: { site: true }
      });
      return backup as any || undefined;
    } catch (error) {
      logger.error('Error getting backup', { error });
      throw error;
    }
  }

  async listBackups(limit: number = 100): Promise<Backup[]> {
    try {
      const backups = await prisma.backup.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { site: true }
      });
      return backups as any[];
    } catch (error) {
      logger.error('Error listing backups', { error });
      throw error;
    }
  }

  async listBackupsBySiteId(siteId: number, limit: number = 100): Promise<Backup[]> {
    try {
      const backups = await prisma.backup.findMany({
        where: { siteId },
        take: limit,
        orderBy: { createdAt: 'desc' }
      });
      return backups as any[];
    } catch (error) {
      logger.error('Error listing backups by site ID', { error });
      throw error;
    }
  }

  async listRecentBackups(limit: number = 10): Promise<Backup[]> {
    return this.listBackups(limit);
  }

  async createBackup(backup: InsertBackup): Promise<Backup> {
    try {
      const result = await prisma.backup.create({
        data: backup as any,
        include: { site: true }
      });
      
      // Update site's last backup timestamp
      await prisma.site.update({
        where: { id: backup.siteId },
        data: { lastBackup: new Date() }
      });
      
      return result as any;
    } catch (error) {
      logger.error('Error creating backup', { error });
      throw error;
    }
  }

  async updateBackupStatus(
    id: number, 
    status: string, 
    size?: number, 
    error?: string, 
    fileCount?: number, 
    changedFiles?: number
  ): Promise<Backup | undefined> {
    try {
      const data: any = { status };
      
      if (size !== undefined) data.size = size;
      if (error !== undefined) data.error = error;
      if (fileCount !== undefined) data.fileCount = fileCount;
      if (changedFiles !== undefined) data.changedFiles = changedFiles;
      
      if (status === 'completed') {
        data.completedAt = new Date();
      }
      
      const backup = await prisma.backup.update({
        where: { id },
        data,
        include: { site: true }
      });
      
      return backup as any;
    } catch (error) {
      logger.error('Error updating backup status', { error });
      throw error;
    }
  }
  
  async getLatestFullBackup(siteId: number): Promise<Backup | undefined> {
    try {
      const backup = await prisma.backup.findFirst({
        where: {
          siteId,
          backupType: 'full',
          status: 'completed'
        },
        orderBy: { createdAt: 'desc' },
        include: { site: true }
      });
      
      return backup as any || undefined;
    } catch (error) {
      logger.error('Error getting latest full backup', { error });
      throw error;
    }
  }
  
  async getBackupChain(backupId: number): Promise<Backup[]> {
    try {
      // Find the initial backup
      const backup = await prisma.backup.findUnique({
        where: { id: backupId },
        include: { site: true }
      });
      
      if (!backup) return [];
      
      // For simplicity, just return all backups for the site
      const backups = await prisma.backup.findMany({
        where: { siteId: backup.siteId },
        orderBy: { createdAt: 'desc' },
        include: { site: true }
      });
      
      return backups as any[];
    } catch (error) {
      logger.error('Error getting backup chain', { error });
      throw error;
    }
  }
  
  async getBackupStats(): Promise<{
    totalSites: number;
    totalStorage: number;
    completedBackups: number;
    failedBackups: number;
  }> {
    try {
      const totalSites = await prisma.site.count();
      
      // Calculate total storage from completed backups
      const backups = await prisma.backup.findMany({
        where: { status: 'completed' },
        select: { filesize: true }
      });
      
      const totalStorage = backups.reduce((total, backup) => total + (backup.filesize || 0), 0);
      
      const completedBackups = await prisma.backup.count({
        where: { status: 'completed' }
      });
      
      const failedBackups = await prisma.backup.count({
        where: { status: 'failed' }
      });
      
      return {
        totalSites,
        totalStorage,
        completedBackups,
        failedBackups
      };
    } catch (error) {
      logger.error('Error getting backup stats', { error });
      throw error;
    }
  }
  
  async getUpcomingBackups(limit: number = 5): Promise<(BackupSchedule & { site: Site })[]> {
    try {
      // Backup schedules not implemented yet
      return [];
    } catch (error) {
      logger.error('Error getting upcoming backups', { error });
      throw error;
    }
  }

  // Feedback operations
  async getFeedback(id: number): Promise<Feedback | undefined> {
    try {
      const feedback = await prisma.feedback.findUnique({
        where: { id },
        include: { site: true }
      });
      return feedback as any || undefined;
    } catch (error) {
      logger.error('Error getting feedback', { error });
      throw error;
    }
  }

  async listFeedback(siteId?: number, limit: number = 100): Promise<Feedback[]> {
    try {
      const feedback = await prisma.feedback.findMany({
        where: siteId ? { siteId } : undefined,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { site: true }
      });
      return feedback as any[];
    } catch (error) {
      logger.error('Error listing feedback', { error });
      throw error;
    }
  }

  async listFeedbackByPage(siteId: number, pagePath: string): Promise<Feedback[]> {
    try {
      const feedback = await prisma.feedback.findMany({
        where: {
          siteId,
          pageUrl: pagePath
        },
        orderBy: { createdAt: 'desc' },
        include: { site: true }
      });
      return feedback as any[];
    } catch (error) {
      logger.error('Error listing feedback by page', { error });
      throw error;
    }
  }

  async createFeedback(feedback: InsertFeedback): Promise<Feedback> {
    try {
      const result = await prisma.feedback.create({
        data: feedback as any,
        include: { site: true }
      });
      return result as any;
    } catch (error) {
      logger.error('Error creating feedback', { error });
      throw error;
    }
  }

  async updateFeedback(id: number, feedback: Partial<InsertFeedback>): Promise<Feedback | undefined> {
    try {
      const result = await prisma.feedback.update({
        where: { id },
        data: feedback as any,
        include: { site: true }
      });
      return result as any;
    } catch (error) {
      logger.error('Error updating feedback', { error });
      throw error;
    }
  }

  async deleteFeedback(id: number): Promise<boolean> {
    try {
      await prisma.feedback.delete({
        where: { id }
      });
      return true;
    } catch (error) {
      logger.error('Error deleting feedback', { error });
      return false;
    }
  }

  async getFeedbackStats(siteId?: number): Promise<{
    total: number;
    open: number;
    inProgress: number;
    completed: number;
    byPriority: { low: number; medium: number; high: number };
  }> {
    try {
      // Get total feedback count
      const totalCount = await prisma.feedback.count({
        where: siteId ? { siteId } : undefined
      });
      
      // Get feedback by status
      const openCount = await prisma.feedback.count({
        where: {
          ...(siteId ? { siteId } : {}),
          status: 'open'
        }
      });
      
      // Since we don't have 'in-progress' in the database yet, handle it safely
      let inProgressCount = 0;
      try {
        inProgressCount = await prisma.feedback.count({
          where: {
            ...(siteId ? { siteId } : {}),
            status: 'in-progress'
          }
        });
      } catch (err) {
        // Ignore, we'll return 0 for in-progress
      }
      
      const completedCount = await prisma.feedback.count({
        where: {
          ...(siteId ? { siteId } : {}),
          status: 'completed'
        }
      });
      
      // We don't have priority in the database yet, use placeholder values
      const lowPriorityCount = 0;
      const mediumPriorityCount = 0;
      const highPriorityCount = 0;
      
      return {
        total: totalCount,
        open: openCount,
        inProgress: inProgressCount,
        completed: completedCount,
        byPriority: {
          low: lowPriorityCount,
          medium: mediumPriorityCount,
          high: highPriorityCount
        }
      };
    } catch (error) {
      logger.error('Error getting feedback stats', { error });
      throw error;
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    try {
      const user = await prisma.user.findUnique({
        where: { id }
      });
      return user || undefined;
    } catch (error) {
      logger.error('Error getting user', { error });
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const user = await prisma.user.findUnique({
        where: { username }
      });
      return user || undefined;
    } catch (error) {
      logger.error('Error getting user by username', { error });
      throw error;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      return await prisma.user.create({
        data: user as any
      });
    } catch (error) {
      logger.error('Error creating user', { error });
      throw error;
    }
  }
}