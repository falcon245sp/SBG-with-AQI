import { storage } from '../storage.js';
import { CustomerLookupService } from './customerLookupService.js';

/**
 * DocumentTraversalService - Complete document relationship and traversal system
 * 
 * Enables traversal of the full document lifecycle:
 * 1. Original Uploaded Document (PDF/DOCX assessment)
 * 2. Generated Documents (rubrics, cover sheets, etc.)
 * 3. Graded Submissions (scanned rubrics with student scores)
 * 
 * This service provides the foundation for comprehensive document inspection
 * and relationship tracking throughout the Standards Sherpa workflow.
 */
export class DocumentTraversalService {
  
  /**
   * Get complete document tree starting from uploaded document
   * Returns original document + all generated children + all grade submissions
   */
  static async getDocumentTree(uploadedDocumentId: string): Promise<{
    originalDocument: any;
    generatedDocuments: Array<{
      document: any;
      gradeSubmissions: any[];
    }>;
    totalGradeSubmissions: number;
    studentsGraded: number;
  }> {
    // Get the original document
    const originalDocument = await storage.getDocument(uploadedDocumentId);
    if (!originalDocument) {
      throw new Error(`Original document ${uploadedDocumentId} not found`);
    }
    
    // Get all generated documents (children)
    const generatedDocuments = await storage.getGeneratedDocuments(uploadedDocumentId);
    
    // For each generated document, get its grade submissions
    const documentsWithGrades = [];
    let totalGradeSubmissions = 0;
    const gradedStudents = new Set<string>();
    
    for (const generatedDoc of generatedDocuments) {
      const gradeSubmissions = await storage.getGradeSubmissionsForDocument(generatedDoc.id);
      
      documentsWithGrades.push({
        document: generatedDoc,
        gradeSubmissions,
      });
      
      totalGradeSubmissions += gradeSubmissions.length;
      gradeSubmissions.forEach(submission => gradedStudents.add(submission.studentId));
    }
    
    return {
      originalDocument,
      generatedDocuments: documentsWithGrades,
      totalGradeSubmissions,
      studentsGraded: gradedStudents.size,
    };
  }
  
  /**
   * Get document lineage (path from original to target document)
   * Shows the complete ancestry chain
   */
  static async getDocumentLineage(documentId: string): Promise<{
    documents: any[];
    path: string[];
    depth: number;
  }> {
    const lineage = [];
    const path = [];
    let currentDocumentId = documentId;
    let depth = 0;
    
    // Traverse up the parent chain
    while (currentDocumentId && depth < 10) { // Safety limit
      const document = await storage.getDocument(currentDocumentId);
      if (!document) break;
      
      lineage.unshift(document); // Add to beginning to maintain order
      path.unshift(document.fileName);
      
      currentDocumentId = document.parentDocumentId;
      depth++;
    }
    
    return {
      documents: lineage,
      path,
      depth,
    };
  }
  
  /**
   * Get all graded submissions for a specific rubric document
   */
  static async getRubricGradeSubmissions(rubricDocumentId: string): Promise<{
    rubricDocument: any;
    originalDocument: any;
    gradeSubmissions: Array<any & {
      student: any;
      qrSequence: any;
    }>;
    gradingStats: {
      totalSubmissions: number;
      averageScore: number;
      highestScore: number;
      lowestScore: number;
      studentsGraded: number;
    };
  }> {
    // Get the rubric document
    const rubricDocument = await storage.getDocument(rubricDocumentId);
    if (!rubricDocument || rubricDocument.assetType !== 'generated') {
      throw new Error(`Rubric document ${rubricDocumentId} not found or not a generated document`);
    }
    
    // Get the original document
    const originalDocument = await storage.getDocument(rubricDocument.parentDocumentId);
    
    // Get all grade submissions for this rubric
    const gradeSubmissions = await storage.getGradeSubmissionsForRubric(rubricDocumentId);
    
    // Enrich with student and QR sequence data
    const enrichedSubmissions = [];
    const scores = [];
    
    for (const submission of gradeSubmissions) {
      const student = await storage.getStudent(submission.studentId);
      const qrSequence = await storage.getQrSequenceById(submission.sequenceNumberId);
      
      enrichedSubmissions.push({
        ...submission,
        student,
        qrSequence,
      });
      
      if (submission.totalScore) {
        scores.push(Number(submission.totalScore));
      }
    }
    
    // Calculate grading statistics
    const gradingStats = {
      totalSubmissions: gradeSubmissions.length,
      averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      highestScore: scores.length > 0 ? Math.max(...scores) : 0,
      lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
      studentsGraded: gradeSubmissions.length,
    };
    
    return {
      rubricDocument,
      originalDocument,
      gradeSubmissions: enrichedSubmissions,
      gradingStats,
    };
  }
  
