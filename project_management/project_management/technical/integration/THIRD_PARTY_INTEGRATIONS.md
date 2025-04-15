# Third-Party Integrations for Payymo

This document outlines the integration standards and implementation guidelines for Payymo's connections with external services and APIs. It also details the requirements for Payymo's own API that will be exposed to external systems.

## 1. Core Application API

### Purpose and Goals

Payymo provides a comprehensive RESTful API that enables:

1. **Multi-tenant SaaS operation**: Allowing WHMCS instances to connect seamlessly
2. **Banking data access**: Providing standardized access to transaction data
3. **Reconciliation workflows**: Enabling automated matching and processing
4. **White-label integration**: Supporting partner-branded instances
5. **Extension development**: Allowing customers to build custom solutions

### API Design Standards

#### RESTful Resource Design

The API follows RESTful principles with resources aligning to business objects:

| Resource | Endpoints | Description |
|----------|-----------|-------------|
| `/api/v1/bank-connections` | GET, POST, PATCH, DELETE | Manage bank connections |
| `/api/v1/transactions` | GET, POST | Retrieve and create transactions |
| `/api/v1/stripe-connections` | GET, POST, PATCH, DELETE | Manage Stripe connections |
| `/api/v1/invoice-matches` | GET, POST, PATCH | Manage invoice matching |
| `/api/v1/tenants` | GET, POST, PATCH, DELETE | Manage tenant information |
| `/api/v1/users` | GET, POST, PATCH, DELETE | Manage user accounts |
| `/api/v1/webhooks` | GET, POST, DELETE | Manage webhook subscriptions |

#### Request and Response Format

All API requests and responses use JSON:

```json
// Example GET /api/v1/transactions response
{
  "data": [
    {
      "id": "txn_12345",
      "transaction_id": "12345abcde",
      "bank_id": "bank_67890",
      "bank_name": "HSBC",
      "account_id": "acc_12345",
      "account_name": "Business Account",
      "amount": 1250.00,
      "currency": "GBP",
      "description": "Invoice payment",
      "reference": "INV-2025-001",
      "transaction_date": "2025-04-10T14:30:00Z",
      "created_at": "2025-04-10T14:35:22Z",
      "status": "processed"
    },
    // Additional transactions
  ],
  "pagination": {
    "total_items": 156,
    "total_pages": 16,
    "current_page": 1,
    "per_page": 10
  },
  "meta": {
    "request_id": "req_abcdef123456"
  }
}
```

#### Error Handling

API errors follow a consistent structure:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "The request is missing required parameters",
    "details": [
      {"field": "account_id", "issue": "This field is required"},
      {"field": "amount", "issue": "Amount must be greater than zero"}
    ],
    "request_id": "req_abcdef123456"
  }
}
```

Standard error codes:

| Status Code | Error Code | Description |
|-------------|------------|-------------|
| 400 | invalid_request | Request is missing parameters or contains invalid data |
| 401 | authentication_required | Authentication is required or failed |
| 403 | permission_denied | User doesn't have permission for the action |
| 404 | resource_not_found | The requested resource doesn't exist |
| 409 | resource_conflict | The resource already exists or conflicts with another |
| 422 | validation_failed | Request validation failed |
| 429 | rate_limit_exceeded | Rate limit has been exceeded |
| 500 | server_error | An unexpected server error occurred |

### Authentication and Authorization

#### API Key Authentication

The primary authentication method is API key-based:

```
Authorization: Bearer pk_live_abcdef123456
```

API keys have the following characteristics:

1. **Tenant-Scoped**: Each key is associated with a specific tenant
2. **Permission-Based**: Keys are restricted to specific permissions
3. **Revocable**: Keys can be invalidated at any time
4. **Auditable**: All API key usage is logged and trackable

Implementation:

```python
# API Key Authentication in Flask
from flask import request, g, jsonify
from functools import wraps

def api_key_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get API key from header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': {
                'code': 'authentication_required',
                'message': 'API key is required'
            }}), 401
        
        api_key = auth_header.replace('Bearer ', '')
        
        # Validate API key
        tenant = validate_api_key(api_key)
        if not tenant:
            return jsonify({'error': {
                'code': 'authentication_required',
                'message': 'Invalid or expired API key'
            }}), 401
        
        # Store tenant info in request context
        g.tenant = tenant
        
        return f(*args, **kwargs)
    return decorated_function

