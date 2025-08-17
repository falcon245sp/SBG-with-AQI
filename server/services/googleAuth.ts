import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// Use environment variable if set, otherwise use Replit domain
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `https://${process.env.REPLIT_DOMAINS}/api/auth/google/callback`;
console.log('Using redirect URI:', REDIRECT_URI);

// OAuth scopes needed
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly'
];

export class GoogleAuthService {
  private oauth2Client: OAuth2Client;

  constructor() {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured');
    }

    this.oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      REDIRECT_URI
    );
  }

  // Generate authorization URL
  getAuthUrl(state?: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent', // Force consent screen to get refresh token
      state: state // Optional state parameter for CSRF protection
    });
  }

  // Exchange authorization code for tokens
  async getTokens(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }

  // Get user info from Google
  async getUserInfo(accessToken: string) {
    const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
    this.oauth2Client.setCredentials({ access_token: accessToken });
    
    const { data } = await oauth2.userinfo.get();
    return data;
  }

  // Get Google Classroom courses
  async getClassrooms(accessToken: string, refreshToken?: string) {
    this.oauth2Client.setCredentials({ 
      access_token: accessToken,
      refresh_token: refreshToken 
    });

    const classroom = google.classroom({ version: 'v1', auth: this.oauth2Client });
    
    try {
      const response = await classroom.courses.list({
        courseStates: ['ACTIVE'],
        teacherId: 'me' // Only courses where user is teacher
      });
      
      return response.data.courses || [];
    } catch (error) {
      console.error('Error fetching classrooms:', error);
      throw error;
    }
  }

  // Get students for a specific classroom
  async getStudents(courseId: string, accessToken: string, refreshToken?: string) {
    this.oauth2Client.setCredentials({ 
      access_token: accessToken,
      refresh_token: refreshToken 
    });

    const classroom = google.classroom({ version: 'v1', auth: this.oauth2Client });
    
    try {
      const response = await classroom.courses.students.list({
        courseId: courseId
      });
      
      return response.data.students || [];
    } catch (error) {
      console.error('Error fetching students:', error);
      throw error;
    }
  }

  // Refresh access token using refresh token
  async refreshAccessToken(refreshToken: string) {
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      return credentials;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw error;
    }
  }

  // Check if token is expired
  isTokenExpired(expiryDate?: Date): boolean {
    if (!expiryDate) return true;
    return Date.now() >= expiryDate.getTime();
  }
}

export const googleAuthService = new GoogleAuthService();