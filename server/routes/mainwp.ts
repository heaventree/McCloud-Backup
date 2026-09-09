/**
 * Account-level API surface for the MainWP McCloud Backup extension.
 * Auth: a single account-level API key (Authorization: Bearer <key>),
 * checked against the ApiKey table (scope "account") - see
 * server/middleware/apiAuth.ts#requireAccountApiKey.
 */
import { Router, Request, Response } from "express";
import prisma from "../prisma";
import logger from "../utils/logger";
import { requireAccountApiKey } from "../middleware/apiAuth";
import { triggerSiteBackup } from "../services/scheduler";

const router = Router();

router.use(requireAccountApiKey);

// Status of every site McCloud Backup knows about, for the MainWP dashboard widget.
router.get("/sites/status", async (_req: Request, res: Response) => {
  try {
    const sites = await prisma.site.findMany({
      include: {
        schedules: { where: { enabled: true }, orderBy: { nextRun: "asc" }, take: 1 },
        backups: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    });

    res.json({
      status: "success",
      sites: sites.map((site) => ({
        id: site.id,
        name: site.name,
        url: site.url,
        connected: site.status === "active",
        lastBackup: site.lastBackup,
        lastBackupStatus: site.backups[0]?.status ?? null,
        nextRun: site.schedules[0]?.nextRun ?? null
      }))
    });
  } catch (error) {
    logger.error("mainwp sites/status error", { error });
    res.status(500).json({ status: "error", message: "Failed to load site statuses" });
  }
});

// One-click "run backup now" from the MainWP extension.
router.post("/sites/:siteId/backup-now", async (req: Request, res: Response) => {
  try {
    const siteId = parseInt(req.params.siteId, 10);
    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) {
      return res.status(404).json({ status: "error", message: "Site not found" });
    }

    const backup = await triggerSiteBackup(site.id, "full");

    res.json({ status: "success", backupId: backup.id, backupStatus: backup.status, message: "Backup triggered" });
  } catch (error) {
    logger.error("mainwp backup-now error", { error });
    res.status(500).json({ status: "error", message: "Failed to queue backup" });
  }
});

export default router;
