import prisma from '../prisma';
import logger from '../utils/logger';
import { IStorage } from '../storage';

export class PrismaStorage implements IStorage {
  constructor() {
    logger.info('Using Prisma storage implementation');
  }

  // Site Management
  async getSites() {
    try {
      return await prisma.site.findMany({
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      logger.error('Error getting sites', { error });
      throw error;
    }
  }

  async getSite(id: number) {
    try {
      return await prisma.site.findUnique({
        where: { id }
      });
    } catch (error) {
      logger.error('Error getting site', { error });
      throw error;
    }
  }

  async addSite(siteData: any) {
    try {
      return await prisma.site.create({
        data: siteData
      });
    } catch (error) {
      logger.error('Error adding site', { error });
      throw error;
    }
  }

  async deleteSite(id: number) {
    try {
      // Delete related records first due to foreign key constraints
      await prisma.backup.deleteMany({ where: { siteId: id } });
      await prisma.feedback.deleteMany({ where: { siteId: id } });
      
      return await prisma.site.delete({
        where: { id }
      });
    } catch (error) {
      logger.error('Error deleting site', { error });
      throw error;
    }
  }

  async updateSite(id: number, siteData: any) {
    try {
      return await prisma.site.update({
        where: { id },
        data: siteData
      });
    } catch (error) {
      logger.error('Error updating site', { error });
      throw error;
    }
  }

  // Backup Management
  async getBackups() {
    try {
      return await prisma.backup.findMany({
        orderBy: { createdAt: 'desc' },
        include: { site: true }
      });
    } catch (error) {
      logger.error('Error getting backups', { error });
      throw error;
    }
  }

  async getBackupsBySite(siteId: number) {
    try {
      return await prisma.backup.findMany({
        where: { siteId },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      logger.error('Error getting backups by site', { error });
      throw error;
    }
  }

  async addBackup(backupData: any) {
    try {
      // Create the backup
      const backup = await prisma.backup.create({
        data: backupData
      });
      
      // Update the site's last backup timestamp
      await prisma.site.update({
        where: { id: backupData.siteId },
        data: { lastBackup: new Date() }
      });
      
      return backup;
    } catch (error) {
      logger.error('Error adding backup', { error });
      throw error;
    }
  }

  async getBackup(id: number) {
    try {
      return await prisma.backup.findUnique({
        where: { id },
        include: { site: true }
      });
    } catch (error) {
      logger.error('Error getting backup', { error });
      throw error;
    }
  }

  async deleteBackup(id: number) {
    try {
      return await prisma.backup.delete({
        where: { id }
      });
    } catch (error) {
      logger.error('Error deleting backup', { error });
      throw error;
    }
  }

  // Feedback Management
  async getFeedback() {
    try {
      return await prisma.feedback.findMany({
        orderBy: { createdAt: 'desc' },
        include: { site: true }
      });
    } catch (error) {
      logger.error('Error getting feedback', { error });
      throw error;
    }
  }

  async getFeedbackBySite(siteId: number) {
    try {
      return await prisma.feedback.findMany({
        where: { siteId },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      logger.error('Error getting feedback by site', { error });
      throw error;
    }
  }

  async addFeedback(feedbackData: any) {
    try {
      return await prisma.feedback.create({
        data: feedbackData
      });
    } catch (error) {
      logger.error('Error adding feedback', { error });
      throw error;
    }
  }

  async updateFeedbackStatus(id: number, status: string) {
    try {
      const data: any = { status };
      // If status is 'resolved', add resolved date
      if (status === 'resolved') {
        data.resolvedAt = new Date();
      }
      
      return await prisma.feedback.update({
        where: { id },
        data
      });
    } catch (error) {
      logger.error('Error updating feedback status', { error });
      throw error;
    }
  }

  // User Management
  async getUser(id: number) {
    try {
      return await prisma.user.findUnique({
        where: { id }
      });
    } catch (error) {
      logger.error('Error getting user', { error });
      throw error;
    }
  }

  async getUserByUsername(username: string) {
    try {
      return await prisma.user.findUnique({
        where: { username }
      });
    } catch (error) {
      logger.error('Error getting user by username', { error });
      throw error;
    }
  }

  async createUser(userData: any) {
    try {
      return await prisma.user.create({
        data: userData
      });
    } catch (error) {
      logger.error('Error creating user', { error });
      throw error;
    }
  }

  // Storage Providers
  async getStorageProviders() {
    try {
      return await prisma.storageProvider.findMany({
        orderBy: { name: 'asc' }
      });
    } catch (error) {
      logger.error('Error getting storage providers', { error });
      throw error;
    }
  }

  async getStorageProvider(id: number) {
    try {
      return await prisma.storageProvider.findUnique({
        where: { id }
      });
    } catch (error) {
      logger.error('Error getting storage provider', { error });
      throw error;
    }
  }

  async addStorageProvider(providerData: any) {
    try {
      return await prisma.storageProvider.create({
        data: providerData
      });
    } catch (error) {
      logger.error('Error adding storage provider', { error });
      throw error;
    }
  }

  async updateStorageProvider(id: number, providerData: any) {
    try {
      return await prisma.storageProvider.update({
        where: { id },
        data: providerData
      });
    } catch (error) {
      logger.error('Error updating storage provider', { error });
      throw error;
    }
  }

  async deleteStorageProvider(id: number) {
    try {
      return await prisma.storageProvider.delete({
        where: { id }
      });
    } catch (error) {
      logger.error('Error deleting storage provider', { error });
      throw error;
    }
  }

  // Additional Statistics methods
  async getDashboardStats() {
    try {
      // Get total sites count
      const sitesCount = await prisma.site.count();
      
      // Get total backups count
      const backupsCount = await prisma.backup.count();
      
      // Get total feedback count
      const feedbackCount = await prisma.feedback.count();
      
      // Get feedback by status
      const feedbackByStatus = await prisma.$queryRaw`
        SELECT status, COUNT(*) as count 
        FROM feedbacks 
        GROUP BY status
      `;
      
      // Get recent backups
      const recentBackups = await prisma.backup.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { site: true }
      });
      
      // Get recent feedback
      const recentFeedback = await prisma.feedback.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { site: true }
      });
      
      return {
        sitesCount,
        backupsCount,
        feedbackCount,
        feedbackByStatus,
        recentBackups,
        recentFeedback
      };
    } catch (error) {
      logger.error('Error getting dashboard stats', { error });
      throw error;
    }
  }

  async getFeedbackStats(projectId?: string) {
    try {
      // Get total feedback count
      const totalCount = await prisma.feedback.count({
        where: projectId ? { projectId } : undefined
      });
      
      // Get feedback by status
      const openCount = await prisma.feedback.count({
        where: {
          ...(projectId ? { projectId } : {}),
          status: 'open'
        }
      });
      
      const inProgressCount = await prisma.feedback.count({
        where: {
          ...(projectId ? { projectId } : {}),
          status: 'in-progress'
        }
      });
      
      const completedCount = await prisma.feedback.count({
        where: {
          ...(projectId ? { projectId } : {}),
          status: 'completed'
        }
      });
      
      // Get feedback by priority
      const lowPriorityCount = await prisma.feedback.count({
        where: {
          ...(projectId ? { projectId } : {}),
          priority: 'low'
        }
      });
      
      const mediumPriorityCount = await prisma.feedback.count({
        where: {
          ...(projectId ? { projectId } : {}),
          priority: 'medium'
        }
      });
      
      const highPriorityCount = await prisma.feedback.count({
        where: {
          ...(projectId ? { projectId } : {}),
          priority: 'high'
        }
      });
      
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
}