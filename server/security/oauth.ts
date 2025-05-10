/**
 * Enhanced OAuth Implementation with PKCE Support
 * 
 * This module provides a secure implementation of OAuth 2.0 with PKCE extension,
 * proper state parameter handling, secure token storage, and token validation.
 */
import crypto from 'crypto';
import axios from 'axios';
import { Request, Response, NextFunction } from 'express';
import { getOAuthConfig } from './oauth-config';
import { encrypt as encryptData, decrypt as decryptData } from './simple-encryption';
import logger from '../utils/logger';

// Use the default logger instance

// Types
export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
}

export interface OAuthState {
  state: string;
  codeVerifier: string;
  provider: string;
  redirect: string;
  nonce: string;
  createdAt: number;
}

/**
 * Generate a cryptographically secure random string
 * @param length Length of the string
 * @returns Random string
 */
export function generateRandomString(length: number): string {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Generate a code verifier for PKCE
 * @returns A random string of appropriate length for code verifier
 */
export function generateCodeVerifier(): string {
  return generateRandomString(64);
}

/**
 * Generate a code challenge from a code verifier using S256 method
 * @param codeVerifier The code verifier to create challenge from
 * @returns The code challenge
 */
export function generateCodeChallenge(codeVerifier: string): string {
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  return hash.toString('base64url');
}

/**
 * Generate a state parameter and associated data for OAuth flow
 * @param provider The OAuth provider name
 * @param redirect Optional redirect URL after authentication
 * @returns OAuth state object
 */
export function generateOAuthState(provider: string, redirect?: string): OAuthState {
  return {
    state: generateRandomString(32),
    codeVerifier: generateCodeVerifier(),
    provider,
    redirect: redirect || '/',
    nonce: generateRandomString(16),
    createdAt: Date.now()
  };
}

/**
 * Store OAuth state securely in session
 * @param req Express request
 * @param oauthState OAuth state object
 */
export function storeOAuthState(req: Request, oauthState: OAuthState): void {
  if (!req.session.oauthStates) {
    req.session.oauthStates = {};
  }
  req.session.oauthStates[oauthState.state] = oauthState;
  logger.debug(`Stored OAuth state for ${oauthState.provider}`);
}

/**
 * Retrieve and validate OAuth state from session
 * @param req Express request
 * @param state State parameter from callback
 * @returns OAuth state if valid, null otherwise
 */
export function getAndValidateOAuthState(req: Request, state: string): OAuthState | null {
  if (!req.session.oauthStates || !req.session.oauthStates[state]) {
    logger.warn('Invalid OAuth state parameter or missing session state');
    return null;
  }

  const oauthState = req.session.oauthStates[state];
  
  // Check if state is expired (10 minutes)
  const MAX_STATE_AGE = 10 * 60 * 1000; // 10 minutes
  if (Date.now() - oauthState.createdAt > MAX_STATE_AGE) {
    logger.warn('OAuth state expired');
    delete req.session.oauthStates[state];
    return null;
  }

  // Remove state after use to prevent replay
  delete req.session.oauthStates[state];
  return oauthState;
}

/**
 * Store OAuth tokens securely
 * @param req Express request
 * @param provider OAuth provider name
 * @param tokens OAuth tokens
 */
export function storeTokens(req: Request, provider: string, tokens: OAuthTokens): void {
  if (!req.session.oauthTokens) {
    req.session.oauthTokens = {};
  }

  try {
    // Don't store tokens directly in session, encrypt sensitive data
    const encryptedTokens = {
      access_token: encryptData(tokens.access_token),
      refresh_token: tokens.refresh_token ? encryptData(tokens.refresh_token) : undefined,
      expires_in: tokens.expires_in,
      token_type: tokens.token_type,
      expires_at: tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : undefined,
      scope: tokens.scope,
      id_token: tokens.id_token ? encryptData(tokens.id_token) : undefined
    };

    // Type assertion to work around TypeScript issues
    req.session.oauthTokens[provider] = encryptedTokens as any;
    logger.info(`Stored OAuth tokens for ${provider}`);
  } catch (error) {
    logger.error(`Failed to store OAuth tokens for ${provider}:`, error);
  }
}

/**
 * Get decrypted OAuth tokens
 * @param req Express request
 * @param provider OAuth provider name
 * @returns Decrypted OAuth tokens or null if not found
 */
export function getTokens(req: Request, provider: string): OAuthTokens | null {
  if (!req.session.oauthTokens || !req.session.oauthTokens[provider]) {
    return null;
  }

  const encryptedTokens = req.session.oauthTokens[provider];
  
  try {
    // Use our simpler synchronous encryption
    const accessToken = decryptData(encryptedTokens.access_token);
    const refreshToken = encryptedTokens.refresh_token ? 
      decryptData(encryptedTokens.refresh_token) : undefined;
    const idToken = encryptedTokens.id_token ? 
      decryptData(encryptedTokens.id_token) : undefined;
      
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: encryptedTokens.expires_in,
      token_type: encryptedTokens.token_type,
      scope: encryptedTokens.scope,
      id_token: idToken as string | undefined
    };
  } catch (error) {
    logger.error(`Error decrypting tokens for ${provider}:`, error);
    return null;
  }
}

