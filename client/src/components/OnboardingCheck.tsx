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

  console.log('🟡 [ONBOARDING-STEP-0] OnboardingCheck component mounted');
  console.log('🟡 [ONBOARDING-STEP-0] User loading status:', isLoading);
  console.log('🟡 [ONBOARDING-STEP-0] User data:', user);

  useEffect(() => {
    console.log('🟡 [ONBOARDING-STEP-0] useEffect triggered - isLoading:', isLoading, 'user:', !!user);
    if (isLoading) {
      console.log('🟡 [ONBOARDING-STEP-0] Still loading, waiting...');
      return;
    }
    if (!user) {
      console.log('🟡 [ONBOARDING-STEP-0] No user found, waiting for authentication...');
      return;
    }
    console.log('🟡 [ONBOARDING-STEP-0] Processing user onboarding status...');

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
    console.log('🟡 [ONBOARDING-STEP-0] Routing user based on onboardingStep:', onboardingStep);
    switch (onboardingStep) {
      case 'jurisdiction':
        console.log('🟡 [ONBOARDING-STEP-0] → Redirecting to jurisdiction selection');
        setLocation('/onboarding/jurisdiction');
        break;
      case 'subject':
        console.log('🟡 [ONBOARDING-STEP-0] → Redirecting to subject selection');
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

  return null;
}