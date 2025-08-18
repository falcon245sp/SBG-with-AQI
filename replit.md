# Document Processing Service - Standards Sherpa v0.7.1

## Overview

The Document Processing Service is a full-stack web application that provides AI-powered educational document analysis. It automatically analyzes educational documents (PDFs, Word docs, Google Docs) to identify standards alignment and determine cognitive rigor levels using multiple AI engines. The application features a RESTful API backend with Express.js and a React frontend, providing educational institutions and EdTech companies with automated document processing capabilities. The business vision is to empower educators with efficient tools for analyzing and aligning educational content, improving curriculum development and assessment.

## Version 0.7.3 - Rubric Collation System
**Release Date:** August 18, 2025

### Major Rubric Collation Achievement
This version delivers comprehensive rubric collation functionality that automatically combines individual graded rubric submissions into organized multipage PDFs:

**Rubric Collation System:**
- **Automatic Collation**: When new grades are submitted, the system automatically regenerates collated PDFs
- **Manual Collation**: Teachers can manually trigger collation via File Cabinet interface
- **Smart Organization**: PDFs organized alphabetically by student name with complete scoring details
- **Comprehensive Content**: Includes student names, scores, question breakdowns, feedback, and teacher notes
- **File Cabinet Integration**: Collated PDFs appear as new export type in the Generated Documents drawer
- **Multi-Format Document Viewing**: Direct viewing of PDF, text, images, and other document types within File Cabinet interface

**Three-Drawer File Cabinet:**
- **Uploaded Documents**: Original assessments and source materials
- **Generated Documents**: Rubrics, cover sheets, and collated grade PDFs
- **Graded Submissions**: Individual student grade entries with detailed scoring

**Anti-Fraud QR Grading System:**
- **One-Time Sequence Numbers**: Each rubric QR code contains a unique UUID that can only be scanned once
- **Duplicate Prevention**: Multiple submissions of the same graded rubric are automatically rejected
- **Audit Trail**: Complete tracking of who scanned which QR codes and when
- **Tamper Protection**: QR codes become invalid after first successful scan, preventing grade manipulation

### Key Benefits Delivered
- ✅ **Automatic PDF Collation**: Individual grade submissions automatically combined into organized multipage PDFs
- ✅ **Teacher Workflow Optimization**: One consolidated PDF per assessment instead of individual files per student
- ✅ **Real-Time Updates**: Collated PDFs automatically regenerate when new grades are submitted
- ✅ **Professional Organization**: Student submissions sorted alphabetically with complete scoring details
- ✅ **Anti-Fraud Protection**: Zero tolerance for duplicate grade submissions with one-time QR sequences
- ✅ **Complete Document Management**: Three-drawer system for comprehensive file organization
- ✅ **Multi-Format Document Viewing**: PDF, text, image, and .docx viewing capabilities with smart download options

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite
- **UI Components**: Shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS with CSS variables
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter
- **File Upload**: React Dropzone with Uppy

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM
- **Authentication**: Replit Auth integration with session management
- **File Processing**: Multer for uploads, PDF-extract for PDFs, Mammoth for Word documents
- **AI Integration**: Multiple AI service integrations
- **Three-Layer Architecture**: Complete separation of concerns implemented
  - **ActiveUserService**: Centralized service for accessing currently authenticated user data from session with clean API for session management
  - **CustomerLookupService**: Single database service for all customer UUID resolution, supporting lookups by session user ID, email, Google ID, customer UUID, and name search with centralized PII decryption
  - **DatabaseWriteService**: Centralized write operations service with business logic, error handling, audit trails, and transaction management

### Database Design
- **Primary Database**: PostgreSQL via Neon serverless
- **Schema Management**: Drizzle Kit
- **Key Tables**: Users, Documents, Questions, AI Responses, Question Results, Processing Queue, Sessions, TeacherOverrides, Classrooms, Students.

### AI Processing Pipeline
- **Multi-Engine Analysis**: Parallel processing with ChatGPT, Grok, and Claude.
- **Consensus Algorithm**: Voting methodology to consolidate results.
- **Rigor Assessment**: Three-tier classification system (mild, medium, spicy) based on Depth of Knowledge (DOK) levels.
- **Standards Mapping**: Automated identification of educational standards alignment.

### File Processing
- **Supported Formats**: PDF, Microsoft Word (.docx), Google Docs.
- **Question Parsing**: Intelligent parsing to extract individual questions and context.
- **Asynchronous Processing**: Queue-based system for handling large documents.
- **Multi-File Upload**: Support for uploading and processing multiple documents simultaneously.

