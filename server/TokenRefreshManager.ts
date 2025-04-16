import axios from 'axios';
import logger from './utils/logger';

/**
 * Represents an OAuth token with refresh capabilities
 */
export interface OAuthToken {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  expires_at?: number; // Calculated expiration timestamp
}

/**
 * Error types specific to token refresh operations
 */
export enum TokenErrorType {
  NETWORK_ERROR = 'network_error',
  INVALID_GRANT = 'invalid_grant',  // Refresh token expired or revoked
  INVALID_CLIENT = 'invalid_client', // Client credentials are invalid
  SERVER_ERROR = 'server_error',     // OAuth provider server error
  RATE_LIMITED = 'rate_limited',     // Too many requests
  UNKNOWN = 'unknown_error'         // Default for unexpected errors
}

/**
 * Custom error for token refresh operations
 */
export class TokenRefreshError extends Error {
  constructor(
    public message: string,
    public type: TokenErrorType,
    public provider: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'TokenRefreshError';
  }
}

/**
 * Manages OAuth token refresh operations across different providers
 */
export class TokenRefreshManager {
  private static instance: TokenRefreshManager;
  private refreshInProgress: Record<string, Promise<OAuthToken>> = {};

  private constructor() {}

  /**
   * Get the singleton instance of TokenRefreshManager
   */
  public static getInstance(): TokenRefreshManager {
    if (!TokenRefreshManager.instance) {
      TokenRefreshManager.instance = new TokenRefreshManager();
    }
    return TokenRefreshManager.instance;
  }

  /**
   * Check if a token needs refreshing
   * @param token The OAuth token to check
   * @param bufferSeconds Optional time buffer in seconds to refresh before expiration (default: 300s/5min)
   */
  public isTokenExpired(token: OAuthToken, bufferSeconds: number = 300): boolean {
    if (!token.expires_at) {
      // If no expiration time is available, consider it expired to be safe
      return true;
    }
    
    const now = Math.floor(Date.now() / 1000);
    return now >= token.expires_at - bufferSeconds;
  }

  /**
   * Calculate the expiration timestamp from the token's expires_in value
   * @param token The OAuth token
   */
  public calculateExpiresAt(token: OAuthToken): OAuthToken {
    if (token.expires_in) {
      const now = Math.floor(Date.now() / 1000);
      return {
        ...token,
        expires_at: now + token.expires_in
      };
    }
    return token;
  }

