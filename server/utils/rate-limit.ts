/**
 * Rate Limiting Utilities
 * 
 * This module provides rate limiting middleware for the application
 * to protect against excessive requests and potential abuse.
 */

import { Request, Response, NextFunction } from 'express';
import logger from './logger';

// Store for rate limits
// In a production environment, this should use Redis or a similar distributed store
const ipLimitStore: Record<string, { count: number; resetTime: number }> = {};
const apiLimitStore: Record<string, { count: number; resetTime: number }> = {};

/**
 * IP-based rate limiting middleware
 * Limits requests based on client IP address
 * 
 * @param maxRequests - Maximum allowed requests in time window
 * @param windowMs - Time window in milliseconds
 * @param message - Optional custom error message
 * @returns Rate limiting middleware
 */
export function ipRateLimit(maxRequests: number, windowMs: number, message?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Get client IP, falling back to a default for missing values
    const ip = 
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || 
      req.socket.remoteAddress || 
      'unknown';
    
    const now = Date.now();
    
    // Initialize or get current limit data for this IP
    if (!ipLimitStore[ip] || ipLimitStore[ip].resetTime < now) {
      ipLimitStore[ip] = {
        count: 0,
        resetTime: now + windowMs,
      };
    }
    
    // Increment request count
    ipLimitStore[ip].count++;
    
    // Check if rate limit exceeded
    if (ipLimitStore[ip].count > maxRequests) {
      const resetTime = ipLimitStore[ip].resetTime;
      const retryAfter = Math.ceil((resetTime - now) / 1000);
      
      // Set rate limiting headers
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)));
      
      logger.warn(`Rate limit exceeded for IP: ${ip}`, {
        ip,
        path: req.path,
        method: req.method,
        requestId: (req as any).requestId,
      });
      
      // Send 429 Too Many Requests response
      return res.status(429).json({
        code: 'RATE_LIMIT_EXCEEDED',
        message: message || `Too many requests, please try again after ${retryAfter} seconds`,
        retryAfter,
      });
    }
    
    // Set rate limiting headers for non-exceeded requests too
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(maxRequests - ipLimitStore[ip].count));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(ipLimitStore[ip].resetTime / 1000)));
    
    next();
  };
}

/**
 * API endpoint-based rate limiting middleware
 * Limits requests based on client IP and requested endpoint
 * 
 * @param maxRequests - Maximum allowed requests in time window
 * @param windowMs - Time window in milliseconds
 * @param message - Optional custom error message
 * @returns Rate limiting middleware
 */
export function apiRateLimit(maxRequests: number, windowMs: number, message?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Get client IP, falling back to a default for missing values
    const ip = 
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || 
      req.socket.remoteAddress || 
      'unknown';
    
    // Create a key based on IP and endpoint
    const endpoint = req.path;
    const key = `${ip}:${endpoint}`;
    
    const now = Date.now();
    
    // Initialize or get current limit data for this key
    if (!apiLimitStore[key] || apiLimitStore[key].resetTime < now) {
      apiLimitStore[key] = {
        count: 0,
        resetTime: now + windowMs,
      };
    }
    
    // Increment request count
    apiLimitStore[key].count++;
    
    // Check if rate limit exceeded
    if (apiLimitStore[key].count > maxRequests) {
      const resetTime = apiLimitStore[key].resetTime;
      const retryAfter = Math.ceil((resetTime - now) / 1000);
      
      // Set rate limiting headers
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)));
      
      logger.warn(`API rate limit exceeded for IP: ${ip}, endpoint: ${endpoint}`, {
        ip,
        endpoint,
        method: req.method,
        requestId: (req as any).requestId,
      });
      
      // Send 429 Too Many Requests response
      return res.status(429).json({
        code: 'RATE_LIMIT_EXCEEDED',
        message: message || `Too many requests for this endpoint, please try again after ${retryAfter} seconds`,
        retryAfter,
      });
    }
    
    // Set rate limiting headers for non-exceeded requests too
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(maxRequests - apiLimitStore[key].count));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(apiLimitStore[key].resetTime / 1000)));
    
    next();
  };
}

/**
 * Clean up expired rate limit entries
 * This should be called periodically to prevent memory leaks
 */
export function cleanupRateLimitStores(): void {
  const now = Date.now();
  
  // Clean up IP limit store
  Object.keys(ipLimitStore).forEach(key => {
    if (ipLimitStore[key].resetTime < now) {
      delete ipLimitStore[key];
    }
  });
  
  // Clean up API limit store
  Object.keys(apiLimitStore).forEach(key => {
    if (apiLimitStore[key].resetTime < now) {
      delete apiLimitStore[key];
    }
  });
  
  logger.debug('Cleaned up rate limit stores');
}

// Set up a cleanup interval (every 15 minutes)
setInterval(cleanupRateLimitStores, 15 * 60 * 1000);

export default {
  ipRateLimit,
  apiRateLimit,
};