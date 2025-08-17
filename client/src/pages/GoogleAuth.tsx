import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, BookOpen, Users, School } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function GoogleAuth() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Check if user is already authenticated
  useEffect(() => {
    console.log('GoogleAuth - checking existing auth state');
    const existingGoogleId = localStorage.getItem('googleId');
    if (existingGoogleId) {
      console.log('GoogleAuth - found existing googleId, testing with API call');
      
      // Test authentication by making a simple API call
      fetch(`/api/auth/user?googleId=${existingGoogleId}`)
        .then(response => {
          console.log('GoogleAuth - API test response status:', response.status);
          if (response.status === 200) {
            // User is still authenticated, redirect to classroom setup
            console.log('GoogleAuth - user is authenticated, redirecting to classroom setup');
            setLocation('/auth/classroom-setup');
          } else if (response.status === 401) {
            // User needs to re-authenticate
            console.log('GoogleAuth - authentication expired, clearing localStorage');
            localStorage.removeItem('googleId');
            toast({
              title: "Session Expired",
              description: "Your session has expired. Please sign in again.",
              variant: "default",
            });
          } else {
            // Other error, clear localStorage
            console.log('GoogleAuth - unexpected response, clearing localStorage');
            localStorage.removeItem('googleId');
          }
        })
        .catch(error => {
          console.error('GoogleAuth - API test failed:', error);
          // On error, clear localStorage and stay on login page
          localStorage.removeItem('googleId');
        });
    }
  }, [setLocation, toast]);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/google');
      const data = await response.json();
      
      if (data.authUrl) {
        console.log('Redirecting to Google OAuth:', data.authUrl);
        // Try opening in a new tab first to test if it works
        const newWindow = window.open(data.authUrl, '_blank');
        if (newWindow) {
          // If popup works, redirect in same window
          setTimeout(() => {
            window.location.href = data.authUrl;
          }, 100);
        } else {
          // Direct redirect if popup blocked
          window.location.href = data.authUrl;
        }
      } else {
        throw new Error('Failed to get authorization URL');
      }
    } catch (error) {
      console.error('Google auth error:', error);
      toast({
        title: "Authentication Error",
        description: "Failed to start Google authentication. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Standards Sherpa
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Connect with Google Classroom
          </p>
        </div>

        {/* Authentication Card */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Get Started</CardTitle>
            <CardDescription>
              Sign in with Google to access your classrooms and student rosters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Features Preview */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <School className="h-4 w-4 text-blue-600" />
                <span>Access your Google Classroom courses</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <Users className="h-4 w-4 text-blue-600" />
                <span>Import student rosters automatically</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <BookOpen className="h-4 w-4 text-blue-600" />
                <span>Standards-based gradebook tracking</span>
              </div>
            </div>

            {/* Google Sign In Button */}
            <Button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>

            <div className="text-xs text-center text-gray-500 dark:text-gray-400">
              By continuing, you agree to connect your Google Classroom account
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}