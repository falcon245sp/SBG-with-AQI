import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/Sidebar";
import { FileUploader } from "@/components/FileUploader";
import { RigorBadge } from "@/components/RigorBadge";
import { ProcessingStatus } from "@/components/ProcessingStatus";
import { 
  FileText, 
  Brain, 
  GraduationCap, 
  Clock,
  Bell,
  ArrowRight,
  Eye,
  Upload,
  CheckCircle,
  Settings,
  Download,
  ChevronDown
} from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DocumentResult {
  id: string;
  fileName: string;
  status: string;
  createdAt: string;
  standardsCount: number;
  rigorLevel: 'mild' | 'medium' | 'spicy';
  processingTime: string;
  aiConsensus: {
    chatgpt: boolean;
    grok: boolean;
    claude: boolean;
  };
}

export default function Dashboard() {
  const { toast } = useToast();
  // Fixed values for testing - in production these come from API
  const customerId = "123";
  const jurisdictions = "Common Core";
  const [useFocusStandards, setUseFocusStandards] = useState(false);
  const [focusStandards, setFocusStandards] = useState("");

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/stats"],
  });

  // Fetch recent documents with live polling for processing documents
  const { data: documents, isLoading: documentsLoading } = useQuery<any[]>({
    queryKey: ["/api/documents"],
    refetchInterval: (query) => {
      // Poll every 2 seconds if there are any processing documents
      const hasProcessingDocs = query.state.data?.some((doc: any) => doc.status === 'processing' || doc.status === 'pending');
      return hasProcessingDocs ? 2000 : false;
    },
    refetchIntervalInBackground: true,
  });

  // Export functionality
  const handleExport = async (documentId: string, format: 'rubric-markdown' | 'rubric-pdf' | 'csv' | 'standards-summary') => {
    try {
      // Fetch document results first
      const response = await fetch(`/api/documents/${documentId}/results`);
      if (!response.ok) {
        throw new Error('Failed to fetch document results');
      }
      const documentResult = await response.json();
      const { document, results } = documentResult;
      
      // Generate export based on format
      switch (format) {
        case 'rubric-markdown':
          generateMarkdownRubric(document, results);
          break;
        case 'rubric-pdf':
          generatePdfRubric(document, results);
          break;
        case 'csv':
          generateCSVExport(document, results);
          break;
        case 'standards-summary':
          generateStandardsSummary(document, results);
          break;
      }
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: `Failed to export document: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Export utility functions (same as in document-results.tsx)
  const generateMarkdownRubric = (doc: any, results: any[]) => {
    const markdownContent = generateMarkdownRubricContent(doc, results);
    downloadFile(markdownContent, `${doc.fileName.replace(/\.[^/.]+$/, '')}_rubric.md`, 'text/markdown');
    
    toast({
      title: "Rubric Generated",
      description: "Markdown rubric ready for Google Docs - just copy and paste!",
      variant: "default",
    });
  };

  const generateCSVExport = (doc: any, results: any[]) => {
    const csvRows = [
      ['Question Number', 'Question Text', 'Standards', 'Rigor Level', 'DOK Level', 'Source', 'Confidence', 'Justification']
    ];
    
    results.forEach(question => {
      const effectiveStandards = question.teacherOverride?.overriddenStandards || question.result?.consensusStandards || [];
      const effectiveRigor = question.teacherOverride?.overriddenRigorLevel || question.result?.consensusRigorLevel || 'mild';
      const source = question.teacherOverride ? 'Teacher Override' : 'Standards Sherpa';
      const confidence = question.teacherOverride?.confidenceLevel || question.result?.confidenceScore || 'N/A';
      const justification = question.teacherOverride?.teacherJustification || question.aiResponses?.[0]?.rigorJustification || '';
      
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
    downloadFile(csvContent, `${doc.fileName.replace(/\.[^/.]+$/, '')}_analysis.csv`, 'text/csv');
    
    toast({
      title: "CSV Export Complete",
      description: "Analysis data exported successfully",
      variant: "default",
    });
  };

  const generateStandardsSummary = (doc: any, results: any[]) => {
    const summaryContent = generateStandardsSummaryContent(doc, results);
    downloadFile(summaryContent, `${doc.fileName.replace(/\.[^/.]+$/, '')}_standards_summary.txt`, 'text/plain');
    
    toast({
      title: "Standards Summary Generated",
      description: "Standards summary downloaded successfully",
      variant: "default",
    });
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = filename;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateMarkdownRubricContent = (doc: any, results: any[]) => {
    const rubricTitle = doc.fileName.replace(/\.[^/.]+$/, '');
    
    let content = `# ${rubricTitle}\n\n## Rubric\n\n`;
    content += `| Criteria | Full Credit | Partial Credit | Minimal Credit | No Credit |\n`;
    content += `|----------|-------------|----------------|----------------|----------|\n`;
    
    // Sort questions numerically by question number
    const sortedResults = [...results].sort((a, b) => a.questionNumber - b.questionNumber);
    
    sortedResults.forEach((question, index) => {
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
      
      content += `| ${criteria} | ${fullCredit} | ${partialCredit} | ${minimalCredit} | ${noCredit} |\n`;
    });
    
    return content;
  };

  const generatePdfRubric = (doc: any, results: any[]) => {
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
        fullCredit = 'Correctly solves equation with accurate solution. [FULL MASTERY]';
        partialCredit = 'N/A';
        minimalCredit = 'Attempts solution but with errors or no attempt. [NOT DEMONSTRATED]';
        noCredit = 'Irrelevant work or entirely incorrect. [NOT DEMONSTRATED]';
      } else if (effectiveRigor === 'medium') {
        fullCredit = 'Correctly solves equation with accurate solution. [FULL MASTERY]';
        partialCredit = 'Solves with minor errors in steps. [PARTIAL MASTERY]';
        minimalCredit = 'Attempts solution but with significant errors. [NOT DEMONSTRATED]';
        noCredit = 'No attempt or entirely incorrect. [NOT DEMONSTRATED]';
      } else { // spicy
        fullCredit = 'Correctly applies advanced concepts and solves with accurate solution. [FULL MASTERY]';
        partialCredit = 'Solves with minor errors in steps. [PARTIAL MASTERY]';
        minimalCredit = 'Attempts solution but with significant errors. [NOT DEMONSTRATED]';
        noCredit = 'No attempt or entirely incorrect. [NOT DEMONSTRATED]';
      }
      
      tableData.push([criteria, fullCredit, partialCredit, minimalCredit, noCredit]);
    });
    
    // Add table
    autoTable(pdf, {
      startY: 55,
      head: [['Criteria', 'Full Credit', 'Partial Credit', 'Minimal Credit', 'No Credit']],
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

  const generateStandardsSummaryContent = (doc: any, results: any[]) => {
    const summaryTitle = `Standards Coverage Summary: ${doc.fileName}`;
    const generatedDate = new Date().toLocaleDateString();
    
    let content = `${summaryTitle}\n`;
    content += `Generated: ${generatedDate}\n`;
    content += `Source: Standards Sherpa with Teacher Overrides\n`;
    content += `\n${"=".repeat(60)}\n\n`;
    
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
      
      effectiveStandards.forEach((standard: any) => {
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

  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Please select at least one file to upload.",
        variant: "destructive",
      });
      return;
    }

    // For multiple files, we'll process them one by one for now
    // In a future version, this could be optimized for batch processing
    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('document', file);
        formData.append('customerId', customerId);
        formData.append('jurisdictions', jurisdictions);

        // Add focus standards if specified
        if (useFocusStandards && focusStandards.trim()) {
          formData.append('focusStandards', focusStandards);
        }

        const endpoint = useFocusStandards ? '/api/documents/upload-with-standards' : '/api/documents/upload';
        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Upload failed for ${file.name}`);
        }

        successCount++;
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        errorCount++;
      }
    }

    // Show summary toast
    if (successCount > 0) {
      const message = files.length === 1 
        ? "Document uploaded and added to processing queue."
        : `${successCount} of ${files.length} documents uploaded successfully.`;
      
      toast({
        title: "Upload Complete",
        description: useFocusStandards 
          ? `${message} Focus standards configuration applied.`
          : message,
      });
    }

    if (errorCount > 0) {
      toast({
        title: "Some Uploads Failed",
        description: `${errorCount} files failed to upload. Please try again.`,
        variant: "destructive",
      });
    }

    // Refresh documents list if any uploads succeeded
    if (successCount > 0) {
      window.location.reload();
    }
  };

  if (statsLoading || documentsLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top Header */}
        <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow border-b border-slate-200">
          <div className="flex-1 px-4 flex justify-between items-center">
            <div className="flex-1 flex">
              <h2 className="text-2xl font-semibold text-slate-800">Dashboard Overview</h2>
            </div>
            <div className="ml-4 flex items-center md:ml-6 space-x-4">
              {/* Notifications */}
              <button className="bg-white p-1 rounded-full text-slate-400 hover:text-slate-500 relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400"></span>
              </button>
              
              {/* API Status */}
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                <span className="text-sm text-slate-600">API Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Dashboard Content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              
              {/* Stats Cards */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Upload className="w-8 h-8 text-blue-500" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-slate-500 truncate">Documents Processed</dt>
                          <dd className="text-3xl font-semibold text-slate-900">
                            {stats?.documentsProcessed || 0}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Brain className="w-8 h-8 text-purple-500" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-slate-500 truncate">Sherpa Analyses</dt>
                          <dd className="text-3xl font-semibold text-slate-900">
                            {stats?.aiAnalyses || 0}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <GraduationCap className="w-8 h-8 text-green-500" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-slate-500 truncate">Standards Identified</dt>
                          <dd className="text-3xl font-semibold text-slate-900">
                            {stats?.standardsIdentified || 0}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Clock className="w-8 h-8 text-amber-500" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-slate-500 truncate">Avg Processing Time</dt>
                          <dd className="text-3xl font-semibold text-slate-900">
                            {stats?.avgProcessingTime || "N/A"}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Document Upload Section */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Upload New Documents</CardTitle>
                  <p className="text-sm text-slate-500">Process educational documents for standards analysis and rigor assessment</p>
                </CardHeader>
                <CardContent>
                  <FileUploader 
                    onFilesUpload={handleFileUpload} 
                    multiple={true}
                  />

                  {/* Testing Configuration - Fixed Values */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-sm font-medium text-blue-800">Testing Configuration</span>
                    </div>
                    <div className="text-sm text-blue-700">
                      <p>Customer: 123</p>
                      <p>Jurisdiction: Common Core</p>
                    </div>
                  </div>

                  {/* Focus Standards Configuration */}
                  <div className="border-t pt-6 mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <Settings className="w-5 h-5 text-blue-600" />
                        <div>
                          <Label htmlFor="useFocusStandards" className="text-base font-medium">Focus Standards Analysis</Label>
                          <p className="text-sm text-slate-500">Specify educational standards to prioritize during analysis</p>
                        </div>
                      </div>
                      <Switch
                        id="useFocusStandards"
                        checked={useFocusStandards}
                        onCheckedChange={setUseFocusStandards}
                      />
                    </div>
                    
                    {useFocusStandards && (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="focusStandards">Educational Standards (comma-separated)</Label>
                          <Input
                            id="focusStandards"
                            placeholder="e.g., CCSS.MATH.HSA.REI.A.1, CCSS.MATH.HSF.IF.A.1, NGSS.HS-PS1-1"
                            value={focusStandards}
                            onChange={(e) => setFocusStandards(e.target.value)}
                            className="mt-1"
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            Enter specific educational standards you want the AI to prioritize. The analysis will give special attention to identifying alignment with these standards.
                          </p>
                        </div>
                        
                        {focusStandards.trim() && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 className="font-medium text-blue-900 mb-2">Standards Preview:</h4>
                            <div className="flex flex-wrap gap-2">
                              {focusStandards.split(',').map((standard, index) => (
                                <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                                  {standard.trim()}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Processing Results */}
              <Card className="mb-8">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Recent Processing Results</CardTitle>
                    <p className="text-sm text-slate-500">Latest document analysis results with AI consensus</p>
                  </div>
                  <Link href="/results">
                    <Button variant="outline" size="sm">
                      View All Results <ArrowRight className="ml-1 w-4 h-4" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {documents && documents.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Document</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Created</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {documents.slice(0, 5).map((doc: any) => (
                            <tr key={doc.id} className="hover:bg-slate-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <FileText className="w-5 h-5 text-blue-500 mr-3" />
                                  <div>
                                    <div className="text-sm font-medium text-slate-900">{doc.fileName}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <ProcessingStatus status={doc.status} />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                {new Date(doc.createdAt).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                {doc.status === 'completed' ? (
                                  <div className="flex space-x-2">
                                    <Link href={`/results/${doc.id}`}>
                                      <Button variant="outline" size="sm">
                                        <Eye className="w-4 h-4 mr-1" />
                                        View
                                      </Button>
                                    </Link>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm">
                                          <Download className="w-4 h-4 mr-1" />
                                          Export
                                          <ChevronDown className="w-3 h-3 ml-1" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleExport(doc.id, 'rubric-markdown')}>
                                          <FileText className="w-4 h-4 mr-2" />
                                          Rubric (Markdown)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleExport(doc.id, 'rubric-pdf')}>
                                          <FileText className="w-4 h-4 mr-2" />
                                          Rubric (PDF)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleExport(doc.id, 'csv')}>
                                          <Download className="w-4 h-4 mr-2" />
                                          CSV Data
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleExport(doc.id, 'standards-summary')}>
                                          <GraduationCap className="w-4 h-4 mr-2" />
                                          Standards Summary
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-xs">Processing...</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="mx-auto h-12 w-12 text-slate-400" />
                      <h3 className="mt-2 text-sm font-medium text-slate-900">No documents yet</h3>
                      <p className="mt-1 text-sm text-slate-500">Get started by uploading your first document.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Rigor Level Distribution */}
              {stats?.rigorDistribution && (
                <Card>
                  <CardHeader>
                    <CardTitle>Rigor Level Distribution</CardTitle>
                    <p className="text-sm text-slate-500">Analysis of DOK levels across processed documents</p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                          <span className="text-2xl">🍃</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900">{stats.rigorDistribution.mild}</div>
                        <div className="text-sm text-slate-500">Mild (DOK 1-2)</div>
                        <div className="text-xs text-green-600 font-medium">Basic recall & application</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                          <span className="text-2xl">🌶️</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900">{stats.rigorDistribution.medium}</div>
                        <div className="text-sm text-slate-500">Medium (DOK 2-3)</div>
                        <div className="text-xs text-amber-600 font-medium">Analysis & reasoning</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                          <span className="text-2xl">🔥</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900">{stats.rigorDistribution.spicy}</div>
                        <div className="text-sm text-slate-500">Spicy (DOK 3-4)</div>
                        <div className="text-xs text-red-600 font-medium">Synthesis & evaluation</div>
                      </div>
                    </div>
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
