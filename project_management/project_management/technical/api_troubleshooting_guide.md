# API Troubleshooting Guide

This guide documents common API integration challenges and their solutions based on our experience with various external services. Use it as a reference when troubleshooting API issues in your projects.

## Table of Contents

1. [Authentication Issues](#authentication-issues)
2. [Rate Limiting](#rate-limiting)
3. [Request Formatting](#request-formatting)
4. [Response Handling](#response-handling)
5. [Connection Problems](#connection-problems)
6. [Webhooks](#webhooks)
7. [OAuth Flows](#oauth-flows)
8. [Testing and Mocking](#testing-and-mocking)
9. [API-Specific Solutions](#api-specific-solutions)

## Authentication Issues

### Common Problems

1. **Expired Credentials**
   - **Symptoms**: 401 Unauthorized responses, "invalid_token" or "expired_token" error messages
   - **Solutions**: 
     - Implement token refresh mechanisms
     - Add expiration checking before API calls
     - Store token creation time and refresh proactively

2. **Incorrect Authentication Headers**
   - **Symptoms**: 401 Unauthorized, "missing authorization" errors
   - **Solutions**:
     - Double-check header format (e.g., `Bearer` prefix for JWT)
     - Verify encoding (Base64 for Basic Auth)
     - Check for whitespace or formatting issues

3. **Environment Variables**
   - **Symptoms**: Authentication fails in production but works in development
   - **Solutions**:
     - Verify environment variables are correctly set in all environments
     - Check for trailing whitespace in environment variables
     - Implement startup validation for required credentials

### Authentication Solution Pattern

```python
class APIAuthManager:
    """Manager for API authentication"""
    
    def __init__(self, api_key=None, client_id=None, client_secret=None):
        self.api_key = api_key or os.environ.get("API_KEY")
        self.client_id = client_id or os.environ.get("CLIENT_ID")
        self.client_secret = client_secret or os.environ.get("CLIENT_SECRET")
        self.token = None
        self.token_expiry = None
        
        # Validate required credentials
        self._validate_credentials()
    
    def _validate_credentials(self):
        """Validate that required credentials are available"""
        if not self.api_key and not (self.client_id and self.client_secret):
            raise ValueError("Either API key or client credentials must be provided")
    
    def get_auth_header(self):
        """Get authentication header for API requests"""
        # If using token-based auth
        if self.token and self.is_token_valid():
            return {"Authorization": f"Bearer {self.token}"}
        
        # If token expired or not set, refresh it
        if self.client_id and self.client_secret:
            self.refresh_token()
            return {"Authorization": f"Bearer {self.token}"}
        
        # If using API key
        if self.api_key:
            return {"Authorization": f"Bearer {self.api_key}"}
            # Some APIs use different formats like:
            # return {"X-API-Key": self.api_key}
            # return {"Authorization": f"ApiKey {self.api_key}"}
        
        raise ValueError("No valid authentication method available")
    
    def is_token_valid(self):
        """Check if the current token is valid and not expired"""
        if not self.token or not self.token_expiry:
            return False
        
        # Add buffer time (30 seconds) to avoid edge cases
        return datetime.now() + timedelta(seconds=30) < self.token_expiry
    
    def refresh_token(self):
        """Refresh the access token using client credentials"""
        try:
            response = requests.post(
                "https://api.example.com/oauth/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret
                }
            )
            response.raise_for_status()
            data = response.json()
            
            self.token = data["access_token"]
            # Calculate expiry time from expires_in (in seconds)
            self.token_expiry = datetime.now() + timedelta(seconds=data["expires_in"])
            
        except requests.exceptions.RequestException as e:
            raise AuthenticationError(f"Failed to refresh token: {str(e)}")
```

## Rate Limiting

### Common Problems

1. **Exceeding Rate Limits**
   - **Symptoms**: 429 Too Many Requests responses, sudden failures during high traffic
   - **Solutions**:
     - Implement exponential backoff and retry
     - Add request throttling or queuing
     - Monitor usage and adjust request patterns

2. **Inconsistent Rate Limit Information**
   - **Symptoms**: Unexpected rate limiting despite staying under documented limits
   - **Solutions**:
     - Parse rate limit headers (X-RateLimit-Remaining, X-RateLimit-Reset)
     - Dynamically adjust request frequency based on remaining quota
     - Implement a distributed rate limiter for multi-server setups

### Rate Limiting Solution Pattern

```python
class RateLimitHandler:
    """Handler for API rate limiting"""
    
    def __init__(self):
        self.rate_limits = {}  # Endpoint -> (remaining, reset_time)
        self.retry_delays = [1, 2, 4, 8, 16, 32]  # Exponential backoff
    
    def update_limits(self, endpoint, response):
        """Update rate limit information from response headers"""
        remaining = response.headers.get("X-RateLimit-Remaining")
        reset = response.headers.get("X-RateLimit-Reset")
        
        if remaining is not None and reset is not None:
            self.rate_limits[endpoint] = (
                int(remaining),
                datetime.fromtimestamp(int(reset))
            )
    
    def should_retry(self, endpoint, response, attempt):
        """Determine if and when a request should be retried"""
        # If not rate limited, no need to retry
        if response.status_code != 429:
            return False, 0
        
        # If we've exceeded max retries, give up
        if attempt >= len(self.retry_delays):
            return False, 0
        
        # Check for Retry-After header
        retry_after = response.headers.get("Retry-After")
        if retry_after:
            # Retry-After can be seconds or HTTP date
            try:
                delay = int(retry_after)
            except ValueError:
                # Parse HTTP date format
                retry_date = datetime.strptime(retry_after, "%a, %d %b %Y %H:%M:%S %Z")
                delay = max(0, (retry_date - datetime.now()).total_seconds())
            
            return True, delay
        
        # Use exponential backoff if no Retry-After
        return True, self.retry_delays[attempt]
    
    def wait_if_needed(self, endpoint):
        """Wait if rate limit is close to being exceeded"""
        if endpoint in self.rate_limits:
            remaining, reset_time = self.rate_limits[endpoint]
            
            # If very few requests remaining, wait until reset
            if remaining <= 2:  # Buffer of 2 requests
                wait_time = max(0, (reset_time - datetime.now()).total_seconds())
                if wait_time > 0:
                    time.sleep(wait_time)
```

## Request Formatting

### Common Problems

1. **Invalid JSON Structures**
   - **Symptoms**: 400 Bad Request, "invalid_request" errors
   - **Solutions**:
     - Validate request bodies before sending
     - Use schema validation libraries (pydantic, zod)
     - Implement request logging for debugging

2. **Character Encoding Issues**
   - **Symptoms**: Corrupted data, unicode errors
   - **Solutions**:
     - Explicitly set content encoding (UTF-8)
     - Sanitize input data before sending
     - Handle encoding conversions explicitly

3. **Date/Time Format Issues**
   - **Symptoms**: Timezone inconsistencies, rejected dates
   - **Solutions**:
     - Always use ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)
     - Be explicit about timezones (prefer UTC)
     - Implement date/time conversion utilities

### Request Validation Pattern

```python
from pydantic import BaseModel, ValidationError
from typing import Dict, Any, Optional, List
import json

class APIRequest:
    """Base class for API request validation and formatting"""
    
    def __init__(self, endpoint: str, method: str = "GET"):
        self.endpoint = endpoint
        self.method = method
        self.headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    
    def validate(self, data: Dict[str, Any], schema_class) -> Dict[str, Any]:
        """Validate request data against a schema"""
        try:
            validated = schema_class(**data)
            return validated.dict(exclude_none=True)
        except ValidationError as e:
            errors = e.errors()
            error_messages = []
            
            for error in errors:
                location = ".".join(str(x) for x in error["loc"])
                error_messages.append(f"{location}: {error['msg']}")
            
            raise ValueError(f"Request validation failed: {'; '.join(error_messages)}")
    
    def prepare_request(self, data: Dict[str, Any] = None, params: Dict[str, Any] = None,
                       headers: Dict[str, Any] = None):
        """Prepare the request for sending"""
        request_data = {
            "method": self.method,
            "url": self.endpoint,
            "headers": {**self.headers, **(headers or {})}
        }
        
        if data is not None:
            # Ensure data is properly serialized
            request_data["json"] = data
        
        if params is not None:
            request_data["params"] = params
        
        return request_data
```

## Response Handling

### Common Problems

1. **Unexpected Response Formats**
   - **Symptoms**: KeyError, TypeError when parsing responses
   - **Solutions**:
     - Use defensive parsing with fallbacks
     - Implement response schemas
     - Add proper error handling for parsing failures

2. **Empty or Null Responses**
   - **Symptoms**: NoneType errors, empty data handling issues
   - **Solutions**:
     - Check for None/empty values before accessing properties
     - Provide default values for missing fields
     - Validate response completeness

3. **Large Response Handling**
   - **Symptoms**: Memory issues, timeouts when processing large responses
   - **Solutions**:
     - Use streaming responses
     - Implement pagination
     - Process large responses incrementally

### Response Handling Pattern

```python
class APIResponse:
    """Wrapper for API responses with enhanced error handling"""
    
    def __init__(self, response):
        self.status_code = response.status_code
        self.headers = response.headers
        self.raw_response = response
        self._parsed_data = None
    
    @property
    def successful(self):
        """Check if the response was successful (2xx status code)"""
        return 200 <= self.status_code < 300
    
    @property
    def data(self):
        """Parse and return response data with error handling"""
        if self._parsed_data is None:
            try:
                self._parsed_data = self.raw_response.json()
            except ValueError:
                # Not JSON or empty response
                self._parsed_data = {}
        
        return self._parsed_data
    
    def get_value(self, key_path, default=None):
        """
        Safely get a value from the response using a dot-notation path
        Example: response.get_value("data.items.0.id")
        """
        parts = key_path.split(".")
        value = self.data
        
        for part in parts:
            try:
                # Handle array indexing
                if part.isdigit() and isinstance(value, list):
                    idx = int(part)
                    if idx < len(value):
                        value = value[idx]
                    else:
                        return default
                # Handle dictionary keys
                elif isinstance(value, dict) and part in value:
                    value = value[part]
                else:
                    return default
            except (KeyError, TypeError, IndexError):
                return default
        
        return value
    
    def validate_against_schema(self, schema_class):
        """Validate response against a schema"""
        try:
            validated = schema_class(**self.data)
            return validated
        except ValidationError as e:
            # Log validation errors but return data anyway
            logging.warning(f"Response validation failed: {e}")
            return self.data
    
    def iter_pages(self, page_key="page", total_key="total_pages", data_key="items"):
        """Generator for paginated responses"""
        current_page = self.get_value(page_key, 1)
        total_pages = self.get_value(total_key)
        
        # Return first page data
        yield self.get_value(data_key, [])
        
        # If more pages, make additional requests
        if total_pages and current_page < total_pages:
            # Implementation depends on specific API pagination approach
            pass
```

## Connection Problems

### Common Problems

1. **Timeout Issues**
   - **Symptoms**: Request timeouts, hanging connections
   - **Solutions**:
     - Set appropriate timeout values
     - Implement connection pooling
     - Use async requests for long-running operations

2. **SSL/TLS Verification**
   - **Symptoms**: SSL verification failures, certificate errors
   - **Solutions**:
     - Update CA certificates
     - Handle self-signed certificates correctly
     - Implement proper certificate verification

3. **Network Interruptions**
   - **Symptoms**: Connection reset, sudden failures
   - **Solutions**:
     - Implement retry logic
     - Use circuit breaker pattern
     - Add logging for network-related issues

### Connection Management Pattern

```python
import requests
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

class APIConnectionManager:
    """Manages HTTP connections to APIs with retry and timeout handling"""
    
    def __init__(
        self,
        base_url,
        timeout=(3.05, 27),  # (connect, read) - Slightly off values avoid thundering herd problem
        max_retries=3,
        backoff_factor=0.3,
        retry_on=(500, 502, 503, 504, 429)
    ):
        self.base_url = base_url
        self.timeout = timeout
        
        # Configure session with retries
        self.session = requests.Session()
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=backoff_factor,
            status_forcelist=retry_on,
            allowed_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
    
    def request(self, method, endpoint, **kwargs):
        """Make a request with proper error handling"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        # Set default timeout if not provided
        if "timeout" not in kwargs:
            kwargs["timeout"] = self.timeout
        
        try:
            return self.session.request(method, url, **kwargs)
        except requests.exceptions.ConnectTimeout:
            raise ConnectionError(f"Connection timed out when connecting to {url}")
        except requests.exceptions.ReadTimeout:
            raise ConnectionError(f"Read timed out when reading from {url}")
        except requests.exceptions.ConnectionError:
            raise ConnectionError(f"Connection failed to {url}")
        except requests.exceptions.SSLError:
            raise ConnectionError(f"SSL verification failed for {url}")
        except requests.exceptions.RequestException as e:
            raise ConnectionError(f"Request failed: {str(e)}")
```

## Webhooks

### Common Problems

1. **Webhook Verification**
   - **Symptoms**: Failed signature validation, rejected webhooks
   - **Solutions**:
     - Implement proper signature verification
     - Check for timestamp validity
     - Validate webhook source IP addresses

2. **Duplicate Events**
   - **Symptoms**: Same webhook received multiple times
   - **Solutions**:
     - Store and check webhook IDs
     - Implement idempotent webhook processing
     - Add duplicate detection logic

3. **Webhook Reliability**
   - **Symptoms**: Missed events, out-of-order events
   - **Solutions**:
     - Implement webhook logging
     - Create a webhook recovery process
     - Use webhook replays when available

### Webhook Handling Pattern

```python
import hmac
import hashlib
import time
import json
from flask import request, abort

class WebhookHandler:
    """Handler for secure webhook processing"""
    
    def __init__(self, secret):
        self.secret = secret.encode('utf-8')
        self.processed_ids = set()  # In production, use Redis or database
    
    def verify_signature(self, signature, payload, timestamp):
        """Verify webhook signature"""
        # Common pattern: HMAC signature of timestamp + payload
        message = f"{timestamp}.{payload}"
        expected_signature = hmac.new(
            self.secret,
            message.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(expected_signature, signature)
    
    def verify_timestamp(self, timestamp, max_age=300):
        """Verify webhook timestamp is recent"""
        try:
            event_time = int(timestamp)
            current_time = int(time.time())
            return current_time - event_time <= max_age
        except (ValueError, TypeError):
            return False
    
    def process_webhook(self):
        """Process an incoming webhook"""
        # Get webhook metadata
        signature = request.headers.get('X-Webhook-Signature')
        timestamp = request.headers.get('X-Webhook-Timestamp')
        
        if not signature or not timestamp:
            abort(400, "Missing webhook signature or timestamp")
        
        # Get payload
        payload = request.get_data(as_text=True)
        
        # Verify signature and timestamp
        if not self.verify_signature(signature, payload, timestamp):
            abort(401, "Invalid webhook signature")
        
        if not self.verify_timestamp(timestamp):
            abort(400, "Webhook timestamp too old")
        
        # Parse payload
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            abort(400, "Invalid JSON payload")
        
        # Check for duplicate webhook
        webhook_id = data.get('id')
        if webhook_id:
            if webhook_id in self.processed_ids:
                # Return 200 for duplicates (idempotent)
                return {"status": "success", "message": "Webhook already processed"}
            
            self.processed_ids.add(webhook_id)
        
        # Process webhook based on event type
        event_type = data.get('type')
        if event_type == 'payment.created':
            self._handle_payment_created(data)
        elif event_type == 'account.updated':
            self._handle_account_updated(data)
        # Add other event types as needed
        
        return {"status": "success"}
    
    def _handle_payment_created(self, data):
        """Handle payment.created webhook event"""
        # Implementation specific to payment.created events
        pass
    
    def _handle_account_updated(self, data):
        """Handle account.updated webhook event"""
        # Implementation specific to account.updated events
        pass
```

## OAuth Flows

### Common Problems

1. **Redirect URI Mismatches**
   - **Symptoms**: OAuth errors about redirect URI mismatch
   - **Solutions**:
     - Ensure exact match between configured and requested URIs
     - Check for protocol (http vs https) consistency
     - Verify no trailing slashes or query parameters unless expected

2. **State Parameter Management**
   - **Symptoms**: CSRF vulnerabilities, broken auth flows
   - **Solutions**:
     - Generate and validate state parameters
     - Store state in server-side session
     - Include expiration for state values

3. **Refresh Token Handling**
   - **Symptoms**: Users unexpectedly logged out, token expiration issues
   - **Solutions**:
     - Implement proactive token refreshing
     - Store refresh tokens securely
     - Handle refresh failures gracefully

### OAuth Flow Pattern

```python
import os
import time
import secrets
import base64
import requests
from flask import request, redirect, session, url_for
from urllib.parse import urlencode

class OAuthManager:
    """Manager for OAuth 2.0 flows"""
    
    def __init__(self, client_id, client_secret, auth_url, token_url, redirect_uri):
        self.client_id = client_id
        self.client_secret = client_secret
        self.auth_url = auth_url
        self.token_url = token_url
        self.redirect_uri = redirect_uri
    
    def generate_state(self):
        """Generate a secure state parameter for CSRF protection"""
        state = secrets.token_urlsafe(32)
        expiration = int(time.time()) + 600  # 10 minutes
        
        # Store in session
        session['oauth_state'] = state
        session['oauth_state_exp'] = expiration
        
        return state
    
    def validate_state(self, state):
        """Validate the state parameter from callback"""
        stored_state = session.get('oauth_state')
        expiration = session.get('oauth_state_exp', 0)
        
        # Clear from session
        session.pop('oauth_state', None)
        session.pop('oauth_state_exp', None)
        
        if not stored_state or stored_state != state:
            return False
        
        if int(time.time()) > expiration:
            return False
        
        return True
    
    def get_authorization_url(self, scope='read', **kwargs):
        """Generate authorization URL for OAuth flow"""
        state = self.generate_state()
        
        params = {
            'client_id': self.client_id,
            'redirect_uri': self.redirect_uri,
            'response_type': 'code',
            'scope': scope,
            'state': state
        }
        
        # Add any additional parameters
        params.update(kwargs)
        
        return f"{self.auth_url}?{urlencode(params)}"
    
    def exchange_code_for_token(self, code, state):
        """Exchange authorization code for access token"""
        # Validate state parameter
        if not self.validate_state(state):
            raise ValueError("Invalid state parameter")
        
        data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': self.redirect_uri
        }
        
        response = requests.post(self.token_url, data=data)
        response.raise_for_status()
        
        return response.json()
    
    def refresh_access_token(self, refresh_token):
        """Refresh an expired access token"""
        data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token
        }
        
        response = requests.post(self.token_url, data=data)
        response.raise_for_status()
        
        return response.json()
```

## Testing and Mocking

### Common Problems

1. **Realistic Test Data**
   - **Symptoms**: Tests pass but production fails
   - **Solutions**:
     - Use production-like test data
     - Implement comprehensive edge cases
     - Test with different API versions

2. **Mocking Consistency**
   - **Symptoms**: Tests don't match actual API behavior
   - **Solutions**:
     - Update mocks when API changes
     - Record and replay real API responses
     - Test against sandbox environments periodically

3. **Authentication in Tests**
   - **Symptoms**: Auth-related test failures
   - **Solutions**:
     - Use test credentials
     - Mock authentication in tests
     - Create isolated test environments

### API Testing Pattern

```python
import pytest
import responses
import json
import os
from pathlib import Path

class APITester:
    """Helper class for API testing with response recording and replaying"""
    
    def __init__(self, base_url, fixtures_path):
        self.base_url = base_url
        self.fixtures_path = Path(fixtures_path)
        self.fixtures_path.mkdir(exist_ok=True, parents=True)
        self.recording = os.environ.get("RECORD_API_FIXTURES") == "1"
    
    def get_fixture_path(self, endpoint, method="get"):
        """Get path for fixture file based on endpoint and method"""
        # Convert endpoint to valid filename
        safe_endpoint = endpoint.replace("/", "_").strip("_")
        return self.fixtures_path / f"{safe_endpoint}_{method.lower()}.json"
    
    def mock_response(self, method, endpoint, status=200, body=None, recording=False):
        """Mock an API response, optionally recording from real API"""
        fixture_path = self.get_fixture_path(endpoint, method)
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        # If recording or fixture doesn't exist, don't mock
        if recording or self.recording:
            return
        
        # If body provided, use it
        if body:
            responses.add(
                getattr(responses, method.upper()),
                url,
                json=body,
                status=status
            )
            return
        
        # Check for fixture
        if fixture_path.exists():
            with open(fixture_path, "r") as f:
                fixture_data = json.load(f)
                responses.add(
                    getattr(responses, method.upper()),
                    url,
                    json=fixture_data.get("body"),
                    status=fixture_data.get("status", 200),
                    headers=fixture_data.get("headers", {})
                )
        else:
            raise ValueError(f"No fixture found for {endpoint} ({method})")
    
    def save_response(self, method, endpoint, response):
        """Save API response to fixture file"""
        if not self.recording:
            return
        
        fixture_path = self.get_fixture_path(endpoint, method)
        
        try:
            body = response.json()
        except ValueError:
            body = response.text
        
        fixture_data = {
            "status": response.status_code,
            "headers": dict(response.headers),
            "body": body
        }
        
        with open(fixture_path, "w") as f:
            json.dump(fixture_data, f, indent=2)
```

## API-Specific Solutions

### Stripe API

1. **Webhook Event Types**
   - **Issue**: Handling numerous event types and nested data structures
   - **Solution**: Use a dispatching pattern with event-specific handlers
   ```python
   def handle_stripe_webhook():
       event = stripe.Webhook.construct_event(
           request.data, request.headers['Stripe-Signature'], webhook_secret
       )
       
       event_handlers = {
           'payment_intent.succeeded': handle_payment_success,
           'payment_intent.payment_failed': handle_payment_failure,
           # Add other event types
       }
       
       handler = event_handlers.get(event.type)
       if handler:
           return handler(event.data.object)
       
       # Acknowledge unhandled events to prevent retries
       return {'status': 'success', 'message': f'Unhandled event: {event.type}'}
   ```

2. **Idempotent Requests**
   - **Issue**: Preventing duplicate operations
   - **Solution**: Use Stripe's Idempotency-Key header
   ```python
   def create_payment_intent(amount, currency, idempotency_key=None):
       idempotency_key = idempotency_key or str(uuid.uuid4())
       
       return stripe.PaymentIntent.create(
           amount=amount,
           currency=currency,
           # Other parameters...
           idempotency_key=idempotency_key
       )
   ```

### GoCardless Open Banking API

1. **Certificate-Based Authentication**
   - **Issue**: Configuring client certificates for API calls
   - **Solution**: Properly configure client certificates in requests
   ```python
   def make_gocardless_request(endpoint, method="GET", data=None):
       cert_path = os.path.join(app.root_path, 'certs', 'client_cert.pem')
       key_path = os.path.join(app.root_path, 'certs', 'client_key.pem')
       
       response = requests.request(
           method,
           f"{GOCARDLESS_API_URL}/{endpoint}",
           json=data,
           cert=(cert_path, key_path),
           headers={
               "Authorization": f"Bearer {GOCARDLESS_ACCESS_TOKEN}",
               "Content-Type": "application/json"
           }
       )
       
       response.raise_for_status()
       return response.json()
   ```

2. **Handling Bank Connections**
   - **Issue**: Managing connections to multiple banks
   - **Solution**: Implement a bank connection service with proper token management
   ```python
   class BankConnectionService:
       def __init__(self, db):
           self.db = db
       
       def get_available_banks(self, country_code="GB"):
           # API call to get available banks
           
       def create_bank_connection(self, bank_id, redirect_uri):
           # API call to initialize connection
           
       def process_callback(self, code, state):
           # Process OAuth callback and store connection
           
       def refresh_token(self, connection_id):
           # Refresh expired access token
           
       def fetch_accounts(self, connection_id):
           # Get accounts for a connection
           
       def fetch_transactions(self, account_id, from_date=None, to_date=None):
           # Get transactions for an account
   ```

### OAuth Service Patterns

1. **Multi-Provider OAuth**
   - **Issue**: Supporting multiple OAuth providers with different requirements
   - **Solution**: Create provider-specific configurations with a common interface
   ```python
   class OAuthProviderFactory:
       @staticmethod
       def get_provider(provider_name):
           providers = {
               'google': GoogleOAuthProvider,
               'github': GitHubOAuthProvider,
               'stripe': StripeOAuthProvider,
               'gocardless': GoCardlessOAuthProvider
           }
           
           provider_class = providers.get(provider_name.lower())
           if not provider_class:
               raise ValueError(f"Unsupported OAuth provider: {provider_name}")
           
           return provider_class()
       
   class BaseOAuthProvider:
       def get_authorization_url(self, redirect_uri, state, **kwargs):
           raise NotImplementedError
       
       def exchange_code_for_token(self, code, redirect_uri):
           raise NotImplementedError
       
       def refresh_token(self, refresh_token):
           raise NotImplementedError
   
   class StripeOAuthProvider(BaseOAuthProvider):
       # Stripe-specific implementation
   
   class GoCardlessOAuthProvider(BaseOAuthProvider):
       # GoCardless-specific implementation
   ```

## Conclusion

This API troubleshooting guide documents the challenges we've encountered and the solutions we've developed for various external API integrations. By following these patterns and being aware of common issues, you can build more robust integrations with fewer surprises in production.

Remember these key principles:

1. **Always validate** input and output data
2. **Implement proper error handling** with specific error types
3. **Use retry mechanisms** for transient failures
4. **Plan for rate limiting** with backoff strategies
5. **Secure your authentication** and keep credentials safe
6. **Test thoroughly** with real-world scenarios
7. **Log API interactions** for troubleshooting