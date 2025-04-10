import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq, and, desc, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../shared/schema";
import { feedbacks, feedbackComments } from "../shared/schema";
import { Feedback, FeedbackComment, InsertFeedback, InsertFeedbackComment } from "../shared/schema";

export interface IStorage {
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
export class PostgresStorage implements IStorage {
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