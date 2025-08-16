import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { CloudUpload, X, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploaderProps {
  onFileUpload?: (file: File) => void;
  onFilesUpload?: (files: File[]) => void;
  maxSize?: number;
  acceptedTypes?: string[];
  className?: string;
  multiple?: boolean;
}

export function FileUploader({ 
  onFileUpload, 
  onFilesUpload,
  maxSize = 50 * 1024 * 1024, // 50MB
  acceptedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.google-apps.document'
  ],
  className,
  multiple = false
}: FileUploaderProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string>("");

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    console.log('=== FILE UPLOADER onDrop DEBUG ===');
    console.log('acceptedFiles:', acceptedFiles.length, acceptedFiles.map(f => f.name));
    console.log('rejectedFiles:', rejectedFiles.length);
    
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
      console.log('Setting selectedFiles to:', acceptedFiles.length, 'files');
      setSelectedFiles(acceptedFiles);
    }
  }, [maxSize, multiple]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.google-apps.document': ['.gdoc']
    },
    maxSize,
    multiple: true,
    maxFiles: 10,
  });

  const handleUpload = () => {
    console.log('=== FILE UPLOADER handleUpload DEBUG ===');
    console.log('selectedFiles.length:', selectedFiles.length);
    console.log('multiple:', multiple);
    console.log('onFilesUpload exists:', !!onFilesUpload);
    console.log('onFileUpload exists:', !!onFileUpload);
    
    if (selectedFiles.length > 0) {
      if (multiple && onFilesUpload) {
        console.log('Calling onFilesUpload with', selectedFiles.length, 'files');
        onFilesUpload(selectedFiles);
      } else if (!multiple && onFileUpload) {
        console.log('Calling onFileUpload with single file');
        onFileUpload(selectedFiles[0]);
      }
      setSelectedFiles([]);
    }
  };

  const removeFile = (index?: number) => {
    if (index !== undefined) {
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    } else {
      setSelectedFiles([]);
    }
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
      {selectedFiles.length === 0 ? (
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
            Support for PDF, Word, and Google Docs formats (max {Math.round(maxSize / (1024 * 1024))}MB per file, up to 10 files)
          </p>
          
          <Button type="button" className="bg-blue-600 hover:bg-blue-700">
            Select Files
          </Button>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg p-4 space-y-3">
          {selectedFiles.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getFileIcon(file.name)}
                <div>
                  <p className="text-sm font-medium text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <Button onClick={() => removeFile(index)} variant="outline" size="sm">
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
          
          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <p className="text-sm text-slate-600">
              {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
            </p>
            <div className="flex items-center space-x-2">
              <Button onClick={handleUpload} size="sm" className="bg-green-600 hover:bg-green-700">
                Upload {selectedFiles.length > 1 ? 'All' : ''}
              </Button>
              <Button onClick={() => removeFile()} variant="outline" size="sm">
                Clear {selectedFiles.length > 1 ? 'All' : ''}
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
