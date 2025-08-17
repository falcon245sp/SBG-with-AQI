# Google OAuth Environment Configuration

## Critical Setup Requirements

### Development Environment (Current)
- **Domain**: `be365067-8647-49d0-ac80-367c87b1cbcc-00-330w27orl8pv0.janeway.replit.dev`
- **Google OAuth Client ID**: `1064115232790-0rbc41hch5df1vtctncbfm1aft5241a0.apps.googleusercontent.com`
- **Environment Variables**: 
  - `DEV_GOOGLE_CLIENT_ID` = 1064115232790-0rbc41hch5df1vtctncbfm1aft5241a0.apps.googleusercontent.com
  - `DEV_GOOGLE_CLIENT_SECRET` = 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
  - `DEV_GOOGLE_REDIRECT_URI` = https://be365067-8647-49d0-ac80-367c87b1cbcc-00-330w27orl8pv0.janeway.replit.dev/api/auth/google/callback
- **Secret Sync**: **SYNCED** (shared between dev environments)

### Production Environment
- **Domain**: `docu-proc-serv-jfielder1.replit.app`
- **Google OAuth Client ID**: [SEPARATE PRODUCTION OAUTH APP REQUIRED]
- **Environment Variables**:
  - `PROD_GOOGLE_CLIENT_ID` = [production-oauth-client-id]
  - `PROD_GOOGLE_CLIENT_SECRET` = [production-oauth-client-secret]
  - `PROD_GOOGLE_REDIRECT_URI` = https://docu-proc-serv-jfielder1.replit.app/api/auth/google/callback
- **Secret Sync**: **UNSYNCED** (isolated from development)

## Current Issue Resolution

### Step 1: Fix Development OAuth Redirect URI
The current development Google OAuth application needs the redirect URI updated:

**Required Change in Google Cloud Console:**
- **Current**: `https://docu-proc-serv-jfielder1.replit.app/api/auth/google/callback`
- **Update to**: `https://be365067-8647-49d0-ac80-367c87b1cbcc-00-330w27orl8pv0.janeway.replit.dev/api/auth/google/callback`

### Step 2: Verify Environment Variable Isolation
**Development (SYNCED)**:
```
SHERPA_GOOGLE_CLIENT_ID=1064115232790-0rbc41hch5df1vtctncbfm1aft5241a0.apps.googleusercontent.com
SHERPA_GOOGLE_CLIENT_SECRET=[dev-secret]
```

**Production (UNSYNCED)**:
```
SHERPA_GOOGLE_CLIENT_ID=[production-oauth-client-id]
SHERPA_GOOGLE_CLIENT_SECRET=[production-oauth-client-secret]
```

### Step 3: Domain-Based Redirect URI Logic
The application automatically constructs redirect URIs using:
- **Development**: Uses `REPLIT_DOMAINS` environment variable
- **Production**: Uses `REPLIT_DOMAINS` environment variable
- **Fallback**: Uses `SHERPA_GOOGLE_REDIRECT_URI` if domain detection fails

## Verification Checklist

### Development Environment
- [ ] JavaScript origin added: `https://be365067-8647-49d0-ac80-367c87b1cbcc-00-330w27orl8pv0.janeway.replit.dev`
- [ ] Redirect URI updated: `https://be365067-8647-49d0-ac80-367c87b1cbcc-00-330w27orl8pv0.janeway.replit.dev/api/auth/google/callback`
- [ ] SHERPA_ environment variables configured and synced
- [ ] OAuth flow tested and working

### Production Environment  
- [ ] Separate Google OAuth application created for production domain
- [ ] JavaScript origin configured: `https://docu-proc-serv-jfielder1.replit.app`
- [ ] Redirect URI configured: `https://docu-proc-serv-jfielder1.replit.app/api/auth/google/callback`
- [ ] SHERPA_ environment variables unsynced in Replit Secrets Manager
- [ ] Production OAuth credentials configured
- [ ] Production OAuth flow tested

## Security Notes

1. **Never sync production secrets** - Always unsync SHERPA_ variables in production
2. **Separate OAuth applications** - Use different Google OAuth apps for dev/prod
3. **Domain validation** - Each OAuth app is restricted to its specific domain
4. **Environment isolation** - No cross-environment credential sharing