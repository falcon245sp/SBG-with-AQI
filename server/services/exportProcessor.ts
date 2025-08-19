/**
 * Export Processor Service - Generates PDF exports from completed document analysis
 * 
 * This service processes export queue items to generate:
 * - Rubric PDFs for grading
 * - Cover sheets for student preview
 * - Processing reports and summaries
 */

import { storage } from '../storage';
import { DatabaseWriteService } from './databaseWriteService';
import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';
import type { ExportType } from '../utils/documentTagging';

export class ExportProcessor {
  private isProcessing = false;
  private isStarted = false;

  start() {
    if (this.isStarted) {
      return;
    }

    this.isStarted = true;
    console.log('[ExportProcessor] Export processor started and ready');
  }

  stop() {
    this.isStarted = false;
    console.log('[ExportProcessor] Export processor stopped');
  }

  /**
   * Process a single export queue item
   */
  async processExport(exportId: string): Promise<void> {
    if (!this.isStarted || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    
    try {
      // Get export queue item
      const exportItem = await storage.getExportQueueItem(exportId);
      if (!exportItem || exportItem.status !== 'pending') {
        console.log(`[ExportProcessor] Skipping export ${exportId} - invalid status: ${exportItem?.status}`);
        this.isProcessing = false;
        return;
      }

      console.log(`[ExportProcessor] Processing export: ${exportItem.exportType} for document ${exportItem.documentId}`);

      // Get the source document
      const document = await storage.getDocument(exportItem.documentId);
      if (!document) {
        throw new Error(`Source document not found: ${exportItem.documentId}`);
      }

      // Generate export based on type
      let exportFilePath: string;
      let exportMimeType: string = 'application/pdf';

      switch (exportItem.exportType) {
        case 'rubric_pdf':
          exportFilePath = await this.generateRubricPDF(document, exportItem);
          break;
        case 'cover_sheet':
          exportFilePath = await this.generateCoverSheet(document, exportItem);
          break;
        default:
          throw new Error(`Unsupported export type: ${exportItem.exportType}`);
      }

      // Create generated document record
      const fullFilePath = path.join(process.cwd(), 'uploads', exportFilePath);
      const documentData = {
        fileName: exportFilePath, // Use the filename as returned by generator
        originalPath: exportFilePath,
        filePath: exportFilePath,
        fileSize: fs.statSync(fullFilePath).size,
        mimeType: exportMimeType,
        parentDocumentId: document.id
      };
      
      const generatedDoc = await DatabaseWriteService.createGeneratedDocument(
        document.customerUuid,
        document.id,
        exportItem.exportType as ExportType,
        documentData,
        []
      );

      console.log(`[ExportProcessor] Generated document created: ${generatedDoc.id}`);

      // Mark export as completed
      await storage.updateExportQueueStatus(exportId, 'completed');
      
      console.log(`[ExportProcessor] Export completed successfully: ${exportItem.exportType} for document ${exportItem.documentId}`);

    } catch (error) {
      console.error(`[ExportProcessor] Export processing failed:`, error);
      
      // Mark export as failed
      try {
        await storage.updateExportQueueStatus(exportId, 'failed');
      } catch (updateError) {
        console.error(`[ExportProcessor] Failed to update export status:`, updateError);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Generate a Standards-Based Grading rubric PDF
   */
  private async generateRubricPDF(document: any, exportItem: any): Promise<string> {
    console.log(`[ExportProcessor] Generating SBG rubric PDF for document: ${document.fileName}`);

    // Get questions and AI results for the document
    const questions = await storage.getQuestionsByDocumentId(document.id);
    const questionResults = await storage.getQuestionResultsByDocumentId(document.id);
    
    const pdf = new jsPDF();
    
    // Header
    pdf.setFontSize(18);
    pdf.text('Standards Sherpa - Standards-Based Grading Rubric', 20, 30);
    
    pdf.setFontSize(12);
    pdf.text(`Assessment: ${document.fileName}`, 20, 45);
    pdf.text(`Student Name: ___________________________`, 20, 60);
    pdf.text(`Date: ___________________________`, 120, 60);
    
    let yPosition = 80;
    
    // Add questions with standards-based grading
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const result = questionResults.find(r => r.questionNumber === question.questionNumber);
      
      // Question header
      pdf.setFontSize(14);
      pdf.text(`Question ${question.questionNumber}`, 20, yPosition);
      yPosition += 15;
      
      // Standards and Rigor information
      if (result) {
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'bold');
        pdf.text(`Standard: ${result.consensusStandards || 'Not analyzed'}`, 20, yPosition);
        yPosition += 12;
        pdf.text(`Rigor Level: ${result.consensusRigorLevel || 'Not analyzed'}`, 20, yPosition);
        pdf.setFont(undefined, 'normal');
        yPosition += 15;
      }
      
      // Question text (wrapped)
      pdf.setFontSize(10);
      const questionLines = pdf.splitTextToSize(question.questionText, 170);
      pdf.text(questionLines, 20, yPosition);
      yPosition += questionLines.length * 5 + 15;
      
      // Standards-Based Grading Scale (4-point)
      pdf.setFontSize(12);
      pdf.setFont(undefined, 'bold');
      pdf.text('Mastery Level (check one):', 20, yPosition);
      pdf.setFont(undefined, 'normal');
      yPosition += 15;
      
      pdf.setFontSize(10);
      // Level 4: Demonstrates Full Mastery
      pdf.rect(25, yPosition - 2, 8, 8);
      pdf.text('4 - Demonstrates Full Mastery', 40, yPosition + 5);
      pdf.text('(Exceeds expectations, shows deep understanding)', 45, yPosition + 12);
      yPosition += 20;
      
      // Level 3: Demonstrates Mastery with Unrelated Mistakes
      pdf.rect(25, yPosition - 2, 8, 8);
      pdf.text('3 - Demonstrates Mastery with Unrelated Mistakes', 40, yPosition + 5);
      pdf.text('(Meets expectations, minor errors don\'t affect understanding)', 45, yPosition + 12);
      yPosition += 20;
      
      // Level 2: Does Not Demonstrate Mastery
      pdf.rect(25, yPosition - 2, 8, 8);
      pdf.text('2 - Does Not Demonstrate Mastery', 40, yPosition + 5);
      pdf.text('(Approaching expectations, significant gaps in understanding)', 45, yPosition + 12);
      yPosition += 20;
      
      // Level 1: No Attempt
      pdf.rect(25, yPosition - 2, 8, 8);
      pdf.text('1 - No Attempt', 40, yPosition + 5);
      pdf.text('(No evidence of understanding or no response provided)', 45, yPosition + 12);
      yPosition += 25;
      
      // Evidence/Notes section
      pdf.setFontSize(10);
      pdf.text('Evidence/Notes:', 20, yPosition);
      yPosition += 10;
      pdf.rect(20, yPosition, 170, 15);
      yPosition += 25;
      
      // Start new page if needed
      if (yPosition > 220) {
        pdf.addPage();
        yPosition = 30;
      }
    }
    
    // Overall Assessment Summary
    if (yPosition > 200) {
      pdf.addPage();
      yPosition = 30;
    }
    
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text('Overall Standards Mastery Summary:', 20, yPosition + 20);
    pdf.setFont(undefined, 'normal');
    yPosition += 35;
    
    pdf.setFontSize(10);
    pdf.text('Standards Mastered (Level 3-4): _________________________', 20, yPosition);
    yPosition += 15;
    pdf.text('Standards Approaching (Level 2): ________________________', 20, yPosition);
    yPosition += 15;
    pdf.text('Standards Not Yet Demonstrated (Level 1): ________________', 20, yPosition);
    yPosition += 20;
    
    pdf.text('Next Steps for Learning:', 20, yPosition);
    yPosition += 10;
    pdf.rect(20, yPosition, 170, 25);
    
    // Save PDF with user-friendly filename
    const baseFileName = document.fileName.replace(/\.[^/.]+$/, ""); // Remove file extension
    const cleanFileName = baseFileName.replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '-'); // Clean filename
    const timestamp = new Date().toISOString().slice(0, 10); // Use YYYY-MM-DD format
    const fileName = `${cleanFileName}_rubric_${timestamp}.pdf`;
    const filePath = path.join(process.cwd(), 'uploads', fileName);
    
    fs.writeFileSync(filePath, Buffer.from(pdf.output('arraybuffer')));
    
    console.log(`[ExportProcessor] Rubric PDF saved: ${fileName}`);
    return fileName; // Return relative path for database storage
  }

  /**
   * Generate a student cover sheet PDF
   */
  private async generateCoverSheet(document: any, exportItem: any): Promise<string> {
    console.log(`[ExportProcessor] Generating cover sheet for document: ${document.fileName}`);

    // Get questions and AI results for the document
    const questions = await storage.getQuestionsByDocumentId(document.id);
    const questionResults = await storage.getQuestionResultsByDocumentId(document.id);
    
    const pdf = new jsPDF();
    
    // Header
    pdf.setFontSize(18);
    pdf.text('Standards Sherpa - Test Preview', 20, 30);
    
    pdf.setFontSize(12);
    pdf.text(`Assessment: ${document.fileName}`, 20, 45);
    pdf.text(`Number of Questions: ${questions.length}`, 20, 60);
    
    let yPosition = 80;
    
    // Create summary table
    pdf.setFontSize(14);
    pdf.text('Question Summary', 20, yPosition);
    yPosition += 15;
    
    // Table headers
    pdf.setFontSize(10);
    pdf.text('Q#', 20, yPosition);
    pdf.text('Standard', 40, yPosition);
    pdf.text('Topic', 100, yPosition);
    pdf.text('Rigor Level', 160, yPosition);
    yPosition += 10;
    
    // Table content
    for (let i = 0; i < Math.min(questions.length, 20); i++) { // Limit to 20 questions
      const question = questions[i];
      const result = questionResults.find(r => r.questionId === question.id);
      
      pdf.text(`${i + 1}`, 20, yPosition);
      pdf.text(result?.primaryStandard || 'TBD', 40, yPosition);
      pdf.text(result?.topic || 'General', 100, yPosition);
      pdf.text(result?.rigorLevel || 'Medium', 160, yPosition);
      yPosition += 8;
      
      // Start new page if needed
      if (yPosition > 280) {
        pdf.addPage();
        yPosition = 30;
      }
    }
    
    // Save PDF with user-friendly filename
    const baseFileName = document.fileName.replace(/\.[^/.]+$/, ""); // Remove file extension
    const cleanFileName = baseFileName.replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '-'); // Clean filename
    const timestamp = new Date().toISOString().slice(0, 10); // Use YYYY-MM-DD format
    const fileName = `${cleanFileName}_cover-sheet_${timestamp}.pdf`;
    const filePath = path.join(process.cwd(), 'uploads', fileName);
    
    fs.writeFileSync(filePath, Buffer.from(pdf.output('arraybuffer')));
    
    console.log(`[ExportProcessor] Cover sheet PDF saved: ${fileName}`);
    return fileName; // Return relative path for database storage
  }

  /**
   * Process all pending exports in the queue
   */
  async processPendingExports(): Promise<void> {
    if (!this.isStarted || this.isProcessing) {
      return;
    }

    try {
      const pendingExports = await storage.getPendingExports();
      console.log(`[ExportProcessor] Found ${pendingExports.length} pending exports`);

      for (const exportItem of pendingExports) {
        await this.processExport(exportItem.id);
      }
    } catch (error) {
      console.error('[ExportProcessor] Error processing pending exports:', error);
    }
  }

  getStatus() {
    return {
      isStarted: this.isStarted,
      isProcessing: this.isProcessing
    };
  }
}

// Create and export singleton instance
export const exportProcessor = new ExportProcessor();