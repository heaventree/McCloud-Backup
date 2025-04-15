# Visual Feedback System Implementation Guide

This document provides a complete blueprint for implementing the point-and-click feedback system (similar to Atarim) in McCloud Backup, allowing users to click on page elements and add targeted feedback comments.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Database Schema](#database-schema)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [Embedding Instructions](#embedding-instructions)
6. [Dependencies](#dependencies)
7. [API Routes](#api-routes)
8. [Integration Guide](#integration-guide)

## System Architecture

The feedback system consists of:

- **Frontend Components**: Interactive overlay for clicking on elements, feedback form, and dashboard
- **Backend Services**: API endpoints for storing and retrieving feedback
- **Database**: Storage for feedback data with relationships to sites and elements
- **Integration Script**: For embedding in third-party sites

## Database Schema

### Feedback Table
```typescript
export interface Feedback {
  id: number;
  projectId: string;
  pagePath: string;
  elementPath?: string;  // CSS selector path to targeted element
  status: string;        // "open", "in-progress", "resolved", "closed"
  priority: string;      // "low", "medium", "high", "critical"
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  comments?: FeedbackComment[];
  coordinates?: {
    x: number;
    y: number;
  };
}

export interface FeedbackComment {
  id: number;
  feedbackId: number;
  author: string;
  content: string;
  createdAt: string;
}
```

### Database Implementation in Drizzle ORM

```typescript
// shared/schema.ts
import { pgTable, serial, text, timestamp, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const feedbacks = pgTable("feedbacks", {
  id: serial("id").primaryKey(),
  projectId: text("project_id").notNull(),
  pagePath: text("page_path").notNull(),
  elementPath: text("element_path"),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("medium"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  assignedTo: text("assigned_to"),
  coordinates: json("coordinates").$type<{x: number, y: number}>(),
});

export const feedbackComments = pgTable("feedback_comments", {
  id: serial("id").primaryKey(),
  feedbackId: integer("feedback_id").references(() => feedbacks.id, { onDelete: "cascade" }).notNull(),
  author: text("author").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Zod validation schemas
export const insertFeedbackSchema = createInsertSchema(feedbacks)
  .omit({ id: true, createdAt: true, updatedAt: true });

export const insertFeedbackCommentSchema = createInsertSchema(feedbackComments)
  .omit({ id: true, createdAt: true });

export type Feedback = typeof feedbacks.$inferSelect;
export type FeedbackComment = typeof feedbackComments.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type InsertFeedbackComment = z.infer<typeof insertFeedbackCommentSchema>;
```

## Backend Implementation

### Storage Interface

```typescript
// server/storage.ts
export interface IStorage {
  // ... other methods

  // Feedback methods
  getFeedbacks(): Promise<Feedback[]>;
  getFeedbackById(id: number): Promise<Feedback | null>;
  getFeedbacksByProject(projectId: string): Promise<Feedback[]>;
  getFeedbacksByPage(projectId: string, pagePath: string): Promise<Feedback[]>;
  createFeedback(feedback: InsertFeedback): Promise<Feedback>;
  updateFeedback(id: number, feedback: Partial<InsertFeedback>): Promise<Feedback | null>;
  deleteFeedback(id: number): Promise<boolean>;

  // Comment methods
  getFeedbackComments(feedbackId: number): Promise<FeedbackComment[]>;
  createFeedbackComment(comment: InsertFeedbackComment): Promise<FeedbackComment>;
  deleteFeedbackComment(id: number): Promise<boolean>;
}
```

### Implementation Example

```typescript
// Implementation for PostgreSQL
class PostgresStorage implements IStorage {
  private db: PostgresJsDatabase<typeof schema>;
  
  constructor(connectionString: string) {
    this.db = drizzle(postgres(connectionString), { schema });
  }

  // Feedback methods
  async getFeedbacks(): Promise<Feedback[]> {
    return this.db.query.feedbacks.findMany({
      with: { comments: true },
      orderBy: [desc(feedbacks.createdAt)]
    });
  }

  async getFeedbackById(id: number): Promise<Feedback | null> {
    return this.db.query.feedbacks.findFirst({
      where: eq(feedbacks.id, id),
      with: { comments: true }
    });
  }

  async getFeedbacksByProject(projectId: string): Promise<Feedback[]> {
    return this.db.query.feedbacks.findMany({
      where: eq(feedbacks.projectId, projectId),
      with: { comments: true },
      orderBy: [desc(feedbacks.createdAt)]
    });
  }

  // Additional implementation details...
}
```

## API Routes

```typescript
// server/routes.ts
export async function registerRoutes(app: Express, storage: IStorage): Promise<void> {
  // Feedback routes
  app.get('/api/feedbacks', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const feedbacks = await storage.getFeedbacks();
      res.json(feedbacks);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch feedbacks' });
    }
  });

  app.get('/api/feedbacks/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const feedback = await storage.getFeedbackById(id);
      
      if (!feedback) {
        return res.status(404).json({ error: 'Feedback not found' });
      }
      
      res.json(feedback);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch feedback' });
    }
  });

  // More API routes...
}
```

## Frontend Implementation

### Feedback Widget Component

The `FeedbackWidget` component provides the core functionality for the point-and-click feedback system:

```tsx
// client/src/components/feedback/FeedbackWidget.tsx
import React, { useState, useEffect, useRef } from 'react';

interface FeedbackWidgetProps {
  projectId: string;
  apiUrl?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  onFeedbackSubmitted?: (feedback: any) => void;
}

export const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({
  projectId,
  apiUrl = '/api/feedbacks',
  position = 'bottom-right',
  onFeedbackSubmitted
}) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isTargeting, setIsTargeting] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null);
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);
  const [elementPath, setElementPath] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<{x: number, y: number} | null>(null);
  const [feedback, setFeedback] = useState({
    title: '',
    description: '',
    priority: 'medium'
  });
  
  // Implementation details...
}
```

### Key Features

1. **Element Targeting Mode**
   - When activated, highlights elements as the user hovers over them
   - Generates CSS path selectors for targeted elements
   - Captures click coordinates for visual reference

2. **Path Generation**
   - Creates unique CSS selectors to identify specific elements
   - Handles complex DOM structures with proper path generation
   - Ensures paths are specific but not overly complex

3. **Feedback Form**
   - Collects title, description, and priority
   - Attaches element path and coordinates to feedback
   - Supports submission to backend API

## Embedding Instructions

### Standalone Script

The feedback system can be embedded in third-party sites using a standalone script:

```typescript
// client/src/embeddable/feedback-script.ts
(function() {
  // Create feedback button
  const button = document.createElement('button');
  button.textContent = 'Feedback';
  button.style.position = 'fixed';
  button.style.bottom = '20px';
  button.style.right = '20px';
  button.style.zIndex = '9999';
  button.style.padding = '10px 20px';
  button.style.backgroundColor = '#3b82f6';
  button.style.color = 'white';
  button.style.border = 'none';
  button.style.borderRadius = '5px';
  button.style.cursor = 'pointer';
  
  // Feedback functionality implementation...
  
  // Add to document
  document.body.appendChild(button);
})();
```

### Integration Steps

1. **Add Script Tag**
   ```html
   <script src="https://your-domain.com/feedback-script.js"></script>
   ```

2. **Configure via Data Attributes**
   ```html
   <script 
     src="https://your-domain.com/feedback-script.js" 
     data-project-id="my-project"
     data-api-url="https://your-api.com/api/external/feedbacks"
   ></script>
   ```

3. **Custom Styling**
   ```html
   <style>
     .mccloud-feedback-button {
       background-color: #0d6efd;
       color: white;
     }
     .mccloud-feedback-overlay {
       background-color: rgba(0, 0, 0, 0.1);
     }
   </style>
   ```

## Dependencies

- **Frontend**:
  - React and React DOM
  - Tailwind CSS with shadcn/ui components
  - Lucide React for icons
  - Zod for validation

- **Backend**:
  - Express for API routes
  - Drizzle ORM for database operations
  - PostgreSQL (or in-memory storage)
  - Zod for validation

## Integration Guide

### Adding to Existing Projects

1. **Copy Component Files**
   - FeedbackWidget.tsx
   - FeedbackDashboard.tsx
   - Any related utility functions

2. **Add Database Schema**
   - Add feedback and comment tables to your schema
   - Run migrations if using a database

3. **Register API Routes**
   - Add feedback routes to your Express application
   - Implement storage methods

4. **Add to UI**
   ```tsx
   import { FeedbackWidget } from '@/components/feedback';
   
   function App() {
     return (
       <div>
         {/* Your app content */}
         <FeedbackWidget projectId="my-project" />
       </div>
     );
   }
   ```

## Security Considerations

1. **Authentication**
   - Public feedback submission can be open or require authentication
   - Admin operations (viewing all feedback, deleting) should be protected

2. **CORS Configuration**
   - If using the embeddable script, configure CORS for external domains
   - Consider allowing only specific domains for production use

3. **Rate Limiting**
   - Implement rate limiting to prevent abuse of the feedback system
   - Consider IP-based limits for public endpoints

---

*Last updated: April 15, 2025*