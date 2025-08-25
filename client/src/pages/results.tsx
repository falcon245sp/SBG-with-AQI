import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/Sidebar";
import { useToast } from "@/hooks/use-toast";
import { RigorBadge } from "@/components/RigorBadge";
import { ProcessingStatus } from "@/components/ProcessingStatus";
import { 
  Search, 
  Filter, 
  FileText, 
  Eye,
  Calendar,
  Brain,
  GraduationCap
} from "lucide-react";

export default function ResultsPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rigorFilter, setRigorFilter] = useState("all");

  // Fetch documents with live polling for processing documents
  const { data: documents, isLoading } = useQuery<any[]>({
    queryKey: ["/api/documents"],
    refetchInterval: (query) => {
      // Poll every 2 seconds if there are any processing documents
      const hasProcessingDocs = query.state.data?.some((doc: any) => 
        doc.status === 'processing' || 
        doc.status === 'pending' ||
        doc.teacherReviewStatus === 'not_reviewed'
      );
      return hasProcessingDocs ? 2000 : false;
    },
    refetchIntervalInBackground: true,
    staleTime: 0, // Always refetch to ensure fresh status
  });

  // Fetch queue status
  const { data: queueStatus, error: queueError } = useQuery<any>({
    queryKey: ["/api/queue"],
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
  });

  // Queue status available for UI

  const filteredDocuments = documents?.filter((doc: any) => {
    const matchesSearch = doc.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    // For rigor filter, we'd need to fetch individual results - simplified for now
    return matchesSearch && matchesStatus;
  }) || [];

  const formatProcessingTime = (start: string, end: string) => {
    if (!start || !end) return "N/A";
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };










  if (isLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top Header */}
        <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow border-b border-slate-200">
          <div className="flex-1 px-4 flex justify-between items-center">
            <div className="flex-1 flex">
              <h2 className="text-2xl font-semibold text-slate-800">Processing Results</h2>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              
              {/* Queue Status Card */}
              {queueStatus?.queueSize > 0 && (
                <Card className="mb-6 border-blue-200 bg-blue-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                          <span className="font-medium text-blue-800">Processing Queue</span>
                        </div>
                        <Badge variant="outline" className="text-blue-700 border-blue-300">
                          {queueStatus.queueSize} files queued
                        </Badge>
                      </div>
                      <div className="text-sm text-blue-600">
                        Processor: {queueStatus.processor?.isProcessing ? 'Active' : 'Idle'}
                      </div>
                    </div>
                    {queueStatus.items?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm text-blue-700 mb-2">Files in queue:</p>
                        <div className="flex flex-wrap gap-2">
                          {queueStatus.items.slice(0, 5).map((item: any, index: number) => (
                            <Badge key={item.id} variant="outline" className="text-xs text-blue-600 border-blue-200">
                              {item.document?.fileName || `Document ${index + 1}`}
                            </Badge>
                          ))}
                          {queueStatus.items.length > 5 && (
                            <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">
                              +{queueStatus.items.length - 5} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Search and Filters */}
              <Card className="mb-8">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <Input
                          placeholder="Search documents..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                      >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="completed">Completed</option>
                        <option value="failed">Failed</option>
                      </select>
                      
                      <select 
                        value={rigorFilter}
                        onChange={(e) => setRigorFilter(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                      >
                        <option value="all">All Rigor</option>
                        <option value="mild">Mild</option>
                        <option value="medium">Medium</option>
                        <option value="spicy">Spicy</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Results Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Document Processing History</CardTitle>
                  <p className="text-sm text-slate-500">
                    Complete history of all processed documents with detailed analysis results
                  </p>
                </CardHeader>
                <CardContent>
                  {filteredDocuments.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Document
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Created
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              View Analysis
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {filteredDocuments.map((doc: any) => (
                            <tr key={doc.id} className="hover:bg-slate-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <FileText className="w-5 h-5 text-blue-500 mr-3" />
                                  <div>
                                    <div className="text-sm font-medium text-slate-900">
                                      {doc.fileName}
                                    </div>
                                    <div className="text-sm text-slate-500">
                                      {(doc.fileSize / 1024 / 1024).toFixed(1)} MB
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <ProcessingStatus status={doc.status} />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                <div className="flex items-center">
                                  <Calendar className="w-4 h-4 mr-1" />
                                  {new Date(doc.createdAt).toLocaleDateString()}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {new Date(doc.createdAt).toLocaleTimeString()}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                {doc.status === 'completed' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      if (doc.assetType === 'generated') {
                                        // Generated documents (PDFs) -> view document directly
                                        window.location.href = `/documents/${doc.id}/inspect`;
                                      } else {
                                        // Uploaded documents -> view analysis results
                                        window.location.href = `/results/${doc.id}`;
                                      }
                                    }}
                                  >
                                    <Eye className="w-4 h-4 mr-1" />
                                    {doc.assetType === 'generated' ? 'View' : 'View Analysis'}
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Brain className="mx-auto h-12 w-12 text-slate-400" />
                      <h3 className="mt-2 text-sm font-medium text-slate-900">No results found</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {searchTerm || statusFilter !== "all" || rigorFilter !== "all"
                          ? "Try adjusting your search criteria."
                          : "Upload documents to see processing results here."}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
