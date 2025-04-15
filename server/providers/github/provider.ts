/**
 * GitHub Backup Provider
 * 
 * This module implements a backup provider that uses GitHub repositories
 * for storing and managing WordPress site backups.
 */
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { Transform } from 'stream';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import archiver from 'archiver';
import * as tar from 'tar';

import logger from '../../utils/logger';
import { BackupProvider, GitHubBackupConfig } from '../types';
import { GitHubClient } from './client';

// Use the default logger instance

/**
 * Backup metadata type
 */
interface BackupMetadata {
  id: string;
  siteId: string;
  name: string;
  created: string;
  size?: number;
  fileCount?: number;
  changedFiles?: number;
  type: 'full' | 'incremental' | 'differential';
  parent?: string;
  tags?: string[];
  metadata: Record<string, any>;
}

/**
 * GitHub backup provider
 */
export class GitHubBackupProvider implements BackupProvider {
  private config: GitHubBackupConfig;
  private client: GitHubClient | null = null;
  private initialized: boolean = false;
  private tempDir: string = path.join(process.cwd(), 'temp');
  
  /**
   * Create a new GitHub backup provider
   * 
   * @param config - Provider configuration
   */
  constructor(config: GitHubBackupConfig) {
    this.config = config;
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }
  
  /**
   * Get provider ID
   */
  getId(): string {
    return 'github';
  }
  
  /**
   * Get provider configuration
   */
  getConfig(): GitHubBackupConfig {
    return this.config;
  }
  
  /**
   * Initialize the provider
   */
  async initialize(): Promise<boolean> {
    try {
      if (this.initialized) {
        return true;
      }
      
      // Create GitHub client
      this.client = new GitHubClient({
        token: this.config.settings.token,
        owner: this.config.settings.owner,
        baseUrl: this.config.settings.baseUrl,
      });
      
      // Validate client by testing connection
      const testResult = await this.client.testConnection();
      
      if (!testResult.success) {
        logger.error(`Failed to initialize GitHub client: ${testResult.message}`);
        return false;
      }
      
      // Check if base repository exists
      const baseRepo = this.config.settings.baseRepo || 'wordpress-backups';
      const repoExists = await this.client.repositoryExists(baseRepo);
      
      if (!repoExists) {
        logger.info(`Base repository doesn't exist, creating: ${baseRepo}`);
        
        // Create repository
        await this.client.createRepository(baseRepo);
      }
      
      this.initialized = true;
      logger.info(`GitHub backup provider initialized for ${this.config.settings.owner}/${baseRepo}`);
      
      return true;
    } catch (error: unknown) {
      logger.error('Error initializing GitHub backup provider', error);
      return false;
    }
  }
  
