# OAuth Redirect URI Debug Information

## Current Configuration
- **Application Domain**: `docu-proc-serv-jfielder1.replit.app`
- **Required Redirect URI**: `https://docu-proc-serv-jfielder1.replit.app/api/auth/google/callback`
- **OAuth Client ID**: `1064115232790-0rbc41hch5df1vtctncbfm1aft5241a0.apps.googleusercontent.com`

## Error Details
```
Error 400: redirect_uri_mismatch
Request details: redirect_uri=https://docu-proc-serv-jfielder1.replit.app/api/auth/google/callback
```

## Google Cloud Console Steps
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to: **APIs & Services > Credentials**
3. Find OAuth 2.0 Client ID ending in: `...0rbc41hch5df1vtctncbfm1aft5241a0.apps.googleusercontent.com`
4. Click **Edit** (pencil icon)
5. In **"Authorized redirect URIs"** section, add:
   ```
   https://docu-proc-serv-jfielder1.replit.app/api/auth/google/callback
   ```
6. Click **Save**

## Common Issues
- **Case sensitivity**: Ensure exact match including https://
- **Trailing slash**: URI should NOT end with /
- **Domain spelling**: Check `docu-proc-serv-jfielder1.replit.app` is exact
- **Propagation delay**: Wait 5-10 minutes after saving in GCP

## Alternative Solution
Deploy to production to get permanent `.replit.app` domain that won't change during development.