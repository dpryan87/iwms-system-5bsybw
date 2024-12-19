# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set build arguments
ARG API_URL
ARG APP_VERSION
ARG COMMIT_HASH

# Set environment variables
ENV NODE_ENV=production \
    VITE_API_URL=${API_URL} \
    VITE_APP_VERSION=${APP_VERSION} \
    VITE_COMMIT_HASH=${COMMIT_HASH}

# Install build dependencies and security updates
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install dependencies with exact versions and security audit
RUN npm ci --production=false && \
    npm audit fix && \
    npm cache clean --force

# Copy source code with appropriate ownership
COPY --chown=node:node . .

# Build application with production optimizations
RUN npm run build && \
    # Optimize build artifacts
    find dist -type f -name '*.js' -exec gzip -k {} \; && \
    find dist -type f -name '*.css' -exec gzip -k {} \; && \
    find dist -type f -name '*.html' -exec gzip -k {} \;

# Stage 2: Production stage
FROM nginx:1.25-alpine

# Install additional security packages
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
    curl \
    tzdata \
    tini

# Create non-root nginx user
RUN addgroup -g 101 -S nginx && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Set environment variables for nginx
ENV NGINX_WORKER_PROCESSES=auto \
    NGINX_WORKER_CONNECTIONS=1024 \
    NGINX_KEEPALIVE_TIMEOUT=65

# Copy nginx configuration
COPY infrastructure/docker/nginx.conf /etc/nginx/nginx.conf

# Create required directories with proper permissions
RUN mkdir -p /var/cache/nginx && \
    mkdir -p /var/log/nginx && \
    mkdir -p /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html && \
    chmod -R 755 /var/log/nginx

# Copy built artifacts from builder stage
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Copy static error pages
COPY --chown=nginx:nginx infrastructure/docker/error-pages/* /usr/share/nginx/html/

# Setup health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl --fail http://localhost/health || exit 1

# Expose port
EXPOSE 80

# Switch to non-root user
USER nginx

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# Build-time metadata
LABEL maintainer="IWMS Development Team" \
      version="${APP_VERSION}" \
      description="Lightweight IWMS Frontend" \
      org.opencontainers.image.source="https://github.com/org/iwms" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${COMMIT_HASH}"