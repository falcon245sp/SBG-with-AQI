import { storage } from '../storage';

// Common Standards Project API configuration
const CSP_API_BASE = 'https://commonstandardsproject.com/api/v1';
const CACHE_TTL_JURISDICTIONS = 30 * 24 * 60 * 60 * 1000; // 30 days
const CACHE_TTL_STANDARD_SETS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_TTL_STANDARDS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Types matching Common Standards Project API responses
export interface CSPJurisdiction {
  id: string;
  title: string;
  type?: string;
  standardSets?: CSPStandardSet[];
}

export interface CSPStandardSet {
  id: string;
  title: string;
  subject: string;
  educationLevels: string[];
  document: {
    id: string;
    valid: string;
    title: string;
    sourceURL?: string;
    asnIdentifier: string;
    publicationStatus: string;
  };
}

export interface CSPStandard {
  id: string;
  asnIdentifier: string;
  position: number;
  depth: number;
  statementNotation?: string;
  statementLabel?: string;
  description: string;
  ancestorDescriptions?: string[];
}

export interface CSPStandardSetResponse {
  data: {
    id: string;
    title: string;
    subject: string;
    educationLevels: string[];
    standards: Record<string, CSPStandard>;
    jurisdiction: {
      id: string;
      title: string;
    };
    document: {
      id: string;
      valid: string;
      title: string;
      sourceURL?: string;
    };
  };
}

// Organized course structure for UI display
export interface GradeBandCourses {
  gradeBand: string;
  gradeLevels: string[];
  courses: {
    id: string;
    title: string;
    subject: string;
  }[];
}

// Course mapping for Common Core State Standards to traditional course names
const COMMON_CORE_COURSE_MAPPING: Record<string, string> = {
  // High School Mathematics - Map domains to traditional courses
  'High School — Algebra': 'Algebra 1',
  'High School — Functions': 'Algebra 2', 
  'High School — Geometry': 'Geometry',
  'High School — Number and Quantity': 'Pre-Calculus',
  'High School — Statistics and Probability': 'Statistics',
  'Grades 9, 10, 11, 12': 'High School Mathematics (General)',
  
  // Keep elementary/middle school grade-based naming
  'Grade K': 'Kindergarten Mathematics',
  'Grade 1': 'Grade 1 Mathematics',
  'Grade 2': 'Grade 2 Mathematics', 
  'Grade 3': 'Grade 3 Mathematics',
  'Grade 4': 'Grade 4 Mathematics',
  'Grade 5': 'Grade 5 Mathematics',
  'Grade 6': 'Grade 6 Mathematics',
  'Grade 7': 'Grade 7 Mathematics',
  'Grade 8': 'Grade 8 Mathematics',
};

class CommonStandardsProjectService {
  private async makeApiRequest<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${CSP_API_BASE}${endpoint}`);
    if (!response.ok) {
      throw new Error(`Common Standards Project API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  // Get all available jurisdictions
  async getJurisdictions(): Promise<CSPJurisdiction[]> {
    // Check cache first
    const cached = await storage.getCachedJurisdictions();
    const now = Date.now();
    
    if (cached.length > 0) {
      const oldestCache = Math.min(...cached.map((j: any) => new Date(j.createdAt || 0).getTime()));
      if (now - oldestCache < CACHE_TTL_JURISDICTIONS) {
        console.log(`[CommonStandardsProjectService] Returning ${cached.length} cached jurisdictions`);
        return cached.map((j: any) => j.data as CSPJurisdiction);
      }
    }

    console.log('[CommonStandardsProjectService] Fetching fresh jurisdictions from API');
    
    try {
      const response = await this.makeApiRequest<{ data: CSPJurisdiction[] }>('/jurisdictions/');
      const jurisdictions = response.data;
      
      // Cache the results
      await storage.cacheJurisdictions(jurisdictions);
      
      return jurisdictions;
    } catch (error) {
      console.error('[CommonStandardsProjectService] Error fetching jurisdictions:', error);
      
      // Fallback to cached data even if stale
      if (cached.length > 0) {
        console.log('[CommonStandardsProjectService] Using stale cached jurisdictions as fallback');
        return cached.map((j: any) => j.data as CSPJurisdiction);
      }
      
      throw error;
    }
  }

