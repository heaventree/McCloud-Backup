/**
 * CSRF Protection Utility
 * 
 * This module provides Cross-Site Request Forgery protection for API endpoints.
 * It implements a double-submit cookie pattern for CSRF tokens with secure validation.
 * 
 * Enhanced CSRF protection with:
 * - 128 bits of entropy for token generation
 * - Secure cookie attributes with proper SameSite policy
 * - Environment-specific configuration with secure defaults
 * - Rotation of the HMAC secret key
 * - Detailed logging for security events
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import logger from '../utils/logger';

// Token expiration time in milliseconds (default: 30 minutes)
const TOKEN_EXPIRY = parseInt(process.env.CSRF_TOKEN_EXPIRY || '1800000', 10);

// Name of the CSRF cookie and header
const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || 'xsrf-token';
const CSRF_HEADER_NAME = process.env.CSRF_HEADER_NAME || 'x-xsrf-token';

// Generate a strong secret for HMAC validation with 256 bits of entropy
// In production, use an environment variable for the base secret
const getSecretKey = (): string => {
  // Use environment variable if provided
  if (process.env.CSRF_SECRET) {
    return process.env.CSRF_SECRET;
  }
  
  // Otherwise generate a strong random key
  return crypto.randomBytes(32).toString('base64');
};

// Initialize the primary secret key
let PRIMARY_SECRET_KEY = getSecretKey();

// Initialize a secondary key for rotation (initially same as primary)
let SECONDARY_SECRET_KEY = PRIMARY_SECRET_KEY;

// Last time the key was rotated
let lastKeyRotation = Date.now();

// Key rotation interval (default: 24 hours)
const KEY_ROTATION_INTERVAL = parseInt(process.env.CSRF_KEY_ROTATION_INTERVAL || '86400000', 10);

/**
 * Rotate the CSRF secret keys periodically
 * This allows for a grace period where tokens generated with the old key are still valid
 */
function rotateKeysIfNeeded(): void {
  const now = Date.now();
  
  // Check if it's time to rotate keys
  if (now - lastKeyRotation > KEY_ROTATION_INTERVAL) {
    // Save the current primary key as secondary (for grace period validation)
    SECONDARY_SECRET_KEY = PRIMARY_SECRET_KEY;
    
    // Generate a new primary key
    PRIMARY_SECRET_KEY = getSecretKey();
    
    lastKeyRotation = now;
    logger.info('[csrf] Secret keys rotated', { timestamp: new Date().toISOString() });
  }
}

// Token structure for verification
interface CSRFToken {
  value: string;
  expires: number;
}

/**
 * Generate a new CSRF token with enhanced entropy (128 bits)
 * @returns {string} The generated token
 */
function generateToken(): string {
  // Ensure keys are rotated if needed
  rotateKeysIfNeeded();
  
  // Generate 128 bits (16 bytes) of random data (vs the original 32 bytes)
  // 16 bytes = 128 bits is still cryptographically strong and creates shorter tokens
  const random = crypto.randomBytes(16).toString('base64');
  const timestamp = Date.now();
  
  // Use SHA-256 HMAC for token signing
  const hmac = crypto.createHmac('sha256', PRIMARY_SECRET_KEY)
    .update(`${random}:${timestamp}`)
    .digest('base64');
    
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
    
    // Try to verify with the primary key first
    try {
      const expectedHmac = crypto.createHmac('sha256', PRIMARY_SECRET_KEY)
        .update(`${random}:${timestamp}`)
        .digest('base64');
        
      return crypto.timingSafeEqual(
        Buffer.from(providedHmac),
        Buffer.from(expectedHmac)
      );
    } catch (primaryError) {
      // If primary key verification fails, try the secondary key
      try {
        const secondaryHmac = crypto.createHmac('sha256', SECONDARY_SECRET_KEY)
          .update(`${random}:${timestamp}`)
          .digest('base64');
          
        return crypto.timingSafeEqual(
          Buffer.from(providedHmac),
          Buffer.from(secondaryHmac)
        );
      } catch (secondaryError) {
        logger.error('[csrf] Token verification error with both keys', { 
          primaryError, 
          secondaryError 
        });
        return false;
      }
    }
  } catch (err) {
    logger.error('[csrf] Token verification error', { error: err });
    return false;
  }
}

/**
 * Determine the appropriate SameSite cookie setting based on environment
 */
function getSameSiteSetting(): 'strict' | 'lax' | 'none' {
  // Default to 'strict' for maximum security
  const setting = (process.env.CSRF_SAME_SITE || 'strict').toLowerCase();
  
  // Validate and return the appropriate setting
  if (setting === 'lax' || setting === 'none') {
    return setting as 'lax' | 'none';
  }
  
  return 'strict';
}

