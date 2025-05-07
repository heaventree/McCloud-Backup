import { Request, Response, NextFunction, Router } from 'express';
import session from 'express-session';
import MemoryStore from 'memorystore';
import { z } from 'zod';
import { tokenRefreshManager, TokenRefreshError, TokenErrorType } from './TokenRefreshManager';
import logger from './utils/logger';
import csrfProtection from './security/csrf';
import { initiateOAuthFlow, handleOAuthCallback } from './security/oauth';

// Extend Express types to include our session properties
declare module 'express-session' {
  interface SessionData {
    authenticated?: boolean;
    user?: { username: string; role: string };
    oauthTokens?: {
      google?: {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        token_type?: string;
        expires_at?: number;
        scope?: string;
        id_token?: string;
      };
      dropbox?: {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        token_type?: string;
        expires_at?: number;
        scope?: string;
        id_token?: string;
      };
      onedrive?: {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        token_type?: string;
        expires_at?: number;
        scope?: string;
        id_token?: string;
      };
      [key: string]: {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        token_type?: string;
        expires_at?: number;
        scope?: string;
        id_token?: string;
      } | undefined;
    };
    oauthStates?: {
      [key: string]: {
        state: string;
        codeVerifier: string;
        provider: string;
        redirect: string;
        nonce: string;
        createdAt: number;
      };
    };
  }
}

// Define auth schemas
const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

// Create Memory Store
const SessionStore = MemoryStore(session);

// OAuth tokens schema
const oauthTokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
  token_type: z.string().optional()
});

export const authRouter = Router();

// Middleware to check if user is authenticated
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.session.authenticated) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
};

// CSRF token endpoint - explicitly creates a token
authRouter.get('/csrf-token', (req: Request, res: Response) => {
  // Generate a new token using the already imported csrfProtection
  const token = csrfProtection.getNewCsrfToken();
  
  // Manually set it in a cookie
  res.cookie('xsrf-token', token, {
    httpOnly: false, // Allow JavaScript to read it
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/'
  });
  
  // Also return it in the response
  return res.json({ 
    success: true, 
    token: token
  });
});

// Setup session middleware
export function setupAuth(app: any) {
  app.use(session({
    secret: process.env.SESSION_SECRET || 'wordpress-backup-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    store: new SessionStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    })
  }));
  
  app.use('/api', authRouter);
}

// Admin login endpoint
authRouter.post('/login', (req: Request, res: Response) => {
  const requestId = (req as any).requestId || 'unknown';
  logger.info('Login attempt', { 
    requestId,
    hasBody: !!req.body,
    bodyContentType: req.headers['content-type'],
  });
  
  try {
    // Debug logging
    if (!req.body) {
      logger.warn('Login attempt with empty body', { requestId });
      return res.status(400).json({ error: 'Empty request body' });
    }
    
    const { username, password } = loginSchema.parse(req.body);
    logger.info('Login credentials parsed successfully', { requestId, username });
    
    // Check against environment variables for admin credentials
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'password123'; // Default for development
    
    // Debug log to see what's happening
    logger.info('Attempting login with credentials', { 
      requestId,
      providedUsername: username,
      configuredUsername: adminUsername,
      passwordsMatch: password === adminPassword
    });
    
    if (!adminPassword && process.env.NODE_ENV === 'production') {
      logger.error('Admin password not configured in production', { requestId });
      return res.status(500).json({ error: 'Admin password not configured' });
    }
    
    // Force login in development mode for troubleshooting
    if (process.env.NODE_ENV !== 'production' && username === 'admin') {
      logger.info('Development mode: Allowing admin login', { requestId });
      req.session.authenticated = true;
      req.session.user = { username, role: 'admin' };
      return res.json({ success: true, message: 'Login successful (dev mode)' });
    }
    
    if (username === adminUsername && password === adminPassword) {
      logger.info('Login successful', { requestId, username });
      req.session.authenticated = true;
      req.session.user = { username, role: 'admin' };
      return res.json({ success: true, message: 'Login successful' });
    }
    
    logger.warn('Invalid login credentials', { requestId, username });
    return res.status(401).json({ error: 'Invalid username or password' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid login data format', { 
        requestId,
        error: error.errors 
      });
      return res.status(400).json({ error: 'Invalid login data', details: error.errors });
    }
    logger.error('Login error', { 
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({ error: 'Authentication error' });
  }
});

// Logout endpoint
authRouter.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie('connect.sid');
    return res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Auth status endpoint
authRouter.get('/status', (req: Request, res: Response) => {
  if (req.session.authenticated) {
    return res.json({ 
      authenticated: true, 
      user: req.session.user 
    });
  }
  return res.json({ authenticated: false });
});

// Google OAuth token endpoint
authRouter.post('/google/token', async (req: Request, res: Response) => {
  try {
    const tokenData = oauthTokenSchema.parse(req.body);
    // Store the token in session
    if (!req.session.oauthTokens) {
      req.session.oauthTokens = {};
    }
    req.session.oauthTokens.google = tokenData;
    return res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid token data', details: error.errors });
    }
    return res.status(500).json({ error: 'Failed to process token' });
  }
});

