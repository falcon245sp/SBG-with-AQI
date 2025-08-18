import { storage } from '../storage.js';
import { DatabaseWriteService } from './databaseWriteService.js';
import jsPDF from 'jspdf';
import fs from 'fs';
import path from 'path';

/**
 * RubricCollationService - Collates individual graded rubrics into multipage PDFs
 * 
 * This service automatically combines multiple student submissions for the same
 * assessment into a single organized PDF document, making it easier for teachers
 * to review and manage graded work in the File Cabinet.
 */
export class RubricCollationService {
  
  /**
   * Collate all graded submissions for a specific original document into a single PDF
   */
  static async collateSubmissionsForDocument(originalDocumentId: string): Promise<{
    success: boolean;
    collatedDocumentId?: string;
    submissionCount: number;
    filePath?: string;
  }> {
    try {
      // Get all grade submissions for this document
      const submissions = await storage.getGradeSubmissionsForDocument(originalDocumentId);
      
      if (submissions.length === 0) {
        return { success: false, submissionCount: 0 };
      }
      
      // Get the original document for metadata
      const originalDocument = await storage.getDocument(originalDocumentId);
      if (!originalDocument) {
        throw new Error(`Original document ${originalDocumentId} not found`);
      }
      
      // Sort submissions by student name for consistent ordering
      const enrichedSubmissions = [];
      for (const submission of submissions) {
        const student = await storage.getStudent(submission.studentId);
        enrichedSubmissions.push({
          ...submission,
          student,
          studentName: student ? `${student.lastName}, ${student.firstName}` : 'Unknown Student'
        });
      }
      
      enrichedSubmissions.sort((a, b) => a.studentName.localeCompare(b.studentName));
      
      // Create multipage PDF
      const pdf = new jsPDF();
      let isFirstPage = true;
      
      for (const submission of enrichedSubmissions) {
        if (!isFirstPage) {
          pdf.addPage();
        }
        
        // Add header for this student's submission
        pdf.setFontSize(16);
        pdf.text(`Student: ${submission.studentName}`, 20, 20);
        
        pdf.setFontSize(12);
        pdf.text(`Assessment: ${originalDocument.fileName}`, 20, 35);
        pdf.text(`Score: ${submission.totalScore || 'Not Scored'}/${submission.maxPossibleScore || 'N/A'}`, 20, 45);
        
        if (submission.percentageScore) {
          pdf.text(`Percentage: ${Number(submission.percentageScore).toFixed(1)}%`, 20, 55);
        }
        
        pdf.text(`Graded: ${new Date(submission.scannedAt).toLocaleDateString()}`, 20, 65);
        
        if (submission.processedBy) {
          pdf.text(`Teacher: ${submission.processedBy}`, 20, 75);
        }
        
        // Add question-by-question breakdown
        let yPosition = 90;
        
        if (submission.questionGrades && Array.isArray(submission.questionGrades)) {
          pdf.setFontSize(14);
          pdf.text('Question Breakdown:', 20, yPosition);
          yPosition += 15;
          
          pdf.setFontSize(10);
          
          for (const [index, questionGrade] of submission.questionGrades.entries()) {
            if (yPosition > 250) { // Near bottom of page
              pdf.addPage();
              yPosition = 20;
            }
            
            const questionText = `Q${index + 1}: ${questionGrade.score || 0}/${questionGrade.maxScore || 0} points`;
            pdf.text(questionText, 25, yPosition);
            yPosition += 10;
            
            if (questionGrade.feedback) {
              pdf.text(`Feedback: ${questionGrade.feedback}`, 30, yPosition);
              yPosition += 10;
            }
          }
        }
        
        // Add scanner notes if present
        if (submission.scannerNotes) {
          yPosition += 10;
          if (yPosition > 250) {
            pdf.addPage();
            yPosition = 20;
          }
          
          pdf.setFontSize(12);
          pdf.text('Scanner Notes:', 20, yPosition);
          yPosition += 10;
          
          pdf.setFontSize(10);
          const notes = pdf.splitTextToSize(submission.scannerNotes, 170);
          pdf.text(notes, 25, yPosition);
        }
        
        isFirstPage = false;
      }
      
      // Generate filename and save PDF
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const baseFileName = originalDocument.fileName.replace(/\.[^/.]+$/, ''); // Remove extension
      const fileName = `${baseFileName}_Graded_Submissions_${timestamp}.pdf`;
      const filePath = path.join('uploads', fileName);
      
      // Ensure uploads directory exists
      if (!fs.existsSync('uploads')) {
        fs.mkdirSync('uploads', { recursive: true });
      }
      
      // Save PDF to file
      const pdfBuffer = pdf.output('arraybuffer');
      fs.writeFileSync(filePath, Buffer.from(pdfBuffer));
      
      // Create document record in database
      const collatedDocument = await DatabaseWriteService.createDocument({
        fileName,
        originalFilename: fileName,
        customerUuid: originalDocument.customerUuid,
        filePath,
        fileSize: fs.statSync(filePath).size,
        mimeType: 'application/pdf',
        assetType: 'generated',
        exportType: 'collated_graded_submissions',
        parentDocumentId: originalDocumentId,
        status: 'completed',
        tags: ['graded-submissions', 'collated', 'teacher-review']
      });
      
      console.log(`[RubricCollation] Created collated PDF for ${originalDocumentId}: ${collatedDocument.id} (${submissions.length} submissions)`);
      
      return {
        success: true,
        collatedDocumentId: collatedDocument.id,
        submissionCount: submissions.length,
        filePath
      };
      
    } catch (error) {
      console.error('[RubricCollation] Error collating submissions:', error);
      return { success: false, submissionCount: 0 };
    }
  }
  
