# ── Frontend Dockerfile ──────────────────────────────────────
# Stage 1 — build (Nginx with static HTML)
FROM nginx:alpine AS builder

# Copy static files
COPY . /usr/share/nginx/html/

# ── Production stage: serve with Nginx ──────────────────────
FROM nginx:alpine

# Remove default Nginx site
RUN rm -rf /usr/share/nginx/html/*

# Copy static files from builder stage
COPY --from=builder /usr/share/nginx/html/ /usr/share/nginx/html/

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
