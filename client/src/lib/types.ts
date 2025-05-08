// Define types for feedback system

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