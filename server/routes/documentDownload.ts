/**
 * Document Download API Routes
 * Handles secure document downloads with proper authentication
 */

import { Router } from 'express';
import { storage } from '../storage';
import { ActiveUserService } from '../services/activeUserService';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

export const documentDownloadRouter = Router();

// Download document by ID
documentDownloadRouter.get('/api/documents/:documentId/download', async (req: any, res) => {
  try {
    const { documentId } = req.params;
    const customerUuid = await ActiveUserService.requireActiveCustomerUuid(req);
    
    logger.userAction('document-download-request', {
      customerUuid,
      documentId,
      userAgent: req.get('User-Agent')
    });

    // Get document from storage
    const document = await storage.getDocument(documentId);
    if (!document) {
      logger.security('Attempted download of non-existent document', {
        customerUuid,
        documentId,
        ip: req.ip
      });
      return res.status(404).json({ message: 'Document not found' });
    }

    // Verify customer owns this document
    if (document.customerUuid !== customerUuid) {
      logger.security('Attempted download of unauthorized document', {
        customerUuid,
        documentId,
        documentOwner: document.customerUuid,
        ip: req.ip
      });
      return res.status(403).json({ message: 'Access denied' });
    }

    // Determine file path based on document type
    let filePath: string;
    let fileName: string;
    let mimeType: string;

    if (document.originalPath) {
      // Original uploaded document
      filePath = document.originalPath;
      fileName = document.originalFilename || document.name || `document-${documentId}`;
      mimeType = document.mimeType || 'application/octet-stream';
    } else if (document.exportPath) {
      // Generated/exported document
      filePath = document.exportPath;
      fileName = document.name || `export-${documentId}`;
      mimeType = document.mimeType || 'application/pdf';
    } else {
      logger.error('Document has no available file path', {
        customerUuid,
        documentId,
        hasOriginalPath: !!document.originalPath,
        hasExportPath: !!document.exportPath
      });
      return res.status(404).json({ message: 'Document file not found' });
    }

    // Check if file exists on filesystem
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      logger.error('Document file missing from filesystem', {
        customerUuid,
        documentId,
        filePath: fullPath
      });
      return res.status(404).json({ message: 'Document file not found on server' });
    }

    // Get file stats for content-length
    const stats = fs.statSync(fullPath);

    // Set headers for download
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stats.size.toString());
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    
    // Cache headers for static content
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('ETag', `"${documentId}-${stats.mtime.getTime()}"`);

    // Handle conditional requests
    const ifNoneMatch = req.get('If-None-Match');
    if (ifNoneMatch && ifNoneMatch === `"${documentId}-${stats.mtime.getTime()}"`) {
      return res.status(304).end();
    }

    logger.userAction('document-download-success', {
      customerUuid,
      documentId,
      fileName,
      fileSize: stats.size,
      mimeType
    });

    // Stream the file
    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);

    stream.on('error', (error) => {
      logger.error('File stream error during download', {
        customerUuid,
        documentId,
        filePath: fullPath
      }, error);
      
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error streaming file' });
      }
    });

  } catch (error) {
    logger.error('Document download failed', {
      documentId: req.params.documentId,
      component: 'document-download'
    }, error instanceof Error ? error : new Error(String(error)));
    
    res.status(500).json({ message: 'Download failed' });
  }
});

export default documentDownloadRouter;