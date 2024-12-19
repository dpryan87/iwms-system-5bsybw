# Lightweight IWMS Web Frontend

## Overview

The Lightweight IWMS (Integrated Workplace Management System) web frontend is a modern, enterprise-grade application designed to streamline workplace and facility management operations. Built with React 18+ and TypeScript, it provides an intuitive interface for space management, lease administration, and occupancy tracking.

### Core Features
- Interactive floor plan management with 2D/3D visualization
- Digital lease document repository and tracking
- Real-time occupancy monitoring and analytics
- Role-based access control and user management
- Responsive design optimized for desktop and mobile devices

### Technology Stack
- **Framework**: React 18+ with TypeScript
- **UI Components**: Material-UI 5.0+
- **State Management**: Redux Toolkit 1.9+
- **Data Visualization**: D3.js 7.0+
- **Build Tool**: Vite
- **Testing**: Jest + React Testing Library

### Architecture Overview
The application follows a component-based architecture with:
- Strict type safety using TypeScript
- Centralized state management with Redux
- Modular component structure
- Real-time data handling via WebSocket
- Responsive design using Material-UI's Grid system

## Prerequisites

### Required Software
- Node.js 18+ LTS
- npm 8+ or yarn 1.22+
- Git 2.40+

### Recommended IDE Extensions
- ESLint
- Prettier
- TypeScript
- Jest
- EditorConfig

## Getting Started

### Repository Setup
```bash
# Clone the repository
git clone <repository-url>
cd src/web

# Install dependencies
npm install
```

### Environment Configuration
1. Copy `.env.example` to `.env.local`
2. Configure the following variables:
```
VITE_API_BASE_URL=<api-endpoint>
VITE_WS_URL=<websocket-endpoint>
VITE_AUTH_DOMAIN=<auth0-domain>
```

### Development Server
```bash
# Start development server
npm run dev

# Server will start at http://localhost:3000
```

### Initial Build
```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

## Development

### Code Style and Standards
- Follow TypeScript strict mode guidelines
- Use functional components with hooks
- Implement proper error boundaries
- Follow Material-UI theming system
- Use CSS-in-JS with styled-components

### Component Development
```typescript
// Component template
import React from 'react';
import { styled } from '@mui/material/styles';

interface ComponentProps {
  // Define prop types
}

export const Component: React.FC<ComponentProps> = (props) => {
  // Implementation
};
```

### State Management
- Use Redux Toolkit for global state
- Implement React Query for API cache
- Use local state for component-specific data
- Follow flux architecture patterns

### Testing Strategy
```bash
# Run unit tests
npm run test

# Run e2e tests
npm run test:e2e

# Generate coverage report
npm run test:coverage
```

### Performance Optimization
- Implement code splitting
- Use React.lazy for route-based splitting
- Optimize bundle size
- Implement proper memoization
- Use service workers for caching

### Security Guidelines
- Implement proper CSRF protection
- Use secure HTTP headers
- Sanitize user inputs
- Follow OWASP security guidelines
- Implement proper authentication flows

## Building and Deployment

### Environment Configuration
- Production-specific environment variables
- API endpoint configuration
- Feature flags management
- Error tracking setup

### Build Optimization
```bash
# Production build with optimization
npm run build

# Analyze bundle size
npm run analyze
```

### Deployment Process
1. Create production build
2. Run security checks
3. Deploy to staging
4. Run integration tests
5. Deploy to production
6. Verify deployment

### Monitoring and Verification
- Monitor application performance
- Track error rates
- Monitor user engagement
- Verify feature functionality
- Check browser compatibility

## Browser Support

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome | Last 2 versions | Full support |
| Firefox | Last 2 versions | Full support |
| Safari | Last 2 versions | Limited 3D support |
| Edge | Last 2 versions | Full support |
| Mobile Chrome | 90+ | Touch optimized |
| Mobile Safari | 14+ | iOS gestures |

## Contributing

### Development Workflow
1. Create feature branch
2. Implement changes
3. Write tests
4. Create pull request
5. Code review
6. Merge to main

### Code Review Guidelines
- Verify TypeScript types
- Check test coverage
- Review performance impact
- Validate accessibility
- Ensure documentation

## License

Copyright © 2023 Lightweight IWMS. All rights reserved.

## Support

For technical support or questions, please contact:
- Technical Support: [support@example.com](mailto:support@example.com)
- Documentation: [docs.example.com](https://docs.example.com)