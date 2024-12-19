/**
 * Redux Store Configuration
 * Implements centralized state management with enhanced security features,
 * real-time synchronization, and performance optimizations for the IWMS application.
 * @version 1.0.0
 */

// External imports
import { configureStore, getDefaultMiddleware, Middleware } from '@reduxjs/toolkit';
import { persistStore, persistReducer, createTransform } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { createStateSyncMiddleware, initMessageListener } from 'redux-state-sync';
import { AES, enc } from 'crypto-js';

// Internal imports
import rootReducer, { RootState } from './reducers';

// Security configuration
const ENCRYPTION_KEY = process.env.VITE_STATE_ENCRYPTION_KEY || 'default-key';
const STATE_VERSION = 1;

/**
 * Custom transform for encrypting sensitive data before persistence
 */
const encryptTransform = createTransform(
  // Transform state on its way to being serialized and persisted
  (inboundState: any, key) => {
    if (key === 'auth' || key === 'lease') {
      return AES.encrypt(JSON.stringify(inboundState), ENCRYPTION_KEY).toString();
    }
    return inboundState;
  },
  // Transform state being rehydrated
  (outboundState: any, key) => {
    if (key === 'auth' || key === 'lease') {
      const decrypted = AES.decrypt(outboundState, ENCRYPTION_KEY).toString(enc.Utf8);
      return JSON.parse(decrypted);
    }
    return outboundState;
  }
);

/**
 * Redux persist configuration with security enhancements
 */
const persistConfig = {
  key: 'iwms-root',
  version: STATE_VERSION,
  storage,
  whitelist: ['auth', 'preferences'], // Only persist necessary slices
  transforms: [encryptTransform],
  serialize: true,
  timeout: 2000,
  writeFailHandler: (err: Error) => {
    console.error('State persistence failed:', err);
    // Implement error reporting here
  }
};

/**
 * Custom middleware for real-time synchronization
 */
const syncConfig = {
  channel: 'iwms-state-sync',
  predicate: (action: any) => {
    // Only sync specific actions
    const syncActions = ['occupancy/', 'resource/', 'floorPlan/'];
    return syncActions.some(prefix => action.type.startsWith(prefix));
  },
  blacklist: ['auth/setCredentials', 'auth/logout'],
  broadcastChannelOption: {
    type: 'localstorage' // Fallback for older browsers
  }
};

// Create sync middleware
const syncMiddleware = createStateSyncMiddleware(syncConfig);

/**
 * Custom error tracking middleware
 */
const errorMiddleware: Middleware = store => next => action => {
  try {
    return next(action);
  } catch (error) {
    console.error('Action error:', { action, error });
    // Implement error reporting here
    return error;
  }
};

/**
 * Performance monitoring middleware
 */
const performanceMiddleware: Middleware = store => next => action => {
  const start = performance.now();
  const result = next(action);
  const duration = performance.now() - start;

  if (duration > 100) { // Log slow actions
    console.warn('Slow action detected:', {
      action: action.type,
      duration: `${duration.toFixed(2)}ms`
    });
  }

  return result;
};

// Persist reducer with configuration
const persistedReducer = persistReducer(persistConfig, rootReducer);

/**
 * Configure and create the Redux store with all middleware and enhancements
 * @param preloadedState - Optional initial state
 * @returns Configured store instance
 */
export const configureAppStore = (preloadedState?: Partial<RootState>) => {
  const store = configureStore({
    reducer: persistedReducer,
    middleware: getDefaultMiddleware => getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        ignoredPaths: ['auth.sessionTimeout']
      },
      thunk: true,
      immutableCheck: true
    }).concat(syncMiddleware, errorMiddleware, performanceMiddleware),
    preloadedState,
    devTools: process.env.NODE_ENV === 'development' ? {
      name: 'IWMS Store',
      trace: true,
      traceLimit: 25,
      maxAge: 50
    } : false,
    enhancers: []
  });

  // Initialize state sync listener
  initMessageListener(store);

  // Enable hot reloading in development
  if (process.env.NODE_ENV === 'development' && module.hot) {
    module.hot.accept('./reducers', () => {
      store.replaceReducer(persistReducer(persistConfig, rootReducer));
    });
  }

  return store;
};

// Create store instance
export const store = configureAppStore();

// Create persistor
export const persistor = persistStore(store, null, () => {
  console.log('State rehydration complete');
});

// Export store types
export type AppStore = ReturnType<typeof configureAppStore>;
export type AppDispatch = AppStore['dispatch'];

// Export store instance as default
export default store;