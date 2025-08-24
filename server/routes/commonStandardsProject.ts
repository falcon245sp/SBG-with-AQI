import { Request, Response } from 'express';
import { commonStandardsProjectService } from '../services/commonStandardsProjectService';
import { ActiveUserService } from '../services/activeUserService';

// Get all available jurisdictions for standards
export async function getJurisdictions(req: Request, res: Response) {
  try {
    // Verify authenticated user
    await ActiveUserService.requireActiveUserAndCustomerUuid(req);

    const jurisdictions = await commonStandardsProjectService.getJurisdictions();
    
    res.json({
      jurisdictions: jurisdictions.filter(j => {
        // Filter to educational jurisdictions that have actual standards
        const title = j.title.toLowerCase();
        const isState = j.type === 'state';
        const isCommonCore = title.includes('core');
        const isNGSS = title.includes('ngss') || title.includes('science');
        const isStandards = title.includes('standards') || title.includes('curriculum');
        const isEducational = title.includes('education') || title.includes('learning');
        
        // Include states, major standards organizations, and educational bodies
        return isState || isCommonCore || isNGSS || isStandards || isEducational;
      })
    });

  } catch (error) {
    console.error('Error getting jurisdictions:', error);
    res.status(500).json({ error: 'Failed to get jurisdictions' });
  }
}

// Get available courses (standard sets) for a jurisdiction
export async function getCoursesForJurisdiction(req: Request, res: Response) {
  try {
    const { jurisdictionId } = req.params;
    
    if (!jurisdictionId) {
      return res.status(400).json({ error: 'Jurisdiction ID is required' });
    }

    // Verify authenticated user
    await ActiveUserService.requireActiveUserAndCustomerUuid(req);

    const standardSets = await commonStandardsProjectService.getStandardSetsForJurisdiction(jurisdictionId);
    
    // Organize by grade bands for UI display
    const gradeBandCourses = commonStandardsProjectService.organizeCoursesByGradeBand(standardSets);

    res.json({
      jurisdiction: jurisdictionId,
      gradeBandCourses,
      totalCourses: standardSets.length
    });

  } catch (error) {
    console.error(`Error getting courses for jurisdiction ${req.params.jurisdictionId}:`, error);
    res.status(500).json({ error: 'Failed to get courses for jurisdiction' });
  }
}

// Get available subjects for a jurisdiction
export async function getSubjectsForJurisdiction(req: Request, res: Response) {
  try {
    const { jurisdictionId } = req.params;
    
    if (!jurisdictionId) {
      return res.status(400).json({ error: 'Jurisdiction ID is required' });
    }

    console.log(`[getSubjectsForJurisdiction] Getting subjects for jurisdiction: ${jurisdictionId}`);

    // Verify authenticated user
    try {
      await ActiveUserService.requireActiveUserAndCustomerUuid(req);
      console.log(`[getSubjectsForJurisdiction] Authentication successful for jurisdiction: ${jurisdictionId}`);
    } catch (authError) {
      console.error(`[getSubjectsForJurisdiction] Authentication failed for jurisdiction ${jurisdictionId}:`, authError);
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get standard sets from the Common Standards Project API
    try {
      const standardSets = await commonStandardsProjectService.getStandardSetsForJurisdiction(jurisdictionId);
      
      console.log(`[getSubjectsForJurisdiction] Found ${standardSets.length} standard sets`);
      console.log(`[getSubjectsForJurisdiction] Raw standard sets:`, JSON.stringify(standardSets.slice(0, 3), null, 2));
      
      // Extract unique subjects from standard sets
      const uniqueSubjects = Array.from(new Set(standardSets.map(set => set.subject))).filter(Boolean);
      
      console.log(`[getSubjectsForJurisdiction] Unique subjects found:`, uniqueSubjects);
      
      // Map to consistent subject format
      const subjects = uniqueSubjects.map(subject => ({
        id: subject.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, ''),
        title: subject,
        description: `Standards and curricula for ${subject}`
      }));

      console.log(`[getSubjectsForJurisdiction] Final subjects response:`, subjects);

      res.json({
        jurisdiction: jurisdictionId,
        subjects,
        totalStandardSets: standardSets.length
      });
    } catch (apiError) {
      console.error(`[getSubjectsForJurisdiction] Common Standards Project API failed for jurisdiction ${jurisdictionId}:`, apiError);
      res.status(500).json({ 
        error: 'Failed to fetch subjects from Common Standards Project API',
        details: apiError instanceof Error ? apiError.message : String(apiError)
      });
    }

  } catch (error) {
    console.error(`[getSubjectsForJurisdiction] Error getting subjects for jurisdiction ${req.params.jurisdictionId}:`, error);
    res.status(500).json({ error: 'Failed to get subjects for jurisdiction' });
  }
}

// Get standards for a specific course (standard set)
export async function getStandardsForCourse(req: Request, res: Response) {
  try {
    const { standardSetId } = req.params;
    
    if (!standardSetId) {
      return res.status(400).json({ error: 'Standard set ID is required' });
    }

    // Verify authenticated user
    await ActiveUserService.requireActiveUserAndCustomerUuid(req);

    const standards = await commonStandardsProjectService.getStandardsForSet(standardSetId);
    
    // Convert to our internal format for compatibility
    const internalFormat = commonStandardsProjectService.convertToInternalFormat(standards);

    res.json({
      standards: internalFormat,
      standardSetId,
      totalStandards: standards.length,
      // Default enable all standards for now - can be customized later
      defaultEnabled: internalFormat.map(s => s.code)
    });

  } catch (error) {
    console.error(`Error getting standards for course ${req.params.standardSetId}:`, error);
    res.status(500).json({ error: 'Failed to get standards for course' });
  }
}

// Search standards across all jurisdictions (for advanced users)
export async function searchStandards(req: Request, res: Response) {
  try {
    const { query } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Verify authenticated user
    await ActiveUserService.requireActiveUserAndCustomerUuid(req);

    // For now, return empty results - full search would require Algolia integration
    // This is a placeholder for future implementation
    res.json({
      query,
      results: [],
      message: 'Standards search coming soon - currently use jurisdiction and course selection'
    });

  } catch (error) {
    console.error(`Error searching standards for query "${req.query.query}":`, error);
    res.status(500).json({ error: 'Failed to search standards' });
  }
}