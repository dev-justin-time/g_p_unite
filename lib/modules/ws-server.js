/**
 * FCM WebSocket Server
 *
 * Zero-dependency WebSocket server using Node.js http upgrade.
 * Broadcasts live contract data to connected GUI clients.
 *
 * Protocol:
 *   Client → Server: { type: "subscribe", channels: ["agents", "tiers", "governance", ...] }
 *   Server → Client: { type: "snapshot", channel: "...", data: {...} }      (on connect)
 *   Server → Client: { type: "update", channel: "...", data: {...} }        (on change)
 *   Server → Client: { type: "heartbeat", ts: ... }                         (every 5s)
 */

const http = require("http");
const crypto = require("crypto");

// WebSocket magic GUID per RFC 6455
const WS_MAGIC = "258EAFA5-E914-47DA-95CA-5AB9DC11F52A";

class WsServer {
    /**
     * @param {http.Server} httpServer - Existing HTTP server to upgrade
     * @param {Object} config
     * @param {number} config.heartbeatMs - Heartbeat interval (default 5000)
     * @param {WsAuth} config.auth - Auth module instance (optional)
     */
    constructor(httpServer, config = {}) {
        this.httpServer = httpServer;
        this.heartbeatMs = config.heartbeatMs || 5000;
        this.auth = config.auth || null; // WsAuth instance
        this.clients = new Map(); // id → { socket, subscriptions: Set<string>, agentSubs: Set<string>, alive: boolean, authed: boolean, address: string }
        this._idCounter = 0;
        this._heartbeatTimer = null;
        this._dataProviders = new Map(); // channel → async () => data
        this._agentProviders = new Map(); // agentId → async () => agent detail
        this._snapshots = new Map();    // channel → last snapshot (for delta detection)
        this._agentSnapshots = new Map(); // agentId → last snapshot
        this._history = new Map();      // channel → [{ ts, data }] — circular buffer for charts
        this._agentHistory = new Map(); // agentId → [{ ts, data }]
        this._historyMaxSize = 500;
        this._historyIntervalMs = 3000; // record every 3s
        this._historyTimer = null;
        this._allAgentIds = []; // list of known agent IDs for recording history

        // Handle upgrade
        this.httpServer.on("upgrade", (req, socket, head) => {
            this._handleUpgrade(req, socket, head);
        });
    }

    // ── Lifecycle ─────────────────────────────────────────────

    start() {
        this._heartbeatTimer = setInterval(() => this._heartbeat(), this.heartbeatMs);
        this._historyTimer = setInterval(() => this._recordHistory(), this._historyIntervalMs);
        console.log(`[WS] Heartbeat every ${this.heartbeatMs}ms, history every ${this._historyIntervalMs}ms`);
    }

    stop() {
        if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
        if (this._historyTimer) clearInterval(this._historyTimer);
        for (const [, client] of this.clients) {
            try { client.socket.close(); } catch (e) { /* ignore */ }
        }
        this.clients.clear();
    }

    // ── Data Providers ────────────────────────────────────────

    /**
     * Register a data provider for a channel.
     * @param {string} channel - e.g. "agents", "tiers", "governance"
     * @param {Function} provider - async () => data object
     */
    on(channel, provider) {
        this._dataProviders.set(channel, provider);
    }

    /**
     * Broadcast an update to all subscribers of a channel.
     */
    broadcast(channel, data) {
        const msg = JSON.stringify({ type: "update", channel, data, ts: Date.now() });
        for (const [, client] of this.clients) {
            if (client.subscriptions.has(channel) || client.subscriptions.has("*")) {
                this._send(client.socket, msg);
            }
        }
    }

    /**
     * Register a data provider for a specific agent.
     * @param {string} agentId - e.g. "inf", "ren", "fl"
     * @param {Function} provider - async () => agent detail object
     */
    onAgent(agentId, provider) {
        this._agentProviders.set(agentId, provider);
        if (!this._allAgentIds.includes(agentId)) this._allAgentIds.push(agentId);
    }

    /**
     * Broadcast agent-specific update to clients subscribed to that agent.
     */
    broadcastAgent(agentId, data) {
        const channel = "agent:" + agentId;
        const msg = JSON.stringify({ type: "update", channel, agentId, data, ts: Date.now() });
        for (const [, client] of this.clients) {
            if (client.agentSubs.has(agentId) || client.subscriptions.has("*")) {
                this._send(client.socket, msg);
            }
        }
    }

