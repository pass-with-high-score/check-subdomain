# ================================
# Stage 1: Build the application
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install Python and build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# ================================
# Stage 2: Production runtime
# ================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install yt-dlp and ffmpeg for YouTube processing
RUN apk add --no-cache python3 py3-pip ffmpeg curl \
    && pip3 install --break-system-packages yt-dlp

# Set environment variables
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nestjs
RUN adduser --system --uid 1001 nestjs

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --legacy-peer-deps --omit=dev

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy youtube cookies if exists
COPY --chown=nestjs:nestjs youtube-cookies.txt* ./

# Create data directory for runtime files (cookies, etc.)
RUN mkdir -p /app/data && chown -R nestjs:nestjs /app/data

# Set correct permissions
RUN chown -R nestjs:nestjs /app

# Expose port
EXPOSE 3010

# Start the application
CMD ["node", "dist/main"]
