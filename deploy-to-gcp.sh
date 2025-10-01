#!/bin/bash


set -e

echo "🚀 Starting SBG with AQI Platform deployment to Google Cloud (Cost-Optimized)..."
echo "=================================================="

if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first."
    echo "   Visit: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Not authenticated with gcloud. Please run:"
    echo "   gcloud auth login"
    exit 1
fi

PROJECT_ID="future-sunrise-473100-q7"
REGION="us-central1"
SERVICE_NAME="sbg-with-aqi"

echo "📋 Configuration:"
echo "   Project ID: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Service: $SERVICE_NAME"
echo ""

gcloud config set project $PROJECT_ID

echo "🔧 Skipping API enabling (using service account with limited permissions)..."
echo "🏗️  Building and deploying with Cloud Build (Cost-Optimized Settings)..."
echo "   - Scales to zero when not in use (no idle costs)"
echo "   - 1GB memory, 1 CPU (efficient resource allocation)"
echo "   - Max 5 instances (cost control)"
echo ""
gcloud builds submit --config cloudbuild.yaml .

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "🌐 Your SBG with AQI Platform should be available at:"
gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)"
echo ""
echo "📊 To view logs:"
echo "   gcloud logs tail --service=$SERVICE_NAME"
echo ""
echo "🔧 Cost Management:"
echo "   Stop service:  gcloud run services update $SERVICE_NAME --region=$REGION --max-instances=0"
echo "   Start service: gcloud run services update $SERVICE_NAME --region=$REGION --max-instances=5"
echo "   Use cost-management.sh script for easy start/stop operations"
echo ""
echo "💰 Cost Benefits:"
echo "   - Scales to zero automatically (no idle charges)"
echo "   - Pay-per-request pricing model"
echo "   - Estimated cost: $5-20/month for light usage"
