import { CommonCoreStandard, COMMON_CORE_MATH_STANDARDS, COMMON_CORE_ELA_STANDARDS } from './commonCoreStandards';
import { SubjectArea, StandardsJurisdiction } from './businessEnums';

// Course title patterns for matching to standards
export interface CoursePattern {
  patterns: string[];
  gradeLevel?: string;
  subject: 'Math' | 'ELA';
  majorDomain?: string;
}

export const COURSE_PATTERNS: CoursePattern[] = [
  // Elementary Math
  { patterns: ['kindergarten math', 'k math', 'math k'], gradeLevel: 'K', subject: 'Math' },
  { patterns: ['first grade math', '1st grade math', 'grade 1 math', 'math 1'], gradeLevel: '1', subject: 'Math' },
  { patterns: ['second grade math', '2nd grade math', 'grade 2 math', 'math 2'], gradeLevel: '2', subject: 'Math' },
  { patterns: ['third grade math', '3rd grade math', 'grade 3 math', 'math 3'], gradeLevel: '3', subject: 'Math' },
  { patterns: ['fourth grade math', '4th grade math', 'grade 4 math', 'math 4'], gradeLevel: '4', subject: 'Math' },
  { patterns: ['fifth grade math', '5th grade math', 'grade 5 math', 'math 5'], gradeLevel: '5', subject: 'Math' },

  // Middle School Math
  { patterns: ['sixth grade math', '6th grade math', 'grade 6 math', 'math 6'], gradeLevel: '6', subject: 'Math' },
  { patterns: ['seventh grade math', '7th grade math', 'grade 7 math', 'math 7'], gradeLevel: '7', subject: 'Math' },
  { patterns: ['eighth grade math', '8th grade math', 'grade 8 math', 'math 8'], gradeLevel: '8', subject: 'Math' },
  { patterns: ['pre-algebra', 'pre algebra', 'prealgebra'], gradeLevel: '8', subject: 'Math', majorDomain: 'Algebra' },

  // High School Math
  { patterns: ['algebra i', 'algebra 1', 'algebra one'], gradeLevel: '9-12', subject: 'Math', majorDomain: 'Algebra' },
  { patterns: ['geometry'], gradeLevel: '9-12', subject: 'Math', majorDomain: 'Geometry' },
  { patterns: ['algebra ii', 'algebra 2', 'algebra two'], gradeLevel: '9-12', subject: 'Math', majorDomain: 'Algebra' },
  { patterns: ['precalculus', 'pre-calculus', 'pre calculus'], gradeLevel: '9-12', subject: 'Math', majorDomain: 'Functions' },
  { patterns: ['calculus', 'ap calculus', 'calculus ab', 'calculus bc'], gradeLevel: '9-12', subject: 'Math', majorDomain: 'Functions' },
  { patterns: ['statistics', 'stats', 'ap statistics', 'ap stats'], gradeLevel: '9-12', subject: 'Math', majorDomain: 'Statistics' },

  // Advanced Math Topics
  { patterns: ['math topics', 'advanced math', 'math analysis'], gradeLevel: '9-12', subject: 'Math' },
  { patterns: ['trigonometry', 'trig'], gradeLevel: '9-12', subject: 'Math', majorDomain: 'Functions' },

  // Elementary ELA
  { patterns: ['kindergarten ela', 'k ela', 'kindergarten english'], gradeLevel: 'K', subject: 'ELA' },
  { patterns: ['first grade ela', '1st grade ela', 'grade 1 ela'], gradeLevel: '1', subject: 'ELA' },
  { patterns: ['second grade ela', '2nd grade ela', 'grade 2 ela'], gradeLevel: '2', subject: 'ELA' },
  { patterns: ['third grade ela', '3rd grade ela', 'grade 3 ela'], gradeLevel: '3', subject: 'ELA' },
  { patterns: ['fourth grade ela', '4th grade ela', 'grade 4 ela'], gradeLevel: '4', subject: 'ELA' },
  { patterns: ['fifth grade ela', '5th grade ela', 'grade 5 ela'], gradeLevel: '5', subject: 'ELA' },

  // Middle/High School ELA
  { patterns: ['english 6', 'sixth grade english'], gradeLevel: '6', subject: 'ELA' },
  { patterns: ['english 7', 'seventh grade english'], gradeLevel: '7', subject: 'ELA' },
  { patterns: ['english 8', 'eighth grade english'], gradeLevel: '8', subject: 'ELA' },
  { patterns: ['english i', 'english 1', 'english 9'], gradeLevel: '9-12', subject: 'ELA' },
  { patterns: ['english ii', 'english 2', 'english 10'], gradeLevel: '9-12', subject: 'ELA' },
  { patterns: ['english iii', 'english 3', 'english 11'], gradeLevel: '9-12', subject: 'ELA' },
  { patterns: ['english iv', 'english 4', 'english 12'], gradeLevel: '9-12', subject: 'ELA' },
  { patterns: ['ap english', 'ap literature', 'ap lang'], gradeLevel: '9-12', subject: 'ELA' },
];

