import { useEffect } from 'react';
import { useLocation } from 'wouter';

export default function AuthCallback() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const startTime = Date.now();
    const callbackId = `callback-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    console.log(`[AuthCallback-${callbackId}] OAuth callback component mounted:`, {
      currentUrl: window.location.href,
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      referrer: document.referrer,
      sessionStorageKeys: Object.keys(sessionStorage),
      localStorageKeys: Object.keys(localStorage),
      cookiesEnabled: navigator.cookieEnabled,
      timestamp: new Date().toISOString()
    });
    
    // The backend OAuth callback sets the session, just redirect to classroom setup
    // No need to handle URL parameters or localStorage anymore
    setTimeout(() => {
      console.log(`[AuthCallback-${callbackId}] Redirecting to classroom setup:`, {
        processingTime: Date.now() - startTime,
        targetUrl: '/auth/classroom-setup',
        timestamp: new Date().toISOString()
      });
      setLocation('/auth/classroom-setup');
    }, 100);
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
