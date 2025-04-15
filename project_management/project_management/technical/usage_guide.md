# Payymo Usage Guide

This document provides instructions for using the Payymo Open Banking and Stripe integration for WHMCS.

## Accessing the Module

1. Log in to your WHMCS admin area.
2. Navigate to **Addons** > **GoCardless Open Banking**.
3. You'll see the main dashboard with statistics and options.

## Adding a Bank Connection

1. Navigate to the **Bank Connections** tab.
2. Click the **Add Bank Connection** button.
3. Select your bank from the available options.
4. Follow the OAuth flow to authorize access to your bank account.
5. Once authorized, your bank account will appear in the list of connected accounts.

## Adding a Stripe Connection

1. Navigate to the **Stripe Integration** tab.
2. Click the **Connect Stripe Account** button.
3. Follow the OAuth flow to authorize access to your Stripe account.
4. Once authorized, your Stripe account will appear in the list of connected accounts.

## Viewing Transactions

1. Navigate to the **Transactions** tab.
2. You'll see a list of all transactions from your connected bank accounts.
3. Use the filters to narrow down the transaction list by date, amount, or status.
4. Click on a transaction to view more details.

## Managing Invoice Matches

1. Navigate to the **Invoice Matches** tab.
2. Review the system's automatically suggested matches between transactions and invoices.
3. For each match, you can:
   - **Approve**: Apply the payment to the invoice in WHMCS
   - **Reject**: Mark the match as incorrect
   - **Ignore**: Skip the match for now
4. The confidence score helps you determine the likelihood of a correct match.

## Handling Manual Matching

1. For transactions without an automatic match, click the **Match Manually** button.
2. Enter the invoice ID or search for an invoice by client name or amount.
3. Select the correct invoice from the search results.
4. Click **Apply Match** to link the transaction to the invoice.

## Configuration Settings

1. Navigate to the **Configuration** tab.
2. Update the following settings as needed:
   - Backend API URL
   - Matching threshold (confidence level for automatic matching)
   - Synchronization frequency
   - Notification preferences
3. Click **Save Changes** to apply the new settings.

## Viewing Logs

1. Navigate to the **Logs** tab.
2. Review the system activity logs, including:
   - API connections
   - Transaction synchronization
   - Matching events
   - Error messages
3. Use the filter options to focus on specific types of log entries.

## Dashboard Analytics

The main dashboard provides several useful analytics:
- Transaction volume trends
- Match success rate
- Connected accounts status
- Recent activity
- Error notifications

## Troubleshooting Common Issues

### Connection Problems
- Verify your API credentials
- Check if your bank or Stripe account needs to renew authorization
- Verify the backend service is running

### Missing Transactions
- Check the sync date range
- Verify that the transactions are available in your bank/Stripe account
- Check for API rate limiting issues

### Matching Issues
- Ensure your invoice references match your bank transaction references
- Check if the amounts match exactly
- Verify that the invoice is in an unpaid status

For additional support, contact support@payymo.com.