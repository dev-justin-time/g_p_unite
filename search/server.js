/**
 * Obscura Search — API Server
 * Proxies requests to Obscura browser, manages proxy pool
 * WebSocket for real-time alert notifications
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { URL } = require('url');
const { SearchEngine } = require('./engine');
const { ProxyRotator } = require('./proxy-rotator');
const { StealthManager } = require('./stealth');

const PORT = parseInt(process.env.OBSCURA_PORT || '3001');
const CDP_PORT = parseInt(process.env.OBSCURA_CDP || '9222');

const engine = new SearchEngine();
const proxyRotator = new ProxyRotator();
const stealth = new StealthManager();

let cdpConnected = false;

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
          // New results found — notify clients
          wsBroadcast({
            type: 'alert:new',
            alertId: id,
            keywords: alert.keywords,
            newResults: deduped.slice(0, newCount - prevCount),
            totalResults: newCount,
            timestamp: new Date().toISOString()
          });
        } else if (prevCount === 0 && newCount > 0) {
          wsBroadcast({
            type: 'alert:first',
            alertId: id,
            keywords: alert.keywords,
            results: deduped,
            totalResults: newCount,
            timestamp: new Date().toISOString()
          });
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    let handled = false;

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

    // ── Connect ──
    if (req.method === 'POST' && url.pathname === '/api/obscura/connect') {
      const body = await readBody(req);
      const { port = CDP_PORT } = JSON.parse(body);
      cdpConnected = true;
      json(res, 200, { success: true, port, connected: true });
      handled = true;
    }

    // ── Disconnect ──
    if (req.method === 'POST' && url.pathname === '/api/obscura/disconnect') {
      cdpConnected = false;
      json(res, 200, { success: true });
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
      json(res, 200, { alert, results: deduped, total: deduped.length });
      handled = true;
    }

    // ── Keyword Alerts: delete ──
    if (req.method === 'DELETE' && url.pathname === '/api/obscura/alerts') {
      const body = await readBody(req);
      const { id: alertId } = JSON.parse(body);
      alertKeywords.delete(alertId);
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
        sched._timer = null;
      }
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

// ─── WebSocket Upgrade ────────────────────────────────────────

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== '/ws') { socket.destroy(); return; }

  const wsSocket = wsHandshake(req, socket);
  if (!wsSocket) return;

  const client = { socket: wsSocket, id: Date.now() };
  wsClients.add(client);
  console.log(`  🔌 WS client connected (${wsClients.size} total)`);

  // Send welcome
  wsSocket.write(wsEncode({ type: 'connected', clientId: client.id, timestamp: new Date().toISOString() }));

  // Handle incoming messages
  let buffer = Buffer.alloc(0);
  wsSocket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const result = wsDecode(buffer);
      if (!result || result.totalLen > buffer.length) break;
      buffer = buffer.slice(result.totalLen);
      if (result.opcode === 0x08) { // close frame
        wsSocket.end();
        wsClients.delete(client);
        console.log(`  🔌 WS client disconnected (${wsClients.size} total)`);
        return;
      }
      if (result.opcode === 0x01) { // text frame
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
    wsClients.delete(client);
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
  console.log(`  🛡️  Stealth: ON | SSRF protection: ON\n`);
  startAlertAutoCheck();
});
