# GoCardless Webhooks Integration Guide

This document explains how the Payymo application integrates with GoCardless webhooks to receive real-time updates about bank transactions and account status changes.

## Overview

GoCardless sends webhook notifications to our application whenever important events occur, such as:
- New transactions being processed
- Changes to bank account connections
- Authorization status updates
- Error notifications

These webhooks allow our application to maintain up-to-date transaction information without constantly polling the GoCardless API.

## Webhook Security

GoCardless secures its webhooks using:

1. **Client Certificates**: GoCardless sends webhooks with client certificates that our application verifies to ensure the webhook comes from GoCardless.

2. **Signature Verification**: Each webhook includes a signature that our application validates using our webhook secret.

## Implementation in Payymo

### Webhook Endpoint

Our webhook endpoint is located at:
```
/api/gocardless/webhook
```

This endpoint is configured to:
1. Verify the client certificate from GoCardless
2. Validate the webhook signature
3. Process the webhook payload
4. Return appropriate responses to GoCardless

### Certificate Verification

GoCardless webhooks come with a client certificate that our application verifies:

```python
# Extract client certificate from the request
client_cert = request.environ.get('SSL_CLIENT_CERT')

# Verify the certificate
if not gocardless_service.verify_webhook_certificate(client_cert):
    logger.warning("Invalid GoCardless webhook certificate")
    raise APIError("Invalid certificate", status_code=403)
```

### Webhook Processing

After verification, our application processes the webhook payload:

```python
# Parse the webhook payload
webhook_data = request.get_json()
if not webhook_data:
    raise APIError("Invalid webhook payload", status_code=400)

# Process the webhook data
result = gocardless_service.process_webhook(webhook_data)
```

## Webhook Events and Handling

### Supported Webhook Events

Our application handles the following webhook events:

1. **New Transactions**
   - Event: `transaction.created`
   - Action: Store new transaction and trigger matching process

2. **Bank Connection Status**
   - Event: `connection.revoked`
   - Action: Update bank connection status to revoked

3. **Authorization Changes**
   - Event: `authorization.updated`
   - Action: Update access token status

### Webhook Response Format

In all cases, our application responds with:

```json
{
  "status": "success",
  "message": "Webhook processed successfully"
}
```

For error cases, the application returns appropriate HTTP status codes and error messages.

## Webhook Configuration

To receive webhooks from GoCardless, you need to:

1. Register your webhook URL in the GoCardless Partner Portal
2. Upload your webhook certificate and key
3. Set the appropriate webhook events you want to receive
4. Configure your security settings (IP restrictions, etc.)

## Testing Webhooks

For details on testing webhooks, see our companion document:
[Testing with GoCardless CLI](testing_with_gocardless_cli.md)

## Troubleshooting

### Common Webhook Issues

1. **Certificate Validation Failures**
   - Problem: GoCardless webhook rejected due to certificate issues
   - Solution: Verify certificate paths and format

2. **Signature Verification Failures**
   - Problem: Invalid signature in webhook payload
   - Solution: Verify webhook secret and signature calculation

3. **Missing Events**
   - Problem: Not receiving expected webhooks
   - Solution: Check webhook configuration in GoCardless portal

## Production Setup

For production environments:

1. Ensure your webhook endpoint is accessible via HTTPS
2. Configure IP restrictions if possible
3. Set up monitoring for webhook failures
4. Implement retry logic for failed webhook processing

## References

- [GoCardless Webhook Documentation](https://developer.gocardless.com/api-reference#webhooks)
- [Webhook Security Best Practices](https://developer.gocardless.com/resources/webhook-security)
- [GoCardless Partner Portal](https://manage.gocardless.com/partner)