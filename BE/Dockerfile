# ── Backend Dockerfile ──────────────────────────────────────
# Uses Node.js 20 LTS (Debian base for native module compatibility)
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install build tools for native deps like better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies first (benefits Docker layer cache)
COPY package*.json ./
RUN npm install --omit=dev --build-from-source=better-sqlite3

# ── Production stage ───────────────────────────────────────
FROM node:20-bookworm-slim

WORKDIR /app

# Create non-root user for security
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --create-home --shell /usr/sbin/nologin appuser

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
