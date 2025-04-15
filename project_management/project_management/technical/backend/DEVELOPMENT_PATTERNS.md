# Backend Development Patterns for Payymo

This document outlines the backend development patterns and best practices for the Payymo platform. These standards ensure consistency, maintainability, and performance across the Flask-based backend.

## 1. API Design (RESTful Principles)

### Resource-Oriented Architecture

All APIs should be designed around resources rather than actions:

✅ **Good**: `/api/v1/transactions` (resource-focused)<br>
❌ **Bad**: `/api/v1/getTransactions` (action-focused)

### HTTP Methods

Use standard HTTP methods appropriately:

- **GET**: Retrieve resources (list or specific item). Always idempotent.
- **POST**: Create new resources or trigger complex operations. Not idempotent.
- **PUT**: Replace an existing resource entirely. Idempotent.
- **PATCH**: Partially update an existing resource. Usually not idempotent.
- **DELETE**: Remove a resource. Idempotent.

### Endpoint Naming Conventions

- Use plural nouns for resource collections (e.g., `/bank_connections`, not `/bank_connection`)
- Use IDs for specific resources (e.g., `/bank_connections/{connection_id}`)
- Use kebab-case or snake_case consistently for multi-word resource names (prefer snake_case in Python)
- For relationships, nest resources (e.g., `/bank_connections/{connection_id}/transactions`)

### Response Structure

Maintain a consistent response structure:

```json
// Success response (collection)
{
  "data": [
    { "id": 1, "name": "Item 1" },
    { "id": 2, "name": "Item 2" }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "per_page": 10
  }
}

// Success response (single item)
{
  "data": {
    "id": 1,
    "name": "Item 1"
  }
}

// Error response
{
  "error": {
    "code": "validation_error",
    "message": "Invalid input",
    "details": [
      { "field": "email", "message": "Email is required" }
    ]
  }
}
```

### Status Codes

Use appropriate HTTP status codes:

- **200 OK**: Successful GET, PUT, PATCH, or POST that doesn't create a new resource
- **201 Created**: Successful POST that creates a new resource
- **204 No Content**: Successful DELETE or PUT/PATCH that returns no content
- **400 Bad Request**: Client error (validation failure, malformed request)
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Authentication successful but user doesn't have permission
- **404 Not Found**: Resource not found
- **409 Conflict**: Request conflicts with current state (e.g., duplicate entry)
- **422 Unprocessable Entity**: Well-formed request but semantically invalid
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server-side error

### API Versioning

Include API versioning in the URL path:

```
/api/v1/transactions
```

Plan for versioning strategy:
- Major changes that break compatibility require a version increment
- Document upgrade paths between versions
- Maintain previous versions during transition periods

## 2. Flask Project Structure

### Organizing by Feature/Domain

Organize code by feature or domain rather than by technical role:

```
flask_backend/
├── __init__.py
├── app.py                    # Main application setup
├── config.py                 # Configuration settings
├── models/                   # Database models
│   ├── __init__.py
│   ├── transaction.py
│   ├── bank_connection.py
│   └── user.py
├── routes/                   # Route definitions
│   ├── __init__.py
│   ├── auth_routes.py
│   ├── transaction_routes.py
│   └── bank_connection_routes.py
├── services/                 # Business logic
│   ├── __init__.py
│   ├── transaction_service.py
│   ├── bank_service.py
│   └── stripe_service.py
├── utils/                    # Utility functions
│   ├── __init__.py
│   ├── validators.py
│   ├── formatters.py
│   └── security.py
├── static/                   # Static assets
└── templates/                # HTML templates
```

### Blueprint Organization

Use Flask blueprints to organize routes by feature:

```python
# routes/transaction_routes.py
from flask import Blueprint, jsonify, request
from services.transaction_service import TransactionService

transaction_bp = Blueprint('transaction', __name__, url_prefix='/api/v1/transactions')
transaction_service = TransactionService()

@transaction_bp.route('/', methods=['GET'])
def get_transactions():
    tenant_id = g.tenant_id  # From middleware
    transactions = transaction_service.get_transactions(tenant_id)
    return jsonify({"data": transactions})

@transaction_bp.route('/<int:transaction_id>', methods=['GET'])
def get_transaction(transaction_id):
    tenant_id = g.tenant_id  # From middleware
    transaction = transaction_service.get_transaction(tenant_id, transaction_id)
    if not transaction:
        return jsonify({"error": {"message": "Transaction not found"}}), 404
    return jsonify({"data": transaction})
```

