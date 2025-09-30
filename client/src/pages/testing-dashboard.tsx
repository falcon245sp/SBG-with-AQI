/**
 * Testing Dashboard for comprehensive system validation
 * Provides UI for running automated tests and viewing results
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle, Clock, PlayCircle, RefreshCw } from 'lucide-react';

interface TestResult {
  testName: string;
  endpoint?: string;
  method?: string;
  status: 'pass' | 'fail' | 'skip';
  statusCode?: number;
  responseTime?: number;
  error?: string;
  warning?: string;
  details?: string;
}

interface TestSuiteResult {
  totalTests: number;
  passed: number;
  failed: number;
  skipped?: number;
  results: TestResult[];
  summary: string;
  success: boolean;
  timestamp: string;
}

export default function TestingDashboard() {
  const [runningTests, setRunningTests] = useState<string[]>([]);

  // System Health Check
  const { data: healthData, refetch: refetchHealth, isLoading: healthLoading } = useQuery<any>({
    queryKey: ['/api/system-health'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // UX Tests
  const { data: uxTestData, refetch: refetchUxTests, isLoading: uxTestsLoading } = useQuery<any>({
    queryKey: ['/api/run-ux-tests'],
    enabled: false // Only run when manually triggered
  });

  const runTestSuite = async (testType: string) => {
    setRunningTests(prev => [...prev, testType]);
    
    try {
      if (testType === 'health') {
        await refetchHealth();
      } else if (testType === 'ux') {
        await refetchUxTests();
      }
    } finally {
      setRunningTests(prev => prev.filter(t => t !== testType));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'implemented':
      case 'pass':
        return <Badge className="bg-green-500 text-white">✓ {status}</Badge>;
      case 'error':
      case 'fail':
        return <Badge variant="destructive">✗ {status}</Badge>;
      case 'stopped':
      case 'skip':
        return <Badge variant="secondary">⏸ {status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">System Testing Dashboard</h1>
        <p className="text-muted-foreground">
          Comprehensive validation of Standards Sherpa functionality, UX, and system health
        </p>
      </div>

      <Tabs defaultValue="health" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="health" className="flex items-center gap-2">
            <CheckCircle size={16} />
            System Health
          </TabsTrigger>
          <TabsTrigger value="ux" className="flex items-center gap-2">
            <PlayCircle size={16} />
            UX Tests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">System Health Check</h2>
            <Button 
              onClick={() => runTestSuite('health')} 
              disabled={runningTests.includes('health') || healthLoading}
              className="flex items-center gap-2"
            >
              {runningTests.includes('health') || healthLoading ? (
                <RefreshCw className="animate-spin" size={16} />
              ) : (
                <PlayCircle size={16} />
              )}
              Run Health Check
            </Button>
          </div>

          {healthData && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Database</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold mb-1">
                    {getStatusBadge(healthData.database)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Connection & queries
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Export Processor</CardTitle>
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold mb-1">
                    {getStatusBadge(healthData.exportProcessor)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Document generation
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">File System</CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold mb-1">
                    {getStatusBadge(healthData.fileSystem)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload directory access
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">User-Friendly Filenames</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold mb-1">
                    {getStatusBadge(healthData.userFriendlyFilenames)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Clean filename generation
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {healthData && (
            <Card>
              <CardHeader>
                <CardTitle>Last Health Check</CardTitle>
                <CardDescription>
                  {formatTimestamp(healthData.timestamp)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="text-sm bg-muted p-4 rounded-md overflow-auto">
                  {JSON.stringify(healthData, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ux" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">UX Validation Tests</h2>
            <Button 
              onClick={() => runTestSuite('ux')} 
              disabled={runningTests.includes('ux') || uxTestsLoading}
              className="flex items-center gap-2"
            >
              {runningTests.includes('ux') || uxTestsLoading ? (
                <RefreshCw className="animate-spin" size={16} />
              ) : (
                <PlayCircle size={16} />
              )}
              Run UX Tests
            </Button>
          </div>

          {uxTestData && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{uxTestData.totalTests}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Passed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{uxTestData.passed}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Failed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{uxTestData.failed}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {(((uxTestData.passed || 0) / ((uxTestData.totalTests || 1) - (uxTestData.skipped || 0))) * 100).toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Test Results</CardTitle>
                  <CardDescription>
                    Detailed results from UX validation tests
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-auto">
                    {uxTestData.results?.map((result: TestResult, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{result.testName}</span>
                            {getStatusBadge(result.status)}
                          </div>
                          {result.endpoint && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {result.method} {result.endpoint}
                            </div>
                          )}
                          {result.error && (
                            <div className="text-sm text-red-600 mt-1">{result.error}</div>
                          )}
                          {result.warning && (
                            <div className="text-sm text-yellow-600 mt-1">{result.warning}</div>
                          )}
                        </div>
                        <div className="text-right">
                          {result.statusCode && (
                            <div className="text-sm font-mono">{result.statusCode}</div>
                          )}
                          {result.responseTime && (
                            <div className="text-xs text-muted-foreground">{result.responseTime}ms</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Test Summary</CardTitle>
                  <CardDescription>
                    {formatTimestamp(uxTestData.timestamp)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="text-sm bg-muted p-4 rounded-md whitespace-pre-wrap">
                    {uxTestData.summary}
                  </pre>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}