import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface PipelineDebugData {
  documentId: string;
  customerUuid: string;
  originalFileName: string;
  originalFileSize: number;
  originalMimeType: string;
  
  // Document extraction
  extractedText?: string;
  extractedTextLength?: number;
  
  // Pass 1: Extraction
  pass1Started?: Date;
  pass1Completed?: Date;
  pass1RawResponse?: any;
  pass1ExtractedQuestions?: any[];
  pass1QuestionCount?: number;
  pass1ErrorMessage?: string;
  pass1Checksum?: string;
  
  // Pass 2: Classification
  pass2Started?: Date;
  pass2Completed?: Date;
  pass2Classifications?: any[];
  pass2StandardsFound?: any[];
  pass2RigorLevels?: any[];
  pass2ErrorMessage?: string;
  pass2Checksum?: string;
  
  // Database storage
  dbStorageStarted?: Date;
  dbStorageCompleted?: Date;
  dbStoredQuestions?: any[];
  dbStoredAiResponses?: any[];
  dbStoredResults?: any[];
  dbStorageErrorMessage?: string;
  dbStorageChecksum?: string;
  
  // UX display
  uxDisplayData?: any;
  uxFetchTimestamp?: Date;
  uxErrorMessage?: string;
  uxDisplayChecksum?: string;
  
  // Metadata
  processingVersion: string;
  aiEnginesUsed?: string[];
  totalProcessingTime?: number;
  createdAt: Date;
}

class DebugLogger {
  private debugDir: string;
  
  constructor() {
    this.debugDir = path.join(process.cwd(), 'appdata', 'debug');
  }
  
  private async ensureDebugDir(): Promise<void> {
    try {
      await fs.access(this.debugDir);
    } catch {
      await fs.mkdir(this.debugDir, { recursive: true });
    }
  }
  
  private generateChecksum(data: any): string {
    const jsonString = JSON.stringify(data, null, 0);
    return crypto.createHash('md5').update(jsonString).digest('hex');
  }
  
  async initializeLog(documentId: string, customerUuid: string, fileName: string, fileSize: number, mimeType: string): Promise<PipelineDebugData> {
    await this.ensureDebugDir();
    
    const debugData: PipelineDebugData = {
      documentId,
      customerUuid,
      originalFileName: fileName,
      originalFileSize: fileSize,
      originalMimeType: mimeType,
      processingVersion: 'two-pass-v1',
      createdAt: new Date()
    };
    
    await this.saveDebugData(documentId, debugData);
    console.log(`🔍 [DEBUG] Initialized pipeline log for document: ${fileName} (${documentId})`);
    return debugData;
  }
  
  async logDocumentExtraction(documentId: string, extractedText: string): Promise<void> {
    const debugData = await this.loadDebugData(documentId);
    if (!debugData) return;
    
    debugData.extractedText = extractedText;
    debugData.extractedTextLength = extractedText.length;
    
    await this.saveDebugData(documentId, debugData);
    console.log(`🔍 [DEBUG] Logged document extraction - ${extractedText.length} characters extracted`);
  }
  
  async logPass1Start(documentId: string): Promise<void> {
    const debugData = await this.loadDebugData(documentId);
    if (!debugData) return;
    
    debugData.pass1Started = new Date();
    
    await this.saveDebugData(documentId, debugData);
    console.log(`🔍 [DEBUG] Pass 1 STARTED for ${documentId}`);
  }
  
  async logPass1Results(documentId: string, rawResponse: any, extractedQuestions: any[], errorMessage?: string): Promise<void> {
    const debugData = await this.loadDebugData(documentId);
    if (!debugData) return;
    
    debugData.pass1Completed = new Date();
    debugData.pass1RawResponse = rawResponse;
    debugData.pass1ExtractedQuestions = extractedQuestions;
    debugData.pass1QuestionCount = extractedQuestions.length;
    debugData.pass1ErrorMessage = errorMessage;
    debugData.pass1Checksum = this.generateChecksum({ rawResponse, extractedQuestions });
    
    await this.saveDebugData(documentId, debugData);
    console.log(`🔍 [DEBUG] Pass 1 COMPLETED - extracted ${extractedQuestions.length} questions`);
    if (errorMessage) {
      console.error(`🔍 [DEBUG] Pass 1 ERROR: ${errorMessage}`);
    }
  }
  
  async logPass2Start(documentId: string): Promise<void> {
    const debugData = await this.loadDebugData(documentId);
    if (!debugData) return;
    
    debugData.pass2Started = new Date();
    
    await this.saveDebugData(documentId, debugData);
    console.log(`🔍 [DEBUG] Pass 2 STARTED for ${documentId}`);
  }
  