def validate_api_key(api_key):
    # Validate API key against database
    # Return tenant if valid, None if invalid
    # This is a placeholder implementation
    api_key_record = ApiKey.query.filter_by(key_prefix=api_key[:8]).first()
    
    if not api_key_record:
        return None
    
    # Verify the API key using constant-time comparison
    if not compare_digest(api_key_record.key_hash, hash_api_key(api_key)):
        return None
    
    # Check if API key is expired
    if api_key_record.expires_at and api_key_record.expires_at < datetime.utcnow():
        return None
    
    # Get associated tenant
    tenant = Tenant.query.get(api_key_record.tenant_id)
    
    return tenant
```

#### OAuth 2.0 Integration (For Future Implementation)

For more complex scenarios, Payymo will implement OAuth 2.0:

1. **Client Credentials Flow**: For server-to-server integrations
2. **Authorization Code Flow**: For user-delegated permissions
3. **Refresh Token Rotation**: For maintaining secure access

### Versioning Strategy

API versioning is implemented through URI path prefixing:

```
/api/v1/transactions   # Version 1
/api/v2/transactions   # Version 2
```

Versioning policies:

1. **Compatibility Promise**: No breaking changes within a version
2. **Deprecation Notice**: Minimum 6-month deprecation period for legacy versions
3. **Changelog Documentation**: All changes between versions are documented

### Rate Limiting

To ensure fair usage and system stability:

1. **Per-Tenant Limits**: 
   - 1000 requests per minute per tenant (standard tier)
   - 5000 requests per minute per tenant (premium tier)

2. **Endpoint-Specific Limits**:
   - `/api/v1/transactions`: 200 requests per minute
   - `/api/v1/bank-connections`: 50 requests per minute

3. **Rate Limit Headers**:
   ```
   X-RateLimit-Limit: 1000
   X-RateLimit-Remaining: 995
   X-RateLimit-Reset: 1617321600
   ```

Implementation:

```python
# Rate limiting in Flask using Flask-Limiter
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app,
    key_func=get_tenant_identifier,  # Custom function to identify tenant
    default_limits=["1000 per minute"],
    storage_uri="redis://localhost:6379"
)

def get_tenant_identifier():
    # Get tenant identifier from request context
    # This is used for rate limiting based on tenant
    if hasattr(g, 'tenant') and g.tenant:
        return str(g.tenant.id)
    return get_remote_address()

# Apply different limits to different endpoints
@app.route('/api/v1/transactions')
@limiter.limit("200 per minute")
@api_key_required
def get_transactions():
    # Implementation
    pass

@app.route('/api/v1/bank-connections', methods=['POST'])
@limiter.limit("50 per minute")
@api_key_required
def create_bank_connection():
    # Implementation
    pass
```

### Documentation

API documentation uses the OpenAPI (Swagger) specification:

1. **Interactive Documentation**: Swagger UI for exploring and testing endpoints
2. **Automated Generation**: Documentation generated from code comments and annotations
3. **Examples**: Comprehensive request/response examples for all endpoints
4. **SDKs**: Auto-generated client libraries for common languages

```python
# Using Flask-RESTX for OpenAPI documentation
from flask_restx import Api, Resource, fields

api = Api(
    app, 
    version='1.0', 
    title='Payymo API',
    description='Financial data integration API',
    doc='/api/docs',
    authorizations={
        'apikey': {
            'type': 'apiKey',
            'in': 'header',
            'name': 'Authorization'
        }
    },
    security='apikey'
)

# Define namespaces
ns_transactions = api.namespace('transactions', description='Transaction operations')
ns_bank_connections = api.namespace('bank-connections', description='Bank connection operations')

# Define models
transaction_model = api.model('Transaction', {
    'id': fields.String(required=True, description='Transaction ID'),
    'transaction_id': fields.String(required=True, description='External transaction ID'),
    'bank_id': fields.String(required=True, description='Bank ID'),
    'amount': fields.Float(required=True, description='Transaction amount'),
    'currency': fields.String(required=True, description='Currency code'),
    'description': fields.String(description='Transaction description'),
    'transaction_date': fields.DateTime(required=True, description='Date of transaction')
})

# Define endpoints
@ns_transactions.route('/')
class TransactionList(Resource):
    @ns_transactions.doc('list_transactions')
    @ns_transactions.marshal_list_with(transaction_model)
    def get(self):
        '''List all transactions'''
        return get_transactions()
