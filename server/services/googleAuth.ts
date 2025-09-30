import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';

// Google OAuth configuration with renamed environment variables to avoid Replit conflicts
// Environment-specific Google OAuth configuration
const isProduction = process.env.NODE_ENV === 'production';

// Use DEV_ prefixed variables in development, PROD_ prefixed in production
const GOOGLE_CLIENT_ID = isProduction 
  ? process.env.PROD_GOOGLE_CLIENT_ID 
  : process.env.DEV_GOOGLE_CLIENT_ID;

const GOOGLE_CLIENT_SECRET = isProduction 
  ? process.env.PROD_GOOGLE_CLIENT_SECRET 
  : process.env.DEV_GOOGLE_CLIENT_SECRET;

const GOOGLE_REDIRECT_URI = isProduction 
  ? process.env.PROD_GOOGLE_REDIRECT_URI 
  : process.env.DEV_GOOGLE_REDIRECT_URI;

console.log(`[GoogleAuth] Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
console.log(`[GoogleAuth] Using ${isProduction ? 'PROD_' : 'DEV_'} prefixed environment variables:`);
console.log(`[GoogleAuth] ${isProduction ? 'PROD_' : 'DEV_'}GOOGLE_CLIENT_ID:`, GOOGLE_CLIENT_ID ? 'Present' : 'Missing');
console.log(`[GoogleAuth] ${isProduction ? 'PROD_' : 'DEV_'}GOOGLE_CLIENT_SECRET:`, GOOGLE_CLIENT_SECRET ? 'Present' : 'Missing');
console.log(`[GoogleAuth] ${isProduction ? 'PROD_' : 'DEV_'}GOOGLE_REDIRECT_URI:`, GOOGLE_REDIRECT_URI);
console.log('[GoogleAuth] REPLIT_DOMAINS:', process.env.REPLIT_DOMAINS);

// OAuth scopes for basic user authentication
const BASIC_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
];

// Additional scopes for Google Drive access (limited to files we create)
const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file' // Only access files created by our app
];

// Additional scopes for classroom access
const CLASSROOM_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly'
];

// Combined scopes for full integration
const FULL_SCOPES = [...BASIC_SCOPES, ...DRIVE_SCOPES, ...CLASSROOM_SCOPES];

export class GoogleAuthService {
  private oauth2Client: OAuth2Client;

  constructor() {
    console.log(`[GoogleAuth] Constructor called - validating environment:`, {
      nodeEnv: process.env.NODE_ENV,
      isProduction,
      envPrefix: isProduction ? 'PROD_' : 'DEV_',
      clientIdPresent: !!GOOGLE_CLIENT_ID,
      clientIdLength: GOOGLE_CLIENT_ID ? GOOGLE_CLIENT_ID.length : 0,
      clientIdPrefix: GOOGLE_CLIENT_ID ? GOOGLE_CLIENT_ID.substring(0, 20) + '...' : 'missing',
      clientSecretPresent: !!GOOGLE_CLIENT_SECRET,
      clientSecretLength: GOOGLE_CLIENT_SECRET ? GOOGLE_CLIENT_SECRET.length : 0,
      redirectUri: GOOGLE_REDIRECT_URI,
      redirectUriValid: GOOGLE_REDIRECT_URI ? GOOGLE_REDIRECT_URI.startsWith('http') : false,
      replitDomains: process.env.REPLIT_DOMAINS,
      availableGoogleEnvVars: Object.keys(process.env).filter(key => key.includes('GOOGLE')),
      timestamp: new Date().toISOString()
    });
    
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.warn('[GoogleAuth] WARNING: Google OAuth credentials not configured - using placeholder values for deployment testing');
      console.warn('[GoogleAuth] OAuth functionality will not work until proper credentials are set');
    }

    console.log(`[GoogleAuth] Creating OAuth client with ${isProduction ? 'PROD_' : 'DEV_'} environment variables:`);
    
    // Create OAuth client using renamed environment variables (allow placeholders for deployment testing)
    this.oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID || 'placeholder-client-id',
      GOOGLE_CLIENT_SECRET || 'placeholder-client-secret',
      GOOGLE_REDIRECT_URI || 'http://localhost:5000/auth/google/callback'
    );
    
    console.log('[GoogleAuth] OAuth client created successfully');
  }

  // Generate authorization URL for basic auth (profile + email only)
  getAuthUrl(state?: string): string {
    console.log('[GoogleAuth] Generating BASIC authorization URL with scopes:', BASIC_SCOPES);
    
    // Use Google Auth library with renamed environment variables
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: BASIC_SCOPES,
      prompt: 'select_account', // Allow user to select account
      state: state || '',
      include_granted_scopes: true // Include previously granted scopes
    });
    
    console.log('[GoogleAuth] Generated OAuth URL with renamed env vars:', authUrl);
    console.log('[GoogleAuth] Redirect URI from renamed env var:', GOOGLE_REDIRECT_URI);
    
    return authUrl;
  }

  // Generate authorization URL for full integration (Drive + Classroom)
  getFullAuthUrl(state?: string): string {
    console.log('[GoogleAuth] Generating FULL integration authorization URL with scopes:', FULL_SCOPES);
    console.log('[GoogleAuth] Using renamed env var redirect URI:', GOOGLE_REDIRECT_URI);
    
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: FULL_SCOPES,
      prompt: 'consent', // Force consent screen to get refresh token
      state: state || 'full_integration' // Mark this as full integration flow
    });
    console.log('[GoogleAuth] Generated full integration authorization URL:', authUrl);
    return authUrl;
  }

  // Generate authorization URL for classroom connection (all scopes)
  getClassroomAuthUrl(state?: string): string {
    console.log('[GoogleAuth] Generating CLASSROOM authorization URL with scopes:', [...BASIC_SCOPES, ...CLASSROOM_SCOPES]);
    console.log('[GoogleAuth] Using renamed env var redirect URI:', GOOGLE_REDIRECT_URI);
    
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [...BASIC_SCOPES, ...CLASSROOM_SCOPES],
      prompt: 'consent', // Force consent screen to get refresh token
      state: state || 'classroom_auth' // Mark this as classroom auth flow
    });
    console.log('[GoogleAuth] Generated classroom authorization URL:', authUrl);
    return authUrl;
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(code: string) {
    const operationId = crypto.randomUUID();
    const startTime = Date.now();
    
    console.log(`[GoogleAuth-${operationId}] Exchanging authorization code for tokens:`, {
      codeLength: code.length,
      codePrefix: code.substring(0, 20) + '...',
      clientIdPresent: !!GOOGLE_CLIENT_ID,
      redirectUri: GOOGLE_REDIRECT_URI,
      timestamp: new Date().toISOString()
    });
    
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      const exchangeTime = Date.now() - startTime;
      
      console.log(`[GoogleAuth-${operationId}] Tokens retrieved successfully:`, {
        hasAccessToken: !!tokens.access_token,
        accessTokenLength: tokens.access_token?.length || 0,
        hasRefreshToken: !!tokens.refresh_token,
        refreshTokenLength: tokens.refresh_token?.length || 0,
        hasIdToken: !!tokens.id_token,
        expiryDate: tokens.expiry_date,
        scope: tokens.scope,
        tokenType: tokens.token_type,
        exchangeTime,
        timestamp: new Date().toISOString()
      });
      
      return tokens;
    } catch (error: any) {
      const failureTime = Date.now() - startTime;
      
      console.error(`[GoogleAuth-${operationId}] ERROR - Token exchange failed:`, {
        error_type: 'GOOGLE_TOKEN_EXCHANGE_ERROR',
        error_name: error.name,
        error_code: error.code,
        error_message: error.message,
        error_status: error.status,
        error_statusText: error.statusText,
        error_response: error.response?.data,
        error_response_status: error.response?.status,
        error_response_statusText: error.response?.statusText,
        request_context: {
          codeLength: code.length,
          clientIdPresent: !!GOOGLE_CLIENT_ID,
          clientSecretPresent: !!GOOGLE_CLIENT_SECRET,
          redirectUri: GOOGLE_REDIRECT_URI,
          environment: isProduction ? 'PRODUCTION' : 'DEVELOPMENT'
        },
        failureTime,
        timestamp: new Date().toISOString(),
        stack: error.stack,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
      });
      throw error;
    }
  }

  // Get user profile from Google
  async getUserProfile(accessToken: string) {
    const operationId = crypto.randomUUID();
    const startTime = Date.now();
    
    console.log(`[GoogleAuth-${operationId}] Fetching user profile from Google API:`, {
      accessTokenLength: accessToken.length,
      accessTokenPrefix: accessToken.substring(0, 20) + '...',
      timestamp: new Date().toISOString()
    });
    
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      this.oauth2Client.setCredentials({ access_token: accessToken });
      
      const response = await oauth2.userinfo.get();
      const fetchTime = Date.now() - startTime;
      
      console.log(`[GoogleAuth-${operationId}] User profile fetched successfully:`, {
        googleId: response.data.id,
        email: response.data.email,
        name: response.data.name,
        givenName: response.data.given_name,
        familyName: response.data.family_name,
        picture: response.data.picture,
        verifiedEmail: response.data.verified_email,
        locale: response.data.locale,
        hd: response.data.hd,
        fetchTime,
        timestamp: new Date().toISOString()
      });
      
      return response.data;
    } catch (error: any) {
      const failureTime = Date.now() - startTime;
      
      console.error(`[GoogleAuth-${operationId}] ERROR - Failed to fetch user profile:`, {
        error_type: 'GOOGLE_USERINFO_ERROR',
        error_name: error.name,
        error_code: error.code,
        error_message: error.message,
        error_status: error.status,
        error_statusText: error.statusText,
        error_response: error.response?.data,
        error_response_status: error.response?.status,
        request_context: {
          accessTokenLength: accessToken.length,
          hasAccessToken: !!accessToken
        },
        failureTime,
        timestamp: new Date().toISOString(),
        stack: error.stack,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
      });
      throw error;
    }
  }

  // Get Google Classroom courses with pagination
  async getClassrooms(accessToken: string, refreshToken?: string) {
    this.oauth2Client.setCredentials({ 
      access_token: accessToken,
      refresh_token: refreshToken 
    });

    const classroom = google.classroom({ version: 'v1', auth: this.oauth2Client });
    
    try {
      // Use pagination to ensure we get ALL classrooms
      let allClassrooms: any[] = [];
      let pageToken: string | undefined;
      
      do {
        const response = await classroom.courses.list({
          courseStates: ['ACTIVE'],
          teacherId: 'me', // Only courses where user is teacher
          pageSize: 100, // Maximum page size
          pageToken: pageToken
        });
        
        const classrooms = response.data.courses || [];
        allClassrooms = allClassrooms.concat(classrooms);
        pageToken = response.data.nextPageToken || undefined;
        
        console.log(`Retrieved ${classrooms.length} classrooms (page token: ${pageToken ? 'more pages' : 'last page'})`);
      } while (pageToken);
      
      console.log(`Total classrooms retrieved: ${allClassrooms.length}`);
      return allClassrooms;
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

  // Get assignments (coursework) for a specific classroom
  async getAssignments(courseId: string, accessToken: string, refreshToken?: string) {
    this.oauth2Client.setCredentials({ 
      access_token: accessToken,
      refresh_token: refreshToken 
    });

    const classroom = google.classroom({ version: 'v1', auth: this.oauth2Client });
    
    try {
      // Use pagination to ensure we get ALL assignments
      let allAssignments: any[] = [];
      let pageToken: string | undefined;
      
      do {
        const response = await classroom.courses.courseWork.list({
          courseId: courseId,
          pageSize: 100, // Maximum page size
          pageToken: pageToken,
          courseWorkStates: ['PUBLISHED'] // Only get published assignments
        });
        
        const assignments = response.data.courseWork || [];
        allAssignments = allAssignments.concat(assignments);
        pageToken = response.data.nextPageToken || undefined;
        
        console.log(`Retrieved ${assignments.length} assignments (page token: ${pageToken ? 'more pages' : 'last page'}) for course ${courseId}`);
      } while (pageToken);
      
      console.log(`Total assignments retrieved for course ${courseId}: ${allAssignments.length}`);
      return allAssignments;
    } catch (error) {
      console.error('Error fetching assignments:', error);
      throw error;
    }
  }

  // Get a specific assignment by ID
  async getAssignment(courseId: string, courseWorkId: string, accessToken: string, refreshToken?: string) {
    this.oauth2Client.setCredentials({ 
      access_token: accessToken,
      refresh_token: refreshToken 
    });

    const classroom = google.classroom({ version: 'v1', auth: this.oauth2Client });
    
    try {
      const response = await classroom.courses.courseWork.get({
        courseId: courseId,
        id: courseWorkId
      });
      
      console.log(`Retrieved assignment ${courseWorkId} for course ${courseId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching assignment:', error);
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