  // Get standard sets for a specific jurisdiction
  async getStandardSetsForJurisdiction(jurisdictionId: string): Promise<CSPStandardSet[]> {
    // Check cache first
    const cached = await storage.getCachedStandardSetsForJurisdiction(jurisdictionId);
    const now = Date.now();
    
    if (cached.length > 0) {
      const oldestCache = Math.min(...cached.map((s: any) => new Date(s.createdAt || 0).getTime()));
      if (now - oldestCache < CACHE_TTL_STANDARD_SETS) {
        console.log(`[CommonStandardsProjectService] Returning ${cached.length} cached standard sets for jurisdiction ${jurisdictionId}`);
        return cached.map((s: any) => s.data as CSPStandardSet);
      }
    }

    console.log(`[CommonStandardsProjectService] Fetching fresh standard sets for jurisdiction ${jurisdictionId}`);
    
    try {
      const response = await this.makeApiRequest<{ data: CSPJurisdiction }>(`/jurisdictions/${jurisdictionId}`);
      const standardSets = response.data.standardSets || [];
      
      // Cache the results
      await storage.cacheStandardSetsForJurisdiction(jurisdictionId, standardSets);
      
      return standardSets;
    } catch (error) {
      console.error(`[CommonStandardsProjectService] Error fetching standard sets for jurisdiction ${jurisdictionId}:`, error);
      
      // Fallback to cached data even if stale
      if (cached.length > 0) {
        console.log(`[CommonStandardsProjectService] Using stale cached standard sets for jurisdiction ${jurisdictionId} as fallback`);
        return cached.map((s: any) => s.data as CSPStandardSet);
      }
      
      throw error;
    }
  }

  // Get standards for a specific standard set
  async getStandardsForSet(standardSetId: string): Promise<CSPStandard[]> {
    // Check cache first
    const cached = await storage.getCachedStandardsForSet(standardSetId);
    const now = Date.now();
    
    if (cached && now - new Date(cached.createdAt || 0).getTime() < CACHE_TTL_STANDARDS) {
      console.log(`[CommonStandardsProjectService] Returning cached standards for set ${standardSetId}`);
      const standardsData = cached.standardsData as Record<string, CSPStandard>;
      return Object.values(standardsData).sort((a, b) => a.position - b.position);
    }

    console.log(`[CommonStandardsProjectService] Fetching fresh standards for set ${standardSetId}`);
    
    try {
      const response = await this.makeApiRequest<CSPStandardSetResponse>(`/standard_sets/${standardSetId}`);
      const standardsData = response.data.standards;
      
      // Cache the results
      await storage.cacheStandardsForSet(standardSetId, standardsData);
      
      return Object.values(standardsData).sort((a, b) => a.position - b.position);
    } catch (error) {
      console.error(`[CommonStandardsProjectService] Error fetching standards for set ${standardSetId}:`, error);
      
      // Fallback to cached data even if stale
      if (cached) {
        console.log(`[CommonStandardsProjectService] Using stale cached standards for set ${standardSetId} as fallback`);
        const standardsData = cached.standardsData as Record<string, CSPStandard>;
        return Object.values(standardsData).sort((a, b) => a.position - b.position);
      }
      
      throw error;
    }
  }