### Route Registration

Register blueprints in the main application file:

```python
# app.py
from flask import Flask
from routes.transaction_routes import transaction_bp
from routes.bank_connection_routes import bank_connection_bp
from routes.auth_routes import auth_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object('config.Config')
    
    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(transaction_bp)
    app.register_blueprint(bank_connection_bp)
    
    return app
```

## 3. Service Layer Pattern

### Purpose

The service layer encapsulates business logic and acts as a bridge between routes (controllers) and data access.

### Implementation

```python
# services/transaction_service.py
from models.transaction import Transaction
from sqlalchemy import desc

class TransactionService:
    def get_transactions(self, tenant_id, page=1, per_page=20, filters=None):
        """Get paginated transactions for tenant"""
        query = Transaction.query.filter_by(tenant_id=tenant_id)
        
        # Apply filters
        if filters:
            if 'bank_id' in filters:
                query = query.filter_by(bank_id=filters['bank_id'])
            if 'start_date' in filters:
                query = query.filter(Transaction.transaction_date >= filters['start_date'])
            if 'end_date' in filters:
                query = query.filter(Transaction.transaction_date <= filters['end_date'])
                
        # Apply pagination and sorting
        total = query.count()
        transactions = query.order_by(desc(Transaction.transaction_date)) \
                           .offset((page - 1) * per_page) \
                           .limit(per_page) \
                           .all()
                           
        # Format for response
        result = {
            "data": [t.to_dict() for t in transactions],
            "meta": {
                "total": total,
                "page": page,
                "per_page": per_page,
                "total_pages": (total + per_page - 1) // per_page
            }
        }
        
        return result

    def get_transaction(self, tenant_id, transaction_id):
        """Get a specific transaction by ID"""
        transaction = Transaction.query.filter_by(
            tenant_id=tenant_id, 
            id=transaction_id
        ).first()
        
        if not transaction:
            return None
            
        return transaction.to_dict()
        
    # Additional methods for creating, updating, deleting transactions
```

### Benefits

- **Separation of Concerns**: Routes handle HTTP request/response, services handle business logic
- **Testability**: Services can be tested independently of HTTP layer
- **Reusability**: Business logic can be reused across different routes or contexts
- **Maintainability**: Easier to understand, modify, and extend functionality

## 4. Database Interaction (SQLAlchemy)

### Model Definition

Define models with clear relationships and constraints:

```python
# models/transaction.py
from app import db
from datetime import datetime

class Transaction(db.Model):
    __tablename__ = 'transactions'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False, index=True)
    transaction_id = db.Column(db.String(100), unique=True, nullable=False)
    bank_id = db.Column(db.String(100))
    bank_name = db.Column(db.String(100))
    account_id = db.Column(db.String(100))
    account_name = db.Column(db.String(255))
    amount = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(3), default='GBP')
    description = db.Column(db.Text)
    reference = db.Column(db.String(255))
    transaction_date = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    matches = db.relationship("InvoiceMatch", back_populates="transaction")
    
    def to_dict(self):
        """Convert model to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'transaction_id': self.transaction_id,
            'bank_id': self.bank_id,
            'bank_name': self.bank_name,
            'account_id': self.account_id,
            'account_name': self.account_name,
            'amount': self.amount,
            'currency': self.currency,
            'description': self.description,
            'reference': self.reference,
            'transaction_date': self.transaction_date.isoformat(),
            'created_at': self.created_at.isoformat()
        }
```

### Query Best Practices

- Always filter queries by tenant_id for tenant isolation
- Use joins rather than multiple queries to retrieve related data
- Add indexes to frequently queried columns
- Use lazy loading for relationships but switch to eager loading (joined/subquery) when retrieving many related records

### Transactions

Use SQLAlchemy's transaction mechanism for operations that need to succeed or fail together:

