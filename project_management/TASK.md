# Payymo Task Management

This document tracks all current and planned tasks for the Payymo project. Tasks are organized by status, priority, and module.

## Active Tasks

### High Priority

| ID | Title | Description | Assignee | Status | Dependencies |
|----|-------|-------------|----------|--------|-------------|
| PM-001 | GoCardless OAuth Flow | Complete the OAuth authentication flow for GoCardless Open Banking API | Developer | In Progress | None |
| PM-002 | Transaction Retrieval | Implement transaction fetching from connected bank accounts | Developer | To Do | PM-001 |
| PM-003 | Dashboard Statistics | Add real-time statistics to the NobleUI dashboard | UI Developer | In Progress | None |

### Medium Priority

| ID | Title | Description | Assignee | Status | Dependencies |
|----|-------|-------------|----------|--------|-------------|
| PM-004 | Transaction Matching Algorithm | Develop initial algorithm for matching transactions to invoices | Developer | To Do | PM-002 |
| PM-005 | Stripe Payment Gateway Integration | Connect Stripe API for payment processing | Developer | To Do | None |
| PM-006 | User Documentation | Create user documentation for the dashboard | Documentation | To Do | PM-003 |

### Low Priority

| ID | Title | Description | Assignee | Status | Dependencies |
|----|-------|-------------|----------|--------|-------------|
| PM-007 | Dark Mode Theme | Implement dark mode for the dashboard | UI Developer | To Do | PM-003 |
| PM-008 | Export Functionality | Add CSV/PDF export for transactions and reports | Developer | To Do | PM-002 |

## Completed Tasks

| ID | Title | Description | Completed By | Completion Date |
|----|-------|-------------|--------------|----------------|
| PM-000 | Project Setup | Initialize project structure and database | Developer | 2025-03-20 |

## Task Details

### PM-001: GoCardless OAuth Flow

**Description:**
Implement the OAuth authentication flow for connecting to bank accounts via the GoCardless Open Banking API.

**Acceptance Criteria:**
- User can initiate bank connection from the dashboard
- OAuth redirect flow works correctly
- Access tokens are securely stored in the database
- Token refresh mechanism is implemented
- Error handling for authentication failures

**Technical Notes:**
- Use the GoCardless sandbox environment for testing
- Implement secure storage of OAuth credentials
- Follow the security guidelines in `md_docs/gocardless_webhooks.md`

**Files Affected:**
- `flask_backend/services/gocardless_service.py`
- `flask_backend/routes.py`
- `flask_backend/templates/nobleui/bank_connection.html`

### PM-002: Transaction Retrieval

**Description:**
Implement functionality to retrieve transactions from connected bank accounts via the GoCardless API.

**Acceptance Criteria:**
- System can fetch transactions from connected bank accounts
- Transactions are stored in the database
- Pagination is implemented for large transaction sets
- Transaction synchronization can be manually triggered
- Automatic scheduling of transaction retrieval

**Technical Notes:**
- Implement error handling for API failures
- Add logging for transaction fetching
- Consider rate limiting and API quotas

**Files Affected:**
- `flask_backend/services/gocardless_service.py`
- `flask_backend/models.py` (Transaction model)
- `flask_backend/routes.py`

### PM-003: Dashboard Statistics

**Description:**
Enhance the NobleUI dashboard with real-time statistics and visualizations for financial data.

**Acceptance Criteria:**
- Dashboard shows transaction count and total amount
- Charts display transaction trends over time
- Statistics update in real-time
- Filter options for date ranges and transaction types

**Technical Notes:**
- Use Chart.js for visualizations
- Optimize database queries for performance
- Implement client-side caching where appropriate

**Files Affected:**
- `flask_backend/templates/nobleui/dashboard_new.html`
- `flask_backend/static/nobleui/js/dashboard.js`
- `flask_backend/routes_fresh.py`

## Adding New Tasks

When adding new tasks, follow this format:

```markdown
### PM-XXX: Task Title

**Description:**
Brief description of the task

**Acceptance Criteria:**
- Criterion 1
- Criterion 2
- ...

**Technical Notes:**
- Technical considerations
- Implementation suggestions
- References to documentation

**Files Affected:**
- List of files that will be modified
```

## Task Status Definitions

- **To Do**: Task is defined but work has not started
- **In Progress**: Work has begun on the task
- **Blocked**: Task cannot proceed due to dependencies or issues
- **Review**: Task is complete and awaiting review
- **Completed**: Task has been finished and verified