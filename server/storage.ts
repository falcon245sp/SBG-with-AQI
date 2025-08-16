import {
  users,
  documents,
  questions,
  aiResponses,
  questionResults,
  apiKeys,
  processingQueue,
  teacherOverrides,
  type User,
  type UpsertUser,
  type Document,
  type Question,
  type AiResponse,
  type QuestionResult,
  type ApiKey,
  type ProcessingQueue,
  type TeacherOverride,
  type InsertDocument,
  type InsertQuestion,
  type InsertAiResponse,
  type InsertApiKey,
  type InsertTeacherOverride,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, inArray, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Document operations
  createDocument(userId: string, document: InsertDocument): Promise<Document>;
  getDocument(id: string): Promise<Document | undefined>;
  getUserDocuments(userId: string, limit?: number): Promise<Document[]>;
  updateDocumentStatus(id: string, status: string, errorMessage?: string): Promise<void>;
  
  // Question operations
  createQuestion(question: InsertQuestion): Promise<Question>;
  getDocumentQuestions(documentId: string): Promise<Question[]>;
  
  // AI Response operations
  createAiResponse(response: InsertAiResponse): Promise<AiResponse>;
  getQuestionAiResponses(questionId: string): Promise<AiResponse[]>;
  
  // Results operations
  createQuestionResult(result: any): Promise<QuestionResult>;
  getDocumentResults(documentId: string): Promise<Array<Question & { result?: QuestionResult; aiResponses: AiResponse[]; teacherOverride?: TeacherOverride }>>;
  
  // API Key operations
  createApiKey(userId: string, apiKey: InsertApiKey): Promise<ApiKey>;
  getUserApiKeys(userId: string): Promise<ApiKey[]>;
  validateApiKey(keyHash: string): Promise<{ userId: string } | null>;
  
  // Processing queue operations
  addToProcessingQueue(documentId: string, priority?: number): Promise<ProcessingQueue>;
  getNextQueueItem(): Promise<ProcessingQueue | undefined>;
  removeFromQueue(id: string): Promise<void>;
  getQueueStatus(): Promise<Array<ProcessingQueue & { document?: Document }>>;
  
  // Teacher override operations
  createTeacherOverride(userId: string, override: InsertTeacherOverride): Promise<TeacherOverride>;
  getQuestionOverride(questionId: string, userId?: string): Promise<TeacherOverride | undefined>;
  updateTeacherOverride(overrideId: string, updates: Partial<InsertTeacherOverride>): Promise<void>;
  getQuestionWithOverrides(questionId: string): Promise<Array<Question & { override?: TeacherOverride; result?: QuestionResult; aiResponses: AiResponse[] }>>;
  
  // Analytics operations
  getProcessingStats(userId?: string): Promise<{
    documentsProcessed: number;
    aiAnalyses: number;
    standardsIdentified: number;
    avgProcessingTime: string;
  }>;
  
  getRigorDistribution(userId?: string): Promise<{
    mild: number;
    medium: number;
    spicy: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Document operations
  async createDocument(userId: string, document: InsertDocument): Promise<Document> {
    const [doc] = await db
      .insert(documents)
      .values({
        ...document,
        userId,
      })
      .returning();
    return doc;
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  }

  async getUserDocuments(userId: string, limit = 50): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.createdAt))
      .limit(limit);
  }

  async updateDocumentStatus(id: string, status: string, errorMessage?: string): Promise<void> {
    await db
      .update(documents)
      .set({
        status: status as any,
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id));
  }

  // Question operations
  async createQuestion(question: InsertQuestion): Promise<Question> {
    const [q] = await db.insert(questions).values(question).returning();
    return q;
  }

  async getDocumentQuestions(documentId: string): Promise<Question[]> {
    return await db
      .select()
      .from(questions)
      .where(eq(questions.documentId, documentId))
      .orderBy(questions.questionNumber);
  }

  // AI Response operations
  async createAiResponse(response: InsertAiResponse): Promise<AiResponse> {
    const [aiResponse] = await db.insert(aiResponses).values(response).returning();
    return aiResponse;
  }

  async getQuestionAiResponses(questionId: string): Promise<AiResponse[]> {
    return await db
      .select()
      .from(aiResponses)
      .where(eq(aiResponses.questionId, questionId));
  }

  // Results operations
  async createQuestionResult(result: any): Promise<QuestionResult> {
    const [qr] = await db.insert(questionResults).values(result).returning();
    return qr;
  }

  async getDocumentResults(documentId: string): Promise<Array<Question & { result?: QuestionResult; aiResponses: AiResponse[]; teacherOverride?: TeacherOverride }>> {
    const questionsData = await db
      .select()
      .from(questions)
      .where(eq(questions.documentId, documentId))
      .orderBy(questions.questionNumber);

    const results = [];
    for (const question of questionsData) {
      const [result] = await db
        .select()
        .from(questionResults)
        .where(eq(questionResults.questionId, question.id));
      
      const aiResponsesData = await db
        .select()
        .from(aiResponses)
        .where(eq(aiResponses.questionId, question.id));

      // Get active teacher override if exists
      const [teacherOverride] = await db
        .select()
        .from(teacherOverrides)
        .where(and(
          eq(teacherOverrides.questionId, question.id),
          eq(teacherOverrides.isActive, true)
        ))
        .orderBy(desc(teacherOverrides.updatedAt))
        .limit(1);

      results.push({
        ...question,
        result,
        aiResponses: aiResponsesData,
        teacherOverride,
      });
    }

    return results;
  }

  // API Key operations
  async createApiKey(userId: string, apiKey: InsertApiKey): Promise<ApiKey> {
    const [key] = await db
      .insert(apiKeys)
      .values({
        ...apiKey,
        userId,
      })
      .returning();
    return key;
  }

  async getUserApiKeys(userId: string): Promise<ApiKey[]> {
    return await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(desc(apiKeys.createdAt));
  }

  async validateApiKey(keyHash: string): Promise<{ userId: string } | null> {
    const [key] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)));
    
    if (key) {
      // Update last used timestamp
      await db
        .update(apiKeys)
        .set({
          lastUsed: new Date(),
          usageCount: sql`${apiKeys.usageCount} + 1`,
        })
        .where(eq(apiKeys.id, key.id));
      
      return { userId: key.userId };
    }
    
    return null;
  }

  // Processing queue operations
  async addToProcessingQueue(documentId: string, priority = 0): Promise<ProcessingQueue> {
    const [item] = await db
      .insert(processingQueue)
      .values({
        documentId,
        priority,
      })
      .returning();
    return item;
  }

  async getNextQueueItem(): Promise<ProcessingQueue | undefined> {
    const [item] = await db
      .select()
      .from(processingQueue)
      .orderBy(desc(processingQueue.priority), processingQueue.createdAt)
      .limit(1);
    return item;
  }

  async removeFromQueue(id: string): Promise<void> {
    await db.delete(processingQueue).where(eq(processingQueue.id, id));
  }

  async getQueueStatus(): Promise<Array<ProcessingQueue & { document?: Document }>> {
    const queueItems = await db
      .select()
      .from(processingQueue)
      .orderBy(desc(processingQueue.priority), processingQueue.createdAt);
    
    const itemsWithDocuments = [];
    for (const item of queueItems) {
      const document = await this.getDocument(item.documentId);
      itemsWithDocuments.push({
        ...item,
        document
      });
    }
    
    return itemsWithDocuments;
  }

  // Analytics operations
  async getProcessingStats(userId?: string): Promise<{
    documentsProcessed: number;
    aiAnalyses: number;
    standardsIdentified: number;
    avgProcessingTime: string;
  }> {
    const whereClause = userId ? eq(documents.userId, userId) : undefined;
    
    const [docStats] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(documents)
      .where(whereClause);

    const [aiStats] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(aiResponses);

    const [standardStats] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(questionResults);

    return {
      documentsProcessed: docStats?.count || 0,
      aiAnalyses: aiStats?.count || 0,
      standardsIdentified: standardStats?.count || 0,
      avgProcessingTime: "2.4m", // This would be calculated from processing times
    };
  }

  async getRigorDistribution(userId?: string): Promise<{
    mild: number;
    medium: number;
    spicy: number;
  }> {
    const [stats] = await db
      .select({
        mild: sql<number>`count(*) filter (where consensus_rigor_level = 'mild')`,
        medium: sql<number>`count(*) filter (where consensus_rigor_level = 'medium')`,
        spicy: sql<number>`count(*) filter (where consensus_rigor_level = 'spicy')`,
      })
      .from(questionResults);

    return {
      mild: stats?.mild || 0,
      medium: stats?.medium || 0,
      spicy: stats?.spicy || 0,
    };
  }
  
  // Teacher override operations with edit history
  async createTeacherOverride(userId: string, override: InsertTeacherOverride): Promise<TeacherOverride> {
    // First deactivate any existing active overrides for this question
    await db
      .update(teacherOverrides)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(teacherOverrides.questionId, override.questionId),
        eq(teacherOverrides.isActive, true)
      ));

    // Create new override
    const [teacherOverride] = await db
      .insert(teacherOverrides)
      .values({
        ...override,
        userId,
        isActive: true,
        isRevertedToAi: false,
      })
      .returning();
    return teacherOverride;
  }

  async getQuestionOverride(questionId: string, userId?: string): Promise<TeacherOverride | undefined> {
    const whereClause = userId 
      ? and(eq(teacherOverrides.questionId, questionId), eq(teacherOverrides.userId, userId), eq(teacherOverrides.isActive, true))
      : and(eq(teacherOverrides.questionId, questionId), eq(teacherOverrides.isActive, true));
    
    const [override] = await db
      .select()
      .from(teacherOverrides)
      .where(whereClause)
      .orderBy(desc(teacherOverrides.createdAt))
      .limit(1);
    return override;
  }

  async getQuestionOverrideHistory(questionId: string): Promise<TeacherOverride[]> {
    return await db
      .select()
      .from(teacherOverrides)
      .where(eq(teacherOverrides.questionId, questionId))
      .orderBy(desc(teacherOverrides.createdAt));
  }

  async revertToAI(questionId: string, userId: string): Promise<void> {
    // Deactivate current active override and mark as reverted to Sherpa
    await db
      .update(teacherOverrides)
      .set({ 
        isActive: false, 
        isRevertedToAi: true, 
        updatedAt: new Date() 
      })
      .where(and(
        eq(teacherOverrides.questionId, questionId),
        eq(teacherOverrides.isActive, true)
      ));
  }

  async updateTeacherOverride(overrideId: string, updates: Partial<InsertTeacherOverride>): Promise<void> {
    await db
      .update(teacherOverrides)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(teacherOverrides.id, overrideId));
  }

  async getQuestionWithOverrides(questionId: string): Promise<Array<Question & { override?: TeacherOverride; result?: QuestionResult; aiResponses: AiResponse[] }>> {
    // Get the question
    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId));
    
    if (!question) return [];
    
    // Get teacher override for this question
    const override = await this.getQuestionOverride(questionId);
    
    // Get AI result
    const [result] = await db
      .select()
      .from(questionResults)
      .where(eq(questionResults.questionId, questionId));
    
    // Get AI responses
    const aiResponsesData = await db
      .select()
      .from(aiResponses)
      .where(eq(aiResponses.questionId, questionId));

    return [{
      ...question,
      override,
      result,
      aiResponses: aiResponsesData,
    }];
  }
}

export const storage = new DatabaseStorage();
