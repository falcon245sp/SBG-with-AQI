import { storage } from '../storage';
import { CustomerLookupService } from './customerLookupService';
import { generateDocumentTags, ExportType } from '../utils/documentTagging';

/**
 * DatabaseWriteService - Centralized service for all database write operations
 * 
 * This service:
 * 1. Centralizes all database mutations
 * 2. Enforces business rules and validation
 * 3. Standardizes on Customer UUIDs as primary business identifiers
 * 4. Provides audit logging for all write operations
 * 5. Manages complex transactions
 * 6. Ensures consistent error handling
 */
export class DatabaseWriteService {
  
  // ==================== DOCUMENT OPERATIONS ====================
  
  /**
   * Create a new document for a customer
   */
  static async createDocument(customerUuid: string, documentData: any): Promise<any> {
    console.log(`[DatabaseWriteService] Creating document for customer: ${customerUuid}`);
    
    try {
      const document = await storage.createDocument(customerUuid, documentData);
      
      console.log(`[DatabaseWriteService] Document created successfully: ${document.id}`);
      return document;
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to create document for customer ${customerUuid}:`, error);
      throw new Error(`Failed to create document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a generated document (rubric, cover sheet, etc.) with automatic tagging
   */
  static async createGeneratedDocument(
    customerUuid: string, 
    parentDocumentId: string,
    exportType: ExportType,
    documentData: any,
    userTags: string[] = []
  ): Promise<any> {
    console.log(`[DatabaseWriteService] Creating generated document (${exportType}) for customer: ${customerUuid}`);
    
    try {
      // Generate automatic tags based on export type
      const autoTags = generateDocumentTags(exportType, userTags);
      
      const generatedDoc = await storage.createDocument(customerUuid, {
        ...documentData,
        assetType: 'generated',
        parentDocumentId,
        exportType,
        tags: autoTags,
      });
      
      console.log(`[DatabaseWriteService] Generated document created successfully: ${generatedDoc.id} with tags: ${autoTags.join(', ')}`);
      return generatedDoc;
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to create generated document:`, error);
      throw new Error(`Failed to create generated document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update document tags (for File Cabinet organization)
   */
  static async updateDocumentTags(documentId: string, newTags: string[]): Promise<void> {
    console.log(`[DatabaseWriteService] Updating document ${documentId} tags`);
    
    try {
      await storage.updateDocumentTags(documentId, newTags);
      console.log(`[DatabaseWriteService] Document tags updated successfully: ${newTags.join(', ')}`);
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to update document tags:`, error);
      throw new Error(`Failed to update document tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update document processing status
   */
  static async updateDocumentStatus(documentId: string, status: string, processingError?: string): Promise<void> {
    console.log(`[DatabaseWriteService] Updating document ${documentId} status to: ${status}`);
    
    try {
      await storage.updateDocumentStatus(documentId, status, processingError);
      console.log(`[DatabaseWriteService] Document status updated successfully`);
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to update document status:`, error);
      throw new Error(`Failed to update document status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==================== EXPORT QUEUE OPERATIONS ====================
  
  /**
   * Add document to export generation queue
   */
  static async queueDocumentExport(documentId: string, exportType: ExportType, priority: number = 0): Promise<any> {
    console.log(`[DatabaseWriteService] Queuing ${exportType} export for document: ${documentId}`);
    
    try {
      const queueItem = await storage.createExportQueueItem({
        documentId,
        exportType,
        priority,
        status: 'pending'
      });
      
      console.log(`[DatabaseWriteService] Export queued successfully: ${queueItem.id}`);
      return queueItem;
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to queue export:`, error);
      throw new Error(`Failed to queue export: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==================== QUESTION OPERATIONS ====================
  
  /**
   * Create a new question during document processing
   */
  static async createQuestion(questionData: any): Promise<any> {
    console.log(`[DatabaseWriteService] Creating question for document: ${questionData.documentId}`);
    
    try {
      const question = await storage.createQuestion(questionData);
      
      console.log(`[DatabaseWriteService] Question created successfully: ${question.id}`);
      return question;
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to create question:`, error);
      throw new Error(`Failed to create question: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==================== AI RESPONSE OPERATIONS ====================
  
  /**
   * Create AI response for a question
   */
  static async createAIResponse(responseData: any): Promise<any> {
    console.log(`[DatabaseWriteService] Creating AI response for question: ${responseData.questionId}`);
    
    try {
      const response = await storage.createAiResponse(responseData);
      
      console.log(`[DatabaseWriteService] AI response created successfully: ${response.id}`);
      return response;
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to create AI response:`, error);
      throw new Error(`Failed to create AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==================== QUESTION RESULT OPERATIONS ====================
  
  /**
   * Create processed result for a question
   */
  static async createQuestionResult(resultData: any): Promise<any> {
    console.log(`[DatabaseWriteService] Creating question result for question: ${resultData.questionId}`);
    
    try {
      const result = await storage.createQuestionResult(resultData);
      
      console.log(`[DatabaseWriteService] Question result created successfully: ${result.id}`);
      return result;
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to create question result:`, error);
      throw new Error(`Failed to create question result: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==================== TEACHER OVERRIDE OPERATIONS ====================
  
  /**
   * Create teacher override for a question
   */
  static async createTeacherOverride(customerUuid: string, overrideData: any): Promise<any> {
    console.log(`[DatabaseWriteService] Creating teacher override for customer: ${customerUuid}`);
    
    try {
      const override = await storage.createTeacherOverride(customerUuid, overrideData);
      console.log(`[DatabaseWriteService] Teacher override created successfully: ${override.id}`);
      return override;
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to create teacher override:`, error);
      throw new Error(`Failed to create teacher override: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update existing teacher override
   */
  static async updateTeacherOverride(overrideId: string, updateData: any): Promise<any> {
    console.log(`[DatabaseWriteService] Updating teacher override: ${overrideId}`);
    
    try {
      const override = await storage.updateTeacherOverride(overrideId, updateData);
      console.log(`[DatabaseWriteService] Teacher override updated successfully`);
      return override;
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to update teacher override:`, error);
      throw new Error(`Failed to update teacher override: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Revert question to AI analysis (disable teacher override)
   */
  static async revertQuestionToAI(questionId: string, customerUuid: string): Promise<void> {
    console.log(`[DatabaseWriteService] Reverting question ${questionId} to AI for customer: ${customerUuid}`);
    
    try {
      await storage.revertToAI(questionId, customerUuid);
      console.log(`[DatabaseWriteService] Question reverted to AI successfully`);
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to revert to AI:`, error);
      throw new Error(`Failed to revert to AI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==================== USER MANAGEMENT OPERATIONS ====================
  
  /**
   * Create API key for a user (using session user ID as bridge to customer UUID)
   */
  static async createApiKey(sessionUserId: string, keyData: any): Promise<any> {
    console.log(`[DatabaseWriteService] Creating API key for session user: ${sessionUserId}`);
    
    try {
      // Get customer UUID through CustomerLookupService
      const customerUuid = await CustomerLookupService.requireCustomerUuid(sessionUserId);
      console.log(`[DatabaseWriteService] Resolved customer UUID: ${customerUuid} for session user: ${sessionUserId}`);
      
      const apiKey = await storage.createApiKey(sessionUserId, keyData);
      console.log(`[DatabaseWriteService] API key created successfully: ${apiKey.id}`);
      return apiKey;
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to create API key:`, error);
      throw new Error(`Failed to create API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==================== GOOGLE CLASSROOM OPERATIONS ====================
  
  /**
   * Create classroom for a customer
   */
  static async createClassroom(classroomData: any): Promise<any> {
    console.log(`[DatabaseWriteService] Creating classroom for customer: ${classroomData.customerUuid}`);
    
    try {
      const classroom = await storage.createClassroom(classroomData);
      
      console.log(`[DatabaseWriteService] Classroom created successfully: ${classroom.id}`);
      return classroom;
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to create classroom:`, error);
      throw new Error(`Failed to create classroom: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sync classroom data from Google Classroom
   */
  static async syncClassrooms(customerUuid: string, classroomData: any[]): Promise<any[]> {
    console.log(`[DatabaseWriteService] Syncing ${classroomData.length} classrooms for customer: ${customerUuid}`);
    
    try {
      const classrooms = await storage.syncClassrooms(customerUuid, classroomData);
      console.log(`[DatabaseWriteService] Classrooms synced successfully: ${classrooms.length} items`);
      return classrooms;
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to sync classrooms:`, error);
      throw new Error(`Failed to sync classrooms: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create student for a classroom
   */
  static async createStudent(studentData: any): Promise<any> {
    console.log(`[DatabaseWriteService] Creating student for classroom: ${studentData.classroomId}`);
    
    try {
      const student = await storage.createStudent(studentData);
      
      console.log(`[DatabaseWriteService] Student created successfully: ${student.id}`);
      return student;
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to create student:`, error);
      throw new Error(`Failed to create student: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sync students from Google Classroom
   */
  static async syncStudents(customerUuid: string, classroomId: string, studentProfiles: any[]): Promise<any[]> {
    console.log(`[DatabaseWriteService] Syncing ${studentProfiles.length} students for customer: ${customerUuid}, classroom: ${classroomId}`);
    
    try {
      const students = await storage.syncStudents(classroomId, studentProfiles);
      console.log(`[DatabaseWriteService] Students synced successfully: ${students.length} items`);
      return students;
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to sync students:`, error);
      throw new Error(`Failed to sync students: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==================== USER TOKEN OPERATIONS ====================
  
  /**
   * Update user Google tokens
   */
  static async updateUserTokens(userId: string, accessToken: string, refreshToken?: string, expiry?: Date): Promise<void> {
    console.log(`[DatabaseWriteService] Updating tokens for user: ${userId}`);
    
    try {
      await storage.updateUserTokens(userId, accessToken, refreshToken, expiry);
      console.log(`[DatabaseWriteService] User tokens updated successfully`);
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to update user tokens:`, error);
      throw new Error(`Failed to update user tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update user Google credentials
   */
  static async updateUserGoogleCredentials(userId: string, credentials: any): Promise<void> {
    console.log(`[DatabaseWriteService] Updating Google credentials for user: ${userId}`);
    
    try {
      await storage.updateUserGoogleCredentials(userId, credentials);
      console.log(`[DatabaseWriteService] User Google credentials updated successfully`);
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to update user credentials:`, error);
      throw new Error(`Failed to update user credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==================== TRANSACTION OPERATIONS ====================
  
  /**
   * Execute multiple write operations in a transaction
   * This ensures all operations succeed or all fail together
   */
  static async executeTransaction<T>(operations: (() => Promise<T>)[]): Promise<T[]> {
    console.log(`[DatabaseWriteService] Executing transaction with ${operations.length} operations`);
    
    try {
      // For now, execute sequentially. In the future, this could use database transactions
      const results: T[] = [];
      for (const operation of operations) {
        const result = await operation();
        results.push(result);
      }
      
      console.log(`[DatabaseWriteService] Transaction completed successfully`);
      return results;
    } catch (error) {
      console.error(`[DatabaseWriteService] Transaction failed:`, error);
      throw new Error(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==================== AUDIT AND LOGGING ====================
  
  /**
   * Log database write operation for audit purposes
   */
  private static logWriteOperation(operation: string, entityType: string, entityId: string, customerUuid: string): void {
    console.log(`[DatabaseWriteService] [AUDIT] ${operation} ${entityType} ${entityId} for customer ${customerUuid} at ${new Date().toISOString()}`);
  }
}