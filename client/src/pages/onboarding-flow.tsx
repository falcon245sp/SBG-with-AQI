import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, User, Target, Building, ArrowRight, BookOpen, BarChart3, FileCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

type OnboardingPersona = 'sbg_converter' | 'standards_auditor' | 'curriculum_builder';

interface UserPreferences {
  customerUuid: string;
  onboardingPersona?: OnboardingPersona;
  completedOnboarding: boolean;
  preferredWorkflow?: string;
  preferences: Record<string, any>;
}

interface PersonaOption {
  id: OnboardingPersona;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  features: string[];
  workflow: string;
  primaryAction: string;
  actionDescription: string;
}

const personaOptions: PersonaOption[] = [
  {
    id: 'sbg_converter',
    title: 'SBG Converter',
    description: 'Veteran teacher transitioning to Standards-Based Grading',
    icon: BarChart3,
    features: [
      'Generate SBG rubrics from existing assessments',
      'Progressive gradebook unlock as standards are identified',
      'Automated rigor level tracking',
      'Student mastery tracking'
    ],
    workflow: 'Upload assessments → AI identifies standards → Generate SBG rubrics → Track student mastery',
    primaryAction: 'Convert My Assessments',
    actionDescription: 'Start by uploading your existing assessments to generate SBG rubrics'
  },
  {
    id: 'standards_auditor',
    title: 'Standards Auditor',
    description: 'Veteran teacher validating standards coverage compliance',
    icon: FileCheck,
    features: [
      'Year-long accountability matrix',
      'Standards coverage gap analysis',
      'District requirement validation',
      'Rigor level compliance tracking'
    ],
    workflow: 'Upload curriculum → AI analyzes standards → Review coverage matrix → Identify gaps → Take action',
    primaryAction: 'Audit My Curriculum',
    actionDescription: 'Upload your curriculum materials to analyze standards coverage'
  },
  {
    id: 'curriculum_builder',
    title: 'Curriculum Builder',
    description: 'New teacher building curriculum throughout the year',
    icon: Building,
    features: [
      'Unit-by-unit curriculum development',
      'Standards alignment guidance',
      'Progressive unit unlock workflow',
      'Scaffolded assessment creation'
    ],
    workflow: 'Create units → Build assessments → AI ensures standards alignment → Track progress → Repeat',
    primaryAction: 'Build My Curriculum',
    actionDescription: 'Start creating your first unit and build curriculum progressively'
  }
];

