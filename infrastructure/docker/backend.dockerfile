# Build stage
FROM node:18-alpine AS builder

# Build arguments
ARG NODE_VERSION=18
ARG BUILD_VERSION=1.0.0

# Install build essentials and security updates
RUN apk update && \
    apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files for dependency caching
COPY src/backend/package*.json ./

# Install all dependencies including devDependencies
RUN npm ci

# Copy source code and TypeScript config
COPY src/backend/tsconfig.json ./
COPY src/backend/src ./src

# Build TypeScript code with production optimizations
RUN npm run build

# Prune dev dependencies for production
RUN npm prune --production

# Run security audit
RUN npm audit

# Production stage
FROM node:18-alpine

# Labels for container metadata
LABEL maintainer="IWMS Development Team" \
      version="1.0.0" \
      security.scan-date="${BUILD_DATE}"

# Install production essentials and security updates
RUN apk update && \
    apk add --no-cache \
    curl \
    tini \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 nodejs && \
    adduser -u 1001 -G nodejs -s /bin/sh -D nodejs

# Set working directory
WORKDIR /app

# Copy production dependencies and compiled code
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Set secure environment defaults
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS="--max-old-space-size=2048" \
    NPM_CONFIG_LOGLEVEL=warn \
    NPM_CONFIG_PRODUCTION=true \
    NPM_CONFIG_AUDIT=true \
    NPM_CONFIG_FUND=false

# Configure health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Set resource limits
ENV MEMORY=2g \
    CPU=1

# Switch to non-root user
USER nodejs:nodejs

# Create and configure volumes
VOLUME ["/app/node_modules", "/tmp"]

# Expose necessary ports
EXPOSE 3000

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Set the default command
CMD ["node", "dist/index.js"]