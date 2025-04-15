# Payymo Reference Implementations

## Introduction

This Reference Implementations guide provides practical, reusable code examples and patterns for implementing key components of the Payymo system. It serves as a coding cookbook that demonstrates best practices, approved patterns, and standardized approaches for common implementation tasks. By following these reference implementations, developers can ensure consistency, quality, and adherence to project standards across the codebase.

## Objectives

The primary objectives of this Reference Implementations guide are to:

1. Provide concrete examples of recommended implementation patterns
2. Demonstrate best practices for common technical challenges
3. Ensure consistency in implementation across the codebase
4. Reduce the learning curve for new developers
5. Minimize technical debt through standardized approaches
6. Improve code quality and maintainability
7. Accelerate development through reusable patterns

## Authentication Implementation

### User Authentication

#### Flask Login Implementation

```python
# app.py
from flask import Flask, request, jsonify, session
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, User

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY")
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    
    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"message": "Missing email or password"}), 400
    
    user = User.query.filter_by(email=data["email"]).first()
    
    if not user or not check_password_hash(user.password_hash, data["password"]):
        return jsonify({"message": "Invalid email or password"}), 401
    
    login_user(user, remember=data.get("remember", False))
    return jsonify({"message": "Login successful", "user": user.to_dict()}), 200

@app.route("/logout")
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logout successful"}), 200

@app.route("/profile")
@login_required
def profile():
    return jsonify({"user": current_user.to_dict()}), 200
```

#### Token-Based Authentication

```python
# auth.py
import jwt
import datetime
from functools import wraps
from flask import request, jsonify, current_app

def generate_token(user_id):
    """Generate a JWT token for the user"""
    payload = {
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24),
        'iat': datetime.datetime.utcnow(),
        'sub': user_id
    }
    return jwt.encode(
        payload,
        current_app.config.get('SECRET_KEY'),
        algorithm='HS256'
    )

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Get token from header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'message': 'Token is missing or invalid'}), 401
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        
        try:
            # Decode token
            payload = jwt.decode(token, current_app.config.get('SECRET_KEY'), algorithms=['HS256'])
            user_id = payload['sub']
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token'}), 401
        
        # Get user from database
        from models import User
        current_user = User.query.get(user_id)
        if not current_user:
            return jsonify({'message': 'User not found'}), 404
        
        return f(current_user, *args, **kwargs)
    
    return decorated

# Usage example
@app.route('/api/protected')
@token_required
def protected_route(current_user):
    return jsonify({'message': 'This is a protected route', 'user': current_user.to_dict()})
```

### API Authentication

#### OAuth2 Client Implementation for GoCardless

```python
# gocardless_service.py
import requests
import base64
import json
from flask import url_for, current_app, session
from models import db, BankConnection

class GoCardlessService:
    def __init__(self, client_id, client_secret, sandbox=True):
        self.client_id = client_id
        self.client_secret = client_secret
        self.base_url = "https://sandbox.gocardless.com" if sandbox else "https://api.gocardless.com"
        self.token_url = f"{self.base_url}/oauth/access_token"
        self.auth_url = f"{self.base_url}/oauth/authorize"
        
    def get_authorization_url(self, state, redirect_uri):
        """Generate the GoCardless authorization URL"""
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "scope": "read_write",
            "state": state,
            "redirect_uri": redirect_uri
        }
        auth_url = f"{self.auth_url}?{'&'.join([f'{k}={v}' for k, v in params.items()])}"
        return auth_url
    
    def exchange_code_for_token(self, code, redirect_uri):
        """Exchange authorization code for access token"""
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri
        }
        
        response = requests.post(self.token_url, data=data)
        
        if response.status_code != 200:
            raise Exception(f"Failed to exchange code for token: {response.text}")
        
        token_data = response.json()
        return token_data
    
    def refresh_access_token(self, refresh_token):
        """Refresh an expired access token"""
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token"
        }
        
        response = requests.post(self.token_url, data=data)
        
        if response.status_code != 200:
            raise Exception(f"Failed to refresh token: {response.text}")
        
        token_data = response.json()
        return token_data
    
    def make_api_request(self, endpoint, method="GET", data=None, access_token=None):
        """Make an authenticated request to the GoCardless API"""
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        url = f"{self.base_url}{endpoint}"
        
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data)
        elif method == "PUT":
            response = requests.put(url, headers=headers, json=data)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        if response.status_code >= 400:
            raise Exception(f"API request failed: {response.text}")
        
        return response.json()

# Usage example
@app.route('/connect/gocardless')
@login_required
def connect_gocardless():
    # Generate random state for CSRF protection
    import secrets
    state = secrets.token_hex(16)
    session['oauth_state'] = state
    
    # Create GoCardless service
    gocardless_service = GoCardlessService(
        client_id=current_app.config['GOCARDLESS_CLIENT_ID'],
        client_secret=current_app.config['GOCARDLESS_CLIENT_SECRET'],
        sandbox=current_app.config['GOCARDLESS_SANDBOX']
    )
    
    # Generate authorization URL
    redirect_uri = url_for('gocardless_callback', _external=True)
    auth_url = gocardless_service.get_authorization_url(state, redirect_uri)
    
    return redirect(auth_url)

@app.route('/connect/gocardless/callback')
@login_required
def gocardless_callback():
    # Verify state parameter
    state = request.args.get('state')
    if state != session.get('oauth_state'):
        return jsonify({'message': 'Invalid state parameter'}), 400
    
    # Exchange code for token
    code = request.args.get('code')
    if not code:
        return jsonify({'message': 'Authorization code is missing'}), 400
    
    try:
        gocardless_service = GoCardlessService(
            client_id=current_app.config['GOCARDLESS_CLIENT_ID'],
            client_secret=current_app.config['GOCARDLESS_CLIENT_SECRET'],
            sandbox=current_app.config['GOCARDLESS_SANDBOX']
        )
        
        redirect_uri = url_for('gocardless_callback', _external=True)
        token_data = gocardless_service.exchange_code_for_token(code, redirect_uri)
        
        # Store token in database
        bank_connection = BankConnection(
            user_id=current_user.id,
            bank_id='gocardless',
            bank_name='GoCardless',
            access_token=token_data['access_token'],
            refresh_token=token_data['refresh_token'],
            token_expires_at=datetime.datetime.utcnow() + datetime.timedelta(seconds=token_data['expires_in']),
            status='active'
        )
        
        db.session.add(bank_connection)
        db.session.commit()
        
        return redirect(url_for('dashboard'))
    except Exception as e:
        return jsonify({'message': f'Error connecting to GoCardless: {str(e)}'}), 500
```

