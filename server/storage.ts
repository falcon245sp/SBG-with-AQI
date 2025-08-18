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
  exportQueue,
  qrSequenceNumbers,
  gradeSubmissions,
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
  type QrSequenceNumber,
  type GradeSubmission,
  type InsertUser,
  type InsertClassroom,
  type InsertStudent,
  type InsertDocument,
  type InsertQuestion,
  type InsertAiResponse,
  type InsertApiKey,
  type InsertTeacherOverride,
  type InsertQrSequenceNumber,
  type InsertGradeSubmission,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, inArray, sql, like, or } from "drizzle-orm";
import { PIIEncryption } from "./utils/encryption";

export interface IStorage {
  // User operations (supports both OAuth and username/password)
  getUser(id: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByCustomerUuid(customerUuid: string): Promise<User | undefined>;
  getUsersByName(firstName?: string, lastName?: string): Promise<User[]>;
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
  deleteDocument(id: string): Promise<void>;
  
  // Question operations
  createQuestion(question: InsertQuestion): Promise<Question>;
  getDocumentQuestions(documentId: string): Promise<Question[]>;
  
  // AI Response operations
  createAiResponse(response: InsertAiResponse): Promise<AiResponse>;
  getQuestionAiResponses(questionId: string): Promise<AiResponse[]>;
  
  // Results operations
  createQuestionResult(result: any): Promise<QuestionResult>;
  getDocumentResults(documentId: string, customerUuid: string): Promise<Array<Question & { result?: QuestionResult; aiResponses: AiResponse[]; teacherOverride?: TeacherOverride }>>;
  
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
  
  // QR Anti-fraud operations
  createQrSequenceNumber(qrData: InsertQrSequenceNumber): Promise<QrSequenceNumber>;
  findQrSequenceByNumber(sequenceNumber: string): Promise<QrSequenceNumber | undefined>;
  markQrSequenceAsUsed(sequenceId: string, usedByTeacher: string): Promise<void>;
  getQrSequencesForDocument(documentId: string): Promise<QrSequenceNumber[]>;
  
  // Grade submission operations
  createGradeSubmission(gradeData: InsertGradeSubmission): Promise<GradeSubmission>;
  getGradeSubmissionsForDocument(documentId: string): Promise<GradeSubmission[]>;
  getGradeSubmissionsForRubric(rubricDocumentId: string): Promise<GradeSubmission[]>;
  getStudentGradeSubmissions(studentId: string): Promise<GradeSubmission[]>;
  
  // Document relationship operations
  getGeneratedDocuments(parentDocumentId: string): Promise<Document[]>;
  getDocument(documentId: string): Promise<Document | undefined>;
  getCustomerDocuments(customerUuid: string): Promise<Document[]>;
  getStudent(studentId: string): Promise<Student | undefined>;
  getQrSequenceById(sequenceId: string): Promise<QrSequenceNumber | undefined>;
  getCustomerGradeSubmissions(customerUuid: string): Promise<GradeSubmission[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (supports both OAuth and username/password)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user) return undefined;
    
    // Try to decrypt PII fields, return user data even if decryption fails
    try {
      return {
        ...user,
        ...PIIEncryption.decryptUserPII({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
        }),
      };
    } catch (error) {
      console.warn('PII decryption failed for user, returning user data:', (error as Error).message);
      return user;
    }
  }

  async getAllUsers(): Promise<User[]> {
    const allUsers = await db.select().from(users);
    return allUsers.map(user => {
      try {
        return {
          ...user,
          ...PIIEncryption.decryptUserPII({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
          }),
        };
      } catch (error) {
        console.warn('PII decryption failed for user during getAllUsers, returning user data:', (error as Error).message);
        return user;
      }
    });
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Note: For username lookup, we need to encrypt the search term to match encrypted data
    const encryptedEmail = PIIEncryption.encrypt(username);
    if (!encryptedEmail) return undefined;
    
    const [user] = await db.select().from(users).where(eq(users.email, encryptedEmail));
    if (!user) return undefined;
    
    // Decrypt PII fields before returning
    return {
      ...user,
      ...PIIEncryption.decryptUserPII({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
      }),
    };
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // Encrypt the email to match encrypted data in database
    const encryptedEmail = PIIEncryption.encrypt(email);
    if (!encryptedEmail) return undefined;
    
    const [user] = await db.select().from(users).where(eq(users.email, encryptedEmail));
    if (!user) return undefined;
    
    try {
      return {
        ...user,
        ...PIIEncryption.decryptUserPII({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
        }),
      };
    } catch (error) {
      console.warn('PII decryption failed for user lookup by email, returning user data:', (error as Error).message);
      return user;
    }
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    if (!user) return undefined;
    
    try {
      return {
        ...user,
        ...PIIEncryption.decryptUserPII({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
        }),
      };
    } catch (error) {
      console.warn('PII decryption failed for user lookup by Google ID, returning user data:', (error as Error).message);
      return user;
    }
  }

