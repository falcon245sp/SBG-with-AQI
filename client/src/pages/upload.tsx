import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/Sidebar";
import { FileUploader } from "@/components/FileUploader";
import { webServiceClient } from "@/lib/webServiceClient";
import { Upload, FileText, CheckCircle, AlertCircle, Clock } from "lucide-react";

export default function UploadPage() {
  const { toast } = useToast();
  // Use authenticated user data
  const { user } = useAuth();
  const customerId = (user as any)?.customerUuid || "";
  const [jurisdictions, setJurisdictions] = useState("Common Core");
  const [focusStandards, setFocusStandards] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [submittedJobs, setSubmittedJobs] = useState<Array<{
    jobId: string;
    fileName: string;
    status: string;
    estimatedCompletion: string;
  }>>([]);

  const handleFileUpload = async (files: File[]) => {
    console.log('=== FRONTEND UPLOAD DEBUG ===');
    console.log('Files received in handleFileUpload:', files.length);
    console.log('File names:', files.map(f => f.name));
    
    if (files.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Please select at least one file to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Parse jurisdictions and focus standards
      const jurisdictionList = jurisdictions.split(',').map(j => j.trim()).filter(Boolean);
      const focusStandardsList = focusStandards ? 
        focusStandards.split(',').map(s => s.trim()).filter(Boolean) : 
        undefined;

      // Submit to web service
      const result = await webServiceClient.submitDocuments({
        customerId,
        files,
        jurisdictions: jurisdictionList,
        focusStandards: focusStandardsList,
        callbackUrl: callbackUrl || undefined
      });
      
      // Add all jobs to submitted jobs list with initial "queued" status
      const newJobs = result.jobs.map((job, index) => ({
        jobId: job.jobId,
        fileName: job.fileName,
        status: index === 0 ? 'processing' : 'queued', // First file starts processing, others queued
        estimatedCompletion: job.estimatedCompletionTime
      }));
      
      setSubmittedJobs(prev => [...newJobs, ...prev]);
      
      // Simulate status updates for demo (in real app, this would come from polling)
      setTimeout(() => {
        setSubmittedJobs(prev => prev.map((job, index) => {
          if (index < newJobs.length && job.status === 'queued') {
            return { ...job, status: 'processing' };
          }
          return job;
        }));
      }, 2000 * (newJobs.findIndex(j => j.status === 'queued') + 1));
      
      const fileNames = files.map(f => f.name).join(', ');
      const successMessage = result.successfulSubmissions === files.length 
        ? `All ${files.length} documents submitted successfully`
        : `${result.successfulSubmissions} of ${files.length} documents submitted`;
        
      toast({
        title: "Documents Submitted",
        description: `${successMessage}. Files: ${fileNames}`,
      });
      
      if (result.errors && result.errors.length > 0) {
        const errorList = result.errors.map(e => `${e.fileName}: ${e.error}`).join('; ');
        toast({
          title: "Some Files Failed",
          description: `Errors: ${errorList}`,
          variant: "destructive",
        });
      }

      // Clear form
      setFocusStandards("");
      setCallbackUrl("");
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your documents for processing.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top Header */}
        <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow border-b border-slate-200">
          <div className="flex-1 px-4 flex justify-between items-center">
            <div className="flex-1 flex">
              <h2 className="text-2xl font-semibold text-slate-800">Upload Documents</h2>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
              
              {/* Upload Form */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Upload className="w-6 h-6 mr-2 text-blue-600" />
                    Document Upload
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    Upload educational documents for AI-powered standards analysis and rigor assessment
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* File Upload Area */}
                  <div>
                    <Label className="text-base font-medium">Document Files</Label>
                    <p className="text-sm text-slate-500 mb-2">
                      Select one or multiple files for processing
                    </p>
                    <div className="mt-2">
                      <FileUploader 
                        onFilesUpload={handleFileUpload}
                        multiple={true}
                      />
                    </div>
                  </div>

                  {/* User Configuration */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-sm font-medium text-blue-800">Current Configuration</span>
                    </div>
                    <div className="text-sm text-blue-700 space-y-2">
                      <p>Customer: {customerId || 'Not authenticated'}</p>
                      <div className="flex items-center space-x-2">
                        <span>Jurisdiction:</span>
                        <select 
                          value={jurisdictions} 
                          onChange={(e) => setJurisdictions(e.target.value)}
                          className="bg-white border border-blue-200 rounded px-2 py-1 text-xs"
                        >
                          <option value="Common Core">Common Core</option>
                          <option value="Texas TEKS">Texas TEKS</option>
                          <option value="California Standards">California Standards</option>
                          <option value="NGSS">NGSS</option>
                          <option value="Custom">Custom</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  {/* Form Fields */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="focusStandards">Focus Standards (Optional)</Label>
                      <Input
                        id="focusStandards"
                        placeholder="e.g., CCSS.MATH.HSA, NGSS.HS.PS1"
                        value={focusStandards}
                        onChange={(e) => setFocusStandards(e.target.value)}
                        className="mt-1"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Specific standards to focus analysis on (comma-separated)
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="callbackUrl">Callback URL (Optional)</Label>
                      <Input
                        id="callbackUrl"
                        type="url"
                        placeholder="https://your-domain.com/webhook/callback"
                        value={callbackUrl}
                        onChange={(e) => setCallbackUrl(e.target.value)}
                        className="mt-1"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        URL to receive processing completion notifications
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Submitted Jobs */}
              {submittedJobs.length > 0 && (
                <Card className="mb-8">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Clock className="w-5 h-5 mr-2 text-blue-600" />
                      Recently Submitted Jobs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {submittedJobs.slice(0, 5).map((job) => {
                        const getStatusDisplay = (status: string) => {
                          switch (status) {
                            case 'queued':
                              return {
                                className: 'bg-gray-100 text-gray-700',
                                text: 'Queued',
                                icon: <Clock className="w-3 h-3 mr-1" />
                              };
                            case 'processing':
                              return {
                                className: 'bg-blue-100 text-blue-800',
                                text: 'Processing',
                                icon: <div className="w-3 h-3 mr-1 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                              };
                            case 'completed':
                              return {
                                className: 'bg-green-100 text-green-800',
                                text: 'Completed',
                                icon: <CheckCircle className="w-3 h-3 mr-1" />
                              };
                            case 'failed':
                              return {
                                className: 'bg-red-100 text-red-800',
                                text: 'Failed',
                                icon: <AlertCircle className="w-3 h-3 mr-1" />
                              };
                            default:
                              return {
                                className: 'bg-gray-100 text-gray-700',
                                text: status,
                                icon: null
                              };
                          }
                        };
                        
                        const statusDisplay = getStatusDisplay(job.status);
                        
                        return (
                          <div key={job.jobId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{job.fileName}</p>
                              <p className="text-xs text-slate-500">Job ID: {job.jobId}</p>
                            </div>
                            <div className="text-right">
                              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${statusDisplay.className}`}>
                                {statusDisplay.icon}
                                {statusDisplay.text}
                              </div>
                              <p className="text-xs text-slate-500 mt-1">
                                Est: {new Date(job.estimatedCompletion).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Information Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <FileText className="w-5 h-5 mr-2 text-green-600" />
                      Supported Formats
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-slate-600">
                      <li className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        PDF Documents (.pdf)
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        Microsoft Word (.doc, .docx)
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        Google Docs (exported formats)
                      </li>
                    </ul>
                    <p className="text-xs text-slate-500 mt-3">
                      Maximum file size: 50MB
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <AlertCircle className="w-5 h-5 mr-2 text-amber-600" />
                      Processing Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-slate-600">
                      <li>• Documents processed via cloud-based AI service</li>
                      <li>• Average processing time: 2-4 minutes</li>
                      <li>• Job-based processing with status tracking</li>
                      <li>• Standards identification and rigor assessment</li>
                      <li>• Results available via API or UI polling</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
