/**
 * Database Mapping Layer - Ensures Consistent camelCase Output
 * 
 * This module provides explicit typed projections for all database entities
 * to prevent snake_case leakage from database columns into TypeScript objects.
 * 
 * Policy: Database uses snake_case, all TypeScript code uses camelCase
 */

import { 
  users, 
  classrooms, 
  documents, 
  questions, 
  questionResults,
  aiResponses,
  teacherOverrides,
  students,
  sessions
} from '../shared/schema.js';

// ===== USER PROJECTIONS =====
export const userSelect = {
  id: users.id,
  customerUuid: users.customerUuid,
  email: users.email,
  passwordHash: users.passwordHash,
  googleId: users.googleId,
  firstName: users.firstName,
  lastName: users.lastName,
  profileImageUrl: users.profileImageUrl,
  googleAccessToken: users.googleAccessToken,
  googleRefreshToken: users.googleRefreshToken,
  googleTokenExpiry: users.googleTokenExpiry,
  googleCredentials: users.googleCredentials,
  classroomConnected: users.classroomConnected,
  onboardingCompleted: users.onboardingCompleted,
  preferredJurisdiction: users.preferredJurisdiction,
  preferredSubjectAreas: users.preferredSubjectAreas,
  selectedGradeLevels: users.selectedGradeLevels,
  selectedCourses: users.selectedCourses,
  onboardingStep: users.onboardingStep,
  selectedRole: users.selectedRole,
  standardsConfigurationCompleted: users.standardsConfigurationCompleted,
  onboardingRoleSelected: users.onboardingRoleSelected,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt
} as const;

// ===== CLASSROOM PROJECTIONS =====
export const classroomSelect = {
  id: classrooms.id,
  googleClassId: classrooms.googleClassId,
  customerUuid: classrooms.customerUuid,
  name: classrooms.name,
  section: classrooms.section,
  description: classrooms.description,
  room: classrooms.room,
  courseState: classrooms.courseState,
  subjectArea: classrooms.subjectArea,
  detectedSubjectArea: classrooms.detectedSubjectArea,
  standardsJurisdiction: classrooms.standardsJurisdiction,
  sbgEnabled: classrooms.sbgEnabled,
  courseTitle: classrooms.courseTitle,
  enabledStandards: classrooms.enabledStandards,
  selectedStandardSetId: classrooms.selectedStandardSetId,
  rigorTargets: classrooms.rigorTargets,
  courseConfigurationCompleted: classrooms.courseConfigurationCompleted,
  createdAt: classrooms.createdAt,
  updatedAt: classrooms.updatedAt
} as const;

// ===== DOCUMENT PROJECTIONS =====
export const documentSelect = {
  id: documents.id,
  name: documents.name,
  originalPath: documents.originalPath,
  mimeType: documents.mimeType,
  fileSize: documents.fileSize,
  status: documents.status,
  customerUuid: documents.customerUuid,
  classroomId: documents.classroomId,
  courseTitle: documents.courseTitle,
  jurisdictions: documents.jurisdictions,
  createdAt: documents.createdAt,
  updatedAt: documents.updatedAt,
  processingStartedAt: documents.processingStartedAt,
  processingCompletedAt: documents.processingCompletedAt,
  analysisType: documents.analysisType,
  customAnalysisPrompt: documents.customAnalysisPrompt,
  aiEngine: documents.aiEngine,
  wordCount: documents.wordCount,
  questionCount: documents.questionCount,
  averageRigor: documents.averageRigor,
  standardsCoverage: documents.standardsCoverage
} as const;

// ===== QUESTION PROJECTIONS =====
export const questionSelect = {
  id: questions.id,
  documentId: questions.documentId,
  questionNumber: questions.questionNumber,
  questionText: questions.questionText,
  context: questions.context,
  createdAt: questions.createdAt
} as const;

// ===== SESSION PROJECTIONS =====
export const sessionSelect = {
  sid: sessions.sid,
  sess: sessions.sess,
  expire: sessions.expire
} as const;

// ===== UTILITY FUNCTIONS =====

/**
 * Development-only guard to detect snake_case leakage in API responses
 */
export function validateCamelCase(obj: any, context: string): void {
  if (process.env.NODE_ENV !== 'development') return;
  
  const hasSnakeCase = (data: any): boolean => {
    if (data === null || data === undefined) return false;
    if (Array.isArray(data)) return data.some(hasSnakeCase);
    if (typeof data === 'object') {
      return Object.keys(data).some(key => 
        key.includes('_') || hasSnakeCase(data[key])
      );
    }
    return false;
  };
  
  if (hasSnakeCase(obj)) {
    console.warn(`🐍 snake_case detected in ${context}:`, obj);
    // Don't throw in development to avoid breaking functionality
    // but make it visible for debugging
  }
}

/**
 * Type-safe projection helper
 */
export type ProjectionResult<T> = {
  [K in keyof T]: T[K]
};