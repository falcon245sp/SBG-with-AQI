import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import NotFound from "@/pages/not-found";
import GoogleAuth from "@/pages/GoogleAuth";
import AuthCallback from "@/pages/AuthCallback";
import AuthError from "@/pages/AuthError";
import ClassroomSetup from "@/pages/ClassroomSetup";
import Dashboard from "@/pages/dashboard";
import UploadPage from "@/pages/upload";
import ResultsPage from "@/pages/results";
import DocumentResults from "@/pages/document-results";
import PromptConfig from "@/pages/prompt-config";

function Router() {
  // Simple authentication check - if googleId exists in localStorage, user is authenticated
  const [googleId, setGoogleId] = useState<string | null>(() => localStorage.getItem('googleId'));
  const [isLoading, setIsLoading] = useState(false);
  
  // Listen for storage changes to update authentication state
  useEffect(() => {
    const handleStorageChange = () => {
      setGoogleId(localStorage.getItem('googleId'));
    };
    
    window.addEventListener('storage', handleStorageChange);
    // Also check for direct localStorage changes
    const interval = setInterval(handleStorageChange, 100);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);
  
  const isAuthenticated = !!googleId;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  // Always show callback and error routes regardless of auth state to handle OAuth returns
  return (
    <Switch>
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/auth/error" component={AuthError} />
      {!isAuthenticated ? (
        <Route component={GoogleAuth} />
      ) : (
        <>
          <Route path="/auth/classroom-setup" component={ClassroomSetup} />
          <Route path="/" component={Dashboard} />
          <Route path="/upload" component={UploadPage} />
          <Route path="/results" component={ResultsPage} />
          <Route path="/results/:id" component={DocumentResults} />
          <Route path="/prompt-config" component={PromptConfig} />
          <Route component={NotFound} />
        </>
      )}
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
