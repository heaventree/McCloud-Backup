/**
 * Security Headers Middleware
 * 
 * This module provides middleware to add comprehensive security headers
 * to all HTTP responses, following security best practices.
 */
import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';

const logger = createLogger('security-headers');

/**
 * Security headers configuration interface
 */
export interface SecurityHeadersConfig {
  // Content Security Policy
  contentSecurityPolicy?: boolean | {
    directives?: {
      [key: string]: string | string[];
    }
  };
  
  // HTTP Strict Transport Security
  strictTransportSecurity?: boolean | {
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  
  // X-Frame-Options
  frameOptions?: boolean | 'DENY' | 'SAMEORIGIN';
  
  // X-Content-Type-Options
  contentTypeOptions?: boolean;
  
  // X-XSS-Protection
  xssProtection?: boolean;
  
  // Referrer-Policy
  referrerPolicy?: boolean | string;
  
  // Permissions-Policy (formerly Feature-Policy)
  permissionsPolicy?: boolean | {
    [key: string]: string | string[];
  };
  
  // X-DNS-Prefetch-Control
  dnsPrefetchControl?: boolean | 'on' | 'off';
  
  // X-Download-Options
  downloadOptions?: boolean;
  
  // Cache-Control
  cacheControl?: boolean | string;
  
  // Clear-Site-Data on logout routes
  clearSiteData?: {
    enabled: boolean;
    routes?: string[];
  };
}

/**
 * Default security headers configuration
 */
const defaultConfig: SecurityHeadersConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Can be restricted further
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", 'https://api.github.com', 'https://www.googleapis.com'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"],
      childSrc: ["'self'"],
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  strictTransportSecurity: {
    maxAge: 15552000, // 180 days
    includeSubDomains: true,
    preload: false
  },
  frameOptions: 'DENY',
  contentTypeOptions: true,
  xssProtection: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: {
    geolocation: ["'none'"],
    microphone: ["'none'"],
    camera: ["'none'"],
    'payment-handler': ["'none'"],
    accelerometer: ["'none'"],
    gyroscope: ["'none'"],
    magnetometer: ["'none'"],
    usb: ["'none'"]
  },
  dnsPrefetchControl: 'off',
  downloadOptions: true,
  cacheControl: 'no-store, max-age=0',
  clearSiteData: {
    enabled: true,
    routes: ['/auth/logout', '/api/auth/logout']
  }
};

/**
 * Format CSP directives object into CSP header string
 * @param directives CSP directives object
 * @returns Formatted CSP string
 */
function formatCSP(directives: { [key: string]: string | string[] }): string {
  return Object.entries(directives)
    .map(([key, value]) => {
      const dirValue = Array.isArray(value) ? value.join(' ') : value;
      return `${key} ${dirValue}`;
    })
    .join('; ');
}

/**
 * Format Permissions Policy directives into header string
 * @param directives Permissions Policy directives object
 * @returns Formatted Permissions Policy string
 */
function formatPermissionsPolicy(directives: { [key: string]: string | string[] }): string {
  return Object.entries(directives)
    .map(([key, value]) => {
      const dirValue = Array.isArray(value) ? value.join(', ') : value;
      return `${key}=${dirValue}`;
    })
    .join(', ');
}

/**
 * Create security headers middleware
 * @param config Security headers configuration
 * @returns Express middleware function
 */
