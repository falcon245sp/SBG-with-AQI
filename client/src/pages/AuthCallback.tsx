import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Extract parameters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const googleId = urlParams.get('googleId');
    const errorParam = urlParams.get('error');

    console.log('AuthCallback - googleId from URL:', googleId);
    console.log('AuthCallback - error from URL:', errorParam);

    if (errorParam) {
      console.error('OAuth callback error:', errorParam);
      setError(errorParam);
      // Stay on this page to show error, don't redirect
      return;
    }

    if (googleId) {
      // Store Google ID in localStorage for subsequent API calls
      localStorage.setItem('googleId', googleId);
      console.log('AuthCallback - stored googleId, redirecting to classroom setup');
      // Redirect to classroom setup
      setLocation('/auth/classroom-setup');
    } else {
      console.log('AuthCallback - no googleId, checking existing auth state');
      // Check if user is already authenticated
      const existingGoogleId = localStorage.getItem('googleId');
      if (existingGoogleId) {
        console.log('AuthCallback - found existing googleId, redirecting to classroom setup');
        setLocation('/auth/classroom-setup');
      } else {
        console.log('AuthCallback - no auth state, redirecting to login');
        setLocation('/');
      }
    }
  }, [setLocation]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-100 dark:bg-red-900 rounded-lg p-6 mb-4">
            <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
              Authentication Error
            </h2>
            <p className="text-red-700 dark:text-red-300 mb-4">
              {error === 'access_denied' && 'You cancelled the authentication process.'}
              {error === 'no_code' && 'No authorization code received from Google.'}
              {error === 'no_access_token' && 'Failed to obtain access token.'}
              {error === 'no_user_info' && 'Failed to obtain user information.'}
              {error === 'authentication_failed' && 'Authentication process failed.'}
              {!['access_denied', 'no_code', 'no_access_token', 'no_user_info', 'authentication_failed'].includes(error) && 
                `An error occurred: ${error}`}
            </p>
            <button
              onClick={() => setLocation('/')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-300">Completing authentication...</p>
      </div>
    </div>
  );
}