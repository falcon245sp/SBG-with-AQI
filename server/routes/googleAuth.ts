import type { Request, Response } from "express";
import { GoogleAuthService } from "../services/googleAuth";
import { storage } from "../storage";
import { CustomerLookupService } from "../services/customerLookupService";
import { ActiveUserService } from "../services/activeUserService";

// Initialize Google Auth service with renamed environment variables
const googleAuth = new GoogleAuthService();

// Initiate basic Google authentication (profile + email only)
export async function initiateGoogleAuth(req: Request, res: Response) {
  try {
    console.log('\n=== ENHANCED OAUTH DEBUG ===');
    console.log('[DEBUG] Request Details:');
    console.log('- Method:', req.method);
    console.log('- URL:', req.url);
    console.log('- Host:', req.headers.host);
    console.log('- Origin:', req.headers.origin);
    console.log('- Referer:', req.headers.referer);
    console.log('- User-Agent:', req.headers['user-agent']);
    console.log('- Accept:', req.headers.accept);
    
    const isProduction = process.env.NODE_ENV === 'production';
    const envPrefix = isProduction ? 'PROD_' : 'DEV_';

    console.log('\n[DEBUG] Environment Variables:');
    console.log(`- Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`- ${envPrefix}GOOGLE_CLIENT_ID exists:`, !!process.env[`${envPrefix}GOOGLE_CLIENT_ID`]);
    console.log(`- ${envPrefix}GOOGLE_CLIENT_SECRET exists:`, !!process.env[`${envPrefix}GOOGLE_CLIENT_SECRET`]);
    console.log(`- ${envPrefix}GOOGLE_REDIRECT_URI:`, process.env[`${envPrefix}GOOGLE_REDIRECT_URI`]);
    console.log('- REPLIT_DOMAINS:', process.env.REPLIT_DOMAINS);
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    
    console.log('\n[OAuth] Initiating basic Google authentication');
    
    // Check if this is a direct browser request or API call
    const acceptHeader = req.get('Accept');
    const isDirectBrowserRequest = !acceptHeader || !acceptHeader.includes('application/json');
    
    const authUrl = googleAuth.getAuthUrl();
    console.log('\n[DEBUG] Generated OAuth URL Analysis:');
    console.log('- Full URL:', authUrl);
    
    // Parse URL components for detailed analysis
    try {
      const url = new URL(authUrl);
      console.log('- Protocol:', url.protocol);
      console.log('- Host:', url.host);
      console.log('- Pathname:', url.pathname);
      console.log('- Client ID:', url.searchParams.get('client_id'));
      console.log('- Redirect URI:', decodeURIComponent(url.searchParams.get('redirect_uri') || ''));
      console.log('- Response Type:', url.searchParams.get('response_type'));
      console.log('- Scope:', decodeURIComponent(url.searchParams.get('scope') || ''));
      console.log('- Access Type:', url.searchParams.get('access_type'));
      console.log('- Prompt:', url.searchParams.get('prompt'));
    } catch (urlError) {
      console.error('- URL parsing error:', urlError);
    }
    
    console.log('\n[DEBUG] Request Type Analysis:');
    console.log('- Accept Header:', acceptHeader);
    console.log('- Is Direct Browser Request:', isDirectBrowserRequest);
    
    if (isDirectBrowserRequest) {
      // Direct browser request - redirect to Google OAuth
      console.log('\n[OAuth] Direct browser request detected');
      console.log('[OAuth] Setting redirect response to:', authUrl);
      console.log('[OAuth] Response headers will include Location:', authUrl);
      res.redirect(authUrl);
      console.log('[OAuth] Redirect response sent');
    } else {
      // API request - return JSON
      console.log('\n[OAuth] API request detected');
      console.log('[OAuth] Returning JSON response with authUrl');
      res.json({ authUrl });
    }
    console.log('=== END OAUTH DEBUG ===\n');
  } catch (error) {
    console.error('\n[ERROR] OAuth Initialization Failed:');
    console.error('- Error Message:', (error as Error).message);
    console.error('- Error Stack:', (error as Error).stack);
    console.error('- Error Type:', (error as Error).constructor.name);
    res.status(500).json({ error: 'Failed to initiate Google authentication' });
  }
}

// Initiate Google authentication with full integration (Drive + Classroom)
export async function initiateFullIntegration(req: Request, res: Response) {
  try {
    console.log('[OAuth] Initiating Google authentication with Full Integration scopes (Drive + Classroom)');
    const authUrl = googleAuth.getFullAuthUrl('full_integration');
    console.log('[OAuth] Redirecting to:', authUrl);
    res.redirect(authUrl);
  } catch (error) {
    console.error('[OAuth] Error initiating Full Integration auth:', error);
    res.status(500).json({ error: 'Failed to initiate Google Full Integration authentication' });
  }
}

// Initiate Google authentication with Classroom scopes
export async function initiateClassroomAuth(req: Request, res: Response) {
  try {
    console.log('[OAuth] Initiating Google authentication with Classroom scopes');
    const authUrl = googleAuth.getClassroomAuthUrl('classroom_auth');
    console.log('[OAuth] Redirecting to:', authUrl);
    res.redirect(authUrl);
  } catch (error) {
    console.error('[OAuth] Error initiating Classroom auth:', error);
    res.status(500).json({ error: 'Failed to initiate Google Classroom authentication' });
  }
}

// Handle Google OAuth callback with renamed environment variables
export async function handleGoogleCallback(req: Request, res: Response) {
  try {
    const { code, error: oauthError, state } = req.query;
    
    console.log('[OAuth] Callback received with code:', !!code);
    console.log('[OAuth] OAuth error:', oauthError);
    console.log('[OAuth] State:', state);
    
    if (oauthError) {
      console.error('[OAuth] OAuth error in callback:', oauthError);
      return res.redirect(`/auth/error?error=${oauthError}&description=Google OAuth error`);
    }

    if (!code || typeof code !== 'string') {
      console.error('[OAuth] No authorization code received');
      return res.redirect('/auth/error?error=no_code&description=No authorization code received');
    }

    // Exchange code for tokens using renamed environment variables
    const tokens = await googleAuth.exchangeCodeForTokens(code);
    console.log('[OAuth] Tokens received, access token present:', !!tokens.access_token);

    // Get user profile from Google
    const userProfile = await googleAuth.getUserProfile(tokens.access_token!);
    console.log('[OAuth] User profile retrieved:', userProfile.email);

    // Create or update user in database
    const user = await storage.upsertGoogleUser({
      googleId: userProfile.id!,
      email: userProfile.email!,
      firstName: userProfile.given_name || undefined,
      lastName: userProfile.family_name || undefined,
      profileImageUrl: userProfile.picture || undefined,
      googleAccessToken: tokens.access_token || undefined,
      googleRefreshToken: tokens.refresh_token || undefined,
      googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    });

    // Set session
    (req as any).session.userId = user.id;
    (req as any).session.userEmail = user.email;
    
    console.log('[OAuth] User authenticated successfully:', user.email);
    console.log('[OAuth] Session userId set to:', user.id);
    
    // Check if user is in onboarding flow and redirect appropriately
    if (user.onboardingCompleted) {
      console.log('[OAuth] Authentication successful, user completed onboarding - redirecting to dashboard');
      res.redirect('/dashboard');
    } else {
      console.log('[OAuth] Authentication successful, user in onboarding - checking state for next step');
      
      // If this was classroom authentication, progress to standards configuration
      if (state === 'classroom_auth') {
        console.log('[OAuth] Classroom authentication complete, importing classrooms and progressing to standards configuration');
        
        try {
          // Import classrooms immediately after successful authentication
          const googleClassrooms = await googleAuth.getClassrooms(user.googleAccessToken!, user.googleRefreshToken || undefined);
          console.log(`[OAuth] Found ${googleClassrooms.length} classrooms to import`);
          
          // Get the complete user record with customerUuid (fixes timing issue with auto-generated field)
          const completeUser = await storage.getUserById(user.id);
          if (!completeUser?.customerUuid) {
            throw new Error('Customer UUID not found for user - database timing issue');
          }
          console.log(`[OAuth] Using customerUuid: ${completeUser.customerUuid} for classroom import`);
          
          // Import the classifier
          const { ClassroomClassifier } = await import('../services/classroomClassifier.js');
          
          // Classify and save/update classrooms in database with subject area detection
          const classifiedClassrooms = googleClassrooms.map((classroom: any) => {
            const classification = ClassroomClassifier.classifyClassroom({
              name: classroom.name,
              section: classroom.section,
              description: classroom.description
            });

            console.log(`[OAuth] Classifying "${classroom.name}":`, classification);

            return {
              ...classroom,
              detectedSubjectArea: classification.subjectArea,
              standardsJurisdiction: classification.suggestedJurisdiction,
              _classificationData: classification
            };
          });

          // Save/update classrooms using the syncClassrooms method with proper customerUuid
          const savedClassrooms = await storage.syncClassrooms(completeUser.customerUuid, classifiedClassrooms);
          console.log(`[OAuth] Successfully imported ${savedClassrooms.length} classrooms`);
          
        } catch (error) {
          console.error('[OAuth] Error importing classrooms:', error);
          // Continue anyway - user can manually sync later from dashboard
        }
        
        // Update user's onboarding step to standards-configuration
        await storage.updateUserPreferences(user.id, { 
          onboardingStep: 'standards-configuration' 
        });
        res.redirect('/onboarding/standards-configuration');
      } else {
        console.log('[OAuth] General authentication, redirecting to onboarding flow');
        // For general authentication, redirect to onboarding and let OnboardingCheck determine the correct step
        res.redirect('/onboarding');
      }
    }
  } catch (error) {
    console.error('[OAuth] Error in Google callback:', error);
    res.redirect('/auth/error?error=auth_failed&description=Authentication process failed');
  }
}

// Sync classroom data for authenticated user
export async function syncClassroomData(req: Request, res: Response) {
  try {
    const { user, customerUuid } = await ActiveUserService.requireActiveUserAndCustomerUuid(req);
    if (!user?.googleAccessToken) {
      return res.status(400).json({ error: 'Google access token not found' });
    }

    // Sync classrooms from Google Classroom API using getClassrooms method
    const googleClassrooms = await googleAuth.getClassrooms(user.googleAccessToken, user.googleRefreshToken || undefined);
    
    // Import the classifier at the top level
    const { ClassroomClassifier } = await import('../services/classroomClassifier.js');
    
    // Classify and save/update classrooms in database with subject area detection
    const classifiedClassrooms = googleClassrooms.map((classroom: any) => {
      const classification = ClassroomClassifier.classifyClassroom({
        name: classroom.name,
        section: classroom.section,
        description: classroom.description
      });
      
      console.log(`[OAuth] Classifying "${classroom.name}":`, classification);
      
      return {
        ...classroom,
        detectedSubjectArea: classification.subjectArea,
        standardsJurisdiction: classification.suggestedJurisdiction,
        _classificationData: classification // Include for debugging/frontend display
      };
    });
    
    const savedClassrooms = await storage.syncClassrooms(customerUuid, classifiedClassrooms);
    
    // Helper function to extract core course name for similarity matching
    const extractCoreCourseName = (classroomName: string): string | null => {
      // Common patterns: "Course Name - Period X", "Course Name (Period X)", "Course Name Pd X", etc.
      // Remove periods, sections, parentheses content, and common suffixes
      const cleaned = classroomName
        .replace(/\s*-\s*(period|pd|per|p)\s*\d+.*$/i, '') // "- Period 1", "- Pd 2"
        .replace(/\s*\((period|pd|per|p)?\s*\d+[^)]*\)/i, '') // "(Period 1)", "(Pd 2)"
        .replace(/\s+(period|pd|per|p)\s*\d+.*$/i, '') // "Period 1", "Pd 2"  
        .replace(/\s*-\s*section\s*[a-z0-9]+.*$/i, '') // "- Section A"
        .replace(/\s*\(section\s*[a-z0-9]+[^)]*\)/i, '') // "(Section A)"
        .replace(/\s+section\s*[a-z0-9]+.*$/i, '') // "Section A"
        .replace(/\s*-\s*[a-z0-9]+$/i, '') // Generic "- A", "- 1" at end
        .replace(/\s*\([a-z0-9]+\)$/i, '') // Generic "(A)", "(1)" at end
        .trim();
      
      // Return null if name is too short (likely just a section identifier)
      return cleaned.length >= 3 ? cleaned : null;
    };

    // Group similar classrooms for bulk configuration suggestion
    const similarGroups: Record<string, any[]> = {};
    const classroomsWithClassification = savedClassrooms.map((classroom: any) => ({
      ...classroom,
      _classificationData: classifiedClassrooms.find((c: any) => c.id === classroom.googleClassId)?._classificationData
    }));

    // Group classrooms by similar core names
    for (const classroom of classroomsWithClassification) {
      const coreCourseName = extractCoreCourseName(classroom.name);
      if (coreCourseName) {
        const key = coreCourseName.toLowerCase();
        if (!similarGroups[key]) {
          similarGroups[key] = [];
        }
        similarGroups[key].push(classroom);
      }
    }

    // Identify groups with 2+ classrooms for bulk configuration suggestion  
    const bulkConfigurationSuggestions = Object.entries(similarGroups)
      .filter(([_, classrooms]) => classrooms.length >= 2)
      .map(([coreCourseName, classrooms]) => ({
        coreCourseName: classrooms[0] ? extractCoreCourseName(classrooms[0].name) : coreCourseName,
        classrooms: classrooms.map(c => ({
          id: c.id,
          name: c.name,
          section: c.section
        })),
        count: classrooms.length
      }));

    console.log(`[OAuth] Found ${bulkConfigurationSuggestions.length} similar course groups for bulk configuration`);

    res.json({
      success: true,
      message: `Synced ${savedClassrooms.length} classrooms`,
      classrooms: classroomsWithClassification,
      bulkConfigurationSuggestions // New field for similar course groupings
    });
  } catch (error) {
    console.error('[OAuth] Error syncing classroom data:', error);
    res.status(500).json({ error: 'Failed to sync classroom data' });
  }
}

// Get user's classrooms
export async function getUserClassrooms(req: Request, res: Response) {
  try {
    const { user, customerUuid } = await ActiveUserService.requireActiveUserAndCustomerUuid(req);
    const classrooms = await storage.getTeacherClassrooms(customerUuid);
    res.json(classrooms);
  } catch (error) {
    console.error('[OAuth] Error fetching user classrooms:', error);
    res.status(500).json({ error: 'Failed to fetch classrooms' });
  }
}

// Get current authenticated user
export async function getCurrentUser(req: Request, res: Response) {
  try {
    const user = await ActiveUserService.requireActiveUser(req);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return user without sensitive information
    const { passwordHash, googleAccessToken, googleRefreshToken, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    console.error('[OAuth] Error fetching current user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}

// Get assignments for a specific classroom
export async function getClassroomAssignments(req: Request, res: Response) {
  try {
    const user = await ActiveUserService.requireActiveUser(req);
    if (!user?.googleAccessToken) {
      return res.status(400).json({ error: 'Google access token not found' });
    }

    const { classroomId } = req.params;
    if (!classroomId) {
      return res.status(400).json({ error: 'Classroom ID is required' });
    }

    // Get the classroom to find the Google Class ID
    const { customerUuid } = await ActiveUserService.requireActiveUserAndCustomerUuid(req);
    const classroom = await storage.getClassroomById(classroomId);
    if (!classroom || classroom.customerUuid !== customerUuid) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    // Fetch assignments from Google Classroom API
    const assignments = await googleAuth.getAssignments(
      classroom.googleClassId, 
      user.googleAccessToken, 
      user.googleRefreshToken || undefined
    );
    
    res.json({
      success: true,
      assignments,
      count: assignments.length
    });
  } catch (error) {
    console.error('[OAuth] Error fetching classroom assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
}

// Sync assignments for all user's classrooms
export async function syncAssignments(req: Request, res: Response) {
  try {
    const user = await ActiveUserService.requireActiveUser(req);
    if (!user?.googleAccessToken) {
      return res.status(400).json({ error: 'Google access token not found' });
    }

    const { customerUuid } = await ActiveUserService.requireActiveUserAndCustomerUuid(req);
    
    // Get all user's classrooms
    const classrooms = await storage.getTeacherClassrooms(customerUuid);
    
    let totalAssignments = 0;
    const syncResults = [];

    for (const classroom of classrooms) {
      try {
        // Fetch assignments from Google Classroom API
        const googleAssignments = await googleAuth.getAssignments(
          classroom.googleClassId, 
          user.googleAccessToken, 
          user.googleRefreshToken || undefined
        );

        // Store/update assignments in database
        for (const assignment of googleAssignments) {
          const assignmentData = {
            googleCourseWorkId: assignment.id,
            classroomId: classroom.id,
            customerUuid: customerUuid,
            title: assignment.title,
            description: assignment.description || null,
            materials: assignment.materials || null,
            workType: assignment.workType || 'ASSIGNMENT',
            state: assignment.state || 'PUBLISHED',
            maxPoints: assignment.maxPoints ? assignment.maxPoints.toString() : null,
            dueDate: assignment.dueDate ? new Date(assignment.dueDate.year, assignment.dueDate.month - 1, assignment.dueDate.day) : null,
            creationTime: assignment.creationTime ? new Date(assignment.creationTime) : null,
            updateTime: assignment.updateTime ? new Date(assignment.updateTime) : null,
          };

          await storage.upsertAssignment(assignmentData);
          totalAssignments++;
        }

        syncResults.push({
          classroomId: classroom.id,
          classroomName: classroom.name,
          assignmentCount: googleAssignments.length
        });

      } catch (classroomError) {
        console.error(`Error syncing assignments for classroom ${classroom.id}:`, classroomError);
        syncResults.push({
          classroomId: classroom.id,
          classroomName: classroom.name,
          error: 'Failed to sync assignments'
        });
      }
    }
    
    res.json({
      success: true,
      message: `Synced ${totalAssignments} assignments across ${classrooms.length} classrooms`,
      totalAssignments,
      classrooms: syncResults
    });
  } catch (error) {
    console.error('[OAuth] Error syncing assignments:', error);
    res.status(500).json({ error: 'Failed to sync assignments' });
  }
}

// Get specific assignment details
export async function getAssignmentDetails(req: Request, res: Response) {
  try {
    const user = await ActiveUserService.requireActiveUser(req);
    if (!user?.googleAccessToken) {
      return res.status(400).json({ error: 'Google access token not found' });
    }

    const { classroomId, assignmentId } = req.params;
    if (!classroomId || !assignmentId) {
      return res.status(400).json({ error: 'Classroom ID and Assignment ID are required' });
    }

    // Get the assignment from database
    const { customerUuid } = await ActiveUserService.requireActiveUserAndCustomerUuid(req);
    const assignment = await storage.getAssignmentById(assignmentId);
    
    if (!assignment || assignment.customerUuid !== customerUuid) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Get fresh data from Google Classroom API if needed
    const classroom = await storage.getClassroomById(classroomId);
    if (classroom) {
      try {
        const googleAssignment = await googleAuth.getAssignment(
          classroom.googleClassId,
          assignment.googleCourseWorkId,
          user.googleAccessToken,
          user.googleRefreshToken || undefined
        );
        
        res.json({
          success: true,
          assignment: {
            ...assignment,
            googleData: googleAssignment
          }
        });
      } catch (googleError) {
        // Fall back to database data if Google API fails
        res.json({
          success: true,
          assignment
        });
      }
    } else {
      res.json({
        success: true,
        assignment
      });
    }
  } catch (error) {
    console.error('[OAuth] Error fetching assignment details:', error);
    res.status(500).json({ error: 'Failed to fetch assignment details' });
  }
}

// Get students for a specific classroom
export async function getClassroomStudents(req: Request, res: Response) {
  try {
    const user = await ActiveUserService.requireActiveUser(req);
    if (!user?.googleAccessToken) {
      return res.status(400).json({ error: 'Google access token not found' });
    }

    const { classroomId } = req.params;
    if (!classroomId) {
      return res.status(400).json({ error: 'Classroom ID is required' });
    }

    // Get the classroom to find the Google Class ID
    const { customerUuid } = await ActiveUserService.requireActiveUserAndCustomerUuid(req);
    const classroom = await storage.getClassroomById(classroomId);
    
    if (!classroom || classroom.customerUuid !== customerUuid) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    // Get students from Google Classroom API
    const googleStudents = await googleAuth.getStudents(
      classroom.googleClassId,
      user.googleAccessToken,
      user.googleRefreshToken || undefined
    );

    // Transform the data for frontend consumption
    const students = googleStudents.map((student: any) => ({
      id: student.userId,
      firstName: student.profile?.name?.givenName || '',
      lastName: student.profile?.name?.familyName || '',
      email: student.profile?.emailAddress || '',
      photoUrl: student.profile?.photoUrl || null,
    }));

    res.json(students);
  } catch (error) {
    console.error('[OAuth] Error fetching classroom students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
}

// Update classroom classification and SBG settings
export async function updateClassroomClassification(req: Request, res: Response) {
  try {
    const { classroomId } = req.params;
    const { subjectArea, standardsJurisdiction, sbgEnabled, courseTitle, enabledStandards } = req.body;
    
    if (!classroomId) {
      return res.status(400).json({ error: 'Classroom ID is required' });
    }

    // Validate subject area and jurisdiction if provided
    const { SubjectArea, StandardsJurisdiction } = await import('../../shared/businessEnums.js');
    
    if (subjectArea && !Object.values(SubjectArea).includes(subjectArea)) {
      return res.status(400).json({ error: 'Invalid subject area' });
    }
    
    if (standardsJurisdiction && !Object.values(StandardsJurisdiction).includes(standardsJurisdiction)) {
      return res.status(400).json({ error: 'Invalid standards jurisdiction' });
    }

    // Get user and verify ownership
    const { user, customerUuid } = await ActiveUserService.requireActiveUserAndCustomerUuid(req);
    const classroom = await storage.getClassroomById(classroomId);
    
    if (!classroom || classroom.customerUuid !== customerUuid) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    // Build update object with only provided fields
    const updates: any = { updatedAt: new Date() };
    if (subjectArea !== undefined) updates.subjectArea = subjectArea;
    if (standardsJurisdiction !== undefined) updates.standardsJurisdiction = standardsJurisdiction;
    if (sbgEnabled !== undefined) updates.sbgEnabled = sbgEnabled;
    if (courseTitle !== undefined) updates.courseTitle = courseTitle;
    if (enabledStandards !== undefined) updates.enabledStandards = enabledStandards;

    // Update the classroom
    const updatedClassroom = await storage.updateClassroom(classroomId, updates);

    res.json({
      success: true,
      message: 'Classroom settings updated successfully',
      classroom: updatedClassroom
    });
  } catch (error) {
    console.error('[OAuth] Error updating classroom settings:', error);
    res.status(500).json({ error: 'Failed to update classroom settings' });
  }
}