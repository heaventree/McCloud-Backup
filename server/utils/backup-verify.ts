/**
 * Backup archive verification.
 *
 * After a backup file lands locally (or is downloaded to a temp path for
 * verification before/after upload), this checks that the zip's central
 * directory is intact and computes a SHA-256 checksum. A backup should only
 * ever be marked "completed" once this passes - otherwise it is "failed".
 */
import { createReadStream, promises as fs } from "fs";
import { createHash } from "crypto";
import logger from "./logger";

export interface VerifyResult {
  valid: boolean;
  checksum?: string;
  checksumAlgorithm: "sha256";
  error?: string;
  size?: number;
}

const EOCD_SIGNATURE = 0x06054b50; // End Of Central Directory record signature

/**
 * Minimal structural validation of a zip file: locates the End Of Central
 * Directory record and sanity-checks the entry count / offsets it declares,
 * without a full unzip. Catches truncated/corrupt uploads.
 */
async function validateZipStructure(filePath: string): Promise<{ valid: boolean; error?: string }> {
  const stat = await fs.stat(filePath);
  if (stat.size < 22) {
    return { valid: false, error: "File too small to be a valid zip archive" };
  }

  // EOCD is at least 22 bytes and can have a variable-length comment at the end,
  // so scan the last 64KB (max comment size) + 22 bytes for the signature.
  const scanSize = Math.min(stat.size, 65557);
  const buffer = Buffer.alloc(scanSize);
  const fh = await fs.open(filePath, "r");
  try {
    await fh.read(buffer, 0, scanSize, stat.size - scanSize);
  } finally {
    await fh.close();
  }

  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    return { valid: false, error: "End of central directory record not found (archive is truncated or corrupt)" };
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirSize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (centralDirOffset + centralDirSize > stat.size) {
    return { valid: false, error: "Central directory extends past end of file (archive is truncated)" };
  }

  if (totalEntries === 0) {
    return { valid: false, error: "Archive contains no entries" };
  }

  return { valid: true };
}

async function computeSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

export async function verifyBackupArchive(filePath: string): Promise<VerifyResult> {
  try {
    const stat = await fs.stat(filePath);
    const structural = await validateZipStructure(filePath);
    if (!structural.valid) {
      logger.warn("Backup archive failed structural validation", { filePath, error: structural.error });
      return { valid: false, error: structural.error, checksumAlgorithm: "sha256", size: stat.size };
    }

    const checksum = await computeSha256(filePath);
    return { valid: true, checksum, checksumAlgorithm: "sha256", size: stat.size };
  } catch (error) {
    logger.error("Backup verification failed", { filePath, error });
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown verification error",
      checksumAlgorithm: "sha256"
    };
  }
}

// Re-export for consumers that only need a checksum (e.g. non-zip DB dumps).
export { computeSha256 };