export function securityHeaders(config: SecurityHeadersConfig = {}): (req: Request, res: Response, next: NextFunction) => void {
  // Merge provided config with defaults
  const mergedConfig: SecurityHeadersConfig = {
    ...defaultConfig
  };
  
  // Merge nested objects
  if (config.contentSecurityPolicy && typeof config.contentSecurityPolicy === 'object') {
    mergedConfig.contentSecurityPolicy = {
      directives: {
        ...((defaultConfig.contentSecurityPolicy as any)?.directives || {}),
        ...((config.contentSecurityPolicy as any)?.directives || {})
      }
    };
  } else if (config.contentSecurityPolicy === false) {
    mergedConfig.contentSecurityPolicy = false;
  }
  
  if (config.permissionsPolicy && typeof config.permissionsPolicy === 'object') {
    mergedConfig.permissionsPolicy = {
      ...((defaultConfig.permissionsPolicy as any) || {}),
      ...(config.permissionsPolicy as any)
    };
  } else if (config.permissionsPolicy === false) {
    mergedConfig.permissionsPolicy = false;
  }
  
  // Merge HSTS
  if (config.strictTransportSecurity && typeof config.strictTransportSecurity === 'object') {
    mergedConfig.strictTransportSecurity = {
      ...(typeof defaultConfig.strictTransportSecurity === 'object' ? defaultConfig.strictTransportSecurity : {}),
      ...(config.strictTransportSecurity as any)
    };
  } else if (config.strictTransportSecurity === false) {
    mergedConfig.strictTransportSecurity = false;
  }
  
  // Merge clearSiteData
  if (config.clearSiteData) {
    mergedConfig.clearSiteData = {
      ...(defaultConfig.clearSiteData || { enabled: false }),
      ...config.clearSiteData
    };
  }
  
  // Apply simple overrides
  if (config.frameOptions !== undefined) mergedConfig.frameOptions = config.frameOptions;
  if (config.contentTypeOptions !== undefined) mergedConfig.contentTypeOptions = config.contentTypeOptions;
  if (config.xssProtection !== undefined) mergedConfig.xssProtection = config.xssProtection;
  if (config.referrerPolicy !== undefined) mergedConfig.referrerPolicy = config.referrerPolicy;
  if (config.dnsPrefetchControl !== undefined) mergedConfig.dnsPrefetchControl = config.dnsPrefetchControl;
  if (config.downloadOptions !== undefined) mergedConfig.downloadOptions = config.downloadOptions;
  if (config.cacheControl !== undefined) mergedConfig.cacheControl = config.cacheControl;
  
  // Log configuration
  logger.debug('Security headers configured');
  
  // Return middleware
  return (req: Request, res: Response, next: NextFunction): void => {
    // Content-Security-Policy
    if (mergedConfig.contentSecurityPolicy) {
      const cspDirectives = (mergedConfig.contentSecurityPolicy as any).directives;
      if (cspDirectives) {
        res.setHeader('Content-Security-Policy', formatCSP(cspDirectives));
      }
    }
    
    // Strict-Transport-Security
    if (mergedConfig.strictTransportSecurity && process.env.NODE_ENV === 'production') {
      const hsts = mergedConfig.strictTransportSecurity as any;
      let value = `max-age=${hsts.maxAge || 15552000}`;
      if (hsts.includeSubDomains) value += '; includeSubDomains';
      if (hsts.preload) value += '; preload';
      res.setHeader('Strict-Transport-Security', value);
    }
    
    // X-Frame-Options
    if (mergedConfig.frameOptions) {
      const value = mergedConfig.frameOptions === true ? 'DENY' : mergedConfig.frameOptions;
      res.setHeader('X-Frame-Options', value);
    }
    
    // X-Content-Type-Options
    if (mergedConfig.contentTypeOptions) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
    
    // X-XSS-Protection
    if (mergedConfig.xssProtection) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }
    
    // Referrer-Policy
    if (mergedConfig.referrerPolicy) {
      const value = mergedConfig.referrerPolicy === true ? 'strict-origin-when-cross-origin' : mergedConfig.referrerPolicy;
      res.setHeader('Referrer-Policy', value);
    }
    
    // Permissions-Policy
    if (mergedConfig.permissionsPolicy) {
      const permissionsDirectives = mergedConfig.permissionsPolicy as any;
      res.setHeader('Permissions-Policy', formatPermissionsPolicy(permissionsDirectives));
    }
    
    // X-DNS-Prefetch-Control
    if (mergedConfig.dnsPrefetchControl) {
      const value = mergedConfig.dnsPrefetchControl === true ? 'off' : mergedConfig.dnsPrefetchControl;
      res.setHeader('X-DNS-Prefetch-Control', value);
    }
    
    // X-Download-Options
    if (mergedConfig.downloadOptions) {
      res.setHeader('X-Download-Options', 'noopen');
    }
    
    // Cache-Control
    if (mergedConfig.cacheControl) {
      const value = mergedConfig.cacheControl === true ? 'no-store, max-age=0' : mergedConfig.cacheControl;
      res.setHeader('Cache-Control', value);
    }
    
    // Clear-Site-Data on logout routes
    if (mergedConfig.clearSiteData?.enabled && 
        mergedConfig.clearSiteData.routes?.includes(req.path)) {
      res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
    }
    
    next();
  };
}