/**
 * DashboardServer — Lightweight HTTP server for real-time system monitoring
 *
 * Serves the live dashboard + JSON API for monitoring agents,
 * tiers, tasks, network health, and earnings — no external dependencies.
 */

const http = require("http");
const path = require("path");
const fs = require("fs");
const { WsServer } = require("./ws-server");
const { ContractDataFeed } = require("./contract-feed");
const { WsAuth } = require("./ws-auth");

class DashboardServer {
    constructor(masterAgent, config = {}) {
        this.master = masterAgent;
        this.port = config.port || 8080;
        this.host = config.host || "127.0.0.1";
        this.server = null;
        this._requestCount = 0;
        this._startTime = Date.now();

        // Auth module
        this.auth = new WsAuth({
            secret: process.env.FCM_AUTH_SECRET || undefined,
            authRequired: process.env.FCM_AUTH_REQUIRED !== "false",
        });

        // Register deployer as admin
        if (process.env.TESTNET_PRIVATE_KEY) {
            // In production, derive address from private key
            // For now, register a default admin
            this.auth.registerWallet("0x0000000000000000000000000000000000000001", "admin");
        }

        // WebSocket + live data feed
        this.ws = null;
        this.feed = null;
        this._broadcastInterval = null;
    }

    start() {
        this.server = http.createServer((req, res) => this._handleRequest(req, res));

        // Initialize WebSocket server with auth
        this.ws = new WsServer(this.server, { heartbeatMs: 5000, auth: this.auth });

        // Initialize contract data feed
        this.feed = new ContractDataFeed({
            rpcUrl: process.env.FCM_RPC_URL || "http://localhost:8545",
            registryAddress: process.env.FCM_REGISTRY || "",
            tokenAddress: process.env.FCM_TOKEN || "",
            tierStakingAddress: process.env.FCM_TIER_STAKING || "",
            governanceAddress: process.env.FCM_GOVERNANCE || "",
            escrowAddress: process.env.FCM_ESCROW || "",
            reputationAddress: process.env.FCM_REPUTATION_NFT || "",
            rewardsPoolAddress: process.env.FCM_REWARDS_POOL || "",
        });

        // Register data providers
        this.ws.on("agents", () => this.feed.getAgents());
        this.ws.on("tiers", () => this.feed.getTiers());
        this.ws.on("governance", () => this.feed.getGovernance());
        this.ws.on("escrows", () => this.feed.getEscrows());
        this.ws.on("reputation", () => this.feed.getReputation());
        this.ws.on("system", () => this.feed.getSystem());
        this.ws.on("rewards", () => this.feed.getRewards());

        // Register per-agent data providers
        const agentIds = this.feed.getAgentIds();
        for (const agentId of agentIds) {
            this.ws.onAgent(agentId, () => this.feed.getAgentDetail(agentId));
        }
        console.log(`[Dashboard] Registered ${agentIds.length} agent providers: ${agentIds.join(", ")}`);

        // Start periodic broadcasts (every 3s for live data)
        this._broadcastInterval = setInterval(() => this._broadcastUpdates(), 3000);

        this.ws.start();

        this.server.listen(this.port, this.host, () => {
            console.log(`[Dashboard] Listening on http://${this.host}:${this.port}`);
            console.log(`[Dashboard] WebSocket available at ws://${this.host}:${this.port}`);
            console.log(`[Dashboard] Open http://${this.host}:${this.port}/gui.html for the live dashboard`);
            console.log(`[Dashboard] Data mode: ${this.feed.connected ? "LIVE (contracts)" : "MOCK (no contracts)"}`);
        });
    }

    stop() {
        if (this._broadcastInterval) clearInterval(this._broadcastInterval);
        if (this.ws) this.ws.stop();
        if (this.server) this.server.close();
    }

    async _broadcastUpdates() {
        if (!this.ws || this.ws.clients.size === 0) return;
        try {
            const [agents, system, rewards] = await Promise.all([
                this.feed.getAgents(),
                this.feed.getSystem(),
                this.feed.getRewards(),
            ]);
            this.ws.broadcast("agents", agents);
            this.ws.broadcast("system", system);
            this.ws.broadcast("rewards", rewards);

            // Broadcast per-agent data to subscribers
            const agentIds = this.feed.getAgentIds();
            for (const agentId of agentIds) {
                const subscribers = this.ws.getAgentSubscribers(agentId);
                if (subscribers.length > 0) {
                    const detail = await this.feed.getAgentDetail(agentId);
                    this.ws.broadcastAgent(agentId, detail);
                }
            }
        } catch (e) {
            console.error("[Dashboard] Broadcast error:", e.message);
        }
    }

