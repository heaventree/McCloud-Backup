import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Cache for CSRF token
let csrfTokenCache: { token: string, expires: number } | null = null;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Get a valid CSRF token, fetching a new one if needed
 */
export async function getCsrfToken(): Promise<string> {
  // Check if we have a valid cached token
  if (csrfTokenCache && Date.now() < csrfTokenCache.expires - 60000) { // Expire 1 minute early to be safe
    return csrfTokenCache.token;
  }
  
  // Otherwise fetch a new token
  const res = await fetch('/api/csrf-token', {
    method: 'GET',
    credentials: 'include',
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch CSRF token');
  }
  
  const data = await res.json();
  csrfTokenCache = {
    token: data.token,
    expires: data.expires
  };
  
  return data.token;
}

/**
 * Make an API request with CSRF protection
 */
export async function apiRequest<T = Response>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<T> {
  // Only fetch CSRF token for state-changing methods
  const csrfNeeded = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  
  // Default headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Add CSRF token header for state-changing methods
  if (csrfNeeded) {
    headers['X-CSRF-Token'] = await getCsrfToken();
  }
  
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
      headers['X-CSRF-Token'] = await getCsrfToken();
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
