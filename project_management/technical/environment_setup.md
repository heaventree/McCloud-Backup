# Environment Setup Guide

This guide provides instructions for setting up the development environment for the Payymo project, including all required environment variables and configuration steps.

## Required Software

- Python 3.11 or higher
- PostgreSQL 14 or higher
- Node.js 18 or higher (for frontend asset compilation)
- pip (Python package manager)
- Git

## Environment Variables

The following environment variables must be set for the application to function properly:

### Core Application Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@localhost/payymo` |
| `SESSION_SECRET` | Secret key for Flask sessions | `your-secure-random-string` |
| `DEBUG` | Enable debug mode | `True` or `False` |
| `FLASK_ENV` | Flask environment | `development` or `production` |
| `PORT` | Application port | `5000` |

### GoCardless API Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GOCARDLESS_CLIENT_ID` | GoCardless API client ID | `your-client-id` |
| `GOCARDLESS_CLIENT_SECRET` | GoCardless API client secret | `your-client-secret` |
| `GOCARDLESS_SANDBOX_MODE` | Use GoCardless sandbox | `True` or `False` |
| `GOCARDLESS_WEBHOOK_SECRET` | Secret for webhook verification | `your-webhook-secret` |
| `GOCARDLESS_REDIRECT_URI` | OAuth redirect URI | `https://your-domain.com/api/gocardless/callback` |

### Stripe API Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `STRIPE_API_KEY` | Stripe API secret key | `sk_test_123456789` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_test_123456789` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_123456789` |
| `STRIPE_CLIENT_ID` | For Connect OAuth flow | `ca_123456789` |

### WHMCS Integration Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `WHMCS_API_IDENTIFIER` | WHMCS API identifier | `your-identifier` |
| `WHMCS_API_SECRET` | WHMCS API secret | `your-api-secret` |
| `WHMCS_ADMIN_USER` | WHMCS admin username | `admin` |
| `WHMCS_ENDPOINT` | WHMCS API endpoint | `https://your-whmcs-install.com/includes/api.php` |

### Security and Certificates

| Variable | Description | Example |
|----------|-------------|---------|
| `SSL_CERT_PATH` | Path to SSL certificate | `/path/to/cert.pem` |
| `SSL_KEY_PATH` | Path to SSL private key | `/path/to/key.pem` |
| `WEBHOOK_SSL_VERIFY` | Verify SSL for webhooks | `True` or `False` |

## Setting Up Environment Variables

### Using a .env File (Development)

Create a `.env` file in the project root with the following content:

```
DATABASE_URL=postgresql://username:password@localhost/payymo
SESSION_SECRET=your-secure-random-string
DEBUG=True
FLASK_ENV=development
PORT=5000

GOCARDLESS_CLIENT_ID=your-client-id
GOCARDLESS_CLIENT_SECRET=your-client-secret
GOCARDLESS_SANDBOX_MODE=True
GOCARDLESS_WEBHOOK_SECRET=your-webhook-secret
GOCARDLESS_REDIRECT_URI=http://localhost:5000/api/gocardless/callback

STRIPE_API_KEY=sk_test_123456789
STRIPE_PUBLISHABLE_KEY=pk_test_123456789
STRIPE_WEBHOOK_SECRET=whsec_123456789

WHMCS_API_IDENTIFIER=your-identifier
WHMCS_API_SECRET=your-api-secret
WHMCS_ADMIN_USER=admin
WHMCS_ENDPOINT=https://your-whmcs-install.com/includes/api.php
```

### Setting Environment Variables on Production

For production environments, set variables through your hosting platform's environment configuration.

For example, with Replit:
- Use the Secrets tab to add each environment variable

## Database Setup

1. Create a PostgreSQL database:
   ```bash
   createdb payymo
   ```

2. The application will automatically create tables on first run.

## SSL Certificate Setup

For using webhooks with GoCardless, you'll need SSL certificates:

1. Generate self-signed certificates for development:
   ```bash
   mkdir -p flask_backend/certs
   cd flask_backend/certs
   openssl req -x509 -newkey rsa:4096 -keyout webhook_key.pem -out webhook_cert.pem -days 365 -nodes
   ```

2. For production, use proper SSL certificates from a trusted authority.

## Starting the Application

After configuring all environment variables and setting up the database:

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the application:
   ```bash
   python main.py
   ```

3. Access the dashboard at http://localhost:5000

## Troubleshooting

If you encounter issues with environment setup, check:

1. Database connectivity - ensure PostgreSQL is running and accessible
2. API credentials - verify keys are valid and have proper permissions
3. SSL certificates - check paths and that they're properly formatted
4. Webhook URLs - ensure they're accessible from external services

For detailed error monitoring, check the application logs.