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
  // Debug: log the cookie content
  console.log('Current cookies:', document.cookie);
  
  // CSRF cookie name from server code is 'xsrf-token' (lowercase)
  const token = decodeURIComponent(document.cookie
    .split('; ')
    .find(row => row.startsWith('xsrf-token='))
    ?.split('=')[1] || '');
    
  console.log('Found token:', token);
  return token;
}

/**
 * Fetch a new CSRF token from the server
 * This should be called before performing any operation that requires CSRF protection
 */
export async function fetchCsrfToken(): Promise<string> {
  // If we already have a token, don't fetch a new one to avoid rate limiting
  const existingToken = getCsrfToken();
  if (existingToken) {
    console.log('Using existing CSRF token');
    return existingToken;
  }
  
  try {
    // Use our direct CSRF token endpoint
    console.log('Fetching new CSRF token from endpoint');
    const response = await fetch('/api/auth/csrf-token', {
      method: 'GET',
      credentials: 'include', // Important to include cookies
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch CSRF token');
    }
    
    // The response includes the token in both the cookie and the response body
    const data = await response.json();
    console.log('Received token from server:', data.token);
    
    // The CSRF token is now in the cookie for future use
    const cookieToken = getCsrfToken();
    console.log('Token from cookie after fetch:', cookieToken);
    
    // Return the token from the response data if not in cookie
    return cookieToken || data.token;
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    return '';
  }
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
 * @param ensureToken If true, ensure a CSRF token exists before making the request
 * @returns Fetch Promise
 */
export async function secureFetch(url: string, options: RequestInit = {}, ensureToken: boolean = false): Promise<Response> {
  // For state-changing methods, we need to ensure we have a token
  const isStateChanging = options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase());
  
  // If we need to ensure a token (e.g. for login) or it's a state-changing method
  if (ensureToken || isStateChanging) {
    let token = getCsrfToken();
    
    // If we don't have a token, fetch one
    if (!token) {
      await fetchCsrfToken();
      token = getCsrfToken();
    }
  }
  
  // Get the current token (which might have just been fetched)
  const csrfToken = getCsrfToken();
  
  // Merge provided headers with CSRF token
  const headers = {
    ...options.headers,
    'X-XSRF-Token': csrfToken,
  };
  
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}

export default {
  getCsrfToken,
  fetchCsrfToken,
  getHeadersWithCsrf,
  getFetchOptions,
  secureFetch
};