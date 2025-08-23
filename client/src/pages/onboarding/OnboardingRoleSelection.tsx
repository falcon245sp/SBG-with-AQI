import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  ChevronLeft, 
  BookCheck, 
  Target, 
  Users,
  CheckCircle 
} from 'lucide-react';

export default function OnboardingRoleSelection() {
  const [, setLocation] = useLocation();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const { toast } = useToast();

  // Update role selection mutation
  const updateRoleMutation = useMutation({
    mutationFn: (data: any) => apiRequest('PUT', '/api/user/update-role-selection', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: "Role Selected!",
        description: "Moving to standards configuration...",
        variant: "default"
      });
      setLocation('/onboarding/standards-configuration');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save role selection",
        variant: "destructive"
      });
    }
  });

  const handleRoleSelection = (role: string) => {
    setSelectedRole(role);
    updateRoleMutation.mutate({
      selectedRole: role,
      onboardingRoleSelected: true,
      onboardingStep: 'standards-configuration'
    });
  };

  const handleBack = () => {
    setLocation('/onboarding/classroom');
  };

  const roles = [
    {
      id: 'sbg-converter',
      title: 'SBG Converter',
      description: 'Transitioning to Standards-Based Grading',
      icon: BookCheck,
      color: 'blue',
      benefits: [
        'Step-by-step SBG implementation guidance',
        'Gradebook conversion tools',
        'Parent communication templates',
        'Mastery tracking dashboards'
      ]
    },
    {
      id: 'standards-auditor',
      title: 'Standards Auditor',
      description: 'Tracking standards coverage and accountability',
      icon: Target,
      color: 'green',
      benefits: [
        'Comprehensive standards coverage reports',
        'Rigor level analysis across curriculum',
        'Gap identification and recommendations',
        'Year-long accountability matrices'
      ]
    },
    {
      id: 'curriculum-builder',
      title: 'Curriculum Builder',
      description: 'Creating and aligning educational content',
      icon: Users,
      color: 'purple',
      benefits: [
        'Standards alignment verification',
        'Automated rigor assessment',
        'Curriculum mapping tools',
        'Assessment creation support'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-5xl w-full">
        {/* Progress Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-purple-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Choose Your Role</h1>
          <p className="text-xl text-gray-600">Tell us how you'll use Standards Sherpa</p>
          
          {/* Progress Indicator - Step 6 of 6 */}
          <div className="mt-6 mb-4">
            <Progress value={90} className="w-full max-w-md mx-auto" />
            <p className="text-sm text-gray-500 mt-2">Step 6 of 6</p>
          </div>
        </div>

        {/* Role Selection Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-8">
          {roles.map((role) => {
            const IconComponent = role.icon;
            const isSelected = selectedRole === role.id;
            
            return (
              <Card 
                key={role.id}
                className={`cursor-pointer hover:shadow-lg transition-all duration-200 border-2 ${
                  isSelected 
                    ? `border-${role.color}-500 bg-${role.color}-50` 
                    : `border-gray-200 hover:border-${role.color}-300`
                }`}
                onClick={() => handleRoleSelection(role.id)}
              >
                <CardHeader className="text-center pb-4">
                  <div className={`mx-auto w-16 h-16 bg-${role.color}-100 rounded-full flex items-center justify-center mb-4`}>
                    <IconComponent className={`h-8 w-8 text-${role.color}-600`} />
                  </div>
                  <CardTitle className="text-xl">{role.title}</CardTitle>
                  <CardDescription className="text-base">
                    {role.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-2 text-sm text-gray-600">
                    {role.benefits.map((benefit, index) => (
                      <li key={index} className="flex items-start">
                        <CheckCircle className={`h-4 w-4 mr-2 mt-0.5 text-${role.color}-500 flex-shrink-0`} />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center max-w-5xl mx-auto">
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
            Select a role to continue
          </div>
        </div>
      </div>
    </div>
  );
}