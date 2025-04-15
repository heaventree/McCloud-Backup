# McCloud Backup - Project Structure

This document outlines the organization of the McCloud Backup codebase, explaining the purpose of key directories and files to help developers navigate the project.

## Directory Structure Overview

```
/
├── client/               # Frontend React application
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utility functions
│   │   ├── pages/        # Page components
│   │   ├── embeddable/   # Embeddable scripts for third-party sites
│   │   └── App.tsx       # Main app component
├── server/               # Backend Node.js server
│   ├── auth.ts           # OAuth authentication
│   ├── index.ts          # Server entry point
│   ├── routes.ts         # API route definitions
│   ├── storage.ts        # Data storage layer
│   ├── storage-providers/ # Storage provider implementations
│   └── vite.ts           # Vite integration
├── shared/               # Shared code between client and server
│   └── schema.ts         # Database schema definitions
├── wordpress-plugin/     # WordPress plugin files
│   ├── backupsheep/      # Plugin directory
│   │   ├── includes/     # PHP includes
│   │   └── backupsheep.php # Main plugin file
├── project_management/   # Project documentation
│   ├── technical/        # Technical documentation
│   └── MASTER_INDEX.md   # Documentation index
├── public/               # Static assets
├── feedback_system_files/ # Feedback system source files
└── package.json          # Node.js dependencies
```

## Key Directories Explained

### `/client`

Contains the frontend React application built with TypeScript, Tailwind CSS, and shadcn/ui components.

#### Important Files

- `/client/src/App.tsx` - Main application component, sets up routing and authentication
- `/client/src/main.tsx` - Entry point for the React application
- `/client/src/lib/queryClient.ts` - React Query configuration

#### Key Subdirectories

- `/client/src/components/` - Reusable UI components
  - `/client/src/components/ui/` - Base UI components from shadcn/ui
  - `/client/src/components/dashboard/` - Dashboard-specific components
  - `/client/src/components/feedback/` - Visual feedback system components
  - `/client/src/components/sites/` - Site management components
  - `/client/src/components/backups/` - Backup management components

- `/client/src/pages/` - Page components for each route
  - `/client/src/pages/dashboard.tsx` - Main dashboard page
  - `/client/src/pages/site-management.tsx` - WordPress site management
  - `/client/src/pages/storage-providers.tsx` - Storage provider management
  - `/client/src/pages/backup-schedules.tsx` - Backup schedule management
  - `/client/src/pages/feedback.tsx` - Feedback system dashboard

- `/client/src/hooks/` - Custom React hooks
  - `/client/src/hooks/use-toast.ts` - Toast notification hook
  - `/client/src/hooks/useSites.ts` - Hook for site management
  - `/client/src/hooks/useStorageProviders.ts` - Hook for storage providers
  - `/client/src/hooks/useBackups.ts` - Hook for backup operations

- `/client/src/lib/` - Utility functions and libraries
  - `/client/src/lib/types.ts` - TypeScript type definitions
  - `/client/src/lib/utils.ts` - General utility functions
  - `/client/src/lib/date-utils.ts` - Date formatting and manipulation

- `/client/src/embeddable/` - Standalone scripts for embedding in third-party sites
  - `/client/src/embeddable/feedback-script.ts` - Embeddable feedback widget

### `/server`

Contains the Node.js backend built with Express, handling API requests, authentication, and data storage.

#### Important Files

- `/server/index.ts` - Main server entry point, sets up Express and middleware
- `/server/auth.ts` - Authentication logic for users and OAuth providers
- `/server/routes.ts` - API route definitions
- `/server/storage.ts` - Data storage interface and implementation

#### Key Subdirectories

- `/server/storage-providers/` - Implementations for different storage providers
  - `/server/storage-providers/google-drive.ts` - Google Drive integration
  - `/server/storage-providers/dropbox.ts` - Dropbox integration
  - `/server/storage-providers/onedrive.ts` - OneDrive integration
  - `/server/storage-providers/github.ts` - GitHub integration
  - `/server/storage-providers/s3.ts` - AWS S3 integration

### `/shared`

Contains code shared between the frontend and backend, primarily data models and validation schemas.

#### Important Files

- `/shared/schema.ts` - Database schema definitions using Drizzle ORM
- `/shared/validators.ts` - Shared validation logic using Zod

### `/wordpress-plugin`

Contains the WordPress plugin files for integration with WordPress sites.

#### Important Files

- `/wordpress-plugin/backupsheep/backupsheep.php` - Main plugin entry point
- `/wordpress-plugin/backupsheep/includes/class-api.php` - API integration with McCloud Backup

### `/project_management`

Contains project documentation, guidelines, and development resources.

#### Important Files

- `/project_management/MASTER_INDEX.md` - Central navigation for all documentation
- `/project_management/PLANNING.md` - Project vision and architecture
- `/project_management/ROADMAP.md` - Development roadmap and milestones
- `/project_management/ISSUES.md` - Known issues and bugs
- `/project_management/CHANGELOG.md` - Version history and changes

