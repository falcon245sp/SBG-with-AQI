/**
 * Classroom Classification Service
 * 
 * Automatically classifies Google Classroom courses by subject area
 * based on course names, sections, and descriptions to enable
 * appropriate standards jurisdiction mapping.
 */

import { SubjectArea, StandardsJurisdiction } from '../../shared/businessEnums.js';

interface ClassificationResult {
  subjectArea: SubjectArea;
  confidence: number;
  suggestedJurisdiction: StandardsJurisdiction;
  detectedKeywords: string[];
}

interface ClassroomData {
  name: string;
  section?: string;
  description?: string;
}

export class ClassroomClassifier {
  
  // Subject area keyword mappings with scoring weights
  private static readonly SUBJECT_KEYWORDS = {
    [SubjectArea.MATHEMATICS]: {
      primary: ['math', 'mathematics', 'algebra', 'geometry', 'calculus', 'trigonometry', 'statistics', 'pre-calc', 'precalc'],
      secondary: ['equation', 'formula', 'number', 'fraction', 'decimal', 'graph', 'function', 'linear', 'quadratic'],
      courses: ['algebra 1', 'algebra 2', 'geometry', 'pre-algebra', 'calculus', 'statistics', 'trigonometry', 'pre-calculus']
    },
    [SubjectArea.ENGLISH_LANGUAGE_ARTS]: {
      primary: ['english', 'ela', 'language arts', 'literature', 'writing', 'reading', 'composition', 'rhetoric'],
      secondary: ['essay', 'novel', 'poetry', 'grammar', 'vocabulary', 'shakespeare', 'story', 'narrative'],
      courses: ['english 9', 'english 10', 'english 11', 'english 12', 'ap english', 'creative writing', 'journalism']
    },
    [SubjectArea.SCIENCE]: {
      primary: ['science', 'biology', 'chemistry', 'physics', 'earth science', 'environmental', 'anatomy', 'physiology'],
      secondary: ['lab', 'experiment', 'molecule', 'cell', 'atom', 'ecosystem', 'evolution', 'genetics'],
      courses: ['biology', 'chemistry', 'physics', 'earth science', 'environmental science', 'ap biology', 'ap chemistry']
    },
    [SubjectArea.SOCIAL_STUDIES]: {
      primary: ['history', 'social studies', 'government', 'civics', 'geography', 'economics', 'sociology', 'psychology'],
      secondary: ['ancient', 'modern', 'world', 'american', 'european', 'democracy', 'constitution', 'culture'],
      courses: ['world history', 'us history', 'american history', 'government', 'ap history', 'civics', 'geography']
    },
    [SubjectArea.COMPUTER_SCIENCE]: {
      primary: ['computer science', 'programming', 'coding', 'software', 'technology', 'it', 'information technology'],
      secondary: ['python', 'java', 'javascript', 'html', 'css', 'algorithm', 'data structure', 'coding'],
      courses: ['computer science', 'ap computer science', 'programming', 'web design', 'it fundamentals']
    },
    [SubjectArea.FOREIGN_LANGUAGE]: {
      primary: ['spanish', 'french', 'german', 'italian', 'chinese', 'japanese', 'latin', 'portuguese'],
      secondary: ['language', 'vocabulary', 'conversation', 'culture', 'grammar', 'pronunciation'],
      courses: ['spanish 1', 'spanish 2', 'french 1', 'german', 'ap spanish', 'mandarin']
    },
    [SubjectArea.HEALTH_PHYSICAL_EDUCATION]: {
      primary: ['pe', 'physical education', 'health', 'fitness', 'athletics', 'sports', 'gym', 'exercise'],
      secondary: ['nutrition', 'wellness', 'safety', 'first aid', 'anatomy', 'movement', 'activity'],
      courses: ['physical education', 'health', 'pe', 'athletics', 'sports medicine', 'fitness']
    },
    [SubjectArea.ARTS]: {
      primary: ['art', 'music', 'theater', 'theatre', 'drama', 'band', 'choir', 'orchestra', 'visual arts'],
      secondary: ['painting', 'drawing', 'sculpture', 'performance', 'instrument', 'singing', 'acting'],
      courses: ['art', 'music', 'band', 'choir', 'theater', 'drama', 'visual arts', 'orchestra']
    },
    [SubjectArea.CAREER_TECHNICAL_EDUCATION]: {
      primary: ['cte', 'career', 'technical', 'vocational', 'trade', 'automotive', 'culinary', 'construction'],
      secondary: ['apprentice', 'skill', 'workshop', 'hands-on', 'practical', 'industry', 'professional'],
      courses: ['automotive', 'culinary arts', 'construction', 'electrical', 'welding', 'business']
    },
    [SubjectArea.OTHER]: {
      primary: ['other', 'miscellaneous', 'general', 'mixed', 'interdisciplinary'],
      secondary: ['study', 'course', 'class', 'subject'],
      courses: ['study hall', 'advisory', 'homeroom', 'elective']
    }
  };

