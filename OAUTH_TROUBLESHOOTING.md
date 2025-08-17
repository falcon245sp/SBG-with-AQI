# OAuth Troubleshooting Guide

## Issue: redirect_uri_mismatch Error 400

### The Problem
Google OAuth is rejecting the redirect URI even though it appears to be correctly configured.

### Root Cause Analysis
The error shows:
- **Client ID**: `1064115232790-0rbc41hch5df1vtctncbfm1aft5241a0.apps.googleusercontent.com`
- **Redirect URI**: `https://docu-proc-serv-jfielder1.replit.app/api/auth/google/callback`

### Step-by-Step Resolution

#### 1. Verify Google Cloud Console Configuration
1. Go to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials)
2. Look for OAuth 2.0 Client ID ending in: `...0rbc41hch5df1vtctncbfm1aft5241a0.apps.googleusercontent.com`
3. Click the **Edit** button (pencil icon)
4. In the **"Authorized redirect URIs"** section, ensure this EXACT URI is present:
   ```
   https://docu-proc-serv-jfielder1.replit.app/api/auth/google/callback
   ```

#### 2. Common Issues to Check
- **Multiple OAuth clients**: Ensure you're editing the correct client ID
- **Typos**: Verify no extra spaces, different domains, or typos
- **HTTP vs HTTPS**: Must be `https://` not `http://`
- **Trailing slashes**: Should NOT end with `/`

#### 3. Alternative: Create New OAuth Client
If the issue persists, create a new OAuth 2.0 Client ID:
1. Go to [Create Credentials](https://console.cloud.google.com/apis/credentials/oauthclient)
2. Application type: **Web application**
3. Name: `Standards Sherpa Production`
4. Authorized redirect URIs: `https://docu-proc-serv-jfielder1.replit.app/api/auth/google/callback`
5. Copy the new Client ID and Client Secret
6. Update environment variables in Replit

#### 4. Propagation Wait Time
After saving changes in GCP:
- Wait 5-10 minutes for changes to propagate
- Clear browser cache
- Try OAuth flow again

### Current Status
- ✅ Application correctly configured
- ✅ Environment variables set properly  
- ✅ OAuth client initialized correctly
- ❌ GCP OAuth client configuration needs verification