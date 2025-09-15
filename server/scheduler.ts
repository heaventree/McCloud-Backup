import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import logger from './utils/logger';
import { tokenRefreshManager } from './TokenRefreshManager';

const prisma = new PrismaClient();

interface ScheduledBackup {
  siteId: number;
  storageProviderId: number;
  frequency: string;
  lastRun?: Date;
}

class BackupScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private tokenRefreshIntervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.startScheduler();
    this.startTokenRefreshScheduler();
  }

  private startScheduler() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    logger.info('🚀 Backup Scheduler started - checking for scheduled backups every minute');
    
    // Check every minute for scheduled backups
    this.intervalId = setInterval(async () => {
      await this.checkAndRunScheduledBackups();
    }, 60 * 1000); // Check every minute
  }

  private async checkAndRunScheduledBackups() {
    try {
      // Check for stuck processes and retry them
      await this.checkAndRetryStuckProcesses();

      // Get all sites with automatic backup frequencies and verified plugins
      const sites = await prisma.site.findMany({
        where: {
          backupFrequency: {
            not: 'ondemand'
          },
          storageProviderId: {
            not: null
          },
          pluginVerified: true // Only run backups for plugin-verified sites
        },
        select: {
          id: true,
          name: true,
          backupFrequency: true,
          storageProviderId: true,
          lastBackup: true,
          pluginVerified: true
        }
      });

      if (sites.length > 0) {
        logger.info(`🔍 Scheduler: Found ${sites.length} site(s) with automatic backup schedules to check`);
        logger.info(`📋 Scheduler: Sites data:`, sites);

        for (const site of sites) {
          logger.info(`🔎 Scheduler: Checking site "${site.name}" (ID: ${site.id})`);
          logger.info(`📊 Scheduler: Site details - Frequency: ${site.backupFrequency}, Last backup: ${site.lastBackup}, Storage Provider: ${site.storageProviderId}, Plugin verified: ${site.pluginVerified}`);
          
          const shouldRunBackup = this.shouldRunBackup(site.backupFrequency, site.lastBackup);
          logger.info(`✅ Scheduler: Should run backup for site "${site.name}"? ${shouldRunBackup}`);
          
          if (shouldRunBackup) {
            logger.info(`⏰ Scheduler: Site "${site.name}" (ID: ${site.id}) is due for backup (frequency: ${site.backupFrequency})`);
            logger.info(`🚀 Scheduler: Triggering backup for site "${site.name}" (ID: ${site.id})`);
            await this.triggerBackup(site.id, site.storageProviderId!);
          } else {
            const nextRun = this.getNextRunTime(site.backupFrequency, site.lastBackup);
            logger.info(`⏳ Scheduler: Site "${site.name}" (ID: ${site.id}) next backup: ${nextRun}`);
          }
        }
      } else {
        logger.info(`📭 Scheduler: No sites found with automatic backup schedules`);
      }
    } catch (error) {
      logger.error('❌ Error checking scheduled backups:', error);
    }
  }

  private async checkAndRetryStuckProcesses() {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      
      // Find all active processes that haven't been updated for more than 5 minutes
      const stuckProcesses = await prisma.processTracking.findMany({
        where: {
          status: 'active',
          lastUpdated: {
            lt: fiveMinutesAgo
          },
          retryCount: {
            lt: 21 // Maximum 21 retries
          }
        },
        include: {
          backup: {
            include: {
              site: true
            }
          }
        }
      });

      if (stuckProcesses.length > 0) {
        logger.info(`🔄 Scheduler: Found ${stuckProcesses.length} stuck process(es) to retry`, {
          stuckProcesses: stuckProcesses.map(p => ({
            processId: p.processId,
            backupId: p.backupId,
            retryCount: p.retryCount,
            lastUpdated: p.lastUpdated
          }))
        });

        for (const stuckProcess of stuckProcesses) {
          await this.retryStuckProcess(stuckProcess);
        }
      }

      // Mark processes that have exceeded retry limit as failed
      const failedProcesses = await prisma.processTracking.findMany({
        where: {
          status: 'active',
          lastUpdated: {
            lt: fiveMinutesAgo
          },
          retryCount: {
            gte: 21 // Already tried 21 times
          }
        },
        include: {
          backup: true
        }
      });

      if (failedProcesses.length > 0) {
        logger.warn(`❌ Scheduler: Marking ${failedProcesses.length} process(es) as failed after 21 retry attempts`, {
          failedProcesses: failedProcesses.map(p => ({
            processId: p.processId,
            backupId: p.backupId,
            retryCount: p.retryCount,
            lastUpdated: p.lastUpdated
          }))
        });

        for (const failedProcess of failedProcesses) {
          await this.markProcessAsFailed(failedProcess);
        }
      }
    } catch (error) {
      logger.error('❌ Error checking for stuck processes:', error);
    }
  }

  private async retryStuckProcess(stuckProcess: any) {
    try {
      const { processId, backup, retryCount } = stuckProcess;
      
      if (!backup?.site) {
        logger.error(`Cannot retry process ${processId} - backup or site not found`);
        return;
      }

      // Check if backup is already completed - don't retry if it is
      if (backup.status === 'completed') {
        logger.info(`🚫 Scheduler: Skipping retry for process ${processId} - backup already completed`, {
          processId,
          backupId: backup.id,
          backupStatus: backup.status
        });
        
        // Mark process tracking as completed since backup is done
        await prisma.processTracking.update({
          where: { processId },
          data: { status: 'completed' }
        });
        
        return;
      }

      logger.info(`🔄 Scheduler: Retrying stuck process ${processId} (attempt ${retryCount + 1}/21)`, {
        processId,
        backupId: backup.id,
        siteName: backup.site.name,
        retryCount: retryCount + 1
      });

      // Increment retry count
      await prisma.processTracking.update({
        where: { processId },
        data: { 
          retryCount: retryCount + 1,
          lastUpdated: new Date() // Reset the timer
        }
      });

      // Ensure the site URL has a protocol
      let siteUrl = backup.site.url;
      if (!siteUrl.startsWith('http://') && !siteUrl.startsWith('https://')) {
        siteUrl = `https://${siteUrl}`;
      }

      // Call the WordPress plugin's /run endpoint
      const formData = new URLSearchParams();
      formData.append('process_id', processId);

      logger.info(`🚀 Scheduler: Making retry API call for stuck process ${processId}`, {
        siteUrl,
        endpoint: `${siteUrl}/index.php?rest_route=%2Fbacksheep%2Fv1%2Fbackup%2Frun`,
        retryAttempt: retryCount + 1,
        triggeredBy: 'scheduler-retry'
      });

      // Make the API call with timeout
      const response = await axios.post(
        `${siteUrl}/index.php?rest_route=%2Fbacksheep%2Fv1%2Fbackup%2Frun`, 
        formData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 120000, // 2 minute timeout
        }
      );

      logger.info(`✅ Scheduler: Retry API call successful for process ${processId}`, {
        processId,
        status: response.status,
        statusText: response.statusText,
        retryAttempt: retryCount + 1
      });

    } catch (error) {
      logger.error(`❌ Scheduler: Failed to retry stuck process ${stuckProcess.processId}`, {
        processId: stuckProcess.processId,
        retryAttempt: stuckProcess.retryCount + 1,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async markProcessAsFailed(failedProcess: any) {
    try {
      const { processId, backup } = failedProcess;

      // Mark process tracking as failed
      await prisma.processTracking.update({
        where: { processId },
        data: { status: 'failed' }
      });

      // Mark the backup as failed
      await prisma.backup.update({
        where: { id: backup.id },
        data: { 
          status: 'failed',
          error: 'Backup process failed after 21 retry attempts - no response from plugin',
          completedAt: new Date()
        }
      });

      logger.error(`❌ Scheduler: Marked process ${processId} and backup ${backup.id} as failed after maximum retries`, {
        processId,
        backupId: backup.id,
        maxRetries: 21
      });

    } catch (error) {
      logger.error(`❌ Scheduler: Failed to mark process ${failedProcess.processId} as failed`, {
        processId: failedProcess.processId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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
      case 'hourly':
        interval = 60 * 60 * 1000;
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
    logger.info(`🕒 shouldRunBackup: Checking backup timing for frequency: ${frequency}, lastBackup: ${lastBackup}`);
    
    if (!lastBackup) {
      logger.info(`🆕 shouldRunBackup: No previous backup found - this is the first backup`);
      return true; // First backup
    }

    const now = new Date();
    const timeDiff = now.getTime() - lastBackup.getTime();
    const timeDiffMinutes = Math.floor(timeDiff / (1000 * 60));
    const timeDiffHours = Math.floor(timeDiff / (1000 * 60 * 60));
    
    logger.info(`⏱️ shouldRunBackup: Current time: ${now.toISOString()}, Last backup: ${lastBackup.toISOString()}`);
    logger.info(`📏 shouldRunBackup: Time difference: ${timeDiffMinutes} minutes (${timeDiffHours} hours)`);

    let requiredInterval = 0;
    let shouldRun = false;

    switch (frequency) {
      case '30min':
        requiredInterval = 30 * 60 * 1000; // 30 minutes
        shouldRun = timeDiff >= requiredInterval;
        logger.info(`⏰ shouldRunBackup: 30min frequency - required: 30 minutes, actual: ${timeDiffMinutes} minutes, should run: ${shouldRun}`);
        break;
      case 'hourly':
        requiredInterval = 60 * 60 * 1000; // 1 hour
        shouldRun = timeDiff >= requiredInterval;
        logger.info(`⏰ shouldRunBackup: Hourly frequency - required: 60 minutes, actual: ${timeDiffMinutes} minutes, should run: ${shouldRun}`);
        break;
      case 'daily':
        requiredInterval = 24 * 60 * 60 * 1000; // 24 hours
        shouldRun = timeDiff >= requiredInterval;
        logger.info(`⏰ shouldRunBackup: Daily frequency - required: 24 hours, actual: ${timeDiffHours} hours, should run: ${shouldRun}`);
        break;
      case 'weekly':
        requiredInterval = 7 * 24 * 60 * 60 * 1000; // 7 days
        shouldRun = timeDiff >= requiredInterval;
        const timeDiffDays = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        logger.info(`⏰ shouldRunBackup: Weekly frequency - required: 7 days, actual: ${timeDiffDays} days, should run: ${shouldRun}`);
        break;
      case 'monthly':
        requiredInterval = 30 * 24 * 60 * 60 * 1000; // 30 days
        shouldRun = timeDiff >= requiredInterval;
        const timeDiffDaysMonthly = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        logger.info(`⏰ shouldRunBackup: Monthly frequency - required: 30 days, actual: ${timeDiffDaysMonthly} days, should run: ${shouldRun}`);
        break;
      case 'yearly':
        requiredInterval = 365 * 24 * 60 * 60 * 1000; // 365 days
        shouldRun = timeDiff >= requiredInterval;
        const timeDiffDaysYearly = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        logger.info(`⏰ shouldRunBackup: Yearly frequency - required: 365 days, actual: ${timeDiffDaysYearly} days, should run: ${shouldRun}`);
        break;
      default:
        logger.error(`❌ shouldRunBackup: Unknown frequency: ${frequency}`);
        return false;
    }

    logger.info(`🏁 shouldRunBackup: Final result for frequency ${frequency}: ${shouldRun}`);
    return shouldRun;
  }

  private async triggerBackup(siteId: number, storageProviderId: number) {
    try {
      logger.info(`🎯 Scheduler: Starting automated backup for site ID ${siteId}`);
      
      // Get site details to determine backup mode
      const site = await prisma.site.findUnique({
        where: { id: siteId }
      });

      if (!site) {
        logger.error(`❌ Site ${siteId} not found for scheduled backup`);
        return;
      }

      // Ensure tokens are valid before making backup request
      logger.debug(`🔐 Scheduler: Validating access token for storage provider ${storageProviderId}`);
      const tokenResult = await tokenRefreshManager.getValidAccessToken(storageProviderId);
      
      if (!tokenResult.success) {
        logger.error(`❌ Failed to get valid access token for scheduled backup:`, {
          siteId,
          storageProviderId,
          error: tokenResult.error
        });
        return;
      }



      // Use the same backup start API that manual backups use
      // Make internal API call to the backup start endpoint - use current environment URL
      const baseUrl = this.getBaseUrl();
      const backupStartUrl = `${baseUrl}/api/backup/start`;
      
      const requestData = {
        siteId: siteId.toString(),
        storageProviderId: storageProviderId,
        mode: site.backupMode || 'ALL' // Use site's backup mode or default to ALL
      };

      // Log the payload being sent from scheduler to backup start API
      logger.info('📅 Scheduler: Making API call to backup start endpoint', {
        url: backupStartUrl,
        payload: requestData,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
        siteId,
        storageProviderId,
        siteName: site.name,
        siteUrl: site.url,
        backupMode: site.backupMode
      });

      // Call the backup start API
      const response = await axios.post(backupStartUrl, requestData, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });

      if (response.data.success) {
        logger.info(`✅ Scheduler: Successfully triggered backup for site ID ${siteId}`);
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

  private getBaseUrl(): string {
    // Check for Replit deployment URL (production/development)
    if (process.env.REPLIT_DOMAINS) {
      return `https://${process.env.REPLIT_DOMAINS}`;
    }
    
    // Check for legacy Replit domain variable
    if (process.env.REPLIT_DEV_DOMAIN) {
      return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    }
    
    // Check for custom deployment URL
    if (process.env.DEPLOYMENT_URL) {
      return process.env.DEPLOYMENT_URL;
    }
    
    // Check for common production environment variables
    if (process.env.NODE_ENV === 'production' && process.env.APP_URL) {
      return process.env.APP_URL;
    }
    
    // Fallback to localhost for development
    return `http://localhost:${process.env.PORT || 3000}`;
  }

  private startTokenRefreshScheduler() {
    logger.info('🔄 Token Refresh Scheduler started - checking for expired tokens every hour');
    
    // Check and refresh tokens every hour
    this.tokenRefreshIntervalId = setInterval(async () => {
      await this.refreshExpiredTokens();
    }, 60 * 60 * 1000); // Check every hour
  }

  private async refreshExpiredTokens() {
    try {
      logger.info('🔄 Scheduler: Running periodic token refresh check');
      await tokenRefreshManager.refreshAllExpiredTokens();
    } catch (error) {
      logger.error('❌ Error during periodic token refresh:', error);
    }
  }

  public stopScheduler() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
    }
    if (this.tokenRefreshIntervalId) {
      clearInterval(this.tokenRefreshIntervalId);
      this.tokenRefreshIntervalId = null;
    }
    logger.info('🛑 Backup Scheduler stopped');
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
  backupScheduler.stopScheduler();
  process.exit(0);
});

process.on('SIGTERM', () => {
  backupScheduler.stopScheduler();
  process.exit(0);
});