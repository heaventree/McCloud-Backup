/**
 * OAuth Configuration
 * 
 * This module provides configuration for various OAuth providers.
 * Configurations are loaded from environment variables for security.
 */
import logger from '../utils/logger';

// Use the default logger instance

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
 * Get the current application hostname
 * Automatically detects Replit environment
 * @returns The current hostname
 */
function getCurrentHost(): string {
  // Check for Replit environment variables
  if (process.env.REPL_ID && process.env.REPL_SLUG) {
    // Extract the hostname from the environment - this works because Replit sets X-Forwarded-Host
    return process.env.REPL_SLUG + '.' + process.env.REPL_OWNER + '.repl.co';
  }
  
  // Check for explicit HOST environment variable
  if (process.env.HOST) {
    return process.env.HOST;
  }
  
  // Default development host
  return 'localhost:5000';
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
      // For development purposes, use a local redirect URI on Replit
      const isLocalDev = process.env.NODE_ENV === 'development';
      
      // Use the appropriate domain based on environment
      const host = isLocalDev 
        ? 'f738c5a3-9bfc-4151-bdf2-8948fba1775b-00-1i9hmd1paan5s.picard.replit.dev'
        : getEnv('PRODUCTION_DOMAIN', 'mccloud.kopailot.com');
      
      // Always use HTTPS for external domains
      const protocol = 'https';
      
      // Build the redirect URI with the proper path
      // Local development URI is different from production
      const pathSegment = isLocalDev ? 'api/auth/dropbox/callback' : 'auth/dropbox/callback';
      const dynamicRedirectUri = `${protocol}://${host}/${pathSegment}`;
      
      // For debugging
      console.log('Using Dropbox redirect URI:', dynamicRedirectUri);
      
      return {
        name: 'Dropbox',
        clientId: getEnv('DROPBOX_CLIENT_ID'),
        clientSecret: getEnv('DROPBOX_CLIENT_SECRET'),
        authorizationUrl: 'https://www.dropbox.com/oauth2/authorize',
        tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
        redirectUri: getEnv('DROPBOX_REDIRECT_URI', dynamicRedirectUri),
        scopes: [], // Dropbox allows configuring scopes in their developer console
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