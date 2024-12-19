import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'; // ^14.0.0
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'; // ^29.0.0
import { ThemeProvider } from '@mui/material/styles'; // ^5.0.0
import userEvent from '@testing-library/user-event'; // ^14.0.0
import Button from '../../src/components/common/Button';
import createAppTheme from '../../src/styles/theme';

// Helper function to render components with theme
const renderWithTheme = (component: React.ReactElement, options = {}) => {
  const theme = createAppTheme('light');
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>,
    options
  );
};

describe('Button Component', () => {
  // Mock handlers
  const mockClick = jest.fn();
  const mockFocus = jest.fn();

  beforeEach(() => {
    mockClick.mockClear();
    mockFocus.mockClear();
  });

  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      renderWithTheme(<Button>Click Me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('type', 'button');
    });

    it('applies custom className and style', () => {
      renderWithTheme(
        <Button className="custom-class" style={{ margin: '10px' }}>
          Styled Button
        </Button>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
      expect(button).toHaveStyle({ margin: '10px' });
    });

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLButtonElement>();
      renderWithTheme(<Button ref={ref}>Ref Button</Button>);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
  });

  describe('Variants and Sizes', () => {
    it('renders all variants correctly', () => {
      const { rerender } = renderWithTheme(<Button variant="contained">Contained</Button>);
      expect(screen.getByRole('button')).toHaveClass('MuiButton-contained');

      rerender(<Button variant="outlined">Outlined</Button>);
      expect(screen.getByRole('button')).toHaveClass('MuiButton-outlined');

      rerender(<Button variant="text">Text</Button>);
      expect(screen.getByRole('button')).toHaveClass('MuiButton-text');

      rerender(<Button variant="gradient">Gradient</Button>);
      const gradientButton = screen.getByRole('button');
      expect(gradientButton).toHaveStyle({
        background: expect.stringContaining('linear-gradient')
      });
    });

    it('renders all sizes correctly', () => {
      const { rerender } = renderWithTheme(<Button size="small">Small</Button>);
      expect(screen.getByRole('button')).toHaveClass('MuiButton-sizeSmall');

      rerender(<Button size="medium">Medium</Button>);
      expect(screen.getByRole('button')).toHaveClass('MuiButton-sizeMedium');

      rerender(<Button size="large">Large</Button>);
      expect(screen.getByRole('button')).toHaveClass('MuiButton-sizeLarge');
    });
  });

  describe('Interaction Handling', () => {
    it('handles click events', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Button onClick={mockClick}>Click Me</Button>);
      
      await user.click(screen.getByRole('button'));
      expect(mockClick).toHaveBeenCalledTimes(1);
    });

    it('handles keyboard interaction', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Button onClick={mockClick}>Press Enter</Button>);
      
      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Enter}');
      expect(mockClick).toHaveBeenCalledTimes(1);
    });

    it('prevents interaction when disabled', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Button disabled onClick={mockClick}>Disabled</Button>);
      
      await user.click(screen.getByRole('button'));
      expect(mockClick).not.toHaveBeenCalled();
    });
  });

  describe('Loading States', () => {
    it('displays loading indicator correctly', () => {
      renderWithTheme(<Button loading>Loading</Button>);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('Loading')).toHaveStyle({ visibility: 'hidden' });
    });

    it('handles different loading positions', () => {
      const { rerender } = renderWithTheme(
        <Button loading loadingPosition="start">Start</Button>
      );
      expect(screen.getByRole('progressbar')).toHaveStyle({ left: '10%' });

      rerender(<Button loading loadingPosition="end">End</Button>);
      expect(screen.getByRole('progressbar')).toHaveStyle({ right: '10%' });

      rerender(<Button loading loadingPosition="center">Center</Button>);
      expect(screen.getByRole('progressbar')).toHaveStyle({ left: '50%' });
    });
  });

  describe('Accessibility Features', () => {
    it('supports ARIA attributes', () => {
      renderWithTheme(
        <Button
          ariaLabel="Accessible Button"
          disabled
          loading
        >
          Access Me
        </Button>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Accessible Button');
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('maintains focus visibility', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Button>Focus Me</Button>);
      
      const button = screen.getByRole('button');
      await user.tab();
      expect(button).toHaveFocus();
      expect(button).toHaveClass('Mui-focusVisible');
    });

    it('provides tooltip support', () => {
      renderWithTheme(
        <Button tooltipText="Helpful tooltip">
          Hover Me
        </Button>
      );
      expect(screen.getByRole('button')).toHaveAttribute('title', 'Helpful tooltip');
    });
  });

  describe('Theme Integration', () => {
    it('applies theme colors correctly', () => {
      const { rerender } = renderWithTheme(
        <Button color="primary">Primary</Button>
      );
      expect(screen.getByRole('button')).toHaveClass('MuiButton-colorPrimary');

      rerender(<Button color="secondary">Secondary</Button>);
      expect(screen.getByRole('button')).toHaveClass('MuiButton-colorSecondary');
    });

    it('supports high contrast mode', () => {
      const theme = createAppTheme('high-contrast');
      render(
        <ThemeProvider theme={theme}>
          <Button>High Contrast</Button>
        </ThemeProvider>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({ border: '2px solid currentColor' });
    });

    it('supports RTL layout', () => {
      const theme = createAppTheme('light');
      theme.direction = 'rtl';
      render(
        <ThemeProvider theme={theme}>
          <Button startIcon={<span>→</span>}>RTL Button</Button>
        </ThemeProvider>
      );
      const startIcon = screen.getByText('→').parentElement;
      expect(startIcon).toHaveStyle({ marginLeft: '8px', marginRight: '0px' });
    });
  });
});