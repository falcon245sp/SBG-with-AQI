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
   * Generate a Standards-Based Grading rubric PDF in table format
   */
  private async generateRubricPDF(document: any, exportItem: any): Promise<string> {
    console.log(`[ExportProcessor] Generating SBG rubric PDF for document: ${document.fileName}`);

    // Get questions and AI results for the document
    const questions = await storage.getQuestionsByDocumentId(document.id);
    const questionResults = await storage.getQuestionResultsByDocumentId(document.id);
    
    const pdf = new jsPDF('portrait', 'mm', 'a4');
    
    // Header with QR code space (upper left) and student name (upper right)
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    const title = document.fileName.replace(/\.[^/.]+$/, "");
    pdf.text(title, 105, 20, { align: 'center' } as any);
    
    pdf.setFontSize(14);
    pdf.text('Rubric', 105, 30, { align: 'center' } as any);
    
    // QR Code placeholder (upper left)
    pdf.setDrawColor(150, 150, 150);
    pdf.rect(10, 10, 25, 25);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('QR Code', 12, 24);
    
    // Student name field (upper right)
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Student Name (Last, First):', 140, 15);
    pdf.setFont('helvetica', 'normal');
    pdf.text('_________________________________', 140, 25);
    
    pdf.setFont('helvetica', 'normal');
    let yPosition = 45;
    
    // Table headers
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    
    // Define column positions and widths
    const cols = {
      criteria: { x: 10, width: 35 },
      points: { x: 45, width: 15 },
      fullCredit: { x: 60, width: 35 },
      partialCredit: { x: 95, width: 35 },
      minimalCredit: { x: 130, width: 35 },
      noCredit: { x: 165, width: 35 }
    };
    
    // Draw header row
    pdf.rect(cols.criteria.x, yPosition, cols.criteria.width, 8);
    pdf.rect(cols.points.x, yPosition, cols.points.width, 8);
    pdf.rect(cols.fullCredit.x, yPosition, cols.fullCredit.width, 8);
    pdf.rect(cols.partialCredit.x, yPosition, cols.partialCredit.width, 8);
    pdf.rect(cols.minimalCredit.x, yPosition, cols.minimalCredit.width, 8);
    pdf.rect(cols.noCredit.x, yPosition, cols.noCredit.width, 8);
    
    pdf.text('Criteria', cols.criteria.x + 2, yPosition + 5);
    pdf.text('Points', cols.points.x + 2, yPosition + 5);
    pdf.text('Full Credit', cols.fullCredit.x + 2, yPosition + 5);
    pdf.text('Partial Credit', cols.partialCredit.x + 2, yPosition + 5);
    pdf.text('Minimal Credit', cols.minimalCredit.x + 2, yPosition + 5);
    pdf.text('No Credit', cols.noCredit.x + 2, yPosition + 5);
    
    yPosition += 8;
    
    // Add questions in table format
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const result = questionResults.find(r => r.questionNumber === question.questionNumber);
      
      // Calculate row height needed
      const rowHeight = 20;
      
      // Check if we need a new page
      if (yPosition + rowHeight > 270) {
        pdf.addPage();
        yPosition = 20;
      }
      
      // Get standards text
      let standardsText = 'Not analyzed';
      if (result && result.consensusStandards) {
        if (typeof result.consensusStandards === 'string') {
          standardsText = result.consensusStandards;
        } else if (Array.isArray(result.consensusStandards)) {
          standardsText = result.consensusStandards.map(s => s.code || s).join(', ');
        } else if (result.consensusStandards.code) {
          standardsText = result.consensusStandards.code;
        }
      }
      
      // Get rigor level as chili peppers
      let rigorDisplay = '🌶️';
      if (result && result.consensusRigorLevel) {
        const rigor = result.consensusRigorLevel.toLowerCase();
        if (rigor === 'mild') rigorDisplay = '🌶️';
        else if (rigor === 'medium') rigorDisplay = '🌶️🌶️';
        else if (rigor === 'spicy') rigorDisplay = '🌶️🌶️🌶️';
      }
      
      // Draw row borders
      pdf.setDrawColor(0, 0, 0);
      pdf.rect(cols.criteria.x, yPosition, cols.criteria.width, rowHeight);
      pdf.rect(cols.points.x, yPosition, cols.points.width, rowHeight);
      pdf.rect(cols.fullCredit.x, yPosition, cols.fullCredit.width, rowHeight);
      pdf.rect(cols.partialCredit.x, yPosition, cols.partialCredit.width, rowHeight);
      pdf.rect(cols.minimalCredit.x, yPosition, cols.minimalCredit.width, rowHeight);
      pdf.rect(cols.noCredit.x, yPosition, cols.noCredit.width, rowHeight);
      
      // Fill content
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      
      // Criteria column
      const questionTitle = `Q${question.questionNumber}: ${question.questionText.substring(0, 50)}...`;
      const wrappedQuestion = pdf.splitTextToSize(questionTitle, cols.criteria.width - 4);
      pdf.text(wrappedQuestion, cols.criteria.x + 2, yPosition + 4);
      pdf.setFontSize(8);
      pdf.text(standardsText, cols.criteria.x + 2, yPosition + 16);
      
      // Points column (rigor)
      pdf.setFontSize(12);
      pdf.text(rigorDisplay, cols.points.x + 5, yPosition + 10);
      
      // Full Credit column
      pdf.setFontSize(8);
      pdf.text('✓', cols.fullCredit.x + 15, yPosition + 6);
      pdf.setFontSize(7);
      pdf.text('Demonstrates complete', cols.fullCredit.x + 2, yPosition + 10);
      pdf.text('understanding with', cols.fullCredit.x + 2, yPosition + 13);
      pdf.text('accurate solution.', cols.fullCredit.x + 2, yPosition + 16);
      
      // Partial Credit column
      pdf.text('✓', cols.partialCredit.x + 15, yPosition + 6);
      pdf.text('Shows understanding', cols.partialCredit.x + 2, yPosition + 10);
      pdf.text('with minor errors in', cols.partialCredit.x + 2, yPosition + 13);
      pdf.text('computation.', cols.partialCredit.x + 2, yPosition + 16);
      
      // Minimal Credit column
      pdf.text('✓', cols.minimalCredit.x + 15, yPosition + 6);
      pdf.text('Attempts solution', cols.minimalCredit.x + 2, yPosition + 10);
      pdf.text('but with significant', cols.minimalCredit.x + 2, yPosition + 13);
      pdf.text('errors.', cols.minimalCredit.x + 2, yPosition + 16);
      
      // No Credit column
      pdf.text('✗', cols.noCredit.x + 15, yPosition + 6);
      pdf.text('No attempt or', cols.noCredit.x + 2, yPosition + 10);
      pdf.text('entirely incorrect.', cols.noCredit.x + 2, yPosition + 13);
      
      yPosition += rowHeight;
    }
    
    // Overall Assessment Summary
    if (yPosition > 180) {
      pdf.addPage();
      yPosition = 30;
    }
    
    // Section separator
    pdf.line(20, yPosition + 15, 190, yPosition + 15);
    
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Overall Standards Mastery Summary', 105, yPosition + 30, { align: 'center' } as any);
    pdf.setFont('helvetica', 'normal');
    yPosition += 45;
    
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Standards Mastered (Level 3-4):', 20, yPosition);
    pdf.setFont('helvetica', 'normal');
    pdf.text('_________________________________', 105, yPosition);
    yPosition += 18;
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Standards Approaching (Level 2):', 20, yPosition);
    pdf.setFont('helvetica', 'normal');
    pdf.text('_________________________________', 105, yPosition);
    yPosition += 18;
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Standards Not Yet Demonstrated (Level 1):', 20, yPosition);
    pdf.setFont('helvetica', 'normal');
    pdf.text('____________________', 130, yPosition);
    yPosition += 25;
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Next Steps for Learning:', 20, yPosition);
    pdf.setFont('helvetica', 'normal');
    yPosition += 12;
    pdf.rect(20, yPosition, 170, 30);
    
    // Footer
    yPosition += 40;
    pdf.setFontSize(8);
    pdf.text('Standards Sherpa - Professional Standards-Based Assessment Tool', 105, yPosition, { align: 'center' } as any);
    
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