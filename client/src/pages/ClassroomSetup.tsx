import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users, School, CheckCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  photoUrl?: string;
}

interface Classroom {
  id: string;
  name: string;
  section?: string;
  students: Student[];
}

export default function ClassroomSetup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);

  const handleSyncClassrooms = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/sync-classroom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to sync classroom data');
      }

      const data = await response.json();
      
      if (data.success && data.classrooms) {
        setClassrooms(data.classrooms);
        setIsComplete(true);
        
        toast({
          title: "Success!",
          description: `Synced ${data.classrooms.length} classrooms with ${data.classrooms.reduce((total: number, c: Classroom) => total + c.students.length, 0)} students`,
        });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Classroom sync error:', error);
      toast({
        title: "Sync Error",
        description: "Failed to sync classroom data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    setLocation('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 pt-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Classroom Setup
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Connect your Google Classroom to import your classes and student rosters
          </p>
        </div>

        {!isComplete ? (
          // Initial Setup Card
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2">
                  <School className="h-5 w-5 text-blue-600" />
                  Import Your Classrooms
                </CardTitle>
                <CardDescription>
                  This will securely access your Google Classroom data to pull your courses and student rosters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                    What we'll import:
                  </h4>
                  <ul className="text-sm text-blue-700 dark:text-blue-200 space-y-1">
                    <li>• Your active Google Classroom courses</li>
                    <li>• Student names and email addresses</li>
                    <li>• Class sections and room information</li>
                  </ul>
                </div>

                <Button
                  onClick={handleSyncClassrooms}
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Syncing Classroom Data...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync Google Classroom
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          // Results Display
          <div className="space-y-6">
            {/* Success Header */}
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-full">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Classroom Data Synced Successfully!</span>
              </div>
            </div>

            {/* Classrooms Grid */}
            <div className="grid gap-6 md:grid-cols-2">
              {classrooms.map((classroom) => (
                <Card key={classroom.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{classroom.name}</span>
                      <Badge variant="secondary">
                        {classroom.students.length} students
                      </Badge>
                    </CardTitle>
                    {classroom.section && (
                      <CardDescription>Section: {classroom.section}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <Users className="h-4 w-4" />
                        <span>Students:</span>
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {classroom.students.map((student) => (
                          <div
                            key={student.id}
                            className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-800 p-2 rounded"
                          >
                            {student.photoUrl && (
                              <img
                                src={student.photoUrl}
                                alt={`${student.firstName} ${student.lastName}`}
                                className="h-6 w-6 rounded-full object-cover"
                              />
                            )}
                            <span>
                              {student.firstName} {student.lastName}
                            </span>
                            {student.email && (
                              <span className="text-gray-500 text-xs ml-auto">
                                {student.email}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Continue Button */}
            <div className="text-center pt-4">
              <Button
                onClick={handleContinue}
                className="bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Continue to Dashboard
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}