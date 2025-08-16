import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/Sidebar";
import { FileUploader } from "@/components/FileUploader";
import { webServiceClient } from "@/lib/webServiceClient";
import { Upload, FileText, CheckCircle, AlertCircle, Clock } from "lucide-react";

export default function UploadPage() {
  const { toast } = useToast();
  const [customerId, setCustomerId] = useState("");
  const [jurisdictions, setJurisdictions] = useState("");
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
    if (!customerId || !jurisdictions) {
      toast({
        title: "Missing Information",
        description: "Please provide customer ID and jurisdictions before uploading.",
        variant: "destructive",
      });
      return;
    }
    
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
      
      // Add all jobs to submitted jobs list
      const newJobs = result.jobs.map(job => ({
        jobId: job.jobId,
        fileName: job.fileName,
        status: job.status,
        estimatedCompletion: job.estimatedCompletionTime
      }));
      
      setSubmittedJobs(prev => [...newJobs, ...prev]);
      
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
      setCustomerId("");
      setJurisdictions("");
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

                  {/* Form Fields */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="customerId">Customer ID *</Label>
                      <Input
                        id="customerId"
                        type="text"
                        placeholder="Enter customer ID"
                        value={customerId}
                        onChange={(e) => setCustomerId(e.target.value)}
                        className="mt-1"
                        required
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Unique identifier for the customer or organization
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="jurisdictions">Educational Jurisdictions *</Label>
                      <Input
                        id="jurisdictions"
                        placeholder="e.g., Common Core, NGSS, Texas TEKS"
                        value={jurisdictions}
                        onChange={(e) => setJurisdictions(e.target.value)}
                        className="mt-1"
                        required
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Comma-separated list (maximum 3 jurisdictions)
                      </p>
                    </div>
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
                      {submittedJobs.slice(0, 5).map((job) => (
                        <div key={job.jobId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{job.fileName}</p>
                            <p className="text-xs text-slate-500">Job ID: {job.jobId}</p>
                          </div>
                          <div className="text-right">
                            <div className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                              {job.status}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Est: {new Date(job.estimatedCompletion).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))}
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
