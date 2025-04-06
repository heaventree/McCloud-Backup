# McCloud Backup - MVP Pre-Flight Document

## Overview

McCloud Backup is a comprehensive WordPress backup solution that provides intelligent backup management, seamless plugin distribution, and advanced security features for administrators. This document serves as a handover guide for the development team to understand the system architecture, deployment process, and potential issues to consider before MVP rollout.

## System Architecture

### Frontend
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS with Shadcn UI components
- **State Management**: React Query for data fetching and caching
- **Routing**: Wouter for lightweight routing
- **API Handling**: Axios for HTTP requests

### Backend
- **Runtime**: Node.js with Express
- **Database**: PostgreSQL (optional, with in-memory fallback)
- **ORM**: Drizzle ORM with Zod validation
- **Authentication**: OAuth 2.0 for cloud storage providers

### WordPress Integration
- **Plugin Structure**: Pure PHP plugin for WordPress integration
- **Communication**: REST API endpoints for secure communication
- **Dependencies**: UpdraftPlus plugin for backup core functionality

## Key Features

1. **Dashboard**
   - Overview statistics with connected sites, storage usage, and backup status
   - Recent backup activity monitoring
   - Quick access to detailed logs and backups

2. **Site Management**
   - Add/edit/remove WordPress sites
   - API key management for secure communication
   - Site connection status monitoring

3. **Storage Providers**
   - Multiple provider support (Google Drive, Dropbox, OneDrive, etc.)
   - OAuth authentication for secure access
   - Storage quota monitoring

4. **Backup Management**
   - View backup history and details
   - Download backup logs
   - Automated backup scheduling

5. **WordPress Plugin**
   - Easy installation via WP admin
   - Custom admin interface
   - REST API for communication with main application

## Deployment Instructions

### Prerequisites
- Node.js v20 or later
- PostgreSQL (optional, but recommended for production)
- npm or yarn package manager
- A server with at least 1GB RAM and 10GB storage

### Deployment Process

1. **Clone Repository**
   ```bash
   git clone [repository-url] mccloud-backup
   cd mccloud-backup
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory with the following variables:
   ```
   # Database Configuration (if using PostgreSQL)
   DATABASE_URL=postgresql://user:password@localhost:5432/mccloud_backup
   
   # OAuth Credentials
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   DROPBOX_CLIENT_ID=your_dropbox_client_id
   DROPBOX_CLIENT_SECRET=your_dropbox_client_secret
   ONEDRIVE_CLIENT_ID=your_onedrive_client_id
   ONEDRIVE_CLIENT_SECRET=your_onedrive_client_secret
   
   # Application Settings
   PORT=5000
   NODE_ENV=production
   ```

4. **Database Setup (if using PostgreSQL)**
   ```bash
   # Create database
   createdb mccloud_backup
   
   # Run migrations
   npm run migrate
   ```

5. **Build Application**
   ```bash
   npm run build
   ```

6. **Start Application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm run start
   ```

7. **Using Deployment Script**
   Alternatively, use the provided deployment script:
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```
   This script will guide you through the setup process interactively.

### Deployment Options

The application can be deployed in two main configurations:

1. **Full Stack Deployment (Recommended for MVP)**
   - Deploy the entire Node.js application
   - Serves both frontend and backend from the same server
   - Simplifies configuration and CORS issues

2. **Split Deployment**
   - Build the frontend as static files (`npm run build`)
   - Deploy static files to a web server (Nginx, Apache)
   - Run the Node.js backend separately
   - Requires proper CORS and API configuration

## WordPress Plugin Deployment

1. **Plugin Installation**
   - Navigate to WordPress Admin > Plugins > Add New
   - Click "Upload Plugin" and select the `backupsheep.zip` file
   - Activate the plugin

2. **Plugin Configuration**
   - Go to WordPress Admin > McCloud Backup
   - Enter the API key from your McCloud Backup dashboard
   - Configure backup settings

## OAuth Configuration

For each storage provider, you need to register your application in their respective developer consoles:

1. **Google Drive**
   - Register at [Google Developer Console](https://console.developers.google.com/)
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `https://your-domain.com/auth/google/callback`
   - Enable Google Drive API

