/**
 * CSRF Protection Middleware
 * 
 * This module provides robust CSRF protection for the application,
 * including token generation, validation, and middleware integration.
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { createLogger } from '../utils/logger';

const logger = createLogger('csrf');

// Session key for storing CSRF token
const CSRF_TOKEN_KEY = 'csrfToken';

// Header and form field names for CSRF token
const CSRF_HEADER = 'x-csrf-token';
const CSRF_FORM_FIELD = '_csrf';

// Token refresh interval in milliseconds (30 minutes)
const TOKEN_REFRESH_INTERVAL = 30 * 60 * 1000;

/**
 * Generate a cryptographically secure CSRF token
 * @returns CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get CSRF token from session or generate a new one
 * @param req Express request
 * @returns CSRF token
 */
export function getCsrfToken(req: Request): string {
  // Check if token exists in session
  if (!req.session.csrfToken || !req.session.csrfTokenTimestamp) {
    return refreshCsrfToken(req);
  }
  
  // Check if token needs to be refreshed
  const timestamp = req.session.csrfTokenTimestamp as number;
  if (Date.now() - timestamp > TOKEN_REFRESH_INTERVAL) {
    return refreshCsrfToken(req);
  }
  
  return req.session.csrfToken as string;
}

/**
 * Generate a new CSRF token and store in session
 * @param req Express request
 * @returns New CSRF token
 */
export function refreshCsrfToken(req: Request): string {
  const token = generateCsrfToken();
  req.session.csrfToken = token;
  req.session.csrfTokenTimestamp = Date.now();
  return token;
}

/**
 * Add CSRF token to response locals for template rendering
 * @param req Express request
 * @param res Express response
 * @param next Express next function
 */
export function csrfTokenMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Get or generate CSRF token
  const token = getCsrfToken(req);
  
  // Add to response locals for template rendering
  res.locals.csrfToken = token;
  
  // Add CSRF token to response header for SPA
  res.setHeader(CSRF_HEADER, token);
  
  next();
}

/**
 * Validate CSRF token from request
 * @param req Express request
 * @param token CSRF token from request
 * @returns True if token is valid
 */
export function validateCsrfToken(req: Request, token: string): boolean {
  return req.session.csrfToken === token;
}

/**
 * CSRF protection middleware for APIs and forms
 * This middleware should be applied to all routes that modify state
 * @param req Express request
 * @param res Express response
 * @param next Express next function
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip CSRF check for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Get token from request
  // Check headers first, then body
  const token = req.headers[CSRF_HEADER] as string || 
                (req.body && req.body[CSRF_FORM_FIELD]);
  
  if (!token) {
    logger.warn('CSRF token missing', { 
      url: req.url, 
      method: req.method, 
      ip: req.ip 
    });
    return res.status(403).json({ error: 'CSRF token missing' });
  }
  
  // Validate token
  if (!validateCsrfToken(req, token)) {
    logger.warn('CSRF token invalid', { 
      url: req.url, 
      method: req.method, 
      ip: req.ip,
      token
    });
    return res.status(403).json({ error: 'CSRF token invalid' });
  }
  
  // Token is valid, proceed
  next();
}

/**
 * Generate CSRF token form input HTML
 * @param req Express request
 * @returns HTML for CSRF token input
 */
export function csrfTokenFormField(req: Request): string {
  const token = getCsrfToken(req);
  return `<input type="hidden" name="${CSRF_FORM_FIELD}" value="${token}">`;
}

/**
 * Get CSRF token header and value for fetch requests
 * @param req Express request
 * @returns Object with header name and token
 */
export function getCsrfHeader(req: Request): { header: string, token: string } {
  return {
    header: CSRF_HEADER,
    token: getCsrfToken(req)
  };
}