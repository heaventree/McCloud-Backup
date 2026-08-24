/**
 * Notification Service
 * 
 * Handles creation, retrieval, and management of system notifications
 */
import prisma from '../prisma';
import logger from '../utils/logger';
import { InsertNotification, Notification } from '@shared/schema';

export class NotificationService {
  private static instance: NotificationService;

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Create a new notification
   */
  async createNotification(notification: InsertNotification): Promise<Notification | null> {
    try {
      const newNotification = await prisma.notification.create({
        data: {
          title: notification.title,
          message: notification.message,
          type: notification.type,
          category: notification.category,
          siteId: notification.siteId || null,
          storageProviderId: notification.storageProviderId || null,
          read: notification.read || false,
          data: notification.data || null,
        },
      });

      logger.info('Notification created', {
        id: newNotification.id,
        type: newNotification.type,
        category: newNotification.category,
        title: newNotification.title,
      });

      return newNotification as Notification;
    } catch (error) {
      logger.error('Failed to create notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        notification,
      });
      return null;
    }
  }

  /**
   * Create a backup error notification
   */
  async createBackupErrorNotification(
    siteId: number,
    siteName: string,
    error: string,
    backupType: 'manual' | 'scheduled' = 'manual'
  ): Promise<Notification | null> {
    return this.createNotification({
      title: 'Backup Failed',
      message: `${siteName} backup failed: ${error}`,
      type: 'error',
      category: 'backup',
      siteId,
      read: false,
      data: JSON.stringify({
        backupType,
        error,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  /**
   * Create a token refresh error notification
   */
  async createTokenRefreshErrorNotification(
    storageProviderId: number,
    providerName: string,
    providerType: string,
    error: string
  ): Promise<Notification | null> {
    return this.createNotification({
      title: 'Storage Provider Token Refresh Failed',
      message: `Failed to refresh ${providerName} (${providerType}) authentication token: ${error}`,
      type: 'error',
      category: 'token_refresh',
      storageProviderId,
      read: false,
      data: JSON.stringify({
        providerType,
        error,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  /**
   * Create a site settings change notification
   */
  async createSiteSettingsChangeNotification(
    siteId: number,
    siteName: string,
    changes: {
      backupFrequency?: { old: string; new: string };
      backupMode?: { old: string; new: string };
      storageProvider?: { old: string | null; new: string | null };
    }
  ): Promise<Notification | null> {
    const changeMessages: string[] = [];
    
    if (changes.backupFrequency) {
      const oldFreq = changes.backupFrequency.old === 'ondemand' ? 'On Demand' : 
                     changes.backupFrequency.old === '30min' ? 'Every 30 Min' : 
                     changes.backupFrequency.old;
      const newFreq = changes.backupFrequency.new === 'ondemand' ? 'On Demand' : 
                     changes.backupFrequency.new === '30min' ? 'Every 30 Min' : 
                     changes.backupFrequency.new;
      changeMessages.push(`backup frequency changed from ${oldFreq} to ${newFreq}`);
    }
    
    if (changes.backupMode) {
      const oldMode = changes.backupMode.old === 'ALL' ? 'Full Site' :
                     changes.backupMode.old === 'FILES' ? 'Files Only' :
                     changes.backupMode.old === 'DB' ? 'Database Only' : changes.backupMode.old;
      const newMode = changes.backupMode.new === 'ALL' ? 'Full Site' :
                     changes.backupMode.new === 'FILES' ? 'Files Only' :
                     changes.backupMode.new === 'DB' ? 'Database Only' : changes.backupMode.new;
      changeMessages.push(`backup type changed from ${oldMode} to ${newMode}`);
    }
    
    if (changes.storageProvider) {
      changeMessages.push(`storage provider changed from ${changes.storageProvider.old || 'none'} to ${changes.storageProvider.new || 'none'}`);
    }

    const message = changeMessages.length > 0 
      ? `${siteName}: ${changeMessages.join(', ')}`
      : `${siteName} settings were updated`;

    return this.createNotification({
      title: 'Site Settings Updated',
      message,
      type: 'info',
      category: 'site_settings',
      siteId,
      read: false,
      data: JSON.stringify({
        changes,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  /**
   * Get all notifications
   */
  async getNotifications(options?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    category?: string;
    siteId?: number;
  }): Promise<{ notifications: Notification[]; total: number }> {
    try {
      const where: any = {};
      
      if (options?.unreadOnly) {
        where.read = false;
      }
      
      if (options?.category) {
        where.category = options.category;
      }
      
      if (options?.siteId) {
        where.siteId = options.siteId;
      }

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: options?.limit || 50,
          skip: options?.offset || 0,
        }),
        prisma.notification.count({ where }),
      ]);

      return {
        notifications: notifications as Notification[],
        total,
      };
    } catch (error) {
      logger.error('Failed to fetch notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        options,
      });
      return { notifications: [], total: 0 };
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: number): Promise<boolean> {
    try {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { read: true, updatedAt: new Date() },
      });
      return true;
    } catch (error) {
      logger.error('Failed to mark notification as read', {
        error: error instanceof Error ? error.message : 'Unknown error',
        notificationId,
      });
      return false;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<boolean> {
    try {
      await prisma.notification.updateMany({
        where: { read: false },
        data: { read: true, updatedAt: new Date() },
      });
      return true;
    } catch (error) {
      logger.error('Failed to mark all notifications as read', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: number): Promise<boolean> {
    try {
      await prisma.notification.delete({
        where: { id: notificationId },
      });
      return true;
    } catch (error) {
      logger.error('Failed to delete notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        notificationId,
      });
      return false;
    }
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications(): Promise<boolean> {
    try {
      await prisma.notification.deleteMany({});
      return true;
    } catch (error) {
      logger.error('Failed to clear all notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
    try {
      return await prisma.notification.count({
        where: { read: false },
      });
    } catch (error) {
      logger.error('Failed to get unread notification count', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }
}

export const notificationService = NotificationService.getInstance();