# Document Processing Service

## Current Version: 0.8 (Development Fork)

## Overview

The Document Processing Service is a full-stack web application that provides AI-powered educational document analysis. The system automatically analyzes educational documents (PDFs, Word docs, Google Docs) to identify standards alignment and determine cognitive rigor levels using multiple AI engines (ChatGPT, Grok, and Claude). The application features a RESTful API backend with Express.js and a modern React frontend with TypeScript, providing educational institutions and EdTech companies with automated document processing capabilities.

## Version History

### Version 0.8 (August 17, 2025) - Google OAuth & Classroom Integration 🚧 IN PROGRESS
- **Google OAuth Authentication**: Google authentication workflow development 
  - Google OAuth 2.0 integration with proper scope management
  - Secure token storage and automatic refresh handling
  - User profile management with Google account linking
  - **FIXED**: Token expiration handling - automatic refresh for returning users
  - **CRITICAL SYSTEM-LEVEL ISSUE**: OAuth URL rewriting by Replit platform causing authentication failures
    - **SYMPTOM**: All OAuth URLs redirect to development domain despite correct configuration
    - **EVIDENCE**: Manual URL construction with hardcoded production domain still generates development URLs
    - **ROOT CAUSE**: Replit platform intercepts and rewrites OAuth URLs from production to development domain
    - **IMPACT**: Environment variable `GOOGLE_REDIRECT_URI` is correctly set but ignored by system-level URL rewriting
    - **TECHNICAL DETAILS**: 
      - Environment vars show: `REPLIT_DEV_DOMAIN=be365067-8647-49d0-ac80-367c87b1cbcc-00-330w27orl8pv0.janeway.replit.dev`
      - Even manually constructed URLs get rewritten from production to development domain
      - This affects ALL OAuth providers, not just Google
    - **SUPPORTABILITY CRISIS**: Cannot rely on environment variables for critical authentication configuration
  - **PRODUCTION DEPLOYMENT CONCERN**: Replit OAuth patterns don't translate to production deployments outside Replit
    - Google search confirms: "Issues can arise when transitioning from working development setup on Replit to production deployment"
    - Need authentication solution that works reliably across deployment environments
    - **SOLUTION**: Implement traditional username/password authentication with secure session management
  - **IMPLEMENTED**: Comprehensive error tracking with 6 unique line identifiers for precise debugging
    - `[LINE 179]` - General callback error  
    - `[LINE 341]` - No googleId in session (getCurrentUser)
    - `[LINE 350]` - Session expired >5 days (getCurrentUser)
    - `[LINE 361]` - User not found in database (getCurrentUser)
    - `[LINE 392]` - Token refresh failed (getCurrentUser)
    - `[LINE 399]` - No refresh token available (getCurrentUser)
- **Google Classroom Integration**: Automated roster and class management
  - Google Classroom API integration for course data
  - Automatic student roster synchronization with pagination support
  - Real-time classroom and student data updates
  - Support for multiple classes per teacher
  - **FIXED**: Student roster pagination issue - now correctly retrieves all students (34/34 for Period 2 Algebra 1)
- **Database Schema Expansion**: Enhanced data models for educational workflows
  - Extended users table with Google OAuth fields and token management
  - New classrooms table with Google Classroom course data
  - New students table with Google profile integration
  - Proper foreign key relationships and data integrity
- **Authentication Flow**: Seamless user onboarding experience development
  - Multi-step authentication with Google OAuth
  - Classroom connection and data synchronization
  - Progress tracking through setup stages
  - Automatic redirection based on authentication state
  - **FIXED**: Token refresh logic integrated into `/api/auth/user` endpoint for seamless re-authentication
  - **ENHANCED**: Forced re-authentication every 5 days for security compliance, even with valid sessions

### Version 0.7 (August 17, 2025) - Teacher Override System & Student Cover Sheet ✓ COMPLETE
- **Student Facing Test Cover Sheet**: ✓ Complete redesign of export functionality
  - Renamed "Standards Summary" to "Student Facing Test Cover Sheet" across all export interfaces
  - New PDF format with portrait orientation and four-column layout (Question, Standard, Topic, Rigor Level)
  - Generic topic descriptions based on standard codes to prevent answer revelation
  - Clean, student-friendly format for test preview without enabling cheating
  - Maintains all teacher override functionality while presenting appropriate student view
