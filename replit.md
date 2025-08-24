# Document Processing Service - Standards Sherpa

## Overview
The Document Processing Service, "Standards Sherpa," is a full-stack web application for AI-powered analysis of educational documents (PDFs, Word docs, Google Docs). Its core purpose is to automatically identify standards alignment and cognitive rigor levels using multiple AI engines. It aims to provide educators and EdTech companies with efficient tools for analyzing and aligning educational content, thereby enhancing curriculum development and assessment. Key capabilities include automated document processing, rubric collation, anti-fraud grading, and comprehensive document management. The business vision is to improve educational content quality and efficiency through advanced AI integration.

## Version History

### **v0.9 (August 22, 2025) - Google Classroom Integration Milestone** ✅
- **Proactive Bulk Configuration**: Automatically presents bulk configuration dialog after configuring first classroom group, eliminating button hunting
- **Mathematical Course Ordering**: Standards sets now sort by math progression (Algebra 1 → Geometry → Algebra 2 → Pre-Calculus) instead of alphabetically
- **Seamless UX Flow**: Intelligent similarity detection with regex patterns for immediate configuration of related classroom groups
- **Enhanced User Workflow**: System proactively guides users through configuring all similar courses without requiring UI discovery
- **Intelligent Course Click Behavior**: Clicking any unconfigured course (single or grouped) immediately opens configuration dialog
- **Contextual Configuration Access**: Eliminates button-hunting UX with natural, discovery-free workflow
- **Admin Classroom Tools**: New admin dashboard tab with Google Classroom data clearing functionality for fresh testing in both DEV and PROD environments

### **v1.0 (Planned) - Standards Accountability & SBG Gradebook**
- **Accountability Matrix**: Year-long standards coverage tracking with visual rigor indicators (green/yellow/red for mild/medium/spicy)
- **Standards Tracking System**: Automated capture of standards and maximum rigor levels from AI analysis
- **Unit-Based Gradebook**: Progressive unlock of SBG entries as units are analyzed and standards identified  
- **Three-Persona Onboarding**: Smart post-configuration flow for SBG converters, standards auditors, and curriculum builders
- **Interactive Matrix**: Hover states with assessment dates and click-through to source rubrics and documents
- **Manual Marking System**: Teacher symbol menu for marking standards without formal assessments

### **v1.1+ (Future Vision) - Predictive Student Success Analytics**
- **Cross-Course Progression Modeling**: Using standards linkage data (Achieve The Core Coherence Map) to predict student success likelihood in subsequent mathematics courses
- **Dual Pressure Motivation System**: Students see both current mastery levels AND predicted readiness for next course (e.g., "75% Algebra 1 mastery → 62% predicted Geometry readiness")
- **Individual Student Success Dashboards**: Real-time visualization of which current standards have highest impact on future course success
- **Early Warning & Intervention**: Automated identification of students at risk for next-level struggles based on current performance patterns
- **Future-Focused Learning Paths**: Personalized recommendations showing students exactly which standards to prioritize for maximum future mathematical success

### **v0.8 (August 21, 2025) - Performance & Reliability Milestone**
- **Critical Bug Fixed**: Resolved alphabetical vs numerical question sorting causing rigor level misalignment in generated documents
- **Document Inspector**: Fixed 404 errors in "View All Questions" navigation links
- **Database Performance**: Implemented materialized views with automatic PostgreSQL trigger-based refresh system
- **UI Enhancements**: Streamlined Document Library interface, improved loading states with proper blue processing indicators
- **Teacher Workflow**: Enhanced override system with automatic rubric regeneration on teacher corrections
- **System Architecture**: Enhanced three-layer pattern with database optimization and comprehensive error handling

### **v0.7 (August 18, 2025) - DatabaseWriteService Implementation**
- Complete three-layer architecture with centralized write operations
- Enterprise-level audit and compliance features
- 15+ core write operations migrated to DatabaseWriteService
- Zero LSP diagnostics achieved

## User Preferences
Preferred communication style: Simple, everyday language.

**IMPORTANT CONSTRAINT**: User does not have access to browser Developer Console (F12) in Replit projects. All debugging must rely on server-side logs, workflow console outputs, and alternative debugging methods that don't require browser dev tools.

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
- **Three-Layer Architecture**: ActiveUserService, CustomerLookupService, DatabaseWriteService for centralized data access and write operations.

### Database Design
- **Primary Database**: PostgreSQL via Neon serverless
- **Schema Management**: Drizzle Kit
- **Key Tables**: Users, Documents, Questions, AI Responses, Question Results, Processing Queue, Sessions, TeacherOverrides, Classrooms, Students.

