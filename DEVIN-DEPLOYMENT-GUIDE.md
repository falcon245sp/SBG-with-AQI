# Devin Agent Deployment Guide - SBG with AQI Platform

## Quick Start for Devin Agents

This guide provides step-by-step instructions for another Devin agent to deploy the SBG with AQI platform to Google Cloud Run.

## Prerequisites Check
```bash
# Verify you're in the correct repository
pwd  # Should be /home/ubuntu/repos/SBG-with-AQI-final

# Check git status
git status  # Should show branch: devin/1759204422-fix-unified-analysis-service

# Verify required files exist
ls -la cloudbuild.yaml Dockerfile create-export-queue.sql
```

## Required Environment Variables

You MUST have these environment variables available:
- `GOOGLE_SQL_PASSWORD` - Database password
- `OPENAI_API_KEY` - OpenAI API key for AI analysis features

Check if they're available:
```bash
echo "GOOGLE_SQL_PASSWORD: ${GOOGLE_SQL_PASSWORD:0:5}..."
echo "OPENAI_API_KEY: ${OPENAI_API_KEY:0:10}..."
```

## Deployment Command

Execute this single command to deploy:
```bash
gcloud builds submit --config cloudbuild.yaml \
  --substitutions _GOOGLE_SQL_PASSWORD=${GOOGLE_SQL_PASSWORD},_OPENAI_API_KEY=${OPENAI_API_KEY} \
  --project future-sunrise-473100-q7
```

## Expected Deployment Flow

### 1. Build Process (5-10 minutes)
- Frontend compilation with Vite
- Docker container creation
- Image push to Google Container Registry

### 2. Deployment Process (2-5 minutes)
- Cloud Run service update
- Environment variable configuration
- Database table creation (export_queue)

### 3. Health Check (30 seconds)
- Automated service health verification
- Endpoint: https://sbg-with-aqi-1027784478102.us-central1.run.app/api/health

## Success Indicators

### Build Success
```
Step #X - "deploy": Service [sbg-with-aqi] revision [sbg-with-aqi-XXXXXX] has been deployed
Step #X - "deploy": Service URL: https://sbg-with-aqi-1027784478102.us-central1.run.app
```

### Health Check Success
```
Step #X - "health-check": Service deployed at: https://sbg-with-aqi-1027784478102.us-central1.run.app
Step #X - "health-check": {"status":"healthy","timestamp":"..."}
```

## Verification Steps

### 1. Service Status
```bash
gcloud run services describe sbg-with-aqi --region=us-central1 --format="value(status.url,status.conditions[0].status)"
```

### 2. Application Health
```bash
curl -f "https://sbg-with-aqi-1027784478102.us-central1.run.app/api/health"
```

### 3. Frontend Loading
Navigate to: https://sbg-with-aqi-1027784478102.us-central1.run.app
- Should display the SBG with AQI platform interface
- No blank white screen
- Console should show minimal errors (401 auth errors are normal for unauthenticated users)

## Common Issues and Solutions

### Issue: Build Timeout
```
ERROR: build step X exceeded timeout
```
**Solution**: Re-run the deployment command. Cloud Build has a 20-minute timeout.

### Issue: Database Connection Error
```
ERROR: connect ECONNREFUSED /cloudsql/...
```
**Solution**: Verify Cloud SQL instance is running:
```bash
gcloud sql instances describe aqi-development --project=future-sunrise-473100-q7
```

### Issue: Missing Environment Variables
```
ERROR: substitution variable not found
```
**Solution**: Ensure GOOGLE_SQL_PASSWORD and OPENAI_API_KEY are set in your environment.

### Issue: OAuth Configuration Error
```
ERROR: redirect_uri_mismatch
```
**Solution**: This is expected during deployment. OAuth is pre-configured correctly.

## Monitoring Deployment

### Real-time Build Logs
```bash
# Get the latest build ID
BUILD_ID=$(gcloud builds list --limit=1 --format="value(id)")

# Follow build logs
gcloud builds log $BUILD_ID --stream
```

### Service Logs
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=sbg-with-aqi" --limit=20
```

## Post-Deployment Testing

### 1. Basic Functionality
- [ ] Service responds to health checks
- [ ] Frontend loads without blank screen
- [ ] No critical errors in console

### 2. OAuth Flow (Optional)
- [ ] Google sign-in button appears
- [ ] OAuth redirect works (may show authentication error - this is a known issue)

### 3. Database Connectivity
- [ ] No "relation does not exist" errors in logs
- [ ] export_queue table created successfully

## Rollback Procedure

If deployment fails or causes issues:
```bash
# Get previous revision
PREVIOUS_REVISION=$(gcloud run revisions list --service=sbg-with-aqi --region=us-central1 --limit=2 --format="value(metadata.name)" | tail -1)

# Rollback
gcloud run services update-traffic sbg-with-aqi --to-revisions=$PREVIOUS_REVISION=100 --region=us-central1
```

## Key Configuration Details

### Service Configuration
- **Name**: sbg-with-aqi
- **Region**: us-central1
- **URL**: https://sbg-with-aqi-1027784478102.us-central1.run.app
- **Port**: 5000
- **Memory**: 1Gi
- **CPU**: 1
- **Min Instances**: 0 (scales to zero for cost savings)
- **Max Instances**: 5

### Database Configuration
- **Instance**: future-sunrise-473100-q7:us-central1:aqi-development
- **Connection**: Unix socket via Cloud SQL connector
- **Database**: aqi-development
- **User**: postgres

### OAuth Configuration (Pre-configured)
- **Client ID**: 1027784478102-ag7l4pecjovjao5v9925g1c7qftor8al.apps.googleusercontent.com
- **Redirect URI**: https://sbg-with-aqi-1027784478102.us-central1.run.app/api/auth/google/callback

## Success Criteria

Deployment is successful when:
1. ✅ Cloud Build completes without errors
2. ✅ Health check returns 200 OK
3. ✅ Frontend loads (no blank screen)
4. ✅ Service URL is accessible
5. ✅ No critical database errors in logs

## Next Steps After Deployment

1. **Test Core Functionality**: Upload a document and verify processing
2. **Monitor Logs**: Watch for any runtime errors
3. **Performance Check**: Verify response times are acceptable
4. **Cost Monitoring**: Confirm service scales to zero when idle

## Emergency Contacts

If you encounter issues beyond this guide:
- Check the main CI-CD-PROCESS.md for detailed troubleshooting
- Review Cloud Build logs for specific error messages
- Verify all environment variables are correctly set

## File Locations

Key files for deployment:
- `cloudbuild.yaml` - Main build configuration
- `Dockerfile` - Container specification  
- `create-export-queue.sql` - Database table creation
- `server/config/database.ts` - Database connection logic
- `server/index.ts` - Application entry point

This guide should enable any Devin agent to successfully deploy the SBG with AQI platform to Google Cloud Run.
