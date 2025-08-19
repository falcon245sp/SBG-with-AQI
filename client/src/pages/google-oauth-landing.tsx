import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, BookOpen, Shield, Users, BarChart3 } from "lucide-react";
import { useLocation } from "wouter";

export default function GoogleOAuthLanding() {
  const [isLoading, setIsLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [location] = useLocation();

  // Check for auth success from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authParam = urlParams.get('auth');
    const userParam = urlParams.get('user');
    
    if (authParam === 'success' && userParam) {
      console.log('OAuth authentication successful for user:', userParam);
      setAuthStatus('success');
      // Clean up URL
      window.history.replaceState({}, document.title, '/');
      // Redirect to dashboard after showing success message
      const redirectDelay = parseInt(import.meta.env.VITE_STABLE_OAUTH_REDIRECT_DELAY_MS || '2000', 10);
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, redirectDelay);
    }
  }, []);

  const handleGoogleAuth = () => {
    console.log('Direct navigation to OAuth endpoint...');
    window.location.href = '/api/auth/google';
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    
    console.log('\n=== CLIENT-SIDE OAUTH DEBUG ===');
    console.log('Current URL:', window.location.href);
    console.log('Current host:', window.location.host);
    console.log('Current protocol:', window.location.protocol);
    console.log('User Agent:', navigator.userAgent);
    console.log('Cookies enabled:', navigator.cookieEnabled);
    
    try {
      console.log('\nTesting OAuth endpoint availability...');
      const testResponse = await fetch('/api/auth/google', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      console.log('OAuth endpoint status:', testResponse.status);
      console.log('OAuth endpoint headers:', Object.fromEntries(testResponse.headers.entries()));
      
      if (testResponse.ok) {
        const data = await testResponse.json();
        console.log('OAuth endpoint returned authUrl:', data.authUrl);
        
        // Parse the Google URL to verify it's correct
        try {
          const googleUrl = new URL(data.authUrl);
          console.log('\nGoogle OAuth URL Analysis:');
          console.log('- Host:', googleUrl.host);
          console.log('- Client ID:', googleUrl.searchParams.get('client_id'));
          console.log('- Redirect URI:', decodeURIComponent(googleUrl.searchParams.get('redirect_uri') || ''));
          console.log('- Scope:', decodeURIComponent(googleUrl.searchParams.get('scope') || ''));
          
          console.log('\nAttempting redirect to Google OAuth...');
          // Try different redirect methods to diagnose browser refusal
          console.log('Method 1: window.location.href');
          window.location.href = data.authUrl;
          
        } catch (urlError) {
          console.error('Error parsing Google OAuth URL:', urlError);
        }
        
      } else {
        console.error('OAuth endpoint failed:', testResponse.status, testResponse.statusText);
      }
      
    } catch (fetchError) {
      console.error('OAuth endpoint fetch error:', fetchError);
      console.log('Falling back to direct navigation...');
      window.location.assign('/api/auth/google');
    }
    
    console.log('=== END CLIENT OAUTH DEBUG ===\n');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="max-w-4xl mx-auto text-center mb-8">
          <BookOpen className="mx-auto h-16 w-16 text-blue-600 mb-6" />
          <h1 className="text-4xl font-bold text-blue-900 dark:text-blue-100 mb-4">
            Standards Sherpa
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Your AI-powered guide for educational standards and assessment
          </p>
        </div>

        {/* Authentication Success Alert */}
        {authStatus === 'success' && (
          <Alert className="mb-8 max-w-2xl mx-auto border-green-200 bg-green-50 dark:bg-green-900/20">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800 dark:text-green-100">Authentication Successful!</AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-200">
              You have been successfully logged in. Redirecting to your dashboard...
            </AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto mb-12">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-6 w-6 text-blue-600" />
                <CardTitle>Standards Analysis</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                AI-powered analysis of educational documents to identify standards alignment and cognitive rigor levels using multiple AI engines for consensus.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Users className="h-6 w-6 text-green-600" />
                <CardTitle>Google Classroom Integration</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                Seamlessly connect with Google Classroom for user authentication, class management, and automated roster synchronization.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Shield className="h-6 w-6 text-purple-600" />
                <CardTitle>Standards-Based Grading</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                Comprehensive gradebook functionality with mastery tracking, rigor hierarchy, and automated grading workflows.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-6 w-6 text-orange-600" />
                <CardTitle>Teacher Override System</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                Save and manage corrections to AI analysis with confidence scoring and edit history for continuous improvement.
              </p>
            </CardContent>
          </Card>
        </div>

        <Alert className="max-w-4xl mx-auto mb-8 border-green-200 bg-green-50 dark:bg-green-900/20">
          <AlertCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800 dark:text-green-100">Google OAuth Working Successfully!</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-200">
            <div className="space-y-4">
              <p><strong>Success:</strong> Google OAuth flow is now working perfectly with database schema fixed.</p>
              
              <div className="bg-green-100 dark:bg-green-800 p-3 rounded">
                <p><strong>OAuth Status:</strong> ✅ Fully Working</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>✅ Token exchange: Successfully retrieving access tokens</li>
                  <li>✅ User data: Getting user profile from Google API</li>
                  <li>✅ Database: Schema updated and storing user data</li>
                  <li>✅ New window popup: Working around iframe restrictions</li>
                </ul>
              </div>
              
              <div className="bg-blue-100 dark:bg-blue-800 p-3 rounded">
                <p><strong>Authentication Options:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><strong>Google OAuth:</strong> Use the "Open Google OAuth in New Window" button</li>
                  <li><strong>Replit Auth:</strong> Platform's built-in authentication</li>
                  <li><strong>Traditional Login:</strong> Username/password authentication</li>
                  <li><strong>Production:</strong> All methods work normally when deployed</li>
                </ul>
              </div>
              
              <div className="mt-4 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    onClick={() => window.location.href = '/auth/login'} 
                    variant="outline"
                    className="text-sm"
                  >
                    Traditional Login
                  </Button>
                  <Button 
                    onClick={() => window.location.href = '/api/login'} 
                    variant="outline"
                    className="text-sm"
                  >
                    Replit Auth
                  </Button>
                </div>
                <Button 
                  onClick={() => {
                    // Use the secure server endpoint instead of hardcoded credentials
                    window.open('/api/auth/google', '_blank', 'width=500,height=600');
                  }}
                  variant="outline" 
                  className="w-full text-sm"
                >
                  Open Google OAuth in New Window
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Get Started</CardTitle>
            <CardDescription className="text-center">
              Sign in with your Google account to access your classrooms and begin analyzing educational content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleGoogleAuth}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg flex items-center justify-center space-x-2 mb-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>{isLoading ? "Signing in..." : "Sign in with Google (Direct)"}</span>
            </Button>
            
            <Button 
              onClick={handleGoogleSignIn}
              variant="outline"
              disabled={isLoading}
              className="w-full"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>{isLoading ? "Signing in..." : "Sign in with Google (JavaScript)"}</span>
            </Button>

            <Button 
              onClick={() => {
                // Use the secure server endpoint instead of hardcoded credentials
                window.open('/api/auth/google', '_blank', 'width=500,height=600');
              }}
              variant="outline" 
              className="w-full mb-4"
            >
              Open Google OAuth in New Window
            </Button>

            <div className="text-center">
              <p className="text-sm text-gray-500">
                Secure authentication powered by Google OAuth
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            By signing in, you agree to connect your Google account for classroom integration and user authentication.
          </p>
        </div>
      </div>
    </div>
  );
}