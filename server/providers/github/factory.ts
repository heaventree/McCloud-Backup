/**
 * GitHub Backup Provider Factory
 * 
 * This module defines the factory for creating GitHub backup providers.
 */
import { z } from 'zod';
import { createLogger } from '../../utils/logger';
import { BackupProviderFactory, BackupConfig, GitHubBackupConfig, isGitHubBackupConfig } from '../types';
import { GitHubBackupProvider } from './provider';

const logger = createLogger('github-factory');

/**
 * Validation schema for GitHub backup provider configuration
 */
const githubConfigSchema = z.object({
  token: z.string().min(1, 'GitHub token is required'),
  owner: z.string().min(1, 'Repository owner (username or organization) is required'),
  baseRepo: z.string().optional(),
  useOAuth: z.boolean().optional().default(false),
  baseUrl: z.string().optional(),
  defaultBranch: z.string().optional().default('main'),
  prefix: z.string().optional(),
});

/**
 * GitHub Backup Provider Factory
 */
export class GitHubBackupProviderFactory implements BackupProviderFactory {
  /**
   * Get provider ID
   */
  getId(): string {
    return 'github';
  }
  
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
  } {
    return {
      id: 'github',
      name: 'GitHub',
      description: 'Backup WordPress sites to GitHub repositories',
      icon: 'github',
      features: {
        incremental: true,
        compression: true,
        encryption: false,
        versioning: true,
        scheduling: true,
        fileRestore: true,
      },
      configFields: [
        {
          name: 'token',
          type: 'password',
          label: 'GitHub Personal Access Token',
          placeholder: 'Enter your GitHub token',
          required: true,
          validation: {
            message: 'GitHub token is required and must have repo permissions.',
          },
        },
        {
          name: 'owner',
          type: 'text',
          label: 'Repository Owner',
          placeholder: 'Enter username or organization name',
          required: true,
          validation: {
            message: 'Repository owner is required.',
          },
        },
        {
          name: 'baseRepo',
          type: 'text',
          label: 'Repository Name',
          placeholder: 'e.g., wordpress-backups',
          required: false,
          defaultValue: 'wordpress-backups',
          validation: {
            message: 'Repository name must be valid GitHub repository name.',
          },
        },
        {
          name: 'useOAuth',
          type: 'boolean',
          label: 'Use OAuth (if authenticated via GitHub OAuth)',
          required: false,
          defaultValue: false,
        },
        {
          name: 'baseUrl',
          type: 'text',
          label: 'GitHub API URL (for GitHub Enterprise)',
          placeholder: 'https://api.github.com',
          required: false,
          defaultValue: 'https://api.github.com',
        },
        {
          name: 'defaultBranch',
          type: 'text',
          label: 'Default Branch',
          placeholder: 'main',
          required: false,
          defaultValue: 'main',
        },
        {
          name: 'prefix',
          type: 'text',
          label: 'Backup Prefix',
          placeholder: 'e.g., wp-backup-',
          required: false,
          defaultValue: 'wp-backup-',
        },
      ],
    };
  }
  
  /**
   * Validate provider configuration
   */
  validateConfig(config: Record<string, any>): {
    valid: boolean;
    errors?: Record<string, string>;
  } {
    try {
      // Validate configuration schema
      const result = githubConfigSchema.safeParse(config);
      
      if (!result.success) {
        // Format validation errors
        const errors: Record<string, string> = {};
        
        result.error.errors.forEach(error => {
          const path = error.path.join('.');
          errors[path] = error.message;
        });
        
        return {
          valid: false,
          errors,
        };
      }
      
      return {
        valid: true,
      };
    } catch (error: unknown) {
      logger.error('Error validating GitHub configuration', error);
      
      return {
        valid: false,
        errors: {
          '_': `Invalid configuration format: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      };
    }
  }
  
  /**
   * Create a new provider instance
   */
  createProvider(config: BackupConfig): GitHubBackupProvider {
    // Validate config type
    if (!isGitHubBackupConfig(config)) {
      throw new Error('Invalid GitHub backup configuration');
    }
    
    // Create provider
    return new GitHubBackupProvider(config);
  }
}

// Create singleton instance
export const githubBackupProviderFactory = new GitHubBackupProviderFactory();

export default githubBackupProviderFactory;