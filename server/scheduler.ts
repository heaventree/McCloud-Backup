import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import logger from './utils/logger';

const prisma = new PrismaClient();

interface ScheduledBackup {
  siteId: number;
  storageProviderId: number;
  frequency: string;
  lastRun?: Date;
}

class BackupScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.startScheduler();
  }

  private startScheduler() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    logger.info('🔄 Starting backup scheduler...');
    
    // Check every minute for scheduled backups
    this.intervalId = setInterval(async () => {
      await this.checkAndRunScheduledBackups();
    }, 60 * 1000); // Check every minute
  }

  private async checkAndRunScheduledBackups() {
    try {
      // Get all sites with automatic backup frequencies
      const sites = await prisma.site.findMany({
        where: {
          backupFrequency: {
            not: 'ondemand'
          },
          storageProviderId: {
            not: null
          }
        },
        select: {
          id: true,
          name: true,
          backupFrequency: true,
          storageProviderId: true,
          lastBackup: true
        }
      });

      if (sites.length > 0) {
        logger.info(`📋 Found ${sites.length} sites with scheduled backups`);

        for (const site of sites) {
          const shouldRunBackup = this.shouldRunBackup(site.backupFrequency, site.lastBackup);
          
          if (shouldRunBackup) {
            logger.info(`🚀 Triggering scheduled backup for site: ${site.name} (${site.backupFrequency})`);
            await this.triggerBackup(site.id, site.storageProviderId!);
          } else {
            const nextRun = this.getNextRunTime(site.backupFrequency, site.lastBackup);
            logger.info(`⏰ Site ${site.name} next backup scheduled for: ${nextRun}`);
          }
        }
      }
    } catch (error) {
      logger.error('❌ Error checking scheduled backups:', error);
    }
  }

  private getNextRunTime(frequency: string, lastBackup: Date | null): string {
    if (!lastBackup) return 'Now (first backup)';

    const lastRun = new Date(lastBackup);
    let interval = 0;

    switch (frequency) {
      case '30min':
        interval = 30 * 60 * 1000;
        break;
      case 'daily':
        interval = 24 * 60 * 60 * 1000;
        break;
      case 'weekly':
        interval = 7 * 24 * 60 * 60 * 1000;
        break;
      case 'monthly':
        interval = 30 * 24 * 60 * 60 * 1000;
        break;
      case 'yearly':
        interval = 365 * 24 * 60 * 60 * 1000;
        break;
      default:
        return 'Unknown';
    }

    const nextRun = new Date(lastRun.getTime() + interval);
    return nextRun.toLocaleString();
  }

  private shouldRunBackup(frequency: string, lastBackup: Date | null): boolean {
    if (!lastBackup) return true; // First backup

    const now = new Date();
    const timeDiff = now.getTime() - lastBackup.getTime();

    switch (frequency) {
      case '30min':
        return timeDiff >= 30 * 60 * 1000; // 30 minutes
      case 'daily':
        return timeDiff >= 24 * 60 * 60 * 1000; // 24 hours
      case 'weekly':
        return timeDiff >= 7 * 24 * 60 * 60 * 1000; // 7 days
      case 'monthly':
        return timeDiff >= 30 * 24 * 60 * 60 * 1000; // 30 days
      case 'yearly':
        return timeDiff >= 365 * 24 * 60 * 60 * 1000; // 365 days
      default:
        return false;
    }
  }

  private async triggerBackup(siteId: number, storageProviderId: number) {
    try {
      logger.info(`🚀 Starting automatic backup for site ${siteId} with storage provider ${storageProviderId}`);
      
      // Get site details to determine backup mode
      const site = await prisma.site.findUnique({
        where: { id: siteId }
      });

      if (!site) {
        logger.error(`❌ Site ${siteId} not found for scheduled backup`);
        return;
      }

      // Use the same backup start API that manual backups use
      // Make internal API call to the backup start endpoint
      const backupStartUrl = `http://localhost:${process.env.PORT || 3000}/api/backup/start`;
      
      const requestData = {
        siteId: siteId.toString(),
        storageProviderId: storageProviderId,
        mode: site.backupMode || 'ALL' // Use site's backup mode or default to ALL
      };

      logger.info(`📡 Making internal API call to start backup`, {
        url: backupStartUrl,
        data: requestData
      });

      // Call the backup start API
      const response = await axios.post(backupStartUrl, requestData, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });

      if (response.data.success) {
        logger.info(`✅ Scheduled backup started successfully`, {
          siteId,
          processId: response.data.processId,
          backupId: response.data.backup?.id
        });
        
        // Update lastBackup timestamp
        await prisma.site.update({
          where: { id: siteId },
          data: { lastBackup: new Date() }
        });
      } else {
        logger.error(`❌ Failed to start scheduled backup for site ${siteId}:`, {
          error: response.data.message,
          data: response.data
        });
      }
      
    } catch (error) {
      logger.error(`❌ Error triggering scheduled backup for site ${siteId}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  public stopScheduler() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      logger.info('🛑 Backup scheduler stopped');
    }
  }

  public getStatus() {
    return {
      running: this.isRunning,
      intervalId: this.intervalId !== null
    };
  }
}

// Create and export a single instance
export const backupScheduler = new BackupScheduler();

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('🔄 Gracefully shutting down backup scheduler...');
  backupScheduler.stopScheduler();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('🔄 Gracefully shutting down backup scheduler...');
  backupScheduler.stopScheduler();
  process.exit(0);
});