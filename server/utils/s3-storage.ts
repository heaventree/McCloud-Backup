/**
 * One S3-compatible client for Backblaze B2, Cloudflare R2, and real AWS S3.
 *
 * All three speak the S3 API; they differ only in endpoint/region/path-style
 * requirements, which is exactly what @aws-sdk/client-s3 lets us parameterize.
 * The server mints short-lived presigned PUT URLs so the long-lived secret
 * key never has to be sent to a WordPress site or the browser.
 */
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type S3CompatibleType = "s3" | "b2" | "r2";

export interface S3ProviderConfig {
  type: S3CompatibleType;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region?: string;
  // B2 and R2 both require an explicit endpoint; plain S3 can omit it.
  endpoint?: string;
}

/**
 * Builds an S3Client for whichever provider this config targets.
 *  - S3:  endpoint omitted, uses the standard AWS region endpoints.
 *  - R2:  endpoint = https://<account_id>.r2.cloudflarestorage.com, region "auto".
 *  - B2:  endpoint = https://s3.<region>.backblazeb2.com (S3-compatible API).
 */
export function createS3Client(config: S3ProviderConfig): S3Client {
  const region = config.region || (config.type === "r2" ? "auto" : "us-east-1");

  return new S3Client({
    region,
    endpoint: config.endpoint,
    // B2 and R2 both require (or strongly prefer) path-style addressing.
    forcePathStyle: config.type !== "s3",
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
}

export interface PresignedUpload {
  url: string;
  key: string;
  expiresIn: number;
}

/**
 * Mints a short-lived presigned PUT URL for a single backup object. The
 * caller (WordPress plugin, or our own backup pipeline) uploads directly to
 * the bucket with this URL - the secret key is never sent to the client.
 */
export async function createPresignedUploadUrl(
  config: S3ProviderConfig,
  key: string,
  options: { contentType?: string; expiresIn?: number } = {}
): Promise<PresignedUpload> {
  const client = createS3Client(config);
  const expiresIn = options.expiresIn ?? 900; // 15 minutes

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: options.contentType || "application/zip"
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  return { url, key, expiresIn };
}

/** Confirms an object actually landed in the bucket (used after upload, before marking a backup complete). */
export async function headObject(config: S3ProviderConfig, key: string) {
  const client = createS3Client(config);
  return client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
}

/** Builds a config from a StorageProvider row's parsed JSON `config` field. */
export function parseS3ProviderConfig(type: string, rawConfig: string | Record<string, unknown>): S3ProviderConfig {
  const cfg = typeof rawConfig === "string" ? JSON.parse(rawConfig) : rawConfig;
  const t = (type === "b2" || type === "r2" ? type : "s3") as S3CompatibleType;

  let endpoint = cfg.endpoint as string | undefined;
  if (!endpoint && t === "b2") {
    // e.g. https://s3.us-west-002.backblazeb2.com
    endpoint = cfg.region ? `https://s3.${cfg.region}.backblazeb2.com` : undefined;
  }
  if (!endpoint && t === "r2") {
    // e.g. https://<account_id>.r2.cloudflarestorage.com
    endpoint = cfg.accountId ? `https://${cfg.accountId}.r2.cloudflarestorage.com` : undefined;
  }

  return {
    type: t,
    accessKeyId: cfg.accessKeyId || cfg.access_key_id || cfg.applicationKeyId,
    secretAccessKey: cfg.secretAccessKey || cfg.secret_access_key || cfg.applicationKey,
    bucket: cfg.bucket,
    region: cfg.region,
    endpoint
  };
}
