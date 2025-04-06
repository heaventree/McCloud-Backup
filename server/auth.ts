import { Request, Response, NextFunction, Router } from 'express';
import session from 'express-session';
import MemoryStore from 'memorystore';
import { z } from 'zod';

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
      };
      dropbox?: {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        token_type?: string;
      };
      onedrive?: {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        token_type?: string;
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
  try {
    const { username, password } = loginSchema.parse(req.body);
    
    // Check against environment variables for admin credentials
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminPassword) {
      return res.status(500).json({ error: 'Admin password not configured' });
    }
    
    if (username === adminUsername && password === adminPassword) {
      req.session.authenticated = true;
      req.session.user = { username, role: 'admin' };
      return res.json({ success: true, message: 'Login successful' });
    }
    
    return res.status(401).json({ error: 'Invalid username or password' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid login data', details: error.errors });
    }
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

// Token refresh endpoints
authRouter.post('/google/refresh', async (req: Request, res: Response) => {
  // Implement token refresh logic for Google
  res.json({ success: true, message: 'Token refreshed' });
});

authRouter.post('/dropbox/refresh', async (req: Request, res: Response) => {
  // Implement token refresh logic for Dropbox
  res.json({ success: true, message: 'Token refreshed' });
});

authRouter.post('/onedrive/refresh', async (req: Request, res: Response) => {
  // Implement token refresh logic for OneDrive
  res.json({ success: true, message: 'Token refreshed' });
});