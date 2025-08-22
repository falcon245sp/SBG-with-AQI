import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpenCheck, ChevronRight, ChevronLeft, Plus, X } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

interface Course {
  id: string;
  title: string;
  description: string;
  gradeLevels: string[];
  standardSetId?: string;
}

export default function OnboardingCourses() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [customCourse, setCustomCourse] = useState('');

  const userPrefs = user as any;

  // Handle snake_case to camelCase conversion
  const preferredSubjectAreas = userPrefs?.preferredSubjectAreas || userPrefs?.preferred_subject_areas || [];
  const selectedGradeLevels = userPrefs?.selectedGradeLevels || userPrefs?.selected_grade_levels || [];

  // Get available courses based on user's subject areas and grade levels
  const { data: availableCourses, isLoading: isLoadingCourses } = useQuery({
    queryKey: [
      '/api/courses/available', 
      { preferredSubjectAreas: preferredSubjectAreas.join(','), selectedGradeLevels: selectedGradeLevels.join(',') }
    ],
    queryFn: () => {
      const params = new URLSearchParams({
        preferredSubjectAreas: preferredSubjectAreas.join(','),
        selectedGradeLevels: selectedGradeLevels.join(',')
      });
      return fetch(`/api/courses/available?${params}`).then(res => res.json());
    },
    enabled: preferredSubjectAreas.length > 0 && selectedGradeLevels.length > 0
  });

  // Update user preferences and complete onboarding
  const completeOnboardingMutation = useMutation({
    mutationFn: (data: any) => apiRequest('PUT', '/api/user/complete-onboarding', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setLocation('/onboarding/classroom');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save course selections",
        variant: "destructive"
      });
    }
  });

  const toggleCourse = (courseId: string) => {
    setSelectedCourses(prev => 
      prev.includes(courseId)
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const addCustomCourse = () => {
    if (!customCourse.trim()) {
      toast({
        title: "Course Name Required",
        description: "Please enter a course name",
        variant: "destructive"
      });
      return;
    }

    const customId = `custom-${Date.now()}`;
    setSelectedCourses(prev => [...prev, customId]);
    setCustomCourse('');
  };

  const removeCustomCourse = (courseId: string) => {
    setSelectedCourses(prev => prev.filter(id => id !== courseId));
  };

  const handleNext = () => {
    if (selectedCourses.length === 0) {
      toast({
        title: "Selection Required",
        description: "Please select at least one course to continue",
        variant: "destructive"
      });
      return;
    }

    completeOnboardingMutation.mutate({
      selectedCourses,
      onboardingStep: 'classroom'
    });
  };

  const handleBack = () => {
    setLocation('/onboarding/grades');
  };

  if (isLoadingCourses) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading course options...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Progress Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
            <BookOpenCheck className="h-8 w-8 text-indigo-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Configure Your Courses</h1>
          <p className="text-xl text-gray-600">Select the courses you teach or work with</p>
          
          {/* Progress Indicator */}
          <div className="mt-6 mb-4">
            <Progress value={80} className="w-full max-w-md mx-auto" />
            <p className="text-sm text-gray-500 mt-2">Step 4 of 5</p>
          </div>
        </div>

        {/* Selected Subject Areas & Grade Levels */}
        <div className="text-center mb-6">
          <div className="flex flex-wrap justify-center gap-2 mb-2">
            {preferredSubjectAreas.map((subject: string) => (
              <Badge key={subject} variant="outline" className="capitalize">
                {subject.replace('_', ' ')}
              </Badge>
            ))}
            {selectedGradeLevels.map((level: string) => (
              <Badge key={level} variant="secondary">
                {level}
              </Badge>
            ))}
          </div>
        </div>

        {/* Available Courses */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-80 overflow-y-auto mb-6">
          {((availableCourses as Course[]) || []).map((course: Course) => {
            const isSelected = selectedCourses.includes(course.id);
            return (
              <Card 
                key={course.id}
                className={`cursor-pointer hover:shadow-lg transition-all duration-200 border-2 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50 shadow-md' 
                    : 'border-gray-200 hover:border-indigo-300'
                }`}
                onClick={() => toggleCourse(course.id)}
                data-testid={`course-${course.id}`}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{course.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {course.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-1">
                    {(course.gradeLevels || []).map(level => (
                      <span 
                        key={level}
                        className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          isSelected 
                            ? 'bg-indigo-100 text-indigo-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {level}
                      </span>
                    ))}
                  </div>
                  
                  {isSelected && (
                    <div className="mt-2 text-center">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium">
                        ✓ Selected
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Add Custom Course */}
        <div className="bg-white rounded-lg border p-4 mb-6">
          <Label className="text-sm font-medium text-gray-700 mb-2 block">
            Add Custom Course
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder="Enter course name (e.g., AP Statistics, Honors Geometry)"
              value={customCourse}
              onChange={(e) => setCustomCourse(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addCustomCourse()}
              data-testid="input-custom-course"
            />
            <Button 
              onClick={addCustomCourse}
              size="sm"
              data-testid="button-add-course"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Selected Custom Courses */}
        {selectedCourses.filter(id => id.startsWith('custom-')).length > 0 && (
          <div className="mb-6">
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Custom Courses Selected
            </Label>
            <div className="flex flex-wrap gap-2">
              {selectedCourses
                .filter(id => id.startsWith('custom-'))
                .map((courseId) => (
                  <Badge 
                    key={courseId} 
                    variant="outline" 
                    className="flex items-center gap-1"
                  >
                    Custom Course
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => removeCustomCourse(courseId)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
            </div>
          </div>
        )}

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
            disabled={selectedCourses.length === 0 || completeOnboardingMutation.isPending}
            className="flex items-center gap-2"
            data-testid="button-next"
          >
            {completeOnboardingMutation.isPending ? 'Saving...' : 'Continue'}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}