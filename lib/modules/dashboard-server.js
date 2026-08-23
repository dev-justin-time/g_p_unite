/**
 * DashboardServer — Lightweight HTTP server for real-time system monitoring
 *
 * Serves the live dashboard + JSON API for monitoring agents,
 * tiers, tasks, network health, and earnings — no external dependencies.
 */

const http = require("http");
const path = require("path");
const fs = require("fs");

class DashboardServer {
    constructor(masterAgent, config = {}) {
        this.master = masterAgent;
        this.port = config.port || 8080;
        this.host = config.host || "127.0.0.1";
        this.server = null;
        this._requestCount = 0;
        this._startTime = Date.now();
    }

    start() {
        this.server = http.createServer((req, res) => this._handleRequest(req, res));
        this.server.listen(this.port, this.host, () => {
            console.log(`[Dashboard] Listening on http://${this.host}:${this.port}`);
            console.log(`[Dashboard] Open http://${this.host}:${this.port}/dashboard.html for the live dashboard`);
        });
    }

    stop() {
        if (this.server) this.server.close();
    }

    async _handleRequest(req, res) {
        this._requestCount++;
        const url = new URL(req.url, `http://${req.headers.host}`);

        // Serve static files (dashboard.html, index.html, app.html, app.js)
        if (url.pathname === "/" || url.pathname === "/dashboard.html") {
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

        // CORS headers (localhost only)
        res.setHeader("Access-Control-Allow-Origin", `http://${this.host}:${this.port}`);
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

                case "/api/permissions":
                    return this._json(res, this._getPermissions());

                case "/api/health":
                    return this._json(res, {
                        status: "ok",
                        uptime: Math.floor((Date.now() - this._startTime) / 1000),
                        requests: this._requestCount,
                        timestamp: new Date().toISOString(),
                    });

                case "/api/earnings":
                    return this._json(res, this._getEarnings());

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
                            "GET /                   — Live dashboard (HTML)",
                            "GET /dashboard.html     — Live dashboard (HTML)",
                            "GET /index.html         — Agent swarm view",
                            "GET /api/status         — Full system status",
                            "GET /api/agents         — All 18 agents with metrics",
                            "GET /api/agents/:id     — Single agent detail",
                            "GET /api/tiers          — Tier rankings with agent lists",
                            "GET /api/tiers/:id      — Agents in a specific tier",
                            "GET /api/resources      — System resource usage",
                            "GET /api/tasks          — Active tasks",
                            "GET /api/permissions    — Permission summary",
                            "GET /api/health         — Server health",
                            "GET /api/settings       — All settings",
                            "POST /api/settings      — Update settings",
                            "GET /api/earnings       — Earnings summary",
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

    _json(res, data, status = 200) {
        res.statusCode = status;
        res.end(JSON.stringify(data, null, 2));
    }
}

module.exports = { DashboardServer };
