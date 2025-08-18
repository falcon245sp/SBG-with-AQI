import { storage } from '../storage';
import { DatabaseWriteService } from './databaseWriteService';
import { aiService } from './aiService';
import { rigorAnalyzer } from './rigorAnalyzer';
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
    try {
      logger.documentProcessing('Starting document processing', {
        documentId,
        callbackUrl,
        focusStandards: focusStandards?.length || 0
      });
      
      // Update status to processing
      await DatabaseWriteService.updateDocumentStatus(documentId, 'processing');
      
      const document = await storage.getDocument(documentId);
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      logger.documentProcessing('Document retrieved', {
        documentId,
        mimeType: document.mimeType,
        fileName: document.name,
        fileSize: document.fileSize,
        jurisdictions: document.jurisdictions?.length || 0
      });

      // Extract text content from the document
      logger.documentProcessing('Starting text extraction', {
        documentId,
        originalPath: document.originalPath,
        mimeType: document.mimeType
      });
      
      const extractedText = await this.extractTextFromDocument(document.originalPath, document.mimeType);
      
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text content could be extracted from the document');
      }
      
      logger.documentProcessing('Text extraction completed', {
        documentId,
        extractedLength: extractedText.length,
        extractedWords: extractedText.split(/\s+/).length
      });
      
      // Send extracted text to AI engines for analysis
      const analysisResults = focusStandards && focusStandards.length > 0
        ? await aiService.analyzeDocumentWithStandards(
            extractedText,
            document.mimeType,
            document.jurisdictions,
            focusStandards
          )
        : await aiService.analyzeDocument(
            extractedText,
            document.mimeType,
            document.jurisdictions
          );
      
      // Create question records from AI analysis
      logger.documentProcessing('AI analysis completed', {
        documentId,
        questionsFound: analysisResults.questions.length,
        processingTime: Date.now()
      });
      
      logger.debug('Questions extracted from AI analysis', {
        documentId,
        questions: analysisResults.questions.map((q, i) => ({
          questionNumber: i + 1,
          textPreview: q.text?.substring(0, 100) + '...',
          hasContext: !!q.context,
          hasAiResults: !!q.aiResults
        }))
      });
      
      const questionRecords = [];
      for (let i = 0; i < analysisResults.questions.length; i++) {
        const questionData = analysisResults.questions[i];
        const question = await DatabaseWriteService.createQuestion({
          documentId: document.id,
          questionNumber: String(i + 1), // Use sequential numbering
          questionText: questionData.text,
          context: questionData.context || '',
        });
        questionRecords.push({ ...question, aiResults: questionData.aiResults });
      }

      // Store AI analysis results for each question with JSON voting
      for (const question of questionRecords) {
        await this.storeAIResultsWithJsonVoting(question, question.aiResults);
      }

      // Update status to completed
      await DatabaseWriteService.updateDocumentStatus(documentId, 'completed');
      
      // Clean up any existing generated documents for this source document (overwrite on re-submission)
      await storage.deleteGeneratedDocumentsForSource(documentId);
      await storage.clearExportQueueForDocument(documentId);
      
      // Automatically generate common exports for completed documents
      await this.autoGenerateExports(documentId);
      
      // Trigger export processing
      setTimeout(async () => {
        const { exportProcessor } = await import('./exportProcessor');
        await exportProcessor.processPendingExports();
      }, 1000); // Small delay to ensure export queue items are saved
      
      // Send callback notification if provided
      if (callbackUrl) {
        await this.sendCallback(callbackUrl, {
          documentId,
          status: 'completed',
          resultsUrl: `/api/documents/${documentId}/results`
        });
      }

      console.log(`Completed processing for document: ${documentId}`);
    } catch (error) {
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
      
      await DatabaseWriteService.updateDocumentStatus(documentId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      
      if (callbackUrl) {
        await this.sendCallback(callbackUrl, {
          documentId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  private async storeAIResultsWithJsonVoting(question: any, aiResults: any): Promise<void> {
    try {
      console.log(`Processing AI results for question ${question.id} (Grok only)`);
      console.log('Raw AI results received:', JSON.stringify(aiResults, null, 2));
      
      // Validate Grok result exists
      if (!aiResults.grok) {
        throw new Error('Missing Grok analysis result');
      }
      
      // Ensure Grok result has required properties and extract JSON
      const enhancedResults = {
        grok: {
          ...aiResults.grok,
          jsonResponse: this.extractJsonFromResponse(aiResults.grok, 'grok'),
          aiEngine: 'grok'
        }
      };
      
      console.log('Enhanced results:', JSON.stringify(enhancedResults, null, 2));
      
      // Store individual AI responses (only Grok)
      await this.storeIndividualAIResponses(question, enhancedResults);
      
      // Use single-engine analysis (Grok only)
      const consensusResult = rigorAnalyzer.analyzeSingleEngineResult(enhancedResults);
      console.log('Consensus result:', JSON.stringify(consensusResult, null, 2));
      
      // Store consensus result
      await DatabaseWriteService.createQuestionResult({
        questionId: question.id,
        consensusStandards: consensusResult.consensusStandards,
        consensusRigorLevel: consensusResult.consensusRigorLevel,
        standardsVotes: consensusResult.standardsVotes,
        rigorVotes: consensusResult.rigorVotes,
        confidenceScore: consensusResult.confidenceScore.toString(),
      });
      
      console.log(`Successfully processed question ${question.id} with single-engine analysis`);
    } catch (error) {
      console.error(`=== DETAILED ERROR ANALYSIS for question ${question.id} ===`);
      console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('Raw AI results structure:', JSON.stringify(aiResults, null, 2));
      console.error('Question details:', JSON.stringify(question, null, 2));
      console.error('=== END ERROR ANALYSIS ===');
      
      // Fallback to original method
      try {
        console.log('Attempting fallback storage method...');
        await this.storeAIResults(question, aiResults);
        console.log('Fallback storage succeeded');
      } catch (fallbackError) {
        console.error('Fallback storage also failed:', fallbackError);
        throw error; // Re-throw original error
      }
    }
  }
  
  private extractJsonFromResponse(aiResult: any, engineName: string): any {
    try {
      console.log(`=== JSON EXTRACTION ATTEMPT for ${engineName} ===`);
      console.log('AI result has keys:', Object.keys(aiResult || {}));
      
      // If jsonResponse already exists, use it
      if (aiResult.jsonResponse) {
        console.log('Using existing jsonResponse');
        return aiResult.jsonResponse;
      }
      
      // Try to extract JSON from rawResponse
      if (aiResult.rawResponse) {
        let content = '';
        console.log('Raw response structure:', Object.keys(aiResult.rawResponse));
        
        if (engineName === 'grok' && aiResult.rawResponse.choices) {
          content = aiResult.rawResponse.choices[0]?.message?.content || '';
          console.log('Extracted content from Grok (first 200 chars):', content.substring(0, 200));
        }
        
        if (content) {
          try {
            const parsed = JSON.parse(content);
            console.log(`Successfully extracted JSON from ${engineName}`);
            return parsed;
          } catch (parseError) {
            console.error(`=== JSON PARSE ERROR for ${engineName} ===`);
            console.error('Parse error:', parseError);
            console.error('Content length:', content.length);
            console.error('Content sample:', content.substring(0, 500));
            console.error('=== END PARSE ERROR ===');
            throw parseError;
          }
        } else {
          console.warn(`No content found in ${engineName} rawResponse`);
        }
      } else {
        console.warn(`No rawResponse found for ${engineName}`);
      }
      
      // Fallback: construct from existing structured data
      console.log('Using fallback JSON construction');
      const fallback = {
        standards: aiResult.standards || [],
        rigor: aiResult.rigor || { level: 'mild', dokLevel: 'DOK 1', justification: 'No data available', confidence: 0.1 }
      };
      console.log('Fallback result:', fallback);
      return fallback;
    } catch (error) {
      console.error(`=== JSON EXTRACTION FAILED for ${engineName} ===`);
      console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      console.error('AI result structure:', JSON.stringify(aiResult, (key, value) => {
        if (typeof value === 'string' && value.length > 100) {
          return value.substring(0, 100) + '...[truncated]';
        }
        return value;
      }, 2));
      console.error('=== END JSON EXTRACTION FAILURE ===');
      
      return {
        error: `Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}`,
        standards: aiResult.standards || [],
        rigor: aiResult.rigor || { level: 'mild', dokLevel: 'DOK 1', justification: 'Parse error', confidence: 0.1 }
      };
    }
  }
  
  private async storeIndividualAIResponses(question: any, enhancedResults: any): Promise<void> {
    try {
      console.log('Storing individual AI response for Grok engine');
      
      if (!enhancedResults.grok) {
        throw new Error('Missing Grok result in enhanced results');
      }
      
      const grokResult = enhancedResults.grok;
      console.log('Grok result details:', {
        hasStandards: !!grokResult.standards,
        standardsCount: grokResult.standards?.length || 0,
        rigorLevel: grokResult.rigor?.level,
        confidence: grokResult.rigor?.confidence,
        processingTime: grokResult.processingTime
      });
      
      await DatabaseWriteService.createAIResponse({
        questionId: question.id,
        aiEngine: 'grok',
        standardsIdentified: grokResult.standards || [],
        rigorLevel: grokResult.rigor?.level || 'mild',
        rigorJustification: grokResult.rigor?.justification || 'No justification provided',
        confidence: (grokResult.rigor?.confidence || 0.5).toString(),
        rawResponse: grokResult.rawResponse || {},
        processingTime: grokResult.processingTime || 0,
      });
      
      console.log('Successfully stored Grok AI response');
    } catch (error) {
      console.error('Error storing individual AI responses:', error);
      console.error('Enhanced results structure:', JSON.stringify(enhancedResults, null, 2));
      throw error;
    }
  }

  private async storeAIResults(question: any, aiResults: any): Promise<void> {
    try {
      console.log('Storing AI results (Grok only)');
      
      if (!aiResults.grok) {
        throw new Error('Missing Grok analysis result');
      }
      
      const grokResult = aiResults.grok;
      console.log('Storing Grok result with details:', {
        hasStandards: !!grokResult.standards,
        standardsCount: grokResult.standards?.length || 0,
        rigorLevel: grokResult.rigor?.level,
        confidence: grokResult.rigor?.confidence
      });
      
      // Store Grok AI response
      await DatabaseWriteService.createAIResponse({
        questionId: question.id,
        aiEngine: 'grok',
        standardsIdentified: grokResult.standards || [],
        rigorLevel: grokResult.rigor?.level || 'mild',
        rigorJustification: grokResult.rigor?.justification || 'No justification provided',
        confidence: (grokResult.rigor?.confidence || 0.5).toString(),
        rawResponse: grokResult.rawResponse || {},
        processingTime: grokResult.processingTime || 0,
      });
      
      console.log('Successfully stored Grok AI result');

      // Only store Claude response if it exists
      if (aiResults.claude) {
        await DatabaseWriteService.createAIResponse({
          questionId: question.id,
          aiEngine: 'claude',
          standardsIdentified: aiResults.claude.standards || [],
          rigorLevel: aiResults.claude.rigor?.level || 'mild',
          rigorJustification: aiResults.claude.rigor?.justification || 'No justification provided',
          confidence: (aiResults.claude.rigor?.confidence || 0.5).toString(),
          rawResponse: aiResults.claude.rawResponse || {},
          processingTime: aiResults.claude.processingTime || 0,
        });
      }

      // Use single-engine analysis (Grok only)
      const consensusResult = rigorAnalyzer.analyzeSingleEngineResult(aiResults);

      // Store consensus result
      await DatabaseWriteService.createQuestionResult({
        questionId: question.id,
        consensusStandards: consensusResult.consensusStandards,
        consensusRigorLevel: consensusResult.consensusRigorLevel,
        standardsVotes: consensusResult.standardsVotes,
        rigorVotes: consensusResult.rigorVotes,
        confidenceScore: consensusResult.confidenceScore.toString(),
      });
    } catch (error) {
      console.error(`Error storing AI results for question ${question.id}:`, error);
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
      
      // Import dynamically to avoid circular dependency
      const { ExportType } = await import('../utils/documentTagging');
      
      // Generate common exports that teachers typically need
      const commonExports: ExportType[] = ['rubric_pdf', 'cover_sheet'];
      
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

    console.log(`PUSH: Adding document ${documentId} to queue`);
    await storage.addToProcessingQueue(documentId, priority);
    
    // Start processing if not already processing
    if (!this.isProcessing) {
      console.log('Queue was idle, starting processing immediately');
      this.processNext();
    } else {
      console.log('Queue processor is busy, item will be processed next');
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
    console.log(`POP: Processing document from queue: ${nextItem.documentId}`);

    try {
      // Check if document still exists and is pending
      const document = await storage.getDocument(nextItem.documentId);
      if (!document || document.status !== 'pending') {
        console.log(`Skipping document ${nextItem.documentId} - invalid status: ${document?.status}`);
        await storage.removeFromQueue(nextItem.id);
        this.isProcessing = false;
        // Try next item since we skipped this one
        this.processNext();
        return;
      }

      // Brief delay to allow UI to show queue status
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Process the document
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
