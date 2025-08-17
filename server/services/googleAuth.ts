import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// Always use production domain for OAuth redirect
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://docu-proc-serv-jfielder1.replit.app/api/auth/google/callback';
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
    console.log('[GoogleAuth] Generating authorization URL with scopes:', SCOPES);
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent', // Force consent screen to get refresh token
      state: state // Optional state parameter for CSRF protection
    });
    console.log('[GoogleAuth] Generated authorization URL:', authUrl);
    return authUrl;
  }

  // Exchange authorization code for tokens
  async getTokens(code: string) {
    console.log('[GoogleAuth] Exchanging authorization code for tokens, code length:', code.length);
    try {
      const response = await this.oauth2Client.getToken(code);
      console.log('[GoogleAuth] Google token exchange successful:', {
        has_access_token: !!response.tokens.access_token,
        has_refresh_token: !!response.tokens.refresh_token,
        token_type: response.tokens.token_type,
        expires_in: response.tokens.expiry_date,
        scope: response.tokens.scope
      });
      return response.tokens;
    } catch (error: any) {
      console.error('[GoogleAuth] ERROR - Google token exchange failed:', {
        error_type: 'GOOGLE_API_ERROR',
        error_code: error.code,
        error_message: error.message,
        error_status: error.status,
        error_response_data: error.response?.data,
        error_config: error.config ? {
          url: error.config.url,
          method: error.config.method,
          headers: error.config.headers
        } : 'No config',
        full_error: JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
      });
      throw error;
    }
  }

  // Get user info from Google
  async getUserInfo(accessToken: string) {
    console.log('[GoogleAuth] Fetching user info from Google API with access token length:', accessToken.length);
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      this.oauth2Client.setCredentials({ access_token: accessToken });
      
      const response = await oauth2.userinfo.get();
      console.log('[GoogleAuth] Google userinfo API successful:', {
        user_id: response.data.id,
        email: response.data.email,
        name: `${response.data.given_name} ${response.data.family_name}`,
        verified_email: response.data.verified_email,
        has_picture: !!response.data.picture
      });
      return response.data;
    } catch (error: any) {
      console.error('[GoogleAuth] ERROR - Google userinfo API failed:', {
        error_type: 'GOOGLE_API_ERROR',
        error_code: error.code,
        error_message: error.message,
        error_details: error.response?.data || error.details || 'No additional details'
      });
      throw error;
    }
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