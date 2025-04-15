/**
 * CSRF Protection Utility
 * 
 * This module provides Cross-Site Request Forgery protection for API endpoints.
 * It implements a double-submit cookie pattern for CSRF tokens with secure validation.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import logger from '../utils/logger';

// Token expiration time in milliseconds (30 minutes)
const TOKEN_EXPIRY = 30 * 60 * 1000;

// Name of the CSRF cookie and header
const CSRF_COOKIE_NAME = 'xsrf-token';
const CSRF_HEADER_NAME = 'x-xsrf-token';

// Secret key for HMAC validation (in production, this should be an environment variable)
const SECRET_KEY = crypto.randomBytes(32).toString('hex');

// Token structure for verification
interface CSRFToken {
  value: string;
  expires: number;
}

/**
 * Generate a new CSRF token
 * @returns {string} The generated token
 */
function generateToken(): string {
  const random = crypto.randomBytes(32).toString('hex');
  const timestamp = Date.now();
  const hmac = crypto.createHmac('sha256', SECRET_KEY)
    .update(`${random}:${timestamp}`)
    .digest('hex');
    
  return `${random}:${timestamp}:${hmac}`;
}

/**
 * Verify a CSRF token
 * @param {string} token The token to verify
 * @returns {boolean} Whether the token is valid
 */
function verifyToken(token: string): boolean {
  try {
    const [random, timestamp, providedHmac] = token.split(':');
    
    if (!random || !timestamp || !providedHmac) {
      return false;
    }
    
    // Check if token has expired
    const tokenTime = parseInt(timestamp, 10);
    const now = Date.now();
    
    if (isNaN(tokenTime) || now - tokenTime > TOKEN_EXPIRY) {
      return false;
    }
    
    // Verify HMAC
    const expectedHmac = crypto.createHmac('sha256', SECRET_KEY)
      .update(`${random}:${timestamp}`)
      .digest('hex');
      
    return crypto.timingSafeEqual(
      Buffer.from(providedHmac),
      Buffer.from(expectedHmac)
    );
  } catch (err) {
    logger.error('[csrf] Token verification error', { error: err });
    return false;
  }
}

/**
 * Middleware to set CSRF token cookie
 */
export function setCsrfToken(req: Request, res: Response, next: NextFunction): void {
  // Only set the token if it doesn't exist or is about to expire
  const existingToken = req.cookies?.[CSRF_COOKIE_NAME];
  
  if (!existingToken || !verifyToken(existingToken)) {
    const token = generateToken();
    
    // Set cookie with appropriate security flags
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: TOKEN_EXPIRY
    });
    
    // Also expose the token in the response for the client to use
    res.setHeader('X-CSRF-Token', token);
  }
  
  next();
}

/**
 * Middleware to validate CSRF token on state-changing requests
 */
export function validateCsrfToken(req: Request, res: Response, next: NextFunction): void {
  // Only validate on state-changing methods
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  
  if (!stateChangingMethods.includes(req.method)) {
    next();
    return;
  }
  
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.header(CSRF_HEADER_NAME);
  
  // Check if both tokens exist and match
  if (!cookieToken || !headerToken) {
    logger.warn('[csrf] Missing CSRF token', {
      path: req.path,
      hasCookieToken: !!cookieToken,
      hasHeaderToken: !!headerToken
    });
    res.status(403).json({ error: 'CSRF token missing' });
    return;
  }
  
  // Validate token format and expiry
  if (!verifyToken(cookieToken)) {
    logger.warn('[csrf] Invalid or expired CSRF token', { path: req.path });
    res.status(403).json({ error: 'CSRF token invalid or expired' });
    return;
  }
  
  // Ensure tokens match
  if (cookieToken !== headerToken) {
    logger.warn('[csrf] CSRF token mismatch', { path: req.path });
    res.status(403).json({ error: 'CSRF token mismatch' });
    return;
  }
  
  next();
}

/**
 * Get a CSRF token for the current session
 * Intended for use in API routes that need to provide a token to the client
 */
export function getNewCsrfToken(): string {
  return generateToken();
}

export default {
  setCsrfToken,
  validateCsrfToken,
  getNewCsrfToken
};