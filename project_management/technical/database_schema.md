# McCloud Backup - Database Schema

This document outlines the database schema for the McCloud Backup platform, detailing all tables, relationships, and their purpose within the application.

## Schema Overview

The McCloud Backup database is designed around several key entities:

1. **Users** - Application users
2. **Sites** - WordPress websites managed by the application
3. **Storage Providers** - Cloud storage services for backups
4. **Backup Schedules** - Scheduled backup configurations
5. **Backups** - Individual backup records and metadata
6. **Feedback** - User feedback and comments for visual feedback system

## Entity Relationship Diagram

```
┌─────────┐       ┌─────────┐       ┌──────────────────┐
│         │       │         │       │                  │
│  Users  │──1─┬─*│  Sites  │──1─┬─*│ Backup Schedules │
│         │    │  │         │    │  │                  │
└─────────┘    │  └─────────┘    │  └──────────────────┘
               │                 │
               │                 │  ┌──────────────────┐
               │                 │  │                  │
               └────────────────┼─*│      Backups      │
                                │  │                  │
┌─────────────────┐             │  └──────────────────┘
│                 │             │
│ Storage Providers │──1─────────┘
│                 │
└─────────────────┘

┌─────────┐       ┌───────────────────┐
│         │       │                   │
│ Feedback │──1─┬─*│ Feedback Comments │
│         │     │  │                   │
└─────────┘     │  └───────────────────┘
                │
```

## Tables

### Users

The `users` table stores application user information.

```typescript
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
```

### Sites

The `sites` table stores information about WordPress sites being managed.

```typescript
export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  apiKey: text("api_key").notNull(),
  status: text("status").notNull().default("active"),
  lastCheckedAt: timestamp("last_checked_at"),
  lastBackupAt: timestamp("last_backup_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Site = typeof sites.$inferSelect;
export type InsertSite = z.infer<typeof insertSiteSchema>;
```

### Storage Providers

The `storage_providers` table stores information about cloud storage providers.

```typescript
export const storageProviders = pgTable("storage_providers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "google-drive", "dropbox", "onedrive", "github", "s3"
  name: text("name").notNull(),
  config: json("config").notNull(), // Provider-specific configuration
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type StorageProvider = typeof storageProviders.$inferSelect;
export type InsertStorageProvider = z.infer<typeof insertStorageProviderSchema>;
```

### Backup Schedules

The `backup_schedules` table defines scheduled backup configurations.

```typescript
export const backupSchedules = pgTable("backup_schedules", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").references(() => sites.id, { onDelete: "cascade" }).notNull(),
  storageProviderId: integer("storage_provider_id").references(() => storageProviders.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  frequency: text("frequency").notNull(), // "daily", "weekly", "monthly", "custom"
  cronExpression: text("cron_expression"), // For custom schedules
  retention: integer("retention"), // Number of backups to keep
  includeDatabase: boolean("include_database").notNull().default(true),
  includeFiles: boolean("include_files").notNull().default(true),
  excludePaths: text("exclude_paths").array(), // Paths to exclude from backup
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type BackupSchedule = typeof backupSchedules.$inferSelect;
export type InsertBackupSchedule = z.infer<typeof insertBackupScheduleSchema>;
```

### Backups

The `backups` table stores information about individual backup executions.

```typescript
export const backups = pgTable("backups", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").references(() => sites.id, { onDelete: "cascade" }).notNull(),
  scheduleId: integer("schedule_id").references(() => backupSchedules.id, { onDelete: "set null" }),
  storageProviderId: integer("storage_provider_id").references(() => storageProviders.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(), // "full", "database", "files", "incremental"
  status: text("status").notNull(), // "pending", "in-progress", "completed", "failed"
  size: bigint("size", { mode: "number" }), // Size in bytes
  fileCount: integer("file_count"),
  changedFiles: integer("changed_files"),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  storageUrl: text("storage_url"), // URL or path in storage provider
  error: text("error"), // Error message if status is "failed"
  parentBackupId: integer("parent_backup_id").references(() => backups.id, { onDelete: "set null" }),
  metadata: json("metadata"), // Additional backup metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Backup = typeof backups.$inferSelect;
export type InsertBackup = z.infer<typeof insertBackupSchema>;
```

### Feedback

The `feedback` table stores feedback items from the visual feedback system.

```typescript
export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  projectId: text("project_id").notNull(),
  pagePath: text("page_path").notNull(),
  elementPath: text("element_path"),
  status: text("status").notNull().default("open"), // "open", "in-progress", "resolved", "closed"
  priority: text("priority").notNull().default("medium"), // "low", "medium", "high", "critical"
  title: text("title").notNull(),
  description: text("description").notNull(),
  assignedTo: text("assigned_to"),
  coordinates: json("coordinates").$type<{x: number, y: number}>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
```

### Feedback Comments

The `feedback_comments` table stores comments associated with feedback items.

```typescript
export const feedbackComments = pgTable("feedback_comments", {
  id: serial("id").primaryKey(),
  feedbackId: integer("feedback_id").references(() => feedback.id, { onDelete: "cascade" }).notNull(),
  author: text("author").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FeedbackComment = typeof feedbackComments.$inferSelect;
export type InsertFeedbackComment = z.infer<typeof insertFeedbackCommentSchema>;
```

## Schema Changes and Migrations

The database schema is managed using Drizzle ORM, which provides a type-safe way to define and interact with the database. Schema changes should follow this process:

1. Update the schema definitions in `shared/schema.ts`
2. Generate migration files using Drizzle Kit
   ```bash
   npm run migration:generate
   ```
3. Apply migrations to the database
   ```bash
   npm run migration:apply
   ```

## Schema Validation

The schema is validated using Zod, which provides runtime type validation. This ensures that data passed to and from the database conforms to the expected structure.

```typescript
export const insertSiteSchema = createInsertSchema(sites).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastCheckedAt: true,
  lastBackupAt: true,
});
```

## In-Memory Storage

For development and testing purposes, the application also supports an in-memory storage implementation that mimics the database schema but doesn't require a database connection.

```typescript
export class MemStorage implements IStorage {
  private usersMap: Map<number, User>;
  private sitesMap: Map<number, Site>;
  private storageProvidersMap: Map<number, StorageProvider>;
  private backupSchedulesMap: Map<number, BackupSchedule>;
  private backupsMap: Map<number, Backup>;
  private feedbackMap: Map<number, Feedback>;
  
  // Implementation methods...
}
```

## Type Safety

The database schema is designed to provide end-to-end type safety:

1. Database schema definitions using Drizzle ORM
2. Generated TypeScript types for database rows
3. Zod validation schemas for input/output validation
4. React Query strongly typed with appropriate types

This ensures consistency throughout the application and prevents type-related bugs.

---

*Last updated: April 15, 2025*