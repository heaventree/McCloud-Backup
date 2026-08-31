/**
 * Token Refresh Manager
 *
 * Handles automatic token refresh for OAuth providers, particularly Dropbox.
 * Ensures tokens are refreshed before they expire and storage providers
 * maintain valid authentication.
 */

import axios from 'axios';
import logger from './utils/logger';
import prisma from './prisma';
import { notificationService } from './services/notification-service';

export interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  expires_at?: number;
}

export interface RefreshTokenResponse {
  success: boolean;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

// Compatibility layer for server/auth.ts's session-based OAuth token refresh routes
// (/auth/*/refresh) - these predate this class's storage-provider-centric refresh flow and
// were dropped when this file was ported in from a branch that doesn't have them. Re-added as
// thin wrappers over refreshAccessToken() rather than the original bespoke per-provider HTTP
// calls, since that generic path already exists and is exercised elsewhere in this class.
export interface OAuthToken {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  expires_at?: number;
}

export enum TokenErrorType {
  NETWORK_ERROR = 'network_error',
  INVALID_GRANT = 'invalid_grant',
  INVALID_CLIENT = 'invalid_client',
  SERVER_ERROR = 'server_error',
  RATE_LIMITED = 'rate_limited',
  UNKNOWN = 'unknown_error'
}

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

export class TokenRefreshManager {
  private static instance: TokenRefreshManager;

  public static getInstance(): TokenRefreshManager {
    if (!TokenRefreshManager.instance) {
      TokenRefreshManager.instance = new TokenRefreshManager();
    }
    return TokenRefreshManager.instance;
  }

  /**
   * Check if a token is expired or will expire soon
   */
  public isTokenExpired(tokenData: TokenData): boolean {
    if (!tokenData.expires_at) {
      // If no expiration time, assume it doesn't expire
      return false;
    }

    // Consider token expired if it expires in less than 5 minutes
    const EXPIRATION_BUFFER = 5 * 60 * 1000; // 5 minutes
    return Date.now() + EXPIRATION_BUFFER > tokenData.expires_at;
  }

  /**
   * Refresh an access token using the refresh token
   */
  public async refreshAccessToken(
    provider: string,
    refreshToken: string
  ): Promise<RefreshTokenResponse> {
    console.log('=== REFRESH TOKEN DEBUG ===');
    console.log('Provider:', provider);
    console.log('Refresh token prefix:', refreshToken.substring(0, 15) + '...');

    try {
      let tokenUrl: string;
      let requestData: any;
      let headers: any = {};

      switch (provider) {
        case 'dropbox':
          tokenUrl = 'https://api.dropbox.com/oauth2/token';
          requestData = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: process.env.DROPBOX_CLIENT_ID || '',
            client_secret: process.env.DROPBOX_CLIENT_SECRET || '',
          });
          headers['Content-Type'] = 'application/x-www-form-urlencoded';

          console.log('Dropbox refresh URL:', tokenUrl);
          console.log('Client ID:', process.env.DROPBOX_CLIENT_ID ? 'EXISTS' : 'MISSING');
          console.log('Client Secret:', process.env.DROPBOX_CLIENT_SECRET ? 'EXISTS' : 'MISSING');
          break;

        case 'google':
          tokenUrl = 'https://oauth2.googleapis.com/token';
          requestData = {
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
          };
          headers['Content-Type'] = 'application/json';
          break;

        case 'github':
          // GitHub tokens don't expire, but we include for completeness
          return {
            success: false,
            error: 'GitHub tokens do not require refresh',
          };

        default:
          return {
            success: false,
            error: `Token refresh not implemented for provider: ${provider}`,
          };
      }

      console.log('Making refresh token request to:', tokenUrl);
      const response = await axios.post(tokenUrl, requestData, { headers });

      const newTokenData = response.data;
      console.log(
        'Refresh successful! New token prefix:',
        newTokenData.access_token?.substring(0, 15) + '...'
      );
      console.log('Expires in:', newTokenData.expires_in, 'seconds');

