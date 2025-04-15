/**
 * Rate Limiting Middleware
 * 
 * This module provides a flexible rate limiting system for API endpoints,
 * supporting IP-based, user-based, and custom key generation strategies.
 */
import { Request, Response, NextFunction } from 'express';
import { RateLimitError } from './error-handler';
import { createLogger } from './logger';

const logger = createLogger('rate-limit');

// Extended Request interface with rate limit information
export interface RequestWithRateLimit extends Request {
  rateLimit: RateLimitInfo;
  user?: {
    id: string;
    [key: string]: any;
  };
}

// Interface for rate limit store
export interface RateLimitStore {
  // Increment the counter for a key and return attempts and reset time
  increment(key: string, windowMs: number): Promise<{ attempts: number, resetTime: number }>;
  
  // Reset counters for a key
  reset(key: string): Promise<void>;
  
  // Clean up expired entries
  cleanup?(): Promise<void>;
}

// Options for rate limiter
export interface RateLimitOptions {
  // Window size in milliseconds
  windowMs?: number;
  
  // Maximum number of requests per window
  maxRequests?: number;
  
  // Message to send when rate limit is exceeded
  message?: string;
  
  // Status code to send when rate limit is exceeded
  statusCode?: number;
  
  // Headers to send with rate limit information
  headers?: boolean;
  
  // Skip rate limiting for certain requests
  skip?: (req: Request) => boolean;
  
  // Generate key for rate limiting
  keyGenerator?: (req: Request) => string;
  
  // Store for rate limiting data
  store?: RateLimitStore;
  
  // Whether to skip logging when rate limit is hit
  skipLog?: boolean;
  
  // Whether to throw an error (true) or send response directly (false)
  throwError?: boolean;
}

// Rate limit information included in response
export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: number;
}

// In-memory store for rate limiting
export class MemoryStore implements RateLimitStore {
  private hits: Map<string, { attempts: number, resetTime: number }> = new Map();
  
  /**
   * Increment the counter for a key
   * @param key Rate limit key
   * @param windowMs Window size in milliseconds
   * @returns Attempts and reset time
   */
  async increment(key: string, windowMs: number): Promise<{ attempts: number, resetTime: number }> {
    // Clean up expired entries for this key
    this.cleanup(key, windowMs);
    
    // Get or create counter
    const now = Date.now();
    const resetTime = now + windowMs;
    
    let counter = this.hits.get(key);
    
    if (!counter || counter.resetTime < now) {
      counter = { attempts: 0, resetTime };
    }
    
    // Increment counter
    counter.attempts++;
    this.hits.set(key, counter);
    
    return counter;
  }
  
  /**
   * Reset counter for a key
   * @param key Rate limit key
   */
  async reset(key: string): Promise<void> {
    this.hits.delete(key);
  }
  
  /**
   * Clean up expired entries for a key
   * @param key Rate limit key (or all keys if not specified)
   * @param windowMs Window size in milliseconds
   */
  async cleanup(key?: string, windowMs?: number): Promise<void> {
    const now = Date.now();
    
    if (key) {
      const counter = this.hits.get(key);
      if (counter && counter.resetTime < now) {
        this.hits.delete(key);
      }
    } else {
      // Clean up all expired entries
      // Using Array.from to avoid downlevelIteration issues
      Array.from(this.hits.entries()).forEach(([entryKey, counter]) => {
        if (counter.resetTime < now) {
          this.hits.delete(entryKey);
        }
      });
    }
  }
}

// Default options
const defaultOptions: RateLimitOptions = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
  message: 'Too many requests, please try again later.',
  statusCode: 429,
  headers: true,
  skip: () => false,
  keyGenerator: (req) => req.ip || 'unknown',
  store: new MemoryStore(),
  skipLog: false,
  throwError: true
};

/**
 * Create rate limiting middleware
 * @param options Rate limiting options
 * @returns Express middleware
 */