```python
from app import db

def create_bank_connection_with_transactions(tenant_id, connection_data, transactions_data):
    try:
        # Start transaction
        connection = BankConnection(tenant_id=tenant_id, **connection_data)
        db.session.add(connection)
        
        # Create associated transactions
        for transaction_data in transactions_data:
            transaction = Transaction(
                tenant_id=tenant_id,
                bank_id=connection.bank_id,
                **transaction_data
            )
            db.session.add(transaction)
            
        # Commit transaction
        db.session.commit()
        return connection
    except Exception as e:
        # Rollback on error
        db.session.rollback()
        raise e
```

## 5. Error Handling

### Custom Exception Classes

Define custom exceptions for different error types:

```python
# utils/exceptions.py
class PayymoException(Exception):
    """Base exception for Payymo application"""
    status_code = 500
    error_code = "server_error"
    
    def __init__(self, message=None, status_code=None, error_code=None):
        self.message = message or "An unexpected error occurred"
        if status_code is not None:
            self.status_code = status_code
        if error_code is not None:
            self.error_code = error_code
        super().__init__(self.message)
    
    def to_dict(self):
        return {
            "error": {
                "code": self.error_code,
                "message": self.message
            }
        }

class ResourceNotFoundException(PayymoException):
    """Exception raised when a requested resource is not found"""
    status_code = 404
    error_code = "resource_not_found"
    
    def __init__(self, message="The requested resource was not found"):
        super().__init__(message=message)

class ValidationException(PayymoException):
    """Exception raised for validation errors"""
    status_code = 400
    error_code = "validation_error"
    
    def __init__(self, message="Invalid input data", errors=None):
        super().__init__(message=message)
        self.errors = errors or []
        
    def to_dict(self):
        result = super().to_dict()
        if self.errors:
            result["error"]["details"] = self.errors
        return result
```

### Global Error Handler

Implement a global error handler for Flask:

```python
# app.py
from flask import jsonify
from utils.exceptions import PayymoException

def create_app():
    app = Flask(__name__)
    # ... app setup ...
    
    @app.errorhandler(PayymoException)
    def handle_payymo_exception(error):
        response = jsonify(error.to_dict())
        response.status_code = error.status_code
        return response
        
    @app.errorhandler(404)
    def handle_not_found(error):
        return jsonify({
            "error": {
                "code": "not_found",
                "message": "The requested URL was not found on the server."
            }
        }), 404
        
    @app.errorhandler(500)
    def handle_server_error(error):
        # Log error details here
        return jsonify({
            "error": {
                "code": "server_error",
                "message": "An internal server error occurred."
            }
        }), 500
        
    return app
```

## 6. Request Validation

### Input Validation

Use a validation library or custom validators to verify request inputs:

```python
# utils/validators.py
from marshmallow import Schema, fields, validate, ValidationError

class TransactionFilterSchema(Schema):
    start_date = fields.Date(required=False)
    end_date = fields.Date(required=False)
    bank_id = fields.String(required=False)
    min_amount = fields.Float(required=False)
    max_amount = fields.Float(required=False)
    
class BankConnectionSchema(Schema):
    bank_id = fields.String(required=True)
    authorization_code = fields.String(required=True)
    account_name = fields.String(required=False)

# routes/transaction_routes.py
from utils.validators import TransactionFilterSchema
from utils.exceptions import ValidationException

@transaction_bp.route('/', methods=['GET'])
def get_transactions():
    # Validate query parameters
    schema = TransactionFilterSchema()
    try:
        filters = schema.load(request.args)
    except ValidationError as err:
        raise ValidationException(errors=err.messages)
        
    # Process validated request
    transactions = transaction_service.get_transactions(
        tenant_id=g.tenant_id,
        page=int(request.args.get('page', 1)),
        per_page=int(request.args.get('per_page', 20)),
        filters=filters
    )
    return jsonify(transactions)
```

## 7. Authentication & Authorization

### JWT Authentication

Implement JWT-based authentication:

