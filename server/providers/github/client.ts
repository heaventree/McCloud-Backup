/**
 * GitHub API Client
 * 
 * This module provides a client for interacting with the GitHub API
 * to perform operations related to backup and restore.
 */
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { createLogger } from '../../utils/logger';

const logger = createLogger('github-client');

/**
 * GitHub repository content type
 */
export type GitHubContent = {
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  size: number;
  name: string;
  path: string;
  sha: string;
  url: string;
  git_url: string;
  html_url: string;
  download_url: string | null;
  content?: string;
  encoding?: string;
};

/**
 * GitHub reference type
 */
export type GitHubRef = {
  ref: string;
  node_id: string;
  url: string;
  object: {
    type: string;
    sha: string;
    url: string;
  };
};

/**
 * GitHub commit type
 */
export type GitHubCommit = {
  sha: string;
  node_id: string;
  url: string;
  html_url: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  committer: {
    name: string;
    email: string;
    date: string;
  };
  message: string;
  tree: {
    sha: string;
    url: string;
  };
  parents: Array<{
    sha: string;
    url: string;
    html_url: string;
  }>;
};

/**
 * GitHub tree type
 */
export type GitHubTree = {
  sha: string;
  url: string;
  tree: Array<{
    path: string;
    mode: string;
    type: 'blob' | 'tree' | 'commit';
    sha: string;
    size?: number;
    url: string;
  }>;
  truncated: boolean;
};

/**
 * GitHub blob type
 */
export type GitHubBlob = {
  sha: string;
  node_id: string;
  size: number;
  url: string;
  content: string;
  encoding: 'base64' | 'utf-8';
};

/**
 * GitHub API client
 */
export class GitHubClient {
  private api: AxiosInstance;
  private token: string;
  private owner: string;
  private baseUrl: string;
  
