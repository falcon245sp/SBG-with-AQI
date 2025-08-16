// Web Service Client for the standalone document processing service

const WEB_SERVICE_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-web-service-url.com'
  : 'http://localhost:3000';

export interface ProcessDocumentRequest {
  customerId: string;
  file: File;
  jurisdictions: string[];
  focusStandards?: string[];
  callbackUrl?: string;
}

export interface ProcessDocumentResponse {
  jobId: string;
  status: 'submitted';
  estimatedCompletionTime: string;
  message: string;
}

class WebServiceClient {
  private apiKey = 'dps_demo_key_12345678901234567890'; // Demo API key
  
  // Submit document for processing
  async submitDocument(request: ProcessDocumentRequest): Promise<ProcessDocumentResponse> {
    // For now, use the existing upload endpoint and transform the response
    const formData = new FormData();
    formData.append('customerId', request.customerId);
    formData.append('document', request.file);
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
      throw new Error('Failed to submit document');
    }

    const result = await response.json();
    
    // Transform existing response to match new API format
    return {
      jobId: result.documentId,
      status: 'submitted',
      estimatedCompletionTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      message: result.message
    };
  }
}

export const webServiceClient = new WebServiceClient();