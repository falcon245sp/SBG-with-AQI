# SBG with AQI Platform

Unified educational document processing and assessment quality analysis platform combining Standards-Based Grading (SBG) with Assessment Quality Index (AQI) capabilities.

## Features

- **Dual-Pipeline Analysis**: Documents processed through both AQI and DocProcServ analysis systems
- **Assessment Quality Scoring**: Design quality, measurement quality, and standards alignment analysis
- **Document Processing**: AI-powered document analysis with Google Classroom integration
- **Google Cloud Deployment**: Cost-optimized Cloud Run deployment with auto-scaling

## Getting Started

1. Install dependencies: `npm install`
2. Configure environment variables (see ENVIRONMENT_VARIABLES.md)
3. Run development server: `npm run dev`
4. Deploy to Google Cloud: `./deploy-to-gcp.sh`

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Google Cloud SQL
- **AI Services**: OpenAI GPT for document analysis
- **Deployment**: Google Cloud Run with CI/CD pipeline

For detailed documentation, see the individual guide files in this repository.
