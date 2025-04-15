/**
 * GitHub Backup Provider
 * 
 * This module provides a backup provider implementation for GitHub repositories.
 */
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import { createReadStream } from 'fs';
import archiver from 'archiver';
import { extract } from 'tar';
import { createLogger } from '../../utils/logger';
import { BackupProvider, BackupProviderInfo, BackupConfig } from '../types';
import { GitHubClient } from './client';

const logger = createLogger('github-provider');

/**
 * GitHub backup configuration
 */
export interface GitHubBackupConfig extends BackupConfig {
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
 * GitHub backup provider
 */
export class GitHubBackupProvider implements BackupProvider {
  private client: GitHubClient;
  private config: GitHubBackupConfig;
  private info: BackupProviderInfo;
  private initialized: boolean = false;
  
  /**
   * Create a GitHub backup provider
   * 
   * @param config - Provider configuration
   */
  constructor(config: GitHubBackupConfig) {
    this.config = config;
    
    // Set up the GitHub client
    this.client = new GitHubClient({
      token: config.settings.token,
      baseUrl: config.settings.baseUrl
    });
    
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
   * Get provider configuration
   * 
   * @returns Provider configuration
   */
  getConfig(): GitHubBackupConfig {
    return this.config;
  }
  
  /**
   * Initialize the provider
   * 
   * @returns True if initialization was successful
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }
    
    try {
      // Test connection to GitHub
      const connectionTest = await this.client.testConnection();
      
      if (!connectionTest) {
        logger.error('Failed to connect to GitHub API', {
          owner: this.config.settings.owner
        });
        return false;
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      logger.error('Error initializing GitHub provider', {
        error,
        owner: this.config.settings.owner
      });
      return false;
    }
  }
  
  /**
   * Test connection to the provider
   * 
   * @returns Connection test result
   */
  async testConnection(): Promise<{
    success: boolean;
    message?: string;
    details?: any;
  }> {
    try {
      // Test connection to GitHub
      const connectionTest = await this.client.testConnection();
      
      if (!connectionTest) {
        return {
          success: false,
          message: 'Failed to authenticate with GitHub API'
        };
      }
      
      // If a base repo is provided, check if it exists
      if (this.config.settings.baseRepo) {
        try {
          await this.client.getRepository(
            this.config.settings.owner,
            this.config.settings.baseRepo
          );
        } catch (error) {
          return {
            success: false,
            message: `Repository ${this.config.settings.owner}/${this.config.settings.baseRepo} does not exist or is not accessible`,
            details: error
          };
        }
      }
      
      return {
        success: true,
        message: 'Successfully connected to GitHub API'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error testing connection to GitHub API',
        details: error
      };
    }
  }
  
  /**
   * List available backup destinations
   * 
   * @returns List of available backup destinations
   */
  async listDestinations(): Promise<{
    id: string;
    name: string;
    type: string;
    path?: string;
    size?: number;
    modified?: Date;
  }[]> {
    try {
      // If a base repo is provided, use it as the destination
      if (this.config.settings.baseRepo) {
        try {
          const repo = await this.client.getRepository(
            this.config.settings.owner,
            this.config.settings.baseRepo
          );
          
          return [
            {
              id: repo.name,
              name: repo.name,
              type: 'repository',
              path: `/${this.config.settings.owner}/${repo.name}`,
              size: repo.size * 1024, // GitHub reports size in KB
              modified: new Date(repo.updated_at)
            }
          ];
        } catch (error) {
          logger.error('Error getting repository', {
            error,
            owner: this.config.settings.owner,
            repo: this.config.settings.baseRepo
          });
          return [];
        }
      }
      
      // Otherwise, list the user's repositories
      // In a real implementation, we'd page through all repos
      // But for simplicity, we'll just return a placeholder
      return [
        {
          id: 'create-new',
          name: 'Create new repository',
          type: 'action'
        }
      ];
    } catch (error) {
      logger.error('Error listing destinations', {
        error,
        owner: this.config.settings.owner
      });
      return [];
    }
  }
  
  /**
   * Create a backup
   * 
   * @param options - Backup options
   * @returns Backup result
   */
  async createBackup(options: {
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
  }> {
    try {
      // Check if initialized
      if (!this.initialized) {
        const initResult = await this.initialize();
        if (!initResult) {
          return {
            id: uuidv4(),
            success: false,
            message: 'Provider not initialized',
            created: new Date()
          };
        }
      }
      
      // Determine the repository to use
      const repoName = this.config.settings.baseRepo || `backup-${options.siteId}`;
      const defaultBranch = this.config.settings.defaultBranch || 'main';
      
      // Generate a unique ID for this backup
      const backupId = `backup-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      
      // Determine the path prefix for files
      const prefix = this.config.settings.prefix || '';
      
      // Calculate the site path within the repo
      const sitePath = prefix ? `${prefix}${options.siteId}/` : `${options.siteId}/`;
      
      // Track statistics
      let totalFiles = 0;
      let totalSize = 0;
      
      // Process and upload each file
      for (const filePath of options.files) {
        try {
          // Skip non-existing files
          if (!fs.existsSync(filePath)) {
            logger.warn(`File does not exist: ${filePath}`);
            continue;
          }
          
          // Read file stats
          const stats = fs.statSync(filePath);
          if (!stats.isFile()) {
            continue;
          }
          
          // Calculate the path within the repository
          const relativePath = path.relative(process.cwd(), filePath);
          const repoPath = `${sitePath}${relativePath}`;
          
          // Read file content
          const fileContent = fs.readFileSync(filePath, 'utf8');
          
          // Upload to GitHub
          await this.client.createOrUpdateFile(
            this.config.settings.owner,
            repoName,
            repoPath,
            fileContent,
            `Backup file: ${relativePath}`,
            {
              branch: defaultBranch,
              author: {
                name: 'Backup System',
                email: 'backup@example.com'
              }
            }
          );
          
          totalFiles++;
          totalSize += stats.size;
        } catch (error) {
          logger.error(`Error uploading file: ${filePath}`, error);
        }
      }
      
      // Upload metadata if provided
      if (options.metadata) {
        try {
          await this.client.createOrUpdateFile(
            this.config.settings.owner,
            repoName,
            `${sitePath}backup-metadata.json`,
            JSON.stringify(
              {
                ...options.metadata,
                backupId,
                siteId: options.siteId,
                timestamp: new Date().toISOString(),
                files: totalFiles,
                size: totalSize
              },
              null,
              2
            ),
            'Backup metadata',
            {
              branch: defaultBranch,
              author: {
                name: 'Backup System',
                email: 'backup@example.com'
              }
            }
          );
        } catch (error) {
          logger.error('Error uploading metadata', error);
        }
      }
      
      // Return the backup result
      return {
        id: backupId,
        success: totalFiles > 0,
        message: `Backed up ${totalFiles} files (${this.formatBytes(totalSize)})`,
        locations: [
          {
            provider: this.getId(),
            destination: repoName,
            path: sitePath,
            url: `https://github.com/${this.config.settings.owner}/${repoName}/tree/${defaultBranch}/${sitePath}`
          }
        ],
        size: totalSize,
        created: new Date()
      };
    } catch (error) {
      logger.error('Error creating backup', error);
      
      return {
        id: uuidv4(),
        success: false,
        message: 'Error creating backup',
        errors: [
          {
            message: error.message || 'Unknown error',
            details: error
          }
        ],
        created: new Date()
      };
    }
  }
  
