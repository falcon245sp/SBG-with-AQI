import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  Database, 
  FileText, 
  Users, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Settings,
  Monitor,
  Bug
} from "lucide-react";

interface SystemHealth {
  timestamp: string;
  database: { status: string; responseTime: number };
  exportProcessor: { status: string; queueSize: number };
  fileSystem: { status: string; uploadsDirectory: boolean };
}

interface UXTestResult {
  testName: string;
  endpoint: string;
  status: 'pass' | 'fail';
  statusCode?: number;
  responseTime?: number;
  error?: string;
}

interface UXTestResponse {
  success: boolean;
  totalTests: number;
  passed: number;
  failed: number;
  results: UXTestResult[];
  summary: string;
  executionTime: number;
}

export default function AdminDashboard() {
  // Get current user for admin check
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Check if user is admin (your email only for now)
  const isAdmin = user?.email === 'admin@standardssherpa.com';

  const { data: systemHealth, isLoading: healthLoading } = useQuery<SystemHealth>({
    queryKey: ['/api/system-health'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: uxTests, isLoading: testsLoading, refetch: refetchTests } = useQuery<UXTestResponse>({
    queryKey: ['/api/admin/run-ux-tests'],
    refetchInterval: 60000, // Refresh every minute
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-300">
              You don't have admin access to view this dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Admin Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            System monitoring and debugging tools
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="system-health" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              System Health
            </TabsTrigger>
            <TabsTrigger value="ux-tests" className="flex items-center gap-2">
              <Bug className="h-4 w-4" />
              UX Tests
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">System Status</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {healthLoading ? '...' : systemHealth ? 'Healthy' : 'Unknown'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    All services operational
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">UX Tests</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {testsLoading ? '...' : uxTests ? `${uxTests.passed}/${uxTests.totalTests}` : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tests passing
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Database</CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {healthLoading ? '...' : systemHealth?.database.responseTime ? `${systemHealth.database.responseTime}ms` : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Response time
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Queue Size</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {healthLoading ? '...' : systemHealth?.exportProcessor.queueSize ?? 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Documents pending
                  </p>
                </CardContent>
              </Card>
            </div>

            <Alert>
              <Settings className="h-4 w-4" />
              <AlertDescription>
                This admin dashboard provides system monitoring, debugging tools, and diagnostic information.
                Customer-facing features are available on the main dashboard.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="system-health">
            <Card>
              <CardHeader>
                <CardTitle>System Health Status</CardTitle>
              </CardHeader>
              <CardContent>
                {healthLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : systemHealth ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Last Updated:</span>
                      <span className="text-sm text-gray-500">
                        {new Date(systemHealth.timestamp).toLocaleString()}
                      </span>
                    </div>
                    
                    <Separator />
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          Database
                        </h4>
                        <Badge variant={systemHealth.database.status === 'healthy' ? 'default' : 'destructive'}>
                          {systemHealth.database.status}
                        </Badge>
                        <p className="text-sm text-gray-600">
                          Response: {systemHealth.database.responseTime}ms
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Export Processor
                        </h4>
                        <Badge variant={systemHealth.exportProcessor.status === 'healthy' ? 'default' : 'destructive'}>
                          {systemHealth.exportProcessor.status}
                        </Badge>
                        <p className="text-sm text-gray-600">
                          Queue: {systemHealth.exportProcessor.queueSize} items
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          File System
                        </h4>
                        <Badge variant={systemHealth.fileSystem.status === 'healthy' ? 'default' : 'destructive'}>
                          {systemHealth.fileSystem.status}
                        </Badge>
                        <p className="text-sm text-gray-600">
                          Uploads: {systemHealth.fileSystem.uploadsDirectory ? 'Available' : 'Unavailable'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-center py-8 text-gray-500">Failed to load system health data</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ux-tests">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">UX Test Results</h2>
                <Button onClick={() => refetchTests()}>
                  Refresh Tests
                </Button>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>Test Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  {testsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : uxTests ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm font-medium">Total Tests</p>
                          <p className="text-2xl font-bold">{uxTests.totalTests}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Passed</p>
                          <p className="text-2xl font-bold text-green-600">{uxTests.passed}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Failed</p>
                          <p className="text-2xl font-bold text-red-600">{uxTests.failed}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Success Rate</p>
                          <p className="text-2xl font-bold">
                            {((uxTests.passed / uxTests.totalTests) * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-2">
                        {uxTests.results.map((test, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              {test.status === 'pass' ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-red-600" />
                              )}
                              <div>
                                <p className="font-medium">{test.testName}</p>
                                <p className="text-sm text-gray-500">{test.endpoint}</p>
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <Badge variant={test.status === 'pass' ? 'default' : 'destructive'}>
                                {test.statusCode}
                              </Badge>
                              {test.responseTime && (
                                <p className="text-gray-500 mt-1">{test.responseTime}ms</p>
                              )}
                              {test.error && (
                                <p className="text-red-500 mt-1">{test.error}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-center py-8 text-gray-500">Failed to load test results</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>System Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    Log viewing functionality will be implemented based on your logging infrastructure.
                    Currently, logs are available in the server console and can be aggregated using the structured logging system.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}