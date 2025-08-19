import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const [isConnectingClassroom, setIsConnectingClassroom] = useState(false);

  // Check current user authentication status
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Fetch documents for status polling
  const { data: documents } = useQuery({
    queryKey: ["/api/documents"],
    enabled: !!user && !error, // Only fetch if authenticated
    refetchInterval: (query) => {
      // Poll every 3 seconds if there are any processing documents
      const hasProcessingDocs = query.state.data?.some((doc: any) => 
        doc.status === 'processing' || 
        doc.status === 'pending' ||
        doc.teacherReviewStatus === 'not_reviewed'
      );
      return hasProcessingDocs ? 3000 : false;
    },
    refetchIntervalInBackground: true,
  });

  const isAuthenticated = !!user && !error;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      console.log('Dashboard - Not authenticated, redirecting to Google Auth page');
      window.location.href = "/auth/google";
    }
  }, [isAuthenticated, isLoading]);

  const handleConnectClassroom = async () => {
    setIsConnectingClassroom(true);
    try {
      console.log('Dashboard - Initiating classroom connection...');
      const response = await fetch('/api/auth/google/classroom');
      const data = await response.json();
      
      if (data.authUrl) {
        console.log('Dashboard - Redirecting to classroom auth:', data.authUrl);
        window.location.href = data.authUrl;
      } else {
        console.error('Dashboard - No auth URL received:', data);
        alert('Failed to initiate classroom connection');
      }
    } catch (error) {
      console.error('Dashboard - Classroom connection error:', error);
      alert('Failed to connect to classroom');
    } finally {
      setIsConnectingClassroom(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-lg">Redirecting to login...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Standards Sherpa Dashboard</h1>
            <p className="text-gray-600">Welcome back, {user?.firstName || user?.email || 'User'}!</p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant={user?.classroomConnected ? "default" : "secondary"}>
              {user?.classroomConnected ? "Classroom Connected" : "Classroom Not Connected"}
            </Badge>
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/api/logout'}
            >
              Sign Out
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* User Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  {user?.profileImageUrl && (
                    <img 
                      src={user.profileImageUrl} 
                      alt="Profile" 
                      className="w-10 h-10 rounded-full"
                    />
                  )}
                  <div>
                    <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                    <p className="text-sm text-gray-600">{user?.email}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Classroom Connection Card */}
          <Card>
            <CardHeader>
              <CardTitle>Google Classroom</CardTitle>
              <CardDescription>
                {user?.classroomConnected 
                  ? "Connected to Google Classroom" 
                  : "Connect to Google Classroom to access your classes and students"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!user?.classroomConnected ? (
                <Button 
                  onClick={handleConnectClassroom}
                  disabled={isConnectingClassroom}
                  className="w-full"
                >
                  {isConnectingClassroom ? "Connecting..." : "Connect to Google Classroom"}
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-green-600 font-medium">✓ Connected Successfully</p>
                  <Button variant="outline" className="w-full">
                    View Classes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Document Processing Card */}
          <Card>
            <CardHeader>
              <CardTitle>Document Processing</CardTitle>
              <CardDescription>Upload and analyze educational documents</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" disabled={!user?.classroomConnected}>
                Upload Documents
              </Button>
              {!user?.classroomConnected && (
                <p className="text-sm text-gray-500 mt-2">
                  Connect to Google Classroom first to enable document processing
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Debug Information */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Debug Information</CardTitle>
            <CardDescription>Authentication status for troubleshooting</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p><strong>Authentication:</strong> {isAuthenticated ? "✅ Authenticated" : "❌ Not Authenticated"}</p>
              <p><strong>User ID:</strong> {user?.id || 'N/A'}</p>
              <p><strong>Google ID:</strong> {user?.googleId || 'N/A'}</p>
              <p><strong>Classroom Connected:</strong> {user?.classroomConnected ? "✅ Yes" : "❌ No"}</p>
              <p><strong>Has Access Token:</strong> {user?.googleAccessToken ? "✅ Yes" : "❌ No"}</p>
              <p><strong>Has Refresh Token:</strong> {user?.googleRefreshToken ? "✅ Yes" : "❌ No"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}