/**
 * Error Handling Utilities
 * 
 * This module provides consistent error handling middleware and utility functions
 * for the application to ensure proper error responses and logging.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';
import logger from './logger';

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  code: string;
  message: string;
  details?: any;
  path?: string;
  method?: string;
  timestamp?: string;
  requestId?: string;
}

/**
 * Error codes for consistent client responses
 */
export const ErrorCodes = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
};

/**
 * HTTP status code mapping for error codes
 */
const StatusCodeMap: Record<string, number> = {
  [ErrorCodes.BAD_REQUEST]: 400,
  [ErrorCodes.UNAUTHORIZED]: 401,
  [ErrorCodes.FORBIDDEN]: 403,
  [ErrorCodes.NOT_FOUND]: 404,
  [ErrorCodes.VALIDATION_ERROR]: 422,
  [ErrorCodes.CONFLICT]: 409,
  [ErrorCodes.INTERNAL_ERROR]: 500,
  [ErrorCodes.SERVICE_UNAVAILABLE]: 503,
  [ErrorCodes.PROVIDER_ERROR]: 502,
};

/**
 * Custom application error class with structured error info
 */
export class AppError extends Error {
  code: string;
  details?: any;
  
  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Format a Zod validation error into a user-friendly error object
 * @param error - Zod validation error
 * @returns Formatted error details
 */
export function formatZodError(error: ZodError): any {
  const validationError = fromZodError(error);
  
  return {
    message: validationError.message,
    errors: error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
    })),
  };
}

/**
 * Format any error into a consistent error response structure
 * @param error - Any error object
 * @param req - Express request object
 * @returns Structured error response
 */
function formatError(error: any, req?: Request): ErrorResponse {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
      path: req?.path,
      method: req?.method,
      timestamp: new Date().toISOString(),
      requestId: (req as any)?.requestId,
    };
  } else if (error instanceof ZodError) {
    const formattedError = formatZodError(error);
    
    return {
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Validation error',
      details: formattedError,
      path: req?.path,
      method: req?.method,
      timestamp: new Date().toISOString(),
      requestId: (req as any)?.requestId,
    };
  } else {
    // Handle generic errors
    return {
      code: ErrorCodes.INTERNAL_ERROR,
      message: error.message || 'Internal server error',
      path: req?.path,
      method: req?.method,
      timestamp: new Date().toISOString(),
      requestId: (req as any)?.requestId,
    };
  }
}

/**
 * Middleware for handling routes that don't exist
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new AppError(
    ErrorCodes.NOT_FOUND,
    `Route not found: ${req.method} ${req.path}`
  );
  
  const errorResponse = formatError(error, req);
  
  logger.warn(`Client error ${errorResponse.message}`, errorResponse);
  
  res.status(404).json(errorResponse);
}

/**
 * Global error handler middleware
 */
export function errorHandler(error: any, req: Request, res: Response, next: NextFunction): void {
  const errorResponse = formatError(error, req);
  
  // Log error with appropriate level
  if (errorResponse.code === ErrorCodes.INTERNAL_ERROR) {
    logger.error(`Server error: ${errorResponse.message}`, {
      error: error,
      ...errorResponse,
    });
  } else {
    logger.warn(`Client error: ${errorResponse.message}`, errorResponse);
  }
  
  // Send appropriate status code based on error type
  const statusCode = StatusCodeMap[errorResponse.code] || 500;
  
  res.status(statusCode).json(errorResponse);
}

/**
 * Create an application error with the specified code and message
 * @param code - Error code
 * @param message - Error message
 * @param details - Additional error details
 * @returns Application error
 */
export function createError(code: string, message: string, details?: any): AppError {
  return new AppError(code, message, details);
}

export default {
  notFoundHandler,
  errorHandler,
  createError,
  formatZodError,
  ErrorCodes,
};