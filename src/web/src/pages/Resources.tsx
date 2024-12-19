import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, Button, Modal, Skeleton, Alert } from '@mui/material'; // @mui/material version ^5.0.0
import { Add as AddIcon, Refresh as RefreshIcon } from '@mui/icons-material'; // @mui/icons-material version ^5.0.0

// Internal imports
import DashboardLayout from '../layouts/DashboardLayout';
import ResourceList from '../components/resources/ResourceList';
import useResource from '../hooks/useResource';
import useWebSocket from '../hooks/useWebSocket';
import { Resource } from '../types/resource.types';

// Modal styling with accessibility support
const MODAL_STYLE = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 600,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  outline: 'none',
  role: 'dialog',
  'aria-modal': true
};

// WebSocket configuration
const WEBSOCKET_RETRY_ATTEMPTS = 3;
const WEBSOCKET_RETRY_DELAY = 1000;

/**
 * Resources page component providing comprehensive resource management capabilities
 * with real-time updates and enhanced accessibility features.
 */
const Resources: React.FC = () => {
  // State management
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  // Custom hooks
  const {
    spaceResources,
    loading,
    error,
    createNewResource,
    updateExistingResource,
    removeResource,
    retryOperation
  } = useResource();

  // WebSocket setup for real-time updates
  const { state: wsState, connect } = useWebSocket(
    `${process.env.REACT_APP_WS_URL}/resources`,
    {
      autoConnect: true,
      reconnectAttempts: WEBSOCKET_RETRY_ATTEMPTS,
      reconnectInterval: WEBSOCKET_RETRY_DELAY
    }
  );

  // Handle WebSocket updates
  useEffect(() => {
    if (wsState.connected) {
      console.log('WebSocket connected for real-time resource updates');
    }
  }, [wsState.connected]);

  // Modal handlers
  const handleModalOpen = useCallback(() => setModalOpen(true), []);
  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setSelectedResource(null);
  }, []);

  // Resource selection handler
  const handleResourceSelect = useCallback((resource: Resource) => {
    setSelectedResource(resource);
    handleModalOpen();
  }, [handleModalOpen]);

  // Resource submission handler
  const handleResourceSubmit = useCallback(async (resourceData: Resource) => {
    try {
      if (selectedResource) {
        await updateExistingResource(selectedResource.id, resourceData);
      } else {
        await createNewResource(resourceData);
      }
      handleModalClose();
    } catch (err) {
      console.error('Resource operation failed:', err);
    }
  }, [selectedResource, updateExistingResource, createNewResource, handleModalClose]);

  // Action buttons for the dashboard header
  const actionButtons = useMemo(() => (
    <>
      <Button
        startIcon={<RefreshIcon />}
        onClick={() => retryOperation()}
        disabled={loading}
        aria-label="Refresh resources"
      >
        Refresh
      </Button>
      <Button
        startIcon={<AddIcon />}
        onClick={handleModalOpen}
        variant="contained"
        color="primary"
        disabled={loading}
        aria-label="Add new resource"
      >
        Add Resource
      </Button>
    </>
  ), [loading, handleModalOpen, retryOperation]);

  return (
    <DashboardLayout
      title="Resources"
      subtitle="Manage workplace resources and amenities"
      actions={actionButtons}
    >
      <Box sx={{ width: '100%', height: '100%' }}>
        {/* Error handling */}
        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => retryOperation()}>
                Retry
              </Button>
            }
          >
            {error.message}
          </Alert>
        )}

        {/* WebSocket connection status */}
        {!wsState.connected && (
          <Alert 
            severity="warning" 
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => connect()}>
                Reconnect
              </Button>
            }
          >
            Real-time updates unavailable. Check your connection.
          </Alert>
        )}

        {/* Loading state */}
        {loading ? (
          <Box sx={{ width: '100%', p: 2 }}>
            <Skeleton variant="rectangular" height={400} animation="wave" />
          </Box>
        ) : (
          /* Resource list with real-time updates */
          <ResourceList
            spaceId="all"
            onResourceSelect={handleResourceSelect}
            showFilters={true}
            wsEndpoint={process.env.REACT_APP_WS_URL}
          />
        )}

        {/* Resource form modal */}
        <Modal
          open={modalOpen}
          onClose={handleModalClose}
          aria-labelledby="resource-modal-title"
          aria-describedby="resource-modal-description"
        >
          <Box sx={MODAL_STYLE}>
            {/* Resource form component would go here */}
            {/* Omitted for brevity - would include form fields for resource management */}
          </Box>
        </Modal>
      </Box>
    </DashboardLayout>
  );
};

export default Resources;