// Match course title to appropriate standards
export function getStandardsForCourse(
  courseTitle: string, 
  jurisdiction: StandardsJurisdiction,
  subjectArea?: SubjectArea
): CommonCoreStandard[] {
  if (jurisdiction !== StandardsJurisdiction.COMMON_CORE_MATH && jurisdiction !== StandardsJurisdiction.COMMON_CORE_ELA) {
    return []; // Only support Common Core for now
  }

  const courseLower = courseTitle.toLowerCase().trim();
  
  // Find matching course pattern
  const matchedPattern = COURSE_PATTERNS.find(pattern => 
    pattern.patterns.some(p => courseLower.includes(p))
  );

  if (!matchedPattern) {
    // Fall back to subject area if no specific course match
    if (subjectArea === SubjectArea.MATHEMATICS) {
      return COMMON_CORE_MATH_STANDARDS;
    } else if (subjectArea === SubjectArea.ENGLISH_LANGUAGE_ARTS) {
      return COMMON_CORE_ELA_STANDARDS;
    }
    return [];
  }

  // Filter standards by matched pattern
  const allStandards = matchedPattern.subject === 'Math' 
    ? COMMON_CORE_MATH_STANDARDS 
    : COMMON_CORE_ELA_STANDARDS;

  let filteredStandards = allStandards;

  // Filter by grade level if specified
  if (matchedPattern.gradeLevel) {
    filteredStandards = filteredStandards.filter(standard => 
      standard.gradeLevel === matchedPattern.gradeLevel
    );
  }

  // Filter by major domain if specified
  if (matchedPattern.majorDomain) {
    filteredStandards = filteredStandards.filter(standard => 
      standard.majorDomain === matchedPattern.majorDomain
    );
  }

  return filteredStandards;
}

// Get suggested course titles based on subject area and jurisdiction
export function getSuggestedCourseTitles(
  subjectArea: SubjectArea,
  jurisdiction: StandardsJurisdiction
): string[] {
  if (jurisdiction !== StandardsJurisdiction.COMMON_CORE_MATH && jurisdiction !== StandardsJurisdiction.COMMON_CORE_ELA) {
    return [];
  }

  const relevantPatterns = COURSE_PATTERNS.filter(pattern => {
    if (subjectArea === SubjectArea.MATHEMATICS) {
      return pattern.subject === 'Math';
    } else if (subjectArea === SubjectArea.ENGLISH_LANGUAGE_ARTS) {
      return pattern.subject === 'ELA';
    }
    return false;
  });

  // Return the first (most common) pattern for each course type
  return relevantPatterns.map(pattern => 
    pattern.patterns[0].replace(/\b\w/g, l => l.toUpperCase()) // Title case
  );
}

// Default enabled standards (all enabled by default)
export function getDefaultEnabledStandards(standards: CommonCoreStandard[]): string[] {
  return standards.map(standard => standard.code);
}