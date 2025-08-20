/**
 * File Cabinet Page - Two-drawer filing system with Mac Finder-style sorting
 * Demonstrates comprehensive document type identification with automatic tagging
 */

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  FileText, 
  Upload, 
  Download, 
  Tag, 
  Calendar, 
  Clock, 
  AlertCircle,
  CheckCircle,
  ArrowUpDown,
  Filter,
  FolderOpen,
  Settings,
  Eye,
  RefreshCw,
  Trash2,
  ArrowLeft,
  Home
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Link } from 'wouter';
import { DocumentViewer } from '@/components/DocumentViewer';
import { useSessionHandler } from '@/hooks/useSessionHandler';
import { useToast } from '@/hooks/use-toast';

interface Document {
  id: string;
  fileName: string;
  originalFilename?: string;
  assetType: 'uploaded' | 'generated';
  exportType?: string;
  tags: string[];
  status: string;
  teacherReviewStatus?: 'not_reviewed' | 'reviewed_and_accepted' | 'reviewed_and_overridden';
  createdAt: string;
  fileSize: number;
  detectedType?: string;
  hasLinkedDocuments?: boolean;
  parentDocument?: Document;
}

interface GradeSubmission {
  id: string;
  type: 'grade_submission';
  studentName: string;
  studentId: string;
  rubricDocument?: any;
  originalDocument?: any;
  totalScore?: string;
  maxPossibleScore?: string;
  percentageScore?: string;
  status: string;
  processedBy?: string;
  scannedAt: string;
  createdAt: string;
  questionGrades: any;
  scannerNotes?: string;
}

interface FileCabinetResponse {
  documents?: Document[];
  gradeSubmissions?: GradeSubmission[];
  totalCount: number;
  drawer?: string;
  filters: {
    drawer: string;
    sortBy: string;
    sortOrder: string;
    tags?: string;
    exportType?: string;
  };
  availableTags?: string[];
  availableExportTypes?: string[];
}

const FILE_CABINET_EXPORT_TYPES = {
  'rubric_pdf': { label: 'Rubric PDF', icon: '📝', color: 'bg-blue-100 text-blue-800' },
  'cover_sheet': { label: 'Cover Sheet', icon: '📄', color: 'bg-green-100 text-green-800' },
  'processing_report': { label: 'Processing Report', icon: '📊', color: 'bg-purple-100 text-purple-800' },
  'standards_summary': { label: 'Standards Summary', icon: '📚', color: 'bg-orange-100 text-orange-800' },
  'question_analysis': { label: 'Question Analysis', icon: '🔍', color: 'bg-indigo-100 text-indigo-800' },
  'teacher_guide': { label: 'Teacher Guide', icon: '👩‍🏫', color: 'bg-yellow-100 text-yellow-800' },
  'collated_graded_submissions': { label: 'Collated Grades', icon: '📋', color: 'bg-emerald-100 text-emerald-800' },
};

