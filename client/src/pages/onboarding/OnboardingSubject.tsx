import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Calculator, ChevronRight, ChevronLeft } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

interface SubjectArea {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const subjectAreas: SubjectArea[] = [
  {
    id: 'mathematics',
    title: 'Mathematics',
    description: 'Math courses including Algebra, Geometry, Statistics, and more',
    icon: <Calculator className="h-8 w-8" />,
    color: 'blue'
  },
  {
    id: 'english_language_arts',
    title: 'English Language Arts',
    description: 'Reading, Writing, Speaking, Listening, and Language standards',
    icon: <BookOpen className="h-8 w-8" />,
    color: 'green'
  }
];

export default function OnboardingSubject() {
  const [, setLocation] = useLocation();
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  // Update user preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: (data: any) => apiRequest('PUT', '/api/user/preferences', data),
    onSuccess: () => {
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