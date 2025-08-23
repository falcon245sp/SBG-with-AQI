import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';

/**
 * OnboardingCheck - Determines user's next step after authentication
 * Routes users through the V1.0 progressive onboarding flow
 */
export default function OnboardingCheck() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading || !user) return;

    // Check onboarding completion status (handle both camelCase and snake_case)
    const userData = user as any;
    const onboardingCompleted = userData.onboardingCompleted || userData.onboarding_completed;
    const onboardingStep = userData.onboardingStep || userData.onboarding_step;
    const preferredJurisdiction = userData.preferredJurisdiction || userData.preferred_jurisdiction;
    const preferredSubjectAreas = userData.preferredSubjectAreas || userData.preferred_subject_areas;
    const selectedGradeLevels = userData.selectedGradeLevels || userData.selected_grade_levels;
    const selectedCourses = userData.selectedCourses || userData.selected_courses;
    const onboardingRoleSelected = userData.onboardingRoleSelected || userData.onboarding_role_selected;
    const selectedRole = userData.selectedRole || userData.selected_role;
    const standardsConfigurationCompleted = userData.standardsConfigurationCompleted || userData.standards_configuration_completed;

    console.log('[OnboardingCheck] User onboarding status:', {
      onboardingCompleted,
      onboardingStep,
      preferredJurisdiction,
      preferredSubjectAreas,
      selectedGradeLevels,
      selectedCourses,
      onboardingRoleSelected,
      selectedRole,
      standardsConfigurationCompleted
    });

    // If ALL onboarding is complete, go to dashboard
    if (onboardingCompleted && standardsConfigurationCompleted) {
      console.log('[OnboardingCheck] Complete onboarding finished, redirecting to dashboard');
      setLocation('/dashboard');
      return;
    }

    // Route user to their next onboarding step
    switch (onboardingStep) {
      case 'jurisdiction':
        setLocation('/onboarding/jurisdiction');
        break;
      case 'subject':
        setLocation('/onboarding/subject');
        break;
      case 'grades':
        setLocation('/onboarding/grades');
        break;
      case 'courses':
        setLocation('/onboarding/courses');
        break;
      case 'classroom':
        setLocation('/onboarding/classroom');
        break;
      case 'role-selection':
        setLocation('/onboarding/role-selection');
        break;
      case 'standards-configuration':
        setLocation('/onboarding/standards-configuration');
        break;
      default:
        // Start from the beginning
        console.log('[OnboardingCheck] Starting onboarding from jurisdiction step');
        setLocation('/onboarding/jurisdiction');
        break;
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Setting up your Standards Sherpa experience...</p>
        </div>
      </div>
    );
  }

  // Temporary debug display
  if (user) {
    const userData = user as any;
    const onboardingStep = userData.onboardingStep || userData.onboarding_step;
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold mb-4">🔍 Debug Info</h1>
          <div className="space-y-2 text-sm">
            <p><strong>Onboarding Step:</strong> {onboardingStep || 'null'}</p>
            <p><strong>Onboarding Completed:</strong> {String(userData.onboardingCompleted || userData.onboarding_completed)}</p>
            <p><strong>Standards Config Completed:</strong> {String(userData.standardsConfigurationCompleted || userData.standards_configuration_completed)}</p>
            <p><strong>Email:</strong> {userData.email}</p>
            <p><strong>Current URL:</strong> {window.location.pathname}</p>
            <p><strong>Should redirect to:</strong> {onboardingStep ? `/onboarding/${onboardingStep}` : '/onboarding/jurisdiction'}</p>
          </div>
          <div className="mt-4">
            <strong>Raw User Object:</strong>
            <pre className="bg-gray-100 p-2 rounded mt-2 overflow-auto text-xs">
              {JSON.stringify(user, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  return null;
}