# Payymo API Reference

This document provides comprehensive documentation for the Payymo REST API endpoints. The backend service exposes these endpoints for integration with WHMCS and other services.

## API Base URL

All API endpoints are relative to your backend service URL, for example:
```
https://payymo-backend.yourdomain.com/api
```

## Authentication

Most API endpoints require authentication using one of the following methods:

### License Key Authentication

Used for license verification and basic WHMCS module API calls:

```
Headers:
  X-License-Key: your_license_key
  X-Domain: your_whmcs_domain.com
```

### API Token Authentication

Used for more secure operations:

```
Headers:
  Authorization: Bearer {token}
```

## API Endpoints

### License Management

#### Verify License

```
POST /license/verify
```

Verifies a license key for a specific domain.

**Request:**
```json
{
  "license_key": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "domain": "example.com",
  "ip_address": "192.0.2.1" 
}
```

**Response:**
```json
{
  "success": true,
  "valid": true,
  "expires_at": "2026-03-22T00:00:00Z",
  "features": {
    "max_banks": 5,
    "max_transactions": 1000,
    "stripe_enabled": true
  }
}
```

#### Get License Info

```
GET /license/info
```

Gets detailed information about a license key.

**Headers:**
```
X-License-Key: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
X-Domain: example.com
```

**Response:**
```json
{
  "success": true,
  "license": {
    "key": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "status": "active",
    "owner_name": "Example Company",
    "owner_email": "admin@example.com",
    "created_at": "2025-01-01T00:00:00Z",
    "expires_at": "2026-03-22T00:00:00Z",
    "last_verified": "2025-03-22T12:34:56Z",
    "allowed_domains": ["example.com", "test.example.com"],
    "max_banks": 5,
    "max_transactions": 1000,
    "features": {
      "stripe_enabled": true,
      "client_area_enabled": true
    }
  }
}
```

### Bank Connections (GoCardless)

#### Get Authorization URL

```
POST /gocardless/auth
```

Gets a GoCardless authorization URL for initiating the OAuth flow.

**Headers:**
```
X-License-Key: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
X-Domain: example.com
```

**Request:**
```json
{
  "redirect_uri": "https://example.com/module/callback"
}
```

**Response:**
```json
{
  "success": true,
  "auth_url": "https://gocardless.com/oauth/authorize?client_id=xxx&redirect_uri=xxx&state=xxx",
  "state": "random_state_token"
}
```

#### Process OAuth Callback

```
POST /gocardless/callback
```

Processes the OAuth callback from GoCardless after user authorization.

**Request:**
```json
{
  "code": "authorization_code_from_gocardless",
  "state": "state_token_from_auth_request"
}
```

**Response:**
```json
{
  "success": true,
  "bank_connection": {
    "id": 1,
    "bank_id": "bank_identifier",
    "bank_name": "Example Bank",
    "account_id": "account_identifier",
    "account_name": "Business Account",
    "status": "active"
  }
}
```

#### Fetch Bank Transactions

```
GET /gocardless/transactions
```

Fetches transactions from a connected bank account.

**Headers:**
```
X-License-Key: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
X-Domain: example.com
```

