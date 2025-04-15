/**
 * Backup Provider Types
 * 
 * This module defines the common interfaces and types for backup providers.
 */

/**
 * Backup provider metadata
 */
export interface BackupProviderInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  url?: string;
  features: {
    [key: string]: boolean;
  };
  configFields: {
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
  }[];
}

/**
 * Backup provider configuration
 */
export interface BackupConfig {
  id: string;
  provider: string;
  name: string;
  active: boolean;
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
  created: Date;
  updated: Date;
}

/**
 * Basic backup provider interface
 */
export interface BackupProvider {
  /**
   * Get provider ID
   */
  getId(): string;
  
  /**
   * Get provider information
   */
  getInfo(): BackupProviderInfo;

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
   * List available backup destinations
   */
  listDestinations(): Promise<{
    id: string;
    name: string;
    type: string;
    path?: string;
    size?: number;
    modified?: Date;
  }[]>;
  
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
   * Get backup details
   */
  getBackup(id: string): Promise<{
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
  deleteBackup(id: string): Promise<{
    success: boolean;
    message?: string;
  }>;
  
  /**
   * Restore a backup
   */
  restoreBackup(id: string, options: {
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
 * Factory for creating backup providers
 */
export interface BackupProviderFactory {
  /**
   * Get provider ID
   */
  getId(): string;
  
  /**
   * Get provider information
   */
  getInfo(): BackupProviderInfo;
  
  /**
   * Create a backup provider instance
   */
  createProvider(config: BackupConfig): BackupProvider;
}