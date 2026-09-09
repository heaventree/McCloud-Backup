/**
 * Real backup scheduler.
 *
 * The codebase had no cron-style dependency and no process that ever looked
 * at BackupSchedule.nextRun, so schedules created via /api/backup-schedules
 * never actually fired - they just sat there. This runs a lightweight
 * in-process check every minute (no new dependency needed) and fires any due
 * schedule by calling the site's McCloud Backup plugin REST endpoint,
 * matching what server/routes/backup-routes.ts's /start route does.
 */
import axios from "axios";
import prisma from "../prisma";
import logger from "../utils/logger";

const CHECK_INTERVAL_MS = 60 * 1000;
let timer: NodeJS.Timeout | null = null;

export async function triggerSiteBackup(siteId: number, backupType: "full" | "incremental" = "full") {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new Error(`Site ${siteId} not found`);
  if (!site.apiKey) throw new Error(`Site ${siteId} has no API key configured`);

  const backupId = `bk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  let parentBackupId: number | undefined;
  if (backupType === "incremental") {
    const lastFull = await prisma.backup.findFirst({
      where: { siteId, backupType: "full", status: "completed" },
      orderBy: { createdAt: "desc" }
    });
    parentBackupId = lastFull?.id;
  }

  const response = await axios.get(
    `${site.url.replace(/\/$/, "")}/wp-json/mccloud-backup/v2/backup`,
    { params: { api_key: site.apiKey, backup_id: backupId, type: backupType }, timeout: 30000 }
  );

  if (response.status !== 200 || response.data?.status !== "success") {
    const backup = await prisma.backup.create({
      data: {
        siteId,
        backupType,
        parentBackupId,
        status: "failed",
        processId: backupId,
        error: response.data?.message || `Site returned HTTP ${response.status}`
      }
    });
    return backup;
  }

  return prisma.backup.create({
    data: {
      siteId,
      backupType,
      parentBackupId,
      status: "in_progress",
      processId: response.data.backup_id || backupId,
      startedAt: new Date()
    }
  });
}

async function runDueSchedules() {
  const now = new Date();
  let due: Awaited<ReturnType<typeof prisma.backupSchedule.findMany>> = [];
  try {
    due = await prisma.backupSchedule.findMany({
      where: { enabled: true, nextRun: { lte: now } }
    });
  } catch (error) {
    logger.error("Scheduler: failed to load due backup schedules", { error });
    return;
  }

  for (const schedule of due) {
    try {
      logger.info("Scheduler: firing due backup schedule", { scheduleId: schedule.id, siteId: schedule.siteId });

      // Every Nth run is a full backup (per fullBackupFrequency), the rest incremental.
      let backupType: "full" | "incremental" = schedule.backupType === "incremental" ? "incremental" : "full";
      if (schedule.backupType === "incremental" && schedule.fullBackupFrequency) {
        const completedCount = await prisma.backup.count({ where: { siteId: schedule.siteId, status: "completed" } });
        if (completedCount % schedule.fullBackupFrequency === 0) backupType = "full";
      }

      await triggerSiteBackup(schedule.siteId, backupType).catch((err) =>
        logger.error("Scheduler: failed to trigger backup", { scheduleId: schedule.id, error: err })
      );

      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      if (schedule.frequency === "weekly") next.setDate(next.getDate() + 6); // land on the same weekday again
      next.setHours(schedule.hourOfDay, schedule.minuteOfHour, 0, 0);

      await prisma.backupSchedule.update({
        where: { id: schedule.id },
        data: { lastRun: now, nextRun: next }
      });
    } catch (error) {
      logger.error("Scheduler: error processing schedule", { scheduleId: schedule.id, error });
    }
  }
}

export function startScheduler() {
  if (timer) return;
  logger.info("Backup scheduler started", { intervalMs: CHECK_INTERVAL_MS });
  timer = setInterval(() => {
    runDueSchedules().catch((error) => logger.error("Scheduler tick failed", { error }));
  }, CHECK_INTERVAL_MS);
  // Also do an immediate check on boot so a due-since-restart schedule doesn't wait a full interval.
  runDueSchedules().catch((error) => logger.error("Scheduler initial tick failed", { error }));
}

export function stopScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
