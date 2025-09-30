import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
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
// Legacy hardcoded standards imports removed - now using CSP API
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

// Helper function to extract core course name for grouping
const extractCoreCourseName = (classroomName: string): string => {
  const cleaned = classroomName
    .replace(/\s*-\s*(period|pd|per|p)\s*\d+.*$/i, '') // "- Period 1", "- Pd 2"
    .replace(/\s*\((period|pd|per|p)?\s*\d+[^)]*\)/i, '') // "(Period 1)", "(Pd 2)"
    .replace(/\s+(period|pd|per|p)\s*\d+.*$/i, '') // "Period 1", "Pd 2"  
    .replace(/\s*-\s*section\s*[a-z0-9]+.*$/i, '') // "- Section A"
    .replace(/\s*\(section\s*[a-z0-9]+[^)]*\)/i, '') // "(Section A)"
    .replace(/\s+section\s*[a-z0-9]+.*$/i, '') // "Section A"
    .replace(/\s*-\s*[^-]*\s*-\s*\d+$/i, '') // "- Fielder - 01" pattern (fixed to handle any text between dashes)
    .replace(/\s*-\s*\d+$/i, '') // Generic "- 01", "- 1" at end
    .replace(/\s*-\s*[a-z0-9]+$/i, '') // Generic "- A" at end
    .replace(/\s*\([a-z0-9]+\)$/i, '') // Generic "(A)", "(1)" at end
    .trim();
  
  // Debug logging (temporary)
  console.log(`Grouping "${classroomName}" -> "${cleaned}"`);
  
  return cleaned || classroomName; // Fallback to original name
};