  /**
   * Create a new GitHub API client
   * 
   * @param options - Client options
   */
  constructor(options: {
    token: string;
    owner: string;
    baseUrl?: string;
  }) {
    this.token = options.token;
    this.owner = options.owner;
    this.baseUrl = options.baseUrl || 'https://api.github.com';
    
    // Create Axios instance
    this.api = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `token ${this.token}`,
      },
    });
    
    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      response => response,
      error => {
        if (error.response) {
          logger.error(`GitHub API error: ${error.response.status} ${error.response.statusText}`, {
            url: error.config.url,
            method: error.config.method,
            data: error.response.data,
          });
        } else if (error.request) {
          logger.error('GitHub API request failed', {
            url: error.config.url,
            method: error.config.method,
          });
        } else {
          logger.error(`GitHub API error: ${error.message}`);
        }
        
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Test the API connection
   * 
   * @returns Test result
   */
  async testConnection(): Promise<{
    success: boolean;
    message?: string;
    user?: {
      login: string;
      name: string;
      email: string;
    };
  }> {
    try {
      // Get authenticated user
      const response = await this.api.get('/user');
      
      return {
        success: true,
        message: `Successfully authenticated as ${response.data.login}`,
        user: {
          login: response.data.login,
          name: response.data.name,
          email: response.data.email,
        },
      };
    } catch (error) {
      logger.error('Error testing GitHub connection', error);
      
      const errorMessage = error.response?.data?.message || 'Failed to connect to GitHub';
      
      return {
        success: false,
        message: `Error testing GitHub connection: ${errorMessage}`,
      };
    }
  }
  
  /**
   * Check if a repository exists
   * 
   * @param repo - Repository name
   * @returns True if the repository exists
   */
  async repositoryExists(repo: string): Promise<boolean> {
    try {
      const response = await this.api.get(`/repos/${this.owner}/${repo}`);
      return response.status === 200;
    } catch (error) {
      if (error.response?.status === 404) {
        return false;
      }
      
      logger.error(`Error checking if repository exists: ${repo}`, error);
      throw error;
    }
  }
  
  /**
   * Create a new repository
   * 
   * @param repo - Repository name
   * @param isPrivate - Whether the repository should be private
   * @returns Created repository information
   */
  async createRepository(repo: string, isPrivate: boolean = true): Promise<{
    name: string;
    full_name: string;
    html_url: string;
    default_branch: string;
  }> {
    try {
      const response = await this.api.post('/user/repos', {
        name: repo,
        private: isPrivate,
        auto_init: true,
        description: 'WordPress Backup Repository',
      });
      
      logger.info(`Created repository: ${response.data.full_name}`);
      
      return {
        name: response.data.name,
        full_name: response.data.full_name,
        html_url: response.data.html_url,
        default_branch: response.data.default_branch,
      };
    } catch (error) {
      logger.error(`Error creating repository: ${repo}`, error);
      throw error;
    }
  }
  
  /**
   * Get reference (branch, tag, etc.)
   * 
   * @param repo - Repository name
   * @param ref - Reference name
   * @returns Reference information
   */
  async getReference(repo: string, ref: string): Promise<GitHubRef> {
    try {
      const response = await this.api.get(`/repos/${this.owner}/${repo}/git/refs/${ref}`);
      return response.data;
    } catch (error) {
      logger.error(`Error getting reference: ${repo}/${ref}`, error);
      throw error;
    }
  }
  
  /**
   * Create a new reference
   * 
   * @param repo - Repository name
   * @param ref - Reference name
   * @param sha - SHA to point to
   * @returns Created reference
   */
  async createReference(repo: string, ref: string, sha: string): Promise<GitHubRef> {
    try {
      const response = await this.api.post(`/repos/${this.owner}/${repo}/git/refs`, {
        ref: ref.startsWith('refs/') ? ref : `refs/${ref}`,
        sha,
      });
      
      logger.info(`Created reference: ${repo}/${ref}`);
      
      return response.data;
    } catch (error) {
      logger.error(`Error creating reference: ${repo}/${ref}`, error);
      throw error;
    }
  }
  
  /**
   * Update a reference
   * 
   * @param repo - Repository name
   * @param ref - Reference name
   * @param sha - SHA to point to
   * @param force - Force update
   * @returns Updated reference
   */
  async updateReference(repo: string, ref: string, sha: string, force: boolean = false): Promise<GitHubRef> {
    try {
      const response = await this.api.patch(`/repos/${this.owner}/${repo}/git/refs/${ref}`, {
        sha,
        force,
      });
      
      logger.info(`Updated reference: ${repo}/${ref}`);
      
      return response.data;
    } catch (error) {
      logger.error(`Error updating reference: ${repo}/${ref}`, error);
      throw error;
    }
  }
  
  /**
   * Get a commit
   * 
   * @param repo - Repository name
   * @param sha - Commit SHA
   * @returns Commit information
   */
  async getCommit(repo: string, sha: string): Promise<GitHubCommit> {
    try {
      const response = await this.api.get(`/repos/${this.owner}/${repo}/git/commits/${sha}`);
      return response.data;
    } catch (error) {
      logger.error(`Error getting commit: ${repo}/${sha}`, error);
      throw error;
    }
  }
  
  /**
   * Create a new commit
   * 
   * @param repo - Repository name
   * @param message - Commit message
   * @param tree - Tree SHA
   * @param parents - Parent commit SHAs
   * @returns Created commit
   */
  async createCommit(repo: string, message: string, tree: string, parents: string[]): Promise<GitHubCommit> {
    try {
      const response = await this.api.post(`/repos/${this.owner}/${repo}/git/commits`, {
        message,
        tree,
        parents,
      });
      
      logger.info(`Created commit: ${repo}/${response.data.sha}`);
      
      return response.data;
    } catch (error) {
      logger.error(`Error creating commit: ${repo}`, error);
      throw error;
    }
  }
  
  /**
   * Get a tree
   * 
   * @param repo - Repository name
   * @param sha - Tree SHA
   * @param recursive - Whether to get tree recursively
   * @returns Tree information
   */
  async getTree(repo: string, sha: string, recursive: boolean = false): Promise<GitHubTree> {
    try {
      const response = await this.api.get(`/repos/${this.owner}/${repo}/git/trees/${sha}`, {
        params: {
          recursive: recursive ? 1 : 0,
        },
      });
      return response.data;
    } catch (error) {
      logger.error(`Error getting tree: ${repo}/${sha}`, error);
      throw error;
    }
  }
  
  /**
   * Create a new tree
   * 
   * @param repo - Repository name
   * @param tree - Tree objects
   * @param baseTree - Base tree SHA
   * @returns Created tree
   */
  async createTree(repo: string, tree: Array<{
    path: string;
    mode: '100644' | '100755' | '040000' | '160000' | '120000';
    type: 'blob' | 'tree' | 'commit';
    sha?: string;
    content?: string;
  }>, baseTree?: string): Promise<GitHubTree> {
    try {
      const response = await this.api.post(`/repos/${this.owner}/${repo}/git/trees`, {
        tree,
        base_tree: baseTree,
      });
      
      logger.info(`Created tree: ${repo}/${response.data.sha}`);
      
      return response.data;
    } catch (error) {
      logger.error(`Error creating tree: ${repo}`, error);
      throw error;
    }
  }
  
  /**
   * Get a blob
   * 
   * @param repo - Repository name
   * @param sha - Blob SHA
   * @returns Blob information
   */
  async getBlob(repo: string, sha: string): Promise<GitHubBlob> {
    try {
      const response = await this.api.get(`/repos/${this.owner}/${repo}/git/blobs/${sha}`);
      return response.data;
    } catch (error) {
      logger.error(`Error getting blob: ${repo}/${sha}`, error);
      throw error;
    }
  }
  
  /**
   * Create a new blob
   * 
   * @param repo - Repository name
   * @param content - Blob content
   * @param encoding - Content encoding
   * @returns Created blob
   */
  async createBlob(repo: string, content: string, encoding: 'base64' | 'utf-8' = 'utf-8'): Promise<{
    sha: string;
    url: string;
  }> {
    try {
      const response = await this.api.post(`/repos/${this.owner}/${repo}/git/blobs`, {
        content,
        encoding,
      });
      
      return {
        sha: response.data.sha,
        url: response.data.url,
      };
    } catch (error) {
      logger.error(`Error creating blob: ${repo}`, error);
      throw error;
    }
  }
  
  /**
   * Get repository contents
   * 
   * @param repo - Repository name
   * @param path - File or directory path
   * @param ref - Reference (branch, tag, etc.)
   * @returns Repository contents
   */
  async getContents(repo: string, path: string, ref?: string): Promise<GitHubContent | GitHubContent[]> {
    try {
      const config: AxiosRequestConfig = {};
      
      if (ref) {
        config.params = { ref };
      }
      
      const response = await this.api.get(`/repos/${this.owner}/${repo}/contents/${path}`, config);
      return response.data;
    } catch (error) {
      logger.error(`Error getting contents: ${repo}/${path}`, error);
      throw error;
    }
  }
  
  /**
   * Create or update a file
   * 
   * @param repo - Repository name
   * @param path - File path
   * @param content - File content
   * @param message - Commit message
   * @param branch - Branch name
   * @param sha - File SHA (required for updates)
   * @returns Updated file information
   */
  async createOrUpdateFile(repo: string, path: string, content: string, message: string, branch: string, sha?: string): Promise<{
    content: GitHubContent;
    commit: {
      sha: string;
      html_url: string;
    };
  }> {
    try {
      const endpoint = `/repos/${this.owner}/${repo}/contents/${path}`;
      const payload: any = {
        message,
        content: Buffer.from(content).toString('base64'),
        branch,
      };
      
      if (sha) {
        payload.sha = sha;
      }
      
      const response = await this.api.put(endpoint, payload);
      
      logger.info(`${sha ? 'Updated' : 'Created'} file: ${repo}/${path}`);
      
      return response.data;
    } catch (error) {
      logger.error(`Error ${sha ? 'updating' : 'creating'} file: ${repo}/${path}`, error);
      throw error;
    }
  }
  
  /**
   * Delete a file
   * 
   * @param repo - Repository name
   * @param path - File path
   * @param message - Commit message
   * @param branch - Branch name
   * @param sha - File SHA
   * @returns Deletion response
   */
  async deleteFile(repo: string, path: string, message: string, branch: string, sha: string): Promise<{
    commit: {
      sha: string;
      html_url: string;
    };
  }> {
    try {
      const response = await this.api.delete(`/repos/${this.owner}/${repo}/contents/${path}`, {
        data: {
          message,
          sha,
          branch,
        },
      });
      
      logger.info(`Deleted file: ${repo}/${path}`);
      
      return response.data;
    } catch (error) {
      logger.error(`Error deleting file: ${repo}/${path}`, error);
      throw error;
    }
  }
  
  /**
   * Create a new branch
   * 
   * @param repo - Repository name
   * @param branch - Branch name
   * @param fromBranch - Branch to create from
   * @returns Created branch reference
   */
  async createBranch(repo: string, branch: string, fromBranch: string = 'main'): Promise<GitHubRef> {
    try {
      // Get SHA from base branch
      const baseRef = await this.getReference(repo, `heads/${fromBranch}`);
      
      // Create new branch
      return await this.createReference(repo, `heads/${branch}`, baseRef.object.sha);
    } catch (error) {
      logger.error(`Error creating branch: ${repo}/${branch}`, error);
      throw error;
    }
  }
  
  /**
   * Get commits for a file
   * 
   * @param repo - Repository name
   * @param path - File path
   * @param branch - Branch name
   * @returns List of commits
   */
  async getFileCommits(repo: string, path: string, branch: string): Promise<Array<{
    sha: string;
    commit: {
      message: string;
      author: {
        name: string;
        email: string;
        date: string;
      };
    };
    html_url: string;
  }>> {
    try {
      const response = await this.api.get(`/repos/${this.owner}/${repo}/commits`, {
        params: {
          path,
          sha: branch,
        },
      });
      
      return response.data;
    } catch (error) {
      logger.error(`Error getting file commits: ${repo}/${path}`, error);
      throw error;
    }
  }
}

export default GitHubClient;