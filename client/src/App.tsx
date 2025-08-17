import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import GoogleOAuthLanding from "@/pages/google-oauth-landing";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import AuthError from "@/pages/auth-error";
import TraditionalLogin from "@/pages/traditional-login";
import UploadPage from "@/pages/upload";
import ResultsPage from "@/pages/results";
import DocumentResults from "@/pages/document-results";
import PromptConfig from "@/pages/prompt-config";

function Router() {
  const { user, isLoading, isAuthenticated } = useAuth();

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

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <>
          <Route path="/" component={GoogleOAuthLanding} />
          <Route path="/landing" component={Landing} />
          <Route path="/auth/login" component={TraditionalLogin} />
          <Route path="/auth/error" component={AuthError} />
          <Route component={NotFound} />
        </>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
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