#### API Key Authentication for Internal Services

```python
# api_auth.py
from functools import wraps
from flask import request, jsonify, current_app
from models import APIKey

def require_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if not api_key:
            return jsonify({'message': 'API key is required'}), 401
        
        # Verify API key
        key_record = APIKey.query.filter_by(key=api_key, status='active').first()
        if not key_record:
            return jsonify({'message': 'Invalid API key'}), 401
        
        # Check rate limits
        if key_record.is_rate_limited():
            return jsonify({'message': 'Rate limit exceeded'}), 429
        
        # Update usage stats
        key_record.increment_usage()
        
        return f(key_record, *args, **kwargs)
    
    return decorated

# Usage example
@app.route('/api/v1/transactions')
@require_api_key
def get_transactions(api_key):
    # api_key is the APIKey model instance
    tenant_id = api_key.tenant_id
    transactions = Transaction.query.filter_by(tenant_id=tenant_id).all()
    return jsonify({'transactions': [t.to_dict() for t in transactions]})
```

## Multi-tenant Data Access Patterns

### Tenant Context Management

```python
# tenant_context.py
from flask import g, request
from functools import wraps
from sqlalchemy.orm import Query
from models import db, Tenant

class TenantContext:
    @staticmethod
    def get_current_tenant_id():
        """Get the current tenant ID from the request context"""
        if hasattr(g, 'tenant_id'):
            return g.tenant_id
        return None
    
    @staticmethod
    def set_current_tenant_id(tenant_id):
        """Set the current tenant ID in the request context"""
        g.tenant_id = tenant_id
    
    @staticmethod
    def clear_current_tenant_id():
        """Clear the current tenant ID from the request context"""
        if hasattr(g, 'tenant_id'):
            delattr(g, 'tenant_id')

def tenant_required(f):
    """Decorator to require a valid tenant in the request"""
    @wraps(f)
    def decorated(*args, **kwargs):
        tenant_id = None
        
        # Check for tenant in header
        tenant_header = request.headers.get('X-Tenant-ID')
        if tenant_header:
            tenant_id = tenant_header
        
        # Or check for tenant in subdomain
        elif request.host.count('.') >= 2:
            subdomain = request.host.split('.')[0]
            tenant = Tenant.query.filter_by(subdomain=subdomain).first()
            if tenant:
                tenant_id = tenant.id
        
        if not tenant_id:
            return jsonify({'message': 'Tenant ID is required'}), 400
        
        # Verify tenant exists and is active
        tenant = Tenant.query.filter_by(id=tenant_id, status='active').first()
        if not tenant:
            return jsonify({'message': 'Invalid or inactive tenant'}), 404
        
        # Set tenant ID in context
        TenantContext.set_current_tenant_id(tenant_id)
        
        return f(*args, **kwargs)
    
    return decorated

# SQLAlchemy query class with tenant filtering
class TenantQuery(Query):
    def get(self, ident):
        # Override get() to ensure tenant filtering
        obj = super(TenantQuery, self).get(ident)
        if obj is None:
            return None
            
        if hasattr(obj, 'tenant_id') and obj.tenant_id != TenantContext.get_current_tenant_id():
            return None
            
        return obj
    
    def __iter__(self):
        # Apply tenant filtering to all queries
        tenant_id = TenantContext.get_current_tenant_id()
        if tenant_id is not None:
            model_class = self._mapper_zero().class_
            if hasattr(model_class, 'tenant_id'):
                return super(TenantQuery, self).filter(model_class.tenant_id == tenant_id).__iter__()
        
        return super(TenantQuery, self).__iter__()

# Base model class with tenant query class
class TenantModel(db.Model):
    __abstract__ = True
    query_class = TenantQuery
    
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)

# Usage example
class Transaction(TenantModel):
    __tablename__ = 'transactions'
    
    id = db.Column(db.Integer, primary_key=True)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    description = db.Column(db.String(255))
    # Other fields...
    
    def __init__(self, *args, **kwargs):
        # Automatically set tenant_id if not provided
        if 'tenant_id' not in kwargs and TenantContext.get_current_tenant_id():
            kwargs['tenant_id'] = TenantContext.get_current_tenant_id()
        super(Transaction, self).__init__(*args, **kwargs)
```

