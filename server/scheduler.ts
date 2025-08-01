import { PrismaClient } from '@prisma/client';

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
    console.log('🔄 Starting backup scheduler...');
    
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
        console.log(`📋 Found ${sites.length} sites with scheduled backups`);

        for (const site of sites) {
          const shouldRunBackup = this.shouldRunBackup(site.backupFrequency, site.lastBackup);
          
          if (shouldRunBackup) {
            console.log(`🚀 Triggering scheduled backup for site: ${site.name} (${site.backupFrequency})`);
            await this.triggerBackup(site.id, site.storageProviderId!);
          } else {
            const nextRun = this.getNextRunTime(site.backupFrequency, site.lastBackup);
            console.log(`⏰ Site ${site.name} next backup scheduled for: ${nextRun}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error checking scheduled backups:', error);
    }
  }

  private getNextRunTime(frequency: string, lastBackup: Date | null): string {
    if (!lastBackup) return 'Now (first backup)';

    const lastRun = new Date(lastBackup);
    let interval = 0;

    switch (frequency) {
      case '5min':
        interval = 5 * 60 * 1000;
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
      case '5min':
        return timeDiff >= 5 * 60 * 1000; // 5 minutes
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
      // Create backup record in database
      const backup = await prisma.backup.create({
        data: {
          siteId,
          storageProviderId,
          status: 'pending',
          backupType: 'full',
          startedAt: new Date()
        }
      });

      console.log(`✅ Scheduled backup created in database:`, backup);
      
      // Update lastBackup timestamp
      await prisma.site.update({
        where: { id: siteId },
        data: { lastBackup: new Date() }
      });

      // The backup processing will be handled by the backup status API
      // which monitors pending backups and initiates them through WordPress API
      
    } catch (error) {
      console.error(`❌ Error creating scheduled backup for site ${siteId}:`, error);
    }
  }

  public stopScheduler() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('🛑 Backup scheduler stopped');
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
  console.log('🔄 Gracefully shutting down backup scheduler...');
  backupScheduler.stopScheduler();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🔄 Gracefully shutting down backup scheduler...');
  backupScheduler.stopScheduler();
  process.exit(0);
});