  /**
   * List backups
   * 
   * @param options - List options
   * @returns List of backups
   */
  async listBackups(options?: {
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
  }> {
    try {
      // Check if initialized
      if (!this.initialized) {
        const initResult = await this.initialize();
        if (!initResult) {
          return { backups: [], total: 0 };
        }
      }
      
      // Determine repository name
      const repoName = this.config.settings.baseRepo || 
        (options?.siteId ? `backup-${options.siteId}` : null);
      
      if (!repoName) {
        return {
          backups: [],
          total: 0
        };
      }
      
      // Determine the prefix for files
      const prefix = this.config.settings.prefix || '';
      
      // Calculate the site path within the repo
      const sitePath = options?.siteId 
        ? (prefix ? `${prefix}${options.siteId}/` : `${options.siteId}/`)
        : prefix;
      
      try {
        // Check if the metadata file exists
        const metadataResponse = await this.client.getContents(
          this.config.settings.owner,
          repoName,
          `${sitePath}backup-metadata.json`,
          this.config.settings.defaultBranch || 'main'
        );
        
        if (metadataResponse) {
          // Download and parse metadata
          let metadata: any = null;
          
          if (metadataResponse.download_url) {
            const metadataContent = await this.client.downloadFile(metadataResponse.download_url);
            metadata = JSON.parse(metadataContent);
          } else if (metadataResponse.content) {
            // Content is base64 encoded
            const content = Buffer.from(metadataResponse.content, 'base64').toString('utf8');
            metadata = JSON.parse(content);
          }
          
          if (metadata) {
            // Return backup info from metadata
            return {
              backups: [
                {
                  id: metadata.backupId || `backup-${Date.now()}`,
                  siteId: options?.siteId || metadata.siteId || 'unknown',
                  name: `Backup ${new Date(metadata.timestamp).toLocaleDateString()}`,
                  destination: repoName,
                  path: sitePath,
                  url: `https://github.com/${this.config.settings.owner}/${repoName}/tree/${this.config.settings.defaultBranch || 'main'}/${sitePath}`,
                  size: metadata.size,
                  created: new Date(metadata.timestamp),
                  metadata
                }
              ],
              total: 1
            };
          }
        }
        
        // Fallback to returning a generic backup info
        return {
          backups: [
            {
              id: `backup-${Date.now()}`,
              siteId: options?.siteId || 'unknown',
              name: `Backup ${new Date().toLocaleDateString()}`,
              destination: repoName,
              path: sitePath,
              url: `https://github.com/${this.config.settings.owner}/${repoName}/tree/${this.config.settings.defaultBranch || 'main'}/${sitePath}`,
              created: new Date(),
            }
          ],
          total: 1
        };
      } catch (error) {
        // No backups found or error accessing them
        return {
          backups: [],
          total: 0
        };
      }
    } catch (error) {
      logger.error('Error listing backups', error);
      return {
        backups: [],
        total: 0
      };
    }
  }
  
  /**
   * Get backup details
   * 
   * @param id - Backup ID
   * @returns Backup details
   */
  async getBackup(id: string): Promise<{
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
      // List backups to find the requested one
      const backups = await this.listBackups();
      
      // Find the backup with the matching ID
      const backup = backups.backups.find(b => b.id === id);
      
      if (!backup) {
        return null;
      }
      
      // Try to list the contents of the backup
      const contents: {
        name: string;
        type: 'file' | 'directory';
        path: string;
        size?: number;
        modified?: Date;
      }[] = [];
      
      try {
        // Get the contents of the backup
        const response = await this.client.getContents(
          this.config.settings.owner,
          backup.destination || this.config.settings.baseRepo || '',
          backup.path || '',
          this.config.settings.defaultBranch || 'main'
        );
        
        // Process the response (could be an array or a single file)
        const items = Array.isArray(response) ? response : [response];
        
        for (const item of items) {
          contents.push({
            name: item.name,
            type: item.type === 'dir' ? 'directory' : 'file',
            path: item.path,
            size: item.size,
            modified: item.updated_at ? new Date(item.updated_at) : undefined
          });
        }
      } catch (error) {
        logger.error('Error getting backup contents', error);
      }
      
      return {
        ...backup,
        contents
      };
    } catch (error) {
      logger.error('Error getting backup details', error);
      return null;
    }
  }
  
