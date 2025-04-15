/**
 * Backup Service
 * 
 * This module provides the service layer for backup management,
 * coordinating between the API routes and the provider implementations.
 */
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { BackupConfig, BackupProvider } from '../providers/types';
import { providerRegistry } from '../providers/registry';

// Use the default logger instance

/**
 * Backup service for managing backup configurations and operations
 */
export class BackupService {
  private configStore: Map<string, BackupConfig>;
  
  /**
   * Create a new backup service
   */
  constructor() {
    this.configStore = new Map();
    
    // Load configurations from storage in a real implementation
    this.loadConfigurations();
  }
  
  /**
   * Load backup configurations from storage
   */
  private loadConfigurations(): void {
    // In a real implementation, this would load from a database
    // For now, we're using an in-memory store
    logger.info('Loading backup configurations');
    
    // Add sample configuration if needed for testing
    // this.addSampleConfiguration();
  }
  
  /**
   * Add a sample configuration for testing
   */
  private addSampleConfiguration(): void {
    // This is just for development/testing
    const sampleConfig: BackupConfig = {
      id: 'sample-github-config',
      provider: 'github',
      name: 'GitHub Backup',
      active: true,
      settings: {
        token: 'sample-token',
        owner: 'sample-owner',
        baseRepo: 'backup-repository',
        defaultBranch: 'main'
      },
      schedule: {
        frequency: 'daily',
        hour: 3,
        minute: 0
      },
      retention: {
        count: 10,
        days: 30
      },
      filters: {
        include: ['wp-content/themes/**', 'wp-content/plugins/**'],
        exclude: ['wp-content/cache/**', 'wp-content/uploads/backups/**']
      },
      created: new Date(),
      updated: new Date()
    };
    
    this.configStore.set(sampleConfig.id, sampleConfig);
  }
  
  /**
   * Get all backup configurations
   * 
   * @returns List of backup configurations
   */
  getAllConfigurations(): BackupConfig[] {
    return Array.from(this.configStore.values());
  }
  
  /**
   * Get a backup configuration by ID
   * 
   * @param id - Configuration ID
   * @returns Backup configuration
   */
  getConfiguration(id: string): BackupConfig | undefined {
    return this.configStore.get(id);
  }
  
  /**
   * Create a new backup configuration
   * 
   * @param config - Backup configuration
   * @returns Created backup configuration
   */
  createConfiguration(config: Omit<BackupConfig, 'id' | 'created' | 'updated'>): BackupConfig {
    // Generate a unique ID
    const id = uuidv4();
    
    // Create the configuration
    const newConfig: BackupConfig = {
      ...config,
      id,
      created: new Date(),
      updated: new Date()
    };
    
    // Store the configuration
    this.configStore.set(id, newConfig);
    
    logger.info(`Created configuration: ${id}`, { provider: newConfig.provider });
    
    return newConfig;
  }
  
  /**
   * Update a backup configuration
   * 
   * @param id - Configuration ID
   * @param config - Updated backup configuration
   * @returns Updated backup configuration
   */
  updateConfiguration(id: string, config: Partial<Omit<BackupConfig, 'id' | 'created' | 'updated'>>): BackupConfig | undefined {
    // Get existing configuration
    const existingConfig = this.configStore.get(id);
    
    if (!existingConfig) {
      logger.warn(`Configuration not found: ${id}`);
      return undefined;
    }
    
    // Update the configuration
    const updatedConfig: BackupConfig = {
      ...existingConfig,
      ...config,
      updated: new Date()
    };
    
    // Store the updated configuration
    this.configStore.set(id, updatedConfig);
    
    logger.info(`Updated configuration: ${id}`);
    
    return updatedConfig;
  }
  
  /**
   * Delete a backup configuration
   * 
   * @param id - Configuration ID
   * @returns True if deletion was successful
   */
  deleteConfiguration(id: string): boolean {
    // Check if configuration exists
    if (!this.configStore.has(id)) {
      logger.warn(`Configuration not found: ${id}`);
      return false;
    }
    
    // Delete the configuration
    const result = this.configStore.delete(id);
    
    if (result) {
      logger.info(`Deleted configuration: ${id}`);
    }
    
    return result;
  }
  