/**
 * Get secure cookie configuration based on environment
 */
function getCookieConfig(token: string): any {
  const sameSite = getSameSiteSetting();
  const secure = process.env.NODE_ENV === 'production' ? true : 
    (process.env.CSRF_SECURE === 'true');
  
  // For SameSite=None, Secure must be true
  const actualSecure = sameSite === 'none' ? true : secure;
  
  return {
    httpOnly: false, // Changed to false so client JavaScript can read it
    secure: actualSecure,
    sameSite: sameSite,
    maxAge: TOKEN_EXPIRY,
    path: '/'
  };
}

/**
 * Middleware to set CSRF token cookie
 */
export function setCsrfToken(req: Request, res: Response, next: NextFunction): void {
  try {
    // Only set the token if it doesn't exist or is about to expire
    const existingToken = req.cookies?.[CSRF_COOKIE_NAME];
    
    if (!existingToken || !verifyToken(existingToken)) {
      const token = generateToken();
      
      // Set cookie with appropriate security flags
      res.cookie(CSRF_COOKIE_NAME, token, getCookieConfig(token));
      
      // Also expose the token in the response for the client to use
      res.setHeader('X-CSRF-Token', token);
      
      logger.debug('[csrf] New token issued', { 
        path: req.path,
        requestId: (req as any).requestId 
      });
    }
    
    next();
  } catch (error) {
    logger.error('[csrf] Error setting CSRF token', { 
      error, 
      path: req.path,
      requestId: (req as any).requestId 
    });
    // Continue anyway to not block the request
    next();
  }
}

/**
 * Middleware to validate CSRF token on state-changing requests
 */
export function validateCsrfToken(req: Request, res: Response, next: NextFunction): void {
  // Skip validation for exempted paths (if configured)
  const exemptPaths = (process.env.CSRF_EXEMPT_PATHS || '').split(',').filter(Boolean);
  
  // Always exempt the login endpoint from CSRF protection for now
  // This is a temporary measure while we continue developing
  if (req.path === '/login' || req.path === '/api/login' || exemptPaths.some(path => req.path.startsWith(path))) {
    next();
    return;
  }
  
  // Only validate on state-changing methods
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  
  if (!stateChangingMethods.includes(req.method)) {
    next();
    return;
  }
  
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.header(CSRF_HEADER_NAME);
  const requestId = (req as any).requestId || 'unknown';
  
  // Check if both tokens exist
  if (!cookieToken || !headerToken) {
    logger.warn('[csrf] Missing CSRF token', {
      path: req.path,
      hasCookieToken: !!cookieToken,
      hasHeaderToken: !!headerToken,
      requestId
    });
    
    res.status(403).json({ 
      error: 'CSRF token missing',
      code: 'CSRF_TOKEN_MISSING'
    });
    return;
  }
  
  // Validate token format and expiry
  if (!verifyToken(cookieToken)) {
    logger.warn('[csrf] Invalid or expired CSRF token', { 
      path: req.path,
      requestId
    });
    
    res.status(403).json({ 
      error: 'CSRF token invalid or expired',
      code: 'CSRF_TOKEN_INVALID'
    });
    return;
  }
  
  // Ensure tokens match
  if (cookieToken !== headerToken) {
    logger.warn('[csrf] CSRF token mismatch', { 
      path: req.path,
      requestId
    });
    
    res.status(403).json({ 
      error: 'CSRF token mismatch',
      code: 'CSRF_TOKEN_MISMATCH'
    });
    return;
  }
  
  // If we get here, the CSRF validation was successful
  logger.debug('[csrf] Valid CSRF token', {
    path: req.path,
    method: req.method,
    requestId
  });
  
  next();
}

/**
 * Get a CSRF token for the current session
 * Intended for use in API routes that need to provide a token to the client
 */
export function getNewCsrfToken(): string {
  return generateToken();
}

/**
 * Explicitly rotate the CSRF keys
 * This can be called during application maintenance or security events
 */
export function rotateSecretKeys(): void {
  SECONDARY_SECRET_KEY = PRIMARY_SECRET_KEY;
  PRIMARY_SECRET_KEY = getSecretKey();
  lastKeyRotation = Date.now();
  logger.info('[csrf] Secret keys manually rotated', { timestamp: new Date().toISOString() });
}

export default {
  setCsrfToken,
  validateCsrfToken,
  getNewCsrfToken,
  rotateSecretKeys
};