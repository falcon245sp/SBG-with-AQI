# Google OAuth Setup for Standards Sherpa

## Current Domain Information
- Current Replit Domain: Check the console logs when starting the app
- Required Redirect URI Format: `https://[CURRENT-DOMAIN]/api/auth/google/callback`

## Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to APIs & Services > Credentials
3. Find your OAuth 2.0 Client ID
4. In "Authorized redirect URIs", add:
   ```
   https://[YOUR-CURRENT-REPLIT-DOMAIN]/api/auth/google/callback
   ```

## When Domain Changes (Development Issue)

Replit sometimes changes domains during development. When you see OAuth redirect URI mismatch:

1. Check console logs for current domain
2. Update the redirect URI in Google Cloud Console
3. OR update the `GOOGLE_REDIRECT_URI` environment variable

## Production Solution

For production deployment, use a custom domain that doesn't change:
1. Set up custom domain in Replit
2. Update Google Cloud Console with stable domain
3. Set `GOOGLE_REDIRECT_URI` to your custom domain

## Required Environment Variables

- `GOOGLE_CLIENT_ID`: Your OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Your OAuth client secret  
- `GOOGLE_REDIRECT_URI`: Full redirect URI (optional, falls back to current domain)

## OAuth Scopes Used

- `https://www.googleapis.com/auth/userinfo.profile`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/classroom.courses.readonly`
- `https://www.googleapis.com/auth/classroom.rosters.readonly`