**Parameters:**
```
account_id=account_identifier
from_date=2025-01-01 (optional)
to_date=2025-03-22 (optional)
```

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "id": 1,
      "transaction_id": "tx_123456",
      "bank_id": "bank_identifier",
      "bank_name": "Example Bank",
      "account_id": "account_identifier",
      "account_name": "Business Account",
      "amount": 100.50,
      "currency": "GBP",
      "description": "Payment for invoice #12345",
      "reference": "INV-12345",
      "transaction_date": "2025-03-15T14:30:00Z",
      "created_at": "2025-03-15T14:35:10Z"
    },
    // Additional transactions...
  ]
}
```

### Invoice Matching

#### Find Invoice Matches

```
POST /match/transaction
```

Finds possible invoice matches for a transaction.

**Headers:**
```
X-License-Key: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
X-Domain: example.com
```

**Request:**
```json
{
  "transaction_id": "tx_123456"
}
```

**Response:**
```json
{
  "success": true,
  "matches": [
    {
      "id": 1,
      "transaction_id": "tx_123456",
      "whmcs_invoice_id": 12345,
      "confidence": 0.95,
      "match_reason": "Reference exact match, amount match, client name in description",
      "status": "pending"
    },
    {
      "id": 2,
      "transaction_id": "tx_123456",
      "whmcs_invoice_id": 12346,
      "confidence": 0.45,
      "match_reason": "Amount match only",
      "status": "pending"
    }
  ]
}
```

#### Apply Match

```
POST /match/apply
```

Applies a match between a transaction and an invoice.

**Headers:**
```
X-License-Key: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
X-Domain: example.com
```

**Request:**
```json
{
  "match_id": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Match applied successfully",
  "whmcs_transaction_id": 5678,
  "status": "Payment applied to invoice #12345"
}
```

#### Reject Match

```
POST /match/reject
```

Rejects a match between a transaction and an invoice.

**Headers:**
```
X-License-Key: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
X-Domain: example.com
```

**Request:**
```json
{
  "match_id": 2
}
```

**Response:**
```json
{
  "success": true,
  "message": "Match rejected successfully"
}
```

### Stripe Integration

#### Get Authorization URL

```
POST /stripe/auth
```

Gets a Stripe authorization URL for initiating the OAuth flow.

**Headers:**
```
X-License-Key: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
X-Domain: example.com
```

**Request:**
```json
{
  "redirect_uri": "https://example.com/module/stripe_callback"
}
```

**Response:**
```json
{
  "success": true,
  "auth_url": "https://connect.stripe.com/oauth/authorize?client_id=xxx&redirect_uri=xxx&state=xxx",
  "state": "random_state_token"
}
```

#### Process OAuth Callback

```
POST /stripe/callback
```

Processes the OAuth callback from Stripe after user authorization.

**Request:**
```json
{
  "code": "authorization_code_from_stripe",
  "state": "state_token_from_auth_request"
}
```

**Response:**
```json
{
  "success": true,
  "stripe_connection": {
    "id": 1,
    "account_id": "acct_1234567890",
    "account_name": "Example Business",
    "account_email": "business@example.com",
    "status": "active",
    "account_type": "standard",
    "account_country": "GB"
  }
}
```

#### Fetch Stripe Payments

```
GET /stripe/payments
```

Fetches payments from a connected Stripe account.

**Headers:**
```
X-License-Key: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
X-Domain: example.com
```

**Parameters:**
```
account_id=acct_1234567890
from_date=2025-01-01 (optional)
to_date=2025-03-22 (optional)
```

**Response:**
```json
{
  "success": true,
  "payments": [
    {
      "id": 1,
      "payment_id": "py_123456",
      "customer_id": "cus_123456",
      "customer_name": "John Doe",
      "customer_email": "john@example.com",
      "amount": 99.99,
      "currency": "USD",
      "description": "Payment for invoice #12345",
      "payment_date": "2025-03-10T12:00:00Z",
      "payment_status": "succeeded",
      "payment_method": "card",
      "payment_metadata": {
        "invoice_id": "12345"
      }
    },
    // Additional payments...
  ]
}
```

#### Get Account Balance

```
GET /stripe/balance
```

Gets the current balance for a Stripe account.

**Headers:**
```
X-License-Key: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
X-Domain: example.com
```

**Parameters:**
```
account_id=acct_1234567890
```

**Response:**
```json
{
  "success": true,
  "balance": {
    "available": [
      {
        "amount": 25000,
        "currency": "usd",
        "source_types": {
          "card": 25000
        }
      },
      {
        "amount": 15000,
        "currency": "eur",
        "source_types": {
          "card": 15000
        }
      }
    ],
    "pending": [
      {
        "amount": 5000,
        "currency": "usd",
        "source_types": {
          "card": 5000
        }
      }
    ]
  }
}
```

### Testing API

#### Health Check

```
GET /health-check
```

Checks the health of the API service.

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2025-03-22T12:34:56Z"
}
```

## Error Responses

All API endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "invalid_license",
    "message": "The provided license key is invalid",
    "details": "License key has expired"
  }
}
```

Common error codes:

| Code | Description |
|------|-------------|
| `invalid_license` | The license key is invalid or expired |
| `invalid_domain` | The domain is not authorized for this license |
| `auth_failed` | Authentication failed |
| `not_found` | Requested resource not found |
| `invalid_request` | Invalid request parameters |
| `api_error` | Error in external API (GoCardless or Stripe) |
| `server_error` | Internal server error |

## Rate Limiting

API endpoints have specific rate limits to ensure platform stability and prevent abuse. Different endpoints have different rate limits based on their sensitivity and expected usage patterns:

| Endpoint Category | Rate Limit | Rationale |
|-------------------|------------|-----------|
| Authentication (login) | 5 per minute | Prevent brute force attacks |
| License verification | 20 per minute | Normal operational use |
| Transaction operations | 30 per minute | Higher volume for regular operations |
| OAuth authorization | 10 per minute | Prevent OAuth abuse |
| Match/apply operations | 15 per minute | Moderate usage for financial operations |
| Balance/reporting | 20 per minute | Normal operational use |

If you exceed a rate limit, you'll receive a `429 Too Many Requests` response with a `Retry-After` header indicating when you can retry.

### Rate Limit Headers

All responses include rate limit headers:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 29
X-RateLimit-Reset: 1714517870
```

- `X-RateLimit-Limit`: The maximum number of requests allowed in the current period
- `X-RateLimit-Remaining`: The number of requests remaining in the current period
- `X-RateLimit-Reset`: The time at which the current rate limit window resets (Unix timestamp)

## Webhooks

The Payymo backend can send webhooks to your WHMCS installation for important events:

### Webhook Authentication

Webhooks include a signature header for verification:

```
X-Payymo-Signature: sha256=hash_of_payload_with_secret
```

Verify this signature using your webhook secret to ensure the webhook is legitimate.

### Webhook Events

| Event Type | Description |
|------------|-------------|
| `transaction.new` | New transaction detected |
| `match.found` | Match found between transaction and invoice |
| `match.applied` | Match applied successfully |
| `match.rejected` | Match rejected |
| `bank.connected` | New bank connection established |
| `bank.expired` | Bank connection token expired |
| `stripe.connected` | New Stripe account connected |
| `stripe.payment.new` | New Stripe payment detected |

### Example Webhook Payload

```json
{
  "event": "transaction.new",
  "timestamp": "2025-03-22T12:34:56Z",
  "data": {
    "transaction_id": "tx_123456",
    "bank_id": "bank_identifier",
    "bank_name": "Example Bank",
    "amount": 100.50,
    "currency": "GBP",
    "reference": "INV-12345"
  }
}
```

## SDK Support

Official SDKs are available for the following languages:

- PHP (for WHMCS integration)
- JavaScript (for client-side integration)
- Python (for backend integration)

## Further Assistance

If you need further assistance with the API, please contact our support team:

- Email: support@payymo.com
- Support Portal: https://support.payymo.com