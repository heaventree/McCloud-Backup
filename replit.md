# WordPress Site Management Platform

## Overview
A comprehensive WordPress site management platform that provides backup and cloud storage solutions with enhanced user experience and security features.

**Current Status:** ✅ Running successfully  
**Port:** 5000  
**Database:** PostgreSQL (connected)

## Technology Stack
- **Frontend:** React with TypeScript, Tailwind CSS
- **Backend:** Express.js with TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Build Tool:** Vite
- **Authentication:** Passport.js with session management
- **Cloud Storage:** Multi-provider integrations (Dropbox, Google Drive, OneDrive, GitHub)

## Project Architecture
### Backend (`server/`)
- `index.ts` - Main server entry point
- `storage.ts` - Database storage implementation with Prisma
- `routes.ts` - API routes
- OAuth integrations for cloud providers

### Frontend (`client/src/`)
- React components with shadcn/ui
- TanStack Query for data fetching
- Wouter for routing

### Database (`prisma/`)
- Schema includes: Sites, Backups, Users, Feedback, StorageProviders
- Migrations handled via Prisma

## Recent Changes

### 2025-08-05: Enhanced Site Cards with Full Mobile Responsiveness 
- **User Request:** Make site cards responsive for better mobile/desktop experience
- **Key Changes Made:**
  - **Enhanced Grid Layout:** Updated grid to `grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3` with maximum 3 cards per row on larger screens for optimal visual balance
  - **Mobile-First Typography:** Responsive text sizes using `text-base sm:text-lg lg:text-xl` patterns throughout cards
  - **Optimized Spacing:** Progressive padding `p-3 sm:p-4 lg:p-6` and margin adjustments for different screen sizes
  - **Button Responsiveness:** Action buttons now use `text-xs sm:text-sm lg:text-base` with responsive icon sizing
  - **API Key Section:** Enhanced with smaller buttons and icons on mobile (`h-5 w-5 sm:h-6 sm:w-6`)
  - **Header Layout:** Improved page header with full-width "Add Site" button on mobile, compact on desktop
  - **Stats Grid Enhancement:** Better mobile layout with `grid-cols-1 sm:grid-cols-2` pattern
  - **Search Input:** Added max-width constraint for better desktop layout
- **Fixed storageProviderId Type Conversion:** Resolved frontend string to backend number conversion issue in site edit functionality
- **Result:** ✅ Fully responsive site management interface that works seamlessly across mobile, tablet, and desktop devices

### 2025-08-01: Added 5-Minute Backup Frequency with Automatic Scheduling
- **User Request:** Add 5-minute backup frequency option with automatic scheduling based on selected frequency
- **Key Changes Made:**
  - **Schema Update:** Added "5min" option to backup frequency enum in `shared/schema.ts`
  - **Form Enhancement:** Updated both add-site and edit forms to include "Every 5 Minutes" option
  - **Display Logic:** Enhanced backup frequency display to show "Every 5 Min" for readability
  - **Background Scheduler:** Created `server/scheduler.ts` with automatic backup scheduling service
  - **Server Integration:** Integrated scheduler with server startup to run continuously
  - **Intelligent Timing:** Scheduler checks every minute and triggers backups based on frequency settings
  - **Database Tracking:** Updates lastBackup timestamps and creates backup records automatically
- **Technical Details:**
  - Scheduler runs background checks every 60 seconds
  - Supports 5min, daily, weekly, monthly, yearly frequencies  
  - Creates backup records in database when schedules trigger
  - Logs detailed scheduling information for monitoring
- **Result:** ✅ Full automatic backup scheduling with 5-minute option and background service running

### 2025-08-01: Made Site Management Cards Fully Responsive + Fixed Progress Calculation
- **User Request:** Make site cards responsive + fix backup progress displaying over 100%
- **Key Changes Made:**
  - **Responsive Grid Layout:** Updated grid to `sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` with responsive gaps
  - **Card Structure:** Made headers stack on mobile with `flex-col sm:flex-row` and proper text truncation
  - **Stats Grid:** Changed from `grid-cols-2` to `grid-cols-1 sm:grid-cols-2` for mobile-first approach
  - **Typography:** Responsive text sizes using `text-lg sm:text-xl` and `text-xs sm:text-sm` patterns
  - **Action Buttons:** Stack vertically on mobile with `flex-col sm:flex-row` layout
  - **Container Padding:** Responsive padding `p-3 sm:p-6` for better mobile spacing
  - **Progress Fix:** Added `Math.min(100, ...)` to cap backup progress at 100% maximum
- **Result:** ✅ Fully responsive site management cards that work perfectly on mobile, tablet, and desktop with fixed progress calculation

