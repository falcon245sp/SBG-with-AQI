import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ExternalLink, CheckCircle, AlertCircle, BookOpen } from "lucide-react";
import { User } from "@/../../shared/schema";

export default function GoogleClassroomSetup() {
  const [apiKey, setApiKey] = useState("");
  const [serviceAccount, setServiceAccount] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const connectMutation = useMutation({
    mutationFn: async (data: { credentials: any }) => {
      return apiRequest('POST', '/api/google/connect', data);
    },
    onSuccess: () => {
      toast({
        title: "Google Classroom Connected",
        description: "Successfully connected to Google Classroom API",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to Google Classroom",
        variant: "destructive",
      });
    },
  });

  const handleApiKeyConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      toast({
        title: "Missing API Key",
        description: "Please enter your Google API key",
        variant: "destructive",
      });
      return;
    }
    
    connectMutation.mutate({
      credentials: { api_key: apiKey.trim() }
    });
  };

  const handleServiceAccountConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceAccount.trim()) {
      toast({
        title: "Missing Service Account",
        description: "Please paste your service account JSON",
        variant: "destructive",
      });
      return;
    }

    try {
      const credentials = JSON.parse(serviceAccount);
      connectMutation.mutate({ credentials });
    } catch (error) {
      toast({
        title: "Invalid JSON",
        description: "Please check your service account JSON format",
        variant: "destructive",
      });
    }
  };

  const isConnected = user?.classroomConnected;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <BookOpen className="mx-auto h-16 w-16 text-blue-600 mb-4" />
          <h1 className="text-3xl font-bold text-blue-900 dark:text-blue-100 mb-2">
            Google Classroom Integration
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Connect your Google Classroom to import classes and students
          </p>
        </div>

        {isConnected ? (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <CardTitle className="text-green-800">Google Classroom Connected</CardTitle>
              </div>
              <CardDescription>
                Your Google Classroom is successfully connected and ready to use.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => window.location.href = '/classrooms'}
                className="w-full"
              >
                View My Classrooms
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Alert className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Production-Ready Authentication</AlertTitle>
              <AlertDescription>
                Standards Sherpa uses secure service-to-service Google API authentication, avoiding OAuth redirect issues that prevent reliable production deployment.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle>Connect Google Classroom</CardTitle>
                <CardDescription>
                  Choose your preferred method to connect Google Classroom API
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="apikey" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="apikey">API Key</TabsTrigger>
                    <TabsTrigger value="serviceaccount">Service Account</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="apikey" className="space-y-4">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Google API Key Setup</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                          This method uses your Google API key for read-only access to Classroom data.
                        </p>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
                          <h4 className="font-medium mb-2">Setup Instructions:</h4>
                          <ol className="list-decimal list-inside space-y-1 text-sm">
                            <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center">Google Cloud Console <ExternalLink className="h-3 w-3 ml-1" /></a></li>
                            <li>Create or select a project</li>
                            <li>Enable the Google Classroom API</li>
                            <li>Go to Credentials → Create credentials → API key</li>
                            <li>Restrict the key to Google Classroom API</li>
                            <li>Copy the API key and paste it below</li>
                          </ol>
                        </div>
                      </div>
                      
                      <form onSubmit={handleApiKeyConnect} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="apikey">Google API Key</Label>
                          <Input
                            id="apikey"
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="AIzaSyD..."
                            required
                          />
                        </div>
                        <Button 
                          type="submit" 
                          className="w-full"
                          disabled={connectMutation.isPending}
                        >
                          {connectMutation.isPending ? "Connecting..." : "Connect with API Key"}
                        </Button>
                      </form>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="serviceaccount" className="space-y-4">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Service Account Setup</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                          This method uses a service account for full API access (recommended for production).
                        </p>
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg mb-4">
                          <h4 className="font-medium mb-2">Setup Instructions:</h4>
                          <ol className="list-decimal list-inside space-y-1 text-sm">
                            <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center">Google Cloud Console <ExternalLink className="h-3 w-3 ml-1" /></a></li>
                            <li>Create or select a project</li>
                            <li>Enable the Google Classroom API</li>
                            <li>Go to Credentials → Create credentials → Service account</li>
                            <li>Download the JSON key file</li>
                            <li>Copy the entire JSON content and paste it below</li>
                          </ol>
                        </div>
                      </div>
                      
                      <form onSubmit={handleServiceAccountConnect} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="serviceaccount">Service Account JSON</Label>
                          <Textarea
                            id="serviceaccount"
                            value={serviceAccount}
                            onChange={(e) => setServiceAccount(e.target.value)}
                            placeholder="Paste your complete service account JSON file contents here"
                            rows={8}
                            required
                          />
                          <p className="text-xs text-gray-500">
                            Paste the entire contents of your service account JSON file
                          </p>
                        </div>
                        <Button 
                          type="submit" 
                          className="w-full"
                          disabled={connectMutation.isPending}
                        >
                          {connectMutation.isPending ? "Connecting..." : "Connect with Service Account"}
                        </Button>
                      </form>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </>
        )}

        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Why This Approach?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>• <strong>Production Ready:</strong> Works reliably in any deployment environment</p>
              <p>• <strong>No OAuth Issues:</strong> Avoids redirect URL problems that break in production</p>
              <p>• <strong>Secure:</strong> Credentials stored securely in your database</p>
              <p>• <strong>Flexible:</strong> Choose between API key or service account based on your needs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What You Get</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>• <strong>Class Import:</strong> Automatically sync your Google Classroom classes</p>
              <p>• <strong>Student Rosters:</strong> Import student lists with photos and emails</p>
              <p>• <strong>Assignment Distribution:</strong> Share assessments directly to classes</p>
              <p>• <strong>Grade Integration:</strong> Sync results back to Google Classroom</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}