# Visual Feedback System Implementation Guide

This document provides a complete blueprint for implementing a point-and-click feedback system similar to Atarim, allowing users to click on page elements and add targeted feedback comments.

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

### Storage Implementation

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

// Implementation for PostgreSQL
class PostgresStorage implements IStorage {
  private db: PostgresJsDatabase<typeof schema>;
  
  constructor(connectionString: string) {
    this.db = drizzle(postgres(connectionString), { schema });
  }

  // Feedback methods implementation
  async getFeedbacks(): Promise<Feedback[]> {
    return this.db.query.feedbacks.findMany({
      with: {
        comments: true
      },
      orderBy: [desc(feedbacks.createdAt)]
    });
  }

  async getFeedbackById(id: number): Promise<Feedback | null> {
    return this.db.query.feedbacks.findFirst({
      where: eq(feedbacks.id, id),
      with: {
        comments: true
      }
    });
  }

  async getFeedbacksByProject(projectId: string): Promise<Feedback[]> {
    return this.db.query.feedbacks.findMany({
      where: eq(feedbacks.projectId, projectId),
      with: {
        comments: true
      },
      orderBy: [desc(feedbacks.createdAt)]
    });
  }

  async getFeedbacksByPage(projectId: string, pagePath: string): Promise<Feedback[]> {
    return this.db.query.feedbacks.findMany({
      where: and(
        eq(feedbacks.projectId, projectId),
        eq(feedbacks.pagePath, pagePath)
      ),
      with: {
        comments: true
      },
      orderBy: [desc(feedbacks.createdAt)]
    });
  }

  async createFeedback(feedback: InsertFeedback): Promise<Feedback> {
    const result = await this.db.insert(feedbacks).values(feedback).returning();
    return result[0];
  }