export default function OnboardingFlow() {
  const [, setLocation] = useLocation();
  const [selectedPersona, setSelectedPersona] = useState<OnboardingPersona | null>(null);
  const [currentStep, setCurrentStep] = useState<'welcome' | 'persona' | 'workflow' | 'complete'>('welcome');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: preferences } = useQuery<UserPreferences>({
    queryKey: ['/api/user/preferences'],
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: (data: Partial<UserPreferences>) =>
      apiRequest('PUT', '/api/user/preferences', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/preferences'] });
    },
  });

  const handlePersonaSelect = (persona: OnboardingPersona) => {
    setSelectedPersona(persona);
  };

  const handleContinue = () => {
    if (currentStep === 'welcome') {
      setCurrentStep('persona');
    } else if (currentStep === 'persona' && selectedPersona) {
      setCurrentStep('workflow');
    } else if (currentStep === 'workflow') {
      setCurrentStep('complete');
    }
  };

  const handleComplete = () => {
    if (!selectedPersona) return;

    const selectedOption = personaOptions.find(p => p.id === selectedPersona);
    
    updatePreferencesMutation.mutate({
      onboardingPersona: selectedPersona,
      completedOnboarding: true,
      preferredWorkflow: selectedOption?.workflow,
      preferences: {
        primaryAction: selectedOption?.primaryAction,
        setupDate: new Date().toISOString(),
      }
    });

    toast({
      title: 'Welcome to Standards Sherpa!',
      description: `You're all set up as a ${selectedOption?.title}`,
    });

    // Redirect based on persona
    switch (selectedPersona) {
      case 'sbg_converter':
        setLocation('/upload');
        break;
      case 'standards_auditor':
        setLocation('/google-classroom');
        break;
      case 'curriculum_builder':
        setLocation('/google-classroom');
        break;
      default:
        setLocation('/dashboard');
    }
  };

  const selectedOption = selectedPersona ? personaOptions.find(p => p.id === selectedPersona) : null;

  if (preferences?.completedOnboarding) {
    setLocation('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-2">
            {['welcome', 'persona', 'workflow', 'complete'].map((step, index) => (
              <div key={step} className="flex items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${(['welcome', 'persona', 'workflow', 'complete'].indexOf(currentStep) >= index)
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-500'
                  }
                `}>
                  {(['welcome', 'persona', 'workflow', 'complete'].indexOf(currentStep) > index) ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < 3 && (
                  <div className={`
                    w-12 h-0.5 mx-2
                    ${(['welcome', 'persona', 'workflow', 'complete'].indexOf(currentStep) > index)
                      ? 'bg-blue-600' 
                      : 'bg-gray-200'
                    }
                  `} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Welcome Step */}
        {currentStep === 'welcome' && (
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl mb-2">Welcome to Standards Sherpa v1.0!</CardTitle>
              <CardDescription className="text-lg">
                Let's set up your personalized experience based on how you plan to use the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-left max-w-2xl mx-auto">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Standards Accountability Matrix</h3>
                    <p className="text-sm text-gray-600">Year-long tracking with visual rigor indicators</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Standards-Based Gradebook</h3>
                    <p className="text-sm text-gray-600">Progressive unlock as units are analyzed</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">AI-Powered Analysis</h3>
                    <p className="text-sm text-gray-600">Automatic standards identification and rigor tracking</p>
                  </div>
                </div>
              </div>
              
              <Button 
                onClick={handleContinue}
                className="mt-6"
                size="lg"
              >
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Persona Selection Step */}
        {currentStep === 'persona' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-center">Choose Your Role</CardTitle>
              <CardDescription className="text-center">
                Select the option that best describes how you plan to use Standards Sherpa
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={selectedPersona || ''} 
                onValueChange={(value) => handlePersonaSelect(value as OnboardingPersona)}
                className="space-y-4"
              >
                {personaOptions.map((option) => {
                  const IconComponent = option.icon;
                  return (
                    <div key={option.id} className="space-y-2">
                      <Label 
                        htmlFor={option.id}
                        className="flex items-start gap-4 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <RadioGroupItem value={option.id} id={option.id} className="mt-1" />
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <IconComponent className="w-6 h-6 text-blue-600" />
                          </div>
                        </div>
                        <div className="flex-grow">
                          <h3 className="font-semibold text-gray-900 mb-1">{option.title}</h3>
                          <p className="text-sm text-gray-600 mb-3">{option.description}</p>
                          <div className="flex flex-wrap gap-2">
                            {option.features.map((feature, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {feature}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
              
              <div className="flex justify-center mt-6">
                <Button 
                  onClick={handleContinue}
                  disabled={!selectedPersona}
                  size="lg"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Workflow Step */}
        {currentStep === 'workflow' && selectedOption && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                  <selectedOption.icon className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{selectedOption.title}</CardTitle>
                  <CardDescription>{selectedOption.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Your Recommended Workflow</h3>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-800">{selectedOption.workflow}</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Key Features You'll Use</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedOption.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Next Step</h3>
                  <p className="text-sm text-gray-700 mb-3">{selectedOption.actionDescription}</p>
                  <Badge variant="default" className="text-sm">
                    {selectedOption.primaryAction}
                  </Badge>
                </div>
              </div>
              
              <div className="flex justify-center mt-6">
                <Button 
                  onClick={handleContinue}
                  size="lg"
                >
                  Complete Setup
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Complete Step */}
        {currentStep === 'complete' && selectedOption && (
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl mb-2">You're All Set!</CardTitle>
              <CardDescription className="text-lg">
                Welcome to Standards Sherpa as a {selectedOption.title}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-600">
                  Your personalized experience is ready. You can change your preferences anytime in your user settings.
                </p>
                
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">Ready to {selectedOption.primaryAction}?</h3>
                  <p className="text-sm text-blue-800">{selectedOption.actionDescription}</p>
                </div>
              </div>
              
              <Button 
                onClick={handleComplete}
                disabled={updatePreferencesMutation.isPending}
                size="lg"
                className="mt-6"
              >
                {updatePreferencesMutation.isPending ? 'Setting up...' : `Let's Go!`}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}