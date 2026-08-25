/**
 * Obscura Search — API Server
 * Proxies requests to Obscura browser, manages proxy pool
 */

const http = require('http');
const https = require('https');
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

// ─── Start ────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`\n  🕸️  Obscura Search API running on http://localhost:${PORT}`);
  console.log(`  📡  CDP target port: ${CDP_PORT}`);
  console.log(`  🛡️  Stealth: ON | SSRF protection: ON\n`);
});
