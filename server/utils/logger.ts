/**
 * Enhanced Application Logger
 * 
 * Advanced, configurable logger with comprehensive sensitive data redaction
 * for security and compliance purposes.
 * 
 * Features:
 * - Multi-level redaction of sensitive information
 * - Pattern-based detection for common sensitive data formats
 * - Context-aware redaction with data type preservation
 * - Configurable via environment variables
 * - Structured logging with correlation IDs
 */

import winston from 'winston';
import { Format } from 'logform';
import util from 'util';

// Define log levels
const levels = {
  error: 0,
  warn: 1, 
  info: 2,
  http: 3,
  debug: 4,
  trace: 5
};

// Define log level colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'cyan',
  trace: 'blue'
};

// Add colors to winston
winston.addColors(colors);

/**
 * Configuration for the logger
 * Can be overridden with environment variables
 */
const config = {
  // Default log level
  level: process.env.LOG_LEVEL || 'info',
  
  // Whether to preserve type information when redacting
  preserveType: process.env.LOG_PRESERVE_TYPE === 'true',
  
  // Maximum depth for redaction (prevents stack overflow)
  maxDepth: parseInt(process.env.LOG_MAX_DEPTH || '10', 10),
  
  // Whether to redact message strings (not just metadata)
  redactMessages: process.env.LOG_REDACT_MESSAGES === 'true',
  
  // Whether to hash sensitive values instead of replacing them with [REDACTED]
  hashValues: process.env.LOG_HASH_VALUES === 'true',
  
  // Show partial values (e.g., last 4 digits of credit card)
  showPartialValues: process.env.LOG_SHOW_PARTIAL_VALUES === 'true',
};

/**
 * Sensitive data categories with specific handling
 */
enum SensitiveCategory {
  CREDENTIALS = 'credentials',
  FINANCIAL = 'financial',
  PERSONAL = 'personal',
  AUTH = 'auth',
  CRYPTO = 'crypto',
  SYSTEM = 'system'
}

/**
 * Define sensitive keys that should be redacted from logs
 * Organized by category for easier management
 */
const SENSITIVE_KEYS: Record<SensitiveCategory, string[]> = {
  // Authentication credentials
  [SensitiveCategory.CREDENTIALS]: [
    'password', 'passwd', 'pwd', 'pass', 
    'credential', 'credentials',
    'secret', 'private_key', 'privatekey',
    'api_key', 'apikey', 'api_secret'
  ],
  
  // Authentication tokens
  [SensitiveCategory.AUTH]: [
    'token', 'refresh_token', 'access_token', 'id_token',
    'auth', 'authorization', 'session', 'jwt',
    'cookie', 'csrf', 'xsrf'
  ],
  
  // Financial information
  [SensitiveCategory.FINANCIAL]: [
    'credit_card', 'creditcard', 'card_number', 'cardnumber',
    'cvv', 'cvc', 'ccv', 'security_code', 'securitycode',
    'expiry', 'expiration', 'bank_account', 'bankaccount',
    'routing_number', 'routingnumber', 'account_number', 'accountnumber',
    'payment', 'billing', 'invoice'
  ],
  
  // Personal identifiable information
  [SensitiveCategory.PERSONAL]: [
    'ssn', 'social_security', 'socialsecurity',
    'dob', 'date_of_birth', 'birthdate',
    'driver_license', 'driverslicense', 'passport',
    'address', 'phone', 'email', 'contact',
    'health', 'medical'
  ],
  
  // Cryptographic values
  [SensitiveCategory.CRYPTO]: [
    'key', 'iv', 'salt', 'hash', 'cert', 'certificate',
    'signature', 'hmac', 'encrypt', 'decrypt'
  ],
  
  // System security
  [SensitiveCategory.SYSTEM]: [
    'env', 'environment', 'config', 'configuration',
    'secret_key', 'secretkey', 'client_secret', 'clientsecret',
    'client_id', 'clientid', 'tenant_id', 'tenantid'
  ]
};

