import React, { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, FileText, Users, Target, TreePine, BookOpen, TrendingUp } from 'lucide-react';
import { Link } from 'wouter';

interface DocumentInspectionData {
  document: any;
  lineage: any[];
  children: any[];
  gradeSubmissions: any[];
  questions: any[];
  processingResults: any[];
  documentType: 'original' | 'generated' | 'unknown';
  relationships: {
    parentCount: number;
    childCount: number;
    submissionCount: number;
    questionCount: number;
  };
}

export default function DocumentInspector() {
  const [match, params] = useRoute('/documents/:documentId/inspect');
  const documentId = params?.documentId;

  const { data: inspection, isLoading, error } = useQuery({
    queryKey: ['/api/documents', documentId, 'inspection'],
    enabled: !!documentId,
  });

  if (!match || !documentId) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Document not found</h2>
          <Link href="/file-cabinet">
            <Button>Return to File Cabinet</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <h1 className="text-2xl font-bold text-gray-700">Loading Document Inspector...</h1>
        </div>
        
        <div className="space-y-6">
          {/* Stats cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Document Lineage skeleton */}
          <div className="border rounded-lg p-6">
            <div className="animate-pulse space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-gray-200 rounded"></div>
                <div className="h-6 bg-gray-200 rounded w-40"></div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2">
                  <div className="w-4 h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded flex-1"></div>
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </div>
                <div className="flex items-center gap-2 p-2">
                  <div className="w-4 h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded flex-1"></div>
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Additional content skeleton */}
          <div className="border rounded-lg p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-48"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !inspection) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-red-600">Error Loading Document</h2>
          <p className="text-gray-600 mb-4">Failed to load document inspection data.</p>
          <Link href="/file-cabinet">
            <Button>Return to File Cabinet</Button>
          </Link>
        </div>
      </div>
    );
  }

  const typedInspection = inspection as DocumentInspectionData;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Link href="/file-cabinet">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to File Cabinet
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{typedInspection.document.fileName}</h1>
            <p className="text-gray-600">Document Inspector</p>
          </div>
        </div>
        <Badge variant={typedInspection.documentType === 'original' ? 'default' : 'secondary'}>
          {typedInspection.documentType === 'original' ? 'Original Upload' : 
           typedInspection.documentType === 'generated' ? 'Generated Document' : 'Unknown Type'}
        </Badge>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="flex items-center p-4">
            <TreePine className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Lineage Depth</p>
              <p className="text-2xl font-bold">{typedInspection.relationships.parentCount}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-4">
            <FileText className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Generated Children</p>
              <p className="text-2xl font-bold">{typedInspection.relationships.childCount}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-4">
            <Target className="h-8 w-8 text-purple-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Questions</p>
              <p className="text-2xl font-bold">{typedInspection.relationships.questionCount}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-4">
            <TrendingUp className="h-8 w-8 text-orange-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Grade Submissions</p>
              <p className="text-2xl font-bold">{typedInspection.relationships.submissionCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Document Details */}
        <Card>
          <CardHeader>
            <CardTitle>Document Details</CardTitle>
            <CardDescription>Basic information about this document</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600">File Name</label>
              <p className="text-sm">{typedInspection.document.fileName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Asset Type</label>
              <p className="text-sm">{typedInspection.document.assetType}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Status</label>
              <Badge variant="outline">{typedInspection.document.status}</Badge>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Created</label>
              <p className="text-sm">{new Date(typedInspection.document.createdAt).toLocaleDateString()}</p>
            </div>
            {typedInspection.document.tags && typedInspection.document.tags.length > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-600">Tags</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {typedInspection.document.tags.map((tag: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Document Lineage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TreePine className="w-5 h-5 text-blue-600" />
              Document Lineage
            </CardTitle>
            <CardDescription>Ancestry path from root document</CardDescription>
          </CardHeader>
          <CardContent>
            {typedInspection.lineage.length > 0 ? (
              <div className="space-y-2">
                {typedInspection.lineage.map((doc, index) => (
                  <div key={doc.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-50 transition-colors">
                    <span className="text-sm font-medium text-gray-500 min-w-[20px]">
                      {index + 1}.
                    </span>
                    <FileText className="w-4 h-4 text-gray-400" />
                    <Link href={`/documents/${doc.id}/inspect`}>
                      <Button variant="link" className="p-0 h-auto text-left font-medium text-blue-600 hover:text-blue-800">
                        {doc.fileName}
                      </Button>
                    </Link>
                    <Badge variant="outline" className="text-xs">
                      {doc.assetType}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-sm text-gray-500 p-4 bg-gray-50 rounded-md">
                <Target className="w-4 h-4" />
                <span>This is a root document (no parent documents)</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Generated Children */}
        {typedInspection.children.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Generated Documents</CardTitle>
              <CardDescription>Documents generated from this source</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {typedInspection.children.map((child) => (
                  <div key={child.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <Link href={`/documents/${child.id}/inspect`}>
                        <Button variant="link" className="p-0 h-auto">
                          {child.fileName}
                        </Button>
                      </Link>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {child.exportType || 'Generated'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grade Submissions */}
        {typedInspection.gradeSubmissions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Grade Submissions</CardTitle>
              <CardDescription>Graded rubrics for this document</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {typedInspection.gradeSubmissions.slice(0, 5).map((submission) => (
                  <div key={submission.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">Grade Submission</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {submission.totalScore && (
                        <Badge variant="outline">
                          {submission.totalScore}/{submission.maxPossibleScore}
                        </Badge>
                      )}
                      <span className="text-xs text-gray-500">
                        {new Date(submission.scannedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
                {typedInspection.gradeSubmissions.length > 5 && (
                  <p className="text-xs text-gray-500 text-center mt-2">
                    +{typedInspection.gradeSubmissions.length - 5} more submissions
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Questions and Processing Results */}
      {typedInspection.questions.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Questions & Analysis</CardTitle>
            <CardDescription>Questions extracted from this document and their AI analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {typedInspection.questions.slice(0, 3).map((question) => (
                <div key={question.id} className="border-l-4 border-blue-500 pl-4 py-2">
                  <div className="flex items-center space-x-2 mb-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">Question {question.questionNumber}</span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">
                    {question.questionText.length > 200 
                      ? `${question.questionText.substring(0, 200)}...` 
                      : question.questionText}
                  </p>
                  {/* You could add processing results here if needed */}
                </div>
              ))}
              {typedInspection.questions.length > 3 && (
                <div className="text-center pt-4 border-t">
                  <Link href={`/documents/${documentId}/results`}>
                    <Button variant="outline">
                      View All {typedInspection.questions.length} Questions
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}