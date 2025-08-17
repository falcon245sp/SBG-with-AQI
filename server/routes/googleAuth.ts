import { Request, Response } from 'express';
import { googleAuthService } from '../services/googleAuth';
import { storage } from '../storage';

// Start Google OAuth flow
export const initiateGoogleAuth = async (req: Request, res: Response) => {
  try {
    const authUrl = googleAuthService.getAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    console.error('Error initiating Google auth:', error);
    res.status(500).json({ error: 'Failed to initiate authentication' });
  }
};

// Handle Google OAuth callback
export const handleGoogleCallback = async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    // Exchange code for tokens
    const tokens = await googleAuthService.getTokens(code);
    
    if (!tokens.access_token) {
      return res.status(400).json({ error: 'Failed to obtain access token' });
    }

    // Get user info from Google
    const userInfo = await googleAuthService.getUserInfo(tokens.access_token);
    
    if (!userInfo.id || !userInfo.email) {
      return res.status(400).json({ error: 'Failed to obtain user information' });
    }

    // Create or update user in database
    const user = await storage.upsertUser({
      googleId: userInfo.id,
      email: userInfo.email,
      firstName: userInfo.given_name || '',
      lastName: userInfo.family_name || '',
      profileImageUrl: userInfo.picture,
      googleAccessToken: tokens.access_token,
      googleRefreshToken: tokens.refresh_token,
      googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      classroomConnected: false, // Will be set to true after classroom auth
    });

    // Redirect with Google ID as URL parameter for client-side storage
    console.log('Redirecting to callback with googleId:', user.googleId);
    res.redirect(`/auth/callback?googleId=${user.googleId}`);
  } catch (error) {
    console.error('Error in Google callback:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Sync Google Classroom data
export const syncClassroomData = async (req: Request, res: Response) => {
  try {
    // For development, we'll use the Google ID from the token
    // In production, implement proper session management
    const { googleId } = req.body;
    
    if (!googleId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const user = await storage.getUserByGoogleId(googleId);
    
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
    const { googleId } = req.query;
    
    if (!googleId || typeof googleId !== 'string') {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const user = await storage.getUserByGoogleId(googleId);
    
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
  try {
    const { googleId } = req.query;
    
    if (!googleId || typeof googleId !== 'string') {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const user = await storage.getUserByGoogleId(googleId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

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
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};