    /**
     * Get all clients subscribed to a specific agent.
     */
    getAgentSubscribers(agentId) {
        const result = [];
        for (const [, client] of this.clients) {
            if (client.agentSubs.has(agentId) || client.subscriptions.has("*")) {
                result.push(client);
            }
        }
        return result;
    }

    // ── WebSocket Protocol ────────────────────────────────────

    _handleUpgrade(req, socket, head) {
        const key = req.headers["sec-websocket-key"];
        if (!key) { socket.destroy(); return; }

        // ── Authentication check ───────────────────────────────
        let authPayload = null;
        let authed = false;

        if (this.auth) {
            // Extract token from query string: ws://host:port?token=xxx
            const url = new URL(req.url, `http://${req.headers.host}`);
            const token = url.searchParams.get("token") ||
                          req.headers["x-auth-token"] || "";

            // Also support token in first Sec-WebSocket-Protocol header
            const protoHeader = req.headers["sec-websocket-protocol"] || "";
            const protoToken = protoHeader.split(",").map(s => s.trim()).find(s => s.length > 20);
            const finalToken = token || protoToken;

            if (!finalToken && this.auth.authRequired) {
                console.log(`[WS] Rejected: No auth token provided`);
                socket.write([
                    "HTTP/1.1 401 Unauthorized",
                    "Content-Type: application/json",
                    "",
                    JSON.stringify({ error: "Authentication required", code: "AUTH_REQUIRED" }),
                ].join("\r\n"));
                socket.destroy();
                return;
            }

            if (finalToken) {
                const result = this.auth.validateToken(finalToken);
                if (!result.valid) {
                    console.log(`[WS] Rejected: ${result.error}`);
                    socket.write([
                        "HTTP/1.1 401 Unauthorized",
                        "Content-Type: application/json",
                        "",
                        JSON.stringify({ error: result.error, code: "INVALID_TOKEN" }),
                    ].join("\r\n"));
                    socket.destroy();
                    return;
                }
                authPayload = result.payload;
                authed = true;
                console.log(`[WS] Authenticated: ${authPayload.address.slice(0, 10)}... (${authPayload.role})`);
            } else if (!this.auth.authRequired) {
                authed = true;
                authPayload = { address: "0x0000...0000", role: "admin", perms: [] };
            }
        } else {
            // No auth module — allow all connections
            authed = true;
        }

        // ── Complete WebSocket handshake ────────────────────────
        const accept = crypto
            .createHash("sha1")
            .update(key + WS_MAGIC)
            .digest("base64");

        socket.write([
            "HTTP/1.1 101 Switching Protocols",
            "Upgrade: websocket",
            "Connection: Upgrade",
            `Sec-WebSocket-Accept: ${accept}`,
            "",
            "",
        ].join("\r\n"));

        const id = `ws-${++this._idCounter}`;
        const client = {
            socket,
            subscriptions: new Set(["*"]), // subscribe to all by default
            agentSubs: new Set(), // per-agent subscriptions
            alive: true,
            id,
            authed,
            address: authPayload ? authPayload.address : null,
            role: authPayload ? authPayload.role : null,
        };
        this.clients.set(id, client);

        console.log(`[WS] Client connected: ${id} (total: ${this.clients.size}, authed: ${authed})`);

        // Send auth confirmation
        this._send(client.socket, JSON.stringify({
            type: "auth",
            authed,
            role: client.role,
            address: client.address,
            ts: Date.now(),
        }));

        // Send initial snapshots
        this._sendSnapshots(client);

        // Handle messages
        let buffer = Buffer.alloc(0);
        socket.on("data", (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);
            buffer = this._processFrames(client, buffer);
        });

        socket.on("close", () => {
            this.clients.delete(id);
            console.log(`[WS] Client disconnected: ${id} (total: ${this.clients.size})`);
        });

