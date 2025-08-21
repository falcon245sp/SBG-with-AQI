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
  real,
  pgEnum
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { ProcessingStatus, TeacherReviewStatus, AssetType, ExportType, AiEngine, RigorLevel, GradeSubmissionStatus, BusinessDefaults } from "./businessEnums";

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

// User storage table - supports both OAuth and username/password auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerUuid: varchar("customer_uuid").unique().notNull().default(sql`gen_random_uuid()`), // Permanent business identifier
  email: varchar("email").unique(),
  passwordHash: varchar("password_hash"), // For username/password auth
  googleId: varchar("google_id").unique(), // Google user ID
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  googleAccessToken: text("google_access_token"), // For Classroom API calls
  googleRefreshToken: text("google_refresh_token"), // For token refresh
  googleTokenExpiry: timestamp("google_token_expiry"), // Token expiration
  googleCredentials: text("google_credentials"), // JSON string of service account credentials
  classroomConnected: boolean("classroom_connected").default(false), // Classroom authorization status
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Google Classroom classes
export const classrooms = pgTable("classrooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  googleClassId: varchar("google_class_id").notNull(), // Google Classroom ID
  customerUuid: varchar("customer_uuid").notNull().references(() => users.customerUuid),
  name: text("name").notNull(),
  section: text("section"),
  description: text("description"),
  room: text("room"),
  courseState: varchar("course_state"), // ACTIVE, ARCHIVED, etc.
  creationTime: timestamp("creation_time"),
  updateTime: timestamp("update_time"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Students in classrooms
export const students = pgTable("students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  googleUserId: varchar("google_user_id"), // Google user ID if available
  classroomId: varchar("classroom_id").notNull().references(() => classrooms.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: varchar("email"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Processing status enum - using business enum values
export const processingStatusEnum = pgEnum('processing_status', [
  ProcessingStatus.PENDING, ProcessingStatus.PROCESSING, ProcessingStatus.COMPLETED, ProcessingStatus.FAILED
]);

// Rigor level enum - using business enum values
export const rigorLevelEnum = pgEnum('rigor_level', [
  RigorLevel.MILD, RigorLevel.MEDIUM, RigorLevel.SPICY
]);

// AI engine enum - using business enum values
export const aiEngineEnum = pgEnum('ai_engine', [
  AiEngine.CHATGPT, AiEngine.GROK, AiEngine.CLAUDE
]);

// Asset type enum for File Cabinet - using business enum values
export const assetTypeEnum = pgEnum('asset_type', [
  AssetType.UPLOADED, AssetType.GENERATED
]);

// Export type enum for generated documents - using business enum values
export const exportTypeEnum = pgEnum('export_type', [
  ExportType.RUBRIC_PDF, ExportType.COVER_SHEET, ExportType.PROCESSING_REPORT, 
  ExportType.STANDARDS_SUMMARY, ExportType.QUESTION_ANALYSIS, ExportType.TEACHER_GUIDE, 
  ExportType.COLLATED_GRADED_SUBMISSIONS
]);

// Grade submission status enum - using business enum values
export const gradeSubmissionStatusEnum = pgEnum('grade_submission_status', [
  GradeSubmissionStatus.PENDING, GradeSubmissionStatus.PROCESSED, 
  GradeSubmissionStatus.DUPLICATE_REJECTED, GradeSubmissionStatus.INVALID_QR
]);

// Teacher review status enum - using business enum values
export const teacherReviewStatusEnum = pgEnum('teacher_review_status', [
  TeacherReviewStatus.NOT_REVIEWED, TeacherReviewStatus.REVIEWED_AND_ACCEPTED, 
  TeacherReviewStatus.REVIEWED_AND_OVERRIDDEN
]);

// Documents table - enhanced for File Cabinet functionality
export const documents: any = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerUuid: varchar("customer_uuid").notNull().references(() => users.customerUuid),
  fileName: text("file_name").notNull(),
  originalPath: text("original_path").notNull(), // File path in uploads/ or exports/ directory
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  extractedText: text("extracted_text"),
  jurisdictions: text("jurisdictions").array(),
  status: processingStatusEnum("status").notNull().default(ProcessingStatus.PENDING),
  teacherReviewStatus: teacherReviewStatusEnum("teacher_review_status").notNull().default(TeacherReviewStatus.NOT_REVIEWED),
  
  // File Cabinet enhancement fields
  assetType: assetTypeEnum("asset_type").notNull().default(AssetType.UPLOADED), // uploaded vs generated
  parentDocumentId: varchar("parent_document_id"), // Links generated assets to originals
  exportType: exportTypeEnum("export_type"), // Type of generated document (null for uploads)
  tags: text("tags").array().default(sql`'{}'`), // User-defined tags for organization
  originalFilename: text("original_filename"), // User's original filename (for display)
  retentionDate: timestamp("retention_date"), // Calculated based on subscription status
  
  // Processing fields
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
  questionType: varchar("question_type"),
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
  aiAgreementLevel: varchar("ai_agreement_level"), // Field found in database
  processingNotes: text("processing_notes"), // Field found in database
  createdAt: timestamp("created_at").defaultNow(),
});

// Teacher overrides for crowd-sourced corrections (with edit history)
export const teacherOverrides = pgTable("teacher_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questionId: varchar("question_id").notNull().references(() => questions.id),
  customerUuid: varchar("customer_uuid").notNull().references(() => users.customerUuid),
  overriddenStandards: jsonb("overridden_standards").notNull(), // Teacher's corrected standards
  overriddenRigorLevel: rigorLevelEnum("overridden_rigor_level"),
  confidenceScore: real("confidence_score"), // Confidence level as real number
  notes: text("notes"), // Teacher's notes
  editReason: varchar("edit_reason"), // Reason for the edit
  isActive: boolean("is_active").notNull().default(BusinessDefaults.DEFAULT_IS_ACTIVE), // Flag to track current active override
  isRevertedToAi: boolean("is_reverted_to_ai").notNull().default(false), // Flag for AI reversion
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// API keys for users
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerUuid: varchar("customer_uuid").notNull().references(() => users.customerUuid),
  keyName: text("key_name").notNull(),
  keyHash: text("key_hash").notNull(),
  isActive: boolean("is_active").notNull().default(BusinessDefaults.DEFAULT_IS_ACTIVE),
  lastUsed: timestamp("last_used"),
  usageCount: integer("usage_count").notNull().default(BusinessDefaults.DEFAULT_USAGE_COUNT),
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

// Export generation queue for File Cabinet
export const exportQueue = pgTable("export_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id), // Source document
  exportType: exportTypeEnum("export_type").notNull(), // Type to generate
  priority: integer("priority").notNull().default(0),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  status: processingStatusEnum("status").notNull().default(sql`'pending'`),
  errorMessage: text("error_message"),
  scheduledFor: timestamp("scheduled_for").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Dead Letter Queue for permanently failed exports - Admin visibility only
export const deadLetterQueue = pgTable("dead_letter_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  originalExportId: varchar("original_export_id").notNull(),
  documentId: varchar("document_id").notNull().references(() => documents.id),
  customerUuid: varchar("customer_uuid").notNull().references(() => users.customerUuid),
  sessionUserId: varchar("session_user_id"),
  exportType: exportTypeEnum("export_type").notNull(),
  priority: integer("priority").notNull(),
  finalAttempts: integer("final_attempts").notNull(),
  maxAttempts: integer("max_attempts").notNull(),
  finalErrorMessage: text("final_error_message"),
  finalErrorStack: text("final_error_stack"),
  originalScheduledFor: timestamp("original_scheduled_for"),
  firstAttemptAt: timestamp("first_attempt_at"),
  finalFailureAt: timestamp("final_failure_at").notNull().defaultNow(),
  // Debugging context
  documentFileName: varchar("document_file_name"),
  documentFileSize: integer("document_file_size"),
  documentMimeType: varchar("document_mime_type"),
  documentStatus: varchar("document_status"),
  // System state at failure
  serverVersion: varchar("server_version"),
  nodeEnv: varchar("node_env"),
  requestId: varchar("request_id"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// QR Code Sequence Numbers - One-time use anti-fraud system
export const qrSequenceNumbers = pgTable("qr_sequence_numbers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id, { onDelete: 'cascade' }),
  studentId: varchar("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  sequenceNumber: varchar("sequence_number").notNull().unique(), // One-time use UUID
  isUsed: boolean("is_used").notNull().default(false),
  qrCodeGenerated: timestamp("qr_code_generated").defaultNow(),
  usedAt: timestamp("used_at"),
  usedByTeacher: varchar("used_by_teacher"), // Track who scanned it
  createdAt: timestamp("created_at").defaultNow(),
});

// Grade Submissions - Results from QR code scans
export const gradeSubmissions = pgTable("grade_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sequenceNumberId: varchar("sequence_number_id").notNull().references(() => qrSequenceNumbers.id),
  rubricDocumentId: varchar("rubric_document_id").notNull().references(() => documents.id), // The generated rubric being graded
  originalDocumentId: varchar("original_document_id").notNull().references(() => documents.id), // Original uploaded assessment
  studentId: varchar("student_id").notNull().references(() => students.id),
  questionGrades: jsonb("question_grades").notNull(), // Array of {questionId, score, maxScore}
  totalScore: decimal("total_score", { precision: 5, scale: 2 }),
  maxPossibleScore: decimal("max_possible_score", { precision: 5, scale: 2 }),
  percentageScore: decimal("percentage_score", { precision: 5, scale: 2 }),
  status: gradeSubmissionStatusEnum("status").notNull().default(sql`'pending'`),
  scannerNotes: text("scanner_notes"), // Optional notes from scanning process
  processedBy: varchar("processed_by"), // Teacher who scanned
  scannedAt: timestamp("scanned_at").defaultNow(),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  googleId: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  googleAccessToken: true,
  googleRefreshToken: true,
  googleTokenExpiry: true,
  classroomConnected: true,
});

export const insertClassroomSchema = createInsertSchema(classrooms).pick({
  googleClassId: true,
  customerUuid: true,
  name: true,
  section: true,
  description: true,
  room: true,
  courseState: true,
  creationTime: true,
  updateTime: true,
});

export const insertStudentSchema = createInsertSchema(students).pick({
  googleUserId: true,
  classroomId: true,
  firstName: true,
  lastName: true,
  email: true,
  photoUrl: true,
});

export const insertDocumentSchema = createInsertSchema(documents).pick({
  fileName: true,
  originalPath: true,
  mimeType: true,
  fileSize: true,
  jurisdictions: true,
}).extend({
  // Make optional fields actually optional
  assetType: z.enum([AssetType.UPLOADED, AssetType.GENERATED] as const).optional(),
  parentDocumentId: z.string().optional(),
  exportType: z.enum([ExportType.RUBRIC_PDF, ExportType.COVER_SHEET, ExportType.PROCESSING_REPORT, ExportType.STANDARDS_SUMMARY, ExportType.QUESTION_ANALYSIS, ExportType.TEACHER_GUIDE, ExportType.COLLATED_GRADED_SUBMISSIONS] as const).optional(),
  tags: z.array(z.string()).optional(),
  originalFilename: z.string().optional(),
  retentionDate: z.date().optional(),
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
  confidenceScore: true,
  notes: true,
  editReason: true,
});

export const insertExportQueueSchema = createInsertSchema(exportQueue).pick({
  documentId: true,
  exportType: true,
  priority: true,
});

export const insertDeadLetterQueueSchema = createInsertSchema(deadLetterQueue).pick({
  originalExportId: true,
  documentId: true,
  customerUuid: true,
  sessionUserId: true,
  exportType: true,
  priority: true,
  finalAttempts: true,
  maxAttempts: true,
  finalErrorMessage: true,
  finalErrorStack: true,
  originalScheduledFor: true,
  firstAttemptAt: true,
  documentFileName: true,
  documentFileSize: true,
  documentMimeType: true,
  documentStatus: true,
  serverVersion: true,
  nodeEnv: true,
  requestId: true,
  userAgent: true,
});

export const insertQrSequenceNumberSchema = createInsertSchema(qrSequenceNumbers).pick({
  documentId: true,
  studentId: true,
  sequenceNumber: true,
});

export const insertGradeSubmissionSchema = createInsertSchema(gradeSubmissions).pick({
  sequenceNumberId: true,
  documentId: true,
  studentId: true,
  questionGrades: true,
  totalScore: true,
  maxPossibleScore: true,
  percentageScore: true,
  scannerNotes: true,
  processedBy: true,
});

// Types
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Classroom = typeof classrooms.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type AiResponse = typeof aiResponses.$inferSelect;
export type QuestionResult = typeof questionResults.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type ProcessingQueue = typeof processingQueue.$inferSelect;
export type ExportQueue = typeof exportQueue.$inferSelect;
export type DeadLetterQueue = typeof deadLetterQueue.$inferSelect;
export type TeacherOverride = typeof teacherOverrides.$inferSelect;
export type QrSequenceNumber = typeof qrSequenceNumbers.$inferSelect;
export type GradeSubmission = typeof gradeSubmissions.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertClassroom = z.infer<typeof insertClassroomSchema>;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type InsertAiResponse = z.infer<typeof insertAiResponseSchema>;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type InsertTeacherOverride = z.infer<typeof insertTeacherOverrideSchema>;
export type InsertQrSequenceNumber = z.infer<typeof insertQrSequenceNumberSchema>;
export type InsertGradeSubmission = z.infer<typeof insertGradeSubmissionSchema>;
