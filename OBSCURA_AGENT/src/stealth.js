/**
 * Obscura Agent — Stealth Module (Merged)
 * HTTP-level: SSRF protection, robots.txt compliance, browser fingerprint headers
 * Browser-level: CDP injection (WebDriver removal, canvas noise, WebGL normalization)
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// ─── Private / reserved IP ranges for SSRF blocking ────────────
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

// ─── Common browser fingerprints for HTTP requests ─────────────
const FINGERPRINTS = [
  { platform: 'Win32', languages: ['en-US', 'en'], webgl: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090, OpenGL 4.5)' },
  { platform: 'MacIntel', languages: ['en-US', 'en'], webgl: 'Apple GPU' },
  { platform: 'Linux x86_64', languages: ['en-US', 'en'], webgl: 'Mesa (AMD Radeon RX 7900 XTX)' },
  { platform: 'Win32', languages: ['en-GB', 'en-US', 'en'], webgl: 'ANGLE (Intel, Intel Iris Xe, OpenGL 4.5)' }
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
];

class Stealth {
  constructor(opts = {}) {
    this.enabled = opts.enabled !== false;
    this.ssrfProtection = opts.ssrfProtection !== false;
    this.respectRobots = opts.respectRobots !== false;

    this._robotsCache = new Map();
    this._robotsTTL = 3600_000;
    this._userAgent = opts.userAgent || USER_AGENTS[0];

    // Browser-level CDP patches
    this.patches = {
      webdriver: true,
      chromeRuntime: true,
      permissions: true,
      plugins: true,
      languages: true,
      canvas: true,
      webgl: true,
      audioContext: true,
      fontFingerprinting: true,
      screenResolution: true,
    };
  }

  // ─── HTTP-Level Stealth ────────────────────────────────────

  /**
   * Validate URL is safe to fetch (SSRF check)
   */
  validateURL(urlString) {
    if (!this.ssrfProtection) return true;
    try {
      const url = new URL(urlString);
      const hostname = url.hostname;
      for (const pattern of PRIVATE_RANGES) {
        if (pattern.test(hostname)) return false;
      }
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
      const cached = this._robotsCache.get(url.host);
      if (cached && Date.now() - cached.time < this._robotsTTL) {
        return this._isAllowed(url.pathname, cached.rules);
      }
      const rules = await this._fetchRobots(robotsUrl);
      this._robotsCache.set(url.host, { rules, time: Date.now() });
      return this._isAllowed(url.pathname, rules);
    } catch (e) {
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
   * Get stealth headers for HTTP requests
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
  getReferrerChain() {
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

  // ─── Browser-Level Stealth (CDP Injection) ────────────────

  /**
   * Generate stealth script to inject before page load via CDP
   */
  generateScript() {
    const patches = [];
    if (this.patches.webdriver) patches.push(this._patchWebDriver());
    if (this.patches.chromeRuntime) patches.push(this._patchChromeRuntime());
    if (this.patches.permissions) patches.push(this._patchPermissions());
    if (this.patches.plugins) patches.push(this._patchPlugins());
    if (this.patches.canvas) patches.push(this._patchCanvas());
    if (this.patches.webgl) patches.push(this._patchWebGL());
    if (this.patches.audioContext) patches.push(this._patchAudioContext());
    if (this.patches.languages) patches.push(this._patchLanguages());
    if (this.patches.fontFingerprinting) patches.push(this._patchFonts());
    return `(function() { ${patches.join('\n')} })();`;
  }

  /**
   * Apply stealth to a CDP session
   */
  async applyToCDP(cdp) {
    if (!this.enabled) return;
    await cdp.send('Network.setUserAgentOverride', { userAgent: this._userAgent });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: this.generateScript() });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  }

  // ─── Internal: HTTP ─────────────────────────────────────────

  _getRandomUA() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
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
    const relevantRules = rules.filter(r => r.agent === '*' || r.agent === 'Obscura');
    let allowed = true;
    for (const rule of relevantRules) {
      if (pathname.startsWith(rule.path)) {
        allowed = rule.allow;
      }
    }
    return allowed;
  }

  // ─── Internal: Browser CDP Patches ──────────────────────────

  _patchWebDriver() {
    return `
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      delete navigator.__proto__.webdriver;
    `;
  }

  _patchChromeRuntime() {
    return `
      window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };
    `;
  }

  _patchPermissions() {
    return `
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (params) => (
        params.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(params)
      );
    `;
  }

  _patchPlugins() {
    return `
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5].map(() => new Plugin()),
        configurable: true
      });
      function Plugin() {
        this.name = 'Chrome PDF Plugin';
        this.description = 'Portable Document Format';
        this.filename = 'internal-pdf-viewer';
        this.length = 1;
      }
      Plugin.prototype.item = function() { return null; };
      Plugin.prototype.namedItem = function() { return null; };
    `;
  }

  _patchCanvas() {
    return `
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type) {
        const context = this.getContext('2d');
        if (context) {
          const shift = {
            r: Math.floor(Math.random() * 2) - 1,
            g: Math.floor(Math.random() * 2) - 1,
            b: Math.floor(Math.random() * 2) - 1
          };
          const imageData = context.getImageData(0, 0, this.width, this.height);
          for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + shift.r));
            imageData.data[i + 1] = Math.min(255, Math.max(0, imageData.data[i + 1] + shift.g));
            imageData.data[i + 2] = Math.min(255, Math.max(0, imageData.data[i + 2] + shift.b));
          }
          context.putImageData(imageData, 0, 0);
        }
        return originalToDataURL.apply(this, arguments);
      };
    `;
  }

  _patchWebGL() {
    return `
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(param) {
        if (param === 37445) return 'Intel Inc.';
        if (param === 37446) return 'Intel Iris OpenGL Engine';
        return getParameter.call(this, param);
      };
    `;
  }

  _patchAudioContext() {
    return `
      const originalGetChannelData = AudioBuffer.prototype.getChannelData;
      AudioBuffer.prototype.getChannelData = function() {
        const results = originalGetChannelData.call(this);
        for (let i = 0; i < results.length; i += 100) {
          results[i] += (Math.random() * 0.0000001);
        }
        return results;
      };
    `;
  }

  _patchLanguages() {
    return `
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
        configurable: true
      });
    `;
  }

  _patchFonts() {
    return `
      const originalMeasureText = CanvasRenderingContext2D.prototype.measureText;
      CanvasRenderingContext2D.prototype.measureText = function(text) {
        const result = originalMeasureText.call(this, text);
        result.width += Math.random() * 0.1;
        return result;
      };
    `;
  }
}

module.exports = { Stealth, StealthManager: Stealth };
