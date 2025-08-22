import { DocumentClassroomAssignment } from "@/components/DocumentClassroomAssignment";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, AlertCircle, CheckCircle2, Clock } from "lucide-react";

export default function DocumentClassroomAssignmentPage() {
  // Check auth and classroom connection status
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const { data: classrooms = [] } = useQuery<any[]>({
    queryKey: ["/api/classrooms"],
    retry: false,
  });

  const hasGoogleClassroomConnection = (user as any)?.classroomConnected;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Document & Classroom Management</h1>
              <p className="text-muted-foreground mt-2">
                Upload documents and assign them to specific classrooms for standards tracking
              </p>
            </div>
          </div>

          {/* Connection Status */}
          {!hasGoogleClassroomConnection ? (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <AlertCircle className="w-8 h-8 text-amber-600" />
                  <div>
                    <h3 className="font-semibold text-amber-900">Google Classroom Not Connected</h3>
                    <p className="text-amber-800 mt-1">
                      To assign documents to classrooms, you need to connect your Google Classroom first.
                    </p>
                    <a 
                      href="/google-classroom-integration" 
                      className="inline-block mt-3 px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors"
                    >
                      Connect Google Classroom
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : classrooms.length === 0 ? (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Clock className="w-8 h-8 text-blue-600" />
                  <div>
                    <h3 className="font-semibold text-blue-900">No Classrooms Found</h3>
                    <p className="text-blue-800 mt-1">
                      Your Google Classroom is connected, but no classrooms were found. Please sync your classrooms.
                    </p>
                    <a 
                      href="/google-classroom-integration" 
                      className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Sync Classrooms
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-green-900">Ready for Document Assignment</h3>
                    <p className="text-green-800 mt-1">
                      Found {classrooms.length} classroom{classrooms.length !== 1 ? 's' : ''} available for document assignment.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Key Features Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg mx-auto flex items-center justify-center mb-2">
                  <BookOpen className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle className="text-lg">Upload with Assignment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center">
                  Upload new documents directly to specific classrooms during the upload process
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg mx-auto flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <CardTitle className="text-lg">Retroactive Assignment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center">
                  Assign existing unlinked documents to classrooms for complete standards tracking
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-lg mx-auto flex items-center justify-center mb-2">
                  <AlertCircle className="w-6 h-6 text-purple-600" />
                </div>
                <CardTitle className="text-lg">Standards Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center">
                  Documents contribute to accountability matrix and SBG gradebook when assigned
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Component */}
          <DocumentClassroomAssignment 
            onUploadSuccess={() => {
              // Could add any post-upload actions here
              console.log("Upload successful!");
            }}
          />

          {/* Help Text */}
          <Card className="bg-slate-50">
            <CardHeader>
              <CardTitle className="text-lg">How Document-Classroom Assignment Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-2">
                <p><strong>Why assign documents to classrooms?</strong></p>
                <p>
                  Document-classroom assignment is essential for the accountability matrix and SBG gradebook 
                  to work properly. When documents are assigned to specific classrooms:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Standards identified in documents contribute to the classroom's accountability matrix</li>
                  <li>Rigor levels are tracked per classroom for progressive standards coverage</li>
                  <li>The SBG gradebook can organize assessments by classroom and standards</li>
                  <li>Teachers can see which standards have been covered in each specific course</li>
                </ul>
                
                <p className="mt-4"><strong>Best Practices:</strong></p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Assign documents to classrooms as soon as possible after upload</li>
                  <li>Use descriptive classroom names to make selection easier</li>
                  <li>Configure standards for your classrooms before assigning documents</li>
                  <li>Enable SBG on classrooms where you want to track standards-based grades</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}