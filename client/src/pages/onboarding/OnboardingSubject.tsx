import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Calculator, ChevronRight, ChevronLeft, Microscope, Globe, Monitor, Languages, Heart, Palette, Wrench, HelpCircle } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { SubjectArea, StandardsJurisdiction } from "@shared/businessEnums";

interface SubjectAreaUI {
  id: SubjectArea;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

// Jurisdiction-specific descriptions for subject areas
const getSubjectDescription = (subjectId: SubjectArea, jurisdiction: StandardsJurisdiction): string => {
  const descriptions = {
    [SubjectArea.MATHEMATICS]: {
      [StandardsJurisdiction.COMMON_CORE_MATH]: 'Common Core Mathematics: Problem-solving, reasoning, and modeling across all grade levels',
      [StandardsJurisdiction.COMMON_CORE_ELA]: 'Math courses including Algebra, Geometry, Statistics, and more',
      [StandardsJurisdiction.NGSS]: 'Mathematics integration within NGSS: Quantitative reasoning and data analysis in science contexts',
      [StandardsJurisdiction.STATE_SPECIFIC]: 'State-aligned mathematics standards and curricula',
      [StandardsJurisdiction.AP_STANDARDS]: 'Advanced Placement Mathematics: Calculus, Statistics, and rigorous college-level content',
      [StandardsJurisdiction.IB_STANDARDS]: 'International Baccalaureate Mathematics: Analysis, Applications, and Global perspectives',
      [StandardsJurisdiction.CUSTOM]: 'Custom mathematics standards and specialized curricula'
    },
    [SubjectArea.ENGLISH_LANGUAGE_ARTS]: {
      [StandardsJurisdiction.COMMON_CORE_ELA]: 'Common Core ELA: Reading, Writing, Speaking, Listening, and Language standards',
      [StandardsJurisdiction.COMMON_CORE_MATH]: 'English Language Arts courses supporting mathematical communication and literacy',
      [StandardsJurisdiction.NGSS]: 'Scientific literacy and communication: Technical writing and analysis in science contexts',
      [StandardsJurisdiction.STATE_SPECIFIC]: 'State-aligned English Language Arts standards and assessments',
      [StandardsJurisdiction.AP_STANDARDS]: 'Advanced Placement English: Literature, Composition, and college-level analysis',
      [StandardsJurisdiction.IB_STANDARDS]: 'International Baccalaureate Language Arts: Global literature and critical thinking',
      [StandardsJurisdiction.CUSTOM]: 'Custom language arts standards and specialized literacy curricula'
    },
    [SubjectArea.SCIENCE]: {
      [StandardsJurisdiction.NGSS]: 'Next Generation Science Standards: 3-dimensional learning with disciplinary core ideas, practices, and crosscutting concepts',
      [StandardsJurisdiction.COMMON_CORE_MATH]: 'Science courses with mathematical modeling and quantitative analysis',
      [StandardsJurisdiction.COMMON_CORE_ELA]: 'Science education emphasizing scientific literacy and evidence-based communication',
      [StandardsJurisdiction.STATE_SPECIFIC]: 'State-aligned science standards covering Biology, Chemistry, Physics, and Earth Science',
      [StandardsJurisdiction.AP_STANDARDS]: 'Advanced Placement Sciences: College-level Biology, Chemistry, Physics, and Environmental Science',
      [StandardsJurisdiction.IB_STANDARDS]: 'International Baccalaureate Sciences: Inquiry-based learning with global perspectives',
      [StandardsJurisdiction.CUSTOM]: 'Custom science standards and specialized STEM curricula'
    },
    [SubjectArea.SOCIAL_STUDIES]: {
      [StandardsJurisdiction.STATE_SPECIFIC]: 'State-aligned Social Studies: History, Geography, Government, Economics, and Civics',
      [StandardsJurisdiction.AP_STANDARDS]: 'Advanced Placement Social Studies: College-level History, Government, and Economics',
      [StandardsJurisdiction.IB_STANDARDS]: 'International Baccalaureate Social Studies: Global perspectives on history and society',
      [StandardsJurisdiction.NGSS]: 'Social studies integration with NGSS: Human impact on environment and society',
      [StandardsJurisdiction.COMMON_CORE_MATH]: 'Social Studies with data analysis and quantitative reasoning',
      [StandardsJurisdiction.COMMON_CORE_ELA]: 'Social Studies emphasizing historical thinking and argumentative writing',
      [StandardsJurisdiction.CUSTOM]: 'Custom social studies standards and specialized humanities curricula'
    }
  };

  const defaultDescriptions = {
    [SubjectArea.MATHEMATICS]: 'Math courses including Algebra, Geometry, Statistics, and more',
    [SubjectArea.ENGLISH_LANGUAGE_ARTS]: 'Reading, Writing, Speaking, Listening, and Language standards',
    [SubjectArea.SCIENCE]: 'Biology, Chemistry, Physics, Earth Science, and Environmental Science',
    [SubjectArea.SOCIAL_STUDIES]: 'History, Geography, Government, Economics, and Civics',
    [SubjectArea.COMPUTER_SCIENCE]: 'Programming, Software Development, and Information Technology',
    [SubjectArea.FOREIGN_LANGUAGE]: 'Spanish, French, German, and other world languages',
    [SubjectArea.HEALTH_PHYSICAL_EDUCATION]: 'Physical fitness, health education, and wellness',
    [SubjectArea.ARTS]: 'Visual Arts, Music, Drama, and Creative Expression',
    [SubjectArea.CAREER_TECHNICAL_EDUCATION]: 'Vocational training and career preparation',
    [SubjectArea.OTHER]: 'Specialized subjects and interdisciplinary courses'
  };

  return (descriptions as any)[subjectId]?.[jurisdiction] || (defaultDescriptions as any)[subjectId] || 'Standards-aligned curriculum and instruction';
};

// Base subject area definitions with icons and colors
const BASE_SUBJECT_AREAS = [
  {
    id: SubjectArea.MATHEMATICS,
    title: 'Mathematics',
    icon: <Calculator className="h-8 w-8" />,
    color: 'blue'
  },
  {
    id: SubjectArea.ENGLISH_LANGUAGE_ARTS,
    title: 'English Language Arts',
    icon: <BookOpen className="h-8 w-8" />,
    color: 'green'
  },
  {
    id: SubjectArea.SCIENCE,
    title: 'Science',
    icon: <Microscope className="h-8 w-8" />,
    color: 'purple'
  },
  {
    id: SubjectArea.SOCIAL_STUDIES,
    title: 'Social Studies',
    icon: <Globe className="h-8 w-8" />,
    color: 'orange'
  },
  {
    id: SubjectArea.COMPUTER_SCIENCE,
    title: 'Computer Science',
    icon: <Monitor className="h-8 w-8" />,
    color: 'cyan'
  },
  {
    id: SubjectArea.FOREIGN_LANGUAGE,
    title: 'Foreign Language',
    icon: <Languages className="h-8 w-8" />,
    color: 'pink'
  },
  {
    id: SubjectArea.HEALTH_PHYSICAL_EDUCATION,
    title: 'Health & Physical Education',
    icon: <Heart className="h-8 w-8" />,
    color: 'red'
  },
  {
    id: SubjectArea.ARTS,
    title: 'Arts',
    icon: <Palette className="h-8 w-8" />,
    color: 'indigo'
  },
  {
    id: SubjectArea.CAREER_TECHNICAL_EDUCATION,
    title: 'Career & Technical Education',
    icon: <Wrench className="h-8 w-8" />,
    color: 'yellow'
  },
  {
    id: SubjectArea.OTHER,
    title: 'Other',
    icon: <HelpCircle className="h-8 w-8" />,
    color: 'gray'
  }
];

// Jurisdiction to subject area mapping
const JURISDICTION_SUBJECT_MAPPING = {
  [StandardsJurisdiction.NGSS]: [SubjectArea.SCIENCE],
  [StandardsJurisdiction.COMMON_CORE_MATH]: [SubjectArea.MATHEMATICS],
  [StandardsJurisdiction.COMMON_CORE_ELA]: [SubjectArea.ENGLISH_LANGUAGE_ARTS],
  [StandardsJurisdiction.STATE_SPECIFIC]: BASE_SUBJECT_AREAS.map(s => s.id),
  [StandardsJurisdiction.AP_STANDARDS]: BASE_SUBJECT_AREAS.map(s => s.id),
  [StandardsJurisdiction.IB_STANDARDS]: BASE_SUBJECT_AREAS.map(s => s.id),
  [StandardsJurisdiction.CUSTOM]: BASE_SUBJECT_AREAS.map(s => s.id)
};

export default function OnboardingSubject() {
  const [, setLocation] = useLocation();
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  // Get user data to determine selected jurisdiction
  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: () => apiRequest('GET', '/api/auth/user')
  });

  // Filter subject areas based on selected jurisdiction and add dynamic descriptions
  const getAvailableSubjectAreas = (): SubjectAreaUI[] => {
    const jurisdiction = (user as any)?.preferred_jurisdiction as StandardsJurisdiction;
    if (!jurisdiction) {
      // If no jurisdiction selected, show all with default descriptions
      return BASE_SUBJECT_AREAS.map(subject => ({
        ...subject,
        description: getSubjectDescription(subject.id, StandardsJurisdiction.STATE_SPECIFIC)
      }));
    }

    const allowedSubjects = JURISDICTION_SUBJECT_MAPPING[jurisdiction] || BASE_SUBJECT_AREAS.map(s => s.id);
    return BASE_SUBJECT_AREAS
      .filter(subject => allowedSubjects.includes(subject.id))
      .map(subject => ({
        ...subject,
        description: getSubjectDescription(subject.id, jurisdiction)
      }));
  };

  const subjectAreas = getAvailableSubjectAreas();

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