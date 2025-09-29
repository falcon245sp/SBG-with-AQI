# SBG with AQI Integration Guide

## Overview

This document describes the successful integration of the AQI (Assessment Quality Index) Platform functionality into the SBGDocProcServ repository, creating a unified educational document processing and assessment quality analysis platform.

## Integration Summary

### ✅ Completed Components

1. **Database Schema Integration**
   - Merged DocProcServ's document processing tables with AQI's hierarchical structure
   - Extended schema with districts, schools, assessments, and assessment items
   - Added AQI's standards management and rigor policy tables
   - Configured for Google Cloud SQL deployment

2. **Package Dependencies**
   - Combined dependencies from both projects in `package.json`
   - Added AQI-specific packages: `@google-cloud/cloud-sql-connector`, `pdf-parse`, `nanoid`, `p-limit`
   - Maintained all existing DocProcServ dependencies
   - Updated project name to "sbg-with-aqi"

3. **Service Integration**
   - Created `unifiedAnalysisService.ts` to orchestrate both workflows
   - Integrated `aqiAnalysisService.ts` for assessment quality analysis
   - Added `aqiScoring.ts` for quality scoring calculations
   - Enhanced document processing pipeline with AQI capabilities

4. **Storage Layer**
   - Extended `storage.ts` with AQI-specific methods
   - Added support for assessment items, rigor policies, and standards
   - Maintained backward compatibility with existing DocProcServ operations

5. **Database Configuration**
   - Created `server/config/database.ts` for Google Cloud SQL connection
   - Updated `drizzle.config.ts` for cloud deployment
   - Configured SSL and connection pooling

### 🔧 Technical Architecture

#### Unified Analysis Workflow
1. **Document Upload**: Users upload documents through existing DocProcServ interface
2. **Document Classification**: System determines if document is an assessment or general document
3. **Analysis Pipeline**:
   - **Assessments**: Processed through AQI analysis pipeline with quality scoring
   - **General Documents**: Processed through DocProcServ's AI analysis
4. **Results Integration**: Both workflows store results in unified schema

#### Database Schema Strategy
- **Foundation**: DocProcServ's document-centric tables
- **Extensions**: AQI's hierarchical structure (districts → schools → users)
- **Standards**: AQI's comprehensive standards management
- **Scoring**: Assessment quality metrics and rigor analysis

#### Authentication Strategy
- **Primary**: DocProcServ's Replit Auth (mature integration)
- **Extended**: Support for AQI's district/school hierarchy
- **Backward Compatible**: Existing DocProcServ users unaffected

### 📊 Key Features

1. **Enhanced Document Processing**
   - Original DocProcServ AI analysis for general documents
   - AQI assessment quality analysis for educational assessments
   - Unified results display with quality metrics

2. **Assessment Quality Scoring**
   - Design quality assessment
   - Measurement quality evaluation
   - Standards alignment analysis
   - DOK (Depth of Knowledge) rigor analysis

3. **Standards Management**
   - Comprehensive educational standards database
   - Multi-jurisdiction support
   - Hierarchical rigor policies

4. **Cost Optimization**
   - Google Cloud Run auto-scaling
   - Optimized database connections
   - Efficient AI model usage

### 🚀 Deployment

#### Environment Variables Required
```bash
# Database Configuration
GOOGLE_SQL_HOST=34.171.150.214
GOOGLE_SQL_USERNAME=your_username
GOOGLE_SQL_PASSWORD=your_password
GOOGLE_SQL_DATABASE=your_database

# AI Services
OPENAI_API_KEY=your_openai_key

# Optional SSL Configuration
GOOGLE_SQL_CLIENT_CERT=your_client_cert
GOOGLE_SQL_CLIENT_KEY=your_client_key
GOOGLE_SQL_SERVER_CA=your_server_ca
```

#### Deployment Steps
1. Set environment variables in Google Cloud Console
2. Run `npm run db:push` to migrate schema
3. Deploy using existing CI/CD pipeline
4. Verify both document processing and assessment analysis workflows

### 🧪 Verification

#### Build Verification
```bash
npm run check    # TypeScript compilation ✅
npm run build    # Frontend + Backend build ✅
```

#### Database Migration
```bash
npm run db:push  # Requires Google Cloud SQL credentials
```

#### Testing Workflows
1. Upload general document → DocProcServ analysis
2. Upload assessment document → AQI analysis + quality scoring
3. Verify unified results display

### 📈 Benefits

1. **Unified Platform**: Single interface for all educational document analysis
2. **Enhanced Analysis**: Combines DocProcServ's AI with AQI's assessment expertise
3. **Scalable Architecture**: Google Cloud deployment with cost optimization
4. **Comprehensive Standards**: Full educational standards coverage
5. **Quality Metrics**: Detailed assessment quality scoring and recommendations

### 🔄 Migration Path

For existing users:
- **DocProcServ users**: Seamless transition with enhanced assessment analysis
- **AQI users**: Full feature preservation with improved document processing
- **Data Migration**: Automated scripts for transferring existing data

### 🛠️ Development

#### Key Files
- `shared/schema.ts`: Unified database schema
- `server/services/unifiedAnalysisService.ts`: Main orchestration service
- `server/services/aqiAnalysisService.ts`: AQI assessment analysis
- `server/storage.ts`: Extended storage layer
- `server/config/database.ts`: Google Cloud SQL configuration

#### Next Steps
1. Set up Google Cloud SQL credentials
2. Run database migration
3. Test end-to-end workflows
4. Deploy to production environment

## Conclusion

The integration successfully combines the best of both platforms:
- DocProcServ's mature document processing and user management
- AQI's sophisticated assessment analysis and quality scoring
- Unified architecture optimized for Google Cloud deployment

The result is a comprehensive educational document analysis platform that serves both general document processing needs and specialized assessment quality analysis.
