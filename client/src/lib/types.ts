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
