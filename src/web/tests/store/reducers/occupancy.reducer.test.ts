/**
 * @fileoverview Unit tests for occupancy reducer
 * @version 1.0.0
 * @package jest@29.0.0
 */

import { occupancyReducer, OccupancyState, OccupancyOperationType } from '../../../../src/store/reducers/occupancy.reducer';
import { 
  OccupancyData, 
  OccupancyTrend, 
  OccupancyAlert, 
  OccupancyAlertType,
  AlertSeverity 
} from '../../../../src/types/occupancy.types';

describe('occupancyReducer', () => {
  let initialState: OccupancyState;

  beforeEach(() => {
    // Reset initial state before each test
    initialState = {
      currentOccupancy: {},
      trends: {},
      alerts: [],
      loadingStates: {
        [OccupancyOperationType.FETCH]: false,
        [OccupancyOperationType.UPDATE]: false,
        [OccupancyOperationType.ANALYZE]: false,
        [OccupancyOperationType.ALERT]: false
      },
      lastUpdated: {},
      errors: []
    };
  });

  it('should return initial state', () => {
    const state = occupancyReducer(undefined, { type: '@@INIT' });
    expect(state).toEqual(initialState);
  });

  describe('Loading States', () => {
    it('should handle setLoading action', () => {
      const action = {
        type: 'occupancy/setLoading',
        payload: {
          operationType: OccupancyOperationType.FETCH,
          isLoading: true
        }
      };

      const state = occupancyReducer(initialState, action);
      expect(state.loadingStates[OccupancyOperationType.FETCH]).toBe(true);
    });
  });

  describe('Current Occupancy', () => {
    const mockOccupancyData: OccupancyData = {
      spaceId: 'space-123',
      timestamp: new Date('2023-01-01T00:00:00Z'),
      occupantCount: 50,
      capacity: 100,
      utilizationRate: 50
    };

    it('should handle setCurrentOccupancy with valid data', () => {
      const action = {
        type: 'occupancy/setCurrentOccupancy',
        payload: {
          spaceId: 'space-123',
          data: mockOccupancyData
        }
      };

      const state = occupancyReducer(initialState, action);
      expect(state.currentOccupancy['space-123']).toEqual(mockOccupancyData);
      expect(state.lastUpdated['space-123']).toBeInstanceOf(Date);
    });

    it('should handle invalid occupancy data', () => {
      const invalidData = { ...mockOccupancyData, utilizationRate: 150 };
      const action = {
        type: 'occupancy/setCurrentOccupancy',
        payload: {
          spaceId: 'space-123',
          data: invalidData
        }
      };

      const state = occupancyReducer(initialState, action);
      expect(state.errors).toHaveLength(1);
      expect(state.errors[0].code).toBe('INVALID_DATA');
    });
  });

  describe('Occupancy Trends', () => {
    const mockTrend: OccupancyTrend = {
      spaceId: 'space-123',
      timeRange: {
        start: new Date('2023-01-01T00:00:00Z'),
        end: new Date('2023-01-02T00:00:00Z')
      },
      averageUtilization: 45,
      peakOccupancy: 75,
      dataPoints: [
        {
          spaceId: 'space-123',
          timestamp: new Date('2023-01-01T00:00:00Z'),
          occupantCount: 45,
          capacity: 100,
          utilizationRate: 45
        }
      ]
    };

    it('should handle setTrend with valid trend data', () => {
      const action = {
        type: 'occupancy/setTrend',
        payload: {
          spaceId: 'space-123',
          trend: mockTrend
        }
      };

      const state = occupancyReducer(initialState, action);
      expect(state.trends['space-123']).toEqual(mockTrend);
      expect(state.lastUpdated['space-123']).toBeInstanceOf(Date);
    });

    it('should handle invalid trend data points', () => {
      const invalidTrend = {
        ...mockTrend,
        dataPoints: [{ invalid: 'data' }]
      };
      const action = {
        type: 'occupancy/setTrend',
        payload: {
          spaceId: 'space-123',
          trend: invalidTrend
        }
      };

      const state = occupancyReducer(initialState, action);
      expect(state.errors).toHaveLength(1);
      expect(state.errors[0].code).toBe('INVALID_TREND');
    });
  });

  describe('Occupancy Alerts', () => {
    const mockAlert: OccupancyAlert = {
      spaceId: 'space-123',
      timestamp: new Date('2023-01-01T00:00:00Z'),
      alertType: OccupancyAlertType.HIGH_UTILIZATION,
      message: 'High utilization detected',
      threshold: 80,
      severity: AlertSeverity.WARNING
    };

    it('should handle addAlert with valid alert', () => {
      const action = {
        type: 'occupancy/addAlert',
        payload: mockAlert
      };

      const state = occupancyReducer(initialState, action);
      expect(state.alerts).toHaveLength(1);
      expect(state.alerts[0]).toEqual(mockAlert);
    });

    it('should sort alerts by severity and timestamp', () => {
      const criticalAlert: OccupancyAlert = {
        ...mockAlert,
        severity: AlertSeverity.CRITICAL,
        timestamp: new Date('2023-01-01T00:01:00Z')
      };

      const state = occupancyReducer(
        { ...initialState, alerts: [mockAlert] },
        { type: 'occupancy/addAlert', payload: criticalAlert }
      );

      expect(state.alerts[0]).toEqual(criticalAlert);
      expect(state.alerts[1]).toEqual(mockAlert);
    });

    it('should handle clearAlert', () => {
      const stateWithAlert = {
        ...initialState,
        alerts: [mockAlert]
      };

      const action = {
        type: 'occupancy/clearAlert',
        payload: {
          spaceId: 'space-123',
          alertType: OccupancyAlertType.HIGH_UTILIZATION
        }
      };

      const state = occupancyReducer(stateWithAlert, action);
      expect(state.alerts).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle clearErrors', () => {
      const stateWithErrors = {
        ...initialState,
        errors: [
          {
            message: 'Test error',
            code: 'TEST_ERROR',
            timestamp: new Date(Date.now() - 6000) // Older than ERROR_TIMEOUT
          }
        ]
      };

      const state = occupancyReducer(stateWithErrors, { type: 'occupancy/clearErrors' });
      expect(state.errors).toHaveLength(0);
    });

    it('should handle recoverFromError', () => {
      const stateWithError = {
        ...initialState,
        loadingStates: {
          ...initialState.loadingStates,
          [OccupancyOperationType.FETCH]: true
        },
        errors: [
          {
            message: 'Error fetching space-123',
            code: 'FETCH_ERROR',
            timestamp: new Date()
          }
        ]
      };

      const action = {
        type: 'occupancy/recoverFromError',
        payload: {
          spaceId: 'space-123',
          operationType: OccupancyOperationType.FETCH
        }
      };

      const state = occupancyReducer(stateWithError, action);
      expect(state.loadingStates[OccupancyOperationType.FETCH]).toBe(false);
      expect(state.errors).toHaveLength(0);
    });
  });
});