```python
# utils/auth.py
import jwt
from datetime import datetime, timedelta
from flask import current_app

def generate_token(user_id, tenant_id, expires_in=60*60):
    """Generate a JWT token for a user"""
    payload = {
        'sub': user_id,
        'tenant_id': tenant_id,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(seconds=expires_in)
    }
    return jwt.encode(
        payload,
        current_app.config['JWT_SECRET_KEY'],
        algorithm='HS256'
    )

def decode_token(token):
    """Decode and validate a JWT token"""
    try:
        payload = jwt.decode(
            token,
            current_app.config['JWT_SECRET_KEY'],
            algorithms=['HS256']
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise PayymoException(
            message="Token has expired",
            status_code=401,
            error_code="token_expired"
        )
    except jwt.InvalidTokenError:
        raise PayymoException(
            message="Invalid token",
            status_code=401,
            error_code="invalid_token"
        )
```

### Middleware for Authentication

Create middleware to validate JWT tokens and set tenant context:

```python
# app.py
from flask import request, g
from utils.auth import decode_token
from utils.exceptions import PayymoException

@app.before_request
def authenticate():
    # Skip authentication for public endpoints
    if request.path.startswith('/api/v1/auth/'):
        return
        
    # Check for Authorization header
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise PayymoException(
            message="Authorization required",
            status_code=401,
            error_code="auth_required"
        )
        
    # Extract and validate token
    token = auth_header.split(' ')[1]
    payload = decode_token(token)
    
    # Set user and tenant context
    g.user_id = payload['sub']
    g.tenant_id = payload['tenant_id']
```

## 8. External API Integration

### Third-Party API Client Pattern

Create service classes for external API integration:

```python
# services/gocardless_service.py
import requests
from flask import current_app
import time

class GoCardlessService:
    def __init__(self):
        self.base_url = current_app.config['GOCARDLESS_API_URL']
        self.client_id = current_app.config['GOCARDLESS_CLIENT_ID']
        self.client_secret = current_app.config['GOCARDLESS_CLIENT_SECRET']
        
    def generate_authorization_url(self, redirect_uri, state):
        """Generate URL for bank authorization"""
        params = {
            'client_id': self.client_id,
            'redirect_uri': redirect_uri,
            'scope': 'openid accounts',
            'state': state,
            'response_type': 'code'
        }
        return f"{self.base_url}/oauth/authorize?" + "&".join(f"{k}={v}" for k, v in params.items())
        
    def exchange_code_for_token(self, code, redirect_uri):
        """Exchange authorization code for access token"""
        response = requests.post(
            f"{self.base_url}/oauth/token",
            data={
                'client_id': self.client_id,
                'client_secret': self.client_secret,
                'code': code,
                'grant_type': 'authorization_code',
                'redirect_uri': redirect_uri
            },
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        
        if response.status_code != 200:
            raise PayymoException(
                message="Failed to exchange code for token",
                status_code=response.status_code,
                error_code="token_exchange_error"
            )
            
        return response.json()
        
    def get_accounts(self, access_token):
        """Retrieve bank accounts using access token"""
        response = requests.get(
            f"{self.base_url}/accounts",
            headers={
                'Authorization': f"Bearer {access_token}",
                'Accept': 'application/json'
            }
        )
        
        if response.status_code != 200:
            raise PayymoException(
                message="Failed to retrieve accounts",
                status_code=response.status_code,
                error_code="account_retrieval_error"
            )
            
        return response.json()
        
    # Additional methods for transactions, etc.
```

### Resilient API Integration

Add retry logic and proper error handling:

```python
def make_api_request(self, method, endpoint, **kwargs):
    """Make API request with retry logic"""
    max_retries = 3
    retry_delay = 1  # seconds
    
    for attempt in range(max_retries):
        try:
            response = requests.request(
                method,
                f"{self.base_url}/{endpoint.lstrip('/')}",
                **kwargs
            )
            
            # Handle rate limiting (429)
            if response.status_code == 429:
                if attempt < max_retries - 1:
                    retry_after = int(response.headers.get('Retry-After', retry_delay))
                    time.sleep(retry_after)
                    continue
                    
            # Return successful response
            if response.status_code < 400:
                return response.json()
                
            # Handle client errors
            if 400 <= response.status_code < 500:
                error_data = response.json() if response.text else {}
                raise PayymoException(
                    message=error_data.get('error_description', 'API client error'),
                    status_code=response.status_code,
                    error_code=error_data.get('error', 'client_error')
                )
                
            # Handle server errors with retry
            if response.status_code >= 500 and attempt < max_retries - 1:
                time.sleep(retry_delay * (2 ** attempt))  # Exponential backoff
                continue
                
            # Final server error
            raise PayymoException(
                message="External API server error",
                status_code=response.status_code,
                error_code="external_server_error"
            )
                
        except requests.RequestException as e:
            if attempt < max_retries - 1:
                time.sleep(retry_delay * (2 ** attempt))
                continue
            raise PayymoException(
                message=f"API connection error: {str(e)}",
                status_code=503,
                error_code="api_connection_error"
            )
```

