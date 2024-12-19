# Lightweight Integrated Workplace Management System (IWMS)

A modern, scalable web-based platform designed to streamline workplace and facility management operations for corporate real estate teams, facility managers, and business unit administrators.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![NPM Version](https://img.shields.io/badge/npm-%3E%3D9.0.0-brightgreen.svg)](https://www.npmjs.com/)
[![Code Style](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://prettier.io/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Overview

The Lightweight IWMS platform provides essential workplace management capabilities with a focus on:

- Interactive floor plan management
- Digital lease administration
- Real-time occupancy monitoring
- Role-based access control
- Analytics and reporting dashboards

### Key Features

- **Floor Plan Management**
  - Interactive 2D/3D visualization
  - Resource allocation capabilities
  - Space utilization tracking

- **Lease Administration**
  - Digital document management
  - Automated tracking and notifications
  - Financial integration

- **Occupancy Analytics**
  - Real-time space utilization monitoring
  - Trend analysis
  - Occupancy forecasting

- **System Administration**
  - Role-based access control
  - Configuration management
  - Audit logging

## System Architecture

The system follows a microservices-based architecture designed for scalability and maintainability:

- **Frontend**: React 18 with TypeScript and Material-UI
- **Backend**: Node.js microservices with Express
- **API Gateway**: Kong for request routing and security
- **Databases**: 
  - PostgreSQL 14+ for primary data
  - Redis 7.0+ for caching
  - InfluxDB 2.6+ for time-series data
- **Storage**: S3-compatible object storage
- **Monitoring**: Prometheus, Grafana, ELK Stack, Jaeger

## Getting Started

### Prerequisites

- Node.js 18 LTS
- npm 9+
- Docker & Docker Compose
- Git
- AWS CLI
- Terraform

### Environment Setup

1. Clone the repository:
```bash
git clone https://github.com/your-org/lightweight-iwms.git
cd lightweight-iwms
```

2. Set up environment variables:
```bash
cp .env.example .env
```

Required environment variables:
- DATABASE_URL
- REDIS_URL
- S3_BUCKET
- JWT_SECRET
- API_URL
- INFLUXDB_URL
- MONITORING_KEY
- AWS_CREDENTIALS

3. Install dependencies:

Backend:
```bash
cd src/backend
npm install
```

Frontend:
```bash
cd src/web
npm install
```

### Development

Start the development servers:

Backend:
```bash
npm run dev
```

Frontend:
```bash
npm run dev
```

### Testing

Run the test suites:

```bash
# Backend tests
cd src/backend
npm run test

# Frontend tests
cd src/web
npm run test
```

### Building for Production

```bash
# Backend build
cd src/backend
npm run build

# Frontend build
cd src/web
npm run build
```

## Deployment

The system supports deployment to cloud environments using containerization:

1. Build Docker images:
```bash
docker-compose build
```

2. Deploy infrastructure:
```bash
cd terraform
terraform init
terraform apply
```

3. Deploy application:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 91+
- Mobile browsers (iOS Safari 14+, Chrome 90+)

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, development workflow, and pull request process.

Key guidelines:
- Follow the established code style
- Write comprehensive tests
- Update documentation
- Follow security best practices
- Submit detailed pull requests

## Security

- All dependencies are regularly scanned for vulnerabilities
- Security patches are applied promptly
- Authentication uses industry-standard protocols
- Data is encrypted at rest and in transit
- Regular security audits are performed

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Create an issue in the GitHub repository
- Contact the development team
- Check the documentation

## Acknowledgments

- Built with modern open-source technologies
- Designed for enterprise-grade reliability
- Focused on user experience and performance
- Community-driven development

---

© 2023 Your Organization. All rights reserved.