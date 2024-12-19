# Stage 1: Builder
FROM node:18-alpine AS builder

# Add build dependencies
RUN apk add --no-cache python3 make g++ curl

# Set working directory
WORKDIR /app

# Copy package files for dependency caching
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies with exact versions
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript application
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Stage 2: Production
FROM node:18-alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Create app directory and set permissions
WORKDIR /app

# Create non-root user/group
RUN addgroup -g 1001 nodeapp && \
    adduser -u 1001 -G nodeapp -s /bin/sh -D nodeapp && \
    chown -R nodeapp:nodeapp /app

# Copy built application from builder stage
COPY --from=builder --chown=nodeapp:nodeapp /app/node_modules ./node_modules/
COPY --from=builder --chown=nodeapp:nodeapp /app/dist ./dist/
COPY --from=builder --chown=nodeapp:nodeapp /app/package.json ./

# Set secure file permissions
RUN chmod -R 755 /app && \
    chmod -R 644 /app/dist/* && \
    chmod -R 644 /app/package.json && \
    chmod -R 755 /app/node_modules/.bin/*

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV TZ=UTC

# Enable production optimizations
ENV NODE_ENV=production

# Expose application port
EXPOSE 3000

# Configure healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Drop all capabilities and only add necessary ones
RUN apk add --no-cache libcap && \
    setcap cap_net_bind_service=+ep /usr/local/bin/node && \
    apk del libcap

# Switch to non-root user
USER nodeapp

# Define entry point with proper signal handling
ENTRYPOINT ["node"]
CMD ["dist/index.js"]

# Add metadata labels
LABEL maintainer="IWMS Development Team" \
      version="1.0.0" \
      description="Lightweight IWMS Backend Service" \
      org.opencontainers.image.source="https://github.com/org/iwms-backend" \
      org.opencontainers.image.licenses="MIT"