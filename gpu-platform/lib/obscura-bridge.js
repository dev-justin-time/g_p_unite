/**
 * G P Unite — Obscura Bridge
 * Node.js bridge to communicate with obscura headless browser via CDP
 * https://github.com/h4ckf0r0day/obscura
 *
 * Usage:
 *   const { ObscuraBridge } = require('./obscura-bridge');
 *   const browser = new ObscuraBridge({ port: 9222 });
 *   await browser.connect();
 *   const result = await browser.fetch('https://example.com', { eval: 'document.title' });
 *   await browser.disconnect();
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class ObscuraBridge {
  constructor(options = {}) {
    this.port = options.port || 9222;
    this.host = options.host || '127.0.0.1';
    this.stealth = options.stealth || false;
    this.proxy = options.proxy || null;
    this.binPath = options.binPath || path.join(__dirname, '..', 'bin', 'obscura');
    this.process = null;
    this.ws = null;
    this._msgId = 0;
    this._callbacks = new Map();
    this._connected = false;
  }

  /**
   * Start the obscura CDP server
   */
  async start() {
    if (this.process) return;

    const args = ['serve', '--port', String(this.port)];
    if (this.stealth) args.push('--stealth');
    if (this.proxy) args.push('--proxy', this.proxy);

    return new Promise((resolve, reject) => {
      this.process = spawn(this.binPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      });

      let started = false;
      this.process.stdout.on('data', (data) => {
        const output = data.toString();
        if (!started && (output.includes('Listening') || output.includes('CDP') || output.includes('9222'))) {
          started = true;
          resolve();
        }
      });

      this.process.stderr.on('data', (data) => {
        // Obscura may write startup info to stderr
      });

      this.process.on('error', (err) => {
        if (!started) reject(err);
      });

      this.process.on('exit', (code) => {
        this.process = null;
        this._connected = false;
      });

      // Timeout fallback
      setTimeout(() => {
        if (!started) { started = true; resolve(); }
      }, 5000);
    });
  }

  /**
   * Connect to running obscura instance via WebSocket
   */
  async connect() {
    const WebSocket = require('ws');
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://${this.host}:${this.port}/devtools/browser`);

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
        } catch (e) { /* ignore */ }
      });

      this.ws.on('close', () => { this._connected = false; });
      this.ws.on('error', (err) => reject(err));

      setTimeout(() => { if (!this._connected) reject(new Error('Connection timeout')); }, 10000);
    });
  }

  /**
   * Send CDP command
   */
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this._connected) { reject(new Error('Not connected')); return; }
      const id = ++this._msgId;
      this._callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this._callbacks.has(id)) {
          this._callbacks.delete(id);
          reject(new Error('CDP command timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Fetch a URL using obscura's CLI
   */
  fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
      const args = ['fetch', url];
      if (options.eval) args.push('--eval', options.eval);
      if (options.dump) args.push('--dump', options.dump);
      if (options.screenshot) args.push('--screenshot', options.screenshot);
      if (options.waitUntil) args.push('--wait-until', options.waitUntil);
      if (options.timeout) args.push('--timeout', String(options.timeout));
      if (this.stealth) args.push('--stealth');
      if (this.proxy) args.push('--proxy', this.proxy);

      let output = '';
      let errOutput = '';
      const proc = spawn(this.binPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

      proc.stdout.on('data', (d) => { output += d.toString(); });
      proc.stderr.on('data', (d) => { errOutput += d.toString(); });
      proc.on('close', (code) => {
        resolve({ code, output: output.trim(), error: errOutput.trim() });
      });
      proc.on('error', reject);
    });
  }

  /**
   * Scrape multiple URLs in parallel
   */
  scrape(urls, options = {}) {
    return new Promise((resolve, reject) => {
      const args = ['scrape', ...urls];
      if (options.concurrency) args.push('--concurrency', String(options.concurrency));
      if (options.eval) args.push('--eval', options.eval);
      if (options.format) args.push('--format', options.format);
      if (this.stealth) args.push('--stealth');
      if (this.proxy) args.push('--proxy', this.proxy);

      let output = '';
      const proc = spawn(this.binPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      proc.stdout.on('data', (d) => { output += d.toString(); });
      proc.on('close', () => {
        try { resolve(JSON.parse(output)); }
        catch { resolve(output.trim().split('\n').filter(Boolean)); }
      });
      proc.on('error', reject);
    });
  }

  /**
   * Take a screenshot via CDP
   */
  async screenshot(url, outputPath) {
    await this.send('Page.enable');
    await this.send('Page.navigate', { url });
    await this.send('Page.loadEventFired');
    await new Promise(r => setTimeout(r, 2000));
    const result = await this.send('Page.captureScreenshot', { format: 'png' });
    if (outputPath && result.data) {
      fs.writeFileSync(outputPath, Buffer.from(result.data, 'base64'));
    }
    return result;
  }

  /**
   * Evaluate JavaScript on a page
   */
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return result?.result?.value;
  }

  /**
   * Disconnect and optionally stop the server
   */
  async disconnect() {
    if (this.ws) { this.ws.close(); this.ws = null; }
    this._connected = false;
  }

  /**
   * Stop the obscura process
   */
  stop() {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
    this._connected = false;
  }

  get isConnected() { return this._connected; }
}

/**
 * Quick CLI wrapper for obscura commands
 */
async function obscuraCLI(command, args = []) {
  const binPath = path.join(__dirname, '..', 'bin', 'obscura');
  return new Promise((resolve, reject) => {
    const proc = spawn(binPath, [command, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    proc.stdout.on('data', d => { out += d.toString(); });
    proc.stderr.on('data', d => { err += d.toString(); });
    proc.on('close', code => resolve({ code, stdout: out.trim(), stderr: err.trim() }));
    proc.on('error', reject);
  });
}

module.exports = { ObscuraBridge, obscuraCLI };