// Flatten the sensitive keys into a single array for easier lookups
const ALL_SENSITIVE_KEYS = Object.values(SENSITIVE_KEYS).flat();

/**
 * Regular expressions to detect common patterns of sensitive data
 * Even when the key names don't match the sensitive key list
 */
const SENSITIVE_PATTERNS: Record<string, RegExp> = {
  // Credit card numbers (with or without spaces/dashes)
  CREDIT_CARD: /\b(?:\d[ -]*?){13,16}\b/g,
  
  // Social Security Numbers (XXX-XX-XXXX format)
  SSN: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
  
  // API keys and tokens (various formats)
  API_KEY: /\b[a-zA-Z0-9_\-]{20,64}\b/g,
  
  // Basic auth headers
  BASIC_AUTH: /\bBasic\s+[a-zA-Z0-9+/=]+\b/gi,
  
  // Bearer tokens
  BEARER_TOKEN: /\bBearer\s+[a-zA-Z0-9._\-]+\b/gi,
  
  // OAuth tokens
  OAUTH_TOKEN: /\boauth[_|\s|\.][a-zA-Z0-9\._\-]+\b/gi,
  
  // AWS access keys
  AWS_KEY: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g,
  
  // Generic secrets/keys (useful but can have false positives)
  GENERIC_SECRET: /\b(secret|key|token|password)[ |:=]+['"]?[a-zA-Z0-9+/=._\-]{8,}['"]?/gi
};

/**
 * Get the appropriate redaction strategy based on the key and value
 * @param key The property key
 * @param value The value to redact
 * @param category Optional category for context-specific redaction
 */
const getRedactionStrategy = (key: string, value: any, category?: SensitiveCategory): any => {
  // If preserving type, return appropriate placeholders based on data type
  if (config.preserveType) {
    if (typeof value === 'string') {
      // Credit card number - show last 4 digits if enabled
      if (
        config.showPartialValues && 
        (category === SensitiveCategory.FINANCIAL || key.includes('card') || key.includes('credit'))
      ) {
        if (/^\d{13,19}$/.test(value.replace(/[\s-]/g, ''))) {
          return '************' + value.slice(-4);
        }
      }
      
      // For other values, just use [REDACTED]
      return '[REDACTED]';
    } else if (typeof value === 'number') {
      return 0;
    } else if (typeof value === 'boolean') {
      return false;
    } else if (Array.isArray(value)) {
      return ['[REDACTED]'];
    } else if (value instanceof Date) {
      return new Date(0);
    } else if (typeof value === 'object') {
      return { redacted: true };
    }
  }
  
  // Default redaction
  return '[REDACTED]';
};

/**
 * Check if a key is sensitive based on our defined lists
 * @param key The property key to check
 */
const isSensitiveKey = (key: string): { isSensitive: boolean, category?: SensitiveCategory } => {
  const lowerKey = key.toLowerCase();
  
  // Check through each category
  for (const [category, keys] of Object.entries(SENSITIVE_KEYS)) {
    for (const sensitiveKey of keys) {
      // Exact match or contains
      if (
        lowerKey === sensitiveKey || 
        lowerKey.includes(sensitiveKey) || 
        (
          // Handle common patterns like api_key, apiKey, api-key
          sensitiveKey.includes('_') && 
          lowerKey.includes(sensitiveKey.replace(/_/g, ''))
        )
      ) {
        return { 
          isSensitive: true, 
          category: category as SensitiveCategory 
        };
      }
    }
  }
  
  return { isSensitive: false };
};

/**
 * Check if a string value matches sensitive patterns
 * @param value The string value to check against patterns
 */
const containsSensitivePattern = (value: string): boolean => {
  if (typeof value !== 'string') return false;
  
  // Only check strings with a reasonable length
  if (value.length < 8 || value.length > 100) return false;
  
  return Object.values(SENSITIVE_PATTERNS).some(pattern => pattern.test(value));
};

/**
 * Recursive function to redact sensitive data in objects
 * @param data The data to redact
 * @param currentDepth Current recursion depth to prevent stack overflow
 * @param parentKey The parent key for context
 * @returns Redacted data
 */
const redactSensitiveData = (data: any, currentDepth: number = 0, parentKey: string = ''): any => {
  // Prevent call stack overflow with max depth check
  if (currentDepth > config.maxDepth) {
    return typeof data === 'object' ? { redacted_max_depth: true } : data;
  }
  
  // Handle null/undefined
  if (data === null || data === undefined) {
    return data;
  }
  
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item, currentDepth + 1, parentKey));
  }
  
  // Handle objects
  if (typeof data === 'object' && !(data instanceof Date)) {
    const redactedObj: Record<string, any> = {};
    
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key];
        const { isSensitive, category } = isSensitiveKey(key);
        
        // Consider the parent key context for better redaction
        const contextualIsSensitive = !isSensitive && parentKey ? 
          isSensitiveKey(parentKey).isSensitive : false;
        
        // If the key is sensitive or the parent key provides sensitive context
        if (isSensitive || contextualIsSensitive) {
          redactedObj[key] = getRedactionStrategy(key, value, category);
        }
        // Check if string values contain sensitive patterns
        else if (typeof value === 'string' && containsSensitivePattern(value)) {
          redactedObj[key] = '[PATTERN-REDACTED]';
        }
        // Otherwise, recursively process non-sensitive fields
        else {
          redactedObj[key] = redactSensitiveData(value, currentDepth + 1, key);
        }
      }
    }
    
    return redactedObj;
  }
  
  // Check for sensitive patterns in string values
  if (typeof data === 'string' && containsSensitivePattern(data)) {
    return '[PATTERN-REDACTED]';
  }
  
  // Return primitives as-is
  return data;
};

