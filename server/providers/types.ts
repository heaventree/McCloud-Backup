/**
 * Backup Provider Types
 * 
 * This module defines the common interfaces and types for backup providers
 * to ensure consistent implementation across different providers.
 */

/**
 * Base backup configuration shared by all provider types
 */
export interface BaseBackupConfig {
  id: string;
  provider: string;
  name: string;
  active: boolean;
  created: Date;
  updated: Date;
  settings: Record<string, any>;
  schedule?: {
    frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
    hour?: number;
    minute?: number;
    dayOfWeek?: number;
    dayOfMonth?: number;
    customExpression?: string;
  };
  retention?: {
    count?: number;
    days?: number;
  };
  filters?: {
    include?: string[];
    exclude?: string[];
  };
}

/**
 * Basic backup config type aliases
 */
export type BackupConfig = BaseBackupConfig;

/**
 * Backup types
 */
export type BackupType = 'full' | 'incremental' | 'differential';

/**
 * Interface for backup providers
 */
export interface BackupProvider {
  /**
   * Get provider ID
   */
  getId(): string;
  
  /**
   * Get provider configuration
   */
  getConfig(): BackupConfig;
  
  /**
   * Initialize the provider
   */
  initialize(): Promise<boolean>;
  
  /**
   * Test connection to the provider
   */
  testConnection(): Promise<{
    success: boolean;
    message?: string;
    details?: any;
  }>;
  
  /**
   * Create a backup
   */
  createBackup(options: {
    siteId: string;
    files: string[];
    database?: boolean;
    destinations?: string[];
    metadata?: Record<string, any>;
  }): Promise<{
    id: string;
    success: boolean;
    message?: string;
    locations?: {
      provider: string;
      destination: string;
      path: string;
      url?: string;
    }[];
    errors?: {
      destination?: string;
      message: string;
      details?: any;
    }[];
    size?: number;
    created: Date;
  }>;
  
  /**
   * List backups
   */
  listBackups(options?: {
    siteId?: string;
    destination?: string;
    limit?: number;
    offset?: number;
    sort?: 'created' | 'size';
    order?: 'asc' | 'desc';
  }): Promise<{
    backups: {
      id: string;
      siteId: string;
      name: string;
      destination?: string;
      path?: string;
      url?: string;
      size?: number;
      created: Date;
      metadata?: Record<string, any>;
    }[];
    total: number;
  }>;
  
  /**
   * Get a specific backup
   */
  getBackup(backupId: string): Promise<{
    id: string;
    siteId: string;
    name: string;
    destination?: string;
    path?: string;
    url?: string;
    contents?: {
      name: string;
      type: 'file' | 'directory';
      path: string;
      size?: number;
      modified?: Date;
    }[];
    size?: number;
    created: Date;
    metadata?: Record<string, any>;
  } | null>;
  
  /**
   * Delete a backup
   */
  deleteBackup(backupId: string): Promise<{
    success: boolean;
    message?: string;
  }>;
  
  /**
   * Restore a backup
   */
  restoreBackup(backupId: string, options: {
    destination?: string;
    files?: string[];
    database?: boolean;
  }): Promise<{
    success: boolean;
    message?: string;
    details?: any;
  }>;
  
  /**
   * Download a file from a backup
   */
  downloadFile(backupId: string, filePath: string): Promise<{
    success: boolean;
    content?: Buffer | string;
    contentType?: string;
    size?: number;
    message?: string;
  }>;
}

/**
 * Interface for backup provider factories
 */
export interface BackupProviderFactory {
  /**
   * Get provider factory ID
   */
  getId(): string;
  
  /**
   * Get provider information
   */
  getInfo(): {
    id: string;
    name: string;
    description: string;
    icon: string;
    features: Record<string, boolean>;
    configFields: Array<{
      name: string;
      type: 'text' | 'password' | 'number' | 'boolean' | 'select';
      label: string;
      placeholder?: string;
      required: boolean;
      options?: { value: string; label: string }[];
      defaultValue?: any;
      validation?: {
        pattern?: string;
        min?: number;
        max?: number;
        message?: string;
      };
    }>;
  };
  
  /**
   * Validate provider configuration
   */
  validateConfig(config: Record<string, any>): {
    valid: boolean;
    errors?: Record<string, string>;
  };
  
  /**
   * Create a new provider instance
   */
  createProvider(config: BackupConfig): BackupProvider;
}

/**
 * GitHub specific provider types
 */
export interface GitHubBackupConfig extends BaseBackupConfig {
  settings: {
    token: string;
    owner: string;
    baseRepo?: string;
    useOAuth?: boolean;
    baseUrl?: string;
    defaultBranch?: string;
    prefix?: string;
  };
}

/**
 * Export type guard for GitHub configs
 */
export function isGitHubBackupConfig(config: BackupConfig): config is GitHubBackupConfig {
  return config.provider === 'github';
}