import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle, Users, BookOpen, GraduationCap, Calendar, Clock, ExternalLink } from 'lucide-react';
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
  const queryClient = useQueryClient();

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
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setSelectedClassroom(classroom.id)}
                        >
                          <h4 className="font-medium text-gray-900">{classroom.name}</h4>
                          {classroom.section && (
                            <p className="text-sm text-gray-600">{classroom.section}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
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
    </div>
  );
}