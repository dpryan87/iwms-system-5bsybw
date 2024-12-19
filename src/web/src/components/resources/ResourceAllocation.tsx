import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, Tooltip, CircularProgress, Alert } from '@mui/material'; // @mui/material v5.0.0
import { GridColDef, GridRowsProp, GridSelectionModel } from '@mui/x-data-grid'; // @mui/x-data-grid v6.0.0
import { Resource, ResourceType, ResourceStatus } from '../../types/resource.types';
import { useResource } from '../../hooks/useResource';
import DataGrid from '../common/DataGrid';

/**
 * Props for the ResourceAllocation component
 */
interface ResourceAllocationProps {
  /** ID of the space to show resources for */
  spaceId: string;
  /** Callback when a resource is updated */
  onResourceUpdate?: (resource: Resource) => void;
  /** Optional CSS class name */
  className?: string;
  /** Flag to enable/disable real-time updates */
  enableRealTimeUpdates?: boolean;
}

/**
 * Component for managing and visualizing resource allocation across different spaces
 * Provides real-time updates and interactive resource management capabilities
 */
const ResourceAllocation: React.FC<ResourceAllocationProps> = ({
  spaceId,
  onResourceUpdate,
  className,
  enableRealTimeUpdates = true
}) => {
  // Resource management hooks
  const {
    spaceResources,
    loading,
    error,
    fetchResourcesBySpace,
    updateExistingResource,
  } = useResource();

  // Local state
  const [selectedResources, setSelectedResources] = useState<GridSelectionModel>([]);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const wsSubscriptions = useRef<(() => void)[]>([]);

  // Grid columns configuration
  const columns: GridColDef[] = [
    {
      field: 'id',
      headerName: 'ID',
      width: 130,
      sortable: true,
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 150,
      sortable: true,
      renderCell: (params) => (
        <Tooltip title={`Resource Type: ${params.value}`}>
          <span>{ResourceType[params.value as keyof typeof ResourceType]}</span>
        </Tooltip>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 150,
      sortable: true,
      renderCell: (params) => (
        <Box
          sx={{
            padding: '4px 8px',
            borderRadius: '4px',
            backgroundColor: getStatusColor(params.value as ResourceStatus),
            color: '#fff',
          }}
        >
          {ResourceStatus[params.value as keyof typeof ResourceStatus]}
        </Box>
      ),
    },
    {
      field: 'capacity',
      headerName: 'Capacity',
      width: 120,
      type: 'number',
      sortable: true,
    },
    {
      field: 'attributes',
      headerName: 'Details',
      width: 250,
      sortable: false,
      renderCell: (params) => (
        <Tooltip title={params.row.attributes.description}>
          <span>{params.row.attributes.name}</span>
        </Tooltip>
      ),
    },
    {
      field: 'updatedAt',
      headerName: 'Last Updated',
      width: 180,
      sortable: true,
      valueFormatter: (params) => new Date(params.value).toLocaleString(),
    },
  ];

  // Fetch resources on mount and space change
  useEffect(() => {
    if (spaceId) {
      fetchResourcesBySpace(spaceId);
    }
  }, [spaceId, fetchResourcesBySpace]);

  // Handle real-time updates
  useEffect(() => {
    if (!enableRealTimeUpdates || !spaceResources) return;

    // Clean up previous subscriptions
    wsSubscriptions.current.forEach(unsubscribe => unsubscribe());
    wsSubscriptions.current = [];

    // Set up new subscriptions for each resource
    spaceResources.forEach(resource => {
      const unsubscribe = subscribeToResourceUpdates(resource.id, (updatedResource) => {
        handleResourceUpdate(updatedResource);
      });
      wsSubscriptions.current.push(unsubscribe);
    });

    return () => {
      wsSubscriptions.current.forEach(unsubscribe => unsubscribe());
      wsSubscriptions.current = [];
    };
  }, [spaceResources, enableRealTimeUpdates]);

  // Handle resource updates with optimistic updates
  const handleResourceUpdate = useCallback(async (resource: Resource, updates: Partial<Resource>) => {
    try {
      setUpdateError(null);
      const updatedResource = await updateExistingResource(resource.id, updates);
      
      if (updatedResource) {
        onResourceUpdate?.(updatedResource);
      }
    } catch (err) {
      setUpdateError('Failed to update resource. Please try again.');
      console.error('Resource update error:', err);
    }
  }, [updateExistingResource, onResourceUpdate]);

  // Helper function to get status color
  const getStatusColor = (status: ResourceStatus): string => {
    switch (status) {
      case ResourceStatus.AVAILABLE:
        return '#2e7d32'; // success
      case ResourceStatus.OCCUPIED:
        return '#d32f2f'; // error
      case ResourceStatus.MAINTENANCE:
        return '#ed6c02'; // warning
      case ResourceStatus.RESERVED:
        return '#0288d1'; // info
      default:
        return '#757575'; // default grey
    }
  };

  // Handle selection changes
  const handleSelectionChange = (newSelection: GridSelectionModel) => {
    setSelectedResources(newSelection);
  };

  // Prepare grid rows
  const rows: GridRowsProp = spaceResources?.map(resource => ({
    ...resource,
    id: resource.id,
  })) || [];

  return (
    <Box className={className}>
      {/* Header */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" component="h2">
          Resource Allocation
        </Typography>
        {loading && <CircularProgress size={24} />}
      </Box>

      {/* Error display */}
      {(error || updateError) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || updateError}
        </Alert>
      )}

      {/* Resource grid */}
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        checkboxSelection
        disableColumnFilter={false}
        autoHeight
        density="comfortable"
        onSelectionModelChange={handleSelectionChange}
        initialState={{
          sorting: [
            { field: 'updatedAt', sort: 'desc' }
          ],
        }}
      />
    </Box>
  );
};

export default ResourceAllocation;