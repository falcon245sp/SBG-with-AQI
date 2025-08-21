/**
 * Centralized Business Logic Enums
 * 
 * This file contains all business logic enums used throughout the application
 * to ensure type safety and consistency across database operations, API responses,
 * and frontend components.
 */

// Processing Status - Document processing workflow states
export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing', 
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// Teacher Review Status - Teacher workflow states
export enum TeacherReviewStatus {
  NOT_REVIEWED = 'not_reviewed',
  REVIEWED_AND_ACCEPTED = 'reviewed_and_accepted',
  REVIEWED_AND_OVERRIDDEN = 'reviewed_and_overridden'
}

// Asset Type - File Cabinet classification
export enum AssetType {
  UPLOADED = 'uploaded',
  GENERATED = 'generated'
}

// Export Type - Generated document types
export enum ExportType {
  RUBRIC_PDF = 'rubric_pdf',
  COVER_SHEET = 'cover_sheet',
  PROCESSING_REPORT = 'processing_report',
  STANDARDS_SUMMARY = 'standards_summary',
  QUESTION_ANALYSIS = 'question_analysis',
  TEACHER_GUIDE = 'teacher_guide',
  COLLATED_GRADED_SUBMISSIONS = 'collated_graded_submissions'
}

// AI Engine - AI service providers
export enum AiEngine {
  CHATGPT = 'chatgpt',
  GROK = 'grok',
  CLAUDE = 'claude'
}

// Rigor Level - Cognitive complexity levels
export enum RigorLevel {
  MILD = 'mild',
  MEDIUM = 'medium',
  SPICY = 'spicy'
}

// Grade Submission Status - Anti-fraud grading system
export enum GradeSubmissionStatus {
  PENDING = 'pending',
  PROCESSED = 'processed',
  DUPLICATE_REJECTED = 'duplicate_rejected',
  INVALID_QR = 'invalid_qr'
}

// Course State - Google Classroom integration
export enum CourseState {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  PROVISIONED = 'PROVISIONED',
  DECLINED = 'DECLINED',
  SUSPENDED = 'SUSPENDED'
}

// Assignment Work Type - Google Classroom assignment types
export enum AssignmentWorkType {
  ASSIGNMENT = 'ASSIGNMENT',
  SHORT_ANSWER_QUESTION = 'SHORT_ANSWER_QUESTION',
  MULTIPLE_CHOICE_QUESTION = 'MULTIPLE_CHOICE_QUESTION',
  QUIZ_ASSIGNMENT = 'QUIZ_ASSIGNMENT'
}

// Assignment State - Google Classroom assignment states
export enum AssignmentState {
  PUBLISHED = 'PUBLISHED',
  DRAFT = 'DRAFT',
  DELETED = 'DELETED'
}

// Default Values - Common defaults used across the application
export const BusinessDefaults = {
  // Document defaults
  INITIAL_PROCESSING_STATUS: ProcessingStatus.PENDING,
  INITIAL_TEACHER_REVIEW_STATUS: TeacherReviewStatus.NOT_REVIEWED,
  DEFAULT_ASSET_TYPE: AssetType.UPLOADED,
  
  // User defaults
  DEFAULT_CLASSROOM_CONNECTED: false,
  DEFAULT_IS_ACTIVE: true,
  DEFAULT_IS_REVERTED_TO_AI: false,
  DEFAULT_USAGE_COUNT: 0,
  
  // Array defaults
  EMPTY_TAGS_ARRAY: [],
  EMPTY_JURISDICTIONS_ARRAY: [],
  
  // Export queue priorities
  PRIMARY_EXPORT_TYPES: [ExportType.COVER_SHEET, ExportType.RUBRIC_PDF] as const,
  
  // AI analysis defaults
  DEFAULT_CONFIDENCE_THRESHOLD: 0.7,
  MINIMUM_AI_CONSENSUS: 2,
  
  // Rigor analysis defaults
  DEFAULT_RIGOR_LEVEL: RigorLevel.MILD,
  
} as const;

// Type helpers for enum values
export type ProcessingStatusValue = `${ProcessingStatus}`;
export type TeacherReviewStatusValue = `${TeacherReviewStatus}`;
export type AssetTypeValue = `${AssetType}`;
export type ExportTypeValue = `${ExportType}`;
export type AiEngineValue = `${AiEngine}`;
export type RigorLevelValue = `${RigorLevel}`;
export type GradeSubmissionStatusValue = `${GradeSubmissionStatus}`;
export type CourseStateValue = `${CourseState}`;
export type AssignmentWorkTypeValue = `${AssignmentWorkType}`;
export type AssignmentStateValue = `${AssignmentState}`;

