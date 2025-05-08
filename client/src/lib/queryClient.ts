import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getCsrfToken, getHeadersWithCsrf } from './csrf';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Make an API request with CSRF protection
 */
export async function apiRequest<T = Response>(
  method: string,
  url: string,
  data?: unknown | undefined,
  customHeaders?: Record<string, string>
): Promise<T> {
  // Check if this is a backup-related endpoint (exempt from CSRF)
  const isBackupEndpoint = url.includes('/api/backup') || url.includes('/api/backups');
  
  // Only fetch CSRF token for state-changing methods that aren't backup endpoints
  const csrfNeeded = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) && !isBackupEndpoint;
  
  // Fetch a fresh CSRF token if needed for state-changing methods
  let csrfToken = '';
  if (csrfNeeded) {
    try {
      const tokenResponse = await fetch('/api/auth/csrf-token');
      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        csrfToken = tokenData.token;
        console.log('Using fresh CSRF token for request');
      }
    } catch (error) {
      console.error('Error fetching CSRF token:', error);
      // Attempt to use existing token
      csrfToken = getCsrfToken();
    }
  }
  
  // Combine base headers with custom headers
  const baseHeaders = {
    'Content-Type': 'application/json',
    ...(csrfNeeded && csrfToken ? { 'X-XSRF-Token': csrfToken } : {})
  };
  
  const headers = {
    ...baseHeaders,
    ...customHeaders
  };
  
  // For debugging
  console.log(`Making ${method} request to ${url} with CSRF token: ${csrfToken ? 'Yes' : 'No'}`);
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  // If T is Response, return the Response object directly
  if (method === "HEAD" || method === "DELETE") {
    return res as unknown as T;
  }
  
  // Otherwise, parse the JSON response
  return await res.json() as T;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Create headers with potential additional data from query key
    const headers: Record<string, string> = {};
    
    // If the query key is an array with specific settings
    const options = Array.isArray(queryKey) && queryKey.length > 1 && typeof queryKey[1] === 'object' 
      ? queryKey[1] as Record<string, any> 
      : {};
      
    // Check if this query requires CSRF protection (rare but possible)
    if (options.csrfProtected) {
      headers['X-CSRF-Token'] = getCsrfToken();
    }
    
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Browser cache for requests to reduce API calls
const requestCache = new Map<string, { data: any; timestamp: number }>();
const BROWSER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Custom fetcher with browser-level caching
export async function cachedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Only cache GET requests
  if (options.method && options.method !== 'GET') {
    return fetch(url, options);
  }
  
  const cacheKey = url;
  const now = Date.now();
  const cached = requestCache.get(cacheKey);
  
  // Return from cache if still valid
  if (cached && now - cached.timestamp < BROWSER_CACHE_TTL) {
    console.log(`Using cached response for: ${url}`);
    return new Response(JSON.stringify(cached.data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Make the actual request
  const response = await fetch(url, options);
  
  // Only cache successful responses
  if (response.ok) {
    try {
      // Clone the response since we need to read it twice (once for cache, once for return)
      const clone = response.clone();
      const data = await clone.json();
      requestCache.set(cacheKey, { data, timestamp: now });
    } catch (err) {
      console.warn('Failed to cache response:', err);
    }
  }
  
  return response;
}

// Request concurrency limiter to avoid rate limiting
class ConcurrencyLimiter {
  private maxConcurrent: number;
  private runningRequests: number = 0;
  private queue: Array<{ resolve: () => void }> = [];
  
  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
  }
  
  async acquire(): Promise<void> {
    if (this.runningRequests < this.maxConcurrent) {
      this.runningRequests++;
      return Promise.resolve();
    }
    
    return new Promise<void>(resolve => {
      this.queue.push({ resolve });
    });
  }
  
  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.resolve();
    } else {
      this.runningRequests--;
    }
  }
}

// Create a limiter that allows only 3 concurrent requests
const limiter = new ConcurrencyLimiter(3);

// Custom retry function to handle rate limiting
const shouldRetry = (failureCount: number, error: any) => {
  // Don't retry if this isn't a rate limit error (status 429)
  if (error?.message && !error.message.includes('429')) {
    return false;
  }

  // Retry a maximum of 3 times with longer delays
  return failureCount < 3;
};

// Override the default fetch implementation with our rate-limited version
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  await limiter.acquire();
  try {
    // Use cached version for GET requests
    if (!args[1] || !args[1].method || args[1].method === 'GET') {
      return cachedFetch(args[0] as string, args[1]);
    }
    return await originalFetch(...args);
  } finally {
    setTimeout(() => limiter.release(), 50); // Add a small delay between requests
  }
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes to reduce refresh frequency
      retry: shouldRetry,
      retryDelay: (attemptIndex) => Math.min(1000 * (2 ** attemptIndex) + Math.random() * 1000, 30000),
      // In TanStack Query v5, cacheTime was renamed to gcTime
      gcTime: 30 * 60 * 1000, // 30 minutes cache time
      networkMode: 'always', // Prevent auto offline detection
    },
    mutations: {
      retry: shouldRetry,
      retryDelay: (attemptIndex) => Math.min(1000 * (2 ** attemptIndex) + Math.random() * 1000, 15000),
      networkMode: 'always', // Prevent auto offline detection
    },
  },
});
