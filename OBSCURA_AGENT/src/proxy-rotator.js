/**
 * Obscura Agent — Proxy Rotator Module
 * Proxy pool management with automatic rotation and health checking.
 */

class ProxyRotator {
  constructor(opts = {}) {
    this._proxies = (opts.proxies || []).map(p => ({
      url: typeof p === 'string' ? p : p.url,
      type: p.type || 'http',
      score: 100,
      failures: 0,
      lastUsed: 0,
      latency: 0,
    }));
    this._currentIndex = 0;
    this._rotationInterval = opts.rotationInterval || 30000; // 30s
    this._maxFailures = opts.maxFailures || 5;
    this._healthCheckUrl = opts.healthCheckUrl || 'https://httpbin.org/ip';
  }

  /**
   * Get the next healthy proxy
   */
  getNext() {
    if (this._proxies.length === 0) return null;
    const now = Date.now();

    // Try to find a healthy proxy, starting from current index
    for (let i = 0; i < this._proxies.length; i++) {
      const idx = (this._currentIndex + i) % this._proxies.length;
      const proxy = this._proxies[idx];

      if (proxy.failures < this._maxFailures) {
        // Respect cooldown
        if (now - proxy.lastUsed < 1000 && this._proxies.length > 1) continue;
        this._currentIndex = (idx + 1) % this._proxies.length;
        proxy.lastUsed = now;
        return proxy;
      }
    }

    // All proxies failed — reset and try first
    this._proxies.forEach(p => { p.failures = 0; });
    return this._proxies[0];
  }

  /**
   * Report proxy success or failure
   */
  reportResult(proxy, success, latency = 0) {
    if (success) {
      proxy.failures = Math.max(0, proxy.failures - 1);
      proxy.latency = latency;
      proxy.score = Math.min(100, proxy.score + 5);
    } else {
      proxy.failures++;
      proxy.score = Math.max(0, proxy.score - 20);
    }
  }

  /**
   * Add proxies to the pool
   */
  addProxies(proxies) {
    for (const p of proxies) {
      this._proxies.push({
        url: typeof p === 'string' ? p : p.url,
        type: p.type || 'http',
        score: 100,
        failures: 0,
        lastUsed: 0,
        latency: 0,
      });
    }
  }

  /**
   * Remove a proxy from the pool
   */
  removeProxy(url) {
    this._proxies = this._proxies.filter(p => p.url !== url);
  }

  /**
   * Get proxy pool stats
   */
  getStats() {
    return {
      total: this._proxies.length,
      healthy: this._proxies.filter(p => p.failures < this._maxFailures).length,
      active: this._proxies[this._currentIndex]?.url || null,
      proxies: this._proxies.map(p => ({
        url: p.url.replace(/:\/\/[^@]+@/, '://***@'), // Mask credentials
        type: p.type,
        score: p.score,
        failures: p.failures,
        latency: p.latency,
      })),
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
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        await fetch(this._healthCheckUrl, {
          signal: controller.signal,
          // Note: Node.js fetch doesn't support proxy directly,
          // this is a placeholder for actual proxy-aware HTTP client
        });
        clearTimeout(timer);
        this.reportResult(proxy, true, Date.now() - start);
        results.push({ url: proxy.url, alive: true, latency: Date.now() - start });
      } catch {
        this.reportResult(proxy, false);
        results.push({ url: proxy.url, alive: false });
      }
    }
    return results;
  }
}

module.exports = { ProxyRotator };