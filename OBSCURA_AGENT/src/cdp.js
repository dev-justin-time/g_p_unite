/**
 * Obscura Agent — CDP Bridge Module
 * Chrome DevTools Protocol bridge for headless browser control.
 * Supports both Puppeteer and native WebSocket CDP.
 */

const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');

class CDPBridge {
  constructor(opts = {}) {
    this.host = opts.host || '127.0.0.1';
    this.port = opts.port || 9222;
    this.browserPath = opts.browserPath || null;
    this.ws = null;
    this._msgId = 0;
    this._callbacks = new Map();
    this._connected = false;
    this._process = null;
  }

  isConnected() { return this._connected; }

  /**
   * Launch browser and connect via CDP
   */
  async start() {
    if (this.browserPath) {
      await this._launchBrowser();
      await this._waitForCDP();
    }
    await this.connect();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `ws://${this.host}:${this.port}/devtools/browser`;
        // First get the WebSocket debugger URL
        fetch(`http://${this.host}:${this.port}/json/version`)
          .then(r => r.json())
          .then(info => {
            const url = info.webSocketDebuggerUrl || wsUrl;
            this.ws = new WebSocket(url);

            this.ws.on('open', () => {
              this._connected = true;
              resolve();
            });

            this.ws.on('message', (data) => {
              try {
                const msg = JSON.parse(data.toString());
                if (msg.id && this._callbacks.has(msg.id)) {
                  const cb = this._callbacks.get(msg.id);
                  this._callbacks.delete(msg.id);
                  if (msg.error) cb.reject(new Error(msg.error.message));
                  else cb.resolve(msg.result);
                }
              } catch (e) { /* ignore parse errors */ }
            });

            this.ws.on('close', () => { this._connected = false; });
            this.ws.on('error', (err) => {
              if (!this._connected) reject(err);
            });

            setTimeout(() => {
              if (!this._connected) reject(new Error('CDP connection timeout'));
            }, 10000);
          })
          .catch(() => {
            // Try direct WebSocket connection
            this.ws = new WebSocket(wsUrl);
            this.ws.on('open', () => { this._connected = true; resolve(); });
            this.ws.on('error', (err) => reject(err));
            setTimeout(() => {
              if (!this._connected) reject(new Error('CDP connection timeout'));
            }, 10000);
          });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Send CDP command and wait for response
   */
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this._connected) {
        reject(new Error('CDP not connected'));
        return;
      }
      const id = ++this._msgId;
      this._callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));

      setTimeout(() => {
        if (this._callbacks.has(id)) {
          this._callbacks.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }

  /**
   * Evaluate JavaScript in page context
   */
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return result?.result?.value;
  }

  /**
   * Take screenshot
   */
  async screenshot(format = 'png', quality = 80) {
    await this.send('Page.enable');
    const result = await this.send('Page.captureScreenshot', { format, quality });
    return result?.data || null; // Base64 encoded
  }

  /**
   * Navigate to URL
   */
  async navigate(url) {
    await this.send('Page.enable');
    return this.send('Page.navigate', { url });
  }

  /**
   * Get page HTML
   */
  async getHTML() {
    return this.evaluate('document.documentElement.outerHTML');
  }

  /**
   * Get page text
   */
  async getText() {
    return this.evaluate('document.body.innerText');
  }

  async disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
  }

  async stop() {
    await this.disconnect();
    if (this._process) {
      this._process.kill('SIGTERM');
      this._process = null;
    }
  }

  async _launchBrowser() {
    if (!this.browserPath) return;

    this._process = spawn(this.browserPath, [
      `--remote-debugging-port=${this.port}`,
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-sync',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--mute-audio',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    this._process.on('exit', () => { this._process = null; });
  }

  async _waitForCDP() {
    // Poll until CDP port is available
    for (let i = 0; i < 30; i++) {
      try {
        const response = await fetch(`http://${this.host}:${this.port}/json/version`);
        if (response.ok) return;
      } catch {}
      await new Promise(r => setTimeout(r, 500));
    }
    throw new Error('Browser CDP did not start');
  }
}

module.exports = { CDPBridge };