        socket.on("error", () => {
            this.clients.delete(id);
        });
    }

    _processFrames(client, buffer) {
        while (buffer.length >= 2) {
            const firstByte = buffer[0];
            const secondByte = buffer[1];
            const opcode = firstByte & 0x0f;
            const masked = (secondByte & 0x80) !== 0;
            let payloadLength = secondByte & 0x7f;
            let offset = 2;

            if (payloadLength === 126) {
                if (buffer.length < 4) return buffer;
                payloadLength = buffer.readUInt16BE(2);
                offset = 4;
            } else if (payloadLength === 127) {
                if (buffer.length < 10) return buffer;
                payloadLength = Number(buffer.readBigUInt64BE(2));
                offset = 10;
            }

            let maskKey = null;
            if (masked) {
                if (buffer.length < offset + 4) return buffer;
                maskKey = buffer.subarray(offset, offset + 4);
                offset += 4;
            }

            if (buffer.length < offset + payloadLength) return buffer;

            let payload = buffer.subarray(offset, offset + payloadLength);
            if (masked && maskKey) {
                payload = Buffer.from(payload);
                for (let i = 0; i < payload.length; i++) {
                    payload[i] ^= maskKey[i % 4];
                }
            }

            buffer = buffer.subarray(offset + payloadLength);

            // Handle opcode
            if (opcode === 0x08) {
                // Close
                client.socket.end();
                return Buffer.alloc(0);
            }
            if (opcode === 0x09) {
                // Ping → Pong
                this._sendFrame(client.socket, 0x0a, payload);
                continue;
            }
            if (opcode === 0x01) {
                // Text frame
                try {
                    const msg = JSON.parse(payload.toString("utf-8"));
                    this._handleMessage(client, msg);
                } catch (e) {
                    // ignore parse errors
                }
            }
        }
        return buffer;
    }

    _handleMessage(client, msg) {
        // ── Auth-gated messages ─────────────────────────────────
        // Ping is always allowed
        if (msg.type === "ping") {
            this._send(client.socket, JSON.stringify({ type: "pong", ts: Date.now() }));
            return;
        }

        // Token refresh is always allowed
        if (msg.type === "refreshToken" && this.auth) {
            const oldToken = msg.token;
            const newToken = this.auth.refreshToken(oldToken);
            if (newToken) {
                this._send(client.socket, JSON.stringify({ type: "tokenRefreshed", token: newToken, ts: Date.now() }));
            } else {
                this._send(client.socket, JSON.stringify({ type: "error", error: "Token refresh failed", ts: Date.now() }));
            }
            return;
        }

        // All other messages require auth
        if (this.auth && this.auth.authRequired && !client.authed) {
            this._send(client.socket, JSON.stringify({ type: "error", error: "Authentication required", code: "AUTH_REQUIRED", ts: Date.now() }));
            return;
        }

        // ── Channel subscriptions ────────────────────────────────
        if (msg.type === "subscribe" && Array.isArray(msg.channels)) {
            client.subscriptions = new Set(msg.channels);
            // Send fresh snapshots for newly subscribed channels
            this._sendSnapshots(client);
        }
        // Request historical data
        if (msg.type === "requestHistory" && msg.channel) {
            const history = this.getHistory(msg.channel, msg.limit || 200);
            const resp = JSON.stringify({ type: "history", channel: msg.channel, data: history, ts: Date.now() });
            this._send(client.socket, resp);
        }
        // Subscribe to a specific agent
        if (msg.type === "subscribeAgent" && msg.agentId) {
            client.agentSubs.add(msg.agentId);
            // Send snapshot for the agent
            this._sendAgentSnapshot(client, msg.agentId);
            // Send agent history
            const history = this.getAgentHistory(msg.agentId, msg.limit || 200);
            if (history.length > 0) {
                const resp = JSON.stringify({ type: "agentHistory", agentId: msg.agentId, data: history, ts: Date.now() });
                this._send(client.socket, resp);
            }
        }
        // Unsubscribe from a specific agent
        if (msg.type === "unsubscribeAgent" && msg.agentId) {
            client.agentSubs.delete(msg.agentId);
        }
        // Unsubscribe from all agents
        if (msg.type === "unsubscribeAllAgents") {
            client.agentSubs.clear();
        }
    }

    async _sendSnapshots(client) {
        for (const [channel, provider] of this._dataProviders) {
            if (client.subscriptions.has(channel) || client.subscriptions.has("*")) {
                try {
                    const data = await provider();
                    this._snapshots.set(channel, data);
                    const msg = JSON.stringify({ type: "snapshot", channel, data, ts: Date.now() });
                    this._send(client.socket, msg);
                } catch (e) {
                    console.error(`[WS] Snapshot error for ${channel}:`, e.message);
                }
            }
        }
        // Send snapshots for subscribed agents
        for (const agentId of client.agentSubs) {
            await this._sendAgentSnapshot(client, agentId);
        }
        // Also send buffered history for charts
        for (const [channel] of this._history) {
            const history = this._history.get(channel);
            if (history && history.length > 0) {
                const msg = JSON.stringify({ type: "history", channel, data: history, ts: Date.now() });
                this._send(client.socket, msg);
            }
        }
        // Send agent history for subscribed agents
        for (const agentId of client.agentSubs) {
            const history = this.getAgentHistory(agentId, 200);
            if (history.length > 0) {
                const resp = JSON.stringify({ type: "agentHistory", agentId, data: history, ts: Date.now() });
                this._send(client.socket, resp);
            }
        }
    }

    async _sendAgentSnapshot(client, agentId) {
        const provider = this._agentProviders.get(agentId);
        if (!provider) return;
        try {
            const data = await provider();
            this._agentSnapshots.set(agentId, data);
            const msg = JSON.stringify({ type: "agentSnapshot", agentId, data, ts: Date.now() });
            this._send(client.socket, msg);
        } catch (e) {
            console.error(`[WS] Agent snapshot error for ${agentId}:`, e.message);
        }
    }

    _heartbeat() {
        const msg = JSON.stringify({ type: "heartbeat", ts: Date.now(), clients: this.clients.size });
        for (const [, client] of this.clients) {
            if (!client.alive) {
                try { client.socket.terminate(); } catch (e) { /* ignore */ }
                this.clients.delete(client.id);
                continue;
            }
            client.alive = false;
            this._send(client.socket, msg);
        }
    }

    // ── Historical Data Recording ──────────────────────────

    async _recordHistory() {
        for (const [channel, provider] of this._dataProviders) {
            try {
                const data = await provider();
                if (!this._history.has(channel)) this._history.set(channel, []);
                const buf = this._history.get(channel);
                buf.push({ ts: Date.now(), data });
                if (buf.length > this._historyMaxSize) {
                    buf.splice(0, buf.length - this._historyMaxSize);
                }
            } catch (e) { /* skip */ }
        }
        // Record per-agent history
        for (const agentId of this._allAgentIds) {
            const provider = this._agentProviders.get(agentId);
            if (!provider) continue;
            try {
                const data = await provider();
                if (!this._agentHistory.has(agentId)) this._agentHistory.set(agentId, []);
                const buf = this._agentHistory.get(agentId);
                buf.push({ ts: Date.now(), data });
                if (buf.length > this._historyMaxSize) {
                    buf.splice(0, buf.length - this._historyMaxSize);
                }
            } catch (e) { /* skip */ }
        }
    }

    getHistory(channel, limit) {
        const buf = this._history.get(channel) || [];
        return buf.slice(-(limit || buf.length));
    }

    getAgentHistory(agentId, limit) {
        const buf = this._agentHistory.get(agentId) || [];
        return buf.slice(-(limit || buf.length));
    }

    // ── Frame Encoding ────────────────────────────────────────

    _send(socket, data) {
        try {
            this._sendFrame(socket, 0x01, Buffer.from(data, "utf-8"));
        } catch (e) { /* ignore broken pipes */ }
    }

    _sendFrame(socket, opcode, payload) {
        const len = payload.length;
        let header;
        if (len < 126) {
            header = Buffer.alloc(2);
            header[0] = 0x80 | opcode;
            header[1] = len;
        } else if (len < 65536) {
            header = Buffer.alloc(4);
            header[0] = 0x80 | opcode;
            header[1] = 126;
            header.writeUInt16BE(len, 2);
        } else {
            header = Buffer.alloc(10);
            header[0] = 0x80 | opcode;
            header[1] = 127;
            header.writeBigUInt64BE(BigInt(len), 2);
        }
        socket.write(Buffer.concat([header, payload]));
    }
}

module.exports = { WsServer };
