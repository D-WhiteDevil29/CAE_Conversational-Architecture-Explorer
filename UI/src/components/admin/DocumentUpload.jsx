import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  File,
  FileText,
  FileJson,
  FileSpreadsheet,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/contexts/ToastContext';
import { useValidation } from '@/contexts/ValidationContext';
import api from '@/services/api';

const FILE_TYPES = {
  'application/pdf': { icon: FileText, label: 'PDF', color: 'text-red-500' },
  'application/json': { icon: FileJson, label: 'JSON', color: 'text-blue-500' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    icon: FileText,
    label: 'DOCX',
    color: 'text-blue-600',
  },
  'application/msword': { icon: FileText, label: 'DOC', color: 'text-blue-600' },
  'text/plain': { icon: File, label: 'TXT', color: 'text-gray-500' },
  'text/csv': { icon: FileSpreadsheet, label: 'CSV', color: 'text-green-500' },
  'application/vnd.ms-excel': { icon: FileSpreadsheet, label: 'XLS', color: 'text-green-600' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    icon: FileSpreadsheet,
    label: 'XLSX',
    color: 'text-green-600',
  },
};

export function DocumentUpload({ onUploadComplete }) {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const toast = useToast();
  const { submitDocumentForValidation } = useValidation();

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    addFiles(selectedFiles);
  };

  const addFiles = (newFiles) => {
    const validFiles = newFiles.filter((file) => {
      // Accept any file type for flexibility
      return file.size <= 50 * 1024 * 1024; // 50MB limit
    });

    setFiles((prev) => [...prev, ...validFiles]);
    
    // Initialize upload status for new files
    const newStatus = {};
    validFiles.forEach((file) => {
      newStatus[file.name] = { status: 'pending', progress: 0 };
    });
    setUploadStatus((prev) => ({ ...prev, ...newStatus }));
  };

  const removeFile = (fileName) => {
    setFiles((prev) => prev.filter((f) => f.name !== fileName));
    setUploadStatus((prev) => {
      const newStatus = { ...prev };
      delete newStatus[fileName];
      return newStatus;
    });
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setIsUploading(true);

    for (const file of files) {
      try {
        // Read file as base64 data URL for PDF viewing in review panel
        const fileDataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });

        setUploadStatus((prev) => ({
          ...prev,
          [file.name]: { status: 'uploading', progress: 50 },
        }));

        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post('/api/upload-document', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadStatus((prev) => ({
              ...prev,
              [file.name]: { status: 'uploading', progress },
            }));
          },
        });

        // Submit document for validation instead of direct ingest
        const documentCount = response.data.documentsAdded || 1;
        const uploadTimestamp = new Date().toISOString();
        submitDocumentForValidation({
          id: `doc_${Date.now()}_${Math.random()}`,
          name: file.name,
          content: response.data.preview || `Document: ${file.name}`,
          fileDataUrl: fileDataUrl,
          fileType: file.type,
          source: 'uploaded',
          size: file.size,
          type: file.type,
          uploadedAt: uploadTimestamp,
        });

        setUploadStatus((prev) => ({
          ...prev,
          [file.name]: { 
            status: 'success', 
            progress: 100,
            message: `✓ Submitted for validation (${documentCount} doc${documentCount > 1 ? 's' : ''})`
          },
        }));

        toast.success(`${file.name} submitted for review`);
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        setUploadStatus((prev) => ({
          ...prev,
          [file.name]: {
            status: 'error',
            progress: 0,
            message: error.response?.data?.error || 'Upload failed',
          },
        }));
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setIsUploading(false);
    
    // Notify parent component
    if (onUploadComplete) {
      onUploadComplete();
    }
  };

  const getFileIcon = (file) => {
    const fileType = FILE_TYPES[file.type];
    if (fileType) {
      const Icon = fileType.icon;
      return <Icon className={`h-5 w-5 ${fileType.color}`} />;
    }
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const getFileTypeLabel = (file) => {
    return FILE_TYPES[file.type]?.label || file.name.split('.').pop().toUpperCase();
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`
          relative border-2 border-dashed rounded-xl p-8 transition-all
          ${
            isDragging
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-border/40 hover:border-purple-500/50 bg-card/50'
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading}
        />

        <label
          htmlFor="file-upload"
          className="flex flex-col items-center cursor-pointer"
        >
          <motion.div
            animate={{ scale: isDragging ? 1.1 : 1 }}
            className={`
              p-4 rounded-full mb-4 transition-colors
              ${isDragging ? 'bg-purple-500/20' : 'bg-purple-500/10'}
            `}
          >
            <Upload
              className={`h-8 w-8 ${isDragging ? 'text-purple-400' : 'text-purple-500'}`}
            />
          </motion.div>
          <h3 className="text-lg font-semibold mb-2">
            {isDragging ? 'Drop files here' : 'Upload Documents'}
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Drag and drop files here or click to browse. Supports PDF, DOCX, DOC, TXT, JSON,
            CSV, XLSX, XLS and more. Max file size: 50MB
          </p>
        </label>
      </motion.div>

      {/* File List */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Selected Files ({files.length})</h4>
              {files.length > 0 && !isUploading && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFiles([]);
                    setUploadStatus({});
                  }}
                  className="text-xs"
                >
                  Clear All
                </Button>
              )}
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {files.map((file) => {
                const status = uploadStatus[file.name] || { status: 'pending', progress: 0 };
                return (
                  <motion.div
                    key={file.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="glass-effect border border-border/40 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="mt-1">{getFileIcon(file)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-500">
                              {getFileTypeLabel(file)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {formatFileSize(file.size)}
                          </p>

                          {/* Status */}
                          {status.status === 'uploading' && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                <span className="text-xs text-blue-500">
                                  Uploading... {status.progress}%
                                </span>
                              </div>
                              <div className="h-1 bg-border/40 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${status.progress}%` }}
                                  className="h-full bg-blue-500"
                                />
                              </div>
                            </div>
                          )}

                          {status.status === 'success' && (
                            <div className="flex items-center gap-2 text-green-500">
                              <CheckCircle className="h-3 w-3" />
                              <span className="text-xs">{status.message}</span>
                            </div>
                          )}

                          {status.status === 'error' && (
                            <div className="flex items-center gap-2 text-red-500">
                              <AlertCircle className="h-3 w-3" />
                              <span className="text-xs">{status.message}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {status.status === 'pending' && !isUploading && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(file.name)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Upload Button */}
            <Button
              onClick={uploadFiles}
              disabled={isUploading || files.length === 0}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload {files.length} {files.length === 1 ? 'File' : 'Files'}
                </>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
