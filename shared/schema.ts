import { pgTable, serial, text, timestamp, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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