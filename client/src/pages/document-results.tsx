import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

  // Sort results by numeric value only (extract number from 3A, 11B, etc.)
  const sortedResults = results.sort((a, b) => {
    const extractNumber = (num: string | number) => {
      const str = String(num);
      const match = str.match(/^(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };

    const numA = extractNumber(a.questionNumber);
    const numB = extractNumber(b.questionNumber);
    
    return numA - numB;
  });

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

              {/* Simple Three-Column Analysis */}
              {sortedResults && sortedResults.length > 0 ? (
                <TooltipProvider>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Brain className="w-5 h-5 mr-2" />
                      Question-by-Question Analysis
                    </CardTitle>
                    <p className="text-sm text-slate-500">
                      Standards and rigor levels for each question in the document
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Question Number
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Standard
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Rigor
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {sortedResults.map((question, index) => (
                            <tr key={question.id} className="hover:bg-slate-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-slate-900">
                                  Question {question.questionNumber}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {question.result?.consensusStandards && question.result.consensusStandards.length > 0 ? (
                                  <div className="space-y-2">
                                    {question.result.consensusStandards.map((standard, stdIndex) => (
                                      <div key={stdIndex} className="text-sm text-slate-900">
                                        <Badge variant="outline" className="font-mono text-xs mr-2">
                                          {standard.code}
                                        </Badge>
                                        {standard.description}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-sm text-slate-400">No standards identified</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {question.result ? (
                                  question.aiResponses && question.aiResponses.length > 0 && question.aiResponses[0].rigorJustification ? (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <RigorBadge level={question.result.consensusRigorLevel} />
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-lg p-3">
                                        <p className="text-xs leading-relaxed">{question.aiResponses[0].rigorJustification}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <RigorBadge level={question.result.consensusRigorLevel} />
                                  )
                                ) : (
                                  <span className="text-sm text-slate-400">Not analyzed</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
                </TooltipProvider>
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