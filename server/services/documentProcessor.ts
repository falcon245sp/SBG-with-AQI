import { storage } from '../storage';
import { aiService } from './aiService';
import { rigorAnalyzer } from './rigorAnalyzer';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
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

      // Extract text content from the document
      console.log(`Extracting text from document: ${document.originalPath}`);
      const extractedText = await this.extractTextFromDocument(document.originalPath, document.mimeType);
      
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text content could be extracted from the document');
      }
      
      console.log(`Extracted ${extractedText.length} characters from document`);
      
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

      // Store AI analysis results for each question with JSON voting
      for (const question of questionRecords) {
        await this.storeAIResultsWithJsonVoting(question, question.aiResults);
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

  private async storeAIResultsWithJsonVoting(question: any, aiResults: any): Promise<void> {
    try {
      console.log(`Processing AI results with JSON voting for question ${question.id}`);
      
      // Ensure each AI result has jsonResponse and aiEngine properties
      const enhancedResults = {
        chatgpt: {
          ...aiResults.chatgpt,
          jsonResponse: this.extractJsonFromResponse(aiResults.chatgpt, 'chatgpt'),
          aiEngine: 'chatgpt'
        },
        grok: {
          ...aiResults.grok,
          jsonResponse: this.extractJsonFromResponse(aiResults.grok, 'grok'),
          aiEngine: 'grok'
        },
        claude: {
          ...aiResults.claude,
          jsonResponse: this.extractJsonFromResponse(aiResults.claude, 'claude'),
          aiEngine: 'claude'
        }
      };
      
      // Store individual AI responses
      await this.storeIndividualAIResponses(question, enhancedResults);
      
      // Use new JSON-based consolidation
      const consensusResult = rigorAnalyzer.consolidateJsonResponses(enhancedResults);
      
      // Store consensus result
      await storage.createQuestionResult({
        questionId: question.id,
        consensusStandards: consensusResult.consensusStandards,
        consensusRigorLevel: consensusResult.consensusRigorLevel,
        standardsVotes: consensusResult.standardsVotes,
        rigorVotes: consensusResult.rigorVotes,
        confidenceScore: consensusResult.confidenceScore.toString(),
      });
      
      console.log(`Successfully processed question ${question.id} with JSON voting`);
    } catch (error) {
      console.error(`Error storing AI results with JSON voting for question ${question.id}:`, error);
      // Fallback to original method
      await this.storeAIResults(question, aiResults);
    }
  }
  
  private extractJsonFromResponse(aiResult: any, engineName: string): any {
    try {
      // If jsonResponse already exists, use it
      if (aiResult.jsonResponse) {
        return aiResult.jsonResponse;
      }
      
      // Try to extract JSON from rawResponse
      if (aiResult.rawResponse) {
        let content = '';
        
        if (engineName === 'claude' && aiResult.rawResponse.content) {
          const contentItem = aiResult.rawResponse.content[0];
          content = contentItem && contentItem.type === 'text' ? contentItem.text : '';
        } else if ((engineName === 'chatgpt' || engineName === 'grok') && aiResult.rawResponse.choices) {
          content = aiResult.rawResponse.choices[0]?.message?.content || '';
        }
        
        if (content) {
          const parsed = JSON.parse(content);
          console.log(`Extracted JSON from ${engineName}:`, parsed);
          return parsed;
        }
      }
      
      // Fallback: construct from existing structured data
      return {
        standards: aiResult.standards || [],
        rigor: aiResult.rigor || { level: 'mild', dokLevel: 'DOK 1', justification: 'No data available', confidence: 0.1 }
      };
    } catch (error) {
      console.error(`Error extracting JSON from ${engineName} response:`, error);
      return {
        error: 'Failed to parse JSON response',
        standards: aiResult.standards || [],
        rigor: aiResult.rigor || { level: 'mild', dokLevel: 'DOK 1', justification: 'Parse error', confidence: 0.1 }
      };
    }
  }
  
  private async storeIndividualAIResponses(question: any, enhancedResults: any): Promise<void> {
    await storage.createAiResponse({
      questionId: question.id,
      aiEngine: 'chatgpt',
      standardsIdentified: enhancedResults.chatgpt.standards,
      rigorLevel: enhancedResults.chatgpt.rigor.level,
      rigorJustification: enhancedResults.chatgpt.rigor.justification,
      confidence: enhancedResults.chatgpt.rigor.confidence.toString(),
      rawResponse: enhancedResults.chatgpt.rawResponse,
      processingTime: enhancedResults.chatgpt.processingTime,
    });

    await storage.createAiResponse({
      questionId: question.id,
      aiEngine: 'grok',
      standardsIdentified: enhancedResults.grok.standards,
      rigorLevel: enhancedResults.grok.rigor.level,
      rigorJustification: enhancedResults.grok.rigor.justification,
      confidence: enhancedResults.grok.rigor.confidence.toString(),
      rawResponse: enhancedResults.grok.rawResponse,
      processingTime: enhancedResults.grok.processingTime,
    });

    await storage.createAiResponse({
      questionId: question.id,
      aiEngine: 'claude',
      standardsIdentified: enhancedResults.claude.standards,
      rigorLevel: enhancedResults.claude.rigor.level,
      rigorJustification: enhancedResults.claude.rigor.justification,
      confidence: enhancedResults.claude.rigor.confidence.toString(),
      rawResponse: enhancedResults.claude.rawResponse,
      processingTime: enhancedResults.claude.processingTime,
    });
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
