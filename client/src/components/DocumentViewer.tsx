import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Download, FileText, AlertCircle, ExternalLink } from 'lucide-react';

interface DocumentViewerProps {
  documentId: string;
  fileName: string;
  fileType?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function DocumentViewer({ documentId, fileName, fileType, isOpen, onClose }: DocumentViewerProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [viewMode, setViewMode] = useState<'preview' | 'download'>('preview');

  const getFileExtension = (filename: string) => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };

  const extension = getFileExtension(fileName);
  const isViewable = ['txt', 'md', 'json', 'csv', 'xml', 'html'].includes(extension);
  const isPDF = extension === 'pdf';
  const isDocx = extension === 'docx';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension);

  useEffect(() => {
    if (isOpen && isViewable) {
      fetchDocumentContent();
    }
  }, [isOpen, documentId, isViewable]);

  const fetchDocumentContent = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/documents/${documentId}/content`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch document content');
      }
      
      const text = await response.text();
      setContent(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `/api/documents/${documentId}/download`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFileTypeInfo = () => {
    switch (extension) {
      case 'pdf':
        return { 
          label: 'PDF Document', 
          color: 'bg-red-100 text-red-800',
          description: 'Portable Document Format - can be viewed in browser'
        };
      case 'docx':
        return { 
          label: 'Word Document', 
          color: 'bg-blue-100 text-blue-800',
          description: 'Microsoft Word document - download to view with Word or compatible editor'
        };
      case 'txt':
        return { 
          label: 'Text File', 
          color: 'bg-gray-100 text-gray-800',
          description: 'Plain text file'
        };
      case 'md':
        return { 
          label: 'Markdown', 
          color: 'bg-purple-100 text-purple-800',
          description: 'Markdown formatted text'
        };
      case 'csv':
        return { 
          label: 'CSV Data', 
          color: 'bg-green-100 text-green-800',
          description: 'Comma-separated values data file'
        };
      default:
        return { 
          label: extension.toUpperCase(), 
          color: 'bg-gray-100 text-gray-800',
          description: 'File format'
        };
    }
  };

  const fileInfo = getFileTypeInfo();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-2">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {fileName}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge className={fileInfo.color}>
                {fileInfo.label}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {fileInfo.description}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* PDF Viewer */}
          {isPDF && (
            <div className="h-full">
              <iframe
                src={`/api/documents/${documentId}/content`}
                className="w-full h-full border rounded"
                title={`PDF: ${fileName}`}
              />
            </div>
          )}

          {/* Image Viewer */}
          {isImage && (
            <div className="h-full flex items-center justify-center">
              <img
                src={`/api/documents/${documentId}/content`}
                alt={fileName}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}

          {/* Text Content Viewer */}
          {isViewable && (
            <ScrollArea className="h-full border rounded">
              {loading ? (
                <div className="p-4 text-center">
                  <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                  Loading document content...
                </div>
              ) : error ? (
                <div className="p-4 text-center text-red-600">
                  <AlertCircle className="h-6 w-6 mx-auto mb-2" />
                  {error}
                </div>
              ) : (
                <pre className="p-4 text-sm whitespace-pre-wrap font-mono">
                  {content}
                </pre>
              )}
            </ScrollArea>
          )}

          {/* Non-viewable files */}
          {!isPDF && !isImage && !isViewable && (
            <div className="h-full flex flex-col items-center justify-center space-y-4 text-center">
              <FileText className="h-16 w-16 text-muted-foreground" />
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Preview not available</h3>
                <p className="text-muted-foreground max-w-sm">
                  {isDocx 
                    ? 'Word documents need to be downloaded and opened with Microsoft Word or a compatible application.'
                    : 'This file type cannot be previewed in the browser. Download the file to view it with an appropriate application.'
                  }
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download to View
                </Button>
                {isDocx && (
                  <Button variant="outline" asChild>
                    <a 
                      href="https://office.live.com/start/Word.aspx" 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open in Word Online
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}