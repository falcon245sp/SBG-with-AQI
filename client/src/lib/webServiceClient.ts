// Web Service Client for the standalone document processing service

// Environment-aware base URL configuration
const getWebServiceBaseUrl = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const prefix = isProduction ? 'VITE_PROD_' : 'VITE_DEV_';
  
  return import.meta.env[`${prefix}WEB_SERVICE_BASE_URL`] || 
    (isProduction 
      ? 'https://your-production-web-service-url.com'
      : 'http://localhost:3000'
    );
};

const WEB_SERVICE_BASE_URL = getWebServiceBaseUrl();

export interface ProcessDocumentRequest {
  customerId: string;
  files: File[];
  courseId?: string; // V1.0 Course context for file organization
  jurisdictions: string[];
  focusStandards?: string[];
  callbackUrl?: string;
}

export interface ProcessDocumentResponse {
  totalFiles: number;
  successfulSubmissions: number;
  failedSubmissions: number;
  jobs: Array<{
    jobId: string;
    fileName: string;
    status: 'submitted';
    estimatedCompletionTime: string;
    progress: number;
    currentStep: string;
  }>;
  errors?: Array<{
    fileName: string;
    error: string;
  }>;
  message: string;
}

class WebServiceClient {
  // Environment-aware API key configuration
  private getApiKey(): string {
    const isProduction = process.env.NODE_ENV === 'production';
    const prefix = isProduction ? 'VITE_PROD_' : 'VITE_DEV_';
    
    return import.meta.env[`${prefix}WEB_SERVICE_API_KEY`] || 
      (isProduction 
        ? (() => { throw new Error('Production web service API key not configured'); })()
        : 'dps_demo_key_development_only'
      );
  }
  
  private apiKey = this.getApiKey();
  
  // Submit documents for processing (supports multiple files)
  async submitDocuments(request: ProcessDocumentRequest): Promise<ProcessDocumentResponse> {
    console.log('=== WEB SERVICE CLIENT DEBUG ===');
    console.log('Files to submit:', request.files.length);
    console.log('File details:', request.files.map(f => ({ name: f.name, size: f.size })));
    
    // For now, use the existing upload endpoint and transform the response
    const formData = new FormData();
    formData.append('customerId', request.customerId);
    
    // Append each file as 'documents'
    request.files.forEach((file, index) => {
      console.log(`Appending file ${index + 1}: ${file.name}`);
      formData.append('documents', file);
    });
    
    console.log('FormData created with files appended');
    
    // Include course context for V1.0 file organization
    if (request.courseId) {
      formData.append('courseId', request.courseId);
    }
    
    formData.append('jurisdictions', request.jurisdictions.join(','));
    if (request.focusStandards) {
      formData.append('focusStandards', request.focusStandards.join(','));
    }
    if (request.callbackUrl) {
      formData.append('callbackUrl', request.callbackUrl);
    }

    const response = await fetch('/api/documents/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to submit documents');
    }

    const result = await response.json();
    
    // For backwards compatibility with single file uploads
    if (result.jobId) {
      return {
        totalFiles: 1,
        successfulSubmissions: 1,
        failedSubmissions: 0,
        jobs: [{
          jobId: result.jobId,
          fileName: request.files[0]?.name || 'unknown',
          status: 'submitted',
          estimatedCompletionTime: result.estimatedCompletionTime || new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          progress: 0,
          currentStep: 'queued'
        }],
        message: result.message
      };
    }
    
    // Return the multi-file response as-is
    return result;
  }
  
  // Legacy method for single file (for backwards compatibility)
  async submitDocument(request: { customerId: string; file: File; jurisdictions: string[]; focusStandards?: string[]; callbackUrl?: string; }): Promise<{ jobId: string; status: 'submitted'; estimatedCompletionTime: string; message: string; }> {
    const response = await this.submitDocuments({
      ...request,
      files: [request.file]
    });
    
    if (response.jobs.length === 0) {
      throw new Error('No jobs created');
    }
    
    return {
      jobId: response.jobs[0].jobId,
      status: response.jobs[0].status,
      estimatedCompletionTime: response.jobs[0].estimatedCompletionTime,
      message: response.message
    };
  }
}

export const webServiceClient = new WebServiceClient();