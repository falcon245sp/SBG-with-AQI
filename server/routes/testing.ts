/**
 * Testing API endpoints for comprehensive system validation
 */

import { Router } from 'express';
import { systemTester } from '../tests/systemTests.js';
import { ActiveUserService } from '../services/activeUserService.js';

const router = Router();

/**
 * Run comprehensive system tests
 * GET /api/testing/run-all-tests
 */
router.get('/run-all-tests', async (req, res) => {
  try {
    console.log('[TestingAPI] Starting comprehensive system tests...');
    
    const results = await systemTester.runAllTests();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results
    });
    
  } catch (error) {
    console.error('[TestingAPI] System test execution failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Test specific system component
 * GET /api/testing/test-component/:component
 */
router.get('/test-component/:component', async (req, res) => {
  try {
    const { component } = req.params;
    
    // Individual component testing logic would go here
    res.json({
      success: true,
      component,
      message: `Component testing for ${component} would be implemented here`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`[TestingAPI] Component test failed for ${req.params.component}:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Validate system health and configuration
 * GET /api/testing/health-check
 */
router.get('/health-check', async (req, res) => {
  try {
    const healthCheck = {
      database: 'unknown',
      exportProcessor: 'unknown',
      fileSystem: 'unknown',
      timestamp: new Date().toISOString()
    };
    
    // Test database connection
    try {
      const { storage } = await import('../storage.js');
      await storage.getCustomerDocuments('health-check-test');
      healthCheck.database = 'healthy';
    } catch (error) {
      healthCheck.database = 'error';
    }
    
    // Test export processor
    try {
      const { exportProcessor } = await import('../services/exportProcessor.js');
      const status = exportProcessor.getStatus();
      healthCheck.exportProcessor = status.isStarted ? 'healthy' : 'not_started';
    } catch (error) {
      healthCheck.exportProcessor = 'error';
    }
    
    // Test file system access
    try {
      const fs = await import('fs');
      const { config } = await import('../config/environment');
      fs.accessSync(config.uploadsDir);
      healthCheck.fileSystem = 'healthy';
    } catch (error) {
      healthCheck.fileSystem = 'error';
    }
    
    const isHealthy = Object.values(healthCheck).every(status => status === 'healthy' || status.includes('2025'));
    
    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      ...healthCheck
    });
    
  } catch (error) {
    console.error('[TestingAPI] Health check failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export { router as testingRouter };