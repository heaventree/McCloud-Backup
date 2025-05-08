// Site type
export interface Site {
  id: number;
  name: string;
  url: string;
  apiKey: string;
  createdAt: string;
}

// Storage Provider type 
export interface StorageProvider {
  id: number;
  name: string;
  type: string;
  credentials: {
    username?: string;
    password?: string;
    token?: string;
    path?: string;
    host?: string;
    port?: number;
  };
  createdAt: string;
}

// Backup type
export interface Backup {
  id: number;
  siteId: number;
  storageProviderId: number;
  status: string;
  type: string;
  size?: number;
  fileCount?: number;
  changedFiles?: number;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

// Backup Schedule type
export interface BackupSchedule {
  id: number;
  siteId: number;
  storageProviderId: number;
  frequency: string;
  retention: number;
  nextRun: string;
  createdAt: string;
  lastRun?: string;
  backupType: string;
  hourOfDay?: number;
  minuteOfHour?: number;
  dayOfWeek?: number;
  enabled?: boolean;
}

// Health Check Result type
export interface HealthCheckResult {
  overall_health?: {
    score: number;
    components?: Record<string, { score: number, issues?: string[] }>;
  };
  wordpress?: {
    version: string;
    is_latest: boolean;
    multisite: boolean;
  };
  database?: {
    size_bytes: number;
    size_formatted: string;
    tables_count: number;
    prefix: string;
  };
  security?: {
    ssl: boolean;
    file_editing: boolean;
    vulnerabilities?: {
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
  php?: {
    version: string;
    is_supported: boolean;
    memory_limit: string;
    max_execution_time: string;
  };
  plugins?: {
    active: number;
    inactive: number;
    updates_needed: number;
  };
  performance?: {
    post_revisions: number;
    transients: number;
    cache?: {
      object_cache: boolean;
      page_cache: boolean;
    }
  };
}

// Feedback type
export interface Feedback {
  id: number;
  projectId: string;
  pagePath: string;
  elementPath?: string;
  status: string;
  priority: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  comments?: FeedbackComment[];
  coordinates?: {
    x: number;
    y: number;
  };
}

// Feedback Comment type
export interface FeedbackComment {
  id: number;
  feedbackId: number;
  author: string;
  content: string;
  createdAt: string;
}

// Sidebar Item type
export interface SidebarItem {
  title: string;
  icon: string;
  path: string;
}

// Dashboard Stats type
export interface DashboardStats {
  totalSites: number;
  totalStorage: number | null;
  completedBackups: number;
  failedBackups: number;
}