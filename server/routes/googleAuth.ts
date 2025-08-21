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

// Initiate Google authentication with Classroom scopes
export async function initiateClassroomAuth(req: Request, res: Response) {
  try {
    console.log('[OAuth] Initiating Google authentication with Classroom scopes');
    const authUrl = googleAuth.getClassroomAuthUrl();
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
    
    // Redirect to dashboard on successful authentication
    console.log('[OAuth] Authentication successful, redirecting to dashboard');
    res.redirect('/dashboard');
  } catch (error) {
    console.error('[OAuth] Error in Google callback:', error);
    res.redirect('/auth/error?error=auth_failed&description=Authentication process failed');
  }
}

// Sync classroom data for authenticated user
export async function syncClassroomData(req: Request, res: Response) {
  try {
    const user = await ActiveUserService.requireActiveUser(req);
    if (!user?.googleAccessToken) {
      return res.status(400).json({ error: 'Google access token not found' });
    }

    // Sync classrooms from Google Classroom API using getClassrooms method
    const classrooms = await googleAuth.getClassrooms(user.googleAccessToken, user.googleRefreshToken || undefined);
    
    res.json({
      success: true,
      message: `Synced ${classrooms.length} classrooms`,
      classrooms
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
            maxPoints: assignment.maxPoints ? parseFloat(assignment.maxPoints) : null,
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