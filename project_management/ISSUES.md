# McCloud Backup - Issues & Bug Tracking

This document tracks known issues, bugs, and enhancement requests for the McCloud Backup platform.

## Active Issues

### High Priority

1. **Storage Provider Icons Display Issues**
   - **Description**: Storage provider icons (Google Drive, AWS S3, etc.) appear blurry or incorrect
   - **Status**: In progress
   - **Assigned**: UI Team
   - **Solution**: Replace SVGL API integration with local SVG assets
   - **Details**: 
     - SVGL API network requests are failing with network errors
     - Current fallback icons need design improvement
     - Need to create a dedicated asset library for all storage provider icons
   - **Ticket**: #UI-028

### Medium Priority

1. **GitHub Repository Integration**
   - **Description**: Need to add GitHub as a backup storage provider option
   - **Status**: In development
   - **Assigned**: Backend Team
   - **Solution**: Implement GitHub API integration for repository backup
   - **Details**:
     - Requires OAuth integration with GitHub
     - Need to implement repository creation and file upload
     - Must handle large files and rate limits
   - **Ticket**: #FEAT-042

2. **Mobile Responsiveness**
   - **Description**: Dashboard elements don't scale properly on mobile devices
   - **Status**: To do
   - **Assigned**: UI Team
   - **Solution**: Enhance responsive design for small screen sizes
   - **Details**:
     - Charts overflow on mobile screens
     - Table layouts break at small viewports
     - Navigation menu needs mobile optimization
   - **Ticket**: #UI-031

### Low Priority

1. **Form Validation Feedback**
   - **Description**: Form validation errors could be more user-friendly
   - **Status**: Backlog
   - **Assigned**: Unassigned
   - **Solution**: Improve error messaging and visual indicators
   - **Details**:
     - Add inline validation feedback
     - Highlight fields with errors more clearly
     - Provide more specific error messages
   - **Ticket**: #UI-035

## Resolved Issues

1. **Site Management Crashes** ✓
   - **Description**: Application crashed when accessing site management page
   - **Resolution**: Fixed critical issues in site-management.tsx with cleaner implementation
   - **Resolved**: March 28, 2025
   - **Ticket**: #BUG-021

2. **Dark Mode Inconsistencies** ✓
   - **Description**: Some UI elements didn't respect dark mode settings
   - **Resolution**: Updated color theme variables and component styling
   - **Resolved**: March 15, 2025
   - **Ticket**: #UI-019

3. **Storage Provider Selection** ✓
   - **Description**: Unable to select storage providers in backup schedules
   - **Resolution**: Fixed form state management and API integration
   - **Resolved**: March 10, 2025
   - **Ticket**: #BUG-018

## Enhancement Requests

1. **Backup Encryption**
   - **Description**: Add option to encrypt backups before storage
   - **Status**: Planned for Phase 4
   - **Priority**: Medium
   - **Requested by**: Security Team
   - **Ticket**: #FEAT-048

2. **Email Notifications**
   - **Description**: Send email alerts for backup completion/failures
   - **Status**: Planned for Phase 3
   - **Priority**: High
   - **Requested by**: User feedback
   - **Ticket**: #FEAT-037

3. **Backup Size Optimization**
   - **Description**: Add options to exclude specific files/folders from backups
   - **Status**: Planned for Phase 4
   - **Priority**: Medium
   - **Requested by**: User feedback
   - **Ticket**: #FEAT-052

## Technical Debt

1. **Refactor Storage Provider Authentication**
   - **Description**: Current OAuth implementation needs standardization
   - **Impact**: Medium
   - **Effort**: Medium
   - **Status**: Planned for Phase 3
   - **Ticket**: #TECH-012

2. **Update React Query Implementation**
   - **Description**: Optimize query invalidation patterns
   - **Impact**: Low
   - **Effort**: Low
   - **Status**: Backlog
   - **Ticket**: #TECH-015

3. **Improve Error Handling**
   - **Description**: Standardize error handling across the application
   - **Impact**: Medium
   - **Effort**: Medium
   - **Status**: Planned for Phase 3
   - **Ticket**: #TECH-018

---

*Last updated: April 15, 2025*