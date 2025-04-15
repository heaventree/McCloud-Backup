/**
 * Standardized Error Handling System
 * 
 * This module provides a comprehensive error handling system for the application,
 * including custom error classes, formatting, and middleware integration.
 */
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

import { createLogger } from './logger';

const logger = createLogger('error-handler');

// Base application error class
export class AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
  details?: any;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    
    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
    
    // Set name to class name
    this.name = this.constructor.name;
  }

  /**
   * Format error for API response
   * @returns Formatted error object
   */
  toJSON() {
    return {
      status: 'error',
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {})
    };
  }
}

// Common error types
export class BadRequestError extends AppError {
  constructor(message = 'Bad request', code = 'BAD_REQUEST', details?: any) {
    super(message, 400, code, true, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED', details?: any) {
    super(message, 401, code, true, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN', details?: any) {
    super(message, 403, code, true, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND', details?: any) {
    super(message, 404, code, true, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict with existing resource', code = 'CONFLICT', details?: any) {
    super(message, 409, code, true, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation error', details?: any) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', details?: any) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true, details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable', details?: any) {
    super(message, 503, 'SERVICE_UNAVAILABLE', true, details);
  }
}

// Error handlers
/**
 * Convert various error types to AppError
 * @param err Original error
 * @returns AppError instance
 */
export function normalizeError(err: any): AppError {
  if (err instanceof AppError) {
    return err;
  }
  
  if (err instanceof ZodError) {
    // Format validation errors
    const formattedErrors = err.errors.map(err => ({
      path: err.path.map(p => String(p)),
      message: err.message
    }));
    return new ValidationError('Validation error', { errors: formattedErrors });
  }
  
  // Check for common error patterns
  if (err?.name === 'JsonWebTokenError') {
    return new UnauthorizedError('Invalid token');
  }
  
  if (err?.name === 'TokenExpiredError') {
    return new UnauthorizedError('Token expired');
  }
  
  if (err?.code === 'ECONNREFUSED') {
    return new ServiceUnavailableError('Service connection failed');
  }
  
  // Default to internal server error
  const message = err?.message || 'Internal server error';
  const isOperational = false; // Unhandled errors are not operational
  return new AppError(message, 500, 'INTERNAL_ERROR', isOperational);
}

/**
 * Global error handling middleware
 * @param err Error object
 * @param req Express request
 * @param res Express response
 * @param next Express next function
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  // Normalize error
  const normalizedError = normalizeError(err);
  
  // Log error
  if (normalizedError.statusCode >= 500) {
    logger.error('Server error', err);
  } else if (normalizedError.statusCode >= 400) {
    logger.warn('Client error', {
      message: normalizedError.message,
      code: normalizedError.code,
      path: req.path,
      method: req.method
    });
  }
  
  // Return error response
  res.status(normalizedError.statusCode).json(normalizedError.toJSON());
}

/**
 * 404 handler for routes that don't exist
 * @param req Express request
 * @param res Express response
 * @param next Express next function
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  next(new NotFoundError(`Route not found: ${req.method} ${req.path}`));
}

/**
 * Async handler to catch errors in async route handlers
 * @param fn Async route handler
 * @returns Wrapped route handler
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create error response for client
 * @param error Error object or message
 * @param code Error code
 * @returns Error response object
 */
export function createErrorResponse(error: string | Error, code = 'ERROR') {
  const message = typeof error === 'string' ? error : error.message;
  return {
    status: 'error',
    code,
    message
  };
}