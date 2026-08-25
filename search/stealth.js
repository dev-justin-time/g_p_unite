/**
 * Obscura Search — Stealth Manager
 * Anti-detection, SSRF protection, robots.txt compliance
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Private / reserved IP ranges for SSRF blocking
const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fd[0-9a-f]{2}:/,
  /^fe80:/i,
  /^localhost$/i,
  /^.*\.local$/i,
  /^.*\.internal$/i,
  /^metadata\.google\.internal$/i,
  /^169\.254\.169\.254$/ // Cloud metadata
];

// Common browser fingerprints
const FINGERPRINTS = [
  { platform: 'Win32', languages: ['en-US', 'en'], webgl: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090, OpenGL 4.5)' },
  { platform: 'MacIntel', languages: ['en-US', 'en'], webgl: 'Apple GPU' },
  { platform: 'Linux x86_64', languages: ['en-US', 'en'], webgl: 'Mesa (AMD Radeon RX 7900 XTX)' },
  { platform: 'Win32', languages: ['en-GB', 'en-US', 'en'], webgl: 'ANGLE (Intel, Intel Iris Xe, OpenGL 4.5)' }
];

class StealthManager {
  constructor() {
    this._robotsCache = new Map();
    this._robotsTTL = 3600_000; // 1 hour
    this.ssrfProtection = true;
    this.respectRobots = true;
  }

  /**
   * Validate URL is safe to fetch (SSRF check)
   */
  validateURL(urlString) {
    if (!this.ssrfProtection) return true;

    try {
      const url = new URL(urlString);
      const hostname = url.hostname;

      // Check private ranges
      for (const pattern of PRIVATE_RANGES) {
        if (pattern.test(hostname)) return false;
      }

      // Block non-http protocols
      if (!['http:', 'https:'].includes(url.protocol)) return false;

      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Check if URL is allowed by robots.txt
   */
  async checkRobots(urlString) {
    if (!this.respectRobots) return true;

    try {
      const url = new URL(urlString);
      const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;

      // Check cache
      const cached = this._robotsCache.get(url.host);
      if (cached && Date.now() - cached.time < this._robotsTTL) {
        return this._isAllowed(url.pathname, cached.rules);
      }

      // Fetch robots.txt
      const rules = await this._fetchRobots(robotsUrl);
      this._robotsCache.set(url.host, { rules, time: Date.now() });
      return this._isAllowed(url.pathname, rules);
    } catch (e) {
      // If robots.txt can't be fetched, assume allowed
      return true;
    }
  }

  /**
   * Generate a random browser fingerprint for requests
   */
  getRandomFingerprint() {
    return FINGERPRINTS[Math.floor(Math.random() * FINGERPRINTS.length)];
  }

  /**
   * Get stealth headers for a request
   */
  getStealthHeaders(fingerprint = null) {
    const fp = fingerprint || this.getRandomFingerprint();
    return {
      'User-Agent': this._getRandomUA(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': fp.languages.join(', ') + ';q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
      'sec-ch-ua': '"Chromium";v="126", "Not(A:Brand";v="8"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': `"${fp.platform === 'MacIntel' ? 'macOS' : fp.platform === 'Win32' ? 'Windows' : 'Linux'}"`,
      'DNT': '1'
    };
  }

  /**
   * Generate a realistic referrer chain
   */
  getReferrerChain(targetDomain) {
    const referrers = [
      'https://www.google.com/',
      'https://www.bing.com/',
      'https://duckduckgo.com/',
      'https://www.reddit.com/',
      'https://twitter.com/',
      'https://news.ycombinator.com/'
    ];
    return referrers[Math.floor(Math.random() * referrers.length)];
  }

  /**
   * Add randomized delay to avoid rate limiting
   */
  randomDelay(minMs = 500, maxMs = 2000) {
    const delay = minMs + Math.random() * (maxMs - minMs);
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  // ─── Internal ────────────────────────────────────────────

  _getRandomUA() {
    const uas = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    ];
    return uas[Math.floor(Math.random() * uas.length)];
  }

  async _fetchRobots(url) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 5000);
      const proto = url.startsWith('https') ? https : http;
      proto.get(url, { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', c => data += c.toString());
        res.on('end', () => {
          clearTimeout(timer);
          resolve(this._parseRobotsTxt(data));
        });
      }).on('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });
  }

  _parseRobotsTxt(text) {
    const rules = [];
    let currentAgent = '*';
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('User-agent:')) {
        currentAgent = trimmed.split(':')[1].trim();
      } else if (trimmed.startsWith('Disallow:')) {
        const path = trimmed.split(':')[1].trim();
        if (path) rules.push({ agent: currentAgent, path, allow: false });
      } else if (trimmed.startsWith('Allow:')) {
        const path = trimmed.split(':')[1].trim();
        rules.push({ agent: currentAgent, path, allow: true });
      }
    }
    return rules;
  }

  _isAllowed(pathname, rules) {
    // Check rules for * agent (most permissive)
    const relevantRules = rules.filter(r => r.agent === '*' || r.agent === 'Obscura');
    let allowed = true;
    for (const rule of relevantRules) {
      if (pathname.startsWith(rule.path)) {
        allowed = rule.allow;
      }
    }
    return allowed;
  }
}

module.exports = { StealthManager };
