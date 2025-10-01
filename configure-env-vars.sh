#!/bin/bash

set -e

PROJECT_ID="future-sunrise-473100-q7"
REGION="us-central1"
SERVICE_NAME="sbg-with-aqi"

echo "🔧 Configuring environment variables for Cloud Run service..."

gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --set-env-vars="NODE_ENV=production,DATABASE_URL=${DATABASE_URL},OPENAI_API_KEY=${OPENAI_API_KEY},GOOGLE_SQL_HOST=${GOOGLE_SQL_HOST},GOOGLE_SQL_USERNAME=${GOOGLE_SQL_USERNAME},GOOGLE_SQL_PASSWORD=${GOOGLE_SQL_PASSWORD},GOOGLE_SQL_DATABASE=${GOOGLE_SQL_DATABASE},ENCRYPTION_KEY=production-encryption-key-32-chars-long,PROD_SESSION_SECRET=production-session-secret-change-me,PROD_GOOGLE_CLIENT_ID=placeholder-client-id,PROD_GOOGLE_CLIENT_SECRET=placeholder-client-secret,PROD_GOOGLE_REDIRECT_URI=https://sbg-with-aqi-future-sunrise-473100-q7.a.run.app/auth/google/callback" \
  --set-secrets="GOOGLE_SQL_CLIENT_KEY=GOOGLE_SQL_CLIENT_KEY:latest,GOOGLE_SQL_CLIENT_CERT=GOOGLE_SQL_CLIENT_CERT:latest,GOOGLE_SQL_SERVER_CA=GOOGLE_SQL_SERVER_CA:latest"

echo "✅ Environment variables configured successfully!"
