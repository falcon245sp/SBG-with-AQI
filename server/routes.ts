import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import { 
  initiateGoogleAuth, 
  initiateClassroomAuth,
  handleGoogleCallback, 
  syncClassroomData,
  getUserClassrooms,
  getCurrentUser 
} from "./routes/googleAuth";
import { checkAuthStatus } from "./routes/auth";
import { documentProcessor, queueProcessor } from "./services/documentProcessor";
import { insertDocumentSchema, insertTeacherOverrideSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { aiService } from "./services/aiService";
import path from "path";
import fs from "fs";
import { SessionCleanup } from "./utils/sessionCleanup";

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit per file
    files: 10, // Maximum 10 files per request
    fields: 10, // Allow additional form fields
    fieldSize: 1024 * 1024 // 1MB limit for text fields
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.google-apps.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Word, and Google Docs are allowed.'));
    }
  }
});

// Password hashing utilities
async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Import the proper Replit Auth middleware
import { setupAuth } from './replitAuth';
import { CustomerLookupService } from './services/customerLookupService';

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Replit Auth first
  await setupAuth(app);

  // Get current user route - uses session-based authentication
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Check if user is authenticated via session userId 
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get user from database using session user ID
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Google OAuth routes with renamed environment variables (workaround for Replit conflicts)
  app.get('/api/auth/google', (req, res, next) => {
    console.log('[DEBUG] /api/auth/google route hit');
    next();
  }, initiateGoogleAuth);
  app.get('/api/auth/google/classroom', initiateClassroomAuth);
  app.get('/api/auth/google/callback', handleGoogleCallback);
  app.post('/api/auth/sync-classroom', syncClassroomData);
  app.get('/api/classrooms', getUserClassrooms);

  // Document upload with standards focus endpoint
  app.post('/api/documents/upload-with-standards', upload.single('document'), async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const customerUuid = user.customerUuid; // Use customer UUID for business operations
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { jurisdictions, focusStandards } = req.body;
      
      // Parse focus standards if provided
      let standards: string[] = [];
      if (focusStandards) {
        try {
          standards = typeof focusStandards === 'string' 
            ? focusStandards.split(',').map((s: string) => s.trim()).filter(Boolean)
            : focusStandards;
        } catch (error) {
          return res.status(400).json({ message: "Invalid focus standards format" });
        }
      }
      
      // Parse jurisdictions with Common Core as default
      let parsedJurisdictions: string[] = ['Common Core'];
      if (jurisdictions && jurisdictions.trim()) {
        parsedJurisdictions = jurisdictions.split(',').map((j: string) => j.trim()).filter(Boolean).slice(0, 3);
      }
      
      // Validate request data
      const validationResult = insertDocumentSchema.safeParse({
        fileName: file.originalname,
        originalPath: file.path,
        mimeType: file.mimetype,
        fileSize: file.size,
        jurisdictions: parsedJurisdictions,
      });

      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request data",
          errors: validationResult.error.errors 
        });
      }

      // Create document record
      const document = await storage.createDocument(customerUuid, validationResult.data);
      
      // Add to event-driven processing queue
      await queueProcessor.addToQueue(document.id);
      
      // Processing will be handled by the queue processor

      res.json({ 
        message: "Document uploaded successfully with focus standards",
        documentId: document.id,
        focusStandards: standards
      });
    } catch (error) {
      console.error("Error uploading document with focus standards:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  // Document upload endpoint - uses session-based auth
  app.post('/api/documents/upload', upload.any(), async (req: any, res) => {
    try {
      // Get authenticated user's customer UUID
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const customerUuid = user.customerUuid;
      const files = (req.files as Express.Multer.File[]) || [];
      
      console.log(`=== UPLOAD DEBUG ===`);
      console.log(`Raw req.files:`, req.files);
      console.log(`Parsed files array length: ${files.length}`);
      console.log(`Files:`, files.map(f => ({ name: f.originalname, size: f.size, fieldname: f.fieldname })));
      console.log(`Form body:`, req.body);
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const { jurisdictions, focusStandards, callbackUrl } = req.body;
      
      // Parse jurisdictions with Common Core as default
      let parsedJurisdictions: string[] = ['Common Core'];
      if (jurisdictions && jurisdictions.trim()) {
        parsedJurisdictions = jurisdictions.split(',').map((j: string) => j.trim()).filter(Boolean).slice(0, 3);
      }
      
      // Process each file and create separate documents
      const jobs = [];
      const errors = [];
      
      for (const file of files) {
        try {
          // Validate request data for each file
          const validationResult = insertDocumentSchema.safeParse({
            fileName: file.originalname,
            originalPath: file.path,
            mimeType: file.mimetype,
            fileSize: file.size,
            jurisdictions: parsedJurisdictions,
          });

          if (!validationResult.success) {
            errors.push({
              fileName: file.originalname,
              error: `Invalid file data: ${validationResult.error.errors.map(e => e.message).join(', ')}`
            });
            continue;
          }

          // Create document record
          const document = await storage.createDocument(customerUuid, validationResult.data);
          
          console.log(`Created document ${document.id} for file ${file.originalname}`);
          
          // Add to event-driven processing queue  
          await queueProcessor.addToQueue(document.id);
          console.log(`Added document ${document.id} to event-driven queue`);
          
          // Processing will be handled by the queue processor
          
          jobs.push({
            jobId: document.id,
            fileName: file.originalname,
            status: 'submitted',
            estimatedCompletionTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            progress: 0,
            currentStep: 'queued'
          });
        } catch (fileError) {
          console.error(`Failed to process file ${file.originalname}:`, fileError);
          errors.push({
            fileName: file.originalname,
            error: fileError instanceof Error ? fileError.message : 'Failed to process file'
          });
        }
      }
      
      // Return response matching the multi-file format
      const response: any = {
        totalFiles: files.length,
        successfulSubmissions: jobs.length,
        failedSubmissions: errors.length,
        jobs
      };

      if (errors.length > 0) {
        response.errors = errors;
      }

      if (jobs.length === 0) {
        return res.status(500).json({
          error: 'all_uploads_failed',
          message: 'All file uploads failed',
          ...response
        });
      }

      const statusCode = errors.length > 0 ? 207 : 202; // 207 Multi-Status if some failed
      
      console.log(`Upload complete: ${jobs.length} jobs created, ${errors.length} errors`);
      console.log(`=== END UPLOAD DEBUG ===`);
      
      // For backwards compatibility, also include single-file response format
      if (jobs.length === 1 && files.length === 1) {
        response.message = "Document uploaded successfully";
        response.documentId = jobs[0].jobId;
        response.jobId = jobs[0].jobId;
        response.status = jobs[0].status;
        response.estimatedCompletionTime = jobs[0].estimatedCompletionTime;
      } else {
        response.message = `${jobs.length} of ${files.length} documents uploaded successfully`;
      }
      
      res.status(statusCode).json(response);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  // Get user documents
  app.get('/api/documents', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const customerUuid = await CustomerLookupService.requireCustomerUuid(userId);
      const documents = await storage.getUserDocuments(customerUuid);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Get document details with results
  app.get('/api/documents/:id/results', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const customerUuid = await CustomerLookupService.requireCustomerUuid(userId);
      const { id } = req.params;
      
      const document = await storage.getDocument(id);
      if (!document) {
        console.log(`Document not found: ${id}`);
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (document.customerUuid !== customerUuid) {
        console.log(`Document ${id} belongs to different customer: ${document.customerUuid} vs ${customerUuid}`);
        return res.status(404).json({ message: "Document not found" });
      }

      console.log(`Fetching results for document ${id}, customer ${customerUuid}`);
      const results = await storage.getDocumentResults(id, customerUuid);
      console.log(`Found ${results.length} results for document ${id}`);
      
      // Debug: Check if results is valid
      console.log('Results first item sample:', results[0] ? {
        id: results[0].id,
        questionNumber: results[0].questionNumber,
        hasResult: !!results[0].result,
        hasAiResponses: results[0].aiResponses?.length || 0
      } : 'No results');
      
      res.json({
        document,
        results
      });
    } catch (error) {
      console.error("Error fetching document results:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ message: "Failed to fetch document results" });
    }
  });

  // Get processing queue status
  app.get('/api/queue', async (req: any, res) => {
    try {
      const queueItems = await storage.getQueueStatus();
      const processorStatus = queueProcessor.getStatus();
      
      res.json({
        queueSize: queueItems.length,
        items: queueItems,
        processor: processorStatus
      });
    } catch (error) {
      console.error("Error fetching queue status:", error);
      res.status(500).json({ message: "Failed to fetch queue status" });
    }
  });

  // Get processing stats
  app.get('/api/stats', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const customerUuid = await CustomerLookupService.requireCustomerUuid(userId);
      const stats = await storage.getProcessingStats(customerUuid);
      const rigorDistribution = await storage.getRigorDistribution(customerUuid);
      
      res.json({
        ...stats,
        rigorDistribution
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Prompt customization endpoints
  app.post('/api/prompt-templates', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const { name, description, customization } = req.body;
      
      if (!name || !customization) {
        return res.status(400).json({ message: "Name and customization are required" });
      }

      // Validate customization structure - keeping for backward compatibility
      const validCustomization = {
        focusStandards: customization.focusStandards || [],
        educationLevel: customization.educationLevel,
        subject: customization.subject,
        rigorCriteria: customization.rigorCriteria,
        additionalInstructions: customization.additionalInstructions,
        jurisdictionPriority: customization.jurisdictionPriority || [],
        outputFormat: customization.outputFormat || 'standardized'
      };

      // In a real implementation, you'd save this to the database
      // For now, we'll just return success
      const templateId = `template_${Date.now()}`;
      
      res.json({
        id: templateId,
        name,
        description: description || '',
        customization: validCustomization,
        userId,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error creating prompt template:", error);
      res.status(500).json({ message: "Failed to create prompt template" });
    }
  });

  app.get('/api/prompt-templates', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      // In a real implementation, you'd fetch from the database
      // For now, return sample templates
      const sampleTemplates = [
        {
          id: 'template_math_high',
          name: 'High School Mathematics',
          description: 'Specialized analysis for high school math standards',
          customization: {
            educationLevel: 'high',
            subject: 'mathematics',
            focusStandards: ['CCSS.MATH.HSA', 'CCSS.MATH.HSF', 'CCSS.MATH.HSG'],
            outputFormat: 'detailed'
          },
          createdAt: '2024-01-01T00:00:00Z'
        },
        {
          id: 'template_elementary_reading',
          name: 'Elementary Reading Standards',
          description: 'Focus on foundational reading skills',
          customization: {
            educationLevel: 'elementary',
            subject: 'english',
            focusStandards: ['CCSS.ELA-LITERACY.RF', 'CCSS.ELA-LITERACY.RL'],
            rigorCriteria: {
              mild: 'Letter recognition and basic phonics',
              medium: 'Word analysis and simple comprehension',
              spicy: 'Complex text analysis and inference'
            }
          },
          createdAt: '2024-01-01T00:00:00Z'
        }
      ];
      
      res.json(sampleTemplates);
    } catch (error) {
      console.error("Error fetching prompt templates:", error);
      res.status(500).json({ message: "Failed to fetch prompt templates" });
    }
  });

  app.post('/api/test-standards', async (req: any, res) => {
    try {
      const { questionText, context, jurisdictions, focusStandards } = req.body;
      
      if (!questionText) {
        return res.status(400).json({ message: "Question text is required" });
      }

      // Parse focus standards
      let standards: string[] = [];
      if (focusStandards) {
        standards = typeof focusStandards === 'string' 
          ? focusStandards.split(',').map((s: string) => s.trim()).filter(Boolean)
          : focusStandards;
      }

      // Test analysis with focus standards
      const dynamicPrompt = aiService['generatePromptWithStandards'](standards);
      const testResults = await aiService.analyzeQuestion(
        questionText,
        context || 'Test analysis context',
        jurisdictions || ['Common Core']
      );

      res.json({
        message: "Standards test completed",
        results: testResults,
        focusStandards: standards,
        promptPreview: dynamicPrompt.substring(0, 500) + '...'
      });
    } catch (error) {
      console.error("Error testing standards:", error);
      res.status(500).json({ message: "Failed to test standards" });
    }
  });

  // API Key management
  app.post('/api/api-keys', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const { keyName } = req.body;
      
      if (!keyName) {
        return res.status(400).json({ message: "Key name is required" });
      }

      // Generate a random API key
      const apiKey = `dps_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
      const keyHash = Buffer.from(apiKey).toString('base64');
      
      const createdKey = await storage.createApiKey(userId, {
        keyName,
        keyHash,
      });

      res.json({
        id: createdKey.id,
        keyName: createdKey.keyName,
        apiKey, // Only returned once
        createdAt: createdKey.createdAt,
      });
    } catch (error) {
      console.error("Error creating API key:", error);
      res.status(500).json({ message: "Failed to create API key" });
    }
  });

  app.get('/api/api-keys', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const keys = await storage.getUserApiKeys(userId);
      
      // Don't return the actual key hash
      res.json(keys.map(key => ({
        id: key.id,
        keyName: key.keyName,
        isActive: key.isActive,
        lastUsed: key.lastUsed,
        usageCount: key.usageCount,
        createdAt: key.createdAt,
      })));
    } catch (error) {
      console.error("Error fetching API keys:", error);
      res.status(500).json({ message: "Failed to fetch API keys" });
    }
  });

  // Public API endpoint for document submission (requires API key)
  app.post('/api/v1/process-document', upload.single('document'), async (req, res) => {
    try {
      const apiKey = req.headers.authorization?.replace('Bearer ', '');
      
      if (!apiKey) {
        return res.status(401).json({ message: "API key required" });
      }

      const keyHash = Buffer.from(apiKey).toString('base64');
      const validatedKey = await storage.validateApiKey(keyHash);
      
      if (!validatedKey) {
        return res.status(401).json({ message: "Invalid API key" });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { jurisdictions, callbackUrl } = req.body;
      
      const validationResult = insertDocumentSchema.safeParse({
        fileName: file.originalname,
        originalPath: file.path,
        mimeType: file.mimetype,
        fileSize: file.size,
        jurisdictions: jurisdictions.split(',').map((j: string) => j.trim()).slice(0, 3),
      });

      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request data",
          errors: validationResult.error.errors 
        });
      }

      const document = await storage.createDocument(validatedKey.customerUuid, validationResult.data);
      await queueProcessor.addToQueue(document.id);
      
      // Parse focus standards if provided
      let focusStandards: string[] = [];
      if (req.body.focusStandards) {
        try {
          focusStandards = typeof req.body.focusStandards === 'string' 
            ? req.body.focusStandards.split(',').map((s: string) => s.trim()).filter(Boolean)
            : req.body.focusStandards;
        } catch (error) {
          console.warn('Invalid focus standards format:', error);
        }
      }
      
      // Processing will be handled by the queue processor

      res.json({ 
        message: "Document submitted for processing",
        documentId: document.id,
        status: "queued"
      });
    } catch (error) {
      console.error("Error processing API request:", error);
      res.status(500).json({ message: "Failed to process document" });
    }
  });

  // Start the queue processor for sequential document processing
  queueProcessor.start();
  console.log('Queue processor started for sequential document processing');

  // Teacher override endpoints
  app.post('/api/questions/:questionId/override', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const customerUuid = await CustomerLookupService.requireCustomerUuid(userId);
      const questionId = req.params.questionId;
      
      const validationResult = insertTeacherOverrideSchema.safeParse({
        questionId,
        ...req.body
      });

      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid override data",
          errors: validationResult.error.errors 
        });
      }

      // Check if override already exists for this customer/question
      const existingOverride = await storage.getQuestionOverride(questionId, customerUuid);
      
      if (existingOverride) {
        // Update existing override
        await storage.updateTeacherOverride(existingOverride.id, validationResult.data);
        res.json({ message: "Override updated successfully", overrideId: existingOverride.id });
      } else {
        // Create new override
        const override = await storage.createTeacherOverride(customerUuid, validationResult.data);
        res.json({ message: "Override created successfully", overrideId: override.id });
      }
    } catch (error) {
      console.error('Error saving teacher override:', error);
      res.status(500).json({ message: 'Failed to save override' });
    }
  });

  // Get override history for a question
  app.get('/api/questions/:questionId/override-history', async (req: any, res) => {
    try {
      const questionId = req.params.questionId;
      const history = await storage.getQuestionOverrideHistory(questionId);
      res.json(history);
    } catch (error) {
      console.error('Error fetching override history:', error);
      res.status(500).json({ message: 'Failed to fetch override history' });
    }
  });

  // Revert to Sherpa analysis (deactivate current override)
  app.post('/api/questions/:questionId/revert-to-ai', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const customerUuid = await CustomerLookupService.requireCustomerUuid(userId);
      const questionId = req.params.questionId;
      
      console.log(`Processing revert request for question ${questionId}`);
      await storage.revertToAI(questionId, customerUuid);
      console.log(`Successfully reverted question ${questionId} to Sherpa analysis`);
      res.json({ message: "Successfully reverted to Sherpa analysis" });
    } catch (error) {
      console.error('Error reverting to Sherpa:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ 
        message: 'Failed to revert to Sherpa analysis',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/questions/:questionId/override', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const customerUuid = await CustomerLookupService.requireCustomerUuid(userId);
      const questionId = req.params.questionId;
      
      const override = await storage.getQuestionOverride(questionId, customerUuid);
      
      if (override) {
        res.json(override);
      } else {
        res.status(404).json({ message: 'No override found' });
      }
    } catch (error) {
      console.error('Error fetching teacher override:', error);
      res.status(500).json({ message: 'Failed to fetch override' });
    }
  });

  // Session management endpoints
  app.get('/api/admin/sessions/stats', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const stats = await SessionCleanup.getSessionStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching session stats:", error);
      res.status(500).json({ message: "Failed to fetch session stats" });
    }
  });
  
  app.post('/api/admin/sessions/cleanup', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const result = await SessionCleanup.runCleanup();
      res.json({
        message: `Session cleanup completed`,
        deletedCount: result.deletedCount
      });
    } catch (error) {
      console.error("Error running session cleanup:", error);
      res.status(500).json({ message: "Failed to run session cleanup" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
