import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { GraduationCap, ChevronRight, ChevronLeft } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

interface GradeBand {
  id: string;
  title: string;
  description: string;
  grades: string[];
  color: string;
}

const gradeBands: GradeBand[] = [
  {
    id: 'K-5',
    title: 'Elementary (K-5)',
    description: 'Kindergarten through 5th Grade',
    grades: ['K', '1', '2', '3', '4', '5'],
    color: 'green'
  },
  {
    id: '6-8',
    title: 'Middle School (6-8)',
    description: '6th through 8th Grade',
    grades: ['6', '7', '8'],
    color: 'blue'
  },
  {
    id: '9-12',
    title: 'High School (9-12)',
    description: '9th through 12th Grade',
    grades: ['9', '10', '11', '12'],
    color: 'purple'
  }
];

export default function OnboardingGrades() {
  const [, setLocation] = useLocation();
  const [selectedGradeBands, setSelectedGradeBands] = useState<string[]>([]);

  // Update user preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: (data: any) => apiRequest('PUT', '/api/user/preferences', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setLocation('/onboarding/courses');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save preferences",
        variant: "destructive"
      });
    }
  });

  const toggleGradeBand = (gradeBandId: string) => {
    setSelectedGradeBands(prev => 
      prev.includes(gradeBandId)
        ? prev.filter(id => id !== gradeBandId)
        : [...prev, gradeBandId]
    );
  };

  const handleNext = () => {
    if (selectedGradeBands.length === 0) {
      toast({
        title: "Selection Required",
        description: "Please select at least one grade level range to continue",
        variant: "destructive"
      });
      return;
    }

    updatePreferencesMutation.mutate({
      selectedGradeLevels: selectedGradeBands,
      onboardingStep: 'courses'
    });
  };

  const handleBack = () => {
    setLocation('/onboarding/subject');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Progress Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
            <GraduationCap className="h-8 w-8 text-purple-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Select Grade Levels</h1>
          <p className="text-xl text-gray-600">Which grade levels do you teach or work with?</p>
          
          {/* Progress Indicator */}
          <div className="mt-6 mb-4">
            <Progress value={60} className="w-full max-w-md mx-auto" />
            <p className="text-sm text-gray-500 mt-2">Step 3 of 6</p>
          </div>
        </div>

        {/* Grade Bands */}
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {gradeBands.map((band) => {
            const isSelected = selectedGradeBands.includes(band.id);
            return (
              <Card 
                key={band.id}
                className={`cursor-pointer hover:shadow-lg transition-all duration-200 border-2 ${
                  isSelected
                    ? `border-${band.color}-500 bg-${band.color}-50 shadow-md` 
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => toggleGradeBand(band.id)}
                data-testid={`grade-band-${band.id}`}
              >
                <CardHeader className="text-center pb-4">
                  <div className={`mx-auto w-16 h-16 bg-${band.color}-100 rounded-full flex items-center justify-center mb-4`}>
                    <GraduationCap className={`h-8 w-8 text-${band.color}-600`} />
                  </div>
                  <CardTitle className="text-xl">{band.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {band.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-center mb-4">
                    <div className="flex flex-wrap justify-center gap-1">
                      {band.grades.map(grade => (
                        <span 
                          key={grade}
                          className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            isSelected 
                              ? `bg-${band.color}-100 text-${band.color}-700` 
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {grade}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="text-center">
                    {isSelected && (
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-${band.color}-100 text-${band.color}-700 text-sm font-medium`}>
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
            You can select multiple grade level ranges if you work across different levels
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
            disabled={selectedGradeBands.length === 0 || updatePreferencesMutation.isPending}
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