  async updateFeedback(id: number, feedback: Partial<InsertFeedback>): Promise<Feedback | null> {
    const result = await this.db.update(feedbacks)
      .set({ ...feedback, updatedAt: new Date() })
      .where(eq(feedbacks.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : null;
  }

  async deleteFeedback(id: number): Promise<boolean> {
    const result = await this.db.delete(feedbacks).where(eq(feedbacks.id, id)).returning();
    return result.length > 0;
  }

  // Comment methods implementation
  async getFeedbackComments(feedbackId: number): Promise<FeedbackComment[]> {
    return this.db.query.feedbackComments.findMany({
      where: eq(feedbackComments.feedbackId, feedbackId),
      orderBy: [asc(feedbackComments.createdAt)]
    });
  }

  async createFeedbackComment(comment: InsertFeedbackComment): Promise<FeedbackComment> {
    const result = await this.db.insert(feedbackComments).values(comment).returning();
    return result[0];
  }

  async deleteFeedbackComment(id: number): Promise<boolean> {
    const result = await this.db.delete(feedbackComments).where(eq(feedbackComments.id, id)).returning();
    return result.length > 0;
  }
}
```

### API Routes

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

  app.get('/api/projects/:projectId/feedbacks', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const feedbacks = await storage.getFeedbacksByProject(projectId);
      res.json(feedbacks);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch feedbacks for project' });
    }
  });

  app.get('/api/projects/:projectId/pages/:pagePath/feedbacks', async (req: Request, res: Response) => {
    try {
      const { projectId, pagePath } = req.params;
      const decodedPath = decodeURIComponent(pagePath);
      const feedbacks = await storage.getFeedbacksByPage(projectId, decodedPath);
      res.json(feedbacks);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch feedbacks for page' });
    }
  });

  app.post('/api/feedbacks', async (req: Request, res: Response) => {
    try {
      const result = insertFeedbackSchema.safeParse(req.body);
      
      if (!result.success) {
        return handleZodError(result.error, res);
      }
      
      const feedback = await storage.createFeedback(result.data);
      res.status(201).json(feedback);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create feedback' });
    }
  });

  app.put('/api/feedbacks/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const updatedFeedback = await storage.updateFeedback(id, req.body);
      
      if (!updatedFeedback) {
        return res.status(404).json({ error: 'Feedback not found' });
      }
      
      res.json(updatedFeedback);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update feedback' });
    }
  });

  app.delete('/api/feedbacks/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteFeedback(id);
      
      if (!success) {
        return res.status(404).json({ error: 'Feedback not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete feedback' });
    }
  });

  // Comment routes
  app.get('/api/feedbacks/:feedbackId/comments', async (req: Request, res: Response) => {
    try {
      const feedbackId = parseInt(req.params.feedbackId);
      const comments = await storage.getFeedbackComments(feedbackId);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch comments' });
    }
  });

  app.post('/api/feedbacks/:feedbackId/comments', async (req: Request, res: Response) => {
    try {
      const feedbackId = parseInt(req.params.feedbackId);
      const result = insertFeedbackCommentSchema.safeParse({ ...req.body, feedbackId });
      
      if (!result.success) {
        return handleZodError(result.error, res);
      }
      
      const comment = await storage.createFeedbackComment(result.data);
      res.status(201).json(comment);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create comment' });
    }
  });

  app.delete('/api/comments/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteFeedbackComment(id);
      
      if (!success) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete comment' });
    }
  });

  // External embedded API endpoint - for use in the embeddable script
  app.post('/api/external/feedbacks', async (req: Request, res: Response) => {
    try {
      // Allow cross-origin for this specific endpoint
      res.header('Access-Control-Allow-Origin', '*');
      
      const result = insertFeedbackSchema.safeParse(req.body);
      
      if (!result.success) {
        return handleZodError(result.error, res);
      }
      
      const feedback = await storage.createFeedback(result.data);
      res.status(201).json(feedback);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create feedback' });
    }
  });
}
```

## Frontend Implementation

### Feedback Widget Component

```tsx
// client/src/components/feedback/FeedbackWidget.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, X, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  
  const widgetRef = useRef<HTMLDivElement>(null);
  
  // Position styles
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4'
  };
  
  // Handle element targeting mode
  useEffect(() => {
    if (!isTargeting) return;
    
    // Prevent widget from being targeted
    const widgetElement = widgetRef.current;
    
    const handleMouseOver = (e: MouseEvent) => {
      if (widgetElement && widgetElement.contains(e.target as Node)) return;
      
      // Highlight the element under cursor
      const element = e.target as HTMLElement;
      if (element !== hoveredElement) {
        // Remove highlight from previous element
        if (hoveredElement) {
          hoveredElement.style.outline = '';
        }
        
        // Add highlight to current element
        element.style.outline = '2px solid #3b82f6';
        element.style.outlineOffset = '2px';
        setHoveredElement(element);
      }
    };
    
    const handleClick = (e: MouseEvent) => {
      if (widgetElement && widgetElement.contains(e.target as Node)) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const element = e.target as HTMLElement;
      setSelectedElement(element);
      
      // Get element path
      setElementPath(getCssPath(element));
      
      // Get click coordinates
      setCoordinates({
        x: e.pageX,
        y: e.pageY
      });
      
      // Exit targeting mode
      setIsTargeting(false);
      
      // Remove highlights
      document.body.querySelectorAll('*').forEach(el => {
        (el as HTMLElement).style.outline = '';
        (el as HTMLElement).style.outlineOffset = '';
      });
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsTargeting(false);
        // Remove highlights
        document.body.querySelectorAll('*').forEach(el => {
          (el as HTMLElement).style.outline = '';
          (el as HTMLElement).style.outlineOffset = '';
        });
      }
    };
    
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown);
      
      // Remove any lingering highlights
      document.body.querySelectorAll('*').forEach(el => {
        (el as HTMLElement).style.outline = '';
        (el as HTMLElement).style.outlineOffset = '';
      });
    };
  }, [isTargeting, hoveredElement]);
  
  // Get CSS path for an element
  const getCssPath = (element: HTMLElement): string => {
    if (!element) return '';
    if (element === document.body) return 'body';
    
    const path = [];
    let currentElement: HTMLElement | null = element;
    
    while (currentElement && currentElement !== document.body) {
      let selector = currentElement.tagName.toLowerCase();
      
      // Add id if available
      if (currentElement.id) {
        selector += `#${currentElement.id}`;
        path.unshift(selector);
        break;
      }
      
      // Add classes if available
      if (currentElement.className) {
        const classes = currentElement.className.split(/\s+/).filter(c => c);
        if (classes.length) {
          selector += `.${classes.join('.')}`;
        }
      }
      
      // Add position among siblings if needed
      const siblings = Array.from(currentElement.parentElement?.children || []);
      if (siblings.length > 1) {
        const index = siblings.indexOf(currentElement) + 1;
        selector += `:nth-child(${index})`;
      }
      
