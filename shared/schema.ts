import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  decimal,
  pgEnum
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Processing status enum
export const processingStatusEnum = pgEnum('processing_status', [
  'pending', 'processing', 'completed', 'failed'
]);

// Rigor level enum
export const rigorLevelEnum = pgEnum('rigor_level', [
  'mild', 'medium', 'spicy'
]);

// AI engine enum
export const aiEngineEnum = pgEnum('ai_engine', [
  'chatgpt', 'grok', 'claude'
]);

// Documents table
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  customerId: integer("customer_id").notNull(),
  fileName: text("file_name").notNull(),
  originalPath: text("original_path").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  extractedText: text("extracted_text"),
  jurisdictions: text("jurisdictions").array().notNull(),
  status: processingStatusEnum("status").notNull().default('pending'),
  processingStarted: timestamp("processing_started"),
  processingCompleted: timestamp("processing_completed"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Questions extracted from documents
export const questions = pgTable("questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id),
  questionNumber: text("question_number").notNull(),
  questionText: text("question_text").notNull(),
  context: text("context"),
  createdAt: timestamp("created_at").defaultNow(),
});

// AI responses for each question
export const aiResponses = pgTable("ai_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questionId: varchar("question_id").notNull().references(() => questions.id),
  aiEngine: aiEngineEnum("ai_engine").notNull(),
  standardsIdentified: jsonb("standards_identified").notNull(), // Array of standard objects
  rigorLevel: rigorLevelEnum("rigor_level"),
  rigorJustification: text("rigor_justification"),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  rawResponse: jsonb("raw_response").notNull(),
  processingTime: integer("processing_time"), // milliseconds
  createdAt: timestamp("created_at").defaultNow(),
});

// Final consensus results for each question
export const questionResults = pgTable("question_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questionId: varchar("question_id").notNull().references(() => questions.id),
  consensusStandards: jsonb("consensus_standards").notNull(), // Voted standards
  consensusRigorLevel: rigorLevelEnum("consensus_rigor_level"),
  standardsVotes: jsonb("standards_votes").notNull(), // Voting breakdown
  rigorVotes: jsonb("rigor_votes").notNull(), // Rigor voting breakdown
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Teacher overrides for crowd-sourced corrections
export const teacherOverrides = pgTable("teacher_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questionId: varchar("question_id").notNull().references(() => questions.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  overriddenStandards: jsonb("overridden_standards").notNull(), // Teacher's corrected standards
  overriddenRigorLevel: rigorLevelEnum("overridden_rigor_level"),
  teacherJustification: text("teacher_justification"), // Teacher's reasoning
  confidenceLevel: integer("confidence_level").notNull().default(5), // 1-5 scale
  hasDomainChange: boolean("has_domain_change").notNull().default(false), // Flag for cross-domain changes
  domainChangeDetails: jsonb("domain_change_details"), // Store domain change information
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// API keys for users
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  keyName: text("key_name").notNull(),
  keyHash: text("key_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastUsed: timestamp("last_used"),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Processing queue
export const processingQueue = pgTable("processing_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id),
  priority: integer("priority").notNull().default(0),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  scheduledFor: timestamp("scheduled_for").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export const insertDocumentSchema = createInsertSchema(documents).pick({
  customerId: true,
  fileName: true,
  originalPath: true,
  mimeType: true,
  fileSize: true,
  jurisdictions: true,
});

export const insertQuestionSchema = createInsertSchema(questions).pick({
  documentId: true,
  questionNumber: true,
  questionText: true,
  context: true,
});

export const insertAiResponseSchema = createInsertSchema(aiResponses).pick({
  questionId: true,
  aiEngine: true,
  standardsIdentified: true,
  rigorLevel: true,
  rigorJustification: true,
  confidence: true,
  rawResponse: true,
  processingTime: true,
});

export const insertApiKeySchema = createInsertSchema(apiKeys).pick({
  keyName: true,
  keyHash: true,
});

export const insertTeacherOverrideSchema = createInsertSchema(teacherOverrides).pick({
  questionId: true,
  overriddenStandards: true,
  overriddenRigorLevel: true,
  teacherJustification: true,
  confidenceLevel: true,
});

// Types
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type AiResponse = typeof aiResponses.$inferSelect;
export type QuestionResult = typeof questionResults.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type ProcessingQueue = typeof processingQueue.$inferSelect;
export type TeacherOverride = typeof teacherOverrides.$inferSelect;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type InsertAiResponse = z.infer<typeof insertAiResponseSchema>;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type InsertTeacherOverride = z.infer<typeof insertTeacherOverrideSchema>;
