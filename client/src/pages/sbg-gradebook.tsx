import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, Users, Target, BookOpen, Calendar, Plus, FileText } from 'lucide-react';
import { Link } from 'wouter';

interface Unit {
  id: string;
  unitNumber: number;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
}

interface StandardsCoverage {
  id: string;
  classroomId: string;
  unitId: string;
  standardCode: string;
  maxRigorLevel: 'mild' | 'medium' | 'spicy';
  sourceType: 'ai_analysis' | 'manual_mark';
  lastAssessedDate: string;
  sourceDocumentIds?: string[];
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  photoUrl?: string;
}

interface AccountabilityMatrixData {
  units: Unit[];
  standards: string[];
  coverage: StandardsCoverage[];
  classroomStandards: string[];
}

const MASTERY_LEVELS = [
  { value: 4, label: 'Mastered', color: 'bg-green-500', textColor: 'text-white' },
  { value: 3, label: 'Proficient', color: 'bg-blue-500', textColor: 'text-white' },
  { value: 2, label: 'Approaching', color: 'bg-yellow-500', textColor: 'text-white' },
  { value: 1, label: 'Beginning', color: 'bg-red-500', textColor: 'text-white' },
  { value: 0, label: 'Not Assessed', color: 'bg-gray-300', textColor: 'text-gray-700' },
];

