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
- **Comprehensive OAuth Token Management:** Implements a `TokenRefreshManager` for automatic token refresh for integrated cloud providers (Dropbox, Google, etc.), ensuring long-term authentication without manual user intervention.
- **Full WordPress API Integration:** The backup flow is designed to interact with WordPress REST API endpoints in a precise sequence, handling process IDs and passing necessary tokens securely.

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