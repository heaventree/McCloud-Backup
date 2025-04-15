/**
 * CORS Configuration Utility
 * 
 * This module provides Cross-Origin Resource Sharing (CORS) configuration 
 * to control which domains can access the API.
 */

import cors from 'cors';
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Default allowed origins (in production, this should be more restrictive)
const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:5173',
  process.env.CLIENT_URL || '',
  process.env.FRONTEND_URL || '',
].filter(Boolean);

/**
 * Configure CORS with secure defaults and customization options
 * 
 * @param options Custom CORS configuration options
 * @returns CORS middleware
 */
export function configureCors(options?: {
  allowedOrigins?: string[];
  allowCredentials?: boolean;
  maxAge?: number;
  allowedMethods?: string[];
  allowedHeaders?: string[];
}) {
  const allowedOrigins = options?.allowedOrigins || defaultAllowedOrigins;
  const allowCredentials = options?.allowCredentials ?? true;
  const maxAge = options?.maxAge || 86400; // 24 hours
  const allowedMethods = options?.allowedMethods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
  const allowedHeaders = options?.allowedHeaders || [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-Token',
    'X-XSRF-Token',
  ];
  
  // Log the CORS configuration
  logger.info('Configuring CORS', {
    origins: allowedOrigins,
    credentials: allowCredentials,
    methods: allowedMethods,
  });
  
  // Create CORS middleware with the specified options
  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if the origin is allowed
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      
      // Log and reject requests from disallowed origins
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: allowCredentials,
    maxAge,
    methods: allowedMethods.join(','),
    allowedHeaders: allowedHeaders.join(','),
  });
}

/**
 * Custom CORS error handler middleware
 * This provides cleaner error messages for CORS errors
 */
export function corsErrorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  if (err.message === 'Not allowed by CORS') {
    logger.warn('CORS error', {
      origin: req.headers.origin,
      path: req.path,
      method: req.method,
    });
    
    res.status(403).json({
      error: 'CORS_ERROR',
      message: 'Cross-Origin Request Blocked: This origin is not allowed by CORS policy',
    });
    return;
  }
  
  next(err);
}

export default {
  configureCors,
  corsErrorHandler,
};