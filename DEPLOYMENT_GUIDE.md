# Standards Sherpa - Production Deployment Guide

## Google OAuth Production Configuration

### The Challenge
Replit automatically syncs Workspace secrets to production deployments. However, Google OAuth requires different redirect URIs for development vs production environments.

### The Solution
"Unsync" Google-related secrets in production to use a separate OAuth application.

## Step-by-Step Production Setup

### 1. Create Production Google OAuth Application

1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. Choose **"Web application"**
4. Name it: `Standards Sherpa - Production`
5. Add authorized JavaScript origins:
   ```
   https://[your-app-name].replit.app
   ```
6. Add authorized redirect URI:
   ```
   https://[your-app-name].replit.app/api/auth/google/callback
   ```
7. Save and note the new Client ID and Client Secret

### 2. Configure Production Secrets in Replit

1. Deploy your app to get the production `.replit.app` URL
2. Go to your deployed app's **Secrets** tab
3. **Unsync** the following secrets (click the sync icon to disable syncing):
   - `SHERPA_GOOGLE_CLIENT_ID`
   - `SHERPA_GOOGLE_CLIENT_SECRET`
   - `SHERPA_GOOGLE_REDIRECT_URI`

4. Set the production values:
   ```
   SHERPA_GOOGLE_CLIENT_ID=[production-client-id]
   SHERPA_GOOGLE_CLIENT_SECRET=[production-client-secret]
   SHERPA_GOOGLE_REDIRECT_URI=https://[your-app-name].replit.app/api/auth/google/callback
   ```

### 3. Enable Required APIs

Ensure these Google APIs are enabled for your production OAuth application:
- Google+ API (for user profile)
- Google Classroom API (for classroom integration)
- People API (for user information)

### 4. OAuth Consent Screen

Configure the OAuth consent screen with:
- **App name**: Standards Sherpa
- **User support email**: Your email
- **Developer contact**: Your email
- **Scopes**: 
  - `userinfo.email`
  - `userinfo.profile`
  - `classroom.courses.readonly`
  - `classroom.rosters.readonly`

## Environment Summary

| Environment | Domain Pattern | OAuth App | Secret Sync | Environment Variables |
|-------------|----------------|-----------|-------------|---------------------|
| **Development** | `*.janeway.replit.dev` | Development OAuth | **SYNCED** | `SHERPA_GOOGLE_CLIENT_ID`, `SHERPA_GOOGLE_CLIENT_SECRET`, `SHERPA_GOOGLE_REDIRECT_URI` |
| **Production** | `*.replit.app` | Production OAuth | **UNSYNCED** | `SHERPA_GOOGLE_CLIENT_ID`, `SHERPA_GOOGLE_CLIENT_SECRET`, `SHERPA_GOOGLE_REDIRECT_URI` |

### Required OAuth Configuration

**Development Environment:**
- **Client ID**: Use development Google OAuth application
- **JavaScript Origin**: `https://be365067-8647-49d0-ac80-367c87b1cbcc-00-330w27orl8pv0.janeway.replit.dev`
- **Redirect URI**: `https://be365067-8647-49d0-ac80-367c87b1cbcc-00-330w27orl8pv0.janeway.replit.dev/api/auth/google/callback`

**Production Environment:**  
- **Client ID**: Use production Google OAuth application  
- **JavaScript Origin**: `https://docu-proc-serv-jfielder1.replit.app`
- **Redirect URI**: `https://docu-proc-serv-jfielder1.replit.app/api/auth/google/callback`

## Verification

After deployment:
1. Test Google OAuth login on production URL
2. Verify Google Classroom integration works
3. Check that user profiles are properly created
4. Confirm redirect URIs match exactly

## Troubleshooting

**redirect_uri_mismatch error**: 
- Verify the exact production URL in Google OAuth configuration
- Ensure no trailing slashes or typos
- Check that secrets are properly unsynced

**Authentication fails silently**:
- Verify SHERPA_ environment variables are set correctly in production
- Check that the production OAuth application has the right scopes enabled