# Error Handling & Debugging Standards for Payymo

This document outlines our approach to error handling, logging, debugging, and monitoring for the Payymo financial platform. Given the critical nature of financial applications, robust error handling is essential to ensure system reliability, security, and maintainability.

## 1. Structured Logging Framework

### Log Format & Structure

All logs must follow a consistent JSON structure with these core fields:

```json
{
  "timestamp": "2025-04-14T12:34:56.789Z",
  "level": "info",
  "message": "User authenticated successfully",
  "context": {
    "request_id": "3f9a2b7c-1a2b-3c4d-5e6f-7g8h9i0j1k2l",
    "tenant_id": "tenant_123",
    "user_id": "user_456",
    "operation": "userAuthentication",
    "path": "/api/v1/auth/login",
    "method": "POST",
    "duration_ms": 245
  }
}
```

### Log Levels

Logs should use appropriate severity levels:

| Level | Usage |
|-------|-------|
| ERROR | Unrecoverable errors, critical failures, security incidents |
| WARN | Recoverable issues, potential problems, expected edge cases |
| INFO | Key application events (startup, connections, operations) |
| DEBUG | Detailed diagnostic information (dev environments only) |

### Required Context Fields

| Field | Description | Required? |
|-------|-------------|-----------|
| request_id | Unique identifier for request correlation | Always |
| tenant_id | Multi-tenant identifier | Always in authenticated context |
| user_id | User identifier (if known) | When available |
| operation | Name of function or operation | Always |
| component | Module, service, or component name | Always |
| duration_ms | Operation duration in milliseconds | For timed operations |
| http_status | HTTP status code (for API responses) | For all API calls |
| error_code | Application-specific error code | For ERROR level |
| stack_trace | Error stack trace | For ERROR level |

### Implementation in Flask

```python
# utils/logger.py
import logging
import json
import time
import uuid
from flask import request, g, has_request_context
from datetime import datetime

class StructuredLogger:
    def __init__(self, app=None):
        self.app = app
        if app is not None:
            self.init_app(app)
            
    def init_app(self, app):
        self.app = app
        app.logger.setLevel(logging.INFO)
        
    def get_context(self):
        """Gather context data from request and g object"""
        context = {
            "component": "payymo-api"
        }
        
        # Add request context if available
        if has_request_context():
            context.update({
                "request_id": getattr(g, "request_id", str(uuid.uuid4())),
                "path": request.path,
                "method": request.method
            })
            
            # Add tenant and user info if authenticated
            if hasattr(g, "tenant_id"):
                context["tenant_id"] = g.tenant_id
            if hasattr(g, "user_id"):
                context["user_id"] = g.user_id
                
        return context
        
    def _log(self, level, message, **kwargs):
        """Create structured log entry"""
        # Get base context
        context = self.get_context()
        
        # Add additional context from kwargs
        context.update(kwargs)
        
        # Create log entry
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": level,
            "message": message,
            "context": context
        }
        
        # Convert to JSON string
        json_log = json.dumps(log_entry)
        
        # Log at appropriate level
        if level == "error":
            self.app.logger.error(json_log)
        elif level == "warn":
            self.app.logger.warning(json_log)
        elif level == "info":
            self.app.logger.info(json_log)
        elif level == "debug":
            self.app.logger.debug(json_log)
            
    def info(self, message, **kwargs):
        self._log("info", message, **kwargs)
        
    def error(self, message, **kwargs):
        self._log("error", message, **kwargs)
        
    def warn(self, message, **kwargs):
        self._log("warn", message, **kwargs)
        
    def debug(self, message, **kwargs):
        self._log("debug", message, **kwargs)
        
    # Specialized helper methods
    def log_api_request_start(self):
        """Log the start of an API request"""
        self.info("API request started", operation="api_request_start")
        
    def log_api_request_end(self, status_code, duration_ms):
        """Log the completion of an API request"""
        level = "error" if status_code >= 500 else "warn" if status_code >= 400 else "info"
        self._log(level, "API request completed", 
                 http_status=status_code, 
                 duration_ms=duration_ms,
                 operation="api_request_end")
        
    def log_exception(self, exception, **kwargs):
        """Log an exception with stack trace"""
        import traceback
        stack_trace = traceback.format_exc()
        self.error(str(exception), 
                  stack_trace=stack_trace,
                  error_type=exception.__class__.__name__,
                  **kwargs)
```

