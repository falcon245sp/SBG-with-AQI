# Document Processing Service

## Overview

The Document Processing Service is a full-stack web application that provides AI-powered educational document analysis. It automatically analyzes educational documents (PDFs, Word docs, Google Docs) to identify standards alignment and determine cognitive rigor levels using multiple AI engines. The application features a RESTful API backend with Express.js and a React frontend, providing educational institutions and EdTech companies with automated document processing capabilities. The business vision is to empower educators with efficient tools for analyzing and aligning educational content, improving curriculum development and assessment.

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
- **Session Management**: PostgreSQL-based session storage.
- **API Security**: Session-based authentication.
- **File Validation**: MIME type validation and file size limits.

### Error Handling & Monitoring
- **Structured Logging**: Request/response logging with timing.
- **Error Boundaries**: Comprehensive error handling.
- **Status Tracking**: Real-time processing status updates.

### Feature Specifications
- **Student Facing Test Cover Sheet**: PDF export with four-column layout (Question, Standard, Topic, Rigor Level) for student preview without answer revelation.
- **Teacher Override System**: Database and UI for teachers to save and manage corrections to AI analysis, including confidence scoring and edit history with "Revert to Sherpa" functionality.
- **Google Classroom Integration**: Google Classroom API integration for automated roster and class management, including student roster synchronization.
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

### Authentication & Google Integration
- **Google OAuth**: Primary authentication using renamed environment variables (SHERPA_*) to avoid Replit platform conflicts
- **OAuth Workaround**: Successfully implemented Google OAuth with renamed env vars to prevent redirect URI overwrites
- **Google Classroom Integration**: Full OAuth-based integration with proper token management and refresh capabilities
- **Fallback Authentication**: Traditional username/password available as secondary option
- **Domain Configuration Issue**: Current Replit domain (be365067-8647-49d0-ac80-367c87b1cbcc-00-330w27orl8pv0.janeway.replit.dev) needs to be added to Google OAuth app's authorized redirect URIs for OAuth to function properly

### UI Libraries
- **Radix UI**: Headless component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **React Hook Form**: Form state management and validation