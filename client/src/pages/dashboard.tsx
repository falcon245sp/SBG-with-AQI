import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/Sidebar";
import { FileUploader } from "@/components/FileUploader";
import { RigorBadge } from "@/components/RigorBadge";
import { ProcessingStatus } from "@/components/ProcessingStatus";
import { 
  FileText, 
  Brain, 
  GraduationCap, 
  Clock,
  Bell,
  ArrowRight,
  Upload,
  CheckCircle,
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
  aiConsensus: {
    chatgpt: boolean;
    grok: boolean;
    claude: boolean;
  };
}

export default function Dashboard() {
  const { toast } = useToast();
  const [customerId, setCustomerId] = useState("");
  const [jurisdictions, setJurisdictions] = useState("");
  const [useFocusStandards, setUseFocusStandards] = useState(false);
  const [focusStandards, setFocusStandards] = useState("");

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/stats"],
  });

  // Fetch recent documents
  const { data: documents, isLoading: documentsLoading } = useQuery<any[]>({
    queryKey: ["/api/documents"],
  });

  // No need to fetch templates anymore - using direct input

  const handleFileUpload = async (file: File) => {
    if (!customerId || !jurisdictions) {
      toast({
        title: "Missing Information",
        description: "Please provide customer ID and jurisdictions before uploading.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('document', file);
    formData.append('customerId', customerId);
    formData.append('jurisdictions', jurisdictions);

    // Add focus standards if specified
    if (useFocusStandards && focusStandards.trim()) {
      formData.append('focusStandards', focusStandards);
    }

    try {
      const endpoint = useFocusStandards ? '/api/documents/upload-with-standards' : '/api/documents/upload';
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      toast({
        title: "Upload Successful",
        description: useFocusStandards 
          ? "Document uploaded with focus standards configuration."
          : "Document uploaded and added to processing queue.",
      });

      // Refresh documents list
      window.location.reload();
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "There was an error uploading your document.",
        variant: "destructive",
      });
    }
  };

  if (statsLoading || documentsLoading) {
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
              <h2 className="text-2xl font-semibold text-slate-800">Dashboard Overview</h2>
            </div>
            <div className="ml-4 flex items-center md:ml-6 space-x-4">
              {/* Notifications */}
              <button className="bg-white p-1 rounded-full text-slate-400 hover:text-slate-500 relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400"></span>
              </button>
              
              {/* API Status */}
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                <span className="text-sm text-slate-600">API Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Dashboard Content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              
              {/* Stats Cards */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Upload className="w-8 h-8 text-blue-500" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-slate-500 truncate">Documents Processed</dt>
                          <dd className="text-3xl font-semibold text-slate-900">
                            {stats?.documentsProcessed || 0}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Brain className="w-8 h-8 text-purple-500" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-slate-500 truncate">AI Analyses</dt>
                          <dd className="text-3xl font-semibold text-slate-900">
                            {stats?.aiAnalyses || 0}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <GraduationCap className="w-8 h-8 text-green-500" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-slate-500 truncate">Standards Identified</dt>
                          <dd className="text-3xl font-semibold text-slate-900">
                            {stats?.standardsIdentified || 0}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Clock className="w-8 h-8 text-amber-500" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-slate-500 truncate">Avg Processing Time</dt>
                          <dd className="text-3xl font-semibold text-slate-900">
                            {stats?.avgProcessingTime || "N/A"}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Document Upload Section */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Upload New Documents</CardTitle>
                  <p className="text-sm text-slate-500">Process educational documents for standards analysis and rigor assessment</p>
                </CardHeader>
                <CardContent>
                  <FileUploader onFileUpload={handleFileUpload} />

                  {/* Customer ID and Jurisdiction Input */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    <div>
                      <Label htmlFor="customerId">Customer ID</Label>
                      <Input
                        id="customerId"
                        type="number"
                        placeholder="Enter customer ID"
                        value={customerId}
                        onChange={(e) => setCustomerId(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="jurisdictions">Educational Jurisdictions (max 3)</Label>
                      <Input
                        id="jurisdictions"
                        placeholder="e.g., California, Common Core, Texas"
                        value={jurisdictions}
                        onChange={(e) => setJurisdictions(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Focus Standards Configuration */}
                  <div className="border-t pt-6 mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <Settings className="w-5 h-5 text-blue-600" />
                        <div>
                          <Label htmlFor="useFocusStandards" className="text-base font-medium">Focus Standards Analysis</Label>
                          <p className="text-sm text-slate-500">Specify educational standards to prioritize during analysis</p>
                        </div>
                      </div>
                      <Switch
                        id="useFocusStandards"
                        checked={useFocusStandards}
                        onCheckedChange={setUseFocusStandards}
                      />
                    </div>
                    
                    {useFocusStandards && (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="focusStandards">Educational Standards (comma-separated)</Label>
                          <Input
                            id="focusStandards"
                            placeholder="e.g., CCSS.MATH.HSA.REI.A.1, CCSS.MATH.HSF.IF.A.1, NGSS.HS-PS1-1"
                            value={focusStandards}
                            onChange={(e) => setFocusStandards(e.target.value)}
                            className="mt-1"
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            Enter specific educational standards you want the AI to prioritize. The analysis will give special attention to identifying alignment with these standards.
                          </p>
                        </div>
                        
                        {focusStandards.trim() && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 className="font-medium text-blue-900 mb-2">Standards Preview:</h4>
                            <div className="flex flex-wrap gap-2">
                              {focusStandards.split(',').map((standard, index) => (
                                <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                                  {standard.trim()}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Processing Results */}
              <Card className="mb-8">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Recent Processing Results</CardTitle>
                    <p className="text-sm text-slate-500">Latest document analysis results with AI consensus</p>
                  </div>
                  <Button variant="outline" size="sm">
                    View All Results <ArrowRight className="ml-1 w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {documents && documents.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Document</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Created</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {documents.slice(0, 5).map((doc: any) => (
                            <tr key={doc.id} className="hover:bg-slate-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <FileText className="w-5 h-5 text-blue-500 mr-3" />
                                  <div>
                                    <div className="text-sm font-medium text-slate-900">{doc.fileName}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <ProcessingStatus status={doc.status} />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                {new Date(doc.createdAt).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="mx-auto h-12 w-12 text-slate-400" />
                      <h3 className="mt-2 text-sm font-medium text-slate-900">No documents yet</h3>
                      <p className="mt-1 text-sm text-slate-500">Get started by uploading your first document.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Rigor Level Distribution */}
              {stats?.rigorDistribution && (
                <Card>
                  <CardHeader>
                    <CardTitle>Rigor Level Distribution</CardTitle>
                    <p className="text-sm text-slate-500">Analysis of DOK levels across processed documents</p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                          <span className="text-2xl">🍃</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900">{stats.rigorDistribution.mild}</div>
                        <div className="text-sm text-slate-500">Mild (DOK 1-2)</div>
                        <div className="text-xs text-green-600 font-medium">Basic recall & application</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                          <span className="text-2xl">🌶️</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900">{stats.rigorDistribution.medium}</div>
                        <div className="text-sm text-slate-500">Medium (DOK 2-3)</div>
                        <div className="text-xs text-amber-600 font-medium">Analysis & reasoning</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                          <span className="text-2xl">🔥</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900">{stats.rigorDistribution.spicy}</div>
                        <div className="text-sm text-slate-500">Spicy (DOK 3-4)</div>
                        <div className="text-xs text-red-600 font-medium">Synthesis & evaluation</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