### 2025-08-01: Enhanced Site Cards with Storage Provider Information + Fixed Backup Progress
- **User Request:** Add storage provider info to cards + fix progress exceeding 100%
- **Key Changes Made:**
  - **Storage Provider Display:** Added dedicated section with cloud icon showing provider name and type
  - **Progress Calculation Fix:** Capped backup progress at 100% using `Math.min(100, overallProgress)`
  - **Enhanced Card Layout:** Added storage provider information in gray background section
  - **Responsive Icons:** Used `flex-shrink-0` for consistent icon sizing
- **Result:** ✅ Site cards now display storage provider information and backup progress correctly caps at 100%

### 2025-07-31: Cleaned Up Site Management Files and Enhanced UI
- **User Request:** Removed conflicting site listing files and enhanced site management with proper edit/delete functionality
- **Key Changes Made:**
  - **File Cleanup:** Removed unused site files (`sites.tsx`, `site-management-new.tsx`, `site-management-simple.tsx`, `site-management.tsx.bak`) to eliminate conflicts
  - **Enhanced Site Management:** Completely rebuilt `site-management.tsx` with modern card-based layout
  - **Dropdown Functionality:** Added proper dropdown menu with MoreVertical icon for edit/delete operations
  - **Backup Frequency Display:** Added Calendar icon with backup frequency display (Daily, Monthly, etc.) on each site card
  - **Edit Modal:** Implemented functional edit site modal with proper form handling and API integration
  - **Delete Confirmation:** Added AlertDialog for delete confirmation outside dropdown structure
  - **Updated Site Types:** Fixed Site interface in `client/src/lib/types.ts` to include all required fields (backupFrequency, status, lastBackup, etc.)
  - **Responsive Design:** Improved card layout with proper spacing, colors, and dark mode support
- **Result:** ✅ Single clean site management file with full CRUD functionality, proper dropdown menus, and backup frequency display

### 2025-07-31: Enhanced Site Management with Backup Frequency and Dropdown UI (Previous Version)
- Enhanced "Add Site" form with backup frequency dropdown (On Demand, Daily, Weekly, Monthly, Yearly)
- Updated database schema to include `backupFrequency` field for sites  
- Modified backend API to automatically create backup schedules based on selected frequency
- Implemented intelligent retention policies (daily: 30, weekly: 12, monthly: 12, yearly: 5 backups)

### 2025-07-29: Completed Database Migration to Prisma-Only Architecture
- **Project Goal:** Migrated entire backend API codebase from dual ORM setup (Prisma + Drizzle) to exclusively using Prisma for all database operations
- **Key Changes Made:**
  - Removed all Drizzle ORM dependencies and related code from the codebase
  - Updated `shared/schema.ts` to use Prisma-based type definitions instead of Drizzle schemas
  - Migrated all raw SQL queries in `backup-routes.ts` and `dropbox.ts` to use Prisma client calls
  - Fixed type mismatches in storage interface (standardized siteId vs projectId parameters)
  - Removed obsolete files: `server/database/pool.ts`, `server/database/postgres-storage.ts`, `server/db.ts`
  - Updated storage interface in `server/storage.ts` to use Prisma exclusively
- **Testing Results:** ✅ All API endpoints (`/api/backups`, `/api/sites`) function correctly with unified Prisma setup
- **Impact:** Simplified architecture, improved type safety, eliminated dual ORM complexity

### 2025-07-29: Fixed Hardcoded Site URL in Backup API
- **Issue:** One-Click Backup button was always calling API with hardcoded 'https://heaventree2.com' URL instead of using the actual site URL
- **Solution:** Updated `server/routes/backup-routes.ts` to dynamically use `site.url` from database for all WordPress API calls
- **Changes Made:**
  - Fixed backup start endpoint to use `${site.url}/index.php?rest_route=...`
  - Fixed backup status endpoint to use site URL from backup record
  - Fixed backup logs endpoint to use site URL from backup record
- **Result:** ✅ Backup operations now correctly target the user's actual WordPress site URL

### 2025-07-28: Fixed Prisma Client Initialization
- **Issue:** Prisma client was generated for "debian-openssl-1.1.x" but deployment required "debian-openssl-3.0.x"
- **Solution:** Updated `prisma/schema.prisma` to include `binaryTargets = ["native", "debian-openssl-3.0.x"]`
- **Action:** Regenerated Prisma client with `npx prisma generate`
- **Result:** ✅ Application now starts successfully

## Environment Configuration
- Database connection via `DATABASE_URL`
- OAuth credentials for cloud providers (some missing - see warnings in logs)
- CORS configured for development

## User Preferences
- Communication: Clear, technical explanations preferred
- Focus on robust, production-ready solutions
- Document all architectural changes

## Known Issues
- Missing OAuth credentials for Google, GitHub, OneDrive (non-blocking warnings)
- Some cloud provider integrations require API keys for full functionality

## Development Commands
- `npm run dev` - Start development server
- `npx prisma generate` - Regenerate Prisma client
- `npm run db:push` - Push schema changes to database