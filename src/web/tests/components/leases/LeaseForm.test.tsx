import React from 'react'; // ^18.0.0
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'; // ^14.0.0
import userEvent from '@testing-library/user-event'; // ^14.0.0
import { vi } from 'vitest'; // ^0.34.0

// Internal imports
import LeaseForm from '../../src/components/leases/LeaseForm';
import { ILease, LeaseStatus, EscalationType } from '../../src/types/lease.types';
import LeaseService from '../../src/services/lease.service';

// Mock the lease service
vi.mock('../../src/services/lease.service', () => ({
  default: {
    createNewLease: vi.fn(),
    validateFinancials: vi.fn(),
    uploadDocument: vi.fn()
  }
}));

// Test data
const mockPropertyOptions = [
  { id: 'prop-1', name: 'Building A' },
  { id: 'prop-2', name: 'Building B' }
];

const mockTenantOptions = [
  { id: 'tenant-1', name: 'Acme Corp' },
  { id: 'tenant-2', name: 'TechCo' }
];

const mockLeaseData: Partial<ILease> = {
  propertyId: 'prop-1',
  tenantId: 'tenant-1',
  status: LeaseStatus.DRAFT,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  monthlyRent: 5000,
  financials: {
    baseRent: 5000,
    operatingCosts: 1000,
    utilities: 500,
    propertyTax: 800,
    insurance: 300,
    paymentSchedule: [],
    escalationSchedule: [],
    lastPaymentDate: new Date(),
    outstandingBalance: 0
  },
  terms: {
    securityDeposit: 10000,
    noticePeriod: 60,
    renewalOptions: {
      available: true,
      terms: 12
    },
    specialClauses: [],
    restrictions: [],
    maintenanceResponsibilities: {
      landlord: [],
      tenant: []
    }
  }
};

describe('LeaseForm Component', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all required form fields with proper accessibility attributes', () => {
    render(
      <LeaseForm
        propertyOptions={mockPropertyOptions}
        tenantOptions={mockTenantOptions}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Check for required form fields with proper labeling
    const propertySelect = screen.getByLabelText(/Property/i);
    expect(propertySelect).toHaveAttribute('aria-required', 'true');

    const tenantSelect = screen.getByLabelText(/Tenant/i);
    expect(tenantSelect).toHaveAttribute('aria-required', 'true');

    const startDateInput = screen.getByLabelText(/Start Date/i);
    expect(startDateInput).toHaveAttribute('type', 'date');

    const monthlyRentInput = screen.getByLabelText(/Monthly Rent/i);
    expect(monthlyRentInput).toHaveAttribute('type', 'number');
  });

  it('validates financial terms correctly', async () => {
    // Mock the financial validation
    (LeaseService.validateFinancials as jest.Mock).mockResolvedValue(true);

    render(
      <LeaseForm
        propertyOptions={mockPropertyOptions}
        tenantOptions={mockTenantOptions}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        initialData={mockLeaseData}
      />
    );

    // Input invalid financial data
    const monthlyRentInput = screen.getByLabelText(/Monthly Rent/i);
    await userEvent.clear(monthlyRentInput);
    await userEvent.type(monthlyRentInput, '-1000');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /Create Lease/i });
    await userEvent.click(submitButton);

    // Verify validation error message
    expect(await screen.findByText(/Monthly rent must be positive/i)).toBeInTheDocument();
  });

  it('handles document upload correctly', async () => {
    // Mock document upload
    (LeaseService.uploadDocument as jest.Mock).mockResolvedValue({
      id: 'doc-1',
      name: 'lease-agreement.pdf',
      type: 'application/pdf',
      url: 'https://example.com/doc-1'
    });

    render(
      <LeaseForm
        propertyOptions={mockPropertyOptions}
        tenantOptions={mockTenantOptions}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Create a mock file
    const file = new File(['test'], 'lease-agreement.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByLabelText(/Upload Document/i);

    // Upload file
    await userEvent.upload(fileInput, file);

    // Verify upload success message
    expect(await screen.findByText(/Document uploaded successfully/i)).toBeInTheDocument();
  });

  it('meets WCAG 2.1 Level AA accessibility requirements', async () => {
    const { container } = render(
      <LeaseForm
        propertyOptions={mockPropertyOptions}
        tenantOptions={mockTenantOptions}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Check for proper heading structure
    const headings = screen.getAllByRole('heading');
    expect(headings.length).toBeGreaterThan(0);

    // Verify form landmarks
    expect(container.querySelector('[role="form"]')).toBeInTheDocument();

    // Check for proper input labels and descriptions
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach(input => {
      expect(input).toHaveAccessibleName();
      expect(input).toHaveAccessibleDescription();
    });

    // Verify error announcements
    const monthlyRentInput = screen.getByLabelText(/Monthly Rent/i);
    await userEvent.clear(monthlyRentInput);
    await userEvent.tab();

    const errorMessage = await screen.findByRole('alert');
    expect(errorMessage).toBeInTheDocument();
  });

  it('handles lease submission with proper validation', async () => {
    (LeaseService.createNewLease as jest.Mock).mockResolvedValue({
      ...mockLeaseData,
      id: 'lease-1'
    });

    render(
      <LeaseForm
        propertyOptions={mockPropertyOptions}
        tenantOptions={mockTenantOptions}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Fill in required fields
    await userEvent.selectOptions(screen.getByLabelText(/Property/i), 'prop-1');
    await userEvent.selectOptions(screen.getByLabelText(/Tenant/i), 'tenant-1');
    await userEvent.type(screen.getByLabelText(/Monthly Rent/i), '5000');

    // Set dates
    const startDateInput = screen.getByLabelText(/Start Date/i);
    const endDateInput = screen.getByLabelText(/End Date/i);
    await userEvent.type(startDateInput, '2024-01-01');
    await userEvent.type(endDateInput, '2024-12-31');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /Create Lease/i });
    await userEvent.click(submitButton);

    // Verify submission
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
        propertyId: 'prop-1',
        tenantId: 'tenant-1',
        monthlyRent: 5000
      }));
    });
  });

  it('handles escalation calculations correctly', async () => {
    render(
      <LeaseForm
        propertyOptions={mockPropertyOptions}
        tenantOptions={mockTenantOptions}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        initialData={{
          ...mockLeaseData,
          terms: {
            ...mockLeaseData.terms!,
            escalationType: EscalationType.FIXED,
            escalationRate: 3
          }
        }}
      />
    );

    // Verify escalation calculations
    const escalationTypeSelect = screen.getByLabelText(/Escalation Type/i);
    const escalationRateInput = screen.getByLabelText(/Escalation Rate/i);

    await userEvent.selectOptions(escalationTypeSelect, EscalationType.FIXED);
    await userEvent.type(escalationRateInput, '3');

    // Verify calculated values
    const monthlyRentInput = screen.getByLabelText(/Monthly Rent/i);
    expect(monthlyRentInput).toHaveValue(5000);

    // Calculate and verify first year escalation
    const firstYearEscalation = 5000 * 1.03;
    expect(screen.getByText(new RegExp(firstYearEscalation.toFixed(2)))).toBeInTheDocument();
  });
});