      path.unshift(selector);
      currentElement = currentElement.parentElement;
    }
    
    return path.join(' > ');
  };
  
  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFeedback(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setFeedback(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feedback.title || !feedback.description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId,
          pagePath: window.location.pathname,
          elementPath,
          coordinates,
          status: 'open',
          priority: feedback.priority,
          title: feedback.title,
          description: feedback.description
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }
      
      const result = await response.json();
      
      toast({
        title: "Success",
        description: "Your feedback has been submitted"
      });
      
      // Reset form
      setFeedback({
        title: '',
        description: '',
        priority: 'medium'
      });
      setSelectedElement(null);
      setElementPath(null);
      setCoordinates(null);
      setIsOpen(false);
      
      // Call onFeedbackSubmitted callback if provided
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted(result);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  // Start targeting mode
  const startTargeting = () => {
    setIsTargeting(true);
    setIsOpen(false);
  };
  
  // Cancel targeting
  const cancelTargeting = () => {
    setIsTargeting(false);
    setSelectedElement(null);
    setElementPath(null);
    setCoordinates(null);
  };
  
  return (
    <div ref={widgetRef} className={`fixed z-50 ${positionClasses[position]}`}>
      {isTargeting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center">
          <div className="bg-white rounded-lg p-4 max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Select an element</h2>
              <Button variant="ghost" size="icon" onClick={cancelTargeting}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Click on any element on the page to provide feedback for it.
              Press ESC to cancel.
            </p>
          </div>
        </div>
      )}
      
      {isOpen && (
        <Card className="p-4 w-80 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Submit Feedback</h3>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <Input
                name="title"
                value={feedback.title}
                onChange={handleInputChange}
                placeholder="Brief description of the issue"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Textarea
                name="description"
                value={feedback.description}
                onChange={handleInputChange}
                placeholder="Detailed explanation of the feedback"
                required
                rows={4}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <Select
                value={feedback.priority}
                onValueChange={(value) => handleSelectChange('priority', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="w-full mb-2"
                onClick={startTargeting}
              >
                <Target className="h-4 w-4 mr-2" />
                Select Element
              </Button>
              
              {selectedElement && (
                <div className="text-xs bg-gray-100 p-2 rounded mb-2 overflow-hidden">
                  <div className="font-medium mb-1">Selected Element:</div>
                  <div className="truncate">{elementPath}</div>
                </div>
              )}
              
              <Button type="submit" className="w-full">
                Submit Feedback
              </Button>
            </div>
          </form>
        </Card>
      )}
      
      {!isOpen && !isTargeting && (
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-full h-12 w-12 shadow-lg"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
};

export default FeedbackWidget;
```

### Feedback Dashboard Component

```tsx
// client/src/pages/feedback.tsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { isDefined, safeArray } from '@/utils/type-utils';
import { Feedback, FeedbackComment } from '@/lib/types';
import { MessageSquare, Activity, Filter, Search, RefreshCw } from 'lucide-react';

export default function FeedbackPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'open', 'in-progress', 'resolved'

  // Fetch feedback data with polling
  const { data: feedbacks, isLoading, isError } = useQuery({
    queryKey: ['/api/feedbacks'],
    refetchInterval: 2000, // Poll every 2 seconds for updates
  });

  // Handle comment submission
  const addCommentMutation = useMutation({
    mutationFn: async ({ feedbackId, content }: { feedbackId: number, content: string }) => {
      const response = await apiRequest('POST', `/api/feedbacks/${feedbackId}/comments`, {
        author: 'You', // Replace with actual user info
        content
      });
      return response.json();
    },
    onSuccess: () => {
      setNewComment('');
      queryClient.invalidateQueries({ queryKey: ['/api/feedbacks'] });
      toast({
        title: "Comment added",
        description: "Your comment has been added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error adding comment",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  });

  // Update feedback status
  const updateFeedbackMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<Feedback> }) => {
      const response = await apiRequest('PUT', `/api/feedbacks/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feedbacks'] });
      toast({
        title: "Feedback updated",
        description: "Feedback has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating feedback",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  });

  // Handle comment submission
  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFeedback || !newComment.trim()) return;
    
    addCommentMutation.mutate({
      feedbackId: selectedFeedback.id,
      content: newComment
    });
  };

  // Status badge color mapping
  const getStatusBadgeColor = (status: string) => {
    switch(status) {
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Priority badge color mapping
  const getPriorityBadgeColor = (priority: string) => {
    switch(priority) {
      case 'low': return 'bg-gray-100 text-gray-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Open feedback details dialog
  const openFeedbackDetails = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setIsDetailsOpen(true);
  };

  // Update feedback status
  const updateFeedbackStatus = (status: string) => {
    if (!selectedFeedback) return;
    
    updateFeedbackMutation.mutate({
      id: selectedFeedback.id,
      data: { status }
    });
    
    // Update local state for immediate UI update
    setSelectedFeedback({
      ...selectedFeedback,
      status
    });
  };

  // Filter feedbacks based on active tab, status, priority, and search term
  const filteredFeedbacks = React.useMemo(() => {
    if (!feedbacks || !Array.isArray(feedbacks)) return [];
    
    return feedbacks.filter((feedback: Feedback) => {
      // Filter by tab (status)
      if (activeTab !== 'all' && feedback.status !== activeTab) return false;
      
      // Filter by status dropdown
      if (statusFilter && feedback.status !== statusFilter) return false;
      
      // Filter by priority dropdown
      if (priorityFilter && feedback.priority !== priorityFilter) return false;
      
      // Filter by search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          feedback.title.toLowerCase().includes(term) ||
          feedback.description.toLowerCase().includes(term) ||
          feedback.pagePath.toLowerCase().includes(term)
        );
      }
      
      return true;
    });
  }, [feedbacks, activeTab, statusFilter, priorityFilter, searchTerm]);

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Feedback Dashboard</h1>
          <p className="text-gray-500">Manage and respond to user feedback</p>
        </div>
        <Button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/feedbacks'] })}
          variant="outline"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid grid-cols-4 w-full max-w-md">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="in-progress">In Progress</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>
      </Tabs>
      
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search feedbacks..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2">
          <Select value={statusFilter || ''} onValueChange={(value) => setStatusFilter(value || null)}>
            <SelectTrigger className="w-[150px]">
              <div className="flex items-center">
                <Filter className="h-4 w-4 mr-2 text-gray-500" />
                <span>{statusFilter || 'Status'}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={priorityFilter || ''} onValueChange={(value) => setPriorityFilter(value || null)}>
            <SelectTrigger className="w-[150px]">
              <div className="flex items-center">
                <Activity className="h-4 w-4 mr-2 text-gray-500" />
                <span>{priorityFilter || 'Priority'}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-4 text-gray-500">Loading feedbacks...</p>
        </div>
      ) : isError ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-center text-red-500">
            <p>Failed to load feedback data. Please try again.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/feedbacks'] })}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : filteredFeedbacks.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-gray-500">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-300 mb-2" />
            <p>No feedback found matching your criteria.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="hidden md:table-cell">Page</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="hidden md:table-cell">Comments</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFeedbacks.map((feedback: Feedback) => (
                <TableRow key={feedback.id}>
                  <TableCell className="font-medium">{feedback.title}</TableCell>
                  <TableCell className="hidden md:table-cell max-w-[200px] truncate">
                    {feedback.pagePath}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusBadgeColor(feedback.status)}>
                      {feedback.status.charAt(0).toUpperCase() + feedback.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getPriorityBadgeColor(feedback.priority)}>
                      {feedback.priority.charAt(0).toUpperCase() + feedback.priority.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {format(new Date(feedback.createdAt), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {safeArray(feedback.comments).length}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => openFeedbackDetails(feedback)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      
      {/* Feedback Details Dialog */}
      {selectedFeedback && (
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">{selectedFeedback.title}</DialogTitle>
              <DialogDescription>
                {selectedFeedback.pagePath}
                {selectedFeedback.elementPath && (
                  <span className="block text-xs bg-gray-100 p-1 rounded mt-1">
                    Element: {selectedFeedback.elementPath}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex flex-col md:flex-row gap-6 mt-4">
              <div className="flex-1">
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-2">Description</h3>
                  <div className="p-3 bg-gray-50 rounded-md">
                    <p className="text-sm whitespace-pre-wrap">{selectedFeedback.description}</p>
                  </div>
                </div>
                
                {selectedFeedback.coordinates && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium mb-2">Coordinates</h3>
                    <div className="p-3 bg-gray-50 rounded-md">
                      <p className="text-sm">X: {selectedFeedback.coordinates.x}, Y: {selectedFeedback.coordinates.y}</p>
                    </div>
                  </div>
                )}
                
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-2">Comments</h3>
                  {safeArray(selectedFeedback.comments).length > 0 ? (
                    <div className="space-y-3">
                      {safeArray(selectedFeedback.comments).map((comment: FeedbackComment) => (
                        <div key={comment.id} className="p-3 bg-gray-50 rounded-md">
                          <div className="flex items-center mb-2">
                            <Avatar className="h-6 w-6 mr-2">
                              <AvatarFallback>{comment.author.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">{comment.author}</span>
                            <span className="text-xs text-gray-500 ml-auto">
                              {format(new Date(comment.createdAt), 'MMM dd, yyyy HH:mm')}
                            </span>
                          </div>
                          <p className="text-sm">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 text-center py-3">
                      No comments yet
                    </div>
                  )}
                </div>
                
                <form onSubmit={handleCommentSubmit}>
                  <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="mb-2"
                  />
                  <Button 
                    type="submit" 
                    disabled={!newComment.trim() || addCommentMutation.isPending}
                  >
                    {addCommentMutation.isPending ? 'Adding...' : 'Add Comment'}
                  </Button>
                </form>
              </div>
              
              <div className="w-full md:w-64">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Status</h3>
                    <Select 
                      value={selectedFeedback.status} 
                      onValueChange={updateFeedbackStatus}
                      disabled={updateFeedbackMutation.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium mb-2">Priority</h3>
                    <Select 
                      value={selectedFeedback.priority}
                      onValueChange={(value) => {
                        updateFeedbackMutation.mutate({
                          id: selectedFeedback.id,
                          data: { priority: value }
                        });
                        setSelectedFeedback({
                          ...selectedFeedback,
                          priority: value
                        });
                      }}
                      disabled={updateFeedbackMutation.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium mb-2">Dates</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Created:</span>
                        <span>{format(new Date(selectedFeedback.createdAt), 'MMM dd, yyyy')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Updated:</span>
                        <span>{format(new Date(selectedFeedback.updatedAt), 'MMM dd, yyyy')}</span>
                      </div>
                    </div>
                  </div>
                  
                  {isDefined(selectedFeedback.assignedTo) && (
                    <div>
                      <h3 className="text-sm font-medium mb-2">Assigned To</h3>
                      <div className="flex items-center">
                        <Avatar className="h-8 w-8 mr-2">
                          <AvatarFallback>{selectedFeedback.assignedTo.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span>{selectedFeedback.assignedTo}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
```

## Embedding Instructions

### Embeddable Script

Create a standalone script that can be embedded on any site:

```typescript
// client/src/embeddable/feedback-script.ts
(() => {
  class FeedbackWidget {
    private apiUrl: string;
    private projectId: string;
    private widget: HTMLElement | null = null;
    private isOpen = false;
    private isTargeting = false;
    private selectedElement: HTMLElement | null = null;
    private hoveredElement: HTMLElement | null = null;
    private elementPath: string | null = null;
    private coordinates: {x: number, y: number} | null = null;
    
    constructor(config: {
      apiUrl: string;
      projectId: string;
      position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    }) {
      this.apiUrl = config.apiUrl;
      this.projectId = config.projectId;
      
      // Create and inject styles
      this.injectStyles();
      
      // Create widget
      this.createWidget(config.position || 'bottom-right');
      
      // Initialize event listeners
      this.initEventListeners();
    }
    
    private injectStyles() {
      const styleElement = document.createElement('style');
      styleElement.textContent = `
        .fb-widget-container {
          position: fixed;
          z-index: 9999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          font-size: 14px;
        }
        .fb-widget-container.bottom-right { bottom: 20px; right: 20px; }
        .fb-widget-container.bottom-left { bottom: 20px; left: 20px; }
        .fb-widget-container.top-right { top: 20px; right: 20px; }
        .fb-widget-container.top-left { top: 20px; left: 20px; }
        
        .fb-trigger-button {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background-color: #3b82f6;
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          transition: transform 0.2s;
        }
        .fb-trigger-button:hover {
          transform: scale(1.05);
        }
        
        .fb-card {
          position: absolute;
          bottom: 60px;
          right: 0;
          width: 320px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          overflow: hidden;
          display: none;
        }
        
        .fb-card-header {
          padding: 16px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .fb-card-title {
          font-weight: 600;
          font-size: 16px;
          margin: 0;
        }
        
        .fb-close-button {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
        }
        
        .fb-card-body {
          padding: 16px;
        }
        
        .fb-form-group {
          margin-bottom: 16px;
        }
        
        .fb-label {
          display: block;
          font-weight: 500;
          margin-bottom: 6px;
          font-size: 14px;
        }
        
        .fb-input, .fb-textarea, .fb-select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 14px;
        }
        
        .fb-textarea {
          min-height: 100px;
          resize: vertical;
        }
        
        .fb-button {
          background-color: #3b82f6;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          width: 100%;
        }
        
        .fb-button-outline {
          background-color: white;
          color: #3b82f6;
          border: 1px solid #3b82f6;
        }
        
        .fb-error {
          color: #ef4444;
          font-size: 12px;
          margin-top: 4px;
        }
        
        .fb-selected-element {
          background-color: #f3f4f6;
          padding: 8px;
          border-radius: 4px;
          font-size: 12px;
          margin-bottom: 12px;
          word-break: break-all;
        }
        
        .fb-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          z-index: 9998;
          display: none;
        }
        
        .fb-targeting-info {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background-color: white;
          padding: 20px;
          border-radius: 8px;
          max-width: 400px;
          text-align: center;
          z-index: 10000;
        }
      `;
      document.head.appendChild(styleElement);
    }
    
    private createWidget(position: string) {
      // Create container
      const container = document.createElement('div');
      container.className = `fb-widget-container ${position}`;
      
      // Create trigger button
      const triggerButton = document.createElement('button');
      triggerButton.className = 'fb-trigger-button';
      triggerButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      `;
      triggerButton.addEventListener('click', () => this.toggleWidget());
      container.appendChild(triggerButton);
      
      // Create feedback card
      const card = document.createElement('div');
      card.className = 'fb-card';
      
      // Card header
      const header = document.createElement('div');
      header.className = 'fb-card-header';
      
      const title = document.createElement('h3');
      title.className = 'fb-card-title';
      title.textContent = 'Submit Feedback';
      
      const closeButton = document.createElement('button');
      closeButton.className = 'fb-close-button';
      closeButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
      closeButton.addEventListener('click', () => this.toggleWidget(false));
      
      header.appendChild(title);
      header.appendChild(closeButton);
      card.appendChild(header);
      
      // Card body with form
      const body = document.createElement('div');
      body.className = 'fb-card-body';
      
      body.innerHTML = `
        <form id="fb-feedback-form">
          <div class="fb-form-group">
            <label class="fb-label" for="fb-title">Title</label>
            <input class="fb-input" type="text" id="fb-title" name="title" placeholder="Brief description of the issue" required>
          </div>
          
          <div class="fb-form-group">
            <label class="fb-label" for="fb-description">Description</label>
            <textarea class="fb-textarea" id="fb-description" name="description" placeholder="Detailed explanation of the feedback" required></textarea>
          </div>
          
          <div class="fb-form-group">
            <label class="fb-label" for="fb-priority">Priority</label>
            <select class="fb-select" id="fb-priority" name="priority">
              <option value="low">Low</option>
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          
          <div class="fb-form-group">
            <button type="button" id="fb-select-element" class="fb-button fb-button-outline">
              <span style="display: flex; align-items: center; justify-content: center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
                  <circle cx="12" cy="12" r="10"></circle>
                  <circle cx="12" cy="12" r="1"></circle>
                  <path d="M12 12 4 20 M12 12l8 8"></path>
                </svg>
                Select Element
              </span>
            </button>
          </div>
          
          <div id="fb-selected-element-container" style="display: none;" class="fb-form-group">
            <div class="fb-selected-element">
              <strong>Selected Element:</strong>
              <div id="fb-element-path"></div>
            </div>
          </div>
          
          <div class="fb-form-group">
            <button type="submit" id="fb-submit" class="fb-button">Submit Feedback</button>
          </div>
        </form>
      `;
      
      card.appendChild(body);
      container.appendChild(card);
      
      // Create overlay for targeting mode
      const overlay = document.createElement('div');
      overlay.className = 'fb-overlay';
      overlay.id = 'fb-targeting-overlay';
      
      const targetingInfo = document.createElement('div');
      targetingInfo.className = 'fb-targeting-info';
      targetingInfo.innerHTML = `
        <h4 style="margin-top: 0; margin-bottom: 12px;">Select an element</h4>
        <p style="margin-bottom: 16px;">Click on any element on the page to provide feedback for it. Press ESC to cancel.</p>
        <button id="fb-cancel-targeting" class="fb-button">Cancel</button>
      `;
      
      overlay.appendChild(targetingInfo);
      document.body.appendChild(overlay);
      
      // Append widget to body
      document.body.appendChild(container);
      this.widget = container;
    }
    
    private initEventListeners() {
      // Get elements
      const form = document.getElementById('fb-feedback-form');
      const selectElementButton = document.getElementById('fb-select-element');
      const cancelTargetingButton = document.getElementById('fb-cancel-targeting');
      
      // Form submission
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.submitFeedback();
        });
      }
      
      // Select element button
      if (selectElementButton) {
        selectElementButton.addEventListener('click', () => {
          this.startTargeting();
        });
      }
      
      // Cancel targeting button
      if (cancelTargetingButton) {
        cancelTargetingButton.addEventListener('click', () => {
          this.cancelTargeting();
        });
      }
      
      // Listen for ESC key to cancel targeting
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isTargeting) {
          this.cancelTargeting();
        }
      });
    }
    
    private toggleWidget(force?: boolean) {
      const card = this.widget?.querySelector('.fb-card');
      this.isOpen = force !== undefined ? force : !this.isOpen;
      
      if (card) {
        card.style.display = this.isOpen ? 'block' : 'none';
      }
    }
    
    private startTargeting() {
      this.isTargeting = true;
      this.toggleWidget(false);
      
      const overlay = document.getElementById('fb-targeting-overlay');
      if (overlay) {
        overlay.style.display = 'block';
      }
      
      document.body.style.cursor = 'crosshair';
      
      // Add mouseover event to highlight elements
      document.addEventListener('mouseover', this.handleMouseOver);
      
      // Add click event to select elements
      document.addEventListener('click', this.handleClick, true);
    }
    
    private cancelTargeting() {
      this.isTargeting = false;
      
      const overlay = document.getElementById('fb-targeting-overlay');
      if (overlay) {
        overlay.style.display = 'none';
      }
      
      document.body.style.cursor = '';
      
      // Remove event listeners
      document.removeEventListener('mouseover', this.handleMouseOver);
      document.removeEventListener('click', this.handleClick, true);
      
      // Remove any lingering highlights
      if (this.hoveredElement) {
        this.hoveredElement.style.outline = '';
        this.hoveredElement.style.outlineOffset = '';
        this.hoveredElement = null;
      }
    }
    
    private handleMouseOver = (e: MouseEvent) => {
      if (!this.isTargeting) return;
      
      const element = e.target as HTMLElement;
      
      // Prevent targeting the overlay or the widget itself
      if (element.closest('#fb-targeting-overlay') || element.closest('.fb-widget-container')) {
        return;
      }
      
      // Remove highlight from previous element
      if (this.hoveredElement && this.hoveredElement !== element) {
        this.hoveredElement.style.outline = '';
        this.hoveredElement.style.outlineOffset = '';
      }
      
      // Add highlight to current element
      element.style.outline = '2px solid #3b82f6';
      element.style.outlineOffset = '2px';
      this.hoveredElement = element;
    };
    
    private handleClick = (e: MouseEvent) => {
      if (!this.isTargeting) return;
      
      // Prevent targeting the overlay or the widget itself
      const element = e.target as HTMLElement;
      if (element.closest('#fb-targeting-overlay') || element.closest('.fb-widget-container')) {
        return;
      }
      
      e.preventDefault();
      e.stopPropagation();
      
      this.selectedElement = element;
      this.elementPath = this.getCssPath(element);
      this.coordinates = {
        x: e.pageX,
        y: e.pageY
      };
      
      // Update UI
      const pathElement = document.getElementById('fb-element-path');
      const elementContainer = document.getElementById('fb-selected-element-container');
      
      if (pathElement) {
        pathElement.textContent = this.elementPath;
      }
      
      if (elementContainer) {
        elementContainer.style.display = 'block';
      }
      
      // Exit targeting mode
      this.cancelTargeting();
      
      // Reopen the widget
      this.toggleWidget(true);
    };
    
    private getCssPath(element: HTMLElement): string {
      if (!element) return '';
      if (element === document.body) return 'body';
      
      const path = [];
      let currentElement: HTMLElement | null = element;
      
      while (currentElement && currentElement !== document.body) {
        let selector = currentElement.tagName.toLowerCase();
        
        // Add id if available
        if (currentElement.id) {
          selector += `#${currentElement.id}`;
          path.unshift(selector);
          break;
        }
        
        // Add classes if available
        if (currentElement.className) {
          const classes = currentElement.className.split(/\s+/).filter(c => c);
          if (classes.length) {
            selector += `.${classes.join('.')}`;
          }
        }
        
        // Add position among siblings if needed
        const siblings = Array.from(currentElement.parentElement?.children || []);
        if (siblings.length > 1) {
          const index = siblings.indexOf(currentElement) + 1;
          selector += `:nth-child(${index})`;
        }
        
        path.unshift(selector);
        currentElement = currentElement.parentElement;
      }
      
      return path.join(' > ');
    }
    
    private submitFeedback() {
      // Get form values
      const titleInput = document.getElementById('fb-title') as HTMLInputElement;
      const descriptionInput = document.getElementById('fb-description') as HTMLTextAreaElement;
      const priorityInput = document.getElementById('fb-priority') as HTMLSelectElement;
      
      const title = titleInput?.value;
      const description = descriptionInput?.value;
      const priority = priorityInput?.value;
      
      // Validate
      if (!title || !description) {
        alert('Please fill in all required fields');
        return;
      }
      
      // Prepare payload
      const payload = {
        projectId: this.projectId,
        pagePath: window.location.pathname,
        elementPath: this.elementPath,
        coordinates: this.coordinates,
        status: 'open',
        priority: priority || 'medium',
        title,
        description
      };
      
      // Submit data
      fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to submit feedback');
          }
          return response.json();
        })
        .then(() => {
          // Success
          alert('Feedback submitted successfully!');
          
          // Reset form
          titleInput.value = '';
          descriptionInput.value = '';
          
          // Clear selected element
          this.selectedElement = null;
          this.elementPath = null;
          this.coordinates = null;
          
          const elementContainer = document.getElementById('fb-selected-element-container');
          if (elementContainer) {
            elementContainer.style.display = 'none';
          }
          
          // Close widget
          this.toggleWidget(false);
        })
        .catch(error => {
          console.error('Error submitting feedback:', error);
          alert('Failed to submit feedback. Please try again.');
        });
    }
  }
  
  // Expose to global scope
  (window as any).FeedbackWidget = FeedbackWidget;
})();
```

## Dependencies

List of dependencies needed for the feedback system:

```json
{
  "dependencies": {
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-avatar": "^1.0.4",
    "@radix-ui/react-select": "^1.2.2",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-badge": "^1.0.4",
    "@tanstack/react-query": "^5.0.0",
    "date-fns": "^2.30.0",
    "lucide-react": "^0.291.0",
    "zod": "^3.22.4",
    "drizzle-orm": "^0.28.6",
    "drizzle-zod": "^0.5.1"
  }
}
```

## API Routes

### Backend Endpoints

| Endpoint | Method | Description | Authentication |
|----------|--------|-------------|---------------|
| `/api/feedbacks` | GET | Get all feedbacks | Required |
| `/api/feedbacks/:id` | GET | Get feedback by ID | Required |
| `/api/projects/:projectId/feedbacks` | GET | Get feedbacks by project | Required |
| `/api/projects/:projectId/pages/:pagePath/feedbacks` | GET | Get feedbacks by project and page | Required |
| `/api/feedbacks` | POST | Create new feedback | Optional |
| `/api/feedbacks/:id` | PUT | Update feedback | Required |
| `/api/feedbacks/:id` | DELETE | Delete feedback | Required |
| `/api/feedbacks/:feedbackId/comments` | GET | Get comments for a feedback | Required |
| `/api/feedbacks/:feedbackId/comments` | POST | Add comment to feedback | Required |
| `/api/comments/:id` | DELETE | Delete a comment | Required |
| `/api/external/feedbacks` | POST | Create feedback from external sites | Not required (CORS enabled) |

## Integration Guide

### Integration with Your App

1. **Setup Database tables**: Run the database migrations to create the `feedbacks` and `feedback_comments` tables

2. **Add Backend Routes**: Implement the API routes in your Express server

3. **Add Frontend Components**: Add the `FeedbackWidget` and `FeedbackPage` components to your React application

4. **Add Navigation**: Add a link to the feedback dashboard in your sidebar or navigation menu

### Embedding in Third-Party Sites

1. Build the embeddable script:
```bash
npx tsc client/src/embeddable/feedback-script.ts --outDir dist
```

2. Host the script on your server:
```html
<script src="https://your-server.com/scripts/feedback-widget.js"></script>
```

3. Initialize the widget:
```html
<script>
  document.addEventListener('DOMContentLoaded', function() {
    new FeedbackWidget({
      apiUrl: 'https://your-server.com/api/external/feedbacks',
      projectId: 'my-project-id',
      position: 'bottom-right'
    });
  });
</script>
```

4. All feedback submitted through the widget will appear in your feedback dashboard