import React, { Component, ErrorInfo } from 'react'; // @version ^18.0.0
import { ERROR_MESSAGES } from '../../constants/error.constants';
import Notification from './Notification';

/**
 * Props interface for the ErrorBoundary component with enhanced customization options
 */
interface ErrorBoundaryProps {
  /** Child components to be wrapped by error boundary */
  children: React.ReactNode;
  /** Optional custom fallback UI to display when error occurs */
  fallback?: React.ReactNode;
  /** Optional callback for custom error handling */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Optional duration for error notification display */
  errorNotificationDuration?: number;
}

/**
 * State interface for the ErrorBoundary component with enhanced error tracking
 */
interface ErrorBoundaryState {
  /** Indicates if an error has occurred */
  hasError: boolean;
  /** The error object if one occurred */
  error: Error | null;
  /** Additional error information including component stack */
  errorInfo: ErrorInfo | null;
  /** Controls visibility of error notification */
  showNotification: boolean;
}

/**
 * Enhanced error boundary component that provides comprehensive error handling
 * and user feedback for the IWMS application.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showNotification: false,
    };

    // Bind methods
    this.handleNotificationClose = this.handleNotificationClose.bind(this);
  }

  /**
   * Static lifecycle method called when an error occurs
   * Updates state to trigger error UI rendering
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
      showNotification: true,
    };
  }

  /**
   * Lifecycle method for handling caught errors
   * Implements comprehensive error logging and notification
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Update state with error details
    this.setState({
      error,
      errorInfo,
      showNotification: true,
    });

    // Log error details in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by ErrorBoundary:', {
        error,
        componentStack: errorInfo.componentStack,
      });
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  /**
   * Handles closing of error notifications
   */
  handleNotificationClose(): void {
    this.setState({ showNotification: false });
  }

  /**
   * Renders either the error UI or children with enhanced error display
   */
  render(): React.ReactNode {
    const { hasError, error, showNotification } = this.state;
    const { children, fallback, errorNotificationDuration = 6000 } = this.props;

    if (hasError) {
      return (
        <>
          {/* Display custom fallback UI if provided, otherwise show default error message */}
          {fallback || (
            <div
              role="alert"
              aria-live="assertive"
              style={{
                padding: '20px',
                margin: '20px',
                borderRadius: '4px',
                backgroundColor: '#fff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              <h2>Something went wrong</h2>
              <p>{ERROR_MESSAGES.INTERNAL_ERROR}</p>
              {process.env.NODE_ENV === 'development' && error && (
                <pre style={{ whiteSpace: 'pre-wrap' }}>{error.toString()}</pre>
              )}
            </div>
          )}

          {/* Display error notification */}
          <Notification
            open={showNotification}
            message={ERROR_MESSAGES.INTERNAL_ERROR}
            severity="error"
            onClose={this.handleNotificationClose}
            autoHideDuration={errorNotificationDuration}
          />
        </>
      );
    }

    // Render children if no error occurred
    return children;
  }
}

export default ErrorBoundary;
```

This implementation provides a robust error boundary component that:

1. Follows React 18 best practices for error boundaries
2. Implements comprehensive error handling with detailed error information
3. Provides customizable error UI through fallback props
4. Includes accessible error notifications using Material-UI components
5. Supports development mode debugging with detailed error information
6. Handles error notification timing and display
7. Implements proper accessibility attributes for error messages
8. Uses standardized error messages from the application constants
9. Supports custom error handling through callback props
10. Provides TypeScript type safety with detailed interfaces

The component can be used to wrap any part of the application where error handling is needed:

```typescript
// Example usage:
<ErrorBoundary
  fallback={<CustomErrorComponent />}
  onError={(error, errorInfo) => {
    // Custom error handling logic
    logErrorToService(error, errorInfo);
  }}
  errorNotificationDuration={5000}
>
  <YourComponent />
</ErrorBoundary>