#### Key Subdirectories

- `/project_management/technical/` - Technical documentation
  - `/project_management/technical/api_reference.md` - API documentation
  - `/project_management/technical/database_schema.md` - Database schema details
  - `/project_management/technical/feedback_implementation.md` - Feedback system documentation
  - `/project_management/technical/preflight_guide.md` - Deployment preparation guide
  - `/project_management/technical/storage_providers.md` - Storage provider integration documentation
  - `/project_management/technical/wordpress_integration.md` - WordPress plugin documentation

## Key Files

### Configuration Files

- `/package.json` - Node.js dependencies and scripts
- `/tsconfig.json` - TypeScript configuration
- `/tailwind.config.ts` - Tailwind CSS configuration
- `/vite.config.ts` - Vite bundler configuration
- `/drizzle.config.ts` - Drizzle ORM configuration
- `/theme.json` - UI theme configuration

### Entry Points

- `/client/src/main.tsx` - Frontend entry point
- `/server/index.ts` - Backend entry point
- `/wordpress-plugin/backupsheep/backupsheep.php` - WordPress plugin entry point

### Deployment Files

- `/deploy.sh` - Deployment script
- `/install.sh` - Installation script

## Code Patterns

### Frontend Patterns

1. **Page Components**

Page components follow this general structure:

```tsx
// client/src/pages/example-page.tsx
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';

export default function ExamplePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/example'],
    queryFn: fetchExampleData
  });

  return (
    <div className="container">
      <PageHeader title="Example Page" />
      <Card>
        {/* Card content */}
      </Card>
    </div>
  );
}
```

2. **Data Fetching**

Data fetching is handled with React Query:

```tsx
// client/src/hooks/useExampleData.ts
import { useQuery, useMutation, queryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export function useExampleData() {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/example'],
    queryFn: () => fetch('/api/example').then(res => res.json())
  });

  const createExample = useMutation({
    mutationFn: (newExample) => apiRequest('/api/example', {
      method: 'POST',
      body: JSON.stringify(newExample)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/example'] });
    }
  });

  return {
    data,
    isLoading,
    createExample
  };
}
```

3. **Form Handling**

Forms use React Hook Form with Zod validation:

```tsx
// client/src/components/example-form.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertExampleSchema } from '@/shared/schema';
import { Button } from '@/components/ui/button';
import { Form, FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

export function ExampleForm({ onSubmit }) {
  const form = useForm({
    resolver: zodResolver(insertExampleSchema),
    defaultValues: {
      name: '',
      description: ''
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        {/* More form fields */}
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
```

### Backend Patterns

1. **API Routes**

API routes follow this pattern:

```typescript
// server/routes.ts
export async function registerRoutes(app: Express, storage: IStorage): Promise<void> {
  app.get('/api/examples', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const examples = await storage.getExamples();
      res.json(examples);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch examples' });
    }
  });

  app.post('/api/examples', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const result = insertExampleSchema.safeParse(req.body);
      
      if (!result.success) {
        return handleZodError(result.error, res);
      }
      
      const example = await storage.createExample(result.data);
      res.status(201).json(example);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create example' });
    }
  });

  // More routes...
}
```

2. **Storage Interface**

The storage layer follows the repository pattern:

```typescript
// server/storage.ts
export interface IStorage {
  getExamples(): Promise<Example[]>;
  getExampleById(id: number): Promise<Example | undefined>;
  createExample(example: InsertExample): Promise<Example>;
  updateExample(id: number, example: Partial<InsertExample>): Promise<Example | undefined>;
  deleteExample(id: number): Promise<boolean>;
}

// Implementation class
export class PostgresStorage implements IStorage {
  // Implementation methods...
}
```

## File Naming Conventions

- **React Components**: PascalCase with `.tsx` extension
  - Example: `StorageProviderCard.tsx`

- **Utility Functions**: camelCase with `.ts` extension
  - Example: `dateUtils.ts`

- **API Routes**: kebab-case URLs
  - Example: `/api/storage-providers`

- **Database Schema**: camelCase in TypeScript, snake_case in database
  - TypeScript: `storageProviders`
  - Database: `storage_providers`

## Development Workflow

1. **Feature Development Flow**
   - Create/update database schema in `shared/schema.ts`
   - Implement storage methods in `server/storage.ts`
   - Add API routes in `server/routes.ts`
   - Create UI components in `client/src/components/`
   - Implement page components in `client/src/pages/`

2. **Testing Flow**
   - Manual testing via the UI
   - API testing with Postman or similar tools
   - Database validation using direct queries

3. **Deployment Flow**
   - Run build script: `npm run build`
   - Execute deployment script: `./deploy.sh`
   - Verify application functionality after deployment

---

*Last updated: April 15, 2025*