- **Export System Cleanup**: ✓ Comprehensive refactoring of export functions
  - Updated all dropdown menus and export handlers across dashboard and document results pages
  - Removed deprecated "Standards Summary" functions and cleaned unused code
  - Consistent naming convention throughout the application
  - Improved PDF generation with proper educational formatting
- **Teacher Override System**: ✓ Complete implementation of crowd-sourced corrections
  - Database schema with teacherOverrides table for storing teacher feedback
  - API endpoints for saving/retrieving teacher corrections with upsert logic
  - Dialog-based UI forms for overriding rigor levels and standards
  - Confidence scoring (1-5 scale) for teacher assessment reliability
  - Robust error handling and input validation to prevent form crashes
  - Safe processing of comma-separated standards input with filtering
- **Edit History & Revert Functionality**: ✓ Complete teacher override history tracking
  - Enhanced database schema with isActive and isRevertedToAi flags for edit history
  - Preserves all teacher override versions instead of overwriting
  - "Revert to Sherpa" button for restoring original AI analysis - **FULLY WORKING**
  - API endpoints for override history viewing and revert operations
  - Automatic dialog closure after successful override submission
  - Fixed critical frontend bug in API parameter ordering for revert functionality
- **Standards Sherpa Persona**: ✓ Complete personified AI platform as educational guide
  - Replaced all "AI" and "Ms. Sage" references with "Standards Sherpa" or "Sherpa"
  - Updated landing page, results display, and all user-facing text
  - Positioned as a trusted educational guide and analysis partner
- **Visual Design Enhancement**: ✓ Warm scholarly aesthetic implementation
  - Rich blue and wood tone color palette inspired by educational imagery
  - Professor/scholar themed landing page with trustworthy design elements
  - Enhanced feature cards and UI elements matching educational environment
- **Development Setup**: Simplified UI for testing and development
  - Fixed testing values: customer ID "123", jurisdiction "Common Core"
  - Removed customer ID and jurisdiction input fields for streamlined testing
  - Added visual indicators showing current testing configuration
  - Enhanced form validation and defensive programming practices

### Version 0.6.0 (August 16, 2025)
- **Multi-File Upload Support**: Added ability to upload and process multiple documents simultaneously
  - Frontend toggle for single vs multi-file mode (up to 10 files)
  - Enhanced FileUploader component with bulk operations
  - Individual job tracking for each uploaded file
  - Comprehensive error handling for partial upload failures
- **Enhanced API Response Format**: Improved web service responses for batch processing
  - Multi-status responses (207) for partial successes
  - Detailed job information for each uploaded file
  - Error tracking per file with specific failure reasons
- **S3 Integration Refinements**: Optimized customer-specific storage patterns
  - Improved file organization in S3 buckets
  - Enhanced upload workflow for multiple files
  - Better error handling for S3 operations

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
- **S3 Storage Integration**: Added AWS S3 support for document storage
  - Customer-specific upload areas: `customers/{customerId}/uploads/`
  - Secure file isolation by customer ID
  - Prepared for AWS Lambda deployment with S3 file processing
  - Updated web service to handle S3 file downloads and processing

## User Preferences

Preferred communication style: Simple, everyday language.

## Standards Sherpa Platform Persona

The platform is personified as "Standards Sherpa" or "Sherpa" for short - a knowledgeable guide who helps teachers navigate educational standards and analysis. Standards Sherpa represents:
- Expert guidance through complex educational terrain
- Collaborative partnership with teachers as a trusted guide
- Reliability and trustworthiness in educational analysis
- Clear, approachable communication style
- Support for teacher judgment and expertise

All user-facing references use "Standards Sherpa" or "Sherpa" instead of generic "AI" terms to create a more personal, educational relationship. The persona suggests cartoon sherpa iconography for branding to reinforce the guiding, supportive nature of the platform.

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