### Tenant Configuration Management

```python
# tenant_config.py
import json
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy.types import TypeDecorator, TEXT
from models import db

class JSONEncodedDict(TypeDecorator):
    impl = TEXT
    
    def process_bind_param(self, value, dialect):
        if value is not None:
            value = json.dumps(value)
        return value
    
    def process_result_value(self, value, dialect):
        if value is not None:
            value = json.loads(value)
        return value

class TenantConfig(db.Model):
    __tablename__ = 'tenant_configs'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False, unique=True)
    settings = db.Column(MutableDict.as_mutable(JSONEncodedDict), default={})
    branding = db.Column(MutableDict.as_mutable(JSONEncodedDict), default={})
    features = db.Column(MutableDict.as_mutable(JSONEncodedDict), default={})
    
    @classmethod
    def get_for_tenant(cls, tenant_id):
        """Get or create config for tenant"""
        config = cls.query.filter_by(tenant_id=tenant_id).first()
        if not config:
            config = cls(tenant_id=tenant_id)
            db.session.add(config)
            db.session.commit()
        return config
    
    def get_setting(self, key, default=None):
        """Get a specific setting value"""
        return self.settings.get(key, default)
    
    def set_setting(self, key, value):
        """Set a specific setting value"""
        self.settings[key] = value
        db.session.add(self)
        db.session.commit()
    
    def is_feature_enabled(self, feature_name):
        """Check if a feature is enabled for this tenant"""
        return self.features.get(feature_name, False)
    
    def enable_feature(self, feature_name):
        """Enable a feature for this tenant"""
        self.features[feature_name] = True
        db.session.add(self)
        db.session.commit()
    
    def disable_feature(self, feature_name):
        """Disable a feature for this tenant"""
        self.features[feature_name] = False
        db.session.add(self)
        db.session.commit()

# Usage example
@app.route('/api/v1/tenant/settings', methods=['GET'])
@login_required
@tenant_required
def get_tenant_settings():
    tenant_id = TenantContext.get_current_tenant_id()
    config = TenantConfig.get_for_tenant(tenant_id)
    return jsonify({
        'settings': config.settings,
        'branding': config.branding,
        'features': config.features
    })

@app.route('/api/v1/tenant/settings', methods=['PUT'])
@login_required
@tenant_required
def update_tenant_settings():
    tenant_id = TenantContext.get_current_tenant_id()
    config = TenantConfig.get_for_tenant(tenant_id)
    
    data = request.get_json()
    if 'settings' in data:
        config.settings = data['settings']
    if 'branding' in data:
        config.branding = data['branding']
    
    db.session.add(config)
    db.session.commit()
    
    return jsonify({'message': 'Settings updated successfully'})
```

### Tenant Isolation in Database Queries

```python
# database_utils.py
from sqlalchemy import event
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.ext.declarative import declarative_base
from flask import g

Base = declarative_base()

def get_tenant_id():
    """Get current tenant ID from Flask g object"""
    return getattr(g, 'tenant_id', None)

class TenantAwareSession(scoped_session):
    def __init__(self, session_factory, scopefunc=None):
        super(TenantAwareSession, self).__init__(session_factory, scopefunc)
        
        @event.listens_for(self, 'before_flush')
        def before_flush(session, flush_context, instances):
            """Ensure tenant_id is set on all tenant-scoped entities"""
            tenant_id = get_tenant_id()
            if tenant_id:
                for obj in session.new:
                    if hasattr(obj, 'tenant_id') and obj.tenant_id is None:
                        obj.tenant_id = tenant_id
        
        @event.listens_for(self, 'do_orm_execute')
        def do_orm_execute(execute_state):
            """Apply tenant filtering to queries"""
            tenant_id = get_tenant_id()
            if tenant_id:
                # Check if query involves tenant-scoped entity
                for entity in execute_state.statement.column_descriptions:
                    entity_type = entity.get('type')
                    if entity_type and hasattr(entity_type, '__table__') and 'tenant_id' in entity_type.__table__.c:
                        # Add tenant filter condition
                        execute_state.statement = execute_state.statement.where(
                            entity_type.tenant_id == tenant_id
                        )
                        break

# Create tenant-aware session
engine = create_engine(DATABASE_URL)
session_factory = sessionmaker(bind=engine)
db_session = TenantAwareSession(session_factory)

# Example of tenant-scoped entity
class User(Base):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    username = db.Column(db.String(64), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    
    # This will automatically filter by tenant_id in queries
    # and ensure tenant_id is set on new instances
```

## Error Handling Patterns

### Global Exception Handler