## 9. Background Jobs and Asynchronous Processing

### Task Queue Approach

Use Celery or similar task queue for background processing:

```python
# tasks.py
from celery import Celery
from app import create_app

flask_app = create_app()
celery = Celery(
    'payymo_tasks',
    broker=flask_app.config['CELERY_BROKER_URL'],
    backend=flask_app.config['CELERY_RESULT_BACKEND']
)

@celery.task
def sync_bank_transactions(tenant_id, connection_id):
    """Background task to sync bank transactions"""
    with flask_app.app_context():
        from services.bank_service import BankService
        service = BankService()
        service.sync_transactions(tenant_id, connection_id)
        
@celery.task
def process_payment_matches(tenant_id):
    """Background task to process payment matching"""
    with flask_app.app_context():
        from services.reconciliation_service import ReconciliationService
        service = ReconciliationService()
        service.find_matches(tenant_id)
```

### Task Scheduling

Schedule periodic tasks using Celery Beat:

```python
# app.py
from celery.schedules import crontab

celery.conf.beat_schedule = {
    'refresh-expiring-tokens': {
        'task': 'tasks.refresh_expiring_tokens',
        'schedule': crontab(hour=0, minute=0)  # Daily at midnight
    },
    'daily-transaction-sync': {
        'task': 'tasks.daily_transaction_sync',
        'schedule': crontab(hour=1, minute=0)  # Daily at 1 AM
    }
}
```

## 10. Logging and Monitoring

### Structured Logging

Implement structured logging with context:

```python
# utils/logging.py
import logging
import json
from flask import request, g
import uuid

class StructuredLogger:
    def __init__(self, app):
        self.app = app
        self.logger = app.logger
        
    def get_context(self):
        """Get common context for log entries"""
        context = {
            'request_id': getattr(g, 'request_id', None),
            'tenant_id': getattr(g, 'tenant_id', None),
            'user_id': getattr(g, 'user_id', None),
            'endpoint': request.endpoint if request else None
        }
        return {k: v for k, v in context.items() if v is not None}
        
    def _log(self, level, message, **kwargs):
        """Internal logging method"""
        context = self.get_context()
        context.update(kwargs)
        
        log_entry = {
            'message': message,
            'context': context
        }
        
        json_entry = json.dumps(log_entry)
        getattr(self.logger, level)(json_entry)
        
    def info(self, message, **kwargs):
        self._log('info', message, **kwargs)
        
    def error(self, message, **kwargs):
        self._log('error', message, **kwargs)
        
    def warning(self, message, **kwargs):
        self._log('warning', message, **kwargs)
        
    def debug(self, message, **kwargs):
        self._log('debug', message, **kwargs)
```

### Request Tracking

Add request tracking middleware:

```python
# app.py
import uuid

@app.before_request
def add_request_id():
    g.request_id = request.headers.get('X-Request-ID') or str(uuid.uuid4())
    
@app.after_request
def add_request_id_header(response):
    response.headers['X-Request-ID'] = g.request_id
    return response
```

## Appendix: Python/Flask-Specific Best Practices

1. Use virtual environments for dependency isolation
2. Store configurations in environment variables
3. Use Flask-Migrate for database migrations
4. Implement proper security headers (CSRF protection, Content-Security-Policy)
5. Use dataclasses or Pydantic models for internal data structures
6. Apply type hints for better code documentation and IDE support
7. Follow PEP 8 style guide for code formatting
8. Write comprehensive docstrings for all functions, classes, and modules