  // Organize standard sets into grade bands for UI display
  organizeCoursesByGradeBand(standardSets: CSPStandardSet[]): GradeBandCourses[] {
    const gradeBands: Record<string, GradeBandCourses> = {};
    
    standardSets.forEach(set => {
      const levels = set.educationLevels.map(level => level.padStart(2, '0')); // Normalize to 2 digits
      const minLevel = Math.min(...levels.map(l => parseInt(l)));
      const maxLevel = Math.max(...levels.map(l => parseInt(l)));
      
      let gradeBand: string;
      let gradeLevels: string[];
      
      if (maxLevel <= 5) {
        gradeBand = "Elementary (K-5)";
        gradeLevels = ["K", "1", "2", "3", "4", "5"];
      } else if (minLevel >= 6 && maxLevel <= 8) {
        gradeBand = "Middle School (6-8)";
        gradeLevels = ["6", "7", "8"];
      } else if (minLevel >= 9) {
        gradeBand = "High School (9-12)";
        gradeLevels = ["9", "10", "11", "12"];
      } else {
        // Spans multiple bands - put in the higher band
        if (maxLevel >= 9) {
          gradeBand = "High School (9-12)";
          gradeLevels = ["9", "10", "11", "12"];
        } else {
          gradeBand = "Middle School (6-8)";
          gradeLevels = ["6", "7", "8"];
        }
      }
      
      if (!gradeBands[gradeBand]) {
        gradeBands[gradeBand] = {
          gradeBand,
          gradeLevels,
          courses: []
        };
      }
      
      // Apply course mapping for Common Core State Standards
      let displayTitle = set.title;
      if (set.title && COMMON_CORE_COURSE_MAPPING[set.title]) {
        displayTitle = COMMON_CORE_COURSE_MAPPING[set.title];
      }
      
      gradeBands[gradeBand].courses.push({
        id: set.id,
        title: displayTitle,
        subject: set.subject
      });
    });
    
    // Sort courses within each grade band using custom math progression order
    Object.values(gradeBands).forEach(band => {
      band.courses.sort((a, b) => this.getMathCourseOrder(a.title, b.title));
    });
    
    return Object.values(gradeBands);
  }

  // Custom sorting for math courses by progression level (lower to higher)
  private getMathCourseOrder(titleA: string, titleB: string): number {
    const mathCourseOrder: Record<string, number> = {
      // Elementary Mathematics (K-5)
      'Kindergarten Mathematics': 1,
      'Grade 1 Mathematics': 2,
      'Grade 2 Mathematics': 3,
      'Grade 3 Mathematics': 4,
      'Grade 4 Mathematics': 5,
      'Grade 5 Mathematics': 6,
      
      // Middle School Mathematics (6-8)
      'Grade 6 Mathematics': 7,
      'Grade 7 Mathematics': 8,
      'Grade 8 Mathematics': 9,
      
      // High School Mathematics - Traditional Progression
      'Algebra 1': 10,
      'Geometry': 11,
      'Algebra 2': 12,
      'Pre-Calculus': 13,
      'Statistics': 14,
      'High School Mathematics (General)': 15,
      
      // Additional courses (if any)
      'Calculus': 16,
      'AP Calculus': 17,
      'AP Statistics': 18
    };

    const orderA = mathCourseOrder[titleA] || 999; // Unknown courses go to end
    const orderB = mathCourseOrder[titleB] || 999;
    
    // If both have defined order, use math progression
    if (orderA !== 999 && orderB !== 999) {
      return orderA - orderB;
    }
    
    // If one or both are unknown, fall back to alphabetical for non-math or unknown courses
    return titleA.localeCompare(titleB);
  }

  // Convert CSP standards to our internal format
  convertToInternalFormat(cspStandards: CSPStandard[]): any[] {
    return cspStandards.map(standard => ({
      id: standard.id,
      code: standard.statementNotation || standard.asnIdentifier,
      title: standard.statementLabel || 'Standard',
      description: standard.description,
      gradeLevel: 'varies', // Will be set based on standard set
      majorDomain: standard.ancestorDescriptions?.[0] || 'General',
      cluster: standard.ancestorDescriptions?.[1] || standard.ancestorDescriptions?.[0] || 'General'
    }));
  }
}

export const commonStandardsProjectService = new CommonStandardsProjectService();