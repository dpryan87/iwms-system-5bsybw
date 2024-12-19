import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
} from '@mui/material'; // @mui/material ^5.0.0
import { styled } from '@mui/material/styles'; // @mui/material ^5.0.0
import { useVirtual } from 'react-virtual'; // react-virtual ^2.10.4
import useTheme from '../../hooks/useTheme';

// Interfaces
export interface Column {
  field: string;
  headerName: string;
  width?: string | number;
  minWidth?: number;
  maxWidth?: number;
  sortable?: boolean;
  resizable?: boolean;
  align?: 'left' | 'center' | 'right';
  renderCell?: (row: any) => React.ReactNode;
  valueGetter?: (row: any) => any;
}

interface TableProps {
  columns: Column[];
  rows: any[];
  rowHeight?: number;
  headerHeight?: number;
  containerHeight?: number | string;
  onRowSelect?: (selectedRows: any[]) => void;
  onColumnResize?: (field: string, width: number) => void;
  sortable?: boolean;
  pagination?: boolean;
  rowsPerPageOptions?: number[];
  initialRowsPerPage?: number;
  virtualScroll?: boolean;
  stickyHeader?: boolean;
  'aria-label'?: string;
}

// Styled Components
const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  position: 'relative',
  overflow: 'auto',
  scrollbarWidth: 'thin',
  scrollbarColor: `${theme.palette.action.hover} transparent`,

  '&::-webkit-scrollbar': {
    width: '8px',
    height: '8px',
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: theme.palette.action.hover,
    borderRadius: '4px',
    '&:hover': {
      backgroundColor: theme.palette.action.selected,
    },
  },

  '@media print': {
    overflow: 'visible',
    height: 'auto !important',
  },

  [theme.breakpoints.down('sm')]: {
    maxWidth: '100vw',
    overflowX: 'auto',
  },
}));

const ResizeHandle = styled('div')(({ theme }) => ({
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  width: '4px',
  cursor: 'col-resize',
  userSelect: 'none',
  touchAction: 'none',
  background: theme.palette.divider,
  opacity: 0,
  transition: theme.transitions.create('opacity'),
  '&:hover, &.resizing': {
    opacity: 1,
  },
}));

// Custom Hooks
const useVirtualRows = (totalRows: number, rowHeight: number, containerHeight: number) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtual({
    size: totalRows,
    parentRef,
    estimateSize: useCallback(() => rowHeight, [rowHeight]),
    overscan: 5,
  });

  return { parentRef, rowVirtualizer };
};

// Main Component
export const Table = React.memo<TableProps>(({
  columns,
  rows,
  rowHeight = 52,
  headerHeight = 56,
  containerHeight = 400,
  onRowSelect,
  onColumnResize,
  sortable = true,
  pagination = true,
  rowsPerPageOptions = [10, 25, 50, 100],
  initialRowsPerPage = 25,
  virtualScroll = true,
  stickyHeader = true,
  'aria-label': ariaLabel,
}) => {
  const { theme } = useTheme();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);

  // Virtual scrolling setup
  const { parentRef, rowVirtualizer } = virtualScroll
    ? useVirtualRows(rows.length, rowHeight, typeof containerHeight === 'number' ? containerHeight : 400)
    : { parentRef: null, rowVirtualizer: null };

  // Sort handler
  const handleSort = useCallback((field: string) => {
    setSortConfig(current => ({
      field,
      direction: current?.field === field && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  // Column resize handler
  const handleColumnResize = useCallback((field: string, deltaX: number) => {
    if (onColumnResize && resizingColumn === field) {
      const column = columns.find(col => col.field === field);
      if (column) {
        const newWidth = Math.max(
          column.minWidth || 50,
          Math.min(parseFloat(String(column.width)) + deltaX, column.maxWidth || Infinity)
        );
        onColumnResize(field, newWidth);
      }
    }
  }, [columns, onColumnResize, resizingColumn]);

  // Row selection handler
  const handleRowSelect = useCallback((row: any) => {
    setSelectedRows(current => {
      const newSelection = current.includes(row)
        ? current.filter(r => r !== row)
        : [...current, row];
      onRowSelect?.(newSelection);
      return newSelection;
    });
  }, [onRowSelect]);

  // Sort and paginate data
  const processedRows = useMemo(() => {
    let result = [...rows];

    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = columns.find(col => col.field === sortConfig.field)?.valueGetter?.(a) ?? a[sortConfig.field];
        const bValue = columns.find(col => col.field === sortConfig.field)?.valueGetter?.(b) ?? b[sortConfig.field];
        return sortConfig.direction === 'asc'
          ? aValue > bValue ? 1 : -1
          : aValue < bValue ? 1 : -1;
      });
    }

    return pagination
      ? result.slice(page * rowsPerPage, (page + 1) * rowsPerPage)
      : result;
  }, [rows, sortConfig, page, rowsPerPage, pagination, columns]);

  return (
    <StyledTableContainer
      ref={parentRef}
      style={{ height: containerHeight }}
      aria-label={ariaLabel}
    >
      <MuiTable stickyHeader={stickyHeader}>
        <TableHead>
          <TableRow style={{ height: headerHeight }}>
            {columns.map(column => (
              <TableCell
                key={column.field}
                align={column.align}
                style={{
                  width: column.width,
                  minWidth: column.minWidth,
                  maxWidth: column.maxWidth,
                  position: 'relative',
                }}
              >
                {sortable && column.sortable !== false ? (
                  <TableSortLabel
                    active={sortConfig?.field === column.field}
                    direction={sortConfig?.field === column.field ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort(column.field)}
                  >
                    {column.headerName}
                  </TableSortLabel>
                ) : (
                  column.headerName
                )}
                {column.resizable && (
                  <ResizeHandle
                    className={resizingColumn === column.field ? 'resizing' : ''}
                    onMouseDown={() => setResizingColumn(column.field)}
                    onMouseUp={() => setResizingColumn(null)}
                    onMouseMove={e => handleColumnResize(column.field, e.movementX)}
                  />
                )}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {virtualScroll && rowVirtualizer
            ? rowVirtualizer.virtualItems.map(virtualRow => (
                <TableRow
                  key={virtualRow.index}
                  hover
                  selected={selectedRows.includes(processedRows[virtualRow.index])}
                  onClick={() => handleRowSelect(processedRows[virtualRow.index])}
                  style={{
                    height: rowHeight,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {columns.map(column => (
                    <TableCell key={column.field} align={column.align}>
                      {column.renderCell
                        ? column.renderCell(processedRows[virtualRow.index])
                        : processedRows[virtualRow.index][column.field]}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : processedRows.map((row, index) => (
                <TableRow
                  key={index}
                  hover
                  selected={selectedRows.includes(row)}
                  onClick={() => handleRowSelect(row)}
                  style={{ height: rowHeight }}
                >
                  {columns.map(column => (
                    <TableCell key={column.field} align={column.align}>
                      {column.renderCell
                        ? column.renderCell(row)
                        : row[column.field]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
        </TableBody>
      </MuiTable>
      {pagination && (
        <TablePagination
          component="div"
          count={rows.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={e => setRowsPerPage(parseInt(e.target.value, 10))}
          rowsPerPageOptions={rowsPerPageOptions}
        />
      )}
    </StyledTableContainer>
  );
});

Table.displayName = 'Table';

export default Table;