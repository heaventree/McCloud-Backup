# McCloud Backup - API Reference

This document provides a comprehensive reference for the McCloud Backup REST API endpoints, including request/response formats, authentication requirements, and example usage.

## API Overview

The McCloud Backup API follows RESTful principles and uses standard HTTP methods:

- `GET` - Retrieve resources
- `POST` - Create new resources
- `PUT` - Update existing resources
- `DELETE` - Remove resources

All API responses are in JSON format and include appropriate HTTP status codes.

## Authentication

### Session-Based Authentication

The main application uses session-based authentication for API access:

- `POST /api/auth/login` - Authenticate user and create session
- `POST /api/auth/logout` - End the current session
- `GET /api/auth/status` - Check authentication status

Protected endpoints require a valid session cookie.

### API Key Authentication

WordPress sites communicate with the API using API keys:

- Include the API key in the `X-API-Key` header
- API keys are site-specific and can be rotated

## Base URL

- Development: `http://localhost:5000/api`
- Production: `https://your-domain.com/api`

## API Endpoints

### Authentication

#### Login

```
POST /auth/login
```

Request:
```json
{
  "username": "admin",
  "password": "secure_password"
}
```

Response (200 OK):
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

#### Logout

```
POST /auth/logout
```

Response (200 OK):
```json
{
  "success": true
}
```

#### Check Authentication Status

```
GET /auth/status
```

