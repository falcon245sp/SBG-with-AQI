import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import mammoth from 'mammoth';
import { ProcessingJob, ProcessingResult, QuestionResult } from '../types';
import { aiService } from './aiService';
import { rigorAnalyzer } from './rigorAnalyzer';
import { JobStore } from './jobStore';
import { s3Service } from './s3Service';

export class DocumentProcessor {
  private jobStore = new JobStore();

  async processDocument(
    jobId: string,
    job: ProcessingJob
  ): Promise<void> {
    console.log(`Starting document processing for job ${jobId}`);
    
    try {
      // Update job status
      await this.jobStore.updateJobStatus(jobId, 'processing', 10, 'downloading_from_s3');
      
      // Download file from S3
      const fileBuffer = await s3Service.getFileBuffer(job.s3Key);
      
      await this.jobStore.updateJobStatus(jobId, 'processing', 20, 'extracting_text');
      
      // Extract text from document
      const extractedText = await this.extractTextFromBuffer(fileBuffer, job.mimeType, job.fileName);
      if (!extractedText) {
        throw new Error('Failed to extract text from document');
      }
      
      await this.jobStore.updateJobStatus(jobId, 'processing', 30, 'parsing_questions');
      
      // Parse questions from text
      const questions = this.parseQuestions(extractedText);
      if (questions.length === 0) {
        throw new Error('No questions found in document');
      }
      
      console.log(`Found ${questions.length} questions to analyze`);
      await this.jobStore.updateJobStatus(jobId, 'processing', 50, 'ai_analysis');
      
      // Process each question with AI
      const results: QuestionResult[] = [];
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        const progress = 50 + Math.round((i / questions.length) * 40);
        
        await this.jobStore.updateJobStatus(
          jobId, 
          'processing', 
          progress, 
          `analyzing_question_${i + 1}`
        );
        
        try {
          const aiResults = await aiService.analyzeQuestion(
            question.text,
            question.context,
            job.jurisdictions,
            job.focusStandards
          );
          
          const consensusResult = rigorAnalyzer.buildConsensus(aiResults);
          
          results.push({
            questionNumber: question.number,
            questionText: question.text,
            context: question.context,
            consensusStandards: consensusResult.standards,
            consensusRigorLevel: consensusResult.rigorLevel,
            confidenceScore: consensusResult.confidence,
            aiResponses: aiResults.map(result => ({
              aiEngine: result.engine,
              rigorLevel: result.rigor.level,
              rigorJustification: result.rigor.justification,
              confidence: result.rigor.confidence,
              standardsIdentified: result.standards
            }))
          });
        } catch (error) {
          console.error(`Failed to analyze question ${i + 1}:`, error);
          // Add placeholder result for failed analysis
          results.push({
            questionNumber: question.number,
            questionText: question.text,
            context: question.context,
            consensusStandards: [],
            consensusRigorLevel: 'mild',
            confidenceScore: 0,
            aiResponses: [{
              aiEngine: 'error',
              rigorLevel: 'mild',
              rigorJustification: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              confidence: 0,
              standardsIdentified: []
            }]
          });
        }
      }
      
      await this.jobStore.updateJobStatus(jobId, 'processing', 90, 'generating_summary');
      
      // Generate summary
      const summary = this.generateSummary(results);
      
      // Create final result
      const processingResult: ProcessingResult = {
        jobId,
        customerId: job.customerId,
        document: {
          fileName: job.fileName,
          fileSize: job.fileSize,
          mimeType: job.mimeType,
          s3Key: job.s3Key,
          s3Bucket: job.s3Bucket,
          s3Url: job.s3Url,
          processedAt: new Date()
        },
        results,
        summary
      };
      
      // Save results
      await this.jobStore.saveJobResults(jobId, processingResult);
      
      // Complete job
      await this.jobStore.updateJobStatus(jobId, 'completed', 100, 'completed');
      
      console.log(`Document processing completed for job ${jobId}`);
      
      // Send callback notification if provided
      if (job.callbackUrl) {
        await this.sendCallbackNotification(job.callbackUrl, jobId, 'completed');
      }
      
    } catch (error) {
      console.error(`Document processing failed for job ${jobId}:`, error);
      await this.jobStore.updateJobStatus(
        jobId, 
        'failed', 
        0, 
        'error', 
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      // Send callback notification if provided
      if (job.callbackUrl) {
        await this.sendCallbackNotification(job.callbackUrl, jobId, 'failed', error);
      }
    }
  }

