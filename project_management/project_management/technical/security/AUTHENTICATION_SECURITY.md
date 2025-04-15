# Authentication & Security Guidelines for Payymo

This document outlines the authentication and security standards for the Payymo financial platform. As an application handling sensitive financial data, Payymo must implement robust security measures at every layer using the principle of defense-in-depth.

## 1. Authentication Strategy

### Primary Authentication Methods

Payymo implements a multi-layered authentication system to protect user accounts and tenant data:

1. **User Authentication**:
   - Username/password with strong password requirements
   - Multi-factor authentication (MFA) using Time-based One-Time Password (TOTP)
   - Session management with secure HTTP cookies

2. **API Authentication**:
   - JWT tokens for service-to-service communication
   - API keys for third-party integrations (GoCardless, Stripe)
   - OAuth 2.0 for authorizing access to third-party services

3. **License Authentication**:
   - License key validation for WHMCS instances
   - Domain verification to prevent unauthorized use
   - Regular verification against license server

### Password Management

For systems requiring password authentication:

- **Password Requirements**:
  - Minimum 12 characters
  - Mix of uppercase, lowercase, numbers, and special characters
  - Check against common password databases (Have I Been Pwned API)
  - Regular password rotation (90-180 days)

- **Password Storage**:
  - Store using Argon2id with appropriate parameters:
    ```python
    # Example of secure password hashing with Argon2
    from argon2 import PasswordHasher
    
    def hash_password(password):
        ph = PasswordHasher(
            time_cost=3,  # Number of iterations
            memory_cost=65536,  # Memory usage in kibibytes
            parallelism=4,  # Number of parallel threads
            hash_len=32,  # Length of the hash in bytes
            salt_len=16   # Length of the salt in bytes
        )
        return ph.hash(password)
    
    def verify_password(stored_hash, provided_password):
        ph = PasswordHasher()
        try:
            ph.verify(stored_hash, provided_password)
            return True
        except:
            return False
    ```

### Multi-Factor Authentication (MFA)

- **TOTP Implementation**:
  - Use pyotp library for TOTP generation and verification
  - Store MFA secret securely in the database (encrypted)
  - Generate backup recovery codes at MFA enrollment

```python
# MFA Setup example
import pyotp
import qrcode
from io import BytesIO
import base64

def setup_mfa(user_id, user_email):
    # Generate a random secret
    secret = pyotp.random_base32()
    
    # Create TOTP object
    totp = pyotp.TOTP(secret)
    
    # Generate provisioning URI for QR code
    provisioning_uri = totp.provisioning_uri(user_email, issuer_name="Payymo")
    
    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = BytesIO()
    img.save(buffered)
    qr_code_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    
    # Generate recovery codes
    recovery_codes = generate_recovery_codes(10)  # Generate 10 recovery codes
    
    # Store secret and recovery codes securely in database
    store_mfa_data(user_id, secret, recovery_codes)
    
    return {
        "secret": secret,
        "qr_code": qr_code_base64,
        "recovery_codes": recovery_codes
    }

def verify_mfa_code(user_id, provided_code):
    # Retrieve user's MFA secret from database
    secret = get_user_mfa_secret(user_id)
    
    if not secret:
        return False
    
    # Create TOTP object
    totp = pyotp.TOTP(secret)
    
    # Verify provided code
    return totp.verify(provided_code)
```

### Session Management

- **Secure Cookie Configuration**:
  ```python
  # Flask session cookie configuration
  app.config.update(
      SESSION_COOKIE_SECURE=True,
      SESSION_COOKIE_HTTPONLY=True,
      SESSION_COOKIE_SAMESITE='Lax',
      PERMANENT_SESSION_LIFETIME=timedelta(hours=12)
  )
  ```

- **Session Rotation**:
  - Generate new session ID after successful login
  - Rotate session upon security-sensitive operations
  - Invalidate session after password changes

## 2. Authorization Framework

### Role-Based Access Control (RBAC)

Payymo implements fine-grained RBAC with the following components:

1. **Roles**: Pre-defined sets of permissions assigned to users
   - `admin`: Full system access
   - `tenant_admin`: Full access to a specific tenant
   - `finance_manager`: Access to financial reports and transactions
   - `support_user`: Limited access for support staff
   - `api_user`: Programmatic access only
   - `read_only`: View-only access

2. **Permissions**: Specific actions that can be performed
   - Format: `resource:action` (e.g., `transactions:read`, `bank_connections:create`)
   - Grouped by resource type with standard actions (create, read, update, delete)

3. **Resources**: Objects that can be acted upon
   - Tenant-scoped resources (bank_connections, transactions, stripe_connections)
   - Global resources (users, settings, audit_logs)

```python
# RBAC Schema
role_permissions = {
    'admin': [
        'users:*',
        'tenants:*',
        'bank_connections:*',
        'transactions:*',
        'stripe_connections:*',
        'reports:*',
        'settings:*',
        'audit_logs:*'
    ],
    'tenant_admin': [
        'bank_connections:*',
        'transactions:*',
        'stripe_connections:*',
        'reports:*',
        'settings:read',
        'settings:update',
        'users:read',
        'users:create'
    ],
    'finance_manager': [
        'bank_connections:read',
        'transactions:read',
        'transactions:update',
        'stripe_connections:read',
        'reports:*'
    ],
    'support_user': [
        'bank_connections:read',
        'transactions:read',
        'stripe_connections:read',
        'reports:read'
    ],
    'read_only': [
        'bank_connections:read',
        'transactions:read',
        'stripe_connections:read',
        'reports:read'
    ]
}
```

### Authorization Implementation

Authorization is enforced at multiple levels:

1. **Route-Level Authorization**:
   ```python
   # Using a decorator for route-level permission checks
   from functools import wraps
   from flask import g, request, abort
   
   def requires_permission(permission):
       def decorator(f):
           @wraps(f)
           def decorated_function(*args, **kwargs):
               if not g.user:
                   abort(401)  # Unauthorized
               
               if not has_permission(g.user, permission):
                   abort(403)  # Forbidden
                   
               return f(*args, **kwargs)
           return decorated_function
       return decorator
   
   # Example route with permission check
   @app.route('/api/transactions', methods=['GET'])
   @requires_permission('transactions:read')
   def get_transactions():
       # Route implementation
       pass
   ```

2. **Service-Level Authorization**:
   ```python
   # Check permissions at the service layer
   def get_bank_connection(connection_id, user):
       # Fetch the bank connection
       connection = BankConnection.query.get(connection_id)
       
       if not connection:
           raise ResourceNotFoundError("Bank connection not found")
           
       # Check if user can access this connection
       if not can_access_resource(user, connection, 'bank_connections:read'):
           raise PermissionDeniedError("You don't have permission to access this bank connection")
           
       return connection
   ```

3. **Database-Level Access Control**:
   - Each resource includes tenant_id for tenant isolation
   - Queries filter by tenant_id to ensure data isolation

## 3. API Security

### JWT Implementation

For API authentication, Payymo uses JSON Web Tokens (JWTs) with the following configuration:

1. **JWT Configuration**:
   - Algorithm: RS256 (asymmetric)
   - Short-lived access tokens (15 minutes)
   - Longer-lived refresh tokens (7 days)

```python
# JWT Token Generation
import jwt
from datetime import datetime, timedelta
import os
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

# Load RSA keys
with open('private_key.pem', 'rb') as key_file:
    private_key = serialization.load_pem_private_key(
        key_file.read(),
        password=None,
        backend=default_backend()
    )

with open('public_key.pem', 'rb') as key_file:
    public_key = serialization.load_pem_public_key(
        key_file.read(),
        backend=default_backend()
    )

def generate_access_token(user_id, tenant_id, permissions):
    now = datetime.utcnow()
    payload = {
        'sub': str(user_id),
        'tenant_id': str(tenant_id),
        'permissions': permissions,
        'iat': now,
        'exp': now + timedelta(minutes=15),
        'type': 'access'
    }
    
    token = jwt.encode(
        payload,
        private_key,
        algorithm='RS256'
    )
    
    return token

def generate_refresh_token(user_id):
    now = datetime.utcnow()
    payload = {
        'sub': str(user_id),
        'iat': now,
        'exp': now + timedelta(days=7),
        'type': 'refresh',
        'jti': str(uuid.uuid4())  # Unique token ID for tracking
    }
    
    token = jwt.encode(
        payload,
        private_key,
        algorithm='RS256'
    )
    
    # Store token ID in database for tracking/revocation
    store_refresh_token(payload['jti'], user_id, payload['exp'])
    
    return token

def verify_token(token):
    try:
        payload = jwt.decode(
            token,
            public_key,
            algorithms=['RS256']
        )
        
        # For refresh tokens, verify they haven't been revoked
        if payload.get('type') == 'refresh':
            if is_token_revoked(payload['jti']):
                raise Exception("Token has been revoked")
        
        return payload
    except jwt.ExpiredSignatureError:
        raise Exception("Token has expired")
    except jwt.InvalidTokenError:
        raise Exception("Invalid token")
```

