FROM rust:1.79-slim-bookworm AS rust-builder
WORKDIR /build
RUN apt-get update && apt-get install -y pkg-config libssl-dev protobuf-compiler clang && rm -rf /var/lib/apt/lists/*
COPY agents/ ./agents/
COPY core/ ./core/
RUN cargo build --release --features "cuda,tee,ipfs"

FROM node:20-slim AS node-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY app.js ./
COPY agents/ ./agents/
COPY index.html ./
RUN npm run build

FROM debian:bookworm-slim AS production
WORKDIR /fcm
RUN apt-get update && apt-get install -y ca-certificates libssl3 libgomp1 nvidia-cuda-toolkit && rm -rf /var/lib/apt/lists/*
COPY --from=rust-builder /build/target/release/fcm-runtime /usr/local/bin/
COPY --from=node-builder /app/dist ./dashboard/
COPY --from=node-builder /app/node_modules ./node_modules/
COPY config/agents.yaml ./config/
COPY config/blocks-ai.yaml ./config/
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 CMD curl -f http://localhost:8080/health || exit 1
EXPOSE 8080 4001 4002/udp
ENV FCM_MODE=agent FCM_NETWORK=blocks.ai FCM_LOG_LEVEL=info RUST_BACKTRACE=1
CMD ["fcm-runtime", "--config", "./config/agents.yaml", "--dashboard", "./dashboard"]
