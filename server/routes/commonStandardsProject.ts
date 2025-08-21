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
      jurisdictions: jurisdictions.filter(j => 
        // Filter to common jurisdictions users care about
        j.title.includes('Core') || // Common Core
        j.type === 'state' || // State standards
        j.title.includes('NGSS') || // Next Generation Science Standards
        j.title.includes('Texas') // Popular state example
      )
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