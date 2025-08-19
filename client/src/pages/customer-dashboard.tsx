import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/Sidebar";
import { FileUploader } from "@/components/FileUploader";
import { RigorBadge } from "@/components/RigorBadge";
import { ProcessingStatus } from "@/components/ProcessingStatus";
import { 
  FileText, 
  Upload, 
  BarChart3, 
  FolderOpen,
  TrendingUp,
  Shield,
  Eye,
  Download,
  Settings
} from "lucide-react";

interface DocumentResult {
  id: string;
  fileName: string;
  status: string;
  createdAt: string;
  standardsCount: number;
  rigorLevel: 'mild' | 'medium' | 'spicy';
  processingTime: string;
}

interface DashboardStats {
  totalDocuments: number;
  documentsProcessed: number;
  questionsAnalyzed: number;
  standardsIdentified: number;
  avgProcessingTime: string;
  successRate: number;
}

export default function CustomerDashboard() {
  const { toast } = useToast();
  const [useFocusStandards, setUseFocusStandards] = useState(false);
  const [focusStandards, setFocusStandards] = useState("");

  // Check if current user has admin access
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Environment-aware admin email configuration
  const getAdminEmail = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    const prefix = isProduction ? 'VITE_PROD_' : 'VITE_DEV_';
    
    return import.meta.env[`${prefix}ADMIN_EMAIL`] || 'admin@standardssherpa.com';
  };
  
  const isAdmin = (user as any)?.email === getAdminEmail();

  // Fetch customer statistics
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
  });

  // Fetch recent documents with live polling for processing documents
  const { data: documents, isLoading: documentsLoading } = useQuery<DocumentResult[]>({
    queryKey: ["/api/documents"],
    refetchInterval: (query) => {
      // Poll every 3 seconds if there are any processing documents
      const hasProcessingDocs = query.state.data?.some((doc: any) => doc.status === 'processing' || doc.status === 'pending');
      return hasProcessingDocs ? 3000 : false;
    },
    refetchIntervalInBackground: true,
  });

  // Export functionality
  const handleExport = async (documentId: string, format: 'rubric-markdown' | 'rubric-pdf' | 'csv' | 'student-cover-sheet') => {
    try {
      const response = await fetch(`/api/documents/${documentId}/export/${format}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `document-${documentId}-${format}.${format.includes('pdf') ? 'pdf' : format.includes('csv') ? 'csv' : 'md'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: `Document exported as ${format}`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-6 py-8">
          {/* Header with Admin Access */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Standards Sherpa
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                AI-powered document analysis for educational standards
              </p>
            </div>
            
            {isAdmin && (
              <Link href="/admin">
                <Button variant="outline" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Admin Panel
                </Button>
              </Link>
            )}
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? '...' : stats?.totalDocuments || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Documents uploaded
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Questions Analyzed</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? '...' : stats?.questionsAnalyzed || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Individual questions processed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Standards Found</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? '...' : stats?.standardsIdentified || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Educational standards identified
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? '...' : stats?.successRate ? `${stats.successRate}%` : '0%'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Processing success rate
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Link href="/upload">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-blue-600" />
                    Upload Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">
                    Upload PDF or Word documents for AI analysis
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/file-cabinet">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-green-600" />
                    File Cabinet
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">
                    Organize uploaded, generated, and graded documents
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/results">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-purple-600" />
                    View Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">
                    Review analysis results and standards alignment
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Recent Documents */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Documents</CardTitle>
                <Link href="/results">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {documentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : documents && documents.length > 0 ? (
                <div className="space-y-4">
                  {documents.slice(0, 5).map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {doc.fileName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {doc.status === 'processing' || doc.status === 'pending' ? (
                          <ProcessingStatus status={doc.status} />
                        ) : (
                          <>
                            <RigorBadge level={doc.rigorLevel} />
                            <Badge variant="secondary">
                              {doc.standardsCount} standards
                            </Badge>
                            <div className="flex gap-1">
                              <Link href={`/results/${doc.id}`}>
                                <Button variant="outline" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleExport(doc.id, 'student-cover-sheet')}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg mb-2">No documents uploaded yet</p>
                  <p className="text-sm mb-4">Start by uploading a document to analyze</p>
                  <Link href="/upload">
                    <Button>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Document
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}