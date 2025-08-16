import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/Sidebar";
import { apiRequest } from "@/lib/queryClient";
import { 
  Settings, 
  Brain, 
  Save, 
  TestTube, 
  Plus,
  ChevronDown,
  ChevronUp,
  Trash2
} from "lucide-react";

interface PromptCustomization {
  focusStandards?: string[];
  educationLevel?: 'elementary' | 'middle' | 'high' | 'college';
  subject?: 'mathematics' | 'science' | 'english' | 'social_studies' | 'general';
  rigorCriteria?: {
    mild?: string;
    medium?: string;
    spicy?: string;
  };
  additionalInstructions?: string;
  jurisdictionPriority?: string[];
  outputFormat?: 'detailed' | 'concise' | 'standardized';
}

interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  customization: PromptCustomization;
  createdAt: string;
}

export default function PromptConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testQuestion, setTestQuestion] = useState("");
  const [testContext, setTestContext] = useState("");
  
  // Form state for customization
  const [customization, setCustomization] = useState<PromptCustomization>({
    educationLevel: 'high',
    subject: 'general',
    outputFormat: 'standardized',
    focusStandards: [],
    jurisdictionPriority: [],
    rigorCriteria: {
      mild: '',
      medium: '',
      spicy: ''
    },
    additionalInstructions: ''
  });

  // Fetch existing templates
  const { data: templates, isLoading: templatesLoading } = useQuery<PromptTemplate[]>({
    queryKey: ["/api/prompt-templates"],
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (templateData: any) => {
      const response = await fetch("/api/prompt-templates", {
        method: "POST",
        body: JSON.stringify(templateData),
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) throw new Error('Failed to create template');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Template Created",
        description: "Your prompt template has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/prompt-templates"] });
      setTemplateName("");
      setTemplateDescription("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create template.",
        variant: "destructive",
      });
    }
  });

  // Test prompt mutation
  const testPromptMutation = useMutation({
    mutationFn: async (testData: any) => {
      const response = await fetch("/api/test-prompt", {
        method: "POST",
        body: JSON.stringify(testData),
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) throw new Error('Failed to test prompt');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Test Completed",
        description: "Prompt test completed successfully. Check the console for detailed results.",
      });
      console.log("Test Results:", data);
    },
    onError: () => {
      toast({
        title: "Test Failed",
        description: "Failed to test the prompt configuration.",
        variant: "destructive",
      });
    }
  });

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      toast({
        title: "Name Required",
        description: "Please provide a name for your template.",
        variant: "destructive",
      });
      return;
    }

    createTemplateMutation.mutate({
      name: templateName,
      description: templateDescription,
      customization
    });
  };

  const handleTestPrompt = () => {
    if (!testQuestion.trim()) {
      toast({
        title: "Test Question Required",
        description: "Please provide a question to test the prompt.",
        variant: "destructive",
      });
      return;
    }

    testPromptMutation.mutate({
      questionText: testQuestion,
      context: testContext,
      jurisdictions: customization.jurisdictionPriority || ["Common Core"],
      customization
    });
  };

  const loadTemplate = (template: PromptTemplate) => {
    setCustomization(template.customization);
    setTemplateName(template.name);
    setTemplateDescription(template.description);
    toast({
      title: "Template Loaded",
      description: `Loaded configuration from "${template.name}".`,
    });
  };

  const addFocusStandard = () => {
    setCustomization(prev => ({
      ...prev,
      focusStandards: [...(prev.focusStandards || []), ""]
    }));
  };

  const updateFocusStandard = (index: number, value: string) => {
    setCustomization(prev => ({
      ...prev,
      focusStandards: prev.focusStandards?.map((std, i) => i === index ? value : std)
    }));
  };

  const removeFocusStandard = (index: number) => {
    setCustomization(prev => ({
      ...prev,
      focusStandards: prev.focusStandards?.filter((_, i) => i !== index)
    }));
  };

  if (templatesLoading) {
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
      
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Header */}
        <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow border-b border-slate-200">
          <div className="flex-1 px-4 flex justify-between items-center">
            <div className="flex items-center">
              <Settings className="w-6 h-6 text-blue-600 mr-3" />
              <h2 className="text-2xl font-semibold text-slate-800">Prompt Configuration</h2>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              
              {/* Existing Templates */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Brain className="w-5 h-5 mr-2" />
                    Saved Templates
                  </CardTitle>
                  <p className="text-sm text-slate-500">Load existing prompt configurations</p>
                </CardHeader>
                <CardContent>
                  {templates && templates.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {templates.map((template) => (
                        <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                          <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                              <CardTitle className="text-lg">{template.name}</CardTitle>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => loadTemplate(template)}
                              >
                                Load
                              </Button>
                            </div>
                            <p className="text-sm text-slate-600">{template.description}</p>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="text-xs text-slate-500">
                              <div>Level: {template.customization.educationLevel || 'Not set'}</div>
                              <div>Subject: {template.customization.subject || 'Not set'}</div>
                              <div>Standards: {template.customization.focusStandards?.length || 0}</div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      No saved templates yet. Create your first template below.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Template Configuration */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Create New Template</CardTitle>
                  <p className="text-sm text-slate-500">Configure AI analysis parameters for your specific needs</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  
                  {/* Basic Information */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="templateName">Template Name</Label>
                      <Input
                        id="templateName"
                        placeholder="e.g., High School Math Analysis"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="templateDescription">Description (Optional)</Label>
                      <Input
                        id="templateDescription"
                        placeholder="Brief description of this configuration"
                        value={templateDescription}
                        onChange={(e) => setTemplateDescription(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Education Level & Subject */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div>
                      <Label>Education Level</Label>
                      <Select
                        value={customization.educationLevel}
                        onValueChange={(value: any) => setCustomization(prev => ({...prev, educationLevel: value}))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="elementary">Elementary</SelectItem>
                          <SelectItem value="middle">Middle School</SelectItem>
                          <SelectItem value="high">High School</SelectItem>
                          <SelectItem value="college">College</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>Subject Area</Label>
                      <Select
                        value={customization.subject}
                        onValueChange={(value: any) => setCustomization(prev => ({...prev, subject: value}))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="mathematics">Mathematics</SelectItem>
                          <SelectItem value="science">Science</SelectItem>
                          <SelectItem value="english">English Language Arts</SelectItem>
                          <SelectItem value="social_studies">Social Studies</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>Output Format</Label>
                      <Select
                        value={customization.outputFormat}
                        onValueChange={(value: any) => setCustomization(prev => ({...prev, outputFormat: value}))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standardized">Standardized</SelectItem>
                          <SelectItem value="detailed">Detailed</SelectItem>
                          <SelectItem value="concise">Concise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Focus Standards */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Focus Standards (Optional)</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addFocusStandard}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Standard
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {customization.focusStandards?.map((standard, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            placeholder="e.g., CCSS.MATH.HSA.REI.A.1"
                            value={standard}
                            onChange={(e) => updateFocusStandard(index, e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeFocusStandard(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Advanced Options */}
                  <div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="mb-4"
                    >
                      {showAdvanced ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                      Advanced Options
                    </Button>
                    
                    {showAdvanced && (
                      <div className="space-y-6 border-t pt-6">
                        {/* Custom Rigor Criteria */}
                        <div>
                          <Label className="text-base font-medium">Custom Rigor Criteria</Label>
                          <p className="text-sm text-slate-500 mb-3">Define custom criteria for rigor level assessment</p>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label htmlFor="mildCriteria">Mild Criteria</Label>
                              <Textarea
                                id="mildCriteria"
                                placeholder="e.g., Basic recall and recognition"
                                value={customization.rigorCriteria?.mild || ''}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  rigorCriteria: { ...prev.rigorCriteria, mild: e.target.value }
                                }))}
                                className="mt-1"
                                rows={3}
                              />
                            </div>
                            <div>
                              <Label htmlFor="mediumCriteria">Medium Criteria</Label>
                              <Textarea
                                id="mediumCriteria"
                                placeholder="e.g., Analysis and interpretation"
                                value={customization.rigorCriteria?.medium || ''}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  rigorCriteria: { ...prev.rigorCriteria, medium: e.target.value }
                                }))}
                                className="mt-1"
                                rows={3}
                              />
                            </div>
                            <div>
                              <Label htmlFor="spicyCriteria">Spicy Criteria</Label>
                              <Textarea
                                id="spicyCriteria"
                                placeholder="e.g., Synthesis and evaluation"
                                value={customization.rigorCriteria?.spicy || ''}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  rigorCriteria: { ...prev.rigorCriteria, spicy: e.target.value }
                                }))}
                                className="mt-1"
                                rows={3}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Additional Instructions */}
                        <div>
                          <Label htmlFor="additionalInstructions">Additional Instructions</Label>
                          <Textarea
                            id="additionalInstructions"
                            placeholder="Any additional specific instructions for the AI analysis..."
                            value={customization.additionalInstructions || ''}
                            onChange={(e) => setCustomization(prev => ({...prev, additionalInstructions: e.target.value}))}
                            className="mt-1"
                            rows={4}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Actions */}
                  <div className="flex gap-4">
                    <Button 
                      onClick={handleSaveTemplate}
                      disabled={createTemplateMutation.isPending}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Template
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Test Prompt */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TestTube className="w-5 h-5 mr-2" />
                    Test Configuration
                  </CardTitle>
                  <p className="text-sm text-slate-500">Test your prompt configuration with a sample question</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="testQuestion">Test Question</Label>
                    <Textarea
                      id="testQuestion"
                      placeholder="Enter a sample educational question to test the prompt configuration..."
                      value={testQuestion}
                      onChange={(e) => setTestQuestion(e.target.value)}
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="testContext">Context (Optional)</Label>
                    <Textarea
                      id="testContext"
                      placeholder="Additional context for the test question..."
                      value={testContext}
                      onChange={(e) => setTestContext(e.target.value)}
                      className="mt-1"
                      rows={2}
                    />
                  </div>
                  <Button 
                    onClick={handleTestPrompt}
                    disabled={testPromptMutation.isPending}
                  >
                    <TestTube className="w-4 h-4 mr-2" />
                    Test Prompt
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}