export default function SBGGradebook() {
  const { classroomId } = useParams();
  const [, setLocation] = useLocation();
  const [selectedUnit, setSelectedUnit] = useState<string>('all');

  const { data: classrooms } = useQuery<any[]>({
    queryKey: ['/api/classrooms'],
    enabled: !!classroomId,
  });

  const classroom = classrooms?.find((c: any) => c.id === classroomId);

  const { data: students } = useQuery<Student[]>({
    queryKey: ['/api/google-classroom/classrooms', classroomId, 'students'],
    enabled: !!classroomId,
  });

  const { data: matrixData, isLoading } = useQuery<AccountabilityMatrixData>({
    queryKey: ['/api/classrooms', classroomId, 'accountability-matrix'],
    enabled: !!classroomId,
  });

  const getRigorColor = (rigorLevel: 'mild' | 'medium' | 'spicy') => {
    switch (rigorLevel) {
      case 'mild': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'spicy': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRigorLabel = (rigorLevel: 'mild' | 'medium' | 'spicy') => {
    switch (rigorLevel) {
      case 'mild': return 'Mild';
      case 'medium': return 'Medium'; 
      case 'spicy': return 'Spicy';
      default: return 'Unknown';
    }
  };

  const getUnlockedStandards = () => {
    if (!matrixData) return [];
    
    if (selectedUnit === 'all') {
      return Array.from(new Set(matrixData.coverage.map(c => c.standardCode)));
    }
    
    return matrixData.coverage
      .filter(c => c.unitId === selectedUnit)
      .map(c => c.standardCode);
  };

  const getStandardCoverage = (standardCode: string) => {
    if (!matrixData) return null;
    
    if (selectedUnit === 'all') {
      const coverageItems = matrixData.coverage.filter(c => c.standardCode === standardCode);
      if (coverageItems.length === 0) return null;
      
      // Find the highest rigor level for this standard
      const rigorOrder = { 'mild': 1, 'medium': 2, 'spicy': 3 };
      return coverageItems.reduce((highest, current) => {
        return rigorOrder[current.maxRigorLevel] > rigorOrder[highest.maxRigorLevel] 
          ? current 
          : highest;
      });
    }
    
    return matrixData.coverage.find(c => c.standardCode === standardCode && c.unitId === selectedUnit);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading gradebook...</p>
        </div>
      </div>
    );
  }

  const unlockedStandards = getUnlockedStandards();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation(`/accountability-matrix/${classroomId}`)}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Matrix
            </Button>
          </div>
          
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Standards-Based Gradebook
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mb-1">
                {classroom?.name || 'Loading classroom...'}
              </p>
              <p className="text-sm text-gray-500">
                Track student mastery levels for identified standards
              </p>
            </div>
            
            <div className="flex gap-2">
              <Link href={`/units/${classroomId}`}>
                <Button variant="outline" size="sm">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Manage Units
                </Button>
              </Link>
              <Button disabled>
                <Plus className="w-4 h-4 mr-2" />
                Add Assessment
              </Button>
            </div>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Students</p>
                  <p className="text-2xl font-bold text-gray-900">{students?.length || 0}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Unlocked Standards</p>
                  <p className="text-2xl font-bold text-green-600">{unlockedStandards.length}</p>
                </div>
                <Target className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Units</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {matrixData?.units.filter(u => u.isActive).length || 0}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Assessments</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {matrixData?.coverage.filter(c => c.sourceType === 'ai_analysis').length || 0}
                  </p>
                </div>
                <FileText className="h-8 w-8 text-indigo-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Unit Filter */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Filter by Unit</CardTitle>
                <CardDescription>
                  Select a unit to view standards unlocked for that specific unit
                </CardDescription>
              </div>
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select unit..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Units</SelectItem>
                  {matrixData?.units
                    .sort((a, b) => a.unitNumber - b.unitNumber)
                    .map(unit => (
                    <SelectItem key={unit.id} value={unit.id}>
                      Unit {unit.unitNumber}: {unit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
        </Card>

        {/* Main Gradebook */}
        <Card>
          <CardHeader>
            <CardTitle>Standards-Based Gradebook</CardTitle>
            <CardDescription>
              {selectedUnit === 'all' 
                ? 'Showing all unlocked standards across all units'
                : `Showing standards unlocked in ${matrixData?.units.find(u => u.id === selectedUnit)?.name || 'selected unit'}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {unlockedStandards.length === 0 ? (
              <div className="text-center py-12">
                <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Standards Unlocked Yet</h3>
                <p className="text-gray-600 mb-6">
                  Upload and analyze assessments to unlock standards for grading
                </p>
                <div className="space-y-3">
                  <Link href="/upload">
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Upload Assessment
                    </Button>
                  </Link>
                  <p className="text-xs text-gray-500">
                    Standards will be automatically unlocked after AI analysis
                  </p>
                </div>
              </div>
            ) : (
              <Tabs defaultValue="gradebook" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="gradebook">Gradebook View</TabsTrigger>
                  <TabsTrigger value="standards">Standards Overview</TabsTrigger>
                </TabsList>
                
                <TabsContent value="gradebook" className="mt-6">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left p-3 border-b font-medium text-gray-600 min-w-[200px]">
                            Student
                          </th>
                          {unlockedStandards.map(standardCode => (
                            <th key={standardCode} className="text-center p-3 border-b font-medium text-gray-600 min-w-[120px]">
                              <div className="text-sm">
                                <div>{standardCode}</div>
                                {(() => {
                                  const coverage = getStandardCoverage(standardCode);
                                  return coverage && (
                                    <Badge 
                                      variant="outline" 
                                      className={`${getRigorColor(coverage.maxRigorLevel)} text-xs mt-1`}
                                    >
                                      {getRigorLabel(coverage.maxRigorLevel)}
                                    </Badge>
                                  );
                                })()}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {students?.map(student => (
                          <tr key={student.id} className="hover:bg-gray-50">
                            <td className="p-3 border-b">
                              <div className="flex items-center gap-3">
                                {student.photoUrl && (
                                  <img 
                                    src={student.photoUrl} 
                                    alt={`${student.firstName} ${student.lastName}`}
                                    className="w-8 h-8 rounded-full"
                                  />
                                )}
                                <div>
                                  <div className="font-medium text-sm">
                                    {student.firstName} {student.lastName}
                                  </div>
                                  {student.email && (
                                    <div className="text-xs text-gray-500">{student.email}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            {unlockedStandards.map(standardCode => (
                              <td key={`${student.id}-${standardCode}`} className="p-3 border-b text-center">
                                <Select disabled>
                                  <SelectTrigger className="w-20 h-8 text-xs">
                                    <SelectValue placeholder="--" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {MASTERY_LEVELS.map(level => (
                                      <SelectItem key={level.value} value={level.value.toString()}>
                                        <div className="flex items-center gap-2">
                                          <div className={`w-3 h-3 rounded-full ${level.color}`}></div>
                                          <span>{level.value} - {level.label}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">📋 Coming Soon: Interactive Grading</h4>
                    <p className="text-sm text-blue-800">
                      The gradebook entries will be interactive once rubric submissions are integrated. 
                      For now, this shows the progressive unlock structure as standards are identified through AI analysis.
                    </p>
                  </div>
                </TabsContent>
                
                <TabsContent value="standards" className="mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {unlockedStandards.map(standardCode => {
                      const coverage = getStandardCoverage(standardCode);
                      return (
                        <Card key={standardCode}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-3">
                              <h3 className="font-medium text-gray-900">{standardCode}</h3>
                              {coverage && (
                                <Badge 
                                  variant="outline" 
                                  className={getRigorColor(coverage.maxRigorLevel)}
                                >
                                  {getRigorLabel(coverage.maxRigorLevel)}
                                </Badge>
                              )}
                            </div>
                            
                            {coverage && (
                              <div className="space-y-2 text-sm text-gray-600">
                                <div className="flex justify-between">
                                  <span>Source:</span>
                                  <span className="capitalize">
                                    {coverage.sourceType === 'ai_analysis' ? 'AI Analysis' : 'Manual Mark'}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Last Assessed:</span>
                                  <span>{new Date(coverage.lastAssessedDate).toLocaleDateString()}</span>
                                </div>
                                {coverage.sourceDocumentIds && coverage.sourceDocumentIds.length > 0 && (
                                  <div className="flex justify-between">
                                    <span>Documents:</span>
                                    <span>{coverage.sourceDocumentIds.length}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        {/* Mastery Level Legend */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Mastery Level Scale</CardTitle>
            <CardDescription>Standards-Based Grading (SBG) 4-point scale</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {MASTERY_LEVELS.map(level => (
                <div key={level.value} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full ${level.color} ${level.textColor} flex items-center justify-center font-bold text-sm`}>
                    {level.value || '--'}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{level.label}</div>
                    <div className="text-xs text-gray-500">
                      {level.value === 4 && 'Exceeds Standard'}
                      {level.value === 3 && 'Meets Standard'}
                      {level.value === 2 && 'Approaching Standard'}
                      {level.value === 1 && 'Below Standard'}
                      {level.value === 0 && 'No Evidence'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}