  /**
   * Test a provider configuration
   * 
   * @param config - Provider configuration
   * @returns Test result
   */
  async testProviderConnection(config: BackupConfig): Promise<{
    success: boolean;
    message?: string;
    details?: any;
  }> {
    try {
      // Get provider instance
      const provider = providerRegistry.getProvider(config);
      
      if (!provider) {
        return {
          success: false,
          message: `Provider not found: ${config.provider}`
        };
      }
      
      // Test connection
      return await provider.testConnection();
    } catch (error: unknown) {
      logger.error(`Error testing provider: ${config.provider}`, error);
      
      return {
        success: false,
        message: `Error testing provider: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * List available provider types
   * 
   * @returns List of available provider types
   */
  getAvailableProviders(): Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    features: Record<string, boolean>;
  }> {
    return providerRegistry.getAvailableProviders();
  }
  
  /**
   * Get provider configuration fields
   * 
   * @param providerId - Provider ID
   * @returns Provider configuration fields
   */
  getProviderConfigurationFields(providerId: string): Array<{
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
  }> | undefined {
    return providerRegistry.getProviderConfigurationFields(providerId);
  }
  
  /**
   * Create a backup
   * 
   * @param configId - Configuration ID
   * @param options - Backup options
   * @returns Backup result
   */
  async createBackup(
    configId: string,
    options: {
      siteId: string;
      files: string[];
      database?: boolean;
      destinations?: string[];
      metadata?: Record<string, any>;
    }
  ): Promise<{
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
  }> {
    try {
      // Get configuration
      const config = this.configStore.get(configId);
      
      if (!config) {
        return {
          id: uuidv4(),
          success: false,
          message: `Configuration not found: ${configId}`,
          created: new Date()
        };
      }
      
      // Get provider instance
      const provider = providerRegistry.getProvider(config);
      
      if (!provider) {
        return {
          id: uuidv4(),
          success: false,
          message: `Provider not found: ${config.provider}`,
          created: new Date()
        };
      }
      
      // Initialize provider if needed
      if (!(await provider.initialize())) {
        return {
          id: uuidv4(),
          success: false,
          message: `Failed to initialize provider: ${config.provider}`,
          created: new Date()
        };
      }
      
      // Create backup
      const result = await provider.createBackup(options);
      
      if (result.success) {
        logger.info(`Backup created: ${result.id}`, {
          configId,
          provider: config.provider,
          siteId: options.siteId
        });
      } else {
        logger.error(`Backup failed: ${configId}`, {
          provider: config.provider,
          siteId: options.siteId,
          errors: result.errors
        });
      }
      
      return result;
    } catch (error: unknown) {
      logger.error(`Error creating backup: ${configId}`, error);
      
      return {
        id: uuidv4(),
        success: false,
        message: `Error creating backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
        created: new Date()
      };
    }
  }
  
  /**
   * List backups
   * 
   * @param configId - Configuration ID
   * @param options - List options
   * @returns List of backups
   */
  async listBackups(
    configId: string,
    options?: {
      siteId?: string;
      destination?: string;
      limit?: number;
      offset?: number;
      sort?: 'created' | 'size';
      order?: 'asc' | 'desc';
    }
  ): Promise<{
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
  }> {
    try {
      // Get configuration
      const config = this.configStore.get(configId);
      
      if (!config) {
        logger.warn(`Configuration not found: ${configId}`);
        return { backups: [], total: 0 };
      }
      
      // Get provider instance
      const provider = providerRegistry.getProvider(config);
      
      if (!provider) {
        logger.warn(`Provider not found: ${config.provider}`);
        return { backups: [], total: 0 };
      }
      
      // Initialize provider if needed
      if (!(await provider.initialize())) {
        logger.error(`Failed to initialize provider: ${config.provider}`);
        return { backups: [], total: 0 };
      }
      
      // List backups
      return await provider.listBackups(options);
    } catch (error: unknown) {
      logger.error(`Error listing backups: ${configId}`, error);
      return { backups: [], total: 0 };
    }
  }
  
  /**
   * Get backup details
   * 
   * @param configId - Configuration ID
   * @param backupId - Backup ID
   * @returns Backup details
   */
  async getBackupDetails(
    configId: string,
    backupId: string
  ): Promise<{
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
  } | null> {
    try {
      // Get configuration
      const config = this.configStore.get(configId);
      
      if (!config) {
        logger.warn(`Configuration not found: ${configId}`);
        return null;
      }
      
      // Get provider instance
      const provider = providerRegistry.getProvider(config);
      
      if (!provider) {
        logger.warn(`Provider not found: ${config.provider}`);
        return null;
      }
      
      // Initialize provider if needed
      if (!(await provider.initialize())) {
        logger.error(`Failed to initialize provider: ${config.provider}`);
        return null;
      }
      
      // Get backup details
      return await provider.getBackup(backupId);
    } catch (error: unknown) {
      logger.error(`Error getting backup details: ${configId}/${backupId}`, error);
      return null;
    }
  }
  
