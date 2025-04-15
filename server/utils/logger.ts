/**
 * Application Logging Utility
 * 
 * This module provides structured logging capabilities for the application,
 * with consistent formatting, log levels, and contextual information.
 */
import { randomUUID } from 'crypto';

// Log levels with numeric values for comparison
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

// String representation of log levels
const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.TRACE]: 'TRACE'
};

// Logger configuration
interface LoggerConfig {
  level: LogLevel;
  redactedFields: string[];
  prettyPrint: boolean;
}

// Default configuration
const defaultConfig: LoggerConfig = {
  level: process.env.LOG_LEVEL ? parseLogLevel(process.env.LOG_LEVEL) : LogLevel.INFO,
  redactedFields: ['password', 'token', 'secret', 'key', 'authorization'],
  prettyPrint: process.env.NODE_ENV !== 'production'
};

// Global logger configuration
let globalConfig: LoggerConfig = { ...defaultConfig };

// Request ID storage for linking logs from the same request
const requestIdStorage = new Map<number, string>();

/**
 * Parse a log level string to LogLevel enum
 * 
 * @param level - Log level string
 * @returns LogLevel enum value
 */
export function parseLogLevel(level: string): LogLevel {
  switch (level.toUpperCase()) {
    case 'ERROR': return LogLevel.ERROR;
    case 'WARN': return LogLevel.WARN;
    case 'INFO': return LogLevel.INFO;
    case 'DEBUG': return LogLevel.DEBUG;
    case 'TRACE': return LogLevel.TRACE;
    default: return LogLevel.INFO;
  }
}

/**
 * Configure the global logger
 * 
 * @param config - Logger configuration
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  globalConfig = { ...globalConfig, ...config };
}

/**
 * Get the current logger configuration
 * 
 * @returns Current logger configuration
 */
export function getLoggerConfig(): LoggerConfig {
  return { ...globalConfig };
}

/**
 * Set the current request ID for the current async context
 * 
 * @param requestId - Request ID
 */
export function setRequestId(requestId: string): void {
  requestIdStorage.set(getAsyncId(), requestId);
}

/**
 * Get the current request ID for the current async context
 * 
 * @returns Current request ID or undefined if not set
 */
export function getRequestId(): string | undefined {
  return requestIdStorage.get(getAsyncId());
}

/**
 * Clear the current request ID for the current async context
 */
export function clearRequestId(): void {
  requestIdStorage.delete(getAsyncId());
}

/**
 * Get an ID for the current async execution context
 * 
 * @returns Numeric ID for the current async context
 */
function getAsyncId(): number {
  // In a real implementation, we would use AsyncLocalStorage
  // For simplicity, we'll just return a fixed value
  return 1;
}

/**
 * Interface for a logger instance
 */
export interface Logger {
  error(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  info(message: string, data?: any): void;
  debug(message: string, data?: any): void;
  trace(message: string, data?: any): void;
}

/**
 * Create a new logger instance
 * 
 * @param source - Source of the logs (module name, class name, etc.)
 * @returns Logger instance
 */
export function createLogger(source: string): Logger {
  return {
    error: (message: string, data?: any) => log(LogLevel.ERROR, source, message, data),
    warn: (message: string, data?: any) => log(LogLevel.WARN, source, message, data),
    info: (message: string, data?: any) => log(LogLevel.INFO, source, message, data),
    debug: (message: string, data?: any) => log(LogLevel.DEBUG, source, message, data),
    trace: (message: string, data?: any) => log(LogLevel.TRACE, source, message, data)
  };
}

/**
 * Log a message at the specified level
 * 
 * @param level - Log level
 * @param source - Source of the log
 * @param message - Log message
 * @param data - Additional data to log
 */
function log(level: LogLevel, source: string, message: string, data?: any): void {
  // Skip if log level is higher than configured level
  if (level > globalConfig.level) {
    return;
  }

  const timestamp = new Date().toISOString();
  const requestId = getRequestId();
  
  // Basic log entry
  const logEntry: Record<string, any> = {
    timestamp,
    level: LOG_LEVEL_NAMES[level],
    source,
    message
  };
  
  // Add request ID if available
  if (requestId) {
    logEntry.requestId = requestId;
  }
  
  // Add data if provided
  if (data !== undefined) {
    // Clone data to avoid modifying the original
    const safeData = typeof data === 'object' && data !== null
      ? JSON.parse(JSON.stringify(data))
      : { value: data };
    
    // Redact sensitive fields
    redactSensitiveFields(safeData, globalConfig.redactedFields);
    
    logEntry.data = safeData;
  }
  
  // Output logs
  if (globalConfig.prettyPrint) {
    outputPrettyLog(level, logEntry);
  } else {
    outputJsonLog(logEntry);
  }
}

/**
 * Recursively redact sensitive fields in an object
 * 
 * @param obj - Object to redact
 * @param fieldsToRedact - Fields to redact
 */
function redactSensitiveFields(obj: any, fieldsToRedact: string[]): void {
  if (typeof obj !== 'object' || obj === null) {
    return;
  }
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Check if this field should be redacted
      const shouldRedact = fieldsToRedact.some(field => 
        key.toLowerCase().includes(field.toLowerCase())
      );
      
      if (shouldRedact && typeof obj[key] === 'string') {
        // Redact the value
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        // Recursively check nested objects
        redactSensitiveFields(obj[key], fieldsToRedact);
      }
    }
  }
}

/**
 * Output a log entry as JSON
 * 
 * @param logEntry - Log entry to output
 */
function outputJsonLog(logEntry: Record<string, any>): void {
  console.log(JSON.stringify(logEntry));
}

/**
 * Output a log entry in a pretty format
 * 
 * @param level - Log level
 * @param logEntry - Log entry to output
 */
function outputPrettyLog(level: LogLevel, logEntry: Record<string, any>): void {
  // Colors for different log levels (ANSI escape codes)
  const colors = {
    [LogLevel.ERROR]: '\x1b[31m', // Red
    [LogLevel.WARN]: '\x1b[33m',  // Yellow
    [LogLevel.INFO]: '\x1b[36m',  // Cyan
    [LogLevel.DEBUG]: '\x1b[35m', // Magenta
    [LogLevel.TRACE]: '\x1b[90m', // Grey
  };
  
  const reset = '\x1b[0m';
  const color = colors[level];
  
  // Format: [TIME] LEVEL (SOURCE): MESSAGE requestId=REQ_ID
  let logString = `${color}[${logEntry.timestamp}] ${logEntry.level} (${logEntry.source}): ${logEntry.message}${reset}`;
  
  // Add request ID if available
  if (logEntry.requestId) {
    logString += ` ${color}requestId=${logEntry.requestId}${reset}`;
  }
  
  // Add data if available
  if (logEntry.data) {
    logString += `\n${JSON.stringify(logEntry.data, null, 2)}`;
  }
  
  // Output to console (use console.error for ERROR level)
  if (level === LogLevel.ERROR) {
    console.error(logString);
  } else {
    console.log(logString);
  }
}

/**
 * Generate a new request ID
 * 
 * @returns New request ID
 */
export function generateRequestId(): string {
  return `req-${Date.now()}-${randomUUID().substring(0, 8)}`;
}

// Create a default logger for general use
export const logger = createLogger('app');