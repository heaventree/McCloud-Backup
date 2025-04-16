# Payymo Troubleshooting Guide

This document provides solutions for common issues that may arise when using the Payymo integration.

## Module Installation Issues

### Module Not Appearing in WHMCS

**Issue**: After uploading the module files, the module doesn't appear in the WHMCS addons list.

**Solutions**:
1. Verify that the files were uploaded to the correct location: `/path/to/whmcs/modules/addons/gocardless_openbanking/`
2. Check file permissions: ensure all files are readable by the web server
3. Clear WHMCS template cache: navigate to Utilities > System > Clear Template Cache
4. Check for PHP errors in your server logs that might prevent the module from loading

### Activation Fails

**Issue**: Attempting to activate the module results in an error.

**Solutions**:
1. Check PHP version compatibility (requires PHP 7.4+)
2. Verify that all required dependencies are installed
3. Check WHMCS admin permissions for the current user
4. Review server error logs for specific PHP errors

## License Issues

### License Key Validation Fails

**Issue**: The module fails to validate your license key.

**Solutions**:
1. Verify that the license key is entered correctly without any leading or trailing spaces
2. Ensure your WHMCS domain matches the domain registered with the license
3. Check that your license has not expired
4. Verify that your server can connect to the license validation server
5. If behind a firewall, ensure outbound connections to the license server are allowed

## Backend Connection Issues

### Can't Connect to Backend Service

**Issue**: The WHMCS module can't connect to the backend service.

**Solutions**:
1. Verify that the backend service is running: `systemctl status payymo-backend.service`
2. Check that the URL configured in WHMCS is correct
3. Ensure there are no firewall rules blocking communication
4. Verify that the backend service is listening on the configured port: `netstat -tuln | grep 5000`
5. Check backend service logs for any errors: `/var/log/payymo-backend.log`

### Backend Service Won't Start

**Issue**: The backend service fails to start.

**Solutions**:
1. Check environment configuration (.env file)
2. Verify database connectivity: `psql -U username -h hostname -p port -d database`
3. Check for Python dependency issues: `pip install -r requirements.txt`
4. Review systemd unit file for errors: `systemctl status payymo-backend.service`
5. Check service logs: `journalctl -u payymo-backend.service`

## Bank Connection Issues

### Can't Connect to Bank

**Issue**: Unable to establish a connection with your bank through the GoCardless OAuth flow.

**Solutions**:
1. Verify that the GoCardless API credentials are valid
2. Check that your bank is supported by GoCardless
3. Ensure your redirect URI is correctly configured and accessible
4. Try clearing browser cookies and cache before retrying
5. Check if your bank's service is operational

### Bank Connection Expired

**Issue**: Previously working bank connection shows as expired.

**Solutions**:
1. OAuth tokens typically expire after 90 days - reconnect to the bank
2. Check backend logs for token refresh failures
3. Verify that the GoCardless API is operational
4. Ensure your backend service has outbound internet access

## Transaction Syncing Issues

### No Transactions Appearing

**Issue**: Bank is connected but no transactions are appearing.

**Solutions**:
1. Verify date range settings for transaction fetching
2. Check bank account permissions - ensure you authorized access to transactions
3. Some banks may have delays in making transactions available via API
4. Check backend logs for API rate limiting or errors
5. Manually trigger a transaction refresh

### Missing Specific Transactions

**Issue**: Some transactions are not appearing in the system.

**Solutions**:
1. Verify transaction date range is correct
2. Some transaction types may not be available via the banking API
3. Check for API filtering that might exclude certain transactions
4. Look for error logs specific to failed transaction retrievals

## Invoice Matching Issues

### Low Match Confidence

**Issue**: System is finding matches but with low confidence scores.

**Solutions**:
1. Ensure your invoice references match your bank payment references
2. Configure matching rules to prioritize the reference fields you use
3. Adjust the confidence threshold in settings if needed
4. Consider manual matching for special cases

### Incorrect Matches

**Issue**: System is suggesting incorrect matches between transactions and invoices.

**Solutions**:
1. Reject incorrect matches to improve the matching algorithm
2. Check for duplicate invoice numbers or references
3. Verify that transaction amounts match invoice amounts exactly
4. Review matching rules configuration

## Stripe Integration Issues

### Can't Connect Stripe Account

**Issue**: Unable to complete the Stripe OAuth process.

**Solutions**:
1. Verify Stripe API credentials
2. Ensure redirect URI is correctly configured
3. Check that your Stripe account is in good standing
4. Verify you have the correct permissions on the Stripe account

### Stripe Payments Not Syncing

**Issue**: Stripe is connected but payments aren't appearing.

**Solutions**:
1. Check date range for payment fetching
2. Verify Stripe webhooks are properly configured
3. Ensure Stripe account permissions include payment data access
4. Check backend logs for Stripe API errors

## Database Issues

### Database Connection Failures

**Issue**: Backend service can't connect to PostgreSQL database.

**Solutions**:
1. Verify database credentials in .env file
2. Check that PostgreSQL server is running
3. Ensure database user has proper permissions
4. Check firewall rules if database is on a separate server
5. Verify PostgreSQL connection limits haven't been exceeded

### Database Performance Issues

**Issue**: Operations are slow or timing out.

**Solutions**:
1. Check database server resources (CPU, memory, disk I/O)
2. Review PostgreSQL configuration for performance optimizations
3. Consider adding indexes to frequently queried fields
4. Analyze slow queries in PostgreSQL logs
5. Implement regular database maintenance (VACUUM, ANALYZE)

## Still Need Help?

If you continue to experience issues after trying these troubleshooting steps, please contact our support team:

- Email: support@payymo.com
- Support Portal: https://support.payymo.com
- Phone: +1-800-PAYYMO-HELP

When contacting support, please include:
- Your license key
- WHMCS version
- PHP version
- Detailed description of the issue
- Any error messages or logs
- Steps already taken to resolve the issue