```

## 2. Banking Integration (GoCardless API)

Payymo integrates with GoCardless for Open Banking functionality:

### Connection and Authentication

1. **API Keys**: Keys are securely stored with field-level encryption
2. **Environment Isolation**: Separate keys for development, staging, and production
3. **Safe Credential Handling**: No hardcoding of credentials in code

```python
# GoCardless API integration
import gocardless_pro
from cryptography.fernet import Fernet

def get_gocardless_client(tenant_id):
    # Retrieve encrypted API key from database
    tenant = Tenant.query.get(tenant_id)
    encrypted_api_key = tenant.gocardless_api_key_encrypted
    
    # Decrypt API key
    decryption_key = os.environ.get('ENCRYPTION_KEY')
    f = Fernet(decryption_key)
    api_key = f.decrypt(encrypted_api_key).decode()
    
    # Initialize GoCardless client
    environment = 'sandbox' if os.environ.get('ENVIRONMENT') != 'production' else 'live'
    
    client = gocardless_pro.Client(
        access_token=api_key,
        environment=environment
    )
    
    return client
```

### Bank Connection Flow

1. **Initiation**: Create a bank authorization request
2. **Redirect**: Send user to bank's authentication page
3. **Callback**: Process the authorization response
4. **Token Storage**: Securely store access and refresh tokens
5. **Refresh Management**: Handle token expiration and refreshing

```python
# Bank connection initialization
@app.route('/api/v1/bank-connections/initialize', methods=['POST'])
@api_key_required
def initialize_bank_connection():
    # Create bank authorization request
    client = get_gocardless_client(g.tenant.id)
    
    redirect_url = request.json.get('redirect_url')
    
    try:
        authorization_request = client.bank_authorisations.create(params={
            "redirect_uri": redirect_url,
            "resources": {
                "accounts": {"account_number_required": True},
                "transactions": {}
            }
        })
        
        return jsonify({
            "authorization_url": authorization_request.authorisation_url,
            "authorization_id": authorization_request.id
        })
    except Exception as e:
        return jsonify({'error': {
            'code': 'bank_integration_error',
            'message': str(e)
        }}), 500
```

### Transaction Retrieval

1. **Scheduled Fetching**: Regular polling for new transactions
2. **Data Normalization**: Standardizing transaction formats
3. **Deduplication**: Preventing duplicate transaction imports
4. **Pagination**: Handling large transaction volumes efficiently

```python
# Transaction retrieval
def fetch_transactions(bank_connection):
    client = get_gocardless_client(bank_connection.tenant_id)
    
    # Fetch transactions from the last successful sync date
    start_date = bank_connection.last_sync_date or (datetime.utcnow() - timedelta(days=90))
    
    try:
        # Fetch account details first
        account = client.accounts.get(bank_connection.account_id)
        
        # Then fetch transactions
        transactions = []
        current_page = None
        
        while True:
            # Get page of transactions
            params = {
                "account_id": bank_connection.account_id,
                "from_date": start_date.strftime("%Y-%m-%d")
            }
            
            if current_page:
                params["after"] = current_page
            
            response = client.transactions.list(params=params)
            
            # Process transactions
            for transaction in response.records:
                # Create or update transaction in database
                process_transaction(bank_connection, transaction)
                transactions.append(transaction)
            
            # Check for more pages
            if response.meta.cursors.after:
                current_page = response.meta.cursors.after
            else:
                break
        
        # Update last sync date
        bank_connection.last_sync_date = datetime.utcnow()
        db.session.commit()
        
        return transactions
    except Exception as e:
        logger.error(f"Error fetching transactions: {str(e)}")
        raise
```

## 3. Payment Processing (Stripe API)

Payymo integrates with Stripe for payment processing:

### Connection and Authentication

1. **Stripe Connect**: Allow tenants to connect their Stripe accounts
2. **OAuth Flow**: Securely handle authentication and permissions
3. **Token Storage**: Securely store access and refresh tokens

```python
# Stripe Connect initialization
@app.route('/api/v1/stripe-connections/initialize', methods=['POST'])
@api_key_required
def initialize_stripe_connection():
    # Get tenant from request context
    tenant = g.tenant
    
    # Create OAuth link
    redirect_url = request.json.get('redirect_url')
    
    oauth_link = f"https://connect.stripe.com/oauth/authorize?response_type=code&client_id={os.environ.get('STRIPE_CLIENT_ID')}&scope=read_write&redirect_uri={redirect_url}&state={tenant.id}"
    
    return jsonify({
        "authorization_url": oauth_link
    })

