/**
 * Application Logger
 * 
 * Configurable logger with redaction of sensitive data for security
 */

import winston from 'winston';
import { Format } from 'logform';

// Define log levels
const levels = {
  error: 0,
  warn: 1, 
  info: 2,
  http: 3,
  debug: 4,
};

// Define log level colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(colors);

// Define sensitive keys that should be redacted from logs
const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'key',
  'auth',
  'credential',
  'api_key',
  'apiKey',
  'access_token',
  'refresh_token',
  'credit_card',
  'cvv',
  'ssn',
  'cookie',
];

/**
 * Recursive function to redact sensitive data in objects
 * @param data The data to redact
 * @returns Redacted data
 */
const redactSensitiveData = (data: any): any => {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle different data types appropriately
  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item));
  }

  if (typeof data === 'object') {
    const redactedObj: Record<string, any> = {};

    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        // Check if the key contains any sensitive keywords
        const isSensitive = SENSITIVE_KEYS.some(
          sensitiveKey => key.toLowerCase().includes(sensitiveKey.toLowerCase())
        );

        if (isSensitive) {
          // Redact sensitive data but preserve type information
          if (typeof data[key] === 'string') {
            redactedObj[key] = '[REDACTED]';
          } else if (typeof data[key] === 'number') {
            redactedObj[key] = 0;
          } else if (Array.isArray(data[key])) {
            redactedObj[key] = ['[REDACTED]'];
          } else if (typeof data[key] === 'object') {
            redactedObj[key] = { redacted: true };
          } else {
            redactedObj[key] = '[REDACTED]';
          }
        } else {
          // Recursively process non-sensitive fields
          redactedObj[key] = redactSensitiveData(data[key]);
        }
      }
    }

    return redactedObj;
  }

  // Return primitives as-is
  return data;
};

// Custom format that includes redaction
const redactionFormat = winston.format((info) => {
  // Don't modify the original object, create a new one
  const redactedInfo = { ...info };
  
  // Recursively redact sensitive fields
  if (redactedInfo.meta) {
    redactedInfo.meta = redactSensitiveData(redactedInfo.meta);
  }
  
  // Handle additional metadata
  for (const key in redactedInfo) {
    if (key !== 'level' && key !== 'message' && key !== 'timestamp' && key !== 'meta') {
      redactedInfo[key] = redactSensitiveData(redactedInfo[key]);
    }
  }
  
  return redactedInfo;
});

// Define log format
const formatConfig: Format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  redactionFormat(),
  winston.format.json(),
  winston.format.printf((info) => {
    // Basic formatting
    let output = `${info.timestamp} ${info.level}: ${info.message}`;
    
    // Add metadata if present
    const metadata = { ...info } as Record<string, any>;
    delete metadata.timestamp;
    delete metadata.level;
    delete metadata.message;
    
    // Only include metadata if it's not empty
    if (Object.keys(metadata).length > 0) {
      output += `\n${JSON.stringify(metadata, null, 2)}`;
    }
    
    return output;
  })
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: formatConfig,
  transports: [
    // Console logging
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        formatConfig
      ),
    }),
    
    // Add file logging for production
    ...(process.env.NODE_ENV === 'production' 
      ? [
          // Error log
          new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error' 
          }),
          // Combined log
          new winston.transports.File({ 
            filename: 'logs/combined.log' 
          }),
        ] 
      : [])
  ],
});

// Export the logger
export default logger;