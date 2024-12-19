/**
 * @fileoverview Redux actions for managing occupancy-related state
 * @version 1.0.0
 * @package @reduxjs/toolkit@1.9.5
 */

import { createAction, createAsyncThunk } from '@reduxjs/toolkit';
import { debounce } from 'lodash'; // @version 4.17.21
import { 
  OccupancyData, 
  OccupancyAlert, 
  isOccupancyData, 
  AlertSeverity 
} from '../../types/occupancy.types';

// Action type constants
export const OCCUPANCY_ACTIONS = {
  SET_CURRENT_OCCUPANCY: 'occupancy/setCurrentOccupancy',
  SET_OCCUPANCY_ERROR: 'occupancy/setOccupancyError',
  CLEAR_OCCUPANCY_ERROR: 'occupancy/clearOccupancyError',
  FETCH_OCCUPANCY_DATA: 'occupancy/fetchOccupancyData',
  START_OCCUPANCY_UPDATES: 'occupancy/startOccupancyUpdates'
} as const;

// WebSocket configuration
export const WEBSOCKET_CONFIG = {
  RECONNECT_ATTEMPTS: 5,
  RECONNECT_INTERVAL: 1000,
  MESSAGE_TIMEOUT: 5000,
  DEBOUNCE_WAIT: 250
} as const;

// Synchronous action creators
export const setCurrentOccupancy = createAction<OccupancyData>(
  OCCUPANCY_ACTIONS.SET_CURRENT_OCCUPANCY,
  (occupancyData: OccupancyData) => {
    if (!isOccupancyData(occupancyData)) {
      throw new Error('Invalid occupancy data format');
    }
    return { payload: occupancyData };
  }
);

export const setOccupancyError = createAction<string>(
  OCCUPANCY_ACTIONS.SET_OCCUPANCY_ERROR
);

export const clearOccupancyError = createAction(
  OCCUPANCY_ACTIONS.CLEAR_OCCUPANCY_ERROR
);

// Async thunk for fetching occupancy data with retry logic
interface FetchOccupancyOptions {
  retryAttempts?: number;
  retryDelay?: number;
  forceRefresh?: boolean;
}

export const fetchOccupancyDataThunk = createAsyncThunk<
  OccupancyData,
  { spaceId: string; options?: FetchOccupancyOptions }
>(
  OCCUPANCY_ACTIONS.FETCH_OCCUPANCY_DATA,
  async ({ spaceId, options = {} }, { dispatch, rejectWithValue }) => {
    const {
      retryAttempts = 3,
      retryDelay = 1000,
      forceRefresh = false
    } = options;

    let attempt = 0;
    
    while (attempt < retryAttempts) {
      try {
        const response = await fetch(`/api/occupancy/${spaceId}`, {
          headers: {
            'Cache-Control': forceRefresh ? 'no-cache' : 'max-age=60'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (!isOccupancyData(data)) {
          throw new Error('Invalid occupancy data received from server');
        }

        dispatch(clearOccupancyError());
        return data;

      } catch (error) {
        attempt++;
        if (attempt === retryAttempts) {
          dispatch(setOccupancyError((error as Error).message));
          return rejectWithValue((error as Error).message);
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }

    throw new Error('Failed to fetch occupancy data');
  }
);

// Async thunk for managing real-time occupancy updates
interface WebSocketConfig {
  reconnectAttempts?: number;
  reconnectInterval?: number;
  messageTimeout?: number;
}

export const startOccupancyUpdatesThunk = createAsyncThunk<
  void,
  { spaceId: string; config?: WebSocketConfig }
>(
  OCCUPANCY_ACTIONS.START_OCCUPANCY_UPDATES,
  async ({ spaceId, config = {} }, { dispatch }) => {
    const {
      reconnectAttempts = WEBSOCKET_CONFIG.RECONNECT_ATTEMPTS,
      reconnectInterval = WEBSOCKET_CONFIG.RECONNECT_INTERVAL,
      messageTimeout = WEBSOCKET_CONFIG.MESSAGE_TIMEOUT
    } = config;

    let ws: WebSocket | null = null;
    let reconnectCount = 0;
    let timeoutId: NodeJS.Timeout;

    // Debounced update handler to prevent excessive state updates
    const debouncedUpdateHandler = debounce((data: OccupancyData) => {
      dispatch(setCurrentOccupancy(data));
    }, WEBSOCKET_CONFIG.DEBOUNCE_WAIT);

    const connect = () => {
      ws = new WebSocket(`wss://api.example.com/occupancy/${spaceId}`);

      ws.onopen = () => {
        reconnectCount = 0;
        dispatch(clearOccupancyError());
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (isOccupancyData(data)) {
            debouncedUpdateHandler(data);
          }
          // Reset timeout on successful message
          clearTimeout(timeoutId);
          timeoutId = setTimeout(checkConnection, messageTimeout);
        } catch (error) {
          dispatch(setOccupancyError('Invalid message format received'));
        }
      };

      ws.onerror = (error) => {
        dispatch(setOccupancyError('WebSocket connection error'));
      };

      ws.onclose = () => {
        if (reconnectCount < reconnectAttempts) {
          reconnectCount++;
          setTimeout(connect, reconnectInterval * reconnectCount);
        } else {
          dispatch(setOccupancyError('WebSocket connection failed'));
        }
      };
    };

    const checkConnection = () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      } else {
        dispatch(setOccupancyError('Connection timeout'));
        reconnect();
      }
    };

    const reconnect = () => {
      if (ws) {
        ws.close();
      }
      if (reconnectCount < reconnectAttempts) {
        connect();
      }
    };

    // Initial connection
    connect();

    // Return cleanup function
    return () => {
      if (ws) {
        ws.close();
      }
      clearTimeout(timeoutId);
      debouncedUpdateHandler.cancel();
    };
  }
);