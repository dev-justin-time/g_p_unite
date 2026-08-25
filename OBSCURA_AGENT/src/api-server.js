/**
 * Obscura Agent — API Server (Merged)
 * REST + WebSocket API with authentication, alerts, notifications, rate limiting
 * Combines search's full-featured server with agent's modular architecture
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// ─── Configuration ────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || process.env.OBSCURA_PORT || '3000');
const CDP_PORT = parseInt(process.env.CDP_PORT || process.env.OBSCURA_CDP || '9222');
const AUTH_ENABLED = process.env.OBSCURA_AUTH !== 'false';
const API_KEY = process.env.OBSCURA_API_KEY || '';
const ADMIN_KEY = process.env.OBSCURA_ADMIN_KEY || '';
const DATA_DIR = process.env.OBSCURA_DATA_DIR || path.join(__dirname, '..', 'data');

// ─── Data Files ───────────────────────────────────────────────
const SCHED_FILE = path.join(DATA_DIR, 'scheduled.json');
const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');
const NOTIF_FILE = path.join(DATA_DIR, 'notifications.json');
const MAX_NOTIFICATIONS = 500;

// ─── In-Memory Stores ─────────────────────────────────────────
const sessions = new Map();
const alertKeywords = new Map();
const scheduledSearches = new Map();
const notifications = [];
const wsClients = new Set();
const wsIPConnections = new Map();
const wsMessageBuckets = new Map();
const rateBuckets = new Map();

const SESSION_TTL = 24 * 60 * 60 * 1000;

// ─── Rate Limiting Config ─────────────────────────────────────
const RATE_LIMITS = {
  search:  { windowMs: 60_000, max: 20,  key: 'rl:search' },
  scrape:  { windowMs: 60_000, max: 10,  key: 'rl:scrape' },
  bulk:    { windowMs: 60_000, max: 3,   key: 'rl:bulk' },
  extract: { windowMs: 60_000, max: 15,  key: 'rl:extract' },
  alerts:  { windowMs: 60_000, max: 30,  key: 'rl:alerts' },
  general: { windowMs: 60_000, max: 60,  key: 'rl:general' },
};

const WS_RATE_LIMITS = {
  maxConnectionsPerIP: 5,
  maxConnectsPerMinute: 10,
  maxMessagesPerMinute: 60,
  maxMessageBytes: 8192,
  idleTimeoutMs: 300_000,
};

const ALERT_CHECK_INTERVAL = 60_000;

class APIServer {
  constructor(opts = {}) {
    this.port = opts.port || PORT;
    this.host = opts.host || '0.0.0.0';
    this._server = null;
    this._core = opts.core;
    this._searchEngine = opts.searchEngine || null;
    this._stealth = opts.stealth || null;
    this._proxyRotator = opts.proxyRotator || null;
    this._monitor = opts.monitor || null;
    this._extractor = opts.extractor || null;
    this._scraper = opts.scraper || null;
    this._cdp = opts.cdp || null;
    this._alertTimer = null;
  }

  async start() {
    this._ensureDataDir();
    this._loadPersisted();

    this._server = http.createServer(async (req, res) => {
      // CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

      const url = new URL(req.url, `http://localhost:${this.port}`);

      // Public endpoints
      const publicPaths = ['/api/obscura/auth/login', '/api/obscura/auth/logout', '/api/obscura/status', '/api/status', '/api/obscura/rate-limit/status', '/health'];
      const isPublic = publicPaths.includes(url.pathname);

      if (!isPublic) {
        const authResult = this._checkAuth(req);
        if (!authResult.ok) {
          this._json(res, 401, { error: authResult.error, code: 'UNAUTHORIZED' });
          return;
        }
        req._authRole = authResult.role;
      }

      try {
        await this._route(req, res, url);
      } catch (e) {
        console.error('API error:', e.message);
        this._json(res, 500, { error: e.message });
      }
    });

    // WebSocket upgrade
    this._server.on('upgrade', (req, socket) => this._handleWSUpgrade(req, socket));

    return new Promise((resolve) => {
      this._server.listen(this.port, this.host, () => {
        console.log(`  🕸️  Obscura API running on http://${this.host}:${this.port}`);
        console.log(`  📡  WebSocket: ws://${this.host}:${this.port}/ws`);
        console.log(`  🛡️  Auth: ${AUTH_ENABLED ? 'ON' : 'OFF'} | Stealth: ON`);
        this._startAlertCheck();
        resolve({ port: this.port, host: this.host });
      });
    });
  }

  async stop() {
    if (this._alertTimer) clearInterval(this._alertTimer);
    if (this._server) {
      this._server.close();
      this._server = null;
    }
  }

  // ─── Route Dispatcher ───────────────────────────────────────

  async _route(req, res, url) {
    const method = req.method;
    const path = url.pathname;
    let handled = false;

    // ── Auth ──
    if (method === 'POST' && path === '/api/obscura/auth/login') {
      handled = true;
      return this._authLogin(req, res);
    }
    if (method === 'POST' && path === '/api/obscura/auth/logout') {
      handled = true;
      return this._authLogout(req, res);
    }
    if (method === 'GET' && path === '/api/obscura/auth/me') {
      handled = true;
      return this._authMe(req, res);
    }

    // ── Status ──
    if ((method === 'GET' && path === '/api/obscura/status') || (method === 'GET' && path === '/api/status')) {
      handled = true;
      return this._status(req, res);
    }

    // ── Health ──
    if (method === 'GET' && path === '/health') {
      handled = true;
      return this._json(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
    }

    // ── Search ──
    if (method === 'POST' && path === '/api/obscura/search') {
      handled = true;
      return this._search(req, res, url);
    }

    // ── Scrape ──
    if (method === 'POST' && path === '/api/obscura/scrape') {
      handled = true;
      return this._scrape(req, res);
    }

    // ── Bulk Scrape ──
    if (method === 'POST' && path === '/api/obscura/bulk-scrape') {
      handled = true;
      return this._bulkScrape(req, res);
    }

    // ── Extract ──
    if (method === 'POST' && path === '/api/obscura/extract') {
      handled = true;
      return this._extract(req, res);
    }

    // ── Monitor ──
    if (method === 'POST' && path === '/api/obscura/monitor/check') {
      handled = true;
      return this._monitorCheck(req, res);
    }
    if (method === 'POST' && path === '/api/monitor/start') {
      handled = true;
      return this._monitorStart(req, res);
    }
    if (method === 'POST' && path === '/api/monitor/stop') {
      handled = true;
      return this._monitorStop(req, res);
    }

    // ── Screenshot ──
    if (method === 'GET' && path === '/api/screenshot') {
      handled = true;
      return this._screenshot(req, res, url);
    }

    // ── Proxy ──
    if (method === 'POST' && path === '/api/obscura/proxy/check') {
      handled = true;
      return this._proxyCheck(req, res);
    }
    if (method === 'POST' && path === '/api/proxy/rotate') {
      handled = true;
      return this._proxyRotate(req, res);
    }

    // ── Connect / Disconnect ──
    if (method === 'POST' && path === '/api/obscura/connect') {
      handled = true;
      return this._connect(req, res);
    }
    if (method === 'POST' && path === '/api/obscura/disconnect') {
      handled = true;
      return this._disconnect(req, res);
    }

    // ── Rate Limit Status ──
    if (method === 'GET' && path === '/api/obscura/rate-limit/status') {
      handled = true;
      return this._rateLimitStatus(req, res);
    }

    // ── WebSocket Status ──
    if (method === 'GET' && path === '/api/obscura/ws/status') {
      handled = true;
      return this._wsStatus(req, res);
    }

    // ── Batch (agent compat) ──
    if (method === 'POST' && path === '/api/batch') {
      handled = true;
      return this._batch(req, res);
    }

    // ── Alerts ──
    if (method === 'GET' && path === '/api/obscura/alerts') {
      handled = true;
      return this._alertsList(req, res);
    }
    if (method === 'POST' && path === '/api/obscura/alerts') {
      handled = true;
      return this._alertsAdd(req, res);
    }
    if (method === 'POST' && path === '/api/obscura/alerts/check') {
      handled = true;
      return this._alertsCheck(req, res);
    }
    if (method === 'DELETE' && path === '/api/obscura/alerts') {
      handled = true;
      return this._alertsDelete(req, res);
    }

    // ── Notifications ──
    if (method === 'GET' && path === '/api/obscura/notifications') {
      handled = true;
      return this._notificationsList(req, res, url);
    }
    if (method === 'POST' && path === '/api/obscura/notifications/read') {
      handled = true;
      return this._notificationsRead(req, res);
    }
    if (method === 'POST' && path === '/api/obscura/notifications/read-all') {
      handled = true;
      return this._notificationsReadAll(req, res);
    }
    if (method === 'DELETE' && path === '/api/obscura/notifications') {
      handled = true;
      return this._notificationsDelete(req, res);
    }
    if (method === 'DELETE' && path === '/api/obscura/notifications/clear') {
      handled = true;
      return this._notificationsClear(req, res);
    }

    // ── Scheduled Searches ──
    if (method === 'GET' && path === '/api/obscura/scheduled') {
      handled = true;
      return this._scheduledList(req, res);
    }
    if (method === 'POST' && path === '/api/obscura/scheduled') {
      handled = true;
      return this._scheduledAdd(req, res);
    }
    if (method === 'DELETE' && path === '/api/obscura/scheduled') {
      handled = true;
      return this._scheduledDelete(req, res);
    }
    if (method === 'POST' && path === '/api/obscura/scheduled/toggle') {
      handled = true;
      return this._scheduledToggle(req, res);
    }

    // ── Agent-specific routes ──
    if (method === 'GET' && path === '/api/screenshot') {
      handled = true;
      return this._screenshot(req, res, url);
    }

    if (!handled) {
      this._json(res, 404, { error: 'Not found', path: url.pathname });
    }
  }

  // ─── Route Handlers ─────────────────────────────────────────

  async _authLogin(req, res) {
    const body = await this._readBody(req);
    const { password, api_key } = JSON.parse(body);
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';

    if (api_key) {
      if (api_key === ADMIN_KEY) {
        const token = this._createSession(ip, 'admin');
        this._json(res, 200, { success: true, token, role: 'admin' });
      } else if (api_key === API_KEY) {
        const token = this._createSession(ip, 'user');
        this._json(res, 200, { success: true, token, role: 'user' });
      } else {
        this._json(res, 401, { error: 'Invalid API key' });
      }
    } else if (password) {
      if (password === ADMIN_KEY && ADMIN_KEY) {
        const token = this._createSession(ip, 'admin');
        this._json(res, 200, { success: true, token, role: 'admin' });
      } else if (password === API_KEY && API_KEY) {
        const token = this._createSession(ip, 'user');
        this._json(res, 200, { success: true, token, role: 'user' });
      } else {
        this._json(res, 401, { error: 'Invalid credentials' });
      }
    } else {
      this._json(res, 400, { error: 'password or api_key required' });
    }
  }

  _authLogout(req, res) {
    const auth = this._extractAuth(req);
    if (auth && auth.type === 'session') sessions.delete(auth.token);
    this._json(res, 200, { success: true });
  }

  _authMe(req, res) {
    const auth = this._extractAuth(req);
    const session = auth ? this._validateSession(auth.token) : null;
    if (session) {
      this._json(res, 200, { authenticated: true, role: session.role });
    } else {
      this._json(res, 200, { authenticated: false });
    }
  }

  _status(req, res) {
    const cdpConnected = this._cdp?.isConnected() || false;
    this._json(res, 200, {
      connected: cdpConnected,
      port: CDP_PORT,
      status: cdpConnected ? 'active' : 'standby',
      state: this._core?.state || 'idle',
      uptime: this._core?.metrics?.uptime || 0,
      metrics: this._core?.metrics || {},
      proxies: this._proxyRotator?.stats() || { total: 0 },
      monitors: this._monitor?.list() || [],
      modules: Object.keys(this._core?._modules || {}),
      stealthActive: true
    });
  }

  async _search(req, res, url) {
    const clientIP = this._getClientIP(req);
    const rl = this._rateLimitCheck(clientIP, 'search');
    this._setRateLimitHeaders(res, rl);
    if (!rl.allowed) return this._json(res, 429, { error: 'Search rate limit exceeded', retryAfter: rl.retryAfter });

    const body = await this._readBody(req);
    const { query, engine: eng = 'duckduckgo', limit = 25, region = 'wt-wt', stealth: useStealth = true, dedup = true } = JSON.parse(body);
    if (!query) return this._json(res, 400, { error: 'query required' });

    const proxy = useStealth ? this._proxyRotator?.next() : null;
    const results = await this._searchEngine.search(query, { engine: eng, limit, region, proxy });
    const deduped = dedup ? this._searchEngine.deduplicate(results) : results;
    this._json(res, 200, { results: deduped, total: deduped.length, engine: eng });
  }

  async _scrape(req, res) {
    const clientIP = this._getClientIP(req);
    const rl = this._rateLimitCheck(clientIP, 'scrape');
    this._setRateLimitHeaders(res, rl);
    if (!rl.allowed) return this._json(res, 429, { error: 'Scrape rate limit exceeded', retryAfter: rl.retryAfter });

    const body = await this._readBody(req);
    const opts = JSON.parse(body);
    if (!opts.url) return this._json(res, 400, { error: 'url required' });

    if (this._stealth && !this._stealth.validateURL(opts.url)) {
      return this._json(res, 400, { error: 'URL blocked by SSRF protection' });
    }

    const proxy = opts.stealth ? this._proxyRotator?.next() : null;
    const result = await this._searchEngine.scrapeURL(opts.url, { ...opts, proxy });
    this._json(res, 200, result);
  }

  async _bulkScrape(req, res) {
    const clientIP = this._getClientIP(req);
    const rl = this._rateLimitCheck(clientIP, 'bulk');
    this._setRateLimitHeaders(res, rl);
    if (!rl.allowed) return this._json(res, 429, { error: 'Bulk scrape rate limit exceeded', retryAfter: rl.retryAfter });

    const body = await this._readBody(req);
    const { urls, dump = 'text', concurrency = 3 } = JSON.parse(body);
    if (!Array.isArray(urls) || urls.length === 0) return this._json(res, 400, { error: 'urls array required' });

    const results = [];
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(batch.map(async (u) => {
        if (this._stealth && !this._stealth.validateURL(u)) {
          return { url: u, error: 'Blocked by SSRF protection', status: 'blocked' };
        }
        const proxy = this._proxyRotator?.next();
        const result = await this._searchEngine.scrapeURL(u, { dump, proxy, timeout: 30 });
        return { url: u, output: result.output || '', status: 'ok' };
      }));
      batchResults.forEach((r, idx) => {
        if (r.status === 'fulfilled') results.push(r.value);
        else results.push({ url: batch[idx], error: r.reason?.message || 'Failed', status: 'error' });
      });
    }
    this._json(res, 200, { results, total: results.length, completed: results.filter(r => r.status === 'ok').length });
  }

  async _extract(req, res) {
    const clientIP = this._getClientIP(req);
    const rl = this._rateLimitCheck(clientIP, 'extract');
    this._setRateLimitHeaders(res, rl);
    if (!rl.allowed) return this._json(res, 429, { error: 'Extract rate limit exceeded', retryAfter: rl.retryAfter });

    const body = await this._readBody(req);
    const { url: targetUrl, schema = {} } = JSON.parse(body);
    if (!targetUrl) return this._json(res, 400, { error: 'url required' });

    const proxy = this._proxyRotator?.next();
    const extracted = await this._searchEngine.extractData(targetUrl, schema, { proxy });
    this._json(res, 200, { extracted });
  }

  async _monitorCheck(req, res) {
    const body = await this._readBody(req);
    const { url: monitorUrl } = JSON.parse(body);
    const result = await this._searchEngine.scrapeURL(monitorUrl, { dump: 'text' });
    this._json(res, 200, { text: result.output || result.text || '', timestamp: Date.now() });
  }

  _monitorStart(req, res) {
    if (!this._monitor) return this._json(res, 500, { error: 'Monitor not loaded' });
    const body = req._body || {};
    if (!body.url) return this._json(res, 400, { error: 'url required' });
    const result = this._monitor.start(body.url, body.interval || 60000);
    this._json(res, 200, result);
  }

  _monitorStop(req, res) {
    if (!this._monitor) return this._json(res, 500, { error: 'Monitor not loaded' });
    const body = req._body || {};
    const result = this._monitor.stop(body.url);
    this._json(res, 200, result);
  }

  async _screenshot(req, res, url) {
    if (!this._cdp || !this._cdp.isConnected()) return this._json(res, 500, { error: 'CDP not connected' });
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) return this._json(res, 400, { error: 'url param required' });
    await this._cdp.navigate(targetUrl);
    const screenshot = await this._cdp.screenshot(url.searchParams.get('format') || 'png');
    this._json(res, 200, { url: targetUrl, screenshot: screenshot ? `data:image/png;base64,${screenshot}` : null });
  }

  async _proxyCheck(req, res) {
    const body = await this._readBody(req);
    const { url: proxyUrl } = JSON.parse(body);
    const ok = await this._proxyRotator.checkProxy(proxyUrl);
    this._json(res, 200, { ok, url: proxyUrl });
  }

  _proxyRotate(req, res) {
    const p = this._proxyRotator?.next();
    this._json(res, 200, { proxy: p?.url || p || null });
  }

  async _connect(req, res) {
    if (req._authRole !== 'admin') return this._json(res, 403, { error: 'Admin access required' });
    const body = await this._readBody(req);
    const { port = CDP_PORT } = JSON.parse(body);
    this._json(res, 200, { success: true, port, connected: true });
  }

  _disconnect(req, res) {
    if (req._authRole !== 'admin') return this._json(res, 403, { error: 'Admin access required' });
    this._json(res, 200, { success: true });
  }

  async _batch(req, res) {
    if (!this._scraper) return this._json(res, 500, { error: 'Scraper not loaded' });
    const body = await this._readBody(req);
    const { urls, concurrency } = JSON.parse(body);
    if (!urls?.length) return this._json(res, 400, { error: 'urls array required' });
    const results = await this._scraper.scrapeBatch(urls, { concurrency });
    this._json(res, 200, { count: results.length, results });
  }

  // ─── Rate Limit Status ──────────────────────────────────────

  _rateLimitStatus(req, res) {
    const clientIP = this._getClientIP(req);
    const status = {};
    for (const [category, config] of Object.entries(RATE_LIMITS)) {
      const bucketKey = `${config.key}:${clientIP}`;
      const bucket = rateBuckets.get(bucketKey);
      const now = Date.now();
      if (bucket && now <= bucket.resetAt) {
        status[category] = { limit: config.max, remaining: Math.max(0, config.max - bucket.count), resetIn: Math.ceil((bucket.resetAt - now) / 1000) };
      } else {
        status[category] = { limit: config.max, remaining: config.max, resetIn: 0 };
      }
    }
    this._json(res, 200, { ip: clientIP, limits: RATE_LIMITS, current: status });
  }

  // ─── WebSocket Status ───────────────────────────────────────

  _wsStatus(req, res) {
    const ipStats = {};
    for (const [ip, entry] of wsIPConnections) {
      ipStats[ip] = { connections: entry.count, recentAttempts: entry.connects.length };
    }
    this._json(res, 200, { clients: wsClients.size, rateLimits: WS_RATE_LIMITS, ipStats, messageBuckets: wsMessageBuckets.size });
  }

  // ─── Alerts ─────────────────────────────────────────────────

  _alertsList(req, res) {
    this._json(res, 200, { alerts: Array.from(alertKeywords.values()) });
  }

  async _alertsAdd(req, res) {
    const body = await this._readBody(req);
    const { keywords = [], engine: eng = 'duckduckgo', limit = 10 } = JSON.parse(body);
    if (keywords.length === 0) return this._json(res, 400, { error: 'keywords required' });
    const id = Date.now();
    const alert = { id, keywords, engine: eng, limit, lastResults: [], createdAt: new Date().toISOString() };
    alertKeywords.set(id, alert);
    this._saveAlerts();
    this._json(res, 200, alert);
  }

  async _alertsCheck(req, res) {
    const body = await this._readBody(req);
    const { id: alertId } = JSON.parse(body);
    const alert = alertKeywords.get(alertId);
    if (!alert) return this._json(res, 404, { error: 'Alert not found' });

    const allResults = [];
    for (const kw of alert.keywords) {
      const results = await this._searchEngine.search(kw, { engine: alert.engine, limit: alert.limit });
      allResults.push(...results);
    }
    const deduped = this._searchEngine.deduplicate(allResults);
    alert.lastResults = deduped;
    this._saveAlerts();
    const notif = this._addNotification({ alertId: alert.id, keywords: alert.keywords, type: 'check', results: deduped, count: deduped.length });
    this._wsBroadcast({ type: 'notification', notification: notif });
    this._json(res, 200, { alert, results: deduped, total: deduped.length });
  }

  async _alertsDelete(req, res) {
    const body = await this._readBody(req);
    const { id: alertId } = JSON.parse(body);
    alertKeywords.delete(alertId);
    this._saveAlerts();
    this._json(res, 200, { success: true });
  }

  // ─── Notifications ──────────────────────────────────────────

  _notificationsList(req, res, url) {
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const unreadOnly = url.searchParams.get('unread') === 'true';
    let filtered = notifications;
    if (unreadOnly) filtered = filtered.filter(n => !n.read);
    this._json(res, 200, { notifications: filtered.slice(0, limit), total: notifications.length, unread: notifications.filter(n => !n.read).length });
  }

  async _notificationsRead(req, res) {
    const body = await this._readBody(req);
    const { id: notifId } = JSON.parse(body);
    const notif = notifications.find(n => n.id === notifId);
    if (notif) notif.read = true;
    this._saveNotifications();
    this._json(res, 200, { success: true });
  }

  _notificationsReadAll(req, res) {
    notifications.forEach(n => n.read = true);
    this._saveNotifications();
    this._json(res, 200, { success: true });
  }

  async _notificationsDelete(req, res) {
    const body = await this._readBody(req);
    const { id: notifId } = JSON.parse(body);
    const idx = notifications.findIndex(n => n.id === notifId);
    if (idx >= 0) notifications.splice(idx, 1);
    this._saveNotifications();
    this._json(res, 200, { success: true });
  }

  _notificationsClear(req, res) {
    notifications.length = 0;
    this._saveNotifications();
    this._json(res, 200, { success: true });
  }

  // ─── Scheduled Searches ─────────────────────────────────────

  _scheduledList(req, res) {
    this._json(res, 200, { scheduled: Array.from(scheduledSearches.values()).map(this._sanitizeSched) });
  }

  async _scheduledAdd(req, res) {
    const body = await this._readBody(req);
    const { query, engine: eng = 'duckduckgo', interval = 300, limit = 25 } = JSON.parse(body);
    if (!query) return this._json(res, 400, { error: 'query required' });
    const id = Date.now();
    const sched = { id, query, engine: eng, interval, limit, active: true, lastRun: null, results: [], createdAt: new Date().toISOString() };
    scheduledSearches.set(id, sched);

    sched._timer = setInterval(async () => {
      try {
        const results = await this._searchEngine.search(sched.query, { engine: sched.engine, limit: sched.limit });
        sched.lastRun = new Date().toISOString();
        sched.results = this._searchEngine.deduplicate(results);
        this._saveScheduled();
      } catch (e) {}
    }, sched.interval * 1000);

    this._saveScheduled();
    this._json(res, 200, this._sanitizeSched(sched));
  }

  async _scheduledDelete(req, res) {
    const body = await this._readBody(req);
    const { id: schedId } = JSON.parse(body);
    const sched = scheduledSearches.get(schedId);
    if (sched && sched._timer) clearInterval(sched._timer);
    scheduledSearches.delete(schedId);
    this._saveScheduled();
    this._json(res, 200, { success: true });
  }

  async _scheduledToggle(req, res) {
    const body = await this._readBody(req);
    const { id: schedId } = JSON.parse(body);
    const sched = scheduledSearches.get(schedId);
    if (!sched) return this._json(res, 404, { error: 'Not found' });
    sched.active = !sched.active;
    if (sched.active) {
      sched._timer = setInterval(async () => {
        try {
          const results = await this._searchEngine.search(sched.query, { engine: sched.engine, limit: sched.limit });
          sched.lastRun = new Date().toISOString();
          sched.results = this._searchEngine.deduplicate(results);
          this._saveScheduled();
        } catch (e) {}
      }, sched.interval * 1000);
    } else {
      if (sched._timer) clearInterval(sched._timer);
      sched._timer = null;
    }
    this._saveScheduled();
    this._json(res, 200, this._sanitizeSched(sched));
  }

  // ─── Authentication Helpers ─────────────────────────────────

  _createSession(ip, role = 'admin') {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { ip, role, createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL });
    return token;
  }

  _validateSession(token) {
    if (!token) return null;
    const session = sessions.get(token);
    if (!session) return null;
    if (Date.now() > session.expiresAt) { sessions.delete(token); return null; }
    return session;
  }

  _extractAuth(req) {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
    if (authHeader.startsWith('Bearer ')) return { type: 'session', token: authHeader.slice(7).trim() };
    if (authHeader.startsWith('ApiKey ')) return { type: 'apikey', key: authHeader.slice(7).trim() };
    try {
      const url = new URL(req.url, `http://localhost:${this.port}`);
      const tokenParam = url.searchParams.get('token');
      if (tokenParam) return { type: 'session', token: tokenParam };
      const keyParam = url.searchParams.get('api_key');
      if (keyParam) return { type: 'apikey', key: keyParam };
    } catch (e) {}
    return null;
  }

  _checkAuth(req, requiredRole = 'user') {
    if (!AUTH_ENABLED) return { ok: true, role: 'admin' };
    const auth = this._extractAuth(req);
    if (!auth) return { ok: false, error: 'Authentication required' };
    if (auth.type === 'session') {
      const session = this._validateSession(auth.token);
      if (!session) return { ok: false, error: 'Invalid or expired session' };
      if (requiredRole === 'admin' && session.role !== 'admin') return { ok: false, error: 'Admin access required' };
      return { ok: true, role: session.role };
    }
    if (auth.type === 'apikey') {
      if (auth.key === ADMIN_KEY) return { ok: true, role: 'admin' };
      if (auth.key === API_KEY) return { ok: true, role: 'user' };
      return { ok: false, error: 'Invalid API key' };
    }
    return { ok: false, error: 'Invalid auth format' };
  }

  // ─── Rate Limiting ──────────────────────────────────────────

  _rateLimitCheck(identifier, category) {
    const config = RATE_LIMITS[category] || RATE_LIMITS.general;
    const bucketKey = `${config.key}:${identifier}`;
    const now = Date.now();
    let bucket = rateBuckets.get(bucketKey);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + config.windowMs };
      rateBuckets.set(bucketKey, bucket);
    }
    bucket.count++;
    const remaining = Math.max(0, config.max - bucket.count);
    const retryAfter = bucket.count > config.max ? Math.ceil((bucket.resetAt - now) / 1000) : 0;
    return { allowed: bucket.count <= config.max, limit: config.max, remaining, resetAt: bucket.resetAt, retryAfter };
  }

  _setRateLimitHeaders(res, rl) {
    res.setHeader('X-RateLimit-Limit', rl.limit);
    res.setHeader('X-RateLimit-Remaining', rl.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(rl.resetAt / 1000));
    if (!rl.allowed) res.setHeader('Retry-After', rl.retryAfter);
  }

  // ─── WebSocket ──────────────────────────────────────────────

  _handleWSUpgrade(req, socket) {
    const url = new URL(req.url, `http://localhost:${this.port}`);
    if (url.pathname !== '/ws') { socket.destroy(); return; }

    const clientIP = this._getClientIP(req);

    // Auth
    if (AUTH_ENABLED) {
      const auth = this._extractAuth(req);
      if (!auth) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }
      let valid = false;
      if (auth.type === 'session') valid = !!this._validateSession(auth.token);
      else if (auth.type === 'apikey') valid = auth.key === API_KEY || auth.key === ADMIN_KEY;
      if (!valid) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }
    }

    // Rate limit
    const rateCheck = this._wsRateCheckConnect(clientIP);
    if (!rateCheck.ok) {
      socket.write('HTTP/1.1 429 Too Many Requests\r\nRetry-After: 60\r\n\r\n');
      socket.destroy();
      return;
    }

    const wsSocket = this._wsHandshake(req, socket);
    if (!wsSocket) return;

    const client = { socket: wsSocket, id: Date.now(), ip: clientIP, lastActivity: Date.now(), subscribed: false, keywordFilter: null };
    wsClients.add(client);

    wsSocket.write(this._wsEncode({ type: 'connected', clientId: client.id, timestamp: new Date().toISOString() }));

    // Idle timeout
    let idleTimer = setTimeout(() => {
      wsSocket.write(this._wsEncode({ type: 'error', message: 'Idle timeout' }));
      wsSocket.end(Buffer.from([0x88, 0x02, 0x03, 0xe8]));
      wsClients.delete(client);
      this._wsRateDecrementIP(clientIP);
    }, WS_RATE_LIMITS.idleTimeoutMs);
    client._idleTimer = idleTimer;

    let buffer = Buffer.alloc(0);
    wsSocket.on('data', (chunk) => {
      client.lastActivity = Date.now();
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        wsSocket.write(this._wsEncode({ type: 'error', message: 'Idle timeout' }));
        wsSocket.end(Buffer.from([0x88, 0x02, 0x03, 0xe8]));
        wsClients.delete(client);
        this._wsRateDecrementIP(clientIP);
      }, WS_RATE_LIMITS.idleTimeoutMs);
      client._idleTimer = idleTimer;

      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 2) {
        const result = this._wsDecode(buffer);
        if (!result || result.totalLen > buffer.length) break;
        buffer = buffer.slice(result.totalLen);

        if (result.opcode === 0x08) {
          clearTimeout(idleTimer);
          wsSocket.end();
          wsClients.delete(client);
          this._wsRateDecrementIP(clientIP);
          return;
        }
        if (result.opcode === 0x01) {
          if (Buffer.byteLength(result.payload) > WS_RATE_LIMITS.maxMessageBytes) {
            wsSocket.write(this._wsEncode({ type: 'error', message: 'Message too large (max 8KB)' }));
            continue;
          }
          try {
            const msg = JSON.parse(result.payload);
            if (msg.type === 'ping') {
              wsSocket.write(this._wsEncode({ type: 'pong', timestamp: new Date().toISOString() }));
            } else if (msg.type === 'subscribe:alerts') {
              client.subscribed = true;
              client.keywordFilter = Array.isArray(msg.keywords) && msg.keywords.length > 0 ? msg.keywords.map(k => k.toLowerCase()) : null;
              wsSocket.write(this._wsEncode({ type: 'subscribed', channel: 'alerts', keywordFilter: client.keywordFilter }));
            } else if (msg.type === 'update:filter') {
              client.keywordFilter = Array.isArray(msg.keywords) && msg.keywords.length > 0 ? msg.keywords.map(k => k.toLowerCase()) : null;
              wsSocket.write(this._wsEncode({ type: 'filter:updated', keywordFilter: client.keywordFilter }));
            }
          } catch (e) {}
        }
      }
    });

    wsSocket.on('close', () => {
      clearTimeout(client._idleTimer);
      wsClients.delete(client);
      this._wsRateDecrementIP(clientIP);
    });
    wsSocket.on('error', () => { wsClients.delete(client); });
  }

  _wsHandshake(req, socket) {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return null; }
    const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-5AB5DC65C740').digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    return socket;
  }

  _wsEncode(data) {
    const payload = Buffer.from(JSON.stringify(data));
    const len = payload.length;
    let header;
    if (len < 126) { header = Buffer.alloc(2); header[0] = 0x81; header[1] = len; }
    else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2); }
    else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
    return Buffer.concat([header, payload]);
  }

  _wsDecode(buffer) {
    if (buffer.length < 2) return null;
    const opcode = buffer[0] & 0x0f;
    const masked = (buffer[1] & 0x80) !== 0;
    let payloadLen = buffer[1] & 0x7f;
    let offset = 2;
    if (payloadLen === 126) { payloadLen = buffer.readUInt16BE(2); offset = 4; }
    else if (payloadLen === 127) { payloadLen = Number(buffer.readBigUInt64BE(2)); offset = 10; }
    if (masked) {
      const mask = buffer.slice(offset, offset + 4); offset += 4;
      const data = buffer.slice(offset, offset + payloadLen);
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i % 4];
      return { opcode, payload: data.toString(), totalLen: offset + payloadLen };
    }
    return { opcode, payload: buffer.slice(offset, offset + payloadLen).toString(), totalLen: offset + payloadLen };
  }

  _wsBroadcast(data) {
    const msg = this._wsEncode(data);
    for (const client of wsClients) {
      if (!client.subscribed) continue;
      if (client.keywordFilter && client.keywordFilter.length > 0) {
        const dataStr = JSON.stringify(data).toLowerCase();
        if (!client.keywordFilter.some(kw => dataStr.includes(kw))) continue;
      }
      try { client.socket.write(msg); } catch (e) { wsClients.delete(client); }
    }
  }

  _wsRateCheckConnect(ip) {
    const now = Date.now();
    let entry = wsIPConnections.get(ip);
    if (!entry) { entry = { count: 0, connects: [] }; wsIPConnections.set(ip, entry); }
    entry.connects = entry.connects.filter(t => now - t < 60_000);
    if (entry.count >= WS_RATE_LIMITS.maxConnectionsPerIP) return { ok: false };
    if (entry.connects.length >= WS_RATE_LIMITS.maxConnectsPerMinute) return { ok: false };
    entry.connects.push(now);
    entry.count++;
    return { ok: true };
  }

  _wsRateDecrementIP(ip) {
    const entry = wsIPConnections.get(ip);
    if (entry) {
      entry.count = Math.max(0, entry.count - 1);
      if (entry.count === 0) wsIPConnections.delete(ip);
    }
  }

  // ─── Notifications Store ────────────────────────────────────

  _addNotification({ alertId, keywords, type, results, count }) {
    const notif = {
      id: Date.now() + Math.random(),
      alertId, keywords, type,
      results: (results || []).slice(0, 10),
      count, read: false,
      timestamp: new Date().toISOString()
    };
    notifications.unshift(notif);
    if (notifications.length > MAX_NOTIFICATIONS) notifications.length = MAX_NOTIFICATIONS;
    this._saveNotifications();
    return notif;
  }

  // ─── Alert Auto-Check ───────────────────────────────────────

  _startAlertCheck() {
    this._alertTimer = setInterval(async () => {
      if (wsClients.size === 0 || alertKeywords.size === 0) return;
      for (const [id, alert] of alertKeywords) {
        try {
          const allResults = [];
          for (const kw of alert.keywords) {
            const results = await this._searchEngine.search(kw, { engine: alert.engine, limit: alert.limit || 10 });
            allResults.push(...results);
          }
          const deduped = this._searchEngine.deduplicate(allResults);
          const prevCount = (alert.lastResults || []).length;
          const newCount = deduped.length;
          if (prevCount > 0 && newCount > prevCount) {
            const notif = this._addNotification({ alertId: id, keywords: alert.keywords, type: 'new', results: deduped.slice(0, newCount - prevCount), count: newCount - prevCount });
            this._wsBroadcast({ type: 'notification', notification: notif });
          } else if (prevCount === 0 && newCount > 0) {
            const notif = this._addNotification({ alertId: id, keywords: alert.keywords, type: 'first', results: deduped, count: newCount });
            this._wsBroadcast({ type: 'notification', notification: notif });
          }
          alert.lastResults = deduped;
        } catch (e) {}
      }
    }, ALERT_CHECK_INTERVAL);
  }

  // ─── Persistence ────────────────────────────────────────────

  _ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  _saveNotifications() {
    try { fs.writeFileSync(NOTIF_FILE, JSON.stringify(notifications, null, 2)); } catch (e) {}
  }

  _loadNotifications() {
    try {
      if (!fs.existsSync(NOTIF_FILE)) return;
      const data = JSON.parse(fs.readFileSync(NOTIF_FILE, 'utf8'));
      notifications.push(...data);
    } catch (e) {}
  }

  _saveAlerts() {
    try { fs.writeFileSync(ALERTS_FILE, JSON.stringify(Array.from(alertKeywords.values()), null, 2)); } catch (e) {}
  }

  _loadAlerts() {
    try {
      if (!fs.existsSync(ALERTS_FILE)) return;
      const data = JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8'));
      for (const a of data) alertKeywords.set(a.id, a);
    } catch (e) {}
  }

  _saveScheduled() {
    try { fs.writeFileSync(SCHED_FILE, JSON.stringify(Array.from(scheduledSearches.values()).map(this._sanitizeSched), null, 2)); } catch (e) {}
  }

  _loadScheduled() {
    try {
      if (!fs.existsSync(SCHED_FILE)) return;
      const data = JSON.parse(fs.readFileSync(SCHED_FILE, 'utf8'));
      for (const s of data) {
        scheduledSearches.set(s.id, { ...s, _timer: null });
        if (s.active) {
          const sched = scheduledSearches.get(s.id);
          sched._timer = setInterval(async () => {
            try {
              const results = await this._searchEngine.search(sched.query, { engine: sched.engine, limit: sched.limit });
              sched.lastRun = new Date().toISOString();
              sched.results = this._searchEngine.deduplicate(results);
              this._saveScheduled();
            } catch (e) {}
          }, sched.interval * 1000);
        }
      }
    } catch (e) {}
  }

  _loadPersisted() {
    this._loadAlerts();
    this._loadScheduled();
    this._loadNotifications();
  }

  // ─── Utility ────────────────────────────────────────────────

  _json(res, code, data) {
    const body = JSON.stringify(data);
    res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
  }

  _readBody(req) {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', c => body += c.toString());
      req.on('end', () => resolve(body));
    });
  }

  _getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress?.replace(/^::ffff:/, '') || 'anon';
  }

  _sanitizeSched(s) {
    const { _timer, ...rest } = s;
    return rest;
  }
}

module.exports = { APIServer };
