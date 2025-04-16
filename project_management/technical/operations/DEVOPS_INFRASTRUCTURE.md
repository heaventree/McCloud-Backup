# DevOps & Infrastructure for Payymo

This document outlines the DevOps practices and infrastructure setup for the Payymo financial platform. It covers deployment strategies, containerization, CI/CD pipelines, monitoring, and scaling approaches to ensure a reliable, secure, and maintainable system.

## 1. Infrastructure Architecture

### Components Overview

```
+--------------------+     +--------------------+     +--------------------+
| Client Applications |     |   API Gateway      |     |  External Services |
|                    |     |                    |     |                    |
| - Web Interface    | --> | - Authentication   | --> | - GoCardless API   |
| - Admin Dashboard  |     | - Rate Limiting    |     | - Stripe API       |
| - Mobile Web       |     | - Request Routing  |     | - WHMCS API        |
+--------------------+     +--------------------+     +--------------------+
                                    |
                                    v
+--------------------+     +--------------------+     +--------------------+
|  Core API Services |     |     Databases      |     |  Auxiliary Systems |
|                    |     |                    |     |                    |
| - Transaction API  | <-> | - PostgreSQL       | <-> | - Scheduled Jobs   |
| - Account API      |     | - Redis (Cache)    |     | - Webhook Handlers |
| - Integration API  |     |                    |     | - Data Processors  |
+--------------------+     +--------------------+     +--------------------+
```

### Environment Structure

Payymo maintains multiple environments to support the development lifecycle:

1. **Development** - For active development work
2. **Testing** - For automated and manual testing
3. **Staging** - Production-like environment for final testing
4. **Production** - Live environment for end users

## 2. Deployment Platforms

### Frontend Deployment

**Primary Platform**: Netlify/Vercel

- **Branch Deployments**: 
  - `main` → Production
  - `staging` → Staging
  - Feature branches → Preview environments

- **Configuration**:
  ```toml
  # netlify.toml example
  [build]
    publish = "build"
    command = "npm run build"
    
  [context.production]
    environment = { NODE_ENV = "production" }
    
  [context.staging]
    environment = { NODE_ENV = "staging" }
  
  [[redirects]]
    from = "/*"
    to = "/index.html"
    status = 200
  ```

### Backend Deployment

**Primary Platform**: Render/Railway

- **Services**:
  - Core API - Main Flask application
  - Worker - Background job processor
  - Scheduler - Cron job runner

- **Configuration**:
  ```yaml
  # render.yaml example
  services:
    - type: web
      name: payymo-api
      env: python
      buildCommand: pip install -r requirements.txt
      startCommand: gunicorn main:app --bind 0.0.0.0:$PORT
      envVars:
        - key: DATABASE_URL
          fromDatabase:
            name: payymo-db
            property: connectionString
        - key: REDIS_URL
          fromService:
            name: payymo-redis
            type: redis
            property: connectionString
            
    - type: worker
      name: payymo-worker
      env: python
      buildCommand: pip install -r requirements.txt
      startCommand: celery -A worker.celery worker
      envVars:
        - key: DATABASE_URL
          fromDatabase:
            name: payymo-db
            property: connectionString
            
  databases:
    - name: payymo-db
      type: postgresql
      ipAllowList: []
  ```

### Database Deployment

**Primary Platform**: Managed PostgreSQL service (Render Database, Railway, AWS RDS)

- **Requirements**:
  - Point-in-Time Recovery (PITR)
  - High Availability with automatic failover
  - Regular automated backups
  - Encrypted at rest and in transit

### Asset Storage

**Primary Platform**: Amazon S3/CloudFront or Cloudflare R2/Cloudflare CDN

- **Structure**:
  - Public assets (static resources, public documentation)
  - Private assets (user uploads, exported data)
  - System files (configuration backups, logs)

## 3. Containerization

### Docker Configuration

All services use Docker for consistent development and deployment environments.

#### Backend Dockerfile

```dockerfile
# Base Python image
FROM python:3.11-slim AS base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
FROM base AS dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Final stage
FROM base AS final
COPY --from=dependencies /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=dependencies /usr/local/bin /usr/local/bin

# Copy application code
COPY . .

# Set up non-root user
RUN adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser /app
USER appuser

# Run the application
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "main:app"]
```

#### Docker Compose for Local Development

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/payymo
      - REDIS_URL=redis://redis:6379/0
      - FLASK_ENV=development
      - FLASK_DEBUG=1
    volumes:
      - ./:/app
    depends_on:
      - db
      - redis
    
  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=payymo
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
      
  redis:
    image: redis:7
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
      
volumes:
  postgres_data:
  redis_data:
```

## 4. CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/main.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main, staging]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          pip install pytest pytest-cov
          
      - name: Lint with flake8
        run: |
          pip install flake8
          flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
          
      - name: Test with pytest
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
        run: |
          pytest --cov=. --cov-report=xml
          
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage.xml
          fail_ci_if_error: true
  
  deploy:
    needs: test
    if: github.event_name == 'push' && (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/staging')
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set environment variables
        run: |
          if [[ $GITHUB_REF == 'refs/heads/main' ]]; then
            echo "DEPLOY_ENV=production" >> $GITHUB_ENV
          else
            echo "DEPLOY_ENV=staging" >> $GITHUB_ENV
          fi
          
      - name: Deploy to Render
        uses: JorgeLNJunior/render-deploy@v1.4.3
        with:
          service_id: ${{ secrets.RENDER_SERVICE_ID }}
          api_key: ${{ secrets.RENDER_API_KEY }}
          clear_cache: true
          
      - name: Run database migrations
        if: env.DEPLOY_ENV == 'production'
        run: |
          # Add commands to run database migrations here
          
      - name: Notify deployment
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK_URL }} \
          -H 'Content-Type: application/json' \
          -d '{"text":"Deployed Payymo '${{ env.DEPLOY_ENV }}' successfully"}'
```

