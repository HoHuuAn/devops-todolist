# ── Backend Dockerfile ──────────────────────────────────────
# Uses Node.js 20 LTS
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (benefits Docker layer cache)
COPY package*.json ./
RUN npm install --omit=dev

# ── Production stage ───────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser  -u 1001 -S appuser -G appgroup

# Copy dependencies from builder
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules

# Copy application code
COPY --chown=appuser:appgroup . .

# Create directory for database file and set ownership
RUN mkdir -p /data && chown -R appuser:appgroup /data

# Switch to non-root user
USER appuser

# Environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DB_PATH=/data/app.db

# Expose application port
EXPOSE 3000

# Health check — uses node directly, no extra tools needed
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Start the application
CMD ["node", "server.js"]