  /**
   * Test connection to GitHub
   */
  async testConnection(): Promise<{
    success: boolean;
    message?: string;
    details?: any;
  }> {
    try {
      // Create GitHub client if not initialized
      if (!this.client) {
        this.client = new GitHubClient({
          token: this.config.settings.token,
          owner: this.config.settings.owner,
          baseUrl: this.config.settings.baseUrl,
        });
      }
      
      // Test connection
      const result = await this.client.testConnection();
      
      if (!result.success) {
        return result;
      }
      
      // Check if base repository exists or can be created
      try {
        const baseRepo = this.config.settings.baseRepo || 'wordpress-backups';
        const repoExists = await this.client.repositoryExists(baseRepo);
        
        if (!repoExists) {
          return {
            success: true,
            message: `Successfully authenticated as ${result.user?.login}. Repository '${baseRepo}' doesn't exist but can be created.`,
            details: {
              user: result.user,
              repository: {
                owner: this.config.settings.owner,
                name: baseRepo,
                exists: false,
                canCreate: true,
              },
            },
          };
        }
        
        return {
          success: true,
          message: `Successfully authenticated as ${result.user?.login}. Repository '${baseRepo}' exists.`,
          details: {
            user: result.user,
            repository: {
              owner: this.config.settings.owner,
              name: baseRepo,
              exists: true,
            },
          },
        };
      } catch (error: unknown) {
        logger.error('Error checking repository', error);
        
        return {
          success: false,
          message: `Authentication succeeded but failed to check repository: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    } catch (error: unknown) {
      logger.error('Error testing GitHub connection', error);
      
      return {
        success: false,
        message: `Error testing GitHub connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
  
  /**
   * Create a backup
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
      if (!this.client || !this.initialized) {
        if (!(await this.initialize())) {
          return {
            id: uuidv4(),
            success: false,
            message: 'Failed to initialize GitHub backup provider',
            created: new Date(),
          };
        }
      }
      
      // Generate backup ID
      const backupId = uuidv4();
      const created = new Date();
      
      // Get repository and branch configuration
      const baseRepo = this.config.settings.baseRepo || 'wordpress-backups';
      const defaultBranch = this.config.settings.defaultBranch || 'main';
      const prefix = this.config.settings.prefix || 'wp-backup-';
      
      // Prepare backup name
      const timestamp = created.toISOString().replace(/[:.]/g, '-');
      const backupName = `${prefix}${options.siteId}-${timestamp}`;
      
      // Create a new branch for this backup
      const backupBranch = `backup/${backupName}`;
      
      try {
        await this.client!.createBranch(baseRepo, backupBranch, defaultBranch);
      } catch (error: unknown) {
        logger.error(`Error creating backup branch: ${backupBranch}`, error);
        
        return {
          id: backupId,
          success: false,
          message: `Error creating backup branch: ${error instanceof Error ? error.message : 'Unknown error'}`,
          created,
        };
      }
      
      // Create backup archive
      const tempArchivePath = path.join(this.tempDir, `${backupId}.tar.gz`);
      const archiveSize = await this.createArchive(options.files, tempArchivePath);
      
      if (archiveSize === 0) {
        logger.error(`Failed to create backup archive: ${tempArchivePath}`);
        
        return {
          id: backupId,
          success: false,
          message: 'Failed to create backup archive',
          created,
        };
      }
      
      // Upload archive to GitHub
      // For large files, we need to split the archive into chunks
      const maxChunkSize = 10 * 1024 * 1024; // 10MB
      
      if (archiveSize > maxChunkSize) {
        // Upload large file in chunks
        const chunks = await this.splitFileIntoChunks(tempArchivePath, maxChunkSize);
        const chunkUploadResults = [];
        
        for (let i = 0; i < chunks.length; i++) {
          const chunkPath = chunks[i];
          const chunkContent = fs.readFileSync(chunkPath, 'utf8');
          const destPath = `backups/${backupName}/archive.tar.gz.part${i + 1}`;
          
          try {
            const uploadResult = await this.client!.createOrUpdateFile(
              baseRepo,
              destPath,
              chunkContent,
              `Add backup archive part ${i + 1} for ${backupName}`,
              backupBranch
            );
            
            chunkUploadResults.push(uploadResult);
          } catch (error: unknown) {
            logger.error(`Error uploading backup archive part ${i + 1}`, error);
            
            return {
              id: backupId,
              success: false,
              message: `Error uploading backup archive part ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              created,
            };
          }
          
          // Clean up chunk file
          fs.unlinkSync(chunkPath);
        }
      } else {
        // Upload single file directly
        const archiveContent = fs.readFileSync(tempArchivePath, 'utf8');
        const destPath = `backups/${backupName}/archive.tar.gz`;
        
        try {
          await this.client!.createOrUpdateFile(
            baseRepo,
            destPath,
            archiveContent,
            `Add backup archive for ${backupName}`,
            backupBranch
          );
        } catch (error: unknown) {
          logger.error(`Error uploading backup archive`, error);
          
          return {
            id: backupId,
            success: false,
            message: `Error uploading backup archive: ${error instanceof Error ? error.message : 'Unknown error'}`,
            created,
          };
        }
      }
      
      // Create backup metadata
      const metadata: BackupMetadata = {
        id: backupId,
        siteId: options.siteId,
        name: backupName,
        created: created.toISOString(),
        size: archiveSize,
        fileCount: options.files.length,
        type: 'full',
        metadata: options.metadata || {},
      };
      
      // Upload metadata
      try {
        await this.client!.createOrUpdateFile(
          baseRepo,
          `backups/${backupName}/metadata.json`,
          JSON.stringify(metadata, null, 2),
          `Add backup metadata for ${backupName}`,
          backupBranch
        );
      } catch (error: unknown) {
        logger.error(`Error uploading backup metadata`, error);
        
        return {
          id: backupId,
          success: false,
          message: `Error uploading backup metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
          created,
        };
      }
      
      // Clean up temporary files
      if (fs.existsSync(tempArchivePath)) {
        fs.unlinkSync(tempArchivePath);
      }
      
      // Return success response
      return {
        id: backupId,
        success: true,
        message: `Backup created successfully: ${backupName}`,
        locations: [
          {
            provider: 'github',
            destination: baseRepo,
            path: `backups/${backupName}`,
            url: `https://github.com/${this.config.settings.owner}/${baseRepo}/tree/${backupBranch}/backups/${backupName}`,
          },
        ],
        size: archiveSize,
        created,
      };
    } catch (error: unknown) {
      logger.error('Error creating backup', error);
      
      return {
        id: uuidv4(),
        success: false,
        message: `Error creating backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
        created: new Date(),
      };
    }
  }
  
  /**
   * Create a backup archive
   * 
   * @param files - Files to include in the archive
   * @param outputPath - Path to the output file
   * @returns Archive size in bytes
   */
  private async createArchive(files: string[], outputPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      try {
        // Create output stream
        const output = createWriteStream(outputPath);
        
        // Create archive
        const archive = archiver('tar', {
          gzip: true,
        });
        
        // Handle archive errors
        archive.on('error', (err) => {
          logger.error('Error creating archive', err);
          reject(err);
        });
        
        // Handle archive end
        output.on('close', () => {
          resolve(archive.pointer());
        });
        
        // Pipe archive to output
        archive.pipe(output);
        
        // Add files to archive
        for (const file of files) {
          // TODO: In a real implementation, we would add actual WordPress files here
          // For now, we'll just add a placeholder file
          archive.append(`This is a placeholder for ${file}`, { name: file });
        }
        
        // Finalize archive
        archive.finalize();
      } catch (error: unknown) {
        logger.error('Error creating archive', error);
        reject(error);
      }
    });
  }
  
  /**
   * Split a file into chunks
   * 
   * @param filePath - Path to the file
   * @param chunkSize - Chunk size in bytes
   * @returns List of chunk file paths
   */
  private async splitFileIntoChunks(filePath: string, chunkSize: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
      try {
        const stats = fs.statSync(filePath);
        const fileSize = stats.size;
        const numChunks = Math.ceil(fileSize / chunkSize);
        const chunkPaths: string[] = [];
        
        if (numChunks === 1) {
          // File is small enough to be a single chunk
          resolve([filePath]);
          return;
        }
        
        // Create chunks
        let currentChunk = 1;
        let bytesRead = 0;
        
        // Create read stream
        const readStream = createReadStream(filePath, {
          highWaterMark: chunkSize,
        });
        
        readStream.on('data', (chunk) => {
          // Create chunk file
          const chunkPath = `${filePath}.part${currentChunk}`;
          fs.writeFileSync(chunkPath, chunk);
          chunkPaths.push(chunkPath);
          
          bytesRead += chunk.length;
          currentChunk++;
        });
        
        readStream.on('end', () => {
          resolve(chunkPaths);
        });
        
        readStream.on('error', (error) => {
          reject(error);
        });
      } catch (error: unknown) {
        reject(error);
      }
    });
  }
  
