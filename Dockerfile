# Multi-stage Dockerfile for Twilio-Azure AI Agents
# Optimized for production deployment on cloud platforms (AWS ECS, GCP Cloud Run, Azure Container Apps)

# Stage 1: Dependencies
FROM node:20-alpine AS dependencies

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install production dependencies only
# --omit=dev ensures no devDependencies are installed
# --ignore-scripts prevents any package lifecycle scripts
RUN npm ci --omit=dev --ignore-scripts

# Stage 2: Production image
FROM node:20-alpine AS production

# Add metadata labels
LABEL maintainer="Twilio-Azure AI Agents"
LABEL description="Voice AI agent powered by Twilio and Azure AI"
LABEL version="1.0.0"

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy production dependencies from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy package.json for reference (useful for debugging)
COPY package*.json ./

# Copy application source code
COPY src/ ./src/

# Create non-root user and switch to it for security
# The 'node' user is pre-created in the node:alpine image
USER node

# Expose the application port
EXPOSE 3000

# Health check using the built-in /health endpoint
# Runs every 30 seconds, 3 second timeout, 3 retries before marking unhealthy
# 10 second grace period on startup
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start the application
CMD ["node", "src/server.js"]
