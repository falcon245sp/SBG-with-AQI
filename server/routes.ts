import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { documentProcessor } from "./services/documentProcessor";
import { insertDocumentSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { PromptCustomization, aiService } from "./services/aiService";
import path from "path";
import fs from "fs";

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', async (req: any, res) => {
    // Mock user for testing
    res.json({
      id: 'test-user-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      profileImageUrl: null
    });
  });

  // Document upload with custom prompt endpoint
  app.post('/api/documents/upload-with-prompt', upload.single('document'), async (req: any, res) => {
    try {
      const userId = 'test-user-123'; // Mock user ID
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { customerId, jurisdictions, promptCustomization } = req.body;
      
      // Parse prompt customization if provided
      let customization: PromptCustomization | undefined;
      if (promptCustomization) {
        try {
          customization = JSON.parse(promptCustomization);
        } catch (error) {
          return res.status(400).json({ message: "Invalid prompt customization JSON" });
        }
      }
      
      // Validate request data
      const validationResult = insertDocumentSchema.safeParse({
        customerId: parseInt(customerId),
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

      // Create document record
      const document = await storage.createDocument(userId, validationResult.data);
      
      // Add to processing queue
      await storage.addToProcessingQueue(document.id);
      
      // Start processing asynchronously with custom prompt
      documentProcessor.processDocument(document.id, undefined, customization).catch(console.error);

      res.json({ 
        message: "Document uploaded successfully with custom analysis configuration",
        documentId: document.id,
        customPromptUsed: !!customization
      });
    } catch (error) {
      console.error("Error uploading document with custom prompt:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  // Document upload endpoint
  app.post('/api/documents/upload', upload.single('document'), async (req: any, res) => {
    try {
      const userId = 'test-user-123'; // Mock user ID
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { customerId, jurisdictions } = req.body;
      
      // Validate request data
      const validationResult = insertDocumentSchema.safeParse({
        customerId: parseInt(customerId),
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

      // Create document record
      const document = await storage.createDocument(userId, validationResult.data);
      
      // Add to processing queue
      await storage.addToProcessingQueue(document.id);
      
      // Start processing asynchronously
      documentProcessor.processDocument(document.id).catch(console.error);

      res.json({ 
        message: "Document uploaded successfully",
        documentId: document.id 
      });
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  // Get user documents
  app.get('/api/documents', async (req: any, res) => {
    try {
      const userId = 'test-user-123'; // Mock user ID
      const documents = await storage.getUserDocuments(userId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Get document details with results
  app.get('/api/documents/:id/results', async (req: any, res) => {
    try {
      const userId = 'test-user-123'; // Mock user ID
      const { id } = req.params;
      
      const document = await storage.getDocument(id);
      if (!document || document.userId !== userId) {
        return res.status(404).json({ message: "Document not found" });
      }

      const results = await storage.getDocumentResults(id);
      
      res.json({
        document,
        results
      });
    } catch (error) {
      console.error("Error fetching document results:", error);
      res.status(500).json({ message: "Failed to fetch document results" });
    }
  });

  // Get processing stats
  app.get('/api/stats', async (req: any, res) => {
    try {
      const userId = 'test-user-123'; // Mock user ID
      const stats = await storage.getProcessingStats(userId);
      const rigorDistribution = await storage.getRigorDistribution(userId);
      
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
      const userId = 'test-user-123'; // Mock user ID
      const { name, description, customization } = req.body;
      
      if (!name || !customization) {
        return res.status(400).json({ message: "Name and customization are required" });
      }

      // Validate customization structure
      const validCustomization: PromptCustomization = {
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
      const userId = 'test-user-123'; // Mock user ID
      
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

  app.post('/api/test-prompt', async (req: any, res) => {
    try {
      const { questionText, context, jurisdictions, customization } = req.body;
      
      if (!questionText) {
        return res.status(400).json({ message: "Question text is required" });
      }

      // Test the custom prompt with a sample analysis
      const testResults = await aiService.analyzeQuestionWithCustomPrompt(
        questionText,
        context || 'Test analysis context',
        jurisdictions || ['Common Core'],
        customization
      );

      res.json({
        message: "Prompt test completed",
        results: testResults,
        promptUsed: !!customization
      });
    } catch (error) {
      console.error("Error testing prompt:", error);
      res.status(500).json({ message: "Failed to test prompt" });
    }
  });

  // API Key management
  app.post('/api/api-keys', async (req: any, res) => {
    try {
      const userId = 'test-user-123'; // Mock user ID
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
      const userId = 'test-user-123'; // Mock user ID
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

      const { customerId, jurisdictions, callbackUrl } = req.body;
      
      const validationResult = insertDocumentSchema.safeParse({
        customerId: parseInt(customerId),
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

      const document = await storage.createDocument(validatedKey.userId, validationResult.data);
      await storage.addToProcessingQueue(document.id);
      
      // Parse prompt customization if provided
      let customization: PromptCustomization | undefined;
      if (req.body.promptCustomization) {
        try {
          customization = JSON.parse(req.body.promptCustomization);
        } catch (error) {
          console.warn('Invalid prompt customization JSON:', error);
        }
      }
      
      // Start processing
      documentProcessor.processDocument(document.id, callbackUrl, customization).catch(console.error);

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

  const httpServer = createServer(app);
  return httpServer;
}
