import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FileUploader } from "@/components/FileUploader";
import { 
  BookOpen, 
  Upload, 
  Link as LinkIcon, 
  AlertCircle,
  FileText,
  Clock,
  CheckCircle2,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Classroom {
  id: string;
  name: string;
  section?: string;
  sbgEnabled: boolean;
  enabledStandards?: any[];
}

interface Document {
  id: string;
  fileName: string;
  status: string;
  createdAt: string;
  classroomId?: string;
  originalFilename?: string;
}

interface DocumentClassroomAssignmentProps {
  onUploadSuccess?: () => void;
}

export function DocumentClassroomAssignment({ onUploadSuccess }: DocumentClassroomAssignmentProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>("");
  const [showUnassigned, setShowUnassigned] = useState(false);

  // Fetch classrooms
  const { data: classrooms = [], isLoading: classroomsLoading } = useQuery<Classroom[]>({
    queryKey: ["/api/classrooms"],
  });

  // Fetch unassigned documents
  const { data: unassignedDocs = [], isLoading: unassignedLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents/unassigned"],
    enabled: showUnassigned,
  });

  // Upload with classroom assignment
  const uploadMutation = useMutation({
    mutationFn: async ({ files, classroomId }: { files: File[]; classroomId: string }) => {
      const formData = new FormData();
      files.forEach(file => formData.append('documents', file));
      formData.append('jurisdictions', 'Common Core');
      if (classroomId) formData.append('classroomId', classroomId);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Upload Successful",
        description: "Documents uploaded and assigned to classroom",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/unassigned"] });
      onUploadSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Assign document to classroom
  const assignMutation = useMutation({
    mutationFn: async ({ documentId, classroomId }: { documentId: string; classroomId: string }) => {
      const response = await fetch(`/api/documents/${documentId}/assign-classroom`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classroomId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Assignment failed');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Assignment Successful",
        description: "Document assigned to classroom",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/unassigned"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Assignment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFilesUpload = async (files: File[]) => {
    if (!selectedClassroomId) {
      toast({
        title: "Classroom Required",
        description: "Please select a classroom before uploading documents",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({ files, classroomId: selectedClassroomId });
  };

  const handleAssignDocument = (documentId: string, classroomId: string) => {
    assignMutation.mutate({ documentId, classroomId });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-red-100 text-red-800';
    }
  };

  const sbgEnabledClassrooms = classrooms.filter(c => c.sbgEnabled);
  const configuredClassrooms = classrooms.filter(c => c.enabledStandards && c.enabledStandards.length > 0);

  return (
    <div className="space-y-6">
      {/* Upload New Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Documents to Classroom
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Classroom Selection */}
          <div className="space-y-2">
            <label htmlFor="classroom-select" className="text-sm font-medium">
              Select Classroom <span className="text-red-500">*</span>
            </label>
            <Select value={selectedClassroomId} onValueChange={setSelectedClassroomId}>
              <SelectTrigger data-testid="select-classroom">
                <SelectValue placeholder="Choose a classroom for your documents" />
              </SelectTrigger>
              <SelectContent>
                {classrooms.map((classroom) => (
                  <SelectItem key={classroom.id} value={classroom.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>
                        {classroom.name}
                        {classroom.section && ` - ${classroom.section}`}
                      </span>
                      <div className="flex items-center gap-1 ml-2">
                        {classroom.sbgEnabled && (
                          <Badge variant="secondary" className="text-xs">SBG</Badge>
                        )}
                        {classroom.enabledStandards && classroom.enabledStandards.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {classroom.enabledStandards.length} standards
                          </Badge>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Classroom Info */}
            {classrooms.length === 0 && !classroomsLoading && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-amber-800">
                  No classrooms found. Connect your Google Classroom first.
                </span>
              </div>
            )}
            
            {selectedClassroomId && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-blue-800 text-sm">
                  <BookOpen className="w-4 h-4" />
                  <span>
                    Documents will be uploaded to: <strong>
                      {classrooms.find(c => c.id === selectedClassroomId)?.name}
                    </strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* File Uploader */}
          <FileUploader
            onFilesUpload={handleFilesUpload}
            multiple={true}
            className="mt-4"
          />

          {/* Upload Status */}
          {uploadMutation.isPending && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Clock className="w-4 h-4 text-blue-600 animate-spin" />
              <span className="text-sm text-blue-800">Uploading documents...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign Existing Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5" />
              Assign Existing Documents
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUnassigned(!showUnassigned)}
              data-testid="button-show-unassigned"
            >
              {showUnassigned ? 'Hide' : 'Show'} Unassigned ({unassignedDocs.length})
            </Button>
          </CardTitle>
        </CardHeader>
        
        {showUnassigned && (
          <CardContent>
            {unassignedLoading ? (
              <div className="text-center py-8">
                <Clock className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                <p className="text-sm text-muted-foreground">Loading unassigned documents...</p>
              </div>
            ) : unassignedDocs.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No unassigned documents found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  All your documents are already assigned to classrooms
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {unassignedDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(doc.status)}
                      <div>
                        <p className="text-sm font-medium">
                          {doc.originalFilename || doc.fileName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={cn("text-xs", getStatusColor(doc.status))}>
                            {doc.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(classroomId) => handleAssignDocument(doc.id, classroomId)}
                        disabled={assignMutation.isPending}
                      >
                        <SelectTrigger className="w-48" data-testid={`select-classroom-${doc.id}`}>
                          <SelectValue placeholder="Assign to classroom" />
                        </SelectTrigger>
                        <SelectContent>
                          {classrooms.map((classroom) => (
                            <SelectItem key={classroom.id} value={classroom.id}>
                              {classroom.name}
                              {classroom.section && ` - ${classroom.section}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Classroom Summary */}
      {classrooms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Classroom Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">{classrooms.length}</div>
                <div className="text-sm text-blue-600">Total Classrooms</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-700">{sbgEnabledClassrooms.length}</div>
                <div className="text-sm text-green-600">SBG Enabled</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-700">{configuredClassrooms.length}</div>
                <div className="text-sm text-purple-600">Standards Configured</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}