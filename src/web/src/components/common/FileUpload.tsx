import React, { useCallback, useState, useRef, useEffect } from 'react'; // ^18.0.0
import { Box, Typography, LinearProgress, Alert, Snackbar } from '@mui/material'; // ^5.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0
import { CloudUpload, CheckCircle, Error } from '@mui/icons-material'; // ^5.0.0
import Button from './Button';
import Loading from './Loading';

// File size constants in bytes based on spec
const FILE_SIZE_LIMITS = {
  FLOOR_PLAN: 50 * 1024 * 1024, // 50MB
  DOCUMENT: 15 * 1024 * 1024,   // 15MB
  IMAGE: 10 * 1024 * 1024       // 10MB
};

// Supported file formats based on spec
const SUPPORTED_FORMATS = {
  FLOOR_PLAN: '.dwg,.dxf,.pdf',
  DOCUMENT: '.pdf,.docx',
  IMAGE: '.png,.jpg,.jpeg'
};

interface FileUploadProps {
  accept: string;
  maxSize: number;
  multiple?: boolean;
  onUpload: (files: File[]) => Promise<void>;
  onError?: (error: string) => void;
  onProgress?: (progress: number) => void;
  maxConcurrent?: number;
  allowRetry?: boolean;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Styled components with theme integration
const UploadContainer = styled(Box, {
  shouldForwardProp: prop => prop !== 'isDragging'
})<{ isDragging?: boolean }>(({ theme, isDragging }) => ({
  border: `2px dashed ${isDragging ? theme.palette.primary.main : theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(3),
  textAlign: 'center',
  transition: theme.transitions.create(['border-color', 'background-color'], {
    duration: theme.transitions.duration.short
  }),
  backgroundColor: isDragging ? theme.palette.action.hover : 'transparent',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: theme.palette.action.hover
  },
  '&:focus-within': {
    outline: `3px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px'
  }
}));

const HiddenInput = styled('input')({
  display: 'none'
});

const ProgressContainer = styled(Box)(({ theme }) => ({
  margin: theme.spacing(2, 0),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(1)
}));

// Validation function with detailed error messages
const validateFiles = (files: File[], accept: string, maxSize: number): ValidationResult => {
  if (!files.length) {
    return { valid: false, error: 'No files selected' };
  }

  const acceptedTypes = accept.split(',').map(type => type.trim());
  
  for (const file of files) {
    const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    
    if (!acceptedTypes.includes(fileExtension)) {
      return {
        valid: false,
        error: `Invalid file type: ${file.name}. Supported formats: ${accept}`
      };
    }

    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File ${file.name} exceeds maximum size of ${Math.round(maxSize / (1024 * 1024))}MB`
      };
    }

    if (!/^[\w\-. ]+$/.test(file.name)) {
      return {
        valid: false,
        error: `Invalid file name: ${file.name}. Use only letters, numbers, spaces, and hyphens`
      };
    }
  }

  return { valid: true };
};

const FileUpload: React.FC<FileUploadProps> = ({
  accept,
  maxSize,
  multiple = false,
  onUpload,
  onError,
  onProgress,
  maxConcurrent = 3,
  allowRetry = true
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // Reset states when props change
  useEffect(() => {
    setError(null);
    setSuccessMessage(null);
    setProgress(0);
  }, [accept, maxSize, multiple]);

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    onError?.(errorMessage);
    setIsUploading(false);
  }, [onError]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validation = validateFiles(fileArray, accept, maxSize);

    if (!validation.valid) {
      handleError(validation.error!);
      return;
    }

    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      await onUpload(fileArray);
      setSuccessMessage(`Successfully uploaded ${fileArray.length} file(s)`);
      setProgress(100);
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [accept, maxSize, onUpload, handleError]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFiles(droppedFiles);
    }
  }, [handleFiles]);

  return (
    <Box>
      <UploadContainer
        isDragging={isDragging}
        onDragEnter={handleDragEnter}
        onDragOver={e => e.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        aria-label="Upload file"
        aria-describedby="upload-instructions"
      >
        <HiddenInput
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={e => e.target.files && handleFiles(e.target.files)}
          aria-hidden="true"
        />

        <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
        
        <Typography variant="h6" gutterBottom>
          Drag and drop files here
        </Typography>
        
        <Typography
          variant="body2"
          color="textSecondary"
          id="upload-instructions"
          gutterBottom
        >
          or click to select files
        </Typography>
        
        <Typography variant="caption" color="textSecondary">
          Supported formats: {accept} (Max size: {Math.round(maxSize / (1024 * 1024))}MB)
        </Typography>

        <Button
          variant="contained"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          sx={{ mt: 2 }}
        >
          Select Files
        </Button>
      </UploadContainer>

      {isUploading && (
        <ProgressContainer>
          <Loading size="small" />
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ width: '100%' }}
            aria-label="Upload progress"
          />
          <Typography variant="body2" color="textSecondary">
            Uploading... {progress}%
          </Typography>
        </ProgressContainer>
      )}

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{ width: '100%' }}
        >
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage(null)}
      >
        <Alert
          severity="success"
          onClose={() => setSuccessMessage(null)}
          sx={{ width: '100%' }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default FileUpload;