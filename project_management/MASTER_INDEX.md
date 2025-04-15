# McCloud Backup - Project Documentation

Welcome to the unified documentation hub for McCloud Backup, a comprehensive WordPress site backup, management, and optimization platform.

## Overview

McCloud Backup provides intelligent backup management, security monitoring, and user-friendly WordPress maintenance tools for website administrators. This documentation center serves as a single source of truth for all aspects of the project.

## Quick Navigation

### Project Fundamentals
- [Project Planning](./PLANNING.md) - Vision, architecture, and technical constraints
- [Development Roadmap](./ROADMAP.md) - Current progress and future development plans
- [Known Issues](./ISSUES.md) - Bugs, challenges, and their resolution status
- [Change Log](./CHANGELOG.md) - History of project updates and changes

### Core Documentation
- [Pre-Flight Guide](./technical/preflight_guide.md) - Pre-deployment checklist and configuration
- [Feedback System Implementation](./technical/feedback_implementation.md) - Visual feedback tool documentation
- [WordPress Integration](./technical/wordpress_integration.md) - Plugin architecture and site connectivity

### Component Documentation
- [Backend API Reference](./technical/api_reference.md) - API endpoints and usage
- [Storage Provider Integration](./technical/storage_providers.md) - Cloud storage connectivity
- [Database Schema](./technical/database_schema.md) - Data structure and relationships

### Developer Resources
- [Development Environment Setup](./technical/environment_setup.md) - Getting started guide for developers
- [Project Structure](./technical/project_structure.md) - Codebase organization and key files
- [Debugging Guide](./technical/debugging_guide.md) - Troubleshooting common issues

### User Documentation
- [Installation Guide](./technical/installation_guide.md) - Setup instructions for end users
- [WordPress Plugin Guide](./technical/wordpress_plugin_guide.md) - WordPress integration instructions
- [User Manual](./technical/user_manual.md) - Complete user documentation

## Project Components

McCloud Backup consists of several integrated components:

1. **Core Dashboard Application**
   - React frontend with TypeScript
   - Express backend with REST API
   - Storage provider integration

2. **Visual Feedback System**
   - Point-and-click interface for targeted feedback
   - Element-specific commenting capability
   - Standalone embeddable script for third-party sites

3. **WordPress Plugin**
   - Site connection and authentication
   - Backup management from WordPress admin
   - Site health monitoring

4. **Storage Provider Connectors**
   - Google Drive, Dropbox, OneDrive integration
   - GitHub repository backup system
   - Local storage options

## Project Status

Current development phase: **Phase 2 - Storage Provider & WordPress Compatibility**

- Previous milestone: Core Development & Compatibility ✓
- Current focus: GitHub repository integration and feedback system implementation
- Next milestone: Advanced monitoring and recovery features

## Development Team

- Project Lead: [Name]
- Frontend Developers: [Names]
- Backend Developers: [Names]
- QA Team: [Names]

---

*Last updated: April 15, 2025*