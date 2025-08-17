import { useEffect } from 'react';
import { useLocation } from 'wouter';

export default function AuthCallback() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Extract Google ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const googleId = urlParams.get('googleId');

    if (googleId) {
      // Store Google ID in localStorage for subsequent API calls
      localStorage.setItem('googleId', googleId);
      // Redirect to classroom setup
      setLocation('/auth/classroom-setup');
    } else {
      // If no Google ID, redirect to login
      setLocation('/');
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