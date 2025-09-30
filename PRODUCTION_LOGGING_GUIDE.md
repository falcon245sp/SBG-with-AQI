# Production Logging Guide - Standards Sherpa

## Overview
Standards Sherpa now features a comprehensive production-ready logging system designed for debugging customer issues in production environments. The logging system provides structured, searchable logs with full correlation across customer interactions.

## Key Features

### Structured Logging
- **Development**: Human-readable format for easy debugging
- **Production**: JSON format for automated log aggregation and searching
- **Log Levels**: ERROR, WARN, INFO, DEBUG with appropriate filtering

### Customer Context Correlation
Every log entry includes relevant customer context:
- `customerUuid`: Links all activity to specific customers
- `userId`: Session-based user identification
- `requestId`: Correlates all logs from a single request
- `sessionId`: Tracks user session activity
- `documentId`: Links document processing events
- `questionId`: Associates question-level operations

### Request Tracing
- Unique request IDs for complete request lifecycle tracking
- Automatic request timing and performance monitoring
- API endpoint success/failure tracking with status codes

## Specialized Logging Methods

### User Actions
```typescript
logger.userAction('document-upload', {
  customerUuid: '123-456-789',
  documentId: 'doc_abc',
  fileSize: 2048576,
  fileName: 'test-quiz.pdf'
});
```

### AI Processing
```typescript
logger.aiProcessing('grok', 'question-analysis', {
  customerUuid: '123-456-789',
  documentId: 'doc_abc',
  questionId: 'q_123',
  duration: 3500
});
```

### Document Processing
```typescript
logger.documentProcessing('text-extraction', {
  customerUuid: '123-456-789',
  documentId: 'doc_abc',
  mimeType: 'application/pdf',
  extractedLength: 15000
});
```

### Authentication Events
```typescript
logger.authentication('google-login', true, {
  customerUuid: '123-456-789',
  ip: '192.168.1.1',
  userAgent: 'Chrome/91.0'
});
```

### Security Events
```typescript
logger.security('unauthorized-access-attempt', {
  ip: '192.168.1.1',
  path: '/api/documents/sensitive',
  userAgent: 'curl/7.68.0'
});
```

### Performance Monitoring
```typescript
logger.performance('database-query', 2500, {
  operation: 'getDocumentsByCustomer',
  customerUuid: '123-456-789'
});
```

### Business Events
```typescript
logger.businessEvent('rubric-submission', {
  customerUuid: '123-456-789',
  documentId: 'doc_abc',
  gradedQuestions: 15
});
```

## Error Handling

### Comprehensive Error Context
All errors include:
- Full stack traces in development
- Customer context for correlation
- Operation details for debugging
- Request correlation IDs

### Error Categories
- **Authentication Errors**: Login failures, token issues
- **Authorization Errors**: Permission denials, access violations
- **Processing Errors**: Document processing failures, AI timeouts
- **Database Errors**: Connection issues, query failures
- **Integration Errors**: External API failures

## Production Debugging Workflow

### 1. Customer Issue Report
When a customer reports an issue:
1. Get their email or customer UUID
2. Search logs by `customerUuid` field
3. Look for ERROR level entries first
4. Follow `requestId` for complete request traces

### 2. Performance Investigation
For performance issues:
1. Search for WARN level performance logs (>5 second operations)
2. Look at `duration` fields across operations
3. Check database query performance logs
4. Review AI processing times

### 3. Authentication Debugging
For login/access issues:
1. Search authentication logs by customer email
2. Check security event logs for failed attempts
3. Review session management logs
4. Verify Google OAuth callback logs

### 4. Document Processing Issues
For upload/processing problems:
1. Search by `documentId` or `customerUuid`
2. Follow document processing pipeline logs
3. Check AI processing results and errors
4. Review file extraction logs

## Log Analysis Examples

### Finding All Activity for a Customer
```bash
# Production environment
grep '"customerUuid":"123-456-789"' app.log | jq '.'

# Development environment  
grep "customerUuid=123-456-789" app.log
```

### Tracing a Specific Request
```bash
# Production
grep '"requestId":"abc123def456"' app.log | jq '.'

# Development
grep "requestId=abc123def456" app.log
```

### Finding Performance Issues
```bash
# Production - operations taking >5 seconds
grep '"level":"WARN"' app.log | grep '"component":"performance"' | jq '.'

# Development
grep "WARN.*Performance:" app.log
```

### Authentication Failures
```bash
# Production
grep '"component":"auth"' app.log | grep '"level":"WARN"' | jq '.'

# Development
grep "Authentication.*Failed" app.log
```

## Component Mapping

### Core Components
- `active-user-service`: User session management
- `customer-lookup-service`: Customer data resolution
- `document-processor`: File processing pipeline
- `ai-service`: AI engine interactions
- `auth`: Authentication and authorization
- `security`: Security event monitoring
- `performance`: Performance monitoring
- `business`: Business logic events

### External Integrations
- `google-auth`: Google OAuth integration
- `google-classroom`: Classroom API integration
- `database`: Database operations
- `file-storage`: File system operations

## Best Practices

### For Developers
1. Always include customer context in logs
2. Use appropriate log levels (ERROR for failures, WARN for issues, INFO for normal flow)
3. Include operation details for debugging
4. Add performance logging for operations >1 second
5. Use business event logging for important user actions

### For Production Support
1. Start with customer UUID or email for issue correlation
2. Look for ERROR logs first, then WARN logs
3. Use request IDs to trace complete request flows
4. Check performance logs for timeout issues
5. Review authentication logs for access problems

## Security Considerations

### PII Handling
- Customer UUIDs are logged (safe identifiers)
- Email addresses are logged only in authentication contexts
- No sensitive personal data in logs
- All PII in database remains encrypted

### Log Retention
- Logs contain customer correlation data
- Implement appropriate retention policies
- Consider log anonymization for long-term storage
- Ensure GDPR compliance for customer data

## Monitoring Integration

### Log Aggregation
The structured JSON format integrates with:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Splunk
- CloudWatch Logs
- Datadog
- New Relic

### Alerting
Set up alerts for:
- High error rates by customer
- Performance degradation
- Authentication failure spikes
- Critical business event failures

This logging system provides complete visibility into customer interactions and system behavior, enabling rapid diagnosis and resolution of production issues.