  private async extractTextFromBuffer(
    buffer: Buffer, 
    mimeType: string, 
    fileName: string
  ): Promise<string> {
    try {
      switch (mimeType) {
        case 'application/pdf':
          return await this.extractPdfTextFromBuffer(buffer);
        
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          return await this.extractWordTextFromBuffer(buffer);
        
        default:
          throw new Error(`Unsupported file type: ${mimeType}`);
      }
    } catch (error) {
      console.error('Text extraction failed:', error);
      throw new Error(`Failed to extract text from ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractPdfTextFromBuffer(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      // Write buffer to temporary file for PDF processing
      const tempFilePath = `/tmp/pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.pdf`;
      
      fs.writeFileSync(tempFilePath, buffer);
      
      const pythonPath = process.env.PYTHON_PATH || 'python3';
      const scriptPath = path.join(process.cwd(), 'scripts', 'extract_pdf_text.py');
      
      const pythonProcess = spawn(pythonPath, [scriptPath, tempFilePath]);
      
      let output = '';
      let errorOutput = '';
      
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        // Clean up temporary file
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupError) {
          console.warn('Failed to clean up temporary file:', cleanupError);
        }
        
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`PDF extraction failed: ${errorOutput}`));
        }
      });
      
      pythonProcess.on('error', (error) => {
        // Clean up temporary file on error
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupError) {
          console.warn('Failed to clean up temporary file:', cleanupError);
        }
        reject(error);
      });
    });
  }

  private async extractWordTextFromBuffer(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw new Error(`Word document extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseQuestions(text: string): Array<{
    number: string;
    text: string;
    context: string;
  }> {
    const questions: Array<{ number: string; text: string; context: string }> = [];
    
    // Split text into paragraphs and process each one
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].trim();
      
      // Look for question patterns (numbers, letters, or question marks)
      const questionPatterns = [
        /^(\d+)[\.\)]\s*(.+\?.*)/m,  // "1. What is...?" or "1) What is...?"
        /^([a-zA-Z])[\.\)]\s*(.+\?.*)/m,  // "a. What is...?" or "a) What is...?"
        /^(.+\?.*$)/m  // Any line ending with a question mark
      ];
      
      for (const pattern of questionPatterns) {
        const match = paragraph.match(pattern);
        if (match) {
          const questionNumber = match[1] || `Q${questions.length + 1}`;
          const questionText = match[2] || match[1];
          
          // Get context from surrounding paragraphs
          const contextStart = Math.max(0, i - 1);
          const contextEnd = Math.min(paragraphs.length, i + 2);
          const context = paragraphs.slice(contextStart, contextEnd).join('\n\n');
          
          questions.push({
            number: questionNumber,
            text: questionText.trim(),
            context: context.trim()
          });
          break;
        }
      }
    }
    
    // If no questions found with patterns, look for sentences with question marks
    if (questions.length === 0) {
      const sentences = text.split(/[.!?]+/).filter(s => s.includes('?'));
      sentences.forEach((sentence, index) => {
        if (sentence.trim().length > 10) { // Minimum question length
          questions.push({
            number: `Q${index + 1}`,
            text: sentence.trim() + '?',
            context: text.substring(Math.max(0, text.indexOf(sentence) - 200), text.indexOf(sentence) + sentence.length + 200)
          });
        }
      });
    }
    
    return questions;
  }

  private generateSummary(results: QuestionResult[]) {
    const rigorDistribution = {
      mild: results.filter(r => r.consensusRigorLevel === 'mild').length,
      medium: results.filter(r => r.consensusRigorLevel === 'medium').length,
      spicy: results.filter(r => r.consensusRigorLevel === 'spicy').length
    };
    
    const allStandards = results.flatMap(r => r.consensusStandards.map(s => s.code));
    const uniqueStandards = [...new Set(allStandards)];
    
    return {
      totalQuestions: results.length,
      rigorDistribution,
      standardsCoverage: uniqueStandards,
      processingTime: '2-4 minutes'
    };
  }

  private async sendCallbackNotification(
    callbackUrl: string, 
    jobId: string, 
    status: string, 
    error?: any
  ): Promise<void> {
    try {
      const payload = {
        jobId,
        status,
        timestamp: new Date().toISOString(),
        error: error ? (error instanceof Error ? error.message : String(error)) : undefined
      };
      
      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DocumentProcessingService/0.5.0'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        console.warn(`Callback notification failed: ${response.status} ${response.statusText}`);
      } else {
        console.log(`Callback notification sent successfully to ${callbackUrl}`);
      }
    } catch (error) {
      console.error(`Failed to send callback notification to ${callbackUrl}:`, error);
    }
  }
}