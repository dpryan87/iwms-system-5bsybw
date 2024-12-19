// External imports with versions
import React, { useState, useEffect, useCallback } from 'react'; // ^18.0.0
import { 
  Box, 
  Paper, 
  Typography, 
  Grid, 
  Button, 
  CircularProgress, 
  Alert,
  Tabs,
  Tab,
  IconButton,
  Tooltip
} from '@mui/material'; // ^5.0.0
import { 
  Upload as UploadIcon,
  Edit as EditIcon,
  Lock as LockIcon,
  Visibility as ViewIcon,
  Warning as WarningIcon
} from '@mui/icons-material'; // ^5.0.0
import CryptoJS from 'crypto-js'; // ^4.1.1

// Internal imports
import { 
  ILease, 
  LeaseDocument, 
  ILeaseFinancials,
  LeaseStatus,
  NotificationType 
} from '../../types/lease.types';
import { useLease } from '../../hooks/useLease';

// Interface definitions
interface LeaseDetailsProps {
  leaseId: string;
  leaseData: ILease;
  isEditable: boolean;
  onUpdate: (updatedLease: ILease) => void;
  securityConfig: {
    encryptionKey: string;
    maxDocumentSize: number;
    allowedDocumentTypes: string[];
  };
  validationRules: {
    financialLimits: {
      minRent: number;
      maxRent: number;
    };
    documentRequirements: {
      required: string[];
      optional: string[];
    };
  };
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// Accessibility component for tab panels
const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`lease-tabpanel-${index}`}
    aria-labelledby={`lease-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

// Main component
export const LeaseDetails: React.FC<LeaseDetailsProps> = ({
  leaseId,
  leaseData,
  isEditable,
  onUpdate,
  securityConfig,
  validationRules
}) => {
  // State management
  const [activeTab, setActiveTab] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [encryptedDocuments, setEncryptedDocuments] = useState<Map<string, string>>(new Map());

  // Custom hook for lease operations
  const { updateLease, uploadDocument, validateFinancial } = useLease();

  // Security validation for documents
  const validateDocument = useCallback((file: File): boolean => {
    if (file.size > securityConfig.maxDocumentSize) {
      throw new Error('Document size exceeds maximum allowed limit');
    }
    if (!securityConfig.allowedDocumentTypes.includes(file.type)) {
      throw new Error('Invalid document type');
    }
    return true;
  }, [securityConfig]);

  // Handle document upload with encryption
  const handleEncryptedDocumentUpload = async (file: File): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // Validate document
      validateDocument(file);

      // Encrypt document content
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target?.result) {
          const encrypted = CryptoJS.AES.encrypt(
            e.target.result as string,
            securityConfig.encryptionKey
          ).toString();

          // Store encrypted content
          setEncryptedDocuments(prev => new Map(prev.set(file.name, encrypted)));

          // Upload encrypted document
          const uploadedDoc = await uploadDocument(leaseId, file);

          // Update lease with new document
          const updatedLease = {
            ...leaseData,
            documents: [...leaseData.documents, uploadedDoc]
          };
          await updateLease(leaseId, updatedLease);
          onUpdate(updatedLease);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setLoading(false);
    }
  };

  // Handle financial data updates
  const handleFinancialUpdate = async (financialData: ILeaseFinancials): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // Validate financial data
      const isValid = await validateFinancial(financialData);
      if (!isValid) {
        throw new Error('Invalid financial data');
      }

      // Update lease with new financial data
      const updatedLease = {
        ...leaseData,
        financials: financialData
      };
      await updateLease(leaseId, updatedLease);
      onUpdate(updatedLease);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update financial data');
    } finally {
      setLoading(false);
    }
  };

  // Render financial details section
  const renderFinancialDetails = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h6" component="h2">
          Financial Details
          {isEditable && (
            <IconButton
              aria-label="edit financial details"
              onClick={() => handleFinancialUpdate(leaseData.financials)}
              disabled={loading}
            >
              <EditIcon />
            </IconButton>
          )}
        </Typography>
      </Grid>
      <Grid item xs={12} md={6}>
        <Paper elevation={2} sx={{ p: 2 }}>
          <Typography variant="subtitle1">Base Rent</Typography>
          <Typography>{`$${leaseData.financials.baseRent.toLocaleString()}`}</Typography>
        </Paper>
      </Grid>
      {/* Additional financial details... */}
    </Grid>
  );

  // Render documents section
  const renderDocuments = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h6" component="h2">
          Documents
          {isEditable && (
            <Tooltip title="Upload New Document">
              <IconButton
                component="label"
                disabled={loading}
                aria-label="upload document"
              >
                <UploadIcon />
                <input
                  type="file"
                  hidden
                  accept={securityConfig.allowedDocumentTypes.join(',')}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleEncryptedDocumentUpload(file);
                  }}
                />
              </IconButton>
            </Tooltip>
          )}
        </Typography>
      </Grid>
      {leaseData.documents.map((doc) => (
        <Grid item xs={12} md={6} key={doc.id}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="subtitle1">{doc.name}</Typography>
            <Typography variant="body2" color="textSecondary">
              {`Uploaded: ${new Date(doc.uploadedAt).toLocaleDateString()}`}
            </Typography>
            <LockIcon fontSize="small" color="primary" />
          </Paper>
        </Grid>
      ))}
    </Grid>
  );

  return (
    <Box
      component="section"
      aria-label="lease details"
      sx={{ width: '100%', typography: 'body1' }}
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        aria-label="lease details tabs"
      >
        <Tab label="Overview" id="lease-tab-0" aria-controls="lease-tabpanel-0" />
        <Tab label="Financial" id="lease-tab-1" aria-controls="lease-tabpanel-1" />
        <Tab label="Documents" id="lease-tab-2" aria-controls="lease-tabpanel-2" />
      </Tabs>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', m: 2 }}>
          <CircularProgress />
        </Box>
      )}

      <TabPanel value={activeTab} index={0}>
        {/* Overview content */}
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="h5" component="h1">
              Lease Details {leaseData.status === LeaseStatus.ACTIVE && '(Active)'}
            </Typography>
          </Grid>
          {/* Additional overview content... */}
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {renderFinancialDetails()}
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        {renderDocuments()}
      </TabPanel>
    </Box>
  );
};

export default LeaseDetails;