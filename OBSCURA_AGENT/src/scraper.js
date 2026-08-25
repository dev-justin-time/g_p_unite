/**
 * Obscura Agent — Scraper Module
 * High-performance URL scraping with retry, timeout, and format support
 */

const cheerio = require('cheerio');
const robotsParser = require('robots-parser');
const { URL } = require('url');

class Scraper {
  constructor(opts = {}) {
    this.maxRetries = opts.maxRetries || 3;
    this.retryDelay = opts.retryDelay || 1000;
    this.timeout = opts.timeout || 30000;
    this.respectRobots = opts.respectRobots !== false;
    this._robotsCache = new Map();
    this._core = opts.core;
  }

  /**
   * Scrape a single URL
   * @param {string} url
   * @param {object} options
   * @returns {Promise<{success: boolean, output: string, error: string|null, latency: number}>}
   */
  async scrape(url, options = {}) {
    const startTime = Date.now();
    const format = options.format || 'html';
    const expression = options.eval || null;
    const waitUntil = options.waitUntil || 'load';
    const timeout = options.timeout || this.timeout;

    // Check robots.txt
    if (this.respectRobots && !(await this._isAllowed(url))) {
      return { success: false, output: '', error: 'Blocked by robots.txt', latency: Date.now() - startTime, url };
    }

    let lastError = null;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this._fetch(url, { format, expression, waitUntil, timeout });
        const latency = Date.now() - startTime;

        if (this._core) this._core.recordScrape(true, latency);
        return { ...result, latency, url };
      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries) {
          await this._sleep(this.retryDelay * attempt);
        }
      }
    }

    if (this._core) this._core.recordScrape(false, Date.now() - startTime);
    return { success: false, output: '', error: lastError?.message || 'Unknown error', latency: Date.now() - startTime, url };
  }

  /**
   * Scrape multiple URLs in parallel
   */
  async scrapeBatch(urls, options = {}) {
    const concurrency = options.concurrency || 10;
    const results = [];

    // Process in chunks
    for (let i = 0; i < urls.length; i += concurrency) {
      const chunk = urls.slice(i, i + concurrency);
      const chunkResults = await Promise.all(chunk.map(url => this.scrape(url, options)));
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Internal fetch using CDP or HTTP
   */
  async _fetch(url, options) {
    const { format, expression, timeout } = options;

    // Check if CDP bridge is available
    if (this._core?._modules?.cdp?.isConnected()) {
      return this._cdpFetch(url, options);
    }

    // Fallback: HTTP fetch
    return this._httpFetch(url, options);
  }

  async _cdpFetch(url, options) {
    const cdp = this._core._modules.cdp;
    await cdp.send('Page.enable');
    await cdp.send('Page.navigate', { url });

    // Wait for load
    await new Promise(r => setTimeout(r, options.waitUntil === 'domcontentloaded' ? 1000 : 2000));

    if (options.expression) {
      const result = await cdp.evaluate(options.expression);
      return { success: true, output: JSON.stringify(result), error: null };
    }

    const result = await cdp.send('Runtime.evaluate', {
      expression: `document.documentElement.${options.format === 'text' ? 'innerText' : 'outerHTML'}`,
      returnByValue: true
    });

    return { success: true, output: result?.result?.value || '', error: null };
  }

  async _httpFetch(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout);

    try {
      const response = await fetch(url, { signal: controller.signal });
      const html = await response.text();

      if (options.format === 'text') {
        const $ = cheerio.load(html);
        return { success: true, output: $('body').text().trim(), error: null };
      }
      if (options.format === 'json') {
        return { success: true, output: html, error: null };
      }

      return { success: true, output: html, error: null };
    } finally {
      clearTimeout(timer);
    }
  }

  async _isAllowed(url) {
    try {
      const { origin } = new URL(url);
      if (!this._robotsCache.has(origin)) {
        const robotsUrl = `${origin}/robots.txt`;
        const response = await fetch(robotsUrl);
        const text = await response.text();
        this._robotsCache.set(origin, robotsParser(robotsUrl, text));
      }
      return this._robotsCache.get(origin).isAllowed(url, 'ObscuraAgent/2.0') ?? true;
    } catch {
      return true; // Allow if robots.txt is unavailable
    }
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

module.exports = { Scraper };