  /**
   * Refresh an OAuth token for Google
   * @param token The OAuth token with refresh_token
   */
  public async refreshGoogleToken(token: OAuthToken): Promise<OAuthToken> {
    const cacheKey = `google_${token.refresh_token}`;
    
    // Return existing refresh operation if one is in progress
    if (this.refreshInProgress[cacheKey]) {
      return this.refreshInProgress[cacheKey];
    }
    
    // Validate we have what we need
    if (!token.refresh_token) {
      throw new TokenRefreshError(
        'Cannot refresh token: Missing refresh token',
        TokenErrorType.INVALID_GRANT,
        'google'
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new TokenRefreshError(
        'Missing Google OAuth credentials',
        TokenErrorType.INVALID_CLIENT,
        'google'
      );
    }

    // Create the refresh operation and store it in the cache
    const refreshOperation = this.performGoogleTokenRefresh(token, clientId, clientSecret)
      .finally(() => {
        // Clean up the cache entry when done
        delete this.refreshInProgress[cacheKey];
      });
    
    this.refreshInProgress[cacheKey] = refreshOperation;
    return refreshOperation;
  }

  /**
   * Perform the actual token refresh request to Google
   */
  private async performGoogleTokenRefresh(
    token: OAuthToken, 
    clientId: string, 
    clientSecret: string
  ): Promise<OAuthToken> {
    try {
      logger.info('Refreshing Google OAuth token');
      
      const response = await axios.post(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: token.refresh_token!,
          grant_type: 'refresh_token'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const newToken: OAuthToken = {
        access_token: response.data.access_token,
        refresh_token: token.refresh_token, // Keep the original refresh token if not provided
        expires_in: response.data.expires_in,
        token_type: response.data.token_type
      };

      // Calculate expires_at timestamp
      return this.calculateExpiresAt(newToken);
    } catch (error: any) {
      // Handle specific error cases
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data || {};
        
        // Handle different error scenarios based on status and error messages
        if (status === 400 && (data.error === 'invalid_grant' || data.error === 'invalid_request')) {
          throw new TokenRefreshError(
            'Refresh token is invalid or expired',
            TokenErrorType.INVALID_GRANT,
            'google', 
            error
          );
        } else if (status === 401 && data.error === 'invalid_client') {
          throw new TokenRefreshError(
            'Client authentication failed',
            TokenErrorType.INVALID_CLIENT,
            'google',
            error
          );
        } else if (status === 429) {
          throw new TokenRefreshError(
            'Rate limit exceeded, try again later',
            TokenErrorType.RATE_LIMITED,
            'google',
            error
          );
        } else if (status >= 500) {
          throw new TokenRefreshError(
            'Google OAuth server error',
            TokenErrorType.SERVER_ERROR,
            'google',
            error
          );
        }
      } else if (error.request) {
        // Network error - request was made but no response
        throw new TokenRefreshError(
          'Network error while refreshing token',
          TokenErrorType.NETWORK_ERROR,
          'google',
          error
        );
      }
      
      // For all other error cases
      throw new TokenRefreshError(
        `Failed to refresh Google token: ${error.message}`,
        TokenErrorType.UNKNOWN,
        'google',
        error
      );
    }
  }

  /**
   * Refresh an OAuth token for Dropbox
   * @param token The OAuth token with refresh_token
   */
  public async refreshDropboxToken(token: OAuthToken): Promise<OAuthToken> {
    const cacheKey = `dropbox_${token.refresh_token}`;
    
    // Return existing refresh operation if one is in progress
    if (this.refreshInProgress[cacheKey]) {
      return this.refreshInProgress[cacheKey];
    }
    
    // Validate we have what we need
    if (!token.refresh_token) {
      throw new TokenRefreshError(
        'Cannot refresh token: Missing refresh token',
        TokenErrorType.INVALID_GRANT,
        'dropbox'
      );
    }

    const clientId = process.env.DROPBOX_CLIENT_ID;
    const clientSecret = process.env.DROPBOX_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new TokenRefreshError(
        'Missing Dropbox OAuth credentials',
        TokenErrorType.INVALID_CLIENT,
        'dropbox'
      );
    }

    // Create the refresh operation and store it in the cache
    const refreshOperation = this.performDropboxTokenRefresh(token, clientId, clientSecret)
      .finally(() => {
        // Clean up the cache entry when done
        delete this.refreshInProgress[cacheKey];
      });
    
    this.refreshInProgress[cacheKey] = refreshOperation;
    return refreshOperation;
  }

  /**
   * Perform the actual token refresh request to Dropbox
   */
  private async performDropboxTokenRefresh(
    token: OAuthToken, 
    clientId: string, 
    clientSecret: string
  ): Promise<OAuthToken> {
    try {
      logger.info('Refreshing Dropbox OAuth token');
      
      const response = await axios.post(
        'https://api.dropboxapi.com/oauth2/token',
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: token.refresh_token!,
          grant_type: 'refresh_token'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const newToken: OAuthToken = {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token || token.refresh_token, // Keep the original if not returned
        expires_in: response.data.expires_in,
        token_type: response.data.token_type
      };

      // Calculate expires_at timestamp
      return this.calculateExpiresAt(newToken);
    } catch (error: any) {
      // Handle specific error cases
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data || {};
        
        if (status === 400 && data.error === 'invalid_grant') {
          throw new TokenRefreshError(
            'Refresh token is invalid or expired',
            TokenErrorType.INVALID_GRANT,
            'dropbox', 
            error
          );
        } else if (status === 401 && data.error === 'invalid_client') {
          throw new TokenRefreshError(
            'Client authentication failed',
            TokenErrorType.INVALID_CLIENT,
            'dropbox',
            error
          );
        } else if (status === 429) {
          throw new TokenRefreshError(
            'Rate limit exceeded, try again later',
            TokenErrorType.RATE_LIMITED,
            'dropbox',
            error
          );
        } else if (status >= 500) {
          throw new TokenRefreshError(
            'Dropbox OAuth server error',
            TokenErrorType.SERVER_ERROR,
            'dropbox',
            error
          );
        }
      } else if (error.request) {
        // Network error - request was made but no response
        throw new TokenRefreshError(
          'Network error while refreshing token',
          TokenErrorType.NETWORK_ERROR,
          'dropbox',
          error
        );
      }
      
      // For all other error cases
      throw new TokenRefreshError(
        `Failed to refresh Dropbox token: ${error.message}`,
        TokenErrorType.UNKNOWN,
        'dropbox',
        error
      );
    }
  }

