# ─── Stage 1: Build the React frontend ───────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy client dependencies and install
COPY client/package*.json ./client/
RUN cd client && npm install

# Copy client source and build
COPY client/ ./client/
RUN cd client && npm run build

# ─── Stage 2: Production server ──────────────────────────────────────────────
FROM node:22-alpine AS production

# Build tools needed to compile better-sqlite3-multiple-ciphers native module
# openssl is required to auto-generate the self-signed TLS certificate at runtime
RUN apk add --no-cache python3 make g++ openssl

WORKDIR /app

# Install server production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

# Copy server source
COPY server/ ./server/

# Copy the built React frontend from the builder stage
COPY --from=builder /app/client/dist ./client/dist

# Create the persistent data directory with safe permissions.
# The database, secret.key, backup.key, and backups all live here.
# Mount a named volume at /data to persist across container restarts.
RUN mkdir -p /data/backups && chmod 700 /data

# Tell the server where to store persistent files
ENV DATA_DIR=/data
ENV NODE_ENV=production
ENV PORT=3001

VOLUME ["/data"]
EXPOSE 3001
EXPOSE 3002

# Health check — uses --no-check-certificate because the cert is self-signed
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- --no-check-certificate https://localhost:3001/api/health || exit 1

CMD ["node", "server/index.js"]
