/**
 * Obscura Search — Search Engine Module
 * Multi-engine search with result parsing, deduplication, and scoring
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// User agents for rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0'
];

class SearchEngine {
  constructor() {
    this.engines = {
      duckduckgo: this._searchDuckDuckGo.bind(this),
      google: this._searchGoogle.bind(this),
      bing: this._searchBing.bind(this),
      brave: this._searchBrave.bind(this)
    };
    this._cache = new Map();
    this._cacheTTL = 5 * 60 * 1000; // 5 min
  }

  /**
   * Search across configured engine
   */
  async search(query, options = {}) {
    const { engine = 'duckduckgo', limit = 25, region = 'wt-wt', proxy = null } = options;
    const cacheKey = `${engine}:${query}:${region}:${limit}`;

    // Check cache
    const cached = this._cache.get(cacheKey);
    if (cached && Date.now() - cached.time < this._cacheTTL) {
      return cached.results.slice(0, limit);
    }

    const searchFn = this.engines[engine];
    if (!searchFn) throw new Error(`Unknown engine: ${engine}`);

    const results = await searchFn(query, { limit, region, proxy });
    const scored = this._scoreResults(results, query);

    // Cache results
    this._cache.set(cacheKey, { results: scored, time: Date.now() });

    return scored.slice(0, limit);
  }

  /**
   * DuckDuckGo HTML search (no API key needed)
   */
  async _searchDuckDuckGo(query, { limit, region, proxy }) {
    const params = new URLSearchParams({
      q: query,
      kl: region !== 'wt-wt' ? region : '',
      b: '0',
      dc: String(limit)
    });

    const url = `https://html.duckduckgo.com/html/?${params}`;
    const html = await this._fetch(url, { proxy });
    return this._parseDuckDuckGoHTML(html);
  }

  /**
   * Google search via scraping (HTML parse)
   */
  async _searchGoogle(query, { limit, region, proxy }) {
    const params = new URLSearchParams({ q: query, num: String(limit), hl: 'en' });
    const url = `https://www.google.com/search?${params}`;
    const html = await this._fetch(url, { proxy, referer: 'https://www.google.com/' });
    return this._parseGoogleHTML(html);
  }

  /**
   * Bing search (HTML scrape)
   */
  async _searchBing(query, { limit, region, proxy }) {
    const params = new URLSearchParams({ q: query, count: String(limit) });
    const url = `https://www.bing.com/search?${params}`;
    const html = await this._fetch(url, { proxy });
    return this._parseBingHTML(html);
  }

  /**
   * Brave Search (HTML scrape)
   */
  async _searchBrave(query, { limit, region, proxy }) {
    const params = new URLSearchParams({ q: query, count: String(limit) });
    const url = `https://search.brave.com/search?${params}`;
    const html = await this._fetch(url, { proxy });
    return this._parseBraveHTML(html);
  }

  // ─── HTML Parsers ────────────────────────────────────────

  _parseDuckDuckGoHTML(html) {
    const results = [];
    // Match result blocks
    const resultRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = resultRegex.exec(html)) !== null) {
      let url = match[1];
      // DuckDuckGo wraps URLs in redirects
      const uddg = url.match(/uddg=([^&]+)/);
      if (uddg) url = decodeURIComponent(uddg[1]);

      results.push({
        title: this._stripHTML(match[2]),
        url: url,
        snippet: this._stripHTML(match[3]),
        engine: 'duckduckgo'
      });
    }

    // Fallback: simpler regex
    if (results.length === 0) {
      const simpleRegex = /<a[^>]+href="([^"]*)"[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/gi;
      while ((match = simpleRegex.exec(html)) !== null) {
        let url = match[1];
        const uddg = url.match(/uddg=([^&]+)/);
        if (uddg) url = decodeURIComponent(uddg[1]);
        results.push({ title: this._stripHTML(match[2]), url, snippet: '', engine: 'duckduckgo' });
      }
    }

    return results;
  }

  _parseGoogleHTML(html) {
    const results = [];
    // Google search results pattern
    const regex = /<div[^>]*class="[^"]*"[^>]*>[\s\S]*?<a[^>]+href="\/url\?q=([^&"]+)/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const url = decodeURIComponent(match[1]);
      if (url.startsWith('http')) {
        results.push({ title: '', url, snippet: '', engine: 'google' });
      }
    }

    // Extract titles from surrounding context
    const titleRegex = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
    let i = 0;
    while ((match = titleRegex.exec(html)) !== null && i < results.length) {
      results[i].title = this._stripHTML(match[1]);
      i++;
    }

    return results;
  }

  _parseBingHTML(html) {
    const results = [];
    const regex = /<li class="b_algo"[^>]*>[\s\S]*?<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      results.push({
        title: this._stripHTML(match[2]),
        url: match[1],
        snippet: this._stripHTML(match[3]),
        engine: 'bing'
      });
    }
    return results;
  }

  _parseBraveHTML(html) {
    const results = [];
    const regex = /<a[^>]+class="[^"]*result-header[^"]*"[^>]+href="([^"]*)"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/a>[\s\S]*?<p[^>]*class="[^"]*snippet-description[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      results.push({
        title: this._stripHTML(match[2]),
        url: match[1],
        snippet: this._stripHTML(match[3]),
        engine: 'brave'
      });
    }
    return results;
  }

  // ─── Scrape URL ──────────────────────────────────────────

  async scrapeURL(url, options = {}) {
    const { dump = 'html', eval: evalCode = null, proxy = null, timeout = 30, screenshot = null } = options;
    const html = await this._fetch(url, { proxy, timeout: timeout * 1000 });

    if (evalCode) {
      // Simple eval: extract via regex patterns
      try {
        const extracted = this._simpleEval(html, evalCode);
        return { output: extracted, code: 0, url };
      } catch (e) {
        return { output: html, code: 0, url, evalError: e.message };
      }
    }

    if (dump === 'text') {
      return { output: this._htmlToText(html), code: 0, url };
    }

    return { output: html, code: 0, url };
  }

  // ─── Data Extraction ─────────────────────────────────────

  async extractData(url, schema, options = {}) {
    const html = await this._fetch(url, options);
    const extracted = {};

    for (const [key, selector] of Object.entries(schema)) {
      if (typeof selector === 'string') {
        extracted[key] = this._extractBySelector(html, selector);
      } else if (Array.isArray(selector)) {
        extracted[key] = selector.map(s => this._extractBySelector(html, s)).flat();
      }
    }

    return extracted;
  }

  _extractBySelector(html, selector) {
    // Simple CSS selector parser for common patterns
    // Supports: tag, .class, #id, tag.class, tag[attr]
    const results = [];

    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      const regex = new RegExp(`<[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/`, 'gi');
      let m;
      while ((m = regex.exec(html)) !== null) results.push(this._stripHTML(m[1]));
    } else if (selector.includes('[')) {
      // attribute selector: img[src], a[href]
      const [tag, attr] = selector.split('[');
      const attrName = attr.replace(']', '');
      const regex = new RegExp(`<${tag || '[a-z]'}[^>]+${attrName}=["']([^"']*)["']`, 'gi');
      let m;
      while ((m = regex.exec(html)) !== null) results.push(m[1]);
    } else if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      const regex = new RegExp(`<[^>]+class=["'][^"']*\\b${cls}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/`, 'gi');
      let m;
      while ((m = regex.exec(html)) !== null) results.push(this._stripHTML(m[1]));
    } else {
      // Tag selector
      const regex = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'gi');
      let m;
      while ((m = regex.exec(html)) !== null) results.push(this._stripHTML(m[1]));
    }

    return results;
  }

  // ─── Deduplication & Scoring ─────────────────────────────

  deduplicate(results) {
    const seen = new Set();
    return results.filter(r => {
      const key = r.url?.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  _scoreResults(results, query) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return results.map(r => {
      const text = `${r.title || ''} ${r.snippet || ''}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (text.includes(term)) score += 2;
        if ((r.title || '').toLowerCase().includes(term)) score += 3;
      }
      // Prefer HTTPS
      if (r.url?.startsWith('https://')) score += 1;
      // Penalize very short snippets
      if ((r.snippet || '').length < 20) score -= 1;
      return { ...r, score };
    }).sort((a, b) => b.score - a.score);
  }

  // ─── HTTP Client ─────────────────────────────────────────

  async _fetch(url, options = {}) {
    const { proxy = null, referer = null, timeout = 15000, headers: extraHeaders = {} } = options;
    const parsedUrl = new URL(url);

    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const headers = {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'identity',
      ...extraHeaders
    };
    if (referer) headers['Referer'] = referer;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Request timeout')), timeout);

      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers
      };

      // If proxy specified, use it
      if (proxy) {
        try {
          const proxyUrl = new URL(proxy);
          reqOptions.hostname = proxyUrl.hostname;
          reqOptions.port = proxyUrl.port;
          reqOptions.path = url;
          reqOptions.headers['Host'] = parsedUrl.hostname;
        } catch (e) { /* ignore bad proxy */ }
      }

      const proto = parsedUrl.protocol === 'https:' ? https : http;
      const req = proto.request(reqOptions, (res) => {
        // Follow redirects
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          clearTimeout(timer);
          const redirectUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : `${parsedUrl.protocol}//${parsedUrl.host}${res.headers.location}`;
          this._fetch(redirectUrl, options).then(resolve).catch(reject);
          return;
        }

        let data = '';
        res.on('data', chunk => data += chunk.toString());
        res.on('end', () => {
          clearTimeout(timer);
          resolve(data);
        });
      });

      req.on('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });

      req.setTimeout(timeout, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  // ─── Helpers ─────────────────────────────────────────────

  _stripHTML(html) {
    return (html || '')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _htmlToText(html) {
    return this._stripHTML(html)
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  _simpleEval(html, code) {
    // Very simple "eval" — supports document.title, meta descriptions, etc.
    if (code === 'document.title') {
      const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      return m ? this._stripHTML(m[1]) : '';
    }
    if (code.includes('querySelector')) {
      // Parse querySelector('selector')
      const m = code.match(/querySelector\(['"]([^'"]+)['"]\)/);
      if (m) return this._extractBySelector(html, m[1])[0] || '';
    }
    if (code.includes('querySelectorAll')) {
      const m = code.match(/querySelectorAll\(['"]([^'"]+)['"]\)/);
      if (m) return this._extractBySelector(html, m[1]);
    }
    return html.substring(0, 5000);
  }
}

module.exports = { SearchEngine };