### AI Processing Pipeline
- **Multi-Engine Analysis**: Parallel processing with ChatGPT, Grok, and Claude.
- **Consensus Algorithm**: Voting methodology to consolidate results.
- **Rigor Assessment**: Three-tier classification system (mild, medium, spicy) based on Depth of Knowledge (DOK) levels.
- **Standards Mapping**: Automated identification of educational standards alignment, including NGSS support.
- **Analysis Workflow**: Clean DRAFT → CONFIRMED analysis workflow where AI analysis is "DRAFT," and teacher acceptance creates a single "CONFIRMED analysis document" as the authoritative source for all generated documents.

### File Processing
- **Supported Formats**: PDF, Microsoft Word (.docx), Google Docs.
- **Question Parsing**: Intelligent parsing to extract individual questions and context.
- **Asynchronous Processing**: Queue-based system for handling large documents.
- **Multi-File Upload**: Support for uploading and processing multiple documents simultaneously.
- **Document Re-submission Overwrite System**: Automatically deletes existing generated documents and clears export queues for re-processed source documents, ensuring seamless re-generation.
- **User-Friendly Filename Generation**: Generated documents use descriptive names (e.g., `[Original-Document-Name]_[type]_[YYYY-MM-DD].pdf`).
- **File Organization**: Human-readable structure under `appdata` (uploads, generated rubrics, coversheets, graded).

### Security & Authentication
- **Authentication Provider**: Replit Auth with OpenID Connect (with fallback username/password).
- **Session Management**: PostgreSQL-based session storage with automatic cleanup.
- **API Security**: Session-based authentication.
- **File Validation**: MIME type validation and file size limits.
- **PII Encryption**: All personally identifiable information encrypted at rest using AES encryption.
- **Credential Security**: OAuth credentials stored in environment variables.
- **Centralized Data Access**: CustomerLookupService and DatabaseWriteService enforce secure and consistent data handling.
- **Environment Configuration**: Comprehensive environment variable system with DEV_/PROD_ prefixes and STABLE_ constants for environment-specific settings.

### Error Handling & Monitoring
- **Production-Ready Logging**: Comprehensive structured logging system with customer context correlation, request tracing, and specialized logging methods for debugging production issues.
- **Log Levels**: ERROR, WARN, INFO, DEBUG.
- **Customer Correlation**: All logs include customerUuid, requestId, and relevant context.
- **Error Boundaries**: Comprehensive error handling with full stack traces and correlation IDs.
- **Status Tracking**: Real-time polling system for processing documents, teacher review status, and export queue monitoring.
- **Performance Monitoring**: Automatic performance logging with warnings for slow operations.
- **Database Optimization**: Materialized views with automatic trigger-based refresh for document relationship queries.

### Feature Specifications
- **Student Facing Test Cover Sheet**: PDF export with four-column layout (Question, Standard, Topic, Rigor Level).
- **Teacher Override System**: Database and UI for teachers to save corrections to AI analysis, including confidence scoring and "Revert to Sherpa" functionality; export processors respect teacher overrides.
- **Google Classroom Integration**: Google Classroom API integration for roster and class management.
- **Anti-Fraud QR Grading**: One-time sequence number system prevents duplicate grade submissions for rubrics.
- **Rubric Collation System**: Automatically combines individual graded rubric submissions into organized multipage PDFs.
- **File Cabinet Document Management**: Three-drawer system (Uploaded, Generated, Graded) with reliable type identification and Mac Finder-style interface.
- **Visual Design**: Warm scholarly aesthetic with a rich blue and wood tone color palette.
- **Rubric Format**: Professional table-based format with six-column layout, rigor indicators, standards alignment, student name field, and QR code placeholder. Standards-Based Grading methodology applied with a 4-level mastery scale.
- **Export Queue Management**: Comprehensive cleanup system with TTL for exports and retry mechanism with exponential backoff.
- **UX**: Dual system with customer-facing dashboard and admin panel for system diagnostics.

## External Dependencies

### AI Services
- **OpenAI API**: GPT-4o model
- **Anthropic Claude**: Claude Sonnet 4
- **X.AI Grok**: Alternative AI engine

### Database & Storage
- **Neon Database**: Serverless PostgreSQL
- **Google Cloud Storage**: Configured for file storage (not actively used)

### Authentication & Google Integration
- **Google OAuth**: Primary authentication, configured with renamed environment variables (SHERPA_*)
- **Google Classroom Integration**: Full OAuth-based integration

### UI Libraries
- **Radix UI**: Headless component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **React Hook Form**: Form state management and validation