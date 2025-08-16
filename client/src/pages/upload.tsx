import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/Sidebar";
import { FileUploader } from "@/components/FileUploader";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";

export default function UploadPage() {
  const { toast } = useToast();
  const [customerId, setCustomerId] = useState("");
  const [jurisdictions, setJurisdictions] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (!customerId || !jurisdictions) {
      toast({
        title: "Missing Information",
        description: "Please provide customer ID and jurisdictions before uploading.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('document', file);
    formData.append('customerId', customerId);
    formData.append('jurisdictions', jurisdictions);
    if (callbackUrl) {
      formData.append('callbackUrl', callbackUrl);
    }

    try {
      const response = await fetch('/api/documents/upload', {
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
        description: `Document "${file.name}" uploaded and added to processing queue.`,
      });

      // Clear form
      setCustomerId("");
      setJurisdictions("");
      setCallbackUrl("");
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "There was an error uploading your document.",
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
                    <Label className="text-base font-medium">Document File</Label>
                    <div className="mt-2">
                      <FileUploader onFileUpload={handleFileUpload} />
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="customerId">Customer ID *</Label>
                      <Input
                        id="customerId"
                        type="number"
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
                        placeholder="e.g., California, Common Core, Texas"
                        value={jurisdictions}
                        onChange={(e) => setJurisdictions(e.target.value)}
                        className="mt-1"
                        required
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Comma-separated list (maximum 3 jurisdictions)
                      </p>
                    </div>
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
                </CardContent>
              </Card>

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
                      <li>• Documents are analyzed by 3 AI engines</li>
                      <li>• Average processing time: 2-4 minutes</li>
                      <li>• Results include standards identification</li>
                      <li>• DOK-based rigor level assessment</li>
                      <li>• Consensus voting for accuracy</li>
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
