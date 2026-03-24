# Use Node.js 22 LTS
FROM node:22-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies for build)
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY . .

# Build the application and worker
RUN pnpm build && pnpm build:worker

# --- Production stage ---
FROM node:22-alpine

RUN npm install -g pnpm

WORKDIR /app

# Copy package files and install production dependencies only
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile --prod

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY drizzle.config.ts ./

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the application (migration is handled separately via db:push or CI)
CMD ["node", "dist/index.js"]
