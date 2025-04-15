/**
 * API Input Validation Utilities
 * 
 * This module provides reusable validators and helper functions for 
 * consistent API input validation using Zod.
 */
import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { fromZodError } from 'zod-validation-error';
import logger from './logger';

// Use the default logger instance

/**
 * Common validation error response type 
 */
export interface ValidationErrorResponse {
  code: string;
  message: string;
  errors?: Array<{
    path: (string | number)[];
    message: string;
  }>;
}

/**
 * Common API error codes
 */
export enum ApiErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  RATE_LIMITED = 'RATE_LIMITED',
}

/**
 * Format Zod validation errors into a consistent structure
 * @param error Zod validation error
 * @returns Formatted validation error response
 */
export function formatZodError(error: ZodError): ValidationErrorResponse {
  const friendlyError = fromZodError(error);
  
  return {
    code: ApiErrorCode.VALIDATION_ERROR,
    message: friendlyError.message,
    errors: error.errors.map(err => ({
      path: err.path.map(p => String(p)), // Convert all path elements to strings
      message: err.message,
    })),
  };
}

/**
 * Express middleware to validate request body
 * @param schema Zod schema to validate against
 * @returns Express middleware
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.parse(req.body);
      req.body = result; // Replace with validated data
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Request body validation failed', {
          path: req.path,
          error: formatZodError(error),
          requestId: (req as any).requestId,
        });
        
        res.status(400).json(formatZodError(error));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Express middleware to validate request query parameters
 * @param schema Zod schema to validate against
 * @returns Express middleware
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.parse(req.query);
      req.query = result as any; // Replace with validated data
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Request query validation failed', {
          path: req.path,
          error: formatZodError(error),
          requestId: (req as any).requestId,
        });
        
        res.status(400).json(formatZodError(error));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Express middleware to validate request path parameters
 * @param schema Zod schema to validate against
 * @returns Express middleware
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.parse(req.params);
      req.params = result as any; // Replace with validated data
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Request params validation failed', {
          path: req.path,
          error: formatZodError(error),
          requestId: (req as any).requestId,
        });
        
        res.status(400).json(formatZodError(error));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Common validation schemas for reuse across different endpoints
 */
export const CommonValidators = {
  id: z.string().uuid({ message: 'Must be a valid UUID' }),
  email: z.string().email({ message: 'Must be a valid email address' }),
  url: z.string().url({ message: 'Must be a valid URL' }),
  limit: z.coerce.number().int().positive().default(10),
  offset: z.coerce.number().int().min(0).default(0),
  page: z.coerce.number().int().positive().default(1),
  sort: z.enum(['asc', 'desc']).default('asc'),
  
  // Common validation for pagination
  pagination: z.object({
    limit: z.coerce.number().int().positive().max(100).default(10),
    offset: z.coerce.number().int().min(0).default(0),
  }),
  
  // GitHub specific validators
  githubOwner: z.string().min(1, 'Repository owner is required'),
  githubRepo: z.string().min(1, 'Repository name is required'),
  githubRef: z.string().default('main'),
  githubToken: z.string().min(10, 'Valid GitHub token is required'),
  
  // Generic token validators
  oauthToken: z.string().min(10, 'Valid OAuth token is required'),
  refreshToken: z.string().min(10, 'Valid refresh token is required'),
};

/**
 * Helper function to validate data against a schema without using middleware
 * @param schema Zod schema to validate against
 * @param data Data to validate
 * @returns Validated data or throws
 */
export function validateData<T>(schema: ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safe validation that returns null on error
 * @param schema Zod schema to validate against
 * @param data Data to validate
 * @returns Validated data or null on error
 */
export function safeValidate<T>(schema: ZodSchema<T>, data: unknown): T | null {
  try {
    return schema.parse(data);
  } catch (error) {
    return null;
  }
}

/**
 * Validate data and return result with error information
 * @param schema Zod schema to validate against
 * @param data Data to validate
 * @returns Object with success flag, data if valid, or error if invalid
 */
export function validateWithResult<T>(schema: ZodSchema<T>, data: unknown): { 
  success: boolean; 
  data?: T; 
  error?: ValidationErrorResponse 
} {
  try {
    const validData = schema.parse(data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof ZodError) {
      return { 
        success: false,
        error: formatZodError(error)
      };
    }
    // Handle unexpected errors
    return { 
      success: false,
      error: { 
        code: ApiErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred during validation'
      }
    };
  }
}