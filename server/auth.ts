import { Request, Response, NextFunction, Router } from 'express';
import session from 'express-session';
import MemoryStore from 'memorystore';
import { z } from 'zod';
// Token refresh is now handled by the centralized TokenRefreshManager
import logger from './utils/logger';
import csrfProtection from './security/csrf';
import { initiateOAuthFlow, handleOAuthCallback } from './security/oauth';
import { scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { storage } from './storage';

// For password verification
const scryptAsync = promisify(scrypt);

// Function to verify a password against a stored hash
async function verifyPassword(providedPassword: string, storedHash: string): Promise<boolean> {
  try {
    const [hashedPassword, salt] = storedHash.split('.');
    const hashedPasswordBuf = Buffer.from(hashedPassword, 'hex');
    const providedPasswordBuf = await scryptAsync(providedPassword, salt, 64) as Buffer;
    return timingSafeEqual(hashedPasswordBuf, providedPasswordBuf);
  } catch (error) {
    logger.error('Error verifying password', { error });
    return false;
  }
}

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
authRouter.post('/login', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId || 'unknown';

  
  try {
    // Debug logging
    if (!req.body) {
      logger.warn('Login attempt with empty body', { requestId });
      return res.status(400).json({ error: 'Empty request body' });
    }
    
    const { username, password } = loginSchema.parse(req.body);

    
    // First try to find the user in the database
    const user = await storage.getUserByUsername(username);
    
    // If user doesn't exist, return a specific error message
    if (!user) {
      logger.warn('Username not found', { requestId, username });
      return res.status(401).json({ 
        success: false, 
        error: 'User not found. Please check your username and try again.'
      });
    }
    
    // Now verify the password against the stored hash
    const isValidPassword = await verifyPassword(password, user.password);
    
    if (isValidPassword) {

      req.session.authenticated = true;
      req.session.user = { 
        username: user.username, 
        role: user.role 
      };
      return res.json({ 
        success: true, 
        message: 'Login successful' 
      });
    } else {
      // Password is invalid
      logger.warn('Invalid password', { requestId, username });
      return res.status(401).json({ 
        success: false, 
        error: 'Incorrect password. Please try again.'
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid login data format', { 
        requestId,
        error: error.errors 
      });
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid login data', 
        details: error.errors 
      });
    }
    
    logger.error('Login error', { 
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({ 
      success: false, 
      error: 'Authentication error. Please try again later.'
    });
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

    initiateOAuthFlow(req, res, 'dropbox', req.query.redirect as string);
  } catch (error) {
    logger.error('Failed to initiate Dropbox OAuth flow', { error });
    res.status(500).json({ error: 'Failed to initiate authentication' });
  }
});

// Dropbox OAuth callback endpoint
authRouter.get('/auth/dropbox/callback', (req: Request, res: Response) => {
  try {

    handleOAuthCallback(req, res);
  } catch (error) {
    logger.error('Failed to handle Dropbox OAuth callback', { error });
    res.status(500).json({ error: 'Failed to complete authentication' });
  }
});

// Token refresh manager already imported at the top of the file

// Token refresh endpoints


