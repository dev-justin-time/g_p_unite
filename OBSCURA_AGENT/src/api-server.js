/**
 * Obscura Agent — API Server
 * REST + WebSocket API for agent integration
 */

const http = require('http');
const { parse } = require('url');

class APIServer {
  constructor(opts = {}) {
    this.port = opts.port || 3000;
    this.host = opts.host || '127.0.0.1';
    this._server = null;
    this._core = opts.core;
    this._routes = new Map();
  }

  /**
   * Register a route handler
   * @param {string} method - GET|POST|PUT|DELETE
   * @param {string} path - '/api/...'
   * @param {Function} handler - (req, res, params, body) => void
   */
  route(method, path, handler) {
    this._routes.set(`${method}:${path}`, handler);
  }

  /**
   * Start the API server
   */
  async start() {
    this._setupDefaultRoutes();

    this._server = http.createServer((req, res) => {
      this._cors(req, res);
      const { pathname, searchParams } = parse(req.url, true);
      const method = req.method.toUpperCase();

      // Body parsing for POST
      if (method === 'POST') {
        let body = '';
        req.on('data', c => body += c.toString());
        req.on('end', () => {
          let parsed = {};
          try { parsed = JSON.parse(body); } catch {}
          this._dispatch(method, pathname, req, res, searchParams, parsed);
        });
      } else {
        this._dispatch(method, pathname, req, res, searchParams, {});
      }
    });

    return new Promise((resolve) => {
      this._server.listen(this.port, this.host, () => {
        resolve({ port: this.port, host: this.host });
      });
    });
  }

  async stop() {
    if (this._server) {
      this._server.close();
      this._server = null;
    }
  }

  _dispatch(method, path, req, res, params, body) {
    const handler = this._routes.get(`${method}:${path}`);
    if (handler) {
      try {
        handler(req, res, params, body);
      } catch (e) {
        this._json(res, 500, { error: e.message });
      }
    } else {
      this._json(res, 404, { error: 'Not found' });
    }
  }

  _setupDefaultRoutes() {
    // GET /api/status
    this.route('GET', '/api/status', (req, res) => {
      const scraper = this._core?._modules?.scraper;
      const monitor = this._core?._modules?.monitor;
      this._json(res, 200, {
        status: 'active',
        state: this._core?.state || 'idle',
        uptime: this._core?.metrics?.uptime || 0,
        metrics: this._core?.metrics || {},
        monitors: monitor?.list() || [],
        modules: Object.keys(this._core?._modules || {}),
      });
    });

    // POST /api/scrape
    this.route('POST', '/api/scrape', async (req, res, _, body) => {
      const scraper = this._core?._modules?.scraper;
      if (!scraper) { this._json(res, 500, { error: 'Scraper not loaded' }); return; }
      if (!body.url) { this._json(res, 400, { error: 'url required' }); return; }
      const result = await scraper.scrape(body.url, body);
      this._json(res, 200, result);
    });

    // POST /api/batch
    this.route('POST', '/api/batch', async (req, res, _, body) => {
      const scraper = this._core?._modules?.scraper;
      if (!scraper) { this._json(res, 500, { error: 'Scraper not loaded' }); return; }
      if (!body.urls?.length) { this._json(res, 400, { error: 'urls array required' }); return; }
      const results = await scraper.scrapeBatch(body.urls, body);
      this._json(res, 200, { count: results.length, results });
    });

    // POST /api/monitor/start
    this.route('POST', '/api/monitor/start', (req, res, _, body) => {
      const monitor = this._core?._modules?.monitor;
      if (!monitor) { this._json(res, 500, { error: 'Monitor not loaded' }); return; }
      if (!body.url) { this._json(res, 400, { error: 'url required' }); return; }
      const result = monitor.start(body.url, body.interval || 60000);
      this._json(res, 200, result);
    });

    // POST /api/monitor/stop
    this.route('POST', '/api/monitor/stop', (req, res, _, body) => {
      const monitor = this._core?._modules?.monitor;
      if (!monitor) { this._json(res, 500, { error: 'Monitor not loaded' }); return; }
      const result = monitor.stop(body.url);
      this._json(res, 200, result);
    });

    // POST /api/extract
    this.route('POST', '/api/extract', async (req, res, _, body) => {
      const scraper = this._core?._modules?.scraper;
      const extractor = this._core?._modules?.extractor;
      if (!scraper || !extractor) { this._json(res, 500, { error: 'Modules not loaded' }); return; }
      if (!body.url) { this._json(res, 400, { error: 'url required' }); return; }
      const result = await scraper.scrape(body.url, { format: 'html' });
      if (!result.success) { this._json(res, 500, { error: result.error }); return; }
      const data = extractor.extract(result.output, body.schema);
      this._json(res, 200, { url: body.url, data });
    });

    // GET /api/screenshot
    this.route('GET', '/api/screenshot', async (req, res, params) => {
      const cdp = this._core?._modules?.cdp;
      const url = params.get('url');
      if (!cdp || !cdp.isConnected()) { this._json(res, 500, { error: 'CDP not connected' }); return; }
      if (!url) { this._json(res, 400, { error: 'url param required' }); return; }
      await cdp.navigate(url);
      const screenshot = await cdp.screenshot(params.get('format') || 'png');
      this._json(res, 200, { url, screenshot: screenshot ? `data:image/png;base64,${screenshot}` : null });
    });

    // POST /api/proxy/rotate
    this.route('POST', '/api/proxy/rotate', (req, res) => {
      const proxy = this._core?._modules?.proxy;
      const p = proxy?.getNext();
      this._json(res, 200, { proxy: p?.url || null });
    });
  }

  _json(res, code, data) {
    const body = JSON.stringify(data);
    res.writeHead(code, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'Access-Control-Allow-Origin': '*',
    });
    res.end(body);
  }

  _cors(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); }
  }
}

module.exports = { APIServer };