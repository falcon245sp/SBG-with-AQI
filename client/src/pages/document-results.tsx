import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/Sidebar";
import { RigorBadge } from "@/components/RigorBadge";
import { ProcessingStatus } from "@/components/ProcessingStatus";
import { 
  ArrowLeft, 
  FileText, 
  Brain, 
  Target, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { Link } from "wouter";

interface DocumentResult {
  document: {
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    jurisdictions: string[];
    createdAt: string;
    processingStarted?: string;
    processingCompleted?: string;
  };
  results: Array<{
    id: string;
    questionNumber: number;
    questionText: string;
    context: string;
    result?: {
      consensusStandards: Array<{
        code: string;
        description: string;
        jurisdiction: string;
        gradeLevel?: string;
        subject?: string;
      }>;
      consensusRigorLevel: 'mild' | 'medium' | 'spicy';
      confidenceScore: string;
      standardsVotes: any;
      rigorVotes: any;
    };
    aiResponses: Array<{
      aiEngine: string;
      rigorLevel: 'mild' | 'medium' | 'spicy';
      rigorJustification: string;
      confidence: string;
      processingTime: number;
      standardsIdentified: Array<{
        code: string;
        description: string;
        jurisdiction: string;
      }>;
    }>;
  }>;
}

export default function DocumentResults() {
  const params = useParams<{ id: string }>();
  const documentId = params?.id;

  const { data: documentResult, isLoading, error } = useQuery<DocumentResult>({
    queryKey: [`/api/documents/${documentId}/results`],
    enabled: !!documentId,
    refetchInterval: (query) => {
      // Poll every 3 seconds if the document is still processing
      const docStatus = query.state.data?.document.status;
      return (docStatus === 'processing' || docStatus === 'pending') ? 3000 : false;
    },
    refetchIntervalInBackground: true,
  });

  const formatProcessingTime = (start?: string, end?: string) => {
    if (!start || !end) return "N/A";
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  if (isLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error || !documentResult) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Card className="w-96">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Results Not Found
              </h3>
              <p className="text-slate-600 mb-4">
                Unable to load the analysis results for this document.
              </p>
              <Link href="/results">
                <Button>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Results
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { document, results } = documentResult;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Header */}
        <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow border-b border-slate-200">
          <div className="flex-1 px-4 flex justify-between items-center">
            <div className="flex items-center">
              <Link href="/results">
                <Button variant="ghost" size="sm" className="mr-4">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <FileText className="w-6 h-6 text-blue-600 mr-3" />
              <h2 className="text-2xl font-semibold text-slate-800">
                Analysis Results: {document.fileName}
              </h2>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              
              {/* Document Overview */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Document Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Status</p>
                      <ProcessingStatus status={document.status} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500">File Size</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {(document.fileSize / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500">Processing Time</p>
                      <p className="text-lg font-semibold text-slate-900 flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {formatProcessingTime(document.processingStarted, document.processingCompleted)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500">Jurisdictions</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {document.jurisdictions?.map((jurisdiction, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {jurisdiction}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Analysis Results */}
              {results && results.length > 0 ? (
                <div className="space-y-6">
                  {results.map((question, index) => (
                    <Card key={question.id}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center">
                            <Brain className="w-5 h-5 mr-2" />
                            Question {question.questionNumber}
                          </div>
                          {question.result && (
                            <div className="flex items-center space-x-2">
                              <RigorBadge level={question.result.consensusRigorLevel} />
                              <Badge variant="secondary">
                                Confidence: {Math.round(parseFloat(question.result.confidenceScore) * 100)}%
                              </Badge>
                            </div>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          {/* Question Text */}
                          <div>
                            <h4 className="font-medium text-slate-900 mb-2">Question Text</h4>
                            <p className="text-slate-700 bg-slate-50 p-3 rounded">
                              {question.questionText}
                            </p>
                            {question.context && (
                              <p className="text-sm text-slate-500 mt-2">
                                <strong>Context:</strong> {question.context}
                              </p>
                            )}
                          </div>

                          {question.result && (
                            <>
                              {/* Consensus Standards */}
                              {question.result.consensusStandards && question.result.consensusStandards.length > 0 && (
                                <div>
                                  <h4 className="font-medium text-slate-900 mb-3 flex items-center">
                                    <Target className="w-4 h-4 mr-2" />
                                    Identified Standards
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {question.result.consensusStandards.map((standard, stdIndex) => (
                                      <div key={stdIndex} className="border border-slate-200 rounded-lg p-4">
                                        <div className="flex items-start justify-between mb-2">
                                          <Badge variant="outline" className="font-mono text-xs">
                                            {standard.code}
                                          </Badge>
                                          <Badge variant="secondary" className="text-xs">
                                            {standard.jurisdiction}
                                          </Badge>
                                        </div>
                                        <p className="text-sm text-slate-700">{standard.description}</p>
                                        {standard.gradeLevel && (
                                          <p className="text-xs text-slate-500 mt-1">
                                            Grade Level: {standard.gradeLevel}
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* AI Engine Breakdown */}
                              <div>
                                <h4 className="font-medium text-slate-900 mb-3 flex items-center">
                                  <TrendingUp className="w-4 h-4 mr-2" />
                                  AI Engine Analysis
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {question.aiResponses.map((response, respIndex) => (
                                    <div key={respIndex} className="border border-slate-200 rounded-lg p-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <Badge variant="outline" className="capitalize">
                                          {response.aiEngine}
                                        </Badge>
                                        <RigorBadge level={response.rigorLevel} />
                                      </div>
                                      <p className="text-sm text-slate-700 mb-3">
                                        {response.rigorJustification}
                                      </p>
                                      <div className="flex justify-between text-xs text-slate-500">
                                        <span>Confidence: {Math.round(parseFloat(response.confidence) * 100)}%</span>
                                        <span>{response.processingTime}ms</span>
                                      </div>
                                      {response.standardsIdentified && response.standardsIdentified.length > 0 && (
                                        <div className="mt-3">
                                          <p className="text-xs font-medium text-slate-600 mb-1">Standards Found:</p>
                                          <div className="flex flex-wrap gap-1">
                                            {response.standardsIdentified.slice(0, 3).map((std, stdIdx) => (
                                              <Badge key={stdIdx} variant="secondary" className="text-xs">
                                                {std.code}
                                              </Badge>
                                            ))}
                                            {response.standardsIdentified.length > 3 && (
                                              <Badge variant="secondary" className="text-xs">
                                                +{response.standardsIdentified.length - 3} more
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}

                          {!question.result && (
                            <div className="text-center py-8 text-slate-500">
                              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                              <p>No consensus results available for this question</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Brain className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">No Analysis Results</h3>
                    <p className="text-slate-500">
                      This document hasn't been fully analyzed yet or no questions were found.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}