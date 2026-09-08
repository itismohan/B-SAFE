# Multi-stage Dockerfile for B-SAFE (production-ready)

# Build stage
FROM node:20-alpine AS builder

# Install build dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy package manifests first for better caching
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

# Runtime stage
FROM node:20-alpine AS runner

# Enable pnpm in runtime
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
ENV NODE_ENV=production

# Copy built artifacts and dependencies from builder
COPY --from=builder /app .

# Expose default port
EXPOSE 3000

# Start command (adjust if your server entry differs)
CMD ["pnpm", "start"]
