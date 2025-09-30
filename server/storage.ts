import {
  users,
  classrooms,
  students,
  assignments,
  documents,
  questions,
  aiResponses,
  questionResults,
  apiKeys,
  processingQueue,
  teacherOverrides,
  confirmedAnalysis,
  exportQueue,
  deadLetterQueue,
  qrSequenceNumbers,
  gradeSubmissions,
  cachedJurisdictions,
  cachedStandardSets,
  cachedStandards,
  type User,
  type UpsertUser,
  type Classroom,
  type Student,
  type Assignment,
  type Document,
  type Question,
  type AiResponse,
  type QuestionResult,
  type ApiKey,
  type ProcessingQueue,
  type ExportQueue,
  type DeadLetterQueue,
  type TeacherOverride,
  type ConfirmedAnalysis,
  type QrSequenceNumber,
  type GradeSubmission,
  type InsertUser,
  type InsertClassroom,
  type InsertStudent,
  type InsertAssignment,
  type InsertDocument,
  type InsertQuestion,
  type InsertAiResponse,
  type InsertApiKey,
  type InsertTeacherOverride,
  type InsertConfirmedAnalysis,
  type InsertQrSequenceNumber,
  type InsertGradeSubmission,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, inArray, sql, like, or } from "drizzle-orm";