2. **Dropbox**
   - Register at [Dropbox Developer Console](https://www.dropbox.com/developers)
   - Create an app
   - Add redirect URI: `https://your-domain.com/auth/dropbox/callback`

3. **OneDrive**
   - Register at [Microsoft Azure Portal](https://portal.azure.com/)
   - Add redirect URI: `https://your-domain.com/auth/onedrive/callback`
   - Set permissions for OneDrive access

## Potential Issues and Considerations

### Security Considerations

1. **API Keys**
   - WordPress sites communicate using API keys
   - Ensure keys are properly secured in transit and at rest
   - Implement rate limiting to prevent abuse

2. **OAuth Tokens**
   - Store refresh tokens securely
   - Implement proper token refreshing logic
   - Handle token revocation gracefully

3. **File Security**
   - Backups contain sensitive data
   - Encrypt backups where possible
   - Ensure proper file permissions

### Performance Considerations

1. **Backup Size**
   - Large WordPress sites may produce huge backups
   - Consider chunked uploads for cloud storage
   - Implement proper timeout handling for long operations

2. **Concurrent Backups**
   - System should handle multiple sites backing up simultaneously
   - Implement queue system for high load scenarios
   - Monitor server resources during backup operations

3. **Database Scaling**
   - Monitor database size over time
   - Implement clean-up routines for outdated logs
   - Consider database sharding for very large deployments

### Integration Considerations

1. **WordPress Version Compatibility**
   - Test with various WordPress versions (5.6+)
   - Handle graceful degradation for older versions
   - Document minimum requirements clearly

2. **Plugin Conflicts**
   - Test with popular WordPress plugins for compatibility
   - Handle conflicts with other backup plugins gracefully
   - Document known conflicts

3. **Cloud Storage Rate Limits**
   - Be aware of API rate limits for storage providers
   - Implement exponential backoff for retries
   - Monitor usage to avoid hitting quotas

## Code Maintenance

### Directory Structure

```
/
├── client/               # Frontend React application
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utility functions
│   │   ├── pages/        # Page components
│   │   └── App.tsx       # Main app component
├── server/               # Backend Node.js server
│   ├── auth.ts           # OAuth authentication
│   ├── index.ts          # Server entry point
│   ├── routes.ts         # API route definitions
│   ├── storage.ts        # Data storage layer
│   └── vite.ts           # Vite integration
├── shared/               # Shared code between client and server
│   └── schema.ts         # Database schema definitions
├── wordpress-plugin/     # WordPress plugin files
│   ├── backupsheep/      # Plugin directory
│   │   ├── includes/     # PHP includes
│   │   └── backupsheep.php # Main plugin file
└── package.json          # Node.js dependencies
```

### Code Documentation

Most of the codebase is documented with comments, particularly:

- **Component Props**: React component props are typed with TypeScript interfaces
- **API Endpoints**: Server routes have function documentation with param details
- **Database Schema**: Data models are defined with annotations
- **WordPress Plugin**: PHP files include PHPDoc comments

However, some areas could benefit from additional documentation:

1. Complex business logic in utility functions
2. Edge case handling in authentication flows
3. Additional inline comments in complex React components

## Monitoring and Logging

For production deployment, consider implementing:

1. **Error Tracking**
   - Integrate error tracking service (Sentry, LogRocket)
   - Log client-side errors to server

2. **Performance Monitoring**
   - Track API response times
   - Monitor memory usage, especially during backup operations
   - Set up alerts for abnormal conditions

3. **Audit Logging**
   - Log all authentication events
   - Track backup successes and failures
   - Maintain history of administrative actions

## Final Checklist

Before MVP release, ensure:

- [ ] All OAuth providers have been tested with real credentials
- [ ] WordPress plugin has been tested on multiple WordPress versions
- [ ] Backups have been validated for integrity
- [ ] Error handling is robust across the application
- [ ] All environment variables are documented
- [ ] Security audit has been performed
- [ ] Performance testing under load has been conducted
- [ ] Documentation is complete and up-to-date

## Support and Maintenance

### Known Issues

1. Large WordPress sites (>10GB) may experience timeout issues during initial backup
2. OAuth token refresh may fail if users revoke application access
3. Some older browsers may have UI layout issues

### Future Enhancements

1. Implement backup encryption
2. Add support for more storage providers (Amazon S3, FTP)
3. Implement differential backup optimization
4. Add user roles and permissions
5. Develop email notification system

---

This document was prepared on April 6, 2025 and reflects the current state of the McCloud Backup MVP.