/**
 * Check if tokens are expired and need refreshing
 * @param req Express request
 * @param provider OAuth provider name
 * @returns True if tokens are expired or will expire soon
 */
export function areTokensExpired(req: Request, provider: string): boolean {
  if (!req.session.oauthTokens || !req.session.oauthTokens[provider]) {
    return true;
  }

  const tokens = req.session.oauthTokens[provider];
  
  if (!tokens.expires_at) {
    return false; // Can't determine expiration
  }

  // Consider tokens expired if they expire in less than 5 minutes
  const EXPIRATION_BUFFER = 5 * 60 * 1000; // 5 minutes
  return Date.now() + EXPIRATION_BUFFER > tokens.expires_at;
}

/**
 * Refresh OAuth tokens
 * @param req Express request
 * @param provider OAuth provider name
 * @returns True if tokens were refreshed successfully
 */
export async function refreshTokens(req: Request, provider: string): Promise<boolean> {
  const tokens = getTokens(req, provider);
  
  if (!tokens || !tokens.refresh_token) {
    logger.warn(`Cannot refresh tokens for ${provider}: No refresh token available`);
    return false;
  }

  try {
    const config = getOAuthConfig(provider);
    const response = await axios.post(config.tokenUrl, {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token'
    });

    const newTokens: OAuthTokens = response.data;
    
    // Preserve refresh token if not returned in response
    if (!newTokens.refresh_token && tokens.refresh_token) {
      newTokens.refresh_token = tokens.refresh_token;
    }

    storeTokens(req, provider, newTokens);
    logger.info(`Refreshed OAuth tokens for ${provider}`);
    return true;
  } catch (error) {
    logger.error(`Failed to refresh tokens for ${provider}`, error);
    return false;
  }
}

/**
 * Validate an access token with the provider
 * @param provider OAuth provider name
 * @param accessToken Access token to validate
 * @returns True if token is valid
 */
