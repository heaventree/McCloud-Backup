-- Add verification / incremental columns that server code already writes to
ALTER TABLE "backups" ADD COLUMN IF NOT EXISTS "parent_backup_id" INTEGER;
ALTER TABLE "backups" ADD COLUMN IF NOT EXISTS "file_count" INTEGER;
ALTER TABLE "backups" ADD COLUMN IF NOT EXISTS "changed_files" INTEGER;
ALTER TABLE "backups" ADD COLUMN IF NOT EXISTS "checksum" TEXT;
ALTER TABLE "backups" ADD COLUMN IF NOT EXISTS "checksum_algorithm" TEXT DEFAULT 'sha256';
ALTER TABLE "backups" ADD COLUMN IF NOT EXISTS "encrypted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "backups" ADD COLUMN IF NOT EXISTS "encryption_method" TEXT;

-- Backup schedules table (previously unimplemented in Prisma, only existed in the
-- unused Drizzle shared/schema.ts + in-memory MemStorage path)
CREATE TABLE IF NOT EXISTS "backup_schedules" (
    "id" SERIAL PRIMARY KEY,
    "site_id" INTEGER NOT NULL REFERENCES "sites"("id"),
    "storage_provider_id" INTEGER,
    "frequency" TEXT NOT NULL,
    "day_of_week" INTEGER,
    "hour_of_day" INTEGER NOT NULL,
    "minute_of_hour" INTEGER NOT NULL,
    "backup_type" TEXT NOT NULL DEFAULT 'full',
    "full_backup_frequency" INTEGER,
    "retention_count" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_run" TIMESTAMP(3),
    "next_run" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "backup_schedules_next_run_idx" ON "backup_schedules"("next_run");

-- API keys for site-level (plugin) and account-level (MainWP extension) auth
CREATE TABLE IF NOT EXISTS "api_keys" (
    "id" SERIAL PRIMARY KEY,
    "key_hash" TEXT NOT NULL UNIQUE,
    "label" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'account',
    "site_id" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
