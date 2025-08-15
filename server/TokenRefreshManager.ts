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

      console.log('=== TOKEN DEBUG ===');
      console.log('Provider ID:', storageProviderId);
      console.log('Provider Type:', provider.type);
      console.log('Access Token prefix:', config.access_token?.substring(0, 15) + '...');
      console.log('Refresh Token prefix:', config.refresh_token?.substring(0, 15) + '...');
      console.log('Token expired?', this.isTokenExpired(config));

      // REMOVED: Don't check timestamp expiry - respond only to actual 401 API errors
      // Always return the current access token - let API calls handle 401 responses
      console.log('Returning current access token (ignoring expiry time - will refresh on 401)');
      return {
        success: true,
        access_token: config.access_token,
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

      // Store updated config back in the same nested format
      const updatedStorageConfig = {
        token: JSON.stringify(newConfig)
          .replace(/"/g, '&quot;')
          .replace(/&/g, '&amp;')
          .replace(/'/g, '&#39;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;'),
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
   * LEGACY: Get valid access token for a storage provider, refreshing if necessary
   * This method is deprecated - use makeDropboxApiCall instead for automatic 401 handling
   */
  public async getValidAccessTokenLegacy(storageProviderId: number): Promise<{
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

      console.log('=== TOKEN DEBUG ===');
      console.log('Provider ID:', storageProviderId);
      console.log('Provider Type:', provider.type);
      console.log('Access Token prefix:', config.access_token?.substring(0, 15) + '...');
      console.log('Refresh Token prefix:', config.refresh_token?.substring(0, 15) + '...');
      console.log('Token expired?', this.isTokenExpired(config));

      // Check if token needs refresh
      if (!this.isTokenExpired(config)) {
        console.log('Token is still valid, returning current access token');
        return {
          success: true,
          access_token: config.access_token,
        };
      }

      console.log('Token expired, attempting refresh...');

      // Token is expired, try to refresh
      if (!config.refresh_token) {
        console.log('ERROR: No refresh token available');
        logger.error(`No refresh token available for storage provider ${storageProviderId}`);
        return {
          success: false,
          error: 'Token expired and no refresh token available',
        };
      }

      console.log(
        'Calling refreshAccessToken with refresh token:',
        config.refresh_token.substring(0, 15) + '...'
      );
      const refreshResult = await this.refreshAccessToken(provider.type, config.refresh_token);

      console.log('Refresh result success:', refreshResult.success);
      if (!refreshResult.success) {
        console.log('Refresh error:', refreshResult.error);
      } else {
        console.log(
          'New access token prefix:',
          refreshResult.access_token?.substring(0, 15) + '...'
        );
      }

      if (!refreshResult.success) {
        // Create notification for token refresh failure
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

      await prisma.storageProvider.update({
        where: { id: storageProviderId },
        data: {
          config: JSON.stringify(newConfig),
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        access_token: newConfig.access_token,
      };
    } catch (error) {
      logger.error(`Error getting valid access token for storage provider ${storageProviderId}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get valid access token',
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
}

// Export singleton instance
export const tokenRefreshManager = TokenRefreshManager.getInstance();
