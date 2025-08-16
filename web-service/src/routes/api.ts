import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { ProcessDocumentRequest, ProcessingJob } from '../types';
import { DocumentProcessor } from '../services/documentProcessor';
import { JobStore } from '../services/jobStore';
import { s3Service } from '../services/s3Service';
import { validateApiKey } from '../middleware/auth';

const router = express.Router();
const documentProcessor = new DocumentProcessor();
const jobStore = new JobStore();

// Configure multer for in-memory storage (files will be uploaded to S3)
const upload = multer({
  storage: multer.memoryStorage(),
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

// Submit document for processing
router.post('/process', validateApiKey, upload.single('document'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        error: 'missing_file',
        message: 'No file uploaded'
      });
    }

    const { customerId, jurisdictions, focusStandards, callbackUrl } = req.body;
    
    if (!customerId || !jurisdictions) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'customerId and jurisdictions are required'
      });
    }

    // Parse jurisdictions and focus standards
    const parsedJurisdictions = typeof jurisdictions === 'string' 
      ? jurisdictions.split(',').map((j: string) => j.trim())
      : jurisdictions;
    
    let parsedFocusStandards: string[] = [];
    if (focusStandards) {
      parsedFocusStandards = typeof focusStandards === 'string'
        ? focusStandards.split(',').map((s: string) => s.trim())
        : focusStandards;
    }

    // Validate jurisdictions limit
    if (parsedJurisdictions.length > 3) {
      return res.status(400).json({
        error: 'too_many_jurisdictions',
        message: 'Maximum 3 jurisdictions allowed'
      });
    }

    // Upload file to S3 in customer-specific area
    const s3Result = await s3Service.uploadFile(customerId, file, file.originalname);

    // Create processing job
    const jobId = uuidv4();
    const job: ProcessingJob = {
      jobId,
      customerId,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      s3Key: s3Result.key,
      s3Bucket: s3Result.bucket,
      s3Url: s3Result.url,
      jurisdictions: parsedJurisdictions,
      focusStandards: parsedFocusStandards,
      callbackUrl,
      status: 'submitted',
      progress: 0,
      currentStep: 'queued',
      startedAt: new Date()
    };

    // Save job
    await jobStore.saveJob(job);

    // Start processing asynchronously
    documentProcessor.processDocument(jobId, job).catch(error => {
      console.error(`Processing failed for job ${jobId}:`, error);
      jobStore.updateJobStatus(jobId, 'failed', 0, 'error', error.message);
    });

    // Return immediate response
    const estimatedCompletionTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes estimate
    
    res.status(202).json({
      jobId,
      status: 'submitted',
      estimatedCompletionTime: estimatedCompletionTime.toISOString(),
      message: `Document "${file.originalname}" submitted for processing`,
      progress: 0,
      currentStep: 'queued'
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'upload_failed',
      message: error instanceof Error ? error.message : 'Failed to process upload'
    });
  }
});

// Get job status
router.get('/status/:jobId', validateApiKey, async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await jobStore.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        error: 'job_not_found',
        message: 'Job not found'
      });
    }

    const response = {
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      estimatedCompletionTime: job.completedAt || new Date(job.startedAt.getTime() + 5 * 60 * 1000),
      errorMessage: job.errorMessage
    };

    res.json(response);
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      error: 'status_check_failed',
      message: 'Failed to check job status'
    });
  }
});

// Get processing results
router.get('/results/:jobId', validateApiKey, async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await jobStore.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        error: 'job_not_found',
        message: 'Job not found'
      });
    }

    if (job.status !== 'completed') {
      return res.status(202).json({
        error: 'job_not_completed',
        message: 'Job is not yet completed',
        status: job.status,
        progress: job.progress
      });
    }

    const results = await jobStore.getJobResults(jobId);
    if (!results) {
      return res.status(404).json({
        error: 'results_not_found',
        message: 'Results not found for completed job'
      });
    }

    res.json(results);
  } catch (error) {
    console.error('Results retrieval error:', error);
    res.status(500).json({
      error: 'results_retrieval_failed',
      message: 'Failed to retrieve results'
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '0.5.0'
  });
});

export default router;