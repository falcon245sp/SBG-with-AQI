import { storage } from '../storage';
import { ProcessingStatus, TeacherReviewStatus, AssetType, ExportType, AiEngine, RigorLevel, GradeSubmissionStatus, BusinessDefaults } from "../../shared/businessEnums";
import { DatabaseWriteService } from './databaseWriteService';
import { aiService } from './aiService';
import { debugLogger } from './debugLogger';
// Removed rigorAnalyzer - using direct AI responses now
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);
import mammoth from 'mammoth';

export class DocumentProcessor {
  async processDocument(
    documentId: string, 
    callbackUrl?: string, 
    focusStandards?: string[]
  ): Promise<void> {
    // Declare uploadedFileId at function scope so it's accessible in error handling
    let uploadedFileId: string | undefined;
    
    try {
      // console.log(`\n🚀 DOCUMENT PROCESSING STARTED: ${documentId}`);
      // console.log(`📄 Processing parameters: callbackUrl=${!!callbackUrl}, focusStandards=${focusStandards?.length || 0}`);
      
      logger.documentProcessing('Starting document processing', {
        documentId,
        component: 'DocumentProcessor',
        operation: 'processDocument'
      });
      
      // Update status to processing
      await DatabaseWriteService.updateDocumentStatus(documentId, ProcessingStatus.PROCESSING);
      
      const document = await storage.getDocument(documentId);
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      // Initialize debug logging
      await debugLogger.initializeLog(
        documentId,
        document.customerUuid,
        document.name,
        document.fileSize,
        document.mimeType
      );

      logger.documentProcessing('Document retrieved', {
        documentId,
        fileName: document.name,
        fileSize: document.fileSize,
        component: 'DocumentProcessor'
      });

      // Try OpenAI Assistants API for PDF upload (file_ids work with Assistants API, not Chat Completions)
      let analysisResults: any;
      let extractedText: string | undefined;
      const courseContext = document.courseTitle || undefined;
      
      try {
        // Upload PDF to OpenAI and use ChatGPT's two-pass method
        logger.documentProcessing('Starting OpenAI file upload for ChatGPT two-pass analysis', {
          documentId,
          fileName: document.originalPath,
          component: 'DocumentProcessor'
        });
        
        uploadedFileId = await aiService.uploadFileToOpenAI(document.originalPath);
        
        logger.documentProcessing('Starting ChatGPT two-pass analysis', {
          documentId,
          component: 'DocumentProcessor',
          operation: 'chatgptTwoPassAnalysis'
        });
        
        // Use ChatGPT's two-pass method with file attachment
        const fileAnalysisResult = await aiService.analyzeTwoPassWithFile(
          [uploadedFileId],
          document.jurisdictions,
          courseContext,
          documentId,
          document.customerUuid
        );
        
        analysisResults = fileAnalysisResult;
        
        logger.documentProcessing('ChatGPT two-pass analysis completed', {
          documentId,
          component: 'DocumentProcessor',
          operation: 'chatgptTwoPassAnalysis'
        });
        
      } catch (fileUploadError) {
        console.log(`⚠️ ChatGPT two-pass analysis failed, falling back to text extraction: ${fileUploadError instanceof Error ? fileUploadError.message : 'Unknown error'}`);
        
        // Cleanup uploaded file if it exists
        if (uploadedFileId) {
          await aiService.deleteFileFromOpenAI(uploadedFileId);
          uploadedFileId = undefined;
        }
        
        // Fallback to text extraction approach
        logger.documentProcessing('Starting text extraction fallback', {
          documentId,
          fileName: document.originalPath,
          component: 'DocumentProcessor'
        });
        
        extractedText = await this.extractTextFromDocument(document.originalPath, document.mimeType);
        
        if (!extractedText || extractedText.trim().length === 0) {
          throw new Error('No text content could be extracted from the document');
        }
        
        // Log extracted text for debugging
        await debugLogger.logDocumentExtraction(documentId, extractedText);
        
        logger.documentProcessing('Text extraction completed', {
          documentId,
          component: 'DocumentProcessor',
          operation: 'textExtraction'
        });
        
        // Send extracted text to AI engines for analysis using new ChatGPT Responses API
        logger.documentProcessing('Starting ChatGPT two-pass analysis with text input', {
          documentId,
          component: 'DocumentProcessor',
          operation: 'chatgptTwoPassTextAnalysis'
        });
        
        analysisResults = await aiService.analyzeTwoPassWithText(
          extractedText,
          document.jurisdictions,
          courseContext,
          documentId,
          document.customerUuid
        );
        
        logger.documentProcessing('ChatGPT two-pass text analysis completed', {
          documentId,
          component: 'DocumentProcessor',
          operation: 'chatgptTwoPassTextAnalysis'
        });
      }
      
      // Create question records from AI analysis
      logger.documentProcessing('AI analysis completed', {
        documentId,
        component: 'DocumentProcessor',
        operation: 'aiAnalysis'
      });
      
      logger.debug('Questions extracted from AI analysis', {
        documentId,
        component: 'DocumentProcessor',
        operation: 'questionExtraction'
      });
      
      // Debug logging: Start DB storage phase
      await debugLogger.logDbStorageStart(documentId);
      
      const questionRecords = [];
      for (let i = 0; i < analysisResults.questions.length; i++) {
        const questionData = analysisResults.questions[i];
        const question = await DatabaseWriteService.createQuestion({
          documentId: document.id,
          questionNumber: String(i + 1), // Use sequential numbering
          questionText: questionData.instruction_text,
          context: questionData.context || '',
        });
        questionRecords.push({ ...question, aiResults: questionData.aiResults });
      }

      // Store AI analysis results for each question with direct AI pipeline
      // console.log(`\n🔄 PROCESSING ${questionRecords.length} QUESTIONS WITH NEW DIRECT AI PIPELINE`);
      
      for (const question of questionRecords) {
        // console.log(`📝 About to process question ${question.questionNumber} with NEW PIPELINE`);
        await this.storeAIResultsWithJsonVoting(question, question.aiResults);
        // Note: storeAIResultsWithJsonVoting returns void and directly stores results to database
      }
      console.log(`✅ COMPLETED PROCESSING ALL QUESTIONS WITH NEW PIPELINE\n`);

      // Debug logging: Complete DB storage phase (using empty arrays for legacy compatibility)
      await debugLogger.logDbStorageResults(
        documentId, 
        questionRecords, 
        [], // storedAiResponses - no longer collected as results are stored directly
        []  // storedResults - no longer collected as results are stored directly
      );

      // Update status to completed
      await DatabaseWriteService.updateDocumentStatus(documentId, ProcessingStatus.COMPLETED);
      
      // Set teacher review status to 'not_reviewed' - AI analysis complete, awaiting teacher review
      // Documents will only be generated after teacher approval via "Accept and Proceed" or override workflow
      
      // Clean up any existing generated documents for this source document (overwrite on re-submission)
      await storage.deleteGeneratedDocumentsForSource(documentId);
      await storage.clearExportQueueForDocument(documentId);
      
      // DO NOT auto-generate exports - wait for teacher review
      // Exports are now triggered only after teacher review status is "reviewed_and_accepted" or "reviewed_and_overridden"
      
      // No export processing until teacher review is complete
      
      // Send callback notification if provided
      if (callbackUrl) {
        await this.sendCallback(callbackUrl, {
          documentId,
          status: ProcessingStatus.COMPLETED,
          resultsUrl: `/api/documents/${documentId}/results`
        });
      }

      // console.log(`Completed processing for document: ${documentId}`);
      
      // Cleanup uploaded files after successful processing
      if (uploadedFileId) {
        console.log(`🧹 Cleaning up uploaded file: ${uploadedFileId}`);
        await aiService.deleteFileFromOpenAI(uploadedFileId);
      }
      
    } catch (error) {
      // Cleanup uploaded files in case of error
      if (uploadedFileId) {
        console.log(`🧹 Cleaning up uploaded file due to error: ${uploadedFileId}`);
        await aiService.deleteFileFromOpenAI(uploadedFileId);
      }
      console.error(`=== DOCUMENT PROCESSING FAILURE ANALYSIS ===`);
      console.error('Document ID:', documentId);
      console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('Callback URL:', callbackUrl || 'None');
      
      // Additional context logging
      try {
        const document = await storage.getDocument(documentId);
        console.error('Document details:', {
          fileName: document?.fileName,
          fileSize: document?.fileSize,
          mimeType: document?.mimeType,
          status: document?.status,
          jurisdictions: document?.jurisdictions
        });
      } catch (docError) {
        console.error('Could not retrieve document details:', docError);
      }
      
      console.error('=== END PROCESSING FAILURE ANALYSIS ===');
      
      await DatabaseWriteService.updateDocumentStatus(documentId, ProcessingStatus.FAILED, error instanceof Error ? error.message : 'Unknown error');
      
      // Debug logging: Log DB storage error
      await debugLogger.logDbStorageResults(
        documentId, 
        [], 
        [], 
        [], 
        error instanceof Error ? error.message : 'Unknown processing error'
      );
      
      if (callbackUrl) {
        await this.sendCallback(callbackUrl, {
          documentId,
          status: ProcessingStatus.FAILED,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  private async storeAIResultsWithJsonVoting(question: any, aiResults: any): Promise<void> {
    try {
      console.log(`\n===== DIRECT AI TO DRAFT ANALYSIS =====`);
      console.log(`Processing AI results for question ${question.id} (${question.questionNumber})`);
      console.log(`Question Text: ${question.questionText?.substring(0, 100)}...`);
      console.log('Raw AI results received:', JSON.stringify(aiResults, null, 2));
      
      // Extra debug for first 4 questions (should be MILD)
      if (parseInt(question.questionNumber) <= 4) {
        console.log(`\n[MILD CHECK] Question ${question.questionNumber} Raw AI Data:`);
        if (aiResults.grok?.rigor) {
          console.log(`[MILD CHECK] - Grok Rigor Raw: ${JSON.stringify(aiResults.grok.rigor)}`);
        }
        if (aiResults.claude?.rigor) {
          console.log(`[MILD CHECK] - Claude Rigor Raw: ${JSON.stringify(aiResults.claude.rigor)}`);
        }
      }
      
      // Validate AI result exists  
      const aiResult = aiResults.openai || aiResults.grok || aiResults.claude;
      if (!aiResult) {
        throw new Error('No AI analysis result found');
      }
      
      console.log(`Using AI result from engine: ${aiResult.aiEngine || 'unknown'}`);
      console.log('Direct AI standards:', JSON.stringify(aiResult.standards));
      console.log('Direct AI rigor:', JSON.stringify(aiResult.rigor));
      
      // Store raw AI response for reference (optional - keep for debugging)
      await this.storeIndividualAIResponses(question, { [aiResult.aiEngine || 'openai']: aiResult });
      
      // NO CONSENSUS - Use AI response directly as DRAFT
      await DatabaseWriteService.createQuestionResult({
        questionId: question.id,
        consensusStandards: aiResult.standards || [],
        consensusRigorLevel: aiResult.rigor?.level || 'mild',
        standardsVotes: {}, // No voting needed
        rigorVotes: {}, // No voting needed  
        confidenceScore: (aiResult.rigor?.confidence || 0.8).toString(),
      });
      
      // Extra debug for first 4 questions
      if (parseInt(question.questionNumber) <= 4) {
        console.log(`\n[MILD CHECK] Question ${question.questionNumber} DRAFT Analysis (Direct from AI):`);
        console.log(`[MILD CHECK] - Standards: ${JSON.stringify(aiResult.standards)}`);
        console.log(`[MILD CHECK] - Rigor Level: ${aiResult.rigor?.level}`);
        console.log(`[MILD CHECK] - Confidence: ${aiResult.rigor?.confidence}`);
      }
      console.log(`===== END DIRECT AI TO DRAFT =====\n`);
      
      console.log(`Successfully stored DRAFT analysis for question ${question.id} directly from AI response`);
    } catch (error) {
      console.error(`=== DETAILED ERROR ANALYSIS for question ${question.id} ===`);
      console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('Raw AI results structure:', JSON.stringify(aiResults, null, 2));
      console.error('Question details:', JSON.stringify(question, null, 2));
      console.error('=== END ERROR ANALYSIS ===');
      
      throw error; // No fallback needed - direct AI storage
    }
  }
  

  
  private async storeIndividualAIResponses(question: any, enhancedResults: any): Promise<void> {
    try {
      // Find the first available AI result
      const engineKeys = Object.keys(enhancedResults);
      if (engineKeys.length === 0) {
        throw new Error('No AI results found in enhanced results');
      }
      
      const engineKey = engineKeys[0];
      const aiResult = enhancedResults[engineKey];
      
      console.log(`Storing individual AI response for ${engineKey} engine`);
      console.log(`${engineKey} result details:`, {
        hasStandards: !!aiResult.standards,
        standardsCount: aiResult.standards?.length || 0,
        rigorLevel: aiResult.rigor?.level,
        confidence: aiResult.rigor?.confidence,
        processingTime: aiResult.processingTime
      });
      
      await DatabaseWriteService.createAIResponse({
        questionId: question.id,
        aiEngine: engineKey,
        standardsIdentified: aiResult.standards || [],
        rigorLevel: aiResult.rigor?.level || 'mild',
        rigorJustification: aiResult.rigor?.justification || 'No justification provided',
        confidence: (aiResult.rigor?.confidence || 0.5).toString(),
        rawResponse: aiResult.rawResponse || {},
        processingTime: aiResult.processingTime || 0,
      });
      
      console.log(`Successfully stored ${engineKey} AI response`);
    } catch (error) {
      console.error('Error storing individual AI responses:', error);
      console.error('Enhanced results structure:', JSON.stringify(enhancedResults, null, 2));
      throw error;
    }
  }




  private async extractTextFromDocument(filePath: string, mimeType: string): Promise<string> {
    try {
      console.log(`Extracting text from ${mimeType} file: ${filePath}`);
      
      if (mimeType === 'application/pdf') {
        return await this.extractTextFromPDF(filePath);
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                 mimeType === 'application/msword') {
        return await this.extractTextFromWord(filePath);
      } else {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }
    } catch (error) {
      console.error(`Error extracting text from ${filePath}:`, error);
      throw error;
    }
  }
  
  private async extractTextFromPDF(filePath: string): Promise<string> {
    try {
      console.log(`Extracting text from PDF using PDFMiner: ${filePath}`);
      
      // Get absolute path to the Python script
      const scriptPath = path.join(process.cwd(), 'server', 'scripts', 'extract_pdf_text.py');
      
      // Execute Python script with the PDF file path
      const { stdout, stderr } = await execAsync(`python3 "${scriptPath}" "${filePath}"`);
      
      if (stderr) {
        console.warn(`PDFMiner warnings: ${stderr}`);
      }
      
      // Parse JSON response from Python script
      const result = JSON.parse(stdout.trim());
      
      if (!result.success) {
        throw new Error(result.error || 'PDF extraction failed');
      }
      
      if (!result.text || result.text.trim().length === 0) {
        throw new Error('No text content found in PDF');
      }
      
      console.log(`Successfully extracted ${result.length} characters from PDF`);
      return result.text.trim();
      
    } catch (error) {
      console.error(`PDF extraction error:`, error);
      throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async extractTextFromWord(filePath: string): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      
      if (!result.value || result.value.trim().length === 0) {
        throw new Error('No text content found in Word document');
      }
      
      return result.value.trim();
    } catch (error) {
      throw new Error(`Word document extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Automatically generate common exports after document processing completes
   */
  private async autoGenerateExports(documentId: string): Promise<void> {
    try {
      console.log(`[DocumentProcessor] Auto-generating exports for document: ${documentId}`);
      
      // Generate common exports that teachers typically need
      const commonExports: ExportType[] = [ExportType.RUBRIC_PDF, ExportType.COVER_SHEET];
      
      for (const exportType of commonExports) {
        try {
          await DatabaseWriteService.queueDocumentExport(documentId, exportType, 0);
          console.log(`[DocumentProcessor] Queued ${exportType} generation for document: ${documentId}`);
        } catch (error) {
          console.warn(`[DocumentProcessor] Failed to queue ${exportType} for document ${documentId}:`, error);
        }
      }
      
      console.log(`[DocumentProcessor] Auto-export generation completed for document: ${documentId}`);
    } catch (error) {
      console.error(`[DocumentProcessor] Error during auto-export generation:`, error);
      // Don't throw - export generation failure shouldn't break main processing
    }
  }

  private async sendCallback(callbackUrl: string, data: any): Promise<void> {
    try {
      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        console.error(`Callback failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Callback error:', error);
    }
  }
}

// Event-driven queue processor class for handling sequential document processing
export class QueueProcessor {
  private isProcessing = false;
  private isStarted = false;

  constructor(private processor: DocumentProcessor) {}

  start() {
    if (this.isStarted) {
      return; // Already started
    }

    this.isStarted = true;
    console.log('Event-driven queue processor started and ready');
    
    // Don't automatically process - only process when items are added
  }

  stop() {
    this.isStarted = false;
    console.log('Queue processor stopped');
  }

  // Push: Add item to queue and start processing if not already processing
  async addToQueue(documentId: string, priority = 0): Promise<void> {
    if (!this.isStarted) {
      throw new Error('Queue processor not started');
    }

    console.log(`📥 PUSH: Adding document ${documentId} to queue (priority: ${priority})`);
    await storage.addToProcessingQueue(documentId, priority);
    console.log(`💾 Document ${documentId} added to storage queue`);
    
    // Start processing if not already processing
    if (!this.isProcessing) {
      console.log(`⚡ Queue was idle, starting processing immediately for ${documentId}`);
      this.processNext();
    } else {
      console.log(`⏳ Queue processor is busy, document ${documentId} will be processed next`);
    }
  }

  // Pop: Process next item in queue
  private async processNext(): Promise<void> {
    if (!this.isStarted || this.isProcessing) {
      return;
    }

    const nextItem = await storage.getNextQueueItem();
    if (!nextItem) {
      console.log('Queue is empty, processor going idle');
      return; // No items in queue - stop processing
    }

    this.isProcessing = true;
    console.log(`📤 POP: Processing document from queue: ${nextItem.documentId}`);

    try {
      // Check if document still exists and is pending
      const document = await storage.getDocument(nextItem.documentId);
      console.log(`🔍 Document status check: ${nextItem.documentId} status=${document?.status}`);
      
      if (!document || document.status !== 'pending') {
        console.log(`⏭️  SKIPPING document ${nextItem.documentId} - invalid status: ${document?.status}`);
        await storage.removeFromQueue(nextItem.id);
        this.isProcessing = false;
        // Try next item since we skipped this one
        this.processNext();
        return;
      }

      // Brief delay to allow UI to show queue status
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Process the document
      console.log(`🎯 CALLING PROCESSOR.processDocument(${nextItem.documentId})`);
      await this.processor.processDocument(nextItem.documentId);
      
      // Remove from queue after successful processing
      await storage.removeFromQueue(nextItem.id);
      console.log(`Successfully processed and removed from queue: ${nextItem.documentId}`);
      
    } catch (error) {
      console.error('Queue processing error:', error);
    } finally {
      this.isProcessing = false;
      // Only continue processing if we're still started and processed an item
      if (this.isStarted) {
        console.log('Processing complete, checking for next item...');
        // Use setTimeout to prevent stack overflow and allow other operations
        setTimeout(() => this.processNext(), 100);
      }
    }
  }

  // Get current processing status
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      isRunning: this.isStarted
    };
  }
}

export const documentProcessor = new DocumentProcessor();
export const queueProcessor = new QueueProcessor(documentProcessor);
