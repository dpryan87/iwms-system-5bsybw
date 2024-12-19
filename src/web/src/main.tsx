import React, { StrictMode } from 'react'; // @version ^18.0.0
import ReactDOM from 'react-dom/client'; // @version ^18.0.0
import * as Sentry from '@sentry/react'; // @version ^7.0.0
import { ErrorBoundary } from '@sentry/react'; // @version ^7.0.0

// Internal imports
import App from './App';

// Constants
const ROOT_ELEMENT_ID = 'root';
const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV;

/**
 * Initializes Sentry error tracking and performance monitoring
 * with environment-specific configuration
 */
const initializeSentry = (): void => {
  if (!SENTRY_DSN) {
    console.warn('Sentry DSN not configured');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    integrations: [
      new Sentry.BrowserTracing({
        tracePropagationTargets: ['localhost', /^https:\/\/[^/]+\.iwms\.com/],
      }),
      new Sentry.Replay(),
    ],
    // Performance monitoring configuration
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    // Error filtering
    ignoreErrors: [
      'Network request failed',
      'ResizeObserver loop limit exceeded',
    ],
    beforeSend(event) {
      // Filter out non-error events in production
      if (ENVIRONMENT === 'production' && !event.exception) {
        return null;
      }
      return event;
    },
  });
};

/**
 * Renders the root application component with necessary providers
 * and error boundaries
 */
const renderApp = (): void => {
  // Initialize error tracking
  initializeSentry();

  // Get or create root element
  const rootElement = document.getElementById(ROOT_ELEMENT_ID);
  if (!rootElement) {
    throw new Error(`Element with id '${ROOT_ELEMENT_ID}' not found`);
  }

  // Create React root with error handling
  try {
    const root = ReactDOM.createRoot(rootElement);

    // Render app with error boundary and strict mode
    root.render(
      <StrictMode>
        <ErrorBoundary
          fallback={({ error }) => (
            <div role="alert">
              <h2>Application Error</h2>
              <p>An error occurred while loading the application.</p>
              {ENVIRONMENT === 'development' && (
                <pre style={{ whiteSpace: 'pre-wrap' }}>
                  {error.toString()}
                </pre>
              )}
            </div>
          )}
          showDialog={ENVIRONMENT === 'production'}
          dialogOptions={{
            title: 'Application Error',
            subtitle: 'The application encountered an unexpected error.',
            subtitle2: 'Our team has been notified and is working on a fix.',
          }}
        >
          <App />
        </ErrorBoundary>
      </StrictMode>
    );

    // Report successful initialization
    if (ENVIRONMENT === 'development') {
      console.log('Application initialized successfully');
    }
  } catch (error) {
    // Handle critical initialization errors
    console.error('Failed to initialize application:', error);
    Sentry.captureException(error, {
      level: 'fatal',
      tags: {
        phase: 'initialization',
      },
    });

    // Display fallback UI for critical errors
    rootElement.innerHTML = `
      <div role="alert" style="padding: 20px; text-align: center;">
        <h2>Critical Error</h2>
        <p>Failed to initialize the application. Please try refreshing the page.</p>
      </div>
    `;
  }
};

// Initialize the application
renderApp();

// Enable hot module replacement in development
if (import.meta.hot) {
  import.meta.hot.accept();
}