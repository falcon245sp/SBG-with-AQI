import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/Sidebar";
import { RigorBadge } from "@/components/RigorBadge";
import { ProcessingStatus } from "@/components/ProcessingStatus";
import { apiRequest } from "@/lib/queryClient";
import { validateStandardsList, detectDomainChange, type CommonCoreStandard } from "@shared/commonCoreStandards";
import { 
  ArrowLeft, 
  FileText, 
  Brain, 
  Target, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Edit3,
  Save,
  X,
  RotateCcw,
  History,
  Download,
  ChevronDown
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
    teacherOverride?: {
      id: string;
      overriddenStandards: Array<{
        code: string;
        description: string;
        jurisdiction: string;
        gradeLevel?: string;
        subject?: string;
      }>;
      overriddenRigorLevel: 'mild' | 'medium' | 'spicy';
      teacherJustification: string;
      confidenceLevel: number;
      hasDomainChange: boolean;
      domainChangeDetails: any;
      createdAt: string;
      updatedAt: string;
    };
  }>;
}

export default function DocumentResults() {
  const params = useParams<{ id: string }>();
  const documentId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [openDialogs, setOpenDialogs] = useState<{ [key: string]: boolean }>({});
  const [overrideFormData, setOverrideFormData] = useState<{
    rigorLevel: 'mild' | 'medium' | 'spicy';
    standards: string;
    justification: string;
    confidence: number;
  }>({ rigorLevel: 'mild', standards: '', justification: '', confidence: 5 });

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

  // Mutation for reverting to Sherpa analysis
  const revertToAiMutation = useMutation({
    mutationFn: async (questionId: string) => {
      console.log('Reverting to Sherpa for question:', questionId);
      const response = await apiRequest('POST', `/api/questions/${questionId}/revert-to-ai`);
      console.log('Revert response:', response);
      return response;
    },
    onSuccess: async (data, questionId) => {
      console.log('Revert successful, invalidating queries...');
      // Invalidate and refetch the queries
      await queryClient.invalidateQueries({ queryKey: [`/api/documents/${documentId}/results`] });
      await queryClient.refetchQueries({ queryKey: [`/api/documents/${documentId}/results`] });
      console.log('Query refetch completed');
      toast({
        title: "Reverted to Sherpa Analysis",
        description: "Successfully restored the original Sherpa analysis results.",
        variant: "default",
      });
    },
    onError: (error: Error) => {
      console.error('Revert failed:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      toast({
        title: "Error",
        description: `Failed to revert to Sherpa analysis: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Export functions
  const exportRubric = (format: 'rubric-markdown' | 'csv' | 'standards-summary') => {
    if (!documentResult) return;
    
    const { document, results } = documentResult;
    
    switch (format) {
      case 'rubric-markdown':
        generateMarkdownRubric(document, results);
        break;
      case 'csv':
        generateCSVExport(document, results);
        break;
      case 'standards-summary':
        generateStandardsSummary(document, results);
        break;
    }
  };

  const generateMarkdownRubric = (doc: DocumentResult['document'], results: DocumentResult['results']) => {
    // Create markdown rubric content that can be pasted into Google Docs
    const markdownContent = generateMarkdownRubricContent(doc, results);
    
    // Download as markdown file
    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${doc.fileName.replace(/\.[^/.]+$/, '')}_rubric.md`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Rubric Generated",
      description: "Markdown rubric ready for Google Docs - just copy and paste!",
      variant: "default",
    });
  };

  const generateCSVExport = (doc: DocumentResult['document'], results: DocumentResult['results']) => {
    const csvRows = [
      ['Question Number', 'Question Text', 'Standards', 'Rigor Level', 'DOK Level', 'Source', 'Confidence', 'Justification']
    ];
    
    results.forEach(question => {
      // Use teacher override as truth if available, otherwise use Sherpa analysis
      const effectiveStandards = question.teacherOverride?.overriddenStandards || question.result?.consensusStandards || [];
      const effectiveRigor = question.teacherOverride?.overriddenRigorLevel || question.result?.consensusRigorLevel || 'mild';
      const source = question.teacherOverride ? 'Teacher Override' : 'Standards Sherpa';
      const confidence = question.teacherOverride?.confidenceLevel || question.result?.confidenceScore || 'N/A';
      const justification = question.teacherOverride?.teacherJustification || question.aiResponses?.[0]?.rigorJustification || '';
      
      const standardsCodes = effectiveStandards.map(s => s.code).join('; ');
      const dokLevel = effectiveRigor === 'mild' ? 'DOK 1-2' : effectiveRigor === 'medium' ? 'DOK 2-3' : 'DOK 3-4';
      
      csvRows.push([
        question.questionNumber.toString(),
        `"${question.questionText.replace(/"/g, '""')}"`,
        `"${standardsCodes}"`,
        effectiveRigor,
        dokLevel,
        source,
        confidence.toString(),
        `"${justification.replace(/"/g, '""')}"`
      ]);
    });
    
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${doc.fileName.replace(/\.[^/.]+$/, '')}_analysis.csv`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "CSV Export Complete",
      description: "Analysis data exported successfully",
      variant: "default",
    });
  };

  const generateStandardsSummary = (doc: DocumentResult['document'], results: DocumentResult['results']) => {
    const summaryContent = generateStandardsSummaryContent(doc, results);
    
    const blob = new Blob([summaryContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${doc.fileName.replace(/\.[^/.]+$/, '')}_standards_summary.txt`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Standards Summary Generated",
      description: "Standards summary downloaded successfully",
      variant: "default",
    });
  };

  const generateMarkdownRubricContent = (doc: DocumentResult['document'], results: DocumentResult['results']) => {
    const rubricTitle = doc.fileName.replace(/\.[^/.]+$/, '');
    
    let content = `# ${rubricTitle}\n\n## Rubric\n\n`;
    content += `| Criteria | Points | Full Credit | Partial Credit | Minimal Credit | No Credit |\n`;
    content += `|----------|--------|-------------|----------------|----------------|----------|\n`;
    
    results.forEach((question, index) => {
      const effectiveStandards = question.teacherOverride?.overriddenStandards || question.result?.consensusStandards || [];
      const effectiveRigor = question.teacherOverride?.overriddenRigorLevel || question.result?.consensusRigorLevel || 'mild';
      const questionText = question.questionText.length > 40 
        ? question.questionText.substring(0, 40) + '...' 
        : question.questionText;
      
      // Get rigor emoji
      const rigorEmoji = effectiveRigor === 'mild' ? '🌶️' : 
                        effectiveRigor === 'medium' ? '🌶️🌶️' : '🌶️🌶️🌶️';
      
      // Get primary standard
      const primaryStandard = effectiveStandards[0]?.code || 'No Standard';
      
      const criteria = `**Q${question.questionNumber}:** ${questionText}<br><br>${primaryStandard}<br><br>${rigorEmoji}`;
      
      // Different rubric criteria based on rigor level
      let fullCredit, partialCredit, minimalCredit, noCredit;
      
      if (effectiveRigor === 'mild') {
        fullCredit = 'Correctly solves equation with accurate solution. ✔️';
        partialCredit = 'N/A';
        minimalCredit = 'Attempts solution but with errors or no attempt. 𝔁';
        noCredit = 'Irrelevant work or entirely incorrect. 𝔁';
      } else if (effectiveRigor === 'medium') {
        fullCredit = 'Correctly solves equation with accurate solution. ✔️';
        partialCredit = 'Solves with minor errors in steps. ✔️s';
        minimalCredit = 'Attempts solution but with significant errors. 𝔁';
        noCredit = 'No attempt or entirely incorrect. 𝔁';
      } else { // spicy
        fullCredit = 'Correctly applies advanced concepts and solves with accurate solution. ✔️';
        partialCredit = 'Solves with minor errors in steps. ✔️s';
        minimalCredit = 'Attempts solution but with significant errors. 𝔁';
        noCredit = 'No attempt or entirely incorrect. 𝔁';
      }
      
      content += `| ${criteria} |  | ${fullCredit} | ${partialCredit} | ${minimalCredit} | ${noCredit} |\n`;
    });
    
    return content;
  };

  const generateStandardsSummaryContent = (doc: DocumentResult['document'], results: DocumentResult['results']) => {
    const summaryTitle = `Standards Coverage Summary: ${doc.fileName}`;
    const generatedDate = new Date().toLocaleDateString();
    
    let content = `${summaryTitle}\n`;
    content += `Generated: ${generatedDate}\n`;
    content += `Source: Standards Sherpa with Teacher Overrides\n`;
    content += `\n${"=".repeat(60)}\n\n`;
    
    // Group questions by standards, respecting teacher overrides
    const standardsMap = new Map<string, {
      code: string;
      description: string;
      questions: number[];
      rigorLevels: string[];
      teacherModified: boolean[];
    }>();
    
    results.forEach(question => {
      const effectiveStandards = question.teacherOverride?.overriddenStandards || question.result?.consensusStandards || [];
      const effectiveRigor = question.teacherOverride?.overriddenRigorLevel || question.result?.consensusRigorLevel || 'mild';
      const isTeacherModified = !!question.teacherOverride;
      
      effectiveStandards.forEach(standard => {
        if (!standardsMap.has(standard.code)) {
          standardsMap.set(standard.code, {
            code: standard.code,
            description: standard.description,
            questions: [],
            rigorLevels: [],
            teacherModified: []
          });
        }
        const entry = standardsMap.get(standard.code)!;
        entry.questions.push(question.questionNumber);
        entry.rigorLevels.push(effectiveRigor);
        entry.teacherModified.push(isTeacherModified);
      });
    });
    
    content += `STANDARDS COVERAGE SUMMARY\n`;
    content += `Total Questions: ${results.length}\n`;
    content += `Standards Addressed: ${standardsMap.size}\n`;
    
    const teacherOverrides = results.filter(q => q.teacherOverride).length;
    if (teacherOverrides > 0) {
      content += `Teacher Overrides Applied: ${teacherOverrides} questions\n`;
    }
    
    content += `\n${"=".repeat(60)}\n\n`;
    
    Array.from(standardsMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([code, data]) => {
        const modifiedCount = data.teacherModified.filter(m => m).length;
        const modifiedIndicator = modifiedCount > 0 ? ` (${modifiedCount} teacher-modified)` : '';
        
        content += `${data.code}${modifiedIndicator}\n`;
        content += `Description: ${data.description}\n`;
        content += `Questions: ${data.questions.join(', ')}\n`;
        content += `Rigor Distribution: ${data.rigorLevels.join(', ')}\n`;
        content += `${"-".repeat(40)}\n\n`;
      });
    
    return content;
  };

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
            
            {/* Export Dropdown */}
            <div className="flex items-center space-x-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                    <ChevronDown className="w-4 h-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportRubric('rubric-markdown')}>
                    <FileText className="w-4 h-4 mr-2" />
                    Rubric (Markdown for Google Docs)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportRubric('csv')}>
                    <Download className="w-4 h-4 mr-2" />
                    CSV Data Export
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportRubric('standards-summary')}>
                    <Target className="w-4 h-4 mr-2" />
                    Standards Summary
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Actions
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
                                {question.teacherOverride ? (
                                  <div className="space-y-2">
                                    {question.teacherOverride.overriddenStandards.map((standard, stdIndex) => (
                                      <div key={stdIndex} className="text-sm text-slate-900">
                                        <Badge variant="outline" className="font-mono text-xs mr-2">
                                          {standard.code}
                                        </Badge>
                                        {standard.description}
                                      </div>
                                    ))}
                                  </div>
                                ) : question.result?.consensusStandards && question.result.consensusStandards.length > 0 ? (
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
                                {question.teacherOverride ? (
                                  <div className="flex items-center space-x-2">
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <RigorBadge level={question.teacherOverride.overriddenRigorLevel} />
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm min-w-48 max-h-64 overflow-y-auto p-4 bg-slate-800 text-white border-slate-700">
                                        <p className="text-sm leading-6 whitespace-pre-wrap break-words">{question.teacherOverride.teacherJustification}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                    <Badge variant="outline" className="text-xs text-green-600 border-green-300">TEACHER</Badge>
                                    {question.teacherOverride.hasDomainChange && (
                                      <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">DOMAIN CHANGE</Badge>
                                    )}
                                  </div>
                                ) : question.result ? (
                                  <div className="flex items-center space-x-2">
                                    {question.aiResponses && question.aiResponses.length > 0 && question.aiResponses[0].rigorJustification ? (
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <RigorBadge level={question.result.consensusRigorLevel} />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-sm min-w-48 max-h-64 overflow-y-auto p-4 bg-slate-800 text-white border-slate-700">
                                          <p className="text-sm leading-6 whitespace-pre-wrap break-words">{question.aiResponses[0].rigorJustification}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      <RigorBadge level={question.result.consensusRigorLevel} />
                                    )}
                                    <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">SHERPA</Badge>
                                  </div>
                                ) : (
                                  <span className="text-sm text-slate-400">Not analyzed</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {question.result && (
                                  <div className="flex space-x-2">
                                    <Dialog 
                                      open={openDialogs[question.id] || false}
                                      onOpenChange={(open) => {
                                        setOpenDialogs(prev => ({ ...prev, [question.id]: open }));
                                      }}
                                    >
                                      <DialogTrigger asChild>
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          onClick={() => {
                                            setEditingQuestionId(question.id);
                                            setOpenDialogs(prev => ({ ...prev, [question.id]: true }));
                                            // Use teacher override data if it exists, otherwise use AI data
                                            const currentData = question.teacherOverride ? {
                                              rigorLevel: question.teacherOverride.overriddenRigorLevel,
                                              standards: question.teacherOverride.overriddenStandards?.map(s => s.code).join(', ') || '',
                                              justification: question.teacherOverride.teacherJustification || '',
                                              confidence: question.teacherOverride.confidenceLevel || 5
                                            } : {
                                              rigorLevel: question.result?.consensusRigorLevel || 'mild',
                                              standards: question.result?.consensusStandards?.map(s => s.code).join(', ') || '',
                                              justification: question.aiResponses?.[0]?.rigorJustification || '',
                                              confidence: 5
                                            };
                                            setOverrideFormData(currentData);
                                          }}
                                        >
                                          <Edit3 className="w-4 h-4 mr-1" />
                                          Override
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="max-w-2xl">
                                        <DialogHeader>
                                          <DialogTitle>Override Sherpa Analysis - Question {question.questionNumber}</DialogTitle>
                                        </DialogHeader>
                                        <TeacherOverrideForm 
                                          questionId={question.id}
                                          questionText={question.questionText}
                                          initialData={overrideFormData}
                                          onSuccess={() => {
                                            toast({ title: "Override saved successfully" });
                                            queryClient.invalidateQueries({ queryKey: [`/api/documents/${documentId}/results`] });
                                            // Close the dialog
                                            setOpenDialogs(prev => ({ ...prev, [question.id]: false }));
                                          }}
                                        />
                                      </DialogContent>
                                    </Dialog>
                                    
                                    {/* Show Revert to Sherpa button if there's a teacher override */}
                                    {question.teacherOverride && (
                                      <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => revertToAiMutation.mutate(question.id)}
                                        disabled={revertToAiMutation.isPending}
                                        className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                      >
                                        <RotateCcw className="w-4 h-4 mr-1" />
                                        {revertToAiMutation.isPending ? 'Reverting...' : 'Revert to Sherpa'}
                                      </Button>
                                    )}
                                  </div>
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

// Teacher Override Form Component
function TeacherOverrideForm({ 
  questionId, 
  questionText, 
  initialData, 
  onSuccess 
}: {
  questionId: string;
  questionText: string;
  initialData: {
    rigorLevel: 'mild' | 'medium' | 'spicy';
    standards: string;
    justification: string;
    confidence: number;
  };
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState(initialData);
  const { toast } = useToast();
  const [standardsValidation, setStandardsValidation] = useState<{
    valid: CommonCoreStandard[];
    invalid: string[];
    suggestions: { [key: string]: CommonCoreStandard[] };
  } | null>(null);
  const [domainChangeWarning, setDomainChangeWarning] = useState<{
    hasSignificantChange: boolean;
    originalDomains: string[];
    newDomains: string[];
    changes: string[];
  } | null>(null);
  
  const saveOverrideMutation = useMutation({
    mutationFn: async (data: any) => {
      // Safely process and validate standards input
      const processStandards = (standardsInput: string) => {
        if (!standardsInput || typeof standardsInput !== 'string') {
          return [];
        }
        
        const codes = standardsInput
          .split(',')
          .map((code: string) => code.trim())
          .filter((code: string) => code.length > 0);
        
        const validation = validateStandardsList(codes);
        
        // For valid standards, use the full Common Core information
        const validStandards = validation.valid.map(standard => ({
          code: standard.code,
          description: standard.description,
          jurisdiction: 'Common Core',
          gradeLevel: standard.gradeLevel,
          subject: standard.subject
        }));
        
        // For invalid standards, still include them but mark as teacher-specified
        const invalidStandards = validation.invalid.map(code => ({
          code,
          description: `Teacher-specified standard: ${code} (not validated)`,
          jurisdiction: 'Common Core',
          gradeLevel: '9-12',
          subject: 'Mathematics'
        }));
        
        return [...validStandards, ...invalidStandards];
      };

      const payload = {
        overriddenRigorLevel: data.rigorLevel,
        overriddenStandards: processStandards(data.standards),
        teacherJustification: data.justification || '',
        confidenceLevel: data.confidence || 5,
        hasDomainChange: domainChangeWarning?.hasSignificantChange || false,
        domainChangeDetails: domainChangeWarning || null
      };
      
      return await apiRequest('POST', `/api/questions/${questionId}/override`, payload);
    },
    onSuccess: () => {
      onSuccess();
    },
    onError: (error) => {
      console.error('Teacher override submission error:', error);
      toast({ 
        title: "Error saving override", 
        description: error instanceof Error ? error.message : "Failed to save your changes. Please try again.",
        variant: "destructive" 
      });
    }
  });

  // Validate standards and detect domain changes whenever input changes
  const validateStandards = (standardsInput: string, originalStandards?: string[]) => {
    if (!standardsInput.trim()) {
      setStandardsValidation(null);
      setDomainChangeWarning(null);
      return;
    }
    
    const codes = standardsInput
      .split(',')
      .map((code: string) => code.trim())
      .filter((code: string) => code.length > 0);
    
    const validation = validateStandardsList(codes);
    setStandardsValidation(validation);
    
    // Check for domain changes if we have original standards
    if (originalStandards && originalStandards.length > 0) {
      const domainChange = detectDomainChange(originalStandards, codes);
      setDomainChangeWarning(domainChange.hasSignificantChange ? domainChange : null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation before submission
    if (!formData.rigorLevel) {
      toast({
        title: "Validation Error",
        description: "Please select a rigor level.",
        variant: "destructive"
      });
      return;
    }
    
    if (formData.confidence < 1 || formData.confidence > 5) {
      toast({
        title: "Validation Error", 
        description: "Confidence level must be between 1 and 5.",
        variant: "destructive"
      });
      return;
    }
    
    // Check if there are any invalid standards
    if (standardsValidation && standardsValidation.invalid.length > 0) {
      const proceed = window.confirm(
        `Warning: The following standards are not recognized Common Core standards: ${standardsValidation.invalid.join(', ')}. Do you want to proceed anyway?`
      );
      if (!proceed) {
        return;
      }
    }
    
    // Check for domain changes requiring justification
    if (domainChangeWarning && !formData.justification.trim()) {
      toast({
        title: "Justification Required",
        description: "Cross-domain changes require explanation. Please provide your reasoning in the justification field.",
        variant: "destructive"
      });
      return;
    }
    
    saveOverrideMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Question Preview */}
      <div className="bg-slate-50 p-4 rounded-lg">
        <h4 className="font-medium text-slate-900 mb-2">Question Text:</h4>
        <p className="text-sm text-slate-700">{questionText}</p>
      </div>

      {/* Rigor Level Override */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Rigor Level</label>
        <Select value={formData.rigorLevel} onValueChange={(value: 'mild' | 'medium' | 'spicy') => 
          setFormData(prev => ({ ...prev, rigorLevel: value }))
        }>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mild">🍃 Mild (DOK 1-2) - Basic recall & application</SelectItem>
            <SelectItem value="medium">🌶️ Medium (DOK 2-3) - Analysis & reasoning</SelectItem>
            <SelectItem value="spicy">🔥 Spicy (DOK 3-4) - Synthesis & evaluation</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Standards Override */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Standards (comma-separated codes)</label>
        <Input
          value={formData.standards}
          onChange={(e) => {
            setFormData(prev => ({ ...prev, standards: e.target.value }));
            // Get original standards from initial data to detect domain changes
            const originalCodes = initialData.standards
              .split(',')
              .map(s => s.trim())
              .filter(s => s.length > 0);
            validateStandards(e.target.value, originalCodes);
          }}
          placeholder="e.g., A-REI.B.4, F-BF.A.1, RL.3.1"
          className={standardsValidation?.invalid.length || domainChangeWarning ? "border-amber-300" : ""}
        />
        <p className="text-xs text-slate-500">Enter valid Common Core standard codes separated by commas</p>
        
        {/* Validation Feedback */}
        {standardsValidation && (
          <div className="space-y-2">
            {standardsValidation.valid.length > 0 && (
              <div className="text-xs text-green-600">
                ✓ Valid standards: {standardsValidation.valid.map(s => s.code).join(', ')}
              </div>
            )}
            
            {standardsValidation.invalid.length > 0 && (
              <Alert className="border-amber-300 bg-amber-50">
                <AlertDescription className="text-xs">
                  <div className="mb-1">
                    <strong>Unrecognized standards:</strong> {standardsValidation.invalid.join(', ')}
                  </div>
                  {Object.entries(standardsValidation.suggestions).map(([invalid, suggestions]) => (
                    suggestions.length > 0 && (
                      <div key={invalid} className="mt-1">
                        <strong>{invalid}</strong> - Did you mean: {(suggestions as CommonCoreStandard[]).slice(0, 2).map(s => s.code).join(', ')}?
                      </div>
                    )
                  ))}
                </AlertDescription>
              </Alert>
            )}
            
            {/* Domain Change Warning */}
            {domainChangeWarning && (
              <Alert className="border-orange-400 bg-orange-50">
                <AlertDescription className="text-sm">
                  <div className="mb-2 font-medium text-orange-800">
                    ⚠️ Significant Domain Change Detected
                  </div>
                  <div className="text-xs text-orange-700 mb-2">
                    {domainChangeWarning.changes.join(' • ')}
                  </div>
                  <div className="text-xs text-orange-600">
                    You're changing from <strong>{domainChangeWarning.originalDomains.join(', ')}</strong> to <strong>{domainChangeWarning.newDomains.join(', ')}</strong>.
                    Please provide additional justification below explaining why this change better reflects the question's content.
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </div>

      {/* Justification */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">
          Your Justification
          {domainChangeWarning && <span className="text-orange-600 ml-1">*Required for domain changes</span>}
        </label>
        <Textarea
          value={formData.justification}
          onChange={(e) => setFormData(prev => ({ ...prev, justification: e.target.value }))}
          placeholder={domainChangeWarning 
            ? "Please explain why this cross-domain change better reflects the question's content..."
            : "Explain your reasoning for this rigor level and standards alignment..."
          }
          rows={domainChangeWarning ? 5 : 4}
          className={domainChangeWarning && !formData.justification.trim() ? "border-orange-300" : ""}
        />
        {domainChangeWarning && (
          <p className="text-xs text-orange-600">
            Cross-domain changes require explanation to help improve our AI training and validate teacher corrections.
          </p>
        )}
      </div>

      {/* Confidence Level */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Confidence Level (1-5)</label>
        <Select value={formData.confidence.toString()} onValueChange={(value) => 
          setFormData(prev => ({ ...prev, confidence: parseInt(value) }))
        }>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 - Low confidence</SelectItem>
            <SelectItem value="2">2 - Below average</SelectItem>
            <SelectItem value="3">3 - Average</SelectItem>
            <SelectItem value="4">4 - High confidence</SelectItem>
            <SelectItem value="5">5 - Very high confidence</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end space-x-3">
        <Button 
          type="submit" 
          disabled={saveOverrideMutation.isPending}
          className="bg-green-600 hover:bg-green-700"
        >
          {saveOverrideMutation.isPending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Override
        </Button>
      </div>
    </form>
  );
}