# McCloud Backup - Project Planning Document

## Project Vision

McCloud Backup aims to be a comprehensive WordPress site management and backup solution that offers intelligent monitoring, proactive security insights, and user-friendly maintenance tools for website administrators. 

### Core Value Proposition

1. **Simplified WordPress Backup Management**
   - Centralized dashboard for managing multiple WordPress sites
   - Intelligent backup scheduling and monitoring
   - Quick restoration capabilities with version history

2. **Multi-Provider Storage Integration**
   - Support for multiple cloud storage providers (Google Drive, Dropbox, OneDrive)
   - GitHub repository backup integration
   - Storage quota monitoring and optimization

3. **Visual Feedback System**
   - Point-and-click interface for targeted feedback on specific page elements
   - Embeddable script for third-party sites
   - Simple roadmap feature for tracking implementation progress

4. **Site Health & Security**
   - WordPress version compatibility checking
   - Plugin security vulnerability monitoring
   - Performance optimization recommendations

## Technical Architecture

### System Overview

McCloud Backup consists of the following major components:

1. **React Frontend Application**
   - TypeScript for type safety
   - Tailwind CSS with Shadcn UI components for responsive design
   - React Query for data fetching and state management
   - Wouter for lightweight routing

2. **Node.js Backend**
   - Express server for REST API endpoints
   - OAuth integration for cloud storage providers
   - Drizzle ORM with PostgreSQL/in-memory data storage
   - Zod for type validation

3. **WordPress Plugin**
   - PHP implementation for WordPress integration
   - REST API endpoints for communication with main application
   - Built on WordPress plugin architecture

4. **Feedback System**
   - Interactive overlay for clicking on elements
   - Element path tracking for targeted comments
   - Embeddable script for third-party sites

### Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  React Frontend ├────►│  Express API    ├────►│  Storage        │
│                 │     │                 │     │  Providers      │
└────────┬────────┘     └────────┬────────┘     └─────────────────┘
         │                       │
         │                       │
┌────────▼────────┐     ┌────────▼────────┐
│                 │     │                 │
│  Feedback       │     │  WordPress      │
│  Overlay        │     │  Plugin         │
│                 │     │                 │
└─────────────────┘     └─────────────────┘
```

### Data Storage

#### Main Application Data

The application uses Drizzle ORM with either PostgreSQL (production) or in-memory storage (development) to manage:

- User accounts and authentication
- WordPress site connections
- Backup schedules and history
- Storage provider configurations
- Feedback and comments

#### WordPress Integration

The WordPress plugin stores:
- Connection keys and tokens
- Local backup configuration
- Site-specific settings

### Authentication & Security

- **Application Access**: Session-based authentication
- **WordPress Plugin**: API key authentication
- **Storage Providers**: OAuth 2.0 token-based authentication
- **Data Security**: HTTPS for all communications, encrypted tokens storage

## Development Constraints

### Technical Constraints

1. **Browser Compatibility**
   - Support for modern browsers (Chrome, Firefox, Safari, Edge)
   - Graceful degradation for older browsers

2. **Performance Requirements**
   - Dashboard page load under 2 seconds
   - Backup operations with progress indication
   - Responsive design for all device sizes

3. **Scalability Considerations**
   - Support for up to 100 WordPress sites per account
   - Handle up to 10GB backup files
   - Manage concurrent backup operations

### Development Guidelines

1. **Code Organization**
   - Consistent file and folder structure
   - Component-based architecture
   - Shared types between frontend and backend

2. **Quality Assurance**
   - TypeScript for type safety
   - Zod validation for API requests
   - Error handling and logging

3. **Documentation Requirements**
   - Inline code documentation
   - API endpoint documentation
   - User guides and tutorials

## Implementation Strategy

### Phase 1: Core Development & Compatibility ✓
- Basic dashboard UI with dark/light mode
- Site management functionality
- Backup scheduling system
- Storage provider integration
- Storage provider selection in backup schedules

### Phase 2: Storage Provider & WordPress Compatibility (Current)
- Update compatibility with latest WordPress version (5.9+)
- Verify and update Google Drive API integration
- Update AWS S3 storage provider integration
- Add GitHub repository backup functionality
- Update Dropbox API compatibility
- Test and fix OneDrive connectivity

### Phase 3: Feedback System & User Experience
- Implement point-and-click visual feedback system
- Create embeddable feedback script
- Enhance dashboard with improved visualization
- Add user permission management
- Implement notification system

### Phase 4: Advanced Features
- WordPress version monitoring system
- Security vulnerability feed integration
- Plugin compatibility testing framework
- Automated update notification system
- Rollback capability for failed updates

## Resources and Dependencies

### External Dependencies

1. **Cloud Storage APIs**
   - Google Drive API
   - Dropbox API
   - Microsoft OneDrive API
   - GitHub API

2. **WordPress Integration**
   - WordPress REST API
   - WP Cron for scheduled tasks

3. **Third-Party Services**
   - SVG Icons (local assets or SVGL API)
   - Chart visualization libraries

### Development Environment

- Node.js v20 or later
- npm or yarn package manager
- PostgreSQL (optional, for production)
- WordPress test environment

---

*Last updated: April 15, 2025*