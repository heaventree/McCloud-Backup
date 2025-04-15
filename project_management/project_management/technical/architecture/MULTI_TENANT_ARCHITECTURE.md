# Multi-Tenant Architecture for Payymo

This document outlines the multi-tenant architecture of the Payymo application, focusing on data isolation, security, and scalability for serving multiple customers with a single application instance.

## Overview

Payymo uses a multi-tenant architecture where a single application instance serves multiple client organizations (tenants). Each tenant's data is logically isolated, but the infrastructure and application code are shared to maximize efficiency and minimize operational overhead.

## Core Concepts

### Tenant Definition

In Payymo, a tenant represents a distinct customer organization with its own:
- Users and authentication
- Bank connections
- Transaction data
- Stripe integrations
- Configuration settings

Each tenant is identified by a unique `tenant_id` which serves as the primary isolation mechanism throughout the system.

## Data Isolation Strategy

### Database Approach: Shared Schema with Tenant Filtering

Payymo uses a shared database schema approach with tenant IDs in each table:

1. **Tenant Identifier**: Every table (except global system tables) includes a `tenant_id` column
2. **Mandatory Filtering**: All queries must include a tenant filter
3. **Default Scoping**: Application-level middleware automatically applies tenant filtering
4. **Indexing**: The `tenant_id` column is indexed for performance
5. **Foreign Key Constraints**: Cross-table relationships enforce data integrity within tenant boundaries

### Sample Table Structure

```sql
CREATE TABLE bank_connections (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    bank_id VARCHAR(100) NOT NULL,
    bank_name VARCHAR(100),
    account_id VARCHAR(100) NOT NULL,
    account_name VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, bank_id, account_id)
);

CREATE INDEX idx_bank_connections_tenant ON bank_connections(tenant_id);
```

## Tenant Context Management

### Request Flow

1. **Authentication**: User authenticates with the system
2. **Tenant Resolution**: System identifies the tenant based on authentication context
3. **Context Setting**: Tenant ID is stored in the request context
4. **Request Processing**: All database queries automatically include tenant filtering
5. **Response**: Data is returned, scoped to the tenant

### Implementation in Flask

```python
@app.before_request
def set_tenant_context():
    # Skip for non-authenticated routes
    if request.path.startswith('/auth/') or request.path == '/':
        return
        
    # Get tenant from authenticated user
    if not current_user or not current_user.is_authenticated:
        return jsonify(error="Authentication required"), 401
        
    g.tenant_id = current_user.tenant_id
    
    # For API key authentication
    if 'X-API-Key' in request.headers:
        api_key = request.headers.get('X-API-Key')
        tenant = get_tenant_for_api_key(api_key)
        if tenant:
            g.tenant_id = tenant.id
```

### Database Query Filtering

```python
class TenantQueryService:
    """Base service class that enforces tenant isolation in database queries"""
    
    def get_query(self, model_class):
        """Get base query with tenant filtering applied"""
        if not hasattr(g, 'tenant_id'):
            raise SecurityException("No tenant context set")
            
        return model_class.query.filter_by(tenant_id=g.tenant_id)
    
    def get_by_id(self, model_class, record_id):
        """Get record by ID with tenant filtering"""
        return self.get_query(model_class).filter_by(id=record_id).first()
    
    def create(self, model_class, **data):
        """Create record with tenant ID automatically set"""
        if not hasattr(g, 'tenant_id'):
            raise SecurityException("No tenant context set")
            
        data['tenant_id'] = g.tenant_id
        instance = model_class(**data)
        db.session.add(instance)
        db.session.commit()
        return instance
```

## Tenant Provisioning

### Tenant Creation Process

1. **Registration**: New organization registers for Payymo (or is created by admin)
2. **Tenant Record**: System creates a tenant record with unique identifier
3. **Initial Setup**: Default settings and configurations are created
4. **Admin User**: First admin user is created for the tenant
5. **Welcome Flow**: Tenant admin is guided through initial setup steps

### Database Migrations

When applying database schema changes:

1. Test migrations thoroughly with multi-tenant data
2. Ensure migrations maintain tenant isolation
3. Consider performance impact of migrations on large tenant datasets
4. Use online schema change tools for zero-downtime migrations when possible

## White-Labeling Support

Payymo supports white-labeling for partners by:

1. **Custom Domains**: Each tenant can have a custom domain
2. **Branding**: Tenant-specific logos, colors, and themes
3. **Email Templates**: Customizable email templates with tenant branding
4. **Custom Terminology**: Configurable terms and language

## Tenant-Specific Customization

### Configuration Management

Tenant-specific configurations are stored in a dedicated table:

```sql
CREATE TABLE tenant_settings (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, setting_key)
);
```

### Feature Flags

Payymo supports tenant-specific feature flags to enable or disable functionality:

```sql
CREATE TABLE tenant_features (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    feature_key VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, feature_key)
);
```

## Security Considerations

### Cross-Tenant Access Prevention

1. **Service Layer Isolation**: All services validate tenant context
2. **API Endpoint Protection**: API routes validate tenant access
3. **Database Query Guards**: Queries always filter by tenant_id
4. **Regular Auditing**: Logging and monitoring for potential isolation breaches

### Tenant Data Backups

1. Each tenant's data can be backed up separately
2. Restore operations maintain tenant isolation
3. Tenant admins can initiate their own exports

## Performance Optimizations

### Database Indexing Strategy

1. Include `tenant_id` in composite indexes where appropriate
2. Consider tenant-specific partitioning for large tables
3. Implement query caching with tenant-aware cache keys

### Query Performance

1. Add tenant filters early in query construction
2. Use tenant-aware connection pooling
3. Implement tenant-specific rate limiting

## Monitoring and Debugging

### Tenant Context Logging

All logs include tenant context for easier debugging:

```python
@app.before_request
def setup_logging():
    if hasattr(g, 'tenant_id'):
        # Add tenant_id to all log records
        request_id = request.headers.get('X-Request-ID', str(uuid.uuid4()))
        log = logging.LoggerAdapter(
            app.logger,
            {
                'tenant_id': g.tenant_id,
                'request_id': request_id
            }
        )
        g.log = log
```

### Tenant-Specific Analytics

1. Track usage metrics per tenant
2. Monitor resource consumption by tenant
3. Set up alerts for abnormal tenant behavior

## Scaling Considerations

### Horizontal Scaling

1. Application instances share tenant data in the database
2. Tenants can be distributed across application instances
3. Load balancers distribute traffic across instances

### Vertical Partitioning

For extremely large tenants:

1. Consider database sharding by tenant
2. Implement tenant-specific caching strategies
3. Potential for dedicated instances for premium tenants

## Appendix: Tenant Isolation Testing

### Test Cases

1. Attempt to access data from another tenant by manipulating request parameters
2. Verify tenant context is properly maintained throughout request lifecycle
3. Test database queries to ensure tenant filtering is applied
4. Validate API endpoints enforce tenant isolation
5. Ensure background jobs maintain tenant context

### Security Auditing

Regularly audit the system for potential tenant isolation breaches:

1. Review database queries for missing tenant filters
2. Analyze logs for suspicious cross-tenant access attempts
3. Conduct penetration testing with focus on tenant isolation
4. Review code changes for potential isolation vulnerabilities