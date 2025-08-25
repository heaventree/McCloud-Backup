import { z } from "zod";

// User types based on Prisma schema
export const insertUserSchema = z.object({
  username: z.string().min(1),
  email: z.string().email().optional(),
  password: z.string().min(1),
  role: z.string().default("user"),
});

export type User = {
  id: number;
  username: string;
  email: string | null;
  password: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertUser = z.infer<typeof insertUserSchema>;

// Site types based on Prisma schema
export const insertSiteSchema = z.object({
  name: z.string().min(1),
  url: z.string().min(1),
  apiKey: z.string().min(1),
  status: z.string().default("active"),
  lastBackup: z.date().optional(),
  backupFrequency: z.enum(["ondemand", "30min", "daily", "weekly", "monthly", "yearly"]).default("ondemand"),
  backupMode: z.enum(["ALL", "FILES", "DB"]).default("ALL"),
  storageProviderId: z.number().optional(),
  pluginVerified: z.boolean().default(false),
});

export type Site = {
  id: number;
  name: string;
  url: string;
  apiKey: string;
  status: string;
  lastBackup: Date | null;
  backupFrequency: string;
  backupMode: string;
  storageProviderId: number | null;
  pluginVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertSite = z.infer<typeof insertSiteSchema>;

// Storage Provider types based on Prisma schema
export const insertStorageProviderSchema = z.object({
  type: z.string().min(1),
  name: z.string().min(1),
  config: z.string(), // JSON string in Prisma schema
  enabled: z.boolean().default(true),
});

export type StorageProvider = {
  id: number;
  type: string;
  name: string;
  config: string; // JSON string in Prisma schema
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertStorageProvider = z.infer<typeof insertStorageProviderSchema>;

// Backup types based on Prisma schema
export const insertBackupSchema = z.object({
  siteId: z.number(),
  storageProviderId: z.number().optional(),
  filename: z.string().optional(),
  filesize: z.number().optional(),
  backupType: z.string().default("full"),
  status: z.string().default("pending"),
  storageType: z.string().optional(),
  storagePath: z.string().optional(),
  processId: z.string().optional(),
  metadata: z.string().optional(),
  error: z.string().optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
});

export type Backup = {
  id: number;
  siteId: number;
  storageProviderId: number | null;
  filename: string | null;
  filesize: number | null;
  backupType: string;
  status: string;
  storageType: string | null;
  storagePath: string | null;
  processId: string | null;
  metadata: string | null;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
};

export type InsertBackup = z.infer<typeof insertBackupSchema>;

// Feedback types based on Prisma schema
export const insertFeedbackSchema = z.object({
  siteId: z.number(),
  type: z.string(),
  content: z.string(),
  pageUrl: z.string(),
  status: z.string().default("new"),
  resolvedAt: z.date().optional(),
});

export type Feedback = {
  id: number;
  siteId: number;
  type: string;
  content: string;
  pageUrl: string;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
};

export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;

// Backup Schedule types (not in Prisma schema yet, keeping for interface compatibility)
export const insertBackupScheduleSchema = z.object({
  siteId: z.number(),
  storageProviderId: z.number(),
  frequency: z.string(),
  dayOfWeek: z.number().optional(),
  hourOfDay: z.number(),
  minuteOfHour: z.number(),
  backupType: z.string().default("full"),
  fullBackupFrequency: z.number().optional(),
  retentionCount: z.number().optional(),
  enabled: z.boolean().default(true),
});

export type BackupSchedule = {
  id: number;
  siteId: number;
  storageProviderId: number;
  frequency: string;
  dayOfWeek: number | null;
  hourOfDay: number;
  minuteOfHour: number;
  backupType: string;
  fullBackupFrequency: number | null;
  retentionCount: number | null;
  enabled: boolean;
  lastRun: Date | null;
  nextRun: Date | null;
  createdAt: Date;
};

export type InsertBackupSchedule = z.infer<typeof insertBackupScheduleSchema>;

// Additional schemas for route validation
export const incrementalBackupSchema = z.object({
  siteId: z.number(),
  storageProviderId: z.number().optional(),
  backupType: z.literal("incremental"),
  parentBackupId: z.number().optional(),
});

export const updateBackupStatusSchema = z.object({
  status: z.string(),
  filesize: z.number().optional(),
  error: z.string().optional(),
  metadata: z.string().optional(),
});

// Notification types for notification system
export const insertNotificationSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.enum(["success", "error", "warning", "info"]),
  category: z.enum(["backup", "token_refresh", "site_settings", "system"]).default("system"),
  siteId: z.number().optional(),
  storageProviderId: z.number().optional(),
  read: z.boolean().default(false),
  data: z.string().optional(), // JSON string for additional data
});

export type Notification = {
  id: number;
  title: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
  category: "backup" | "token_refresh" | "site_settings" | "system";
  siteId: number | null;
  storageProviderId: number | null;
  read: boolean;
  data: string | null; // JSON string for additional data
  createdAt: Date;
  updatedAt: Date;
};

export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// Notification Preferences types
export const insertNotificationPreferencesSchema = z.object({
  userId: z.number(),
  emailEnabled: z.boolean().default(false),
  emailAddress: z.string().email().optional().or(z.literal("")).transform(val => val === "" ? undefined : val),
  emailBackupCompleted: z.boolean().default(true),
  emailBackupFailed: z.boolean().default(true),
  emailStorageWarning: z.boolean().default(true),
  smsEnabled: z.boolean().default(false),
  smsPhoneNumber: z.string().optional().or(z.literal("")).transform(val => val === "" ? undefined : val),
  smsBackupFailed: z.boolean().default(true),
  smsCriticalStorageWarning: z.boolean().default(true),
});

export type NotificationPreferences = {
  id: number;
  userId: number;
  emailEnabled: boolean;
  emailAddress: string | null;
  emailBackupCompleted: boolean;
  emailBackupFailed: boolean;
  emailStorageWarning: boolean;
  smsEnabled: boolean;
  smsPhoneNumber: string | null;
  smsBackupFailed: boolean;
  smsCriticalStorageWarning: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;