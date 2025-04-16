/**
 * Backup Service
 * 
 * This module provides the service layer for backup management,
 * coordinating between the API routes and the provider implementations.
 */
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { BackupConfig, BackupProvider } from '../providers/types';
import * as providerRegistry from '../providers/registry';

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
      description: 'Sample GitHub backup configuration',
      settings: {
        repositoryName: 'wordpress-backup',
        repositoryOwner: 'your-username',
        token: 'your-github-token'
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
    const now = new Date();
    
    const newConfig: BackupConfig = {
      ...config,
      id: uuidv4(),
      created: now,
      updated: now
    };
    
    this.configStore.set(newConfig.id, newConfig);
    
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
    const existingConfig = this.configStore.get(id);
    
    if (!existingConfig) {
      return undefined;
    }
    
    const updatedConfig: BackupConfig = {
      ...existingConfig,
      ...config,
      updated: new Date()
    };
    
    this.configStore.set(id, updatedConfig);
    
    return updatedConfig;
  }
  
  /**
   * Delete a backup configuration
   * 
   * @param id - Configuration ID
   * @returns True if deletion was successful
   */
  deleteConfiguration(id: string): boolean {
    return this.configStore.delete(id);
  }
  
  /**
   * Test a provider connection
   * 
   * @param config - Provider configuration
   * @returns Test result
   */
  async testProviderConnection(config: BackupConfig): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      // Get provider instance
      const provider = await providerRegistry.getProvider(config);
      
      if (!provider) {
        return {
          success: false,
          message: `Provider not found: ${config.provider}`
        };
      }
      
      // Initialize provider if needed
      const initialized = await provider.initialize();
      
      if (!initialized) {
        return {
          success: false,
          message: `Failed to initialize provider: ${config.provider}`
        };
      }
      
      // Test connection
      const result = await provider.testConnection();
      
      return result;
    } catch (error: unknown) {
      logger.error(`Error testing provider connection: ${config.provider}`, error);
      
      return {
        success: false,
        message: `Error testing provider connection: ${error instanceof Error ? error.message : 'Unknown error'}`
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
    type: string;
    label: string;
    required: boolean;
    description?: string;
    options?: Array<{
      value: string;
      label: string;
    }>;
  }> {
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
      description?: string;
      includeDatabase?: boolean;
      includeUploads?: boolean;
      includePlugins?: boolean;
      includeThemes?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    message: string;
    backupId?: string;
    created?: Date;
  }> {
    try {
      const config = this.configStore.get(configId);
      
      if (!config) {
        return {
          success: false,
          message: `Configuration not found: ${configId}`
        };
      }
      
      // Get provider instance
      const provider = await providerRegistry.getProvider(config);
      
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
      
      // Create backup
      const result = await provider.createBackup(options);
      
      if (result.success) {
        logger.info(`Backup created: ${configId}/${result.backupId}`, {
          backupId: result.backupId,
          provider: config.provider
        });
      } else {
        logger.warn(`Failed to create backup: ${configId}`, {
          message: result.message,
          provider: config.provider
        });
      }
      
      return result;
    } catch (error: unknown) {
      logger.error(`Error creating backup: ${configId}`, error);
      
      return {
        success: false,
        message: `Error creating backup: ${error instanceof Error ? error.message : 'Unknown error'}`
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
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    success: boolean;
    message: string;
    backups?: Array<{
      id: string;
      description: string;
      size: number;
      created: Date;
    }>;
  }> {
    try {
      const config = this.configStore.get(configId);
      
      if (!config) {
        return {
          success: false,
          message: `Configuration not found: ${configId}`
        };
      }
      
      // Get provider instance
      const provider = await providerRegistry.getProvider(config);
      
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
      
      // List backups
      const result = await provider.listBackups(options);
      
      return result;
    } catch (error: unknown) {
      logger.error(`Error listing backups: ${configId}`, error);
      
      return {
        success: false,
        message: `Error listing backups: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
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
    success: boolean;
    message: string;
    backup?: {
      id: string;
      description: string;
      size: number;
      files: Array<{
        path: string;
        size: number;
        modified?: Date;
      }>;
      created: Date;
    };
  }> {
    try {
      const config = this.configStore.get(configId);
      
      if (!config) {
        return {
          success: false,
          message: `Configuration not found: ${configId}`
        };
      }
      
      // Get provider instance
      const provider = await providerRegistry.getProvider(config);
      
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
      
      // Get backup details
      const result = await provider.getBackupDetails(backupId);
      
      return result;
    } catch (error: unknown) {
      logger.error(`Error getting backup details: ${configId}/${backupId}`, error);
      
      return {
        success: false,
        message: `Error getting backup details: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
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
    message: string;
  }> {
    try {
      const config = this.configStore.get(configId);
      
      if (!config) {
        return {
          success: false,
          message: `Configuration not found: ${configId}`
        };
      }
      
      // Get provider instance
      const provider = await providerRegistry.getProvider(config);
      
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
      restoreDatabase?: boolean;
      restoreUploads?: boolean;
      restorePlugins?: boolean;
      restoreThemes?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const config = this.configStore.get(configId);
      
      if (!config) {
        return {
          success: false,
          message: `Configuration not found: ${configId}`
        };
      }
      
      // Get provider instance
      const provider = await providerRegistry.getProvider(config);
      
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
        logger.info(`Backup restored: ${configId}/${backupId}`);
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
    message: string;
    data?: Buffer;
    mimeType?: string;
  }> {
    try {
      const config = this.configStore.get(configId);
      
      if (!config) {
        return {
          success: false,
          message: `Configuration not found: ${configId}`
        };
      }
      
      // Get provider instance
      const provider = await providerRegistry.getProvider(config);
      
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

export const backupService = new BackupService();