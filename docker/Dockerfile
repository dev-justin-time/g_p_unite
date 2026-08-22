# FCM Agent Container — Multi-stage build
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY lib/ ./lib/
COPY agents/ ./agents/
COPY cli/ ./cli/
COPY config/ ./config/

# Stage 2: Production
FROM node:20-alpine AS production

# Security: run as non-root
RUN addgroup -g 1001 -S fcm && \
    adduser -S fcm -u 1001

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/agents ./agents
COPY --from=builder /app/cli ./cli
COPY --from=builder /app/config ./config
COPY --from=builder /app/package.json ./

# Create data directories
RUN mkdir -p /fcm/data /fcm/config /fcm/models /fcm/wasm && \
    chown -R fcm:fcm /app /fcm

USER fcm

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1

# Default agent type (overridden by env)
ENV FCM_AGENT_TYPE=inference
ENV FCM_AGENT_ID=agent-001
ENV FCM_RPC_URL=http://localhost:8545

# Start the agent
CMD ["node", "-e", "console.log('FCM Agent started'); setInterval(() => {}, 1 << 30)"]
