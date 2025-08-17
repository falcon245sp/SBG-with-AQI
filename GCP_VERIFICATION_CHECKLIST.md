# Google Cloud Console Verification Checklist

## Critical Issue: Despite correct configuration, OAuth still fails

Since the application correctly generates the OAuth URL with the proper redirect URI, the issue is in the Google Cloud Console configuration.

## Required Verification Steps

### 1. OAuth Client Type Verification
❗ **CRITICAL**: Go to [GCP Credentials](https://console.cloud.google.com/apis/credentials)
- Find client: `1064115232790-0rbc41hch5df1vtctncbfm1aft5241a0.apps.googleusercontent.com`
- **Verify Type**: Must show "Web application" (NOT "Desktop application")
- If it says "Desktop application", that's the problem

### 2. Required OAuth Client Configuration
Click **Edit** on the OAuth client and configure **BOTH**:

**A. Authorized JavaScript origins:**
```
https://docu-proc-serv-jfielder1.replit.app
```
(No trailing slash, no path)

**B. Authorized redirect URIs:**
```
https://docu-proc-serv-jfielder1.replit.app/api/auth/google/callback
```
(Full path to callback endpoint)

### 3. OAuth Consent Screen
- Go to [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
- **Status must be**: "In production" or "Testing" (not "Not configured")
- **App domain** should be set if required

### 4. API Enablement
- Go to [API Library](https://console.cloud.google.com/apis/library)
- Verify these APIs are **ENABLED**:
  - Google+ API (or People API)
  - Google Classroom API (if using classroom scopes)

### 5. Test with Minimal Scopes
I've temporarily reduced OAuth scopes to: `openid email profile`
Try the OAuth flow with minimal scopes to isolate the issue.

## If All Above Check Out
Create a **NEW** OAuth 2.0 Client ID:
1. Go to [Create Credentials](https://console.cloud.google.com/apis/credentials/oauthclient)
2. Type: **Web application**
3. Name: `Standards Sherpa New`
4. Authorized redirect URIs: `https://docu-proc-serv-jfielder1.replit.app/api/auth/google/callback`
5. Update environment variables with new client ID and secret