2. **Token Storage**:
   - Access tokens: Stored in memory (JavaScript variables)
   - Refresh tokens: HTTP-only, secure cookies

```python
# Setting refresh token in cookie
@app.route('/api/auth/login', methods=['POST'])
def login():
    # Authenticate user
    user = authenticate_user(request.json.get('username'), request.json.get('password'))
    
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Generate tokens
    access_token = generate_access_token(user.id, user.tenant_id, user.permissions)
    refresh_token = generate_refresh_token(user.id)
    
    response = jsonify({
        'access_token': access_token,
        'user': {
            'id': user.id,
            'name': user.name,
            'email': user.email,
            'tenant_id': user.tenant_id,
            'permissions': user.permissions
        }
    })
    
    # Set refresh token as HTTP-only cookie
    response.set_cookie(
        'refresh_token',
        refresh_token,
        httponly=True,
        secure=True,
        samesite='Lax',
        max_age=60*60*24*7  # 7 days
    )
    
    return response
```

3. **Token Refresh Mechanism**:
   - Implementation of token refresh with rotation
   - Detection of potentially compromised refresh tokens

```python
@app.route('/api/auth/refresh', methods=['POST'])
def refresh_token():
    # Get refresh token from cookie
    refresh_token = request.cookies.get('refresh_token')
    
    if not refresh_token:
        return jsonify({'error': 'No refresh token provided'}), 401
    
    try:
        # Verify refresh token
        payload = verify_token(refresh_token)
        
        # Check token type
        if payload.get('type') != 'refresh':
            return jsonify({'error': 'Invalid token type'}), 401
        
        # Get user from database
        user = get_user_by_id(payload['sub'])
        
        if not user:
            return jsonify({'error': 'User not found'}), 401
        
        # Generate new tokens
        new_access_token = generate_access_token(user.id, user.tenant_id, user.permissions)
        new_refresh_token = generate_refresh_token(user.id)
        
        # Revoke old refresh token
        revoke_refresh_token(payload['jti'])
        
        response = jsonify({
            'access_token': new_access_token
        })
        
        # Set new refresh token as HTTP-only cookie
        response.set_cookie(
            'refresh_token',
            new_refresh_token,
            httponly=True,
            secure=True,
            samesite='Lax',
            max_age=60*60*24*7  # 7 days
        )
        
        return response
    except Exception as e:
        return jsonify({'error': str(e)}), 401
```

### API Rate Limiting

Implement comprehensive rate limiting to protect against abuse and DoS attacks:

```python
# Rate limiting configuration
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# Authentication endpoints - stricter limits to prevent brute force
@app.route('/api/auth/login', methods=['POST'])
@limiter.limit("5 per minute")  # Prevent brute force attacks
def login():
    # Login implementation
    pass

# OAuth authorization endpoints
@app.route('/api/gocardless/auth', methods=['POST'])
@limiter.limit("10 per minute")  # Rate limiting for OAuth auth
def gocardless_auth():
    # Implementation
    pass

@app.route('/api/gocardless/callback', methods=['GET', 'POST'])
@limiter.limit("10 per minute")  # Rate limiting for OAuth callback
def gocardless_callback():
    # Implementation
    pass

# Matching and high-value transaction endpoints
@app.route('/api/match/apply', methods=['POST'])
@limiter.limit("15 per minute")  # Rate limiting for matching operations
def apply_match():
    # Implementation
    pass

# Data retrieval endpoints - higher limits for regular operational use
@app.route('/api/transactions/fetch', methods=['POST'])
@limiter.limit("30 per minute")  # Higher limit for transaction fetching
def fetch_transactions():
    # Implementation
    pass
```

