import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar } from "@/components/Sidebar";
import { useToast } from "@/hooks/use-toast";
import { RigorBadge } from "@/components/RigorBadge";
import { ProcessingStatus } from "@/components/ProcessingStatus";
import { 
  Search, 
  Filter, 
  FileText, 
  Download,
  Eye,
  Calendar,
  Brain,
  ChevronDown,
  GraduationCap
} from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ResultsPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rigorFilter, setRigorFilter] = useState("all");

  // Fetch documents with live polling for processing documents
  const { data: documents, isLoading } = useQuery<any[]>({
    queryKey: ["/api/documents"],
    refetchInterval: (query) => {
      // Poll every 2 seconds if there are any processing documents
      const hasProcessingDocs = query.state.data?.some((doc: any) => doc.status === 'processing' || doc.status === 'pending');
      return hasProcessingDocs ? 2000 : false;
    },
    refetchIntervalInBackground: true,
  });

  // Fetch queue status
  const { data: queueStatus, error: queueError } = useQuery<any>({
    queryKey: ["/api/queue"],
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
  });

  // Queue status available for UI

  const filteredDocuments = documents?.filter((doc: any) => {
    const matchesSearch = doc.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    // For rigor filter, we'd need to fetch individual results - simplified for now
    return matchesSearch && matchesStatus;
  }) || [];

  const formatProcessingTime = (start: string, end: string) => {
    if (!start || !end) return "N/A";
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  // Export functionality (identical to dashboard)
  const handleExport = async (documentId: string, format: 'rubric-markdown' | 'rubric-pdf' | 'csv' | 'student-cover-sheet') => {
    try {
      const response = await fetch(`/api/documents/${documentId}/results`);
      if (!response.ok) {
        throw new Error('Failed to fetch document results');
      }
      const documentResult = await response.json();
      const { document, results } = documentResult;
      
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
        case 'student-cover-sheet':
          generateStudentCoverSheet(document, results);
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

  const generateMarkdownRubric = (doc: any, results: any[]) => {
    const markdownContent = generateMarkdownRubricContent(doc, results);
    downloadFile(markdownContent, `${doc.fileName.replace(/\.[^/.]+$/, '')}_rubric.md`, 'text/markdown');
    
    toast({
      title: "Rubric Generated",
      description: "Markdown rubric ready for Google Docs - just copy and paste!",
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
    });
  };

  const generateStudentCoverSheet = (doc: any, results: any[]) => {
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
      const effectiveStandards = question.teacherOverride?.overriddenStandards || question.result?.consensusStandards || [];
      const effectiveRigor = question.teacherOverride?.overriddenRigorLevel || question.result?.consensusRigorLevel || 'mild';
      
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

  const generateMarkdownRubricContent = (doc: any, results: any[]) => {
    const rubricTitle = doc.fileName.replace(/\.[^/.]+$/, '');
    
    let content = `# ${rubricTitle}\n\n## Rubric\n\n`;
    content += `| Criteria | Demonstrates Understanding | Understanding with Minor Mistakes | Demonstrates Lack of Understanding | No Attempt |\n`;
    content += `|----------|---------------------------|----------------------------------|-----------------------------------|----------|\n`;
    
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

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top Header */}
        <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow border-b border-slate-200">
          <div className="flex-1 px-4 flex justify-between items-center">
            <div className="flex-1 flex">
              <h2 className="text-2xl font-semibold text-slate-800">Processing Results</h2>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              
              {/* Queue Status Card */}
              {queueStatus?.queueSize > 0 && (
                <Card className="mb-6 border-blue-200 bg-blue-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                          <span className="font-medium text-blue-800">Processing Queue</span>
                        </div>
                        <Badge variant="outline" className="text-blue-700 border-blue-300">
                          {queueStatus.queueSize} files queued
                        </Badge>
                      </div>
                      <div className="text-sm text-blue-600">
                        Processor: {queueStatus.processor?.isProcessing ? 'Active' : 'Idle'}
                      </div>
                    </div>
                    {queueStatus.items?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm text-blue-700 mb-2">Files in queue:</p>
                        <div className="flex flex-wrap gap-2">
                          {queueStatus.items.slice(0, 5).map((item: any, index: number) => (
                            <Badge key={item.id} variant="outline" className="text-xs text-blue-600 border-blue-200">
                              {item.document?.fileName || `Document ${index + 1}`}
                            </Badge>
                          ))}
                          {queueStatus.items.length > 5 && (
                            <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">
                              +{queueStatus.items.length - 5} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Search and Filters */}
              <Card className="mb-8">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <Input
                          placeholder="Search documents..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                      >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="completed">Completed</option>
                        <option value="failed">Failed</option>
                      </select>
                      
                      <select 
                        value={rigorFilter}
                        onChange={(e) => setRigorFilter(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                      >
                        <option value="all">All Rigor</option>
                        <option value="mild">Mild</option>
                        <option value="medium">Medium</option>
                        <option value="spicy">Spicy</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Results Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Document Processing History</CardTitle>
                  <p className="text-sm text-slate-500">
                    Complete history of all processed documents with detailed analysis results
                  </p>
                </CardHeader>
                <CardContent>
                  {filteredDocuments.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Document
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Customer ID
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Jurisdictions
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Processing Time
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Created
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {filteredDocuments.map((doc: any) => (
                            <tr key={doc.id} className="hover:bg-slate-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <FileText className="w-5 h-5 text-blue-500 mr-3" />
                                  <div>
                                    <div className="text-sm font-medium text-slate-900">
                                      {doc.fileName}
                                    </div>
                                    <div className="text-sm text-slate-500">
                                      {(doc.fileSize / 1024 / 1024).toFixed(1)} MB
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <ProcessingStatus status={doc.status} />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                                {doc.customerId}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-wrap gap-1">
                                  {doc.jurisdictions?.map((jurisdiction: string, index: number) => (
                                    <Badge key={index} variant="outline" className="text-xs">
                                      {jurisdiction}
                                    </Badge>
                                  )) || <span className="text-slate-400">None</span>}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                {formatProcessingTime(doc.processingStarted, doc.processingCompleted)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                <div className="flex items-center">
                                  <Calendar className="w-4 h-4 mr-1" />
                                  {new Date(doc.createdAt).toLocaleDateString()}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {new Date(doc.createdAt).toLocaleTimeString()}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex space-x-2">
                                  {doc.status === 'completed' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => window.location.href = `/results/${doc.id}`}
                                    >
                                      <Eye className="w-4 h-4 mr-1" />
                                      View
                                    </Button>
                                  )}
                                  {doc.status === 'completed' && (
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
                                        <DropdownMenuItem onClick={() => handleExport(doc.id, 'student-cover-sheet')}>
                                          <GraduationCap className="w-4 h-4 mr-2" />
                                          Student Facing Test Cover Sheet
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Brain className="mx-auto h-12 w-12 text-slate-400" />
                      <h3 className="mt-2 text-sm font-medium text-slate-900">No results found</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {searchTerm || statusFilter !== "all" || rigorFilter !== "all"
                          ? "Try adjusting your search criteria."
                          : "Upload documents to see processing results here."}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
