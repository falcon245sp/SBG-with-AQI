/**
 * File Cabinet API Routes
 * Handles the two-drawer filing system with Mac Finder-style sorting
 */

import { Router } from 'express';
import { storage } from '../storage';
import { ActiveUserService } from '../services/activeUserService';
import { DatabaseWriteService } from '../services/databaseWriteService';
import { generateDocumentTags, identifyDocumentType, ExportType } from '../utils/documentTagging';

export const fileCabinetRouter = Router();

// Get File Cabinet contents with filtering and sorting
fileCabinetRouter.get('/api/file-cabinet', async (req: any, res) => {
  try {
    const customerUuid = await ActiveUserService.requireActiveCustomerUuid(req);
    const { 
      drawer = 'all', // 'uploaded', 'generated', or 'all'
      sortBy = 'createdAt', 
      sortOrder = 'desc', 
      tags,
      exportType 
    } = req.query;
    
    console.log(`[FileCabinet] Fetching documents for customer ${customerUuid}, drawer: ${drawer}`);
    
    const allDocuments = await storage.getUserDocuments(customerUuid);
    
    // Filter by drawer (asset type)
    let filteredDocs = allDocuments;
    if (drawer !== 'all') {
      filteredDocs = allDocuments.filter(doc => doc.assetType === drawer);
    }
    
    // Filter by export type if specified
    if (exportType) {
      filteredDocs = filteredDocs.filter(doc => doc.exportType === exportType);
    }
    
    // Filter by tags if provided
    if (tags) {
      const tagsArray = Array.isArray(tags) ? tags : tags.split(',');
      filteredDocs = filteredDocs.filter(doc => 
        doc.tags && tagsArray.some((tag: string) => doc.tags?.includes(tag.trim()))
      );
    }
    
    // Mac Finder-style sorting
    filteredDocs.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortBy) {
        case 'name':
          aVal = (a.originalFilename || a.fileName).toLowerCase();
          bVal = (b.originalFilename || b.fileName).toLowerCase();
          break;
        case 'uploadDate':
        case 'createdAt':
          aVal = new Date(a.createdAt);
          bVal = new Date(b.createdAt);
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'tags':
          aVal = (a.tags || []).join(', ').toLowerCase();
          bVal = (b.tags || []).join(', ').toLowerCase();
          break;
        default:
          aVal = new Date(a.createdAt);
          bVal = new Date(b.createdAt);
      }
      
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    // Enhance documents with type identification
    const enhancedDocs = filteredDocs.map(doc => ({
      ...doc,
      detectedType: identifyDocumentType({
        exportType: doc.exportType,
        tags: doc.tags,
        fileName: doc.fileName
      }),
      hasLinkedDocuments: doc.assetType === 'uploaded' ? 
        allDocuments.some(d => d.parentDocumentId === doc.id) : false,
      parentDocument: doc.parentDocumentId ? 
        allDocuments.find(d => d.id === doc.parentDocumentId) : null
    }));
    
    console.log(`[FileCabinet] Found ${enhancedDocs.length} documents in ${drawer} drawer`);
    
    res.json({
      documents: enhancedDocs,
      totalCount: enhancedDocs.length,
      filters: {
        drawer,
        sortBy,
        sortOrder,
        tags,
        exportType
      },
      availableTags: Array.from(new Set(allDocuments.flatMap(doc => doc.tags || []))).sort(),
      availableExportTypes: Array.from(new Set(allDocuments.map(doc => doc.exportType).filter(Boolean))).sort()
    });
  } catch (error) {
    console.error('[FileCabinet] Error fetching file cabinet data:', error);
    res.status(500).json({ message: 'Failed to fetch file cabinet data' });
  }
});

// Update document tags (with automatic tag preservation)
fileCabinetRouter.patch('/api/file-cabinet/documents/:id/tags', async (req: any, res) => {
  try {
    const customerUuid = await ActiveUserService.requireActiveCustomerUuid(req);
    const { id } = req.params;
    const { userTags } = req.body; // Only user-defined tags, automatic tags are preserved
    
    // Validate document ownership
    const document = await storage.getDocument(id);
    if (!document || document.customerUuid !== customerUuid) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Generate complete tag set (automatic + user tags)
    const allTags = generateDocumentTags(document.exportType as ExportType, userTags);
    
    await DatabaseWriteService.updateDocumentTags(id, allTags);
    
    console.log(`[FileCabinet] Updated tags for document ${id}: ${allTags.join(', ')}`);
    
    res.json({ 
      success: true, 
      tags: allTags,
      userTags,
      automaticTags: document.exportType ? generateDocumentTags(document.exportType as ExportType, []) : []
    });
  } catch (error) {
    console.error('[FileCabinet] Error updating document tags:', error);
    res.status(500).json({ message: 'Failed to update tags' });
  }
});

// Queue export generation (automatic background generation)
fileCabinetRouter.post('/api/file-cabinet/documents/:id/generate-exports', async (req: any, res) => {
  try {
    const customerUuid = await ActiveUserService.requireActiveCustomerUuid(req);
    const { id } = req.params;
    const { exportTypes } = req.body; // Array of export types to generate
    
    // Validate document ownership
    const document = await storage.getDocument(id);
    if (!document || document.customerUuid !== customerUuid) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Only allow export generation for uploaded documents
    if (document.assetType !== 'uploaded') {
      return res.status(400).json({ message: 'Can only generate exports for uploaded documents' });
    }
    
    const queuedExports = [];
    for (const exportType of exportTypes) {
      const queueItem = await DatabaseWriteService.queueDocumentExport(id, exportType as ExportType, 1);
      queuedExports.push(queueItem);
    }
    
    console.log(`[FileCabinet] Queued ${exportTypes.length} exports for document ${id}`);
    
    res.json({
      success: true,
      queuedExports,
      message: `Queued ${exportTypes.length} exports for background generation`
    });
  } catch (error) {
    console.error('[FileCabinet] Error queuing exports:', error);
    res.status(500).json({ message: 'Failed to queue exports' });
  }
});

// Get document type statistics
fileCabinetRouter.get('/api/file-cabinet/stats', async (req: any, res) => {
  try {
    const customerUuid = await ActiveUserService.requireActiveCustomerUuid(req);
    const documents = await storage.getUserDocuments(customerUuid);
    
    const stats = {
      totalDocuments: documents.length,
      uploadedDocuments: documents.filter(d => d.assetType === 'uploaded').length,
      generatedDocuments: documents.filter(d => d.assetType === 'generated').length,
      documentsByType: {} as Record<string, number>,
      documentsByStatus: {} as Record<string, number>,
      totalTags: Array.from(new Set(documents.flatMap(d => d.tags || []))).length,
      mostUsedTags: {} as Record<string, number>
    };
    
    // Count by export type
    documents.forEach(doc => {
      const type = doc.exportType || 'uploaded';
      stats.documentsByType[type] = (stats.documentsByType[type] || 0) + 1;
      
      const status = doc.status;
      stats.documentsByStatus[status] = (stats.documentsByStatus[status] || 0) + 1;
      
      // Count tag usage
      (doc.tags || []).forEach((tag: string) => {
        stats.mostUsedTags[tag] = (stats.mostUsedTags[tag] || 0) + 1;
      });
    });
    
    res.json(stats);
  } catch (error) {
    console.error('[FileCabinet] Error fetching stats:', error);
    res.status(500).json({ message: 'Failed to fetch statistics' });
  }
});