  /**
   * Auto-collate submissions when new grades are added
   * Called from grade submission processing to maintain up-to-date collated PDFs
   */
  static async autoCollateOnNewSubmission(originalDocumentId: string): Promise<void> {
    try {
      // Check if there's already a collated document for this assessment
      const existingCollated = await storage.getGeneratedDocuments(originalDocumentId);
      const existingCollation = existingCollated.find(doc => doc.exportType === 'collated_graded_submissions');
      
      // Always regenerate to include the new submission
      const result = await this.collateSubmissionsForDocument(originalDocumentId);
      
      if (result.success && existingCollation) {
        // Remove the old collated document
        try {
          if (existingCollation.filePath && fs.existsSync(existingCollation.filePath)) {
            fs.unlinkSync(existingCollation.filePath);
          }
          await DatabaseWriteService.deleteDocument(existingCollation.id);
          console.log(`[RubricCollation] Replaced old collated document ${existingCollation.id} with new one`);
        } catch (cleanupError) {
          console.warn('[RubricCollation] Failed to cleanup old collated document:', cleanupError);
        }
      }
      
      if (result.success) {
        console.log(`[RubricCollation] Auto-collated ${result.submissionCount} submissions for document ${originalDocumentId}`);
      }
      
    } catch (error) {
      console.error('[RubricCollation] Error in auto-collation:', error);
    }
  }
  
  /**
   * Get collation statistics for dashboard/reporting
   */
  static async getCollationStatistics(customerUuid: string): Promise<{
    totalCollatedDocuments: number;
    totalSubmissionsCollated: number;
    recentCollations: Array<{
      documentName: string;
      submissionCount: number;
      createdAt: string;
    }>;
  }> {
    try {
      const documents = await storage.getCustomerDocuments(customerUuid);
      const collatedDocs = documents.filter(doc => doc.exportType === 'collated_graded_submissions');
      
      let totalSubmissions = 0;
      const recentCollations = [];
      
      for (const doc of collatedDocs.slice(-10)) { // Last 10 collations
        const originalDoc = doc.parentDocumentId ? await storage.getDocument(doc.parentDocumentId) : null;
        const submissions = doc.parentDocumentId ? await storage.getGradeSubmissionsForDocument(doc.parentDocumentId) : [];
        
        totalSubmissions += submissions.length;
        
        recentCollations.push({
          documentName: originalDoc?.fileName || 'Unknown Assessment',
          submissionCount: submissions.length,
          createdAt: doc.createdAt
        });
      }
      
      return {
        totalCollatedDocuments: collatedDocs.length,
        totalSubmissionsCollated: totalSubmissions,
        recentCollations: recentCollations.reverse() // Most recent first
      };
      
    } catch (error) {
      console.error('[RubricCollation] Error getting statistics:', error);
      return {
        totalCollatedDocuments: 0,
        totalSubmissionsCollated: 0,
        recentCollations: []
      };
    }
  }
  
  /**
   * Manually trigger collation for a specific document
   * Useful for teachers who want to regenerate collated PDFs
   */
  static async manualCollation(originalDocumentId: string, customerUuid: string): Promise<{
    success: boolean;
    message: string;
    collatedDocumentId?: string;
  }> {
    try {
      // Verify customer owns the document
      const originalDocument = await storage.getDocument(originalDocumentId);
      if (!originalDocument || originalDocument.customerUuid !== customerUuid) {
        return { success: false, message: 'Document not found or access denied' };
      }
      
      const result = await this.collateSubmissionsForDocument(originalDocumentId);
      
      if (result.success) {
        return {
          success: true,
          message: `Successfully collated ${result.submissionCount} submissions`,
          collatedDocumentId: result.collatedDocumentId
        };
      } else {
        return {
          success: false,
          message: result.submissionCount === 0 ? 'No graded submissions found to collate' : 'Failed to create collated PDF'
        };
      }
      
    } catch (error) {
      console.error('[RubricCollation] Error in manual collation:', error);
      return { success: false, message: 'Internal error during collation' };
    }
  }
}