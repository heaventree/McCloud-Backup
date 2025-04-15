/**
 * Structured Logging System
 * 
 * This module provides a structured logging system with proper severity levels,
 * context tracking, and formatting for consistent logs across the application.
 */

// Log levels
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
  TRACE = 'TRACE'
}

// Log entry interface
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  requestId?: string;
  userId?: string | number;
  data?: any;
  error?: {
    message: string;
    name?: string;
    stack?: string;
  };
}

// Global request ID for context tracking
let currentRequestId: string | undefined;

/**
 * Set current request ID for context tracking
 * @param requestId Request ID to set
 */
export function setRequestId(requestId: string): void {
  currentRequestId = requestId;
}

/**
 * Get current request ID
 * @returns Current request ID or undefined
 */
export function getRequestId(): string | undefined {
  return currentRequestId;
}

/**
 * Clear current request ID
 */
export function clearRequestId(): void {
  currentRequestId = undefined;
}

/**
 * Format log entry as JSON string
 * @param entry Log entry to format
 * @returns Formatted log entry
 */
function formatLogEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

/**
 * Get current log level from environment
 * @returns Current log level
 */
function getCurrentLogLevel(): LogLevel {
  const envLogLevel = process.env.LOG_LEVEL?.toUpperCase();
  
  switch (envLogLevel) {
    case 'ERROR':
      return LogLevel.ERROR;
    case 'WARN':
      return LogLevel.WARN;
    case 'INFO':
      return LogLevel.INFO;
    case 'DEBUG':
      return LogLevel.DEBUG;
    case 'TRACE':
      return LogLevel.TRACE;
    default:
      // Default to INFO in production, DEBUG in development
      return process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
  }
}

/**
 * Check if log level should be logged
 * @param level Log level to check
 * @returns True if log level should be logged
 */
function shouldLog(level: LogLevel): boolean {
  const currentLevel = getCurrentLogLevel();
  
  switch (currentLevel) {
    case LogLevel.ERROR:
      return level === LogLevel.ERROR;
    case LogLevel.WARN:
      return level === LogLevel.ERROR || level === LogLevel.WARN;
    case LogLevel.INFO:
      return level === LogLevel.ERROR || level === LogLevel.WARN || level === LogLevel.INFO;
    case LogLevel.DEBUG:
      return level === LogLevel.ERROR || level === LogLevel.WARN || level === LogLevel.INFO || level === LogLevel.DEBUG;
    case LogLevel.TRACE:
      return true;
    default:
      return true;
  }
}

/**
 * Create logger instance for a specific source
 * @param source Source name for logger
 * @returns Logger instance
 */
export function createLogger(source: string) {
  return {
    /**
     * Log error message
     * @param message Error message
     * @param error Error object
     * @param data Additional data
     */
    error(message: string, error?: any, data?: any): void {
      if (!shouldLog(LogLevel.ERROR)) {
        return;
      }
      
      const errorObj = error instanceof Error ? {
        message: error.message,
        name: error.name,
        stack: error.stack
      } : error ? { message: String(error) } : undefined;
      
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: LogLevel.ERROR,
        source,
        message,
        requestId: currentRequestId,
        data,
        error: errorObj
      };
      
      console.error(formatLogEntry(entry));
    },
    
    /**
     * Log warning message
     * @param message Warning message
     * @param data Additional data
     */
    warn(message: string, data?: any): void {
      if (!shouldLog(LogLevel.WARN)) {
        return;
      }
      
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: LogLevel.WARN,
        source,
        message,
        requestId: currentRequestId,
        data
      };
      
      console.warn(formatLogEntry(entry));
    },
    
    /**
     * Log info message
     * @param message Info message
     * @param data Additional data
     */
    info(message: string, data?: any): void {
      if (!shouldLog(LogLevel.INFO)) {
        return;
      }
      
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: LogLevel.INFO,
        source,
        message,
        requestId: currentRequestId,
        data
      };
      
      console.info(formatLogEntry(entry));
    },
    
    /**
     * Log debug message
     * @param message Debug message
     * @param data Additional data
     */
    debug(message: string, data?: any): void {
      if (!shouldLog(LogLevel.DEBUG)) {
        return;
      }
      
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: LogLevel.DEBUG,
        source,
        message,
        requestId: currentRequestId,
        data
      };
      
      console.debug(formatLogEntry(entry));
    },
    
    /**
     * Log trace message
     * @param message Trace message
     * @param data Additional data
     */
    trace(message: string, data?: any): void {
      if (!shouldLog(LogLevel.TRACE)) {
        return;
      }
      
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: LogLevel.TRACE,
        source,
        message,
        requestId: currentRequestId,
        data
      };
      
      console.debug(formatLogEntry(entry));
    }
  };
}

// Create default logger
export const logger = createLogger('app');

/**
 * Create middleware for request logging
 * @returns Express middleware for request logging
 */
export function createRequestLogger() {
  const requestLogger = createLogger('http');
  
  return (req: any, res: any, next: Function) => {
    // Generate request ID if not exists
    const requestId = req.headers['x-request-id'] || 
                     req.headers['x-correlation-id'] || 
                     `req-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    // Set request ID for context
    setRequestId(requestId);
    
    // Add request ID to response headers
    res.setHeader('X-Request-ID', requestId);
    
    // Log request
    requestLogger.info(`${req.method} ${req.url}`, {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    // Track response time
    const startTime = Date.now();
    
    // Capture response
    const originalEnd = res.end;
    res.end = function(chunk: any, encoding: string) {
      // Restore original end
      res.end = originalEnd;
      
      // Calculate response time
      const responseTime = Date.now() - startTime;
      
      // Log response
      requestLogger.info(`${req.method} ${req.url} ${res.statusCode} ${responseTime}ms`, {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        responseTime
      });
      
      // Clear request ID
      clearRequestId();
      
      // Call original end
      return originalEnd.call(this, chunk, encoding);
    };
    
    next();
  };
}