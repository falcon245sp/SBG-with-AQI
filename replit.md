# Document Processing Service - Standards Sherpa

## Overview
The Document Processing Service, personified as "Standards Sherpa," is a full-stack web application that provides AI-powered analysis of educational documents (PDFs, Word docs, Google Docs). Its main purpose is to automatically identify standards alignment and determine cognitive rigor levels using multiple AI engines. The application aims to empower educators and EdTech companies with efficient tools for analyzing and aligning educational content, thereby improving curriculum development and assessment. Key capabilities include automated document processing, rubric collation, anti-fraud grading, and comprehensive document management.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes
- **August 19, 2025**: Implemented professional table-based rubric format exactly matching user's provided template. Features include: six-column table layout (Criteria, Points, Full Credit, Partial Credit, Minimal Credit, No Credit), chili pepper rigor indicators (🌶️ symbols), standards alignment per question, student name field (upper right), and QR code placeholder (upper left) for future automated gradebook integration.
- **August 19, 2025**: Completely overhauled rubric generation to align with Standards-Based Grading methodology. The new SBG rubric displays standard/rigor pairs for each question and uses the proper 4-level mastery scale: "Demonstrates Full Mastery" (4), "Demonstrates Mastery with Unrelated Mistakes" (3), "Does Not Demonstrate Mastery" (2), and "No Attempt" (1), replacing the previous points-based system.
- **August 19, 2025**: Fixed critical "Accept & Proceed" functionality that was failing due to database access errors in storage.ts. Resolved TypeScript errors where `this.db` was incorrectly used instead of the imported `db` instance. The teacher review workflow now functions properly, allowing documents to transition from "not_reviewed" to "reviewed_and_accepted" status and trigger cover sheet and rubric generation.
- **August 18, 2025**: Implemented comprehensive production-ready logging system with customer context correlation, request tracing, and specialized logging methods for debugging customer issues in production environments. Created PRODUCTION_LOGGING_GUIDE.md with complete debugging workflows.
- **August 18, 2025**: Split UX into dual system: customer-facing dashboard for document operations (upload, file cabinet, results) and admin panel for system diagnostics, monitoring, and debugging tools. Admin access restricted to specific email addresses.

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
- **Three-Layer Architecture**:
    - **ActiveUserService**: Centralized service for accessing authenticated user data.
    - **CustomerLookupService**: Single database service for customer UUID resolution and PII decryption.
    - **DatabaseWriteService**: Centralized write operations service with business logic, error handling, audit trails, and transaction management.

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
- **Document Re-submission Overwrite System**: Automatically deletes previously generated documents and clears export queues for re-processed source documents, ensuring seamless re-generation.
- **User-Friendly Filename Generation**: Generated documents use descriptive names (e.g., `[Original-Document-Name]_[type]_[YYYY-MM-DD].pdf`).

### Security & Authentication
- **Authentication Provider**: Replit Auth with OpenID Connect (with fallback username/password).
- **Session Management**: PostgreSQL-based session storage with automatic cleanup.
- **API Security**: Session-based authentication.
- **File Validation**: MIME type validation and file size limits.
- **PII Encryption**: All personally identifiable information encrypted at rest using AES encryption.
- **Credential Security**: OAuth credentials stored in environment variables.
- **Centralized Data Access**: CustomerLookupService and DatabaseWriteService enforce secure and consistent data handling.

### Error Handling & Monitoring
- **Production-Ready Logging**: Comprehensive structured logging system with customer context correlation, request tracing, and specialized logging methods for debugging production issues.
- **Log Levels**: ERROR, WARN, INFO, DEBUG with environment-appropriate formatting (JSON for production, readable for development).
- **Customer Correlation**: All logs include customerUuid, requestId, and relevant context for complete issue tracing.
- **Error Boundaries**: Comprehensive error handling with full stack traces and correlation IDs.
- **Status Tracking**: Real-time processing status updates.
- **Performance Monitoring**: Automatic performance logging with warnings for slow operations (>5 seconds).

### Feature Specifications
- **Student Facing Test Cover Sheet**: PDF export with four-column layout (Question, Standard, Topic, Rigor Level).
- **Teacher Override System**: Database and UI for teachers to save corrections to AI analysis, including confidence scoring and "Revert to Sherpa" functionality.
- **Google Classroom Integration**: Google Classroom API integration for roster and class management.
- **Anti-Fraud QR Grading**: One-time sequence number system prevents duplicate grade submissions for rubrics.
- **Rubric Collation System**: Automatically combines individual graded rubric submissions into organized multipage PDFs, integrating with the File Cabinet.
- **File Cabinet Document Management**: Three-drawer system (Uploaded, Generated, Graded) with reliable type identification and Mac Finder-style interface.
- **Visual Design**: Warm scholarly aesthetic with a rich blue and wood tone color palette.

## External Dependencies

### AI Services
- **OpenAI API**: GPT-4o model
- **Anthropic Claude**: Claude Sonnet 4
- **X.AI Grok**: Alternative AI engine

### Database & Storage
- **Neon Database**: Serverless PostgreSQL
- **Google Cloud Storage**: Configured for file storage (not actively used)

### Authentication & Google Integration
- **Google OAuth**: Primary authentication, configured with renamed environment variables (SHERPA_*) to avoid Replit platform conflicts.
- **Google Classroom Integration**: Full OAuth-based integration with proper token management.

### UI Libraries
- **Radix UI**: Headless component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **React Hook Form**: Form state management and validation