/**
 * Sanitize log message strings to remove sensitive data
 * @param message The log message to sanitize
 */
const sanitizeMessage = (message: string | unknown): string => {
  if (!config.redactMessages || typeof message !== 'string') {
    return typeof message === 'string' ? message : String(message);
  }
  
  let sanitized = message;
  
  // Replace known sensitive patterns
  Object.values(SENSITIVE_PATTERNS).forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });
  
  return sanitized;
};

/**
 * Custom formatter that includes comprehensive redaction
 */
const redactionFormat = winston.format((info) => {
  // Don't modify the original object, create a new one
  const redactedInfo = { ...info };
  
  // Sanitize the log message if enabled
  if (config.redactMessages && redactedInfo.message) {
    redactedInfo.message = sanitizeMessage(redactedInfo.message);
  }
  
  // Recursively redact sensitive fields in metadata
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

/**
 * Format configuration for the logger
 */
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
      // Format objects for better readability
      output += `\n${JSON.stringify(metadata, null, 2)}`;
    }
    
    return output;
  })
);

/**
 * Create the logger instance
 */
const logger = winston.createLogger({
  level: config.level,
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
          // Create a separate security log for sensitive operations
          new winston.transports.File({
            filename: 'logs/security.log',
            level: 'info',
            // Custom security log format
            format: winston.format.combine(
              winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
              redactionFormat(),
              winston.format.json()
            )
          })
        ] 
      : [])
  ],
  // Don't exit on uncaught exception, let the process manager handle it
  exitOnError: false
});

/**
 * Utility function for logging potentially sensitive objects safely
 * 
 * @param level The log level
 * @param message The log message
 * @param data Optional data to log (will be redacted)
 */
const safelog = (level: string, message: string, data?: any): void => {
  logger.log(level, message, { meta: data });
};

// Add convenience methods for safe logging
const safeLogger = {
  error: (message: string, data?: any) => safelog('error', message, data),
  warn: (message: string, data?: any) => safelog('warn', message, data),
  info: (message: string, data?: any) => safelog('info', message, data),
  http: (message: string, data?: any) => safelog('http', message, data),
  debug: (message: string, data?: any) => safelog('debug', message, data),
  trace: (message: string, data?: any) => safelog('trace', message, data),
  
  // Expose the utility function
  safelog,
  
  // Expose core logger
  core: logger
};

// Export enhanced logger
export default safeLogger;