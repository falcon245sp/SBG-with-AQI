import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { RigorBadge } from "@/components/RigorBadge";
import { ProcessingStatus } from "@/components/ProcessingStatus";
import { 
  FileText, 
  Upload, 
  Eye,
  Download,
  Shield,
  RefreshCw,
  Users
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

export default function CustomerDashboard() {
  const { toast } = useToast();

  // Google Classroom sync mutation
  const syncClassroomsMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/auth/sync-classroom', {}),
    onSuccess: (data: any) => {
      const classroomCount = data.classrooms?.length || 0;
      toast({
        title: "Sync Successful",
        description: data.message || `Successfully synced ${classroomCount} classrooms from Google Classroom`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/classrooms'] });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync Google Classroom data. Please try again.",
        variant: "destructive",
      });
    }
  });

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

  // Fetch recent documents with live polling for processing documents
  const { data: documents, isLoading: documentsLoading } = useQuery<DocumentResult[]>({
    queryKey: ["/api/documents"],
    refetchInterval: (query) => {
      // Poll every 2 seconds if there are any processing documents
      const hasProcessingDocs = query.state.data?.some((doc: any) => doc.status === 'processing' || doc.status === 'pending');
      return hasProcessingDocs ? 2000 : false;
    },
    refetchIntervalInBackground: true,
    staleTime: 0, // Always treat data as stale for fresh status updates
    gcTime: 0, // Disable cache for real-time updates
  });

  // Export functionality
  const handleExport = async (documentId: string, format: 'student-cover-sheet') => {
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
      a.download = `document-${documentId}-${format}.pdf`;
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
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Simple Header */}
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Standards Sherpa
            </h1>
            <p className="text-gray-600">
              Document analysis and standards alignment
            </p>
          </div>
          
          {isAdmin && (
            <Link href="/admin">
              <Button variant="outline" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Admin
              </Button>
            </Link>
          )}
        </div>

        {/* Google Classroom Sync Section */}
        <div className="mb-8">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-green-600" />
                  <div>
                    <h3 className="text-lg font-semibold text-green-900">Google Classroom</h3>
                    <p className="text-sm text-green-700">
                      {(user as any)?.classroomConnected || (user as any)?.classroom_connected
                        ? "Connected - Click to sync your latest classroom data" 
                        : "Connect to import your classes and student rosters"
                      }
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => syncClassroomsMutation.mutate()}
                  disabled={syncClassroomsMutation.isPending || !((user as any)?.classroomConnected || (user as any)?.classroom_connected)}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                  data-testid="button-sync-classrooms"
                >
                  <RefreshCw className={`h-4 w-4 ${syncClassroomsMutation.isPending ? 'animate-spin' : ''}`} />
                  {syncClassroomsMutation.isPending ? 'Syncing...' : 'Sync Classrooms'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Core Action - Upload */}
        <div className="mb-12">
          <Link href="/upload">
            <Card className="cursor-pointer hover:shadow-md transition-shadow border-2 border-dashed border-blue-200 hover:border-blue-300">
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Upload className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Upload Document</h2>
                  <p className="text-gray-600">Drop PDF or Word documents for AI analysis</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Documents */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Your Documents</h2>
            {(documents as DocumentResult[])?.length > 5 && (
              <Link href="/results">
                <Button variant="outline" size="sm">View All</Button>
              </Link>
            )}
          </div>

          {documentsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (documents as DocumentResult[])?.length > 0 ? (
            <div className="space-y-3">
              {(documents as DocumentResult[]).slice(0, 10).map((doc: DocumentResult) => (
                <Card key={doc.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">
                          {doc.fileName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {doc.status === 'processing' || doc.status === 'pending' ? (
                        <ProcessingStatus status={doc.status} />
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <RigorBadge level={doc.rigorLevel} />
                            <Badge variant="secondary">
                              {doc.standardsCount} standards
                            </Badge>
                          </div>
                          <div className="flex gap-2">
                            <Link href={`/results/${doc.id}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                            </Link>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleExport(doc.id, 'student-cover-sheet')}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Export
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-500">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">No documents yet</h3>
              <p className="mb-6">Upload your first document to get started</p>
              <Link href="/upload">
                <Button>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}