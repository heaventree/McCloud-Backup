/**
 * XSS Protection Utilities for React Client
 * 
 * This module provides helper functions to sanitize content on the client side
 * to protect against XSS attacks when user-provided content is rendered.
 */

/**
 * Characters to escape in HTML content
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
 * Create a replacement function for the regex
 */
const escapeReplacer = (char: string) => escapeMap[char] || char;

/**
 * Sanitize a string by escaping HTML special characters
 * @param input String to sanitize
 * @returns Sanitized string safe for rendering
 */
export function sanitizeString(input: string | undefined | null): string {
  if (input == null) return '';
  return String(input).replace(escapeRegExp, escapeReplacer);
}

/**
 * Strip all HTML tags from a string
 * @param input String with potential HTML
 * @returns String with all HTML tags removed
 */
export function stripHtml(input: string | undefined | null): string {
  if (input == null) return '';
  return String(input).replace(/<\/?[^>]+(>|$)/g, '');
}

/**
 * Sanitize user input specifically for use in HTML attributes
 * @param input String to sanitize
 * @returns Sanitized string safe for HTML attributes
 */
export function sanitizeHtmlAttribute(input: string | undefined | null): string {
  if (input == null) return '';
  return String(input)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Sanitize user input specifically for use in URLs
 * @param input URL string to sanitize
 * @returns Sanitized URL string or empty string if invalid
 */
export function sanitizeUrl(input: string | undefined | null): string {
  if (input == null) return '';
  
  const urlString = String(input).trim();
  // Basic URL sanitization - whitelist common protocols
  if (/^(https?|mailto|tel|ftp|data):/i.test(urlString)) {
    return urlString;
  } else if (urlString.startsWith('/')) {
    // Relative URLs are usually safe
    return urlString;
  }
  
  // If no valid protocol and not a relative URL, return empty
  return '';
}

/**
 * Create a trusted HTML element using React's dangerouslySetInnerHTML
 * WARNING: Only use this with content that has been properly sanitized!
 * 
 * @param html HTML content to render
 * @returns Object for dangerouslySetInnerHTML
 */
export function createTrustedHtml(html: string): { __html: string } {
  return { __html: html };
}

/**
 * Safely format content that may contain basic markdown (**, *, `, etc.)
 * This converts markdown to HTML safely by first sanitizing the input
 * 
 * @param markdown Simple markdown content
 * @returns Safe HTML string
 */
export function formatMarkdown(markdown: string | undefined | null): string {
  if (markdown == null) return '';
  
  const sanitized = sanitizeString(markdown);
  
  // Basic markdown formatting
  return sanitized
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Code
    .replace(/`(.*?)`/g, '<code>$1</code>')
    // Line breaks
    .replace(/\n/g, '<br />');
}