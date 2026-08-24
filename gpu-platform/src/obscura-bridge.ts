/**
 * G P Unite — Obscura Bridge (TypeScript)
 * Node.js bridge to communicate with obscura headless browser via CDP
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import type { ObscuraScrapeOptions, ObscuraScrapeResult } from './types';

interface CDPMessage {
  id?: number;
  method?: string;
  params?: Record<string, any>;
  result?: any;
  error?: { message: string };
}

interface CallbackEntry {
  resolve: (value: any) => void;
  reject: (reason: Error) => void;
}

export interface ObscuraBridgeOptions {
  port?: number;
  host?: string;
  stealth?: boolean;
  proxy?: string | null;
  binPath?: string;
}

export class ObscuraBridge {
  readonly port: number;
  private host: string;
  private stealth: boolean;
  private proxy: string | null;
  private binPath: string;
  private process: ChildProcess | null = null;
  private ws: any = null;
  private _msgId = 0;
  private _callbacks = new Map<number, CallbackEntry>();
  private _connected = false;

  constructor(options: ObscuraBridgeOptions = {}) {
    this.port = options.port || 9222;
    this.host = options.host || '127.0.0.1';
    this.stealth = options.stealth || false;
    this.proxy = options.proxy || null;
    this.binPath = options.binPath || path.join(__dirname, '..', 'bin', 'obscura');
  }

  get isConnected(): boolean { return this._connected; }

  async start(): Promise<void> {
    if (this.process) return;
    const args = ['serve', '--port', String(this.port)];
    if (this.stealth) args.push('--stealth');
    if (this.proxy) args.push('--proxy', this.proxy);

    return new Promise((resolve) => {
      this.process = spawn(this.binPath, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: false });
      let started = false;
      this.process.stdout?.on('data', (data: Buffer) => {
        if (!started && data.toString().includes(String(this.port))) { started = true; resolve(); }
      });
      this.process.on('error', () => { if (!started) resolve(); });
      this.process.on('exit', () => { this.process = null; this._connected = false; });
      setTimeout(() => { if (!started) { started = true; resolve(); } }, 5000);
    });
  }

  async connect(): Promise<void> {
    const WebSocket = require('ws');
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://${this.host}:${this.port}/devtools/browser`);
      this.ws.on('open', () => { this._connected = true; resolve(); });
      this.ws.on('message', (data: Buffer) => {
        try {
          const msg: CDPMessage = JSON.parse(data.toString());
          if (msg.id && this._callbacks.has(msg.id)) {
            const cb = this._callbacks.get(msg.id)!;
            this._callbacks.delete(msg.id);
            if (msg.error) cb.reject(new Error(msg.error.message));
            else cb.resolve(msg.result);
          }
        } catch (e) { /* ignore */ }
      });
      this.ws.on('close', () => { this._connected = false; });
      this.ws.on('error', (err: Error) => reject(err));
      setTimeout(() => { if (!this._connected) reject(new Error('Connection timeout')); }, 10000);
    });
  }

  send(method: string, params: Record<string, any> = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this._connected) { reject(new Error('Not connected')); return; }
      const id = ++this._msgId;
      this._callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this._callbacks.has(id)) { this._callbacks.delete(id); reject(new Error('CDP timeout')); }
      }, 30000);
    });
  }

  fetch(url: string, options: Partial<ObscuraScrapeOptions> = {}): Promise<ObscuraScrapeResult> {
    return new Promise((resolve, reject) => {
      const args = ['fetch', url];
      if (options.eval) args.push('--eval', options.eval);
      if (options.dump) args.push('--dump', options.dump);
      if (options.screenshot) args.push('--screenshot', options.screenshot);
      if (options.waitUntil) args.push('--wait-until', options.waitUntil);
      if (options.timeout) args.push('--timeout', String(options.timeout));
      if (this.stealth) args.push('--stealth');
      if (this.proxy) args.push('--proxy', this.proxy);

      let output = '', errOutput = '';
      const proc = spawn(this.binPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      proc.stdout.on('data', (d: Buffer) => { output += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { errOutput += d.toString(); });
      proc.on('close', (code: number | null) => {
        resolve({ code: code ?? 1, success: code === 0, output: output.trim(), error: errOutput.trim(), url, latency: 0 });
      });
      proc.on('error', reject);
    });
  }

  async screenshot(url: string, outputPath?: string): Promise<any> {
    await this.send('Page.enable');
    await this.send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 2000));
    const result = await this.send('Page.captureScreenshot', { format: 'png' });
    if (outputPath && result?.data) fs.writeFileSync(outputPath, Buffer.from(result.data, 'base64'));
    return result;
  }

  async evaluate(expression: string): Promise<any> {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return result?.result?.value;
  }

  async disconnect(): Promise<void> {
    if (this.ws) { this.ws.close(); this.ws = null; }
    this._connected = false;
  }

  stop(): void {
    if (this.process) { this.process.kill('SIGTERM'); this.process = null; }
    this._connected = false;
  }
}