  /**
   * Delete a backup
   * 
   * @param configId - Configuration ID
   * @param backupId - Backup ID
   * @returns Deletion result
   */
  async deleteBackup(
    configId: string,
    backupId: string
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      // Get configuration
      const config = this.configStore.get(configId);
      
      if (!config) {
        return {
          success: false,
          message: `Configuration not found: ${configId}`
        };
      }
      
      // Get provider instance
      const provider = providerRegistry.getProvider(config);
      
      if (!provider) {
        return {
          success: false,
          message: `Provider not found: ${config.provider}`
        };
      }
      
      // Initialize provider if needed
      if (!(await provider.initialize())) {
        return {
          success: false,
          message: `Failed to initialize provider: ${config.provider}`
        };
      }
      
      // Delete backup
      const result = await provider.deleteBackup(backupId);
      
      if (result.success) {
        logger.info(`Backup deleted: ${configId}/${backupId}`);
      } else {
        logger.warn(`Failed to delete backup: ${configId}/${backupId}`, {
          message: result.message
        });
      }
      
      return result;
    } catch (error: unknown) {
      logger.error(`Error deleting backup: ${configId}/${backupId}`, error);
      
      return {
        success: false,
        message: `Error deleting backup: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * Restore a backup
   * 
   * @param configId - Configuration ID
   * @param backupId - Backup ID
   * @param options - Restore options
   * @returns Restore result
   */
  async restoreBackup(
    configId: string,
    backupId: string,
    options: {
      destination?: string;
      files?: string[];
      database?: boolean;
    }
  ): Promise<{
    success: boolean;
    message?: string;
    details?: any;
  }> {
    try {
      // Get configuration
      const config = this.configStore.get(configId);
      
      if (!config) {
        return {
          success: false,
          message: `Configuration not found: ${configId}`
        };
      }
      
      // Get provider instance
      const provider = providerRegistry.getProvider(config);
      
      if (!provider) {
        return {
          success: false,
          message: `Provider not found: ${config.provider}`
        };
      }
      
      // Initialize provider if needed
      if (!(await provider.initialize())) {
        return {
          success: false,
          message: `Failed to initialize provider: ${config.provider}`
        };
      }
      
      // Restore backup
      const result = await provider.restoreBackup(backupId, options);
      
      if (result.success) {
        logger.info(`Backup restored: ${configId}/${backupId}`, {
          destination: options.destination,
          files: options.files?.length,
          database: options.database
        });
      } else {
        logger.warn(`Failed to restore backup: ${configId}/${backupId}`, {
          message: result.message
        });
      }
      
      return result;
    } catch (error: unknown) {
      logger.error(`Error restoring backup: ${configId}/${backupId}`, error);
      
      return {
        success: false,
        message: `Error restoring backup: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * Download a file from a backup
   * 
   * @param configId - Configuration ID
   * @param backupId - Backup ID
   * @param filePath - File path
   * @returns File download result
   */
  async downloadFile(
    configId: string,
    backupId: string,
    filePath: string
  ): Promise<{
    success: boolean;
    content?: Buffer | string;
    contentType?: string;
    size?: number;
    message?: string;
  }> {
    try {
      // Get configuration
      const config = this.configStore.get(configId);
      
      if (!config) {
        return {
          success: false,
          message: `Configuration not found: ${configId}`
        };
      }
      
      // Get provider instance
      const provider = providerRegistry.getProvider(config);
      
      if (!provider) {
        return {
          success: false,
          message: `Provider not found: ${config.provider}`
        };
      }
      
      // Initialize provider if needed
      if (!(await provider.initialize())) {
        return {
          success: false,
          message: `Failed to initialize provider: ${config.provider}`
        };
      }
      
      // Download file
      const result = await provider.downloadFile(backupId, filePath);
      
      if (result.success) {
        logger.info(`File downloaded: ${configId}/${backupId}/${filePath}`, {
          size: result.size
        });
      } else {
        logger.warn(`Failed to download file: ${configId}/${backupId}/${filePath}`, {
          message: result.message
        });
      }
      
      return result;
    } catch (error: unknown) {
      logger.error(`Error downloading file: ${configId}/${backupId}/${filePath}`, error);
      
      return {
        success: false,
        message: `Error downloading file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// Create singleton instance
export const backupService = new BackupService();

export default backupService;