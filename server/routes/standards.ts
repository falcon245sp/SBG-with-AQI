import { Request, Response } from 'express';
import { ActiveUserService } from '../services/activeUserService';
import { storage } from '../storage';
import { getStandardsForCourse, getSuggestedCourseTitles, getDefaultEnabledStandards } from '../../shared/standardsMatching';
import { SubjectArea, StandardsJurisdiction } from '../../shared/businessEnums';
import { CommonCoreStandard } from '../../shared/commonCoreStandards';

// Get standards for a specific course title
export async function getStandardsForCourseTitle(req: Request, res: Response) {
  try {
    const { courseTitle, jurisdiction, subjectArea } = req.query;
    
    if (!courseTitle || !jurisdiction) {
      return res.status(400).json({ error: 'Course title and jurisdiction are required' });
    }

    const standards = getStandardsForCourse(
      courseTitle as string,
      jurisdiction as StandardsJurisdiction,
      subjectArea as SubjectArea
    );

    res.json({
      standards,
      defaultEnabled: getDefaultEnabledStandards(standards)
    });

  } catch (error) {
    console.error('Error getting standards for course:', error);
    res.status(500).json({ error: 'Failed to get standards for course' });
  }
}

// Get suggested course titles for a subject area
export async function getSuggestedCourses(req: Request, res: Response) {
  try {
    const { subjectArea, jurisdiction } = req.query;
    
    if (!subjectArea || !jurisdiction) {
      return res.status(400).json({ error: 'Subject area and jurisdiction are required' });
    }

    const suggestions = getSuggestedCourseTitles(
      subjectArea as SubjectArea,
      jurisdiction as StandardsJurisdiction
    );

    res.json({ suggestions });

  } catch (error) {
    console.error('Error getting course suggestions:', error);
    res.status(500).json({ error: 'Failed to get course suggestions' });
  }
}

// Get current classroom standards configuration
export async function getClassroomStandards(req: Request, res: Response) {
  try {
    const { classroomId } = req.params;
    
    if (!classroomId) {
      return res.status(400).json({ error: 'Classroom ID is required' });
    }

    // Get user and verify ownership
    const { user, customerUuid } = await ActiveUserService.requireActiveUserAndCustomerUuid(req);
    const classroom = await storage.getClassroomById(classroomId);
    
    if (!classroom || classroom.customerUuid !== customerUuid) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    // Get available standards for this classroom
    let availableStandards: CommonCoreStandard[] = [];
    if (classroom.courseTitle && classroom.standardsJurisdiction) {
      availableStandards = getStandardsForCourse(
        classroom.courseTitle,
        classroom.standardsJurisdiction as StandardsJurisdiction,
        classroom.subjectArea as SubjectArea
      );
    }

    res.json({
      classroom: {
        id: classroom.id,
        name: classroom.name,
        courseTitle: classroom.courseTitle,
        subjectArea: classroom.subjectArea,
        standardsJurisdiction: classroom.standardsJurisdiction,
        sbgEnabled: classroom.sbgEnabled,
        enabledStandards: classroom.enabledStandards || []
      },
      availableStandards,
      defaultEnabled: getDefaultEnabledStandards(availableStandards)
    });

  } catch (error) {
    console.error('Error getting classroom standards:', error);
    res.status(500).json({ error: 'Failed to get classroom standards' });
  }
}