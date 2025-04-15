/**
 * OAuth Configuration
 * 
 * This module provides configuration for various OAuth providers.
 * Configurations are loaded from environment variables for security.
 */
import { createLogger } from '../utils/logger';

const logger = createLogger('oauth-config');

export interface OAuthProviderConfig {
  name: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scopes: string[];
  validationUrl?: string;
  revocationUrl?: string;
}

/**
 * Load and validate required environment variables
 * @param name Variable name
 * @param fallback Optional fallback value
 * @returns Environment variable value or fallback
 */
function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value && fallback === undefined) {
    logger.warn(`Missing environment variable: ${name}`);
  }
  return value || '';
}

/**
 * Get OAuth configuration for specific provider
 * @param provider Provider name (google, github, dropbox, onedrive)
 * @returns OAuth provider configuration
 */
export function getOAuthConfig(provider: string): OAuthProviderConfig {
  // Base URL for redirect URI
  const baseUrl = getEnv('BASE_URL', 'http://localhost:5000');
  
  switch (provider.toLowerCase()) {
    case 'google':
      return {
        name: 'Google',
        clientId: getEnv('GOOGLE_CLIENT_ID'),
        clientSecret: getEnv('GOOGLE_CLIENT_SECRET'),
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        redirectUri: `${baseUrl}/auth/google/callback`,
        scopes: ['https://www.googleapis.com/auth/drive'],
        validationUrl: 'https://www.googleapis.com/oauth2/v3/tokeninfo',
        revocationUrl: 'https://oauth2.googleapis.com/revoke'
      };
      
    case 'github':
      return {
        name: 'GitHub',
        clientId: getEnv('GITHUB_CLIENT_ID'),
        clientSecret: getEnv('GITHUB_CLIENT_SECRET'),
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        redirectUri: `${baseUrl}/auth/github/callback`,
        scopes: ['repo', 'user'],
        validationUrl: 'https://api.github.com/user',
        // GitHub doesn't have a dedicated revocation endpoint, tokens must be deleted via API
      };
      
    case 'dropbox':
      return {
        name: 'Dropbox',
        clientId: getEnv('DROPBOX_CLIENT_ID'),
        clientSecret: getEnv('DROPBOX_CLIENT_SECRET'),
        authorizationUrl: 'https://www.dropbox.com/oauth2/authorize',
        tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
        redirectUri: `${baseUrl}/auth/dropbox/callback`,
        scopes: ['files.content.write', 'files.content.read'],
        validationUrl: 'https://api.dropboxapi.com/2/check/user',
        revocationUrl: 'https://api.dropboxapi.com/2/auth/token/revoke'
      };
      
    case 'onedrive':
      return {
        name: 'OneDrive',
        clientId: getEnv('ONEDRIVE_CLIENT_ID'),
        clientSecret: getEnv('ONEDRIVE_CLIENT_SECRET'),
        authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        redirectUri: `${baseUrl}/auth/onedrive/callback`,
        scopes: ['Files.ReadWrite', 'offline_access'],
        validationUrl: 'https://graph.microsoft.com/v1.0/me',
        // OneDrive doesn't have a dedicated token revocation endpoint
      };
      
    default:
      logger.error(`Unknown OAuth provider: ${provider}`);
      throw new Error(`Unknown OAuth provider: ${provider}`);
  }
}

/**
 * Validate OAuth configurations on startup
 * Logs warnings for missing or incomplete configurations
 */
export function validateOAuthConfigs(): void {
  const providers = ['google', 'github', 'dropbox', 'onedrive'];
  
  providers.forEach(provider => {
    try {
      const config = getOAuthConfig(provider);
      const missing = [];
      
      if (!config.clientId) missing.push('Client ID');
      if (!config.clientSecret) missing.push('Client Secret');
      
      if (missing.length > 0) {
        logger.warn(`Incomplete OAuth configuration for ${provider}: Missing ${missing.join(', ')}`);
      } else {
        logger.info(`OAuth configuration for ${provider} is valid`);
      }
    } catch (error) {
      logger.error(`Error validating OAuth config for ${provider}`, error);
    }
  });
}