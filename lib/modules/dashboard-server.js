/**
 * DashboardServer — Lightweight HTTP server for real-time system monitoring
 *
 * Serves a JSON API + optional static dashboard for monitoring agents,
 * tasks, network health, and earnings — no external dependencies.
 */

const http = require("http");
const path = require("path");
const fs = require("fs");

class DashboardServer {
    constructor(masterAgent, config = {}) {
        this.master = masterAgent;
        this.port = config.port || 8080;
        this.host = config.host || "127.0.0.1"; // M-10: Bind to localhost only
        this.server = null;
        this._requestCount = 0;
    }

    start() {
        this.server = http.createServer((req, res) => this._handleRequest(req, res));
        this.server.listen(this.port, this.host, () => {
            console.log(`[Dashboard] Listening on http://${this.host}:${this.port}`);
        });
    }

    stop() {
        if (this.server) this.server.close();
    }

    async _handleRequest(req, res) {
        this._requestCount++;

        // CORS headers (localhost only)
        res.setHeader("Access-Control-Allow-Origin", `http://${this.host}:${this.port}`);
        res.setHeader("Content-Type", "application/json");

        try {
            const url = new URL(req.url, `http://${req.headers.host}`);

            switch (url.pathname) {
                case "/api/status":
                    return this._json(res, this.master.getFullStatus());

                case "/api/agents":
                    return this._json(res, this.master.getAgents());

                case "/api/resources":
                    return this._json(res, this.master.resourceAnalyzer.getUsage());

                case "/api/tasks":
                    return this._json(res, this.master.getActiveTasks());

                case "/api/permissions":
                    return this._json(res, this.master.permissionManager.getNetworkSummary());

                case "/api/health":
                    return this._json(res, {
                        status: "ok",
                        uptime: Math.floor((Date.now() - this.master.startTime) / 1000),
                        requests: this._requestCount,
                        timestamp: new Date().toISOString(),
                    });

                case "/api/settings":
                    if (req.method === "GET") {
                        return this._json(res, this.master.settingsManager.getAll());
                    }
                    if (req.method === "POST") {
                        return this._handlePostSettings(req, res);
                    }
                    return this._json(res, { error: "Method not allowed" }, 405);

                case "/api/earnings":
                    return this._json(res, this._getEarningsSummary());

                default:
                    return this._json(res, {
                        endpoints: [
                            "GET /api/status — Full system status",
                            "GET /api/agents — Registered agents",
                            "GET /api/resources — System resources",
                            "GET /api/tasks — Active tasks",
                            "GET /api/permissions — Permission summary",
                            "GET /api/health — Server health",
                            "GET /api/settings — All settings",
                            "POST /api/settings — Update settings",
                            "GET /api/earnings — Earnings summary",
                        ],
                    });
            }
        } catch (e) {
            this._json(res, { error: e.message }, 500);
        }
    }

    async _handlePostSettings(req, res) {
        let body = "";
        for await (const chunk of req) body += chunk;
        try {
            const data = JSON.parse(body);
            for (const [key, value] of Object.entries(data)) {
                this.master.settingsManager.set(key, value);
            }
            this._json(res, { success: true, message: "Settings updated" });
        } catch (e) {
            this._json(res, { error: e.message }, 400);
        }
    }

    _getEarningsSummary() {
        const agents = [...this.master.agents.values()];
        const stakeByType = {};
        for (const a of agents) {
            stakeByType[a.type] = (stakeByType[a.type] || 0) + a.stake;
        }
        return {
            totalAgents: agents.length,
            activeAgents: agents.filter(a => a.active).length,
            stakeByType,
            estimatedHourly: {
                inference: agents.filter(a => a.type === "inference" && a.active).length * 2.5,
                render: agents.filter(a => a.type === "render" && a.active).length * 1.0,
                node: agents.filter(a => a.type === "node" && a.active).length * 1.0,
                storage: agents.filter(a => a.type === "storage" && a.active).length * 0.05,
                file_server: agents.filter(a => a.type === "file_server" && a.active).length * 0.02,
            },
        };
    }

    _json(res, data, status = 200) {
        res.statusCode = status;
        res.end(JSON.stringify(data, null, 2));
    }
}

module.exports = { DashboardServer };
