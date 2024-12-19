// External imports
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

// Internal imports
import LoginForm from '../../../src/components/auth/LoginForm';
import { AuthContext } from '../../../src/contexts/AuthContext';
import { AuthErrorType, LoginCredentials } from '../../../src/types/auth.types';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock device fingerprint generation
const mockDeviceFingerprint = 'mock-device-fingerprint-123';
jest.mock('../../../src/utils/auth.utils', () => ({
  generateDeviceFingerprint: jest.fn().mockResolvedValue(mockDeviceFingerprint),
}));

// Test data
const validCredentials: LoginCredentials = {
  email: 'test@example.com',
  password: 'SecurePass123!',
  mfaCode: '123456',
  deviceId: mockDeviceFingerprint,
};

const invalidCredentials: LoginCredentials = {
  email: 'invalid@test',
  password: 'weak',
  mfaCode: '12345', // Invalid length
  deviceId: '',
};

// Mock auth context
const mockAuthContext = {
  login: jest.fn(),
  verifyMfa: jest.fn(),
  state: {
    loading: false,
    error: null,
  },
};

// Helper function to render with providers
const renderWithProviders = (ui: React.ReactElement, contextValue = mockAuthContext) => {
  return render(
    <AuthContext.Provider value={contextValue}>
      {ui}
    </AuthContext.Provider>
  );
};

describe('LoginForm Component', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering and Accessibility', () => {
    it('renders login form with all required fields', () => {
      renderWithProviders(
        <LoginForm 
          onSuccess={jest.fn()} 
          onError={jest.fn()} 
          onMFARequired={jest.fn()} 
        />
      );

      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('meets WCAG 2.1 accessibility standards', async () => {
      const { container } = renderWithProviders(
        <LoginForm 
          onSuccess={jest.fn()} 
          onError={jest.fn()} 
          onMFARequired={jest.fn()} 
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', () => {
      renderWithProviders(
        <LoginForm 
          onSuccess={jest.fn()} 
          onError={jest.fn()} 
          onMFARequired={jest.fn()} 
        />
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      emailInput.focus();
      expect(document.activeElement).toBe(emailInput);

      userEvent.tab();
      expect(document.activeElement).toBe(passwordInput);

      userEvent.tab();
      expect(document.activeElement).toBe(submitButton);
    });
  });

  describe('Form Validation', () => {
    it('validates email format', async () => {
      renderWithProviders(
        <LoginForm 
          onSuccess={jest.fn()} 
          onError={jest.fn()} 
          onMFARequired={jest.fn()} 
        />
      );

      const emailInput = screen.getByLabelText(/email/i);
      await userEvent.type(emailInput, invalidCredentials.email);
      fireEvent.blur(emailInput);

      expect(await screen.findByText(/please enter a valid email address/i))
        .toBeInTheDocument();
    });

    it('validates password requirements', async () => {
      renderWithProviders(
        <LoginForm 
          onSuccess={jest.fn()} 
          onError={jest.fn()} 
          onMFARequired={jest.fn()} 
        />
      );

      const passwordInput = screen.getByLabelText(/password/i);
      await userEvent.type(passwordInput, invalidCredentials.password);
      fireEvent.blur(passwordInput);

      expect(await screen.findByText(/password must be at least 8 characters/i))
        .toBeInTheDocument();
    });

    it('validates MFA code when required', async () => {
      renderWithProviders(
        <LoginForm 
          onSuccess={jest.fn()} 
          onError={jest.fn()} 
          onMFARequired={jest.fn()} 
        />,
        {
          ...mockAuthContext,
          state: { ...mockAuthContext.state, requiresMfa: true }
        }
      );

      const mfaInput = await screen.findByLabelText(/mfa code/i);
      await userEvent.type(mfaInput, '12345'); // Invalid length
      fireEvent.blur(mfaInput);

      expect(await screen.findByText(/mfa code must be 6 digits/i))
        .toBeInTheDocument();
    });
  });

  describe('Authentication Flow', () => {
    it('handles successful login without MFA', async () => {
      const onSuccess = jest.fn();
      mockAuthContext.login.mockResolvedValueOnce({ requiresMfa: false });

      renderWithProviders(
        <LoginForm 
          onSuccess={onSuccess} 
          onError={jest.fn()} 
          onMFARequired={jest.fn()} 
        />
      );

      await userEvent.type(screen.getByLabelText(/email/i), validCredentials.email);
      await userEvent.type(screen.getByLabelText(/password/i), validCredentials.password);
      
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockAuthContext.login).toHaveBeenCalledWith(expect.objectContaining({
          email: validCredentials.email,
          password: validCredentials.password,
        }));
      });

      expect(onSuccess).toHaveBeenCalled();
    });

    it('handles MFA flow correctly', async () => {
      const onMFARequired = jest.fn();
      mockAuthContext.login.mockResolvedValueOnce({ 
        requiresMfa: true,
        sessionToken: 'mfa-session-token'
      });

      renderWithProviders(
        <LoginForm 
          onSuccess={jest.fn()} 
          onError={jest.fn()} 
          onMFARequired={onMFARequired} 
        />
      );

      await userEvent.type(screen.getByLabelText(/email/i), validCredentials.email);
      await userEvent.type(screen.getByLabelText(/password/i), validCredentials.password);
      
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(onMFARequired).toHaveBeenCalledWith('mfa-session-token');
        expect(screen.getByLabelText(/mfa code/i)).toBeInTheDocument();
      });
    });

    it('implements rate limiting for failed attempts', async () => {
      const onError = jest.fn();
      mockAuthContext.login.mockRejectedValue(new Error('Invalid credentials'));

      renderWithProviders(
        <LoginForm 
          onSuccess={jest.fn()} 
          onError={onError} 
          onMFARequired={jest.fn()} 
        />
      );

      // Attempt multiple failed logins
      for (let i = 0; i < 4; i++) {
        await userEvent.type(screen.getByLabelText(/email/i), invalidCredentials.email);
        await userEvent.type(screen.getByLabelText(/password/i), invalidCredentials.password);
        
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

        await waitFor(() => {
          expect(onError).toHaveBeenCalled();
        });

        // Clear inputs
        userEvent.clear(screen.getByLabelText(/email/i));
        userEvent.clear(screen.getByLabelText(/password/i));
      }

      // Verify account lockout
      expect(await screen.findByText(/account temporarily locked/i))
        .toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
    });
  });

  describe('Security Features', () => {
    it('masks password input by default', () => {
      renderWithProviders(
        <LoginForm 
          onSuccess={jest.fn()} 
          onError={jest.fn()} 
          onMFARequired={jest.fn()} 
        />
      );

      const passwordInput = screen.getByLabelText(/password/i);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('includes device fingerprint in login request', async () => {
      renderWithProviders(
        <LoginForm 
          onSuccess={jest.fn()} 
          onError={jest.fn()} 
          onMFARequired={jest.fn()} 
        />
      );

      await userEvent.type(screen.getByLabelText(/email/i), validCredentials.email);
      await userEvent.type(screen.getByLabelText(/password/i), validCredentials.password);
      
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockAuthContext.login).toHaveBeenCalledWith(
          expect.objectContaining({
            deviceId: mockDeviceFingerprint,
          })
        );
      });
    });

    it('clears sensitive form data after submission', async () => {
      renderWithProviders(
        <LoginForm 
          onSuccess={jest.fn()} 
          onError={jest.fn()} 
          onMFARequired={jest.fn()} 
        />
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await userEvent.type(emailInput, validCredentials.email);
      await userEvent.type(passwordInput, validCredentials.password);
      
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(passwordInput).toHaveValue('');
      });
    });
  });
});