import {
  users,
  classrooms,
  students,
  documents,
  questions,
  aiResponses,
  questionResults,
  apiKeys,
  processingQueue,
  teacherOverrides,
  type User,
  type UpsertUser,
  type Classroom,
  type Student,
  type Document,
  type Question,
  type AiResponse,
  type QuestionResult,
  type ApiKey,
  type ProcessingQueue,
  type TeacherOverride,
  type InsertUser,
  type InsertClassroom,
  type InsertStudent,
  type InsertDocument,
  type InsertQuestion,
  type InsertAiResponse,
  type InsertApiKey,
  type InsertTeacherOverride,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, inArray, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (supports both OAuth and username/password)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserTokens(userId: string, accessToken: string, refreshToken?: string, expiry?: Date): Promise<void>;
  updateUserGoogleCredentials(userId: string, credentials: any): Promise<void>;
  
  // Classroom operations
  createClassroom(classroom: InsertClassroom): Promise<Classroom>;
  getTeacherClassrooms(teacherId: string): Promise<Classroom[]>;
  getClassroomByGoogleId(googleClassId: string): Promise<Classroom | undefined>;
  syncClassrooms(teacherId: string, classroomData: any[]): Promise<Classroom[]>;
  
  // Student operations  
  createStudent(student: InsertStudent): Promise<Student>;
  getClassroomStudents(classroomId: string): Promise<Student[]>;
  syncStudents(classroomId: string, studentData: any[]): Promise<Student[]>;
  
  // Document operations
  createDocument(customerUuid: string, document: InsertDocument): Promise<Document>;
  getDocument(id: string): Promise<Document | undefined>;
  getUserDocuments(customerUuid: string, limit?: number): Promise<Document[]>;
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
  createApiKey(customerUuid: string, apiKey: InsertApiKey): Promise<ApiKey>;
  getUserApiKeys(customerUuid: string): Promise<ApiKey[]>;
  validateApiKey(keyHash: string): Promise<{ customerUuid: string } | null>;
  
  // Processing queue operations
  addToProcessingQueue(documentId: string, priority?: number): Promise<ProcessingQueue>;
  getNextQueueItem(): Promise<ProcessingQueue | undefined>;
  removeFromQueue(id: string): Promise<void>;
  getQueueStatus(): Promise<Array<ProcessingQueue & { document?: Document }>>;
  
  // Teacher override operations
  createTeacherOverride(customerUuid: string, override: InsertTeacherOverride): Promise<TeacherOverride>;
  getQuestionOverride(questionId: string, customerUuid?: string): Promise<TeacherOverride | undefined>;
  updateTeacherOverride(overrideId: string, updates: Partial<InsertTeacherOverride>): Promise<void>;
  getQuestionWithOverrides(questionId: string): Promise<Array<Question & { override?: TeacherOverride; result?: QuestionResult; aiResponses: AiResponse[] }>>;
  
  // Analytics operations
  getProcessingStats(customerUuid?: string): Promise<{
    documentsProcessed: number;
    aiAnalyses: number;
    standardsIdentified: number;
    avgProcessingTime: string;
  }>;
  
  getRigorDistribution(customerUuid?: string): Promise<{
    mild: number;
    medium: number;
    spicy: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations (supports both OAuth and username/password)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    console.log('[Database] Upserting user with googleId:', userData.googleId);
    
    try {
      // If googleId provided, try to find existing user by googleId
      if (userData.googleId) {
        console.log('[Database] Checking for existing user with googleId:', userData.googleId);
        const existingUser = await this.getUserByGoogleId(userData.googleId);
        
        if (existingUser) {
          console.log('[Database] Existing user found, updating:', {
            database_id: existingUser.id,
            current_email: existingUser.email,
            new_email: userData.email
          });
          
          // Update existing user
          const [user] = await db
            .update(users)
            .set({
              ...userData,
              updatedAt: new Date(),
            })
            .where(eq(users.googleId, userData.googleId))
            .returning();
            
          console.log('[Database] User updated successfully:', {
            database_id: user.id,
            google_id: user.googleId,
            email: user.email
          });
          
          return user;
        }
      }

      console.log('[Database] No existing user found, creating new user');
      
      // Create new user
      const [user] = await db
        .insert(users)
        .values(userData)
        .returning();
        
      console.log('[Database] New user created successfully:', {
        database_id: user.id,
        google_id: user.googleId,
        email: user.email
      });
      
      return user;
    } catch (error: any) {
      console.error('[Database] ERROR - User upsert failed:', {
        error_type: 'DATABASE_ERROR',
        error_name: error.name,
        error_message: error.message,
        error_code: error.code,
        user_data: {
          googleId: userData.googleId,
          email: userData.email
        }
      });
      throw error;
    }
  }

  async updateUserTokens(userId: string, accessToken: string, refreshToken?: string, expiry?: Date): Promise<void> {
    await db
      .update(users)
      .set({
        googleAccessToken: accessToken,
        googleRefreshToken: refreshToken,
        googleTokenExpiry: expiry,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async updateUserGoogleCredentials(userId: string, credentials: any): Promise<void> {
    const updateData: any = {
      googleCredentials: JSON.stringify(credentials),
      classroomConnected: true,
      updatedAt: new Date(),
    };

    // If credentials include access token, store it
    if (credentials.access_token) {
      updateData.googleAccessToken = credentials.access_token;
    }
    
    if (credentials.refresh_token) {
      updateData.googleRefreshToken = credentials.refresh_token;
    }

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId));
  }

  async upsertGoogleUser(userData: {
    googleId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    profileImageUrl?: string;
    googleAccessToken?: string;
    googleRefreshToken?: string;
    googleTokenExpiry?: Date;
  }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        googleId: userData.googleId,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
        googleAccessToken: userData.googleAccessToken,
        googleRefreshToken: userData.googleRefreshToken,
        googleTokenExpiry: userData.googleTokenExpiry,
        classroomConnected: !!userData.googleAccessToken,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [users.googleId],
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          googleAccessToken: userData.googleAccessToken,
          googleRefreshToken: userData.googleRefreshToken,
          googleTokenExpiry: userData.googleTokenExpiry,
          classroomConnected: !!userData.googleAccessToken,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Classroom operations
  async createClassroom(classroomData: InsertClassroom): Promise<Classroom> {
    const [classroom] = await db
      .insert(classrooms)
      .values(classroomData)
      .returning();
    return classroom;
  }

  async getTeacherClassrooms(customerUuid: string): Promise<Classroom[]> {
    return await db
      .select()
      .from(classrooms)
      .where(eq(classrooms.customerUuid, customerUuid))
      .orderBy(classrooms.name);
  }

  async getClassroomByGoogleId(googleClassId: string): Promise<Classroom | undefined> {
    const [classroom] = await db
      .select()
      .from(classrooms)
      .where(eq(classrooms.googleClassId, googleClassId));
    return classroom;
  }

  async syncClassrooms(customerUuid: string, classroomData: any[]): Promise<Classroom[]> {
    const syncedClassrooms: Classroom[] = [];
    
    for (const classData of classroomData) {
      // Check if classroom already exists
      let classroom = await this.getClassroomByGoogleId(classData.id);
      
      if (classroom) {
        // Update existing classroom
        const [updated] = await db
          .update(classrooms)
          .set({
            name: classData.name,
            section: classData.section,
            description: classData.description,
            room: classData.room,
            courseState: classData.courseState,
            updateTime: classData.updateTime ? new Date(classData.updateTime) : undefined,
            updatedAt: new Date(),
          })
          .where(eq(classrooms.googleClassId, classData.id))
          .returning();
        syncedClassrooms.push(updated);
      } else {
        // Create new classroom
        const newClassroom = await this.createClassroom({
          googleClassId: classData.id,
          customerUuid,
          name: classData.name,
          section: classData.section,
          description: classData.description,
          room: classData.room,
          courseState: classData.courseState,
          creationTime: classData.creationTime ? new Date(classData.creationTime) : undefined,
          updateTime: classData.updateTime ? new Date(classData.updateTime) : undefined,
        });
        syncedClassrooms.push(newClassroom);
      }
    }
    
    return syncedClassrooms;
  }

  // Student operations
  async createStudent(studentData: InsertStudent): Promise<Student> {
    const [student] = await db
      .insert(students)
      .values(studentData)
      .returning();
    return student;
  }

  async getClassroomStudents(classroomId: string): Promise<Student[]> {
    return await db
      .select()
      .from(students)
      .where(eq(students.classroomId, classroomId))
      .orderBy(students.lastName, students.firstName);
  }

  async syncStudents(classroomId: string, studentData: any[]): Promise<Student[]> {
    const syncedStudents: Student[] = [];
    
    for (const studentInfo of studentData) {
      const profile = studentInfo.profile;
      
      // Check if student already exists in this classroom
      const [existingStudent] = await db
        .select()
        .from(students)
        .where(
          and(
            eq(students.classroomId, classroomId),
            profile.id ? eq(students.googleUserId, profile.id) : eq(students.email, profile.emailAddress)
          )
        );
      
      if (existingStudent) {
        // Update existing student
        const [updated] = await db
          .update(students)
          .set({
            firstName: profile.name.givenName,
            lastName: profile.name.familyName,
            email: profile.emailAddress,
            photoUrl: profile.photoUrl,
            updatedAt: new Date(),
          })
          .where(eq(students.id, existingStudent.id))
          .returning();
        syncedStudents.push(updated);
      } else {
        // Create new student
        const newStudent = await this.createStudent({
          googleUserId: profile.id,
          classroomId,
          firstName: profile.name.givenName,
          lastName: profile.name.familyName,
          email: profile.emailAddress,
          photoUrl: profile.photoUrl,
        });
        syncedStudents.push(newStudent);
      }
    }
    
    return syncedStudents;
  }

  // Document operations
  async createDocument(customerUuid: string, document: InsertDocument): Promise<Document> {
    const [doc] = await db
      .insert(documents)
      .values({
        ...document,
        customerUuid,
      })
      .returning();
    return doc;
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  }

  async getUserDocuments(customerUuid: string, limit = 50): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.customerUuid, customerUuid))
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
      
      // Debug logging for specific question
      if (question.id === '98a5b027-17d4-42f0-9b04-94c0d21a0abc') {
        console.log(`Question ${question.id}: found ${teacherOverride ? 'active' : 'no active'} override`);
        if (teacherOverride) {
          console.log(`Override details: id=${teacherOverride.id}, isActive=${teacherOverride.isActive}, isRevertedToAi=${teacherOverride.isRevertedToAi}`);
        }
      }

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
    const result = await db
      .update(teacherOverrides)
      .set({ 
        isActive: false, 
        isRevertedToAi: true, 
        updatedAt: new Date() 
      })
      .where(and(
        eq(teacherOverrides.questionId, questionId),
        eq(teacherOverrides.isActive, true)
      ))
      .returning();
    
    console.log(`Reverted ${result.length} override(s) for question ${questionId}:`, result.map(r => ({ id: r.id, isActive: r.isActive, isRevertedToAi: r.isRevertedToAi })));
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