```python
# error_handlers.py
import traceback
import logging
from flask import jsonify, current_app, request
from werkzeug.exceptions import HTTPException
from sqlalchemy.exc import SQLAlchemyError, IntegrityError

logger = logging.getLogger(__name__)

def register_error_handlers(app):
    """Register error handlers for the Flask app"""
    
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({
            'error': 'Bad Request',
            'message': str(error),
            'status_code': 400
        }), 400
    
    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({
            'error': 'Unauthorized',
            'message': str(error),
            'status_code': 401
        }), 401
    
    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({
            'error': 'Forbidden',
            'message': str(error),
            'status_code': 403
        }), 403
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            'error': 'Not Found',
            'message': str(error),
            'status_code': 404
        }), 404
    
    @app.errorhandler(SQLAlchemyError)
    def handle_sqlalchemy_error(error):
        # Log the full error with traceback
        logger.error(f"Database error: {error}\n{traceback.format_exc()}")
        
        # Handle specific database errors
        if isinstance(error, IntegrityError):
            return jsonify({
                'error': 'Data Integrity Error',
                'message': 'A database constraint was violated.',
                'status_code': 400
            }), 400
        
        # Generic database error
        return jsonify({
            'error': 'Database Error',
            'message': 'A database error occurred.',
            'status_code': 500
        }), 500
    
    @app.errorhandler(HTTPException)
    def handle_http_exception(error):
        return jsonify({
            'error': error.name,
            'message': error.description,
            'status_code': error.code
        }), error.code
    
    @app.errorhandler(Exception)
    def handle_generic_exception(error):
        # Log the full error with traceback
        logger.error(f"Unhandled exception: {error}\n{traceback.format_exc()}")
        
        # In production, don't expose internal error details
        if current_app.config.get('DEBUG', False):
            message = str(error)
        else:
            message = 'An unexpected error occurred.'
        
        return jsonify({
            'error': 'Internal Server Error',
            'message': message,
            'status_code': 500
        }), 500
    
    # Log all 5xx errors
    @app.after_request
    def log_errors(response):
        if response.status_code >= 500:
            logger.error(f"5xx error: {response.status_code} - {request.url}")
        return response

# Usage example
app = Flask(__name__)
register_error_handlers(app)
```

### Structured Error Responses

```python
# errors.py
from flask import jsonify

class APIError(Exception):
    """Base class for API errors"""
    status_code = 500
    error_code = 'internal_error'
    
    def __init__(self, message=None, status_code=None, error_code=None, payload=None):
        super(APIError, self).__init__()
        self.message = message or 'An unexpected error occurred'
        if status_code is not None:
            self.status_code = status_code
        if error_code is not None:
            self.error_code = error_code
        self.payload = payload
    
    def to_dict(self):
        rv = dict(self.payload or {})
        rv['error'] = self.error_code
        rv['message'] = self.message
        rv['status_code'] = self.status_code
        return rv
    
    def get_response(self):
        return jsonify(self.to_dict()), self.status_code

class BadRequestError(APIError):
    status_code = 400
    error_code = 'bad_request'
    
    def __init__(self, message='Invalid request parameters', **kwargs):
        super(BadRequestError, self).__init__(message=message, **kwargs)

class UnauthorizedError(APIError):
    status_code = 401
    error_code = 'unauthorized'
    
    def __init__(self, message='Authentication required', **kwargs):
        super(UnauthorizedError, self).__init__(message=message, **kwargs)

class ForbiddenError(APIError):
    status_code = 403
    error_code = 'forbidden'
    
    def __init__(self, message='Permission denied', **kwargs):
        super(ForbiddenError, self).__init__(message=message, **kwargs)

class NotFoundError(APIError):
    status_code = 404
    error_code = 'not_found'
    
    def __init__(self, message='Resource not found', **kwargs):
        super(NotFoundError, self).__init__(message=message, **kwargs)

class ValidationError(APIError):
    status_code = 422
    error_code = 'validation_error'
    
    def __init__(self, message='Validation error', errors=None, **kwargs):
        payload = kwargs.get('payload', {})
        if errors:
            payload['errors'] = errors
        kwargs['payload'] = payload
        super(ValidationError, self).__init__(message=message, **kwargs)

# Register handler for APIError
def register_api_error_handler(app):
    @app.errorhandler(APIError)
    def handle_api_error(error):
        return error.get_response()

# Usage example
@app.route('/api/v1/users/<int:user_id>')
def get_user(user_id):
    user = User.query.get(user_id)
    if not user:
        raise NotFoundError(message=f"User with ID {user_id} not found")
    return jsonify(user.to_dict())

@app.route('/api/v1/transactions', methods=['POST'])
def create_transaction():
    data = request.get_json()
    
    # Validate required fields
    errors = {}
    if not data.get('amount'):
        errors['amount'] = 'Amount is required'
    if not data.get('description'):
        errors['description'] = 'Description is required'
    
    if errors:
        raise ValidationError(message='Invalid transaction data', errors=errors)
    
    # Process valid data
    transaction = Transaction(
        amount=data['amount'],
        description=data['description'],
        # Other fields...
    )
    db.session.add(transaction)
    db.session.commit()
    
    return jsonify(transaction.to_dict()), 201
```

### Transaction Management and Rollback

