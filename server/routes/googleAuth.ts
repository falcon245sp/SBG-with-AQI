import { Request, Response } from 'express';
import { googleAuthService } from '../services/googleAuth';
import { storage } from '../storage';

// Start Google OAuth flow (BASIC auth - profile + email only)
export const initiateGoogleAuth = async (req: Request, res: Response) => {
  console.log('[OAuth] Client requesting BASIC Google OAuth initiation from IP:', req.ip);
  try {
    const authUrl = googleAuthService.getAuthUrl();
    console.log('[OAuth] Successfully generated BASIC auth URL, responding to client');
    res.json({ authUrl });
  } catch (error: any) {
    console.error('[OAuth] ERROR - Failed to initiate Google auth:', {
      error_type: 'APPLICATION_ERROR',
      error_message: error.message,
      error_stack: error.stack
    });
    res.status(500).json({ error: 'Failed to initiate authentication' });
  }
};

// Start Google Classroom OAuth flow (CLASSROOM auth - additional scopes)
export const initiateClassroomAuth = async (req: Request, res: Response) => {
  console.log('[OAuth] Client requesting CLASSROOM Google OAuth initiation from IP:', req.ip);
  
  // Check if user is already authenticated with basic Google auth
  const sessionGoogleId = (req as any).session?.googleId;
  if (!sessionGoogleId) {
    return res.status(401).json({ error: 'User must be logged in first before connecting classroom' });
  }
  
  try {
    const authUrl = googleAuthService.getClassroomAuthUrl('classroom_auth');
    console.log('[OAuth] Successfully generated CLASSROOM auth URL, responding to client');
    res.json({ authUrl });
  } catch (error: any) {
    console.error('[OAuth] ERROR - Failed to initiate classroom auth:', {
      error_type: 'APPLICATION_ERROR',
      error_message: error.message,
      error_stack: error.stack
    });
    res.status(500).json({ error: 'Failed to initiate classroom authentication' });
  }
};

// Handle Google OAuth callback
export const handleGoogleCallback = async (req: Request, res: Response) => {
  console.log('[OAuth] =================================');
  console.log('[OAuth] Google OAuth callback initiated');
  console.log('[OAuth] Request IP:', req.ip);
  console.log('[OAuth] Request headers:', {
    'user-agent': req.headers['user-agent'],
    'referer': req.headers.referer,
    'x-forwarded-for': req.headers['x-forwarded-for']
  });
  console.log('[OAuth] Query parameters:', req.query);
  
  try {
    const { code, error, error_description, state } = req.query;
    
    // Check for OAuth errors from Google
    if (error) {
      console.error('[OAuth] ERROR - Google OAuth returned error:', {
        error_type: 'GOOGLE_OAUTH_ERROR',
        error_code: error,
        error_description: error_description,
        state: state
      });
      return res.redirect(`/auth/error?error=${encodeURIComponent(error as string)}&description=${encodeURIComponent(error_description as string || 'Google OAuth error')}`);
    }
    
    if (!code || typeof code !== 'string') {
      console.error('[OAuth] ERROR - No authorization code provided:', {
        error_type: 'APPLICATION_ERROR',
        code_present: !!code,
        code_type: typeof code,
        query_params: req.query
      });
      return res.redirect('/auth/error?error=no_code&description=Authorization code not provided');
    }

    console.log('[OAuth] Authorization code received, proceeding with token exchange...');
    
    try {
      // Exchange code for tokens
      const tokens = await googleAuthService.getTokens(code);
      
      if (!tokens.access_token) {
        console.error('[OAuth] ERROR - No access token in response:', {
          error_type: 'APPLICATION_ERROR',
          tokens_received: Object.keys(tokens)
        });
        return res.redirect('/auth/error?error=no_access_token&description=Failed to obtain access token');
      }

      console.log('[OAuth] Token exchange successful, fetching user information...');
      
      // Get user info from Google
      const userInfo = await googleAuthService.getUserInfo(tokens.access_token);
    
      if (!userInfo.id || !userInfo.email) {
        console.error('[OAuth] ERROR - Incomplete user information:', {
          error_type: 'APPLICATION_ERROR',
          has_id: !!userInfo.id,
          has_email: !!userInfo.email,
          userinfo_keys: Object.keys(userInfo)
        });
        return res.redirect('/auth/error?error=no_user_info&description=Failed to obtain complete user information');
      }

      console.log('[OAuth] User information retrieved, saving to database...');
      
      // Create or update user in database
      const userData = {
        googleId: userInfo.id,
        email: userInfo.email,
        firstName: userInfo.given_name || '',
        lastName: userInfo.family_name || '',
        profileImageUrl: userInfo.picture,
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        classroomConnected: (state === 'classroom_auth'), // True if this is classroom auth flow
      };
      
      console.log('[OAuth] Attempting to upsert user with data:', {
        googleId: userData.googleId,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        has_access_token: !!userData.googleAccessToken,
        has_refresh_token: !!userData.googleRefreshToken
      });

      const user = await storage.upsertUser(userData);

      console.log('[OAuth] User upserted successfully:', {
        database_id: user.id,
        google_id: user.googleId,
        email: user.email
      });
      
      // Store googleId and timestamp in session instead of URL parameter
      console.log('[OAuth] Session before storing data:', (req as any).session);
      (req as any).session.googleId = user.googleId;
      (req as any).session.lastAuthTime = Date.now();
      console.log('[OAuth] GoogleId and auth timestamp stored in session:', user.googleId);
      console.log('[OAuth] Session after storing data:', (req as any).session);
    
      // Different redirect based on auth flow type
      const isClassroomAuth = state === 'classroom_auth';
      const redirectUrl = isClassroomAuth ? `/dashboard` : `/auth/classroom-setup`;
      console.log('[OAuth] Authentication complete, redirecting to:', redirectUrl);
      console.log('[OAuth] Auth flow type:', isClassroomAuth ? 'CLASSROOM_AUTH' : 'BASIC_AUTH');
      console.log('[OAuth] =================================');
      
      res.redirect(redirectUrl);
    } catch (tokenError: any) {
      console.error('[OAuth] ERROR - Token exchange failed:', {
        error_type: 'GOOGLE_API_ERROR',
        error_name: tokenError.name,
        error_message: tokenError.message,
        error_code: tokenError.code,
        error_status: tokenError.status,
        error_response: tokenError.response?.data,
        full_error: JSON.stringify(tokenError, null, 2)
      });
      return res.redirect('/auth/error?error=token_exchange_failed&description=Failed to exchange authorization code for tokens');
    }
  } catch (error: any) {
    console.error('[OAuth] ERROR - Unhandled exception in callback:', {
      error_type: 'APPLICATION_ERROR',
      error_name: error.name,
      error_message: error.message,
      error_stack: error.stack
    });
    console.log('[OAuth] =================================');
    
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    res.redirect(`/auth/error?error=server_error&description=${encodeURIComponent(errorMessage)}`);
  }
};

