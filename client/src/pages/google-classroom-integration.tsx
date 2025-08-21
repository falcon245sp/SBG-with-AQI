import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, CheckCircle, Users, BookOpen, GraduationCap, Calendar, Clock, ExternalLink, Settings, Lightbulb, Target } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

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

export default function GoogleClassroomIntegration() {
  const [currentStep, setCurrentStep] = useState<'auth' | 'connecting' | 'connected'>('auth');
  const [selectedClassroom, setSelectedClassroom] = useState<string | null>(null);
  const [editingClassification, setEditingClassification] = useState<string | null>(null);
  const queryClient = useQueryClient();

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
    mutationFn: ({ classroomId, ...settings }: {
      classroomId: string;
      subjectArea?: string;
      standardsJurisdiction?: string;
      sbgEnabled?: boolean;
    }) => fetch(`/api/classrooms/${classroomId}/classification`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/classrooms'] });
      setEditingClassification(null);
    },
  });

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
                                console.log('SBG toggle changed:', { classroomId: classroom.id, checked });
                                updateClassificationMutation.mutate({
                                  classroomId: classroom.id,
                                  sbgEnabled: checked
                                });
                              }}
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
                                      setEditingClassification(classroom.id);
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