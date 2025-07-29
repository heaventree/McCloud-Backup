import { z } from "zod";

// User types based on Prisma schema
export const insertUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  role: z.string().default("user"),
});

export type User = {
  id: number;
  username: string;
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
});

export type Site = {
  id: number;
  name: string;
  url: string;
  apiKey: string;
  status: string;
  lastBackup: Date | null;
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