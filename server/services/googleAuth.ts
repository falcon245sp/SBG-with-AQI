import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// FORCE production domain to fix env var override issue
const FORCED_PRODUCTION_REDIRECT_URI = 'https://docu-proc-serv-jfielder1.replit.app/api/auth/google/callback';

console.log('[GoogleAuth] Environment variable GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI);
console.log('[GoogleAuth] FORCED production redirect URI:', FORCED_PRODUCTION_REDIRECT_URI);
console.log('[GoogleAuth] Development domain detected:', process.env.REPLIT_DEV_DOMAIN);

// OAuth scopes for basic user authentication
const BASIC_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
];

// Additional scopes for classroom access
const CLASSROOM_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly'
];

export class GoogleAuthService {
  private oauth2Client: OAuth2Client;

  constructor() {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured');
    }

    console.log('[GoogleAuth] Creating NEW OAuth client with forced production URI:', FORCED_PRODUCTION_REDIRECT_URI);
    
    // Create fresh OAuth client with forced production URL
    this.oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      FORCED_PRODUCTION_REDIRECT_URI
    );
    
    console.log('[GoogleAuth] OAuth client created successfully');
  }

  // Generate authorization URL for basic auth (profile + email only)
  getAuthUrl(state?: string): string {
    console.log('[GoogleAuth] Generating BASIC authorization URL with scopes:', BASIC_SCOPES);
    console.log('[GoogleAuth] BYPASSING Google auth library and building URL manually');
    
    // BYPASS the Google auth library entirely and build URL manually
    // This will prove if the issue is in the library or our configuration
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      redirect_uri: FORCED_PRODUCTION_REDIRECT_URI,
      response_type: 'code',
      scope: BASIC_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: state || ''
    });
    
    const manualAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    console.log('[GoogleAuth] MANUALLY constructed OAuth URL:', manualAuthUrl);
    console.log('[GoogleAuth] Manual URL redirect_uri parameter:', FORCED_PRODUCTION_REDIRECT_URI);
    
    return manualAuthUrl;
  }

  // Generate authorization URL for classroom connection (all scopes)
  getClassroomAuthUrl(state?: string): string {
    console.log('[GoogleAuth] Generating CLASSROOM authorization URL with scopes:', [...BASIC_SCOPES, ...CLASSROOM_SCOPES]);
    console.log('[GoogleAuth] FORCE using redirect URI:', FORCED_PRODUCTION_REDIRECT_URI);
    
    // Create a COMPLETELY fresh OAuth client to avoid any caching issues
    const freshOAuth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      FORCED_PRODUCTION_REDIRECT_URI
    );
    
    const authUrl = freshOAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [...BASIC_SCOPES, ...CLASSROOM_SCOPES],
      prompt: 'consent', // Force consent screen to get refresh token
      state: state || 'classroom_auth', // Mark this as classroom auth flow
      redirect_uri: FORCED_PRODUCTION_REDIRECT_URI // Double force the redirect URI
    });
    console.log('[GoogleAuth] Generated classroom authorization URL:', authUrl);
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