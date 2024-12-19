import React, { useEffect, useMemo, useState, useCallback, memo } from 'react';
import { Box, Typography, Skeleton, Alert } from '@mui/material'; // @mui/material version ^5.0.0
import { debounce } from 'lodash'; // lodash version ^4.17.21
import DataGrid from '../common/DataGrid';
import { Resource, ResourceType, ResourceStatus } from '../../types/resource.types';
import useResource from '../../hooks/useResource';
import { getUserFromToken, isTokenValid } from '../../utils/auth.utils';
import { UserRole } from '../../backend/src/core/users/interfaces/user.interface';

/**
 * Props interface for the ResourceList component
 */
interface ResourceListProps {
  spaceId: string;
  onResourceSelect?: (resource: Resource) => void;
  showFilters?: boolean;
  roleBasedAccess?: boolean;
  wsEndpoint?: string;
  errorBoundary?: boolean;
}

/**
 * Helper function to get theme-aware color based on resource status
 */
const getResourceStatusColor = (status: ResourceStatus): string => {
  switch (status) {
    case ResourceStatus.AVAILABLE:
      return 'success.main';
    case ResourceStatus.OCCUPIED:
      return 'warning.main';
    case ResourceStatus.MAINTENANCE:
      return 'error.main';
    case ResourceStatus.RESERVED:
      return 'info.main';
    default:
      return 'text.secondary';
  }
};

/**
 * ResourceList Component
 * Displays a list of workplace resources with real-time updates and role-based access control
 */
const ResourceList = memo(({
  spaceId,
  onResourceSelect,
  showFilters = true,
  roleBasedAccess = true,
  wsEndpoint,
  errorBoundary = true
}: ResourceListProps) => {
  // Custom hooks and state
  const {
    spaceResources,
    loading,
    error,
    wsConnected,
    fetchResourcesBySpace,
    updateExistingResource
  } = useResource();

  const [filterValue, setFilterValue] = useState<string>('');
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  // Initialize user role and permissions
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token && isTokenValid(token)) {
      const user = getUserFromToken(token);
      if (user) {
        setUserRole(user.role);
      }
    }
  }, []);

  // Fetch resources on mount and space change
  useEffect(() => {
    if (spaceId) {
      fetchResourcesBySpace(spaceId);
    }
  }, [spaceId, fetchResourcesBySpace]);

  // Debounced filter handler
  const handleFilterChange = useMemo(
    () =>
      debounce((value: string) => {
        setFilterValue(value);
      }, 300),
    []
  );

  // Grid columns configuration with accessibility support
  const columns = useMemo(() => [
    {
      field: 'id',
      headerName: 'ID',
      width: 130,
      headerClassName: 'data-grid-header',
      sortable: true,
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 150,
      valueGetter: (params: any) => ResourceType[params.row.type],
      headerClassName: 'data-grid-header',
      sortable: true,
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 150,
      renderCell: (params: any) => (
        <Box
          sx={{
            color: getResourceStatusColor(params.row.status),
            fontWeight: 'medium',
          }}
          role="status"
          aria-label={`Resource status: ${ResourceStatus[params.row.status]}`}
        >
          {ResourceStatus[params.row.status]}
        </Box>
      ),
      headerClassName: 'data-grid-header',
      sortable: true,
    },
    {
      field: 'attributes.name',
      headerName: 'Name',
      width: 200,
      valueGetter: (params: any) => params.row.attributes.name,
      headerClassName: 'data-grid-header',
      sortable: true,
    },
    {
      field: 'capacity',
      headerName: 'Capacity',
      width: 130,
      type: 'number',
      headerClassName: 'data-grid-header',
      sortable: true,
    },
    {
      field: 'attributes.location',
      headerName: 'Location',
      width: 200,
      valueGetter: (params: any) => params.row.attributes.location,
      headerClassName: 'data-grid-header',
      sortable: true,
    }
  ], []);

  // Row click handler with role-based access control
  const handleRowClick = useCallback((params: any) => {
    if (!roleBasedAccess || (userRole && [UserRole.SYSTEM_ADMIN, UserRole.FACILITY_MANAGER].includes(userRole))) {
      onResourceSelect?.(params.row);
    }
  }, [onResourceSelect, roleBasedAccess, userRole]);

  // Filter resources based on search input
  const filteredResources = useMemo(() => {
    if (!filterValue) return spaceResources;
    
    return spaceResources.filter(resource => 
      resource.attributes.name.toLowerCase().includes(filterValue.toLowerCase()) ||
      resource.attributes.location.toLowerCase().includes(filterValue.toLowerCase())
    );
  }, [spaceResources, filterValue]);

  // Error handling with boundary
  if (errorBoundary && error) {
    return (
      <Alert 
        severity="error"
        sx={{ mb: 2 }}
        role="alert"
      >
        Failed to load resources: {error.message}
      </Alert>
    );
  }

  // Loading state with skeleton
  if (loading) {
    return (
      <Box sx={{ width: '100%' }}>
        <Skeleton variant="rectangular" height={400} animation="wave" />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}
    >
      {/* WebSocket connection status */}
      {wsEndpoint && (
        <Alert 
          severity={wsConnected ? "success" : "warning"}
          sx={{ mb: 1 }}
          role="status"
        >
          {wsConnected ? "Real-time updates active" : "Real-time updates unavailable"}
        </Alert>
      )}

      {/* Main data grid */}
      <DataGrid
        rows={filteredResources}
        columns={columns}
        loading={loading}
        onRowClick={handleRowClick}
        checkboxSelection={false}
        disableColumnFilter={!showFilters}
        autoHeight
        density="comfortable"
        sortingMode="client"
        filterMode="client"
        aria-label="Resource list"
        getRowId={(row) => row.id}
      />

      {/* Resource count summary */}
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mt: 1 }}
        role="status"
        aria-label="Resource count"
      >
        {`${filteredResources.length} resources found`}
      </Typography>
    </Box>
  );
});

ResourceList.displayName = 'ResourceList';

export default ResourceList;