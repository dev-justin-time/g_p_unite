/**
 * Obscura Search — API Server
 * Proxies requests to Obscura browser, manages proxy pool
 * WebSocket for real-time alert notifications
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { SearchEngine } = require('./engine');
const { ProxyRotator } = require('./proxy-rotator');
const { StealthManager } = require('./stealth');

const PORT = parseInt(process.env.OBSCURA_PORT || '3001');
const CDP_PORT = parseInt(process.env.OBSCURA_CDP || '9222');
const AUTH_ENABLED = process.env.OBSCURA_AUTH !== 'false';
const API_KEY = process.env.OBSCURA_API_KEY || ''; // master API key
const ADMIN_KEY = process.env.OBSCURA_ADMIN_KEY || ''; // admin API key

const engine = new SearchEngine();
const proxyRotator = new ProxyRotator();
const stealth = new StealthManager();

let cdpConnected = false;

// ─── Authentication ──────────────────────────────────────────
const sessions = new Map(); // token -> { ip, role, createdAt, expiresAt }
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createSession(ip, role = 'admin') {
  const token = generateToken();
  sessions.set(token, {
    ip,
    role,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL
  });
  return token;
}

function validateSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function extractAuth(req) {
  // Check Authorization header: Bearer <token> or ApiKey <key>
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    return { type: 'session', token: authHeader.slice(7).trim() };
  }
  if (authHeader.startsWith('ApiKey ')) {
    return { type: 'apikey', key: authHeader.slice(7).trim() };
  }
  // Check query parameter
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const tokenParam = url.searchParams.get('token');
    if (tokenParam) return { type: 'session', token: tokenParam };
    const keyParam = url.searchParams.get('api_key');
    if (keyParam) return { type: 'apikey', key: keyParam };
  } catch (e) { /* ignore parse errors */ }
  return null;
}

function checkAuth(req, requiredRole = 'user') {
  if (!AUTH_ENABLED) return { ok: true, role: 'admin' };

  const auth = extractAuth(req);
  if (!auth) return { ok: false, error: 'Authentication required' };

  if (auth.type === 'session') {
    const session = validateSession(auth.token);
    if (!session) return { ok: false, error: 'Invalid or expired session' };
    if (requiredRole === 'admin' && session.role !== 'admin') {
      return { ok: false, error: 'Admin access required' };
    }
    return { ok: true, role: session.role };
  }

  if (auth.type === 'apikey') {
    if (auth.key === ADMIN_KEY) return { ok: true, role: 'admin' };
    if (auth.key === API_KEY) return { ok: true, role: requiredRole === 'admin' ? 'user' : 'user' };
    return { ok: false, error: 'Invalid API key' };
  }

  return { ok: false, error: 'Invalid auth format' };
}

function cleanupSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now > session.expiresAt) sessions.delete(token);
  }
}
setInterval(cleanupSessions, 60_000);

// ─── Data Persistence ────────────────────────────────────────
const DATA_DIR = process.env.OBSCURA_DATA_DIR || path.join(__dirname, 'data');
const SCHED_FILE = path.join(DATA_DIR, 'scheduled.json');
const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');
const NOTIF_FILE = path.join(DATA_DIR, 'notifications.json');
const MAX_NOTIFICATIONS = 500; // keep last 500 notifications

// ─── Notifications Store ─────────────────────────────────────
const notifications = []; // { id, alertId, keywords, type, results, count, read, timestamp }

function addNotification({ alertId, keywords, type, results, count }) {
  const notif = {
    id: Date.now() + Math.random(),
    alertId,
    keywords,
    type,        // 'first' | 'new' | 'check'
    results: (results || []).slice(0, 10), // store up to 10 result snippets
    count,
    read: false,
    timestamp: new Date().toISOString()
  };
  notifications.unshift(notif);
  if (notifications.length > MAX_NOTIFICATIONS) notifications.length = MAX_NOTIFICATIONS;
  saveNotifications();
  return notif;
}

function saveNotifications() {
  try {
    ensureDataDir();
    fs.writeFileSync(NOTIF_FILE, JSON.stringify(notifications, null, 2));
  } catch (e) { console.error('Failed to save notifications:', e.message); }
}