export function rateLimit(options: RateLimitOptions = {}): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  // Merge options with defaults
  const opts: RateLimitOptions = { ...defaultOptions, ...options };
  const store = opts.store || new MemoryStore();
  const windowMs = opts.windowMs || 60 * 1000;
  const maxRequests = opts.maxRequests || 60;
  
  // Schedule cleanup for memory store if it has cleanup method
  if (store.cleanup && typeof store.cleanup === 'function') {
    setInterval(() => {
      store.cleanup?.();
    }, 15 * 60 * 1000); // Run cleanup every 15 minutes
  }
  
  // Return middleware
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip rate limiting if specified
    if (opts.skip && opts.skip(req)) {
      return next();
    }
    
    // Generate key
    const key = opts.keyGenerator ? opts.keyGenerator(req) : (req.ip || 'unknown');
    
    try {
      // Increment counter
      const counter = await store.increment(key, windowMs);
      
      // Set rate limit headers if enabled
      if (opts.headers) {
        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - counter.attempts).toString());
        res.setHeader('X-RateLimit-Reset', Math.ceil(counter.resetTime / 1000).toString());
      }
      
      // Add rate limit info to request
      (req as RequestWithRateLimit).rateLimit = {
        limit: maxRequests,
        current: counter.attempts,
        remaining: Math.max(0, maxRequests - counter.attempts),
        resetTime: counter.resetTime
      };
      
      // Check if rate limit is exceeded
      if (counter.attempts > maxRequests) {
        if (!opts.skipLog) {
          logger.warn(`Rate limit exceeded for ${key}`, {
            ip: req.ip,
            path: req.path,
            method: req.method,
            attempts: counter.attempts,
            limit: maxRequests
          });
        }
        
        // Add retry-after header
        res.setHeader('Retry-After', Math.ceil((counter.resetTime - Date.now()) / 1000).toString());
        
        // Handle rate limit exceeded
        if (opts.throwError) {
          throw new RateLimitError(opts.message || 'Too many requests');
        } else {
          res.status(opts.statusCode || 429).json({
            status: 'error',
            code: 'RATE_LIMIT_EXCEEDED',
            message: opts.message || 'Too many requests, please try again later.'
          });
          return;
        }
      }
      
      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        res.status(opts.statusCode || 429).json({
          status: 'error',
          code: 'RATE_LIMIT_EXCEEDED',
          message: error.message
        });
      } else {
        logger.error('Rate limiting error', error);
        next(error);
      }
    }
  };
}

/**
 * Create IP-based rate limiting middleware
 * @param maxRequests Maximum requests per window
 * @param windowMs Window size in milliseconds
 * @param message Custom error message
 * @returns Express middleware
 */
export function ipRateLimit(maxRequests = 60, windowMs = 60 * 1000, message?: string): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return rateLimit({
    windowMs,
    maxRequests,
    message,
    keyGenerator: (req) => req.ip || 'unknown'
  });
}

/**
 * Create user-based rate limiting middleware
 * Requires user ID to be available on request (e.g., from authentication middleware)
 * @param maxRequests Maximum requests per window
 * @param windowMs Window size in milliseconds
 * @param message Custom error message
 * @returns Express middleware
 */
export function userRateLimit(maxRequests = 100, windowMs = 60 * 1000, message?: string): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return rateLimit({
    windowMs,
    maxRequests,
    message,
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise fall back to IP
      const userId = (req as any).user?.id;
      return userId ? `user:${userId}` : `ip:${req.ip || 'unknown'}`;
    },
    // Skip for authenticated users if desired
    // skip: (req) => !!(req as any).user
  });
}

/**
 * Create API endpoint rate limiting middleware
 * Limits requests to specific endpoints
 * @param maxRequests Maximum requests per window
 * @param windowMs Window size in milliseconds
 * @param message Custom error message
 * @returns Express middleware
 */
export function apiRateLimit(maxRequests = 30, windowMs = 60 * 1000, message?: string): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return rateLimit({
    windowMs,
    maxRequests,
    message,
    keyGenerator: (req) => {
      // Create key based on endpoint and IP
      const endpoint = `${req.method}:${req.path}`;
      const userId = (req as any).user?.id;
      
      if (userId) {
        return `${endpoint}:user:${userId}`;
      }
      
      return `${endpoint}:ip:${req.ip || 'unknown'}`;
    }
  });
}