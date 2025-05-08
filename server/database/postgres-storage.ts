/**
 * PostgreSQL Storage Implementation
 * 
 * This module provides a PostgreSQL implementation of the storage interface
 * using Drizzle ORM for database operations.
 */
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq, and, desc, asc, isNull, sql } from "drizzle-orm";

import * as schema from "../../shared/schema";
import { 
  users, sites, storageProviders, backupSchedules, backups, feedback,
  type User, type InsertUser, 
  type Site, type InsertSite,
  type StorageProvider, type InsertStorageProvider,
  type BackupSchedule, type InsertBackupSchedule,
  type Backup, type InsertBackup,
  type Feedback, type InsertFeedback
} from "../../shared/schema";
import { IStorage } from "../storage";
import logger from "../utils/logger";

/**
 * PostgreSQL implementation of the storage interface
 */
export class PostgresStorage implements IStorage {
  private db: PostgresJsDatabase<any>;
  
  constructor(db: PostgresJsDatabase<any>) {
    this.db = db;
  }
  
  // Database operations
  async isDatabaseConnected(): Promise<boolean> {
    try {
      // Try to execute a simple query to check connection
      await this.db.execute(sql`SELECT 1`);
      return true;
    } catch (error) {
      logger.error("Database connection check failed", { error });
      return false;
    }
  }
  
