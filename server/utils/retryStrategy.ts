/**
 * Retry Strategy Utility
 * 
 * Provides a configurable retry mechanism with exponential backoff
 * for handling transient failures in critical operations.
 */

import logger from './logger';

/**
 * Configuration options for retry operations
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  
  /** Initial delay in milliseconds (default: 1000ms) */
  initialDelay?: number;
  
  /** Maximum delay in milliseconds (default: 30000ms) */
  maxDelay?: number;
  
  /** Exponential backoff factor (default: 2) */
  backoffFactor?: number;
  
  /** Whether to add jitter to delays to prevent synchronized retries (default: true) */
  useJitter?: boolean;
  
  /** Predicate function to determine if an error is retryable */
  retryableError?: (error: unknown) => boolean;
  
  /** Optional callback for each retry attempt */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
}

/**
 * Retry result with details about the operation
 */
export interface RetryResult<T> {
  /** The result of the successful operation */
  result: T;
  
  /** Number of retry attempts that were made */
  attempts: number;
  
  /** Total time elapsed during retry operations (ms) */
  totalTime: number;
}

/**
 * Default options for retry operations
 */
const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'retryableError' | 'onRetry'>> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffFactor: 2,
  useJitter: true
};

/**
 * Default predicate to determine if an error is retryable
 * By default, considers network errors, rate limiting, and server errors as retryable
 */
const defaultRetryableError = (error: unknown): boolean => {
  if (!error) return false;
  
  // If it's an axios error with response status
  if (
    typeof error === 'object' && 
    error !== null && 
    'response' in (error as Record<string, unknown>) && 
    (error as Record<string, unknown>).response !== null &&
    (error as Record<string, unknown>).response !== undefined &&
    typeof (error as Record<string, unknown>).response === 'object' &&
    (error as Record<string, unknown>).response !== null &&
    'status' in ((error as Record<string, unknown>).response as Record<string, unknown>)
  ) {
    const status = ((error as Record<string, unknown>).response as Record<string, unknown>).status as number;
    
    // Retry on rate limiting (429) and server errors (5xx)
    if (status === 429 || (status >= 500 && status < 600)) {
      return true;
    }
  }
  
  // Network errors (ECONNRESET, ETIMEDOUT, etc.)
  if (
    typeof error === 'object' && 
    error !== null && 
    'code' in error && 
    typeof error.code === 'string'
  ) {
    const networkErrorCodes = [
      'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND',
      'ENETUNREACH', 'EHOSTUNREACH', 'EPIPE'
    ];
    
    if (networkErrorCodes.includes(error.code)) {
      return true;
    }
  }
  
  // If it's an Error object with a message indicating a network issue
  if (error instanceof Error) {
    const networkErrorMessages = [
      'network error', 'timeout', 'socket hang up', 'ETIMEDOUT', 
      'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND'
    ];
    
    if (networkErrorMessages.some(msg => error.message.toLowerCase().includes(msg.toLowerCase()))) {
      return true;
    }
  }
  
  return false;
};

/**
 * Calculates the next delay with exponential backoff and optional jitter
 * 
 * @param attempt Current attempt number (0-based)
 * @param options Retry options
 * @returns Delay in milliseconds
 */
export const calculateBackoffDelay = (
  attempt: number, 
  options: Required<Omit<RetryOptions, 'retryableError' | 'onRetry'>>
): number => {
  // Calculate exponential backoff
  const exponentialDelay = Math.min(
    options.maxDelay,
    options.initialDelay * Math.pow(options.backoffFactor, attempt)
  );
  
  // Add jitter if enabled (±20% randomness)
  if (options.useJitter) {
    const jitterFactor = 0.8 + (Math.random() * 0.4); // Random value between 0.8 and 1.2
    return Math.floor(exponentialDelay * jitterFactor);
  }
  
  return exponentialDelay;
};

/**
 * Executes a function with retry capability using exponential backoff
 * 
 * @param fn The async function to retry
 * @param options Retry configuration options
 * @returns A promise that resolves with the operation result and retry stats
 * @throws The last error encountered if all retries fail
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  // Merge provided options with defaults
  const retryOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    retryableError: options.retryableError || defaultRetryableError,
    onRetry: options.onRetry || ((err, attempt, delay) => {
      logger.warn(`Retry attempt ${attempt} after ${delay}ms delay`, { 
        error: err instanceof Error ? err.message : String(err),
        attempt,
        delay
      });
    })
  };
  
  let lastError: unknown;
  let attempts = 0;
  const startTime = Date.now();
  
  while (attempts <= retryOptions.maxRetries) {
    try {
      // Execute the function
      const result = await fn();
      
      // Calculate total elapsed time
      const totalTime = Date.now() - startTime;
      
      // If successful after retries, log the success
      if (attempts > 0) {
        logger.info(`Operation succeeded after ${attempts} retries`, {
          attempts,
          totalTime
        });
      }
      
      // Return the result with retry statistics
      return {
        result,
        attempts,
        totalTime
      };
    } catch (error) {
      lastError = error;
      attempts++;
      
      // If we've reached max retries or the error isn't retryable, throw
      if (
        attempts > retryOptions.maxRetries || 
        !retryOptions.retryableError(error)
      ) {
        logger.error(`Operation failed after ${attempts - 1} retries`, {
          error: error instanceof Error ? error.message : String(error),
          attempts: attempts - 1,
          totalTime: Date.now() - startTime
        });
        throw error;
      }
      
      // Calculate delay for this attempt
      const delay = calculateBackoffDelay(attempts - 1, retryOptions);
      
      // Execute retry callback if provided
      if (retryOptions.onRetry) {
        retryOptions.onRetry(error, attempts, delay);
      }
      
      // Wait for the calculated delay
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // This shouldn't be reachable due to the throw in the catch block,
  // but TypeScript requires a return value
  throw lastError;
}

/**
 * Creates a wrapped version of an async function with retry capabilities
 * 
 * @param fn The async function to wrap with retry logic
 * @param options Retry configuration options
 * @returns A wrapped function with the same signature that will retry on failure
 */
export function withRetry<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options: RetryOptions = {}
): (...args: T) => Promise<RetryResult<R>> {
  return async (...args: T): Promise<RetryResult<R>> => {
    return retry(() => fn(...args), options);
  };
}

/**
 * Helper to create a specialized retry function with custom default options
 * 
 * @param defaultOptions Default retry options for this specialized retry function
 * @returns A configured retry function
 */
export function createRetryStrategy(defaultOptions: RetryOptions) {
  return <T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<RetryResult<T>> => {
    return retry(fn, { ...defaultOptions, ...options });
  };
}

// Export a preconfigured retry strategy for critical operations
export const criticalOperationRetry = createRetryStrategy({
  maxRetries: 5,
  initialDelay: 1000,
  maxDelay: 60000, // 1 minute max delay
  backoffFactor: 2,
  useJitter: true
});

// Export a preconfigured retry strategy for network requests
export const networkRequestRetry = createRetryStrategy({
  maxRetries: 3,
  initialDelay: 500,
  maxDelay: 5000, // 5 seconds max delay
  backoffFactor: 2,
  useJitter: true
});

// Export a preconfigured retry strategy for database operations
export const dbOperationRetry = createRetryStrategy({
  maxRetries: 4,
  initialDelay: 100,
  maxDelay: 3000, // 3 seconds max delay
  backoffFactor: 1.5, // Gentler backoff factor
  useJitter: true
});