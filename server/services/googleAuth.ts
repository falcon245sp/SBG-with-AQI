import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// Always use the production domain from environment variable
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `https://${process.env.REPLIT_DOMAINS}/api/auth/google/callback`;
console.log('OAuth Debug Info:');
console.log('- Using redirect URI:', REDIRECT_URI);
console.log('- GOOGLE_REDIRECT_URI env var:', process.env.GOOGLE_REDIRECT_URI);
console.log('- REPLIT_DOMAINS env var:', process.env.REPLIT_DOMAINS);
console.log('- Expected GCP URI: https://docu-proc-serv-jfielder1.replit.app/api/auth/google/callback');

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

    // Force the production redirect URI - MUST use environment variable
    const PRODUCTION_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
    
    if (!PRODUCTION_REDIRECT_URI) {
      throw new Error('GOOGLE_REDIRECT_URI environment variable is required');
    }
    
    this.oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      PRODUCTION_REDIRECT_URI
    );
    
    console.log('OAuth2Client initialized with redirect URI:', PRODUCTION_REDIRECT_URI || REDIRECT_URI);
  }

  // Generate authorization URL
  getAuthUrl(state?: string): string {
    console.log('=== OAuth URL Generation Debug ===');
    console.log('OAuth2Client redirect URI:', this.oauth2Client.redirectUri);
    console.log('REDIRECT_URI constant:', REDIRECT_URI);
    console.log('Environment GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI);
    
    // Try with minimal configuration to isolate issue
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'], // Minimal scopes for testing
      prompt: 'consent',
      state: state
    });
    
    console.log('Final generated auth URL:', authUrl);
    console.log('Extracted redirect_uri from URL:', authUrl.match(/redirect_uri=([^&]*)/)?.[1]);
    
    return authUrl;
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
      // Use pagination to ensure we get ALL students
      let allStudents: any[] = [];
      let pageToken: string | undefined;
      
      do {
        const response = await classroom.courses.students.list({
          courseId: courseId,
          pageSize: 100, // Maximum page size
          pageToken: pageToken
        });
        
        const students = response.data.students || [];
        allStudents = allStudents.concat(students);
        pageToken = response.data.nextPageToken || undefined;
        
        console.log(`Retrieved ${students.length} students (page token: ${pageToken ? 'more pages' : 'last page'}) for course ${courseId}`);
      } while (pageToken);
      
      console.log(`Total students retrieved for course ${courseId}: ${allStudents.length}`);
      return allStudents;
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