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
import { createLogger } from './utils/logger';
import { securityHeaders } from './security/headers';
import { csrfTokenMiddleware, csrfProtection } from './security/csrf';
import { errorHandler, notFoundHandler } from './utils/error-handler';
import { ipRateLimit, apiRateLimit } from './utils/rate-limit';
import { registerHealthRoutes } from './utils/health';
import { validateOAuthConfigs } from './security/oauth-config';

const logger = createLogger('middleware');
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
        requestId
      });
    });
    
    next();
  });
  
  // Security headers
  app.use(securityHeaders());
  
  // Session management
  const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'dev-session-secret',
    resave: false,
    saveUninitialized: false,
    name: 'mccloud.sid',
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    store: new MemorySessionStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    })
  };
  
  if (process.env.NODE_ENV === 'production' && !sessionConfig.cookie.secure) {
    logger.warn('Session cookies not set to secure in production environment');
  }
  
  app.use(session(sessionConfig));
  
  // Authentication
  app.use(passport.initialize());
  app.use(passport.session());
  
  // CSRF protection - must be after session middleware
  app.use(csrfTokenMiddleware);
  
  // Basic rate limiting for all requests
  app.use(ipRateLimit(240, 60 * 1000)); // 240 requests per minute per IP
  
  // More restrictive rate limiting for API endpoints
  app.use('/api/', apiRateLimit(60, 60 * 1000)); // 60 requests per minute per IP per endpoint
  
  // Specific rate limiting for authentication endpoints
  app.use('/api/auth/', ipRateLimit(30, 60 * 1000, 'Too many authentication attempts')); 
  
  // Apply CSRF protection to state-changing operations
  // This must be after route-specific middleware to support route-specific exemptions
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF protection for API routes that use token auth
    // Or routes that specifically need to be exempt
    const skipCsrfRoutes = [
      '/api/external/', // For external API clients with token auth
      '/auth/github/callback', // OAuth callbacks
      '/auth/google/callback',
      '/auth/dropbox/callback',
      '/auth/onedrive/callback'
    ];
    
    if (skipCsrfRoutes.some(route => req.path.startsWith(route))) {
      return next();
    }
    
    return csrfProtection(req, res, next);
  });
  
  // Health check routes
  registerHealthRoutes(app);
  
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