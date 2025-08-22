import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import GoogleOAuthLanding from "@/pages/google-oauth-landing";
import Landing from "@/pages/landing";
import RoleSelection from "@/pages/role-selection";
import CustomerDashboard from "@/pages/customer-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import AuthError from "@/pages/auth-error";
import TraditionalLogin from "@/pages/traditional-login";
import OnboardingCheck from "@/components/OnboardingCheck";
import OnboardingJurisdiction from "@/pages/onboarding/OnboardingJurisdiction";
import OnboardingSubject from "@/pages/onboarding/OnboardingSubject";
import OnboardingGrades from "@/pages/onboarding/OnboardingGrades";
import OnboardingCourses from "@/pages/onboarding/OnboardingCourses";
import OnboardingClassroom from "@/pages/onboarding/OnboardingClassroom";
import UploadPage from "@/pages/upload";
import ResultsPage from "@/pages/results";
import DocumentResults from "@/pages/document-results";
import PromptConfig from "@/pages/prompt-config";
import FileCabinet from "@/pages/file-cabinet";
import DocumentInspector from "@/pages/document-inspector";
import TestingDashboard from "@/pages/testing-dashboard";
import GoogleClassroomIntegration from "@/pages/google-classroom-integration";

// Protected Route wrapper that redirects to landing page if not authenticated
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  
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
  
  if (!isAuthenticated) {
    // Redirect to landing page
    window.location.href = '/';
    return null;
  }

  // Check if user needs onboarding (except for onboarding routes and role selection)
  const currentPath = window.location.pathname;
  const isOnboardingRoute = currentPath.startsWith('/onboarding') || currentPath === '/role-selection';
  
  if (!isOnboardingRoute && user) {
    const userData = user as any;
    const onboardingCompleted = userData.onboardingCompleted || userData.onboarding_completed;
    
    console.log('[ProtectedRoute] Checking onboarding status:', { currentPath, onboardingCompleted });
    
    if (!onboardingCompleted) {
      console.log('[ProtectedRoute] Onboarding required, redirecting...');
      window.location.href = '/onboarding';
      return null;
    }
  }
  
  return <Component />;
}

function Router() {
  const { isLoading } = useAuth();

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
      {/* Public routes - always accessible */}
      <Route path="/" component={GoogleOAuthLanding} />
      <Route path="/landing" component={GoogleOAuthLanding} />
      <Route path="/auth/login" component={TraditionalLogin} />
      <Route path="/auth/error" component={AuthError} />
      <Route path="/testing-dashboard" component={TestingDashboard} />
      
      {/* Protected routes - require authentication */}
      <Route path="/onboarding" component={() => <ProtectedRoute component={OnboardingCheck} />} />
      <Route path="/onboarding/jurisdiction" component={() => <ProtectedRoute component={OnboardingJurisdiction} />} />
      <Route path="/onboarding/subject" component={() => <ProtectedRoute component={OnboardingSubject} />} />
      <Route path="/onboarding/grades" component={() => <ProtectedRoute component={OnboardingGrades} />} />
      <Route path="/onboarding/courses" component={() => <ProtectedRoute component={OnboardingCourses} />} />
      <Route path="/onboarding/classroom" component={() => <ProtectedRoute component={OnboardingClassroom} />} />
      <Route path="/role-selection" component={() => <ProtectedRoute component={RoleSelection} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={CustomerDashboard} />} />
      <Route path="/admin" component={() => <ProtectedRoute component={AdminDashboard} />} />
      <Route path="/upload" component={() => <ProtectedRoute component={UploadPage} />} />
      <Route path="/results" component={() => <ProtectedRoute component={ResultsPage} />} />
      <Route path="/results/:id" component={() => <ProtectedRoute component={DocumentResults} />} />
      <Route path="/prompt-config" component={() => <ProtectedRoute component={PromptConfig} />} />
      <Route path="/file-cabinet" component={() => <ProtectedRoute component={FileCabinet} />} />
      <Route path="/documents/:documentId/inspect" component={() => <ProtectedRoute component={DocumentInspector} />} />
      <Route path="/google-classroom" component={() => <ProtectedRoute component={GoogleClassroomIntegration} />} />
      
      {/* Default catch-all */}
      <Route component={NotFound} />
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
