# Document Processing Service

## Current Version: 0.5.0

## Overview

The Document Processing Service is a full-stack web application that provides AI-powered educational document analysis. The system automatically analyzes educational documents (PDFs, Word docs, Google Docs) to identify standards alignment and determine cognitive rigor levels using multiple AI engines (ChatGPT, Grok, and Claude). The application features a RESTful API backend with Express.js and a modern React frontend with TypeScript, providing educational institutions and EdTech companies with automated document processing capabilities.

## Version History

### Version 0.5.0 (August 16, 2025)
- **Enhanced Tooltip UX**: Improved hover tooltips for rigor justification text
  - Added vertical growth with proper word wrapping
  - Enhanced readability with dark theme contrast
  - Flexible sizing with max-height and vertical scrolling
  - Better text formatting with preserved line breaks
- **UI Improvements**: Enhanced user experience for viewing AI analysis reasoning
- **Architecture Refactor**: Separated application into frontend UX and standalone web service
  - Created standalone web service with core AI processing functionality
  - Designed new API contract for AWS deployment (API Gateway + SQS + Lambda)
  - Updated frontend to use web service client with job-based processing
  - Added focus standards support to upload workflow
  - Implemented job tracking and status display for submitted documents

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming support
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **File Upload**: React Dropzone with Uppy for enhanced file upload experience

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Replit Auth integration with session management
- **File Processing**: Multer for file uploads with support for PDF extraction and Word document parsing
- **AI Integration**: Multiple AI service integrations (OpenAI GPT-4, Anthropic Claude, X.AI Grok)

### Database Design
- **Primary Database**: PostgreSQL via Neon serverless
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Key Tables**:
  - Users table for authentication and user management
  - Documents table for uploaded file metadata and processing status
  - Questions table for parsed questions from documents
  - AI Responses table for storing individual AI engine results
  - Question Results table for consolidated analysis results
  - Processing Queue for background job management
  - Sessions table for authentication state

### AI Processing Pipeline
- **Multi-Engine Analysis**: Parallel processing with ChatGPT, Grok, and Claude
- **Consensus Algorithm**: Voting methodology to consolidate results from multiple AI engines
- **Rigor Assessment**: Three-tier classification system (mild, medium, spicy) based on Depth of Knowledge (DOK) levels
- **Standards Mapping**: Automated identification of educational standards alignment

### File Processing
- **Supported Formats**: PDF, Microsoft Word (.docx), Google Docs
- **Text Extraction**: PDF-extract for PDFs, Mammoth for Word documents
- **Question Parsing**: Intelligent parsing to extract individual questions and context
- **Asynchronous Processing**: Queue-based system for handling large documents

### Security & Authentication
- **Authentication Provider**: Replit Auth with OpenID Connect
- **Session Management**: PostgreSQL-based session storage with configurable TTL
- **API Security**: Session-based authentication for API endpoints
- **File Validation**: MIME type validation and file size limits (50MB)

### Error Handling & Monitoring
- **Structured Logging**: Request/response logging with timing information
- **Error Boundaries**: Comprehensive error handling throughout the application
- **Status Tracking**: Real-time processing status updates (pending, processing, completed, failed)

## External Dependencies

### AI Services
- **OpenAI API**: GPT-4o model for educational content analysis
- **Anthropic Claude**: Claude Sonnet 4 for educational standards identification
- **X.AI Grok**: Alternative AI engine for consensus building

### Database & Storage
- **Neon Database**: Serverless PostgreSQL for primary data storage
- **Google Cloud Storage**: File storage and management (configured but not actively used)

### Authentication
- **Replit Auth**: OAuth-based authentication system
- **OpenID Connect**: Standards-based authentication protocol

### Development Tools
- **Vite**: Frontend build tool and development server
- **Drizzle Kit**: Database migration and schema management
- **ESBuild**: Backend bundling for production builds

### UI Libraries
- **Radix UI**: Headless component primitives for accessibility
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library for consistent iconography
- **React Hook Form**: Form state management and validation