### Request Logging Middleware

```python
# app.py
import time
import uuid
from flask import g, request

@app.before_request
def before_request():
    # Set request start time
    g.request_start_time = time.time()
    
    # Generate or capture request ID
    g.request_id = request.headers.get('X-Request-ID', str(uuid.uuid4()))
    
    # Log request start
    logger.log_api_request_start()

@app.after_request
def after_request(response):
    # Calculate request duration
    duration_ms = int((time.time() - g.request_start_time) * 1000)
    
    # Add request ID to response headers
    response.headers['X-Request-ID'] = g.request_id
    
    # Log request completion
    logger.log_api_request_end(response.status_code, duration_ms)
    
    return response
```

## 2. Error Correlation System

### Request ID Generation and Propagation

Every request in the system must be traceable end-to-end using a unique request ID:

1. **Generation Point**: Generate UUID at the earliest point (edge, API gateway, or frontend)
2. **HTTP Header**: Propagate as `X-Request-ID` HTTP header
3. **Logging**: Include in all log entries related to the request
4. **Response**: Return to client in response headers
5. **User Interface**: Show in error messages for support reference

### Implementation

```python
# Frontend (JavaScript)
function makeApiCall(endpoint, method, data) {
    // Generate request ID if not already present
    const requestId = this.currentRequestId || uuidv4();
    this.currentRequestId = requestId;
    
    // Log request start with request ID
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        message: `API call to ${method} ${endpoint}`,
        context: {
            request_id: requestId,
            component: "frontend",
            operation: "api_call"
        }
    }));
    
    // Make API call with request ID header
    return fetch(endpoint, {
        method,
        headers: {
            'X-Request-ID': requestId,
            'Content-Type': 'application/json'
        },
        body: data ? JSON.stringify(data) : undefined
    }).then(response => {
        // Log response
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: response.ok ? "info" : "error",
            message: `API ${response.ok ? 'success' : 'error'}: ${method} ${endpoint}`,
            context: {
                request_id: requestId,
                http_status: response.status,
                component: "frontend",
                operation: "api_response"
            }
        }));
        
        return response;
    });
}
```

## 3. Exception Handling

### Custom Exception Hierarchy

```python
# utils/exceptions.py
class PayymoException(Exception):
    """Base exception for Payymo application"""
    status_code = 500
    error_code = "internal_error"
    
    def __init__(self, message=None, error_code=None, status_code=None):
        self.message = message or "An unexpected error occurred"
        if error_code:
            self.error_code = error_code
        if status_code:
            self.status_code = status_code
        super().__init__(self.message)
        
    def to_dict(self):
        """Convert exception to a dictionary for response serialization"""
        return {
            "error": {
                "code": self.error_code,
                "message": self.message
            }
        }

class ResourceNotFoundException(PayymoException):
    """Exception for resources not found"""
    status_code = 404
    error_code = "resource_not_found"
    
    def __init__(self, resource_type=None, resource_id=None):
        message = f"{resource_type} with ID {resource_id} not found" if resource_type and resource_id else "Resource not found"
        super().__init__(message)

class ValidationException(PayymoException):
    """Exception for validation errors"""
    status_code = 400
    error_code = "validation_error"
    
    def __init__(self, message="Validation error", errors=None):
        super().__init__(message)
        self.errors = errors or []
        
    def to_dict(self):
        result = super().to_dict()
        if self.errors:
            result["error"]["details"] = self.errors
        return result

class AuthenticationException(PayymoException):
    """Exception for authentication failures"""
    status_code = 401
    error_code = "authentication_error"

class AuthorizationException(PayymoException):
    """Exception for authorization failures"""
    status_code = 403
    error_code = "authorization_error"

class ExternalServiceException(PayymoException):
    """Exception for external service failures"""
    status_code = 502
    error_code = "external_service_error"
    
    def __init__(self, service_name, message=None):
        super().__init__(message or f"Error communicating with {service_name}")
        self.service_name = service_name
        
    def to_dict(self):
        result = super().to_dict()
        result["error"]["service"] = self.service_name
        return result
```