  /**
   * Refresh an OAuth token for OneDrive
   * @param token The OAuth token with refresh_token
   */
  public async refreshOneDriveToken(token: OAuthToken): Promise<OAuthToken> {
    const cacheKey = `onedrive_${token.refresh_token}`;
    
    // Return existing refresh operation if one is in progress
    if (this.refreshInProgress[cacheKey]) {
      return this.refreshInProgress[cacheKey];
    }
    
    // Validate we have what we need
    if (!token.refresh_token) {
      throw new TokenRefreshError(
        'Cannot refresh token: Missing refresh token',
        TokenErrorType.INVALID_GRANT,
        'onedrive'
      );
    }

    const clientId = process.env.ONEDRIVE_CLIENT_ID;
    const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new TokenRefreshError(
        'Missing OneDrive OAuth credentials',
        TokenErrorType.INVALID_CLIENT,
        'onedrive'
      );
    }

    // Create the refresh operation and store it in the cache
    const refreshOperation = this.performOneDriveTokenRefresh(token, clientId, clientSecret)
      .finally(() => {
        // Clean up the cache entry when done
        delete this.refreshInProgress[cacheKey];
      });
    
    this.refreshInProgress[cacheKey] = refreshOperation;
    return refreshOperation;
  }

  /**
   * Perform the actual token refresh request to Microsoft for OneDrive
   */
  private async performOneDriveTokenRefresh(
    token: OAuthToken, 
    clientId: string, 
    clientSecret: string
  ): Promise<OAuthToken> {
    try {
      logger.info('Refreshing OneDrive OAuth token');
      
      const response = await axios.post(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: token.refresh_token!,
          grant_type: 'refresh_token',
          scope: 'files.readwrite offline_access'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const newToken: OAuthToken = {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token || token.refresh_token, // Keep the original if not returned
        expires_in: response.data.expires_in,
        token_type: response.data.token_type
      };

      // Calculate expires_at timestamp
      return this.calculateExpiresAt(newToken);
    } catch (error: any) {
      // Handle specific error cases
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data || {};
        
        if (status === 400 && data.error === 'invalid_grant') {
          throw new TokenRefreshError(
            'Refresh token is invalid or expired',
            TokenErrorType.INVALID_GRANT,
            'onedrive', 
            error
          );
        } else if (status === 401 && data.error === 'invalid_client') {
          throw new TokenRefreshError(
            'Client authentication failed',
            TokenErrorType.INVALID_CLIENT,
            'onedrive',
            error
          );
        } else if (status === 429) {
          throw new TokenRefreshError(
            'Rate limit exceeded, try again later',
            TokenErrorType.RATE_LIMITED,
            'onedrive',
            error
          );
        } else if (status >= 500) {
          throw new TokenRefreshError(
            'Microsoft OAuth server error',
            TokenErrorType.SERVER_ERROR,
            'onedrive',
            error
          );
        }
      } else if (error.request) {
        // Network error - request was made but no response
        throw new TokenRefreshError(
          'Network error while refreshing token',
          TokenErrorType.NETWORK_ERROR,
          'onedrive',
          error
        );
      }
      
      // For all other error cases
      throw new TokenRefreshError(
        `Failed to refresh OneDrive token: ${error.message}`,
        TokenErrorType.UNKNOWN,
        'onedrive',
        error
      );
    }
  }
}

// Export singleton instance
export const tokenRefreshManager = TokenRefreshManager.getInstance();