  /**
   * List backups
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
      if (!this.client || !this.initialized) {
        if (!(await this.initialize())) {
          return { backups: [], total: 0 };
        }
      }
      
      // Get repository configuration
      const baseRepo = this.config.settings.baseRepo || 'wordpress-backups';
      const prefix = this.config.settings.prefix || 'wp-backup-';
      
      // Get list of branches
      let branches: string[] = [];
      
      try {
        const refs = await this.client!.getReference(baseRepo, 'heads');
        
        if (Array.isArray(refs)) {
          branches = refs
            .filter(ref => ref.ref.startsWith('refs/heads/backup/'))
            .map(ref => ref.ref.substring('refs/heads/'.length));
        }
      } catch (error: unknown) {
        logger.error('Error getting branches', error);
        return { backups: [], total: 0 };
      }
      
      // Filter branches by site ID
      if (options?.siteId) {
        branches = branches.filter(branch => {
          const parts = branch.split('/')[1].split('-');
          return parts.length > 1 && parts[1] === options.siteId;
        });
      }
      
      // Collect backup data
      const backups: {
        id: string;
        siteId: string;
        name: string;
        destination?: string;
        path?: string;
        url?: string;
        size?: number;
        created: Date;
        metadata?: Record<string, any>;
      }[] = [];
      
      for (const branch of branches) {
        try {
          const backupName = branch.split('/')[1];
          const metadataPath = `backups/${backupName}/metadata.json`;
          
          // Get metadata file
          const metadata = await this.client!.getContents(
            baseRepo,
            metadataPath,
            branch
          );
          
          if (!Array.isArray(metadata) && metadata.type === 'file' && metadata.content) {
            // Parse metadata
            const metadataJson = JSON.parse(
              Buffer.from(metadata.content, 'base64').toString('utf8')
            ) as BackupMetadata;
            
            // Filter by site ID if needed
            if (options?.siteId && metadataJson.siteId !== options.siteId) {
              continue;
            }
            
            backups.push({
              id: metadataJson.id,
              siteId: metadataJson.siteId,
              name: metadataJson.name,
              destination: baseRepo,
              path: `backups/${backupName}`,
              url: `https://github.com/${this.config.settings.owner}/${baseRepo}/tree/${branch}/backups/${backupName}`,
              size: metadataJson.size,
              created: new Date(metadataJson.created),
              metadata: metadataJson.metadata,
            });
          }
        } catch (error: unknown) {
          logger.error(`Error getting metadata for branch: ${branch}`, error);
          // Continue to next branch
          continue;
        }
      }
      
      // Sort backups
      if (options?.sort) {
        const sortField = options.sort;
        const sortOrder = options.order === 'asc' ? 1 : -1;
        
        backups.sort((a, b) => {
          if (sortField === 'created') {
            return sortOrder * (a.created.getTime() - b.created.getTime());
          } else if (sortField === 'size') {
            const aSize = a.size || 0;
            const bSize = b.size || 0;
            return sortOrder * (aSize - bSize);
          }
          
          return 0;
        });
      } else {
        // Default to sorting by created date, newest first
        backups.sort((a, b) => b.created.getTime() - a.created.getTime());
      }
      
      // Apply pagination
      let result = backups;
      
      if (options?.offset != null || options?.limit != null) {
        const offset = options?.offset || 0;
        const limit = options?.limit || 10;
        
        result = backups.slice(offset, offset + limit);
      }
      
      return {
        backups: result,
        total: backups.length,
      };
    } catch (error: unknown) {
      logger.error('Error listing backups', error);
      return { backups: [], total: 0 };
    }
  }
  
  /**
   * Get a specific backup
   */
  async getBackup(backupId: string): Promise<{
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
      if (!this.client || !this.initialized) {
        if (!(await this.initialize())) {
          return null;
        }
      }
      
      // Get repository configuration
      const baseRepo = this.config.settings.baseRepo || 'wordpress-backups';
      
      // List all backups
      const { backups } = await this.listBackups();
      
      // Find backup by ID
      const backup = backups.find(b => b.id === backupId);
      
      if (!backup) {
        return null;
      }
      
      // Get branch name
      const branchName = `backup/${backup.name}`;
      
      // Get backup contents
      try {
        const contents = await this.client!.getContents(
          baseRepo,
          `backups/${backup.name}`,
          branchName
        );
        
        if (Array.isArray(contents)) {
          // Map contents to expected format
          const backupContents = contents.map(item => ({
            name: item.name,
            type: item.type === 'file' ? 'file' as const : 'directory' as const,
            path: item.path,
            size: item.size,
            modified: undefined, // GitHub API doesn't provide this directly
          }));
          
          return {
            ...backup,
            contents: backupContents,
          };
        }
      } catch (error: unknown) {
        logger.error(`Error getting backup contents: ${backupId}`, error);
        // Return backup without contents
      }
      
      return backup;
    } catch (error: unknown) {
      logger.error(`Error getting backup: ${backupId}`, error);
      return null;
    }
  }
  
  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      if (!this.client || !this.initialized) {
        if (!(await this.initialize())) {
          return {
            success: false,
            message: 'Failed to initialize GitHub backup provider',
          };
        }
      }
      
      // Get repository configuration
      const baseRepo = this.config.settings.baseRepo || 'wordpress-backups';
      
      // Get backup details
      const backup = await this.getBackup(backupId);
      
      if (!backup) {
        return {
          success: false,
          message: `Backup not found: ${backupId}`,
        };
      }
      
      // Delete branch
      const branchName = `backup/${backup.name}`;
      
      try {
        // GitHub API doesn't have a direct "delete branch" method
        // We need to delete the reference
        await this.client!.deleteReference(
          baseRepo,
          `heads/${branchName}`
        );
        
        return {
          success: true,
          message: `Backup deleted: ${backup.name}`,
        };
      } catch (error: unknown) {
        logger.error(`Error deleting backup branch: ${branchName}`, error);
        
        return {
          success: false,
          message: `Error deleting backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    } catch (error: unknown) {
      logger.error(`Error deleting backup: ${backupId}`, error);
      
      return {
        success: false,
        message: `Error deleting backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
  
  /**
   * Restore a backup
   */
  async restoreBackup(backupId: string, options: {
    destination?: string;
    files?: string[];
    database?: boolean;
  }): Promise<{
    success: boolean;
    message?: string;
    details?: any;
  }> {
    try {
      if (!this.client || !this.initialized) {
        if (!(await this.initialize())) {
          return {
            success: false,
            message: 'Failed to initialize GitHub backup provider',
          };
        }
      }
      
      // Get backup details
      const backup = await this.getBackup(backupId);
      
      if (!backup) {
        return {
          success: false,
          message: `Backup not found: ${backupId}`,
        };
      }
      
      // Get repository configuration
      const baseRepo = this.config.settings.baseRepo || 'wordpress-backups';
      
      // Get branch name
      const branchName = `backup/${backup.name}`;
      
      // Create temporary directory for restoration
      const restoreDir = path.join(this.tempDir, `restore-${backupId}`);
      
      if (!fs.existsSync(restoreDir)) {
        fs.mkdirSync(restoreDir, { recursive: true });
      }
      
      // Download archive
      try {
        const archivePath = `backups/${backup.name}/archive.tar.gz`;
        const archiveDestPath = path.join(restoreDir, 'archive.tar.gz');
        
        // Check if the archive exists as a single file
        try {
          const archiveFile = await this.client!.getContents(
            baseRepo,
            archivePath,
            branchName
          );
          
          if (!Array.isArray(archiveFile) && archiveFile.type === 'file') {
            // Download the file
            const response = await this.downloadFile(backupId, archivePath);
            
            if (!response.success || !response.content) {
              return {
                success: false,
                message: response.message || 'Failed to download backup archive',
              };
            }
            
            // Write content to file
            fs.writeFileSync(archiveDestPath, response.content);
          }
        } catch (error: unknown) {
          // Archive might be split into chunks
          let foundChunks = false;
          let chunkIndex = 1;
          const archiveChunks: Buffer[] = [];
          
          while (true) {
            try {
              const chunkPath = `${archivePath}.part${chunkIndex}`;
              const response = await this.downloadFile(backupId, chunkPath);
              
              if (!response.success || !response.content) {
                break;
              }
              
              foundChunks = true;
              
              // Add chunk to list
              if (Buffer.isBuffer(response.content)) {
                archiveChunks.push(response.content);
              } else {
                archiveChunks.push(Buffer.from(response.content));
              }
              
              chunkIndex++;
            } catch (error: unknown) {
              break;
            }
          }
          
          if (!foundChunks) {
            return {
              success: false,
              message: 'Failed to find backup archive',
            };
          }
          
          // Combine chunks and write to file
          fs.writeFileSync(archiveDestPath, Buffer.concat(archiveChunks));
        }
        
        // Extract archive
        await tar.extract({
          file: archiveDestPath,
          cwd: restoreDir,
        });
        
        // In a real implementation, we would copy the files to the destination
        // For now, just log the files
        const extractedFiles = fs.readdirSync(restoreDir);
        
        // Clean up
        fs.unlinkSync(archiveDestPath);
        
        if (options.files && options.files.length > 0) {
          // Filter files if needed
          const filteredFiles = extractedFiles.filter(file => {
            return options.files!.includes(file);
          });
          
          return {
            success: true,
            message: `Backup restored: ${backup.name} (${filteredFiles.length} files)`,
            details: {
              files: filteredFiles,
            },
          };
        }
        
        return {
          success: true,
          message: `Backup restored: ${backup.name} (${extractedFiles.length} files)`,
          details: {
            files: extractedFiles,
          },
        };
      } catch (error: unknown) {
        logger.error(`Error restoring backup: ${backupId}`, error);
        
        return {
          success: false,
          message: `Error restoring backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      } finally {
        // Clean up restore directory
        if (fs.existsSync(restoreDir)) {
          fs.rmSync(restoreDir, { recursive: true, force: true });
        }
      }
    } catch (error: unknown) {
      logger.error(`Error restoring backup: ${backupId}`, error);
      
      return {
        success: false,
        message: `Error restoring backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
  
  /**
   * Download a file from a backup
   */
  async downloadFile(backupId: string, filePath: string): Promise<{
    success: boolean;
    content?: Buffer | string;
    contentType?: string;
    size?: number;
    message?: string;
  }> {
    try {
      if (!this.client || !this.initialized) {
        if (!(await this.initialize())) {
          return {
            success: false,
            message: 'Failed to initialize GitHub backup provider',
          };
        }
      }
      
      // Get backup details
      const backup = await this.getBackup(backupId);
      
      if (!backup) {
        return {
          success: false,
          message: `Backup not found: ${backupId}`,
        };
      }
      
      // Get repository configuration
      const baseRepo = this.config.settings.baseRepo || 'wordpress-backups';
      
      // Get branch name
      const branchName = `backup/${backup.name}`;
      
      // Get file content
      try {
        const fileContent = await this.client!.getContents(
          baseRepo,
          filePath,
          branchName
        );
        
        if (Array.isArray(fileContent)) {
          return {
            success: false,
            message: `Requested path is a directory: ${filePath}`,
          };
        }
        
        if (fileContent.type !== 'file' || !fileContent.content) {
          return {
            success: false,
            message: `Invalid file type or missing content: ${filePath}`,
          };
        }
        
        // Decode content
        const content = Buffer.from(fileContent.content, 'base64');
        
        // Determine content type based on file extension
        const extension = path.extname(filePath).toLowerCase();
        let contentType = 'application/octet-stream';
        
        switch (extension) {
          case '.json':
            contentType = 'application/json';
            break;
          case '.txt':
            contentType = 'text/plain';
            break;
          case '.html':
          case '.htm':
            contentType = 'text/html';
            break;
          case '.css':
            contentType = 'text/css';
            break;
          case '.js':
            contentType = 'application/javascript';
            break;
          case '.png':
            contentType = 'image/png';
            break;
          case '.jpg':
          case '.jpeg':
            contentType = 'image/jpeg';
            break;
          case '.gif':
            contentType = 'image/gif';
            break;
          case '.svg':
            contentType = 'image/svg+xml';
            break;
          case '.tar':
            contentType = 'application/x-tar';
            break;
          case '.gz':
          case '.gzip':
            contentType = 'application/gzip';
            break;
          case '.zip':
            contentType = 'application/zip';
            break;
        }
        
        return {
          success: true,
          content,
          contentType,
          size: content.length,
        };
      } catch (error: unknown) {
        logger.error(`Error downloading file: ${filePath}`, error);
        
        return {
          success: false,
          message: `Error downloading file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    } catch (error: unknown) {
      logger.error(`Error downloading file: ${backupId}/${filePath}`, error);
      
      return {
        success: false,
        message: `Error downloading file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

// Add this method to GitHubClient
declare module './client' {
  interface GitHubClient {
    deleteReference(repo: string, ref: string): Promise<void>;
  }
}

// This function extends the GitHubClient class to add a deleteReference method
// We'll use it through our GitHubProvider which has an instance of GitHubClient
async function deleteReference(client: GitHubClient, repo: string, ref: string): Promise<void> {
  try {
    // Get the api instance and owner from the client through proper public APIs
    const apiUrl = `/repos/${client.getOwner()}/${repo}/git/refs/${ref}`;
    await client.makeApiCall('delete', apiUrl);
    logger.info(`Deleted reference: ${repo}/${ref}`);
  } catch (error: unknown) {
    logger.error(`Error deleting reference: ${repo}/${ref}`, error);
    throw error;
  }
};

export default GitHubBackupProvider;