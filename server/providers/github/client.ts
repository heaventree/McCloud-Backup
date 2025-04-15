/**
 * GitHub API Client
 * 
 * This module provides a client for interacting with the GitHub API
 * to perform operations like repository access and file operations.
 */
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { createLogger } from '../../utils/logger';

const logger = createLogger('github-client');

/**
 * GitHub client configuration
 */
export interface GitHubClientConfig {
  token: string;
  baseUrl?: string;
  timeout?: number;
}

/**
 * GitHub API client for repository operations
 */
export class GitHubClient {
  private client: AxiosInstance;
  private config: GitHubClientConfig;
  
  /**
   * Create a GitHub client
   * 
   * @param config - Client configuration
   */
  constructor(config: GitHubClientConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || 'https://api.github.com',
      timeout: config.timeout || 10000
    };
    
    // Create axios instance
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${this.config.token}`,
        'User-Agent': 'WordPress-Backup-App'
      }
    });
    
    // Add response interceptor for rate limiting and error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        // Log API rate limits
        if (error.response) {
          const rateLimit = {
            limit: error.response.headers['x-ratelimit-limit'],
            remaining: error.response.headers['x-ratelimit-remaining'],
            reset: error.response.headers['x-ratelimit-reset'],
            used: error.response.headers['x-ratelimit-used']
          };
          
          if (rateLimit.limit) {
            logger.debug('GitHub API rate limit', rateLimit);
          }
          
          // Check if rate limited
          if (error.response.status === 403 && rateLimit.remaining === '0') {
            const resetDate = new Date(parseInt(rateLimit.reset, 10) * 1000);
            logger.warn(`GitHub API rate limit exceeded. Resets at ${resetDate.toISOString()}`);
            
            return Promise.reject(new Error(`GitHub API rate limit exceeded. Resets at ${resetDate.toLocaleString()}`));
          }
        }
        
        // Log error details
        logger.error('GitHub API error', {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        });
        
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Test the connection to GitHub API
   * 
   * @returns True if connection is successful
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/rate_limit');
      return response.status === 200;
    } catch (error) {
      logger.error('Error testing GitHub API connection', error);
      return false;
    }
  }
  
  /**
   * Get repository information
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @returns Repository information
   */
  async getRepository(owner: string, repo: string): Promise<any> {
    try {
      const response = await this.client.get(`/repos/${owner}/${repo}`);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        throw new Error(`Repository ${owner}/${repo} not found`);
      }
      
      throw error;
    }
  }
  
  /**
   * Get repository contents
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param path - File or directory path
   * @param ref - Git reference (branch, tag, commit)
   * @returns Contents information
   */
  async getContents(owner: string, repo: string, path: string, ref?: string): Promise<any> {
    try {
      const params: Record<string, string> = {};
      
      if (ref) {
        params.ref = ref;
      }
      
      const response = await this.client.get(`/repos/${owner}/${repo}/contents/${path}`, { params });
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        throw new Error(`Path ${path} not found in ${owner}/${repo}`);
      }
      
      throw error;
    }
  }
  
  /**
   * Download a file from GitHub
   * 
   * @param url - File download URL
   * @returns File content
   */
  async downloadFile(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'WordPress-Backup-App'
        },
        responseType: 'text'
      });
      
      return response.data;
    } catch (error) {
      logger.error('Error downloading file', error);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }
  
  /**
   * Create or update a file in the repository
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param path - File path
   * @param content - File content
   * @param message - Commit message
   * @param options - Additional options
   * @returns File creation result
   */
  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    options?: {
      branch?: string;
      sha?: string;
      author?: {
        name: string;
        email: string;
      };
      committer?: {
        name: string;
        email: string;
      };
    }
  ): Promise<any> {
    try {
      // Check if file exists to get its SHA
      let sha: string | undefined = options?.sha;
      
      if (!sha) {
        try {
          const existingFile = await this.getContents(owner, repo, path, options?.branch);
          if (existingFile.sha) {
            sha = existingFile.sha;
          }
        } catch (error) {
          // File doesn't exist, that's fine for creation
          if (error.message && !error.message.includes('not found')) {
            throw error;
          }
        }
      }
      
      // Prepare request data
      const requestData: Record<string, any> = {
        message,
        content: Buffer.from(content).toString('base64'),
        branch: options?.branch || 'main'
      };
      
      // Add SHA if updating an existing file
      if (sha) {
        requestData.sha = sha;
      }
      
      // Add author if provided
      if (options?.author) {
        requestData.author = options.author;
      }
      
      // Add committer if provided
      if (options?.committer) {
        requestData.committer = options.committer;
      }
      
      // Make the API request
      const response = await this.client.put(
        `/repos/${owner}/${repo}/contents/${path}`,
        requestData
      );
      
      return response.data;
    } catch (error) {
      logger.error(`Error creating/updating file: ${path}`, error);
      throw new Error(`Failed to create/update file: ${error.message}`);
    }
  }
  
  /**
   * Delete a file from the repository
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param path - File path
   * @param message - Commit message
   * @param options - Additional options
   * @returns File deletion result
   */
  async deleteFile(
    owner: string,
    repo: string,
    path: string,
    message: string,
    options?: {
      branch?: string;
      sha?: string;
      author?: {
        name: string;
        email: string;
      };
      committer?: {
        name: string;
        email: string;
      };
    }
  ): Promise<any> {
    try {
      // Get the file SHA if not provided
      let sha = options?.sha;
      
      if (!sha) {
        const existingFile = await this.getContents(owner, repo, path, options?.branch);
        sha = existingFile.sha;
      }
      
      if (!sha) {
        throw new Error(`Cannot delete file without SHA: ${path}`);
      }
      
      // Prepare request data
      const requestData: Record<string, any> = {
        message,
        sha,
        branch: options?.branch || 'main'
      };
      
      // Add author if provided
      if (options?.author) {
        requestData.author = options.author;
      }
      
      // Add committer if provided
      if (options?.committer) {
        requestData.committer = options.committer;
      }
      
      // Make the API request
      const response = await this.client.delete(
        `/repos/${owner}/${repo}/contents/${path}`,
        { data: requestData }
      );
      
      return response.data;
    } catch (error) {
      logger.error(`Error deleting file: ${path}`, error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }
  
  /**
   * Create a blob in the repository
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param content - Blob content
   * @param encoding - Content encoding
   * @returns Blob creation result
   */
  async createBlob(
    owner: string,
    repo: string,
    content: string,
    encoding: 'utf-8' | 'base64' = 'utf-8'
  ): Promise<any> {
    try {
      const response = await this.client.post(
        `/repos/${owner}/${repo}/git/blobs`,
        {
          content,
          encoding
        }
      );
      
      return response.data;
    } catch (error) {
      logger.error('Error creating blob', error);
      throw new Error(`Failed to create blob: ${error.message}`);
    }
  }
  
  /**
   * Create a tree in the repository
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param tree - Tree entries
   * @param baseTree - Base tree SHA
   * @returns Tree creation result
   */
  async createTree(
    owner: string,
    repo: string,
    tree: Array<{
      path: string;
      mode: '100644' | '100755' | '040000' | '160000' | '120000';
      type: 'blob' | 'tree' | 'commit';
      sha?: string;
      content?: string;
    }>,
    baseTree?: string
  ): Promise<any> {
    try {
      const requestData: Record<string, any> = { tree };
      
      if (baseTree) {
        requestData.base_tree = baseTree;
      }
      
      const response = await this.client.post(
        `/repos/${owner}/${repo}/git/trees`,
        requestData
      );
      
      return response.data;
    } catch (error) {
      logger.error('Error creating tree', error);
      throw new Error(`Failed to create tree: ${error.message}`);
    }
  }
  
  /**
   * Create a commit in the repository
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param message - Commit message
   * @param tree - Tree SHA
   * @param parents - Parent commit SHAs
   * @param options - Additional options
   * @returns Commit creation result
   */
  async createCommit(
    owner: string,
    repo: string,
    message: string,
    tree: string,
    parents: string[],
    options?: {
      author?: {
        name: string;
        email: string;
        date?: string;
      };
      committer?: {
        name: string;
        email: string;
        date?: string;
      };
    }
  ): Promise<any> {
    try {
      const requestData: Record<string, any> = {
        message,
        tree,
        parents
      };
      
      if (options?.author) {
        requestData.author = options.author;
      }
      
      if (options?.committer) {
        requestData.committer = options.committer;
      }
      
      const response = await this.client.post(
        `/repos/${owner}/${repo}/git/commits`,
        requestData
      );
      
      return response.data;
    } catch (error) {
      logger.error('Error creating commit', error);
      throw new Error(`Failed to create commit: ${error.message}`);
    }
  }
  
  /**
   * Update a reference in the repository
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param ref - Reference name
   * @param sha - Commit SHA
   * @param force - Force update
   * @returns Reference update result
   */
  async updateReference(
    owner: string,
    repo: string,
    ref: string,
    sha: string,
    force: boolean = false
  ): Promise<any> {
    try {
      // Ensure ref is formatted correctly
      const formattedRef = ref.startsWith('refs/') ? ref : `refs/heads/${ref}`;
      
      const response = await this.client.patch(
        `/repos/${owner}/${repo}/git/${formattedRef}`,
        {
          sha,
          force
        }
      );
      
      return response.data;
    } catch (error) {
      logger.error(`Error updating reference: ${ref}`, error);
      throw new Error(`Failed to update reference: ${error.message}`);
    }
  }
}