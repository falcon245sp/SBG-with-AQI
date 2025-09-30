import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function AuthError() {
  const [, setLocation] = useLocation();
  
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');
  const description = urlParams.get('description');

  const getErrorMessage = () => {
    switch (error) {
      case 'oauth_error':
        return 'Google OAuth authentication failed. Please try again.';
      case 'no_code':
        return 'No authorization code received from Google. Please try again.';
      case 'auth_failed':
        return 'Authentication process failed. Please try again.';
      case 'access_denied':
        return 'Access was denied. You need to grant permissions to continue.';
      default:
        return description || 'An unknown authentication error occurred.';
    }
  };

  const handleRetry = () => {
    setLocation('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <CardTitle className="text-red-800">Authentication Error</CardTitle>
          </div>
          <CardDescription>
            There was a problem with the Google OAuth authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Details</AlertTitle>
            <AlertDescription>
              {getErrorMessage()}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Button 
              onClick={handleRetry}
              className="w-full"
              variant="default"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            
            <div className="text-center">
              <p className="text-sm text-gray-500">
                If this problem persists, please contact support
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}