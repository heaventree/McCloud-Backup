/**
 * Rate Limiting Utilities - DISABLED
 * 
 * This module provides no-op rate limiting middleware for the application.
 * All rate limiting functionality has been disabled as requested.
 */

import { Request, Response, NextFunction } from 'express';
import logger from './logger';

/**
 * No-op IP-based rate limiting middleware
 * This function doesn't actually limit any requests, it just passes through all traffic
 * 
 * @param maxRequests - Maximum allowed requests in time window (ignored)
 * @param windowMs - Time window in milliseconds (ignored)
 * @param message - Optional custom error message (ignored)
 * @returns No-op middleware that always allows requests
 */
export function ipRateLimit(maxRequests: number, windowMs: number, message?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Just pass through all requests with no rate limiting
    logger.debug('Rate limiting disabled - allowing all requests');
    next();
  };
}

/**
 * No-op API endpoint-based rate limiting middleware
 * This function doesn't actually limit any requests, it just passes through all traffic
 * 
 * @param maxRequests - Maximum allowed requests in time window (ignored)
 * @param windowMs - Time window in milliseconds (ignored)
 * @param message - Optional custom error message (ignored)
 * @returns No-op middleware that always allows requests
 */
export function apiRateLimit(maxRequests: number, windowMs: number, message?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Just pass through all requests with no rate limiting
    logger.debug('Rate limiting disabled - allowing all requests');
    next();
  };
}

/**
 * No-op cleanup function that does nothing
 */
export function cleanupRateLimitStores(): void {
  // No rate limit stores to clean up
  logger.debug('Rate limiting stores disabled - no cleanup needed');
}

// No need for cleanup interval as there's nothing to clean
// setInterval is removed

export default {
  ipRateLimit,
  apiRateLimit,
};