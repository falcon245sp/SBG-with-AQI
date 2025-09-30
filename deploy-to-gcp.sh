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

echo "🔧 Enabling required Google Cloud APIs..."
gcloud services enable appengine.googleapis.com
gcloud services enable sqladmin.googleapis.com

echo "🏗️  Deploying to App Engine with F1 instances (Cost-Optimized Settings)..."
echo "   - F1 instance class (lowest cost option)"
echo "   - Scales to zero when not in use (no idle costs)"
echo "   - Max 5 instances (cost control)"
echo ""

echo "📦 Building application..."
npm run build

echo "🚀 Deploying to App Engine..."
gcloud app deploy app.yaml --quiet

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "🌐 Your SBG with AQI Platform should be available at:"
gcloud app browse --no-launch-browser
echo ""
echo "📊 To view logs:"
echo "   gcloud app logs tail -s default"
echo ""
echo "🔧 Cost Management:"
echo "   Stop service:  gcloud app versions stop --service=default --version=\$(gcloud app versions list --service=default --sort-by=~version.createTime --limit=1 --format='value(version.id)')"
echo "   Start service: App Engine automatically starts when receiving requests"
echo "   Use cost-management.sh script for easy start/stop operations"
echo ""
echo "💰 Cost Benefits:"
echo "   - Scales to zero automatically (no idle charges)"
echo "   - Pay-per-request pricing model"
echo "   - Estimated cost: $5-20/month for light usage"
