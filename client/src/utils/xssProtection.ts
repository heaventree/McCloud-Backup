/**
 * XSS Protection Utilities for the Client Side
 * 
 * This module provides tools to help prevent XSS (Cross-Site Scripting) attacks
 * by sanitizing user input and output in the client application.
 */

import DOMPurify from 'dompurify';

// Initialize DOMPurify with recommended config 
DOMPurify.setConfig({
  FORBID_ATTR: [
    'onerror', 'onload', 'onmouseover', 'onmouseout', 'onmousemove', 
    'onmouseup', 'onmousedown', 'onclick', 'onblur', 'onfocus',
    'onchange', 'onsubmit', 'onreset', 'onselect', 'onabort',
  ],
  FORBID_TAGS: [
    'script', 'style', 'iframe', 'frame', 'object', 'embed', 'form',
    'input', 'button', 'textarea', 'select', 'option', 'applet', 'meta',
  ],
  USE_PROFILES: { html: true },
  ADD_ATTR: ['target'], // Allow target attribute for links
});

// Add a hook to make all links safe
DOMPurify.addHook('afterSanitizeAttributes', function(node) {
  // If the node is an anchor tag
  if (node.tagName && node.tagName.toLowerCase() === 'a') {
    // Force links to open in a new tab
    node.setAttribute('target', '_blank');
    
    // Add security attributes to prevent the new page from accessing the window.opener
    node.setAttribute('rel', 'noopener noreferrer');
    
    // Only allow http/https protocols
    const href = node.getAttribute('href') || '';
    if (href && !href.startsWith('http:') && !href.startsWith('https:') && !href.startsWith('/') && !href.startsWith('#')) {
      node.setAttribute('href', '#');
    }
  }
});

/**
 * Sanitize HTML content to prevent XSS attacks
 * 
 * @param content HTML content to sanitize
 * @returns Sanitized HTML
 */
export const sanitizeHtml = (content: string): string => {
  return DOMPurify.sanitize(content);
};

/**
 * Sanitize HTML content with restrictive settings (minimal HTML tags allowed)
 * 
 * @param content HTML content to sanitize
 * @returns Sanitized restrictive HTML
 */
export const sanitizeRestrictive = (content: string): string => {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
  });
};

/**
 * Remove all HTML tags and return plain text
 * 
 * @param html HTML content to strip
 * @returns Plain text without HTML
 */
export const stripHtml = (html: string): string => {
  // Create a temporary element
  const tempEl = document.createElement('div');
  
  // Set its HTML content to the sanitized HTML
  tempEl.innerHTML = DOMPurify.sanitize(html);
  
  // Return just the text content
  return tempEl.textContent || '';
};

/**
 * Escape a string for safe insertion into HTML content
 * 
 * @param str String to escape
 * @returns Escaped string
 */
export const escapeHtml = (str: string): string => {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

/**
 * Callback function type for sanitizing content
 */
export type SanitizeFunction = (content: string) => string;

export default {
  sanitizeHtml,
  sanitizeRestrictive,
  stripHtml,
  escapeHtml,
};