  async getUserByCustomerUuid(customerUuid: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.customerUuid, customerUuid));
    if (!user) return undefined;
    
    try {
      return {
        ...user,
        ...PIIEncryption.decryptUserPII({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
        }),
      };
    } catch (error) {
      console.warn('PII decryption failed for user lookup by customer UUID, returning user data:', (error as Error).message);
      return user;
    }
  }

  async getUsersByName(firstName?: string, lastName?: string): Promise<User[]> {
    let query = db.select().from(users);

    // Build conditions for name search - note: we need to search encrypted fields
    const conditions = [];
    if (firstName) {
      const encryptedFirstName = PIIEncryption.encrypt(firstName);
      if (encryptedFirstName) {
        conditions.push(like(users.firstName, `%${encryptedFirstName}%`));
      }
    }
    if (lastName) {
      const encryptedLastName = PIIEncryption.encrypt(lastName);
      if (encryptedLastName) {
        conditions.push(like(users.lastName, `%${encryptedLastName}%`));
      }
    }

    if (conditions.length > 0) {
      query = query.where(or(...conditions)) as any;
    }

    const userResults = await query.limit(50); // Limit to prevent large result sets

    // Handle decryption for all users
    return userResults.map(user => {
      try {
        return {
          ...user,
          ...PIIEncryption.decryptUserPII({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
          }),
        };
      } catch (error) {
        console.warn('PII decryption failed for user during getUsersByName, returning user data:', (error as Error).message);
        return user;
      }
    });
  }

  async createUser(userData: UpsertUser): Promise<User> {
    // Encrypt PII fields before storing
    const encryptedUserData = {
      ...userData,
      ...PIIEncryption.encryptUserPII({
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
      }),
    };
    
    const [user] = await db
      .insert(users)
      .values(encryptedUserData)
      .returning();
    
    // Decrypt PII fields before returning
    return {
      ...user,
      ...PIIEncryption.decryptUserPII({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
      }),
    };
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
          
          // Encrypt PII fields before updating
          const encryptedUserData = {
            ...userData,
            ...PIIEncryption.encryptUserPII({
              email: userData.email,
              firstName: userData.firstName,
              lastName: userData.lastName,
              profileImageUrl: userData.profileImageUrl,
            }),
            updatedAt: new Date(),
          };
          
          // Update existing user
          const [user] = await db
            .update(users)
            .set(encryptedUserData)
            .where(eq(users.googleId, userData.googleId))
            .returning();
            
          console.log('[Database] User updated successfully:', {
            database_id: user.id,
            google_id: user.googleId,
            email: userData.email // Log original unencrypted email
          });
          
          // Decrypt PII fields before returning
          return {
            ...user,
            ...PIIEncryption.decryptUserPII({
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              profileImageUrl: user.profileImageUrl,
            }),
          };
        }
      }

      console.log('[Database] No existing user found, creating new user');
      
      // Encrypt PII fields before storing
      const encryptedUserData = {
        ...userData,
        ...PIIEncryption.encryptUserPII({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
        }),
      };
      
      // Create new user
      const [user] = await db
        .insert(users)
        .values(encryptedUserData)
        .returning();
        
      console.log('[Database] New user created successfully:', {
        database_id: user.id,
        google_id: user.googleId,
        email: userData.email // Log original unencrypted email
      });
      
      // Decrypt PII fields before returning
      return {
        ...user,
        ...PIIEncryption.decryptUserPII({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
        }),
      };
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
    // Encrypt PII fields before storing
    const encryptedStudentData = {
      ...studentData,
      firstName: PIIEncryption.encrypt(studentData.firstName) || studentData.firstName,
      lastName: PIIEncryption.encrypt(studentData.lastName) || studentData.lastName,
      email: studentData.email ? PIIEncryption.encrypt(studentData.email) : studentData.email,
    };
    
    const [student] = await db
      .insert(students)
      .values(encryptedStudentData)
      .returning();
      
    // Decrypt PII fields before returning
    return {
      ...student,
      firstName: PIIEncryption.decrypt(student.firstName) || '',
      lastName: PIIEncryption.decrypt(student.lastName) || '',
      email: PIIEncryption.decrypt(student.email),
    };
  }

  async getClassroomStudents(classroomId: string): Promise<Student[]> {
    const students_data = await db
      .select()
      .from(students)
      .where(eq(students.classroomId, classroomId))
      .orderBy(students.lastName, students.firstName);
      
    // Decrypt PII fields before returning
    return students_data.map(student => ({
      ...student,
      firstName: PIIEncryption.decrypt(student.firstName) || '',
      lastName: PIIEncryption.decrypt(student.lastName) || '',
      email: PIIEncryption.decrypt(student.email),
    }));
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
        // Encrypt PII fields before updating
        const encryptedUpdateData = {
          firstName: PIIEncryption.encrypt(profile.name.givenName) || profile.name.givenName,
          lastName: PIIEncryption.encrypt(profile.name.familyName) || profile.name.familyName,
          email: profile.emailAddress ? PIIEncryption.encrypt(profile.emailAddress) : null,
          photoUrl: profile.photoUrl,
          updatedAt: new Date(),
        };
        
        // Update existing student
        const [updated] = await db
          .update(students)
          .set(encryptedUpdateData)
          .where(eq(students.id, existingStudent.id))
          .returning();
          
        // Decrypt PII fields before adding to results
        syncedStudents.push({
          ...updated,
          firstName: PIIEncryption.decrypt(updated.firstName) || '',
          lastName: PIIEncryption.decrypt(updated.lastName) || '',
          email: PIIEncryption.decrypt(updated.email),
        });
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

  async updateDocumentTags(id: string, tags: string[]): Promise<void> {
    await db
      .update(documents)
      .set({
        tags,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id));
  }

  async deleteDocument(id: string): Promise<void> {
    // Delete document and all related data (cascading deletes should handle related records)
    await db
      .delete(documents)
      .where(eq(documents.id, id));
  }

  // Export Queue operations
  async createExportQueueItem(queueData: any): Promise<any> {
    const [item] = await db.insert(exportQueue).values(queueData).returning();
    return item;
  }

  async getExportQueueItems(): Promise<any[]> {
    return await db
      .select()
      .from(exportQueue)
      .where(eq(exportQueue.status, 'pending'))
      .orderBy(desc(exportQueue.priority), exportQueue.scheduledFor);
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

  async getDocumentResults(documentId: string, customerUuid: string): Promise<Array<Question & { result?: QuestionResult; aiResponses: AiResponse[]; teacherOverride?: TeacherOverride }>> {
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
        .select({
          id: teacherOverrides.id,
          questionId: teacherOverrides.questionId,
          customerUuid: teacherOverrides.customerUuid,
          overriddenStandards: teacherOverrides.overriddenStandards,
          overriddenRigorLevel: teacherOverrides.overriddenRigorLevel,
          confidenceScore: teacherOverrides.confidenceScore,
          notes: teacherOverrides.notes,
          editReason: teacherOverrides.editReason,
          isActive: teacherOverrides.isActive,
          isRevertedToAi: teacherOverrides.isRevertedToAi,
          createdAt: teacherOverrides.createdAt,
          updatedAt: teacherOverrides.updatedAt,
        })
        .from(teacherOverrides)
        .where(and(
          eq(teacherOverrides.questionId, question.id),
          eq(teacherOverrides.customerUuid, customerUuid),
          eq(teacherOverrides.isActive, true)
        ))
        .orderBy(desc(teacherOverrides.updatedAt))
        .limit(1);
      
      // Debug logging for Question 1 to understand the customer filtering issue
      if (question.questionNumber === '1') {
        console.log(`[DEBUG] Question 1 (${question.id}): Looking for overrides with customerUuid: ${customerUuid}`);
        
        // Check all overrides for this question regardless of customer to debug
        const allOverrides = await db
          .select({
            id: teacherOverrides.id,
            customerUuid: teacherOverrides.customerUuid,
            isActive: teacherOverrides.isActive,
            isRevertedToAi: teacherOverrides.isRevertedToAi,
            updatedAt: teacherOverrides.updatedAt,
          })
          .from(teacherOverrides)
          .where(eq(teacherOverrides.questionId, question.id))
          .orderBy(desc(teacherOverrides.updatedAt));
        
        console.log(`[DEBUG] All overrides for Question 1:`, allOverrides);
        console.log(`[DEBUG] Found ${teacherOverride ? 'active' : 'no active'} override for customer ${customerUuid}`);
      }
      
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
  async createApiKey(customerUuid: string, apiKey: InsertApiKey): Promise<ApiKey> {
    const [key] = await db
      .insert(apiKeys)
      .values({
        ...apiKey,
        customerUuid,
      })
      .returning();
    return key;
  }

  async getUserApiKeys(customerUuid: string): Promise<ApiKey[]> {
    return await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.customerUuid, customerUuid))
      .orderBy(desc(apiKeys.createdAt));
  }

  async validateApiKey(keyHash: string): Promise<{ customerUuid: string } | null> {
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
      
      return { customerUuid: key.customerUuid };
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
  async getProcessingStats(customerUuid?: string): Promise<{
    documentsProcessed: number;
    aiAnalyses: number;
    standardsIdentified: number;
    avgProcessingTime: string;
  }> {
    const whereClause = customerUuid ? eq(documents.customerUuid, customerUuid) : undefined;
    
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

  async getRigorDistribution(customerUuid?: string): Promise<{
    mild: number;
    medium: number;
    spicy: number;
  }> {
    // For now, return basic stats without filtering by customer since questionResults doesn't have customerUuid
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
  async createTeacherOverride(customerUuid: string, override: InsertTeacherOverride): Promise<TeacherOverride> {
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
        customerUuid,
        isActive: true,
        isRevertedToAi: false,
      })
      .returning();
    return teacherOverride;
  }

  async getQuestionOverride(questionId: string, customerUuid?: string): Promise<TeacherOverride | undefined> {
    const whereClause = customerUuid 
      ? and(eq(teacherOverrides.questionId, questionId), eq(teacherOverrides.customerUuid, customerUuid), eq(teacherOverrides.isActive, true))
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

  async revertToAI(questionId: string, customerUuid: string): Promise<void> {
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
  
  // QR Anti-fraud operations
  async createQrSequenceNumber(qrData: InsertQrSequenceNumber): Promise<QrSequenceNumber> {
    const [sequence] = await db.insert(qrSequenceNumbers).values(qrData).returning();
    return sequence;
  }
  
  async findQrSequenceByNumber(sequenceNumber: string): Promise<QrSequenceNumber | undefined> {
    const [sequence] = await db
      .select()
      .from(qrSequenceNumbers)
      .where(eq(qrSequenceNumbers.sequenceNumber, sequenceNumber));
    return sequence;
  }
  
  async markQrSequenceAsUsed(sequenceId: string, usedByTeacher: string): Promise<void> {
    await db
      .update(qrSequenceNumbers)
      .set({
        isUsed: true,
        usedAt: new Date(),
        usedByTeacher,
      })
      .where(eq(qrSequenceNumbers.id, sequenceId));
  }
  
  async getQrSequencesForDocument(documentId: string): Promise<QrSequenceNumber[]> {
    return await db
      .select()
      .from(qrSequenceNumbers)
      .where(eq(qrSequenceNumbers.documentId, documentId))
      .orderBy(qrSequenceNumbers.createdAt);
  }
  
  // Grade submission operations
  async createGradeSubmission(gradeData: InsertGradeSubmission): Promise<GradeSubmission> {
    const [submission] = await db.insert(gradeSubmissions).values(gradeData).returning();
    return submission;
  }
  
  async getGradeSubmissionsForDocument(documentId: string): Promise<GradeSubmission[]> {
    return await db
      .select()
      .from(gradeSubmissions)
      .where(or(
        eq(gradeSubmissions.rubricDocumentId, documentId),
        eq(gradeSubmissions.originalDocumentId, documentId)
      ))
      .orderBy(gradeSubmissions.scannedAt);
  }
  
  async getGradeSubmissionsForRubric(rubricDocumentId: string): Promise<GradeSubmission[]> {
    return await db
      .select()
      .from(gradeSubmissions)
      .where(eq(gradeSubmissions.rubricDocumentId, rubricDocumentId))
      .orderBy(gradeSubmissions.scannedAt);
  }
  
  async getStudentGradeSubmissions(studentId: string): Promise<GradeSubmission[]> {
    return await db
      .select()
      .from(gradeSubmissions)
      .where(eq(gradeSubmissions.studentId, studentId))
      .orderBy(gradeSubmissions.scannedAt);
  }
  
  // Document relationship operations
  async getGeneratedDocuments(parentDocumentId: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(and(
        eq(documents.parentDocumentId, parentDocumentId),
        eq(documents.assetType, 'generated')
      ))
      .orderBy(documents.createdAt);
  }
  
  async getDocument(documentId: string): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));
    return document;
  }
  
  async getCustomerDocuments(customerUuid: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.customerUuid, customerUuid))
      .orderBy(desc(documents.createdAt));
  }
  
  async getStudent(studentId: string): Promise<Student | undefined> {
    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.id, studentId));
    return student;
  }
  
  async getQrSequenceById(sequenceId: string): Promise<QrSequenceNumber | undefined> {
    const [sequence] = await db
      .select()
      .from(qrSequenceNumbers)
      .where(eq(qrSequenceNumbers.id, sequenceId));
    return sequence;
  }
  
  async getCustomerGradeSubmissions(customerUuid: string): Promise<GradeSubmission[]> {
    return await db
      .select()
      .from(gradeSubmissions)
      .innerJoin(documents, eq(gradeSubmissions.originalDocumentId, documents.id))
      .where(eq(documents.customerUuid, customerUuid))
      .orderBy(desc(gradeSubmissions.scannedAt))
      .then(results => results.map(result => result.grade_submissions));
  }
}

export const storage = new DatabaseStorage();