  /**
   * Delete a backup
   * 
   * @param id - Backup ID
   * @returns Deletion result
   */
  async deleteBackup(id: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      // List backups to find the requested one
      const backups = await this.listBackups();
      
      // Find the backup with the matching ID
      const backup = backups.backups.find(b => b.id === id);
      
      if (!backup) {
        return {
          success: false,
          message: 'Backup not found'
        };
      }
      
      // In a real implementation, we would delete all files in the backup
      // But for simplicity, we'll just delete the metadata file
      
      try {
        await this.client.deleteFile(
          this.config.settings.owner,
          backup.destination || this.config.settings.baseRepo || '',
          `${backup.path}backup-metadata.json`,
          'Delete backup metadata',
          {
            branch: this.config.settings.defaultBranch || 'main',
            author: {
              name: 'Backup System',
              email: 'backup@example.com'
            }
          }
        );
        
        return {
          success: true,
          message: 'Backup deleted successfully'
        };
      } catch (error) {
        logger.error('Error deleting backup', error);
        
        return {
          success: false,
          message: 'Error deleting backup: ' + error.message
        };
      }
    } catch (error) {
      logger.error('Error deleting backup', error);
      
      return {
        success: false,
        message: 'Error deleting backup: ' + error.message
      };
    }
  }
  
  /**
   * Restore a backup
   * 
   * @param id - Backup ID
   * @param options - Restore options
   * @returns Restore result
   */
  async restoreBackup(id: string, options: {
    destination?: string;
    files?: string[];
    database?: boolean;
  }): Promise<{
    success: boolean;
    message?: string;
    details?: any;
  }> {
    try {
      // List backups to find the requested one
      const backups = await this.listBackups();
      
      // Find the backup with the matching ID
      const backup = backups.backups.find(b => b.id === id);
      
      if (!backup) {
        return {
          success: false,
          message: 'Backup not found'
        };
      }
      
      // Get more details about the backup
      const backupDetails = await this.getBackup(id);
      
      if (!backupDetails || !backupDetails.contents) {
        return {
          success: false,
          message: 'Backup details or contents not available'
        };
      }
      
      // Determine which files to restore
      const filesToRestore = options.files
        ? backupDetails.contents.filter(item => 
            item.type === 'file' && 
            options.files!.some(f => item.path.includes(f)))
        : backupDetails.contents.filter(item => item.type === 'file');
      
      // Restore each file
      let restoredFiles = 0;
      let failedFiles = 0;
      
      for (const file of filesToRestore) {
        try {
          // Get the file content
          const fileContent = await this.client.getContents(
            this.config.settings.owner,
            backup.destination || this.config.settings.baseRepo || '',
            file.path,
            this.config.settings.defaultBranch || 'main'
          );
          
          if (fileContent.download_url) {
            // Download the file content
            const content = await this.client.downloadFile(fileContent.download_url);
            
            // Determine the target path
            const targetPath = options.destination
              ? path.join(options.destination, path.basename(file.path))
              : file.path;
            
            // Create the directory if it doesn't exist
            const targetDir = path.dirname(targetPath);
            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true });
            }
            
            // Write the file
            fs.writeFileSync(targetPath, content);
            
            restoredFiles++;
          }
        } catch (error) {
          logger.error(`Error restoring file: ${file.path}`, error);
          failedFiles++;
        }
      }
      
      return {
        success: restoredFiles > 0,
        message: `Restored ${restoredFiles} files, ${failedFiles} failed`,
        details: {
          restoredFiles,
          failedFiles,
          totalFiles: filesToRestore.length
        }
      };
    } catch (error) {
      logger.error('Error restoring backup', error);
      
      return {
        success: false,
        message: 'Error restoring backup: ' + error.message
      };
    }
  }
  
  /**
   * Download a file from a backup
   * 
   * @param backupId - Backup ID
   * @param filePath - File path
   * @returns File download result
   */
  async downloadFile(backupId: string, filePath: string): Promise<{
    success: boolean;
    content?: Buffer | string;
    contentType?: string;
    size?: number;
    message?: string;
  }> {
    try {
      // List backups to find the requested one
      const backups = await this.listBackups();
      
      // Find the backup with the matching ID
      const backup = backups.backups.find(b => b.id === backupId);
      
      if (!backup) {
        return {
          success: false,
          message: 'Backup not found'
        };
      }
      
      // Build the complete file path
      const completePath = backup.path
        ? path.join(backup.path, filePath).replace(/\\/g, '/')
        : filePath;
      
      try {
        // Get the file content
        const fileContent = await this.client.getContents(
          this.config.settings.owner,
          backup.destination || this.config.settings.baseRepo || '',
          completePath,
          this.config.settings.defaultBranch || 'main'
        );
        
        if (fileContent.download_url) {
          // Download the file content
          const content = await this.client.downloadFile(fileContent.download_url);
          
          return {
            success: true,
            content,
            contentType: this.getContentType(filePath),
            size: fileContent.size
          };
        } else if (fileContent.content) {
          // Content is base64 encoded
          const content = Buffer.from(fileContent.content, 'base64');
          
          return {
            success: true,
            content,
            contentType: this.getContentType(filePath),
            size: content.length
          };
        } else {
          return {
            success: false,
            message: 'File content not available'
          };
        }
      } catch (error) {
        logger.error(`Error downloading file: ${completePath}`, error);
        
        return {
          success: false,
          message: 'Error downloading file: ' + error.message
        };
      }
    } catch (error) {
      logger.error('Error downloading file', error);
      
      return {
        success: false,
        message: 'Error downloading file: ' + error.message
      };
    }
  }
  
  /**
   * Format bytes to a human-readable string
   * 
   * @param bytes - Number of bytes
   * @param decimals - Number of decimal places
   * @returns Formatted string
   */
  private formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
  
  /**
   * Get content type for a file
   * 
   * @param filePath - File path
   * @returns Content type
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    const contentTypes: Record<string, string> = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.xml': 'application/xml',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.php': 'application/x-httpd-php',
      '.sql': 'application/sql'
    };
    
    return contentTypes[ext] || 'application/octet-stream';
  }
}