// Sync Google Classroom data
export const syncClassroomData = async (req: Request, res: Response) => {
  try {
    // Check session for googleId and auth timestamp
    const sessionGoogleId = (req as any).session?.googleId;
    const lastAuthTime = (req as any).session?.lastAuthTime;
    
    if (!sessionGoogleId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    // Force re-auth every 5 days
    const fiveDays = 5 * 24 * 60 * 60 * 1000;
    if (!lastAuthTime || (Date.now() - lastAuthTime) > fiveDays) {
      (req as any).session.googleId = null;
      (req as any).session.lastAuthTime = null;
      return res.status(401).json({ error: 'Authentication expired, please sign in again' });
    }

    const user = await storage.getUserByGoogleId(sessionGoogleId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = user.id;

    if (!user || !user.googleAccessToken) {
      return res.status(401).json({ error: 'Google authentication required' });
    }

    // Check if token is expired and refresh if needed
    let accessToken = user.googleAccessToken;
    if (user.googleTokenExpiry && googleAuthService.isTokenExpired(user.googleTokenExpiry)) {
      if (user.googleRefreshToken) {
        const refreshedTokens = await googleAuthService.refreshAccessToken(user.googleRefreshToken);
        accessToken = refreshedTokens.access_token!;
        
        // Update user with new tokens
        await storage.updateUserTokens(
          userId,
          accessToken,
          refreshedTokens.refresh_token || undefined,
          refreshedTokens.expiry_date ? new Date(refreshedTokens.expiry_date) : undefined
        );
      } else {
        return res.status(401).json({ error: 'Token expired and no refresh token available' });
      }
    }

    // Fetch classrooms from Google Classroom
    const classroomData = await googleAuthService.getClassrooms(accessToken, user.googleRefreshToken || undefined);
    
    // Sync classrooms to database
    const syncedClassrooms = await storage.syncClassrooms(userId, classroomData);
    
    // Sync students for each classroom
    const classroomsWithStudents = [];
    for (const classroom of syncedClassrooms) {
      console.log(`Syncing students for classroom: ${classroom.name} (${classroom.googleClassId})`);
      
      const studentData = await googleAuthService.getStudents(
        classroom.googleClassId,
        accessToken,
        user.googleRefreshToken || undefined
      );
      
      console.log(`Found ${studentData.length} students from Google API for ${classroom.name}`);
      
      const syncedStudents = await storage.syncStudents(classroom.id, studentData);
      
      console.log(`Synced ${syncedStudents.length} students to database for ${classroom.name}`);
      
      classroomsWithStudents.push({
        ...classroom,
        students: syncedStudents
      });
    }

    // Mark user as classroom connected
    await storage.updateUserTokens(userId, accessToken, user.googleRefreshToken || undefined, user.googleTokenExpiry || undefined);
    await storage.upsertUser({
      ...user,
      classroomConnected: true
    });

    res.json({
      success: true,
      classrooms: classroomsWithStudents
    });

  } catch (error) {
    console.error('Error syncing classroom data:', error);
    res.status(500).json({ error: 'Failed to sync classroom data' });
  }
};

// Get user's classrooms and students
export const getUserClassrooms = async (req: Request, res: Response) => {
  try {
    // Check session for googleId and auth timestamp
    const sessionGoogleId = (req as any).session?.googleId;
    const lastAuthTime = (req as any).session?.lastAuthTime;
    
    if (!sessionGoogleId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    // Force re-auth every 5 days
    const fiveDays = 5 * 24 * 60 * 60 * 1000;
    if (!lastAuthTime || (Date.now() - lastAuthTime) > fiveDays) {
      (req as any).session.googleId = null;
      (req as any).session.lastAuthTime = null;
      return res.status(401).json({ error: 'Authentication expired, please sign in again' });
    }

    const user = await storage.getUserByGoogleId(sessionGoogleId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = user.id;

    const classrooms = await storage.getTeacherClassrooms(userId);
    
    // Get students for each classroom
    const classroomsWithStudents = await Promise.all(
      classrooms.map(async (classroom) => {
        const students = await storage.getClassroomStudents(classroom.id);
        return {
          ...classroom,
          students
        };
      })
    );

    res.json(classroomsWithStudents);
  } catch (error) {
    console.error('Error fetching classrooms:', error);
    res.status(500).json({ error: 'Failed to fetch classrooms' });
  }
};

// Get current user info
export const getCurrentUser = async (req: Request, res: Response) => {
  console.log('[Auth] Getting current user');
  console.log('[Auth] Full session data:', (req as any).session);
  
  try {
    // Check session first for googleId
    const sessionGoogleId = (req as any).session?.googleId;
    const lastAuthTime = (req as any).session?.lastAuthTime;
    console.log('[Auth] Session googleId:', sessionGoogleId, 'lastAuthTime:', lastAuthTime);
    
    if (!sessionGoogleId) {
      console.log('[Auth] No googleId in session, user not authenticated');
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // Force re-auth every 5 days (5 * 24 * 60 * 60 * 1000 = 432000000 ms)
    const fiveDays = 5 * 24 * 60 * 60 * 1000;
    if (!lastAuthTime || (Date.now() - lastAuthTime) > fiveDays) {
      console.log('[Auth] Session older than 5 days, forcing re-authentication');
      (req as any).session.googleId = null;
      (req as any).session.lastAuthTime = null;
      return res.status(401).json({ error: 'Authentication failed' });
    }

    console.log('[Auth] Looking up user with googleId from session:', sessionGoogleId);
    const user = await storage.getUserByGoogleId(sessionGoogleId);
    
    if (!user) {
      console.log('[Auth] User not found in database');
      // Clear invalid session
      (req as any).session.googleId = null;
      (req as any).session.lastAuthTime = null;
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // Check if token is expired and refresh if needed
    if (user.googleTokenExpiry && googleAuthService.isTokenExpired(user.googleTokenExpiry)) {
      console.log('[Auth] Access token expired, attempting refresh...');
      
      if (user.googleRefreshToken) {
        try {
          const refreshedTokens = await googleAuthService.refreshAccessToken(user.googleRefreshToken);
          
          console.log('[Auth] Token refresh successful');
          
          // Update user with new tokens
          await storage.updateUserTokens(
            user.id,
            refreshedTokens.access_token!,
            refreshedTokens.refresh_token || user.googleRefreshToken,
            refreshedTokens.expiry_date ? new Date(refreshedTokens.expiry_date) : undefined
          );
          
          console.log('[Auth] User tokens updated successfully');
        } catch (error) {
          console.error('[Auth] ERROR - Token refresh failed:', {
            error_type: 'GOOGLE_API_ERROR',
            error: error
          });
          
          // Clear invalid session and require re-authentication
          (req as any).session.googleId = null;
          (req as any).session.lastAuthTime = null;
          return res.status(401).json({ error: 'Authentication failed' });
        }
      } else {
        console.log('[Auth] No refresh token available, re-authentication required');
        // Clear invalid session
        (req as any).session.googleId = null;
        (req as any).session.lastAuthTime = null;
        return res.status(401).json({ error: 'Authentication failed' });
      }
    }

    console.log('[Auth] User authenticated successfully:', {
      userId: user.id,
      email: user.email,
      classroomConnected: user.classroomConnected
    });

    // Don't send sensitive token data to client
    const safeUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      classroomConnected: user.classroomConnected
    };

    res.json(safeUser);
  } catch (error: any) {
    console.error('[Auth] ERROR - Get current user failed:', {
      error_type: 'APPLICATION_ERROR',
      error_message: error.message,
      error_stack: error.stack
    });
    
    res.status(500).json({ error: 'Failed to get current user' });
  }
};