The rate limiting strategy focuses on these key areas:

1. **Authentication**: Strict limits (5/min) to prevent credential stuffing and brute force attacks
2. **OAuth**: Moderate limits (10/min) to prevent OAuth abuse while allowing normal integration
3. **Critical Operations**: Controlled limits (15/min) for financial operations like matching
4. **Data Retrieval**: Higher limits (30/min) for regular operational endpoints
5. **License Validation**: Appropriate limits on license verification to prevent abuse

## 4. Data Protection

### Encryption at Rest

Sensitive data must be encrypted at rest:

1. **Database Field-Level Encryption**:
   - Sensitive fields (access tokens, credentials, personal information)
   - Separate encryption keys for different data categories

```python
# Example field-level encryption implementation
from cryptography.fernet import Fernet
import base64
import os

class FieldEncryptor:
    def __init__(self, key=None):
        if key is None:
            # Use environment variable or generate a new key
            key = os.environ.get('ENCRYPTION_KEY')
            if not key:
                key = Fernet.generate_key().decode('utf-8')
                print(f"Generated new encryption key: {key}")
        
        # Ensure key is in correct format
        if isinstance(key, str):
            key = key.encode('utf-8')
        
        self.fernet = Fernet(key)
    
    def encrypt(self, data):
        if data is None:
            return None
        
        # Convert data to string if not already
        if not isinstance(data, str):
            data = str(data)
        
        # Encrypt
        encrypted_data = self.fernet.encrypt(data.encode('utf-8'))
        
        # Return as base64 string for storage
        return base64.b64encode(encrypted_data).decode('utf-8')
    
    def decrypt(self, encrypted_data):
        if encrypted_data is None:
            return None
        
        # Decode from base64
        if isinstance(encrypted_data, str):
            encrypted_data = base64.b64decode(encrypted_data.encode('utf-8'))
        
        # Decrypt
        decrypted_data = self.fernet.decrypt(encrypted_data).decode('utf-8')
        
        return decrypted_data

# Usage in database models
class BankConnection(db.Model):
    __tablename__ = 'bank_connections'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    access_token_encrypted = db.Column(db.Text)
    refresh_token_encrypted = db.Column(db.Text)
    
    @property
    def access_token(self):
        encryptor = FieldEncryptor()
        return encryptor.decrypt(self.access_token_encrypted)
    
    @access_token.setter
    def access_token(self, value):
        encryptor = FieldEncryptor()
        self.access_token_encrypted = encryptor.encrypt(value)
    
    @property
    def refresh_token(self):
        encryptor = FieldEncryptor()
        return encryptor.decrypt(self.refresh_token_encrypted)
    
    @refresh_token.setter
    def refresh_token(self, value):
        encryptor = FieldEncryptor()
        self.refresh_token_encrypted = encryptor.encrypt(value)
```

2. **Transparent Database Encryption**:
   - Use PostgreSQL's encryption features
   - Consider full disk encryption for production deployments

### Secure External API Connections

Connections to third-party services (GoCardless, Stripe):

1. **API Key Management**:
   - Store API keys securely using field-level encryption
   - Rotate keys regularly according to provider recommendations
   - Implement separate keys for development/staging/production

2. **TLS Configuration**:
   - Enforce TLS 1.2+ for all API connections
   - Validate SSL certificates
   - Implement certificate pinning for critical connections

