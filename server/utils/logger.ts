/**
 * Logging Utility
 * 
 * This module provides consistent logging functionality throughout the application
 * with contextual information and standardized format.
 */
import { createLogger as createWinstonLogger, format, transports, Logger } from 'winston';

// Log levels
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
  trace: 5,
};

// Determine the appropriate level based on environment
const getLogLevel = (): string => {
  const env = process.env.NODE_ENV || 'development';
  
  // Use more verbose logging in development
  return env === 'production' ? 'info' : 'debug';
};

// Format for console output
const consoleFormat = format.combine(
  format.colorize({ all: true }),
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(({ level, message, timestamp, module, ...meta }) => {
    // Add module context if available
    const modulePrefix = module ? `[${module}] ` : '';
    
    // Handle objects and errors in the message
    let formattedMessage = message;
    const metaString = Object.keys(meta).length > 0 
      ? `\n${JSON.stringify(meta, null, 2)}` 
      : '';
    
    return `${timestamp} ${level}: ${modulePrefix}${formattedMessage}${metaString}`;
  })
);

// Format for file output (more structured for potential log analysis)
const fileFormat = format.combine(
  format.timestamp(),
  format.json()
);

// Create the base Winston logger
const winstonLogger = createWinstonLogger({
  levels: LOG_LEVELS,
  level: getLogLevel(),
  transports: [
    // Console transport
    new transports.Console({
      format: consoleFormat,
    }),
    // File transport for errors and above
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // File transport for all logs
    new transports.File({
      filename: 'logs/combined.log',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  // Don't exit on uncaught exceptions, just log them
  exitOnError: false,
});

/**
 * Create a logger for a specific module
 * 
 * @param moduleName - Name of the module using the logger
 * @returns Logger instance
 */
export function createLogger(moduleName: string): Logger {
  return winstonLogger.child({ module: moduleName });
}

/**
 * Get the root logger instance
 * 
 * @returns Root logger instance
 */
export function getRootLogger(): Logger {
  return winstonLogger;
}

// Create a default logger for direct use
export const logger = createLogger('app');

// Export the Winston logger for advanced use cases
export { winstonLogger };

/**
 * Create an Express middleware to log requests
 * 
 * @returns Request logging middleware
 */
export function createRequestLogger() {
  const httpLogger = createLogger('http');
  
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    const { method, url, ip } = req;
    
    // Log on response finish
    res.on('finish', () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      
      httpLogger.info(`${method} ${url} ${status} ${duration}ms`, {
        method,
        url,
        status,
        duration,
        ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id
      });
    });
    
    next();
  };
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received, shutting down logger');
  winstonLogger.close();
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received, shutting down logger');
  winstonLogger.close();
});

export default logger;