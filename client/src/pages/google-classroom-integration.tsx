import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, CheckCircle, Users, BookOpen, GraduationCap, Calendar, Clock, ExternalLink, Settings, Lightbulb, Target, FileText, Globe, ChevronDown, X, Plus, ChevronRight } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { GRADE_BANDS, getCoursesByGradeBand } from '@shared/standardsMatching';
import type { CommonCoreStandard } from '@shared/commonCoreStandards';

interface GoogleUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  googleId?: string;
  googleAccessToken?: string;
}

interface Classroom {
  id: string;
  name: string;
  section?: string;
  description?: string;
  ownerId: string;
  courseState: string;
  studentCount?: number;
  subjectArea?: string;
  detectedSubjectArea?: string;
  standardsJurisdiction?: string;
  sbgEnabled?: boolean;
  courseTitle?: string;
  enabledStandards?: string[];
  _classificationData?: {
    subjectArea: string;
    confidence: number;
    suggestedJurisdiction: string;
    detectedKeywords: string[];
  };
}


interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  photoUrl?: string;
}

interface Assignment {
  id: string;
  title: string;
  description?: string;
  state: string;
  workType: string;
  maxPoints?: string;
  dueDate?: string;
  creationTime?: string;
  updateTime?: string;
}

// New interfaces for Common Standards Project integration
interface CSPJurisdiction {
  id: string;
  title: string;
  type?: string;
}

interface CSPCourse {
  id: string;
  title: string;
  subject: string;
}

interface CSPGradeBandCourses {
  gradeBand: string;
  gradeLevels: string[];
  courses: CSPCourse[];
}

interface CSPStandard {
  id: string;
  code: string;
  title: string;
  description: string;
  gradeLevel: string;
  majorDomain: string;
  cluster: string;
}

