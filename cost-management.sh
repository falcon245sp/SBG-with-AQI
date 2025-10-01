#!/bin/bash


set -e

PROJECT_ID="future-sunrise-473100-q7"
SERVICE_NAME="aqi-platform"
REGION="us-central1"

function show_status() {
    echo "📊 Current service status:"
    gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.conditions[0].status,spec.template.spec.containerConcurrency,spec.template.spec.containers[0].resources.limits.memory,spec.template.metadata.annotations.'autoscaling.knative.dev/maxScale')"
}

function stop_service() {
    echo "⏹️  Stopping AQI Platform (scaling to zero)..."
    gcloud run services update $SERVICE_NAME \
        --region $REGION \
        --max-instances 0
    echo "✅ Service stopped. No charges will occur while stopped."
}

function start_service() {
    echo "▶️  Starting AQI Platform..."
    gcloud run services update $SERVICE_NAME \
        --region $REGION \
        --max-instances 5
    echo "✅ Service started and ready to handle requests."
}

function show_costs() {
    echo "💰 Recent usage (last 7 days):"
    gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" \
        --limit 10 \
        --format="table(timestamp,severity,textPayload)" \
        --freshness=7d
}

function show_url() {
    echo "🌐 Service URL:"
    gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)"
}

case "$1" in
    "status")
        show_status
        ;;
    "stop")
        stop_service
        ;;
    "start")
        start_service
        ;;
    "costs")
        show_costs
        ;;
    "url")
        show_url
        ;;
    *)
        echo "AQI Platform Cost Management"
        echo ""
        echo "Usage: $0 {status|stop|start|costs|url}"
        echo ""
        echo "Commands:"
        echo "  status  - Show current service status"
        echo "  stop    - Stop service (scale to zero, no costs)"
        echo "  start   - Start service (allow scaling up)"
        echo "  costs   - Show recent usage logs"
        echo "  url     - Show service URL"
        echo ""
        echo "Cost optimization tips:"
        echo "- Use 'stop' when not actively using the platform"
        echo "- Use 'start' when you need to access the platform"
        echo "- Service automatically scales to zero after ~15 minutes of no traffic"
        exit 1
        ;;
esac
