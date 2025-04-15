/**
 * GitHub Backup Provider Factory
 * 
 * This module provides a factory for creating GitHub backup providers.
 */
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger';
import { BackupProviderFactory, BackupProviderInfo, BackupConfig } from '../types';
import { GitHubBackupProvider, GitHubBackupConfig } from './provider';

const logger = createLogger('github-provider-factory');

/**
 * GitHub backup provider factory
 */
export class GitHubBackupProviderFactory implements BackupProviderFactory {
  private info: BackupProviderInfo;
  
  /**
   * Create a new GitHub backup provider factory
   */
  constructor() {
    // Provider information
    this.info = {
      id: 'github',
      name: 'GitHub',
      description: 'Backup to GitHub repositories',
      icon: 'github',
      url: 'https://github.com',
      features: {
        versioning: true,
        incremental: true,
        retention: true,
        encryption: false,
        compression: true,
        deduplication: false,
        scheduling: true,
        restore: true,
        partial: true,
        browse: true
      },
      configFields: [
        {
          name: 'token',
          type: 'password',
          label: 'Personal Access Token',
          placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
          required: true,
          validation: {
            pattern: '^gh[a-zA-Z0-9_]+$',
            message: 'Invalid GitHub token format'
          }
        },
        {
          name: 'owner',
          type: 'text',
          label: 'Repository Owner',
          placeholder: 'username or organization',
          required: true
        },
        {
          name: 'baseRepo',
          type: 'text',
          label: 'Base Repository Name',
          placeholder: 'Leave empty to create per-site repositories',
          required: false
        },
        {
          name: 'defaultBranch',
          type: 'text',
          label: 'Default Branch',
          placeholder: 'main',
          required: false,
          defaultValue: 'main'
        },
        {
          name: 'prefix',
          type: 'text',
          label: 'Path Prefix',
          placeholder: 'sites/',
          required: false
        },
        {
          name: 'useOAuth',
          type: 'boolean',
          label: 'Use OAuth Access Token',
          required: false,
          defaultValue: false
        }
      ]
    };
  }
  
  /**
   * Get provider ID
   * 
   * @returns Provider ID
   */
  getId(): string {
    return this.info.id;
  }
  
  /**
   * Get provider information
   * 
   * @returns Provider information
   */
  getInfo(): BackupProviderInfo {
    return this.info;
  }
  
  /**
   * Create a backup provider instance
   * 
   * @param config - Provider configuration
   * @returns Backup provider instance
   */
  createProvider(config: BackupConfig): GitHubBackupProvider {
    const requiredFields = ['token', 'owner'];
    
    // Validate required fields
    for (const field of requiredFields) {
      if (!config.settings[field]) {
        logger.error(`Missing required field '${field}' in GitHub provider configuration`);
        throw new Error(`Missing required field '${field}' in GitHub provider configuration`);
      }
    }
    
    // Ensure all required properties are present
    const githubConfig: GitHubBackupConfig = {
      ...config,
      settings: {
        ...config.settings,
        // Set defaults for optional fields
        defaultBranch: config.settings.defaultBranch || 'main',
        prefix: config.settings.prefix || '',
        useOAuth: Boolean(config.settings.useOAuth)
      }
    };
    
    return new GitHubBackupProvider(githubConfig);
  }
}

// Export a factory instance for provider registration
export const githubBackupProviderFactory = new GitHubBackupProviderFactory();