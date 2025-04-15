/**
 * Request Validation Utilities
 * 
 * This module provides middleware and utilities for validating request data
 * against Zod schemas, ensuring consistent validation throughout the application.
 */
import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { createLogger } from './logger';

const logger = createLogger('validation');

/**
 * Validation target type
 */
export type ValidationTarget = 'body' | 'query' | 'params' | 'headers';

/**
 * Validation options
 */
export interface ValidationOptions {
  target?: ValidationTarget;
  stripUnknown?: boolean;
}

/**
 * Default validation options
 */
const defaultOptions: ValidationOptions = {
  target: 'body',
  stripUnknown: true
};

/**
 * Validation error response
 */
export interface ValidationErrorResponse {
  message: string;
  code: string;
  errors: {
    path: string[];
    message: string;
  }[];
}

/**
 * Format Zod validation errors into a standardized format
 * 
 * @param error - Zod error object
 * @returns Formatted error object
 */
export function formatZodError(error: ZodError) {
  return {
    errors: error.errors.map(err => ({
      path: err.path.map(p => String(p)),
      message: err.message
    }))
  };
}

/**
 * Create validation middleware for a Zod schema
 * 
 * @param schema - Zod schema to validate against
 * @param options - Validation options
 * @returns Express middleware function
 */
export function validate<T extends z.ZodType>(
  schema: T,
  options: ValidationOptions = {}
) {
  const mergedOptions = { ...defaultOptions, ...options };
  
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get data from request based on target
      const data = req[mergedOptions.target!];
      
      // Validate data against schema
      const validatedData = schema.parse(data);
      
      // Replace request data with validated data
      req[mergedOptions.target!] = validatedData;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        
        logger.debug('Validation error', {
          target: mergedOptions.target,
          errors: error.errors
        });
        
        // Create error response
        const errorResponse: ValidationErrorResponse = {
          message: validationError.message,
          code: 'VALIDATION_ERROR',
          errors: error.errors.map(err => ({
            path: err.path.map(p => String(p)),
            message: err.message
          }))
        };
        
        return res.status(400).json(errorResponse);
      }
      
      // Unknown error, pass to next error handler
      next(error);
    }
  };
}

/**
 * Validate a numeric ID parameter
 * 
 * @param paramName - Name of the parameter to validate
 * @returns Express middleware function
 */
export function validateNumericId(paramName: string = 'id') {
  return validate(
    z.object({
      [paramName]: z.coerce.number().int().positive()
    }),
    { target: 'params' }
  );
}

/**
 * Validate an ID parameter (any string)
 * 
 * @param paramName - Name of the parameter to validate
 * @returns Express middleware function
 */
export function validateId(paramName: string = 'id') {
  return validate(
    z.object({
      [paramName]: z.string().min(1)
    }),
    { target: 'params' }
  );
}

/**
 * Parse and validate a pagination query
 * 
 * @param req - Express request
 * @returns Parsed pagination parameters or defaults
 */
export function parsePagination(req: Request) {
  const schema = z.object({
    limit: z.coerce.number().int().positive().optional().default(100),
    offset: z.coerce.number().int().min(0).optional().default(0)
  });
  
  try {
    return schema.parse(req.query);
  } catch (error) {
    if (error instanceof ZodError) {
      return { limit: 100, offset: 0 };
    }
    throw error;
  }
}

/**
 * Validate a date string
 * 
 * @param dateString - String to validate as date
 * @returns true if valid ISO date string, false otherwise
 */
export function isValidDateString(dateString: string): boolean {
  try {
    return !isNaN(Date.parse(dateString));
  } catch (error) {
    return false;
  }
}

/**
 * Validate a URL string
 * 
 * @param urlString - String to validate as URL
 * @returns true if valid URL, false otherwise
 */
export function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch (error) {
    return false;
  }
}