### Deployment Workflow

1. **Code Merge**: Developer merges code to staging/main branch
2. **CI Pipeline**: Automated tests run on the merged code
3. **Build**: Application is built and containerized
4. **Deploy**: Containers are deployed to the target environment
5. **Post-Deploy Checks**: Automated smoke tests verify deployment
6. **Notification**: Team is notified of successful/failed deployment

## 5. Environment Management

### Environment Variables

- **Local Development**: Use `.env` file (gitignored)
- **CI/CD**: Use GitHub Secrets
- **Production**: Use managed secrets in deployment platform

#### Environment Variable Categories

1. **Infrastructure**: Database URLs, Redis URLs, etc.
2. **API Keys**: Third-party service credentials
3. **Feature Flags**: Toggle features on/off in different environments
4. **Application Settings**: Various configuration parameters

### Secret Management

For sensitive credentials:

1. **Never commit secrets** to version control
2. **Rotate regularly**, especially after developer departures
3. **Use least privilege principle** for all service accounts
4. **Audit regularly** for unused or overprivileged credentials

## 6. Monitoring & Observability

### Application Monitoring

**Primary Tools**: Sentry, Datadog/New Relic

- **Error Tracking**: Capture and aggregate application errors
- **Performance Monitoring**: Track API response times and database query performance
- **User Experience Monitoring**: Capture frontend performance metrics

### Infrastructure Monitoring

**Primary Tools**: Datadog, Grafana + Prometheus

- **Resource Utilization**: CPU, memory, disk, network
- **Database Metrics**: Query throughput, connection count, index usage
- **External API Dependencies**: Response times, error rates, availability

### Logging

**Primary Approach**: Structured JSON logs to centralized logging service

```python
# Example structured logging
logger.info("Bank connection created", extra={
    "tenant_id": tenant.id,
    "bank_id": bank_connection.bank_id,
    "request_id": request_id,
    "duration_ms": duration_ms
})
```

- **Log Retention**: Store logs for at least 30 days
- **Log Indexing**: Make logs searchable by key fields
- **Log Correlation**: Use request IDs to correlate logs across services

### Alerting

**Alert Categories**:

1. **Critical**: Immediate response required (SMS, phone call)
2. **Warning**: Attention needed soon (email, Slack)
3. **Informational**: For awareness only (dashboard)

**Key Alerts**:

- Application error rate exceeds threshold
- API endpoint response time exceeds threshold
- Database connection failures
- Failed authentication attempts spike
- Scheduled job failures
- Disk space running low

## 7. Scaling Strategy

### Horizontal Scaling

- **API Services**: Scale horizontally based on CPU utilization and request rate
- **Background Workers**: Scale based on job queue depth
- **Database**: Use read replicas for scaling read operations

### Vertical Scaling

- **Database Primary**: Scale vertically for write-heavy workloads
- **In-Memory Cache**: Scale vertically for larger datasets

### Load Balancing

- **API Services**: Round-robin load balancing with health checks
- **Static Content**: CDN distribution with edge caching

### Database Scaling

1. **Connection Pooling**: Optimize database connection usage
2. **Read Replicas**: Direct read queries to replicas
3. **Query Optimization**: Regularly review and optimize slow queries
4. **Sharding Strategy**: Prepare for potential future sharding by tenant

## 8. Disaster Recovery

See [BACKUP_RECOVERY.md](./BACKUP_RECOVERY.md) for detailed disaster recovery procedures.

Key points:

- **Regular Backups**: Automated daily backups
- **Restore Testing**: Monthly restore tests
- **Failover Procedures**: Documented procedures for critical components
- **Recovery Time Objectives (RTOs)**: Defined for each system component

## 9. Security Considerations

### Infrastructure Security

1. **Network Security**:
   - Use private networking where possible
   - Implement strict firewall rules
   - Enable VPC peering for service-to-service communication

2. **Access Control**:
   - Implement least privilege access to all systems
   - Use multi-factor authentication for infrastructure access
   - Audit access regularly

3. **Scanning and Monitoring**:
   - Regular vulnerability scans
   - Container image scanning
   - Dependency security scanning in CI/CD

### Compliance Requirements

Ensure infrastructure meets compliance requirements:

- **PCI DSS**: If handling payment data
- **GDPR**: For EU customer data
- **Financial Regulations**: Specific to operating jurisdictions

## 10. Development Workflow

### Local Development

1. Clone repository
2. Copy `.env.example` to `.env` and configure
3. Run `docker-compose up` to start local environment
4. Access application at `http://localhost:5000`

### Code Review Process

1. Create feature branch from `staging`
2. Develop and test locally
3. Create pull request to `staging`
4. Pass automated tests
5. Receive code review approval
6. Merge to `staging`
7. Test in staging environment
8. Create pull request from `staging` to `main`
9. Merge to `main` for production deployment

## 11. Implementation Checklist

### Initial Setup

- [ ] Configure CI/CD pipeline in GitHub Actions
- [ ] Set up development, staging, and production environments
- [ ] Configure monitoring and alerting
- [ ] Implement logging infrastructure
- [ ] Set up database backups and testing

### Ongoing Maintenance

- [ ] Regular dependency updates
- [ ] Security patch management
- [ ] Performance monitoring and optimization
- [ ] Scaling adjustments based on usage patterns
- [ ] Documentation updates