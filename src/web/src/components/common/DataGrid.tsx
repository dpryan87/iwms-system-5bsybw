import React, { useMemo, useState, useCallback, useEffect, useRef, memo } from 'react';
import { 
  DataGrid as MuiDataGrid,
  GridColDef, 
  GridRowsProp, 
  GridSortModel, 
  GridFilterModel, 
  GridRowParams,
  GridSelectionModel,
  GridPageChangeParams,
  GridFeatureMode
} from '@mui/x-data-grid'; // @mui/x-data-grid version ^6.0.0
import { styled } from '@mui/material/styles'; // @mui/material version ^5.0.0
import { lightTheme, darkTheme } from '../../styles/theme';

// Enhanced interface for DataGrid props
interface DataGridProps {
  columns: GridColDef[];
  rows: GridRowsProp;
  pageSize?: number;
  onRowClick?: (params: GridRowParams) => void;
  loading?: boolean;
  checkboxSelection?: boolean;
  disableColumnFilter?: boolean;
  disableColumnMenu?: boolean;
  autoHeight?: boolean;
  density?: 'compact' | 'standard' | 'comfortable';
  sortingMode?: GridFeatureMode;
  filterMode?: GridFeatureMode;
  onSelectionModelChange?: (selectionModel: GridSelectionModel) => void;
  initialState?: {
    sorting?: GridSortModel;
    filter?: GridFilterModel;
  };
}

// Styled component with comprehensive theme integration
const StyledDataGrid = styled(MuiDataGrid)(({ theme }) => ({
  // Root styles
  '&.MuiDataGrid-root': {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.spacing(1),
    backgroundColor: theme.palette.background.paper,
    fontFamily: theme.typography.fontFamily,
    
    // Responsive font sizing
    fontSize: theme.typography.body2.fontSize,
    [theme.breakpoints.up('md')]: {
      fontSize: theme.typography.body1.fontSize,
    },
  },

  // Header styles
  '.MuiDataGrid-columnHeaders': {
    backgroundColor: theme.palette.mode === 'light' 
      ? theme.palette.grey[100] 
      : theme.palette.grey[900],
    borderBottom: `2px solid ${theme.palette.divider}`,
  },

  // Cell styles
  '.MuiDataGrid-cell': {
    borderBottom: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1),
    
    '&:focus': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: -2,
    },
  },

  // Row hover and selection styles
  '.MuiDataGrid-row': {
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    '&.Mui-selected': {
      backgroundColor: theme.palette.action.selected,
      '&:hover': {
        backgroundColor: theme.palette.action.selected,
      },
    },
  },

  // Loading overlay styles
  '.MuiDataGrid-loadingOverlay': {
    backgroundColor: theme.palette.background.paper,
  },

  // Pagination styles
  '.MuiDataGrid-footer': {
    borderTop: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1),
  },

  // Custom scrollbar styles
  '&::-webkit-scrollbar': {
    width: 8,
    height: 8,
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: theme.palette.grey[400],
    borderRadius: 4,
  },
}));

// Custom hooks for sorting and filtering
const useGridSort = (rows: GridRowsProp, sortModel: GridSortModel): GridRowsProp => {
  return useMemo(() => {
    if (!sortModel || sortModel.length === 0) return rows;

    return [...rows].sort((a, b) => {
      for (const sort of sortModel) {
        const { field, sort: direction } = sort;
        const valueA = a[field];
        const valueB = b[field];
        
        if (valueA < valueB) return direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [rows, sortModel]);
};

const useGridFilter = (rows: GridRowsProp, filterModel: GridFilterModel): GridRowsProp => {
  return useMemo(() => {
    if (!filterModel || !filterModel.items.length) return rows;

    return rows.filter(row => {
      return filterModel.items.every(filter => {
        const value = row[filter.field];
        const filterValue = filter.value;

        switch (filter.operator) {
          case 'contains':
            return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
          case 'equals':
            return value === filterValue;
          case 'startsWith':
            return String(value).toLowerCase().startsWith(String(filterValue).toLowerCase());
          case 'endsWith':
            return String(value).toLowerCase().endsWith(String(filterValue).toLowerCase());
          default:
            return true;
        }
      });
    });
  }, [rows, filterModel]);
};

// Main DataGrid component
const DataGrid = memo(({
  columns,
  rows,
  pageSize = 25,
  onRowClick,
  loading = false,
  checkboxSelection = false,
  disableColumnFilter = false,
  disableColumnMenu = false,
  autoHeight = false,
  density = 'standard',
  sortingMode = 'client',
  filterMode = 'client',
  onSelectionModelChange,
  initialState,
  ...props
}: DataGridProps) => {
  // State management
  const [page, setPage] = useState(0);
  const [sortModel, setSortModel] = useState<GridSortModel>(initialState?.sorting || []);
  const [filterModel, setFilterModel] = useState<GridFilterModel>(initialState?.filter || { items: [] });
  const [selectionModel, setSelectionModel] = useState<GridSelectionModel>([]);
  
  // Refs for performance optimization
  const gridRef = useRef<HTMLDivElement>(null);

  // Process data based on current sort and filter state
  const sortedRows = useGridSort(rows, sortModel);
  const filteredRows = useGridFilter(sortedRows, filterModel);

  // Event handlers
  const handlePageChange = useCallback((params: GridPageChangeParams) => {
    setPage(params.page);
  }, []);

  const handleSortModelChange = useCallback((model: GridSortModel) => {
    setSortModel(model);
  }, []);

  const handleFilterModelChange = useCallback((model: GridFilterModel) => {
    setFilterModel(model);
  }, []);

  const handleSelectionModelChange = useCallback((newSelectionModel: GridSelectionModel) => {
    setSelectionModel(newSelectionModel);
    onSelectionModelChange?.(newSelectionModel);
  }, [onSelectionModelChange]);

  // Accessibility enhancements
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.setAttribute('role', 'grid');
      gridRef.current.setAttribute('aria-label', 'Data Grid');
    }
  }, []);

  return (
    <StyledDataGrid
      ref={gridRef}
      rows={filteredRows}
      columns={columns}
      pageSize={pageSize}
      page={page}
      onPageChange={handlePageChange}
      sortModel={sortModel}
      onSortModelChange={handleSortModelChange}
      filterModel={filterModel}
      onFilterModelChange={handleFilterModelChange}
      selectionModel={selectionModel}
      onSelectionModelChange={handleSelectionModelChange}
      onRowClick={onRowClick}
      loading={loading}
      checkboxSelection={checkboxSelection}
      disableColumnFilter={disableColumnFilter}
      disableColumnMenu={disableColumnMenu}
      autoHeight={autoHeight}
      density={density}
      sortingMode={sortingMode}
      filterMode={filterMode}
      pagination
      disableSelectionOnClick
      aria-label="Data grid"
      getRowId={(row) => row.id}
      components={{
        NoRowsOverlay: () => (
          <div style={{ padding: 16, textAlign: 'center' }}>
            No data to display
          </div>
        ),
        NoResultsOverlay: () => (
          <div style={{ padding: 16, textAlign: 'center' }}>
            No results found
          </div>
        ),
      }}
      {...props}
    />
  );
});

DataGrid.displayName = 'DataGrid';

export default DataGrid;
export type { DataGridProps };
export { useGridSort, useGridFilter };