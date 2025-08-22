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

    // Check onboarding completion status
    const { 
      onboardingCompleted, 
      onboardingStep,
      preferredJurisdiction,
      preferredSubjectAreas,
      selectedGradeLevels 
    } = user as any;

    console.log('[OnboardingCheck] User onboarding status:', {
      onboardingCompleted,
      onboardingStep,
      preferredJurisdiction,
      preferredSubjectAreas,
      selectedGradeLevels
    });

    // Skip onboarding entirely - go directly to role selection
    console.log('[OnboardingCheck] Skipping onboarding, redirecting to role selection');
    setLocation('/role-selection');
    return;

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