/**
 * Application Middleware Configuration
 *
 * This module sets up all required middleware for the application,
 * including security, logging, error handling, and more.
 */
import { Express, Request, Response, NextFunction } from 'express';
import session from 'express-session';
import MemoryStore from 'memorystore';
import passport from 'passport';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import logger from './utils/logger';
import { securityHeaders } from './security/headers';
import corsConfig from './security/cors';
import csrfProtection from './security/csrf';
import { errorHandler, notFoundHandler } from './utils/error-handler';
// Rate limiting imports removed
import { registerHealthRoutes } from './utils/health';
import { validateOAuthConfigs } from './security/oauth-config';
import sanitize from './utils/sanitize';

// Simple in-memory cache for server responses
class ResponseCache {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly DEFAULT_TTL = 60 * 1000; // 1 minute

  constructor(private maxSize: number = 100) {}

  set(key: string, data: any): void {
    // Prune cache if it's too large
    if (this.cache.size >= this.maxSize) {
      // Get the first entry (arbitrary)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.DEFAULT_TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

// Create a singleton instance of the cache
export const responseCache = new ResponseCache();

const MemorySessionStore = MemoryStore(session);

/**
 * Configure all middleware for the application
 * @param app Express application
 */
export function setupMiddleware(app: Express): void {
  // Request ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] || uuidv4();
    (req as any).requestId = requestId;
    res.setHeader('X-Request-ID', requestId as string);
    next();
  });

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const method = req.method;
    const url = req.url;
    const requestId = (req as any).requestId;
    const startTime = Date.now();

    // Log request on completion
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const status = res.statusCode;

      logger.info(`${method} ${url} ${status} ${duration}ms`, {
        method,
        url,
        status,
        duration,
        requestId,
      });
    });

    next();
  });

  // Security headers and CORS
  app.use(securityHeaders());

  // Use appropriate CORS configuration based on environment
  if (process.env.NODE_ENV === 'production') {
    app.use(
      corsConfig.configureCors({
        // Restrict origins in production
        // allowedOrigins: process.env.ALLOWED_ORIGINS
        //   ? process.env.ALLOWED_ORIGINS.split(',')
        //   : ['https://app.example.com']
      })
    );
  } else {
    app.use(
      corsConfig.configureCors({
        // Allow more origins in development
        allowedOrigins: ['*'],
      })
    );
  }

  // Add CORS error handler
  app.use(corsConfig.corsErrorHandler);

  // XSS protection through input sanitization
  app.use(sanitize.sanitizeInputs);

  // Session management
  // Generate a strong session secret if not provided
  if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') {
    logger.warn(
      'No SESSION_SECRET provided in production environment - using auto-generated value'
    );
    logger.warn(
      'Auto-generated secrets will change on server restart, invalidating existing sessions'
    );
  }

  // Generate a strong secret for dev environments or as fallback
  const generateStrongSecret = () => {
    return crypto.randomBytes(32).toString('hex');
  };

  const sessionSecret = process.env.SESSION_SECRET || generateStrongSecret();

  const sessionConfig = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: 'mccloud.sid', // Custom session ID name
    cookie: {
      httpOnly: true, // Prevent client-side JavaScript access
      secure: process.env.NODE_ENV === 'production', // Require HTTPS in production
      sameSite: 'lax' as const, // Restrict cross-site request context
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
    store: new MemorySessionStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
  };

  // Security warnings
  if (process.env.NODE_ENV === 'production') {
    if (!sessionConfig.cookie.secure) {
      logger.warn('Session cookies not set to secure in production environment');
    }

    if (!process.env.SESSION_SECRET) {
      logger.warn('Using auto-generated session secret in production');
    }
  }

  app.use(session(sessionConfig));

  // Authentication
  app.use(passport.initialize());
  app.use(passport.session());

  // CSRF protection - must be after session middleware
  app.use(csrfProtection.setCsrfToken);

  // Rate limiting has been disabled
  // No rate limits applied to allow unlimited requests

  // Health check routes
  registerHealthRoutes(app);

  // Apply CSRF protection to state-changing operations
  // This must be after all routes are registered
  // so that routes can opt out of CSRF protection if needed
  app.use((req, res, next) => {
    // Explicitly bypass CSRF for login endpoint
    if (req.path === '/api/login') {
      logger.info('Bypassing CSRF validation for login endpoint', { path: req.path });
      next();
      return;
    }
    // Otherwise apply CSRF validation
    csrfProtection.validateCsrfToken(req, res, next);
  });

  // Validate OAuth configurations on startup
  validateOAuthConfigs();

  logger.info('Middleware configuration complete');
}

/**
 * Configure error handling middleware
 * Must be called after all routes are registered
 * @param app Express application
 */
export function setupErrorHandling(app: Express): void {
  // 404 handler
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  logger.info('Error handling middleware configured');
}