  async logPass2Results(documentId: string, classifications: any[], standardsFound: any[], rigorLevels: any[], errorMessage?: string): Promise<void> {
    const debugData = await this.loadDebugData(documentId);
    if (!debugData) return;
    
    debugData.pass2Completed = new Date();
    debugData.pass2Classifications = classifications;
    debugData.pass2StandardsFound = standardsFound;
    debugData.pass2RigorLevels = rigorLevels;
    debugData.pass2ErrorMessage = errorMessage;
    debugData.pass2Checksum = this.generateChecksum({ classifications, standardsFound, rigorLevels });
    
    await this.saveDebugData(documentId, debugData);
    console.log(`🔍 [DEBUG] Pass 2 COMPLETED - classified ${classifications.length} questions`);
    if (errorMessage) {
      console.error(`🔍 [DEBUG] Pass 2 ERROR: ${errorMessage}`);
    }
  }
  
  async logDbStorageStart(documentId: string): Promise<void> {
    const debugData = await this.loadDebugData(documentId);
    if (!debugData) return;
    
    debugData.dbStorageStarted = new Date();
    
    await this.saveDebugData(documentId, debugData);
    console.log(`🔍 [DEBUG] Database storage STARTED for ${documentId}`);
  }
  
  async logDbStorageResults(documentId: string, storedQuestions: any[], storedAiResponses: any[], storedResults: any[], errorMessage?: string): Promise<void> {
    const debugData = await this.loadDebugData(documentId);
    if (!debugData) return;
    
    debugData.dbStorageCompleted = new Date();
    debugData.dbStoredQuestions = storedQuestions;
    debugData.dbStoredAiResponses = storedAiResponses;
    debugData.dbStoredResults = storedResults;
    debugData.dbStorageErrorMessage = errorMessage;
    debugData.dbStorageChecksum = this.generateChecksum({ storedQuestions, storedAiResponses, storedResults });
    
    await this.saveDebugData(documentId, debugData);
    console.log(`🔍 [DEBUG] Database storage COMPLETED - stored ${storedQuestions.length} questions`);
    if (errorMessage) {
      console.error(`🔍 [DEBUG] Database storage ERROR: ${errorMessage}`);
    }
  }
  
  async logUxDisplay(documentId: string, displayData: any, errorMessage?: string): Promise<void> {
    const debugData = await this.loadDebugData(documentId);
    if (!debugData) return;
    
    debugData.uxDisplayData = displayData;
    debugData.uxFetchTimestamp = new Date();
    debugData.uxErrorMessage = errorMessage;
    debugData.uxDisplayChecksum = this.generateChecksum(displayData);
    
    await this.saveDebugData(documentId, debugData);
    console.log(`🔍 [DEBUG] UX display data logged for ${documentId}`);
    if (errorMessage) {
      console.error(`🔍 [DEBUG] UX display ERROR: ${errorMessage}`);
    }
  }
  
  async finalizePipelineLog(documentId: string, aiEnginesUsed: string[], totalProcessingTime: number): Promise<void> {
    const debugData = await this.loadDebugData(documentId);
    if (!debugData) return;
    
    debugData.aiEnginesUsed = aiEnginesUsed;
    debugData.totalProcessingTime = totalProcessingTime;
    
    await this.saveDebugData(documentId, debugData);
    console.log(`🔍 [DEBUG] Pipeline logging FINALIZED for ${documentId} - total time: ${totalProcessingTime}ms`);
  }
  
  private async saveDebugData(documentId: string, data: PipelineDebugData): Promise<void> {
    const fileName = `pipeline_${documentId}.json`;
    const filePath = path.join(this.debugDir, fileName);
    
    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Failed to save debug data for ${documentId}:`, error);
    }
  }
  
  private async loadDebugData(documentId: string): Promise<PipelineDebugData | null> {
    const fileName = `pipeline_${documentId}.json`;
    const filePath = path.join(this.debugDir, fileName);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Failed to load debug data for ${documentId}:`, error);
      return null;
    }
  }
  
  async getDebugData(documentId: string): Promise<PipelineDebugData | null> {
    return this.loadDebugData(documentId);
  }
  
  async getAllDebugLogs(): Promise<{ documentId: string; data: PipelineDebugData }[]> {
    await this.ensureDebugDir();
    
    try {
      const files = await fs.readdir(this.debugDir);
      const debugLogs = [];
      
      for (const file of files) {
        if (file.startsWith('pipeline_') && file.endsWith('.json')) {
          const documentId = file.replace('pipeline_', '').replace('.json', '');
          const data = await this.loadDebugData(documentId);
          if (data) {
            debugLogs.push({ documentId, data });
          }
        }
      }
      
      return debugLogs.sort((a, b) => b.data.createdAt.getTime() - a.data.createdAt.getTime());
    } catch (error) {
      console.error('Failed to get all debug logs:', error);
      return [];
    }
  }
}

export const debugLogger = new DebugLogger();