# Stripe Connect callback handling
@app.route('/api/v1/stripe-connections/callback', methods=['POST'])
@api_key_required
def stripe_connection_callback():
    code = request.json.get('code')
    tenant_id = request.json.get('state')
    
    # Verify tenant ID matches the authenticated tenant
    if str(g.tenant.id) != tenant_id:
        return jsonify({'error': {
            'code': 'permission_denied',
            'message': 'Tenant ID mismatch'
        }}), 403
    
    try:
        # Exchange code for access token
        response = requests.post('https://connect.stripe.com/oauth/token', data={
            'client_secret': os.environ.get('STRIPE_SECRET_KEY'),
            'grant_type': 'authorization_code',
            'code': code
        })
        
        if response.status_code != 200:
            return jsonify({'error': {
                'code': 'stripe_integration_error',
                'message': 'Failed to exchange code for access token'
            }}), 500
        
        data = response.json()
        
        # Store connection in database
        stripe_connection = StripeConnection(
            tenant_id=g.tenant.id,
            account_id=data['stripe_user_id'],
            access_token=data['access_token'],
            refresh_token=data.get('refresh_token'),
            token_expires_at=datetime.utcnow() + timedelta(days=90) if data.get('refresh_token') else None,
            publishable_key=data['stripe_publishable_key'],
            status='active'
        )
        
        db.session.add(stripe_connection)
        db.session.commit()
        
        return jsonify({
            "connection_id": stripe_connection.id,
            "account_id": stripe_connection.account_id
        })
    except Exception as e:
        return jsonify({'error': {
            'code': 'stripe_integration_error',
            'message': str(e)
        }}), 500
```

### Payment Data Retrieval

1. **Scheduled Fetching**: Regular polling for new payments
2. **Webhook Integration**: Real-time updates on payment events
3. **Data Normalization**: Standardizing payment formats
4. **Reconciliation**: Matching Stripe payments with bank transactions

```python
# Fetch Stripe payments
def fetch_stripe_payments(stripe_connection, from_date=None):
    # Get tenant's Stripe connection
    if not from_date:
        from_date = stripe_connection.last_sync_date or (datetime.utcnow() - timedelta(days=30))
    
    # Convert datetime to Unix timestamp
    from_timestamp = int(from_date.timestamp())
    
    try:
        # Initialize Stripe with the connected account's access token
        stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')
        
        # Fetch payments (Stripe charges)
        payments = []
        has_more = True
        starting_after = None
        
        while has_more:
            params = {
                "created": {"gte": from_timestamp},
                "limit": 100
            }
            
            if starting_after:
                params["starting_after"] = starting_after
            
            charges = stripe.Charge.list(
                stripe_account=stripe_connection.account_id,
                **params
            )
            
            # Process charges
            for charge in charges.data:
                # Create or update payment in database
                process_stripe_payment(stripe_connection, charge)
                payments.append(charge)
            
            # Check for more pages
            has_more = charges.has_more
            if has_more and charges.data:
                starting_after = charges.data[-1].id
        
        # Update last sync date
        stripe_connection.last_sync_date = datetime.utcnow()
        db.session.commit()
        
        return payments
    except Exception as e:
        logger.error(f"Error fetching Stripe payments: {str(e)}")
        raise
```

### Webhook Handling

```python
# Stripe webhook handling
@app.route('/webhooks/stripe', methods=['POST'])
def stripe_webhook():
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')
    
    try:
        # Verify webhook signature
        event = stripe.Webhook.construct_event(
            payload, sig_header, os.environ.get('STRIPE_WEBHOOK_SECRET')
        )
        
        # Handle specific event types
        if event.type == 'charge.succeeded':
            handle_charge_succeeded(event.data.object)
        elif event.type == 'charge.failed':
            handle_charge_failed(event.data.object)
        # Add more event handlers as needed
        
        return jsonify({'status': 'success'})
    except ValueError as e:
        # Invalid payload
        return jsonify({'error': 'Invalid payload'}), 400
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        return jsonify({'error': 'Invalid signature'}), 400
    except Exception as e:
        # Other errors
        logger.exception("Error processing Stripe webhook")
        return jsonify({'error': str(e)}), 500
