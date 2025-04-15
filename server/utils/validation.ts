/**
 * Input Validation Utilities
 * 
 * This module provides consistent validation functions for various types of inputs
 * across the application to enhance security and data integrity.
 */

import { z } from 'zod';
import { formatZodError } from './error-handler';
import logger from './logger';

// Common validation schemas
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .max(255, 'Email must be less than 255 characters');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password must be less than 100 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
    'Password must include uppercase, lowercase, number, and special character'
  );

export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be less than 30 characters')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Username can only contain letters, numbers, underscores, and hyphens'
  );

export const urlSchema = z
  .string()
  .url('Invalid URL format')
  .max(2048, 'URL must be less than 2048 characters');

export const apiKeySchema = z
  .string()
  .min(10, 'API key must be at least 10 characters')
  .max(500, 'API key must be less than 500 characters');

export const tokenSchema = z
  .string()
  .min(10, 'Token must be at least 10 characters')
  .max(1000, 'Token must be less than 1000 characters');

export const idSchema = z
  .union([
    z.number().int().positive(),
    z.string().regex(/^\d+$/).transform(Number)
  ])
  .refine((val) => val > 0, 'ID must be a positive number');

export const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    'Invalid UUID format'
  );

// Validation wrapper function for async validation
export async function validateAsync<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<{ success: true; data: T } | { success: false; error: any }> {
  try {
    const validData = await schema.parseAsync(data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedError = formatZodError(error);
      logger.debug('Validation error', { error: formattedError });
      return { success: false, error: formattedError };
    }
    
    logger.error('Unexpected validation error', { error });
    return {
      success: false,
      error: { message: 'An unexpected validation error occurred' }
    };
  }
}

// Synchronous validation wrapper
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: any } {
  try {
    const validData = schema.parse(data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedError = formatZodError(error);
      logger.debug('Validation error', { error: formattedError });
      return { success: false, error: formattedError };
    }
    
    logger.error('Unexpected validation error', { error });
    return {
      success: false,
      error: { message: 'An unexpected validation error occurred' }
    };
  }
}

export default {
  validate,
  validateAsync,
  emailSchema,
  passwordSchema,
  usernameSchema,
  urlSchema,
  apiKeySchema,
  tokenSchema,
  idSchema,
  uuidSchema
};