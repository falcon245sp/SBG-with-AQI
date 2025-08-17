import { useEffect } from 'react';
import { useLocation } from 'wouter';

export default function AuthCallback() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Extract Google ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const googleId = urlParams.get('googleId');

    console.log('AuthCallback - googleId from URL:', googleId);

    if (googleId) {
      // Store Google ID in localStorage for subsequent API calls
      localStorage.setItem('googleId', googleId);
      console.log('AuthCallback - stored googleId, redirecting to classroom setup');
      // Redirect to classroom setup
      setLocation('/auth/classroom-setup');
    } else {
      console.log('AuthCallback - no googleId, checking existing auth state');
      // Check if user is already authenticated with token refresh
      const existingGoogleId = localStorage.getItem('googleId');
      if (existingGoogleId) {
        console.log('AuthCallback - found existing googleId, checking auth status with server');
        
        fetch(`/api/auth/status?googleId=${existingGoogleId}`)
          .then(response => response.json())
          .then(data => {
            console.log('AuthCallback - auth status check result:', data);
            
            if (data.authenticated) {
              console.log('AuthCallback - user authenticated, redirecting to classroom setup');
              setLocation('/auth/classroom-setup');
            } else {
              console.log('AuthCallback - not authenticated, redirecting to login');
              localStorage.removeItem('googleId');
              setLocation('/');
            }
          })
          .catch(error => {
            console.error('AuthCallback - auth status check failed:', error);
            localStorage.removeItem('googleId');
            setLocation('/');
          });
      } else {
        console.log('AuthCallback - no auth state, redirecting to login');
        setLocation('/');
      }
    }
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-300">Completing authentication...</p>
      </div>
    </div>
  );
}