```python
# transaction_utils.py
from contextlib import contextmanager
from sqlalchemy.exc import SQLAlchemyError
from flask import current_app
from models import db

@contextmanager
def db_transaction():
    """
    Context manager for database transactions with automatic commit/rollback.
    
    Usage:
        with db_transaction() as session:
            user = User(...)
            session.add(user)
            # No need to call session.commit()
    """
    try:
        yield db.session
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Transaction rolled back due to error: {str(e)}")
        raise

# Alternative with explicit nested transaction support
def atomic_transaction(func):
    """
    Decorator to wrap a function in a database transaction.
    Supports nested transactions through savepoints.
    
    Usage:
        @atomic_transaction
        def create_user(name, email):
            user = User(name=name, email=email)
            db.session.add(user)
            return user
    """
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy import create_engine
    
    def wrapper(*args, **kwargs):
        try:
            result = func(*args, **kwargs)
            db.session.commit()
            return result
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Transaction rolled back due to error: {str(e)}")
            raise
    
    return wrapper

# Usage example
@app.route('/api/v1/payments', methods=['POST'])
def create_payment():
    data = request.get_json()
    
    with db_transaction() as session:
        # Create payment record
        payment = Payment(
            amount=data['amount'],
            currency=data['currency'],
            status='pending'
        )
        session.add(payment)
        
        # Create payment transaction
        transaction = Transaction(
            payment_id=payment.id,
            type='payment',
            amount=data['amount'],
            status='pending'
        )
        session.add(transaction)
        
        # Create audit log entry
        audit_log = AuditLog(
            action='payment_created',
            entity_type='payment',
            entity_id=payment.id,
            user_id=current_user.id
        )
        session.add(audit_log)
    
    # Transaction committed automatically if no exception
    return jsonify(payment.to_dict()), 201

# Alternative with decorator
@app.route('/api/v1/refunds', methods=['POST'])
@atomic_transaction
def create_refund():
    data = request.get_json()
    
    # Find original payment
    payment = Payment.query.get(data['payment_id'])
    if not payment:
        raise NotFoundError(message=f"Payment with ID {data['payment_id']} not found")
    
    # Create refund record
    refund = Refund(
        payment_id=payment.id,
        amount=data['amount'],
        reason=data['reason'],
        status='pending'
    )
    db.session.add(refund)
    
    # Update payment status
    payment.refunded_amount = (payment.refunded_amount or 0) + data['amount']
    if payment.refunded_amount >= payment.amount:
        payment.status = 'fully_refunded'
    else:
        payment.status = 'partially_refunded'
    
    # Create transaction for refund
    transaction = Transaction(
        payment_id=payment.id,
        refund_id=refund.id,
        type='refund',
        amount=-data['amount'],
        status='pending'
    )
    db.session.add(transaction)
    
    # Create audit log entry
    audit_log = AuditLog(
        action='refund_created',
        entity_type='refund',
        entity_id=refund.id,
        user_id=current_user.id
    )
    db.session.add(audit_log)
    
    # No need to commit - decorator handles it
    return jsonify(refund.to_dict()), 201
```

## Secure Credential Management

### Encrypted Field Storage

```python
# encryption.py
import os
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from sqlalchemy.types import TypeDecorator, String

class EncryptedType(TypeDecorator):
    """SQLAlchemy type for encrypted fields"""
    impl = String
    
    def __init__(self, key=None, **kwargs):
        super(EncryptedType, self).__init__(**kwargs)
        self.key = key or os.environ.get('ENCRYPTION_KEY')
        if not self.key:
            raise ValueError("Encryption key is required")
        
        # Derive a key from the provided key
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b'payymo_salt',  # Use a fixed salt for consistent key derivation
            iterations=100000,
        )
        key_bytes = self.key.encode('utf-8')
        derived_key = base64.urlsafe_b64encode(kdf.derive(key_bytes))
        self.fernet = Fernet(derived_key)
    
    def process_bind_param(self, value, dialect):
        """Encrypt value before storing in database"""
        if value is None:
            return None
        
        if not isinstance(value, str):
            value = str(value)
        
        # Encrypt the value
        encrypted_value = self.fernet.encrypt(value.encode('utf-8'))
        return encrypted_value.decode('utf-8')
    
    def process_result_value(self, value, dialect):
        """Decrypt value when retrieved from database"""
        if value is None:
            return None
        
        # Decrypt the value
        decrypted_value = self.fernet.decrypt(value.encode('utf-8'))
        return decrypted_value.decode('utf-8')

# Usage example
class APICredential(db.Model):
    __tablename__ = 'api_credentials'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    service_name = db.Column(db.String(100), nullable=False)
    api_key = db.Column(EncryptedType(), nullable=True)
    api_secret = db.Column(EncryptedType(), nullable=True)
    access_token = db.Column(EncryptedType(), nullable=True)
    refresh_token = db.Column(EncryptedType(), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Ensure uniqueness of service per tenant
    __table_args__ = (
        db.UniqueConstraint('tenant_id', 'service_name', name='uq_tenant_service'),
    )
    
    @classmethod
    def get_for_service(cls, tenant_id, service_name):
        """Get credentials for a specific service"""
        return cls.query.filter_by(tenant_id=tenant_id, service_name=service_name).first()
    
    def update_credentials(self, **kwargs):
        """Update credential fields"""
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
        
        self.updated_at = datetime.datetime.utcnow()
        db.session.add(self)
        db.session.commit()
```

### Secure Service Connections