  /**
   * Get detailed inspection view for any document with full context
   */
  static async getDocumentInspection(documentId: string): Promise<{
    document: any;
    lineage: any[];
    children: any[];
    gradeSubmissions: any[];
    questions: any[];
    processingResults: any[];
    documentType: 'original' | 'generated' | 'unknown';
    relationships: {
      parentCount: number;
      childCount: number;
      submissionCount: number;
      questionCount: number;
    };
  }> {
    // Get the document
    const document = await storage.getDocument(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }
    
    // Get lineage (ancestry)
    const lineageResult = await this.getDocumentLineage(documentId);
    
    // Get children (generated documents)
    const children = await storage.getGeneratedDocuments(documentId);
    
    // Get grade submissions
    const gradeSubmissions = await storage.getGradeSubmissionsForDocument(documentId);
    
    // Get questions and results
    const questions = await storage.getDocumentQuestions(documentId);
    const processingResults = await storage.getDocumentResults(documentId, document.customerUuid);
    
    // Determine document type
    let documentType: 'original' | 'generated' | 'unknown' = 'unknown';
    if (document.assetType === 'uploaded') {
      documentType = 'original';
    } else if (document.assetType === 'generated') {
      documentType = 'generated';
    }
    
    return {
      document,
      lineage: lineageResult.documents,
      children,
      gradeSubmissions,
      questions,
      processingResults,
      documentType,
      relationships: {
        parentCount: lineageResult.depth,
        childCount: children.length,
        submissionCount: gradeSubmissions.length,
        questionCount: questions.length,
      },
    };
  }
  
  /**
   * Get document statistics for dashboard
   */
  static async getDocumentStatistics(customerUuid: string): Promise<{
    totalOriginalDocuments: number;
    totalGeneratedDocuments: number;
    totalGradeSubmissions: number;
    recentActivity: Array<{
      type: 'upload' | 'generation' | 'grading';
      document: any;
      timestamp: Date;
    }>;
  }> {
    const documents = await storage.getCustomerDocuments(customerUuid);
    
    const originalDocuments = documents.filter(d => d.assetType === 'uploaded');
    const generatedDocuments = documents.filter(d => d.assetType === 'generated');
    
    // Get all grade submissions for this customer
    const allGradeSubmissions = [];
    for (const doc of generatedDocuments) {
      const submissions = await storage.getGradeSubmissionsForDocument(doc.id);
      allGradeSubmissions.push(...submissions);
    }
    
    // Build recent activity timeline
    const recentActivity = [];
    
    // Add recent uploads
    originalDocuments.slice(-5).forEach(doc => {
      recentActivity.push({
        type: 'upload' as const,
        document: doc,
        timestamp: doc.createdAt,
      });
    });
    
    // Add recent generations
    generatedDocuments.slice(-5).forEach(doc => {
      recentActivity.push({
        type: 'generation' as const,
        document: doc,
        timestamp: doc.createdAt,
      });
    });
    
    // Add recent gradings
    allGradeSubmissions.slice(-5).forEach(submission => {
      recentActivity.push({
        type: 'grading' as const,
        document: { id: submission.rubricDocumentId, fileName: 'Graded Rubric' },
        timestamp: submission.scannedAt,
      });
    });
    
    // Sort by timestamp, most recent first
    recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return {
      totalOriginalDocuments: originalDocuments.length,
      totalGeneratedDocuments: generatedDocuments.length,
      totalGradeSubmissions: allGradeSubmissions.length,
      recentActivity: recentActivity.slice(0, 10), // Last 10 activities
    };
  }
}