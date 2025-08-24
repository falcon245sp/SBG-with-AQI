import { useState } from 'react';
import * as React from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Calculator, ChevronRight, ChevronLeft, Microscope, Globe, Monitor, Languages, Heart, Palette, Wrench, HelpCircle } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { SubjectArea, StandardsJurisdiction } from "@shared/businessEnums";

// Dynamic subject interface for API-based subjects
interface APISubject {
  id: string;
  title: string;
  description: string;
}

interface SubjectAreaUI {
  id: SubjectArea;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

// Map subject titles to icons and colors
const getSubjectIcon = (title: string) => {
  const titleLower = title.toLowerCase();
  if (titleLower.includes('math')) return { icon: <Calculator className="h-8 w-8" />, color: 'blue' };
  if (titleLower.includes('english') || titleLower.includes('language')) return { icon: <BookOpen className="h-8 w-8" />, color: 'green' };
  if (titleLower.includes('science')) return { icon: <Microscope className="h-8 w-8" />, color: 'purple' };
  if (titleLower.includes('social') || titleLower.includes('history')) return { icon: <Globe className="h-8 w-8" />, color: 'orange' };
  if (titleLower.includes('computer')) return { icon: <Monitor className="h-8 w-8" />, color: 'cyan' };
  if (titleLower.includes('foreign') || titleLower.includes('language')) return { icon: <Languages className="h-8 w-8" />, color: 'pink' };
  if (titleLower.includes('health') || titleLower.includes('physical')) return { icon: <Heart className="h-8 w-8" />, color: 'red' };
  if (titleLower.includes('art')) return { icon: <Palette className="h-8 w-8" />, color: 'indigo' };
  if (titleLower.includes('career') || titleLower.includes('technical')) return { icon: <Wrench className="h-8 w-8" />, color: 'yellow' };
  return { icon: <HelpCircle className="h-8 w-8" />, color: 'gray' };
};



export default function OnboardingSubject() {
  const [, setLocation] = useLocation();
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  console.log('🔵 [ONBOARDING-STEP-2] OnboardingSubject component mounted');

  // Get user data to determine selected jurisdiction
  const { data: user, isLoading: isLoadingUser, error: userError } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: () => apiRequest('GET', '/api/auth/user')
  });
  
  console.log('🔵 [ONBOARDING-STEP-2] User API call status:');
  console.log('🔵 [ONBOARDING-STEP-2] - Loading:', isLoadingUser);
  console.log('🔵 [ONBOARDING-STEP-2] - Data:', user);
  console.log('🔵 [ONBOARDING-STEP-2] - Error:', userError);

  // Get subjects for selected jurisdiction dynamically
  const jurisdictionId = (user as any)?.preferredJurisdiction;
  
  console.log('🔵 [ONBOARDING-STEP-2] Jurisdiction from user:', jurisdictionId);
  
  // If user hasn't selected a jurisdiction yet, redirect to jurisdiction selection
  React.useEffect(() => {
    if (user && !jurisdictionId) {
      console.log('🔵 [ONBOARDING-STEP-2] ⚠️  No jurisdiction selected, redirecting to jurisdiction selection');
      setLocation('/onboarding/jurisdiction');
    }
  }, [user, jurisdictionId, setLocation]);
  
  const { data: subjectsResponse, isLoading: isLoadingSubjects, error: subjectsError } = useQuery({
    queryKey: ['/api/csp/jurisdictions', jurisdictionId, 'subjects', Date.now()], // Cache bust
    queryFn: async () => {
      console.log('🔵 [ONBOARDING-STEP-2] Making subjects API call for jurisdiction:', jurisdictionId);
      try {
        const response = await fetch(`/api/csp/jurisdictions/${jurisdictionId}/subjects`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        console.log('🔵 [ONBOARDING-STEP-2] Fetch response status:', response.status);
        console.log('🔵 [ONBOARDING-STEP-2] Fetch response ok:', response.ok);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('🔵 [ONBOARDING-STEP-2] Raw API response:', data);
        console.log('🔵 [ONBOARDING-STEP-2] Subjects in response:', data.subjects?.length || 0);
        return data;
      } catch (error) {
        console.error('🔵 [ONBOARDING-STEP-2] API call failed:', error);
        throw error;
      }
    },
    enabled: !!jurisdictionId,
    staleTime: 0,        // Always fetch fresh data  
    refetchOnMount: true, // Always refetch when component mounts
    retry: 1             // Retry once on failure
  });
  
  console.log('🔵 [ONBOARDING-STEP-2] Subjects API call status:');
  console.log('🔵 [ONBOARDING-STEP-2] - Loading:', isLoadingSubjects);
  console.log('🔵 [ONBOARDING-STEP-2] - Data:', subjectsResponse);
  console.log('🔵 [ONBOARDING-STEP-2] - Error:', subjectsError);
  console.log('🔵 [ONBOARDING-STEP-2] - Enabled:', !!jurisdictionId);

  // Convert API subjects to UI format with icons and colors
  const subjectAreas: SubjectAreaUI[] = ((subjectsResponse as any)?.subjects || []).map((subject: APISubject) => {
    const { icon, color } = getSubjectIcon(subject.title);
    return {
      id: subject.id,
      title: subject.title,
      description: subject.description,
      icon,
      color
    };
  });
  
  console.log('🔵 [ONBOARDING-STEP-2] Processed subjects for UI:', subjectAreas);
  console.log('🔵 [ONBOARDING-STEP-2] Subject count:', subjectAreas.length);

  // Update user preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: (data: any) => {
      console.log('🔵 [ONBOARDING-STEP-2] Saving subject preferences:', data);
      return apiRequest('PUT', '/api/user/preferences', data);
    },
    onSuccess: () => {
      console.log('🔵 [ONBOARDING-STEP-2] ✅ Subject preferences saved successfully');
      console.log('🔵 [ONBOARDING-STEP-2] → Redirecting to grade selection');
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setLocation('/onboarding/grades');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save preferences",
        variant: "destructive"
      });
    }
  });

  const toggleSubject = (subjectId: string) => {
    setSelectedSubjects(prev => 
      prev.includes(subjectId)
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const handleNext = () => {
    if (selectedSubjects.length === 0) {
      toast({
        title: "Selection Required",
        description: "Please select at least one subject area to continue",
        variant: "destructive"
      });
      return;
    }

    updatePreferencesMutation.mutate({
      preferredSubjectAreas: selectedSubjects,
      onboardingStep: 'grades'
    });
  };

  const handleBack = () => {
    setLocation('/onboarding/jurisdiction');
  };

  if (isLoadingUser || isLoadingSubjects) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading available subjects...</p>
          
          {/* TEMPORARY DEBUG INFO */}
          <div className="mt-8 p-4 bg-white rounded-lg shadow-lg max-w-2xl mx-auto text-left text-sm">
            <h3 className="font-bold mb-3 text-blue-600">🔍 DEBUG INFO:</h3>
            <div className="space-y-2">
              <p><strong>User Loading:</strong> {isLoadingUser ? '✅ YES' : '❌ NO'}</p>
              <p><strong>Subjects Loading:</strong> {isLoadingSubjects ? '✅ YES' : '❌ NO'}</p>
              <p><strong>Jurisdiction ID:</strong> {jurisdictionId || '❌ NOT SET'}</p>
              <p><strong>User Data Present:</strong> {user ? '✅ YES' : '❌ NO'}</p>
              <p><strong>Subjects Response Present:</strong> {subjectsResponse ? '✅ YES' : '❌ NO'}</p>
              <p><strong>Query Enabled:</strong> {!!jurisdictionId ? '✅ YES' : '❌ NO'}</p>
              <p><strong>Response Type:</strong> {subjectsResponse ? typeof subjectsResponse : 'N/A'}</p>
              <p><strong>Response Keys:</strong> {subjectsResponse ? Object.keys(subjectsResponse as any).join(', ') : 'N/A'}</p>
              <p><strong>Subjects Count:</strong> {(subjectsResponse as any)?.subjects?.length || 0}</p>
              {userError && <p><strong>User Error:</strong> {JSON.stringify(userError, null, 2)}</p>}
              {subjectsError && <p><strong>Subjects Error:</strong> {JSON.stringify(subjectsError, null, 2)}</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if no subjects found
  if (!isLoadingSubjects && (!(subjectsResponse as any)?.subjects || (subjectsResponse as any).subjects.length === 0)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">No subjects available for the selected jurisdiction</div>
          
          {/* TEMPORARY DEBUG INFO */}
          <div className="mt-6 p-4 bg-white rounded-lg shadow-lg max-w-2xl mx-auto text-left text-sm">
            <h3 className="font-bold mb-3 text-red-600">🚨 ERROR STATE DEBUG:</h3>
            <div className="space-y-2">
              <p><strong>Jurisdiction ID:</strong> {jurisdictionId || '❌ NOT SET'}</p>
              <p><strong>Subjects Response:</strong> {JSON.stringify(subjectsResponse, null, 2)}</p>
              <p><strong>Subjects Error:</strong> {subjectsError ? JSON.stringify(subjectsError, null, 2) : '✅ NO ERROR'}</p>
              <p><strong>Subject Areas Processed:</strong> {subjectAreas.length}</p>
              <p><strong>Raw Subject Areas:</strong> {JSON.stringify(subjectAreas, null, 2)}</p>
            </div>
          </div>
          
          <Button onClick={() => setLocation('/onboarding/jurisdiction')} variant="outline" className="mt-4">
            Go Back to Jurisdiction Selection
          </Button>
        </div>
      </div>
    );
  }

  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading subject areas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Progress Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <BookOpen className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Select Your Subject Areas</h1>
          <p className="text-xl text-gray-600">Which subjects do you teach or work with?</p>
          
          {/* Progress Indicator */}
          <div className="mt-6 mb-4">
            <Progress value={40} className="w-full max-w-md mx-auto" />
            <p className="text-sm text-gray-500 mt-2">Step 2 of 6</p>
          </div>
        </div>


        {/* Subject Areas */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {subjectAreas.map((subject) => {
            const isSelected = selectedSubjects.includes(subject.id);
            return (
              <Card 
                key={subject.id}
                className={`cursor-pointer hover:shadow-lg transition-all duration-200 border-2 ${
                  isSelected
                    ? `border-${subject.color}-500 bg-${subject.color}-50 shadow-md` 
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => toggleSubject(subject.id)}
                data-testid={`subject-${subject.id}`}
              >
                <CardHeader className="text-center pb-4">
                  <div className={`mx-auto w-16 h-16 bg-${subject.color}-100 rounded-full flex items-center justify-center mb-4`}>
                    <div className={`text-${subject.color}-600`}>
                      {subject.icon}
                    </div>
                  </div>
                  <CardTitle className="text-2xl">{subject.title}</CardTitle>
                  <CardDescription className="text-lg">
                    {subject.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-center">
                    {isSelected && (
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-${subject.color}-100 text-${subject.color}-700 text-sm font-medium`}>
                        ✓ Selected
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Multiple Selection Note */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            You can select multiple subject areas if you work with both
          </p>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-8">
          <Button 
            variant="outline" 
            onClick={handleBack}
            className="flex items-center gap-2"
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          
          <Button 
            onClick={handleNext}
            disabled={selectedSubjects.length === 0 || updatePreferencesMutation.isPending}
            className="flex items-center gap-2"
            data-testid="button-next"
          >
            {updatePreferencesMutation.isPending ? 'Saving...' : 'Continue'}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}