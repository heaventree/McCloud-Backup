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

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
