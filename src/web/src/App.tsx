import React, { useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'; // @version ^6.0.0
import { CssBaseline } from '@mui/material'; // @version ^5.0.0
import { ErrorBoundary } from 'react-error-boundary'; // @version ^4.0.0

// Internal imports
import MainLayout from './layouts/MainLayout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ROUTES } from './constants/routes.constants';
import { ERROR_MESSAGES } from './constants/error.constants';
import Notification from './components/common/Notification';

// Security monitoring decorator
const withSecurityMonitoring = (WrappedComponent: React.ComponentType) => {
  return function WithSecurityMonitoring(props: any) {
    const { validateSecurityContext } = useAuth();

    useEffect(() => {
      const monitorSecurity = async () => {
        try {
          const validationResult = await validateSecurityContext();
          if (!validationResult.isValid) {
            console.error('Security validation failed:', validationResult.reason);
          }
        } catch (error) {
          console.error('Security monitoring error:', error);
        }
      };

      const securityInterval = setInterval(monitorSecurity, 60000); // Check every minute
      return () => clearInterval(securityInterval);
    }, [validateSecurityContext]);

    return <WrappedComponent {...props} />;
  };
};

// Error fallback component with enhanced error display
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => {
  return (
    <Notification
      open={true}
      message={ERROR_MESSAGES.INTERNAL_ERROR}
      severity="error"
      onClose={() => window.location.reload()}
    />
  );
};

// Protected route wrapper with role validation
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  requiredRoles?: string[];
}> = ({ children, requiredRoles = [] }) => {
  const { state } = useAuth();

  if (!state.isAuthenticated) {
    return <Navigate to={ROUTES.AUTH.LOGIN.path} replace />;
  }

  if (
    requiredRoles.length > 0 &&
    !requiredRoles.some(role => state.user?.permissions.includes(role))
  ) {
    return <Navigate to={ROUTES.DASHBOARD.path} replace />;
  }

  return <>{children}</>;
};

// Main application component
const App: React.FC = () => {
  // Error handling callback
  const handleError = useCallback((error: Error) => {
    console.error('Application error:', error);
    // In production, this would send to error monitoring service
  }, []);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleError}
      onReset={() => window.location.reload()}
    >
      <BrowserRouter>
        <ThemeProvider>
          <CssBaseline />
          <AuthProvider>
            <Routes>
              {/* Authentication routes */}
              <Route path={ROUTES.AUTH.path}>
                <Route path={ROUTES.AUTH.LOGIN.path} element={/* Login component */} />
                <Route path={ROUTES.AUTH.LOGOUT.path} element={/* Logout component */} />
                <Route
                  path={ROUTES.AUTH.FORGOT_PASSWORD.path}
                  element={/* ForgotPassword component */}
                />
                <Route
                  path={ROUTES.AUTH.RESET_PASSWORD.path}
                  element={/* ResetPassword component */}
                />
              </Route>

              {/* Protected application routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      {/* Dashboard routes */}
                      <Routes>
                        <Route
                          path={ROUTES.DASHBOARD.path}
                          element={/* Dashboard component */}
                        />
                        <Route
                          path={ROUTES.FLOOR_PLANS.path}
                          element={/* FloorPlans component */}
                        />
                        <Route
                          path={ROUTES.LEASES.path}
                          element={
                            <ProtectedRoute requiredRoles={['admin']}>
                              {/* Leases component */}
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path={ROUTES.OCCUPANCY.path}
                          element={/* Occupancy component */}
                        />
                        <Route
                          path={ROUTES.RESOURCES.path}
                          element={/* Resources component */}
                        />
                        <Route
                          path={ROUTES.SETTINGS.path}
                          element={
                            <ProtectedRoute requiredRoles={['admin']}>
                              {/* Settings component */}
                            </ProtectedRoute>
                          }
                        />
                        {/* Default redirect */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

// Export enhanced App component with security monitoring
export default withSecurityMonitoring(App);