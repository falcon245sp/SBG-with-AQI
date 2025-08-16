import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { documentProcessor } from "./services/documentProcessor";
import { insertDocumentSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
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
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log('Auth Debug - User ID:', userId);
      const user = await storage.getUser(userId);
      console.log('Auth Debug - User from DB:', user);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Document upload endpoint
  app.post('/api/documents/upload', isAuthenticated, upload.single('document'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
  app.get('/api/documents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documents = await storage.getUserDocuments(userId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Get document details with results
  app.get('/api/documents/:id/results', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
  app.get('/api/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  // API Key management
  app.post('/api/api-keys', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  app.get('/api/api-keys', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      
      // Start processing
      documentProcessor.processDocument(document.id, callbackUrl).catch(console.error);

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
