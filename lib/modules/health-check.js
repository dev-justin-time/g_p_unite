/**
 * HealthCheckServer — Lightweight HTTP health check for agent containers
 *
 * Endpoints:
 *   GET /health  — Full health report (200=healthy, 503=unhealthy)
 *   GET /ready   — Readiness probe (200=ready, 503=not ready)
 *   GET /live    — Liveness probe (200=alive, always)
 *   GET /        — Health check index
 *
 * Bind to 0.0.0.0 for container orchestrators (Docker, K8s).
 */

const http = require("http");

class HealthCheckServer {
  /**
   * @param {Object} config
   * @param {string} config.agentId - Agent identifier
   * @param {string} config.agentType - Agent type (inference, render, etc.)
   * @param {number} config.port - Health check port (default 8081)
   * @param {string} config.host - Bind host (default 0.0.0.0 for containers)
   * @param {Function} config.checkFn - Optional async health check function
   */
  constructor(config = {}) {
    this.agentId = config.agentId || "unknown";
    this.agentType = config.agentType || "unknown";
    this.port = config.port || 8081;
    this.host = config.host || "0.0.0.0";
    this.checkFn = config.checkFn || null;
    this.server = null;
    this._startTime = Date.now();
    this._ready = false;
    this._healthy = true;
    this._checks = {};
    this._requestCount = 0;
  }

  start() {
    this.server = http.createServer((req, res) => this._handleRequest(req, res));
    this.server.listen(this.port, this.host, () => {
      console.log(
        `[HealthCheck] ${this.agentId} (${this.agentType}) listening on ${this.host}:${this.port}`
      );
    });
    return this;
  }

  stop() {
    if (this.server) this.server.close();
  }

  /** Mark agent as ready (after initialization) */
  setReady(ready) {
    this._ready = ready;
  }

  /** Mark agent as healthy/unhealthy */
  setHealthy(healthy) {
    this._healthy = healthy;
  }

  /** Update a named health check */
  setCheck(name, ok, details) {
    this._checks[name] = { ok, details, timestamp: Date.now() };
  }

  async _handleRequest(req, res) {
    this._requestCount++;
    const url = new URL(req.url, `http://${req.headers.host}`);

    res.setHeader("Content-Type", "application/json; charset=utf-8");

    try {
      switch (url.pathname) {
        case "/health":
          return this._handleHealth(req, res);
        case "/ready":
          return this._handleReady(req, res);
        case "/live":
          return this._handleLive(req, res);
        default:
          return this._json(res, {
            service: "fcm-agent-health",
            agentId: this.agentId,
            agentType: this.agentType,
            endpoints: ["GET /health", "GET /ready", "GET /live"],
          });
      }
    } catch (e) {
      return this._json(res, { status: "error", error: e.message }, 500);
    }
  }

  async _handleHealth(req, res) {
    // Run custom health check if provided
    if (this.checkFn) {
      try {
        const result = await this.checkFn();
        Object.assign(this._checks, result);
      } catch (e) {
        this._checks.custom = { ok: false, details: e.message, timestamp: Date.now() };
      }
    }

    const allChecks = Object.values(this._checks);
    const allOk = this._healthy && allChecks.every((c) => c.ok);
    const status = allOk ? "healthy" : "unhealthy";
    const statusCode = allOk ? 200 : 503;

    return this._json(res, {
      status,
      agentId: this.agentId,
      agentType: this.agentType,
      uptime: Math.floor((Date.now() - this._startTime) / 1000),
      ready: this._ready,
      checks: this._checks,
      requests: this._requestCount,
      timestamp: new Date().toISOString(),
    }, statusCode);
  }

  async _handleReady(req, res) {
    const status = this._ready ? "ready" : "not_ready";
    const statusCode = this._ready ? 200 : 503;

    return this._json(res, {
      status,
      agentId: this.agentId,
      uptime: Math.floor((Date.now() - this._startTime) / 1000),
    }, statusCode);
  }

  async _handleLive(req, res) {
    // Liveness always returns 200 — if this fails, the container orchestrator restarts
    return this._json(res, {
      status: "alive",
      agentId: this.agentId,
      uptime: Math.floor((Date.now() - this._startTime) / 1000),
    });
  }

  _json(res, data, status = 200) {
    res.statusCode = status;
    res.end(JSON.stringify(data, null, 2));
  }
}

module.exports = { HealthCheckServer };
