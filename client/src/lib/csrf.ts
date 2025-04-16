/**
 * CSRF Token Utility Functions
 * 
 * This module provides utility functions for retrieving and working with CSRF tokens
 * in the browser, ensuring proper security for state-changing API requests.
 */

/**
 * Get the CSRF token from cookies
 * @returns The CSRF token value or empty string if not found
 */
export function getCsrfToken(): string {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('xsrf-token='))
    ?.split('=')[1] || '';
}

/**
 * Get headers with CSRF token included
 * @param contentType Optional content type header (defaults to 'application/json')
 * @returns Headers object with CSRF token and content type
 */
export function getHeadersWithCsrf(contentType: string = 'application/json'): HeadersInit {
  const csrfToken = getCsrfToken();
  
  return {
    'Content-Type': contentType,
    'X-XSRF-Token': csrfToken || '',
  };
}

/**
 * Default fetch options to include CSRF token and credentials
 * @param method HTTP method (GET, POST, PUT, DELETE, PATCH)
 * @param body Optional request body (will be stringified if object)
 * @returns Fetch options with proper headers and credentials
 */
export function getFetchOptions(method: string = 'GET', body?: any): RequestInit {
  const options: RequestInit = {
    method,
    headers: getHeadersWithCsrf(),
    credentials: 'include', // Always include cookies in requests
  };
  
  if (body && method !== 'GET') {
    options.body = typeof body === 'object' ? JSON.stringify(body) : body;
  }
  
  return options;
}

/**
 * Secure fetch wrapper that adds CSRF protection
 * @param url API endpoint URL
 * @param options Request options
 * @returns Fetch Promise
 */
export async function secureFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const csrfToken = getCsrfToken();
  
  // Merge provided headers with CSRF token
  const headers = {
    ...options.headers,
    'X-XSRF-Token': csrfToken || '',
  };
  
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}

export default {
  getCsrfToken,
  getHeadersWithCsrf,
  getFetchOptions,
  secureFetch
};