  // Standards jurisdiction mappings
  private static readonly JURISDICTION_MAPPING = {
    [SubjectArea.MATHEMATICS]: StandardsJurisdiction.COMMON_CORE_MATH,
    [SubjectArea.ENGLISH_LANGUAGE_ARTS]: StandardsJurisdiction.COMMON_CORE_ELA,
    [SubjectArea.SCIENCE]: StandardsJurisdiction.NGSS,
    [SubjectArea.SOCIAL_STUDIES]: StandardsJurisdiction.STATE_SPECIFIC,
    [SubjectArea.COMPUTER_SCIENCE]: StandardsJurisdiction.STATE_SPECIFIC,
    [SubjectArea.FOREIGN_LANGUAGE]: StandardsJurisdiction.STATE_SPECIFIC,
    [SubjectArea.HEALTH_PHYSICAL_EDUCATION]: StandardsJurisdiction.STATE_SPECIFIC,
    [SubjectArea.ARTS]: StandardsJurisdiction.STATE_SPECIFIC,
    [SubjectArea.CAREER_TECHNICAL_EDUCATION]: StandardsJurisdiction.STATE_SPECIFIC,
    [SubjectArea.OTHER]: StandardsJurisdiction.CUSTOM
  };

  /**
   * Classify a classroom based on its name, section, and description
   */
  static classifyClassroom(classroomData: ClassroomData): ClassificationResult {
    const text = this.prepareTextForAnalysis(classroomData);
    const scores = this.calculateSubjectScores(text);
    
    // Find the highest scoring subject area
    const [topSubject, topScore] = Object.entries(scores)
      .reduce(([bestSubject, bestScore], [subject, score]) => 
        score > bestScore ? [subject as SubjectArea, score] : [bestSubject, bestScore],
        [SubjectArea.OTHER, 0]
      ) as [SubjectArea, number];

    // Calculate confidence based on score difference from second place
    const sortedScores = Object.values(scores).sort((a, b) => b - a);
    const confidence = sortedScores.length > 1 
      ? Math.min((topScore - sortedScores[1]) / topScore, 1.0)
      : topScore > 0 ? 0.8 : 0.0;

    // Get detected keywords for this subject
    const detectedKeywords = this.getDetectedKeywords(text, topSubject);

    return {
      subjectArea: topSubject,
      confidence: Math.round(confidence * 100) / 100, // Round to 2 decimal places
      suggestedJurisdiction: this.JURISDICTION_MAPPING[topSubject] || StandardsJurisdiction.CUSTOM,
      detectedKeywords
    };
  }