### Security & Authentication
- **Authentication Provider**: Replit Auth with OpenID Connect (note: traditional username/password authentication also implemented due to Replit OAuth URL rewriting issues).
- **Session Management**: PostgreSQL-based session storage with automatic cleanup of expired sessions.
- **Session Cleanup**: Automated hourly cleanup process removes expired sessions to maintain database efficiency.
- **API Security**: Session-based authentication.
- **File Validation**: MIME type validation and file size limits.
- **PII Encryption**: All personally identifiable information encrypted at rest using AES encryption in both development and production environments.
- **Credential Security**: All OAuth credentials stored in environment variables with no hardcoded credentials in client-side code
- **Pre-Deployment Security**: Comprehensive security audit completed with hardcoded credential removal and secure credential management implementation
- **Centralized Data Access**: 
  - **CustomerLookupService**: Centralized database service that handles all customer UUID resolution and user data access, with PII decryption managed in one place for security consistency.
  - **DatabaseWriteService**: All database write operations centralized with consistent business logic, error handling, and audit trails for security compliance.

### Error Handling & Monitoring
- **Structured Logging**: Request/response logging with timing.
- **Error Boundaries**: Comprehensive error handling.
- **Status Tracking**: Real-time processing status updates.

### Feature Specifications
- **Student Facing Test Cover Sheet**: PDF export with four-column layout (Question, Standard, Topic, Rigor Level) for student preview without answer revelation.
- **Teacher Override System**: Database and UI for teachers to save and manage corrections to AI analysis, including confidence scoring and edit history with "Revert to Sherpa" functionality.
- **Google Classroom Integration**: Google Classroom API integration for automated roster and class management, including student roster synchronization.
- **Anti-Fraud QR Grading**: One-time sequence number system prevents duplicate grade submissions from the same rubric, ensuring grade integrity and preventing manipulation.
- **File Cabinet Document Management**: Comprehensive document organization with reliable type identification, Mac Finder-style interface, and performance optimization for document re-use.
- **Persona**: The platform is personified as "Standards Sherpa" or "Sherpa" – a knowledgeable guide for educational standards and analysis. All user-facing references use this persona.
- **Visual Design**: Warm scholarly aesthetic with a rich blue and wood tone color palette.

## External Dependencies

### AI Services
- **OpenAI API**: GPT-4o model
- **Anthropic Claude**: Claude Sonnet 4
- **X.AI Grok**: Alternative AI engine

### Database & Storage
- **Neon Database**: Serverless PostgreSQL
- **Google Cloud Storage**: Configured for file storage (not actively used)

### Production Deployment Requirements
- **Separate Google OAuth App**: Production requires dedicated OAuth application with .replit.app domain
- **Unsynced Secrets**: SHERPA_* environment variables must be unsynced in production deployment
- **API Enablement**: Google APIs (Classroom, People, OAuth) must be enabled for production OAuth app

### Authentication & Google Integration
- **Google OAuth**: Primary authentication using renamed environment variables (SHERPA_*) to avoid Replit platform conflicts
- **OAuth Implementation**: Successfully implemented Google OAuth with renamed env vars to prevent redirect URI overwrites
- **Google Classroom Integration**: Full OAuth-based integration with proper token management and refresh capabilities
- **Fallback Authentication**: Traditional username/password available as secondary option
- **Production Secret Management**: 
  - Development uses environment variables for secure credential storage (DEV_GOOGLE_*)
  - Production requires "unsyncing" Google secrets in Replit Secrets Manager to use different OAuth application  
  - Must create separate Google OAuth application for production with .replit.app domain redirect URI
  - Unsync DEV_GOOGLE_CLIENT_ID, DEV_GOOGLE_CLIENT_SECRET, DEV_GOOGLE_REDIRECT_URI in production deployment
- **OAuth Configuration Status**: 
  - **Development OAuth Application**:
    - Client ID: [Stored in DEV_GOOGLE_CLIENT_ID environment variable]
    - JavaScript Origin: ✅ Current development domain (auto-detected)
    - Redirect URI: ✅ CONFIGURED using environment variables
    - Environment Variables: DEV_GOOGLE_CLIENT_ID, DEV_GOOGLE_CLIENT_SECRET, DEV_GOOGLE_REDIRECT_URI (SYNCED)
    - Status: ✅ FULLY WORKING - OAuth flow complete with secure credential management
  - **Production OAuth Application**: 
    - Domain: docu-proc-serv-jfielder1.replit.app
    - Environment Variables: PROD_GOOGLE_CLIENT_ID, PROD_GOOGLE_CLIENT_SECRET, PROD_GOOGLE_REDIRECT_URI (UNSYNCED)
    - Status: ✅ Ready for deployment - will work in single browser window without popup requirement

### UI Libraries
- **Radix UI**: Headless component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **React Hook Form**: Form state management and validation