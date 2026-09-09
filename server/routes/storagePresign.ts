/**
 * Presigned-upload endpoint for S3-compatible storage providers (S3, Backblaze
 * B2, Cloudflare R2). The server holds the provider's long-lived secret key;
 * a caller (the WordPress plugin, or our own pipeline) only ever receives a
 * short-lived signed URL to PUT the backup archive to directly.
 */
import { Router, Request, Response } from "express";
import prisma from "../prisma";
import logger from "../utils/logger";
import { requireSiteApiKey, AuthedRequest } from "../middleware/apiAuth";
import { createPresignedUploadUrl, parseS3ProviderConfig } from "../utils/s3-storage";

const router = Router();

router.post("/presign-upload", requireSiteApiKey, async (req: AuthedRequest, res: Response) => {
  try {
    const { storage_provider_id, filename, content_type } = req.body || {};

    if (!storage_provider_id || !filename) {
      return res.status(400).json({ status: "error", message: "storage_provider_id and filename are required" });
    }

    const provider = await prisma.storageProvider.findUnique({ where: { id: Number(storage_provider_id) } });
    if (!provider) {
      return res.status(404).json({ status: "error", message: "Storage provider not found" });
    }

    if (!["s3", "b2", "r2"].includes(provider.type)) {
      return res.status(400).json({ status: "error", message: `Storage provider type "${provider.type}" is not S3-compatible` });
    }

    const s3Config = parseS3ProviderConfig(provider.type, provider.config);
    const key = `sites/${req.site!.id}/${Date.now()}-${filename}`.replace(/\s+/g, "-");

    const upload = await createPresignedUploadUrl(s3Config, key, { contentType: content_type });

    res.json({ status: "success", ...upload, bucket: s3Config.bucket, provider: provider.type });
  } catch (error) {
    logger.error("presign-upload error", { error });
    res.status(500).json({ status: "error", message: "Failed to create presigned upload URL" });
  }
});

export default router;
