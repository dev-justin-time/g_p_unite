/**
 * G P Unite — Obscura API Routes (TypeScript)
 * REST endpoints for the obscura browser agent
 */

import type { IncomingMessage, ServerResponse } from 'http';
import type { ObscuraScrapeOptions, ObscuraStatus } from './types';
import { ObscuraBridge } from './obscura-bridge';

let bridge: ObscuraBridge | null = null;

function getBridge(): ObscuraBridge {
  if (!bridge) bridge = new ObscuraBridge();
  return bridge;
}

function json(res: ServerResponse, code: number, data: unknown): void {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
  });
}

export async function handleObscuraRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  // GET /api/obscura/status
  if (req.method === 'GET' && url.pathname === '/api/obscura/status') {
    const b = getBridge();
    json(res, 200, {
      connected: b.isConnected,
      port: b.port,
      status: b.isConnected ? 'active' : 'standby'
    } satisfies Partial<ObscuraStatus>);
    return true;
  }

  // POST /api/obscura/scrape
  if (req.method === 'POST' && url.pathname === '/api/obscura/scrape') {
    const body = await readBody(req);
    try {
      const opts: ObscuraScrapeOptions = JSON.parse(body);
      if (!opts.url) { json(res, 400, { error: 'url required' }); return true; }
      const b = getBridge();
      const result = await b.fetch(opts.url, opts);
      json(res, 200, result);
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
    return true;
  }

  // POST /api/obscura/connect
  if (req.method === 'POST' && url.pathname === '/api/obscura/connect') {
    const body = await readBody(req);
    try {
      const { port, stealth } = JSON.parse(body);
      const b = new ObscuraBridge({ port, stealth });
      await b.start();
      await b.connect();
      bridge = b;
      json(res, 200, { success: true, port: b.port, connected: b.isConnected });
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
    return true;
  }

  // POST /api/obscura/disconnect
  if (req.method === 'POST' && url.pathname === '/api/obscura/disconnect') {
    const b = getBridge();
    await b.disconnect();
    b.stop();
    bridge = null;
    json(res, 200, { success: true });
    return true;
  }

  return false;
}
