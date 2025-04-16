# Payymo Issues Tracker

This document tracks known issues, bugs, and their resolution status for the Payymo project.

## Active Issues

### Critical Issues

| ID | Title | Description | Status | Assigned To | Reported | Related Task |
|----|-------|-------------|--------|------------|----------|--------------|
| ISSUE-001 | OAuth Token Refresh Failure | GoCardless token refresh mechanism fails after 7 days | Investigating | Developer | 2025-04-10 | PM-001 |

### High Priority Issues

| ID | Title | Description | Status | Assigned To | Reported | Related Task |
|----|-------|-------------|--------|------------|----------|--------------|
| ISSUE-002 | Dashboard Loading Performance | Dashboard takes >3s to load with many transactions | In Progress | UI Developer | 2025-04-12 | PM-003 |
| ISSUE-003 | Transaction Date Timezone Inconsistency | Transactions show incorrect dates due to timezone issues | Investigating | Developer | 2025-04-12 | PM-002 |

### Medium Priority Issues

| ID | Title | Description | Status | Assigned To | Reported | Related Task |
|----|-------|-------------|--------|------------|----------|--------------|
| ISSUE-004 | Chart Labels Overlap | Chart labels overlap when viewing on tablet devices | To Do | UI Developer | 2025-04-13 | PM-003 |
| ISSUE-005 | Missing Error Messages | Some API errors don't show user-friendly error messages | To Do | Developer | 2025-04-13 | None |

### Low Priority Issues

| ID | Title | Description | Status | Assigned To | Reported | Related Task |
|----|-------|-------------|--------|------------|----------|--------------|
| ISSUE-006 | Documentation Typos | Several typos in API documentation | To Do | Documentation | 2025-04-14 | None |
| ISSUE-007 | Console Warning Messages | Non-critical console warnings in browser dev tools | To Do | UI Developer | 2025-04-14 | None |

## Resolved Issues

| ID | Title | Resolution | Resolved By | Resolution Date | Related Task |
|----|-------|------------|-------------|-----------------|--------------|
| ISSUE-000 | Database Connection Pool Exhaustion | Implemented connection pool recycling and ping checks | Developer | 2025-04-08 | None |

## Issue Details

### ISSUE-001: OAuth Token Refresh Failure

**Description:**
GoCardless OAuth tokens fail to refresh after approximately 7 days, requiring users to re-authenticate. This affects all bank connections established more than a week ago.

**Steps to Reproduce:**
1. Connect a bank account via GoCardless OAuth
2. Wait 7+ days 
3. Attempt to fetch transactions
4. Observe "token expired" error

**Expected Behavior:**
The system should automatically refresh the token before it expires.

**Actual Behavior:**
Token refresh attempt fails with "invalid_grant" error.

**Technical Notes:**
- Error occurs in `gocardless_service.py` during token refresh
- Refresh token appears to expire despite documentation stating it should be valid for 90 days
- May be related to sandbox environment limitations

**Potential Solutions:**
- Check if production tokens have different expiry behavior
- Implement proactive token refresh 1-2 days before expiry
- Add better error handling and notification for refresh failures

### ISSUE-002: Dashboard Loading Performance

**Description:**
The NobleUI dashboard is slow to load when there are more than ~100 transactions, taking over 3 seconds which exceeds our performance requirement of 2 seconds.

**Steps to Reproduce:**
1. Add at least 100 test transactions to the database
2. Load the dashboard page
3. Observe loading time > 3 seconds

**Expected Behavior:**
Dashboard should load in under 2 seconds regardless of transaction count.

**Actual Behavior:**
Loading time increases linearly with transaction count.

**Technical Notes:**
- Performance bottleneck appears to be in the initial data query
- No pagination is implemented for transaction data
- All chart data is loaded upfront rather than lazily

**Potential Solutions:**
- Implement pagination for transaction data
- Add data caching for frequently accessed statistics
- Optimize database queries with proper indexing
- Load charts asynchronously after the initial page load

## Adding New Issues

When reporting new issues, follow this format:

```markdown
### ISSUE-XXX: Issue Title

**Description:**
Brief description of the issue

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. ...

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens

**Technical Notes:**
- Technical details
- Error messages
- Affected components

**Potential Solutions:**
- Possible approaches to fixing the issue
```

## Issue Status Definitions

- **To Do**: Issue is logged but work has not started
- **Investigating**: Issue is being analyzed to determine root cause
- **In Progress**: Work has begun on fixing the issue
- **Review**: Fix is complete and awaiting review/testing
- **Resolved**: Issue has been fixed and verified
- **Won't Fix**: Issue will not be addressed (with explanation)