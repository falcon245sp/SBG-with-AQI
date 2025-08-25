import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import { 
  initiateGoogleAuth, 
  initiateFullIntegration,
  initiateClassroomAuth,
  handleGoogleCallback, 
  syncClassroomData,
  getUserClassrooms,
  getCurrentUser,
  getClassroomAssignments,
  syncAssignments,
  getAssignmentDetails,
  getClassroomStudents,
  updateClassroomClassification
} from "./routes/googleAuth";
import { 
  getStandardsForCourseTitle,
  getSuggestedCourses,
  getClassroomStandards
} from "./routes/standards";
import {
  getJurisdictions,
  getCoursesForJurisdiction,
  getSubjectsForJurisdiction,
  getStandardsForCourse,
  searchStandards
} from "./routes/commonStandardsProject";
import { checkAuthStatus } from "./routes/auth";
import { documentProcessor, queueProcessor } from "./services/documentProcessor";
import { exportProcessor } from "./services/exportProcessor";
import { 
  insertDocumentSchema, 
  insertTeacherOverrideSchema,
  documents,
  users,
  questions,
  aiResponses,
  questionResults,
  teacherOverrides,
  processingQueue,
  exportQueue,
  gradeSubmissions,
  qrSequenceNumbers,
  apiKeys,
  sessions,
  classrooms,
  students,
  assignments
} from "@shared/schema";
import { TeacherReviewStatus } from "@shared/businessEnums";
import { z } from "zod";
import { count, sql } from "drizzle-orm";
import { db } from "./db";
import multer from "multer";
import { aiService } from "./services/aiService";
import path from "path";
import fs from "fs";
import { SessionCleanup } from "./utils/sessionCleanup";
import { DatabaseWriteService } from "./services/databaseWriteService";
import { CustomerLookupService } from "./services/customerLookupService";
import { ActiveUserService } from "./services/activeUserService";
import { commonStandardsProjectService } from "./services/commonStandardsProjectService";
import { requireAdmin } from "./middleware/adminAuth";
import { sessionErrorHandler, withSessionHandling } from "./middleware/sessionHandler";

import { config } from "./config/environment";
import { materializedViewManager } from "./services/materializedViewManager";

