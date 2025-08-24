import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  ChevronLeft, 
  CheckCircle, 
  Users,
  BookOpen,
  Settings,
  Target,
  RefreshCw,
  AlertCircle,
  X
} from 'lucide-react';

interface Classroom {
  id: string;
  name: string;
  section: string;
  subjectArea: string;
  studentCount: number;
  googleClassId: string;
}

interface CourseMapping {
  classroomId: string;
  selectedCourseId: string;
  enableSBG: boolean;
  selectedStandards: string[];
}

export default function OnboardingStandardsConfiguration() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [courseMappings, setCourseMappings] = useState<CourseMapping[]>([]);
  const [configurationPhase, setConfigurationPhase] = useState<'mapping' | 'standards'>('mapping');

  // Fetch classrooms
  const { data: classrooms, isLoading: classroomsLoading } = useQuery({
    queryKey: ['/api/classrooms'],
    enabled: !!user,
  });

  // Get user's saved onboarding data
  const userData = user as any;
  const selectedCourses = userData?.selectedCourses || userData?.selected_courses || [];
  const preferredJurisdiction = userData?.preferredJurisdiction || userData?.preferred_jurisdiction;
  const selectedSubjects = userData?.preferredSubjectAreas || userData?.preferred_subject_areas || [];
  const selectedGrades = userData?.selectedGradeLevels || userData?.selected_grade_levels || [];

  // Convert grade levels to the format expected by API (e.g., ["9-12"] -> "9-12")
  const gradeString = selectedGrades.join(',');
  const subjectString = selectedSubjects.join(',');


  // Validate that user has completed required onboarding steps
  const hasRequiredData = preferredJurisdiction && selectedSubjects.length > 0 && selectedGrades.length > 0;

  // Fetch courses using user's actual onboarding selections - NO FALLBACKS
  const { data: availableCourses, isLoading: coursesLoading, error: coursesError } = useQuery({
    queryKey: ['/api/courses/available', preferredJurisdiction, subjectString, gradeString],
    queryFn: async () => {
      if (!preferredJurisdiction) {
        throw new Error('Jurisdiction not selected - please complete onboarding step 1');
      }
      if (!subjectString) {
        throw new Error('Subjects not selected - please complete onboarding step 2');
      }
      if (!gradeString) {
        throw new Error('Grade levels not selected - please complete onboarding step 3');
      }

      const params = new URLSearchParams({
        jurisdiction: preferredJurisdiction,
        subjects: subjectString,
        grades: gradeString
      });
      const response = await fetch(`/api/courses/available?${params}`);
      if (!response.ok) throw new Error('Failed to fetch courses');
      return response.json();
    },
    enabled: !!user && hasRequiredData,
  });

  // Always use the full course objects from API for display (they have titles)
  // selectedCourses is just IDs, availableCourses has the actual course data with titles
  const coursesToDisplay = availableCourses || [];

  // State for standards selection
  const [courseStandards, setCourseStandards] = useState<Record<string, any[]>>({});
  const [selectedStandards, setSelectedStandards] = useState<Record<string, string[]>>({});
  const [loadingStandards, setLoadingStandards] = useState<Record<string, boolean>>({});

  // Fetch standards for a course
  const fetchStandardsForCourse = async (courseId: string, standardSetId: string) => {
    if (courseStandards[courseId] || loadingStandards[courseId]) return;
    
    setLoadingStandards(prev => ({ ...prev, [courseId]: true }));
    
    try {
      const response = await fetch(`/api/standards/course/${standardSetId}`);
      if (!response.ok) throw new Error('Failed to fetch standards');
      
      const data = await response.json();
      setCourseStandards(prev => ({ ...prev, [courseId]: data.standards }));
      setSelectedStandards(prev => ({ ...prev, [courseId]: data.defaultEnabled || [] }));
    } catch (error) {
      console.error(`Error fetching standards for course ${courseId}:`, error);
    } finally {
      setLoadingStandards(prev => ({ ...prev, [courseId]: false }));
    }
  };

  // Handle standards selection toggle
  const toggleStandardSelection = (courseId: string, standardCode: string) => {
    setSelectedStandards(prev => ({
      ...prev,
      [courseId]: prev[courseId]?.includes(standardCode)
        ? prev[courseId].filter(code => code !== standardCode)
        : [...(prev[courseId] || []), standardCode]
    }));
  };


  // Intelligent course matching based on classroom names
  const suggestCourseForClassroom = (classroomName: string): string | null => {
    if (!coursesToDisplay || coursesToDisplay.length === 0) return null;
    
    const name = classroomName.toLowerCase();
    
    // Define course matching patterns
    const coursePatterns = [
      { keywords: ['algebra 1', 'algebra i', 'alg 1', 'alg i'], courseTitle: 'Algebra 1' },
      { keywords: ['algebra 2', 'algebra ii', 'alg 2', 'alg ii'], courseTitle: 'Algebra 2' },
      { keywords: ['geometry', 'geom'], courseTitle: 'Geometry' },
      { keywords: ['pre-calculus', 'precalculus', 'pre calc', 'precalc'], courseTitle: 'Pre-Calculus' },
      { keywords: ['statistics', 'stats'], courseTitle: 'Statistics' },
      { keywords: ['calculus', 'calc'], courseTitle: 'Calculus' },
      { keywords: ['trigonometry', 'trig'], courseTitle: 'Trigonometry' }
    ];
    
    // Find matching course
    for (const pattern of coursePatterns) {
      if (pattern.keywords.some(keyword => name.includes(keyword))) {
        const matchingCourse = coursesToDisplay.find((course: any) => 
          course.title && course.title.toLowerCase().includes(pattern.courseTitle.toLowerCase())
        );
        return matchingCourse?.id || null;
      }
    }
    
    return null;
  };

  // Complete standards configuration mutation
  const completeConfigurationMutation = useMutation({
    mutationFn: (data: any) => apiRequest('PUT', '/api/user/complete-standards-configuration', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: "Configuration Complete!",
        description: "Welcome to Standards Sherpa! Your dashboard is ready.",
        variant: "default"
      });
      setLocation('/dashboard');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete configuration",
        variant: "destructive"
      });
    }
  });

  // Retry classroom import mutation
  const retryImportMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/auth/sync-classroom'),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/classrooms'] });
      toast({
        title: "Import Successful!",
        description: `Successfully imported ${data.classrooms?.length || 0} classrooms from Google Classroom.`,
        variant: "default"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import classrooms. Please try again or contact support.",
        variant: "destructive"
      });
    }
  });

  // Initialize course mappings when classrooms load
  useEffect(() => {
    if (classrooms && Array.isArray(classrooms)) {
      const initialMappings = classrooms.map((classroom: Classroom) => ({
        classroomId: classroom.id,
        selectedCourseId: '', // User will select
        enableSBG: false,
        selectedStandards: []
      }));
      setCourseMappings(initialMappings);
    }
  }, [classrooms]);

  const handleCourseMapping = (classroomId: string, courseId: string) => {
    setCourseMappings(prev => 
      prev.map(mapping => 
        mapping.classroomId === classroomId 
          ? { ...mapping, selectedCourseId: courseId }
          : mapping
      )
    );
  };

  const handleSBGToggle = (classroomId: string, enabled: boolean) => {
    setCourseMappings(prev => 
      prev.map(mapping => {
        if (mapping.classroomId === classroomId) {
          let suggestedCourseId = mapping.selectedCourseId;
          
          // Auto-suggest course when enabling SBG
          if (enabled && !suggestedCourseId) {
            const classroom = classrooms?.find((c: Classroom) => c.id === classroomId);
            if (classroom) {
              suggestedCourseId = suggestCourseForClassroom(classroom.name) || '';
            }
          }
          
          return { 
            ...mapping, 
            enableSBG: enabled, 
            selectedCourseId: suggestedCourseId 
          };
        }
        return mapping;
      })
    );
  };

  const handleCompleteConfiguration = () => {
    // Filter to only SBG-enabled courses with course mappings
    const sbgEnabledMappings = courseMappings.filter(mapping => mapping.enableSBG && mapping.selectedCourseId);
    
    // Validate that all SBG-enabled classrooms have course mappings
    const sbgWithoutMapping = courseMappings.filter(mapping => mapping.enableSBG && !mapping.selectedCourseId);
    
    if (sbgWithoutMapping.length > 0) {
      toast({
        title: "Course Mapping Required",
        description: "Please select a course for all SBG-enabled classrooms.",
        variant: "destructive"
      });
      return;
    }
    
    completeConfigurationMutation.mutate({
      standardsConfigurationCompleted: true,
      onboardingCompleted: true,
      courseMappings: sbgEnabledMappings
    });
  };

  const handleBack = () => {
    setLocation('/onboarding/role-selection');
  };

  const completedMappings = courseMappings.filter(m => m.enableSBG && m.selectedCourseId).length;
  const totalSBGEnabled = courseMappings.filter(m => m.enableSBG).length;

  // Group classrooms by course for standards configuration
  const courseGroups = courseMappings
    .filter(m => m.enableSBG && m.selectedCourseId)
    .reduce((groups, mapping) => {
      const course = coursesToDisplay.find(c => c.id === mapping.selectedCourseId);
      if (!course) return groups;
      
      if (!groups[course.id]) {
        groups[course.id] = {
          course,
          classrooms: [],
          selectedStandards: []
        };
      }
      
      const classroom = classrooms?.find(c => c.id === mapping.classroomId);
      if (classroom) {
        groups[course.id].classrooms.push(classroom);
      }
      
      return groups;
    }, {} as Record<string, { course: any, classrooms: any[], selectedStandards: string[] }>);

  // Check if ready to advance to standards phase
  const readyForStandards = totalSBGEnabled > 0 && completedMappings === totalSBGEnabled;

  // Fetch standards for all courses when entering standards configuration phase
  useEffect(() => {
    if (configurationPhase === 'standards') {
      const coursesToFetch = Object.entries(courseGroups).map(([courseId, group]) => ({
        id: courseId,
        standardSetId: group.course.standardSetId
      })).filter(course => course.standardSetId);

      coursesToFetch.forEach(course => {
        fetchStandardsForCourse(course.id, course.standardSetId);
      });
    }
  }, [configurationPhase, courseGroups]);

  // Show incomplete onboarding error
  if (!hasRequiredData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center max-w-2xl">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Incomplete Onboarding</h1>
          <p className="text-lg text-gray-600 mb-6">
            Please complete all onboarding steps before configuring classrooms.
          </p>
          <div className="bg-white rounded-lg p-6 mb-6 text-left">
            <h3 className="font-semibold text-gray-900 mb-3">Missing Information:</h3>
            <ul className="space-y-2">
              {!preferredJurisdiction && (
                <li className="flex items-center text-red-600">
                  <X className="h-4 w-4 mr-2" />
                  Standards jurisdiction not selected (Step 1)
                </li>
              )}
              {selectedSubjects.length === 0 && (
                <li className="flex items-center text-red-600">
                  <X className="h-4 w-4 mr-2" />
                  Subject areas not selected (Step 2)
                </li>
              )}
              {selectedGrades.length === 0 && (
                <li className="flex items-center text-red-600">
                  <X className="h-4 w-4 mr-2" />
                  Grade levels not selected (Step 3)
                </li>
              )}
            </ul>
          </div>
          <Button 
            onClick={() => setLocation('/onboarding/jurisdiction')}
            className="mr-4"
          >
            Complete Onboarding
          </Button>
          <Button 
            variant="outline"
            onClick={() => setLocation('/dashboard')}
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (classroomsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your classrooms...</p>
        </div>
      </div>
    );
  }

  // Show courses API error
  if (coursesError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center max-w-2xl">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Error Loading Courses</h1>
          <p className="text-lg text-gray-600 mb-6">
            {coursesError.message}
          </p>
          <Button 
            onClick={() => setLocation('/onboarding/jurisdiction')}
            className="mr-4"
          >
            Review Onboarding
          </Button>
          <Button 
            variant="outline"
            onClick={() => setLocation('/dashboard')}
          >
            Return to Dashboard
          </Button>
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
            <Settings className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Configure Standards</h1>
          <p className="text-xl text-gray-600">Set up Standards-Based Grading for your courses</p>
          
          {/* Progress Indicator - Step 6 of 6 */}
          <div className="mt-6 mb-4">
            <Progress value={100} className="w-full max-w-md mx-auto" />
            <p className="text-sm text-gray-500 mt-2">Step 6 of 6</p>
          </div>
        </div>

        {/* Configuration Cards */}
        <div className="space-y-6 mb-8">
          {configurationPhase === 'standards' && (
            <div className="text-center mb-6">
              <Button
                variant="outline"
                onClick={() => setConfigurationPhase('mapping')}
                className="mb-4"
              >
                ← Back to Course Mapping
              </Button>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Select Standards to Assess
              </h2>
              <p className="text-gray-600">
                Choose which specific standards you'll assess for each course
              </p>
            </div>
          )}

          {configurationPhase === 'standards' && Object.entries(courseGroups).map(([courseId, group]) => (
            <Card key={courseId} className="border-2 border-blue-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Target className="h-6 w-6 text-blue-600" />
                    <div>
                      <CardTitle className="text-xl">{group.course.title}</CardTitle>
                      <CardDescription>
                        {group.classrooms.length} section{group.classrooms.length !== 1 ? 's' : ''}: {group.classrooms.map(c => c.name).join(', ')}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingStandards[courseId] ? (
                  <div className="p-4 bg-gray-50 rounded-lg flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-gray-600">Loading standards...</span>
                  </div>
                ) : courseStandards[courseId] ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-900">Select Standards to Assess</h4>
                      <span className="text-xs text-gray-500">
                        {selectedStandards[courseId]?.length || 0} of {courseStandards[courseId]?.filter((standard: any) => {
                          // Only count actual assessable standards, not category headers
                          return standard.code && 
                                 standard.code.trim() !== '' && 
                                 standard.description && 
                                 standard.description.trim() !== '' &&
                                 !standard.code.toLowerCase().includes('category') &&
                                 !standard.code.toLowerCase().includes('domain') &&
                                 !standard.description.toLowerCase().includes('category') &&
                                 !standard.description.toLowerCase().includes('this domain includes');
                        }).length || 0} selected
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto border rounded-lg bg-gray-50">
                      {courseStandards[courseId]?.filter((standard: any) => {
                        // Only show actual assessable standards, not category headers
                        return standard.code && 
                               standard.code.trim() !== '' && 
                               standard.description && 
                               standard.description.trim() !== '' &&
                               !standard.code.toLowerCase().includes('category') &&
                               !standard.code.toLowerCase().includes('domain') &&
                               !standard.description.toLowerCase().includes('category') &&
                               !standard.description.toLowerCase().includes('this domain includes');
                      }).map((standard: any, index: number) => (
                        <label key={standard.code || index} className="flex items-start gap-3 p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0">
                          <input
                            type="checkbox"
                            checked={selectedStandards[courseId]?.includes(standard.code) || false}
                            onChange={() => toggleStandardSelection(courseId, standard.code)}
                            className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900">{standard.code}</div>
                            <div className="text-sm text-gray-600 line-clamp-2">{standard.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">No standards available for this course</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {/* No Classrooms Found - Show Import Options */}
          {configurationPhase === 'mapping' && Array.isArray(classrooms) && classrooms.length === 0 && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-6 w-6 text-yellow-600" />
                  <div>
                    <CardTitle className="text-yellow-900">No Classrooms Found</CardTitle>
                    <CardDescription className="text-yellow-700">
                      We couldn't find any Google Classroom classes in your account.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-white p-4 rounded-lg border border-yellow-200">
                  <p className="text-sm text-gray-700 mb-4">
                    This can happen if:
                  </p>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mb-4">
                    <li>You don't have any active classes in Google Classroom</li>
                    <li>Your classes are archived or inactive</li>
                    <li>There was a temporary issue during the import</li>
                  </ul>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => retryImportMutation.mutate()}
                      disabled={retryImportMutation.isPending}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                      data-testid="button-retry-import"
                    >
                      <RefreshCw className={`h-4 w-4 ${retryImportMutation.isPending ? 'animate-spin' : ''}`} />
                      {retryImportMutation.isPending ? 'Importing...' : 'Retry Import'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCompleteConfiguration}
                      disabled={completeConfigurationMutation.isPending}
                      data-testid="button-skip-classroom-setup"
                    >
                      Skip & Complete Setup
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {configurationPhase === 'mapping' && Array.isArray(classrooms) && classrooms.map((classroom: Classroom) => {
            const mapping = courseMappings.find(m => m.classroomId === classroom.id);
            
            return (
              <Card key={classroom.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Users className="h-6 w-6 text-blue-600" />
                      <div>
                        <CardTitle className="text-lg">{classroom.name}</CardTitle>
                        <CardDescription>
                          {classroom.section} • {classroom.studentCount} students
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {classroom.subjectArea === 'mathematics' ? 'Math' : classroom.subjectArea}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Enable SBG Toggle */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Target className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium">Enable Standards-Based Grading</p>
                        <p className="text-sm text-gray-600">Track student mastery of standards</p>
                      </div>
                    </div>
                    <Switch
                      checked={mapping?.enableSBG || false}
                      onCheckedChange={(checked) => handleSBGToggle(classroom.id, checked)}
                    />
                  </div>

                  {/* Course Selection */}
                  {mapping?.enableSBG && (
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-gray-700">
                        Which Standard Course does "{classroom.name}" represent?
                      </label>
                      <div className="space-y-2 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <BookOpen className="h-5 w-5 text-yellow-600" />
                          <span className="font-medium text-yellow-800">
                            Select from your onboarding courses:
                          </span>
                        </div>
                        {coursesLoading ? (
                          <div className="text-center py-4">
                            <p className="text-gray-600">Loading available courses...</p>
                          </div>
                        ) : coursesToDisplay && coursesToDisplay.length > 0 ? (
                          <div className="grid gap-2">
                            {coursesToDisplay.map((course: any) => (
                              <label
                                key={course.id}
                                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                                  mapping.selectedCourseId === course.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`course-${classroom.id}`}
                                  value={course.id}
                                  checked={mapping.selectedCourseId === course.id}
                                  onChange={() => handleCourseMapping(classroom.id, course.id)}
                                  className="mr-3"
                                />
                                <div className="flex items-center gap-2">
                                  <BookOpen className="h-4 w-4 text-gray-500" />
                                  <span className="font-medium">{course.title}</span>
                                  {course.description && (
                                    <span className="text-sm text-gray-500">• {course.description}</span>
                                  )}
                                </div>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <p className="text-gray-600 mb-2">No courses found from your onboarding.</p>
                            <p className="text-sm text-gray-500">
                              You may need to complete the courses step in onboarding first.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Summary and Completion */}
        <Card className="mb-8 border-green-200 bg-green-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-900">Configuration Summary</h3>
                <p className="text-sm text-green-700">
                  {totalSBGEnabled} classes enabled for Standards-Based Grading
                  {completedMappings > 0 && ` • ${completedMappings} course mappings completed`}
                </p>
              </div>
            </div>
            
            {configurationPhase === 'mapping' ? (
              <Button
                onClick={() => setConfigurationPhase('standards')}
                disabled={!readyForStandards}
                className="w-full bg-blue-600 hover:bg-blue-700"
                data-testid="button-configure-standards"
              >
                Configure Standards for Each Course →
              </Button>
            ) : (
              <Button
                onClick={handleCompleteConfiguration}
                disabled={completeConfigurationMutation.isPending}
                className="w-full bg-green-600 hover:bg-green-700"
                data-testid="button-complete-configuration"
              >
                {completeConfigurationMutation.isPending 
                  ? 'Completing Setup...' 
                  : 'Complete Setup & Go to Dashboard'
                }
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center">
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
            Enable SBG for at least one classroom to continue
          </div>
        </div>
      </div>
    </div>
  );
}