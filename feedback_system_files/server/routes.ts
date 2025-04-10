import { Express, Request, Response } from 'express';
import { ZodError } from 'zod';
import { IStorage } from './storage';
import { insertFeedbackSchema, insertFeedbackCommentSchema } from '../shared/schema';

// Middleware for checking authentication
const isAuthenticated = (req: Request, res: Response, next: Function) => {
  if (req.session && req.session.authenticated) {
    return next();
  }
  return res.status(401).json({ error: 'Authentication required' });
};

// Helper for handling Zod validation errors
const handleZodError = (error: ZodError, res: Response) => {
  const formattedErrors = error.errors.map(err => ({
    path: err.path.join('.'),
    message: err.message
  }));
  
  return res.status(400).json({ 
    error: 'Validation error', 
    details: formattedErrors 
  });
};

export function registerFeedbackRoutes(app: Express, storage: IStorage) {
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
      res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        return res.status(204).send();
      }
      
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