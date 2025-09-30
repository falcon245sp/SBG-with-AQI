/**
 * Document Tagging Utilities for File Cabinet
 * Ensures reliable identification of generated document types through automatic tagging
 */

export type ExportType = 'rubric_pdf' | 'cover_sheet' | 'processing_report' | 'standards_summary' | 'question_analysis' | 'teacher_guide';

/**
 * Automatic tag generation mapping for export types
 * These tags are ALWAYS applied when saving generated documents
 */
export const EXPORT_TYPE_TAGS: Record<ExportType, string[]> = {
  rubric_pdf: ['rubric', 'pdf', 'assessment', 'grading'],
  cover_sheet: ['cover-sheet', 'student-preview', 'test-prep'],
  processing_report: ['report', 'analysis', 'processing-summary'],
  standards_summary: ['standards', 'alignment', 'curriculum'],
  question_analysis: ['questions', 'analysis', 'breakdown'],
  teacher_guide: ['teacher', 'guide', 'instructions', 'reference']
};

/**
 * Generate automatic tags for a document based on export type
 * @param exportType - The type of generated document
 * @param userTags - Additional user-defined tags (optional)
 * @returns Combined array of automatic and user tags
 */
export function generateDocumentTags(exportType: ExportType | null, userTags: string[] = []): string[] {
  const autoTags = exportType ? EXPORT_TYPE_TAGS[exportType] : [];
  
  // Combine automatic tags with user tags, removing duplicates
  const allTags = [...autoTags, ...userTags];
  const uniqueTags = new Set(allTags.map(tag => tag.toLowerCase().trim()));
  return Array.from(uniqueTags);
}

/**
 * Determine if a document is a specific type based on tags and export_type
 * @param tags - Document tags array
 * @param exportType - Export type enum value
 * @param targetType - The type we're checking for
 * @returns boolean indicating if document matches target type
 */
export function isDocumentType(tags: string[], exportType: ExportType | null, targetType: ExportType): boolean {
  // Primary check: export_type column
  if (exportType === targetType) return true;
  
  // Fallback check: required tags for the target type
  const requiredTags = EXPORT_TYPE_TAGS[targetType];
  return requiredTags.some(tag => tags.includes(tag));
}

/**
 * Extract document type from filename as additional fallback
 * @param filename - The document filename
 * @returns Detected export type or null
 */
export function detectTypeFromFilename(filename: string): ExportType | null {
  const lowerFilename = filename.toLowerCase();
  
  if (lowerFilename.includes('rubric')) return 'rubric_pdf';
  if (lowerFilename.includes('cover') && lowerFilename.includes('sheet')) return 'cover_sheet';
  if (lowerFilename.includes('report') || lowerFilename.includes('summary')) return 'processing_report';
  if (lowerFilename.includes('standards')) return 'standards_summary';
  if (lowerFilename.includes('questions') || lowerFilename.includes('analysis')) return 'question_analysis';
  if (lowerFilename.includes('guide') || lowerFilename.includes('teacher')) return 'teacher_guide';
  
  return null;
}

/**
 * Comprehensive document type identification
 * Uses export_type, tags, and filename for reliable identification
 * @param document - Document with exportType, tags, and fileName
 * @returns Most likely export type
 */
export function identifyDocumentType(document: {
  exportType?: ExportType | null;
  tags?: string[];
  fileName: string;
}): ExportType | null {
  // 1. Primary: Use export_type if available
  if (document.exportType) return document.exportType;
  
  // 2. Secondary: Check tags against known patterns
  if (document.tags) {
    for (const [type, typeTags] of Object.entries(EXPORT_TYPE_TAGS)) {
      if (typeTags.some(tag => document.tags!.includes(tag))) {
        return type as ExportType;
      }
    }
  }
  
  // 3. Fallback: Analyze filename
  return detectTypeFromFilename(document.fileName);
}