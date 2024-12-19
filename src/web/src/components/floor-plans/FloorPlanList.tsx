import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; // version: ^6.0.0
import { 
  Box, 
  Typography, 
  Chip, 
  CircularProgress, 
  Alert 
} from '@mui/material'; // version: ^5.0.0
import { styled } from '@mui/material/styles';
import { GridColDef, GridRowParams } from '@mui/x-data-grid'; // version: ^6.0.0

import { 
  FloorPlan, 
  FloorPlanStatus, 
  FloorPlanMetadata 
} from '../../types/floor-plan.types';
import { FloorPlanService } from '../../services/floor-plan.service';
import DataGrid from '../common/DataGrid';

// Enhanced styled components for status indicators
const StatusChip = styled(Chip)(({ theme, status }: { theme: any; status: FloorPlanStatus }) => ({
  borderRadius: theme.spacing(1),
  fontWeight: 500,
  ...(status === FloorPlanStatus.DRAFT && {
    backgroundColor: theme.palette.grey[200],
    color: theme.palette.grey[700],
  }),
  ...(status === FloorPlanStatus.PUBLISHED && {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
  }),
  ...(status === FloorPlanStatus.ARCHIVED && {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
  }),
}));

// Interface for component props
interface FloorPlanListProps {
  propertyId: string;
  onFloorPlanSelect?: (floorPlan: FloorPlan) => void;
  className?: string;
  initialSort?: { field: string; direction: 'asc' | 'desc' };
  pageSize?: number;
}

// Custom hook for grid columns configuration
const useFloorPlanColumns = (): GridColDef[] => {
  return useMemo(() => [
    {
      field: 'metadata.name',
      headerName: 'Name',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => (
        <Typography variant="body2" noWrap>
          {params.row.metadata.name}
        </Typography>
      ),
    },
    {
      field: 'metadata.level',
      headerName: 'Level',
      width: 120,
      type: 'number',
      renderCell: (params) => (
        <Typography variant="body2">
          {`Floor ${params.row.metadata.level}`}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 150,
      renderCell: (params) => (
        <StatusChip
          status={params.row.status}
          label={params.row.status}
          size="small"
          role="status"
          aria-label={`Floor plan status: ${params.row.status}`}
        />
      ),
      filterOptions: {
        items: Object.values(FloorPlanStatus),
      },
    },
    {
      field: 'metadata.totalArea',
      headerName: 'Area (sq ft)',
      width: 150,
      type: 'number',
      valueFormatter: (params) => {
        return params.value.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
      },
    },
    {
      field: 'metadata.lastModified',
      headerName: 'Last Modified',
      width: 180,
      type: 'dateTime',
      valueFormatter: (params) => {
        return new Date(params.value).toLocaleString();
      },
    },
  ], []);
};

// Main component implementation
const FloorPlanList = memo(({
  propertyId,
  onFloorPlanSelect,
  className,
  initialSort,
  pageSize = 25,
}: FloorPlanListProps) => {
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const columns = useFloorPlanColumns();

  // Initialize floor plan service subscription
  useEffect(() => {
    const floorPlanService = new FloorPlanService();
    let subscription: any;

    const initializeFloorPlans = async () => {
      try {
        setLoading(true);
        await floorPlanService.loadPropertyFloorPlans(propertyId);
        
        subscription = floorPlanService.propertyFloorPlans$.subscribe(
          (plans) => {
            setFloorPlans(plans);
            setLoading(false);
            setError(null);
          },
          (error) => {
            setError('Failed to load floor plans. Please try again.');
            setLoading(false);
          }
        );
      } catch (err) {
        setError('Failed to initialize floor plans. Please try again.');
        setLoading(false);
      }
    };

    initializeFloorPlans();

    // Cleanup subscription
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [propertyId]);

  // Handle row click with navigation
  const handleRowClick = useCallback((params: GridRowParams) => {
    const floorPlan = params.row as FloorPlan;
    if (onFloorPlanSelect) {
      onFloorPlanSelect(floorPlan);
    } else {
      navigate(`${location.pathname}/${floorPlan.id}`);
    }
  }, [navigate, location.pathname, onFloorPlanSelect]);

  return (
    <Box className={className} sx={{ width: '100%', height: '100%' }}>
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      <DataGrid
        rows={floorPlans}
        columns={columns}
        loading={loading}
        pageSize={pageSize}
        onRowClick={handleRowClick}
        initialState={{
          sorting: {
            sortModel: initialSort ? [
              { field: initialSort.field, sort: initialSort.direction }
            ] : [],
          },
        }}
        autoHeight
        disableSelectionOnClick
        getRowId={(row) => row.id}
        components={{
          LoadingOverlay: () => (
            <Box 
              display="flex" 
              alignItems="center" 
              justifyContent="center" 
              p={2}
            >
              <CircularProgress />
            </Box>
          ),
        }}
        sx={{
          '& .MuiDataGrid-row': {
            cursor: 'pointer',
          },
        }}
      />
    </Box>
  );
});

FloorPlanList.displayName = 'FloorPlanList';

export default FloorPlanList;