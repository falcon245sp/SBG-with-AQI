import { storage } from '../storage';
import { aiService } from './aiService';
import { rigorAnalyzer } from './rigorAnalyzer';
import * as fs from 'fs';
import * as path from 'path';
import PDFExtract from 'pdf-extract';
import mammoth from 'mammoth';

export class DocumentProcessor {
  async processDocument(documentId: string, callbackUrl?: string): Promise<void> {
    try {
      console.log(`Starting processing for document: ${documentId}`);
      
      // Update status to processing
      await storage.updateDocumentStatus(documentId, 'processing');
      
      const document = await storage.getDocument(documentId);
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      // Extract text from document
      const extractedText = await this.extractTextFromFile(
        document.originalPath,
        document.mimeType
      );
      
      // Update document with extracted text
      await storage.updateDocumentStatus(documentId, 'processing');
      
      // Parse questions from extracted text
      const questions = await this.parseQuestions(extractedText);
      
      // Create question records
      const questionRecords = [];
      for (let i = 0; i < questions.length; i++) {
        const question = await storage.createQuestion({
          documentId: document.id,
          questionNumber: i + 1,
          questionText: questions[i].text,
          context: questions[i].context,
        });
        questionRecords.push(question);
      }

      // Process each question with all AI engines
      for (const question of questionRecords) {
        await this.processQuestion(question, document.jurisdictions);
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

  private async extractTextFromFile(filePath: string, mimeType: string): Promise<string> {
    try {
      switch (mimeType) {
        case 'application/pdf':
          return await this.extractFromPDF(filePath);
        
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          return await this.extractFromWord(filePath);
        
        default:
          throw new Error(`Unsupported file type: ${mimeType}`);
      }
    } catch (error) {
      console.error('Text extraction error:', error);
      throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractFromPDF(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const extract = new PDFExtract();
      extract.extract(filePath, {}, (err: any, data: any) => {
        if (err) {
          reject(err);
          return;
        }
        
        let text = '';
        data.pages.forEach((page: any) => {
          page.content.forEach((item: any) => {
            if (item.str) {
              text += item.str + ' ';
            }
          });
        });
        
        resolve(text.trim());
      });
    });
  }

  private async extractFromWord(filePath: string): Promise<string> {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  private async parseQuestions(text: string): Promise<Array<{ text: string; context: string }>> {
    // Simple question parsing - look for numbered questions
    const questions = [];
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    let currentQuestion = '';
    let currentContext = '';
    let inQuestion = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check if line starts with a number followed by a period or parenthesis
      const questionMatch = trimmedLine.match(/^(\d+)[\.\)]\s*(.+)/);
      
      if (questionMatch) {
        // Save previous question if exists
        if (inQuestion && currentQuestion) {
          questions.push({
            text: currentQuestion.trim(),
            context: currentContext.trim()
          });
        }
        
        // Start new question
        currentQuestion = questionMatch[2];
        currentContext = '';
        inQuestion = true;
      } else if (inQuestion) {
        // Check if this looks like an answer choice (A, B, C, D)
        if (trimmedLine.match(/^[A-Z][\.\)]\s/)) {
          currentQuestion += ' ' + trimmedLine;
        } else if (trimmedLine.length > 10) { // Context line
          currentContext += ' ' + trimmedLine;
        } else {
          currentQuestion += ' ' + trimmedLine;
        }
      }
    }
    
    // Don't forget the last question
    if (inQuestion && currentQuestion) {
      questions.push({
        text: currentQuestion.trim(),
        context: currentContext.trim()
      });
    }
    
    // If no numbered questions found, treat the whole text as one question
    if (questions.length === 0 && text.trim().length > 0) {
      questions.push({
        text: text.trim(),
        context: ''
      });
    }
    
    return questions;
  }

  private async processQuestion(question: any, jurisdictions: string[]): Promise<void> {
    try {
      // Get AI analyses from all three engines
      const aiResults = await aiService.analyzeQuestion(
        question.questionText,
        question.context || '',
        jurisdictions
      );

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
      console.error(`Error processing question ${question.id}:`, error);
      // Continue processing other questions even if one fails
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