// Utility functions for enum validation and conversion
export const BusinessEnumUtils = {
  // Validation functions
  isValidProcessingStatus: (value: string): value is ProcessingStatusValue => 
    Object.values(ProcessingStatus).includes(value as ProcessingStatus),
    
  isValidTeacherReviewStatus: (value: string): value is TeacherReviewStatusValue => 
    Object.values(TeacherReviewStatus).includes(value as TeacherReviewStatus),
    
  isValidAssetType: (value: string): value is AssetTypeValue => 
    Object.values(AssetType).includes(value as AssetType),
    
  isValidExportType: (value: string): value is ExportTypeValue => 
    Object.values(ExportType).includes(value as ExportType),
    
  isValidAiEngine: (value: string): value is AiEngineValue => 
    Object.values(AiEngine).includes(value as AiEngine),
    
  isValidRigorLevel: (value: string): value is RigorLevelValue => 
    Object.values(RigorLevel).includes(value as RigorLevel),
    
  // Array conversion functions
  getAllProcessingStatuses: () => Object.values(ProcessingStatus),
  getAllTeacherReviewStatuses: () => Object.values(TeacherReviewStatus),
  getAllAssetTypes: () => Object.values(AssetType),
  getAllExportTypes: () => Object.values(ExportType),
  getAllAiEngines: () => Object.values(AiEngine),
  getAllRigorLevels: () => Object.values(RigorLevel),
  
  // Status transition validation
  canTransitionProcessingStatus: (from: ProcessingStatusValue, to: ProcessingStatusValue): boolean => {
    const validTransitions = {
      [ProcessingStatus.PENDING]: [ProcessingStatus.PROCESSING, ProcessingStatus.FAILED],
      [ProcessingStatus.PROCESSING]: [ProcessingStatus.COMPLETED, ProcessingStatus.FAILED],
      [ProcessingStatus.COMPLETED]: [ProcessingStatus.PROCESSING], // Allow reprocessing
      [ProcessingStatus.FAILED]: [ProcessingStatus.PROCESSING], // Allow retry
    };
    return validTransitions[from]?.includes(to as ProcessingStatus) ?? false;
  },
  
  canTransitionTeacherReviewStatus: (from: TeacherReviewStatusValue, to: TeacherReviewStatusValue): boolean => {
    const validTransitions = {
      [TeacherReviewStatus.NOT_REVIEWED]: [TeacherReviewStatus.REVIEWED_AND_ACCEPTED, TeacherReviewStatus.REVIEWED_AND_OVERRIDDEN],
      [TeacherReviewStatus.REVIEWED_AND_ACCEPTED]: [TeacherReviewStatus.REVIEWED_AND_OVERRIDDEN, TeacherReviewStatus.NOT_REVIEWED],
      [TeacherReviewStatus.REVIEWED_AND_OVERRIDDEN]: [TeacherReviewStatus.REVIEWED_AND_ACCEPTED, TeacherReviewStatus.NOT_REVIEWED],
    };
    return validTransitions[from]?.includes(to as TeacherReviewStatus) ?? false;
  },
  
  // Display name mappings
  getProcessingStatusDisplayName: (status: ProcessingStatusValue): string => {
    const displayNames = {
      [ProcessingStatus.PENDING]: 'Pending Analysis',
      [ProcessingStatus.PROCESSING]: 'Analyzing Document',
      [ProcessingStatus.COMPLETED]: 'Analysis Complete',
      [ProcessingStatus.FAILED]: 'Analysis Failed'
    };
    return displayNames[status] || status;
  },
  
  getTeacherReviewStatusDisplayName: (status: TeacherReviewStatusValue): string => {
    const displayNames = {
      [TeacherReviewStatus.NOT_REVIEWED]: 'Awaiting Review',
      [TeacherReviewStatus.REVIEWED_AND_ACCEPTED]: 'Accepted',
      [TeacherReviewStatus.REVIEWED_AND_OVERRIDDEN]: 'Modified'
    };
    return displayNames[status] || status;
  },
  
  getRigorLevelDisplayName: (level: RigorLevelValue): string => {
    const displayNames = {
      [RigorLevel.MILD]: 'Mild (DOK 1-2)',
      [RigorLevel.MEDIUM]: 'Medium (DOK 3)', 
      [RigorLevel.SPICY]: 'Spicy (DOK 4)'
    };
    return displayNames[level] || level;
  }
} as const;

// Subject Area - Course classification for standards mapping
export enum SubjectArea {
  MATHEMATICS = 'mathematics',
  ENGLISH_LANGUAGE_ARTS = 'english_language_arts',
  SCIENCE = 'science',
  SOCIAL_STUDIES = 'social_studies',
  COMPUTER_SCIENCE = 'computer_science',
  FOREIGN_LANGUAGE = 'foreign_language',
  HEALTH_PHYSICAL_EDUCATION = 'health_physical_education',
  ARTS = 'arts',
  CAREER_TECHNICAL_EDUCATION = 'career_technical_education',
  OTHER = 'other'
}

// Standards Jurisdiction - Standards framework for course alignment
export enum StandardsJurisdiction {
  COMMON_CORE_MATH = 'common_core_math',
  COMMON_CORE_ELA = 'common_core_ela', 
  NGSS = 'ngss', // Next Generation Science Standards
  STATE_SPECIFIC = 'state_specific',
  AP_STANDARDS = 'ap_standards',
  IB_STANDARDS = 'ib_standards',
  CUSTOM = 'custom'
}

export type SubjectAreaValue = `${SubjectArea}`;
export type StandardsJurisdictionValue = `${StandardsJurisdiction}`;