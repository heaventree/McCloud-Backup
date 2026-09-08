#!/usr/bin/env node
/**
 * Prune local backup files under temp/ for backups that no longer need them.
 *
 * Stopgap disk-safety net for the VPS, run from its own crontab, independent of the app
 * process. It is deliberately conservative: it only ever removes temp/<processId>/ where
 *
 *   - the matching backups row is in a terminal state (completed / failed / upload_failed),
 *     so nothing will ever read those files again; or
 *   - no backups row references that processId at all (an orphan directory), AND the
 *     directory was last modified more than ORPHAN_MIN_AGE_HOURS ago, so a run that was
 *     started moments ago but hasn't been recorded yet is never touched.
 *
 * Anything belonging to a backup still in flight (in_progress / capturing / captured /
 * uploading / ready / streaming) is always left alone.
 *
 * Once the streaming pipeline (commit 7d93058) is deployed, nothing writes to temp/ anymore
 * and this script finds nothing to do - it is safe to keep on the crontab until temp/ is
 * removed entirely.
 *
 * Usage (from the app root, so .env and node_modules resolve):
 *   node scripts/prune-temp.js            # delete
 *   node scripts/prune-temp.js --dry-run  # report only
 *
 * Suggested crontab entry (hourly):
 *   0 * * * * cd /home/heaventree/McCloud-Backup && /usr/bin/node scripts/prune-temp.js >> logs/prune-temp.log 2>&1
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const APP_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TEMP_DIR = path.join(APP_ROOT, 'temp');
const TERMINAL_STATUSES = ['completed', 'failed', 'upload_failed'];
const ORPHAN_MIN_AGE_HOURS = 24;
const PROCESS_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

const dryRun = process.argv.includes('--dry-run');

dotenv.config({ path: path.join(APP_ROOT, '.env') });

function log(message) {
  console.log(`${new Date().toISOString()} ${message}`);
}

async function directorySizeBytes(dir) {
  let total = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await directorySizeBytes(full);
    } else if (entry.isFile()) {
      total += (await fs.stat(full)).size;
    }
  }
  return total;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set (checked environment and .env in the app root) - refusing to run');
    process.exit(2);
  }

  let entries;
  try {
    entries = await fs.readdir(TEMP_DIR, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      log(`temp/ does not exist at ${TEMP_DIR} - nothing to prune`);
      return;
    }
    throw error;
  }

  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
  if (dirs.length === 0) {
    log('temp/ is empty - nothing to prune');
    return;
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  let statusByProcessId;
  try {
    const result = await pool.query(
      'SELECT process_id, status FROM backups WHERE process_id = ANY($1::text[])',
      [dirs]
    );
    statusByProcessId = new Map(result.rows.map(r => [r.process_id, r.status]));
  } finally {
    await pool.end();
  }

  const now = Date.now();
  let removed = 0;
  let removedBytes = 0;
  let kept = 0;
  let skippedUnsafe = 0;

  for (const name of dirs) {
    const dir = path.join(TEMP_DIR, name);

    if (!PROCESS_ID_PATTERN.test(name)) {
      // Not something this app created - never touch it.
      skippedUnsafe++;
      log(`SKIP  ${name}: unexpected directory name, not a processId`);
      continue;
    }

    const status = statusByProcessId.get(name);
    let reason;

    if (status === undefined) {
      const ageHours = (now - (await fs.stat(dir)).mtimeMs) / 3_600_000;
      if (ageHours < ORPHAN_MIN_AGE_HOURS) {
        kept++;
        log(`KEEP  ${name}: no backups row yet, modified ${ageHours.toFixed(1)}h ago (< ${ORPHAN_MIN_AGE_HOURS}h)`);
        continue;
      }
      reason = `orphan, no backups row, last modified ${ageHours.toFixed(1)}h ago`;
    } else if (TERMINAL_STATUSES.includes(status)) {
      reason = `backup status '${status}'`;
    } else {
      kept++;
      log(`KEEP  ${name}: backup status '${status}' is not terminal`);
      continue;
    }

    const bytes = await directorySizeBytes(dir);
    if (dryRun) {
      log(`WOULD REMOVE ${name} (${formatBytes(bytes)}): ${reason}`);
    } else {
      await fs.rm(dir, { recursive: true, force: true });
      log(`REMOVED ${name} (${formatBytes(bytes)}): ${reason}`);
    }
    removed++;
    removedBytes += bytes;
  }

  log(
    `${dryRun ? 'Dry run: ' : ''}${removed} directory(ies) ${dryRun ? 'would be ' : ''}removed (${formatBytes(removedBytes)}), ` +
      `${kept} kept, ${skippedUnsafe} skipped as unrecognised`
  );
}

main().catch(error => {
  console.error(`${new Date().toISOString()} prune-temp failed:`, error);
  process.exit(1);
});
