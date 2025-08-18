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
    fileSize: 50 * 1024 * 1024, // 50MB limit per file
    files: 10, // Maximum 10 files per request
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
router.post('/process', validateApiKey, upload.array('documents', 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'missing_files',
        message: 'No files uploaded'
      });
    }

    const { customerId, jurisdictions, focusStandards, callbackUrl } = req.body;
    
    if (!customerId) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'customerId is required'
      });
    }

    // Parse jurisdictions with Common Core as default
    let parsedJurisdictions: string[] = ['Common Core'];
    if (jurisdictions) {
      parsedJurisdictions = typeof jurisdictions === 'string' 
        ? jurisdictions.split(',').map((j: string) => j.trim()).filter(Boolean)
        : jurisdictions;
    }
    
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

    // Process each file and create separate jobs
    const jobs = [];
    const errors = [];

    for (const file of files) {
      try {
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

        const estimatedCompletionTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes estimate
        
        jobs.push({
          jobId,
          fileName: file.originalname,
          status: 'submitted',
          estimatedCompletionTime: estimatedCompletionTime.toISOString(),
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

    // Return response with all jobs and any errors
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
    res.status(statusCode).json({
      message: `${jobs.length} of ${files.length} documents submitted for processing`,
      ...response
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