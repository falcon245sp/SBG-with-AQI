import { storage } from '../storage';
import { aiService } from './aiService';
import { rigorAnalyzer } from './rigorAnalyzer';
import * as fs from 'fs';
import * as path from 'path';
import PDFExtract from 'pdf-extract';
import mammoth from 'mammoth';

export class DocumentProcessor {
  async processDocument(
    documentId: string, 
    callbackUrl?: string, 
    focusStandards?: string[]
  ): Promise<void> {
    try {
      console.log(`Starting processing for document: ${documentId}`);
      
      // Update status to processing
      await storage.updateDocumentStatus(documentId, 'processing');
      
      const document = await storage.getDocument(documentId);
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      // Send document directly to AI engines for OCR and analysis
      const analysisResults = focusStandards && focusStandards.length > 0
        ? await aiService.analyzeDocumentWithStandards(
            document.originalPath,
            document.mimeType,
            document.jurisdictions,
            focusStandards
          )
        : await aiService.analyzeDocument(
            document.originalPath,
            document.mimeType,
            document.jurisdictions
          );
      
      // Create question records from AI analysis
      const questionRecords = [];
      for (let i = 0; i < analysisResults.questions.length; i++) {
        const questionData = analysisResults.questions[i];
        const question = await storage.createQuestion({
          documentId: document.id,
          questionNumber: i + 1,
          questionText: questionData.text,
          context: questionData.context || '',
        });
        questionRecords.push({ ...question, aiResults: questionData.aiResults });
      }

      // Store AI analysis results for each question
      for (const question of questionRecords) {
        await this.storeAIResults(question, question.aiResults);
      }

      // Update status to completed
      await storage.updateDocumentStatus(documentId, 'completed');
      
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
      console.error(`Error processing document ${documentId}:`, error);
      await storage.updateDocumentStatus(documentId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      
      if (callbackUrl) {
        await this.sendCallback(callbackUrl, {
          documentId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  private async storeAIResults(question: any, aiResults: any): Promise<void> {
    try {
      // Store individual AI responses
      await storage.createAiResponse({
        questionId: question.id,
        aiEngine: 'chatgpt',
        standardsIdentified: aiResults.chatgpt.standards,
        rigorLevel: aiResults.chatgpt.rigor.level,
        rigorJustification: aiResults.chatgpt.rigor.justification,
        confidence: aiResults.chatgpt.rigor.confidence.toString(),
        rawResponse: aiResults.chatgpt.rawResponse,
        processingTime: aiResults.chatgpt.processingTime,
      });

      await storage.createAiResponse({
        questionId: question.id,
        aiEngine: 'grok',
        standardsIdentified: aiResults.grok.standards,
        rigorLevel: aiResults.grok.rigor.level,
        rigorJustification: aiResults.grok.rigor.justification,
        confidence: aiResults.grok.rigor.confidence.toString(),
        rawResponse: aiResults.grok.rawResponse,
        processingTime: aiResults.grok.processingTime,
      });

      await storage.createAiResponse({
        questionId: question.id,
        aiEngine: 'claude',
        standardsIdentified: aiResults.claude.standards,
        rigorLevel: aiResults.claude.rigor.level,
        rigorJustification: aiResults.claude.rigor.justification,
        confidence: aiResults.claude.rigor.confidence.toString(),
        rawResponse: aiResults.claude.rawResponse,
        processingTime: aiResults.claude.processingTime,
      });

      // Consolidate responses using voting
      const consensusResult = rigorAnalyzer.consolidateResponses(aiResults);

      // Store consensus result
      await storage.createQuestionResult({
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

export const documentProcessor = new DocumentProcessor();
