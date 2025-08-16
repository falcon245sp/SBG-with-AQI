# Document Processing Web Service API Contract

## Overview
Standalone web service for AI-powered educational document analysis that accepts documents and returns JSON results. Designed for AWS deployment with API Gateway, SQS, Step Functions, and Lambda.

## Core API Endpoints

### 1. Submit Document for Processing
**POST** `/api/v1/process`

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  ```
  customerId: string (required)
  file: File (required) - PDF, Word, or Google Doc
  jurisdictions: string[] (required) - Array of educational standards jurisdictions
  focusStandards: string[] (optional) - Specific standards to focus on
  callbackUrl: string (optional) - Webhook URL for completion notification
  ```

**Response:**
```json
{
  "jobId": "uuid-string",
  "status": "submitted",
  "estimatedCompletionTime": "2024-01-01T12:00:00Z",
  "message": "Document submitted for processing"
}
```

### 2. Check Processing Status
**GET** `/api/v1/status/{jobId}`

**Response:**
```json
{
  "jobId": "uuid-string",
  "status": "processing|completed|failed",
  "progress": 75,
  "currentStep": "ai_analysis",
  "startedAt": "2024-01-01T10:00:00Z",
  "completedAt": "2024-01-01T12:00:00Z",
  "errorMessage": "string (if failed)"
}
```

### 3. Get Processing Results
**GET** `/api/v1/results/{jobId}`

**Response:**
```json
{
  "jobId": "uuid-string",
  "customerId": "string",
  "document": {
    "fileName": "string",
    "fileSize": 1024000,
    "mimeType": "application/pdf",
    "processedAt": "2024-01-01T12:00:00Z"
  },
  "results": [
    {
      "questionNumber": "1A",
      "questionText": "string",
      "context": "string",
      "consensusStandards": [
        {
          "code": "CCSS.MATH.HSA.REI.A.1",
          "description": "string",
          "jurisdiction": "Common Core",
          "gradeLevel": "9-12",
          "subject": "Mathematics"
        }
      ],
      "consensusRigorLevel": "mild|medium|spicy",
      "confidenceScore": 0.85,
      "aiResponses": [
        {
          "aiEngine": "grok|chatgpt|claude",
          "rigorLevel": "medium",
          "rigorJustification": "string",
          "confidence": 0.8,
          "standardsIdentified": [...]
        }
      ]
    }
  ],
  "summary": {
    "totalQuestions": 25,
    "rigorDistribution": {
      "mild": 10,
      "medium": 12,
      "spicy": 3
    },
    "standardsCoverage": ["Common Core", "NGSS"],
    "processingTime": "2m 45s"
  }
}
```

## Authentication
- API Key based authentication via `Authorization: Bearer {api-key}` header
- Rate limiting: 100 requests per hour per API key

## Error Responses
```json
{
  "error": "error_code",
  "message": "Human readable error message",
  "details": "Additional error context"
}
```

## Status Codes
- 200: Success
- 202: Accepted (for async operations)
- 400: Bad Request
- 401: Unauthorized
- 404: Not Found
- 429: Rate Limited
- 500: Internal Server Error

## AWS Integration Notes
- POST `/process` will put message on SQS queue for Lambda processing
- Status and results endpoints will query DynamoDB for job state
- Large results may be stored in S3 with presigned URLs