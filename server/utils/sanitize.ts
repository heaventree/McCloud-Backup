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
// Specific body fields (by route prefix) that carry opaque credential/token blobs (OAuth
// access & refresh tokens, API keys) rather than user-facing text. Nothing in this app ever
// renders those particular values as HTML, so HTML-entity-escaping them protects against
// nothing - it just corrupts the stored JSON. Confirmed live: a Google OAuth token JSON string
// had every `"` turned into `&quot;` on the way into storage_providers.config, breaking any
// direct read of that column (TokenRefreshManager's read-side multi-pass entity-decode happened
// to paper over it for in-app usage, which is why this went unnoticed until someone inspected
// the raw value).
//
// Scoped to these specific fields, not the whole request body - other fields on the same
// routes (e.g. storage_providers.name) genuinely are rendered as HTML in the UI and must stay
// sanitized normally, so a route-wide exemption would reopen an XSS path through them.
const OPAQUE_CREDENTIAL_FIELDS_BY_ROUTE: { prefix: string; fields: string[] }[] = [
  { prefix: '/api/storage-providers', fields: ['config'] },
  { prefix: '/api/oauth-tokens', fields: ['tokenData'] }
];

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

    // Sanitize request body - except any opaque credential fields for this route, which are
    // preserved from before sanitization and spliced back in unchanged afterward. Everything
    // else in the body (name, type, provider, etc.) still goes through normal sanitization.
    if (req.body && typeof req.body === 'object') {
      const exemptFields = OPAQUE_CREDENTIAL_FIELDS_BY_ROUTE.find(r => req.path.startsWith(r.prefix))?.fields;

      if (exemptFields && exemptFields.length > 0) {
        const preserved: Record<string, unknown> = {};
        for (const field of exemptFields) {
          if (field in req.body) {
            preserved[field] = req.body[field];
          }
        }

        req.body = sanitizeObject(req.body);

        for (const field of exemptFields) {
          if (field in preserved) {
            req.body[field] = preserved[field];
          }
        }
      } else {
        req.body = sanitizeObject(req.body);
      }
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