export async function validateToken(provider: string, accessToken: string): Promise<boolean> {
  try {
    const config = getOAuthConfig(provider);
    
    // Different providers have different validation endpoints
    switch (provider) {
      case 'google':
        await axios.get('https://www.googleapis.com/oauth2/v3/tokeninfo', {
          params: { access_token: accessToken }
        });
        break;
      case 'github':
        await axios.get('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        break;
      case 'dropbox':
        await axios.post('https://api.dropboxapi.com/2/check/user', {}, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        break;
      default:
        if (config.validationUrl) {
          await axios.get(config.validationUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
        } else {
          logger.warn(`No validation URL defined for provider ${provider}`);
          return true; // Assume valid if no validation URL
        }
    }
    
    return true;
  } catch (error) {
    logger.error(`Token validation failed for ${provider}`, error);
    return false;
  }
}

/**
 * Middleware to ensure OAuth tokens are valid and refreshed if needed
 * @param provider OAuth provider name
 * @returns Express middleware function
 */
export function requireValidToken(provider: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if tokens exist
    if (!req.session.oauthTokens || !req.session.oauthTokens[provider]) {
      logger.warn(`No OAuth tokens for ${provider}`);
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if tokens are expired
    if (areTokensExpired(req, provider)) {
      logger.info(`Tokens for ${provider} are expired, attempting refresh`);
      const refreshed = await refreshTokens(req, provider);
      if (!refreshed) {
        logger.warn(`Failed to refresh tokens for ${provider}`);
        return res.status(401).json({ error: 'Authentication expired' });
      }
    }

    // Validate token
    const tokens = getTokens(req, provider);
    if (!tokens) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const isValid = await validateToken(provider, tokens.access_token);
    if (!isValid) {
      logger.warn(`Invalid token for ${provider}`);
      return res.status(401).json({ error: 'Authentication invalid' });
    }

    next();
  };
}

/**
 * Initiate OAuth flow with PKCE
 * @param req Express request
 * @param res Express response
 * @param provider OAuth provider name
 * @param redirect Optional redirect URL after authentication
 */
export function initiateOAuthFlow(req: Request, res: Response, provider: string, redirect?: string) {
  try {
    const config = getOAuthConfig(provider);
    const oauthState = generateOAuthState(provider, redirect);
    const codeChallenge = generateCodeChallenge(oauthState.codeVerifier);
    
    storeOAuthState(req, oauthState);
    
    const authUrl = new URL(config.authorizationUrl);
    authUrl.searchParams.append('client_id', config.clientId);
    authUrl.searchParams.append('redirect_uri', config.redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('state', oauthState.state);
    
    // Dropbox has different OAuth requirements
    if (provider === 'dropbox') {
      // Dropbox doesn't support PKCE in the same way
      // Don't append scopes if empty - Dropbox configures these in the app console
      if (config.scopes.length > 0) {
        authUrl.searchParams.append('scope', config.scopes.join(' '));
      }
      
      // Use token access type for offline access (to get refresh token)
      authUrl.searchParams.append('token_access_type', 'offline');
    } else {
      // For other providers, use standard PKCE flow
      if (config.scopes.length > 0) {
        authUrl.searchParams.append('scope', config.scopes.join(' '));
      }
      authUrl.searchParams.append('code_challenge', codeChallenge);
      authUrl.searchParams.append('code_challenge_method', 'S256');
      authUrl.searchParams.append('nonce', oauthState.nonce);
    }
    
    logger.info(`Initiating OAuth flow for ${provider}`);
    logger.info(`Authorization URL: ${authUrl.toString()}`);
    res.redirect(authUrl.toString());
  } catch (error) {
    logger.error(`Error initiating OAuth flow for ${provider}`, error);
    res.status(500).json({ error: 'Failed to initiate authentication' });
  }
}

/**
 * Handle OAuth callback with PKCE validation
 * @param req Express request
 * @param res Express response
 */
export async function handleOAuthCallback(req: Request, res: Response) {
  try {
    const { code, state, error } = req.query as { code?: string, state?: string, error?: string };
    
    if (error) {
      logger.warn(`OAuth error: ${error}`);
      return res.redirect('/auth/error?error=' + encodeURIComponent(error.toString()));
    }
    
    if (!code || !state) {
      logger.warn('Missing code or state parameter');
      return res.redirect('/auth/error?error=missing_parameters');
    }
    
    // Validate state parameter to prevent CSRF
    const oauthState = getAndValidateOAuthState(req, state.toString());
    if (!oauthState) {
      logger.warn('Invalid OAuth state');
      return res.redirect('/auth/error?error=invalid_state');
    }
    
    const provider = oauthState.provider;
    const config = getOAuthConfig(provider);
    
    let tokenResponse;
    if (provider === 'dropbox') {
      // Dropbox requires form data instead of JSON
      const params = new URLSearchParams();
      params.append('client_id', config.clientId);
      params.append('client_secret', config.clientSecret);
      params.append('code', code.toString());
      params.append('redirect_uri', config.redirectUri);
      params.append('grant_type', 'authorization_code');
      
      // Log the request parameters for debugging
      logger.info(`Exchanging code for token with Dropbox. Params: ${JSON.stringify({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code'
      })}`);
      
      tokenResponse = await axios.post(config.tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
    } else {
      // Standard OAuth flow for other providers including PKCE
      tokenResponse = await axios.post(config.tokenUrl, {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: code.toString(),
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: oauthState.codeVerifier
      });
    }
    
    // Log the token response structure for debugging
    logger.info(`Token response received with keys: ${Object.keys(tokenResponse.data).join(', ')}`);
    
    const tokens: OAuthTokens = tokenResponse.data;
    
    // Store tokens securely
    storeTokens(req, provider, tokens);
    
    // Create or update storage provider in database
    // This would typically call a service to store provider info in database
    
    logger.info(`OAuth authentication successful for ${provider}`);
    res.redirect(oauthState.redirect || '/');
  } catch (error) {
    logger.error('OAuth callback error', error);
    res.redirect('/auth/error?error=authentication_failed');
  }
}

/**
 * Revoke OAuth tokens
 * @param req Express request
 * @param provider OAuth provider name
 * @returns True if tokens were revoked successfully
 */
export async function revokeTokens(req: Request, provider: string): Promise<boolean> {
  const tokens = getTokens(req, provider);
  
  if (!tokens) {
    return true; // No tokens to revoke
  }

  try {
    const config = getOAuthConfig(provider);
    
    if (config.revocationUrl) {
      await axios.post(config.revocationUrl, {
        token: tokens.access_token,
        client_id: config.clientId,
        client_secret: config.clientSecret
      });
      
      if (tokens.refresh_token) {
        await axios.post(config.revocationUrl, {
          token: tokens.refresh_token,
          client_id: config.clientId,
          client_secret: config.clientSecret
        });
      }
    }
    
    // Remove tokens from session
    if (req.session.oauthTokens) {
      delete req.session.oauthTokens[provider];
    }
    
    logger.info(`Revoked OAuth tokens for ${provider}`);
    return true;
  } catch (error) {
    logger.error(`Failed to revoke tokens for ${provider}`, error);
    return false;
  }
}