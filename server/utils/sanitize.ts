/**
 * Server-Side Input Sanitization Utilities
 * 
 * This module provides utility functions for sanitizing user inputs
 * to prevent various injection attacks (XSS, SQL injection, etc.)
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from './logger';

/**
 * Characters that need escaping in HTML content
 */
const escapeMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

/**
 * Regex pattern to match characters that need escaping
 */
const escapeRegExp = /[&<>"'`=\/]/g;

/**
 * Escapes HTML special characters in a string
 * @param input - String to sanitize
 * @returns Sanitized string safe for inserting into HTML
 */
export function escapeHtml(input: string | undefined | null): string {
  if (input == null) return '';
  return String(input).replace(escapeRegExp, (match) => escapeMap[match] || match);
}

/**
 * Sanitizes a string to prevent XSS attacks
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string | undefined | null): string {
  if (input == null) return '';
  return escapeHtml(String(input).trim());
}

/**
 * Safely parses an integer from a string, with a default value
 * @param input - String to parse
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed integer or default value
 */
export function safeParseInt(input: string | undefined | null, defaultValue: number): number {
  if (input == null) return defaultValue;
  
  const parsed = parseInt(input, 10);
  if (isNaN(parsed)) return defaultValue;
  
  return parsed;
}

/**
 * Safely parses a float from a string, with a default value
 * @param input - String to parse
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed float or default value
 */
export function safeParseFloat(input: string | undefined | null, defaultValue: number): number {
  if (input == null) return defaultValue;
  
  const parsed = parseFloat(input);
  if (isNaN(parsed)) return defaultValue;
  
  return parsed;
}

/**
 * Strips all HTML tags from a string
 * @param input - String to strip
 * @returns String without HTML tags
 */
export function stripHtml(input: string | undefined | null): string {
  if (input == null) return '';
  return String(input).replace(/<\/?[^>]+(>|$)/g, '');
}

/**
 * Sanitizes user input specifically for inclusion in SQL queries
 * This should be used with parameterized queries for proper protection
 * @param input - Input to sanitize
 * @returns Sanitized input
 */
export function sanitizeForSql(input: string | undefined | null): string {
  if (input == null) return '';
  
  // Replace single quotes with doubled single quotes to escape them
  return String(input).replace(/'/g, "''");
}

/**
 * Middleware to sanitize all request inputs
 */
export function sanitizeInputs(req: Request, res: Response, next: NextFunction): void {
  const requestId = uuidv4();
  
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
    logger.debug(`[sanitize] (${requestId}) Request body sanitized`, {
      path: req.path,
      method: req.method,
    });
  }
  
  // Sanitize URL parameters
  if (req.params && typeof req.params === 'object') {
    sanitizeObject(req.params);
    logger.debug(`[sanitize] (${requestId}) Request params sanitized`, {
      path: req.path,
      method: req.method,
    });
  }
  
  // Sanitize query string
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
    logger.debug(`[sanitize] (${requestId}) Request query sanitized`, {
      path: req.path,
      method: req.method,
    });
  }
  
  // Attach request ID for tracing
  req.requestId = requestId;
  
  next();
}

/**
 * Helper function to recursively sanitize all string values in an object
 * @param obj - Object to sanitize
 */
function sanitizeObject(obj: Record<string, any>): void {
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    
    if (typeof value === 'string') {
      // Skip sanitization for password fields to avoid interference
      if (key.toLowerCase().includes('password')) {
        return;
      }
      
      // Sanitize string values
      obj[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects and arrays
      sanitizeObject(value);
    }
  });
}

// Extend the Express Request interface to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export default {
  escapeHtml,
  sanitizeString,
  safeParseInt,
  safeParseFloat,
  stripHtml,
  sanitizeForSql,
  sanitizeInputs,
};