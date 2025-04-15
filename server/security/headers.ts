/**
 * Security Headers Middleware
 * 
 * This module provides security headers for the application
 * to protect against common web vulnerabilities.
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * Generate security headers middleware
 * @returns Middleware function to apply security headers
 */
export function securityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Set security headers
    
    // Content-Security-Policy - Helps prevent XSS attacks
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // More restrictive in production
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://images.unsplash.com https://svgl.app",
      "font-src 'self' data:",
      "connect-src 'self' https://api.github.com https://api.dropbox.com https://graph.microsoft.com",
      "media-src 'self'",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ];
    
    res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
    
    // X-Content-Type-Options - Prevents MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // X-Frame-Options - Prevents clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // X-XSS-Protection - Legacy XSS protection for older browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Strict-Transport-Security - Enforces HTTPS
    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
    }
    
    // Referrer-Policy - Controls information in the Referer header
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permission-Policy - Controls browser features
    const permissionPolicy = [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
    ];
    
    res.setHeader('Permissions-Policy', permissionPolicy.join(', '));
    
    // Cache-Control - Prevent caching of sensitive data
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
      // Allow caching of static assets with appropriate max-age
      if (
        req.path.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/)
      ) {
        res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      } else {
        res.setHeader('Cache-Control', 'no-cache, private');
      }
    } else {
      // No caching for API responses
      res.setHeader('Cache-Control', 'no-store, max-age=0');
    }
    
    next();
  };
}

export default {
  securityHeaders
};