function loadNotifications() {
  try {
    if (!fs.existsSync(NOTIF_FILE)) return;
    const data = JSON.parse(fs.readFileSync(NOTIF_FILE, 'utf8'));
    notifications.push(...data);
    console.log(`  📂 Loaded ${data.length} notifications from disk`);
  } catch (e) { console.error('Failed to load notifications:', e.message); }
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function saveScheduled() {
  try {
    ensureDataDir();
    const data = Array.from(scheduledSearches.values()).map(sanitizeSched);
    fs.writeFileSync(SCHED_FILE, JSON.stringify(data, null, 2));
  } catch (e) { console.error('Failed to save scheduled:', e.message); }
}

function loadScheduled() {
  try {
    if (!fs.existsSync(SCHED_FILE)) return;
    const data = JSON.parse(fs.readFileSync(SCHED_FILE, 'utf8'));
    for (const s of data) {
      scheduledSearches.set(s.id, { ...s, _timer: null });
      // Restart active timers
      if (s.active) {
        const sched = scheduledSearches.get(s.id);
        sched._timer = setInterval(async () => {
          try {
            const results = await engine.search(sched.query, { engine: sched.engine, limit: sched.limit });
            sched.lastRun = new Date().toISOString();
            sched.results = engine.deduplicate(results);
            saveScheduled();
          } catch (e) {}
        }, sched.interval * 1000);
      }
    }
    console.log(`  📂 Loaded ${data.length} scheduled searches from disk`);
  } catch (e) { console.error('Failed to load scheduled:', e.message); }
}

function saveAlerts() {
  try {
    ensureDataDir();
    const data = Array.from(alertKeywords.values());
    fs.writeFileSync(ALERTS_FILE, JSON.stringify(data, null, 2));
  } catch (e) { console.error('Failed to save alerts:', e.message); }
}

function loadAlerts() {
  try {
    if (!fs.existsSync(ALERTS_FILE)) return;
    const data = JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8'));
    for (const a of data) alertKeywords.set(a.id, a);
    console.log(`  📂 Loaded ${data.length} alerts from disk`);
  } catch (e) { console.error('Failed to load alerts:', e.message); }
}

// ─── In-memory stores ───────────────────────────────────────
const alertKeywords = new Map(); // id -> { keywords, engine, lastResults, createdAt }
const scheduledSearches = new Map(); // id -> { query, engine, interval, active, lastRun, results }

// ─── WebSocket Clients ───────────────────────────────────────
const wsClients = new Set();

function wsBroadcast(data) {
  const msg = wsEncode(data);
  for (const client of wsClients) {
    try { client.socket.write(msg); } catch (e) { wsClients.delete(client); }
  }
}

// Minimal WebSocket framing (RFC 6455) — no external deps
function wsEncode(data) {
  const payload = Buffer.from(JSON.stringify(data));
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + text frame
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function wsDecode(buffer) {
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

function wsHandshake(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-5AB5DC65C740')
    .digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n` +
    '\r\n'
  );
  return socket;
}

// ─── Auto-check Alerts ───────────────────────────────────────
const ALERT_CHECK_INTERVAL = 60_000; // check every 60s
let alertCheckTimer = null;

function startAlertAutoCheck() {
  alertCheckTimer = setInterval(async () => {
    if (wsClients.size === 0) return; // no listeners, skip
    for (const [id, alert] of alertKeywords) {
      try {
        const allResults = [];
        for (const kw of alert.keywords) {
          const results = await engine.search(kw, { engine: alert.engine, limit: alert.limit || 10 });
          allResults.push(...results);
        }
        const deduped = engine.deduplicate(allResults);
        const prevCount = (alert.lastResults || []).length;
        const newCount = deduped.length;
        if (prevCount > 0 && newCount > prevCount) {
          // New results found — create notification + broadcast
          const notif = addNotification({
            alertId: id,
            keywords: alert.keywords,
            type: 'new',
            results: deduped.slice(0, newCount - prevCount),
            count: newCount - prevCount
          });
          wsBroadcast({ type: 'notification', notification: notif });
        } else if (prevCount === 0 && newCount > 0) {
          // First results — create notification + broadcast
          const notif = addNotification({
            alertId: id,
            keywords: alert.keywords,
            type: 'first',
            results: deduped,
            count: newCount
          });
          wsBroadcast({ type: 'notification', notification: notif });
        }
        alert.lastResults = deduped;
      } catch (e) { /* skip failed checks */ }
    }
  }, ALERT_CHECK_INTERVAL);
}

// ─── HTTP Server ──────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Public endpoints (no auth required)
  const publicPaths = ['/api/obscura/auth/login', '/api/obscura/auth/logout', '/api/obscura/status', '/health'];
  const isPublic = publicPaths.includes(url.pathname);

  // Auth check (skip public endpoints)
  if (!isPublic) {
    const authResult = checkAuth(req);
    if (!authResult.ok) {
      json(res, 401, { error: authResult.error, code: 'UNAUTHORIZED' });
      return;
    }
    req._authRole = authResult.role;
  }

  try {
    let handled = false;

    // ── Auth: Login ──
    if (req.method === 'POST' && url.pathname === '/api/obscura/auth/login') {
      const body = await readBody(req);
      const { password, api_key } = JSON.parse(body);
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';

      if (api_key) {
        // API key login
        if (api_key === ADMIN_KEY) {
          const token = createSession(ip, 'admin');
          json(res, 200, { success: true, token, role: 'admin', expiresAt: new Date(Date.now() + SESSION_TTL).toISOString() });
        } else if (api_key === API_KEY) {
          const token = createSession(ip, 'user');
          json(res, 200, { success: true, token, role: 'user', expiresAt: new Date(Date.now() + SESSION_TTL).toISOString() });
        } else {
          json(res, 401, { error: 'Invalid API key' });
        }
        handled = true;
      } else if (password) {
        // Password login (password = admin key or API key)
        if (password === ADMIN_KEY && ADMIN_KEY) {
          const token = createSession(ip, 'admin');
          json(res, 200, { success: true, token, role: 'admin', expiresAt: new Date(Date.now() + SESSION_TTL).toISOString() });
        } else if (password === API_KEY && API_KEY) {
          const token = createSession(ip, 'user');
          json(res, 200, { success: true, token, role: 'user', expiresAt: new Date(Date.now() + SESSION_TTL).toISOString() });
        } else {
          json(res, 401, { error: 'Invalid credentials' });
        }
        handled = true;
      } else {
        json(res, 400, { error: 'password or api_key required' });
        handled = true;
      }
    }

    // ── Auth: Logout ──
    if (req.method === 'POST' && url.pathname === '/api/obscura/auth/logout') {
      const auth = extractAuth(req);
      if (auth && auth.type === 'session') sessions.delete(auth.token);
      json(res, 200, { success: true });
      handled = true;
    }

    // ── Auth: Check session ──
    if (req.method === 'GET' && url.pathname === '/api/obscura/auth/me') {
      const auth = extractAuth(req);
      const session = auth ? validateSession(auth.token) : null;
      if (session) {
        json(res, 200, { authenticated: true, role: session.role, expiresAt: new Date(session.expiresAt).toISOString() });
      } else {
        json(res, 200, { authenticated: false });
      }
      handled = true;
    }

    // ── Status ──
    if (req.method === 'GET' && url.pathname === '/api/obscura/status') {
      json(res, 200, {
        connected: cdpConnected,
        port: CDP_PORT,
        status: cdpConnected ? 'active' : 'standby',
        proxies: proxyRotator.pool.length,
        activeProxy: proxyRotator.current,
        stealthActive: true
      });
      handled = true;
    }

    // ── Search ──
    if (req.method === 'POST' && url.pathname === '/api/obscura/search') {
      const body = await readBody(req);
      const { query, engine: eng = 'duckduckgo', limit = 25, region = 'wt-wt', stealth: useStealth = true, dedup = true } = JSON.parse(body);
      if (!query) { json(res, 400, { error: 'query required' }); return; }

      const proxy = useStealth ? proxyRotator.next() : null;
      const results = await engine.search(query, { engine: eng, limit, region, proxy });
      const deduped = dedup ? engine.deduplicate(results) : results;

      json(res, 200, { results: deduped, total: deduped.length, engine: eng });
      handled = true;
    }

    // ── Scrape ──
    if (req.method === 'POST' && url.pathname === '/api/obscura/scrape') {
      const body = await readBody(req);
      const opts = JSON.parse(body);
      if (!opts.url) { json(res, 400, { error: 'url required' }); return; }

      // SSRF protection
      if (opts.stealth && !stealth.validateURL(opts.url)) {
        json(res, 400, { error: 'URL blocked by SSRF protection (private IP)' });
        handled = true;
      } else {
        const proxy = opts.stealth ? proxyRotator.next() : null;
        const result = await engine.scrapeURL(opts.url, { ...opts, proxy });
        json(res, 200, result);
        handled = true;
      }
    }

    // ── Extract ──
    if (req.method === 'POST' && url.pathname === '/api/obscura/extract') {
      const body = await readBody(req);
      const { url: targetUrl, schema = {} } = JSON.parse(body);
      if (!targetUrl) { json(res, 400, { error: 'url required' }); return; }

      const proxy = proxyRotator.next();
      const extracted = await engine.extractData(targetUrl, schema, { proxy });
      json(res, 200, { extracted });
      handled = true;
    }

    // ── Monitor Check ──
    if (req.method === 'POST' && url.pathname === '/api/obscura/monitor/check') {
      const body = await readBody(req);
      const { url: monitorUrl } = JSON.parse(body);
      const result = await engine.scrapeURL(monitorUrl, { dump: 'text' });
      json(res, 200, { text: result.output || result.text || '', timestamp: Date.now() });
      handled = true;
    }

    // ── Proxy Check ──
    if (req.method === 'POST' && url.pathname === '/api/obscura/proxy/check') {
      const body = await readBody(req);
      const { url: proxyUrl } = JSON.parse(body);
      const ok = await proxyRotator.checkProxy(proxyUrl);
      json(res, 200, { ok, url: proxyUrl });
      handled = true;
    }

    // ── Connect (admin only) ──
    if (req.method === 'POST' && url.pathname === '/api/obscura/connect') {
      if (req._authRole !== 'admin') {
        json(res, 403, { error: 'Admin access required' });
        handled = true;
      } else {
        const body = await readBody(req);
        const { port = CDP_PORT } = JSON.parse(body);
        cdpConnected = true;
        json(res, 200, { success: true, port, connected: true });
        handled = true;
      }
    }

    // ── Disconnect (admin only) ──
    if (req.method === 'POST' && url.pathname === '/api/obscura/disconnect') {
      if (req._authRole !== 'admin') {
        json(res, 403, { error: 'Admin access required' });
      } else {
        cdpConnected = false;
        json(res, 200, { success: true });
      }
      handled = true;
    }

    // ── WebSocket Status ──
    if (req.method === 'GET' && url.pathname === '/api/obscura/ws/status') {
      const ipStats = {};
      for (const [ip, entry] of wsIPConnections) {
        ipStats[ip] = { connections: entry.count, recentAttempts: entry.connects.length };
      }
      json(res, 200, {
        clients: wsClients.size,
        rateLimits: WS_RATE_LIMITS,
        ipStats,
        messageBuckets: wsMessageBuckets.size
      });
      handled = true;
    }

    // ── Bulk Scrape ──
    if (req.method === 'POST' && url.pathname === '/api/obscura/bulk-scrape') {
      const body = await readBody(req);
      const { urls, dump = 'text', concurrency = 3 } = JSON.parse(body);
      if (!Array.isArray(urls) || urls.length === 0) { json(res, 400, { error: 'urls array required' }); return; }

      const results = [];
      const total = urls.length;
      // Process in batches
      for (let i = 0; i < total; i += concurrency) {
        const batch = urls.slice(i, i + concurrency);
        const batchResults = await Promise.allSettled(
          batch.map(async (u) => {
            if (!stealth.validateURL(u)) {
              return { url: u, error: 'Blocked by SSRF protection', status: 'blocked' };
            }
            const proxy = proxyRotator.next();
            const result = await engine.scrapeURL(u, { dump, proxy, timeout: 30 });
            return { url: u, output: result.output || '', status: 'ok' };
          })
        );
        batchResults.forEach((r, idx) => {
          if (r.status === 'fulfilled') results.push(r.value);
          else results.push({ url: batch[idx], error: r.reason?.message || 'Failed', status: 'error' });
        });
      }
      json(res, 200, { results, total: results.length, completed: results.filter(r => r.status === 'ok').length });
      handled = true;
    }

    // ── Keyword Alerts: list ──
    if (req.method === 'GET' && url.pathname === '/api/obscura/alerts') {
      json(res, 200, { alerts: Array.from(alertKeywords.values()) });
      handled = true;
    }

    // ── Keyword Alerts: add ──
    if (req.method === 'POST' && url.pathname === '/api/obscura/alerts') {
      const body = await readBody(req);
      const { keywords = [], engine: eng = 'duckduckgo', limit = 10 } = JSON.parse(body);
      if (keywords.length === 0) { json(res, 400, { error: 'keywords required' }); return; }
      const id = Date.now();
      const alert = { id, keywords, engine: eng, limit, lastResults: [], createdAt: new Date().toISOString() };
      alertKeywords.set(id, alert);
      saveAlerts();
      json(res, 200, alert);
      handled = true;
    }

    // ── Keyword Alerts: check ──
    if (req.method === 'POST' && url.pathname === '/api/obscura/alerts/check') {
      const body = await readBody(req);
      const { id: alertId } = JSON.parse(body);
      const alert = alertKeywords.get(alertId);
      if (!alert) { json(res, 404, { error: 'Alert not found' }); return; }

      // Search for each keyword
      const allResults = [];
      for (const kw of alert.keywords) {
        const results = await engine.search(kw, { engine: alert.engine, limit: alert.limit });
        allResults.push(...results);
      }
      const deduped = engine.deduplicate(allResults);
      alert.lastResults = deduped;
      saveAlerts();
      // Create notification for manual check
      const notif = addNotification({
        alertId: alert.id,
        keywords: alert.keywords,
        type: 'check',
        results: deduped,
        count: deduped.length
      });
      wsBroadcast({ type: 'notification', notification: notif });
      json(res, 200, { alert, results: deduped, total: deduped.length });
      handled = true;
    }

    // ── Notifications: list ──
    if (req.method === 'GET' && url.pathname === '/api/obscura/notifications') {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const unreadOnly = url.searchParams.get('unread') === 'true';
      let filtered = notifications;
      if (unreadOnly) filtered = filtered.filter(n => !n.read);
      json(res, 200, { notifications: filtered.slice(0, limit), total: notifications.length, unread: notifications.filter(n => !n.read).length });
      handled = true;
    }

    // ── Notifications: mark read ──
    if (req.method === 'POST' && url.pathname === '/api/obscura/notifications/read') {
      const body = await readBody(req);
      const { id: notifId } = JSON.parse(body);
      const notif = notifications.find(n => n.id === notifId);
      if (notif) notif.read = true;
      saveNotifications();
      json(res, 200, { success: true });
      handled = true;
    }

    // ── Notifications: mark all read ──
    if (req.method === 'POST' && url.pathname === '/api/obscura/notifications/read-all') {
      notifications.forEach(n => n.read = true);
      saveNotifications();
      json(res, 200, { success: true });
      handled = true;
    }

    // ── Notifications: delete ──
    if (req.method === 'DELETE' && url.pathname === '/api/obscura/notifications') {
      const body = await readBody(req);
      const { id: notifId } = JSON.parse(body);
      const idx = notifications.findIndex(n => n.id === notifId);
      if (idx >= 0) notifications.splice(idx, 1);
      saveNotifications();
      json(res, 200, { success: true });
      handled = true;
    }

    // ── Notifications: clear all ──
    if (req.method === 'DELETE' && url.pathname === '/api/obscura/notifications/clear') {
      notifications.length = 0;
      saveNotifications();
      json(res, 200, { success: true });
      handled = true;
    }

    // ── Keyword Alerts: delete ──
    if (req.method === 'DELETE' && url.pathname === '/api/obscura/alerts') {
      const body = await readBody(req);
      const { id: alertId } = JSON.parse(body);
      alertKeywords.delete(alertId);
      saveAlerts();
      json(res, 200, { success: true });
      handled = true;
    }

    // ── Scheduled Searches: list ──
    if (req.method === 'GET' && url.pathname === '/api/obscura/scheduled') {
      json(res, 200, { scheduled: Array.from(scheduledSearches.values()).map(sanitizeSched) });
      handled = true;
    }

    // ── Scheduled Searches: add ──
    if (req.method === 'POST' && url.pathname === '/api/obscura/scheduled') {
      const body = await readBody(req);
      const { query, engine: eng = 'duckduckgo', interval = 300, limit = 25 } = JSON.parse(body);
      if (!query) { json(res, 400, { error: 'query required' }); return; }
      const id = Date.now();
      const sched = { id, query, engine: eng, interval, limit, active: true, lastRun: null, results: [], createdAt: new Date().toISOString() };
      scheduledSearches.set(id, sched);

      // Start the timer
      sched._timer = setInterval(async () => {
        try {
          const results = await engine.search(sched.query, { engine: sched.engine, limit: sched.limit });
          sched.lastRun = new Date().toISOString();
          sched.results = engine.deduplicate(results);
        } catch (e) { /* skip failed runs */ }
      }, sched.interval * 1000);

      // Run immediately
      engine.search(sched.query, { engine: sched.engine, limit: sched.limit }).then(results => {
        sched.lastRun = new Date().toISOString();
        sched.results = engine.deduplicate(results);
      }).catch(() => {});

      saveScheduled();
      json(res, 200, sanitizeSched(sched));
      handled = true;
    }

    // ── Scheduled Searches: delete ──
    if (req.method === 'DELETE' && url.pathname === '/api/obscura/scheduled') {
      const body = await readBody(req);
      const { id: schedId } = JSON.parse(body);
      const sched = scheduledSearches.get(schedId);
      if (sched && sched._timer) clearInterval(sched._timer);
      scheduledSearches.delete(schedId);
      saveScheduled();
      json(res, 200, { success: true });
      handled = true;
    }

    // ── Scheduled Searches: toggle ──
    if (req.method === 'POST' && url.pathname === '/api/obscura/scheduled/toggle') {
      const body = await readBody(req);
      const { id: schedId } = JSON.parse(body);
      const sched = scheduledSearches.get(schedId);
      if (!sched) { json(res, 404, { error: 'Scheduled search not found' }); return; }
      sched.active = !sched.active;
      if (sched.active) {
        sched._timer = setInterval(async () => {
          try {
            const results = await engine.search(sched.query, { engine: sched.engine, limit: sched.limit });
            sched.lastRun = new Date().toISOString();
            sched.results = engine.deduplicate(results);
          } catch (e) {}
        }, sched.interval * 1000);
      } else {
        if (sched._timer) clearInterval(sched._timer);
        sched._timer = null;      }
      saveScheduled();
      json(res, 200, sanitizeSched(sched));
      handled = true;
    }


    if (!handled) {
      json(res, 404, { error: 'Not found', path: url.pathname });
    }
  } catch (e) {
    console.error('API error:', e.message);
    json(res, 500, { error: e.message });
  }
});

// ─── Helpers ──────────────────────────────────────────────────

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c.toString());
    req.on('end', () => resolve(body));
  });
}

/** Strip non-serializable timer refs from scheduled objects */
function sanitizeSched(s) {
  const { _timer, ...rest } = s;
  return rest;
}

// ─── WebSocket Rate Limiting ──────────────────────────────────
const WS_RATE_LIMITS = {
  maxConnectionsPerIP: 5,       // max concurrent connections per IP
  maxConnectsPerMinute: 10,     // max new connections per IP per minute
  maxMessagesPerMinute: 60,     // max messages per connection per minute
  maxMessageBytes: 8192,        // max single message size (8KB)
  idleTimeoutMs: 300_000,       // 5 min idle timeout
};

const wsIPConnections = new Map();  // ip -> { count, connects[] }
const wsMessageBuckets = new Map(); // clientId -> { count, window[] }

function wsRateCheckConnect(ip) {
  const now = Date.now();
  let entry = wsIPConnections.get(ip);
  if (!entry) { entry = { count: 0, connects: [] }; wsIPConnections.set(ip, entry); }

  // Prune old connection attempts (>60s)
  entry.connects = entry.connects.filter(t => now - t < 60_000);

  // Check concurrent connections
  if (entry.count >= WS_RATE_LIMITS.maxConnectionsPerIP) {
    return { ok: false, reason: `Max ${WS_RATE_LIMITS.maxConnectionsPerIP} concurrent connections per IP` };
  }

  // Check connect rate
  if (entry.connects.length >= WS_RATE_LIMITS.maxConnectsPerMinute) {
    return { ok: false, reason: `Max ${WS_RATE_LIMITS.maxConnectsPerMinute} connections per minute` };
  }

  entry.connects.push(now);
  entry.count++;
  return { ok: true };
}

function wsRateCheckMessage(clientId) {
  const now = Date.now();
  let bucket = wsMessageBuckets.get(clientId);
  if (!bucket) { bucket = { messages: [] }; wsMessageBuckets.set(clientId, bucket); }

  // Prune old messages (>60s)
  bucket.messages = bucket.messages.filter(t => now - t < 60_000);

  if (bucket.messages.length >= WS_RATE_LIMITS.maxMessagesPerMinute) {
    return { ok: false, reason: `Max ${WS_RATE_LIMITS.maxMessagesPerMinute} messages per minute` };
  }

  bucket.messages.push(now);
  return { ok: true };
}

function wsRateDecrementIP(ip) {
  const entry = wsIPConnections.get(ip);
  if (entry) {
    entry.count = Math.max(0, entry.count - 1);
    if (entry.count === 0) wsIPConnections.delete(ip);
  }
}

// Periodic cleanup of stale rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of wsIPConnections) {
    entry.connects = entry.connects.filter(t => now - t < 60_000);
    if (entry.connects.length === 0 && entry.count === 0) wsIPConnections.delete(ip);
  }
  for (const [id, bucket] of wsMessageBuckets) {
    bucket.messages = bucket.messages.filter(t => now - t < 60_000);
    if (bucket.messages.length === 0) wsMessageBuckets.delete(id);
  }
}, 60_000);

// ─── WebSocket Upgrade ────────────────────────────────────────

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== '/ws') { socket.destroy(); return; }

  // Extract client IP (support nginx X-Forwarded-For)
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                    req.socket.remoteAddress?.replace(/^::ffff:/, '') || 'unknown';

  // Auth check for WebSocket
  if (AUTH_ENABLED) {
    const auth = extractAuth(req);
    if (!auth) {
      console.log(`  🔒 WS auth failed: ${clientIP} — no credentials`);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    let valid = false;
    if (auth.type === 'session') {
      valid = !!validateSession(auth.token);
    } else if (auth.type === 'apikey') {
      valid = auth.key === API_KEY || auth.key === ADMIN_KEY;
    }
    if (!valid) {
      console.log(`  🔒 WS auth failed: ${clientIP} — invalid credentials`);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
  }

  // Rate limit check
  const rateCheck = wsRateCheckConnect(clientIP);
  if (!rateCheck.ok) {
    console.log(`  ⚠️  WS rate limit: ${clientIP} — ${rateCheck.reason}`);
    socket.write('HTTP/1.1 429 Too Many Requests\r\nRetry-After: 60\r\n\r\n');
    socket.destroy();
    return;
  }

  const wsSocket = wsHandshake(req, socket);
  if (!wsSocket) return;

  const client = { socket: wsSocket, id: Date.now(), ip: clientIP, lastActivity: Date.now() };
  wsClients.add(client);
  console.log(`  🔌 WS client connected from ${clientIP} (${wsClients.size} total)`);

  // Send welcome
  wsSocket.write(wsEncode({ type: 'connected', clientId: client.id, timestamp: new Date().toISOString() }));

  // Idle timeout
  const idleTimer = setTimeout(() => {
    console.log(`  ⏱️  WS idle timeout: ${clientIP}`);
    wsSocket.write(wsEncode({ type: 'error', message: 'Idle timeout' }));
    wsSocket.end(Buffer.from([0x88, 0x02, 0x03, 0xe8]));
    wsClients.delete(client);
    wsRateDecrementIP(clientIP);
    wsMessageBuckets.delete(client.id);
  }, WS_RATE_LIMITS.idleTimeoutMs);

  // Handle incoming messages
  let buffer = Buffer.alloc(0);
  wsSocket.on('data', (chunk) => {
    client.lastActivity = Date.now();
    clearTimeout(idleTimer);
    // Restart idle timer on activity
    const newIdleTimer = setTimeout(() => {
      console.log(`  ⏱️  WS idle timeout: ${clientIP}`);
      wsSocket.write(wsEncode({ type: 'error', message: 'Idle timeout' }));
      wsSocket.end(Buffer.from([0x88, 0x02, 0x03, 0xe8]));
      wsClients.delete(client);
      wsRateDecrementIP(clientIP);
      wsMessageBuckets.delete(client.id);
    }, WS_RATE_LIMITS.idleTimeoutMs);
    // Update reference for cleanup
    client._idleTimer = newIdleTimer;

    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const result = wsDecode(buffer);
      if (!result || result.totalLen > buffer.length) break;
      buffer = buffer.slice(result.totalLen);

      if (result.opcode === 0x08) { // close frame
        clearTimeout(newIdleTimer);
        wsSocket.end();
        wsClients.delete(client);
        wsRateDecrementIP(clientIP);
        wsMessageBuckets.delete(client.id);
        console.log(`  🔌 WS client disconnected (${wsClients.size} total)`);
        return;
      }

      if (result.opcode === 0x01) { // text frame
        // Message size check
        if (Buffer.byteLength(result.payload) > WS_RATE_LIMITS.maxMessageBytes) {
          wsSocket.write(wsEncode({ type: 'error', message: 'Message too large (max 8KB)' }));
          continue;
        }

        // Message rate check
        const msgRate = wsRateCheckMessage(client.id);
        if (!msgRate.ok) {
          console.log(`  ⚠️  WS message rate limit: ${clientIP}`);
          wsSocket.write(wsEncode({ type: 'error', message: msgRate.reason }));
          continue;
        }

        try {
          const msg = JSON.parse(result.payload);
          if (msg.type === 'ping') {
            wsSocket.write(wsEncode({ type: 'pong', timestamp: new Date().toISOString() }));
          } else if (msg.type === 'subscribe:alerts') {
            client.subscribed = true;
            wsSocket.write(wsEncode({ type: 'subscribed', channel: 'alerts' }));
          }
        } catch (e) { /* ignore malformed messages */ }
      }
    }
  });

  wsSocket.on('close', () => {
    clearTimeout(client._idleTimer || idleTimer);
    wsClients.delete(client);
    wsRateDecrementIP(clientIP);
    wsMessageBuckets.delete(client.id);
    console.log(`  🔌 WS client disconnected (${wsClients.size} total)`);
  });

  wsSocket.on('error', () => {
    wsClients.delete(client);
  });
});

// ─── Start ────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`\n  🕸️  Obscura Search API running on http://localhost:${PORT}`);
  console.log(`  📡  CDP target port: ${CDP_PORT}`);
  console.log(`  📡  WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`  🛡️  Stealth: ON | SSRF protection: ON`);
  console.log(`  📂  Data directory: ${DATA_DIR}\n`);
  loadAlerts();
  loadScheduled();
  loadNotifications();
  startAlertAutoCheck();
});