// Dropbox OAuth token endpoint
authRouter.post('/dropbox/token', async (req: Request, res: Response) => {
  try {
    const tokenData = oauthTokenSchema.parse(req.body);
    // Store the token in session
    if (!req.session.oauthTokens) {
      req.session.oauthTokens = {};
    }
    req.session.oauthTokens.dropbox = tokenData;
    return res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid token data', details: error.errors });
    }
    return res.status(500).json({ error: 'Failed to process token' });
  }
});

// OneDrive OAuth token endpoint
authRouter.post('/onedrive/token', async (req: Request, res: Response) => {
  try {
    const tokenData = oauthTokenSchema.parse(req.body);
    // Store the token in session
    if (!req.session.oauthTokens) {
      req.session.oauthTokens = {};
    }
    req.session.oauthTokens.onedrive = tokenData;
    return res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid token data', details: error.errors });
    }
    return res.status(500).json({ error: 'Failed to process token' });
  }
});

// OAuth functions are already imported at the top of the file

// Dropbox OAuth authorization endpoint
authRouter.get('/auth/dropbox/authorize', (req: Request, res: Response) => {
  try {
    logger.info('Initiating Dropbox OAuth flow');
    initiateOAuthFlow(req, res, 'dropbox', req.query.redirect as string);
  } catch (error) {
    logger.error('Failed to initiate Dropbox OAuth flow', { error });
    res.status(500).json({ error: 'Failed to initiate authentication' });
  }
});

// Dropbox OAuth callback endpoint
authRouter.get('/auth/dropbox/callback', (req: Request, res: Response) => {
  try {
    logger.info('Handling Dropbox OAuth callback');
    handleOAuthCallback(req, res);
  } catch (error) {
    logger.error('Failed to handle Dropbox OAuth callback', { error });
    res.status(500).json({ error: 'Failed to complete authentication' });
  }
});

// Token refresh manager already imported at the top of the file

// Token refresh endpoints
authRouter.post('/google/refresh', async (req: Request, res: Response) => {
  try {
    if (!req.session.oauthTokens?.google) {
      return res.status(400).json({ 
        error: 'No Google token available to refresh',
        errorType: 'missing_token'
      });
    }

    logger.info('Attempting to refresh Google OAuth token');
    
    const refreshedToken = await tokenRefreshManager.refreshGoogleToken(req.session.oauthTokens.google);
    
    // Update the token in the session
    req.session.oauthTokens.google = refreshedToken;
    
    return res.json({ 
      success: true, 
      message: 'Token refreshed successfully',
      expiresAt: refreshedToken.expires_at
    });
  } catch (error) {
    if (error instanceof TokenRefreshError) {
      logger.error(`Google token refresh error: ${error.message}`, {
        errorType: error.type,
        provider: 'google'
      });

      // Handle specific error types
      if (error.type === TokenErrorType.INVALID_GRANT) {
        // Clear the invalid token
        if (req.session.oauthTokens?.google) {
          delete req.session.oauthTokens.google;
        }
        
        return res.status(401).json({
          error: 'Google authorization expired. Please reconnect your account.',
          errorType: error.type,
          requiresReauth: true
        });
      } 
      
      if (error.type === TokenErrorType.INVALID_CLIENT) {
        return res.status(401).json({
          error: 'Invalid Google OAuth client configuration.',
          errorType: error.type,
          requiresReauth: true
        });
      }
      
      if (error.type === TokenErrorType.RATE_LIMITED) {
        return res.status(429).json({
          error: 'Too many requests. Please try again later.',
          errorType: error.type,
          retryAfter: 60 // Suggest retry after 1 minute
        });
      }
      
      // For other error types
      return res.status(500).json({
        error: `Failed to refresh Google token: ${error.message}`,
        errorType: error.type
      });
    }
    
    // Generic error handling
    logger.error('Unexpected error during Google token refresh', { error });
    return res.status(500).json({ 
      error: 'An unexpected error occurred while refreshing the token',
      errorType: 'unexpected_error'
    });
  }
});

