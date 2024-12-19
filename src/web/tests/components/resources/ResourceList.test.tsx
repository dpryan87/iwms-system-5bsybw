import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { axe, toHaveNoViolations } from '@axe-core/react';
import ResourceList from '../../../../src/components/resources/ResourceList';
import { Resource, ResourceType, ResourceStatus } from '../../../../src/types/resource.types';
import { UserRole } from '../../../../src/backend/src/core/users/interfaces/user.interface';
import { useWebSocket } from '../../../../src/hooks/useWebSocket';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock useWebSocket hook
vi.mock('../../../../src/hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    state: {
      connected: true,
      connectionState: 'CONNECTED',
      error: null
    },
    connect: vi.fn(),
    disconnect: vi.fn()
  }))
}));

// Mock sample resources
const mockResources: Resource[] = [
  {
    id: '1',
    type: ResourceType.WORKSTATION,
    status: ResourceStatus.AVAILABLE,
    capacity: 1,
    attributes: {
      name: 'Workstation A1',
      description: 'Corner workstation',
      equipment: ['Monitor', 'Dock'],
      location: 'Floor 1',
      customFields: {}
    },
    spaceId: 'space-1',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01')
  },
  {
    id: '2',
    type: ResourceType.MEETING_ROOM,
    status: ResourceStatus.OCCUPIED,
    capacity: 8,
    attributes: {
      name: 'Meeting Room 101',
      description: 'Large conference room',
      equipment: ['Projector', 'Whiteboard'],
      location: 'Floor 1',
      customFields: {}
    },
    spaceId: 'space-1',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01')
  }
];

// Mock resource hook
const mockUseResource = vi.fn(() => ({
  spaceResources: mockResources,
  loading: false,
  error: null,
  wsConnected: true,
  fetchResourcesBySpace: vi.fn(),
  updateExistingResource: vi.fn()
}));

vi.mock('../../../../src/hooks/useResource', () => ({
  useResource: () => mockUseResource()
}));

describe('ResourceList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should render successfully with resources', async () => {
    render(
      <ResourceList
        spaceId="space-1"
        showFilters={true}
        userRole={UserRole.FACILITY_MANAGER}
      />
    );

    // Verify resources are rendered
    expect(screen.getByText('Workstation A1')).toBeInTheDocument();
    expect(screen.getByText('Meeting Room 101')).toBeInTheDocument();

    // Verify status indicators
    expect(screen.getByText('AVAILABLE')).toHaveStyle({
      color: 'success.main'
    });
    expect(screen.getByText('OCCUPIED')).toHaveStyle({
      color: 'warning.main'
    });
  });

  it('should handle loading state correctly', () => {
    mockUseResource.mockImplementationOnce(() => ({
      spaceResources: [],
      loading: true,
      error: null,
      wsConnected: true,
      fetchResourcesBySpace: vi.fn()
    }));

    render(
      <ResourceList
        spaceId="space-1"
        showFilters={true}
        userRole={UserRole.FACILITY_MANAGER}
      />
    );

    // Verify loading skeleton is displayed
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('should handle error state correctly', () => {
    const errorMessage = 'Failed to load resources';
    mockUseResource.mockImplementationOnce(() => ({
      spaceResources: [],
      loading: false,
      error: new Error(errorMessage),
      wsConnected: false,
      fetchResourcesBySpace: vi.fn()
    }));

    render(
      <ResourceList
        spaceId="space-1"
        showFilters={true}
        userRole={UserRole.FACILITY_MANAGER}
      />
    );

    // Verify error message is displayed
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('should enforce role-based access control', async () => {
    const onResourceSelect = vi.fn();

    // Test with read-only user
    render(
      <ResourceList
        spaceId="space-1"
        onResourceSelect={onResourceSelect}
        userRole={UserRole.READONLY_USER}
      />
    );

    // Click on a resource
    fireEvent.click(screen.getByText('Workstation A1'));
    expect(onResourceSelect).not.toHaveBeenCalled();

    // Test with facility manager
    render(
      <ResourceList
        spaceId="space-1"
        onResourceSelect={onResourceSelect}
        userRole={UserRole.FACILITY_MANAGER}
      />
    );

    fireEvent.click(screen.getByText('Workstation A1'));
    expect(onResourceSelect).toHaveBeenCalledWith(mockResources[0]);
  });

  it('should handle real-time updates via WebSocket', async () => {
    const { rerender } = render(
      <ResourceList
        spaceId="space-1"
        showFilters={true}
        userRole={UserRole.FACILITY_MANAGER}
      />
    );

    // Simulate WebSocket update
    const updatedResources = [...mockResources];
    updatedResources[0].status = ResourceStatus.OCCUPIED;

    mockUseResource.mockImplementationOnce(() => ({
      spaceResources: updatedResources,
      loading: false,
      error: null,
      wsConnected: true,
      fetchResourcesBySpace: vi.fn()
    }));

    rerender(
      <ResourceList
        spaceId="space-1"
        showFilters={true}
        userRole={UserRole.FACILITY_MANAGER}
      />
    );

    // Verify status update is reflected
    const statusElements = screen.getAllByText('OCCUPIED');
    expect(statusElements).toHaveLength(2);
  });

  it('should handle filtering resources', async () => {
    render(
      <ResourceList
        spaceId="space-1"
        showFilters={true}
        userRole={UserRole.FACILITY_MANAGER}
      />
    );

    // Get filter input
    const filterInput = screen.getByRole('textbox', { name: /filter/i });

    // Filter by name
    fireEvent.change(filterInput, { target: { value: 'Meeting Room' } });

    await waitFor(() => {
      expect(screen.queryByText('Workstation A1')).not.toBeInTheDocument();
      expect(screen.getByText('Meeting Room 101')).toBeInTheDocument();
    });
  });

  it('should meet accessibility requirements', async () => {
    const { container } = render(
      <ResourceList
        spaceId="space-1"
        showFilters={true}
        userRole={UserRole.FACILITY_MANAGER}
      />
    );

    // Run accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify ARIA attributes
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should display WebSocket connection status', () => {
    render(
      <ResourceList
        spaceId="space-1"
        showFilters={true}
        userRole={UserRole.FACILITY_MANAGER}
        wsEndpoint="ws://localhost:3000"
      />
    );

    // Verify connection status alert
    expect(screen.getByText('Real-time updates active')).toBeInTheDocument();
  });

  it('should handle resource count summary', () => {
    render(
      <ResourceList
        spaceId="space-1"
        showFilters={true}
        userRole={UserRole.FACILITY_MANAGER}
      />
    );

    // Verify resource count
    expect(screen.getByText('2 resources found')).toBeInTheDocument();
  });
});