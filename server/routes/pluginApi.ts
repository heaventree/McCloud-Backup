/**
 * Server-side counterpart of the McCloud Backup WordPress plugin's outbound
 * calls (includes/api.php -> $api->send('backup/xxx', ...)), mounted at
 * /v2 to match the plugin's default MCCLOUD_BACKUP_API_URL
 * (https://api.mccloud-backup.com/v2). Every route here requires the
 * per-site API key (Site.apiKey) that the plugin sends as
 * "Authorization: Bearer <key>".
 *
 * Previously none of these routes existed server-side at all, so the plugin's
 * completion/error callbacks silently failed and backups never showed as
 * finished on the dashboard.
 */
import { Router, Request, Response } from "express";
import prisma from "../prisma";
import logger from "../utils/logger";
import { requireSiteApiKey, AuthedRequest } from "../middleware/apiAuth";
import { verifyBackupArchive } from "../utils/backup-verify";

const router = Router();

router.get("/site/ping", requireSiteApiKey, (req: AuthedRequest, res: Response) => {
  res.json({ status: "success", site_id: req.site!.id });
});

/**
 * Called by McCloud_Backup_Backup::notify_backup_complete().
 * body: { site_id, backup_id, status: 'completed', size, file_count, files: [...], completed_at }
 *
 * If the plugin/pipeline provides a local archive path (server-side backups
 * that stream through this host use `archive_path`), the archive is verified
 * (zip structural check + SHA-256) before the backup is allowed to be marked
 * completed; a corrupt/truncated archive is stored as "failed" instead.
 */
router.post("/backup/complete", requireSiteApiKey, async (req: AuthedRequest, res: Response) => {
  try {
    const { backup_id, size, file_count, changed_files, archive_path, encrypted, encryption_method } = req.body || {};

    if (!backup_id) {
      return res.status(400).json({ status: "error", message: "backup_id is required" });
    }

    let status = "completed";
    let checksum: string | undefined;
    let verifyError: string | undefined;

    if (archive_path) {
      const result = await verifyBackupArchive(archive_path);
      if (!result.valid) {
        status = "failed";
        verifyError = result.error;
        logger.warn("Backup archive failed verification, marking failed", { backup_id, error: result.error });
      } else {
        checksum = result.checksum;
      }
    }

    const existing = await prisma.backup.findFirst({ where: { processId: String(backup_id), siteId: req.site!.id } });

    const data: any = {
      status,
      completedAt: new Date(),
      filesize: size !== undefined ? Number(size) : undefined,
      fileCount: file_count !== undefined ? Number(file_count) : undefined,
      changedFiles: changed_files !== undefined ? Number(changed_files) : undefined,
      checksum,
      encrypted: encrypted === true || encrypted === "1" || encrypted === 1,
      encryptionMethod: encryption_method || undefined,
      error: verifyError
    };

    const backup = existing
      ? await prisma.backup.update({ where: { id: existing.id }, data })
      : await prisma.backup.create({
          data: {
            siteId: req.site!.id,
            processId: String(backup_id),
            backupType: "full",
            ...data
          }
        });

    await prisma.site.update({ where: { id: req.site!.id }, data: { lastBackup: new Date() } }).catch(() => undefined);

    res.json({ status: "success", backup_status: backup.status, backup_id });
  } catch (error) {
    logger.error("backup/complete error", { error });
    res.status(500).json({ status: "error", message: "Failed to record backup completion" });
  }
});

/**
 * Called by McCloud_Backup_Backup::notify_backup_error().
 * body: { site_id, backup_id, status: 'error', error_message, failed_at }
 */
router.post("/backup/error", requireSiteApiKey, async (req: AuthedRequest, res: Response) => {
  try {
    const { backup_id, error_message } = req.body || {};
    if (!backup_id) {
      return res.status(400).json({ status: "error", message: "backup_id is required" });
    }

    const existing = await prisma.backup.findFirst({ where: { processId: String(backup_id), siteId: req.site!.id } });
    const data = { status: "failed", error: error_message || "Unknown error", completedAt: new Date() };

    if (existing) {
      await prisma.backup.update({ where: { id: existing.id }, data });
    } else {
      await prisma.backup.create({
        data: { siteId: req.site!.id, processId: String(backup_id), backupType: "full", ...data }
      });
    }

    res.json({ status: "success" });
  } catch (error) {
    logger.error("backup/error error", { error });
    res.status(500).json({ status: "error", message: "Failed to record backup error" });
  }
});

export default router;