### Global Exception Handler

```python
# app.py
@app.errorhandler(PayymoException)
def handle_payymo_exception(error):
    """Handle custom exceptions"""
    # Log the error
    logger.error(error.message, 
                error_code=error.error_code, 
                error_type=error.__class__.__name__)
    
    # Return formatted response
    response = jsonify(error.to_dict())
    response.status_code = error.status_code
    return response

@app.errorhandler(Exception)
def handle_unexpected_error(error):
    """Handle unexpected exceptions"""
    # Log the error with stack trace
    logger.log_exception(error, operation="unhandled_exception")
    
    # Return generic error response
    response = jsonify({
        "error": {
            "code": "internal_error",
            "message": "An unexpected error occurred",
            "reference": g.request_id if hasattr(g, "request_id") else None
        }
    })
    response.status_code = 500
    return response
```

## 4. User-Facing Error Messages

### Error Response Format

All API error responses should follow this format:

```json
{
  "error": {
    "code": "resource_not_found",
    "message": "Transaction with ID tr_123456 not found",
    "reference": "3f9a2b7c-1a2b-3c4d-5e6f-7g8h9i0j1k2l",
    "details": [
      {
        "field": "transaction_id",
        "message": "No transaction with this ID exists"
      }
    ]
  }
}
```

### Error Message Guidelines

1. **User-Friendly**: Error messages should be understandable by non-technical users
2. **Actionable**: Suggest what the user can do to resolve the issue
3. **Reference ID**: Include the request ID for support reference
4. **No Technical Details**: Don't expose stack traces, code references, or database error messages to users
5. **Field-Level Validation**: For validation errors, specify which fields failed and why

## 5. Debugging Tools and Techniques

### Local Development

- Use Flask's debug mode during development
- Enable SQLAlchemy query logging for database troubleshooting
- Use flask-debugtoolbar for request inspection
- Set up comprehensive logging in development

```python
# Development configuration
app.config["DEBUG"] = True
app.config["SQLALCHEMY_ECHO"] = True
logging.basicConfig(level=logging.DEBUG)
```

### Production Debugging

- Never enable debug mode in production
- Use transaction ID to correlate logs
- Implement database query timing monitoring
- Add performance tracking for critical operations

```python
# Transaction timing decorator
def timed_operation(operation_name):
    def decorator(f):
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = f(*args, **kwargs)
                duration_ms = int((time.time() - start_time) * 1000)
                logger.info(f"{operation_name} completed", 
                           operation=operation_name,
                           duration_ms=duration_ms)
                return result
            except Exception as e:
                duration_ms = int((time.time() - start_time) * 1000)
                logger.error(f"{operation_name} failed",
                            operation=operation_name,
                            duration_ms=duration_ms,
                            error=str(e))
                raise
        return wrapper
    return decorator

# Usage
@timed_operation("bank_transaction_sync")
def sync_bank_transactions(connection_id):
    # Implementation
    pass
```

## 6. Monitoring and Alerting

### Key Metrics to Monitor

1. **Error Rates**: Track errors by type, endpoint, and tenant
2. **Response Times**: Monitor API endpoint performance
3. **External Service Health**: Track success rates of external API calls
4. **Authentication Failures**: Monitor failed login attempts
5. **Database Performance**: Track query execution times
6. **Resource Usage**: Monitor CPU, memory, and disk usage

### Alert Thresholds

| Metric | Warning Threshold | Critical Threshold | Action |
|--------|-------------------|-------------------|--------|
| 5xx Error Rate | >1% of requests | >5% of requests | Immediate investigation |
| API Response Time | >1000ms average | >3000ms average | Performance review |
| Failed External API Calls | >5% failure rate | >20% failure rate | Service status check |
| Authentication Failures | >10 per minute for a tenant | >50 per minute for a tenant | Security alert |
| Database Query Time | >500ms average | >2000ms average | Query optimization |

### Implementation

- Use a monitoring service like Datadog, New Relic, or Sentry
- Configure alerting to appropriate channels (email, Slack, etc.)
- Set up dashboards for key metrics
- Implement health check endpoints for each service

