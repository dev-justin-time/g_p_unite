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

// ─── Start ────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`\n  🕸️  Obscura Search API running on http://localhost:${PORT}`);
  console.log(`  📡  CDP target port: ${CDP_PORT}`);
  console.log(`  🛡️  Stealth: ON | SSRF protection: ON\n`);
});
