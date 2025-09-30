# Multi-stage build for AQI Platform
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Accept build arguments for Vite environment variables
ARG VITE_PROD_WEB_SERVICE_API_KEY
ARG VITE_PROD_WEB_SERVICE_BASE_URL

# Set environment variables for Vite build
ENV VITE_PROD_WEB_SERVICE_API_KEY=$VITE_PROD_WEB_SERVICE_API_KEY
ENV VITE_PROD_WEB_SERVICE_BASE_URL=$VITE_PROD_WEB_SERVICE_BASE_URL

# Build the application
RUN npm run build

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Ensure the dist/public directory exists for static file serving
RUN mkdir -p /app/dist/public

# Service account credentials will be provided via environment variables

USER nextjs

EXPOSE 5000

ENV PORT=5000

CMD ["npm", "start"]
