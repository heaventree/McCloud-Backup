# McCloud Backup - Debugging & Troubleshooting Guide

This document provides comprehensive guidance for diagnosing and resolving issues in the McCloud Backup platform.

## Common Issues

### UI and Visual Issues

#### Storage Provider Icons

**Issue**: Storage provider icons (Google Drive, AWS S3, etc.) appear blurry or incorrect

**Diagnosis**:
- SVGL API network requests are failing with network errors
- Current fallback icons need design improvement
- Inconsistent icon sizing across components

**Solution**:
1. Replace SVGL API integration with local SVG assets
2. Create a dedicated asset library for all storage provider icons
3. Standardize icon sizing and styling across components

**Code Location**:
- `client/src/components/storage-providers/StorageProviderIcon.tsx`
- `client/src/utils/icon-utils.ts`

**Sample Fix**:
```tsx
// Before: Using SVGL API
const StorageProviderIcon = ({ provider, size = 24 }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: [`svgl-icon-${provider}`],
    queryFn: () => fetch(`https://api.svgl.app/v1/icons/${provider}`).then(res => res.json())
  });

  if (isLoading) return <Loader size={size} />;
  if (error) return <FallbackIcon provider={provider} size={size} />;

  return <img src={data.url} width={size} height={size} alt={provider} />;
};

// After: Using local SVG assets
import { GoogleDriveIcon, DropboxIcon, OneDriveIcon, GitHubIcon, S3Icon } from '@/components/icons';

const StorageProviderIcon = ({ provider, size = 24 }) => {
  const iconProps = { width: size, height: size };
  
  switch (provider) {
    case 'google-drive':
      return <GoogleDriveIcon {...iconProps} />;
    case 'dropbox':
      return <DropboxIcon {...iconProps} />;
    case 'onedrive':
      return <OneDriveIcon {...iconProps} />;
    case 'github':
      return <GitHubIcon {...iconProps} />;
    case 's3':
      return <S3Icon {...iconProps} />;
    default:
      return <FileIcon {...iconProps} />;
  }
};
```

### API Integration Issues

#### OAuth Token Refresh

**Issue**: OAuth tokens sometimes fail to refresh properly

**Diagnosis**:
- Token refresh attempts don't properly handle certain error responses
- Some storage providers require specific handling for refresh tokens
- Missing retry logic for transient network errors

**Solution**:
1. Implement provider-specific token refresh strategies
2. Add proper error handling for different failure modes
3. Implement exponential backoff for retries

**Code Location**:
- `server/auth.ts`
- `client/src/hooks/useStorageProvider.ts`

#### External API Connectivity

**Issue**: Storage provider API calls occasionally fail with network errors

**Diagnosis**:
- Network timeouts during large file uploads
- Rate limiting from API providers
- Inadequate error handling for transient failures

**Solution**:
1. Implement chunked uploads for large files
2. Add rate limiting awareness and throttling
3. Improve error handling with automatic retries

**Code Location**:
- `server/storage-providers/base-provider.ts`
- `server/storage-providers/google-drive.ts`
- `server/storage-providers/dropbox.ts`

### Performance Issues

#### Slow Dashboard Loading

**Issue**: Dashboard sometimes takes >3 seconds to load initially

**Diagnosis**:
- Too many simultaneous API requests on load
- Inefficient data fetching strategy
- Missing data caching

**Solution**:
1. Implement request batching for dashboard stats
2. Add client-side caching for frequently accessed data
3. Optimize component rendering with proper memoization

**Code Location**:
- `client/src/pages/dashboard.tsx`
- `client/src/hooks/useDashboardStats.ts`

#### Memory Usage During Backups

**Issue**: Server memory usage spikes during large backup operations

**Diagnosis**:
- Large files loaded entirely into memory
- Insufficient stream processing for file operations
- Memory leaks in long-running operations

**Solution**:
1. Switch to streaming file processing
2. Implement better garbage collection during large operations
3. Add memory usage monitoring with auto-scaling

**Code Location**:
- `server/backup/backup-service.ts`
- `server/storage-providers/file-utils.ts`

### Browser Compatibility Issues

#### Mobile Layout Problems

**Issue**: Dashboard layout breaks on some mobile viewports

**Diagnosis**:
- Insufficient responsive design testing
- Hardcoded pixel values instead of responsive units
- Chart components not adapting to small screens

**Solution**:
1. Implement responsive design improvements using Tailwind's responsive modifiers
2. Replace fixed pixel values with relative units
3. Add mobile-specific chart configurations

**Code Location**:
- `client/src/components/dashboard/StatisticsPanel.tsx`
- `client/src/components/charts/BackupChart.tsx`

## Debugging Tools & Techniques

### Frontend Debugging

#### React Query DevTools

For debugging data fetching and caching issues:

```tsx
// Add to App.tsx for development mode
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <>
      {/* App components */}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
    </>
  );
}
```

#### Component Error Boundaries

For isolating and diagnosing component errors:

```tsx
// client/src/components/ErrorBoundary.tsx
import React from 'react';

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Component error:', error, errorInfo);
    // Log to error tracking service
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong.</h2>
          <details>
            <summary>Error details</summary>
            <pre>{this.state.error?.toString()}</pre>
          </details>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

### Backend Debugging

#### Express Middleware for Logging

For diagnosing API request/response issues:

```javascript
// server/middleware/request-logger.ts
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Capture original methods
  const oldJson = res.json;
  const oldSend = res.send;
  
  // Override response methods to log
  res.json = function(body) {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    return oldJson.call(this, body);
  };
  
  res.send = function(body) {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    return oldSend.call(this, body);
  };
  
  next();
};
```

#### Database Query Logging

For troubleshooting database performance:

```typescript
// Add to database config
const db = drizzle(postgres(connectionString), { 
  schema,
  logger: {
    logQuery: (query, params) => {
      console.log('Query:', query);
      console.log('Params:', params);
    }
  }
});
```

## Future Investigations

1. **SVG Sprite Implementation**
   - Investigate using SVG sprites for icons instead of individual SVG components
   - Potential performance improvements for icon-heavy pages
   - Simplified asset management

2. **API Request Caching**
   - Consider adding a caching mechanism for external API calls
   - Reduce rate limit usage and improve performance
   - Balance freshness of data with performance

3. **React Component Performance**
   - Review component render performance with React Profiler
   - Identify and fix unnecessary re-renders
   - Optimize memo usage and dependency arrays

4. **GitHub API Efficiency**
   - Research optimal patterns for GitHub API usage
   - Implement best practices for large repository operations
   - Balance between rate limits and backup reliability

## Reference: Common Error Codes

| Error Code | Description | Possible Solutions |
|------------|-------------|-------------------|
| `EAUTH_001` | OAuth token expired | Refresh token or prompt for re-authentication |
| `EAUTH_002` | OAuth token revoked | Prompt user to reconnect the storage provider |
| `EBACK_001` | Backup size exceeds provider limit | Split backup or suggest different provider |
| `EBACK_002` | Network timeout during backup | Implement chunked uploading with resume capability |
| `EBACK_003` | WordPress site connection error | Check API key and WordPress plugin status |
| `EAPI_001` | Rate limit exceeded | Implement exponential backoff and request throttling |
| `EAPI_002` | API endpoint not found | Check API version compatibility |
| `ESTOR_001` | Storage quota exceeded | Alert user to upgrade storage or clean up old backups |

---

*Last updated: April 15, 2025*