Response (200 OK):
```json
{
  "authenticated": true,
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

### Sites

#### List Sites

```
GET /sites
```

Response (200 OK):
```json
{
  "sites": [
    {
      "id": 1,
      "name": "My WordPress Site",
      "url": "https://mysite.com",
      "status": "active",
      "lastCheckedAt": "2025-04-10T15:30:45Z",
      "lastBackupAt": "2025-04-10T12:00:00Z"
    },
    {
      "id": 2,
      "name": "Client Website",
      "url": "https://clientsite.com",
      "status": "active",
      "lastCheckedAt": "2025-04-09T10:15:30Z",
      "lastBackupAt": "2025-04-09T08:00:00Z"
    }
  ]
}
```

#### Get Site

```
GET /sites/:id
```

Response (200 OK):
```json
{
  "id": 1,
  "name": "My WordPress Site",
  "url": "https://mysite.com",
  "apiKey": "sk_XXXXXXXXXXXXXXXXXXXX",
  "status": "active",
  "lastCheckedAt": "2025-04-10T15:30:45Z",
  "lastBackupAt": "2025-04-10T12:00:00Z",
  "createdAt": "2025-03-15T09:30:00Z",
  "updatedAt": "2025-04-10T15:30:45Z"
}
```

#### Create Site

```
POST /sites
```

Request:
```json
{
  "name": "New WordPress Site",
  "url": "https://newsite.com",
  "apiKey": "site_generated_api_key"
}
```

Response (201 Created):
```json
{
  "id": 3,
  "name": "New WordPress Site",
  "url": "https://newsite.com",
  "apiKey": "site_generated_api_key",
  "status": "active",
  "createdAt": "2025-04-15T14:25:10Z",
  "updatedAt": "2025-04-15T14:25:10Z"
}
```

#### Update Site

```
PUT /sites/:id
```

Request:
```json
{
  "name": "Updated Site Name",
  "status": "inactive"
}
```

Response (200 OK):
```json
{
  "id": 1,
  "name": "Updated Site Name",
  "url": "https://mysite.com",
  "apiKey": "sk_XXXXXXXXXXXXXXXXXXXX",
  "status": "inactive",
  "lastCheckedAt": "2025-04-10T15:30:45Z",
  "lastBackupAt": "2025-04-10T12:00:00Z",
  "createdAt": "2025-03-15T09:30:00Z",
  "updatedAt": "2025-04-15T14:30:20Z"
}
```

#### Delete Site

```
DELETE /sites/:id
```

Response (204 No Content)

### Storage Providers

#### List Storage Providers

```
GET /storage-providers
```

Response (200 OK):
```json
{
  "providers": [
    {
      "id": 1,
      "type": "google-drive",
      "name": "Google Drive",
      "status": "active",
      "tokenExpiry": "2025-05-15T00:00:00Z"
    },
    {
      "id": 2,
      "type": "dropbox",
      "name": "Dropbox",
      "status": "active",
      "tokenExpiry": "2025-06-20T00:00:00Z"
    }
  ]
}
```

#### Get Storage Provider

```
GET /storage-providers/:id
```

Response (200 OK):
```json
{
  "id": 1,
  "type": "google-drive",
  "name": "Google Drive",
  "status": "active",
  "config": {
    "rootFolder": "McCloud Backups"
  },
  "tokenExpiry": "2025-05-15T00:00:00Z",
  "createdAt": "2025-03-20T10:15:30Z",
  "updatedAt": "2025-04-10T08:45:00Z"
}
```

#### Delete Storage Provider

```
DELETE /storage-providers/:id
```

Response (204 No Content)

### Backup Schedules

#### List Backup Schedules

```
GET /backup-schedules
```

Response (200 OK):
```json
{
  "schedules": [
    {
      "id": 1,
      "siteId": 1,
      "storageProviderId": 1,
      "name": "Daily Backup",
      "frequency": "daily",
      "nextRunAt": "2025-04-16T00:00:00Z",
      "status": "active"
    },
    {
      "id": 2,
      "siteId": 2,
      "storageProviderId": 2,
      "name": "Weekly Backup",
      "frequency": "weekly",
      "nextRunAt": "2025-04-20T00:00:00Z",
      "status": "active"
    }
  ]
}
```

#### Get Backup Schedule

```
GET /backup-schedules/:id
```

Response (200 OK):
```json
{
  "id": 1,
  "siteId": 1,
  "storageProviderId": 1,
  "name": "Daily Backup",
  "frequency": "daily",
  "cronExpression": "0 0 * * *",
  "retention": 7,
  "includeDatabase": true,
  "includeFiles": true,
  "excludePaths": [
    "wp-content/cache",
    "wp-content/uploads/large-files"
  ],
  "lastRunAt": "2025-04-15T00:00:00Z",
  "nextRunAt": "2025-04-16T00:00:00Z",
  "status": "active",
  "createdAt": "2025-03-25T14:30:00Z",
  "updatedAt": "2025-04-15T00:15:00Z"
}
```

#### Create Backup Schedule

```
POST /backup-schedules
```

Request:
```json
{
  "siteId": 1,
  "storageProviderId": 1,
  "name": "Weekly Full Backup",
  "frequency": "weekly",
  "retention": 4,
  "includeDatabase": true,
  "includeFiles": true,
  "excludePaths": ["wp-content/cache"]
}
```

Response (201 Created):
```json
{
  "id": 3,
  "siteId": 1,
  "storageProviderId": 1,
  "name": "Weekly Full Backup",
  "frequency": "weekly",
  "cronExpression": "0 0 * * 0",
  "retention": 4,
  "includeDatabase": true,
  "includeFiles": true,
  "excludePaths": ["wp-content/cache"],
  "nextRunAt": "2025-04-20T00:00:00Z",
  "status": "active",
  "createdAt": "2025-04-15T15:00:00Z",
  "updatedAt": "2025-04-15T15:00:00Z"
}
```

#### Update Backup Schedule

```
PUT /backup-schedules/:id
```

Request:
```json
{
  "name": "Updated Backup Schedule",
  "frequency": "monthly",
  "status": "inactive"
}
```

Response (200 OK):
```json
{
  "id": 1,
  "siteId": 1,
  "storageProviderId": 1,
  "name": "Updated Backup Schedule",
  "frequency": "monthly",
  "cronExpression": "0 0 1 * *",
  "retention": 7,
  "includeDatabase": true,
  "includeFiles": true,
  "excludePaths": [
    "wp-content/cache",
    "wp-content/uploads/large-files"
  ],
  "lastRunAt": "2025-04-15T00:00:00Z",
  "nextRunAt": "2025-05-01T00:00:00Z",
  "status": "inactive",
  "createdAt": "2025-03-25T14:30:00Z",
  "updatedAt": "2025-04-15T15:10:00Z"
}
```

#### Delete Backup Schedule

```
DELETE /backup-schedules/:id
```

Response (204 No Content)

### Backups

#### List Backups

```
GET /backups
```

Response (200 OK):
```json
{
  "backups": [
    {
      "id": 1,
      "siteId": 1,
      "scheduleId": 1,
      "storageProviderId": 1,
      "type": "full",
      "status": "completed",
      "size": 1562000000,
      "startedAt": "2025-04-15T00:00:00Z",
      "completedAt": "2025-04-15T00:15:30Z"
    },
    {
      "id": 2,
      "siteId": 2,
      "scheduleId": 2,
      "storageProviderId": 2,
      "type": "full",
      "status": "completed",
      "size": 840000000,
      "startedAt": "2025-04-14T00:00:00Z",
      "completedAt": "2025-04-14T00:10:15Z"
    }
  ]
}
```

#### List Backups by Site

```
GET /sites/:siteId/backups
```

Response (200 OK):
```json
{
  "backups": [
    {
      "id": 1,
      "siteId": 1,
      "scheduleId": 1,
      "storageProviderId": 1,
      "type": "full",
      "status": "completed",
      "size": 1562000000,
      "startedAt": "2025-04-15T00:00:00Z",
      "completedAt": "2025-04-15T00:15:30Z"
    },
    {
      "id": 3,
      "siteId": 1,
      "scheduleId": 1,
      "storageProviderId": 1,
      "type": "full",
      "status": "completed",
      "size": 1570000000,
      "startedAt": "2025-04-14T00:00:00Z",
      "completedAt": "2025-04-14T00:16:20Z"
    }
  ]
}
```

#### Get Backup

```
GET /backups/:id
```

Response (200 OK):
```json
{
  "id": 1,
  "siteId": 1,
  "scheduleId": 1,
  "storageProviderId": 1,
  "type": "full",
  "status": "completed",
  "size": 1562000000,
  "fileCount": 8542,
  "changedFiles": 326,
  "startedAt": "2025-04-15T00:00:00Z",
  "completedAt": "2025-04-15T00:15:30Z",
  "storageUrl": "https://drive.google.com/folders/abc123",
  "metadata": {
    "wordpressVersion": "6.4.2",
    "pluginCount": 12,
    "databaseSize": 52000000
  },
  "createdAt": "2025-04-15T00:00:00Z",
  "updatedAt": "2025-04-15T00:15:30Z",
  "site": {
    "id": 1,
    "name": "My WordPress Site",
    "url": "https://mysite.com"
  },
  "storageProvider": {
    "id": 1,
    "type": "google-drive",
    "name": "Google Drive"
  }
}
```

#### Trigger Manual Backup

```
POST /sites/:siteId/backups
```

Request:
```json
{
  "storageProviderId": 1,
  "type": "full",
  "includeDatabase": true,
  "includeFiles": true,
  "excludePaths": ["wp-content/cache"]
}
```

Response (202 Accepted):
```json
{
  "id": 5,
  "siteId": 1,
  "storageProviderId": A1,
  "type": "full",
  "status": "pending",
  "startedAt": "2025-04-15T15:30:00Z",
  "createdAt": "2025-04-15T15:30:00Z",
  "updatedAt": "2025-04-15T15:30:00Z"
}
```

### Feedback System

#### List Feedbacks

```
GET /feedbacks
```

Response (200 OK):
```json
{
  "feedbacks": [
    {
      "id": 1,
      "projectId": "default",
      "pagePath": "/dashboard",
      "elementPath": "#root > .main-wrapper > .dashboard-header",
      "status": "open",
      "priority": "medium",
      "title": "Dashboard Header Issue",
      "description": "The spacing in the dashboard header looks off",
      "coordinates": { "x": 150, "y": 75 },
      "createdAt": "2025-04-14T10:30:00Z"
    },
    {
      "id": 2,
      "projectId": "default",
      "pagePath": "/sites",
      "elementPath": ".site-card:nth-child(2) .site-status",
      "status": "in-progress",
      "priority": "high",
      "title": "Status indicator incorrect",
      "description": "The status indicator shows green but site is inactive",
      "coordinates": { "x": 420, "y": 180 },
      "createdAt": "2025-04-13T14:20:00Z"
    }
  ]
}
```

#### Get Feedback

```
GET /feedbacks/:id
```

Response (200 OK):
```json
{
  "id": 1,
  "projectId": "default",
  "pagePath": "/dashboard",
  "elementPath": "#root > .main-wrapper > .dashboard-header",
  "status": "open",
  "priority": "medium",
  "title": "Dashboard Header Issue",
  "description": "The spacing in the dashboard header looks off",
  "assignedTo": null,
  "coordinates": { "x": 150, "y": 75 },
  "createdAt": "2025-04-14T10:30:00Z",
  "updatedAt": "2025-04-14T10:30:00Z",
  "comments": [
    {
      "id": 1,
      "feedbackId": 1,
      "author": "designer",
      "content": "I'll fix the spacing issue",
      "createdAt": "2025-04-14T11:45:00Z"
    }
  ]
}
```

#### Create Feedback

```
POST /feedbacks
```

Request:
```json
{
  "projectId": "default",
  "pagePath": "/storage-providers",
  "elementPath": ".provider-card .provider-icon",
  "status": "open",
  "priority": "medium",
  "title": "Storage provider icon blurry",
  "description": "The Dropbox icon appears blurry on high-DPI screens",
  "coordinates": { "x": 120, "y": 200 }
}
```

Response (201 Created):
```json
{
  "id": 3,
  "projectId": "default",
  "pagePath": "/storage-providers",
  "elementPath": ".provider-card .provider-icon",
  "status": "open",
  "priority": "medium",
  "title": "Storage provider icon blurry",
  "description": "The Dropbox icon appears blurry on high-DPI screens",
  "coordinates": { "x": 120, "y": 200 },
  "createdAt": "2025-04-15T15:45:00Z",
  "updatedAt": "2025-04-15T15:45:00Z"
}
```

#### Update Feedback

```
PUT /feedbacks/:id
```

Request:
```json
{
  "status": "in-progress",
  "assignedTo": "developer1",
  "priority": "high"
}
```

Response (200 OK):
```json
{
  "id": 1,
  "projectId": "default",
  "pagePath": "/dashboard",
  "elementPath": "#root > .main-wrapper > .dashboard-header",
  "status": "in-progress",
  "priority": "high",
  "title": "Dashboard Header Issue",
  "description": "The spacing in the dashboard header looks off",
  "assignedTo": "developer1",
  "coordinates": { "x": 150, "y": 75 },
  "createdAt": "2025-04-14T10:30:00Z",
  "updatedAt": "2025-04-15T15:50:00Z"
}
```

#### Delete Feedback

```
DELETE /feedbacks/:id
```

Response (204 No Content)

#### List Feedback Comments

```
GET /feedbacks/:feedbackId/comments
```

Response (200 OK):
```json
{
  "comments": [
    {
      "id": 1,
      "feedbackId": 1,
      "author": "designer",
      "content": "I'll fix the spacing issue",
      "createdAt": "2025-04-14T11:45:00Z"
    },
    {
      "id": 2,
      "feedbackId": 1,
      "author": "developer1",
      "content": "Fixed in PR #123",
      "createdAt": "2025-04-15T16:00:00Z"
    }
  ]
}
```

#### Add Feedback Comment

```
POST /feedbacks/:feedbackId/comments
```

Request:
```json
{
  "author": "developer1",
  "content": "Fixed in PR #123"
}
```

Response (201 Created):
```json
{
  "id": 2,
  "feedbackId": 1,
  "author": "developer1",
  "content": "Fixed in PR #123",
  "createdAt": "2025-04-15T16:00:00Z"
}
```

#### Delete Feedback Comment

```
DELETE /comments/:id
```

Response (204 No Content)

### External API (Embeddable Feedback)

#### Submit External Feedback

```
POST /external/feedbacks
```

Request:
```json
{
  "projectId": "client-site",
  "pagePath": "/products",
  "elementPath": ".product-card:nth-child(3) .product-title",
  "title": "Product title overflow",
  "description": "The product title overflows its container on mobile devices",
  "priority": "medium",
  "coordinates": { "x": 180, "y": 320 }
}
```

Response (201 Created):
```json
{
  "id": 4,
  "projectId": "client-site",
  "pagePath": "/products",
  "elementPath": ".product-card:nth-child(3) .product-title",
  "status": "open",
  "priority": "medium",
  "title": "Product title overflow",
  "description": "The product title overflows its container on mobile devices",
  "coordinates": { "x": 180, "y": 320 },
  "createdAt": "2025-04-15T16:10:00Z",
  "updatedAt": "2025-04-15T16:10:00Z"
}
```

## Error Responses

All endpoints return appropriate HTTP status codes:

- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `204 No Content` - Resource deleted successfully
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

Error Response Format:
```json
{
  "error": "Error message",
  "details": {
    "field1": ["Error detail 1", "Error detail 2"],
    "field2": ["Error detail 3"]
  }
}
```

## Pagination

List endpoints support pagination using query parameters:

- `limit` - Number of items per page (default: 20, max: 100)
- `offset` - Offset for pagination (default: 0)

Example:
```
GET /backups?limit=10&offset=20
```

Response includes pagination metadata:
```json
{
  "backups": [...],
  "pagination": {
    "total": 45,
    "limit": 10,
    "offset": 20,
    "next": "/api/backups?limit=10&offset=30",
    "previous": "/api/backups?limit=10&offset=10"
  }
}
```

## Filtering

List endpoints support filtering using query parameters:

Example:
```
GET /backups?status=completed&type=full&siteId=1
```

## Rate Limiting

API requests are subject to rate limiting to prevent abuse:

- Authenticated requests: 100 requests per minute
- Unauthenticated requests: 20 requests per minute

Rate limit headers are included in all responses:
- `X-RateLimit-Limit` - Requests allowed per period
- `X-RateLimit-Remaining` - Requests remaining in current period
- `X-RateLimit-Reset` - Time when the rate limit resets (Unix timestamp)

When rate limit is exceeded, returns `429 Too Many Requests` with:
```json
{
  "error": "Rate limit exceeded",
  "resetAt": 1728486000
}
```

## Versioning

The API uses versioned endpoints for major changes. The current version is implied (v1).

Future versions will be explicitly versioned:
```
/api/v2/sites
```

---

*Last updated: April 15, 2025*