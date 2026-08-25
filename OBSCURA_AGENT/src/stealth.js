/**
 * Obscura Agent — Stealth Module
 * Anti-detection: fingerprint normalization, canvas noise, WebDriver removal
 */

class Stealth {
  constructor(opts = {}) {
    this.enabled = opts.enabled !== false;
    this.patches = {
      webdriver: true,       // Remove navigator.webdriver
      chromeRuntime: true,    // Fix chrome.runtime detection
      permissions: true,      // Normalize permissions API
      plugins: true,          // Add realistic plugin array
      languages: true,        // Set realistic language list
      canvas: true,           // Add canvas fingerprint noise
      webgl: true,            // Normalize WebGL vendor/renderer
      audioContext: true,     // Add AudioContext fingerprint noise
      fontFingerprinting: true, // Normalize font enumeration
      screenResolution: true,  // Report realistic resolution
    };
    this._userAgent = opts.userAgent ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
  }

  /**
   * Generate stealth script to inject before page load
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
   * Apply stealth to CDP session
   */
  async applyToCDP(cdp) {
    if (!this.enabled) return;

    await cdp.send('Network.setUserAgentOverride', { userAgent: this._userAgent });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: this.generateScript() });

    // Disable automation indicators
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  }

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

module.exports = { Stealth };