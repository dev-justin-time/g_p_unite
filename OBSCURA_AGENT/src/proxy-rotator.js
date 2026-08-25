/**
 * Obscura Agent — Proxy Rotator Module (Merged)
 * Full proxy pool management with rotation strategies, health checks, and failover
 * Combines search's strategy-based rotation with agent's score-based tracking
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

class ProxyRotator {
  constructor(opts = {}) {
    this._proxies = (opts.proxies || []).map(p => this._normalizeProxy(p));
    this._currentIndex = 0;
    this.strategy = opts.strategy || 'round-robin'; // round-robin | latency | random | score
    this._maxFailures = opts.maxFailures || 5;
    this._healthCheckUrl = opts.healthCheckUrl || 'https://httpbin.org/ip';
    this._checkInterval = opts.checkInterval || 60_000;
  }

  _normalizeProxy(p) {
    const url = typeof p === 'string' ? p : p.url;
    return {
      id: Date.now() + Math.random(),
      url,
      type: p.type || 'http',
      status: 'unchecked',
      score: 100,
      failures: 0,
      latency: null,
      lastUsed: 0,
      lastCheck: null,
      addedAt: new Date().toISOString()
    };
  }

  // ─── Core Rotation ──────────────────────────────────────────

  /**
   * Get next proxy from pool (alias: next() for search compat, getNext() for agent compat)
   */
  getNext() {
    return this.next();
  }

  next() {
    if (this._proxies.length === 0) return null;

    switch (this.strategy) {
      case 'latency':
        return this._nextByLatency();
      case 'random':
        return this._nextRandom();
      case 'score':
        return this._nextByScore();
      default:
        return this._nextRoundRobin();
    }
  }

  /**
   * Rotate to next proxy
   */
  rotate() {
    return this.next();
  }

  // ─── Pool Management ────────────────────────────────────────

  /**
   * Add a proxy to the pool
   */
  add(proxyUrl) {
    try {
      const parsed = new URL(proxyUrl);
      if (!['http:', 'https:', 'socks5:'].includes(parsed.protocol)) {
        throw new Error('Unsupported protocol');
      }
    } catch (e) {
      throw new Error(`Invalid proxy URL: ${proxyUrl}`);
    }

    if (this._proxies.some(p => p.url === proxyUrl)) {
      throw new Error('Proxy already in pool');
    }

    const proxy = this._normalizeProxy({ url: proxyUrl });
    this._proxies.push(proxy);
    this._checkProxy(proxy);
    return proxy;
  }

  /**
   * Add multiple proxies
   */
  addProxies(proxies) {
    for (const p of proxies) {
      try {
        const url = typeof p === 'string' ? p : p.url;
        if (!this._proxies.some(x => x.url === url)) {
          this._proxies.push(this._normalizeProxy(p));
          this._checkProxy(this._proxies[this._proxies.length - 1]);
        }
      } catch (e) { /* skip invalid */ }
    }
  }

  /**
   * Remove a proxy
   */
  remove(proxyUrl) {
    this._proxies = this._proxies.filter(p => p.url !== proxyUrl);
  }

  /**
   * Report proxy success or failure
   */
  reportResult(proxy, success, latency = 0) {
    if (success) {
      proxy.failures = Math.max(0, proxy.failures - 1);
      proxy.latency = latency;
      proxy.score = Math.min(100, proxy.score + 5);
      proxy.status = 'active';
    } else {
      proxy.failures++;
      proxy.score = Math.max(0, proxy.score - 20);
      if (proxy.failures >= this._maxFailures) {
        proxy.status = 'failed';
      }
    }
  }

  /**
   * Check if a specific proxy is working
   */
  async checkProxy(proxyUrl) {
    const proxy = this._proxies.find(p => p.url === proxyUrl);
    if (!proxy) throw new Error('Proxy not in pool');
    return this._checkProxy(proxy);
  }

  /**
   * Set rotation strategy
   */
  setStrategy(strategy) {
    if (!['round-robin', 'latency', 'random', 'score'].includes(strategy)) {
      throw new Error(`Unknown strategy: ${strategy}`);
    }
    this.strategy = strategy;
  }

  // ─── Stats & Health ─────────────────────────────────────────

  /**
   * Get pool stats
   */
  stats() {
    const active = this._proxies.filter(p => p.status === 'active').length;
    const avgLatency = this._proxies
      .filter(p => p.latency != null)
      .reduce((sum, p, _, arr) => sum + p.latency / (arr.length || 1), 0);

    return {
      total: this._proxies.length,
      active,
      healthy: this._proxies.filter(p => p.failures < this._maxFailures).length,
      failed: this._proxies.filter(p => p.status === 'failed').length,
      unchecked: this._proxies.filter(p => p.status === 'unchecked').length,
      avgLatency: Math.round(avgLatency || 0),
      strategy: this.strategy,
      activeProxy: this._proxies[this._currentIndex]?.url || null,
      proxies: this._proxies.map(p => ({
        url: p.url.replace(/:\/\/[^@]+@/, '://***@'),
        type: p.type,
        status: p.status,
        score: p.score,
        failures: p.failures,
        latency: p.latency,
      }))
    };
  }

  /**
   * Health check all proxies
   */
  async healthCheck() {
    const results = [];
    for (const proxy of this._proxies) {
      try {
        const start = Date.now();
        await this._testConnectivity(proxy.url, 8000);
        this.reportResult(proxy, true, Date.now() - start);
        results.push({ url: proxy.url, alive: true, latency: Date.now() - start });
      } catch {
        this.reportResult(proxy, false);
        results.push({ url: proxy.url, alive: false });
      }
    }
    return results;
  }

  // ─── Internal: Rotation Strategies ──────────────────────────

  _nextRoundRobin() {
    const now = Date.now();
    for (let i = 0; i < this._proxies.length; i++) {
      const idx = (this._currentIndex + i) % this._proxies.length;
      const proxy = this._proxies[idx];
      if (proxy.failures < this._maxFailures) {
        if (now - proxy.lastUsed < 1000 && this._proxies.length > 1) continue;
        this._currentIndex = (idx + 1) % this._proxies.length;
        proxy.lastUsed = now;
        return proxy.url;
      }
    }
    // All failed — reset and try first
    this._proxies.forEach(p => { p.failures = 0; });
    this._currentIndex = 0;
    return this._proxies[0]?.url || null;
  }

  _nextRandom() {
    const active = this._proxies.filter(p => p.status === 'active' || p.failures < this._maxFailures);
    if (active.length === 0) return this._proxies[0]?.url || null;
    const pick = active[Math.floor(Math.random() * active.length)];
    pick.lastUsed = Date.now();
    return pick.url;
  }

  _nextByLatency() {
    const active = this._proxies
      .filter(p => p.status === 'active' || p.failures < this._maxFailures)
      .sort((a, b) => (a.latency || 99999) - (b.latency || 99999));
    if (active.length === 0) return this._proxies[0]?.url || null;
    active[0].lastUsed = Date.now();
    return active[0].url;
  }

  _nextByScore() {
    const active = this._proxies
      .filter(p => p.failures < this._maxFailures)
      .sort((a, b) => b.score - a.score);
    if (active.length === 0) return this._proxies[0]?.url || null;
    active[0].lastUsed = Date.now();
    return active[0].url;
  }

  // ─── Internal: Health Checking ──────────────────────────────

  async _checkProxy(proxy) {
    const startTime = Date.now();
    try {
      await this._testConnectivity(proxy.url, 8000);
      proxy.status = 'active';
      proxy.latency = Date.now() - startTime;
      proxy.failures = 0;
    } catch (e) {
      proxy.status = 'failed';
      proxy.latency = null;
      proxy.failures++;
    }
    proxy.lastCheck = new Date().toISOString();
    return proxy;
  }

  _testConnectivity(proxyUrl, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), timeout);
      try {
        const parsed = new URL(proxyUrl);
        const proto = parsed.protocol === 'https:' ? https : http;
        const req = proto.request({
          hostname: parsed.hostname,
          port: parsed.port,
          method: 'CONNECT',
          path: 'httpbin.org:443',
          timeout
        }, (res) => {
          clearTimeout(timer);
          if (res.statusCode === 200) resolve(true);
          else reject(new Error(`Status ${res.statusCode}`));
        });
        req.on('error', (e) => { clearTimeout(timer); reject(e); });
        req.on('timeout', () => { req.destroy(); clearTimeout(timer); reject(new Error('timeout')); });
        req.end();
      } catch (e) {
        clearTimeout(timer);
        reject(e);
      }
    });
  }
}

module.exports = { ProxyRotator };