      return {
        success: true,
        access_token: newTokenData.access_token,
        refresh_token: newTokenData.refresh_token || refreshToken, // Some providers don't return new refresh token
        expires_in: newTokenData.expires_in,
      };
    } catch (error) {
      console.log('=== REFRESH ERROR ===');
      console.log('Error message:', error instanceof Error ? error.message : 'Unknown error');
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        console.log('Status code:', axiosError.response?.status);
        console.log('Response data:', axiosError.response?.data);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh token',
      };
    }
  }

  /**
   * Get valid access token for a storage provider, refreshing if necessary
   */
  /**
   * Get a valid access token for a storage provider - refreshing and persisting a new one if
   * the current token has expired. This is the single, canonical implementation; there used to
   * be a second "legacy" copy of this same expiry-check-and-refresh logic that nothing called
   * (this method itself just returned whatever was stored, unconditionally, despite a comment
   * claiming a 401 would trigger a refresh - it wouldn't have, for any Google-backed caller).
   * Confirmed live: a Google Drive access token sat expired for 4 days with a valid
   * refresh_token right next to it, because nothing was actually checking expiry here.
   */
  public async getValidAccessToken(storageProviderId: number): Promise<{
    success: boolean;
    access_token?: string;
    error?: string;
  }> {
    try {
      // Get storage provider from database
      const provider = await prisma.storageProvider.findUnique({
        where: { id: storageProviderId },
      });

      if (!provider) {
        return {
          success: false,
          error: 'Storage provider not found',
        };
      }

      // Parse config
      let config: TokenData;
      try {
        const rawConfig = JSON.parse(provider.config);

        // Handle nested token structure: {"token": "JSON_STRING"}
        if (rawConfig.token && typeof rawConfig.token === 'string') {
          // The token is stored as a JSON string, need to parse it again
          let tokenString = rawConfig.token;

          // Decode HTML entities if present
          if (tokenString.includes('&quot;')) {
            tokenString = tokenString
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&#39;/g, "'")
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>');
          }

          config = JSON.parse(tokenString);
        } else if (rawConfig.access_token) {
          // Direct token structure
          config = rawConfig;
        } else {
          return {
            success: false,
            error: 'No valid token data found in configuration',
          };
        }
      } catch (error) {
        logger.error('Failed to parse provider configuration', {
          storageProviderId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return {
          success: false,
          error: 'Invalid provider configuration format',
        };
      }

      if (!this.isTokenExpired(config)) {
        return {
          success: true,
          access_token: config.access_token,
        };
      }

      logger.info(`Access token expired for storage provider ${storageProviderId}, attempting refresh`, {
        provider: provider.type,
      });

      if (!config.refresh_token) {
        logger.error(`Token expired and no refresh token available for storage provider ${storageProviderId}`);
        return {
          success: false,
          error: 'Token expired and no refresh token available',
        };
      }

      const refreshResult = await this.refreshAccessToken(provider.type, config.refresh_token);

      if (!refreshResult.success) {
        logger.error(`Token refresh failed for storage provider ${storageProviderId}`, {
          error: refreshResult.error,
        });

        try {
          await notificationService.createTokenRefreshErrorNotification(
            storageProviderId,
            provider.name,
            provider.type,
            refreshResult.error || 'Failed to refresh token'
          );
        } catch (notificationError) {
          logger.error('Failed to create token refresh error notification', notificationError);
        }

        return {
          success: false,
          error: refreshResult.error || 'Failed to refresh token',
        };
      }

      const newConfig: TokenData = {
        access_token: refreshResult.access_token!,
        refresh_token: refreshResult.refresh_token || config.refresh_token,
        expires_in: refreshResult.expires_in,
        token_type: config.token_type,
        expires_at: refreshResult.expires_in
          ? Date.now() + refreshResult.expires_in * 1000
          : undefined,
      };

      // Persist in the same nested format the token was originally stored in - and that every
      // other reader of this column expects - {"token": "<json string>", ...}, not a flat
      // access_token-at-top-level structure.
      const updatedStorageConfig = {
        token: JSON.stringify(newConfig),
        tokenExpiresAt: newConfig.expires_at ? new Date(newConfig.expires_at).toISOString() : undefined,
      };

      await prisma.storageProvider.update({
        where: { id: storageProviderId },
        data: {
          config: JSON.stringify(updatedStorageConfig),
          updatedAt: new Date(),
        },
      });

      logger.info(`Access token refreshed and persisted for storage provider ${storageProviderId}`);

      return {
        success: true,
        access_token: newConfig.access_token,
      };
    } catch (error) {
      logger.error('Error getting valid access token', {
        storageProviderId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: 'Failed to get access token',
      };
    }
  }

  /**
   * Wrapper function to handle API calls with automatic token refresh on 401 errors
   */
  public async makeDropboxApiCall<T>(
    storageProviderId: number,
    apiCall: (accessToken: string) => Promise<T>
  ): Promise<T> {
    console.log('=== MAKING DROPBOX API CALL WITH AUTO-REFRESH ===');
    console.log('Provider ID:', storageProviderId);

    // Get current access token
    const tokenResult = await this.getValidAccessToken(storageProviderId);
    if (!tokenResult.success || !tokenResult.access_token) {
      throw new Error(tokenResult.error || 'Failed to get access token');
    }

    try {
      // Try the API call with current token
      console.log('Attempting API call with current token...');
      return await apiCall(tokenResult.access_token);
    } catch (error) {
      console.log("API call failed, checking if it's a 401 error...");

      // Check if it's a 401 error (unauthorized)
      const is401Error = (error: any) => {
        return (
          error?.response?.status === 401 ||
          error?.status === 401 ||
          (error?.message && error.message.includes('401'))
        );
      };

      if (!is401Error(error)) {
        console.log('Not a 401 error, rethrowing original error');
        throw error;
      }

      console.log('401 error detected! Attempting token refresh...');

      // Get storage provider to extract refresh token
      const provider = await prisma.storageProvider.findUnique({
        where: { id: storageProviderId },
      });

      if (!provider) {
        throw new Error('Storage provider not found');
      }

      // Parse config to get refresh token
      let config: TokenData;
      try {
        console.log('Parsing provider config...', provider.config);
        const rawConfig = JSON.parse(provider.config);
        console.log('Parsed config:', rawConfig);
        if (rawConfig.token && typeof rawConfig.token === 'string') {
          let tokenString = rawConfig.token;
          console.log('Raw token string:', tokenString.substring(0, 100) + '...');
          // Handle HTML-encoded tokens with multiple decoding passes
          let originalLength = tokenString.length;
          let maxPasses = 5; // Prevent infinite loops
          let passes = 0;
          
          while (passes < maxPasses && (tokenString.includes('&amp;') || tokenString.includes('&quot;'))) {
            passes++;
            tokenString = tokenString
              .replace(/&amp;quot;/g, '"')
              .replace(/&amp;amp;/g, '&')
              .replace(/&amp;#39;/g, "'")
              .replace(/&amp;lt;/g, '<')
              .replace(/&amp;gt;/g, '>');
              
            // Also handle single-encoded entities
            tokenString = tokenString
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&#39;/g, "'")
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>');
              
            console.log(`HTML decode pass ${passes}, length: ${tokenString.length}`);
          }
          
          console.log('Final decoded token string:', tokenString.substring(0, 100) + '...');
          config = JSON.parse(tokenString);
          console.log('Parsed token config:', config);
        } else {
          config = rawConfig;
        }
      } catch (parseError) {
        console.log('Parse error:', parseError);
        console.log('Provider config that failed to parse:', provider.config);
        throw new Error(`Failed to parse provider configuration: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }

      if (!config.refresh_token) {
        console.log('ERROR: No refresh token available for automatic refresh');
        throw new Error('Token expired and no refresh token available');
      }

      // Attempt token refresh
      console.log(
        'Refreshing token with refresh token:',
        config.refresh_token.substring(0, 15) + '...'
      );
      const refreshResult = await this.refreshAccessToken(provider.type, config.refresh_token);

      if (!refreshResult.success) {
        console.log('Token refresh failed:', refreshResult.error);
        logger.error(
          `Dropbox API returned 401 even after token refresh for provider ${storageProviderId}`
        );
        throw new Error('Token is invalid and could not be refreshed. Please re-authenticate.');
      }

      console.log('Token refresh successful! Updating database...');

      // Update database with new token
      const newConfig: TokenData = {
        access_token: refreshResult.access_token!,
        refresh_token: refreshResult.refresh_token || config.refresh_token,
        expires_in: refreshResult.expires_in,
        token_type: config.token_type,
        expires_at: refreshResult.expires_in
          ? Date.now() + refreshResult.expires_in * 1000
          : undefined,
      };

      // Store updated config back in the same nested format WITHOUT HTML encoding
      const updatedStorageConfig = {
        token: JSON.stringify(newConfig), // Store as plain JSON string - no HTML encoding
        tokenExpiresAt: newConfig.expires_at
          ? new Date(newConfig.expires_at).toISOString()
          : undefined,
      };

      await prisma.storageProvider.update({
        where: { id: storageProviderId },
        data: {
          config: JSON.stringify(updatedStorageConfig),
        },
      });

      console.log('Database updated with new token. Retrying original API call...');

      // Retry the original API call with the new token
      return await apiCall(refreshResult.access_token!);
    }
  }

  /**
   * Proactively force refresh a token and update the database regardless of expiration status
   * This is useful for long-running operations that need a fresh token
   */
  public async forceRefreshAndUpdateToken(storageProviderId: number): Promise<{
    success: boolean;
    access_token?: string;
    error?: string;
  }> {
    try {
      logger.info('🔄 PROACTIVE TOKEN REFRESH: Starting forced token refresh', {
        storageProviderId,
        reason: 'Ensuring fresh token for long-running operation',
      });

      // Get storage provider from database
      const provider = await prisma.storageProvider.findUnique({
        where: { id: storageProviderId },
      });

      if (!provider) {
        logger.error('❌ REFRESH ERROR: Storage provider not found', {
          storageProviderId,
        });
        return {
          success: false,
          error: 'Storage provider not found',
        };
      }

      // Parse config to extract current token data
      let tokenConfig: TokenData;
      try {
        const currentConfig = JSON.parse(provider.config);
        
        if (currentConfig.token && typeof currentConfig.token === 'string') {
          logger.info('🔧 Parsing nested token structure with HTML entity decoding', {
            storageProviderId,
          });
          
          // Handle nested token structure with HTML entity decoding
          let tokenString = currentConfig.token;
          
          // Decode HTML entities if present (multiple passes for nested encoding)
          let maxPasses = 5;
          let passes = 0;
          
          while (passes < maxPasses && (tokenString.includes('&amp;') || tokenString.includes('&quot;'))) {
            passes++;
            tokenString = tokenString
              .replace(/&amp;quot;/g, '"')
              .replace(/&amp;amp;/g, '&')
              .replace(/&amp;#39;/g, "'")
              .replace(/&amp;lt;/g, '<')
              .replace(/&amp;gt;/g, '>');
              
            // Also handle single-encoded entities
            tokenString = tokenString
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&#39;/g, "'")
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>');
          }
          
          if (passes > 0) {
            logger.info(`🔧 HTML entity decoding completed after ${passes} passes`, {
              storageProviderId,
            });
          }
          
          tokenConfig = JSON.parse(tokenString);
        } else {
          logger.info('🔧 Using direct token structure (no nested parsing needed)', {
            storageProviderId,
          });
          tokenConfig = currentConfig;
        }
      } catch (parseError) {
        logger.error('❌ CONFIG PARSE ERROR: Failed to parse provider configuration', {
          storageProviderId,
          error: parseError instanceof Error ? parseError.message : 'Unknown error',
        });
        return {
          success: false,
          error: 'Invalid provider configuration format',
        };
      }

      if (!tokenConfig.refresh_token) {
        logger.error('❌ REFRESH ERROR: No refresh token available for proactive refresh', {
          storageProviderId,
        });
        return {
          success: false,
          error: 'No refresh token available for proactive refresh',
        };
      }

      // Force refresh the token
      logger.info('🔄 FORCING TOKEN REFRESH: Calling OAuth refresh endpoint', {
        storageProviderId,
        provider: provider.type,
        refreshTokenPrefix: tokenConfig.refresh_token.substring(0, 15) + '...',
        currentTokenPrefix: tokenConfig.access_token?.substring(0, 15) + '...',
      });

      const refreshResult = await this.refreshAccessToken(provider.type, tokenConfig.refresh_token);

      if (!refreshResult.success) {
        logger.error('❌ TOKEN REFRESH FAILED: Could not obtain new access token', {
          storageProviderId,
          error: refreshResult.error,
        });
        return {
          success: false,
          error: `Token refresh failed: ${refreshResult.error}`,
        };
      }

      logger.info('✅ TOKEN REFRESH SUCCESS: New access token obtained', {
        storageProviderId,
        provider: provider.type,
        oldTokenPrefix: tokenConfig.access_token?.substring(0, 15) + '...',
        newTokenPrefix: refreshResult.access_token!.substring(0, 15) + '...',
        expiresInSeconds: refreshResult.expires_in,
        expiresInHours: refreshResult.expires_in ? Math.round(refreshResult.expires_in / 3600) : 'unknown',
      });

      // Update database with new token
      const newTokenConfig: TokenData = {
        access_token: refreshResult.access_token!,
        refresh_token: refreshResult.refresh_token || tokenConfig.refresh_token,
        expires_in: refreshResult.expires_in,
        token_type: tokenConfig.token_type,
        expires_at: refreshResult.expires_in
          ? Date.now() + refreshResult.expires_in * 1000
          : undefined,
      };

      const updatedStorageConfig = {
        token: JSON.stringify(newTokenConfig),
        tokenExpiresAt: newTokenConfig.expires_at
          ? new Date(newTokenConfig.expires_at).toISOString()
          : undefined,
      };

      await prisma.storageProvider.update({
        where: { id: storageProviderId },
        data: {
          config: JSON.stringify(updatedStorageConfig),
        },
      });

      logger.info('💾 DATABASE UPDATE SUCCESS: Refreshed token saved to database', {
        storageProviderId,
        expiresAt: newTokenConfig.expires_at 
          ? new Date(newTokenConfig.expires_at).toISOString() 
          : 'no expiration set',
      });

      return {
        success: true,
        access_token: newTokenConfig.access_token,
      };
    } catch (error) {
      logger.error('❌ FORCE REFRESH ERROR: Unexpected error during proactive token refresh', {
        storageProviderId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to force refresh token',
      };
    }
  }

  /**
   * Refresh tokens for all storage providers that need it
   */
  public async refreshAllExpiredTokens(): Promise<void> {
    try {
      const providers = await prisma.storageProvider.findMany({
        where: {
          enabled: true,
        },
      });

      for (const provider of providers) {
        try {
          const result = await this.getValidAccessToken(provider.id);
          if (!result.success) {
            logger.warn(
              `Failed to refresh token for storage provider ${provider.id}: ${result.error}`
            );
          }
        } catch (error) {
          logger.error(`Error processing storage provider ${provider.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error during token refresh check:', error);
    }
  }

  /**
   * Session-token compatibility wrapper - see the note above OAuthToken.
   */
  private async refreshSessionToken(provider: string, token: OAuthToken): Promise<OAuthToken> {
    if (!token.refresh_token) {
      throw new TokenRefreshError(
        `No refresh token available for ${provider}`,
        TokenErrorType.INVALID_GRANT,
        provider
      );
    }

    const result = await this.refreshAccessToken(provider, token.refresh_token);

    if (!result.success || !result.access_token) {
      throw new TokenRefreshError(
        result.error || `Failed to refresh ${provider} token`,
        TokenErrorType.UNKNOWN,
        provider
      );
    }

    return {
      access_token: result.access_token,
      refresh_token: result.refresh_token || token.refresh_token,
      expires_in: result.expires_in,
      token_type: token.token_type,
      expires_at: result.expires_in ? Date.now() + result.expires_in * 1000 : undefined
    };
  }

  public async refreshGoogleToken(token: OAuthToken): Promise<OAuthToken> {
    return this.refreshSessionToken('google', token);
  }

  public async refreshDropboxToken(token: OAuthToken): Promise<OAuthToken> {
    return this.refreshSessionToken('dropbox', token);
  }

  public async refreshOneDriveToken(token: OAuthToken): Promise<OAuthToken> {
    return this.refreshSessionToken('onedrive', token);
  }
}

// Export singleton instance
export const tokenRefreshManager = TokenRefreshManager.getInstance();
