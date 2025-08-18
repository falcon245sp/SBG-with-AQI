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
   * Generate a grading rubric PDF
   */
  private async generateRubricPDF(document: any, exportItem: any): Promise<string> {
    console.log(`[ExportProcessor] Generating rubric PDF for document: ${document.fileName}`);

    // Get questions and AI results for the document
    const questions = await storage.getQuestionsByDocumentId(document.id);
    
    const pdf = new jsPDF();
    
    // Header
    pdf.setFontSize(18);
    pdf.text('Standards Sherpa - Grading Rubric', 20, 30);
    
    pdf.setFontSize(12);
    pdf.text(`Assessment: ${document.fileName}`, 20, 45);
    pdf.text(`Student Name: ___________________________`, 20, 60);
    pdf.text(`Date: ___________________________`, 120, 60);
    
    let yPosition = 80;
    
    // Add questions with grading spaces
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      
      // Question header
      pdf.setFontSize(14);
      pdf.text(`Question ${i + 1}`, 20, yPosition);
      yPosition += 15;
      
      // Question text (wrapped)
      pdf.setFontSize(10);
      const questionLines = pdf.splitTextToSize(question.questionText, 170);
      pdf.text(questionLines, 20, yPosition);
      yPosition += questionLines.length * 5 + 10;
      
      // Grading box
      pdf.rect(20, yPosition, 170, 20);
      pdf.text('Score: _____ / _____ points', 25, yPosition + 12);
      yPosition += 30;
      
      // Start new page if needed
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = 30;
      }
    }
    
    // Total score section
    pdf.setFontSize(14);
    pdf.text('Total Score: _____ / _____ points', 20, yPosition + 20);
    
    // Save PDF
    const timestamp = Date.now();
    const fileName = `rubric_${document.id}_${timestamp}.pdf`;
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
    
    // Save PDF
    const timestamp = Date.now();
    const fileName = `cover_sheet_${document.id}_${timestamp}.pdf`;
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