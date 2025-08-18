/**
 * Comprehensive UX testing for Standards Sherpa
 * Tests all routes, endpoints, and user flows to prevent dead links and 404 errors
 */

import { storage } from '../storage.js';
import { ActiveUserService } from '../services/activeUserService.js';
import fetch from 'node-fetch';

interface UXTestResult {
  testName: string;
  endpoint: string;
  method: string;
  status: 'pass' | 'fail' | 'skip';
  statusCode?: number;
  responseTime?: number;
  error?: string;
  warning?: string;
}

export class UXTester {
  private baseUrl: string;
  private testResults: UXTestResult[] = [];

  constructor(baseUrl = 'http://localhost:5000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Run comprehensive UX tests
   */
  async runAllUXTests(): Promise<{
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    results: UXTestResult[];
    summary: string;
  }> {
    console.log('[UXTester] Starting comprehensive UX validation...');
    
    this.testResults = [];

    // Test all public endpoints
    await this.testPublicEndpoints();
    
    // Test API endpoints (without auth)
    await this.testApiEndpoints();
    
    // Test file serving endpoints
    await this.testFileEndpoints();
    
    // Test authentication endpoints
    await this.testAuthEndpoints();
    
    // Test error handling
    await this.testErrorHandling();

    // Generate summary
    const passed = this.testResults.filter(r => r.status === 'pass').length;
    const failed = this.testResults.filter(r => r.status === 'fail').length;
    const skipped = this.testResults.filter(r => r.status === 'skip').length;
    
    const summary = `
===== UX TEST RESULTS =====
Total Tests: ${this.testResults.length}
Passed: ${passed} ✅
Failed: ${failed} ${failed > 0 ? '❌' : ''}
Skipped: ${skipped} ⏭️
Success Rate: ${((passed / (this.testResults.length - skipped)) * 100).toFixed(1)}%

${failed > 0 ? '\nFAILED TESTS:\n' + this.testResults.filter(r => r.status === 'fail').map(r => `- ${r.testName} (${r.endpoint}): ${r.error}`).join('\n') : ''}
===========================
    `;
    
    return {
      totalTests: this.testResults.length,
      passed,
      failed,
      skipped,
      results: this.testResults,
      summary
    };
  }

  /**
   * Test public endpoints (should return HTML or redirect)
   */
  private async testPublicEndpoints(): Promise<void> {
    const publicRoutes = [
      { path: '/', name: 'Landing Page' },
      { path: '/dashboard', name: 'Dashboard' },
      { path: '/upload', name: 'Upload Page' },
      { path: '/file-cabinet', name: 'File Cabinet' },
      { path: '/results', name: 'Results Page' },
      { path: '/document-inspector', name: 'Document Inspector' },
      { path: '/prompt-config', name: 'Prompt Configuration' },
      { path: '/google-classroom-setup', name: 'Google Classroom Setup' },
      { path: '/google-oauth-landing', name: 'Google OAuth Landing' },
      { path: '/traditional-login', name: 'Traditional Login' },
      { path: '/auth-error', name: 'Auth Error Page' },
      { path: '/not-found', name: '404 Page' }
    ];

    for (const route of publicRoutes) {
      await this.testEndpoint({
        testName: `Public Route: ${route.name}`,
        endpoint: route.path,
        method: 'GET',
        expectedStatuses: [200, 304, 401] // 401 is acceptable for protected routes
      });
    }
  }

  /**
   * Test API endpoints
   */
  private async testApiEndpoints(): Promise<void> {
    const apiEndpoints = [
      { path: '/api/system-health', name: 'System Health Check', method: 'GET' },
      { path: '/api/auth/user', name: 'User Authentication Status', method: 'GET' },
      { path: '/api/auth/status', name: 'Auth Status Check', method: 'GET' },
      { path: '/api/documents', name: 'Document List', method: 'GET' },
      { path: '/api/queue', name: 'Queue Status', method: 'GET' },
      { path: '/api/auth/google', name: 'Google Auth Initiation', method: 'GET' },
      { path: '/api/auth/google/classroom', name: 'Google Classroom Auth', method: 'GET' },
      { path: '/api/classrooms', name: 'Classroom List', method: 'GET' },
      { path: '/api/file-cabinet', name: 'File Cabinet API', method: 'GET' }
    ];

    for (const endpoint of apiEndpoints) {
      await this.testEndpoint({
        testName: `API Endpoint: ${endpoint.name}`,
        endpoint: endpoint.path,
        method: endpoint.method as 'GET' | 'POST',
        expectedStatuses: [200, 401, 302] // 302 for redirects, 401 for auth required
      });
    }
  }

  /**
   * Test file serving endpoints
   */
  private async testFileEndpoints(): Promise<void> {
    // Get a sample document to test file serving
    try {
      const sampleDocuments = await storage.getCustomerDocuments('test-customer');
      const testDoc = sampleDocuments.find((doc: any) => doc.assetType === 'uploaded');
      
      if (testDoc) {
        await this.testEndpoint({
          testName: 'File Content Serving',
          endpoint: `/api/documents/${testDoc.id}/content`,
          method: 'GET',
          expectedStatuses: [200, 401, 404]
        });

        await this.testEndpoint({
          testName: 'File Download',
          endpoint: `/api/documents/${testDoc.id}/download`,
          method: 'GET',
          expectedStatuses: [200, 401, 404]
        });

        await this.testEndpoint({
          testName: 'Document Results',
          endpoint: `/api/documents/${testDoc.id}/results`,
          method: 'GET',
          expectedStatuses: [200, 401, 404]
        });

        await this.testEndpoint({
          testName: 'Document Inspection',
          endpoint: `/api/documents/${testDoc.id}/inspection`,
          method: 'GET',
          expectedStatuses: [200, 401, 404]
        });
      } else {
        this.testResults.push({
          testName: 'File Endpoints Test',
          endpoint: '/api/documents/*/content',
          method: 'GET',
          status: 'skip',
          warning: 'No test documents available'
        });
      }
    } catch (error) {
      this.testResults.push({
        testName: 'File Endpoints Test Setup',
        endpoint: '/api/documents',
        method: 'GET',
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Test authentication endpoints
   */
  private async testAuthEndpoints(): Promise<void> {
    const authEndpoints = [
      { path: '/api/auth/google/callback', name: 'Google OAuth Callback', method: 'GET' },
      { path: '/api/auth/logout', name: 'Logout Endpoint', method: 'POST' },
      { path: '/api/admin/sessions/stats', name: 'Session Stats (Admin)', method: 'GET' }
    ];

    for (const endpoint of authEndpoints) {
      await this.testEndpoint({
        testName: `Auth Endpoint: ${endpoint.name}`,
        endpoint: endpoint.path,
        method: endpoint.method as 'GET' | 'POST',
        expectedStatuses: [200, 400, 401, 302] // Various auth states are acceptable
      });
    }
  }

  /**
   * Test error handling and edge cases
   */
  private async testErrorHandling(): Promise<void> {
    // Test invalid document IDs
    await this.testEndpoint({
      testName: 'Invalid Document ID Handling',
      endpoint: '/api/documents/invalid-uuid/content',
      method: 'GET',
      expectedStatuses: [400, 401, 404] // Should handle gracefully
    });

    // Test malformed requests
    await this.testEndpoint({
      testName: 'Malformed API Request',
      endpoint: '/api/documents/upload',
      method: 'POST',
      expectedStatuses: [400, 401] // Should validate properly
    });

    // Test non-existent endpoints
    await this.testEndpoint({
      testName: 'Non-existent Endpoint',
      endpoint: '/api/nonexistent',
      method: 'GET',
      expectedStatuses: [404] // Should return 404
    });

    // Test invalid export test
    await this.testEndpoint({
      testName: 'Invalid Test Export',
      endpoint: '/api/test-export',
      method: 'GET',
      expectedStatuses: [400] // Should require documentId
    });
  }

  /**
   * Test individual endpoint
   */
  private async testEndpoint({
    testName,
    endpoint,
    method,
    expectedStatuses = [200],
    body = null,
    headers = {}
  }: {
    testName: string;
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    expectedStatuses?: number[];
    body?: any;
    headers?: Record<string, string>;
  }): Promise<void> {
    const startTime = Date.now();
    
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const options: any = {
        method,
        headers: {
          'User-Agent': 'Standards-Sherpa-UX-Test/1.0',
          ...headers
        }
      };

      if (body && method !== 'GET') {
        options.body = typeof body === 'string' ? body : JSON.stringify(body);
        options.headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(url, options);
      const responseTime = Date.now() - startTime;

      const isExpectedStatus = expectedStatuses.includes(response.status);
      
      this.testResults.push({
        testName,
        endpoint,
        method,
        status: isExpectedStatus ? 'pass' : 'fail',
        statusCode: response.status,
        responseTime,
        error: isExpectedStatus ? undefined : `Unexpected status ${response.status}, expected one of: ${expectedStatuses.join(', ')}`
      });

      if (isExpectedStatus) {
        console.log(`✅ ${testName} (${responseTime}ms): ${response.status}`);
      } else {
        console.error(`❌ ${testName} (${responseTime}ms): Got ${response.status}, expected ${expectedStatuses.join(', ')}`);
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.testResults.push({
        testName,
        endpoint,
        method,
        status: 'fail',
        responseTime,
        error: `Request failed: ${errorMessage}`
      });
      
      console.error(`❌ ${testName} (${responseTime}ms): ${errorMessage}`);
    }
  }
}

// Export singleton
export const uxTester = new UXTester();