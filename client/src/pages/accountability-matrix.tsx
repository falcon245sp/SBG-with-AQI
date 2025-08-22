import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Plus, Calendar, FileText, Target, User } from 'lucide-react';
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

interface AccountabilityMatrixData {
  units: Unit[];
  standards: string[];
  coverage: StandardsCoverage[];
  classroomStandards: string[];
}

interface Classroom {
  id: string;
  name: string;
  description?: string;
}

export default function AccountabilityMatrix() {
  const { classroomId } = useParams();
  const [, setLocation] = useLocation();

  const { data: classrooms } = useQuery<any[]>({
    queryKey: ['/api/classrooms'],
    enabled: !!classroomId,
  });

  const classroom = classrooms?.find((c: any) => c.id === classroomId);

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

  const getCoverageForCell = (standardCode: string, unitId: string) => {
    return matrixData?.coverage.find(
      c => c.standardCode === standardCode && c.unitId === unitId
    );
  };

  const getStandardCoverageStatus = (standardCode: string) => {
    const coverageItems = matrixData?.coverage.filter(c => c.standardCode === standardCode) || [];
    if (coverageItems.length === 0) return null;
    
    // Find the highest rigor level for this standard
    const rigorOrder = { 'mild': 1, 'medium': 2, 'spicy': 3 };
    const highestRigor = coverageItems.reduce((highest, current) => {
      return rigorOrder[current.maxRigorLevel] > rigorOrder[highest.maxRigorLevel] 
        ? current 
        : highest;
    });
    
    return highestRigor;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading accountability matrix...</p>
        </div>
      </div>
    );
  }

  if (!matrixData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">Error Loading Matrix</CardTitle>
              <CardDescription>Unable to load accountability matrix data.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation('/google-classroom')}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Classrooms
            </Button>
          </div>
          
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Standards Accountability Matrix
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mb-1">
                {classroom?.name || 'Loading classroom...'}
              </p>
              <p className="text-sm text-gray-500">
                Year-long standards coverage tracking with rigor indicators
              </p>
            </div>
            
            <div className="flex gap-2">
              <Link href={`/units/${classroomId}`}>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Manage Units
                </Button>
              </Link>
              <Link href={`/gradebook/${classroomId}`}>
                <Button>
                  <User className="w-4 h-4 mr-2" />
                  SBG Gradebook
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Standards Coverage Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Standards</p>
                  <p className="text-2xl font-bold text-gray-900">{matrixData.classroomStandards.length}</p>
                </div>
                <Target className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Covered Standards</p>
                  <p className="text-2xl font-bold text-green-600">
                    {new Set(matrixData.coverage.map(c => c.standardCode)).size}
                  </p>
                </div>
                <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                  <div className="h-4 w-4 bg-green-500 rounded-full"></div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Units</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {matrixData.units.filter(u => u.isActive).length}
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
                  <p className="text-sm font-medium text-gray-600">Coverage Rate</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {Math.round((new Set(matrixData.coverage.map(c => c.standardCode)).size / matrixData.classroomStandards.length) * 100)}%
                  </p>
                </div>
                <FileText className="h-8 w-8 text-indigo-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Rigor Level Legend */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Rigor Level Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <span className="text-sm">Mild Rigor (DOK 1-2)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                <span className="text-sm">Medium Rigor (DOK 3)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                <span className="text-sm">Spicy Rigor (DOK 4)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-300 rounded-full"></div>
                <span className="text-sm">Not Assessed</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accountability Matrix */}
        <Card>
          <CardHeader>
            <CardTitle>Standards Coverage Matrix</CardTitle>
            <CardDescription>
              Track which standards are covered in each unit with rigor level indicators
            </CardDescription>
          </CardHeader>
          <CardContent>
            {matrixData.units.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No units created yet</p>
                <Link href={`/units/${classroomId}`}>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Unit
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left p-3 border-b font-medium text-gray-600 min-w-[200px]">
                        Standard
                      </th>
                      {matrixData.units
                        .sort((a, b) => a.unitNumber - b.unitNumber)
                        .map(unit => (
                        <th key={unit.id} className="text-center p-3 border-b font-medium text-gray-600 min-w-[120px]">
                          <div className="text-sm">
                            <div>Unit {unit.unitNumber}</div>
                            <div className="text-xs text-gray-500 mt-1">{unit.name}</div>
                          </div>
                        </th>
                      ))}
                      <th className="text-center p-3 border-b font-medium text-gray-600 min-w-[100px]">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixData.classroomStandards.map(standardCode => {
                      const overallStatus = getStandardCoverageStatus(standardCode);
                      
                      return (
                        <tr key={standardCode} className="hover:bg-gray-50">
                          <td className="p-3 border-b font-medium text-sm">
                            {standardCode}
                          </td>
                          {matrixData.units
                            .sort((a, b) => a.unitNumber - b.unitNumber)
                            .map(unit => {
                            const coverage = getCoverageForCell(standardCode, unit.id);
                            
                            return (
                              <td key={`${standardCode}-${unit.id}`} className="p-3 border-b text-center">
                                {coverage ? (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge 
                                        variant="outline" 
                                        className={`${getRigorColor(coverage.maxRigorLevel)} text-xs`}
                                      >
                                        {getRigorLabel(coverage.maxRigorLevel)}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="text-sm">
                                        <div className="font-medium">{standardCode}</div>
                                        <div>Rigor: {getRigorLabel(coverage.maxRigorLevel)}</div>
                                        <div>Source: {coverage.sourceType === 'ai_analysis' ? 'AI Analysis' : 'Manual Mark'}</div>
                                        <div>Assessed: {new Date(coverage.lastAssessedDate).toLocaleDateString()}</div>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <div className="w-8 h-6 bg-gray-100 rounded border-gray-200 border"></div>
                                )}
                              </td>
                            );
                          })}
                          <td className="p-3 border-b text-center">
                            {overallStatus ? (
                              <Badge 
                                variant="outline" 
                                className={`${getRigorColor(overallStatus.maxRigorLevel)} text-xs`}
                              >
                                {getRigorLabel(overallStatus.maxRigorLevel)}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-100 text-gray-600 text-xs">
                                Not Covered
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}