export default function FileCabinet() {
  const [currentDrawer, setCurrentDrawer] = useState<'uploaded' | 'generated' | 'graded'>('uploaded');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [tagFilter, setTagFilter] = useState('');
  const [exportTypeFilter, setExportTypeFilter] = useState('all');
  const [newTags, setNewTags] = useState<Record<string, string>>({});
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  const queryClient = useQueryClient();

  // Handle collation of submissions for a document
  const collateMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`/api/file-cabinet/documents/${documentId}/collate-submissions`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to collate submissions');
      return response.json();
    },
    onSuccess: (data, documentId) => {
      // Refresh the file cabinet to show the new collated document
      queryClient.invalidateQueries({ queryKey: ['file-cabinet'] });
      console.log(`Collation completed for ${documentId}:`, data);
    },
    onError: (error) => {
      console.error('Failed to collate submissions:', error);
    }
  });

  const handleCollateSubmissions = (documentId: string) => {
    collateMutation.mutate(documentId);
  };

  // Resubmit document to Sherpa for reprocessing
  const resubmitMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`/api/documents/${documentId}/resubmit`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to resubmit document');
      return response.json();
    },
    onSuccess: (data, documentId) => {
      queryClient.invalidateQueries({ queryKey: ['file-cabinet'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      console.log(`Document ${documentId} resubmitted for processing:`, data);
    },
    onError: (error) => {
      console.error('Failed to resubmit document:', error);
    }
  });

  // Delete document
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to delete document');
      return response.json();
    },
    onSuccess: (data, documentId) => {
      queryClient.invalidateQueries({ queryKey: ['file-cabinet'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      console.log(`Document ${documentId} deleted:`, data);
    },
    onError: (error) => {
      console.error('Failed to delete document:', error);
    }
  });

  const handleResubmitDocument = (documentId: string) => {
    if (confirm('Resubmit this document to Standards Sherpa for reprocessing? This will analyze the document again.')) {
      resubmitMutation.mutate(documentId);
    }
  };

  const handleDeleteDocument = (documentId: string, fileName: string) => {
    if (confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
      deleteMutation.mutate(documentId);
    }
  };

  // Accept AI analysis and proceed to document generation
  const acceptAndProceedMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`/api/documents/${documentId}/accept`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to accept and proceed');
      return response.json();
    },
    onSuccess: (data, documentId) => {
      queryClient.invalidateQueries({ queryKey: ['file-cabinet'] });
      toast({
        title: "Analysis Accepted",
        description: "Document generation has been triggered. Check the Generated Documents drawer for results.",
      });
      console.log(`Document ${documentId} accepted and proceeding to generation:`, data);
    },
    onError: (error) => {
      console.error('Failed to accept and proceed:', error);
      toast({
        title: "Error",
        description: "Failed to accept the analysis. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleAcceptAndProceed = (documentId: string) => {
    if (confirm('Accept the AI analysis and proceed to generate cover sheets and rubrics?')) {
      acceptAndProceedMutation.mutate(documentId);
    }
  };



  const { fetchWithSessionHandling } = useSessionHandler();
  const { toast } = useToast();

  // Fetch File Cabinet data with real-time polling for processing documents
  const { data: fileCabinetData, isLoading } = useQuery({
    queryKey: ['file-cabinet', currentDrawer, sortBy, sortOrder, tagFilter, exportTypeFilter],
    queryFn: async (): Promise<FileCabinetResponse> => {
      const params = new URLSearchParams({
        drawer: currentDrawer,
        sortBy,
        sortOrder,
        ...(tagFilter && { tags: tagFilter }),
        ...(exportTypeFilter && exportTypeFilter !== 'all' && { exportType: exportTypeFilter }),
      });
      
      const response = await fetchWithSessionHandling(`/api/file-cabinet?${params}`);
      
      if (!response) {
        // Session error was handled by the hook
        throw new Error('Session expired');
      }
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication required');
        }
        throw new Error('Failed to fetch file cabinet data');
      }
      
      return response.json();
    },
    refetchInterval: (query) => {
      // Poll every 2 seconds if there are any processing documents or export queue items
      const data = query.state.data;
      const hasProcessingDocs = data?.documents?.some(doc => 
        doc.status === 'processing' || 
        doc.status === 'pending' || 
        doc.teacherReviewStatus === 'not_reviewed'
      );
      return hasProcessingDocs ? 2000 : false;
    },
    refetchIntervalInBackground: true,
    staleTime: 0, // Always treat data as stale for fresh status updates
    gcTime: 0, // Disable cache for real-time updates (TanStack Query v5)
    retry: (failureCount, error) => {
      // Don't retry session errors
      if (error.message.includes('Session expired') || 
          error.message.includes('Authentication required')) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Update document tags mutation
  const updateTagsMutation = useMutation({
    mutationFn: async ({ documentId, userTags }: { documentId: string; userTags: string[] }) => {
      const response = await fetch(`/api/file-cabinet/documents/${documentId}/tags`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ userTags }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update tags');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-cabinet'] });
      setNewTags({});
    },
  });

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const handleAddTag = (documentId: string) => {
    const tagsInput = newTags[documentId];
    if (!tagsInput?.trim()) return;

    const userTags = tagsInput.split(',').map(tag => tag.trim()).filter(Boolean);
    updateTagsMutation.mutate({ documentId, userTags });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTeacherReviewStatusBadge = (reviewStatus?: string) => {
    if (!reviewStatus || reviewStatus === 'not_reviewed') {
      return <Badge variant="outline" className="text-yellow-700 bg-yellow-50 text-xs">🟡 Not Reviewed</Badge>;
    }
    if (reviewStatus === 'reviewed_and_accepted') {
      return <Badge variant="outline" className="text-green-700 bg-green-50 text-xs">🟢 Accepted</Badge>;
    }
    if (reviewStatus === 'reviewed_and_overridden') {
      return <Badge variant="outline" className="text-blue-700 bg-blue-50 text-xs">🔵 Overridden</Badge>;
    }
    return null;
  };

  const getExportTypeBadge = (exportType?: string) => {
    if (!exportType) return null;
    const typeConfig = FILE_CABINET_EXPORT_TYPES[exportType as keyof typeof FILE_CABINET_EXPORT_TYPES];
    if (!typeConfig) return <Badge variant="outline">{exportType}</Badge>;
    
    return (
      <Badge className={typeConfig.color}>
        <span className="mr-1">{typeConfig.icon}</span>
        {typeConfig.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading File Cabinet...</div>
      </div>
    );
  }

  const documents = fileCabinetData?.documents || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Standards Sherpa File Cabinet</h1>
            <p className="text-muted-foreground">
              Manage your uploaded documents and generated exports with comprehensive type identification
            </p>
          </div>
        </div>
        <Button variant="outline" className="gap-2">
          <Settings className="h-4 w-4" />
          Settings
        </Button>
      </div>

      {/* Three-Drawer System */}
      <Tabs value={currentDrawer} onValueChange={(value) => setCurrentDrawer(value as 'uploaded' | 'generated' | 'graded')}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="uploaded" className="gap-2">
            <Upload className="h-4 w-4" />
            Uploaded Documents
          </TabsTrigger>
          <TabsTrigger value="generated" className="gap-2">
            <Download className="h-4 w-4" />
            Generated Documents
          </TabsTrigger>
          <TabsTrigger value="graded" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Graded Submissions
          </TabsTrigger>
        </TabsList>

        {/* Filters and Sorting Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Sort By</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="createdAt">Upload Date</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="tags">Tags</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Order</label>
                <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'asc' | 'desc')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Descending</SelectItem>
                    <SelectItem value="asc">Ascending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Filter by Tags</label>
                <Input
                  placeholder="Enter tag names..."
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                />
              </div>

              {/* Only show export type filter for document drawers, not graded submissions */}
              {currentDrawer !== 'graded' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Filter by Type</label>
                  <Select value={exportTypeFilter} onValueChange={setExportTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {fileCabinetData?.availableExportTypes?.map(type => (
                        <SelectItem key={type} value={type}>
                          {FILE_CABINET_EXPORT_TYPES[type as keyof typeof FILE_CABINET_EXPORT_TYPES]?.label || type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Document Table with Mac Finder-style sorting */}
        <TabsContent value={currentDrawer} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Document Library
                <Badge variant="secondary">{documents.length} items</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-1">
                          Name
                          <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('createdAt')}
                      >
                        <div className="flex items-center gap-1">
                          Upload Date
                          <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center gap-1">
                          Status
                          <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead>Type & Tags</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">
                              {doc.originalFilename || doc.fileName}
                            </div>
                            {doc.parentDocument && (
                              <div className="text-xs text-muted-foreground">
                                Generated from: {doc.parentDocument.originalFilename || doc.parentDocument.fileName}
                              </div>
                            )}
                            {doc.hasLinkedDocuments && (
                              <div className="text-xs text-blue-600">
                                Has generated exports
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(doc.status)}
                              <span className="capitalize">{doc.status}</span>
                            </div>
                            {/* Show teacher review status for uploaded documents */}
                            {doc.assetType === 'uploaded' && doc.status === 'completed' && (
                              <div className="flex gap-1">
                                {getTeacherReviewStatusBadge(doc.teacherReviewStatus)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            {getExportTypeBadge(doc.exportType)}
                            <div className="flex flex-wrap gap-1">
                              {doc.tags.map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  <Tag className="h-3 w-3 mr-1" />
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            {/* On-the-fly tag creation */}
                            <div className="flex gap-1">
                              <Input
                                className="h-7 text-xs"
                                placeholder="Add tags..."
                                value={newTags[doc.id] || ''}
                                onChange={(e) => setNewTags(prev => ({ ...prev, [doc.id]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddTag(doc.id);
                                  }
                                }}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2"
                                onClick={() => handleAddTag(doc.id)}
                                disabled={updateTagsMutation.isPending}
                              >
                                Add
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatFileSize(doc.fileSize)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {/* Review Results Action - only show for uploaded documents with completed analysis */}
                            {doc.assetType === 'uploaded' && doc.status === 'completed' && (
                              <Link href={`/results/${doc.id}`}>
                                <Button
                                  size="sm"
                                  variant={doc.teacherReviewStatus === 'not_reviewed' ? 'default' : 'outline'}
                                  className={doc.teacherReviewStatus === 'not_reviewed' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                                  title={doc.teacherReviewStatus === 'not_reviewed' ? 
                                    'Review AI analysis and decide on next steps' : 
                                    'View analysis results'}
                                >
                                  📊 Review Results
                                </Button>
                              </Link>
                            )}
                            
                            <Button 
                              size="sm" 
                              variant="outline" 
                              title="Download document"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = `/api/documents/${doc.id}/download`;
                                link.download = doc.originalFilename || doc.fileName;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {/* Only show view button for non-docx files */}
                            {!doc.originalFilename?.toLowerCase().endsWith('.docx') && 
                             !doc.fileName?.toLowerCase().endsWith('.docx') && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                title="View document"
                                onClick={() => {
                                  setSelectedDocument(doc);
                                  setViewerOpen(true);
                                }}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            )}

                            {doc.assetType === 'uploaded' && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                title="Collate graded submissions into a single PDF"
                                onClick={() => handleCollateSubmissions(doc.id)}
                              >
                                📋
                              </Button>
                            )}

                            <Link href={`/documents/${doc.id}/inspect`}>
                              <Button size="sm" variant="outline" title="Inspect document relationships and details">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              title="Delete document"
                              onClick={() => handleDeleteDocument(doc.id, doc.originalFilename || doc.fileName)}
                              disabled={deleteMutation.isPending}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {documents.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No documents found in this drawer.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Graded Submissions Drawer */}
        <TabsContent value="graded" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Graded Rubric Submissions
              </CardTitle>
              <CardDescription>
                View and manage all graded assessment submissions with scores and student details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer hover:bg-muted/50">
                        Student Name
                        <ArrowUpDown className="ml-1 h-4 w-4 inline" />
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50">
                        Assessment
                        <ArrowUpDown className="ml-1 h-4 w-4 inline" />
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50">
                        Score
                        <ArrowUpDown className="ml-1 h-4 w-4 inline" />
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50">
                        Graded Date
                        <ArrowUpDown className="ml-1 h-4 w-4 inline" />
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50">
                        Teacher
                        <ArrowUpDown className="ml-1 h-4 w-4 inline" />
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fileCabinetData?.gradeSubmissions && fileCabinetData.gradeSubmissions.length > 0 ? (
                      fileCabinetData.gradeSubmissions.map((submission) => (
                        <TableRow key={submission.id}>
                          <TableCell className="font-medium">
                            {submission.studentName}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{submission.originalDocument?.fileName || 'Unknown Assessment'}</span>
                              {submission.rubricDocument && (
                                <span className="text-sm text-muted-foreground">
                                  via {submission.rubricDocument.fileName}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {submission.totalScore && submission.maxPossibleScore ? (
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {submission.totalScore}/{submission.maxPossibleScore}
                                </span>
                                {submission.percentageScore && (
                                  <span className="text-sm text-muted-foreground">
                                    {Number(submission.percentageScore).toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Not scored</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{new Date(submission.scannedAt).toLocaleDateString()}</span>
                              <span className="text-sm text-muted-foreground">
                                {new Date(submission.scannedAt).toLocaleTimeString()}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {submission.processedBy || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" title="View submission details">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {submission.originalDocument && (
                                <Link href={`/documents/${submission.originalDocument.id}/inspect`}>
                                  <Button size="sm" variant="outline" title="Inspect original document">
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No graded submissions found. Grade some rubrics to see them here.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Available Tags Quick Reference */}
      {fileCabinetData?.availableTags && fileCabinetData.availableTags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Available Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {fileCabinetData.availableTags.map((tag) => (
                <Badge 
                  key={tag} 
                  variant="secondary" 
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  onClick={() => setTagFilter(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document Viewer Modal */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedDocument?.originalFilename || selectedDocument?.fileName || 'Document Viewer'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {selectedDocument && (
              <div className="p-4">
                {/* For PDF files, show embedded viewer */}
                {(selectedDocument.originalFilename?.toLowerCase().endsWith('.pdf') ||
                  selectedDocument.fileName?.toLowerCase().endsWith('.pdf')) ? (
                  <div className="w-full h-96">
                    <iframe
                      src={`/api/documents/${selectedDocument.id}/download`}
                      width="100%"
                      height="100%"
                      className="border rounded"
                      title="Document Preview"
                    />
                  </div>
                ) : (
                  /* For other file types, show metadata and download option */
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="font-semibold">File Information</h3>
                        <p className="text-sm text-gray-600">Name: {selectedDocument.originalFilename || selectedDocument.fileName}</p>
                        <p className="text-sm text-gray-600">Type: {selectedDocument.fileName?.split('.').pop()?.toUpperCase() || 'Unknown'}</p>
                        <p className="text-sm text-gray-600">Size: {formatFileSize(selectedDocument.fileSize)}</p>
                        <p className="text-sm text-gray-600">Created: {new Date(selectedDocument.createdAt).toLocaleString()}</p>
                      </div>
                      <div>
                        <h3 className="font-semibold">Actions</h3>
                        <div className="space-y-2">
                          <Button 
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = `/api/documents/${selectedDocument.id}/download`;
                              link.download = selectedDocument.originalFilename || selectedDocument.fileName;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="w-full"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download Document
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}