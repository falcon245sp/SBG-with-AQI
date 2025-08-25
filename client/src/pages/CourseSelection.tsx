import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { GraduationCap, ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function CourseSelection() {
  const [, setLocation] = useLocation();
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const queryClient = useQueryClient();

  // Fetch user's configured classrooms for course selection
  const { data: classrooms, isLoading } = useQuery<any[]>({
    queryKey: ["/api/classrooms"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const setCourseContextMutation = useMutation({
    mutationFn: () => {
      // Store course context in session storage for immediate use
      if (selectedCourseId) {
        sessionStorage.setItem('currentCourseId', selectedCourseId);
      }
      return Promise.resolve();
    },
    onSuccess: () => {
      toast({
        title: "Course Selected!",
        description: "Your course context has been set. You can now upload documents.",
        variant: "default"
      });
      setLocation('/upload');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set course context",
        variant: "destructive"
      });
    }
  });

  const handleCourseSelection = () => {
    if (!selectedCourseId) {
      toast({
        title: "Selection Required",
        description: "Please select a course to continue.",
        variant: "destructive"
      });
      return;
    }
    setCourseContextMutation.mutate();
  };

  const configuredClassrooms = classrooms?.filter(c => c.courseConfigurationCompleted) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading your courses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <GraduationCap className="w-16 h-16 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">
            Which course would you like to begin with?
          </CardTitle>
          <p className="text-slate-600 mt-2">
            Select a course to set your working context. You can switch between courses anytime using the navigation panel.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {configuredClassrooms.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-600 mb-4">
                No configured courses found. Please complete the course configuration first.
              </p>
              <Button 
                variant="outline" 
                onClick={() => setLocation('/onboarding/standards-configuration')}
              >
                Complete Course Configuration
              </Button>
            </div>
          ) : (
            <>
              <div>
                <Label className="text-base font-medium">Available Courses</Label>
                <RadioGroup 
                  value={selectedCourseId} 
                  onValueChange={setSelectedCourseId}
                  className="mt-3"
                >
                  {configuredClassrooms.map((classroom) => (
                    <div key={classroom.id} className="flex items-center space-x-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <RadioGroupItem value={classroom.id} id={classroom.id} />
                      <Label htmlFor={classroom.id} className="flex-1 cursor-pointer">
                        <div className="font-medium">
                          {classroom.courseTitle || classroom.name}
                        </div>
                        {classroom.section && (
                          <div className="text-sm text-slate-500">
                            Section: {classroom.section}
                          </div>
                        )}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="flex justify-between items-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => setLocation('/dashboard')}
                >
                  Skip for Now
                </Button>
                <Button
                  onClick={handleCourseSelection}
                  disabled={!selectedCourseId || setCourseContextMutation.isPending}
                  className="flex items-center space-x-2"
                >
                  <span>Continue with Selected Course</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}