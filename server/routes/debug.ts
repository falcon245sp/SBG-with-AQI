import express from 'express';
import { debugLogger } from '../services/debugLogger';
import { storage } from '../storage';
import { ActiveUserService } from '../services/activeUserService';

const router = express.Router();

// Get debug pipeline data for a specific document
router.get('/pipeline/:documentId', async (req, res) => {
  try {
    const user = await ActiveUserService.requireActiveUser(req);
    const { documentId } = req.params;
    
    // Security: Check document ownership
    const document = await storage.getDocument(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Only allow document owner or admin
    if (document.customerUuid !== user.id && !user.isAdmin) {
      return res.status(403).json({ error: 'Access denied: not document owner' });
    }
    
    const debugData = await debugLogger.getDebugData(documentId);
    
    if (!debugData) {
      return res.status(404).json({ error: 'Debug data not found for this document' });
    }
    
    res.json({
      documentId,
      debugData,
      message: 'Debug pipeline data retrieved successfully'
    });
  } catch (error) {
    console.error('Error retrieving debug data:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve debug data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all debug logs (admin only)
router.get('/pipeline', async (req, res) => {
  try {
    const user = await ActiveUserService.requireActiveUser(req);
    
    // Security: Admin only
    if (!user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const allLogs = await debugLogger.getAllDebugLogs();
    
    res.json({
      count: allLogs.length,
      logs: allLogs,
      message: 'All debug logs retrieved successfully'
    });
  } catch (error) {
    console.error('Error retrieving all debug logs:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve debug logs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Compare pipeline data between documents
router.get('/compare/:documentId1/:documentId2', async (req, res) => {
  try {
    const user = await ActiveUserService.requireActiveUser(req);
    const { documentId1, documentId2 } = req.params;
    
    // Security: Check ownership for BOTH documents
    const [document1, document2] = await Promise.all([
      storage.getDocument(documentId1),
      storage.getDocument(documentId2)
    ]);
    
    if (!document1 || !document2) {
      return res.status(404).json({ 
        error: 'One or both documents not found',
        found: { documentId1: !!document1, documentId2: !!document2 }
      });
    }
    
    // Only allow if user owns both documents or is admin
    if (!user.isAdmin && (document1.customerUuid !== user.id || document2.customerUuid !== user.id)) {
      return res.status(403).json({ error: 'Access denied: must own both documents to compare' });
    }
    
    const [data1, data2] = await Promise.all([
      debugLogger.getDebugData(documentId1),
      debugLogger.getDebugData(documentId2)
    ]);
    
    if (!data1 || !data2) {
      return res.status(404).json({ 
        error: 'Debug data not found for one or both documents',
        found: { documentId1: !!data1, documentId2: !!data2 }
      });
    }
    
    res.json({
      documentId1,
      documentId2,
      data1,
      data2,
      comparison: {
        pass1Questions: {
          doc1: data1.pass1QuestionCount || 0,
          doc2: data2.pass1QuestionCount || 0,
          match: (data1.pass1QuestionCount || 0) === (data2.pass1QuestionCount || 0)
        },
        pass1Checksums: {
          doc1: data1.pass1Checksum,
          doc2: data2.pass1Checksum,
          match: data1.pass1Checksum === data2.pass1Checksum
        },
        pass2Checksums: {
          doc1: data1.pass2Checksum,
          doc2: data2.pass2Checksum,
          match: data1.pass2Checksum === data2.pass2Checksum
        },
        dbStorageChecksums: {
          doc1: data1.dbStorageChecksum,
          doc2: data2.dbStorageChecksum,
          match: data1.dbStorageChecksum === data2.dbStorageChecksum
        },
        uxDisplayChecksums: {
          doc1: data1.uxDisplayChecksum,
          doc2: data2.uxDisplayChecksum,
          match: data1.uxDisplayChecksum === data2.uxDisplayChecksum
        }
      },
      message: 'Debug data comparison completed'
    });
  } catch (error) {
    console.error('Error comparing debug data:', error);
    res.status(500).json({ 
      error: 'Failed to compare debug data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;