```python
# health.py
@app.route('/health/live', methods=['GET'])
def liveness_check():
    """Basic health check to verify service is running"""
    return jsonify({"status": "ok"})

@app.route('/health/ready', methods=['GET'])
def readiness_check():
    """Check if service is ready to handle requests"""
    # Check database connection
    try:
        db.session.execute('SELECT 1')
        db_status = "ok"
    except Exception as e:
        db_status = "error"
        
    # Check external services
    try:
        gocardless_service.check_health()
        gocardless_status = "ok"
    except Exception as e:
        gocardless_status = "error"
        
    # Overall status is ok only if all checks pass
    overall_status = "ok" if all(s == "ok" for s in [db_status, gocardless_status]) else "error"
    
    return jsonify({
        "status": overall_status,
        "database": db_status,
        "gocardless": gocardless_status,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }), 200 if overall_status == "ok" else 503
```

## 7. Error Registry and Documentation

### Error Code Registry

Maintain a registry of all application error codes, with:

1. **Code**: Unique identifier (e.g., `bank_connection_failed`)
2. **HTTP Status**: Associated HTTP status code
3. **Description**: Explanation of the error
4. **Resolution Steps**: How to resolve the error (for users and support)
5. **Internal Notes**: Additional context for developers

### Sample Registry Entry

```
Error Code: bank_connection_expired
HTTP Status: 401
Description: The connection to the bank has expired and requires re-authentication.
Resolution Steps: 
  1. Navigate to the Bank Connections page
  2. Click "Reconnect" on the expired connection
  3. Complete the bank authentication flow
Internal Notes: 
  - Bank tokens expire after 90 days
  - Check logs for any API errors from GoCardless
  - May require manually refreshing tokens in some cases
```

## 8. Backup and Recovery

### Error Recovery Strategies

1. **Automatic Retries**: Implement retry logic with exponential backoff for transient failures
2. **Circuit Breakers**: Use circuit breakers to prevent cascading failures
3. **Fallbacks**: Define fallback behavior when services are unavailable
4. **Data Validation**: Implement thorough validation to prevent data corruption

### Example Implementation

```python
# Retry decorator
def retry(max_attempts=3, backoff_factor=1.5, retryable_exceptions=(ExternalServiceException,)):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            attempt = 0
            while attempt < max_attempts:
                try:
                    return func(*args, **kwargs)
                except retryable_exceptions as e:
                    attempt += 1
                    if attempt >= max_attempts:
                        logger.error(f"All retry attempts failed for {func.__name__}",
                                    operation=func.__name__,
                                    attempt=attempt,
                                    error=str(e))
                        raise
                    
                    # Calculate backoff time
                    backoff_time = backoff_factor ** attempt
                    logger.warn(f"Retrying {func.__name__} after failure",
                               operation=func.__name__,
                               attempt=attempt,
                               backoff_time=backoff_time,
                               error=str(e))
                    time.sleep(backoff_time)
            
            # Should never reach here, but just in case
            raise ExternalServiceException("Unknown service", "Maximum retry attempts reached")
        
        return wrapper
    return decorator

# Usage
@retry(max_attempts=3, backoff_factor=2)
def get_bank_transactions(connection_id):
    # Implementation that might fail transiently
    pass
```

## Appendix: Financial Systems-Specific Error Handling

### Transaction Reconciliation Errors

For financial reconciliation errors:

1. **Isolation**: Errors should not affect other transactions
2. **Detailed Logging**: Log all details of reconciliation failures
3. **Manual Override**: Provide admin interface for manual correction
4. **Audit Trail**: Maintain full audit trail of all error resolutions

### Integration Error Handling

For external service integration failures:

1. **Saga Pattern**: Use sagas for distributed transactions involving multiple services
2. **Compensating Actions**: Define compensating actions to undo partial transactions
3. **Idempotency**: Design all integrations to be idempotent (safe to retry)
4. **Consistency Checks**: Implement periodic consistency checks between systems

### Security-Related Error Handling

For security-related errors:

1. **Limited Information**: Provide minimal details in user-facing error messages
2. **Rate Limiting**: Implement rate limiting for authentication failures
3. **Alert Thresholds**: Set up alerts for suspicious patterns
4. **Audit Logging**: Maintain comprehensive audit logs for security events