```python
# secure_service.py
import os
import json
import logging
from urllib.parse import urlparse
import requests
from models import APICredential
from flask import current_app

logger = logging.getLogger(__name__)

class SecureServiceConnection:
    """Base class for secure connections to external services"""
    
    def __init__(self, tenant_id, service_name):
        self.tenant_id = tenant_id
        self.service_name = service_name
        self.base_url = current_app.config.get(f'{service_name.upper()}_API_URL')
        self.credentials = self._load_credentials()
        
        # Set up request session with default headers
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': f'Payymo/{current_app.config.get("VERSION", "1.0.0")}',
            'Accept': 'application/json'
        })
    
    def _load_credentials(self):
        """Load credentials from database"""
        credentials = APICredential.get_for_service(self.tenant_id, self.service_name)
        if not credentials:
            logger.warning(f"No credentials found for tenant {self.tenant_id} and service {self.service_name}")
            return None
        return credentials
    
    def _get_auth_header(self):
        """Get authentication header for API requests"""
        raise NotImplementedError("Subclasses must implement _get_auth_header")
    
    def _handle_response(self, response):
        """Handle API response, raising exceptions for errors"""
        try:
            response.raise_for_status()
            return response.json() if response.content else None
        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error from {self.service_name}: {str(e)}")
            error_data = {}
            try:
                error_data = response.json()
            except:
                error_data = {'error': str(e)}
            
            # Log redacted error data
            redacted_data = self._redact_sensitive_data(error_data)
            logger.error(f"Error data: {json.dumps(redacted_data)}")
            
            # Raise appropriate exception
            raise APIError(
                message=f"{self.service_name} API error: {response.status_code}",
                status_code=500,
                error_code=f'{self.service_name.lower()}_api_error',
                payload={'service_status_code': response.status_code}
            )
    
    def _redact_sensitive_data(self, data):
        """Redact sensitive data from logs"""
        if isinstance(data, dict):
            redacted = {}
            sensitive_fields = ['key', 'secret', 'password', 'token', 'auth', 'credential']
            
            for key, value in data.items():
                if isinstance(value, (dict, list)):
                    redacted[key] = self._redact_sensitive_data(value)
                elif any(field in key.lower() for field in sensitive_fields):
                    redacted[key] = '[REDACTED]'
                else:
                    redacted[key] = value
            return redacted
        elif isinstance(data, list):
            return [self._redact_sensitive_data(item) for item in data]
        else:
            return data
    
    def make_request(self, method, endpoint, data=None, params=None, headers=None):
        """Make an authenticated request to the API"""
        url = self._build_url(endpoint)
        request_headers = self._get_auth_header()
        if headers:
            request_headers.update(headers)
        
        try:
            response = self.session.request(
                method=method.upper(),
                url=url,
                json=data if method.upper() in ['POST', 'PUT', 'PATCH'] and data else None,
                data=data if method.upper() in ['POST', 'PUT', 'PATCH'] and not isinstance(data, dict) else None,
                params=params,
                headers=request_headers,
                timeout=current_app.config.get('API_TIMEOUT', 30)
            )
            return self._handle_response(response)
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error for {self.service_name}: {str(e)}")
            raise APIError(
                message=f"Error connecting to {self.service_name} API",
                status_code=500,
                error_code=f'{self.service_name.lower()}_connection_error'
            )
    
    def _build_url(self, endpoint):
        """Build full URL from endpoint"""
        if endpoint.startswith('http'):
            return endpoint
        
        # Ensure endpoint starts with /
        if not endpoint.startswith('/'):
            endpoint = '/' + endpoint
        
        return self.base_url + endpoint

# Example implementation for Stripe
class StripeService(SecureServiceConnection):
    def __init__(self, tenant_id):
        super(StripeService, self).__init__(tenant_id, 'stripe')
    
    def _get_auth_header(self):
        """Get Stripe authentication header"""
        if not self.credentials or not self.credentials.api_key:
            raise APIError(
                message="Stripe API key not configured",
                status_code=500,
                error_code='stripe_key_missing'
            )
        
        return {
            'Authorization': f'Bearer {self.credentials.api_key}'
        }
    
    def list_customers(self, limit=100):
        """List Stripe customers"""
        return self.make_request('GET', '/v1/customers', params={'limit': limit})
    
    def create_customer(self, email, name=None, metadata=None):
        """Create a Stripe customer"""
        data = {
            'email': email
        }
        if name:
            data['name'] = name
        if metadata:
            data['metadata'] = metadata
        
        return self.make_request('POST', '/v1/customers', data=data)
    
    def retrieve_payment_intent(self, payment_intent_id):
        """Get a specific payment intent"""
        return self.make_request('GET', f'/v1/payment_intents/{payment_intent_id}')

# Usage example
@app.route('/api/v1/stripe/customers', methods=['GET'])
@login_required
@tenant_required
def list_stripe_customers():
    tenant_id = TenantContext.get_current_tenant_id()
    
    try:
        stripe_service = StripeService(tenant_id)
        customers = stripe_service.list_customers(limit=request.args.get('limit', 100))
        return jsonify(customers)
    except APIError as e:
        return e.get_response()
```

## Data Processing and Filtering

### Query Builder Pattern