```python
# Secure external API connections
import requests
import ssl

def create_secure_session():
    session = requests.Session()
    
    # Configure TLS
    session.mount('https://', requests.adapters.HTTPAdapter(
        max_retries=3,
        ssl_version=ssl.PROTOCOL_TLSv1_2,
        ssl_minimum_version=ssl.TLSVersion.TLSv1_2
    ))
    
    # Set default timeouts
    session.request = lambda method, url, **kwargs: \
        requests.Session.request(
            session, method, url, 
            timeout=kwargs.pop('timeout', (3.05, 27)), 
            **kwargs
        )
    
    return session

def call_gocardless_api(endpoint, method='GET', data=None):
    # Get API key from secure storage
    api_key = get_encrypted_api_key('gocardless')
    
    session = create_secure_session()
    
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'GoCardless-Version': '2015-07-06'
    }
    
    base_url = 'https://api.gocardless.com'
    url = f"{base_url}/{endpoint}"
    
    try:
        response = session.request(
            method=method,
            url=url,
            headers=headers,
            json=data
        )
        
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        # Log error
        logger.error(f"GoCardless API error: {str(e)}")
        # Handle the error appropriately
        raise
```

## 5. Web Security Headers

Implement security headers to protect against common web vulnerabilities:

```python
# Using Flask-Talisman for security headers
from flask_talisman import Talisman

csp = {
    'default-src': "'self'",
    'script-src': [
        "'self'",
        'https://js.stripe.com',
        'https://cdn.jsdelivr.net'
    ],
    'style-src': [
        "'self'",
        'https://fonts.googleapis.com',
        'https://cdn.jsdelivr.net'
    ],
    'font-src': [
        "'self'",
        'https://fonts.gstatic.com'
    ],
    'img-src': [
        "'self'",
        'data:',
        'https://cdn.jsdelivr.net'
    ],
    'connect-src': [
        "'self'",
        'https://api.stripe.com'
    ],
    'frame-src': [
        "'self'",
        'https://js.stripe.com',
        'https://hooks.stripe.com'
    ],
    'form-action': "'self'",
    'frame-ancestors': "'none'",
    'base-uri': "'self'",
    'object-src': "'none'"
}

talisman = Talisman(
    app,
    content_security_policy=csp,
    content_security_policy_nonce_in=['script-src', 'style-src'],
    feature_policy={
        'geolocation': "'none'",
        'microphone': "'none'",
        'camera': "'none'",
        'payment': "'self'"
    },
    force_https=True,
    force_https_permanent=True,
    strict_transport_security=True,
    strict_transport_security_preload=True,
    strict_transport_security_max_age=31536000,
    strict_transport_security_include_subdomains=True,
    referrer_policy='strict-origin-when-cross-origin',
    session_cookie_secure=True,
    session_cookie_http_only=True
)
```

## 6. Input Validation and Sanitization

Implement thorough input validation to prevent injection attacks:

```python
# Using Marshmallow for schema validation
from marshmallow import Schema, fields, validate, ValidationError

class BankConnectionSchema(Schema):
    bank_id = fields.String(required=True, validate=validate.Length(min=1, max=100))
    account_id = fields.String(required=True, validate=validate.Length(min=1, max=100))
    account_name = fields.String(required=True, validate=validate.Length(min=1, max=255))
    tenant_id = fields.Integer(required=True)

# Using schema for validation in routes
@app.route('/api/bank-connections', methods=['POST'])
@requires_permission('bank_connections:create')
def create_bank_connection():
    schema = BankConnectionSchema()
    
    try:
        # Validate incoming data
        data = schema.load(request.json)
        
        # Check if tenant_id matches the user's tenant
        if data['tenant_id'] != g.user.tenant_id and not has_permission(g.user, 'admin'):
            return jsonify({'error': 'You can only create connections for your own tenant'}), 403
        
        # Process the validated data
        connection = create_bank_connection_service(data)
        
        return jsonify(schema.dump(connection)), 201
    except ValidationError as err:
        return jsonify({'error': 'Validation error', 'details': err.messages}), 400
    except Exception as e:
        logger.exception("Error creating bank connection")
        return jsonify({'error': 'Internal server error'}), 500
```

### SQL Injection Prevention

Use SQLAlchemy ORM to prevent SQL injection:

