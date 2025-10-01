# SBG with AQI Platform - CI/CD Process Documentation

## Overview
This document provides comprehensive instructions for deploying the SBG with AQI platform to Google Cloud Run using Google Cloud Build. The platform combines Standards-Based Grading document processing with Assessment Quality Index analysis capabilities.

<!-- CI/CD Test: This comment was added to test automated Cloud Build triggers on PR creation -->

## Architecture
- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL on Google Cloud SQL
- **ORM**: Drizzle ORM with schema-first approach
- **Deployment**: Google Cloud Run (serverless, scales to zero)
- **Build System**: Google Cloud Build with Docker containerization

## Repository Structure
```
SBG-with-AQI-final/
├── client/                 # React frontend
├── server/                 # Express.js backend
├── shared/                 # Shared types/schemas
├── cloudbuild.yaml         # Cloud Build configuration
├── Dockerfile             # Container configuration
├── create-export-queue.sql # Database table creation
└── deploy-to-gcp.sh       # Local deployment script
```

## Environment Variables Required

### Core Database Variables (Required)
```bash
GOOGLE_SQL_PASSWORD=<database_password>
OPENAI_API_KEY=<openai_api_key>
```

### Auto-configured Variables (Set by cloudbuild.yaml)
```bash
NODE_ENV=production
GOOGLE_CLOUD_PROJECT=future-sunrise-473100-q7
GOOGLE_SQL_REGION=us-central1
GOOGLE_SQL_INSTANCE=aqi-development
GOOGLE_SQL_DATABASE=aqi-development
GOOGLE_SQL_USERNAME=postgres
ENCRYPTION_KEY=production-encryption-key-32-chars-long
PROD_SESSION_SECRET=production-session-secret-change-me
PROD_WEB_SERVICE_API_KEY=placeholder-api-key
```

### OAuth Configuration
```bash
PROD_GOOGLE_CLIENT_ID=1027784478102-ag7l4pecjovjao5v9925g1c7qftor8al.apps.googleusercontent.com
PROD_GOOGLE_CLIENT_SECRET=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
PROD_GOOGLE_REDIRECT_URI=https://sbg-with-aqi-1027784478102.us-central1.run.app/api/auth/google/callback
PROD_WEB_SERVICE_BASE_URL=https://sbg-with-aqi-1027784478102.us-central1.run.app
```

### Database Connection
```bash
DATABASE_URL=postgresql://postgres:${_GOOGLE_SQL_PASSWORD}@/aqi-development?host=/cloudsql/future-sunrise-473100-q7:us-central1:aqi-development&sslmode=disable
```

## Cloud Build Configuration (cloudbuild.yaml)

### Build Steps Overview
1. **Frontend Build**: Compile React app with Vite
2. **Docker Build**: Create container with build args
3. **Docker Push**: Push to Google Container Registry
4. **Cloud Run Deploy**: Deploy with environment variables
5. **Database Setup**: Execute SQL scripts for missing tables
6. **Health Check**: Verify deployment success

### Key Configuration Details
```yaml
# Build Arguments for Frontend
--build-arg VITE_PROD_WEB_SERVICE_API_KEY=placeholder-api-key
--build-arg VITE_PROD_WEB_SERVICE_BASE_URL=https://sbg-with-aqi-1027784478102.us-central1.run.app

# Cloud Run Configuration
--memory 1Gi
--cpu 1
--min-instances 0
--max-instances 5
--concurrency 80
--execution-environment gen2
--add-cloudsql-instances future-sunrise-473100-q7:us-central1:aqi-development
```

## Deployment Process

### Method 1: Google Cloud Build (Recommended)
```bash
# From repository root
gcloud builds submit --config cloudbuild.yaml \
  --substitutions _GOOGLE_SQL_PASSWORD=${GOOGLE_SQL_PASSWORD},_OPENAI_API_KEY=${OPENAI_API_KEY} \
  --project future-sunrise-473100-q7
```

### Method 2: Local Deployment Script
```bash
# Set required environment variables
export GOOGLE_SQL_PASSWORD="your_password"
export OPENAI_API_KEY="your_api_key"

# Run deployment script
./deploy-to-gcp.sh
```

## Database Setup

### Cloud SQL Instance Details
- **Project**: future-sunrise-473100-q7
- **Region**: us-central1
- **Instance**: aqi-development
- **Database**: aqi-development
- **Connection**: Unix socket via Cloud SQL connector

### Missing Table Creation
The deployment automatically creates the `export_queue` table if missing:
```sql
CREATE TABLE IF NOT EXISTS "export_queue" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "document_id" varchar NOT NULL,
  "export_type" "export_type" NOT NULL,
  -- ... additional columns
);
```

