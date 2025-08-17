import type { Request, Response } from "express";
import { GoogleAuthService } from "../services/googleAuth";
import { storage } from "../storage";

// Initialize Google Auth service with renamed environment variables
const googleAuth = new GoogleAuthService();

// Initiate basic Google authentication (profile + email only)
export async function initiateGoogleAuth(req: Request, res: Response) {
  try {
    console.log('[OAuth] Initiating basic Google authentication');
    const authUrl = googleAuth.getAuthUrl();
    console.log('[OAuth] Generated auth URL:', authUrl);
    res.json({ authUrl });
  } catch (error) {
    console.error('[OAuth] Error initiating Google auth:', error);
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
    
    // Always redirect back to the current frontend domain with success parameters
    const currentDomain = process.env.REPLIT_DOMAINS?.split(',')[0];
    const frontendUrl = `https://${currentDomain}/?auth=success&user=${encodeURIComponent(user.email || '')}`;
    
    console.log('[OAuth] Redirecting to frontend with auth success:', frontendUrl);
    res.redirect(frontendUrl);
  } catch (error) {
    console.error('[OAuth] Error in Google callback:', error);
    res.redirect('/auth/error?error=auth_failed&description=Authentication process failed');
  }
}

// Sync classroom data for authenticated user
export async function syncClassroomData(req: Request, res: Response) {
  try {
    const userId = (req as any).session?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const user = await storage.getUser(userId);
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
    const userId = (req as any).session?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const classrooms = await storage.getTeacherClassrooms(userId);
    res.json(classrooms);
  } catch (error) {
    console.error('[OAuth] Error fetching user classrooms:', error);
    res.status(500).json({ error: 'Failed to fetch classrooms' });
  }
}

// Get current authenticated user
export async function getCurrentUser(req: Request, res: Response) {
  try {
    const userId = (req as any).session?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const user = await storage.getUser(userId);
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