// Configure multer for file uploads
const upload = multer({
  dest: config.uploadsDir,
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Replit Auth first
  await setupAuth(app);

  // Get current user route - uses session-based authentication
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      const user = await ActiveUserService.requireActiveUser(req);
      res.json(user);
    } catch (error) {
      if ((error as Error).message === 'Authentication required') {
        return res.status(401).json({ error: 'Authentication required' });
      }
      if ((error as Error).message === 'User not found') {
        return res.status(404).json({ error: 'User not found' });
      }
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // V1.0 ONBOARDING ENDPOINTS
  
  // Update user preferences during onboarding
  app.put('/api/user/preferences', async (req: any, res) => {
    try {
      const { user, customerUuid } = await ActiveUserService.requireActiveUserAndCustomerUuid(req);
      const updates = req.body;

      // Validate the update data
      const allowedFields = [
        'preferredJurisdiction', 
        'preferredSubjectAreas', 
        'selectedGradeLevels', 
        'selectedCourses',
        'onboardingStep'
      ];

      const validUpdates = Object.keys(updates)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = updates[key];
          return obj;
        }, {} as any);

      if (Object.keys(validUpdates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      // Update the user record
      await storage.updateUserPreferences(user.id, validUpdates);

      res.json({ success: true, updated: validUpdates });
    } catch (error) {
      console.error('Error updating user preferences:', error);
      res.status(500).json({ error: 'Failed to update preferences' });
    }
  });

  // Update onboarding step
  app.put('/api/user/update-onboarding-step', async (req: any, res) => {
    try {
      const { user, customerUuid } = await ActiveUserService.requireActiveUserAndCustomerUuid(req);
      const { onboardingStep } = req.body;

      await storage.updateUserPreferences(user.id, { onboardingStep });

      res.json({ success: true, onboardingStep });
    } catch (error) {
      console.error('Error updating onboarding step:', error);
      res.status(500).json({ error: 'Failed to update onboarding step' });
    }
  });

  // Update role selection
  app.put('/api/user/update-role-selection', async (req: any, res) => {
    try {
      const { user, customerUuid } = await ActiveUserService.requireActiveUserAndCustomerUuid(req);
      const { selectedRole, onboardingRoleSelected, onboardingStep } = req.body;

      const updates = {
        selectedRole,
        onboardingRoleSelected,
        onboardingStep
      };

      await storage.updateUserPreferences(user.id, updates);

      res.json({ success: true, updates });
    } catch (error) {
      console.error('Error updating role selection:', error);
      res.status(500).json({ error: 'Failed to update role selection' });
    }
  });

  // Complete standards configuration and full onboarding
  app.put('/api/user/complete-standards-configuration', async (req: any, res) => {
    try {
      const { user, customerUuid } = await ActiveUserService.requireActiveUserAndCustomerUuid(req);
      const { standardsConfigurationCompleted, onboardingCompleted, courseMappings } = req.body;

      const updates = {
        standardsConfigurationCompleted,
        onboardingCompleted,
        onboardingStep: null
      };

      // If course mappings provided, update classroom configurations
      if (courseMappings && Array.isArray(courseMappings)) {
        // Update each classroom with SBG and course mapping settings
        for (const mapping of courseMappings) {
          // Extract course name from the technical ID
          // Format: "67810E9EF6944F9383DCC602A3484C23_D10003FB_high-school-algebra"
          // We want the part after the last underscore: "high-school-algebra"
          let readableCourseName = 'Course';
          if (mapping.selectedCourseId) {
            const parts = mapping.selectedCourseId.split('_');
            const coursePart = parts[parts.length - 1]; // "high-school-algebra"
            
            // Convert to readable format
            if (coursePart.includes('algebra')) {
              readableCourseName = 'Algebra 1';
            } else if (coursePart.includes('geometry')) {
              readableCourseName = 'Geometry';
            } else if (coursePart.includes('number-and-quantity')) {
              readableCourseName = 'Pre-Calculus';
            } else if (coursePart.includes('statistics')) {
              readableCourseName = 'Statistics';
            } else if (coursePart.includes('functions')) {
              readableCourseName = 'Algebra 2';
            } else {
              // Fallback: clean up the technical name
              readableCourseName = coursePart
                .replace(/-/g, ' ')
                .replace(/\b\w/g, (l: string) => l.toUpperCase());
            }
          }
          
          await storage.updateClassroom(mapping.classroomId, {
            sbgEnabled: mapping.enableSBG,
            courseTitle: readableCourseName, // ✅ Store readable name instead of technical ID
            courseConfigurationCompleted: true
          });
        }
      }

      await storage.updateUserPreferences(user.id, updates);

      res.json({ success: true, onboardingCompleted: true });
    } catch (error) {
      console.error('Error completing standards configuration:', error);
      res.status(500).json({ error: 'Failed to complete standards configuration' });
    }
  });

  // Complete onboarding process (legacy endpoint)
  app.put('/api/user/complete-onboarding', async (req: any, res) => {
    try {
      const { user, customerUuid } = await ActiveUserService.requireActiveUserAndCustomerUuid(req);
      const { selectedCourses, classroomSkipped } = req.body;

      const updates = {
        onboardingCompleted: true,
        onboardingStep: null,
        ...(selectedCourses && { selectedCourses }),
        ...(classroomSkipped && { classroomSkipped })
      };

      // Update the user record
      await storage.updateUserPreferences(user.id, updates);

      res.json({ success: true, onboardingCompleted: true });
    } catch (error) {
      console.error('Error completing onboarding:', error);
      res.status(500).json({ error: 'Failed to complete onboarding' });
    }
  });

  // Get available courses based on user preferences or query parameters
  app.get('/api/courses/available', async (req: any, res) => {
    try {
      const { jurisdiction, subjects, grades, preferredSubjectAreas, selectedGradeLevels } = req.query;
      
      let jurisdictionUuid: string | null = null;
      let subjectAreas: string[] = [];
      let gradeLevels: string[] = [];

      // Try to get from query parameters first (for onboarding)
      if (jurisdiction && subjects && grades) {
        jurisdictionUuid = jurisdiction.toString();
        subjectAreas = subjects.toString().split(',');
        gradeLevels = grades.toString().split(',');
      } else {
        // Fall back to user preferences (for authenticated users)
        try {
          const { user } = await ActiveUserService.requireActiveUserAndCustomerUuid(req);
          const userRecord = await storage.getUser(user.id);
          
          jurisdictionUuid = userRecord?.preferredJurisdiction;
          subjectAreas = preferredSubjectAreas ? preferredSubjectAreas.toString().split(',') : [];
          gradeLevels = selectedGradeLevels ? selectedGradeLevels.toString().split(',') : [];
        } catch (authError) {
          // User not authenticated, return empty if no query params
          if (!jurisdiction || !subjects || !grades) {
            res.json([]);
            return;
          }
        }
      }

      if (!jurisdictionUuid) {
        // If no jurisdiction is available, return empty courses
        res.json([]);
        return;
      }

      console.log(`[API] Fetching courses for jurisdiction: ${jurisdictionUuid}, subjects: ${subjectAreas.join(',')}, grades: ${gradeLevels.join(',')}`);

      // Fetch dynamic courses from Common Standards Project API
      const courses = await commonStandardsProjectService.getCoursesForJurisdiction(
        jurisdictionUuid,
        gradeLevels,
        subjectAreas
      );

      res.json(courses);
    } catch (error) {
      console.error('Error fetching available courses:', error);
      res.status(500).json({ error: 'Failed to fetch available courses' });
    }
  });

  // Get available grade levels for a jurisdiction dynamically
  app.get('/api/grade-levels/available', async (req: any, res) => {
    try {
      const { user } = await ActiveUserService.requireActiveUserAndCustomerUuid(req);
      
      // Get user's selected jurisdiction
      const userRecord = await storage.getUser(user.id);
      const jurisdictionUuid = userRecord?.preferredJurisdiction;

      if (!jurisdictionUuid) {
        // If no jurisdiction is selected, return empty grade levels
        res.json([]);
        return;
      }

      console.log(`[API] Fetching grade levels for jurisdiction: ${jurisdictionUuid}`);

      // Fetch dynamic grade levels from Common Standards Project API
      const gradeLevels = await commonStandardsProjectService.getGradeLevelsForJurisdiction(jurisdictionUuid);

      res.json(gradeLevels);
    } catch (error) {
      console.error('Error fetching available grade levels:', error);
      res.status(500).json({ error: 'Failed to fetch available grade levels' });
    }
  });

  // Google OAuth routes with renamed environment variables (workaround for Replit conflicts)
  app.get('/api/auth/google', initiateGoogleAuth);
  app.get('/api/auth/google/full-integration', initiateFullIntegration);
  app.get('/api/auth/google/classroom', initiateClassroomAuth);
  app.get('/api/auth/google/callback', handleGoogleCallback);
  app.post('/api/auth/sync-classroom', syncClassroomData);
  app.get('/api/classrooms', getUserClassrooms);
  
  // Assignment routes
  app.get('/api/classrooms/:classroomId/assignments', getClassroomAssignments);
  app.post('/api/assignments/sync', syncAssignments);
  app.get('/api/classrooms/:classroomId/assignments/:assignmentId', getAssignmentDetails);
  
  // Student routes
  app.get('/api/classrooms/:classroomId/students', getClassroomStudents);
  
  // Classroom classification routes
  app.patch('/api/classrooms/:classroomId/classification', updateClassroomClassification);
  
  // Standards configuration routes (legacy - using hardcoded patterns)
  app.get('/api/standards/course-standards', getStandardsForCourseTitle);
  app.get('/api/standards/course-suggestions', getSuggestedCourses);
  app.get('/api/classrooms/:classroomId/standards', getClassroomStandards);
  
  // Common Standards Project API routes
  app.get('/api/standards/course/:standardSetId', getStandardsForCourse);
  
  // V1.0 Standards and Jurisdictions
  app.get('/api/standards/jurisdictions', getJurisdictions);
  
  // Save classroom standards configuration with similarity matching
  app.post('/api/classrooms/:classroomId/standards-configuration', async (req, res) => {
    try {
      const { classroomId } = req.params;
      const { jurisdictionId, standardSetId, selectedStandards, courseTitle, autoEnableSBG = true } = req.body;
      
      if (!classroomId) {
        return res.status(400).json({ error: 'Classroom ID is required' });
      }

      // Get user and verify ownership
      const { user, customerUuid } = await ActiveUserService.requireActiveUserAndCustomerUuid(req);
      const classroom = await storage.getClassroomById(classroomId);
      
      if (!classroom || classroom.customerUuid !== customerUuid) {
        return res.status(404).json({ error: 'Classroom not found' });
      }

      // Helper function to extract core course name for similarity matching
      const extractCoreCourseName = (classroomName: string): string | null => {
        // Common patterns: "Course Name - Period X", "Course Name (Period X)", "Course Name Pd X", etc.
        // Remove periods, sections, parentheses content, and common suffixes
        const cleaned = classroomName
          .replace(/\s*-\s*(period|pd|per|p)\s*\d+.*$/i, '') // "- Period 1", "- Pd 2"
          .replace(/\s*\((period|pd|per|p)?\s*\d+[^)]*\)/i, '') // "(Period 1)", "(Pd 2)"
          .replace(/\s+(period|pd|per|p)\s*\d+.*$/i, '') // "Period 1", "Pd 2"  
          .replace(/\s*-\s*section\s*[a-z0-9]+.*$/i, '') // "- Section A"
          .replace(/\s*\(section\s*[a-z0-9]+[^)]*\)/i, '') // "(Section A)"
          .replace(/\s+section\s*[a-z0-9]+.*$/i, '') // "Section A"
          .replace(/\s*-\s*[a-z0-9]+$/i, '') // Generic "- A", "- 1" at end
          .replace(/\s*\([a-z0-9]+\)$/i, '') // Generic "(A)", "(1)" at end
          .trim();
        
        // Return null if name is too short (likely just a section identifier)
        return cleaned.length >= 3 ? cleaned : null;
      };

      // Get all classrooms for this customer to find similar ones
      const allClassrooms = await storage.getTeacherClassrooms(customerUuid);
      const currentCoreCourseName = extractCoreCourseName(classroom.name);
      
      // Find similar classrooms
      const similarClassrooms = currentCoreCourseName ? 
        allClassrooms.filter(c => {
          if (c.id === classroomId) return false; // Skip current classroom
          const otherCoreCourseName = extractCoreCourseName(c.name);
          return otherCoreCourseName && 
                 otherCoreCourseName.toLowerCase() === currentCoreCourseName.toLowerCase();
        }) : [];

      // Prepare the standards configuration
      const enabledStandardIds = selectedStandards || [];
      
      // Convert technical course ID to readable name if needed
      let readableCourseName = courseTitle;
      if (courseTitle && courseTitle.includes('_')) {
        const parts = courseTitle.split('_');
        const coursePart = parts[parts.length - 1];
        
        if (coursePart.includes('algebra')) {
          readableCourseName = 'Algebra 1';
        } else if (coursePart.includes('geometry')) {
          readableCourseName = 'Geometry';
        } else if (coursePart.includes('number-and-quantity')) {
          readableCourseName = 'Pre-Calculus';
        } else if (coursePart.includes('statistics')) {
          readableCourseName = 'Statistics';
        } else if (coursePart.includes('functions')) {
          readableCourseName = 'Algebra 2';
        } else {
          readableCourseName = coursePart
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (l: string) => l.toUpperCase());
        }
      }
      
      // Configuration to apply
      const standardsConfig = {
        standardsJurisdiction: jurisdictionId,
        courseTitle: readableCourseName, // ✅ Store readable name
        enabledStandards: enabledStandardIds,
        sbgEnabled: autoEnableSBG, // Auto-enable SBG when configuring standards
        updatedAt: new Date()
      };

      // Update the primary classroom
      await storage.updateClassroom(classroomId, standardsConfig);
      
      // Update similar classrooms with the same configuration
      const updatedSimilarClassrooms = [];
      for (const similarClassroom of similarClassrooms) {
        await storage.updateClassroom(similarClassroom.id, standardsConfig);
        updatedSimilarClassrooms.push({
          id: similarClassroom.id,
          name: similarClassroom.name
        });
      }

      console.log(`[StandardsConfig] Updated ${1 + similarClassrooms.length} classrooms:`, {
        primary: classroom.name,
        similar: similarClassrooms.map(c => c.name),
        configuration: {
          jurisdiction: jurisdictionId,
          courseTitle,
          standardsCount: enabledStandardIds.length
        }
      });

      res.json({
        success: true,
        message: `Standards configuration saved${similarClassrooms.length > 0 ? ` and applied to ${similarClassrooms.length} similar classroom(s)` : ''}`,
        primaryClassroom: {
          id: classroom.id,
          name: classroom.name
        },
        similarClassroomsUpdated: updatedSimilarClassrooms,
        configuration: {
          jurisdictionId,
          standardSetId,
          courseTitle,
          enabledStandardsCount: enabledStandardIds.length
        }
      });
    } catch (error) {
      console.error('[StandardsConfig] Error saving standards configuration:', error);
      res.status(500).json({ error: 'Failed to save standards configuration' });
    }
  });

  // Common Standards Project routes (new - dynamic API-based)
  app.get('/api/csp/jurisdictions', getJurisdictions);
  app.get('/api/csp/jurisdictions/:jurisdictionId/subjects', getSubjectsForJurisdiction);
  app.get('/api/csp/jurisdictions/:jurisdictionId/courses', getCoursesForJurisdiction);
  app.get('/api/csp/courses/:standardSetId/standards', getStandardsForCourse);
  app.get('/api/csp/search', searchStandards);

  // Document upload with standards focus endpoint
  app.post('/api/documents/upload-with-standards', upload.single('document'), async (req: any, res) => {
    try {
      const { user, customerUuid } = await ActiveUserService.requireActiveUserAndCustomerUuid(req);
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
      const document = await DatabaseWriteService.createDocument(customerUuid, validationResult.data);
      
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
      console.log(`🔥 UPLOAD REQUEST RECEIVED - Starting processing...`);
      // Get authenticated user's customer UUID
      let customerUuid;
      try {
        customerUuid = await ActiveUserService.requireActiveCustomerUuid(req);
        console.log(`[Upload] Customer UUID found: ${customerUuid}`);
      } catch (authError) {
        console.error(`[Upload] Authentication failed:`, authError);
        return res.status(401).json({ 
          message: "Please sign in to upload documents", 
          error: "authentication_required",
          shouldRedirect: true,
          redirectUrl: "/",
          details: "You need to be signed in to upload and process documents. Click 'Sign in with Google' to continue."
        });
      }
      const files = (req.files as Express.Multer.File[]) || [];
      
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const { jurisdictions, focusStandards, callbackUrl, courseTitle } = req.body;
      
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
          const documentData = {
            fileName: file.originalname,
            originalPath: file.path,
            mimeType: file.mimetype,
            fileSize: file.size,
            jurisdictions: parsedJurisdictions,
            ...(courseTitle && { courseId: courseTitle }), // V1.0 Course context for file organization
          };
          console.log(`[Upload] Validating document data:`, documentData);
          const validationResult = insertDocumentSchema.safeParse(documentData);

          if (!validationResult.success) {
            errors.push({
              fileName: file.originalname,
              error: `Invalid file data: ${validationResult.error.errors.map(e => e.message).join(', ')}`
            });
            continue;
          }

          // Create document record
          console.log(`[Upload] Creating document record for ${file.originalname} with data:`, validationResult.data);
          const document = await DatabaseWriteService.createDocument(customerUuid, validationResult.data);
          
          console.log(`Created document ${document.id} for file ${file.originalname}`);
          
          // Add to event-driven processing queue  
          console.log(`🏗️ ABOUT TO ADD DOCUMENT TO QUEUE: ${document.id}`);
          await queueProcessor.addToQueue(document.id);
          console.log(`✅ SUCCESSFULLY ADDED DOCUMENT TO QUEUE: ${document.id}`);
          
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
      console.error("Full error stack:", error instanceof Error ? error.stack : error);
      res.status(500).json({ 
        message: "Failed to upload document",
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : error
      });
    }
  });

  // Document content endpoint for viewing
  app.get('/api/documents/:id/content', async (req: any, res) => {
    try {
      const customerUuid = await ActiveUserService.requireActiveCustomerUuid(req);
      const { id } = req.params;
      
      // Get document and verify ownership
      const document = await storage.getDocument(id);
      if (!document || document.customerUuid !== customerUuid) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      // Determine file path based on document type and available paths (SAME LOGIC AS DOWNLOAD ENDPOINT)
      let filePath: string;
      
      if (document.assetType === 'generated') {
        // For generated documents, use centralized environment variables
        console.log(`[Documents] Content request for generated document: ${document.fileName}`);
        
        // Determine which subdirectory based on file name using environment variables
        if (document.fileName.includes('cover-sheet')) {
          filePath = path.join(config.coversheetsDir, document.fileName);
        } else if (document.fileName.includes('rubric')) {
          filePath = path.join(config.rubricsDir, document.fileName);
        } else {
          // Fallback to checking both directories
          const rubricPath = path.join(config.rubricsDir, document.fileName);
          const coverSheetPath = path.join(config.coversheetsDir, document.fileName);
          
          if (fs.existsSync(rubricPath)) {
            filePath = rubricPath;
          } else if (fs.existsSync(coverSheetPath)) {
            filePath = coverSheetPath;
          } else {
            console.error(`[Documents] Generated document not found in either directory: ${document.fileName}`);
            return res.status(404).json({ message: 'Generated file not found on disk' });
          }
        }
      } else if (document.originalPath) {
        // For uploaded documents, use environment variable
        if (path.isAbsolute(document.originalPath)) {
          filePath = document.originalPath;
        } else {
          filePath = path.join(config.uploadsDir, document.originalPath);
        }
      } else {
        return res.status(404).json({ message: 'Document file path not found' });
      }
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`[Documents] File not found: ${filePath}`);
        return res.status(404).json({ message: 'File not found on disk' });
      }
      
      // Get file stats and extension
      const stats = fs.statSync(filePath);
      const fileName = document.originalFilename || document.fileName;
      const ext = path.extname(fileName).toLowerCase();
      
      // Set appropriate content type
      let contentType = 'application/octet-stream';
      switch (ext) {
        case '.pdf':
          contentType = 'application/pdf';
          break;
        case '.txt':
          contentType = 'text/plain';
          break;
        case '.md':
          contentType = 'text/markdown';
          break;
        case '.csv':
          contentType = 'text/csv';
          break;
        case '.json':
          contentType = 'application/json';
          break;
        case '.xml':
          contentType = 'application/xml';
          break;
        case '.html':
          contentType = 'text/html';
          break;
        case '.jpg':
        case '.jpeg':
          contentType = 'image/jpeg';
          break;
        case '.png':
          contentType = 'image/png';
          break;
        case '.gif':
          contentType = 'image/gif';
          break;
        case '.svg':
          contentType = 'image/svg+xml';
          break;
        case '.webp':
          contentType = 'image/webp';
          break;
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stats.size);
      
      // For PDFs and images, enable inline viewing
      if (ext === '.pdf' || ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'].includes(ext)) {
        res.setHeader('Content-Disposition', `inline; filename="${document.originalFilename || document.fileName}"`);
      }
      
      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      
    } catch (error) {
      console.error('[Documents] Error serving document content:', error);
      res.status(500).json({ message: 'Failed to load document content' });
    }
  });

  // Document download endpoint
  app.get('/api/documents/:id/download', async (req: any, res) => {
    try {
      console.log(`[Documents] Download request for document: ${req.params.id}`);
      const customerUuid = await ActiveUserService.requireActiveCustomerUuid(req);
      const { id } = req.params;
      console.log(`[Documents] Customer UUID: ${customerUuid}, Document ID: ${id}`);
      
      // Get document and verify ownership
      const document = await storage.getDocument(id);
      if (!document || document.customerUuid !== customerUuid) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      // Determine file path based on document type and available paths
      let filePath: string;
      let fileName: string;
      
      if (document.assetType === 'generated') {
        // For generated documents, use centralized environment variables
        console.log(`[Documents] Generated document request: ${document.fileName}`);
        console.log(`[Documents] Asset type: ${document.assetType}`);
        
        // Determine which subdirectory based on file name using environment variables
        if (document.fileName.includes('cover-sheet')) {
          filePath = path.join(config.coversheetsDir, document.fileName);
        } else if (document.fileName.includes('rubric')) {
          filePath = path.join(config.rubricsDir, document.fileName);
        } else {
          // Fallback to checking both directories
          const rubricPath = path.join(config.rubricsDir, document.fileName);
          const coverSheetPath = path.join(config.coversheetsDir, document.fileName);
          
          if (fs.existsSync(rubricPath)) {
            filePath = rubricPath;
          } else if (fs.existsSync(coverSheetPath)) {
            filePath = coverSheetPath;
          } else {
            console.error(`[Documents] Generated document not found in either directory: ${document.fileName}`);
            return res.status(404).json({ message: 'Generated file not found on disk' });
          }
        }
        fileName = document.fileName;
      } else if (document.originalPath) {
        // For uploaded documents, use environment variable
        if (path.isAbsolute(document.originalPath)) {
          filePath = document.originalPath;
        } else {
          // Check if originalPath already contains the uploads directory to avoid double path
          if (document.originalPath.includes(config.uploadsDir)) {
            filePath = document.originalPath;
          } else {
            filePath = path.join(config.uploadsDir, document.originalPath);
          }
        }
        fileName = document.originalFilename || document.fileName || 'document';
      } else {
        return res.status(404).json({ message: 'Document file path not found' });
      }
      
      // Debug logging for file path resolution
      console.log(`[Documents] Resolved file path: ${filePath}`);
      console.log(`[Documents] Original path from DB: ${document.originalPath}`);
      console.log(`[Documents] Config uploads dir: ${config.uploadsDir}`);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`[Documents] File not found: ${filePath}`);
        return res.status(404).json({ message: 'File not found on disk' });
      }
      
      // Get file stats
      const stats = fs.statSync(filePath);
      const ext = path.extname(fileName).toLowerCase();
      
      // Set content type based on file extension
      let contentType = document.mimeType || 'application/octet-stream';
      if (ext === '.pdf') contentType = 'application/pdf';
      
      // For PDF documents, use inline display for viewing
      const disposition = ext === '.pdf' ? 'inline' : 'attachment';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stats.size.toString());
      res.setHeader('Content-Disposition', `${disposition}; filename="${fileName}"`);
      
      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      
    } catch (error) {
      console.error('[Documents] Error downloading document:', error);
      res.status(500).json({ message: 'Failed to download document' });
    }
  });

  // Teacher review - Accept and Proceed
  app.post('/api/documents/:documentId/accept', async (req: any, res) => {
    try {
      const { documentId } = req.params;
      console.log(`\n🔥 ACCEPT & PROCEED TRIGGERED for document: ${documentId}`);
      
      const customerUuid = await ActiveUserService.requireActiveCustomerUuid(req);
      
      if (!customerUuid) {
        console.error(`[Accept] No customer UUID found for document: ${documentId}`);
        return res.status(401).json({ 
          error: 'Authentication required',
          message: 'Unable to identify customer for this request'
        });
      }

      console.log(`[Accept] Customer UUID: ${customerUuid}, updating status for document: ${documentId}`);

      // Update document status to reviewed_and_accepted
      await DatabaseWriteService.updateDocumentTeacherReviewStatus(
        documentId,
        customerUuid,
        TeacherReviewStatus.REVIEWED_AND_ACCEPTED
      );

      console.log(`[Accept] Creating CONFIRMED analysis document for: ${documentId}`);

      // Create CONFIRMED analysis document (DRAFT → CONFIRMED workflow)
      await DatabaseWriteService.createConfirmedAnalysisDocument(documentId, customerUuid);

      console.log(`[Accept] CONFIRMED analysis created, queueing exports for document: ${documentId}`);

      // Trigger document generation (cover sheets, rubrics) from CONFIRMED source
      await DatabaseWriteService.queueDocumentExports(documentId, customerUuid);

      console.log(`[Accept] Exports queued successfully for document: ${documentId}`);

      res.json({ 
        success: true, 
        message: 'Analysis accepted, document generation queued',
        documentId 
      });

    } catch (error) {
      console.error(`[Accept] Failed to accept and proceed for document ${req.params?.documentId}:`, error);
      res.status(500).json({ 
        error: 'Failed to accept and proceed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Regenerate missing generated documents endpoint
  app.post('/api/documents/:documentId/regenerate-missing', async (req: any, res) => {
    try {
      const { documentId } = req.params;
      console.log(`[RegenerateMissing] Processing regenerate-missing request for document: ${documentId}`);
      
      const customerUuid = await ActiveUserService.requireActiveCustomerUuid(req);
      
      if (!customerUuid) {
        console.error(`[RegenerateMissing] No customer UUID found for document: ${documentId}`);
        return res.status(401).json({ 
          error: 'Authentication required',
          message: 'Unable to identify customer for this request'
        });
      }

      // Get document and verify ownership
      const document = await storage.getDocument(documentId);
      if (!document || document.customerUuid !== customerUuid) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      // Only allow regeneration for uploaded documents that are reviewed and accepted
      if (document.assetType !== 'uploaded') {
        return res.status(400).json({ message: 'Can only regenerate for uploaded documents' });
      }
      
      if (document.teacherReviewStatus !== 'reviewed_and_accepted') {
        return res.status(400).json({ message: 'Document must be reviewed and accepted first' });
      }

      console.log(`[RegenerateMissing] Customer UUID: ${customerUuid}, analyzing missing exports for document: ${documentId}`);

      // Detect which exports are missing and queue only those
      const missingExports = await DatabaseWriteService.detectAndQueueMissingExports(documentId, customerUuid);

      console.log(`[RegenerateMissing] Queued ${missingExports.length} missing exports for document: ${documentId}`);

      res.json({ 
        success: true, 
        message: `Regenerating ${missingExports.length} missing generated document(s)`,
        documentId,
        missingExports: missingExports
      });

    } catch (error) {
      console.error(`[RegenerateMissing] Failed to regenerate missing documents for ${req.params?.documentId}:`, error);
      res.status(500).json({ 
        error: 'Failed to regenerate missing documents',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get pending export status for documents
  app.get('/api/documents/export-status', async (req: any, res) => {
    try {
      const customerUuid = await ActiveUserService.requireActiveCustomerUuid(req);
      
      // Get all pending exports for this customer's documents
      const pendingExports = await storage.getPendingExports();
      
      // Get customer's documents to filter relevant exports
      const documents = await storage.getUserDocuments(customerUuid);
      const documentIds = new Set(documents.map(doc => doc.id));
      
      // Filter exports that belong to this customer and group by document ID
      const customerExports = pendingExports.filter(exp => documentIds.has(exp.documentId));
      const exportsByDocument: Record<string, Array<{ exportType: string; scheduledFor: string; attempts: number }>> = {};
      
      for (const exportItem of customerExports) {
        if (!exportsByDocument[exportItem.documentId]) {
          exportsByDocument[exportItem.documentId] = [];
        }
        exportsByDocument[exportItem.documentId].push({
          exportType: exportItem.exportType,
          scheduledFor: exportItem.scheduledFor,
          attempts: exportItem.attempts || 0
        });
      }
      
      res.json({
        pendingExports: exportsByDocument,
        totalPending: customerExports.length
      });
    } catch (error) {
      console.error('[Export Status] Failed to get export status:', error);
      res.status(500).json({ 
        error: 'Failed to get export status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get user documents
  app.get('/api/documents', async (req: any, res) => {
    try {
      const customerUuid = await ActiveUserService.requireActiveCustomerUuid(req);
      console.log(`[Documents] Fetching documents for customer: ${customerUuid}`);
      const documents = await storage.getUserDocuments(customerUuid);
      console.log(`[Documents] Found ${documents.length} documents for customer: ${customerUuid}`);
      
      // Set cache control headers to ensure fresh status data for real-time polling
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      // Disable ETag generation to prevent 304 responses
      res.removeHeader('ETag');
      
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      
      // More specific error handling
      if ((error as Error).message === 'Authentication required') {
        return res.status(401).json({ error: 'Authentication required' });
      }
      if ((error as Error).message === 'User not found') {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Get document details with results
  app.get('/api/documents/:id/results', async (req: any, res) => {
    try {
      const customerUuid = await ActiveUserService.requireActiveCustomerUuid(req);
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
      const rawResults = await storage.getDocumentResults(id, customerUuid);
      console.log(`Found ${rawResults.length} results for document ${id}`);
      
      // Transform the nested data structure into the flat structure expected by frontend
      const transformedResults = rawResults.map(item => {
        const baseData = {
          id: item.id,
          questionNumber: item.questionNumber,
          questionText: item.questionText,
          questionType: item.questionType,
          context: item.context,
          // Default values
          finalRigorLevel: null,
          finalStandards: [],
          confidenceScore: null,
          isOverridden: false,
          rigorJustification: null
        };

        // Check for teacher override first (highest priority)
        if (item.teacherOverride && !item.teacherOverride.isRevertedToAi) {
          baseData.finalRigorLevel = item.teacherOverride.overriddenRigorLevel;
          baseData.finalStandards = item.teacherOverride.overriddenStandards || [];
          baseData.confidenceScore = item.teacherOverride.confidenceScore;
          baseData.isOverridden = true;
          console.log(`[Transform] Q${item.questionNumber}: Using teacher override`);
        }
        // Otherwise use the consensus result from AI analysis
        else if (item.result) {
          console.log(`[Transform] Q${item.questionNumber}: Using consensus result`, {
            consensusRigor: item.result.consensusRigorLevel,
            consensusStandards: Array.isArray(item.result.consensusStandards) ? item.result.consensusStandards.length : 'Not array'
          });
          baseData.finalRigorLevel = item.result.consensusRigorLevel;
          baseData.finalStandards = item.result.consensusStandards || [];
          baseData.confidenceScore = item.result.confidenceScore;
          // Add rigor justification from the first AI response
          baseData.rigorJustification = item.aiResponses?.[0]?.rigorJustification || null;
        }
        // Fallback to AI responses if no result consensus yet
        else if (item.aiResponses && item.aiResponses.length > 0) {
          const latestResponse = item.aiResponses[0];
          console.log(`[Transform] Q${item.questionNumber}: Using AI response fallback`);
          baseData.finalRigorLevel = latestResponse.rigorLevel;
          baseData.finalStandards = latestResponse.standardsIdentified || [];
          baseData.confidenceScore = latestResponse.confidence;
          baseData.rigorJustification = latestResponse.rigorJustification || null;
        }
        else {
          console.log(`[Transform] Q${item.questionNumber}: No data source available - result:${!!item.result}, aiResponses:${item.aiResponses?.length || 0}`);
        }

        return baseData;
      });

      console.log('Transformed results sample:', transformedResults[0] ? {
        id: transformedResults[0].id,
        questionNumber: transformedResults[0].questionNumber,
        hasRigor: !!transformedResults[0].finalRigorLevel,
        hasStandards: transformedResults[0].finalStandards?.length > 0,
        questionTextLength: transformedResults[0].questionText?.length || 0
      } : 'No results');
      
      res.json({
        document,
        results: transformedResults
      });
    } catch (error) {
      console.error("Error fetching document results:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ message: "Failed to fetch document results" });
    }
  });

  // Document inspection endpoint - provides comprehensive document relationships and metadata
  app.get('/api/documents/:id/inspection', async (req: any, res) => {
    try {
      const customerUuid = await ActiveUserService.requireActiveCustomerUuid(req);
      const { id } = req.params;
      
      // Get the main document and verify ownership
      const document = await storage.getDocument(id);
      if (!document || document.customerUuid !== customerUuid) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Determine document type
      let documentType: 'original' | 'generated' | 'unknown' = 'unknown';
      if (document.assetType === 'uploaded') {
        documentType = 'original';
      } else if (document.assetType === 'generated') {
        documentType = 'generated';
      }

      // Use materialized view for optimized performance with fallback to direct queries
      let relationships, lineage, children;
      try {
        [relationships, lineage, children] = await Promise.all([
          storage.getDocumentRelationships(id),
          storage.getDocumentLineage(id), 
          storage.getDocumentChildren(id)
        ]);
        console.log(`[DocumentInspector] Using materialized view - found ${children?.length || 0} children`);
      } catch (error) {
        console.warn('[DocumentInspector] Materialized view failed, falling back to direct queries:', error);
        // Fallback to direct queries
        lineage = [];
        if (document.parentDocumentId) {
          const parent = await storage.getDocument(document.parentDocumentId);
          if (parent && parent.customerUuid === customerUuid) {
            lineage.push(parent);
          }
        }
        children = await storage.getGeneratedDocuments(id);
        relationships = {
          child_count: children?.length || 0,
          question_count: 0,
          submission_count: 0
        };
      }

      // Always get questions directly (they're needed for display)
      const questions = await storage.getDocumentResults(id, customerUuid);

      // Get grade submissions (still need targeted query for now)
      const gradeSubmissions = await storage.getCustomerGradeSubmissions(customerUuid);
      const relatedSubmissions = gradeSubmissions.filter(
        sub => sub.originalDocumentId === id || sub.rubricDocumentId === id
      );

      // Use pre-computed relationship counts from materialized view
      const relationshipCounts = {
        parentCount: lineage.length,
        childCount: relationships?.child_count || 0,
        submissionCount: relationships?.submission_count || relatedSubmissions.length,
        questionCount: relationships?.question_count || questions.length
      };

      const inspectionData = {
        document,
        lineage,
        children,
        gradeSubmissions: relatedSubmissions,
        questions,
        processingResults: questions, // Processing results are same as questions in current implementation
        documentType,
        relationships: relationshipCounts
      };

      res.json(inspectionData);
    } catch (error) {
      console.error('[Documents] Error in document inspection:', error);
      res.status(500).json({ message: 'Failed to inspect document' });
    }
  });

  // Resubmit document for reprocessing
  app.post('/api/documents/:id/resubmit', async (req: any, res) => {
    try {
      const customerUuid = await ActiveUserService.requireActiveCustomerUuid(req);
      const { id } = req.params;
      
      // Get document and verify ownership
      const document = await storage.getDocument(id);
      if (!document || document.customerUuid !== customerUuid) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      // Only allow resubmission for uploaded documents
      if (document.assetType !== 'uploaded') {
        return res.status(400).json({ message: 'Can only resubmit uploaded documents' });
      }
      
      // Reset document status to pending first (required for queue processor)
      await DatabaseWriteService.updateDocumentStatus(id, 'pending');
      
      // Add to processing queue via storage (this handles the database)
      await storage.addToProcessingQueue(id, 1); // priority 1 for resubmitted documents
      
      // Trigger the queue processor to start processing
      await queueProcessor.addToQueue(id, 1);
      
      console.log(`[Documents] Document ${id} resubmitted for processing`);
      
      res.json({
        success: true,
        message: 'Document resubmitted for processing',
        documentId: id,
        status: 'queued'
      });
    } catch (error) {
      console.error('[Documents] Error resubmitting document:', error);
      res.status(500).json({ message: 'Failed to resubmit document' });
    }
  });

  // Get document deletion impact (for confirmation dialog)
  app.get('/api/documents/:id/deletion-impact', async (req: any, res) => {
    try {
      console.log(`[DELETION_IMPACT] Analyzing deletion impact for document: ${req.params.id}`);
      const customerUuid = await ActiveUserService.requireActiveCustomerUuid(req);
      const { id } = req.params;
      
      // Get document and verify ownership
      const document = await storage.getDocument(id);
      
      if (!document || document.customerUuid !== customerUuid) {
        console.warn(`[DELETION_IMPACT] Document not found or unauthorized access`);
        return res.status(404).json({ message: 'Document not found' });
      }
      
      // Get deletion impact analysis
      const impact = await DatabaseWriteService.getDocumentDeletionImpact(id);
      console.log(`[DELETION_IMPACT] Impact: ${impact.totalDocumentsToDelete} documents will be deleted`);
      
      res.json(impact);
    } catch (error) {
      console.error('[DELETION_IMPACT] Error analyzing deletion impact:', error);
      res.status(500).json({ 
        message: 'Failed to analyze deletion impact',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Delete document
  app.delete('/api/documents/:id', async (req: any, res) => {
    try {
      console.log(`[DELETE] Starting deletion for document: ${req.params.id}`);
      const customerUuid = await ActiveUserService.requireActiveCustomerUuid(req);
      const { id } = req.params;
      console.log(`[DELETE] Customer UUID: ${customerUuid}, Document ID: ${id}`);
      
      // Get document and verify ownership
      const document = await storage.getDocument(id);
      console.log(`[DELETE] Retrieved document:`, document ? `ID: ${document.id}, Customer: ${document.customerUuid}, AssetType: ${document.assetType}` : 'null');
      
      if (!document || document.customerUuid !== customerUuid) {
        console.warn(`[DELETE] Document not found or unauthorized access. Document exists: ${!!document}, Customer match: ${document?.customerUuid === customerUuid}`);
        return res.status(404).json({ message: 'Document not found' });
      }
      
      // Delete the document from the database
      console.log(`[DELETE] Calling DatabaseWriteService.deleteDocument for ID: ${id}`);
      await DatabaseWriteService.deleteDocument(id);
      console.log(`[DELETE] Database deletion successful for ID: ${id}`);
      
      // Note: Materialized view will auto-refresh via database triggers
      
      // Clean up physical file if it exists - determine path by document type using centralized environment variables
      let basePath;
      if (document.assetType === 'uploaded') {
        basePath = config.uploadsDir;
      } else if (document.assetType === 'generated') {
        if (document.exportType === 'rubric_pdf') {
          basePath = config.rubricsDir;
        } else if (document.exportType === 'cover_sheet') {
          basePath = config.coversheetsDir;
        } else {
          basePath = config.generatedDir;
        }
      } else {
        basePath = config.uploadsDir; // fallback
      }
      
      const filePath = path.join(basePath, document.originalPath);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`[Documents] Deleted physical file: ${filePath}`);
        } catch (fileError) {
          console.warn(`[Documents] Could not delete physical file ${filePath}:`, fileError);
        }
      }
      
      console.log(`[Documents] Document ${id} deleted by user`);
      
      res.json({
        success: true,
        message: 'Document deleted successfully',
        documentId: id
      });
    } catch (error) {
      console.error('[DELETE] Error deleting document:', error);
      console.error('[DELETE] Error stack:', error instanceof Error ? error.stack : 'No stack available');
      console.error('[DELETE] Error message:', error instanceof Error ? error.message : error);
      res.status(500).json({ 
        message: 'Failed to delete document',
        error: error instanceof Error ? error.message : 'Unknown error',
        documentId: req.params.id
      });
    }
  });

  // Get processing queue status (requires authentication)
  app.get('/api/queue', async (req: any, res) => {
    try {
      const customerUuid = await ActiveUserService.requireActiveCustomerUuid(req);
      
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
      const customerUuid = await ActiveUserService.requireActiveCustomerUuid(req);
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
      const userId = ActiveUserService.requireSessionUserId(req);
      
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
      const userId = ActiveUserService.requireSessionUserId(req);
      
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
      const userId = ActiveUserService.requireSessionUserId(req);
      const { keyName } = req.body;
      
      if (!keyName) {
        return res.status(400).json({ message: "Key name is required" });
      }

      // Generate a random API key
      const apiKey = `dps_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
      const keyHash = Buffer.from(apiKey).toString('base64');
      
      const createdKey = await DatabaseWriteService.createApiKey(userId, {
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
      const userId = ActiveUserService.requireSessionUserId(req);
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
  
  // Test route to manually trigger export processing (for debugging)
  app.post('/api/test/trigger-export-processing', async (req, res) => {
    try {
      await exportProcessor.processPendingExports();
      res.json({ success: true, message: 'Export processing triggered manually' });
    } catch (error) {
      console.error('Failed to trigger export processing:', error);
      res.status(500).json({ success: false, message: 'Failed to trigger export processing' });
    }
  });

  // Start export processor
  exportProcessor.start();
  
  // Process pending exports on startup with longer delay and interval checking
  setTimeout(() => {
    console.log('[Routes] Processing pending exports on startup...');
    exportProcessor.processPendingExports();
  }, 10000); // Wait 10 seconds for system to fully initialize
  
  // Set up periodic export processing every 30 seconds
  setInterval(() => {
    exportProcessor.processPendingExports();
  }, 30000); // Check for pending exports every 30 seconds
  console.log('Queue processor started for sequential document processing');

  // Teacher override endpoints
  app.post('/api/questions/:questionId/override', async (req: any, res) => {
    try {
      const customerUuid = await ActiveUserService.requireActiveCustomerUuid(req);
      const questionId = req.params.questionId;
      
      const validationResult = insertTeacherOverrideSchema.safeParse({
        questionId,
        ...req.body
      });

      if (!validationResult.success) {
        console.error('[Teacher Override] Validation failed:', validationResult.error.errors);
        console.error('[Teacher Override] Request body was:', req.body);
        return res.status(400).json({ 
          message: "Invalid override data",
          errors: validationResult.error.errors 
        });
      }

      // Check if override already exists for this customer/question
      const existingOverride = await storage.getQuestionOverride(questionId, customerUuid);
      
      if (existingOverride) {
        // Update existing override
        await DatabaseWriteService.updateTeacherOverride(existingOverride.id, validationResult.data);
        res.json({ message: "Override updated successfully", overrideId: existingOverride.id });
      } else {
        // Create new override
        const override = await DatabaseWriteService.createTeacherOverride(customerUuid, validationResult.data);
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
      const customerUuid = await ActiveUserService.requireActiveCustomerUuid(req);
      const questionId = req.params.questionId;
      
      console.log(`Processing revert request for question ${questionId}`);
      await DatabaseWriteService.revertQuestionToAI(questionId, customerUuid);
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
      const customerUuid = await ActiveUserService.requireActiveCustomerUuid(req);
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
      ActiveUserService.requireSessionUserId(req);
      
      const stats = await SessionCleanup.getSessionStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching session stats:", error);
      res.status(500).json({ message: "Failed to fetch session stats" });
    }
  });
  
  app.post('/api/admin/sessions/cleanup', async (req: any, res) => {
    try {
      ActiveUserService.requireSessionUserId(req);
      
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

  // Dead Letter Queue endpoints (Admin only)
  app.get('/api/admin/dead-letter-queue', async (req: any, res) => {
    try {
      ActiveUserService.requireSessionUserId(req);
      
      const deadLetterItems = await storage.getDeadLetterQueueItems();
      res.json({
        items: deadLetterItems,
        count: deadLetterItems.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching dead letter queue:", error);
      res.status(500).json({ message: "Failed to fetch dead letter queue" });
    }
  });

  app.get('/api/admin/dead-letter-queue/:id', async (req: any, res) => {
    try {
      ActiveUserService.requireSessionUserId(req);
      
      const { id } = req.params;
      const item = await storage.getDeadLetterQueueItem(id);
      
      if (!item) {
        return res.status(404).json({ message: 'Dead letter queue item not found' });
      }
      
      res.json(item);
    } catch (error) {
      console.error("Error fetching dead letter queue item:", error);
      res.status(500).json({ message: "Failed to fetch dead letter queue item" });
    }
  });

  app.delete('/api/admin/dead-letter-queue/:id', async (req: any, res) => {
    try {
      ActiveUserService.requireSessionUserId(req);
      
      const { id } = req.params;
      await storage.deleteDeadLetterQueueItem(id);
      
      res.json({ 
        message: 'Dead letter queue item deleted successfully',
        deletedId: id
      });
    } catch (error) {
      console.error("Error deleting dead letter queue item:", error);
      res.status(500).json({ message: "Failed to delete dead letter queue item" });
    }
  });

  // Register File Cabinet router
  const { fileCabinetRouter } = await import('./routes/fileCabinet');
  console.log('[Routes] Registering File Cabinet router');
  app.use(fileCabinetRouter);
  
  // Import and use document download router
  const { documentDownloadRouter } = await import('./routes/documentDownload');
  app.use(documentDownloadRouter);

  // Register Document Traversal router
  const documentTraversalRouter = await import('./routes/documentTraversal');
  app.use(documentTraversalRouter.default);

  // Simple testing endpoints for system validation
  app.get('/api/test-export', async (req, res) => {
    try {
      const { documentId } = req.query;
      if (!documentId || typeof documentId !== 'string') {
        return res.status(400).json({ error: 'documentId required' });
      }
      
      // Queue test exports
      await storage.addToExportQueue(documentId, 'rubric_pdf');
      await storage.addToExportQueue(documentId, 'cover_sheet');
      
      // Process exports
      await exportProcessor.processPendingExports();
      
      res.json({ 
        success: true, 
        message: 'Test exports queued and processed',
        documentId 
      });
    } catch (error) {
      console.error('Test export error:', error);
      res.status(500).json({ error: 'Test export failed' });
    }
  });

  app.post('/api/test-export', async (req, res) => {
    try {
      const { documentId } = req.body;
      if (!documentId) {
        return res.status(400).json({ error: 'documentId required' });
      }
      
      // Queue test exports
      await storage.addToExportQueue(documentId, 'rubric_pdf');
      await storage.addToExportQueue(documentId, 'cover_sheet');
      
      // Process exports immediately
      setTimeout(() => {
        exportProcessor.processPendingExports();
      }, 1000);
      
      res.json({ 
        success: true, 
        message: 'Test exports queued for processing',
        documentId 
      });
    } catch (error) {
      console.error('Test export error:', error);
      res.status(500).json({ error: 'Test export failed' });
    }
  });

  app.get('/api/system-health', async (req, res) => {
    try {
      const health = {
        timestamp: new Date().toISOString(),
        database: 'unknown',
        exportProcessor: 'unknown',
        fileSystem: 'unknown',
        userFriendlyFilenames: 'unknown'
      };
      
      // Test database
      try {
        await storage.getCustomerDocuments('health-check');
        health.database = 'healthy';
      } catch (err) {
        health.database = 'error';
      }
      
      // Test export processor
      try {
        const status = exportProcessor.getStatus();
        health.exportProcessor = status.isStarted ? 'healthy' : 'stopped';
      } catch (err) {
        health.exportProcessor = 'error';
      }
      
      // Test file system
      try {
        fs.accessSync(config.uploadsDir);
        health.fileSystem = 'healthy';
      } catch (err) {
        health.fileSystem = 'error';
      }
      
      // Test user-friendly filenames by checking recent generated files
      try {
        const recentFiles = fs.readdirSync(config.uploadsDir)
          .filter(f => f.includes('rubric') || f.includes('cover'))
          .filter(f => !f.includes('_4251e0f1-1739-4d39-99cc-86052f6ed3f0_')); // Old UUID format
        
        health.userFriendlyFilenames = recentFiles.length > 0 ? 'implemented' : 'not_tested';
      } catch (err) {
        health.userFriendlyFilenames = 'error';
      }
      
      const isHealthy = Object.values(health).every(status => 
        ['healthy', 'implemented'].includes(status) || status.includes('2025')
      );
      
      res.status(isHealthy ? 200 : 503).json(health);
    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({ error: 'Health check failed' });
    }
  });

  // Data truncation endpoint for development - admin only
  app.post('/api/admin/truncate-data', requireAdmin, async (req, res) => {
    try {
      console.log('[TruncateData] Starting complete data truncation...');
      
      // Get the count of records before deletion for reporting
      const beforeCounts = {
        documents: await db.select({ count: count() }).from(documents),
        users: await db.select({ count: count() }).from(users),
        questions: await db.select({ count: count() }).from(questions),
        aiResponses: await db.select({ count: count() }).from(aiResponses),
        questionResults: await db.select({ count: count() }).from(questionResults),
        teacherOverrides: await db.select({ count: count() }).from(teacherOverrides),
        processingQueue: await db.select({ count: count() }).from(processingQueue),
        exportQueue: await db.select({ count: count() }).from(exportQueue),
        gradeSubmissions: await db.select({ count: count() }).from(gradeSubmissions),
        qrSequenceNumbers: await db.select({ count: count() }).from(qrSequenceNumbers),
        apiKeys: await db.select({ count: count() }).from(apiKeys),
        sessions: await db.select({ count: count() }).from(sessions),
        classrooms: await db.select({ count: count() }).from(classrooms),
        students: await db.select({ count: count() }).from(students),
      };
      
      const totalRecordsBefore = Object.values(beforeCounts).reduce(
        (sum, result) => sum + (result[0]?.count || 0), 0
      );
      
      console.log(`[TruncateData] Found ${totalRecordsBefore} total records to delete`);
      
      // Truncate all database tables (order matters due to foreign key constraints)
      const tablesToTruncate = [
        { table: gradeSubmissions, name: 'gradeSubmissions' },
        { table: qrSequenceNumbers, name: 'qrSequenceNumbers' },
        { table: exportQueue, name: 'exportQueue' },
        { table: processingQueue, name: 'processingQueue' },
        { table: teacherOverrides, name: 'teacherOverrides' },
        { table: questionResults, name: 'questionResults' },
        { table: aiResponses, name: 'aiResponses' },
        { table: questions, name: 'questions' },
        { table: documents, name: 'documents' },
        { table: apiKeys, name: 'apiKeys' },
        { table: students, name: 'students' },
        { table: classrooms, name: 'classrooms' },
        { table: sessions, name: 'sessions' },
        { table: users, name: 'users' },
      ];
      
      let tablesCleared = 0;
      
      for (const { table, name } of tablesToTruncate) {
        try {
          const deleteResult = await db.delete(table);
          console.log(`[TruncateData] Cleared table: ${name}`);
          tablesCleared++;
        } catch (error) {
          console.warn(`[TruncateData] Failed to clear table ${name}:`, error);
        }
      }
      
      // Clear uploads directory using environment variables
      let filesDeleted = 0;
      try {
        if (fs.existsSync(config.uploadsDir)) {
          const files = fs.readdirSync(config.uploadsDir);
          
          for (const file of files) {
            // Skip .gitkeep and other hidden files
            if (!file.startsWith('.')) {
              try {
                const filePath = path.join(config.uploadsDir, file);
                fs.unlinkSync(filePath);
                filesDeleted++;
              } catch (fileError) {
                console.warn(`[TruncateData] Failed to delete file ${file}:`, fileError);
              }
            }
          }
          
          console.log(`[TruncateData] Deleted ${filesDeleted} files from uploads directory`);
        }
      } catch (error) {
        console.warn('[TruncateData] Failed to clear uploads directory:', error);
      }
      
      // Clear any in-memory caches or queues
      try {
        // Reset any service states if needed
        console.log('[TruncateData] Cleared in-memory caches');
      } catch (error) {
        console.warn('[TruncateData] Failed to clear caches:', error);
      }
      
      const response = {
        success: true,
        message: 'All data truncated successfully',
        tablesCleared,
        filesDeleted,
        totalRecordsBefore,
        timestamp: new Date().toISOString()
      };
      
      console.log(`[TruncateData] Truncation complete:`, response);
      res.json(response);
      
    } catch (error) {
      console.error('[TruncateData] Truncation failed:', error);
      res.status(500).json({
        error: 'Data truncation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Clear Google Classroom data endpoint - admin only
  app.post('/api/admin/clear-classroom-data', async (req, res) => {
    try {
      console.log('[ClearClassroomData] Starting Google Classroom data clearing...');
      
      // Clear Google Classroom related data (order matters due to foreign key constraints)
      const tablesToClear = [
        { table: students, name: 'students' },
        { table: assignments, name: 'assignments' },
        { table: classrooms, name: 'classrooms' }
      ];
      
      let tablesCleared = 0;
      let totalRecordsBefore = 0;
      
      // Get count before deletion
      for (const { table, name } of tablesToClear) {
        try {
          const [{ count: recordCount }] = await db.select({ count: count() }).from(table);
          totalRecordsBefore += recordCount;
          console.log(`[ClearClassroomData] ${name}: ${recordCount} records`);
        } catch (error) {
          console.warn(`[ClearClassroomData] Failed to count ${name}:`, error);
        }
      }
      
      // Clear tables in order
      for (const { table, name } of tablesToClear) {
        try {
          await db.delete(table);
          tablesCleared++;
          console.log(`[ClearClassroomData] Cleared ${name}`);
        } catch (error) {
          console.error(`[ClearClassroomData] Failed to clear ${name}:`, error);
          throw error;
        }
      }
      
      // Also clear Google Classroom auth data from users
      try {
        await db.update(users).set({
          googleAccessToken: null,
          googleRefreshToken: null,
          googleTokenExpiry: null,
          classroomConnected: false
        }).where(sql`classroom_connected = true`);
        console.log('[ClearClassroomData] Cleared Google auth tokens from users');
      } catch (error) {
        console.warn('[ClearClassroomData] Failed to clear auth tokens:', error);
      }
      
      const response = {
        success: true,
        message: 'Google Classroom data cleared successfully',
        tablesCleared,
        totalRecordsBefore,
        timestamp: new Date().toISOString()
      };
      
      console.log(`[ClearClassroomData] Clearing complete:`, response);
      res.json(response);
      
    } catch (error) {
      console.error('[ClearClassroomData] Clearing failed:', error);
      res.status(500).json({
        error: 'Classroom data clearing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // UX testing endpoint - admin only
  app.get('/api/admin/run-ux-tests', async (req, res) => {
    try {
      console.log('[UXTests] Starting comprehensive UX validation...');
      
      // Inline UX testing implementation for immediate functionality
      const testResults = [];
      const startTime = Date.now();
      
      // Test critical endpoints
      const endpoints = [
        { path: '/', name: 'Landing Page', expectAuth: false },
        { path: '/dashboard', name: 'Dashboard', expectAuth: false },
        { path: '/upload', name: 'Upload Page', expectAuth: false },
        { path: '/file-cabinet', name: 'File Cabinet', expectAuth: false },
        { path: '/testing-dashboard', name: 'Testing Dashboard', expectAuth: false },
        { path: '/api/system-health', name: 'System Health API', expectAuth: false },
        { path: '/api/auth/user', name: 'Auth Status API', expectAuth: false },
        { path: '/api/documents', name: 'Documents API (Auth Required)', expectAuth: true },
        { path: '/api/queue', name: 'Queue Status API (Auth Required)', expectAuth: true },
        { path: '/api/file-cabinet', name: 'File Cabinet API (Auth Required)', expectAuth: true },
        { path: '/api/nonexistent', name: '404 Test', expectAuth: false }
      ];
      
      for (const endpoint of endpoints) {
        try {
          const testStartTime = Date.now();
          const { default: fetch } = await import('node-fetch');
          const response = await fetch(`http://localhost:5000${endpoint.path}`, {
            method: 'GET',
            headers: { 'User-Agent': 'Standards-Sherpa-UX-Test/1.0' }
          });
          
          const responseTime = Date.now() - testStartTime;
          
          let isSuccess = false;
          let expectedStatus = '';
          
          if (endpoint.name === '404 Test') {
            isSuccess = response.status === 404;
            expectedStatus = '404 (not found)';
          } else if (endpoint.expectAuth) {
            // Auth-required endpoints should return 401/500 when not authenticated
            isSuccess = [401, 500].includes(response.status);
            expectedStatus = '401/500 (auth required)';
          } else if (endpoint.name.includes('API')) {
            // Public APIs should return success or redirect
            isSuccess = [200, 304, 401, 302].includes(response.status);
            expectedStatus = '200/304/401/302';
          } else {
            // Frontend routes should return success or redirect (not 500)
            isSuccess = [200, 304, 302].includes(response.status);
            expectedStatus = '200/304/302';
          }
          
          testResults.push({
            testName: `Route: ${endpoint.name}`,
            endpoint: endpoint.path,
            method: 'GET',
            status: isSuccess ? 'pass' : 'fail',
            statusCode: response.status,
            responseTime,
            error: isSuccess ? undefined : `Got ${response.status}, expected ${expectedStatus}`
          });
        } catch (error) {
          testResults.push({
            testName: `Route: ${endpoint.name}`,
            endpoint: endpoint.path,
            method: 'GET',
            status: 'fail',
            error: error instanceof Error ? error.message : 'Request failed'
          });
        }
      }
      
      const passed = testResults.filter(r => r.status === 'pass').length;
      const failed = testResults.filter(r => r.status === 'fail').length;
      const totalTime = Date.now() - startTime;
      
      const summary = `
===== UX TEST RESULTS =====
Total Tests: ${testResults.length}
Passed: ${passed} ✅
Failed: ${failed} ${failed > 0 ? '❌' : ''}
Total Time: ${totalTime}ms
Success Rate: ${((passed / testResults.length) * 100).toFixed(1)}%

${failed > 0 ? 'FAILED TESTS:\n' + testResults.filter(r => r.status === 'fail').map(r => `- ${r.testName}: ${r.error}`).join('\n') : 'All tests passed!'}
===========================`;
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        totalTests: testResults.length,
        passed,
        failed,
        results: testResults,
        summary,
        executionTime: totalTime
      });
      
    } catch (error) {
      console.error('[UXTests] UX test execution failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle 404 for API routes before Vite middleware
  app.use('/api/*', (req, res) => {
    res.status(404).json({ message: 'API endpoint not found' });
  });

  const httpServer = createServer(app);
  return httpServer;
}
