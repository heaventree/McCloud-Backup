export interface Site {
  id: number;
  name: string;
  url: string;
  apiKey: string;
  createdAt: string;
}

export interface StorageProvider {
  id: number;
  name: string;
  type: string;
  credentials: Record<string, any>;
  quota: number | null;
  createdAt: string;
}

export interface BackupSchedule {
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
  lastRun: string | null;
  nextRun: string | null;
  createdAt: string;
  site?: Site;
  storageProvider?: StorageProvider;
}

export interface Backup {
  id: number;
  siteId: number;
  storageProviderId: number;
  status: string;
  type: string;
  parentBackupId: number | null;
  size: number | null;
  fileCount: number | null;
  changedFiles: number | null;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  site?: Site;
  storageProvider?: StorageProvider;
}

export interface DashboardStats {
  totalSites: number;
  totalStorage: number;
  completedBackups: number;
  failedBackups: number;
}

export interface SidebarItem {
  title: string;
  icon: string;
  path: string;
}

export interface HealthCheckResult {
  status: string;
  timestamp: string;
  overall_health: {
    score: number;
    status: string;
    components: Record<string, { score: number; weight: number }>;
  };
  wordpress: {
    version: string;
    latest_version: string;
    is_latest: boolean;
    updates: {
      core: any[];
      plugins: any[];
      themes: any[];
    };
    constants: Record<string, any>;
    file_permissions: {
      issues: any[];
    };
    multisite: boolean;
    health_score: number;
    status: string;
  };
  php: {
    version: string;
    recommended_version: string;
    is_supported: boolean;
    memory_limit: string;
    max_execution_time: string;
    extensions: Record<string, boolean>;
    health_score: number;
    status: string;
  };
  database: {
    version: string;
    size: number;
    size_formatted: string;
    tables_count: number;
    prefix: string;
    autoload_size: number;
    health_score: number;
    status: string;
  };
  server: {
    software: string;
    php_sapi: string;
    os: string;
    ssl: boolean;
    host_info: {
      provider: string;
    };
    time: string;
    directory_size: Record<string, number>;
    health_score: number;
    status: string;
  };
  plugins: {
    total: number;
    active: number;
    inactive: number;
    updates_needed: number;
    unoptimized: Array<{
      name: string;
      slug: string;
      reason: string;
    }>;
    health_score: number;
    status: string;
  };
  themes: {
    total: number;
    active: {
      name: string;
      version: string;
      author: string;
    };
    updates_needed: number;
    child_theme: boolean;
    health_score: number;
    status: string;
  };
  security: {
    file_editing: boolean;
    file_mods: boolean;
    ssl: boolean;
    db_prefix: boolean;
    users: {
      admin_user_exists: boolean;
      users_with_admin: number;
    };
    vulnerabilities: {
      total: number;
      items: any[];
    };
    health_score: number;
    status: string;
  };
  performance: {
    transients: number;
    post_revisions: number;
    auto_drafts: number;
    trash_posts: number;
    spam_comments: number;
    cron_jobs: Array<{
      hook: string;
      time: number;
      schedule: string;
      interval: number;
    }>;
    cache: {
      object_cache: boolean;
      page_cache: boolean;
    };
    health_score: number;
    status: string;
  };
}
