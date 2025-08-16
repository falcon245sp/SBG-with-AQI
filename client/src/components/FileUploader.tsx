import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { CloudUpload, X, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploaderProps {
  onFileUpload: (file: File) => void;
  maxSize?: number;
  acceptedTypes?: string[];
  className?: string;
}

export function FileUploader({ 
  onFileUpload, 
  maxSize = 50 * 1024 * 1024, // 50MB
  acceptedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.google-apps.document'
  ],
  className 
}: FileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError("");
    
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        setError(`File is too large. Maximum size is ${Math.round(maxSize / (1024 * 1024))}MB.`);
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError('Invalid file type. Only PDF, Word, and Google Docs are supported.');
      } else {
        setError('File upload failed. Please try again.');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
    }
  }, [maxSize]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.google-apps.document': ['.gdoc']
    },
    maxSize,
    multiple: false,
  });

  const handleUpload = () => {
    if (selectedFile) {
      onFileUpload(selectedFile);
      setSelectedFile(null);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setError("");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return <FileText className="w-8 h-8 text-blue-500" />;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {!selectedFile ? (
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
            isDragActive
              ? "border-blue-500 bg-blue-50"
              : "border-slate-300 hover:border-slate-400"
          )}
        >
          <input {...getInputProps()} />
          
          <CloudUpload className="mx-auto h-12 w-12 text-slate-400 mb-4" />
          
          {isDragActive ? (
            <p className="text-lg font-medium text-blue-600 mb-2">Drop the file here</p>
          ) : (
            <p className="text-lg font-medium text-slate-900 mb-2">Drag and drop files here</p>
          )}
          
          <p className="text-sm text-slate-500 mb-4">
            Support for PDF, Word, and Google Docs formats (max {Math.round(maxSize / (1024 * 1024))}MB)
          </p>
          
          <Button type="button" className="bg-blue-600 hover:bg-blue-700">
            Select Files
          </Button>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getFileIcon(selectedFile.name)}
              <div>
                <p className="text-sm font-medium text-slate-900">{selectedFile.name}</p>
                <p className="text-xs text-slate-500">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button onClick={handleUpload} size="sm" className="bg-green-600 hover:bg-green-700">
                Upload
              </Button>
              <Button onClick={removeFile} variant="outline" size="sm">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}
    </div>
  );
}