```python
# query_builder.py
from sqlalchemy import and_, or_, desc, asc
from models import db, Transaction

class QueryBuilder:
    """Builder pattern for constructing complex database queries"""
    
    def __init__(self, model_class):
        self.model_class = model_class
        self.query = model_class.query
        self.filters = []
        self.sort_columns = []
        self.grouping = []
        self.limit_val = None
        self.offset_val = None
    
    def filter(self, field, operator, value):
        """Add a filter condition"""
        column = getattr(self.model_class, field)
        
        if operator == 'eq':
            self.filters.append(column == value)
        elif operator == 'neq':
            self.filters.append(column != value)
        elif operator == 'gt':
            self.filters.append(column > value)
        elif operator == 'gte':
            self.filters.append(column >= value)
        elif operator == 'lt':
            self.filters.append(column < value)
        elif operator == 'lte':
            self.filters.append(column <= value)
        elif operator == 'in':
            self.filters.append(column.in_(value))
        elif operator == 'not_in':
            self.filters.append(~column.in_(value))
        elif operator == 'like':
            self.filters.append(column.like(f'%{value}%'))
        elif operator == 'ilike':
            self.filters.append(column.ilike(f'%{value}%'))
        elif operator == 'startswith':
            self.filters.append(column.startswith(value))
        elif operator == 'endswith':
            self.filters.append(column.endswith(value))
        elif operator == 'is_null':
            self.filters.append(column.is_(None) if value else column.isnot(None))
        else:
            raise ValueError(f"Unsupported operator: {operator}")
        
        return self
    
    def filter_by(self, **kwargs):
        """Add multiple equality filters"""
        for field, value in kwargs.items():
            self.filter(field, 'eq', value)
        return self
    
    def or_filter(self, *conditions):
        """Add OR condition with multiple filters"""
        or_conditions = []
        for condition in conditions:
            field, operator, value = condition
            column = getattr(self.model_class, field)
            
            if operator == 'eq':
                or_conditions.append(column == value)
            elif operator == 'neq':
                or_conditions.append(column != value)
            elif operator == 'like':
                or_conditions.append(column.like(f'%{value}%'))
            # Add other operators as needed...
        
        self.filters.append(or_(*or_conditions))
        return self
    
    def order_by(self, field, direction='asc'):
        """Add sorting criteria"""
        column = getattr(self.model_class, field)
        if direction.lower() == 'desc':
            self.sort_columns.append(desc(column))
        else:
            self.sort_columns.append(asc(column))
        return self
    
    def group_by(self, field):
        """Add grouping criteria"""
        column = getattr(self.model_class, field)
        self.grouping.append(column)
        return self
    
    def limit(self, limit_val):
        """Set limit"""
        self.limit_val = limit_val
        return self
    
    def offset(self, offset_val):
        """Set offset"""
        self.offset_val = offset_val
        return self
    
    def build(self):
        """Build and return the final query"""
        query = self.query
        
        if self.filters:
            query = query.filter(and_(*self.filters))
        
        if self.grouping:
            query = query.group_by(*self.grouping)
        
        if self.sort_columns:
            query = query.order_by(*self.sort_columns)
        
        if self.limit_val is not None:
            query = query.limit(self.limit_val)
        
        if self.offset_val is not None:
            query = query.offset(self.offset_val)
        
        return query
    
    def count(self):
        """Count results"""
        return self.build().count()
    
    def all(self):
        """Execute query and return all results"""
        return self.build().all()
    
    def first(self):
        """Execute query and return first result"""
        return self.build().first()
    
    def paginate(self, page, per_page):
        """Get paginated results"""
        query = self.build()
        return query.paginate(page=page, per_page=per_page, error_out=False)

# Usage example
@app.route('/api/v1/transactions')
@login_required
@tenant_required
def get_transactions():
    tenant_id = TenantContext.get_current_tenant_id()
    
    # Parse query parameters
    page = int(request.args.get('page', 1))
    per_page = min(int(request.args.get('per_page', 20)), 100)
    status = request.args.get('status')
    min_amount = request.args.get('min_amount')
    max_amount = request.args.get('max_amount')
    search = request.args.get('search')
    sort_field = request.args.get('sort', 'created_at')
    sort_dir = request.args.get('direction', 'desc')
    
    # Build query
    query_builder = QueryBuilder(Transaction).filter_by(tenant_id=tenant_id)
    
    if status:
        query_builder.filter('status', 'eq', status)
    
    if min_amount:
        query_builder.filter('amount', 'gte', float(min_amount))
    
    if max_amount:
        query_builder.filter('amount', 'lte', float(max_amount))
    
    if search:
        query_builder.or_filter(
            ('description', 'like', search),
            ('reference', 'like', search),
            ('transaction_id', 'like', search)
        )
    
    # Add sorting
    query_builder.order_by(sort_field, sort_dir)
    
    # Get paginated results
    pagination = query_builder.paginate(page, per_page)
    
    # Format response
    return jsonify({
        'items': [item.to_dict() for item in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'page': pagination.page,
        'per_page': pagination.per_page
    })
```

### Bulk Data Processing

