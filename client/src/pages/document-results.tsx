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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
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
  ChevronDown,
  Eye,
  Edit,
  AlertTriangle
} from "lucide-react";
import { Link } from "wouter";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Label } from "@/components/ui/label";

interface DocumentResult {
  document: {
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    teacherReviewStatus: 'not_reviewed' | 'reviewed_and_accepted' | 'reviewed_and_overridden';
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
    finalRigorLevel: 'mild' | 'medium' | 'spicy' | null;
    finalStandards: Array<{
      code: string;
      description: string;
      jurisdiction: string;
      gradeLevel?: string;
      subject?: string;
    }>;
    confidenceScore: number | null;
    isOverridden: boolean;
    rigorJustification?: string;
  }>;
}

// QuestionOverrideForm component for inline editing
interface QuestionOverrideFormProps {
  questionId: string;
  questionNumber: string;
  questionText: string;
  initialRigor?: string;
  initialStandards: string;
  isOverridden: boolean;
  onSaveOverride: (payload: any) => void;
  onCancel?: () => void;
  onRevert?: () => void;
  onCopyFrom?: (questionNumber: string) => void;
  allQuestions?: Array<{ questionNumber: number; finalRigorLevel: string; finalStandards: any[]; isOverridden: boolean; }>;
  isSaving?: boolean;
}

