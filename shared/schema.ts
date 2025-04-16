import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Site schema
export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  apiKey: text("api_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSiteSchema = createInsertSchema(sites).omit({
  id: true,
  createdAt: true,
});

export type Site = typeof sites.$inferSelect;
export type InsertSite = z.infer<typeof insertSiteSchema>;

// Storage Provider schema
export const storageProviders = pgTable("storage_providers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // "google_drive", "dropbox", "s3", etc.
  credentials: jsonb("credentials").notNull(),
  quota: integer("quota"), // in bytes, null means unlimited
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStorageProviderSchema = createInsertSchema(storageProviders).omit({
  id: true,
  createdAt: true,
});

export type StorageProvider = typeof storageProviders.$inferSelect;
export type InsertStorageProvider = z.infer<typeof insertStorageProviderSchema>;

// Backup Schedule schema
export const backupSchedules = pgTable("backup_schedules", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull(),
  storageProviderId: integer("storage_provider_id").notNull(),
  frequency: text("frequency").notNull(), // "daily", "weekly", "monthly", etc.
  dayOfWeek: integer("day_of_week"), // 0-6, null if not applicable
  hourOfDay: integer("hour_of_day").notNull(), // 0-23
  minuteOfHour: integer("minute_of_hour").notNull(), // 0-59
  backupType: text("backup_type").default("full").notNull(), // "full", "incremental"
  fullBackupFrequency: integer("full_backup_frequency"), // number of incremental backups before full backup
  retentionCount: integer("retention_count"), // number of backups to keep
  enabled: boolean("enabled").default(true).notNull(),
  lastRun: timestamp("last_run"),
  nextRun: timestamp("next_run"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBackupScheduleSchema = createInsertSchema(backupSchedules).omit({
  id: true,
  lastRun: true,
  nextRun: true,
  createdAt: true,
});

export type BackupSchedule = typeof backupSchedules.$inferSelect;
export type InsertBackupSchedule = z.infer<typeof insertBackupScheduleSchema>;

// Backup schema
export const backups = pgTable("backups", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull(),
  storageProviderId: integer("storage_provider_id").notNull(),
  status: text("status").notNull(), // "pending", "in_progress", "completed", "failed", etc.
  type: text("type").default("full").notNull(), // "full", "incremental", "differential"
  parentBackupId: integer("parent_backup_id"), // reference to parent backup for incremental backups
  size: integer("size"), // in bytes, null if not completed
  fileCount: integer("file_count"), // number of files backed up
  changedFiles: integer("changed_files"), // number of files changed since last backup (for incrementals)
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  error: text("error"), // error message if failed
});

export const insertBackupSchema = createInsertSchema(backups).omit({
  id: true,
  completedAt: true,
  error: true,
});

export type Backup = typeof backups.$inferSelect;
export type InsertBackup = z.infer<typeof insertBackupSchema>;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// Feedback schema
export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  projectId: text("project_id").notNull(), // Identifier for the project/app this feedback relates to
  pagePath: text("page_path").notNull(), // The URL path where feedback was given
  x: real("x").notNull(), // X position as percentage of viewport width
  y: real("y").notNull(), // Y position as percentage of viewport height
  elementPath: text("element_path"), // CSS path to the specific element (if any)
  comment: text("comment").notNull(), // The feedback text
  status: text("status").default("open").notNull(), // "open", "in-progress", "completed"
  priority: text("priority").default("medium").notNull(), // "low", "medium", "high"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  submittedBy: text("submitted_by"), // Optional user identifier
  screenshot: text("screenshot"), // Optional screenshot data URI
});

export const insertFeedbackSchema = createInsertSchema(feedback).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;

// Additional validation schemas for API endpoints
export const incrementalBackupSchema = z.object({
  siteId: z.number().int().positive().or(z.string().regex(/^\d+$/).transform(Number)),
  storageProviderId: z.number().int().positive().or(z.string().regex(/^\d+$/).transform(Number))
});

export const updateBackupStatusSchema = z.object({
  status: z.string().nonempty(),
  size: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
  fileCount: z.number().int().nonnegative().optional(),
  changedFiles: z.number().int().nonnegative().optional()
});

export type IncrementalBackupRequest = z.infer<typeof incrementalBackupSchema>;
export type UpdateBackupStatusRequest = z.infer<typeof updateBackupStatusSchema>;
