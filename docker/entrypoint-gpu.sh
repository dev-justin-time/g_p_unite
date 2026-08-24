#!/bin/sh
set -e

# ═══════════════════════════════════════════════════════════════
# GPU Platform GUI — Entrypoint
# Starts nginx + optional WebSocket server + obscura
# ═══════════════════════════════════════════════════════════════

echo "╔══════════════════════════════════════════╗"
echo "║   GPU Platform GUI — Starting...         ║"
echo "╚══════════════════════════════════════════╝"

# ── Configure nginx from env vars ────────────────────────────
# Replace placeholders in nginx config
GPU_PORT="${GPU_PORT:-9091}"
GPU_WS_PORT="${GPU_WS_PORT:-9092}"

# Generate final nginx config from template
envsubst '${GPU_PORT} ${GPU_WS_PORT}' < /etc/nginx/conf.d/default.conf > /tmp/nginx-default.conf
mv /tmp/nginx-default.conf /etc/nginx/conf.d/default.conf

# Set worker processes to CPU count
CPU_COUNT=$(nproc 2>/dev/null || echo 1)
sed -i "s/worker_processes auto;/worker_processes ${CPU_COUNT};/" /etc/nginx/nginx.conf 2>/dev/null || true

echo "[nginx] Configured on port ${GPU_PORT}"
echo "[nginx] WebSocket proxy → port ${GPU_WS_PORT}"

# ── Start Node.js WebSocket Server ───────────────────────────
if [ "${GPU_WS_ENABLED}" = "true" ]; then
    echo "[ws] Starting WebSocket server on port ${GPU_WS_PORT}..."

    # Create server startup script
    cat > /tmp/ws-server.js << 'WSEOF'
const http = require('http');
const path = require('path');

// Try to load dashboard server modules
let WsServer, ContractDataFeed;
try {
    const wsMod = require('/opt/gpu-platform/lib/modules/ws-server');
    WsServer = wsMod.WsServer;
} catch (e) {
    console.log('[ws] WsServer module not found, running minimal WS');
}

try {
    const feedMod = require('/opt/gpu-platform/lib/modules/contract-feed');
    ContractDataFeed = feedMod.ContractDataFeed;
} catch (e) {
    console.log('[ws] ContractDataFeed not found, using mock data');
}

const PORT = parseInt(process.env.GPU_WS_PORT || '9092');
const REGISTRY = process.env.GPU_REGISTRY_CONTRACT || '';
const RPC = process.env.GPU_RPC_URL || '';
const AUTH_SECRET = process.env.GPU_AUTH_SECRET || '';
const AUTH_REQUIRED = process.env.GPU_AUTH_REQUIRED === 'true';

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // Health check
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', service: 'gpu-ws', clients: ws ? ws._clients?.size || 0 : 0 }));
        return;
    }

    // Auth endpoints
    if (req.url === '/api/auth/login' && req.method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
            try {
                const { address, role } = JSON.parse(body);
                if (!address || !address.startsWith('0x')) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Invalid address' }));
                    return;
                }
                const token = Buffer.from(JSON.stringify({
                    address, role: role || 'viewer',
                    iat: Date.now(), exp: Date.now() + 86400000
                })).toString('base64') + '.mock';
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, token, role: role || 'viewer', address }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

let ws;
if (WsServer) {
    ws = new WsServer(server);
    console.log('[ws] WebSocket server initialized with WsServer module');
} else {
    console.log('[ws] Running minimal WebSocket server (no WsServer module)');
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[ws] Server listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[ws] Shutting down...');
    server.close(() => process.exit(0));
});
WSEOF

    node /tmp/ws-server.js &
    WS_PID=$!
    echo "[ws] Started with PID ${WS_PID}"
else
    echo "[ws] Disabled (GPU_WS_ENABLED=false)"
fi

# ── Start Obscura (optional) ─────────────────────────────────
if [ "${GPU_OBSURA_ENABLED}" = "true" ]; then
    OBSCURA_BIN="/opt/gpu-platform/bin/obscura"
    if [ -x "${OBSCURA_BIN}" ]; then
        echo "[obscura] Starting obscura on port ${GPU_OBSURA_PORT}..."
        ${OBSCURA_BIN} serve --port ${GPU_OBSURA_PORT} --stealth &
        OBSCURA_PID=$!
        echo "[obscura] Started with PID ${OBSCURA_PID}"
    else
        echo "[obscura] Binary not found at ${OBSCURA_BIN}, skipping"
    fi
else
    echo "[obscura] Disabled (GPU_OBSURA_ENABLED=false)"
fi

# ── Print summary ────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   GPU Platform GUI — Ready!                            ║"
echo "║                                                        ║"
echo "║   🌐 GUI:    http://localhost:${GPU_PORT}/gpu_nited.html  ║"
echo "║   🔌 WS:     ws://localhost:${GPU_WS_PORT}                ║"
echo "║   📊 Health: http://localhost:${GPU_PORT}/health          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Start nginx in foreground ────────────────────────────────
exec nginx -g "daemon off;"