function QuestionOverrideForm({ questionId, questionNumber, questionText, initialRigor, initialStandards, isOverridden, onSaveOverride, onCancel, onRevert, onCopyFrom, allQuestions, isSaving }: QuestionOverrideFormProps) {
  const [rigor, setRigor] = useState(initialRigor || '');
  const [standards, setStandards] = useState(initialStandards);
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  const handleSave = () => {
    if (!rigor) {
      toast({
        title: "Error",
        description: "Please select a rigor level.",
        variant: "destructive",
      });
      return;
    }

    const processStandards = (standardsInput: string) => {
      if (!standardsInput || typeof standardsInput !== 'string') {
        return [];
      }
      const codes = standardsInput
        .split(',')
        .map((code: string) => code.trim())
        .filter((code: string) => code.length > 0);
        
      return codes.map((code: string) => ({
        code,
        description: '',
        jurisdiction: 'Unknown'
      }));
    };

    const payload = {
      questionId,
      overriddenRigorLevel: rigor,
      overriddenStandards: processStandards(standards),
      notes,
      confidenceScore: 5, // Default confidence
      editReason: 'Teacher override from document results'
    };

    onSaveOverride(payload);
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded">
        <strong>Question {questionNumber}:</strong> {questionText.substring(0, 150)}...
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="rigor" className="text-sm font-medium">Rigor Level</Label>
          <Select value={rigor} onValueChange={setRigor}>
            <SelectTrigger>
              <SelectValue placeholder="Select rigor level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mild">Mild</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="spicy">Spicy</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="standards" className="text-sm font-medium">Standards</Label>
          <Input 
            id="standards"
            value={standards}
            onChange={(e) => setStandards(e.target.value)}
            placeholder="Enter standards codes separated by commas (e.g., N-RN.B.3, A-SSE.A.1)"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="notes" className="text-sm font-medium">Notes (Optional)</Label>
          <Textarea 
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this override..."
            className="mt-1"
            rows={3}
          />
        </div>

        {/* Copy from another question */}
        {allQuestions && allQuestions.length > 0 && (
          <div>
            <Label className="text-sm font-medium">Copy from Question</Label>
            <Select onValueChange={(value) => onCopyFrom?.(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Copy analysis from another question..." />
              </SelectTrigger>
              <SelectContent>
                {allQuestions
                  .filter(q => q.questionNumber.toString() !== questionNumber)
                  .map((q) => (
                    <SelectItem key={q.questionNumber} value={q.questionNumber.toString()}>
                      Question {q.questionNumber} ({q.finalRigorLevel?.toUpperCase() || 'No analysis'})
                      {q.isOverridden && " [EDITED]"}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex justify-between">
          <div className="space-x-2">
            {isOverridden && onRevert && (
              <Button 
                type="button" 
                variant="outline"
                onClick={onRevert}
                className="text-blue-600 hover:text-blue-700"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Revert to Sherpa
              </Button>
            )}
          </div>
          <div className="space-x-2 flex">
            <Button 
              type="button" 
              variant="outline"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button 
              type="button"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Override'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DocumentResults() {
  const params = useParams<{ id: string }>();
  const docId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [openDialogs, setOpenDialogs] = useState<{ [key: string]: boolean }>({});
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<any>(null);
  const [overrideFormData, setOverrideFormData] = useState<{
    rigorLevel: 'mild' | 'medium' | 'spicy';
    standards: string;
    justification: string;
    confidence: number;
  }>({ rigorLevel: 'mild', standards: '', justification: '', confidence: 5 });
  
  // Copy/paste functionality - populates form fields instead of saving immediately
  const handleCopyFromQuestion = (targetQuestionId: string, sourceQuestionNumber: string) => {
    const sourceQuestion = docResult?.results?.find(r => r.questionNumber.toString() === sourceQuestionNumber);
    if (!sourceQuestion) return;
    
    // Populate form fields with copied data - use comma format for standards
    setOverrideFormData({
      rigorLevel: sourceQuestion.finalRigorLevel as 'mild' | 'medium' | 'spicy',
      standards: sourceQuestion.finalStandards?.map(s => 
        typeof s === 'string' ? s : s.code
      ).join(', ') || '',
      justification: `Copied from Question ${sourceQuestionNumber}`,
      confidence: sourceQuestion.confidenceScore || 5
    });
    
    toast({
      title: "Copied Successfully",
      description: `Rigor level and standards copied from Question ${sourceQuestionNumber}. Review and save when ready.`,
      variant: "default"
    });
  };


  const { data: docResult, isLoading, error } = useQuery<DocumentResult>({
    queryKey: [`/api/documents/${docId}/results`],
    enabled: !!docId,
    refetchInterval: (query) => {
      // Poll every 3 seconds if the doc is still processing or needs review
      const docStatus = query.state.data?.document?.status;
      const reviewStatus = query.state.data?.document?.teacherReviewStatus;
      return (docStatus === 'processing' || docStatus === 'pending' || reviewStatus === 'not_reviewed') ? 3000 : false;
    },
    refetchIntervalInBackground: true,
    staleTime: 0, // Always refetch to ensure fresh status
  });

  // Accept and proceed mutation with loading state
  const acceptAndProceedMutation = useMutation({
    mutationFn: async () => {
      if (!docId) {
        throw new Error('No doc ID available');
      }
      
      console.log(`[Accept] Starting accept process for doc: ${docId}`);
      
      const response = await fetch(`/api/documents/${docId}/accept`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include'
      });

      console.log(`[Accept] Response received - Status: ${response.status}, OK: ${response.ok}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[Accept] Error data:', errorData);
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('[Accept] Success response:', responseData);
      return responseData;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [`/api/documents/${docId}/results`] });
      await queryClient.invalidateQueries({ queryKey: ['/api/file-cabinet'] });
      
      toast({
        title: "Analysis Accepted",
        description: "Cover sheets and rubrics are now being generated and will appear in the File Cabinet.",
        variant: "default",
      });
    },
    onError: (error: Error) => {
      console.error('[Accept] Error in accept mutation:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to accept analysis',
        variant: "destructive",
      });
    },
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
      
      // Close any open dialogs
      const openDialog = document.querySelector('[data-state="open"][role="dialog"]');
      if (openDialog) {
        const closeButton = openDialog.querySelector('[aria-label="Close"]') as HTMLElement;
        if (closeButton) closeButton.click();
      }
      
      // Force immediate data refresh
      await queryClient.invalidateQueries({ queryKey: [`/api/documents/${docId}/results`] });
      await queryClient.refetchQueries({ queryKey: [`/api/documents/${docId}/results`] });
      console.log('Query refetch completed');
      toast({
        title: "Reverted to Sherpa Analysis",
        description: "Successfully restored the original Sherpa analysis results.",
        variant: "default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to revert to Sherpa analysis. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Function to handle save with confirmation
  const handleSaveWithConfirmation = (data: any) => {
    setPendingSaveData(data);
    setShowSaveConfirmation(true);
  };

  // Function to proceed with actual save
  const proceedWithSave = () => {
    if (pendingSaveData) {
      saveOverrideMutation.mutate(pendingSaveData);
    }
    setShowSaveConfirmation(false);
    setPendingSaveData(null);
  };

  // Save override mutation
  const saveOverrideMutation = useMutation({
    mutationFn: async (data: any) => {
      const processStandards = (standardsInput: string) => {
        if (!standardsInput || typeof standardsInput !== 'string') {
          return [];
        }
        
        const codes = standardsInput
          .split(',')
          .map((code: string) => code.trim())
          .filter((code: string) => code.length > 0);
          
        return codes.map((code: string) => ({
          code,
          description: '',
          jurisdiction: 'Unknown'
        }));
      };
      
      const processedStandards = processStandards(data.standards);
      
      const payload = {
        ...data,
        overriddenStandards: processedStandards
      };
      
      const response = await apiRequest('POST', `/api/questions/${data.questionId}/override`, payload);
      return { response, questionId: data.questionId };
    },
    onSuccess: async (data, variables) => {
      console.log('Override saved, invalidating cache for doc:', docId);
      
      // Close the dialog after successful save
      const openDialog = document.querySelector('[data-state="open"][role="dialog"]');
      if (openDialog) {
        const closeButton = openDialog.querySelector('[aria-label="Close"]') as HTMLElement;
        if (closeButton) closeButton.click();
      }
      
      // Force immediate data refresh
      await queryClient.invalidateQueries({ queryKey: [`/api/documents/${docId}/results`] });
      await queryClient.refetchQueries({ queryKey: [`/api/documents/${docId}/results`] });
      console.log('Cache refetch completed');
      
      toast({
        title: "Override Saved",
        description: "Changes saved successfully. Continue editing other questions or click 'Accept and Proceed' to generate rubrics.",
        variant: "default",
      });
    },
    onError: (error: any) => {
      console.error('Failed to save override:', error);
      toast({
        title: "Error",
        description: "Failed to save teacher override. Please try again.",
        variant: "destructive",
      });
    },
  });

  // If loading, show loading state
  if (isLoading) {
    return (
      <div className="flex h-screen bg-slate-50">
        <Sidebar />
        
        <div className="flex flex-col w-0 flex-1 overflow-hidden">
          <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow border-b border-slate-200">
            <div className="flex-1 px-4 flex justify-between items-center">
              <div className="flex items-center">
                <Link href="/results">
                  <Button variant="ghost" size="sm" className="mr-4">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </Link>
                <FileText className="w-6 h-6 text-blue-600 mr-3" />
                <h2 className="text-2xl font-semibold text-slate-800">Loading Analysis...</h2>
              </div>
            </div>
          </div>
          
          <main className="flex-1 relative overflow-y-auto focus:outline-none">
            <div className="py-6">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
                <div className="animate-pulse">
                  <div className="h-8 bg-slate-200 rounded mb-4"></div>
                  <div className="h-64 bg-slate-200 rounded"></div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // If error, show error state
  if (error || !docResult) {
    return (
      <div className="flex h-screen bg-slate-50">
        <Sidebar />
        
        <div className="flex flex-col w-0 flex-1 overflow-hidden">
          <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow border-b border-slate-200">
            <div className="flex-1 px-4 flex justify-between items-center">
              <div className="flex items-center">
                <Link href="/results">
                  <Button variant="ghost" size="sm" className="mr-4">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </Link>
                <FileText className="w-6 h-6 text-blue-600 mr-3" />
                <h2 className="text-2xl font-semibold text-slate-800">Error Loading Analysis</h2>
              </div>
            </div>
          </div>
          
          <main className="flex-1 relative overflow-y-auto focus:outline-none">
            <div className="py-6">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center">
                      <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
                      <h3 className="mt-2 text-sm font-medium text-slate-900">
                        Unable to load doc analysis
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {error?.message || 'An error occurred while loading the analysis.'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const handleAcceptAndProceed = () => {
    acceptAndProceedMutation.mutate();
  };

  // Export functions
  const exportRubric = (format: 'rubric-markdown' | 'rubric-pdf' | 'csv' | 'student-cover-sheet') => {
    if (!docResult) return;
    
    const doc = docResult.document;
    const results = docResult.results;
    
    switch (format) {
      case 'rubric-markdown':
        generateMarkdownRubric(doc, results);
        break;
      case 'rubric-pdf':
        generatePdfRubric(doc, results);
        break;
      case 'csv':
        generateCSVExport(doc, results);
        break;
      case 'student-cover-sheet':
        generateStudentCoverSheet(doc, results);
        break;
    }
  };

  const generateMarkdownRubric = (doc: DocumentResult['document'], results: DocumentResult['results']) => {
    // Create markdown rubric content that can be pasted into Google Docs
    const markdownContent = generateMarkdownRubricContent(doc, results);
    
    // Download as markdown file
    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.fileName.replace(/\.[^/.]+$/, '')}_rubric.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
      // NEW ARCHITECTURE: Use CONFIRMED data when available, fallback to old logic for compatibility
      const getEffectiveData = () => {
        if (question.confirmedData) {
          // Use CONFIRMED analysis data (single source of truth)
          return {
            standards: question.confirmedData.finalStandards || [],
            rigor: question.confirmedData.finalRigorLevel || 'mild',
            source: question.confirmedData.hasTeacherOverride ? 'Teacher (Confirmed)' : 'AI (Confirmed)',
            confidence: question.confirmedData.aiConfidenceScore || 'N/A'
          };
        } else {
          // Fallback to old scattered logic for docs without CONFIRMED analysis
          return {
            standards: question.teacherOverride?.overriddenStandards || question.result?.consensusStandards || [],
            rigor: question.teacherOverride?.overriddenRigorLevel || question.result?.consensusRigorLevel || 'mild',
            source: question.teacherOverride ? 'Teacher Override' : 'Standards Sherpa',
            confidence: question.teacherOverride?.confidenceScore || question.result?.confidenceScore || 'N/A'
          };
        }
      };
      
      const effectiveData = getEffectiveData();
      const effectiveStandards = effectiveData.standards;
      const effectiveRigor = effectiveData.rigor;
      const source = effectiveData.source;
      const confidence = effectiveData.confidence;
      const justification = question.teacherOverride?.notes || question.teacherOverride?.editReason || question.aiResponses?.[0]?.rigorJustification || '';
      
      const standardsCodes = effectiveStandards.map((s: any) => s.code).join('; ');
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
    const a = window.doc.createElement('a');
    a.href = url;
    a.download = `${doc.fileName.replace(/\.[^/.]+$/, '')}_analysis.csv`;
    window.doc.body.appendChild(a);
    a.click();
    window.doc.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "CSV Export Complete",
      description: "Analysis data exported successfully",
      variant: "default",
    });
  };

  const generateStudentCoverSheet = (doc: DocumentResult['document'], results: DocumentResult['results']) => {
    const pdf = new jsPDF('portrait', 'mm', 'a4');
    
    // Header
    pdf.setFontSize(16);
    pdf.text(`Test Cover Sheet: ${doc.fileName.replace(/\.[^/.]+$/, '')}`, 20, 20);
    
    pdf.setFontSize(12);
    pdf.text('What to expect on this assessment:', 20, 35);
    
    // Prepare table data
    const tableData: string[][] = [];
    
    // Sort questions numerically
    const sortedResults = [...results].sort((a, b) => a.questionNumber - b.questionNumber);
    
    sortedResults.forEach((question) => {
      // NEW ARCHITECTURE: Use CONFIRMED data for cover sheet generation
      const effectiveStandards = question.confirmedData?.finalStandards || question.teacherOverride?.overriddenStandards || question.result?.consensusStandards || [];
      const effectiveRigor = question.confirmedData?.finalRigorLevel || question.teacherOverride?.overriddenRigorLevel || question.result?.consensusRigorLevel || 'mild';
      
      const primaryStandard = effectiveStandards[0]?.code || 'No Standard';
      const rigorText = effectiveRigor === 'mild' ? 'MILD (*)' : 
                       effectiveRigor === 'medium' ? 'MEDIUM (**)' : 'SPICY (***)';
      
      // Generate generic topic description based on standard
      let topicDescription = 'Mathematical concepts and problem solving';
      if (primaryStandard.includes('A-REI')) {
        topicDescription = 'Solving equations and inequalities';
      } else if (primaryStandard.includes('A-APR')) {
        topicDescription = 'Arithmetic with polynomials and rational expressions';
      } else if (primaryStandard.includes('A-SSE')) {
        topicDescription = 'Seeing structure in expressions';
      } else if (primaryStandard.includes('F-')) {
        topicDescription = 'Functions and function notation';
      } else if (primaryStandard.includes('G-')) {
        topicDescription = 'Geometric relationships and proofs';
      } else if (primaryStandard.includes('S-')) {
        topicDescription = 'Statistics and probability';
      }
      
      tableData.push([
        question.questionNumber.toString(),
        primaryStandard,
        topicDescription,
        rigorText
      ]);
    });
    
    // Add table
    autoTable(pdf, {
      startY: 45,
      head: [['Question', 'Standard', 'Topic', 'Rigor Level']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 25 },  // Question
        1: { cellWidth: 40 },  // Standard
        2: { cellWidth: 90 },  // Topic
        3: { cellWidth: 35 }   // Rigor Level
      },
      margin: { top: 45, left: 20, right: 20 }
    });
    
    // Footer note
    const finalY = (pdf as any).lastAutoTable.finalY + 20;
    pdf.setFontSize(9);
    pdf.text('Rigor Levels: * = Basic recall/computation, ** = Application/analysis, *** = Strategic thinking/reasoning', 20, finalY);
    
    // Save
    pdf.save(`${doc.fileName.replace(/\.[^/.]+$/, '')}_cover_sheet.pdf`);
    
    toast({
      title: "Cover Sheet Generated",
      description: "Student-facing test cover sheet created successfully",
      variant: "default",
    });
  };

  const generateMarkdownRubricContent = (doc: DocumentResult['document'], results: DocumentResult['results']) => {
    const rubricTitle = doc.fileName.replace(/\.[^/.]+$/, '');
    
    let content = `# ${rubricTitle}\n\n## Rubric\n\n`;
    content += `| Criteria | Demonstrates Understanding | Understanding with Minor Mistakes | Demonstrates Lack of Understanding | No Attempt |\n`;
    content += `|----------|---------------------------|----------------------------------|-----------------------------------|----------|\n`;
    
    // Sort questions numerically by question number
    const sortedResults = [...results].sort((a, b) => a.questionNumber - b.questionNumber);
    
    sortedResults.forEach((question, index) => {
      // NEW ARCHITECTURE: Use CONFIRMED data for rubric generation
      const effectiveStandards = question.confirmedData?.finalStandards || question.teacherOverride?.overriddenStandards || question.result?.consensusStandards || [];
      const effectiveRigor = question.confirmedData?.finalRigorLevel || question.teacherOverride?.overriddenRigorLevel || question.result?.consensusRigorLevel || 'mild';
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
      
      content += `| ${criteria} | ${fullCredit} | ${partialCredit} | ${minimalCredit} | ${noCredit} |\n`;
    });
    
    return content;
  };



  const generatePdfRubric = (doc: DocumentResult['document'], results: DocumentResult['results']) => {
    const pdf = new jsPDF('landscape'); // Set landscape orientation
    const rubricTitle = doc.fileName.replace(/\.[^/.]+$/, '');
    
    // Add title
    pdf.setFontSize(20);
    pdf.text(rubricTitle, 20, 30);
    
    pdf.setFontSize(16);
    pdf.text('Rubric', 20, 45);
    
    // Prepare table data with proper numerical sorting
    const tableData: string[][] = [];
    
    // Sort questions numerically by question number
    const sortedResults = [...results].sort((a, b) => a.questionNumber - b.questionNumber);
    
    sortedResults.forEach((question) => {
      const effectiveStandards = question.teacherOverride?.overriddenStandards || question.result?.consensusStandards || [];
      const effectiveRigor = question.teacherOverride?.overriddenRigorLevel || question.result?.consensusRigorLevel || 'mild';
      const questionText = question.questionText.length > 60 
        ? question.questionText.substring(0, 60) + '...' 
        : question.questionText;
      
      // Get rigor text (no emojis for PDF compatibility)
      const rigorText = effectiveRigor === 'mild' ? 'MILD (*)' : 
                       effectiveRigor === 'medium' ? 'MEDIUM (**)' : 'SPICY (***)';
      
      const primaryStandard = effectiveStandards[0]?.code || 'No Standard';
      const criteria = `Q${question.questionNumber}: ${questionText}\n\n${primaryStandard}\n\n${rigorText}`;
      
      // Different rubric criteria based on rigor level
      let fullCredit, partialCredit, minimalCredit, noCredit;
      
      if (effectiveRigor === 'mild') {
        fullCredit = 'Correctly solves equation with accurate solution.';
        partialCredit = 'Solves correctly with minor computational errors.';
        minimalCredit = 'Shows some understanding but with significant errors or gaps.';
        noCredit = 'No work shown or completely incorrect approach.';
      } else if (effectiveRigor === 'medium') {
        fullCredit = 'Correctly applies concepts and solves with accurate solution.';
        partialCredit = 'Applies concepts correctly with minor errors in execution.';
        minimalCredit = 'Shows partial understanding but lacks complete conceptual grasp.';
        noCredit = 'No work shown or completely incorrect approach.';
      } else { // spicy
        fullCredit = 'Correctly applies advanced concepts with sophisticated reasoning.';
        partialCredit = 'Demonstrates strong understanding with minor errors in complex steps.';
        minimalCredit = 'Shows some conceptual understanding but lacks depth or accuracy.';
        noCredit = 'No work shown or completely incorrect approach.';
      }
      
      tableData.push([criteria, fullCredit, partialCredit, minimalCredit, noCredit]);
    });
    
    // Add table
    autoTable(pdf, {
      startY: 55,
      head: [['Criteria', 'Demonstrates Understanding', 'Understanding with Minor Mistakes', 'Demonstrates Lack of Understanding', 'No Attempt']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 80 }, // Criteria
        1: { cellWidth: 50 }, // Full Credit
        2: { cellWidth: 50 }, // Partial Credit
        3: { cellWidth: 50 }, // Minimal Credit
        4: { cellWidth: 50 }  // No Credit
      },
      margin: { top: 55, left: 15, right: 15 }
    });
    
    // Save the PDF
    pdf.save(`${rubricTitle}_rubric.pdf`);
    
    toast({
      title: "PDF Rubric Generated",
      description: "PDF rubric downloaded successfully",
      variant: "default",
    });
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

  if (error || !docResult) {
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
                Unable to load the analysis results for this doc.
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
                Analysis Results: {docResult?.document?.fileName}
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
                  <DropdownMenuItem onClick={() => exportRubric('rubric-pdf')}>
                    <FileText className="w-4 h-4 mr-2" />
                    Rubric (PDF)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportRubric('csv')}>
                    <Download className="w-4 h-4 mr-2" />
                    CSV Data Export
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportRubric('student-cover-sheet')}>
                    <Target className="w-4 h-4 mr-2" />
                    Student Facing Test Cover Sheet
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Main Content - Two-Pane Layout for Review, Single-Pane for Accepted */}
        <main className="flex-1 relative overflow-hidden focus:outline-none">
          {docResult?.document?.status === 'completed' && docResult?.document?.teacherReviewStatus === 'not_reviewed' ? (
            /* TWO-PANE LAYOUT: Original doc + AI analysis side by side */
            <ResizablePanelGroup direction="horizontal" className="h-full">
              {/* LEFT PANE: Original Document */}
              <ResizablePanel defaultSize={50} minSize={30} maxSize={70}>
                <div className="h-full flex flex-col bg-white">
                  {/* Document Header */}
                  <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50">
                    <div className="flex items-center">
                      <Eye className="w-4 h-4 text-slate-600 mr-2" />
                      <h3 className="text-sm font-medium text-slate-900">Original Document</h3>
                      <Badge variant="outline" className="ml-2 text-xs">
                        {docResult?.document?.fileName}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Document Viewer */}
                  <div className="flex-1 overflow-hidden">
                    <iframe
                      src={`/api/documents/${docId}/download`}
                      className="w-full h-full border-0"
                      title={`PDF: ${docResult?.document?.fileName}`}
                      data-testid="doc-viewer-iframe"
                    />
                  </div>
                </div>
              </ResizablePanel>

              {/* RESIZABLE HANDLE */}
              <ResizableHandle withHandle />

              {/* RIGHT PANE: AI Analysis */}
              <ResizablePanel defaultSize={50} minSize={30} maxSize={70}>
                <div className="h-full flex flex-col bg-slate-50">
                  {/* Analysis Header */}
                  <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Brain className="w-4 h-4 text-blue-600 mr-2" />
                        <h3 className="text-sm font-medium text-slate-900">AI Analysis Results</h3>
                        <Badge variant="secondary" className="ml-2 bg-yellow-100 text-yellow-800">
                          Awaiting Review
                        </Badge>
                      </div>
                      
                      {/* Accept & Proceed Button */}
                      <Button
                        onClick={() => {
                          console.log('[Button] Accept & Proceed button clicked');
                          handleAcceptAndProceed();
                        }}
                        className={`${
                          acceptAndProceedMutation.isPending 
                            ? 'bg-gray-400 hover:bg-gray-400 cursor-not-allowed' 
                            : 'bg-green-600 hover:bg-green-700'
                        } text-white`}
                        size="sm"
                        disabled={acceptAndProceedMutation.isPending}
                        data-testid="accept-proceed-button"
                      >
                        {acceptAndProceedMutation.isPending ? '⏳ Processing...' : '✅ Accept & Proceed'}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Analysis Content - Scrollable */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="p-4 space-y-6">
                      {/* Ready for Review Message */}
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="text-lg font-semibold text-blue-900">Ready for Teacher Review</h4>
                        <p className="text-sm text-blue-700 mt-1">
                          Standards Sherpa has completed its analysis. Review the results below and click "Accept & Proceed" to generate docs, or use "Override" buttons to edit specific questions.
                        </p>
                      </div>

                      {/* Document Overview Compact */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center text-lg">
                            <FileText className="w-5 h-5 mr-2" />
                            Document Overview
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-medium text-slate-500">Status</p>
                              <ProcessingStatus status={docResult?.document?.status} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-500">File Size</p>
                              <p className="text-lg font-semibold text-slate-900">
                                {((docResult?.document?.fileSize || 0) / 1024 / 1024).toFixed(1)} MB
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-500">Processing Time</p>
                              <p className="text-lg font-semibold text-slate-900 flex items-center">
                                <Clock className="w-4 h-4 mr-1" />
                                {formatProcessingTime(docResult?.document?.processingStarted, docResult?.document?.processingCompleted)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-500">Jurisdictions</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {docResult?.document?.jurisdictions?.map((jurisdiction, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {jurisdiction}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Question Analysis Results */}
                      <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-slate-900 flex items-center">
                          <Target className="w-5 h-5 mr-2" />
                          Question Analysis ({docResult.results?.length || 0} questions)
                        </h4>
                        
                        {docResult.results?.map((result, index) => (
                          <Card key={result.id} className="border-l-4 border-l-blue-500">
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base">
                                  Question {result.questionNumber}
                                  {result.isOverridden && (
                                    <Badge variant="outline" className="ml-2 text-xs">
                                      EDITED
                                    </Badge>
                                  )}
                                </CardTitle>
                                <div className="flex items-center space-x-2 relative">
                                  <div className="group relative">
                                    <Badge 
                                      variant={
                                        result.finalRigorLevel === 'spicy' ? 'destructive' :
                                        result.finalRigorLevel === 'medium' ? 'default' : 'secondary'
                                      }
                                      className="text-xs cursor-help"
                                    >
                                      {result.finalRigorLevel?.toUpperCase() || 'PENDING'}
                                    </Badge>
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-sm rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 max-w-xs">
                                      <div className="font-semibold mb-1">Sherpa's Reasoning:</div>
                                      <div className="text-xs leading-relaxed whitespace-normal">
                                        {(result as any).rigorJustification || 'Reasoning not available'}
                                      </div>
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
                                    </div>
                                  </div>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        data-testid={`button-edit-${result.questionNumber}`}
                                      >
                                        <Edit className="w-3 h-3 mr-1" />
                                        Edit
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Edit Question {result.questionNumber}</DialogTitle>
                                      </DialogHeader>
                                      <QuestionOverrideForm
                                        questionId={result.id}
                                        questionNumber={result.questionNumber.toString()}
                                        questionText={result.questionText}
                                        initialRigor={result.finalRigorLevel || ''}
                                        initialStandards={result.finalStandards?.map((s: any) => typeof s === 'string' ? s : s.code).join(', ') || ''}
                                        isOverridden={result.isOverridden}
                                        allQuestions={docResult?.results?.map(r => ({
                                          questionNumber: r.questionNumber,
                                          finalRigorLevel: r.finalRigorLevel || '',
                                          finalStandards: r.finalStandards || [],
                                          isOverridden: r.isOverridden
                                        }))}
                                        onSaveOverride={(payload) => {
                                          saveOverrideMutation.mutate(payload);
                                        }}
                                        onRevert={() => {
                                          revertToAiMutation.mutate(result.id);
                                        }}
                                        onCopyFrom={(sourceQuestionNumber) => {
                                          handleCopyFromQuestion(result.id, sourceQuestionNumber);
                                        }}
                                        isSaving={saveOverrideMutation.isPending}
                                      />
                                    </DialogContent>
                                  </Dialog>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div>
                                <p className="text-sm font-medium text-slate-700 mb-1">Question Text:</p>
                                <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded">{result.questionText}</p>
                              </div>
                              
                              <div>
                                <p className="text-sm font-medium text-slate-700 mb-1">Standards:</p>
                                <div className="flex flex-wrap gap-1">
                                  {result.finalStandards && result.finalStandards.length > 0 ? (
                                    result.finalStandards.map((standard, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        {typeof standard === 'string' ? standard : standard.code}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className="text-xs text-slate-400 italic">No standards identified</span>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            /* SINGLE-PANE LAYOUT: Standard view for accepted docs */
            <div className="h-full overflow-y-auto">
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
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                        <div>
                          <p className="text-sm font-medium text-slate-500">Status</p>
                          <ProcessingStatus status={docResult?.document?.status} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-500">Teacher Review</p>
                          <div className="flex items-center space-x-2">
                            {docResult?.document?.teacherReviewStatus === 'not_reviewed' && (
                              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                Awaiting Review
                              </Badge>
                            )}
                            {docResult?.document?.teacherReviewStatus === 'reviewed_and_accepted' && (
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                ✓ Accepted
                              </Badge>
                            )}
                            {docResult?.document?.teacherReviewStatus === 'reviewed_and_overridden' && (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                ✓ Reviewed with Edits
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-500">File Size</p>
                          <p className="text-lg font-semibold text-slate-900">
                            {(docResult?.document?.fileSize / 1024 / 1024).toFixed(1)} MB
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-500">Processing Time</p>
                          <p className="text-lg font-semibold text-slate-900 flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {formatProcessingTime(docResult?.document?.processingStarted, docResult?.document?.processingCompleted)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-500">Jurisdictions</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {docResult?.document?.jurisdictions?.map((jurisdiction, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {jurisdiction}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );

  // If loading, show loading state
  if (isLoading) {
    return (
      <div className="flex h-screen bg-slate-50">
        <Sidebar />
        
        <div className="flex flex-col w-0 flex-1 overflow-hidden">
          <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow border-b border-slate-200">
            <div className="flex-1 px-4 flex justify-between items-center">
              <div className="flex items-center">
                <Link href="/results">
                  <Button variant="ghost" size="sm" className="mr-4">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </Link>
                <FileText className="w-6 h-6 text-blue-600 mr-3" />
                <h2 className="text-2xl font-semibold text-slate-800">Loading Analysis...</h2>
              </div>
            </div>
          </div>
          
          <main className="flex-1 relative overflow-y-auto focus:outline-none">
            <div className="py-6">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
                <div className="animate-pulse">
                  <div className="h-8 bg-slate-200 rounded mb-4"></div>
                  <div className="h-64 bg-slate-200 rounded"></div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // If error, show error state
  if (error || !docResult) {
    return (
      <div className="flex h-screen bg-slate-50">
        <Sidebar />
        
        <div className="flex flex-col w-0 flex-1 overflow-hidden">
          <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow border-b border-slate-200">
            <div className="flex-1 px-4 flex justify-between items-center">
              <div className="flex items-center">
                <Link href="/results">
                  <Button variant="ghost" size="sm" className="mr-4">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </Link>
                <FileText className="w-6 h-6 text-blue-600 mr-3" />
                <h2 className="text-2xl font-semibold text-slate-800">Error Loading Analysis</h2>
              </div>
            </div>
          </div>
          
          <main className="flex-1 relative overflow-y-auto focus:outline-none">
            <div className="py-6">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center">
                      <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
                      <h3 className="mt-2 text-sm font-medium text-slate-900">
                        Unable to load doc analysis
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {error?.message || 'An error occurred while loading the analysis.'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Extract data from query result  
  const doc = docResult.document;
  const results = docResult.results;
  const sortedResults = results?.slice().sort((a: any, b: any) => {
    // Custom sorting to handle mixed numeric/string question numbers
    const extractNumber = (str: string | number): number => {
      if (typeof str === 'number') return str;
      const match = str.toString().match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
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
                Analysis Results: {docResult?.document?.fileName}
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
                  <DropdownMenuItem onClick={() => exportRubric('rubric-pdf')}>
                    <FileText className="w-4 h-4 mr-2" />
                    Rubric (PDF)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportRubric('csv')}>
                    <Download className="w-4 h-4 mr-2" />
                    CSV Data Export
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportRubric('student-cover-sheet')}>
                    <Target className="w-4 h-4 mr-2" />
                    Student Facing Test Cover Sheet
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Main Content - Two-Pane Layout for Review, Single-Pane for Accepted */}
        <main className="flex-1 relative overflow-hidden focus:outline-none">
          {docResult?.document?.status === 'completed' && docResult?.document?.teacherReviewStatus === 'not_reviewed' ? (
            /* TWO-PANE LAYOUT: Original doc + AI analysis side by side */
            <ResizablePanelGroup direction="horizontal" className="h-full">
              {/* LEFT PANE: Original Document */}
              <ResizablePanel defaultSize={50} minSize={30} maxSize={70}>
                <div className="h-full flex flex-col bg-white">
                  {/* Document Header */}
                  <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50">
                    <div className="flex items-center">
                      <Eye className="w-4 h-4 text-slate-600 mr-2" />
                      <h3 className="text-sm font-medium text-slate-900">Original Document</h3>
                      <Badge variant="outline" className="ml-2 text-xs">
                        {docResult?.document?.fileName}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Document Viewer */}
                  <div className="flex-1 overflow-hidden">
                    <iframe
                      src={`/api/documents/${docId}/download`}
                      className="w-full h-full border-0"
                      title={`PDF: ${docResult?.document?.fileName}`}
                      data-testid="doc-viewer-iframe"
                    />
                  </div>
                </div>
              </ResizablePanel>

              {/* RESIZABLE HANDLE */}
              <ResizableHandle withHandle />

              {/* RIGHT PANE: AI Analysis */}
              <ResizablePanel defaultSize={50} minSize={30} maxSize={70}>
                <div className="h-full flex flex-col bg-slate-50">
                  {/* Analysis Header */}
                  <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Brain className="w-4 h-4 text-blue-600 mr-2" />
                        <h3 className="text-sm font-medium text-slate-900">AI Analysis Results</h3>
                        <Badge variant="secondary" className="ml-2 bg-yellow-100 text-yellow-800">
                          Awaiting Review
                        </Badge>
                      </div>
                      
                      {/* Accept & Proceed Button */}
                      <Button
                        onClick={() => {
                          console.log('[Button] Accept & Proceed button clicked');
                          handleAcceptAndProceed();
                        }}
                        className={`${
                          acceptAndProceedMutation.isPending 
                            ? 'bg-gray-400 hover:bg-gray-400 cursor-not-allowed' 
                            : 'bg-green-600 hover:bg-green-700'
                        } text-white`}
                        size="sm"
                        disabled={acceptAndProceedMutation.isPending}
                        data-testid="accept-proceed-button"
                      >
                        {acceptAndProceedMutation.isPending ? '⏳ Processing...' : '✅ Accept & Proceed'}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Analysis Content - Scrollable */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="p-4 space-y-6">
                      {/* Ready for Review Message */}
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="text-lg font-semibold text-blue-900">Ready for Teacher Review</h4>
                        <p className="text-sm text-blue-700 mt-1">
                          Standards Sherpa has completed its analysis. Review the results below and click "Accept & Proceed" to generate docs, or use "Override" buttons to edit specific questions.
                        </p>
                      </div>

                      {/* Document Overview Compact */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center text-lg">
                            <FileText className="w-5 h-5 mr-2" />
                            Document Overview
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-medium text-slate-500">Status</p>
                              <ProcessingStatus status={docResult?.document?.status} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-500">File Size</p>
                              <p className="text-lg font-semibold text-slate-900">
                                {((docResult?.document?.fileSize || 0) / 1024 / 1024).toFixed(1)} MB
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-500">Processing Time</p>
                              <p className="text-lg font-semibold text-slate-900 flex items-center">
                                <Clock className="w-4 h-4 mr-1" />
                                {formatProcessingTime(docResult?.document?.processingStarted, docResult?.document?.processingCompleted)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-500">Jurisdictions</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {docResult?.document?.jurisdictions?.map((jurisdiction, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {jurisdiction}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Question-by-Question Analysis */}
                      {sortedResults && sortedResults.length > 0 && (
                        <TooltipProvider>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Brain className="w-5 h-5 mr-2" />
                      Question-by-Question Analysis
                    </CardTitle>
                    <p className="text-sm text-slate-500">
                      Standards and rigor levels for each question in the doc
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
                            <tr key={question.id} className={`hover:bg-slate-50 ${question.teacherOverride ? 'bg-green-25 border-l-4 border-l-green-500 dark:border-l-green-400' : ''}`}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-slate-900 flex items-center">
                                  Question {question.questionNumber}
                                  {question.teacherOverride && (
                                    <Badge variant="outline" className="ml-2 text-xs text-green-600 border-green-300">
                                      <Edit3 className="w-3 h-3 mr-1" />
                                      EDITED
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {(() => {
                                  // NEW ARCHITECTURE: Use CONFIRMED data first, then fallback to old logic
                                  const effectiveStandards = question.confirmedData?.finalStandards || 
                                                            question.teacherOverride?.overriddenStandards || 
                                                            question.result?.consensusStandards || [];
                                  
                                  if (effectiveStandards.length > 0) {
                                    return (
                                      <div className="space-y-2">
                                        {effectiveStandards.map((standard: any, stdIndex: number) => (
                                          <div key={stdIndex} className="text-sm text-slate-900">
                                            <Badge variant="outline" className="font-mono text-xs mr-2">
                                              {standard.code}
                                            </Badge>
                                            {standard.description}
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  } else {
                                    return <span className="text-sm text-slate-400">No standards identified</span>;
                                  }
                                })()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {(() => {
                                  // NEW ARCHITECTURE: Use CONFIRMED data first, then fallback to old logic
                                  if (question.confirmedData) {
                                    const effectiveRigor = question.confirmedData.finalRigorLevel as 'mild' | 'medium' | 'spicy';
                                    const hasTeacherOverride = question.confirmedData.hasTeacherOverride;
                                    const confirmedDataAny = question.confirmedData as any;
                                    const justification = confirmedDataAny.teacherNotes || 
                                                        question.aiResponses?.[0]?.rigorJustification || 
                                                        'No justification available';
                                    
                                    return (
                                      <div className="flex items-center space-x-2">
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <RigorBadge level={effectiveRigor} />
                                          </TooltipTrigger>
                                          <TooltipContent className="max-w-sm min-w-48 max-h-64 overflow-y-auto p-4 bg-slate-800 text-white border-slate-700">
                                            <p className="text-sm leading-6 whitespace-pre-wrap break-words">
                                              {justification}
                                            </p>
                                          </TooltipContent>
                                        </Tooltip>
                                        <Badge variant="outline" className={`text-xs ${
                                          hasTeacherOverride 
                                            ? 'text-green-600 border-green-300 bg-green-50' 
                                            : 'text-blue-600 border-blue-300'
                                        }`}>
                                          {hasTeacherOverride ? (
                                            <>
                                              <Edit3 className="w-3 h-3 mr-1" />
                                              TEACHER (CONFIRMED)
                                            </>
                                          ) : (
                                            'SHERPA (CONFIRMED)'
                                          )}
                                        </Badge>
                                      </div>
                                    );
                                  } else if (question.teacherOverride) {
                                    return (
                                      <div className="flex items-center space-x-2">
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <RigorBadge level={question.teacherOverride.overriddenRigorLevel} />
                                          </TooltipTrigger>
                                          <TooltipContent className="max-w-sm min-w-48 max-h-64 overflow-y-auto p-4 bg-slate-800 text-white border-slate-700">
                                            <p className="text-sm leading-6 whitespace-pre-wrap break-words">
                                              {question.teacherOverride.notes || question.teacherOverride.editReason || 'Teacher override - no justification provided'}
                                            </p>
                                          </TooltipContent>
                                        </Tooltip>
                                        <Badge variant="outline" className="text-xs text-green-600 border-green-300 bg-green-50">
                                          <Edit3 className="w-3 h-3 mr-1" />
                                          TEACHER OVERRIDE
                                        </Badge>
                                      </div>
                                    );
                                  } else if (question.result) {
                                    return (
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
                                    );
                                  } else {
                                    return <span className="text-sm text-slate-400">Not analyzed</span>;
                                  }
                                })()}
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
                                          data-testid="override-button"
                                          onClick={() => {
                                            setEditingQuestionId(question.id);
                                            setOpenDialogs(prev => ({ ...prev, [question.id]: true }));
                                            // NEW ARCHITECTURE: Use CONFIRMED data first, then fallback to old logic
                                            const confirmedDataAny = question.confirmedData as any;
                                            const currentData = question.confirmedData ? {
                                              rigorLevel: question.confirmedData.finalRigorLevel as 'mild' | 'medium' | 'spicy',
                                              standards: question.confirmedData.finalStandards?.map((s: any) => s.code).join(', ') || '',
                                              justification: confirmedDataAny?.teacherNotes || question.aiResponses?.[0]?.rigorJustification || '',
                                              confidence: (confirmedDataAny?.teacherConfidenceScore || confirmedDataAny?.aiConfidenceScore || 5) as number
                                            } : question.teacherOverride ? {
                                              rigorLevel: question.teacherOverride.overriddenRigorLevel,
                                              standards: question.teacherOverride.overriddenStandards?.map(s => s.code).join(', ') || '',
                                              justification: question.teacherOverride.notes || question.teacherOverride.editReason || '',
                                              confidence: question.teacherOverride.confidenceScore || 5
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
                                          onSave={handleSaveWithConfirmation}
                                          onSuccess={() => {
                                            // Keep dialog open so user can continue editing
                                            // setOpenDialogs(prev => ({ ...prev, [question.id]: false }));
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
                      )}
                    </div>
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            /* SINGLE-PANE LAYOUT: Standard view for accepted docs */
            <div className="h-full overflow-y-auto">
              <div className="py-6">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
                  {/* Single-pane doc overview and analysis would go here */}
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Brain className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-slate-900 mb-2">Analysis Complete</h3>
                      <p className="text-slate-500">
                        This doc has been accepted and processed. View the generated docs in the File Cabinet.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      
      {/* Confirmation Dialog for Teacher Override Saves */}
      <AlertDialog open={showSaveConfirmation} onOpenChange={setShowSaveConfirmation}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-amber-600">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Commit Changes to Gradebook?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="text-slate-700">
                <strong>This action will:</strong>
              </p>
              <ul className="text-sm text-slate-600 space-y-1 pl-4">
                <li>• Save your override permanently</li>
                <li>• Regenerate rubrics with your changes</li>
                <li>• Commit results to the gradebook</li>
                <li>• Update all exported documents</li>
              </ul>
              <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded border border-amber-200">
                <strong>⚠️ Important:</strong> Once saved, these changes will be reflected in all generated rubrics and gradebooks. You can continue editing afterwards if needed.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="space-x-2">
            <AlertDialogCancel 
              onClick={() => {
                setShowSaveConfirmation(false);
                setPendingSaveData(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={proceedWithSave}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Yes, Commit to Gradebook
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Teacher Override Form Component
function TeacherOverrideForm({ 
  questionId, 
  questionText, 
  initialData, 
  onSave,
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
  onSave: (data: any) => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState(initialData);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const params = useParams<{ id: string }>();
  const docId = params?.id;
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
  
  // This mutation was moved to the top of the parent component

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
    
    // Use the confirmation system instead of direct save
    onSave({
      questionId,
      overriddenRigorLevel: formData.rigorLevel,
      overriddenStandards: formData.standards,
      notes: formData.justification,
      confidenceScore: formData.confidence,
      editReason: 'Teacher override from document results'
    });
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