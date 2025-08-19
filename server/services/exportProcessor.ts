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
    
    // Header with consistent formatting
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Standards-Based Grading Rubric', 105, 25, { align: 'center' } as any);
    pdf.setFont('helvetica', 'normal');
    
    // Horizontal line under title
    pdf.line(20, 30, 190, 30);
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Assessment:', 20, 45);
    pdf.setFont('helvetica', 'normal');
    pdf.text(document.fileName, 55, 45);
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Student Name:', 20, 60);
    pdf.setFont('helvetica', 'normal');
    pdf.text('_________________________________', 65, 60);
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Date:', 120, 60);
    pdf.setFont('helvetica', 'normal');
    pdf.text('______________', 135, 60);
    
    let yPosition = 80;
    
    // Add questions with standards-based grading
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const result = questionResults.find(r => r.questionNumber === question.questionNumber);
      
      // Question header
      pdf.setFontSize(14);
      pdf.text(`Question ${question.questionNumber}`, 20, yPosition);
      yPosition += 15;
      
      // Standards and Rigor information in a clean box
      if (result) {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Standard:', 25, yPosition);
        pdf.setFont('helvetica', 'normal');
        // Handle JSONB consensus_standards field
        let standardsText = 'Not analyzed';
        if (result.consensusStandards) {
          if (typeof result.consensusStandards === 'string') {
            standardsText = result.consensusStandards;
          } else if (Array.isArray(result.consensusStandards)) {
            standardsText = result.consensusStandards.map(s => s.code || s).join(', ');
          } else if (result.consensusStandards.code) {
            standardsText = result.consensusStandards.code;
          }
        }
        
        pdf.text(standardsText, 55, yPosition);
        
        pdf.setFont('helvetica', 'bold');
        pdf.text('Rigor:', 120, yPosition);
        pdf.setFont('helvetica', 'normal');
        pdf.text(result.consensusRigorLevel || 'Not analyzed', 140, yPosition);
        
        // Light border around standards info
        pdf.setDrawColor(200, 200, 200);
        pdf.rect(20, yPosition - 5, 170, 12);
        pdf.setDrawColor(0, 0, 0);
        yPosition += 15;
      }
      
      // Question text (wrapped)
      pdf.setFontSize(10);
      const questionLines = pdf.splitTextToSize(question.questionText, 170);
      pdf.text(questionLines, 20, yPosition);
      yPosition += questionLines.length * 5 + 15;
      
      // Standards-Based Grading Scale (4-point) with better formatting
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Mastery Level (check one):', 20, yPosition);
      pdf.setFont('helvetica', 'normal');
      yPosition += 12;
      
      // Create a bordered section for the grading scale
      const scaleStartY = yPosition;
      pdf.setFontSize(9);
      
      // Level 4: Demonstrates Full Mastery
      pdf.rect(25, yPosition, 6, 6);
      pdf.setFont('helvetica', 'bold');
      pdf.text('4 - Demonstrates Full Mastery', 35, yPosition + 4);
      pdf.setFont('helvetica', 'normal');
      pdf.text('(Exceeds expectations, shows deep understanding)', 40, yPosition + 10);
      yPosition += 16;
      
      // Level 3: Demonstrates Mastery with Unrelated Mistakes
      pdf.rect(25, yPosition, 6, 6);
      pdf.setFont('helvetica', 'bold');
      pdf.text('3 - Demonstrates Mastery with Unrelated Mistakes', 35, yPosition + 4);
      pdf.setFont('helvetica', 'normal');
      pdf.text('(Meets expectations, minor errors don\'t affect understanding)', 40, yPosition + 10);
      yPosition += 16;
      
      // Level 2: Does Not Demonstrate Mastery
      pdf.rect(25, yPosition, 6, 6);
      pdf.setFont('helvetica', 'bold');
      pdf.text('2 - Does Not Demonstrate Mastery', 35, yPosition + 4);
      pdf.setFont('helvetica', 'normal');
      pdf.text('(Approaching expectations, significant gaps in understanding)', 40, yPosition + 10);
      yPosition += 16;
      
      // Level 1: No Attempt
      pdf.rect(25, yPosition, 6, 6);
      pdf.setFont('helvetica', 'bold');
      pdf.text('1 - No Attempt', 35, yPosition + 4);
      pdf.setFont('helvetica', 'normal');
      pdf.text('(No evidence of understanding or no response provided)', 40, yPosition + 10);
      yPosition += 20;
      
      // Border around the entire grading scale
      pdf.setDrawColor(150, 150, 150);
      pdf.rect(20, scaleStartY - 3, 170, yPosition - scaleStartY + 3);
      pdf.setDrawColor(0, 0, 0);
      
      // Evidence/Notes section
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Evidence/Notes:', 20, yPosition + 8);
      pdf.setFont('helvetica', 'normal');
      yPosition += 15;
      pdf.rect(20, yPosition, 170, 20);
      yPosition += 30;
      
      // Start new page if needed
      if (yPosition > 220) {
        pdf.addPage();
        yPosition = 30;
      }
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