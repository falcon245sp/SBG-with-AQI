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

    console.log('[OnboardingCheck] User onboarding status:', {
      onboardingCompleted,
      onboardingStep,
      preferredJurisdiction,
      preferredSubjectAreas,
      selectedGradeLevels
    });
    console.log('[OnboardingCheck] Raw user data:', userData);

    // If onboarding is complete, go to dashboard (since role is already selected)
    if (onboardingCompleted) {
      console.log('[OnboardingCheck] Onboarding complete, redirecting to dashboard');
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