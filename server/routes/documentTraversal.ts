import { Router } from 'express';
import { DocumentTraversalService } from '../services/documentTraversalService.js';
import { ActiveUserService } from '../services/activeUserService.js';
import { debugLogger } from '../services/debugLogger.js';
import { z } from 'zod';

const router = Router();

/**
 * Get complete document tree for an uploaded document
 * Shows all generated documents and their grade submissions
 */
router.get('/api/documents/:documentId/tree', async (req, res) => {
  try {
    await ActiveUserService.requireActiveUser();
    
    const { documentId } = req.params;
    const documentTree = await DocumentTraversalService.getDocumentTree(documentId);
    
    res.json(documentTree);
  } catch (error) {
    console.error('[DocumentTraversal] Error getting document tree:', error);
    res.status(500).json({ 
      error: 'Failed to get document tree',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get document lineage (ancestry path)
 * Shows path from root document to current document
 */
router.get('/api/documents/:documentId/lineage', async (req, res) => {
  try {
    await ActiveUserService.requireActiveUser();
    
    const { documentId } = req.params;
    const lineage = await DocumentTraversalService.getDocumentLineage(documentId);
    
    res.json(lineage);
  } catch (error) {
    console.error('[DocumentTraversal] Error getting document lineage:', error);
    res.status(500).json({ 
      error: 'Failed to get document lineage',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get all grade submissions for a specific rubric
 * Includes grading statistics and student details
 */
router.get('/api/documents/:rubricId/grade-submissions', async (req, res) => {
  try {
    await ActiveUserService.requireActiveUser();
    
    const { rubricId } = req.params;
    const gradeData = await DocumentTraversalService.getRubricGradeSubmissions(rubricId);
    
    res.json(gradeData);
  } catch (error) {
    console.error('[DocumentTraversal] Error getting rubric grade submissions:', error);
    res.status(500).json({ 
      error: 'Failed to get grade submissions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get detailed inspection view for any document
 * Shows complete context including relationships, questions, results
 */
router.get('/api/documents/:documentId/inspection', async (req, res) => {
  try {
    await ActiveUserService.requireActiveUser();
    
    const { documentId } = req.params;
    const inspection = await DocumentTraversalService.getDocumentInspection(documentId);
    
    // Debug logging: Log UX display data for pipeline debugging
    await debugLogger.logUxDisplay(
      documentId, 
      {
        inspection,
        endpoint: '/api/documents/:documentId/inspection',
        timestamp: new Date().toISOString(),
        questionsCount: inspection?.questions?.length || 0,
        resultsCount: inspection?.results?.length || 0
      }
    );
    
    res.json(inspection);
  } catch (error) {
    console.error('[DocumentTraversal] Error getting document inspection:', error);
    
    // Debug logging: Log UX display error
    await debugLogger.logUxDisplay(
      req.params.documentId,
      null,
      error instanceof Error ? error.message : 'Unknown inspection error'
    );
    
    res.status(500).json({ 
      error: 'Failed to get document inspection',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get document statistics for dashboard
 * Provides overview of document activity and relationships
 */
router.get('/api/documents/statistics', async (req, res) => {
  try {
    const customerUuid = await ActiveUserService.requireActiveCustomerUuid();
    
    const statistics = await DocumentTraversalService.getDocumentStatistics(customerUuid);
    
    res.json(statistics);
  } catch (error) {
    console.error('[DocumentTraversal] Error getting document statistics:', error);
    res.status(500).json({ 
      error: 'Failed to get document statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;