export default function GoogleClassroomIntegration() {
  const [currentStep, setCurrentStep] = useState<'auth' | 'connecting' | 'connected'>('auth');
  const [selectedClassroom, setSelectedClassroom] = useState<string | null>(null);
  const [editingClassification, setEditingClassification] = useState<string | null>(null);
  
  // State for CSP standards configuration workflow
  const [configuringClassroom, setConfiguringClassroom] = useState<string | null>(null);
  const [configurationStep, setConfigurationStep] = useState<'jurisdiction' | 'standardSet' | 'standards'>('jurisdiction');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string | null>(null);
  const [selectedStandardSetId, setSelectedStandardSetId] = useState<string | null>(null);
  const [selectedStandardsMap, setSelectedStandardsMap] = useState<Record<string, boolean>>({});
  
  const queryClient = useQueryClient();
  
  // States for course configuration
  const [selectedClassroomForStandards, setSelectedClassroomForStandards] = useState<string | null>(null);
  const [courseTitleInput, setCourseTitleInput] = useState('');
  const [selectedStandards, setSelectedStandards] = useState<string[]>([]);

  // Subject areas and jurisdictions
  const subjectAreas = [
    { value: 'mathematics', label: 'Mathematics' },
    { value: 'english_language_arts', label: 'English Language Arts' },
    { value: 'science', label: 'Science' },
    { value: 'social_studies', label: 'Social Studies' },
    { value: 'computer_science', label: 'Computer Science' },
    { value: 'foreign_language', label: 'Foreign Language' },
    { value: 'health_physical_education', label: 'Health & Physical Education' },
    { value: 'arts', label: 'Arts' },
    { value: 'career_technical_education', label: 'Career & Technical Education' },
    { value: 'other', label: 'Other' }
  ];

  const standardsJurisdictions = [
    { value: 'common_core_math', label: 'Common Core Mathematics' },
    { value: 'common_core_ela', label: 'Common Core English Language Arts' },
    { value: 'ngss', label: 'Next Generation Science Standards (NGSS)' },
    { value: 'state_specific', label: 'State-Specific Standards' },
    { value: 'ap_standards', label: 'Advanced Placement (AP) Standards' },
    { value: 'ib_standards', label: 'International Baccalaureate (IB) Standards' },
    { value: 'custom', label: 'Custom Standards' }
  ];

  // Check current user authentication status
  const { data: user, isLoading: userLoading } = useQuery<GoogleUser>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  // Fetch classrooms once user is authenticated
  const { 
    data: classrooms = [], 
    isLoading: classroomsLoading, 
    refetch: refetchClassrooms 
  } = useQuery<Classroom[]>({
    queryKey: ['/api/classrooms'],
    enabled: !!user?.googleAccessToken,
  });

  // New queries for Common Standards Project integration
  const { data: jurisdictionsData } = useQuery<{jurisdictions: CSPJurisdiction[]}>({
    queryKey: ['/api/csp/jurisdictions'],
    enabled: !!user?.googleAccessToken,
  });

  const jurisdictions = jurisdictionsData?.jurisdictions || [];

  const { data: coursesData } = useQuery<{gradeBandCourses: CSPGradeBandCourses[]}>({
    queryKey: ['/api/csp/jurisdictions', selectedJurisdiction, 'courses'],
    enabled: !!selectedJurisdiction,
  });

  const gradeBandCourses = coursesData?.gradeBandCourses || [];

  const { data: cspStandardsData } = useQuery<{standards: CSPStandard[]}>({
    queryKey: ['/api/csp/courses', selectedStandardSetId, 'standards'],
    enabled: !!selectedStandardSetId,
  });

  const cspStandards = cspStandardsData?.standards || [];

  // Get selected classroom for standards configuration
  const configuringClassroomData = classrooms.find(c => c.id === configuringClassroom);

  // Fetch assignments for selected classroom
  const { data: assignments = [] } = useQuery<Assignment[]>({
    queryKey: ['/api/classrooms', selectedClassroom, 'assignments'],
    enabled: !!selectedClassroom,
  });

  // Fetch students for selected classroom
  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ['/api/classrooms', selectedClassroom, 'students'],
    enabled: !!selectedClassroom,
  });
  
  // Get classroom standards
  const classroomStandardsQuery = useQuery({
    queryKey: ['/api/classrooms', selectedClassroomForStandards, 'standards'],
    queryFn: async () => {
      if (!selectedClassroomForStandards) return null;
      const response = await fetch(`/api/classrooms/${selectedClassroomForStandards}/standards`);
      if (!response.ok) throw new Error('Failed to fetch classroom standards');
      return response.json();
    },
    enabled: !!selectedClassroomForStandards,
  });
  
  // Get standards for course title
  // Get available courses for selected grade band
  const availableCourses = selectedGradeBand ? getCoursesByGradeBand(selectedGradeBand) : [];

  const courseStandardsQuery = useQuery({
    queryKey: ['/api/standards/course-standards', selectedCourse, selectedClassroomForStandards],
    queryFn: async () => {
      if (!selectedCourse) return { standards: [], defaultEnabled: [] };
      
      const classroom = classrooms.find(c => c.id === selectedClassroomForStandards);
      if (!classroom) return { standards: [], defaultEnabled: [] };
      
      const params = new URLSearchParams({
        courseTitle: selectedCourse,
        jurisdiction: classroom.standardsJurisdiction || 'Common Core',
        subjectArea: classroom.subjectArea || '',
      });
      
      const response = await fetch(`/api/standards/course-standards?${params}`);
      if (!response.ok) throw new Error('Failed to fetch course standards');
      return response.json();
    },
    enabled: !!selectedCourse && !!selectedClassroomForStandards,
  });

  // Sync classrooms mutation
  const syncClassroomsMutation = useMutation({
    mutationFn: () => fetch('/api/auth/sync-classroom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/classrooms'] });
      setCurrentStep('connected');
    },
  });

  // Sync assignments mutation
  const syncAssignmentsMutation = useMutation({
    mutationFn: () => fetch('/api/assignments/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/classrooms'] });
    },
  });

  // Update classroom settings mutation
  const updateClassificationMutation = useMutation({
    mutationFn: async ({ classroomId, ...settings }: {
      classroomId: string;
      subjectArea?: string;
      standardsJurisdiction?: string;
      sbgEnabled?: boolean;
      courseTitle?: string;
      enabledStandards?: string[];
    }) => {
      const response = await fetch(`/api/classrooms/${classroomId}/classification`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update classroom');
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/classrooms'] });
      setEditingClassification(null);
    },
    onError: (error) => {
      console.error('SBG toggle update failed:', error);
    },
  });

  // Course configuration handlers
  const handleCourseConfigurationSave = async (classroomId: string) => {
    try {
      await updateClassificationMutation.mutateAsync({
        classroomId,
        courseTitle: selectedCourse || courseTitleInput,
        enabledStandards: selectedStandards
      });
      
      // Reset states and close dialog
      setSelectedClassroomForStandards(null);
      setCourseTitleInput('');
      setSelectedStandards([]);
      setSelectedGradeBand('');
      setSelectedCourse('');
    } catch (error) {
      console.error('Failed to save course configuration:', error);
    }
  };

  // Initialize course configuration when classroom is selected
  const initializeCourseConfiguration = (classroom: Classroom) => {
    setSelectedClassroomForStandards(classroom.id);
    setCourseTitleInput(classroom.courseTitle || '');
    setSelectedStandards(classroom.enabledStandards || []);
    // Reset dropdown selections
    setSelectedGradeBand('');
    setSelectedCourse('');
  };

  // Check authentication status and set current step
  useEffect(() => {
    if (user?.googleAccessToken) {
      if (classrooms.length > 0) {
        setCurrentStep('connected');
      } else {
        setCurrentStep('connecting');
      }
    } else {
      setCurrentStep('auth');
    }
  }, [user, classrooms]);

  const initiateGoogleAuth = () => {
    window.location.href = '/api/auth/google/full-integration';
  };

  const handleSyncClassrooms = () => {
    setCurrentStep('connecting');
    syncClassroomsMutation.mutate();
  };

  const handleSyncAssignments = () => {
    syncAssignmentsMutation.mutate();
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Google Classroom Integration</h1>
        <p className="text-gray-600">
          Connect your Google Classroom to sync classes, rosters, and assignments for seamless document analysis.
        </p>
      </div>

      {/* Authentication Step */}
      {currentStep === 'auth' && (
        <Card className="mb-6">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <GraduationCap className="h-6 w-6" />
              Connect to Google Classroom
            </CardTitle>
            <CardDescription>
              Authorize Standards Sherpa to access your Google Drive and Google Classroom data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>What we'll access:</strong>
                  <ul className="mt-2 ml-4 space-y-1 text-sm">
                    <li>• Google Drive: Create folders and files (only for documents we generate)</li>
                    <li>• Google Classroom: Read your classes, student rosters, and assignments</li>
                    <li>• Your Google profile information</li>
                  </ul>
                </AlertDescription>
              </Alert>
              
              <div className="text-center">
                <Button 
                  onClick={initiateGoogleAuth}
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Connect Google Account
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connecting Step */}
      {currentStep === 'connecting' && (
        <Card className="mb-6">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <BookOpen className="h-6 w-6" />
              Syncing Your Classroom Data
            </CardTitle>
            <CardDescription>
              We're fetching your classes, students, and assignments...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              {syncClassroomsMutation.isPending ? (
                <div className="space-y-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600">Syncing classroom data...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Google authentication successful! Click below to sync your classroom data.
                    </AlertDescription>
                  </Alert>
                  <Button 
                    onClick={handleSyncClassrooms}
                    disabled={syncClassroomsMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    Sync Classroom Data
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connected Step - Show Classroom Data */}
      {currentStep === 'connected' && (
        <>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Your Google Classroom Data</h2>
              <p className="text-gray-600">Manage your classes, students, and assignments</p>
            </div>
            <div className="space-x-2">
              <Button 
                onClick={handleSyncClassrooms}
                variant="outline"
                disabled={syncClassroomsMutation.isPending}
              >
                {syncClassroomsMutation.isPending ? 'Syncing...' : 'Refresh Classes'}
              </Button>
              <Button 
                onClick={handleSyncAssignments}
                variant="outline"
                disabled={syncAssignmentsMutation.isPending}
              >
                {syncAssignmentsMutation.isPending ? 'Syncing...' : 'Sync Assignments'}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Classrooms List */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Your Classes ({classrooms.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {classroomsLoading ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-sm text-gray-600">Loading classes...</p>
                    </div>
                  ) : classrooms.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No classes found</p>
                  ) : (
                    <div className="space-y-2">
                      {classrooms.map((classroom) => (
                        <div
                          key={classroom.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedClassroom === classroom.id
                              ? 'border-blue-500 bg-blue-50'
                              : classroom.sbgEnabled
                              ? 'border-green-300 bg-green-50 hover:border-green-400'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setSelectedClassroom(classroom.id)}
                        >
                          <h4 className="font-medium text-gray-900">{classroom.name}</h4>
                          {classroom.section && (
                            <p className="text-sm text-gray-600">{classroom.section}</p>
                          )}
                          
                          {/* SBG Toggle */}
                          <div className="mt-2 flex items-center gap-2 p-2 bg-gray-50 rounded border">
                            <Switch
                              checked={classroom.sbgEnabled || false}
                              onCheckedChange={(checked) => {
                                updateClassificationMutation.mutate({
                                  classroomId: classroom.id,
                                  sbgEnabled: checked
                                });
                              }}
                              disabled={updateClassificationMutation.isPending}
                              className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-300"
                            />
                            <Target className="w-4 h-4 text-emerald-600" />
                            <span className="text-sm font-medium text-gray-900">
                              Standards-Based Grading
                            </span>
                            {classroom.sbgEnabled && (
                              <Badge variant="default" className="text-xs bg-green-600 text-white">
                                SBG Active
                              </Badge>
                            )}
                          </div>
                          
                          {/* Course Configuration */}
                          <div className="mt-2 flex items-center gap-2 p-2 bg-blue-50 rounded border">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-gray-900">
                              Course Configuration
                            </span>
                            {classroom.courseTitle && (
                              <Badge variant="outline" className="text-xs">
                                {classroom.courseTitle}
                              </Badge>
                            )}
                            {classroom.enabledStandards && classroom.enabledStandards.length > 0 && (
                              <Badge variant="default" className="text-xs bg-blue-600 text-white">
                                {classroom.enabledStandards.length} Standards
                              </Badge>
                            )}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="ml-auto"
                                  onClick={() => initializeCourseConfiguration(classroom)}
                                >
                                  Configure
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                                <DialogHeader>
                                  <DialogTitle>Course Configuration - {classroom.name}</DialogTitle>
                                  <DialogDescription>
                                    Set your course title and select which standards to include in assessments.
                                  </DialogDescription>
                                </DialogHeader>
                                
                                <div className="flex-1 overflow-y-auto space-y-6">
                                  {/* Course Title Input */}
                                  {/* Grade Band Selection */}
                                  <div className="space-y-2">
                                    <Label htmlFor="grade-band">Grade Band</Label>
                                    <Select value={selectedGradeBand} onValueChange={(value) => {
                                      setSelectedGradeBand(value);
                                      setSelectedCourse(''); // Reset course selection
                                      setSelectedStandards([]); // Reset standards
                                    }}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select grade band" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {GRADE_BANDS.map((band) => (
                                          <SelectItem key={band.id} value={band.id}>
                                            {band.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                      Choose the appropriate grade level range
                                    </p>
                                  </div>

                                  {/* Course Selection */}
                                  {selectedGradeBand && (
                                    <div className="space-y-2">
                                      <Label htmlFor="course">Course</Label>
                                      <Select value={selectedCourse} onValueChange={(value) => {
                                        setSelectedCourse(value);
                                        setSelectedStandards([]); // Reset standards when course changes
                                      }}>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select course" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {availableCourses.map((course) => (
                                            <SelectItem key={course} value={course}>
                                              {course}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <p className="text-xs text-muted-foreground">
                                        Select your specific course to load relevant standards
                                      </p>
                                    </div>
                                  )}

                                  {/* Standards Selection */}
                                  {courseStandardsQuery.data && courseStandardsQuery.data.standards.length > 0 && (
                                    <div className="space-y-4">
                                      <div>
                                        <h4 className="text-sm font-medium mb-2">Available Standards</h4>
                                        <p className="text-xs text-muted-foreground mb-4">
                                          Select which standards to include in your assessments. All are enabled by default.
                                        </p>
                                      </div>
                                      
                                      <div className="max-h-64 overflow-y-auto border rounded-lg p-4">
                                        <div className="space-y-3">
                                          {courseStandardsQuery.data.standards.map((standard: CommonCoreStandard) => (
                                            <div key={standard.code} className="flex items-start space-x-3">
                                              <Switch
                                                id={`standard-${standard.code}`}
                                                checked={selectedStandards.includes(standard.code)}
                                                onCheckedChange={(checked) => {
                                                  if (checked) {
                                                    setSelectedStandards(prev => [...prev, standard.code]);
                                                  } else {
                                                    setSelectedStandards(prev => prev.filter(code => code !== standard.code));
                                                  }
                                                }}
                                              />
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center space-x-2">
                                                  <Badge variant="secondary" className="text-xs">
                                                    {standard.code}
                                                  </Badge>
                                                  <Badge variant="outline" className="text-xs">
                                                    Grade {standard.gradeLevel}
                                                  </Badge>
                                                </div>
                                                <p className="text-sm mt-1">{standard.description}</p>
                                                {standard.majorDomain && (
                                                  <p className="text-xs text-muted-foreground mt-1">
                                                    {standard.majorDomain}
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-center justify-between text-sm">
                                        <span>{selectedStandards.length} of {courseStandardsQuery.data.standards.length} standards selected</span>
                                        <div className="space-x-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setSelectedStandards([])}
                                          >
                                            Select None
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setSelectedStandards(courseStandardsQuery.data.standards.map((s: CommonCoreStandard) => s.code))}
                                          >
                                            Select All
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {selectedCourse && !courseStandardsQuery.isLoading && (!courseStandardsQuery.data || courseStandardsQuery.data.standards.length === 0) && (
                                    <Alert>
                                      <AlertCircle className="h-4 w-4" />
                                      <AlertDescription>
                                        No standards found for "{selectedCourse}". Try selecting a different course.
                                      </AlertDescription>
                                    </Alert>
                                  )}
                                  
                                  {courseStandardsQuery.isLoading && selectedCourse && (
                                    <div className="flex items-center justify-center py-8">
                                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                      <span className="ml-2 text-sm text-muted-foreground">Finding standards...</span>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex justify-end space-x-2 pt-4 border-t">
                                  <DialogTrigger asChild>
                                    <Button variant="outline">Cancel</Button>
                                  </DialogTrigger>
                                  <DialogTrigger asChild>
                                    <Button 
                                      onClick={() => handleCourseConfigurationSave(classroom.id)}
                                      disabled={!selectedCourse || updateClassificationMutation.isPending}
                                    >
                                      {updateClassificationMutation.isPending ? 'Saving...' : 'Save Configuration'}
                                    </Button>
                                  </DialogTrigger>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>

                          {/* Subject Area Classification */}
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center gap-2">
                              <Lightbulb className="w-3 h-3 text-blue-500" />
                              <span className="text-xs font-medium text-gray-700">
                                Subject: {subjectAreas.find(s => s.value === (classroom.subjectArea || classroom.detectedSubjectArea))?.label || 'Not classified'}
                              </span>
                              {classroom._classificationData && (
                                <Badge variant="outline" className="text-xs">
                                  {Math.round(classroom._classificationData.confidence * 100)}% confidence
                                </Badge>
                              )}
                            </div>
                            
                            {(classroom.standardsJurisdiction || classroom._classificationData?.suggestedJurisdiction) && (
                              <div className="flex items-center gap-2">
                                <GraduationCap className="w-3 h-3 text-green-500" />
                                <span className="text-xs text-gray-600">
                                  Standards: {standardsJurisdictions.find(j => j.value === (classroom.standardsJurisdiction || classroom._classificationData?.suggestedJurisdiction))?.label || 'Not set'}
                                </span>
                              </div>
                            )}
                            
                            {classroom.sbgEnabled && (
                              <div className="mt-2 p-2 bg-green-100 rounded border border-green-200">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-green-800">
                                    SBG Configuration
                                  </span>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfiguringClassroom(classroom.id);
                                      setConfigurationStep('jurisdiction');
                                      setSelectedJurisdiction(null);
                                      setSelectedStandardSetId(null);
                                      setSelectedStandardsMap({});
                                    }}
                                    className="text-xs text-green-700 hover:text-green-900 underline"
                                  >
                                    Configure Standards
                                  </button>
                                </div>
                              </div>
                            )}
                            
                            {!classroom.sbgEnabled && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingClassification(classroom.id);
                                }}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1"
                              >
                                <Settings className="w-3 h-3" />
                                Edit Classification
                              </button>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {classroom.courseState}
                            </Badge>
                            {classroom.studentCount && (
                              <span className="text-xs text-gray-500">
                                {classroom.studentCount} students
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Classroom Details */}
            <div className="lg:col-span-2">
              {selectedClassroom ? (
                <Tabs defaultValue="assignments" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="assignments">Assignments</TabsTrigger>
                    <TabsTrigger value="students">Students</TabsTrigger>
                  </TabsList>

                  <TabsContent value="assignments">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Calendar className="h-5 w-5" />
                          Assignments ({assignments.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {assignments.length === 0 ? (
                          <p className="text-gray-500 text-center py-8">No assignments found</p>
                        ) : (
                          <div className="space-y-4">
                            {assignments.map((assignment) => (
                              <div key={assignment.id} className="border rounded-lg p-4">
                                <div className="flex justify-between items-start mb-2">
                                  <h4 className="font-medium text-gray-900">{assignment.title}</h4>
                                  <div className="flex gap-2">
                                    <Badge variant="outline">{assignment.workType}</Badge>
                                    <Badge variant={assignment.state === 'PUBLISHED' ? 'default' : 'secondary'}>
                                      {assignment.state}
                                    </Badge>
                                  </div>
                                </div>
                                {assignment.description && (
                                  <p className="text-sm text-gray-600 mb-2">{assignment.description}</p>
                                )}
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  {assignment.maxPoints && (
                                    <span>Max Points: {assignment.maxPoints}</span>
                                  )}
                                  {assignment.dueDate && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      Due: {new Date(assignment.dueDate).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="students">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="h-5 w-5" />
                          Students ({students.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {students.length === 0 ? (
                          <p className="text-gray-500 text-center py-8">No students found</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {students.map((student) => (
                              <div key={student.id} className="flex items-center gap-3 p-3 border rounded-lg">
                                {student.photoUrl ? (
                                  <img
                                    src={student.photoUrl}
                                    alt={`${student.firstName} ${student.lastName}`}
                                    className="w-8 h-8 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                    <span className="text-xs font-medium text-gray-600">
                                      {student.firstName[0]}{student.lastName[0]}
                                    </span>
                                  </div>
                                )}
                                <div>
                                  <h4 className="font-medium text-gray-900">
                                    {student.firstName} {student.lastName}
                                  </h4>
                                  {student.email && (
                                    <p className="text-sm text-gray-600">{student.email}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <div className="text-center text-gray-500">
                      <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>Select a class to view details</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}

      {/* Classification Edit Dialog */}
      {editingClassification && (
        <ClassificationEditDialog
          classroom={classrooms.find(c => c.id === editingClassification)!}
          subjectAreas={subjectAreas}
          standardsJurisdictions={standardsJurisdictions}
          onSave={(subjectArea, standardsJurisdiction, sbgEnabled) => {
            updateClassificationMutation.mutate({
              classroomId: editingClassification,
              subjectArea,
              standardsJurisdiction,
              sbgEnabled
            });
          }}
          onCancel={() => setEditingClassification(null)}
          isLoading={updateClassificationMutation.isPending}
        />
      )}

      {/* CSP Standards Configuration Dialog */}
      {configuringClassroom && configuringClassroomData && (
        <StandardsConfigurationDialog
          classroom={configuringClassroomData}
          step={configurationStep}
          jurisdictions={jurisdictions}
          selectedJurisdiction={selectedJurisdiction}
          gradeBandCourses={gradeBandCourses}
          selectedStandardSetId={selectedStandardSetId}
          cspStandards={cspStandards}
          selectedStandardsMap={selectedStandardsMap}
          onStepChange={setConfigurationStep}
          onJurisdictionSelect={setSelectedJurisdiction}
          onStandardSetSelect={setSelectedStandardSetId}
          onStandardsChange={setSelectedStandardsMap}
          onClose={() => {
            setConfiguringClassroom(null);
            setConfigurationStep('jurisdiction');
            setSelectedJurisdiction(null);
            setSelectedStandardSetId(null);
            setSelectedStandardsMap({});
          }}
          onSave={() => {
            // TODO: Save selected standards to classroom
            console.log('Saving standards configuration:', {
              classroomId: configuringClassroom,
              jurisdictionId: selectedJurisdiction,
              standardSetId: selectedStandardSetId,
              selectedStandards: Object.keys(selectedStandardsMap).filter(id => selectedStandardsMap[id])
            });
            setConfiguringClassroom(null);
          }}
        />
      )}
    </div>
  );
}

// Classification Edit Dialog Component
function ClassificationEditDialog({
  classroom,
  subjectAreas,
  standardsJurisdictions,
  onSave,
  onCancel,
  isLoading
}: {
  classroom: Classroom;
  subjectAreas: Array<{value: string; label: string}>;
  standardsJurisdictions: Array<{value: string; label: string}>;
  onSave: (subjectArea: string, standardsJurisdiction: string, sbgEnabled: boolean) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [selectedSubject, setSelectedSubject] = useState(
    classroom.subjectArea || classroom.detectedSubjectArea || ''
  );
  const [selectedJurisdiction, setSelectedJurisdiction] = useState(
    classroom.standardsJurisdiction || classroom._classificationData?.suggestedJurisdiction || ''
  );
  const [sbgEnabled, setSbgEnabled] = useState(classroom.sbgEnabled || false);

  const handleSave = () => {
    if (selectedSubject && selectedJurisdiction) {
      onSave(selectedSubject, selectedJurisdiction, sbgEnabled);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Classroom Settings</DialogTitle>
          <DialogDescription>
            Update the subject area, standards jurisdiction, and SBG settings for "{classroom.name}"
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Current AI Detection Info */}
          {classroom._classificationData && (
            <Alert>
              <Lightbulb className="h-4 w-4" />
              <AlertDescription>
                <strong>AI Detection:</strong> {subjectAreas.find(s => s.value === classroom._classificationData?.subjectArea)?.label} 
                ({Math.round(classroom._classificationData.confidence * 100)}% confidence)
                {classroom._classificationData.detectedKeywords.length > 0 && (
                  <div className="mt-1 text-xs">
                    Keywords: {classroom._classificationData.detectedKeywords.join(', ')}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="subject-area">Subject Area</Label>
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Select subject area" />
              </SelectTrigger>
              <SelectContent>
                {subjectAreas.map((subject) => (
                  <SelectItem key={subject.value} value={subject.value}>
                    {subject.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="standards-jurisdiction">Standards Jurisdiction</Label>
            <Select value={selectedJurisdiction} onValueChange={setSelectedJurisdiction}>
              <SelectTrigger>
                <SelectValue placeholder="Select standards jurisdiction" />
              </SelectTrigger>
              <SelectContent>
                {standardsJurisdictions.map((jurisdiction) => (
                  <SelectItem key={jurisdiction.value} value={jurisdiction.value}>
                    {jurisdiction.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded border">
              <Switch
                id="sbg-enabled"
                checked={sbgEnabled}
                onCheckedChange={setSbgEnabled}
                className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-300"
              />
              <Label htmlFor="sbg-enabled" className="flex items-center gap-2 text-gray-900 font-medium">
                <Target className="w-4 h-4 text-emerald-600" />
                Enable Standards-Based Grading
              </Label>
            </div>
            {sbgEnabled && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-800">
                  <strong>Standards-Based Grading Enabled</strong><br />
                  This classroom will use SBG methodology for document analysis and assessment generation.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!selectedSubject || !selectedJurisdiction || isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Standards Configuration Dialog Component - CSP Workflow
function StandardsConfigurationDialog({
  classroom,
  step,
  jurisdictions,
  selectedJurisdiction,
  gradeBandCourses,
  selectedStandardSetId,
  cspStandards,
  selectedStandardsMap,
  onStepChange,
  onJurisdictionSelect,
  onStandardSetSelect,
  onStandardsChange,
  onClose,
  onSave
}: {
  classroom: Classroom;
  step: 'jurisdiction' | 'standardSet' | 'standards';
  jurisdictions: CSPJurisdiction[];
  selectedJurisdiction: string | null;
  gradeBandCourses: CSPGradeBandCourses[];
  selectedStandardSetId: string | null;
  cspStandards: CSPStandard[];
  selectedStandardsMap: Record<string, boolean>;
  onStepChange: (step: 'jurisdiction' | 'standardSet' | 'standards') => void;
  onJurisdictionSelect: (jurisdictionId: string) => void;
  onStandardSetSelect: (standardSetId: string) => void;
  onStandardsChange: (standardsMap: Record<string, boolean>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  
  // Auto-advance workflow steps
  const handleJurisdictionSelect = (jurisdictionId: string) => {
    onJurisdictionSelect(jurisdictionId);
    onStepChange('standardSet');
  };

  const handleStandardSetSelect = (standardSetId: string) => {
    onStandardSetSelect(standardSetId);
    onStepChange('standards');
    
    // Default all standards to "on" when moving to standards step
    const defaultStandardsMap: Record<string, boolean> = {};
    cspStandards.forEach(standard => {
      defaultStandardsMap[standard.id] = true;
    });
    onStandardsChange(defaultStandardsMap);
  };

  const toggleStandard = (standardId: string) => {
    const newMap = { ...selectedStandardsMap };
    newMap[standardId] = !newMap[standardId];
    onStandardsChange(newMap);
  };

  const selectedJurisdictionData = jurisdictions.find(j => j.id === selectedJurisdiction);
  const selectedStandardSet = gradeBandCourses
    .flatMap(gb => gb.courses)
    .find(course => course.id === selectedStandardSetId);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            Standards Configuration: {classroom.name}
          </DialogTitle>
          <DialogDescription>
            Configure educational standards for Standards-Based Grading
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex items-center justify-between mb-6 p-3 bg-gray-50 rounded-lg">
          <div className={`flex items-center gap-2 ${step === 'jurisdiction' ? 'text-blue-600 font-semibold' : step === 'standardSet' || step === 'standards' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'jurisdiction' ? 'bg-blue-600 text-white' : step === 'standardSet' || step === 'standards' ? 'bg-green-600 text-white' : 'bg-gray-300'}`}>1</div>
            <span className="text-sm">Select Jurisdiction</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <div className={`flex items-center gap-2 ${step === 'standardSet' ? 'text-blue-600 font-semibold' : step === 'standards' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'standardSet' ? 'bg-blue-600 text-white' : step === 'standards' ? 'bg-green-600 text-white' : 'bg-gray-300'}`}>2</div>
            <span className="text-sm">Select Standard Set</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <div className={`flex items-center gap-2 ${step === 'standards' ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'standards' ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>3</div>
            <span className="text-sm">Select Standards</span>
          </div>
        </div>

        <div className="space-y-6">
          {/* Step 1: Jurisdiction Selection */}
          {step === 'jurisdiction' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Step 1: Select Educational Jurisdiction</h3>
                <p className="text-sm text-gray-600 mb-4">Choose your state or educational organization to access their official standards.</p>
              </div>
              
              <div className="space-y-2">
                <Label>Educational Jurisdiction</Label>
                <Select value={selectedJurisdiction || ''} onValueChange={handleJurisdictionSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your state or organization..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {jurisdictions.map((jurisdiction) => (
                      <SelectItem key={jurisdiction.id} value={jurisdiction.id}>
                        {jurisdiction.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {selectedJurisdictionData && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Selected:</strong> {selectedJurisdictionData.title}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Standard Set Selection */}
          {step === 'standardSet' && selectedJurisdictionData && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Step 2: Select Standard Set</h3>
                <p className="text-sm text-gray-600 mb-2">Choose the specific course or grade level that applies to this classroom.</p>
                <p className="text-xs text-gray-500">Jurisdiction: <strong>{selectedJurisdictionData.title}</strong></p>
              </div>
              
              {gradeBandCourses.map((gradeBand) => (
                <div key={gradeBand.gradeBand} className="space-y-2">
                  <h4 className="font-medium text-gray-900">{gradeBand.gradeBand}</h4>
                  <div className="grid gap-2">
                    {gradeBand.courses.map((course) => (
                      <button
                        key={course.id}
                        onClick={() => handleStandardSetSelect(course.id)}
                        className="p-3 text-left border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                      >
                        <div className="font-medium">{course.title}</div>
                        <div className="text-sm text-gray-600">{course.subject}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step 3: Standards Selection */}
          {step === 'standards' && selectedStandardSet && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Step 3: Select Essential Standards</h3>
                <p className="text-sm text-gray-600 mb-2">All standards are enabled by default. Turn off any that are not essential for your classroom.</p>
                <p className="text-xs text-gray-500">
                  Course: <strong>{selectedStandardSet.title}</strong> | 
                  Jurisdiction: <strong>{selectedJurisdictionData?.title}</strong>
                </p>
              </div>
              
              <div className="max-h-96 overflow-y-auto border rounded-lg">
                <div className="space-y-1">
                  {cspStandards.map((standard) => (
                    <div
                      key={standard.id}
                      className={`p-3 border-b last:border-b-0 ${selectedStandardsMap[standard.id] ? 'bg-green-50' : 'bg-gray-50'}`}
                    >
                      <div className="flex items-start gap-3">
                        <Switch
                          checked={selectedStandardsMap[standard.id] || false}
                          onCheckedChange={() => toggleStandard(standard.id)}
                          className="data-[state=checked]:bg-green-600 mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {standard.code && <span className="text-blue-600">{standard.code}: </span>}
                            {standard.title}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {standard.description}
                          </div>
                          {standard.gradeLevel && (
                            <div className="text-xs text-gray-500 mt-1">
                              Grade: {standard.gradeLevel}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-800">
                  <strong>{Object.values(selectedStandardsMap).filter(Boolean).length}</strong> of {cspStandards.length} standards selected
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Dialog Actions */}
        <div className="flex justify-between pt-6 border-t">
          <div className="flex gap-2">
            {step !== 'jurisdiction' && (
              <Button
                variant="outline"
                onClick={() => {
                  if (step === 'standardSet') {
                    onStepChange('jurisdiction');
                    onStandardSetSelect('');
                  } else if (step === 'standards') {
                    onStepChange('standardSet');
                    onStandardsChange({});
                  }
                }}
              >
                ← Back
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {step === 'standards' && (
              <Button onClick={onSave} disabled={Object.values(selectedStandardsMap).filter(Boolean).length === 0}>
                Save Configuration
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}