  /**
   * Prepare text for analysis by combining and normalizing all available text
   */
  private static prepareTextForAnalysis(classroomData: ClassroomData): string {
    const parts = [
      classroomData.name || '',
      classroomData.section || '',
      classroomData.description || ''
    ];
    
    return parts
      .join(' ')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Calculate scores for each subject area based on keyword matches
   */
  private static calculateSubjectScores(text: string): Record<SubjectArea, number> {
    const scores: Record<SubjectArea, number> = {} as Record<SubjectArea, number>;
    
    for (const [subject, keywords] of Object.entries(this.SUBJECT_KEYWORDS)) {
      let score = 0;
      
      // Primary keywords (higher weight)
      for (const keyword of keywords.primary) {
        if (text.includes(keyword)) {
          score += 10;
        }
      }
      
      // Secondary keywords (lower weight)
      for (const keyword of keywords.secondary) {
        if (text.includes(keyword)) {
          score += 5;
        }
      }
      
      // Course patterns (highest weight for exact matches)
      for (const course of keywords.courses) {
        if (text.includes(course)) {
          score += 15;
        }
      }
      
      scores[subject as SubjectArea] = score;
    }
    
    return scores;
  }

  /**
   * Get the keywords that were detected for a specific subject area
   */
  private static getDetectedKeywords(text: string, subjectArea: SubjectArea): string[] {
    const keywords = this.SUBJECT_KEYWORDS[subjectArea];
    if (!keywords) return [];
    
    const detected: string[] = [];
    
    [...keywords.primary, ...keywords.secondary, ...keywords.courses].forEach(keyword => {
      if (text.includes(keyword)) {
        detected.push(keyword);
      }
    });
    
    return detected;
  }

  /**
   * Get all possible subject areas for dropdown/selection
   */
  static getAllSubjectAreas(): Array<{value: SubjectArea, label: string}> {
    return [
      { value: SubjectArea.MATHEMATICS, label: 'Mathematics' },
      { value: SubjectArea.ENGLISH_LANGUAGE_ARTS, label: 'English Language Arts' },
      { value: SubjectArea.SCIENCE, label: 'Science' },
      { value: SubjectArea.SOCIAL_STUDIES, label: 'Social Studies' },
      { value: SubjectArea.COMPUTER_SCIENCE, label: 'Computer Science' },
      { value: SubjectArea.FOREIGN_LANGUAGE, label: 'Foreign Language' },
      { value: SubjectArea.HEALTH_PHYSICAL_EDUCATION, label: 'Health & Physical Education' },
      { value: SubjectArea.ARTS, label: 'Arts' },
      { value: SubjectArea.CAREER_TECHNICAL_EDUCATION, label: 'Career & Technical Education' },
      { value: SubjectArea.OTHER, label: 'Other' }
    ];
  }

  /**
   * Get available standards jurisdictions for a subject area
   */
  static getJurisdictionsForSubject(subjectArea: SubjectArea): Array<{value: StandardsJurisdiction, label: string}> {
    const allJurisdictions = [
      { value: StandardsJurisdiction.COMMON_CORE_MATH, label: 'Common Core Mathematics' },
      { value: StandardsJurisdiction.COMMON_CORE_ELA, label: 'Common Core English Language Arts' },
      { value: StandardsJurisdiction.NGSS, label: 'Next Generation Science Standards (NGSS)' },
      { value: StandardsJurisdiction.STATE_SPECIFIC, label: 'State-Specific Standards' },
      { value: StandardsJurisdiction.AP_STANDARDS, label: 'Advanced Placement (AP) Standards' },
      { value: StandardsJurisdiction.IB_STANDARDS, label: 'International Baccalaureate (IB) Standards' },
      { value: StandardsJurisdiction.CUSTOM, label: 'Custom Standards' }
    ];

    // Filter relevant jurisdictions based on subject area
    switch (subjectArea) {
      case SubjectArea.MATHEMATICS:
        return allJurisdictions.filter(j => 
          [StandardsJurisdiction.COMMON_CORE_MATH, StandardsJurisdiction.AP_STANDARDS, 
           StandardsJurisdiction.IB_STANDARDS, StandardsJurisdiction.STATE_SPECIFIC, 
           StandardsJurisdiction.CUSTOM].includes(j.value)
        );
      case SubjectArea.ENGLISH_LANGUAGE_ARTS:
        return allJurisdictions.filter(j => 
          [StandardsJurisdiction.COMMON_CORE_ELA, StandardsJurisdiction.AP_STANDARDS, 
           StandardsJurisdiction.IB_STANDARDS, StandardsJurisdiction.STATE_SPECIFIC, 
           StandardsJurisdiction.CUSTOM].includes(j.value)
        );
      case SubjectArea.SCIENCE:
        return allJurisdictions.filter(j => 
          [StandardsJurisdiction.NGSS, StandardsJurisdiction.AP_STANDARDS, 
           StandardsJurisdiction.IB_STANDARDS, StandardsJurisdiction.STATE_SPECIFIC, 
           StandardsJurisdiction.CUSTOM].includes(j.value)
        );
      default:
        return allJurisdictions.filter(j => 
          [StandardsJurisdiction.STATE_SPECIFIC, StandardsJurisdiction.AP_STANDARDS, 
           StandardsJurisdiction.IB_STANDARDS, StandardsJurisdiction.CUSTOM].includes(j.value)
        );
    }
  }
}