/**
 * G P Unite — Obscura API Routes
 * REST endpoints for the obscura browser agent
 * Mount on the main Express/HTTP server
 */

const { ObscuraAgent } = require('../../agents/obscura');

let agent = null;

function getAgent() {
  if (!agent) agent = new ObscuraAgent();
  return agent;
}

/**
 * Handle obscura-related HTTP requests
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @returns {boolean} true if handled
 */
function handleObscuraRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // GET /api/obscura/status
  if (req.method === 'GET' && url.pathname === '/api/obscura/status') {
    const a = getAgent();
    json(res, 200, {
      id: a.id,
      name: a.name,
      icon: a.icon,
      status: a.status,
      connected: a.bridge.isConnected,
      port: a.bridge.port,
      metrics: a.metrics,
      history: a.getHistory().slice(-50),
      monitors: a.getMonitors()
    });
    return true;
  }

  // POST /api/obscura/scrape
  if (req.method === 'POST' && url.pathname === '/api/obscura/scrape') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try {
        const { url: targetUrl, eval: expression, dump, screenshot, waitUntil, timeout } = JSON.parse(body);
        if (!targetUrl) { json(res, 400, { error: 'url required' }); return; }
        const a = getAgent();
        const result = await a.scrape(targetUrl, { eval: expression, dump, screenshot, waitUntil, timeout });
        json(res, 200, result);
      } catch (e) {
        json(res, 500, { error: e.message });
      }
    });
    return true;
  }

  // POST /api/obscura/batch
  if (req.method === 'POST' && url.pathname === '/api/obscura/batch') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try {
        const { urls, concurrency, eval: expression } = JSON.parse(body);
        if (!urls || !Array.isArray(urls)) { json(res, 400, { error: 'urls array required' }); return; }
        const a = getAgent();
        const results = await a.scrapeBatch(urls, { concurrency, eval: expression });
        json(res, 200, { results });
      } catch (e) {
        json(res, 500, { error: e.message });
      }
    });
    return true;
  }

  // POST /api/obscura/monitor
  if (req.method === 'POST' && url.pathname === '/api/obscura/monitor') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try {
        const { url: targetUrl, interval } = JSON.parse(body);
        if (!targetUrl) { json(res, 400, { error: 'url required' }); return; }
        const a = getAgent();
        const result = a.startMonitoring(targetUrl, interval || 60000);
        json(res, 200, result);
      } catch (e) {
        json(res, 500, { error: e.message });
      }
    });
    return true;
  }

  // POST /api/obscura/connect
  if (req.method === 'POST' && url.pathname === '/api/obscura/connect') {
    const a = getAgent();
    a.connect().then(result => json(res, 200, result)).catch(e => json(res, 500, { error: e.message }));
    return true;
  }

  // POST /api/obscura/disconnect
  if (req.method === 'POST' && url.pathname === '/api/obscura/disconnect') {
    const a = getAgent();
    a.disconnect().then(() => json(res, 200, { success: true })).catch(e => json(res, 500, { error: e.message }));
    return true;
  }

  return false; // Not handled
}

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

module.exports = { handleObscuraRequest, getAgent };