// Helper function to group classrooms by core course name
const groupClassrooms = (classrooms: Classroom[]): Array<{
  coreCourseName: string;
  classrooms: Classroom[];
}> => {
  console.log(`groupClassrooms called with ${classrooms.length} classrooms:`, classrooms.map(c => c.name));
  
  const groups = new Map<string, Classroom[]>();
  
  classrooms.forEach(classroom => {
    const coreCourseName = extractCoreCourseName(classroom.name);
    if (!groups.has(coreCourseName)) {
      groups.set(coreCourseName, []);
    }
    groups.get(coreCourseName)!.push(classroom);
  });
  
  const result = Array.from(groups.entries()).map(([coreCourseName, classrooms]) => ({
    coreCourseName,
    classrooms
  }));
  
  console.log(`groupClassrooms returning ${result.length} groups:`, result.map(g => `${g.coreCourseName} (${g.classrooms.length} sections)`));
  
  return result;
};

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
  
  // State for bulk configuration suggestions
  const [bulkConfigSuggestions, setBulkConfigSuggestions] = useState<any[]>([]);
  const [showBulkConfigDialog, setShowBulkConfigDialog] = useState(false);
  const [bulkConfiguringClassrooms, setBulkConfiguringClassrooms] = useState<string[]>([]);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
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

  // Debug logging (proper way)
  useEffect(() => {
    console.log('Render state:', { 
      classroomsLoading, 
      classroomsLength: classrooms.length, 
      classrooms: classrooms.map(c => c.name) 
    });
  }, [classroomsLoading, classrooms]);

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
  
  // Legacy hardcoded standards system removed - now using CSP workflow

  // Sync classrooms mutation
  const syncClassroomsMutation = useMutation({
    mutationFn: () => fetch('/api/auth/sync-classroom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(res => res.json()),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['/api/classrooms'] });
      setCurrentStep('connected');
      
      // Handle bulk configuration suggestions
      if (response.bulkConfigurationSuggestions && response.bulkConfigurationSuggestions.length > 0) {
        setBulkConfigSuggestions(response.bulkConfigurationSuggestions);
        setShowBulkConfigDialog(true);
        
        // Show toast notification about similar courses found
        toast({
          title: "Similar Courses Detected",
          description: `Found ${response.bulkConfigurationSuggestions.length} group(s) of similar courses. Configure them all at once!`,
          duration: 5000,
        });
      }
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

  // Mutation for saving standards configuration with similarity matching
  const saveStandardsConfigMutation = useMutation({
    mutationFn: async (data: {
      classroomId: string;
      jurisdictionId: string;
      standardSetId: string;
      selectedStandards: string[];
      courseTitle: string;
    }) => {
      const response = await fetch(`/api/classrooms/${data.classroomId}/standards-configuration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jurisdictionId: data.jurisdictionId,
          standardSetId: data.standardSetId,
          selectedStandards: data.selectedStandards,
          courseTitle: data.courseTitle
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save standards configuration');
      }

      return result;
    },
    onSuccess: (response) => {
      // Show feedback about similar classrooms that were auto-configured
      if (response.similarClassroomsUpdated && response.similarClassroomsUpdated.length > 0) {
        toast({
          title: "Configuration Applied to Similar Classrooms",
          description: `Standards configuration applied to ${response.similarClassroomsUpdated.length} similar classroom(s): ${response.similarClassroomsUpdated.map((c: any) => c.name).join(', ')}`,
          duration: 6000,
        });
      } else {
        toast({
          title: "Standards Configuration Saved",
          description: "Successfully configured classroom standards and enabled Standards-Based Grading.",
        });
      }
      
      // Refresh classroom list to show updated configurations
      queryClient.invalidateQueries({ queryKey: ['/api/classrooms'] }).then(() => {
        // After refresh, check for other similar unconfigured courses
        setTimeout(() => {
          const currentClassrooms = queryClient.getQueryData(['/api/classrooms']) as Classroom[] || [];
          const groupedClassrooms = groupClassrooms(currentClassrooms);
          
          // Find groups with unconfigured classrooms (always check for other unconfigured groups)
          const unconfiguredGroups = groupedClassrooms
            .filter(group => group.classrooms.some(c => 
              !c.sbgEnabled || !c.enabledStandards || c.enabledStandards.length === 0
            ))
            .map(group => ({
              coreCourseName: group.coreCourseName,
              classrooms: group.classrooms
                .filter(c => !c.sbgEnabled || !c.enabledStandards || c.enabledStandards.length === 0)
                .map(c => ({
                  id: c.id,
                  name: c.name,
                  section: c.section
                })),
              count: group.classrooms.filter(c => 
                !c.sbgEnabled || !c.enabledStandards || c.enabledStandards.length === 0
              ).length
            }))
            .filter(group => group.count > 0); // Only groups with unconfigured courses

          // If there are unconfigured groups, proactively show bulk configuration
          if (unconfiguredGroups.length > 0) {
            setBulkConfigSuggestions(unconfiguredGroups);
            setShowBulkConfigDialog(true);
          }
        }, 500); // Small delay to ensure data is refreshed
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save standards configuration",
        variant: "destructive",
      });
    },
  });

  // Legacy course configuration handlers removed - now using CSP workflow

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
                    <div className="space-y-4">
                      {/* Grouped Classroom Display */}
                      {groupClassrooms(classrooms).map((group) => (
                        <div key={group.coreCourseName} className="border rounded-lg bg-white shadow-sm">
                          {/* Group Header */}
                          <div className="bg-slate-50 px-4 py-3 rounded-t-lg border-b">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-semibold text-gray-900">{group.coreCourseName}</h3>
                                <p className="text-sm text-gray-600">
                                  {group.classrooms.length} section{group.classrooms.length === 1 ? '' : 's'}
                                  {group.classrooms.some(c => c.sbgEnabled) && (
                                    <Badge variant="default" className="ml-2 text-xs bg-green-600 text-white">
                                      SBG Enabled
                                    </Badge>
                                  )}
                                  {group.classrooms.some(c => c.enabledStandards && c.enabledStandards.length > 0) && (
                                    <Badge variant="outline" className="ml-2 text-xs">
                                      Standards Configured
                                    </Badge>
                                  )}
                                </p>
                              </div>
                              {group.classrooms.length > 1 && (
                                <div className="flex items-center gap-2">
                                  <div className="text-sm text-gray-500">
                                    Similar Course Group
                                  </div>
                                  {/* Show configure button if some courses in group are unconfigured */}
                                  {group.classrooms.some(c => !c.sbgEnabled || !c.enabledStandards || c.enabledStandards.length === 0) && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const unconfiguredClassrooms = group.classrooms.filter(c => 
                                          !c.sbgEnabled || !c.enabledStandards || c.enabledStandards.length === 0
                                        );
                                        setBulkConfigSuggestions([{
                                          coreCourseName: group.coreCourseName,
                                          classrooms: unconfiguredClassrooms.map(c => ({
                                            id: c.id,
                                            name: c.name,
                                            section: c.section
                                          })),
                                          count: unconfiguredClassrooms.length
                                        }]);
                                        setShowBulkConfigDialog(true);
                                      }}
                                      className="text-xs"
                                    >
                                      Configure Similar Courses
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Group Sections */}
                          <div className="p-4 space-y-3">
                            {group.classrooms.map((classroom) => (
                              <div
                                key={classroom.id}
                                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                  selectedClassroom === classroom.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : classroom.sbgEnabled
                                    ? 'border-green-300 bg-green-50 hover:border-green-400'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                                onClick={() => {
                                  // Check if this classroom needs configuration
                                  const needsConfiguration = !classroom.sbgEnabled || !classroom.enabledStandards || classroom.enabledStandards.length === 0;
                                  
                                  if (needsConfiguration) {
                                    // Find if there are similar courses that also need configuration
                                    const allGroups = groupClassrooms(classrooms);
                                    const myGroup = allGroups.find(g => g.classrooms.some(c => c.id === classroom.id));
                                    
                                    if (myGroup) {
                                      const unconfiguredInGroup = myGroup.classrooms.filter(c => 
                                        !c.sbgEnabled || !c.enabledStandards || c.enabledStandards.length === 0
                                      );
                                      
                                      // Always show configuration dialog for unconfigured courses
                                      // Whether it's 1 course or multiple, we present the configuration options
                                      setBulkConfigSuggestions([{
                                        coreCourseName: myGroup.coreCourseName,
                                        classrooms: unconfiguredInGroup.map(c => ({
                                          id: c.id,
                                          name: c.name,
                                          section: c.section
                                        })),
                                        count: unconfiguredInGroup.length
                                      }]);
                                      setShowBulkConfigDialog(true);
                                      return;
                                    }
                                  }
                                  
                                  // For configured courses, just select normally
                                  setSelectedClassroom(classroom.id);
                                }}
                              >
                                <h4 className="font-medium text-gray-900">{classroom.name}</h4>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {classroom.courseState}
                                  </Badge>
                                  {classroom.sbgEnabled && (
                                    <Badge variant="default" className="text-xs bg-green-600 text-white">
                                      SBG Active
                                    </Badge>
                                  )}
                                  {classroom.enabledStandards && classroom.enabledStandards.length > 0 && (
                                    <Badge variant="outline" className="text-xs">
                                      {classroom.enabledStandards.length} Standards
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
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
          isBulkConfiguration={bulkConfiguringClassrooms.length > 0}
          bulkClassroomCount={bulkConfiguringClassrooms.length}
          onStepChange={setConfigurationStep}
          onJurisdictionSelect={setSelectedJurisdiction}
          onStandardSetSelect={setSelectedStandardSetId}
          onStandardsChange={setSelectedStandardsMap}
          onClose={() => {
            setConfiguringClassroom(null);
            setBulkConfiguringClassrooms([]);
            setConfigurationStep('jurisdiction');
            setSelectedJurisdiction(null);
            setSelectedStandardSetId(null);
            setSelectedStandardsMap({});
          }}
          onSave={() => {
            if (!configuringClassroom || !selectedJurisdiction || !selectedStandardSetId) return;
            
            // Get the selected course title for display
            const selectedStandardSet = gradeBandCourses
              .flatMap(gb => gb.courses)
              .find(course => course.id === selectedStandardSetId);
            
            // Get enabled standards (defaults to all if none explicitly disabled)
            const enabledStandards = cspStandards
              .filter(standard => selectedStandardsMap[standard.id] ?? true)
              .map(standard => standard.code);
            
            // If this is bulk configuration, handle all classrooms in the group
            if (bulkConfiguringClassrooms.length > 0) {
              // Save configuration for all classrooms in the bulk group
              Promise.all(
                bulkConfiguringClassrooms.map(classroomId =>
                  saveStandardsConfigMutation.mutateAsync({
                    classroomId,
                    jurisdictionId: selectedJurisdiction,
                    standardSetId: selectedStandardSetId,
                    selectedStandards: enabledStandards,
                    courseTitle: selectedStandardSet?.title || 'Unknown Course'
                  })
                )
              ).then((responses) => {
                // Show special success message for bulk configuration
                const totalClassrooms = responses.reduce((sum, response) => {
                  return sum + 1 + (response.similarClassroomsUpdated?.length || 0);
                }, 0);
                
                toast({
                  title: "Bulk Configuration Complete",
                  description: `Successfully configured standards and enabled SBG for ${totalClassrooms} classroom(s) in this course group.`,
                  duration: 6000,
                });
                
                // Reset bulk configuration state
                setBulkConfiguringClassrooms([]);
              }).catch((error) => {
                toast({
                  title: "Bulk Configuration Failed", 
                  description: error.message || "Failed to save bulk standards configuration",
                  variant: "destructive",
                });
              });
            } else {
              // Regular single classroom configuration
              saveStandardsConfigMutation.mutate({
                classroomId: configuringClassroom,
                jurisdictionId: selectedJurisdiction,
                standardSetId: selectedStandardSetId,
                selectedStandards: enabledStandards,
                courseTitle: selectedStandardSet?.title || 'Unknown Course'
              });
            }
            
            // Close dialog
            setConfiguringClassroom(null);
            setConfigurationStep('jurisdiction');
            setSelectedJurisdiction(null);
            setSelectedStandardSetId(null);
            setSelectedStandardsMap({});
          }}
        />
      )}
      
      {/* Bulk Configuration Suggestions Dialog */}
      {showBulkConfigDialog && bulkConfigSuggestions.length > 0 && (
        <Dialog open={showBulkConfigDialog} onOpenChange={setShowBulkConfigDialog}>
          <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                Similar Courses Detected
              </DialogTitle>
              <DialogDescription>
                We found courses with similar names. Configure them all at the same time to save time!
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {bulkConfigSuggestions.map((suggestion, index) => (
                <div key={index} className="border rounded-lg p-4 bg-blue-50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {suggestion.coreCourseName}
                    </h3>
                    <Badge variant="secondary" className="text-sm">
                      {suggestion.count || (suggestion.classrooms ? suggestion.classrooms.length : 0)} sections
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                    {(suggestion.classrooms || []).map((classroom: any) => (
                      <div key={classroom.id} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        <span className="font-medium">{classroom.name}</span>
                        {classroom.section && (
                          <span className="text-gray-600">({classroom.section})</span>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <Button
                    onClick={() => {
                      // Set up bulk configuration for this group
                      const classrooms = suggestion.classrooms || [];
                      setBulkConfiguringClassrooms(classrooms.map((c: any) => c.id));
                      setConfiguringClassroom(classrooms[0]?.id); // Use first classroom as primary
                      setShowBulkConfigDialog(false);
                      setConfigurationStep('jurisdiction');
                      setSelectedJurisdiction(null);
                      setSelectedStandardSetId(null);
                      setSelectedStandardsMap({});
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Configure All {suggestion.count || (suggestion.classrooms ? suggestion.classrooms.length : 0)} Sections
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setShowBulkConfigDialog(false)}>
                Configure Later
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
  isBulkConfiguration = false,
  bulkClassroomCount = 0,
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
  isBulkConfiguration?: boolean;
  bulkClassroomCount?: number;
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
            {isBulkConfiguration 
              ? `Bulk Standards Configuration (${bulkClassroomCount} classrooms)`
              : `Standards Configuration: ${classroom.name}`
            }
          </DialogTitle>
          <DialogDescription>
            {isBulkConfiguration
              ? `Configure standards for all ${bulkClassroomCount} sections at once for Standards-Based Grading`
              : "Configure educational standards for Standards-Based Grading"
            }
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
                      className={`p-3 border-b last:border-b-0 ${(selectedStandardsMap[standard.id] ?? true) ? 'bg-green-50' : 'bg-gray-50'}`}
                    >
                      <div className="flex items-start gap-3">
                        <Switch
                          checked={selectedStandardsMap[standard.id] ?? true}
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
                  <strong>{cspStandards.filter(standard => selectedStandardsMap[standard.id] ?? true).length}</strong> of {cspStandards.length} standards selected
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
              <Button onClick={onSave} disabled={cspStandards.filter(standard => selectedStandardsMap[standard.id] ?? true).length === 0}>
                Save Configuration
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}