```

## 4. Webhook System (Outbound Notifications)

Payymo implements an outbound webhook system to notify external systems of events:

### Webhook Subscription Management

1. **Subscription Creation**: API for registering webhook endpoints
2. **Event Types**: Support for various event types (transaction.created, match.created, etc.)
3. **Security**: Signed payloads for webhook verification

```python
# Webhook subscription model
class WebhookSubscription(db.Model):
    __tablename__ = 'webhook_subscriptions'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    url = db.Column(db.String(255), nullable=False)
    events = db.Column(db.Text, nullable=False)  # JSON array of event types
    secret = db.Column(db.String(64), nullable=False)  # Used for signing payloads
    active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    tenant = db.relationship('Tenant', backref='webhook_subscriptions')

# Webhook subscription API
@app.route('/api/v1/webhooks', methods=['POST'])
@api_key_required
def create_webhook():
    # Validate request
    url = request.json.get('url')
    events = request.json.get('events')
    
    if not url or not events:
        return jsonify({'error': {
            'code': 'invalid_request',
            'message': 'URL and events are required'
        }}), 400
    
    # Generate webhook secret
    webhook_secret = secrets.token_hex(32)
    
    # Create webhook subscription
    subscription = WebhookSubscription(
        tenant_id=g.tenant.id,
        url=url,
        events=json.dumps(events),
        secret=webhook_secret,
        active=True
    )
    
    db.session.add(subscription)
    db.session.commit()
    
    return jsonify({
        'id': subscription.id,
        'url': subscription.url,
        'events': events,
        'secret': webhook_secret,  # Only return secret on creation
        'created_at': subscription.created_at.isoformat()
    }), 201
```

### Webhook Delivery

1. **Asynchronous Processing**: Queue-based webhook delivery
2. **Retry Logic**: Exponential backoff for failed deliveries
3. **Delivery Logging**: Tracking of webhook delivery attempts

```python
# Webhook delivery function
def deliver_webhook(event_type, payload, tenant_id):
    # Find all active webhook subscriptions for this tenant and event type
    subscriptions = WebhookSubscription.query.filter_by(
        tenant_id=tenant_id,
        active=True
    ).all()
    
    for subscription in subscriptions:
        # Check if subscription is interested in this event type
        events = json.loads(subscription.events)
        if event_type not in events:
            continue
        
        # Prepare webhook payload
        webhook_payload = {
            'event_type': event_type,
            'tenant_id': tenant_id,
            'timestamp': datetime.utcnow().isoformat(),
            'data': payload
        }
        
        # Generate signature
        timestamp = int(time.time())
        payload_string = json.dumps(webhook_payload)
        signature_payload = f"{timestamp}.{payload_string}"
        signature = hmac.new(
            subscription.secret.encode(),
            signature_payload.encode(),
            hashlib.sha256
        ).hexdigest()
        
        # Set headers with signature
        headers = {
            'Content-Type': 'application/json',
            'X-Payymo-Signature': f"t={timestamp},v1={signature}"
        }
        
        # Queue webhook delivery (using Celery or similar)
        deliver_webhook_task.delay(
            subscription.id,
            subscription.url,
            webhook_payload,
            headers
        )

# Webhook delivery task (Celery task)
@celery.task(bind=True, max_retries=5)
def deliver_webhook_task(self, subscription_id, url, payload, headers):
    try:
        # Attempt to deliver webhook
        response = requests.post(
            url,
            json=payload,
            headers=headers,
            timeout=10
        )
        
        # Log delivery attempt
        log_webhook_delivery(
            subscription_id=subscription_id,
            status_code=response.status_code,
            response_body=response.text[:1000],  # Truncate long responses
            success=response.status_code >= 200 and response.status_code < 300
        )
        
        # Raise exception for non-2xx responses
        response.raise_for_status()
    except requests.RequestException as e:
        # Log delivery failure
        log_webhook_delivery(
            subscription_id=subscription_id,
            status_code=None,
            response_body=str(e),
            success=False
        )
        
        # Retry with exponential backoff
        retry_count = self.request.retries
        backoff = 60 * (2 ** retry_count)  # 60s, 120s, 240s, 480s, 960s
        
        # Raise exception to trigger retry
        raise self.retry(exc=e, countdown=backoff)
```

## 5. WHMCS Integration

Payymo integrates with WHMCS for billing and client management:

### Connection Setup

1. **API Authentication**: Secure storage and usage of WHMCS API credentials
2. **Module Integration**: WHMCS module for streamlined setup
3. **Domain Verification**: Ensuring legitimate WHMCS installations

```python
# WHMCS instance model
class WhmcsInstance(db.Model):
    __tablename__ = 'whmcs_instances'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    domain = db.Column(db.String(255), nullable=False)
    api_identifier = db.Column(db.String(255))
    api_secret = db.Column(db.Text)  # Encrypted
    admin_user = db.Column(db.String(100))
    webhook_secret = db.Column(db.String(64))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_seen = db.Column(db.DateTime, default=datetime.utcnow)
    
    tenant = db.relationship('Tenant', backref='whmcs_instances')

