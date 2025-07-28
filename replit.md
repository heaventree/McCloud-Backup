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