    async _handleRequest(req, res) {
        this._requestCount++;
        const url = new URL(req.url, `http://${req.headers.host}`);

        // CORS headers
        res.setHeader("Access-Control-Allow-Origin", `http://${this.host}:${this.port}`);
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Auth-Token");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

        // Handle CORS preflight
        if (req.method === "OPTIONS") {
            res.writeHead(204);
            return res.end();
        }

        // ── Static files (no auth required) ─────────────────
        if (url.pathname === "/" || url.pathname === "/gui.html") {
            return this._serveFile(res, path.join(__dirname, "../../gui.html"), "text/html");
        }
        if (url.pathname === "/dashboard.html") {
            return this._serveFile(res, path.join(__dirname, "../../dashboard.html"), "text/html");
        }
        if (url.pathname === "/index.html") {
            return this._serveFile(res, path.join(__dirname, "../../index.html"), "text/html");
        }
        if (url.pathname === "/app.html") {
            return this._serveFile(res, path.join(__dirname, "../../app.html"), "text/html");
        }
        if (url.pathname === "/app.js") {
            return this._serveFile(res, path.join(__dirname, "../../app.js"), "application/javascript");
        }
        if (url.pathname === "/gpuagent.html") {
            return this._serveFile(res, path.join(__dirname, "../../gpu-platform/gpuagent.html"), "text/html");
        }

        // ── Auth endpoints (no auth required) ───────────────
        if (url.pathname === "/api/auth/login" && req.method === "POST") {
            return this._handleLogin(req, res);
        }
        if (url.pathname === "/api/auth/register" && req.method === "POST") {
            return this._handleRegister(req, res);
        }
        if (url.pathname === "/api/auth/refresh" && req.method === "POST") {
            return this._handleRefresh(req, res);
        }
        if (url.pathname === "/api/auth/revoke" && req.method === "POST") {
            return this._handleRevoke(req, res);
        }
        if (url.pathname === "/api/health") {
            return this._json(res, {
                status: "ok",
                uptime: Math.floor((Date.now() - this._startTime) / 1000),
                requests: this._requestCount,
                auth: this.auth.getStats(),
                timestamp: new Date().toISOString(),
            });
        }

        // ── Auth check for protected API endpoints ───────────
        if (url.pathname.startsWith("/api/")) {
            let token = null;
            const authHeader = req.headers["authorization"];
            if (authHeader && authHeader.startsWith("Bearer ")) {
                token = authHeader.slice(7);
            }
            if (!token) {
                token = url.searchParams.get("token");
            }
            if (!token) {
                token = req.headers["x-auth-token"];
            }

            if (this.auth.authRequired && !token) {
                return this._json(res, { error: "Authentication required", code: "AUTH_REQUIRED" }, 401);
            }

            if (token) {
                const result = this.auth.validateToken(token);
                if (!result.valid) {
                    return this._json(res, { error: result.error, code: "INVALID_TOKEN" }, 401);
                }
                req.authPayload = result.payload;
            } else if (!this.auth.authRequired) {
                req.authPayload = { address: "0x0000...0000", role: "admin", perms: [] };
            }
        }

        // ── Protected API routes ────────────────────────────
        res.setHeader("Content-Type", "application/json");

        try {
            switch (url.pathname) {
                case "/api/status":
                    return this._json(res, this._getFullStatus());

                case "/api/agents":
                    return this._json(res, this._getAgents());

                case "/api/agents/:id":
                    return this._json(res, this._getAgent(url.pathname.split("/").pop()));

                case "/api/tiers":
                    return this._json(res, this._getTiers());

                case "/api/tiers/:id":
                    return this._json(res, this._getTierAgents(url.pathname.split("/").pop()));

                case "/api/resources":
                    return this._json(res, this._getResources());

                case "/api/tasks":
                    return this._json(res, this._getTasks());

                case "/api/v1/agents":
                    if (req.method !== "GET") return this._json(res, { error: "Method not allowed" }, 405);
                    return this._getLiveAgents(res, url);

                case "/api/v1/tasks":
                    if (req.method === "GET") return this._getLiveTasks(res);
                    if (req.method === "POST") return this._handleLiveTaskClaim(req, res);
                    return this._json(res, { error: "Method not allowed" }, 405);

                case "/api/permissions":
                    return this._json(res, this._getPermissions());

                case "/api/earnings":
                    return this._json(res, this._getEarnings());

                case "/api/v1/system/stats":
                    return this._getLiveStats(res);

                case "/api/v1/system/contracts":
                    return this._getLiveContracts(res);

                case "/api/v1/agents/:did/heartbeat":
                    if (req.method !== "GET") return this._json(res, { error: "Method not allowed" }, 405);
                    return this._getLiveAgentHeartbeat(res, url.pathname.split("/")[4]);

                case "/api/settings":
                    if (req.method === "GET") {
                        return this._json(res, this._getSettings());
                    }
                    if (req.method === "POST") {
                        return this._handlePostSettings(req, res);
                    }
                    return this._json(res, { error: "Method not allowed" }, 405);

                default:
                    return this._json(res, {
                        endpoints: [
                            "POST /api/auth/login      — Login with wallet address",
                            "POST /api/auth/register   — Register wallet with role",
                            "POST /api/auth/refresh    — Refresh auth token",
                            "POST /api/auth/revoke     — Revoke auth token",
                            "GET  /api/health          — Server health (no auth)",
                            "GET  /api/status          — Full system status",
                            "GET  /api/agents          — All 18 agents with metrics",
                            "GET  /api/agents/:id      — Single agent detail",
                            "GET  /api/tiers           — Tier rankings",
                            "GET  /api/tiers/:id       — Agents in tier",
                            "GET  /api/resources       — System resources",
                            "GET  /api/tasks           — Active tasks",
                            "GET  /api/permissions     — Permission summary",
                            "GET  /api/earnings        — Earnings summary",
                            "GET  /api/settings        — All settings",
                            "POST /api/settings        — Update settings",
                        ],
                    });
            }
        } catch (e) {
            this._json(res, { error: e.message }, 500);
        }
    }