```python
# Safe query examples
def get_transactions_for_account(account_id, tenant_id):
    # Using SQLAlchemy ORM (safe from SQL injection)
    transactions = Transaction.query.filter_by(
        account_id=account_id,
        tenant_id=tenant_id
    ).all()
    
    return transactions

# If raw SQL is necessary, use parameterized queries
def get_transactions_by_date_range(account_id, start_date, end_date):
    query = text("""
        SELECT * FROM transactions
        WHERE account_id = :account_id
        AND transaction_date BETWEEN :start_date AND :end_date
        ORDER BY transaction_date DESC
    """)
    
    result = db.session.execute(
        query,
        {
            'account_id': account_id,
            'start_date': start_date,
            'end_date': end_date
        }
    )
    
    return result.fetchall()
```

## 7. CSRF Protection

Implement Cross-Site Request Forgery (CSRF) protection:

```python
# Using Flask-WTF for CSRF protection
from flask_wtf.csrf import CSRFProtect

csrf = CSRFProtect(app)

# Exempt certain routes if needed (e.g., API webhooks)
@csrf.exempt
@app.route('/api/webhooks/stripe', methods=['POST'])
def stripe_webhook():
    # Process webhook
    pass
```

## 8. Security Logging and Monitoring

Implement comprehensive security logging:

```python
# Security event logging
def log_security_event(event_type, user_id, details, ip_address):
    event = SecurityEvent(
        event_type=event_type,
        user_id=user_id,
        details=details,
        ip_address=ip_address,
        created_at=datetime.utcnow()
    )
    
    db.session.add(event)
    db.session.commit()
    
    # If critical event, trigger alert
    if event_type in ['login_failed', 'mfa_disabled', 'permission_escalation']:
        trigger_security_alert(event)

# Usage examples
@app.route('/api/auth/login', methods=['POST'])
def login():
    username = request.json.get('username')
    password = request.json.get('password')
    
    user = authenticate_user(username, password)
    
    if not user:
        log_security_event(
            'login_failed',
            None,
            {'username': username},
            request.remote_addr
        )
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Successful login
    log_security_event(
        'login_success',
        user.id,
        {'method': 'password'},
        request.remote_addr
    )
    
    # Continue with login process
    # ...
```

### Security Event Types

Track and alert on the following security events:

1. **Authentication Events**:
   - `login_success`: Successful login
   - `login_failed`: Failed login attempt
   - `logout`: User logout
   - `password_reset_requested`: Password reset requested
   - `password_changed`: Password changed
   - `mfa_enabled`: MFA enabled for account
   - `mfa_disabled`: MFA disabled for account
   - `mfa_failed`: Failed MFA verification

2. **Authorization Events**:
   - `permission_denied`: User attempted unauthorized action
   - `permission_changed`: User permissions modified
   - `role_assigned`: Role assigned to user
   - `role_removed`: Role removed from user

3. **Resource Access Events**:
   - `sensitive_data_accessed`: Access to sensitive data
   - `api_key_created`: New API key created
   - `api_key_revoked`: API key revoked

4. **System Events**:
   - `rate_limit_exceeded`: Rate limiting applied to request
   - `suspicious_activity`: Potential security threat detected
   - `configuration_changed`: Security-related configuration changed

## 9. Regular Security Audits

Implement a regular security audit program:

1. **Automated Scanning**:
   - Dependency vulnerability scanning in CI/CD pipeline
   - Static application security testing (SAST)
   - Dynamic application security testing (DAST)

2. **Manual Reviews**:
   - Regular code reviews with security focus
   - Penetration testing before major releases
   - Third-party security assessments annually

3. **Security Response Plan**:
   - Documented procedure for handling security incidents
   - Regular testing of security response procedures
   - Post-incident reviews and improvement process

## 10. Implementation Checklist

- [ ] Implement secure authentication with strong password requirements
- [ ] Enable multi-factor authentication for all user accounts
- [ ] Establish comprehensive role-based access control
- [ ] Implement JWT-based API authentication
- [ ] Set up field-level encryption for sensitive data
- [ ] Configure security headers for all HTTP responses
- [ ] Implement input validation and sanitization
- [ ] Set up CSRF protection for all forms
- [ ] Establish comprehensive security logging
- [ ] Implement regular automated vulnerability scanning
- [ ] Create and test security incident response plan