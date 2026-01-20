# WordPress Site Management Platform

## Overview
A comprehensive WordPress site management platform that provides backup and cloud storage solutions with enhanced user experience and security features. The project aims to deliver robust, production-ready solutions for managing WordPress sites, focusing on reliable backup processes and multi-provider cloud storage integration.

## User Preferences
- Communication: Clear, technical explanations preferred
- Focus on robust, production-ready solutions
- Document all architectural changes

## System Architecture
The platform is built with a React frontend (TypeScript, Tailwind CSS), an Express.js backend (TypeScript), and a PostgreSQL database with Prisma ORM. Vite is used as the build tool, and Passport.js handles authentication with session management.

**Key Architectural Decisions:**
- **Unified ORM:** Exclusively uses Prisma for all database operations, simplifying the architecture and improving type safety.
- **Modular Backend:** Backend is structured with clear separation for API routes, database storage, and OAuth integrations.
- **Frontend State Management:** Utilizes TanStack Query for efficient data fetching and Wouter for client-side routing.
- **UI/UX:** Leverages shadcn/ui for consistent and responsive UI components. Design emphasizes mobile responsiveness across all sections, including site cards, ensuring optimal experience on various devices.
- **Automated Backup Scheduling:** Features a robust background scheduler that can trigger backups at specified frequencies (e.g., every 5 minutes, daily, weekly, monthly, yearly), automatically initiating backup processes via the WordPress API.
- **Comprehensive OAuth Token Management:** Implements a `TokenRefreshManager` for automatic token refresh for integrated cloud providers (Dropbox, Google, etc.), ensuring long-term authentication without manual user intervention. Handles nested token storage structures and HTML entity decoding.
- **Full WordPress API Integration:** The backup flow is designed to interact with WordPress REST API endpoints in a precise sequence, handling process IDs and passing necessary tokens securely with proper form data encoding.

**Recent Fixes (August 2025):**
- **Token Malformation Issue Resolved:** Fixed critical issue where Dropbox tokens were stored with nested JSON structure and HTML entity encoding in database. TokenRefreshManager now properly parses {"token": "JSON_STRING"} format and decodes HTML entities (&quot; → ").
- **WordPress API Format Compatibility:** Backup/run API now uses form data (application/x-www-form-urlencoded) instead of JSON for better WordPress REST API compatibility.
- **Backup Timeout Optimization:** Increased API timeouts from 30 seconds to 2 minutes to accommodate typical WordPress backup processing times.
- **Enhanced Error Handling:** Added comprehensive token validation and debugging logs for better troubleshooting.
- **Webhook Status Updates (August 6, 2025):** Added webhook endpoint `/api/backup/webhook/status-update` for third-party systems to notify when auto-backup schedules complete. Endpoint only requires `processId` in JSON payload, automatically queries WordPress API to get current status, then updates backup records and site lastBackup timestamps accordingly.
- **Storage Path & Type Fix (August 6, 2025):** Fixed issue in `/api/backup/start` endpoint where `storagePath` and `storageType` fields weren't being saved correctly in backup records. Now properly extracts and saves the backup path from WordPress API response and storage provider type during backup creation.
- **Backup Download Functionality Complete (August 6, 2025):** Successfully implemented and debugged the complete backup download system. Fixed major Dropbox API Content-Type header issues, implemented directory path handling for backup folders, added intelligent file detection with fallback mechanisms. The `/api/backups/:id/download` endpoint now properly: gets backup ID → fetches backup record → retrieves storage provider and token → downloads files from cloud storage. Architecture follows correct database relationship flow as specified.
- **ZIP Archive Creation Fixed (August 15, 2025):** Resolved critical issue where Dropbox directory downloads were creating malformed archives. Previously, the system concatenated files with text headers instead of creating proper ZIP files, causing only some files (like themes.zip contents) to be accessible while others (verification.txt, wp-config.php, database.sql) were missing. Now uses the `archiver` library to create proper ZIP files with all individual files preserved correctly.
- **Download Size API Accuracy Fixed (August 15, 2025):** Fixed major discrepancy where the `/api/backups/:id/size` endpoint reported uncompressed total file sizes (~131MB) while actual downloads delivered compressed ZIP files (~29MB). Created new `getDropboxDownloadSize` function that generates the actual compressed archive to provide accurate size information matching the real download. This ensures users see correct file sizes in confirmation dialogs and progress tracking.
- **Streaming ZIP Downloads Implemented (August 29, 2025):** Completely replaced memory-heavy download system with streaming ZIP creation. The `/api/backups/:id/download` endpoint now streams files directly from Dropbox → ZIP archive → client response without storing content in server memory. Added `streamDropboxDirectoryAsZip()` and `streamDropboxFile()` functions that use Node.js streams and archiver for constant low memory usage (~2-5MB) regardless of backup size. Supports unlimited backup sizes and provides faster response times.
- **Memory-Efficient Size Calculation (August 29, 2025):** Optimized `/api/backups/:id/size` endpoint to eliminate RAM usage by implementing size caching and streaming calculation. Now returns cached `filesize` from database instantly when available. For uncached sizes, uses new `calculateDropboxCompressedSize()` function that streams to a size-counting sink instead of loading full archives. Added automatic size calculation during backup completion via the `PUT /api/backups/:id/status` endpoint when status is set to 'completed'.
- **Google Drive Storage Info API (January 2026):** Added `/api/googledrive/provider/:id` endpoint to fetch Google Drive account info and space usage, mirroring the existing Dropbox implementation. Created `GoogleDriveProviderCard` component to display storage usage, account name, and email for Google Drive providers. Added `makeGoogleDriveApiCall` method to `TokenRefreshManager` for automatic 401 error handling and token refresh.
- **Google Drive Support for Backup Webhooks (January 2026):** Extended all backup webhook endpoints and scheduler retry logic to support Google Drive alongside Dropbox:
  - Added `fetchGoogleDriveFolderSizeByPath` function to calculate backup folder sizes in Google Drive by traversing folder paths and recursively calculating file sizes.
  - Updated `/api/backup/webhook/status-update` to detect storage provider type (Dropbox or Google Drive) and use the appropriate API for folder size retrieval.
  - Updated `/api/backup/webhook/status-update/fail` with the same multi-provider support.
  - Updated `/api/backup/webhook/process-update` to include `storage_provider` in form data when calling WordPress plugin's `/run` endpoint.
  - Updated scheduler retry logic (`retryStuckProcess`) to include `storage_provider` in form data for stuck backup retries.

**Feature Specifications:**
- **Backup Functionality:** Supports full WordPress site backups (database and files) with configurable frequencies.
- **Cloud Storage Integration:** Provides seamless integration with multiple cloud storage providers.
- **Site Management:** Offers full CRUD (Create, Read, Update, Delete) functionality for managing WordPress sites, including detailed site cards displaying backup status and storage provider information.
- **Responsive Design:** All UI components, particularly site cards, are designed to be fully responsive across mobile, tablet, and desktop viewports.

## External Dependencies
- **PostgreSQL:** Primary database for storing site, backup, user, and configuration data.
- **Prisma ORM:** Used for database interactions.
- **Passport.js:** Authentication library for user session management.
- **Cloud Storage Providers (OAuth integrations):**
    - Dropbox
    - Google Drive
    - OneDrive
    - GitHub
- **WordPress REST API:** Used for initiating and managing backup processes directly on WordPress sites.