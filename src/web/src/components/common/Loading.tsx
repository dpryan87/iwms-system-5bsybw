import React, { memo } from 'react'; // react version ^18.0.0
import { CircularProgress, Box } from '@mui/material'; // @mui/material version ^5.0.0
import { styled } from '@mui/material/styles'; // @mui/material version ^5.0.0
import { useTheme } from '../../styles/theme';

// Props interface with comprehensive customization options
interface LoadingProps {
  size?: number | 'small' | 'medium' | 'large';
  overlay?: boolean;
  message?: string;
  testId?: string;
}

// Styled component for the loading overlay with theme integration
const LoadingOverlay = styled(Box)(({ theme }) => ({
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.palette.mode === 'light' 
    ? 'rgba(255, 255, 255, 0.8)' 
    : 'rgba(0, 0, 0, 0.8)',
  zIndex: theme.zIndex.modal + 1,
  transition: theme.transitions.create(['opacity'], {
    duration: theme.transitions.duration.standard,
  }),
  backdropFilter: 'blur(2px)',
}));

// Styled component for the loading container with responsive spacing
const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  color: theme.palette.text.primary,
}));

/**
 * Helper function to convert size prop to pixel value
 * @param size - Size value to convert
 * @returns Numeric pixel value for the spinner
 */
const getSizeValue = (size: LoadingProps['size']): number => {
  if (typeof size === 'number') {
    if (size < 16 || size > 96) {
      throw new Error('Size must be between 16 and 96 pixels');
    }
    return size;
  }

  switch (size) {
    case 'small':
      return 24;
    case 'large':
      return 56;
    case 'medium':
    default:
      return 40;
  }
};

/**
 * Loading component that displays a Material-UI circular progress indicator
 * with optional overlay and customizable size.
 */
const Loading: React.FC<LoadingProps> = memo(({
  size = 'medium',
  overlay = false,
  message,
  testId = 'loading-indicator',
}) => {
  const theme = useTheme();
  const spinnerSize = getSizeValue(size);

  // Base loading content with accessibility support
  const loadingContent = (
    <LoadingContainer
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid={testId}
    >
      <CircularProgress
        size={spinnerSize}
        thickness={4}
        // Adjust color for high contrast mode
        color={theme.palette.mode === 'high-contrast' ? 'inherit' : 'primary'}
        sx={{
          // Ensure good contrast in all theme modes
          color: theme.palette.mode === 'high-contrast' 
            ? theme.palette.common.white 
            : undefined,
        }}
      />
      {message && (
        <Box
          component="span"
          sx={{
            typography: 'body2',
            textAlign: 'center',
            // Ensure text remains readable in all modes
            color: theme.palette.text.primary,
          }}
        >
          {message}
        </Box>
      )}
    </LoadingContainer>
  );

  // Render with or without overlay based on prop
  return overlay ? (
    <LoadingOverlay>{loadingContent}</LoadingOverlay>
  ) : (
    loadingContent
  );
});

// Display name for debugging
Loading.displayName = 'Loading';

export default Loading;