## Service Configuration

### Cloud Run Service Details
- **Service Name**: sbg-with-aqi
- **Region**: us-central1
- **URL**: https://sbg-with-aqi-1027784478102.us-central1.run.app
- **Port**: 5000
- **Platform**: managed
- **Access**: allow-unauthenticated

### Container Configuration
- **Base Image**: node:18-alpine
- **Working Directory**: /app
- **Exposed Port**: 5000
- **Health Check**: /api/health endpoint

## OAuth Configuration

### Google OAuth Setup
1. **Client ID**: 1027784478102-ag7l4pecjovjao5v9925g1c7qftor8al.apps.googleusercontent.com
2. **Authorized JavaScript Origins**: https://sbg-with-aqi-1027784478102.us-central1.run.app
3. **Authorized Redirect URIs**: https://sbg-with-aqi-1027784478102.us-central1.run.app/api/auth/google/callback

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors
- Verify Cloud SQL instance is running
- Check Unix socket path in DATABASE_URL
- Ensure Cloud SQL connector is properly configured

#### 2. OAuth Redirect Mismatch
- Verify redirect URI matches exactly in Google Console
- Check PROD_GOOGLE_REDIRECT_URI environment variable

#### 3. Frontend Build Failures
- Ensure VITE build arguments are properly set
- Check for TypeScript compilation errors

#### 4. Container Startup Issues
- Verify server binds to 0.0.0.0 and process.env.PORT
- Check for missing environment variables

### Debugging Commands
```bash
# View Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=sbg-with-aqi" --limit=50

# Check service status
gcloud run services describe sbg-with-aqi --region=us-central1

# Test health endpoint
curl https://sbg-with-aqi-1027784478102.us-central1.run.app/api/health
```

## Monitoring and Maintenance

### Health Checks
- **Endpoint**: /api/health
- **Expected Response**: 200 OK with service status
- **Automated**: Cloud Build includes health check step

### Log Monitoring
- **Location**: Google Cloud Logging
- **Filter**: resource.type=cloud_run_revision AND resource.labels.service_name=sbg-with-aqi
- **Key Metrics**: OAuth errors, database connection issues, application errors

### Cost Management
- **Auto-scaling**: Scales to zero when not in use
- **Min Instances**: 0 (no idle costs)
- **Max Instances**: 5 (prevents runaway costs)

## Security Considerations

### Environment Variables
- Never commit secrets to repository
- Use Cloud Build substitutions for sensitive data
- Rotate OAuth client secrets regularly

### Database Security
- Uses Cloud SQL connector for secure connections
- SSL/TLS encryption in transit
- Private IP networking recommended for production

### Authentication
- Google OAuth 2.0 for user authentication
- Session-based authentication with PostgreSQL storage
- CSRF protection enabled

## Deployment Checklist

### Pre-deployment
- [ ] Verify all environment variables are set
- [ ] Check Google OAuth configuration
- [ ] Ensure Cloud SQL instance is accessible
- [ ] Validate cloudbuild.yaml syntax

### During Deployment
- [ ] Monitor Cloud Build logs for errors
- [ ] Verify container build completes successfully
- [ ] Check Cloud Run deployment status
- [ ] Confirm database table creation

### Post-deployment
- [ ] Test health endpoint responds
- [ ] Verify frontend loads correctly
- [ ] Test Google OAuth flow end-to-end
- [ ] Monitor application logs for errors
- [ ] Validate database connectivity

## Performance Optimization

### Frontend
- Vite build optimization enabled
- Static asset compression
- CDN-ready asset paths

### Backend
- Node.js production mode
- Database connection pooling
- Efficient Drizzle ORM queries

### Infrastructure
- Cloud Run gen2 execution environment
- Optimized container image layers
- Automatic scaling based on demand

## Backup and Recovery

### Database Backups
- Automated daily backups via Cloud SQL
- Point-in-time recovery available
- Cross-region backup replication recommended

### Application Recovery
- Container images stored in Google Container Registry
- Infrastructure as Code via cloudbuild.yaml
- Environment variables documented and backed up

## Support and Documentation

### Key Files
- `cloudbuild.yaml`: Build and deployment configuration
- `Dockerfile`: Container specification
- `server/config/database.ts`: Database connection logic
- `server/routes/googleAuth.ts`: OAuth implementation

### External Dependencies
- Google Cloud SQL
- Google OAuth 2.0
- OpenAI API
- Google Container Registry
- Google Cloud Run

This documentation provides complete instructions for deploying and maintaining the SBG with AQI platform on Google Cloud infrastructure.