  async getDatabaseStats(): Promise<{
    tables: number;
    size: number | null;
    type: string;
    version: string | null;
  }> {
    try {
      // Get database version
      const versionResult = await this.db.execute(sql`SELECT version()`);
      const version = versionResult[0]?.version || null;
      
      // Count tables in the database
      const tablesResult = await this.db.execute(sql`
        SELECT count(*) as table_count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      const tableCount = parseInt(tablesResult[0]?.table_count || '0', 10);
      
      // Get approximate database size
      // Note: This requires permissions on the database
      let size: number | null = null;
      try {
        const sizeResult = await this.db.execute(sql`
          SELECT pg_database_size(current_database()) as size
        `);
        size = parseInt(sizeResult[0]?.size || '0', 10);
      } catch (e) {
        logger.warn("Unable to get database size", { error: e });
      }
      
      return {
        tables: tableCount,
        size,
        type: "PostgreSQL",
        version
      };
    } catch (error) {
      logger.error("Error getting database stats", { error });
      return {
        tables: 0,
        size: null,
        type: "PostgreSQL",
        version: null
      };
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    try {
      const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
      return result[0];
    } catch (error) {
      logger.error("Error retrieving user by ID", { error, userId: id });
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
      return result[0];
    } catch (error) {
      logger.error("Error retrieving user by username", { error, username });
      throw error;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      const result = await this.db.insert(users).values(user).returning();
      return result[0];
    } catch (error) {
      logger.error("Error creating user", { error, username: user.username });
      throw error;
    }
  }

  // Site operations
  async getSite(id: number): Promise<Site | undefined> {
    try {
      const result = await this.db.select().from(sites).where(eq(sites.id, id)).limit(1);
      return result[0];
    } catch (error) {
      logger.error("Error retrieving site by ID", { error, siteId: id });
      throw error;
    }
  }

  async getSiteByUrl(url: string): Promise<Site | undefined> {
    try {
      const result = await this.db.select().from(sites).where(eq(sites.url, url)).limit(1);
      return result[0];
    } catch (error) {
      logger.error("Error retrieving site by URL", { error, url });
      throw error;
    }
  }

  async listSites(): Promise<Site[]> {
    try {
      return await this.db.select().from(sites).orderBy(asc(sites.name));
    } catch (error) {
      logger.error("Error listing sites", { error });
      throw error;
    }
  }

  async createSite(site: InsertSite): Promise<Site> {
    try {
      const result = await this.db.insert(sites).values(site).returning();
      return result[0];
    } catch (error) {
      logger.error("Error creating site", { error, siteName: site.name });
      throw error;
    }
  }

  async updateSite(id: number, site: Partial<InsertSite>): Promise<Site | undefined> {
    try {
      const result = await this.db.update(sites)
        .set(site)
        .where(eq(sites.id, id))
        .returning();
      
      return result[0];
    } catch (error) {
      logger.error("Error updating site", { error, siteId: id });
      throw error;
    }
  }

  async deleteSite(id: number): Promise<boolean> {
    try {
      const result = await this.db.delete(sites)
        .where(eq(sites.id, id))
        .returning({ id: sites.id });
      
      return result.length > 0;
    } catch (error) {
      logger.error("Error deleting site", { error, siteId: id });
      throw error;
    }
  }

  // Storage Provider operations
  async getStorageProvider(id: number): Promise<StorageProvider | undefined> {
    try {
      const result = await this.db.select().from(storageProviders).where(eq(storageProviders.id, id)).limit(1);
      return result[0];
    } catch (error) {
      logger.error("Error retrieving storage provider by ID", { error, providerId: id });
      throw error;
    }
  }

  async listStorageProviders(): Promise<StorageProvider[]> {
    try {
      return await this.db.select().from(storageProviders).orderBy(asc(storageProviders.name));
    } catch (error) {
      logger.error("Error listing storage providers", { error });
      throw error;
    }
  }

  async createStorageProvider(provider: InsertStorageProvider): Promise<StorageProvider> {
    try {
      const result = await this.db.insert(storageProviders).values(provider).returning();
      return result[0];
    } catch (error) {
      logger.error("Error creating storage provider", { error, providerName: provider.name });
      throw error;
    }
  }

  async updateStorageProvider(id: number, provider: Partial<InsertStorageProvider>): Promise<StorageProvider | undefined> {
    try {
      const result = await this.db.update(storageProviders)
        .set(provider)
        .where(eq(storageProviders.id, id))
        .returning();
      
      return result[0];
    } catch (error) {
      logger.error("Error updating storage provider", { error, providerId: id });
      throw error;
    }
  }

  async deleteStorageProvider(id: number): Promise<boolean> {
    try {
      const result = await this.db.delete(storageProviders)
        .where(eq(storageProviders.id, id))
        .returning({ id: storageProviders.id });
      
      return result.length > 0;
    } catch (error) {
      logger.error("Error deleting storage provider", { error, providerId: id });
      throw error;
    }
  }

  // Backup Schedule operations
  async getBackupSchedule(id: number): Promise<BackupSchedule | undefined> {
    try {
      const result = await this.db.select().from(backupSchedules).where(eq(backupSchedules.id, id)).limit(1);
      return result[0];
    } catch (error) {
      logger.error("Error retrieving backup schedule by ID", { error, scheduleId: id });
      throw error;
    }
  }

  async listBackupSchedules(): Promise<BackupSchedule[]> {
    try {
      return await this.db.select().from(backupSchedules).orderBy(asc(backupSchedules.nextRun));
    } catch (error) {
      logger.error("Error listing backup schedules", { error });
      throw error;
    }
  }

  async listBackupSchedulesBySiteId(siteId: number): Promise<BackupSchedule[]> {
    try {
      return await this.db.select()
        .from(backupSchedules)
        .where(eq(backupSchedules.siteId, siteId))
        .orderBy(asc(backupSchedules.nextRun));
    } catch (error) {
      logger.error("Error listing backup schedules by site ID", { error, siteId });
      throw error;
    }
  }

  async createBackupSchedule(schedule: InsertBackupSchedule): Promise<BackupSchedule> {
    try {
      // Calculate next run date
      const now = new Date();
      const nextRun = new Date(now);
      nextRun.setHours(schedule.hourOfDay);
      nextRun.setMinutes(schedule.minuteOfHour || 0);
      nextRun.setSeconds(0);
      nextRun.setMilliseconds(0);
      
      if (nextRun <= now) {
        // If the scheduled time for today has already passed, schedule for tomorrow
        nextRun.setDate(nextRun.getDate() + 1);
      }
      
      // For weekly schedules, adjust to the next occurrence of the specified day
      if (schedule.frequency === 'weekly' && schedule.dayOfWeek !== null && schedule.dayOfWeek !== undefined) {
        while (nextRun.getDay() !== schedule.dayOfWeek) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
      }

      const insertData = {
        ...schedule,
        lastRun: null as null  // Explicitly typed as null
      };

      const result = await this.db.insert(backupSchedules)
        .values(insertData)
        .returning();
        
      return result[0];
    } catch (error) {
      logger.error("Error creating backup schedule", { error, siteId: schedule.siteId });
      throw error;
    }
  }

  async updateBackupSchedule(id: number, schedule: Partial<InsertBackupSchedule>): Promise<BackupSchedule | undefined> {
    try {
      // If schedule timing is changed, recalculate next run
      if (schedule.hourOfDay !== undefined || schedule.minuteOfHour !== undefined || schedule.dayOfWeek !== undefined) {
        const currentSchedule = await this.getBackupSchedule(id);
        if (currentSchedule) {
          const hourOfDay = schedule.hourOfDay ?? currentSchedule.hourOfDay;
          const minuteOfHour = schedule.minuteOfHour ?? currentSchedule.minuteOfHour;
          const frequency = schedule.frequency ?? currentSchedule.frequency;
          const dayOfWeek = schedule.dayOfWeek ?? currentSchedule.dayOfWeek;
          
          const now = new Date();
          const nextRun = new Date(now);
          nextRun.setHours(hourOfDay);
          nextRun.setMinutes(minuteOfHour);
          nextRun.setSeconds(0);
          nextRun.setMilliseconds(0);
          
          if (nextRun <= now) {
            // If the scheduled time for today has already passed, schedule for tomorrow
            nextRun.setDate(nextRun.getDate() + 1);
          }
          
          // For weekly schedules, adjust to the next occurrence of the specified day
          if (frequency === 'weekly' && dayOfWeek !== null && dayOfWeek !== undefined) {
            while (nextRun.getDay() !== dayOfWeek) {
              nextRun.setDate(nextRun.getDate() + 1);
            }
          }
          
          // Instead of adding nextRun to schedule object, we'll set it directly in the update query
        }
      }

      // Update the schedule
      const result = await this.db.update(backupSchedules)
        .set(schedule)
        .where(eq(backupSchedules.id, id))
        .returning();
      
      return result[0];
    } catch (error) {
      logger.error("Error updating backup schedule", { error, scheduleId: id });
      throw error;
    }
  }

  async deleteBackupSchedule(id: number): Promise<boolean> {
    try {
      const result = await this.db.delete(backupSchedules)
        .where(eq(backupSchedules.id, id))
        .returning({ id: backupSchedules.id });
      
      return result.length > 0;
    } catch (error) {
      logger.error("Error deleting backup schedule", { error, scheduleId: id });
      throw error;
    }
  }

  // Backup operations
  async getBackup(id: number): Promise<Backup | undefined> {
    try {
      const result = await this.db.select().from(backups).where(eq(backups.id, id)).limit(1);
      return result[0];
    } catch (error) {
      logger.error("Error retrieving backup by ID", { error, backupId: id });
      throw error;
    }
  }

  async listBackups(limit: number = 100): Promise<Backup[]> {
    try {
      return await this.db.select()
        .from(backups)
        .orderBy(desc(backups.startedAt))
        .limit(limit);
    } catch (error) {
      logger.error("Error listing backups", { error });
      throw error;
    }
  }

  async listBackupsBySiteId(siteId: number, limit: number = 100): Promise<Backup[]> {
    try {
      return await this.db.select()
        .from(backups)
        .where(eq(backups.siteId, siteId))
        .orderBy(desc(backups.startedAt))
        .limit(limit);
    } catch (error) {
      logger.error("Error listing backups by site ID", { error, siteId });
      throw error;
    }
  }

  async listRecentBackups(limit: number = 10): Promise<Backup[]> {
    try {
      return await this.db.select()
        .from(backups)
        .orderBy(desc(backups.startedAt))
        .limit(limit);
    } catch (error) {
      logger.error("Error listing recent backups", { error });
      throw error;
    }
  }

  async createBackup(backup: InsertBackup): Promise<Backup> {
    try {
      const result = await this.db.insert(backups).values(backup).returning();
      return result[0];
    } catch (error) {
      logger.error("Error creating backup", { error, siteId: backup.siteId });
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
      const updateData: Partial<Backup> = { status };
      
      if (size !== undefined) updateData.size = size;
      if (error !== undefined) updateData.error = error;
      if (fileCount !== undefined) updateData.fileCount = fileCount;
      if (changedFiles !== undefined) updateData.changedFiles = changedFiles;
      
      // If the status is "completed", set the completedAt timestamp
      if (status === "completed") {
        updateData.completedAt = new Date();
      }

      const result = await this.db.update(backups)
        .set(updateData)
        .where(eq(backups.id, id))
        .returning();
      
      return result[0];
    } catch (error) {
      logger.error("Error updating backup status", { error, backupId: id });
      throw error;
    }
  }

  async getLatestFullBackup(siteId: number): Promise<Backup | undefined> {
    try {
      const result = await this.db.select()
        .from(backups)
        .where(and(
          eq(backups.siteId, siteId),
          eq(backups.type, 'full'),
          eq(backups.status, 'completed')
        ))
        .orderBy(desc(backups.startedAt))
        .limit(1);
      
      return result[0];
    } catch (error) {
      logger.error("Error retrieving latest full backup", { error, siteId });
      throw error;
    }
  }

  async getBackupChain(backupId: number): Promise<Backup[]> {
    try {
      const rootBackup = await this.getBackup(backupId);
      if (!rootBackup) return [];
      
      // If the backup is a full backup, just return it
      if (rootBackup.type === 'full' || !rootBackup.parentBackupId) {
        return [rootBackup];
      }
      
      // Otherwise, recursively get the chain of backups
      const chain = [rootBackup];
      let currentParentId = rootBackup.parentBackupId;
      
      while (currentParentId) {
        const parentBackup = await this.getBackup(currentParentId);
        if (!parentBackup) break;
        
        chain.unshift(parentBackup);
        
        if (parentBackup.type === 'full' || !parentBackup.parentBackupId) {
          break;
        }
        
        currentParentId = parentBackup.parentBackupId;
      }
      
      return chain;
    } catch (error) {
      logger.error("Error retrieving backup chain", { error, backupId });
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
      // Get total number of sites
      const sitesCount = await this.db.select({ count: sql<number>`COUNT(*)` }).from(sites);
      const totalSites = sitesCount[0]?.count || 0;
      
      // Get total storage used
      const totalStorageResult = await this.db.select({ 
        total: sql<number>`COALESCE(SUM(${backups.size}), 0)` 
      })
      .from(backups)
      .where(eq(backups.status, 'completed'));
      const totalStorage = totalStorageResult[0]?.total || 0;
      
      // Get completed backups count
      const completedBackupsResult = await this.db.select({ 
        count: sql<number>`COUNT(*)` 
      })
      .from(backups)
      .where(eq(backups.status, 'completed'));
      const completedBackups = completedBackupsResult[0]?.count || 0;
      
      // Get failed backups count
      const failedBackupsResult = await this.db.select({ 
        count: sql<number>`COUNT(*)` 
      })
      .from(backups)
      .where(eq(backups.status, 'failed'));
      const failedBackups = failedBackupsResult[0]?.count || 0;
      
      return {
        totalSites,
        totalStorage,
        completedBackups,
        failedBackups
      };
    } catch (error) {
      logger.error("Error retrieving backup stats", { error });
      throw error;
    }
  }

  async getUpcomingBackups(limit: number = 5): Promise<(BackupSchedule & { site: Site })[]> {
    try {
      const schedules = await this.db.select({
        schedule: backupSchedules,
        site: sites
      })
      .from(backupSchedules)
      .innerJoin(sites, eq(backupSchedules.siteId, sites.id))
      .where(eq(backupSchedules.enabled, true))
      .orderBy(asc(backupSchedules.nextRun))
      .limit(limit);
      
      return schedules.map(({ schedule, site }) => ({
        ...schedule,
        site
      }));
    } catch (error) {
      logger.error("Error retrieving upcoming backups", { error });
      throw error;
    }
  }

  // Feedback operations
  async getFeedback(id: number): Promise<Feedback | undefined> {
    try {
      const result = await this.db.select().from(feedback).where(eq(feedback.id, id)).limit(1);
      return result[0];
    } catch (error) {
      logger.error("Error retrieving feedback by ID", { error, feedbackId: id });
      throw error;
    }
  }

  async listFeedback(projectId?: string, limit: number = 100): Promise<Feedback[]> {
    try {
      if (projectId) {
        return await this.db.select()
          .from(feedback)
          .where(eq(feedback.projectId, projectId))
          .orderBy(desc(feedback.createdAt))
          .limit(limit);
      } else {
        return await this.db.select()
          .from(feedback)
          .orderBy(desc(feedback.createdAt))
          .limit(limit);
      }
    } catch (error) {
      logger.error("Error listing feedback", { error, projectId });
      throw error;
    }
  }

  async listFeedbackByPage(projectId: string, pagePath: string): Promise<Feedback[]> {
    try {
      return await this.db.select()
        .from(feedback)
        .where(and(
          eq(feedback.projectId, projectId),
          eq(feedback.pagePath, pagePath)
        ))
        .orderBy(desc(feedback.createdAt));
    } catch (error) {
      logger.error("Error listing feedback by page", { error, projectId, pagePath });
      throw error;
    }
  }

  async createFeedback(feedbackItem: InsertFeedback): Promise<Feedback> {
    try {
      const result = await this.db.insert(feedback).values(feedbackItem).returning();
      return result[0];
    } catch (error) {
      logger.error("Error creating feedback", { error, projectId: feedbackItem.projectId });
      throw error;
    }
  }

  async updateFeedback(id: number, feedbackItem: Partial<InsertFeedback>): Promise<Feedback | undefined> {
    try {
      const result = await this.db.update(feedback)
        .set(feedbackItem)
        .where(eq(feedback.id, id))
        .returning();
      
      return result[0];
    } catch (error) {
      logger.error("Error updating feedback", { error, feedbackId: id });
      throw error;
    }
  }

  async deleteFeedback(id: number): Promise<boolean> {
    try {
      const result = await this.db.delete(feedback)
        .where(eq(feedback.id, id))
        .returning({ id: feedback.id });
      
      return result.length > 0;
    } catch (error) {
      logger.error("Error deleting feedback", { error, feedbackId: id });
      throw error;
    }
  }

  async getFeedbackStats(projectId?: string): Promise<{
    total: number;
    open: number;
    inProgress: number;
    completed: number;
    byPriority: { low: number; medium: number; high: number };
  }> {
    try {
      // Using raw SQL queries through sql`` to avoid Drizzle TypeScript issues
      let projectFilter = '';
      const params: any[] = [];
      
      if (projectId) {
        projectFilter = 'WHERE project_id = $1';
        params.push(projectId);
      }
      
      // Get total count
      const totalResult = await this.db.execute(sql`
        SELECT COUNT(*) as count FROM feedback ${sql.raw(projectFilter)}
      `, params);
      const total = Number(totalResult[0]?.count || 0);
      
      // Get open count 
      const openResult = await this.db.execute(sql`
        SELECT COUNT(*) as count FROM feedback 
        WHERE status = 'open' ${projectId ? sql`AND project_id = ${projectId}` : sql``}
      `);
      const open = Number(openResult[0]?.count || 0);
      
      // Get in-progress count
      const inProgressResult = await this.db.execute(sql`
        SELECT COUNT(*) as count FROM feedback 
        WHERE status = 'in-progress' ${projectId ? sql`AND project_id = ${projectId}` : sql``}
      `);
      const inProgress = Number(inProgressResult[0]?.count || 0);
      
      // Get completed count
      const completedResult = await this.db.execute(sql`
        SELECT COUNT(*) as count FROM feedback 
        WHERE status = 'completed' ${projectId ? sql`AND project_id = ${projectId}` : sql``}
      `);
      const completed = Number(completedResult[0]?.count || 0);
      
      // Get priority counts
      const lowPriorityResult = await this.db.execute(sql`
        SELECT COUNT(*) as count FROM feedback 
        WHERE priority = 'low' ${projectId ? sql`AND project_id = ${projectId}` : sql``}
      `);
      const lowPriority = Number(lowPriorityResult[0]?.count || 0);
      
      const mediumPriorityResult = await this.db.execute(sql`
        SELECT COUNT(*) as count FROM feedback 
        WHERE priority = 'medium' ${projectId ? sql`AND project_id = ${projectId}` : sql``}
      `);
      const mediumPriority = Number(mediumPriorityResult[0]?.count || 0);
      
      const highPriorityResult = await this.db.execute(sql`
        SELECT COUNT(*) as count FROM feedback 
        WHERE priority = 'high' ${projectId ? sql`AND project_id = ${projectId}` : sql``}
      `);
      const highPriority = Number(highPriorityResult[0]?.count || 0);
      
      return {
        total,
        open,
        inProgress,
        completed,
        byPriority: {
          low: lowPriority,
          medium: mediumPriority,
          high: highPriority
        }
      };
    } catch (error) {
      logger.error("Error retrieving feedback stats", { error, projectId });
      throw error;
    }
  }
}