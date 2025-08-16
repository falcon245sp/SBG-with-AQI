export interface ProcessDocumentRequest {
  customerId: string;
  file: Express.Multer.File;
  jurisdictions: string[];
  focusStandards?: string[];
  callbackUrl?: string;
}

export interface ProcessingJob {
  jobId: string;
  customerId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  jurisdictions: string[];
  focusStandards?: string[];
  callbackUrl?: string;
  status: 'submitted' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export interface EducationalStandard {
  code: string;
  description: string;
  jurisdiction: string;
  gradeLevel?: string;
  subject?: string;
}

export interface RigorAssessment {
  level: 'mild' | 'medium' | 'spicy';
  dokLevel: string;
  justification: string;
  confidence: number;
}

export interface AIAnalysisResult {
  rigor: RigorAssessment;
  standards: EducationalStandard[];
  confidence: number;
  processingTime: number;
  jsonResponse?: any;
}

export interface QuestionResult {
  questionNumber: string;
  questionText: string;
  context: string;
  consensusStandards: EducationalStandard[];
  consensusRigorLevel: 'mild' | 'medium' | 'spicy';
  confidenceScore: number;
  aiResponses: Array<{
    aiEngine: string;
    rigorLevel: 'mild' | 'medium' | 'spicy';
    rigorJustification: string;
    confidence: number;
    standardsIdentified: EducationalStandard[];
  }>;
}

export interface ProcessingResult {
  jobId: string;
  customerId: string;
  document: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    processedAt: Date;
  };
  results: QuestionResult[];
  summary: {
    totalQuestions: number;
    rigorDistribution: {
      mild: number;
      medium: number;
      spicy: number;
    };
    standardsCoverage: string[];
    processingTime: string;
  };
}