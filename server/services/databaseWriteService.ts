import { storage } from '../storage';
import { CustomerLookupService } from './customerLookupService';
import { generateDocumentTags, ExportType as DocumentTaggingExportType } from '../utils/documentTagging';
import { ProcessingStatus, TeacherReviewStatus, AssetType, ExportType as BusinessExportType, AiEngine, RigorLevel, GradeSubmissionStatus, BusinessDefaults } from '../../shared/businessEnums';

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
   * Implements overwrite logic: deletes existing generated documents of the same type for the same parent
   */
  static async createGeneratedDocument(
    customerUuid: string, 
    parentDocumentId: string,
    exportType: DocumentTaggingExportType,
    documentData: any,
    userTags: string[] = []
  ): Promise<any> {
    console.log(`[DatabaseWriteService] Creating generated document (${exportType}) for customer: ${customerUuid}`);
    
    try {
      // OVERWRITE LOGIC: Delete existing generated documents of the same type for this parent
      const existingDocs = await storage.getGeneratedDocumentsByParentAndType(parentDocumentId, exportType as any);
      
      if (existingDocs.length > 0) {
        console.log(`[DatabaseWriteService] Found ${existingDocs.length} existing ${exportType} documents for parent ${parentDocumentId}, deleting them`);
        
        for (const existingDoc of existingDocs) {
          try {
            // Delete the physical file if it exists
            if (existingDoc.originalPath) {
              const fs = await import('fs');
              const path = await import('path');
              const fullPath = path.join(process.cwd(), 'uploads', existingDoc.originalPath);
              if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
                console.log(`[DatabaseWriteService] Deleted physical file: ${existingDoc.originalPath}`);
              }
            }
            
            // Delete the database record
            await storage.deleteDocument(existingDoc.id);
            console.log(`[DatabaseWriteService] Deleted existing document: ${existingDoc.id}`);
          } catch (deleteError) {
            console.warn(`[DatabaseWriteService] Failed to delete existing document ${existingDoc.id}:`, deleteError);
            // Continue with creation even if cleanup fails
          }
        }
        
        // Also clean up any pending export queue items for this document/type combination
        await storage.deleteExportQueueByDocumentAndType(parentDocumentId, exportType);
        console.log(`[DatabaseWriteService] Cleaned up export queue for ${exportType} documents of parent ${parentDocumentId}`);
      }
      
      // Generate automatic tags based on export type
      const autoTags = generateDocumentTags(exportType, userTags);
      
      const generatedDoc = await storage.createDocument(customerUuid, {
        ...documentData,
        assetType: AssetType.GENERATED,
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
   * Update document status (for resubmission tracking)
   */
  static async updateDocumentStatus(documentId: string, status: string, errorMessage?: string): Promise<void> {
    console.log(`[DatabaseWriteService] Updating document ${documentId} status to: ${status}`);
    
    try {
      await storage.updateDocumentStatus(documentId, status, errorMessage);
      console.log(`[DatabaseWriteService] Document status updated successfully`);
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to update document status:`, error);
      throw new Error(`Failed to update document status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get document deletion impact - what will be deleted with this document
   */
  static async getDocumentDeletionImpact(documentId: string): Promise<{
    document: any;
    isSourceDocument: boolean;
    childDocuments: any[];
    totalDocumentsToDelete: number;
    impactSummary: string;
  }> {
    console.log(`[DatabaseWriteService] Analyzing deletion impact for document: ${documentId}`);
    
    try {
      // Get the target document
      const document = await storage.getDocument(documentId);
      if (!document) {
        throw new Error('Document not found');
      }
      
      const isSourceDocument = document.assetType === 'uploaded';
      let childDocuments: any[] = [];
      
      if (isSourceDocument) {
        // If this is a source document, find all generated documents that depend on it
        childDocuments = await storage.getChildDocuments(documentId);
      }
      
      const totalDocumentsToDelete = 1 + childDocuments.length;
      
      // Create impact summary
      let impactSummary = `This will delete "${document.fileName}"`;
      if (childDocuments.length > 0) {
        const childTypes = childDocuments.map(doc => {
          if (doc.exportType === 'rubric_pdf') return 'rubric';
          if (doc.exportType === 'cover_sheet') return 'cover sheet';
          return doc.exportType || 'generated document';
        });
        const uniqueTypes = Array.from(new Set(childTypes));
        impactSummary += ` and ${childDocuments.length} generated document${childDocuments.length > 1 ? 's' : ''} (${uniqueTypes.join(', ')})`;
      }
      impactSummary += '.';
      
      return {
        document,
        isSourceDocument,
        childDocuments,
        totalDocumentsToDelete,
        impactSummary
      };
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to analyze deletion impact:`, error);
      throw new Error(`Failed to analyze deletion impact: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete document and all related data (with cardinality awareness)
   */
  static async deleteDocument(documentId: string): Promise<void> {
    console.log(`[DatabaseWriteService] Deleting document: ${documentId}`);
    
    try {
      // Get the document and check if it's a source document with children
      const document = await storage.getDocument(documentId);
      if (!document) {
        throw new Error('Document not found');
      }
      
      const isSourceDocument = document.assetType === 'uploaded';
      let documentsToDelete = [documentId];
      
      if (isSourceDocument) {
        // Get all child documents (generated from this source)
        const childDocuments = await storage.getChildDocuments(documentId);
        console.log(`[DatabaseWriteService] Source document has ${childDocuments.length} generated children`);
        
        // Add child document IDs to deletion list
        documentsToDelete = [...documentsToDelete, ...childDocuments.map(child => child.id)];
      }
      
      console.log(`[DatabaseWriteService] Will delete ${documentsToDelete.length} total documents`);
      
      // Delete each document and its related data
      for (const docId of documentsToDelete) {
        await this.deleteSingleDocumentAndData(docId);
      }
      
      console.log(`[DatabaseWriteService] Successfully deleted ${documentsToDelete.length} documents`);
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to delete document:`, error);
      throw new Error(`Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a single document and all its related data (questions, responses, etc.)
   */
  private static async deleteSingleDocumentAndData(documentId: string): Promise<void> {
    console.log(`[DatabaseWriteService] Deleting single document and data: ${documentId}`);
    
    try {
      // 1. Clean up export queue entries for this document
      console.log(`[DatabaseWriteService] Cleaning up export queue for document: ${documentId}`);
      await storage.deleteExportQueueByDocumentId(documentId);
      
      // 2. Delete all question-related data for this document
      console.log(`[DatabaseWriteService] Cleaning up question-related data for document: ${documentId}`);
      
      // Get all questions for this document
      const questions = await storage.getQuestionsByDocumentId(documentId);
      console.log(`[DatabaseWriteService] Found ${questions.length} questions to clean up`);
      
      // Delete question results and AI responses for each question
      for (const question of questions) {
        console.log(`[DatabaseWriteService] Deleting data for question: ${question.id}`);
        
        // Delete question results
        await storage.deleteQuestionResultsByQuestionId(question.id);
        
        // Delete AI responses
        await storage.deleteAiResponsesByQuestionId(question.id);
        
        // Delete teacher overrides
        await storage.deleteTeacherOverridesByQuestionId(question.id);
      }
      
      // 3. Delete all questions for this document
      console.log(`[DatabaseWriteService] Deleting questions for document: ${documentId}`);
      await storage.deleteQuestionsByDocumentId(documentId);
      
      // 4. Finally, delete the document record
      await storage.deleteDocument(documentId);
      console.log(`[DatabaseWriteService] Document deleted successfully: ${documentId}`);
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to delete single document:`, error);
      throw new Error(`Failed to delete single document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }



  // ==================== EXPORT QUEUE OPERATIONS ====================
  
  /**
   * Add document to export generation queue
   */
  static async queueDocumentExport(documentId: string, exportType: BusinessExportType, priority: number = 0): Promise<any> {
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
  
  // ==================== QR ANTI-FRAUD OPERATIONS ====================
  
  /**
   * Create a one-time QR sequence number for anti-fraud protection
   */
  static async createQrSequenceNumber(qrData: {
    documentId: string;
    studentId: string;
    sequenceNumber: string;
  }): Promise<any> {
    console.log(`[DatabaseWriteService] Creating QR sequence for document ${qrData.documentId}, student ${qrData.studentId}`);
    
    try {
      const qrSequence = await storage.createQrSequenceNumber(qrData);
      console.log(`[DatabaseWriteService] QR sequence created: ${qrSequence.id}`);
      return qrSequence;
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to create QR sequence:`, error);
      throw new Error(`Failed to create QR sequence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Find QR sequence by sequence number (for validation)
   */
  static async findQrSequenceNumber(sequenceNumber: string): Promise<any> {
    try {
      return await storage.findQrSequenceByNumber(sequenceNumber);
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to find QR sequence:`, error);
      return null;
    }
  }
  
  /**
   * Mark QR sequence as used (anti-fraud protection)
   */
  static async markQrSequenceAsUsed(sequenceId: string, usedByTeacher: string): Promise<void> {
    console.log(`[DatabaseWriteService] Marking QR sequence ${sequenceId} as used by ${usedByTeacher}`);
    
    try {
      await storage.markQrSequenceAsUsed(sequenceId, usedByTeacher);
      console.log(`[DatabaseWriteService] QR sequence marked as used successfully`);
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to mark QR sequence as used:`, error);
      throw new Error(`Failed to mark QR sequence as used: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get all QR sequences for a document
   */
  static async getQrSequencesForDocument(documentId: string): Promise<any[]> {
    try {
      return await storage.getQrSequencesForDocument(documentId);
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to get QR sequences:`, error);
      return [];
    }
  }
  
  /**
   * Create a grade submission after successful QR scan
   */
  static async createGradeSubmission(gradeData: {
    sequenceNumberId: string;
    documentId: string;
    rubricDocumentId: string;
    originalDocumentId?: string;
    studentId: string;
    questionGrades: any;
    totalScore?: number;
    maxPossibleScore?: number;
    percentageScore?: number;
    scannerNotes?: string;
    processedBy: string;
  }): Promise<any> {
    console.log(`[DatabaseWriteService] Creating grade submission for student ${gradeData.studentId}`);
    
    try {
      const submission = await storage.createGradeSubmission({
        ...gradeData,
        originalDocumentId: gradeData.originalDocumentId || gradeData.documentId,
        totalScore: gradeData.totalScore ? String(gradeData.totalScore) : undefined,
        maxPossibleScore: gradeData.maxPossibleScore ? String(gradeData.maxPossibleScore) : undefined,
        percentageScore: gradeData.percentageScore ? String(gradeData.percentageScore) : undefined
      });
      console.log(`[DatabaseWriteService] Grade submission created: ${submission.id}`);
      
      // Trigger automatic collation for this document
      try {
        const { RubricCollationService } = await import('./rubricCollationService.js');
        
        // Use originalDocumentId if available, otherwise use documentId  
        const documentToCollate = (gradeData as any).originalDocumentId || gradeData.documentId;
        if (documentToCollate) {
          // Run collation in background without blocking submission processing
          setTimeout(async () => {
            try {
              await RubricCollationService.autoCollateOnNewSubmission(documentToCollate);
            } catch (collationError) {
              console.warn(`[DatabaseWriteService] Background collation failed for ${documentToCollate}:`, collationError);
            }
          }, 100); // Small delay to ensure submission is fully processed
        }
      } catch (importError) {
        console.warn('[DatabaseWriteService] Could not import RubricCollationService for auto-collation:', importError);
      }
      
      return submission;
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to create grade submission:`, error);
      throw new Error(`Failed to create grade submission: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update document teacher review status
   */
  static async updateDocumentTeacherReviewStatus(
    documentId: string,
    customerUuid: string,
    status: TeacherReviewStatus
  ): Promise<void> {
    console.log(`[DatabaseWriteService] Updating document ${documentId} teacher review status to: ${status}`);
    
    try {
      // Verify document ownership
      const document = await storage.getDocument(documentId);
      if (!document || document.customerUuid !== customerUuid) {
        throw new Error('Document not found or access denied');
      }

      await storage.updateDocumentTeacherReviewStatus(documentId, status);
      console.log(`[DatabaseWriteService] Teacher review status updated successfully`);
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to update teacher review status:`, error);
      throw new Error(`Failed to update teacher review status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Queue document exports (cover sheets, rubrics) for generation
   */
  static async queueDocumentExports(documentId: string, customerUuid: string): Promise<void> {
    console.log(`[DatabaseWriteService] Queueing document exports for ${documentId}`);
    
    try {
      // Verify document ownership and status
      const document = await storage.getDocument(documentId);
      if (!document || document.customerUuid !== customerUuid) {
        throw new Error('Document not found or access denied');
      }

      // Queue cover sheet and rubric generation
      await storage.addToExportQueue(documentId, BusinessExportType.COVER_SHEET);
      await storage.addToExportQueue(documentId, BusinessExportType.RUBRIC_PDF);
      
      console.log(`[DatabaseWriteService] Export queue entries created for document ${documentId}`);
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to queue document exports:`, error);
      throw new Error(`Failed to queue document exports: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect missing generated documents and queue only those for regeneration
   */
  static async detectAndQueueMissingExports(documentId: string, customerUuid: string): Promise<string[]> {
    console.log(`[DatabaseWriteService] Detecting missing exports for document ${documentId}`);
    
    try {
      // Verify document ownership and status
      const document = await storage.getDocument(documentId);
      if (!document || document.customerUuid !== customerUuid) {
        throw new Error('Document not found or access denied');
      }

      // Get all generated documents for this source document
      const generatedDocs = await storage.getChildDocuments(documentId);
      console.log(`[DatabaseWriteService] Found ${generatedDocs.length} existing generated documents`);

      // Check which export types already exist
      const existingExportTypes = new Set(generatedDocs.map(doc => doc.exportType).filter(Boolean));
      console.log(`[DatabaseWriteService] Existing export types:`, Array.from(existingExportTypes));

      // Define expected export types for a reviewed and accepted document
      const expectedExportTypes = [BusinessExportType.COVER_SHEET, BusinessExportType.RUBRIC_PDF];
      
      // Find missing export types
      const missingExportTypes = expectedExportTypes.filter(exportType => !existingExportTypes.has(exportType));
      console.log(`[DatabaseWriteService] Missing export types:`, missingExportTypes);

      // Queue only the missing exports
      const queuedExports: string[] = [];
      for (const exportType of missingExportTypes) {
        await storage.addToExportQueue(documentId, exportType);
        queuedExports.push(exportType);
        console.log(`[DatabaseWriteService] Queued missing export: ${exportType}`);
      }
      
      console.log(`[DatabaseWriteService] Queued ${queuedExports.length} missing exports for document ${documentId}`);
      return queuedExports;
    } catch (error) {
      console.error(`[DatabaseWriteService] Failed to detect and queue missing exports:`, error);
      throw new Error(`Failed to detect and queue missing exports: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}