# OAuth Redirect URI Solution

## The Problem
Google Cloud Console requires EXACT redirect URI match. The current OAuth client ID `1064115232790-0rbc41hch5df1vtctncbfm1aft5241a0.apps.googleusercontent.com` is not configured with the correct redirect URI.

## Required Actions

### Step 1: Verify Current Configuration
1. Go to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials)
2. Find OAuth 2.0 Client ID: `1064115232790-0rbc41hch5df1vtctncbfm1aft5241a0.apps.googleusercontent.com`
3. Click **Edit**
4. In **"Authorized redirect URIs"** section, ensure this EXACT URI exists:
   ```
   https://docu-proc-serv-jfielder1.replit.app/api/auth/google/callback
   ```

### Step 2: If Step 1 Fails - Create New OAuth Client
1. Go to [Create OAuth Client](https://console.cloud.google.com/apis/credentials/oauthclient)
2. Application type: **Web application**
3. Name: `Standards Sherpa Production`
4. **Authorized redirect URIs**: `https://docu-proc-serv-jfielder1.replit.app/api/auth/google/callback`
5. Save and copy the new Client ID and Client Secret
6. Update environment variables:
   - `GOOGLE_CLIENT_ID`: [new client id]
   - `GOOGLE_CLIENT_SECRET`: [new client secret]

### Step 3: Test OAuth Flow
After configuration, test the OAuth flow - it should work without redirect URI mismatch errors.

## Current Status
- Application correctly configured ✅
- Environment variables set ✅
- OAuth2Client initialized properly ✅
- Google Cloud Console configuration needed ❌

## Alternative: Deploy to Production
Deploying to Replit provides a permanent `.replit.app` domain that eliminates redirect URI configuration issues.