# WHMCS API function
def call_whmcs_api(whmcs_instance, action, params=None):
    if params is None:
        params = {}
    
    # Get API credentials
    encryptor = FieldEncryptor()
    api_secret = encryptor.decrypt(whmcs_instance.api_secret)
    
    # Prepare request
    url = f"https://{whmcs_instance.domain}/includes/api.php"
    
    # Add standard params
    request_params = {
        'identifier': whmcs_instance.api_identifier,
        'secret': api_secret,
        'action': action,
        'responsetype': 'json'
    }
    
    # Add custom params
    request_params.update(params)
    
    try:
        # Make request
        response = requests.post(url, data=request_params, timeout=30)
        response.raise_for_status()
        
        # Parse response
        data = response.json()
        
        # Check for WHMCS API errors
        if data.get('result') == 'error':
            raise Exception(f"WHMCS API error: {data.get('message')}")
        
        return data
    except Exception as e:
        logger.error(f"WHMCS API error: {str(e)}")
        raise
```

### Invoice Matching

1. **Automatic Matching**: Algorithm for matching bank transactions to WHMCS invoices
2. **Confidence Scoring**: Assigning confidence levels to potential matches
3. **Human Review**: Interface for reviewing low-confidence matches

```python
# Invoice matching function
def match_transaction_to_invoices(transaction, whmcs_instance):
    # Get transaction details
    amount = transaction.amount
    reference = transaction.reference
    description = transaction.description
    
    # Fetch unpaid invoices from WHMCS
    invoices = fetch_unpaid_invoices(whmcs_instance)
    
    matches = []
    
    for invoice in invoices:
        # Calculate confidence score
        confidence = calculate_match_confidence(
            transaction=transaction,
            invoice=invoice
        )
        
        if confidence > 0:
            matches.append({
                'invoice_id': invoice['id'],
                'confidence': confidence,
                'match_reason': generate_match_reason(transaction, invoice, confidence)
            })
    
    # Sort matches by confidence (highest first)
    matches.sort(key=lambda x: x['confidence'], reverse=True)
    
    # Return matches
    return matches

def calculate_match_confidence(transaction, invoice):
    confidence = 0
    reasons = []
    
    # Check exact amount match
    if abs(transaction.amount - float(invoice['total'])) < 0.01:
        confidence += 0.6
        reasons.append("amount_exact_match")
    # Check close amount match (within 1%)
    elif abs(transaction.amount - float(invoice['total'])) / float(invoice['total']) < 0.01:
        confidence += 0.4
        reasons.append("amount_close_match")
    else:
        # No amount match
        return 0  # If amount doesn't match at all, it's not a match
    
    # Check reference number match
    if transaction.reference and invoice['id'] in transaction.reference:
        confidence += 0.3
        reasons.append("reference_contains_invoice_id")
    
    # Check client name match
    if transaction.description and invoice['client']['name'].lower() in transaction.description.lower():
        confidence += 0.2
        reasons.append("description_contains_client_name")
    
    # Cap confidence at 1.0
    confidence = min(confidence, 1.0)
    
    return confidence
```

## 6. Implementation Checklist

### Core API

- [ ] Design and implement RESTful API endpoints
- [ ] Implement API key authentication system
- [ ] Create API documentation with OpenAPI
- [ ] Set up rate limiting and monitoring
- [ ] Implement comprehensive logging and error handling

### Banking Integration

- [ ] Implement GoCardless API connection
- [ ] Create bank authorization flow
- [ ] Build transaction retrieval and storage
- [ ] Set up scheduled synchronization jobs
- [ ] Implement webhook handling for real-time updates

### Payment Processing

- [ ] Set up Stripe Connect integration
- [ ] Implement OAuth flow for account connection
- [ ] Create payment data retrieval system
- [ ] Set up webhook handling for payment events
- [ ] Build reconciliation system for payments

### WHMCS Integration

- [ ] Create WHMCS module for easy installation
- [ ] Implement API connection and authentication
- [ ] Build invoice fetching and matching system
- [ ] Create interface for managing WHMCS connections
- [ ] Implement automatic payment application