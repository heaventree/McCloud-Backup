import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
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
  frequency: text("frequency").notNull(), // "daily", "weekly", "monthly", etc.
  dayOfWeek: integer("day_of_week"), // 0-6, null if not applicable
  hourOfDay: integer("hour_of_day").notNull(), // 0-23
  minuteOfHour: integer("minute_of_hour").notNull(), // 0-59
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
  size: integer("size"), // in bytes, null if not completed
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
