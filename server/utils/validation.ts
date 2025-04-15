/**
 * Comprehensive Input Validation
 * 
 * This module provides robust input validation middleware using Zod
 * for validating API inputs, query parameters, and URL segments.
 */
import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema, z } from 'zod';
import { createLogger } from './logger';

const logger = createLogger('validation');

// Types for validation targets
type ValidationTarget = 'body' | 'query' | 'params';

export interface ValidationOptions {
  target?: ValidationTarget;
  sanitize?: boolean;
  abortEarly?: boolean;
}

/**
 * Format Zod validation errors into a consistent structure
 * @param error Zod validation error
 * @returns Formatted error object
 */
export function formatZodError(error: ZodError) {
  return {
    status: 'validation_error',
    errors: error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
      code: err.code
    }))
  };
}

/**
 * Create validation middleware for request body, query, or params
 * @param schema Zod schema for validation
 * @param options Validation options
 * @returns Express middleware function
 */
export function validate<T>(schema: ZodSchema<T>, options: ValidationOptions = {}) {
  const { target = 'body', sanitize = true, abortEarly = false } = options;
  
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Select validation target
      const data = target === 'body' ? req.body :
                  target === 'query' ? req.query :
                  target === 'params' ? req.params : req.body;
      
      // Validate and potentially sanitize data
      const validatedData = schema.parse(data);
      
      // If sanitization is enabled, replace original data with validated data
      if (sanitize) {
        if (target === 'body') req.body = validatedData;
        else if (target === 'query') req.query = validatedData;
        else if (target === 'params') req.params = validatedData;
      }
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Validation error', { target, errors: error.errors });
        
        return res.status(400).json(formatZodError(error));
      }
      
      // Unexpected errors should be passed to error handler
      next(error);
    }
  };
}

/**
 * Generate validation debug information
 * This can be used during development to understand validation issues
 * @param schema Zod schema
 * @param data Data to validate
 * @returns Validation result or error information
 */
export function validateDebug<T>(schema: ZodSchema<T>, data: any) {
  try {
    const result = schema.safeParse(data);
    
    if (result.success) {
      return {
        success: true,
        data: result.data
      };
    } else {
      return {
        success: false,
        errors: formatZodError(result.error)
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Common validation schemas for reuse
 */
export const commonSchemas = {
  // String validation with common options
  string: (options?: { min?: number, max?: number, trim?: boolean }) => {
    let schema = z.string();
    
    if (options?.trim) schema = schema.trim();
    if (options?.min !== undefined) schema = schema.min(options.min);
    if (options?.max !== undefined) schema = schema.max(options.max);
    
    return schema;
  },
  
  // Non-empty string validation
  nonEmptyString: z.string().trim().min(1),
  
  // Email validation
  email: z.string().email().trim().toLowerCase(),
  
  // URL validation
  url: z.string().url().trim(),
  
  // ID validation (number or string)
  id: z.union([
    z.number().int().positive(),
    z.string().trim().min(1)
  ]),
  
  // Numeric ID validation
  numericId: z.number().int().positive(),
  
  // String ID validation
  stringId: z.string().trim().min(1),
  
  // UUID validation
  uuid: z.string().uuid(),
  
  // Date validation
  date: z.union([
    z.date(),
    z.string().refine(value => !isNaN(Date.parse(value)), {
      message: 'Invalid date format'
    }).transform(value => new Date(value))
  ]),
  
  // Pagination parameters
  pagination: z.object({
    page: z.union([
      z.string().transform(val => parseInt(val, 10)),
      z.number().int()
    ]).default(1),
    limit: z.union([
      z.string().transform(val => parseInt(val, 10)),
      z.number().int()
    ]).default(10).refine(val => val <= 100, {
      message: 'Limit cannot exceed 100'
    })
  }).default({ page: 1, limit: 10 }),
  
  // Search parameters
  search: z.object({
    query: z.string().trim().optional(),
    sort: z.string().trim().optional(),
    direction: z.enum(['asc', 'desc']).optional().default('asc')
  }).default({})
};

/**
 * Create validation middleware for pagination parameters
 * @returns Express middleware function
 */
export function validatePagination() {
  return validate(commonSchemas.pagination, { target: 'query' });
}

/**
 * Create validation middleware for search parameters
 * @returns Express middleware function
 */
export function validateSearch() {
  return validate(commonSchemas.search, { target: 'query' });
}

/**
 * Create validation middleware for ID parameter
 * @param paramName Name of the ID parameter (default: 'id')
 * @returns Express middleware function
 */
export function validateId(paramName = 'id') {
  return validate(
    z.object({ [paramName]: commonSchemas.id }),
    { target: 'params' }
  );
}

/**
 * Create validation middleware for numeric ID parameter
 * @param paramName Name of the ID parameter (default: 'id')
 * @returns Express middleware function
 */
export function validateNumericId(paramName = 'id') {
  return validate(
    z.object({ [paramName]: commonSchemas.numericId }),
    { target: 'params' }
  );
}