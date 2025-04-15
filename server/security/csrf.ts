/**
 * CSRF Protection Middleware
 * 
 * This module provides middleware for Cross-Site Request Forgery (CSRF) protection,
 * generating and validating CSRF tokens for secure form submissions.
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { createLogger } from '../utils/logger';

declare module 'express-session' {
  interface SessionData {
    csrfToken?: string;
    csrfTokenTimestamp?: number;
  }
}

const logger = createLogger('csrf');

// CSRF token expiration time (15 minutes)
const CSRF_TOKEN_EXPIRATION = 15 * 60 * 1000;

// Paths that are exempt from CSRF protection
const EXEMPT_PATHS = [
  '/api/auth/login',
  '/api/auth/status',
  '/health',
  '/api/backup/providers',
  '/api/backup/providers/github/fields'
];

// HTTP methods that don't modify state (don't need CSRF protection)
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Generate a CSRF token and store it in the session
 * 
 * @param req - Express request
 * @returns CSRF token
 */
export function generateCsrfToken(req: Request): string {
  // Generate a random token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Store the token and timestamp in the session
  req.session.csrfToken = token;
  req.session.csrfTokenTimestamp = Date.now();
  
  return token;
}

/**
 * Middleware to validate CSRF token
 * 
 * @param req - Express request
 * @param res - Express response
 * @param next - Next function
 */
export function validateCsrfToken(req: Request, res: Response, next: NextFunction): any {
  // Skip CSRF validation for exempt paths
  if (EXEMPT_PATHS.some(path => req.path.startsWith(path))) {
    return next();
  }
  
  // Skip CSRF validation for safe methods
  if (SAFE_METHODS.includes(req.method)) {
    return next();
  }
  
  // Get token from request
  const token = 
    req.body._csrf || 
    req.query._csrf as string || 
    req.headers['x-csrf-token'] as string || 
    req.headers['csrf-token'] as string;
  
  // If no token is provided
  if (!token) {
    logger.warn('CSRF token missing', {
      url: req.path,
      method: req.method,
      ip: req.ip
    });
    
    res.status(403).json({
      error: 'CSRF token missing'
    });
    return;
  }
  
  // Get token from session
  const sessionToken = req.session.csrfToken;
  const tokenTimestamp = req.session.csrfTokenTimestamp;
  
  // If no token is stored in the session
  if (!sessionToken || !tokenTimestamp) {
    logger.warn('No CSRF token in session', {
      url: req.path,
      method: req.method,
      ip: req.ip
    });
    
    res.status(403).json({
      error: 'Invalid session. Please refresh the page and try again.'
    });
    return;
  }
  
  // Check if token has expired
  const now = Date.now();
  if (now - tokenTimestamp > CSRF_TOKEN_EXPIRATION) {
    logger.warn('CSRF token expired', {
      url: req.path,
      method: req.method,
      ip: req.ip,
      tokenAge: now - tokenTimestamp
    });
    
    // Generate a new token
    generateCsrfToken(req);
    
    res.status(403).json({
      error: 'CSRF token expired. Please refresh the page and try again.'
    });
    return;
  }
  
  // Validate token
  if (token !== sessionToken) {
    logger.warn('CSRF token mismatch', {
      url: req.path,
      method: req.method,
      ip: req.ip
    });
    
    res.status(403).json({
      error: 'Invalid CSRF token. Please refresh the page and try again.'
    });
    return;
  }
  
  // Token is valid, continue
  next();
}

/**
 * Middleware to attach CSRF token to response locals
 * 
 * @param req - Express request
 * @param res - Express response
 * @param next - Next function
 */
export function attachCsrfToken(req: Request, res: Response, next: NextFunction): void {
  // Generate a token if none exists or it's expired
  if (!req.session.csrfToken || 
      !req.session.csrfTokenTimestamp || 
      Date.now() - req.session.csrfTokenTimestamp > CSRF_TOKEN_EXPIRATION) {
    generateCsrfToken(req);
  }
  
  // Attach token to response locals
  res.locals.csrfToken = req.session.csrfToken;
  
  next();
}

/**
 * API route to get a new CSRF token
 * 
 * @param req - Express request
 * @param res - Express response
 */
export function getCsrfToken(req: Request, res: Response): any {
  const token = generateCsrfToken(req);
  
  res.json({
    token,
    expires: Date.now() + CSRF_TOKEN_EXPIRATION
  });
}

/**
 * Setup CSRF protection middleware
 * 
 * @param app - Express application
 */
export function setupCsrfProtection(app: any): void {
  // Attach CSRF token to all requests
  app.use(attachCsrfToken);
  
  // Validate CSRF token for state-changing requests
  app.use(validateCsrfToken);
  
  // Add route to get a new CSRF token
  app.get('/api/csrf-token', getCsrfToken);
  
  logger.info('CSRF protection middleware configured');
}

export default {
  setupCsrfProtection,
  generateCsrfToken,
  validateCsrfToken,
  attachCsrfToken,
  getCsrfToken
};