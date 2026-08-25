/**
 * Obscura Search — Proxy Rotator
 * Manages proxy pool with health checks, rotation strategies, and failover
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

class ProxyRotator {
  constructor() {
    this.pool = [];
    this.current = -1;
    this.strategy = 'round-robin'; // round-robin | latency | random
    this._healthChecks = new Map();
    this._checkInterval = 60_000; // 1 min

    // Built-in free proxies for demo (user adds real ones via GUI)
    this._loadDefaults();
  }

  /**
   * Get next proxy from pool
   */
  next() {
    if (this.pool.length === 0) return null;

    switch (this.strategy) {
      case 'latency':
        return this._nextByLatency();
      case 'random':
        return this._nextRandom();
      default:
        return this._nextRoundRobin();
    }
  }

  /**
   * Add a proxy to the pool
   */
  add(proxyUrl) {
    // Validate format
    try {
      const parsed = new URL(proxyUrl);
      if (!['http:', 'https:', 'socks5:'].includes(parsed.protocol)) {
        throw new Error('Unsupported protocol');
      }
    } catch (e) {
      throw new Error(`Invalid proxy URL: ${proxyUrl}`);
    }

    // Check duplicates
    if (this.pool.some(p => p.url === proxyUrl)) {
      throw new Error('Proxy already in pool');
    }

    const proxy = {
      id: Date.now(),
      url: proxyUrl,
      status: 'unchecked',
      latency: null,
      lastCheck: null,
      failures: 0,
      addedAt: new Date().toISOString()
    };

    this.pool.push(proxy);
    this._checkProxy(proxy);
    return proxy;
  }

  /**
   * Remove a proxy
   */
  remove(proxyUrl) {
    this.pool = this.pool.filter(p => p.url !== proxyUrl);
  }

  /**
   * Check if a proxy is working
   */
  async checkProxy(proxyUrl) {
    const proxy = this.pool.find(p => p.url === proxyUrl);
    if (!proxy) throw new Error('Proxy not in pool');
    return this._checkProxy(proxy);
  }

  /**
   * Rotate to next proxy
   */
  rotate() {
    this.current = (this.current + 1) % this.pool.length;
    return this.pool[this.current];
  }

  /**
   * Set rotation strategy
   */
  setStrategy(strategy) {
    if (!['round-robin', 'latency', 'random'].includes(strategy)) {
      throw new Error(`Unknown strategy: ${strategy}`);
    }
    this.strategy = strategy;
  }

  /**
   * Get pool stats
   */
  stats() {
    const active = this.pool.filter(p => p.status === 'active').length;
    const avgLatency = this.pool
      .filter(p => p.latency != null)
      .reduce((sum, p, _, arr) => sum + p.latency / arr.length, 0);

    return {
      total: this.pool.length,
      active,
      failed: this.pool.filter(p => p.status === 'failed').length,
      unchecked: this.pool.filter(p => p.status === 'unchecked').length,
      avgLatency: Math.round(avgLatency),
      strategy: this.strategy
    };
  }

  // ─── Internal ────────────────────────────────────────────

  _nextRoundRobin() {
    this.current = (this.current + 1) % this.pool.length;
    return this.pool[this.current].url;
  }

  _nextRandom() {
    const active = this.pool.filter(p => p.status === 'active');
    if (active.length === 0) return this.pool[0]?.url || null;
    return active[Math.floor(Math.random() * active.length)].url;
  }

  _nextByLatency() {
    const active = this.pool
      .filter(p => p.status === 'active')
      .sort((a, b) => (a.latency || 99999) - (b.latency || 99999));
    if (active.length === 0) return this.pool[0]?.url || null;
    return active[0].url;
  }

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

  _loadDefaults() {
    // No default proxies — user adds via GUI
  }
}

module.exports = { ProxyRotator };
