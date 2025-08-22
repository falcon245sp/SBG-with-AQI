import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Users, ChevronRight, ChevronLeft, CheckCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

export default function OnboardingClassroom() {
  const [, setLocation] = useLocation();
  const [isConnecting, setIsConnecting] = useState(false);

  // Complete onboarding mutation
  const completeOnboardingMutation = useMutation({
    mutationFn: (data: any) => apiRequest('PUT', '/api/user/complete-onboarding', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: "Welcome to Standards Sherpa!",
        description: "Your onboarding is complete. Let's get started!",
        variant: "default"
      });
      setLocation('/role-selection');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete onboarding",
        variant: "destructive"
      });
    }
  });

  const handleConnectClassroom = async () => {
    setIsConnecting(true);
    try {
      // Redirect to Google Classroom OAuth
      window.location.href = '/api/auth/google';
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Failed to initiate Google Classroom connection",
        variant: "destructive"
      });
      setIsConnecting(false);
    }
  };

  const handleSkipClassroom = () => {
    completeOnboardingMutation.mutate({
      onboardingCompleted: true,
      classroomSkipped: true
    });
  };

  const handleBack = () => {
    setLocation('/onboarding/courses');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Progress Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Connect Google Classroom</h1>
          <p className="text-xl text-gray-600">Import your classes and students (optional)</p>
          
          {/* Progress Indicator */}
          <div className="mt-6 mb-4">
            <Progress value={100} className="w-full max-w-md mx-auto" />
            <p className="text-sm text-gray-500 mt-2">Step 5 of 5</p>
          </div>
        </div>

        {/* Main Options */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Connect Option */}
          <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-green-300">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Connect Google Classroom</CardTitle>
              <CardDescription className="text-lg">
                Import your classes, students, and assignments
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-3 text-gray-600 mb-6">
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                  Automatic class roster import
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                  Standards-Based Gradebook sync
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                  Assignment and assessment tracking
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                  Streamlined workflow integration
                </li>
              </ul>
              <Button 
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={handleConnectClassroom}
                disabled={isConnecting}
                data-testid="button-connect-classroom"
              >
                {isConnecting ? 'Connecting...' : 'Connect Google Classroom'}
              </Button>
            </CardContent>
          </Card>

          {/* Skip Option */}
          <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-gray-300">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <ChevronRight className="h-8 w-8 text-gray-600" />
              </div>
              <CardTitle className="text-2xl">Skip for Now</CardTitle>
              <CardDescription className="text-lg">
                You can connect Google Classroom later
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-3 text-gray-600 mb-6">
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-gray-400" />
                  Manual class management
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-gray-400" />
                  Individual document processing
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-gray-400" />
                  Connect later from settings
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-gray-400" />
                  Full feature access still available
                </li>
              </ul>
              <Button 
                variant="outline"
                className="w-full"
                onClick={handleSkipClassroom}
                disabled={completeOnboardingMutation.isPending}
                data-testid="button-skip-classroom"
              >
                {completeOnboardingMutation.isPending ? 'Completing...' : 'Skip and Continue'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Info Note */}
        <div className="text-center mt-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Google Classroom integration is completely optional. 
              You can use all of Standards Sherpa's features without connecting to Classroom, 
              and you can always connect later from your dashboard settings.
            </p>
          </div>
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
          
          <div className="text-sm text-gray-500">
            Choose an option above to continue
          </div>
        </div>
      </div>
    </div>
  );
}