import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import logger from './utils/logger';
import { tokenRefreshManager } from './TokenRefreshManager';
import { deleteGoogleDriveBackupFolder } from './providers/google-drive';
import { finalizeUploadResult } from './routes/backup-routes';

const prisma = new PrismaClient();

// How long a completed/failed/stuck backup - and its local temp/<processId>/ files - are kept
// before being purged. Confirmed via audit that nothing else in the codebase ever cleans these
// up, so the local temp directory grows unbounded without this.
const BACKUP_RETENTION_DAYS = 30;

interface ScheduledBackup {
  siteId: number;
  storageProviderId: number;
  frequency: string;
  lastRun?: Date;
}

class BackupScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private tokenRefreshIntervalId: NodeJS.Timeout | null = null;
  private retentionIntervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isCheckingBackups = false;

  constructor() {
    this.recoverStaleUploadingBackups();
    this.startScheduler();
    this.startTokenRefreshScheduler();
    this.startRetentionScheduler();
  }

  /**
   * One-time startup recovery: any backup still marked 'uploading' is definitely stale left
   * over from before this process started - a single Node process is the only writer of that
   * status (via finalizeUploadResult's atomic claim), so if this process just started, nothing
   * is actively holding that claim anymore. Most likely real-world cause: pm2 restart during a
   * deploy landing mid-upload-attempt. Without this, checkAndRetryStuckUploads() only ever scans
   * 'captured' rows, so a row stuck at 'uploading' from a dead process would never be picked up
   * again - silently lost, not retried, not marked failed either. Reset it back to 'captured' so
   * the normal retry path (next minute tick) picks it up.
   */
  private async recoverStaleUploadingBackups() {
    try {
      const result = await prisma.backup.updateMany({
        where: { status: 'uploading' },
        data: { status: 'captured' }
      });
      if (result.count > 0) {
        logger.info(`🔧 Scheduler: Recovered ${result.count} backup(s) stuck at 'uploading' from a previous process - reset to 'captured'`);
      }
    } catch (error) {
      logger.error('❌ Error recovering stale uploading backups on startup:', error);
    }
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
    if (this.isCheckingBackups) {
      logger.warn('⚠️ Scheduler: Backup check already in progress, skipping this check to prevent overlap');
      return;
    }

    this.isCheckingBackups = true;
    try {
      // Check for stuck processes and retry them
      await this.checkAndRetryStuckProcesses();

      // Resume/retry uploads for backups whose WordPress-side capture finished but whose cloud
      // upload hasn't been confirmed yet - independent of whether anyone's browser is polling
      // /status/:processId right now. Without this, a backup captured while nobody's watching
      // (a scheduled run, or a person who closed the tab) would sit at 'captured' forever, not
      // because retries were exhausted but because nothing ever triggered them.
      await this.checkAndRetryStuckUploads();

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
    } finally {
      this.isCheckingBackups = false;
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

  /**
   * Resume the upload step for any backup sitting at 'captured' - WordPress-side capture
   * finished, local files are on disk, but the cloud upload hasn't been confirmed yet. This is
   * the only server-side driver of that retry; without it, nothing advances a captured backup
   * unless a browser happens to be polling /status/:processId at the time.
   *
   * Deliberately no age filter here (e.g. "only rows older than N minutes") - finalizeUploadResult
   * already caps itself at MAX_UPLOAD_ATTEMPTS and permanently gives up (-> 'upload_failed') on
   * non-transient errors, so simply retrying every 'captured' row on every minute-tick is safe
   * and self-limiting on its own, without needing a new timestamp column on `backups`.
   */
  private async checkAndRetryStuckUploads() {
    try {
      const stuck = await prisma.backup.findMany({
        where: { status: 'captured' },
        select: { id: true, processId: true }
      });

      if (stuck.length === 0) {
        return;
      }

      logger.info(`📤 Scheduler: Found ${stuck.length} backup(s) captured but not yet uploaded - retrying`, {
        processIds: stuck.map(b => b.processId)
      });

      for (const backup of stuck) {
        try {
          const outcome = await finalizeUploadResult(backup.id);
          logger.info(`📤 Scheduler: Upload retry for backup ${backup.id} (${backup.processId}) -> ${outcome.state}`, {
            success: outcome.success,
            message: outcome.message
          });
        } catch (error) {
          logger.error(`❌ Scheduler: Error retrying upload for backup ${backup.id} (${backup.processId})`, {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    } catch (error) {
      logger.error('❌ Error checking for stuck uploads:', error);
    }
  }

  private async retryStuckProcess(stuckProcess: any) {
    try {
      const { processId, backup, retryCount } = stuckProcess;
      
      if (!backup?.site) {
        logger.error(`Cannot retry process ${processId} - backup or site not found`);
        return;
      }

      // Check if the WordPress side is already done - don't re-nudge wp-cron for it. This
      // covers 'completed' (fully done) as well as 'captured'/'upload_failed' (WordPress
      // already finished and handed the files off locally - only the cloud upload, handled by
      // backup-routes.ts's own retry loop, might still be pending; re-nudging wp-cron here
      // would just re-run a WordPress backup that already succeeded).
      if (['completed', 'captured', 'upload_failed'].includes(backup.status)) {
        logger.info(`🚫 Scheduler: Skipping wp-cron retry for process ${processId} - WordPress side already finished`, {
          processId,
          backupId: backup.id,
          backupStatus: backup.status
        });

        // Mark process tracking as completed since the WordPress side is done
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

      // The backup's mccloud_backup_run_event was already scheduled by the original /start
      // call (see backup-routes.ts) - it just never fired, most likely because the site's own
      // internal loopback nudge got blocked (confirmed live: security plugins commonly block a
      // site from looping back into itself) or lost to a caching race on WP's cron option. There
      // is no separate "run"/retry endpoint in v3 - re-nudging wp-cron.php externally (the same
      // mechanism /start already uses, which IS reliable since Node is always an external
      // caller) is what re-triggers the already-queued event, not a POST to a dead v1 route.
      const cronUrl = `${siteUrl}/wp-cron.php`;

      logger.info(`🚀 Scheduler: Re-nudging WP-Cron for stuck process ${processId}`, {
        siteUrl,
        endpoint: cronUrl,
        retryAttempt: retryCount + 1,
        triggeredBy: 'scheduler-retry'
      });

      const response = await axios.get(cronUrl, {
        params: { doing_wp_cron: Date.now() / 1000 },
        timeout: 15000, // this is a real (not fire-and-forget) retry - wait for a response
      });

      logger.info(`✅ Scheduler: WP-Cron nudge sent for stuck process ${processId}`, {
        processId,
        status: response.status,
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
      case '12hour':
        interval = 12 * 60 * 60 * 1000;
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
      case '12hour':
        requiredInterval = 12 * 60 * 60 * 1000; // 12 hours
        shouldRun = timeDiff >= requiredInterval;
        logger.info(`⏰ shouldRunBackup: 12-hour frequency - required: 12 hours, actual: ${timeDiffHours} hours, should run: ${shouldRun}`);
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
        timeout: 120000 // 2 minutes timeout
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

  private startRetentionScheduler() {
    logger.info(`🗑️ Retention Scheduler started - purging backups older than ${BACKUP_RETENTION_DAYS} days once a day`);

    // Run once on startup so a freshly-started server doesn't wait a full day before working
    // off any existing backlog, then repeat daily.
    this.runRetentionCleanup().catch(error => {
      logger.error('❌ Error during startup retention cleanup:', error);
    });

    this.retentionIntervalId = setInterval(async () => {
      await this.runRetentionCleanup();
    }, 24 * 60 * 60 * 1000); // Once a day
  }

  /**
   * Delete backups (DB row + their local temp/<processId>/ files) older than
   * BACKUP_RETENTION_DAYS, based on createdAt. Covers every status - completed, failed, and
   * long-stuck in_progress rows alike, since none of them are useful past the retention window.
   *
   * Deliberately scoped to backups the DB knows about; does not sweep temp/ for orphaned
   * directories with no matching backup row - that's a different (disk-hygiene) problem.
   */
  private async runRetentionCleanup() {
    try {
      const cutoff = new Date(Date.now() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000);

      const eligible = await prisma.backup.findMany({
        where: { createdAt: { lt: cutoff } },
        select: {
          id: true,
          processId: true,
          siteId: true,
          status: true,
          createdAt: true,
          storageType: true,
          storageProviderId: true
        }
      });

      if (eligible.length === 0) {
        logger.info('🗑️ Retention: No backups older than retention window - nothing to purge');
        return;
      }

      logger.info(`🗑️ Retention: Found ${eligible.length} backup(s) older than ${BACKUP_RETENTION_DAYS} days - purging`, {
        cutoff: cutoff.toISOString()
      });

      let filesDeleted = 0;
      let fileErrors = 0;
      let driveDeleted = 0;
      let driveErrors = 0;

      for (const backup of eligible) {
        if (!backup.processId || !/^[A-Za-z0-9_-]+$/.test(backup.processId)) {
          // No processId (never actually started against WordPress) or an unexpected shape -
          // nothing safe to remove from disk/Drive, skip straight to DB deletion below.
          continue;
        }

        const dir = path.join(process.cwd(), 'temp', backup.processId);
        try {
          await fs.rm(dir, { recursive: true, force: true });
          filesDeleted++;
        } catch (error) {
          fileErrors++;
          logger.warn(`⚠️ Retention: Failed to remove local files for backup ${backup.id} (${dir})`, {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          // Non-fatal - still proceed to delete the DB row so it doesn't linger forever;
          // any leftover directory becomes an orphan for a future disk-hygiene pass.
        }

        // If this backup was uploaded to Google Drive, purge it there too - not just the
        // local copy - so "retain for 30 days" actually holds across both locations.
        if (backup.storageType === 'google' && backup.storageProviderId) {
          try {
            const tokenResult = await tokenRefreshManager.getValidAccessToken(backup.storageProviderId);
            if (tokenResult.success && tokenResult.access_token) {
              await deleteGoogleDriveBackupFolder(tokenResult.access_token, backup.processId);
              driveDeleted++;
            } else {
              driveErrors++;
              logger.warn(`⚠️ Retention: Could not get a valid Google Drive token to purge backup ${backup.id}`, {
                error: tokenResult.error
              });
            }
          } catch (error) {
            driveErrors++;
            logger.warn(`⚠️ Retention: Failed to remove Google Drive files for backup ${backup.id}`, {
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            // Non-fatal, same reasoning as local file deletion above - still proceed to
            // delete the DB row.
          }
        }
      }

      const ids = eligible.map(b => b.id);

      // ProcessTracking rows reference backups by FK - must go first, same ordering as
      // PrismaStorage.deleteBackup().
      await prisma.processTracking.deleteMany({ where: { backupId: { in: ids } } });
      await prisma.backup.deleteMany({ where: { id: { in: ids } } });

      logger.info(`✅ Retention: Purged ${eligible.length} backup record(s) (${filesDeleted} local file set(s) removed, ${fileErrors} file-removal error(s); ${driveDeleted} Google Drive folder(s) removed, ${driveErrors} Drive-removal error(s))`);
    } catch (error) {
      logger.error('❌ Error during retention cleanup:', error);
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
    if (this.retentionIntervalId) {
      clearInterval(this.retentionIntervalId);
      this.retentionIntervalId = null;
    }
    logger.info('🛑 Backup Scheduler stopped');
  }

  public getStatus() {
    return {
      running: this.isRunning,
      intervalId: this.intervalId !== null,
      checkingBackups: this.isCheckingBackups
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