import { ProcessingStatus, TeacherReviewStatus, AssetType, ExportType, AiEngine, RigorLevel, GradeSubmissionStatus, BusinessDefaults } from "../shared/businessEnums";
import { PIIEncryption } from "./utils/encryption";
import crypto from "crypto";

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
  updateUserPreferences(userId: string, preferences: any): Promise<void>;
  
  // Classroom operations
  createClassroom(classroom: InsertClassroom): Promise<Classroom>;
  updateClassroom(classroomId: string, updates: Partial<Classroom>): Promise<Classroom>;
  getTeacherClassrooms(teacherId: string): Promise<Classroom[]>;
  getClassroomById(classroomId: string): Promise<Classroom | undefined>;
  getClassroomByGoogleId(googleClassId: string): Promise<Classroom | undefined>;
  syncClassrooms(teacherId: string, classroomData: any[]): Promise<Classroom[]>;
  
  // Student operations  
  createStudent(student: InsertStudent): Promise<Student>;
  getClassroomStudents(classroomId: string): Promise<Student[]>;
  syncStudents(classroomId: string, studentData: any[]): Promise<Student[]>;
  
  // Assignment operations
  upsertAssignment(assignment: InsertAssignment): Promise<Assignment>;
  getAssignmentById(assignmentId: string): Promise<Assignment | undefined>;
  getClassroomAssignments(classroomId: string): Promise<Assignment[]>;
  
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
  
  // CONFIRMED analysis operations - single source of truth for generated documents
  createConfirmedAnalysis(customerUuid: string, analysis: InsertConfirmedAnalysis): Promise<ConfirmedAnalysis>;
  getConfirmedAnalysis(documentId: string): Promise<ConfirmedAnalysis | undefined>;
  updateConfirmedAnalysis(documentId: string, updates: Partial<InsertConfirmedAnalysis>): Promise<void>;
  
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
  
  // Generated document cleanup operations
  deleteGeneratedDocumentsForSource(sourceDocumentId: string): Promise<void>;
  clearExportQueueForDocument(documentId: string): Promise<void>;

  // Common Standards Project cache methods
  getCachedJurisdictions(): Promise<any[]>;
  cacheJurisdictions(jurisdictions: any[]): Promise<void>;
  getCachedStandardSetsForJurisdiction(jurisdictionId: string): Promise<any[]>;
  cacheStandardSetsForJurisdiction(jurisdictionId: string, standardSets: any[]): Promise<void>;
  getCachedStandardsForSet(standardSetId: string): Promise<any | null>;
  cacheStandardsForSet(standardSetId: string, standardsData: any): Promise<void>;
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
      // Silenced: PII decryption failed for user, returning user data
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
        // Silenced: PII decryption failed for user during getAllUsers
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
      // Silenced: PII decryption failed for user lookup by email, returning user data
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
      // Silenced: PII decryption failed for user lookup by Google ID, returning user data
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
      // Silenced: PII decryption failed for user lookup by customer UUID, returning user data
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
        // Silenced: PII decryption failed for user during getUsersByName, returning user data
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
      
      // Generate customerUuid if not provided - userData doesn't have customerUuid field in UpsertUser
      const customerUuid = crypto.randomUUID();
      
      // Encrypt PII fields before storing
      const encryptedUserData = {
        ...userData,
        customerUuid,
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

  async updateUserPreferences(userId: string, preferences: any): Promise<void> {
    const updateData: any = {
      updatedAt: new Date(),
      ...preferences
    };

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
    const operationId = crypto.randomUUID();
    const startTime = Date.now();
    
    console.log(`[DB-${operationId}] Starting upsertGoogleUser:`, {
      googleId: userData.googleId,
      email: userData.email,
      hasFirstName: !!userData.firstName,
      hasLastName: !!userData.lastName,
      hasProfileImage: !!userData.profileImageUrl,
      hasAccessToken: !!userData.googleAccessToken,
      accessTokenLength: userData.googleAccessToken?.length || 0,
      hasRefreshToken: !!userData.googleRefreshToken,
      refreshTokenLength: userData.googleRefreshToken?.length || 0,
      hasTokenExpiry: !!userData.googleTokenExpiry,
      tokenExpiry: userData.googleTokenExpiry?.toISOString(),
      timestamp: new Date().toISOString()
    });
    
    // Check if user already exists
    const lookupStart = Date.now();
    const existing = await this.getUserByGoogleId(userData.googleId);
    const lookupTime = Date.now() - lookupStart;
    console.log(`[DB-${operationId}] User lookup result:`, {
      userExists: !!existing,
      existingUserId: existing?.id,
      existingEmail: existing?.email,
      existingCustomerUuid: existing?.customerUuid,
      existingGoogleId: existing?.googleId,
      lookupTime,
      email: userData.email,
      googleId: userData.googleId.substring(0, 10) + '...',
      isExistingUser: !!existing
    });
    
    const upsertStart = Date.now();
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
        onboardingCompleted: false,
        onboardingStep: 'role-selection',
        selectedRole: 'teacher',
        onboardingRoleSelected: false,
        standardsConfigurationCompleted: false,
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
    
    const upsertTime = Date.now() - upsertStart;
    console.log(`[DB-${operationId}] User operation completed:`, {
      operation: existing ? 'UPDATE' : 'CREATE',
      userId: user.id,
      email: user.email,
      customerUuid: user.customerUuid,
      onboardingCompleted: user.onboardingCompleted,
      onboardingStep: user.onboardingStep,
      standardsConfigurationCompleted: user.standardsConfigurationCompleted,
      classroomConnected: user.classroomConnected,
      upsertTime,
      totalTime: Date.now() - startTime
    });
    
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

  async updateClassroom(classroomId: string, updates: Partial<Classroom>): Promise<Classroom> {
    console.log('🏫 [CLASSROOM-UPDATE] Updating classroom:', {
      classroomId,
      updates,
      updatesKeys: Object.keys(updates)
    });
    
    // Import the explicit projection to ensure camelCase output
    const { classroomSelect } = await import('./dbMapper.js');
    
    const [classroom] = await db
      .update(classrooms)
      .set(updates)
      .where(eq(classrooms.id, classroomId))
      .returning(classroomSelect);
    
    console.log('🏫 [CLASSROOM-UPDATE] Classroom updated successfully:', {
      classroomId: classroom.id,
      name: classroom.name,
      courseTitle: classroom.courseTitle,
      courseConfigurationCompleted: classroom.courseConfigurationCompleted,
      sbgEnabled: classroom.sbgEnabled
    });
    
    return classroom;
  }

  async getTeacherClassrooms(customerUuid: string): Promise<Classroom[]> {
    // console.log('🔍 [DB-QUERY] Fetching teacher classrooms for customerUuid:', customerUuid);
    
    // Import the explicit projection to ensure camelCase output
    const { classroomSelect } = await import('./dbMapper.js');
    
    const results = await db
      .select(classroomSelect)
      .from(classrooms)
      .where(eq(classrooms.customerUuid, customerUuid))
      .orderBy(classrooms.name);
    
    // console.log('🔍 [DB-QUERY] Database returned classrooms:', {
    //   count: results.length,
    //   customerUuid,
    //   classrooms: results.map(c => ({
    //     id: c.id,
    //     name: c.name,
    //     courseTitle: c.courseTitle,
    //     courseConfigurationCompleted: c.courseConfigurationCompleted,
    //     sbgEnabled: c.sbgEnabled
    //   }))
    // });
    
    return results;
  }

  async getClassroomByGoogleId(googleClassId: string): Promise<Classroom | undefined> {
    const [classroom] = await db
      .select()
      .from(classrooms)
      .where(eq(classrooms.googleClassId, googleClassId));
    return classroom;
  }

  async getClassroomById(classroomId: string): Promise<Classroom | undefined> {
    const [classroom] = await db
      .select()
      .from(classrooms)
      .where(eq(classrooms.id, classroomId));
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
            detectedSubjectArea: classData.detectedSubjectArea,
            standardsJurisdiction: classData.standardsJurisdiction,
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
          detectedSubjectArea: classData.detectedSubjectArea,
          standardsJurisdiction: classData.standardsJurisdiction,
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

  // Assignment operations
  async upsertAssignment(assignmentData: InsertAssignment): Promise<Assignment> {
    // Check if assignment already exists by Google CourseWork ID
    const [existing] = await db
      .select()
      .from(assignments)
      .where(eq(assignments.googleCourseWorkId, assignmentData.googleCourseWorkId));

    if (existing) {
      // Update existing assignment
      const [updated] = await db
        .update(assignments)
        .set({
          ...assignmentData,
          updatedAt: new Date(),
        })
        .where(eq(assignments.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new assignment
      const [created] = await db
        .insert(assignments)
        .values(assignmentData)
        .returning();
      return created;
    }
  }

  async getAssignmentById(assignmentId: string): Promise<Assignment | undefined> {
    const [assignment] = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, assignmentId));
    return assignment;
  }

  async getClassroomAssignments(classroomId: string): Promise<Assignment[]> {
    return await db
      .select()
      .from(assignments)
      .where(eq(assignments.classroomId, classroomId))
      .orderBy(assignments.createdAt);
  }

  // Document operations
  async createDocument(customerUuid: string, document: InsertDocument): Promise<Document> {
    const result = await db
      .insert(documents)
      .values({
        ...document,
        customerUuid,
      })
      .returning();
    return (result as Document[])[0];
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
      .where(eq(exportQueue.status, ProcessingStatus.PENDING as any))
      .orderBy(desc(exportQueue.priority), exportQueue.scheduledFor);
  }

  async getExportQueueItem(id: string): Promise<any> {
    const [item] = await db
      .select()
      .from(exportQueue)
      .where(eq(exportQueue.id, id));
    return item;
  }

  async updateExportQueueStatus(id: string, status: string): Promise<void> {
    await db
      .update(exportQueue)
      .set({
        status: status as any,
        completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined
      })
      .where(eq(exportQueue.id, id));
  }

  async deleteExportQueueByDocumentId(documentId: string): Promise<void> {
    await db
      .delete(exportQueue)
      .where(eq(exportQueue.documentId, documentId));
  }

  async deleteExportQueueItem(exportId: string): Promise<void> {
    await db
      .delete(exportQueue)
      .where(eq(exportQueue.id, exportId));
  }

  async incrementExportAttempts(exportId: string, attempts: number): Promise<void> {
    await db
      .update(exportQueue)
      .set({ 
        attempts,
        status: 'pending' as any // Reset to pending for retry
      })
      .where(eq(exportQueue.id, exportId));
  }

  async rescheduleExport(exportId: string, scheduleTime: Date): Promise<void> {
    await db
      .update(exportQueue)
      .set({ 
        scheduledFor: scheduleTime,
        startedAt: null // Clear previous start time
      })
      .where(eq(exportQueue.id, exportId));
  }

  // Dead Letter Queue methods
  async moveToDeadLetterQueue(
    exportId: string,
    customerUuid: string,
    sessionUserId: string | null,
    finalError: Error,
    requestId?: string,
    userAgent?: string
  ): Promise<void> {
    const exportItem = await this.getExportQueueItem(exportId);
    if (!exportItem) {
      throw new Error(`Export item not found: ${exportId}`);
    }

    const document = await this.getDocument(exportItem.documentId);
    if (!document) {
      throw new Error(`Document not found: ${exportItem.documentId}`);
    }

    // Create dead letter queue entry with comprehensive debugging info
    await db.insert(deadLetterQueue).values({
      originalExportId: exportId,
      documentId: exportItem.documentId,
      customerUuid,
      sessionUserId,
      exportType: exportItem.exportType,
      priority: exportItem.priority,
      finalAttempts: exportItem.attempts,
      maxAttempts: exportItem.maxAttempts,
      finalErrorMessage: finalError.message,
      finalErrorStack: finalError.stack || '',
      originalScheduledFor: exportItem.scheduledFor,
      firstAttemptAt: exportItem.startedAt,
      // Document debugging context
      documentFileName: document.fileName,
      documentFileSize: document.fileSize,
      documentMimeType: document.mimeType,
      documentStatus: document.status,
      // System debugging context
      serverVersion: process.env.npm_package_version || '1.0.0',
      nodeEnv: process.env.NODE_ENV || 'unknown',
      requestId,
      userAgent,
    });

    // Remove from export queue
    await this.deleteExportQueueItem(exportId);
  }

  async getDeadLetterQueueItems(): Promise<DeadLetterQueue[]> {
    return await db
      .select()
      .from(deadLetterQueue)
      .orderBy(desc(deadLetterQueue.finalFailureAt));
  }

  async getDeadLetterQueueItem(id: string): Promise<DeadLetterQueue | null> {
    const result = await db
      .select()
      .from(deadLetterQueue)
      .where(eq(deadLetterQueue.id, id))
      .limit(1);
    
    return (result as DeadLetterQueue[]).length > 0 ? result[0] : null;
  }

  async deleteDeadLetterQueueItem(id: string): Promise<void> {
    await db
      .delete(deadLetterQueue)
      .where(eq(deadLetterQueue.id, id));
  }

  async getPendingExports(): Promise<any[]> {
    return await db
      .select()
      .from(exportQueue)
      .where(eq(exportQueue.status, ProcessingStatus.PENDING as any))
      .orderBy(desc(exportQueue.priority), exportQueue.scheduledFor);
  }





  // Direct query methods for document relationships
  async getDocumentRelationships(documentId: string): Promise<any> {
    console.log(`[DocumentRelationships] Getting relationships for document: ${documentId}`);
    
    // Get the document with parent info
    const result = await db.execute(sql`
      SELECT 
        d.id,
        d.customer_uuid,
        d.file_name,
        d.asset_type,
        d.parent_document_id,
        CASE WHEN d.parent_document_id IS NULL THEN 0 ELSE 1 END as depth,
        (SELECT count(*) FROM ${documents} children WHERE children.parent_document_id = d.id) as child_count,
        (SELECT count(*) FROM ${questions} WHERE ${questions.documentId} = d.id) as question_count,
        (SELECT count(*) FROM ${gradeSubmissions} WHERE ${gradeSubmissions.originalDocumentId} = d.id) as submission_count,
        parent.file_name as parent_file_name,
        parent.asset_type as parent_asset_type
      FROM ${documents} d
      LEFT JOIN ${documents} parent ON d.parent_document_id = parent.id
      WHERE d.id = ${documentId}
      LIMIT 1
    `);
    
    console.log(`[DocumentRelationships] Found ${result.rows.length} relationship records`);
    return result.rows[0] || null;
  }

  async getDocumentLineage(documentId: string): Promise<any[]> {
    // Build lineage by traversing up the parent chain
    const lineage = [];
    let currentDocumentId = documentId;
    let depth = 0;
    
    // First collect all document IDs in the chain
    const documentIds = [];
    while (currentDocumentId && depth < 10) { // Safety limit
      const doc = await this.getDocument(currentDocumentId);
      if (!doc) break;
      
      documentIds.unshift(currentDocumentId); // Add to beginning for proper order
      currentDocumentId = doc.parentDocumentId;
      depth++;
    }
    
    // Now get all documents except the target
    const filteredIds = documentIds.filter(id => id !== documentId);
    
    if (filteredIds.length === 0) {
      return [];
    }
    
    // Get documents in proper order
    const documentsData = [];
    for (let i = 0; i < filteredIds.length; i++) {
      const doc = await this.getDocument(filteredIds[i]);
      if (doc) {
        documentsData.push({
          id: doc.id,
          file_name: doc.fileName,
          asset_type: doc.assetType,
          depth: doc.parentDocumentId ? 1 : 0
        });
      }
    }
    
    return documentsData;
  }

  async getDocumentChildren(documentId: string): Promise<any[]> {
    console.log(`[DocumentRelationships] Getting children for document: ${documentId}`);
    const result = await db.execute(sql`
      SELECT 
        id,
        file_name,
        asset_type,
        created_at
      FROM ${documents}
      WHERE parent_document_id = ${documentId}
      ORDER BY created_at ASC
    `);
    
    console.log(`[DocumentRelationships] Found ${result.rows.length} child documents`);
    return result.rows;
  }

  async refreshDocumentRelationships(): Promise<void> {
    // No longer needed - direct queries don't require refresh
    console.log(`[DocumentRelationships] Refresh not needed for direct queries`);
  }

  async getQuestionResultsByDocumentId(documentId: string): Promise<any[]> {
    return await db
      .select({
        id: questionResults.id,
        questionId: questionResults.questionId,
        consensusStandards: questionResults.consensusStandards,
        consensusRigorLevel: questionResults.consensusRigorLevel,
        standardsVotes: questionResults.standardsVotes,
        rigorVotes: questionResults.rigorVotes,
        confidenceScore: questionResults.confidenceScore,
        aiAgreementLevel: questionResults.aiAgreementLevel,
        processingNotes: questionResults.processingNotes,
        createdAt: questionResults.createdAt,
        questionNumber: questions.questionNumber,
        questionText: questions.questionText
      })
      .from(questionResults)
      .innerJoin(questions, eq(questionResults.questionId, questions.id))
      .where(eq(questions.documentId, documentId))
      .orderBy(sql`CAST(${questions.questionNumber} AS INTEGER)`);
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
      .orderBy(sql`CAST(${questions.questionNumber} AS INTEGER)`);
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

  async getDocumentResults(documentId: string, customerUuid: string): Promise<Array<Question & { result?: QuestionResult; aiResponses: AiResponse[]; teacherOverride?: TeacherOverride; confirmedData?: any }>> {
    // NEW ARCHITECTURE: Check for CONFIRMED analysis first
    const confirmedAnalysis = await this.getConfirmedAnalysis(documentId);
    let confirmedQuestionsMap = new Map<string, any>();
    
    if (confirmedAnalysis) {
      console.log(`[getDocumentResults] Using CONFIRMED analysis for document: ${documentId}`);
      const analysisData = confirmedAnalysis.analysisData as any;
      if (analysisData.questions) {
        for (let i = 0; i < Math.min(3, analysisData.questions.length); i++) {
          const q = analysisData.questions[i];
        }
        for (const q of analysisData.questions) {
          confirmedQuestionsMap.set(q.questionId, q);
        }
      }
    } else {
      console.log(`[getDocumentResults] No CONFIRMED analysis found, using original AI analysis for document: ${documentId}`);
    }

    const questionsData = await db
      .select()
      .from(questions)
      .where(eq(questions.documentId, documentId))
      .orderBy(sql`CAST(${questions.questionNumber} AS INTEGER)`);

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
        
      }
      
      // Debug logging for specific question
      if (question.id === '98a5b027-17d4-42f0-9b04-94c0d21a0abc') {
        console.log(`Question ${question.id}: found ${teacherOverride ? 'active' : 'no active'} override`);
        if (teacherOverride) {
          console.log(`Override details: id=${teacherOverride.id}, isActive=${teacherOverride.isActive}, isRevertedToAi=${teacherOverride.isRevertedToAi}`);
        }
      }

      // Include CONFIRMED analysis data if available for this question
      const confirmedData = confirmedQuestionsMap.get(question.id);
      
      results.push({
        ...question,
        result,
        aiResponses: aiResponsesData,
        teacherOverride,
        confirmedData, // Add CONFIRMED analysis data
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

  // ==================== CONFIRMED ANALYSIS OPERATIONS ====================
  
  /**
   * Create a CONFIRMED analysis document - single source of truth for generated documents
   */
  async createConfirmedAnalysis(customerUuid: string, analysis: InsertConfirmedAnalysis): Promise<ConfirmedAnalysis> {
    console.log(`[DatabaseStorage] Creating confirmed analysis for document: ${analysis.documentId}`);
    
    const [confirmedAnalysisDoc] = await db
      .insert(confirmedAnalysis)
      .values({
        ...analysis,
        customerUuid,
      })
      .returning();
    
    console.log(`[DatabaseStorage] Confirmed analysis created: ${confirmedAnalysisDoc.id}`);
    return confirmedAnalysisDoc;
  }

  /**
   * Get CONFIRMED analysis document for a document
   */
  async getConfirmedAnalysis(documentId: string): Promise<ConfirmedAnalysis | undefined> {
    const [analysis] = await db
      .select()
      .from(confirmedAnalysis)
      .where(eq(confirmedAnalysis.documentId, documentId))
      .orderBy(desc(confirmedAnalysis.confirmedAt))
      .limit(1);
    
    return analysis;
  }

  /**
   * Update CONFIRMED analysis document
   */
  async updateConfirmedAnalysis(documentId: string, updates: Partial<InsertConfirmedAnalysis>): Promise<void> {
    await db
      .update(confirmedAnalysis)
      .set(updates)
      .where(eq(confirmedAnalysis.documentId, documentId));
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
        eq(documents.assetType, AssetType.GENERATED as any)
      ))
      .orderBy(documents.createdAt);
  }

  async getGeneratedDocumentsByParentAndType(parentDocumentId: string, exportType: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(and(
        eq(documents.parentDocumentId, parentDocumentId),
        eq(documents.assetType, AssetType.GENERATED as any),
        eq(documents.exportType, exportType as any)
      ))
      .orderBy(documents.createdAt);
  }

  async deleteExportQueueByDocumentAndType(documentId: string, exportType: string): Promise<void> {
    await db
      .delete(exportQueue)
      .where(and(
        eq(exportQueue.documentId, documentId),
        eq(exportQueue.exportType, exportType as any)
      ));
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

  // Generated document cleanup operations
  async deleteGeneratedDocumentsForSource(sourceDocumentId: string): Promise<void> {
    console.log(`[Storage] Cleaning up generated documents for source document: ${sourceDocumentId}`);
    
    // Find all generated documents that were created from this source document
    const generatedDocs = await db
      .select()
      .from(documents)
      .where(and(
        eq(documents.parentDocumentId, sourceDocumentId),
        eq(documents.assetType, 'generated')
      ));
    
    console.log(`[Storage] Found ${generatedDocs.length} generated documents to delete`);
    
    // Delete the physical files and database records
    for (const doc of generatedDocs) {
      try {
        // Delete physical file
        const fs = await import('fs');
        const path = await import('path');
        const { config } = await import('./config/environment');
        const filePath = path.join(config.uploadsDir, doc.fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`[Storage] Deleted physical file: ${doc.fileName}`);
        }
      } catch (error) {
        console.warn(`[Storage] Failed to delete physical file ${doc.fileName}:`, error);
      }
    }
    
    // Delete database records
    if (generatedDocs.length > 0) {
      const docIds = generatedDocs.map(doc => doc.id);
      await db
        .delete(documents)
        .where(inArray(documents.id, docIds));
      console.log(`[Storage] Deleted ${generatedDocs.length} generated document records from database`);
    }
  }

  async clearExportQueueForDocument(documentId: string): Promise<void> {
    console.log(`[Storage] Clearing export queue for document: ${documentId}`);
    
    // Delete all pending and failed export queue items for this document
    const deletedItems = await db
      .delete(exportQueue)
      .where(eq(exportQueue.documentId, documentId))
      .returning();
    
    console.log(`[Storage] Cleared ${deletedItems.length} export queue items for document: ${documentId}`);
  }

  /**
   * Update document teacher review status
   */
  async updateDocumentTeacherReviewStatus(
    documentId: string,
    status: TeacherReviewStatus
  ): Promise<void> {
    await db
      .update(documents)
      .set({ teacherReviewStatus: status })
      .where(eq(documents.id, documentId));
  }

  /**
   * Add document export to queue
   */
  async addToExportQueue(documentId: string, exportType: string): Promise<void> {
    await db.insert(exportQueue).values({
      documentId,
      exportType: exportType as any,
      priority: 0,
      status: BusinessDefaults.INITIAL_PROCESSING_STATUS
    });
  }

  // ==================== CASCADE DELETE METHODS ====================
  
  /**
   * Get all questions for a document
   */
  async getQuestionsByDocumentId(documentId: string): Promise<any[]> {
    return await db
      .select()
      .from(questions)
      .where(eq(questions.documentId, documentId))
      .orderBy(sql`CAST(${questions.questionNumber} AS INTEGER)`);
  }

  /**
   * Delete all questions for a document
   */
  async deleteQuestionsByDocumentId(documentId: string): Promise<void> {
    await db
      .delete(questions)
      .where(eq(questions.documentId, documentId));
  }

  /**
   * Delete question results by question ID
   */
  async deleteQuestionResultsByQuestionId(questionId: string): Promise<void> {
    await db
      .delete(questionResults)
      .where(eq(questionResults.questionId, questionId));
  }

  /**
   * Delete AI responses by question ID
   */
  async deleteAiResponsesByQuestionId(questionId: string): Promise<void> {
    await db
      .delete(aiResponses)
      .where(eq(aiResponses.questionId, questionId));
  }

  /**
   * Delete teacher overrides by question ID
   */
  async deleteTeacherOverridesByQuestionId(questionId: string): Promise<void> {
    await db
      .delete(teacherOverrides)
      .where(eq(teacherOverrides.questionId, questionId));
  }

  /**
   * Get all child documents (generated from a source document)
   */
  async getChildDocuments(parentDocumentId: string): Promise<any[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.parentDocumentId, parentDocumentId));
  }

  /**
   * Delete CONFIRMED analysis records by document ID (CRITICAL for document deletion)
   */
  async deleteConfirmedAnalysisByDocumentId(documentId: string): Promise<void> {
    console.log(`[Storage] Deleting CONFIRMED analysis records for document: ${documentId}`);
    
    // Import the confirmedAnalysis table from schema
    const { confirmedAnalysis } = await import('../shared/schema');
    
    // Delete all CONFIRMED analysis records for this document
    const deletedRecords = await db
      .delete(confirmedAnalysis)
      .where(eq(confirmedAnalysis.documentId, documentId))
      .returning();
    
    console.log(`[Storage] Deleted ${deletedRecords.length} CONFIRMED analysis records for document: ${documentId}`);
  }

  // Common Standards Project cache methods
  async getCachedJurisdictions() {
    return await db.select().from(cachedJurisdictions);
  }

  async cacheJurisdictions(jurisdictions: any[]) {
    // Clear existing cache
    await db.delete(cachedJurisdictions);
    
    // Insert fresh data
    for (const jurisdiction of jurisdictions) {
      await db.insert(cachedJurisdictions).values({
        id: jurisdiction.id,
        title: jurisdiction.title,
        type: jurisdiction.type,
        data: jurisdiction
      }).onConflictDoUpdate({
        target: cachedJurisdictions.id,
        set: {
          title: jurisdiction.title,
          type: jurisdiction.type,
          data: jurisdiction,
          updatedAt: new Date()
        }
      });
    }
  }

  async getCachedStandardSetsForJurisdiction(jurisdictionId: string) {
    return await db.select().from(cachedStandardSets).where(eq(cachedStandardSets.jurisdictionId, jurisdictionId));
  }

  async cacheStandardSetsForJurisdiction(jurisdictionId: string, standardSets: any[]) {
    // Clear existing cache for this jurisdiction
    await db.delete(cachedStandardSets).where(eq(cachedStandardSets.jurisdictionId, jurisdictionId));
    
    // Insert fresh data
    for (const standardSet of standardSets) {
      await db.insert(cachedStandardSets).values({
        id: standardSet.id,
        jurisdictionId,
        title: standardSet.title,
        subject: standardSet.subject,
        educationLevels: standardSet.educationLevels,
        data: standardSet
      }).onConflictDoUpdate({
        target: cachedStandardSets.id,
        set: {
          title: standardSet.title,
          subject: standardSet.subject,
          educationLevels: standardSet.educationLevels,
          data: standardSet,
          updatedAt: new Date()
        }
      });
    }
  }

  async getCachedStandardsForSet(standardSetId: string) {
    const result = await db.select().from(cachedStandards).where(eq(cachedStandards.standardSetId, standardSetId)).limit(1);
    return result[0] || null;
  }

  async cacheStandardsForSet(standardSetId: string, standardsData: any) {
    await db.insert(cachedStandards).values({
      standardSetId,
      standardsData
    }).onConflictDoUpdate({
      target: cachedStandards.standardSetId,
      set: {
        standardsData,
        updatedAt: new Date()
      }
    });
  }
  async updateDocument(documentId: string, updates: Partial<any>) {
    return await db
      .update(documents)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));
  }

  async bulkCreateQuestions(questionsData: InsertQuestion[]) {
    if (questionsData.length === 0) return [];
    
    return await db
      .insert(questions)
      .values(questionsData)
      .returning();
  }

  async bulkCreateAiResponses(aiResponsesData: InsertAiResponse[]) {
    if (aiResponsesData.length === 0) return [];
    
    return await db
      .insert(aiResponses)
      .values(aiResponsesData)
      .returning();
  }

  async updateAssessment(assessmentId: string, updates: Partial<any>) {
    return await db
      .update(documents)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, assessmentId));
  }

  async getAssessment(assessmentId: string) {
    const result = await db
      .select()
      .from(documents)
      .where(eq(documents.id, assessmentId))
      .limit(1);
    
    return result[0] || null;
  }

  async createAssessmentItem(item: any) {
    const result = await db
      .insert(questions)
      .values({
        documentId: item.assessmentId,
        questionNumber: item.questionNumber || 1,
        questionText: item.instructionText || "",
        context: item.context || "",
      })
      .returning();
    
    return result[0];
  }

  async bulkCreateAssessmentItems(items: any[]) {
    if (items.length === 0) return [];
    
    const questionsData = items.map(item => ({
      documentId: item.assessmentId,
      questionNumber: item.questionNumber || 1,
      questionText: item.instructionText || "",
      context: item.context || "",
    }));
    
    return await db
      .insert(questions)
      .values(questionsData)
      .returning();
  }

  async getAssessmentItems(assessmentId: string) {
    return await db
      .select()
      .from(questions)
      .where(eq(questions.documentId, assessmentId))
      .orderBy(asc(questions.questionNumber));
  }

  async getEffectiveRigorPolicy(userId: string, districtId?: string, schoolId?: string) {
    return {
      dok1Range: { min: 0, max: 25 },
      dok2Range: { min: 25, max: 50 },
      dok3Range: { min: 25, max: 50 },
      dok4Range: { min: 0, max: 25 },
    };
  }
}

export const storage = new DatabaseStorage();