authRouter.post('/dropbox/refresh', async (req: Request, res: Response) => {
  try {
    if (!req.session.oauthTokens?.dropbox) {
      return res.status(400).json({ 
        error: 'No Dropbox token available to refresh',
        errorType: 'missing_token'
      });
    }

    logger.info('Attempting to refresh Dropbox OAuth token');
    
    const refreshedToken = await tokenRefreshManager.refreshDropboxToken(req.session.oauthTokens.dropbox);
    
    // Update the token in the session
    req.session.oauthTokens.dropbox = refreshedToken;
    
    return res.json({ 
      success: true, 
      message: 'Token refreshed successfully',
      expiresAt: refreshedToken.expires_at
    });
  } catch (error) {
    if (error instanceof TokenRefreshError) {
      logger.error(`Dropbox token refresh error: ${error.message}`, {
        errorType: error.type,
        provider: 'dropbox'
      });

      // Handle specific error types
      if (error.type === TokenErrorType.INVALID_GRANT) {
        // Clear the invalid token
        if (req.session.oauthTokens?.dropbox) {
          delete req.session.oauthTokens.dropbox;
        }
        
        return res.status(401).json({
          error: 'Dropbox authorization expired. Please reconnect your account.',
          errorType: error.type,
          requiresReauth: true
        });
      } 
      
      if (error.type === TokenErrorType.INVALID_CLIENT) {
        return res.status(401).json({
          error: 'Invalid Dropbox OAuth client configuration.',
          errorType: error.type,
          requiresReauth: true
        });
      }
      
      if (error.type === TokenErrorType.RATE_LIMITED) {
        return res.status(429).json({
          error: 'Too many requests. Please try again later.',
          errorType: error.type,
          retryAfter: 60 // Suggest retry after 1 minute
        });
      }
      
      // For other error types
      return res.status(500).json({
        error: `Failed to refresh Dropbox token: ${error.message}`,
        errorType: error.type
      });
    }
    
    // Generic error handling
    logger.error('Unexpected error during Dropbox token refresh', { error });
    return res.status(500).json({ 
      error: 'An unexpected error occurred while refreshing the token',
      errorType: 'unexpected_error'
    });
  }
});

authRouter.post('/onedrive/refresh', async (req: Request, res: Response) => {
  try {
    if (!req.session.oauthTokens?.onedrive) {
      return res.status(400).json({ 
        error: 'No OneDrive token available to refresh',
        errorType: 'missing_token'
      });
    }

    logger.info('Attempting to refresh OneDrive OAuth token');
    
    const refreshedToken = await tokenRefreshManager.refreshOneDriveToken(req.session.oauthTokens.onedrive);
    
    // Update the token in the session
    req.session.oauthTokens.onedrive = refreshedToken;
    
    return res.json({ 
      success: true, 
      message: 'Token refreshed successfully',
      expiresAt: refreshedToken.expires_at
    });
  } catch (error) {
    if (error instanceof TokenRefreshError) {
      logger.error(`OneDrive token refresh error: ${error.message}`, {
        errorType: error.type,
        provider: 'onedrive'
      });

      // Handle specific error types
      if (error.type === TokenErrorType.INVALID_GRANT) {
        // Clear the invalid token
        if (req.session.oauthTokens?.onedrive) {
          delete req.session.oauthTokens.onedrive;
        }
        
        return res.status(401).json({
          error: 'OneDrive authorization expired. Please reconnect your account.',
          errorType: error.type,
          requiresReauth: true
        });
      } 
      
      if (error.type === TokenErrorType.INVALID_CLIENT) {
        return res.status(401).json({
          error: 'Invalid OneDrive OAuth client configuration.',
          errorType: error.type,
          requiresReauth: true
        });
      }
      
      if (error.type === TokenErrorType.RATE_LIMITED) {
        return res.status(429).json({
          error: 'Too many requests. Please try again later.',
          errorType: error.type,
          retryAfter: 60 // Suggest retry after 1 minute
        });
      }
      
      // For other error types
      return res.status(500).json({
        error: `Failed to refresh OneDrive token: ${error.message}`,
        errorType: error.type
      });
    }
    
    // Generic error handling
    logger.error('Unexpected error during OneDrive token refresh', { error });
    return res.status(500).json({ 
      error: 'An unexpected error occurred while refreshing the token',
      errorType: 'unexpected_error'
    });
  }
});