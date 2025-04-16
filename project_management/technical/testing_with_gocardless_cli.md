# Testing GoCardless Webhooks with the GoCardless CLI

This guide explains how to test GoCardless webhooks against your development environment using the GoCardless Command-Line Interface (CLI) tool.

## Prerequisites

1. Install the GoCardless CLI tool (requires Node.js)
   ```
   npm install -g @gocardless/cli
   ```

2. You need to have a valid webhook endpoint available for testing:
   - For local development, you can use a tool like ngrok to expose your local webhook endpoint
   - For Replit, use your application's public URL

3. Make sure your webhook endpoint is configured to receive and validate GoCardless webhooks

## Setup for Webhook Testing

1. **Export your GoCardless API keys**:
   ```bash
   export GC_ACCESS_TOKEN=your_access_token
   export GC_SECRET=your_webhook_signing_secret
   ```

2. **Configure your webhook endpoint**:
   ```bash
   gocardless webhook:configure https://your-domain.com/api/gocardless/webhook
   ```

## Sending Test Webhooks

### Test a Basic Webhook

```bash
gocardless webhook:trigger \
  --url https://your-domain.com/api/gocardless/webhook \
  --type test
```

### Test a Specific Event Type

For testing a specific event type such as a new transaction:

```bash
gocardless webhook:trigger \
  --url https://your-domain.com/api/gocardless/webhook \
  --type transaction \
  --resource-id trn_12345 \
  --action created
```

### Create a Custom Webhook Payload

For more complex testing scenarios:

```bash
# Create a JSON file with your custom payload
cat > custom_payload.json << EOF
{
  "events": [
    {
      "id": "EV123456",
      "created_at": "2025-03-22T12:00:00.000Z",
      "resource_type": "transactions",
      "action": "created",
      "links": {
        "transaction": "TR123456"
      },
      "details": {
        "origin": "gocardless",
        "cause": "payment_created",
        "description": "Test transaction created"
      }
    }
  ]
}
EOF

# Send the custom webhook payload
gocardless webhook:trigger \
  --url https://your-domain.com/api/gocardless/webhook \
  --payload-file custom_payload.json
```

## Verifying Webhook Receipt

After sending a test webhook, check your application logs to confirm that:

1. The webhook was received
2. The signature validation passed
3. The webhook was processed correctly

Look for log entries similar to:

```
Received GoCardless webhook
Webhook signature verified successfully
Processing webhook event: EV123456
```

## Troubleshooting

If your webhook tests fail, check the following:

1. **Signature Verification Issues**:
   - Verify the webhook secret is correct
   - Check if the request is being modified in transit
   - Ensure clock synchronization between systems

2. **SSL/TLS Certificate Issues**:
   - Make sure your webhook endpoint supports the TLS version required by GoCardless
   - Verify certificate validity

3. **Request Format Problems**:
   - Check if your webhook handler expects a specific content type
   - Ensure your handler can parse the received JSON correctly

4. **Authorization Issues**:
   - Confirm your webhook endpoint doesn't require additional authentication that may block the GoCardless webhook

## Example Workflow

For a complete testing workflow:

```bash
# 1. Configure webhook
gocardless webhook:configure https://your-domain.com/api/gocardless/webhook

# 2. Send a test webhook
gocardless webhook:trigger \
  --url https://your-domain.com/api/gocardless/webhook \
  --type test

# 3. Check application logs for the result
# 4. Send a more specific test webhook
gocardless webhook:trigger \
  --url https://your-domain.com/api/gocardless/webhook \
  --type transaction \
  --action created

# 5. Verify the application processed it correctly
```

## Additional Resources

- [GoCardless API Documentation](https://developer.gocardless.com/api-reference)
- [GoCardless CLI Documentation](https://developer.gocardless.com/resources/testing-webhooks-cli)
- [Webhook Security Best Practices](https://developer.gocardless.com/resources/webhook-security)