# Lightweight IWMS Backend Service

![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Test Coverage](https://img.shields.io/badge/coverage-%3E90%25-brightgreen)
![Docker Build](https://img.shields.io/badge/docker-ready-blue)
![API Documentation](https://img.shields.io/badge/api-documented-blue)
![License](https://img.shields.io/badge/license-MIT-blue)

Enterprise-grade backend service for the Lightweight Integrated Workplace Management System (IWMS), providing robust APIs for space management, lease administration, and occupancy tracking.

## Overview

The IWMS backend service is built on a microservices architecture using Node.js 18 LTS, providing scalable and maintainable APIs for workplace and facility management operations. The service implements enterprise-ready features including real-time occupancy monitoring, document management, and advanced analytics.

### Key Features

- Interactive floor plan management API
- Lease document repository and tracking
- Real-time occupancy monitoring
- Role-based access control
- Advanced analytics and reporting
- Multi-tenant architecture
- Enterprise integration capabilities

## Prerequisites

- Node.js 18.x LTS
- npm 8.x or newer
- Docker 24.x
- PostgreSQL 14.x
- Redis 7.x
- Git 2.40+

## Getting Started

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd src/backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure environment variables
nano .env

# Initialize database
npm run db:migrate

# Start development server
npm run dev
```

### Environment Configuration

Required environment variables (see `.env.example` for complete list):

| Variable | Description | Example |
|----------|-------------|---------|
| NODE_ENV | Environment mode | development |
| PORT | API server port | 3000 |
| DB_HOST | PostgreSQL host | localhost |
| DB_PORT | PostgreSQL port | 5432 |
| REDIS_URL | Redis connection URL | redis://localhost:6379 |
| JWT_SECRET | JWT signing secret | <secure-random-string> |
| AWS_S3_BUCKET | Document storage bucket | iwms-documents |

## Project Structure

```
src/backend/
├── src/
│   ├── api/           # API route handlers
│   ├── config/        # Configuration files
│   ├── services/      # Business logic services
│   ├── models/        # Database models
│   ├── middleware/    # Express middleware
│   ├── utils/         # Utility functions
│   └── types/         # TypeScript type definitions
├── tests/             # Test suites
├── docs/              # API documentation
├── scripts/           # Utility scripts
└── docker/           # Docker configurations
```

## Development

### Code Style

- TypeScript strict mode enabled
- ESLint configuration with Airbnb style guide
- Prettier for code formatting
- Husky for pre-commit hooks

### Available Scripts

```bash
# Development
npm run dev           # Start development server
npm run lint         # Run linter
npm run format       # Format code
npm run type-check   # Run TypeScript compiler

# Testing
npm run test         # Run all tests
npm run test:unit    # Run unit tests
npm run test:int     # Run integration tests
npm run test:cov     # Generate coverage report

# Building
npm run build        # Build production bundle
npm run start        # Start production server

# Database
npm run db:migrate   # Run migrations
npm run db:rollback  # Rollback migration
npm run db:seed      # Seed database
```

## API Documentation

### Core Endpoints

| Endpoint | Method | Description | Authentication |
|----------|--------|-------------|----------------|
| /api/v1/floor-plans | GET, POST | Floor plan management | Required |
| /api/v1/spaces | GET, POST, PUT | Space allocation | Required |
| /api/v1/leases | GET, POST, PUT | Lease management | Required |
| /api/v1/occupancy | GET | Real-time occupancy | Required |
| /api/v1/analytics | GET | Usage analytics | Required |

Complete API documentation available at `/docs/api` when running in development mode.

## Database

### Migration Strategy

- Versioned migrations using TypeORM
- Forward-only migrations
- Automated backup before migrations
- Rollback support for failed migrations

### Performance Optimization

- Indexed queries for common operations
- Query optimization for large datasets
- Connection pooling
- Read replicas for scaling

## Testing

### Testing Strategy

- Unit tests for business logic
- Integration tests for API endpoints
- End-to-end tests for critical flows
- Performance tests for scalability
- Security tests for vulnerabilities

### Coverage Requirements

- Minimum 90% code coverage
- 100% coverage for critical paths
- Integration test coverage for all APIs
- Performance benchmark tests

## Deployment

### Docker Deployment

```bash
# Build Docker image
docker build -t iwms-backend .

# Run container
docker-compose up -d

# Scale services
docker-compose up -d --scale api=3
```

### Production Deployment

- Blue-green deployment strategy
- Automated rollback capability
- Health check monitoring
- Zero-downtime updates

## Security

### Security Checklist

- [x] OAuth 2.0 + JWT authentication
- [x] Rate limiting implementation
- [x] Input validation and sanitization
- [x] SQL injection prevention
- [x] XSS protection
- [x] CSRF protection
- [x] Security headers configuration
- [x] Data encryption at rest
- [x] Audit logging

## Monitoring

### Metrics Collection

- Application metrics via Prometheus
- Custom business metrics
- Performance monitoring
- Error tracking and alerting

### Logging

- Structured JSON logging
- Log level configuration
- Centralized log aggregation
- Audit trail logging

## Troubleshooting

Common issues and solutions available in the [Troubleshooting Guide](docs/troubleshooting.md).

### Debug Mode

```bash
# Enable debug logging
DEBUG=iwms:* npm run dev

# Debug specific module
DEBUG=iwms:api npm run dev
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

### Pull Request Process

1. Branch naming: feature/*, bugfix/*, hotfix/*
2. Commit message format: conventional commits
3. Required reviews: 2
4. CI checks must pass
5. Documentation updates required

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and upgrade guides.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.