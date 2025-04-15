/**
 * Input Sanitization Utilities
 * 
 * This module provides functions to sanitize user input
 * to prevent XSS and other injection attacks.
 */

import { Request, Response, NextFunction } from 'express';
import logger from './logger';

/**
 * HTML entity encoder
 * 
 * @param str Input string
 * @returns Sanitized string with HTML entities encoded
 */
export function encodeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitize a string to prevent XSS
 * 
 * @param input Input string or object
 * @returns Sanitized version
 */
export function sanitizeString(input: string | undefined | null): string {
  if (input === undefined || input === null) {
    return '';
  }
  
  return encodeHTML(input);
}

/**
 * Recursively sanitize an object's string properties
 * 
 * @param obj Object to sanitize
 * @returns Sanitized object
 */
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = sanitizeObject(obj[key]);
      }
    }
    return result;
  }
  
  return obj;
}

/**
 * Middleware to sanitize request inputs
 * 
 * @param req Request object
 * @param res Response object
 * @param next Next middleware function
 */
export function sanitizeInputs(req: Request, res: Response, next: NextFunction): void {
  try {
    // Skip sanitization for certain content types
    const contentType = req.headers['content-type'] || '';
    if (
      contentType.includes('multipart/form-data') ||
      contentType.includes('application/octet-stream')
    ) {
      // Skip binary content
      return next();
    }
    
    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    
    // Sanitize URL params
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }
    
    next();
  } catch (error) {
    logger.error('Error in sanitization middleware', { error });
    next(error);
  }
}

export default {
  sanitizeString,
  sanitizeObject,
  sanitizeInputs
};