    // ===== STATIC FILE SERVING =====
    _serveFile(res, filePath, contentType) {
        try {
            if (!fs.existsSync(filePath)) {
                res.writeHead(404, { "Content-Type": "text/plain" });
                return res.end("Not found");
            }
            const content = fs.readFileSync(filePath);
            res.writeHead(200, {
                "Content-Type": contentType,
                "Cache-Control": "no-cache",
                "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self';",
            });
            res.end(content);
        } catch (e) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Error serving file");
        }
    }

    // ===== API DATA =====
    async _getLiveAgents(res, url) {
        if (!this.feed || !this.feed.connected) return this._json(res, { error: "Live contract feed is not connected", mode: "mock" }, 503);
        const data = await this.feed.getAgents();
        const agents = Array.isArray(data.agents) ? data.agents : [];
        const term = (url.searchParams.get("q") || "").toLowerCase();
        const filtered = term ? agents.filter(a => [a.name, a.category, a.status, a.didHash].some(v => String(v || "").toLowerCase().includes(term))) : agents;
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
        const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
        const start = (page - 1) * limit;
        return this._json(res, { data: filtered.slice(start, start + limit), pagination: { page, limit, total: filtered.length, pages: Math.ceil(filtered.length / limit) }, mode: "live", ts: Date.now() });
    }

    async _getLiveTasks(res) {
        if (!this.feed || !this.feed.connected) return this._json(res, { error: "Live contract feed is not connected", mode: "mock" }, 503);
        const data = await this.feed.getTasks();
        return this._json(res, { data: data.tasks || [], pagination: { page: 1, limit: data.tasks ? data.tasks.length : 0, total: data.tasks ? data.tasks.length : 0, pages: 1 }, mode: "live", ts: Date.now() });
    }

    async _getLiveStats(res) {
        if (!this.feed || !this.feed.connected) return this._json(res, { error: "Live contract feed is not connected", mode: "mock" }, 503);
        const [agents, tiers, governance, escrows] = await Promise.all([this.feed.getAgents(), this.feed.getTiers(), this.feed.getGovernance(), this.feed.getEscrows()]);
        const list = agents.agents || [];
        return this._json(res, { agents: { total: list.length, active: list.filter(a => a.status === "active").length }, governance: { totalProposals: governance.total || (governance.proposals || []).length, active: (governance.proposals || []).filter(p => p.state === "Active").length }, escrow: { total: escrows.total || (escrows.escrows || []).length, inProgress: (escrows.escrows || []).filter(e => e.state === "InProgress").length }, tiers: tiers.tiers || [], mode: "live", ts: Date.now() });
    }

    async _getLiveContracts(res) {
        if (!this.feed || !this.feed.connected) return this._json(res, { error: "Live contract feed is not connected", mode: "mock" }, 503);
        return this._json(res, { registry: process.env.FCM_REGISTRY || "", token: process.env.FCM_TOKEN || "", tierStaking: process.env.FCM_TIER_STAKING || "", governance: process.env.FCM_GOVERNANCE || "", escrow: process.env.FCM_ESCROW || "", reputationNFT: process.env.FCM_REPUTATION_NFT || "", rewardsPool: process.env.FCM_REWARDS_POOL || "", mode: "live" });
    }

    async _getLiveAgentHeartbeat(res, did) {
        if (!this.feed || !this.feed.connected) return this._json(res, { error: "Live contract feed is not connected", mode: "mock" }, 503);
        const agents = await this.feed.getAgents();
        const agent = (agents.agents || []).find(a => a.didHash === did || a.didHash === "0x" + did);
        if (!agent) return this._json(res, { error: "Agent not found" }, 404);
        const age = Math.max(0, Math.floor(Date.now() / 1000 - Number(agent.lastHeartbeat || 0)));
        return this._json(res, { didHash: agent.didHash, heartbeatAge: age, online: age < 600, lastHeartbeat: agent.lastHeartbeat, mode: "live" });
    }

    _getFullStatus() {
        return {
            system: "FCM Agent Swarm",
            version: "1.0.0",
            agents: this._getAgentList(),
            tiers: this._getTierSummary(),
            resources: this._getResources(),
            health: {
                uptime: Math.floor((Date.now() - this._startTime) / 1000),
                requests: this._requestCount,
                timestamp: new Date().toISOString(),
            },
        };
    }

    _getAgents() {
        return this._getAgentList();
    }

    _getAgent(id) {
        const agent = this._getAgentList().find(a => a.id === id);
        if (!agent) return { error: "Agent not found" };
        return agent;
    }

    _getAgentList() {
        // Return agent data from the master agent or static definitions
        const agentDefs = [
            { id:'inf', name:'Inference Router', icon:'🧠', category:'compute', tier:4, status:'active' },
            { id:'ren', name:'Render Splitter', icon:'🎬', category:'compute', tier:3, status:'active' },
            { id:'fl', name:'FL Coordinator', icon:'🔒', category:'compute', tier:5, status:'active' },
            { id:'edge', name:'Edge Runner', icon:'⚡', category:'compute', tier:3, status:'active' },
            { id:'zk', name:'ZK Prover', icon:'🛡️', category:'compute', tier:4, status:'standby' },
            { id:'game', name:'Game Host', icon:'🎮', category:'compute', tier:2, status:'active' },
            { id:'sci', name:'Science Grid', icon:'🔬', category:'compute', tier:3, status:'standby' },
            { id:'priv', name:'Privacy Mesh', icon:'🕵️', category:'compute', tier:4, status:'active' },
            { id:'node', name:'Node Runner', icon:'🖥️', category:'infrastructure', tier:2, status:'active' },
            { id:'stor', name:'Storage Provider', icon:'💾', category:'infrastructure', tier:3, status:'active' },
            { id:'fsrv', name:'File Server', icon:'📁', category:'infrastructure', tier:1, status:'active' },
            { id:'rwrd', name:'Rewarded Worker', icon:'🎁', category:'infrastructure', tier:1, status:'active' },
            { id:'tier', name:'Tier Manager', icon:'📊', category:'platform', tier:5, status:'active' },
            { id:'reward', name:'Rewards Distributor', icon:'💰', category:'platform', tier:5, status:'active' },
            { id:'gov', name:'Governance Agent', icon:'🏛️', category:'platform', tier:4, status:'active' },
            { id:'escrow', name:'Escrow Manager', icon:'🔒', category:'platform', tier:3, status:'active' },
            { id:'rep', name:'Reputation Oracle', icon:'🏅', category:'platform', tier:4, status:'active' },
            { id:'coord', name:'Agent Coordinator', icon:'🤝', category:'platform', tier:5, status:'active' },
        ];

        // Enrich with live data from master agent if available
        if (this.master && this.master.agents) {
            return agentDefs.map(def => {
                const live = this.master.agents.get(def.id) || {};
                return {
                    ...def,
                    stake: live.stake || 0,
                    activeTasks: live.activeTasks || 0,
                    reputation: live.reputation || 0,
                    lastHeartbeat: live.lastHeartbeat || null,
                };
            });
        }
        return agentDefs;
    }

    _getTiers() {
        const tierConfig = [
            { tier: 0, name: 'Free', minStake: 0, multiplier: '0.5x', maxTasks: 1, feeDiscount: 0 },
            { tier: 1, name: 'Starter', minStake: 100, multiplier: '1x', maxTasks: 3, feeDiscount: 5 },
            { tier: 2, name: 'Standard', minStake: 500, multiplier: '1.5x', maxTasks: 5, feeDiscount: 10 },
            { tier: 3, name: 'Advanced', minStake: 2000, multiplier: '2x', maxTasks: 10, feeDiscount: 15 },
            { tier: 4, name: 'Pro', minStake: 10000, multiplier: '3x', maxTasks: 20, feeDiscount: 20 },
            { tier: 5, name: 'Elite', minStake: 50000, multiplier: '5x', maxTasks: 50, feeDiscount: 25 },
        ];

        const agents = this._getAgentList();
        return tierConfig.map(t => ({
            ...t,
            agentCount: agents.filter(a => a.tier === t.tier).length,
            agents: agents.filter(a => a.tier === t.tier).map(a => ({ id: a.id, name: a.name, icon: a.icon })),
        }));
    }

    _getTierAgents(tierId) {
        const tier = parseInt(tierId, 10);
        if (isNaN(tier) || tier < 0 || tier > 5) return { error: "Invalid tier (0-5)" };
        const agents = this._getAgentList().filter(a => a.tier === tier);
        return { tier, agents };
    }

    _getResources() {
        if (this.master && this.master.resourceAnalyzer) {
            return this.master.resourceAnalyzer.getUsage();
        }
        // Static fallback
        return {
            cpu: { cores: 8, usage: Math.floor(Math.random() * 40 + 20) + "%" },
            memory: { total: "32GB", used: Math.floor(Math.random() * 10 + 8) + "GB" },
            disk: { total: "2TB", used: Math.floor(Math.random() * 500 + 200) + "GB" },
            network: { down: "1Gbps", up: "500Mbps" },
        };
    }

    _getTasks() {
        if (this.master && this.master.getActiveTasks) {
            return this.master.getActiveTasks();
        }
        return { active: 0, queued: 0, completed: 0 };
    }

    _getPermissions() {
        if (this.master && this.master.permissionManager) {
            return this.master.permissionManager.getNetworkSummary();
        }
        return { users: 0, agents: 0 };
    }

    _getEarnings() {
        const agents = this._getAgentList();
        const tierStakes = [0, 100, 500, 2000, 10000, 50000];
        const tierMultipliers = [0.5, 1, 1.5, 2, 3, 5];
        let totalStaked = 0;
        let estimatedHourly = 0;

        agents.forEach(a => {
            totalStaked += tierStakes[a.tier] || 0;
            estimatedHourly += (tierMultipliers[a.tier] || 0.5) * (a.status === 'active' ? 1 : 0.3);
        });

        return {
            totalAgents: agents.length,
            activeAgents: agents.filter(a => a.status === 'active').length,
            totalStaked,
            estimatedHourly: estimatedHourly.toFixed(1),
            byCategory: {
                compute: agents.filter(a => a.category === 'compute').length,
                infrastructure: agents.filter(a => a.category === 'infrastructure').length,
                platform: agents.filter(a => a.category === 'platform').length,
            },
        };
    }

    _getSettings() {
        if (this.master && this.master.settingsManager) {
            return this.master.settingsManager.getAll();
        }
        return {};
    }

    async _handlePostSettings(req, res) {
        let body = "";
        for await (const chunk of req) body += chunk;
        try {
            const data = JSON.parse(body);
            if (this.master && this.master.settingsManager) {
                for (const [key, value] of Object.entries(data)) {
                    this.master.settingsManager.set(key, value);
                }
            }
            this._json(res, { success: true, message: "Settings updated" });
        } catch (e) {
            this._json(res, { error: e.message }, 400);
        }
    }

    // ===== AUTH HANDLERS =====

    async _handleLogin(req, res) {
        let body = "";
        for await (const chunk of req) body += chunk;
        try {
            const { address, role: requestedRole } = JSON.parse(body);
            if (!address || !address.startsWith("0x") || address.length < 10) {
                return this._json(res, { error: "Invalid wallet address" }, 400);
            }

            // Determine role: check registered wallets first, then use request
            let role = this.auth.getWalletRole(address) || requestedRole || "viewer";

            // Validate role
            if (!["admin", "operator", "viewer"].includes(role)) {
                role = "viewer";
            }

            // Generate token
            const token = this.auth.generateToken(address, role);
            const payload = this.auth.getPayload(token);

            console.log(`[Auth] Login: ${address.slice(0, 10)}... as ${role}`);

            this._json(res, {
                success: true,
                token,
                role,
                address,
                expiresAt: payload.exp,
                permissions: payload.perms,
            });
        } catch (e) {
            this._json(res, { error: "Invalid request body" }, 400);
        }
    }

    async _handleRegister(req, res) {
        let body = "";
        for await (const chunk of req) body += chunk;
        try {
            const { address, role } = JSON.parse(body);
            if (!address || !address.startsWith("0x") || address.length < 10) {
                return this._json(res, { error: "Invalid wallet address" }, 400);
            }
            if (!["admin", "operator", "viewer"].includes(role)) {
                return this._json(res, { error: "Invalid role (admin/operator/viewer)" }, 400);
            }

            // Only admin can register new wallets
            const authHeader = req.headers["authorization"];
            let callerIsAdmin = false;
            if (authHeader && authHeader.startsWith("Bearer ")) {
                callerIsAdmin = this.auth.hasPermission(authHeader.slice(7), "admin:roles");
            }

            // First registration is always admin (bootstrap)
            if (this.auth.knownWallets.size === 0) {
                callerIsAdmin = true;
            }

            if (!callerIsAdmin) {
                return this._json(res, { error: "Admin permission required to register wallets" }, 403);
            }

            this.auth.registerWallet(address, role);
            const token = this.auth.generateToken(address, role);
            const payload = this.auth.getPayload(token);

            this._json(res, {
                success: true,
                message: `Wallet registered as ${role}`,
                token,
                role,
                address,
                expiresAt: payload.exp,
                permissions: payload.perms,
            });
        } catch (e) {
            this._json(res, { error: "Invalid request body" }, 400);
        }
    }

    async _handleRefresh(req, res) {
        let body = "";
        for await (const chunk of req) body += chunk;
        try {
            const { token } = JSON.parse(body);
            if (!token) return this._json(res, { error: "Token required" }, 400);

            const newToken = this.auth.refreshToken(token);
            if (!newToken) {
                return this._json(res, { error: "Token refresh failed (invalid or expired)" }, 401);
            }

            const payload = this.auth.getPayload(newToken);
            this._json(res, {
                success: true,
                token: newToken,
                role: payload.role,
                address: payload.address,
                expiresAt: payload.exp,
            });
        } catch (e) {
            this._json(res, { error: "Invalid request body" }, 400);
        }
    }

    async _handleRevoke(req, res) {
        let body = "";
        for await (const chunk of req) body += chunk;
        try {
            const { token, address } = JSON.parse(body);

            if (token) {
                this.auth.revokeToken(token);
                return this._json(res, { success: true, message: "Token revoked" });
            }
            if (address) {
                this.auth.revokeAllForAddress(address);
                return this._json(res, { success: true, message: `All sessions revoked for ${address}` });
            }

            this._json(res, { error: "Token or address required" }, 400);
        } catch (e) {
            this._json(res, { error: "Invalid request body" }, 400);
        }
    }

    _json(res, data, status = 200) {
        res.statusCode = status;
        res.end(JSON.stringify(data, null, 2));
    }
}

module.exports = { DashboardServer };