```python
# bulk_processor.py
import threading
import queue
import logging
from flask import current_app
from sqlalchemy.exc import SQLAlchemyError
from models import db

logger = logging.getLogger(__name__)

class BulkProcessor:
    """Process data in bulk with batch processing and error handling"""
    
    def __init__(self, batch_size=100, max_workers=5):
        self.batch_size = batch_size
        self.max_workers = max_workers
        self.error_queue = queue.Queue()
        self.result_queue = queue.Queue()
        self.workers = []
    
    def process_items(self, items, process_func):
        """
        Process a list of items in batches
        
        Args:
            items: List of items to process
            process_func: Function to process each batch
                          Should accept a list of items and return a tuple of (success_count, failure_count)
        
        Returns:
            tuple: (total_processed, total_failed, errors)
        """
        # Split items into batches
        batches = [items[i:i+self.batch_size] for i in range(0, len(items), self.batch_size)]
        
        # Create worker threads
        num_workers = min(self.max_workers, len(batches))
        batch_queue = queue.Queue()
        
        # Add batches to queue
        for batch in batches:
            batch_queue.put(batch)
        
        # Start worker threads
        for i in range(num_workers):
            worker = threading.Thread(
                target=self._worker_thread,
                args=(batch_queue, process_func)
            )
            worker.daemon = True
            worker.start()
            self.workers.append(worker)
        
        # Wait for all workers to finish
        for worker in self.workers:
            worker.join()
        
        # Collect results
        total_processed = 0
        total_failed = 0
        errors = []
        
        while not self.result_queue.empty():
            success, failure = self.result_queue.get()
            total_processed += success
            total_failed += failure
        
        while not self.error_queue.empty():
            errors.append(self.error_queue.get())
        
        return total_processed, total_failed, errors
    
    def _worker_thread(self, batch_queue, process_func):
        """Worker thread to process batches"""
        while not batch_queue.empty():
            try:
                batch = batch_queue.get(block=False)
            except queue.Empty:
                break
            
            try:
                success, failure = process_func(batch)
                self.result_queue.put((success, failure))
            except Exception as e:
                logger.error(f"Error processing batch: {str(e)}")
                self.error_queue.put(str(e))
                self.result_queue.put((0, len(batch)))
            
            batch_queue.task_done()

# Example usage - bulk transaction import
def import_transactions(transactions_data, tenant_id):
    """
    Import transactions in bulk
    
    Args:
        transactions_data: List of transaction data dictionaries
        tenant_id: Tenant ID for the transactions
        
    Returns:
        tuple: (total_imported, total_failed, errors)
    """
    processor = BulkProcessor(batch_size=100)
    
    def process_batch(batch):
        success_count = 0
        failure_count = 0
        
        try:
            # Start a transaction for the batch
            transaction_objects = []
            
            for transaction_data in batch:
                try:
                    # Create transaction object
                    transaction = Transaction(
                        tenant_id=tenant_id,
                        transaction_id=transaction_data['transaction_id'],
                        amount=transaction_data['amount'],
                        currency=transaction_data['currency'],
                        description=transaction_data.get('description'),
                        reference=transaction_data.get('reference'),
                        transaction_date=transaction_data['transaction_date'],
                        status='pending'
                    )
                    transaction_objects.append(transaction)
                    success_count += 1
                except Exception as e:
                    logger.error(f"Error creating transaction: {str(e)}")
                    failure_count += 1
            
            # Bulk insert all successful transactions
            if transaction_objects:
                db.session.bulk_save_objects(transaction_objects)
                db.session.commit()
        except SQLAlchemyError as e:
            db.session.rollback()
            logger.error(f"Database error during bulk insert: {str(e)}")
            # All transactions in this batch failed
            failure_count = len(batch)
            success_count = 0
        
        return success_count, failure_count
    
    return processor.process_items(transactions_data, process_batch)

# API endpoint example
@app.route('/api/v1/transactions/import', methods=['POST'])
@login_required
@tenant_required
def import_transactions_endpoint():
    tenant_id = TenantContext.get_current_tenant_id()
    transactions_data = request.get_json()
    
    if not isinstance(transactions_data, list):
        return jsonify({'error': 'Invalid data format, expected a list of transactions'}), 400
    
    # Check limit on number of transactions
    max_transactions = current_app.config.get('MAX_IMPORT_TRANSACTIONS', 10000)
    if len(transactions_data) > max_transactions:
        return jsonify({
            'error': f'Too many transactions. Maximum allowed is {max_transactions}'
        }), 400
    
    # Process import in background task
    import_task = threading.Thread(
        target=background_import_task,
        args=(transactions_data, tenant_id)
    )
    import_task.daemon = True
    import_task.start()
    
    return jsonify({
        'message': f'Import of {len(transactions_data)} transactions started',
        'status': 'processing'
    }), 202

def background_import_task(transactions_data, tenant_id):
    """Background task to import transactions"""
    try:
        imported, failed, errors = import_transactions(transactions_data, tenant_id)
        
        # Update import status
        import_status = ImportStatus(
            tenant_id=tenant_id,
            type='transaction_import',
            total_items=len(transactions_data),
            processed_items=imported,
            failed_items=failed,
            errors=errors[:10] if errors else [],
            status='completed'
        )
        db.session.add(import_status)
        db.session.commit()
    except Exception as e:
        logger.error(f"Background import task failed: {str(e)}")
        
        try:
            # Record failure
            import_status = ImportStatus(
                tenant_id=tenant_id,
                type='transaction_import',
                total_items=len(transactions_data),
                processed_items=0,
                failed_items=len(transactions_data),
                errors=[str(e)],
                status='failed'
            )
            db.session.add(import_status)
            db.session.commit()
        except:
            logger.error("Failed to record import failure")
```

## Approval

This Reference Implementations guide has been reviewed and approved by:

- Project Manager: _________________________ Date: _________
- Technical Lead: ___________________________ Date: _________
- Security Lead: ___________________________ Date: _________

---

## Revision History

| Version | Date | Description | Author | Approved By |
|---------|------|-------------|--------|------------|
| 0.1 | 2025-04-14 | Initial draft | AI Assistant | |
| 1.0 | | Approved version | | |