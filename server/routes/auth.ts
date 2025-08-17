import { Request, Response } from 'express';
import { storage } from '../storage';
import { googleAuthService } from '../services/googleAuth';

// Check authentication status and refresh tokens if needed
export const checkAuthStatus = async (req: Request, res: Response) => {
  console.log('[Auth] Checking authentication status');
  
  try {
    const { googleId } = req.query;
    
    if (!googleId || typeof googleId !== 'string') {
      console.log('[Auth] No googleId provided');
      return res.json({ authenticated: false });
    }

    console.log('[Auth] Looking up user with googleId:', googleId);
    const user = await storage.getUserByGoogleId(googleId);
    
    if (!user) {
      console.log('[Auth] User not found in database');
      return res.json({ authenticated: false });
    }

    console.log('[Auth] User found, checking token expiry:', {
      userId: user.id,
      hasAccessToken: !!user.googleAccessToken,
      hasRefreshToken: !!user.googleRefreshToken,
      tokenExpiry: user.googleTokenExpiry
    });

    // Check if token is expired
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
          
          return res.json({ 
            authenticated: true, 
            user: {
              id: user.id,
              googleId: user.googleId,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              classroomConnected: user.classroomConnected
            },
            tokenRefreshed: true
          });
        } catch (error) {
          console.error('[Auth] ERROR - Token refresh failed:', {
            error_type: 'GOOGLE_API_ERROR',
            error: error
          });
          
          // If refresh fails, user needs to re-authenticate
          return res.json({ authenticated: false, requiresReauth: true });
        }
      } else {
        console.log('[Auth] No refresh token available, re-authentication required');
        return res.json({ authenticated: false, requiresReauth: true });
      }
    }

    // Token is still valid
    console.log('[Auth] Access token still valid');
    return res.json({ 
      authenticated: true, 
      user: {
        id: user.id,
        googleId: user.googleId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        classroomConnected: user.classroomConnected
      }
    });

  } catch (error: any) {
    console.error('[Auth] ERROR - Auth status check failed:', {
      error_type: 'APPLICATION_ERROR',
      error_message: error.message,
      error_stack: error.stack
    });
    
    res.status(500).json({ error: 'Failed to check authentication status' });
  }
};