/**
 * API authentication for server routes that were previously wide open.
 *
 * Two auth models are supported, both via the `Authorization: Bearer <key>` header
 * (falling back to an `x-api-key` header for convenience):
 *  - Site-level: the McCloud Backup WordPress plugin calls back into
 *    /v2/backup/* using the per-site key stored in Site.apiKey.
 *  - Account-level: the MainWP extension calls /api/mainwp/* using a key
 *    minted for the whole account and stored (hashed) in the ApiKey table.
 */
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import prisma from "../prisma";
import logger from "../utils/logger";

export interface AuthedRequest extends Request {
  site?: { id: number; url: string };
  apiKeyId?: number;
}

function extractKey(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }
  const alt = req.headers["x-api-key"];
  if (typeof alt === "string" && alt.length > 0) return alt;
  // The WP plugin also allows the key as a query/body param on GET/POST calls.
  const paramKey = (req.query.api_key as string) || (req.body && req.body.api_key);
  if (typeof paramKey === "string" && paramKey.length > 0) return paramKey;
  return undefined;
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Requires a valid per-site API key. Resolves the site by `site_id` (query,
 * body, or param) and checks it against that site's stored apiKey.
 */
export async function requireSiteApiKey(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const key = extractKey(req);
    if (!key) {
      return res.status(401).json({ status: "error", message: "Missing API key" });
    }

    const siteIdRaw = req.body?.site_id ?? req.query.site_id ?? req.params.siteId;
    const siteId = siteIdRaw !== undefined ? parseInt(String(siteIdRaw), 10) : NaN;

    if (isNaN(siteId)) {
      return res.status(400).json({ status: "error", message: "site_id is required" });
    }

    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site || !site.apiKey || site.apiKey !== key) {
      return res.status(401).json({ status: "error", message: "Invalid API key for site" });
    }

    req.site = { id: site.id, url: site.url };
    next();
  } catch (error) {
    logger.error("Site API key auth error", { error });
    res.status(500).json({ status: "error", message: "Auth check failed" });
  }
}

/**
 * Requires a valid account-level API key (used by the MainWP extension).
 * Keys are stored hashed in the ApiKey table with scope "account".
 */
export async function requireAccountApiKey(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const key = extractKey(req);
    if (!key) {
      return res.status(401).json({ status: "error", message: "Missing API key" });
    }

    const keyHash = hashApiKey(key);
    const record = await prisma.apiKey.findUnique({ where: { keyHash } });
    if (!record || !record.active || record.scope !== "account") {
      return res.status(401).json({ status: "error", message: "Invalid account API key" });
    }

    await prisma.apiKey.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() }
    }).catch(() => undefined);

    req.apiKeyId = record.id;
    next();
  } catch (error) {
    logger.error("Account API key auth error", { error });
    res.status(500).json({ status: "error", message: "Auth check failed" });
  }
}
