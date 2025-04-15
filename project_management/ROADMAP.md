# McCloud Backup - Development Roadmap

This document outlines the planned development phases for the McCloud Backup platform, including completed items, current focus, and future enhancements.

## Phase 1: Core Development & Compatibility ✓
*Completed - March 2025*

**Core Platform**
- ✓ Basic dashboard UI with dark/light mode support
- ✓ Site management functionality (add, edit, remove sites)
- ✓ Backup scheduling system with configurable intervals
- ✓ Initial storage provider integration architecture
- ✓ Storage provider selection in backup schedules

**User Interface**
- ✓ Update form inputs to use more subtle, modern styling
- ✓ Update dropdown selects to match input field styling
- ✓ Add subtle shadows to form elements for depth
- ✓ Improve visual consistency across components
- ✓ Align bottom buttons in card layouts for visual consistency

## Phase 2: Storage Provider & WordPress Compatibility (Current)
*In Progress - April 2025*

**Storage Integration**
- ⟳ Update compatibility with latest WordPress version (5.9+)
- ⟳ Verify and update Google Drive API integration
- ⟳ Update AWS S3 storage provider integration
- ➤ Add GitHub repository backup functionality
- ⟳ Update Dropbox API compatibility
- ⟳ Test and fix OneDrive connectivity

**Feedback System Implementation**
- ✓ Design feedback system architecture
- ✓ Implement point-and-click interface for element selection
- ✓ Add element path tracking for targeted comments
- ✓ Create feedback dashboard for viewing and managing comments
- ✓ Develop embeddable script for third-party site integration

**UI Improvements**
- ➤ Fix storage provider icons display issues
- ➤ Replace SVGL API with local SVG asset library
- ➤ Enhance mobile responsiveness for dashboard elements
- ➤ Optimize spacing and layout for better readability

## Phase 3: Alert & Update System
*Planned - May 2025*

**Monitoring & Alerts**
- WordPress version monitoring system
- Security vulnerability feed integration
- Plugin compatibility testing framework
- Automated update notification system
- Rollback capability for failed updates

**UI/UX Enhancements**
- Add backup health score visualization
- Design intuitive backup scheduling wizard
- Create backup recommendation engine
- Implement backup priority settings
- Add animated backup progress indicator

## Phase 4: Advanced Features
*Planned - June-July 2025*

**User Management**
- Create user role management for central dashboard
- Implement team collaboration features
- Add client reporting capabilities

**Backup Enhancements**
- Add detailed backup reporting and analytics
- Implement backup encryption options
- Add incremental backup functionality
- Develop AI-powered backup recommendation engine
- Create interactive backup timeline visualization

**User Experience**
- One-click cloud storage integration wizard
- Personalized backup health score with gamification elements
- Quick preview modal for backup content before restoration
- Animated backup progress visualizer
- Intuitive drag-and-drop backup schedule creator

## Phase 5: Advanced Monitoring & Recovery
*Planned - Q3-Q4 2025*

**Monitoring**
- Real-time backup status monitoring
- Automated restoration testing
- Cross-site recovery options
- Notification system improvements
- Performance optimization

**Recovery Features**
- One-click disaster recovery
- Selective content restoration
- Database-only recovery options
- File comparison tools

## Phase 6: Integration & Expansion
*Planned - Q4 2025*

**Ecosystem Expansion**
- Integration with other WordPress plugins
- Offsite verification systems
- Plugin marketplace integration
- Extended API for third-party integrations

## Known Issues & Future Improvements

**Current Issues**
- Storage provider icons not displaying correctly or appearing blurry
- SVGL API integration needs optimization or replacement with local SVG asset library
- Improve visual appearance of storage provider iconography

**Pending UI Improvements**
- Enhance mobile responsiveness for dashboard elements
- Optimize spacing and layout for better readability
- Improve form validation feedback

---

*Last updated: April 15, 2025*