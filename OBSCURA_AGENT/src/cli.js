#!/usr/bin/env node
/**
 * Obscura Agent — CLI
 *
 * Usage:
 *   node cli.js scrape <url> [--format html|text|json] [--eval <js>]
 *   node cli.js monitor <url> [--interval <seconds>]
 *   node cli.js extract <url> [--schema <name>]
 *   node cli.js serve [--port <port>]
 *   node cli.js status
 *   node cli.js batch <url1,url2,url3>
 */

const { CoreEngine } = require('./core');
const { Scraper } = require('./scraper');
const { Monitor } = require('./monitor');
const { AIExtractor } = require('./ai-extractor');
const { CDPBridge } = require('./cdp');
const { ProxyRotator } = require('./proxy-rotator');
const { APIServer } = require('./api-server');
const { Scheduler } = require('./scheduler');
const { SearchEngine } = require('./engine');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help') {
    console.log(`
🕸️  Obscura Agent — Web Intelligence CLI

Commands:
  search <query>       Multi-engine search (--engine duckduckgo|google|bing|brave, --limit <n>)
  scrape <url>         Scrape a URL (--format html|text|json, --eval <js>, --timeout <ms>)
  batch <urls>         Scrape multiple URLs (comma-separated)
  monitor <url>        Start monitoring a URL for changes (--interval <seconds>)
  extract <url>        Extract structured data from a URL (--schema <json>)
  serve                Start API server (--port <port>)
  status               Show agent status
  help                 Show this help

Examples:
  node cli.js search "machine learning" --engine duckduckgo --limit 10
  node cli.js scrape "https://example.com" --format text
  node cli.js batch "https://a.com,https://b.com"
  node cli.js monitor "https://example.com" --interval 60
  node cli.js serve --port 3000
`);
    process.exit(0);
  }

  const core = new CoreEngine();

  switch (command) {
    case 'search': {
      const query = args[1];
      if (!query) { console.error('Error: Query required'); process.exit(1); }
      const options = parseOptions(args.slice(2));
      const searchEngine = new SearchEngine();
      const results = await searchEngine.search(query, options);
      const deduped = searchEngine.deduplicate(results);
      console.log(JSON.stringify({ results: deduped, total: deduped.length }, null, 2));
      break;
    }

    case 'scrape': {
      const url = args[1];
      if (!url) { console.error('Error: URL required'); process.exit(1); }
      const options = parseOptions(args.slice(2));
      const scraper = new Scraper({ core });
      const result = await scraper.scrape(url, options);
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'batch': {
      const urls = args[1]?.split(',').map(u => u.trim());
      if (!urls?.length) { console.error('Error: URLs required'); process.exit(1); }
      const options = parseOptions(args.slice(2));
      const scraper = new Scraper({ core });
      const results = await scraper.scrapeBatch(urls, options);
      console.log(JSON.stringify(results, null, 2));
      break;
    }

    case 'monitor': {
      const url = args[1];
      if (!url) { console.error('Error: URL required'); process.exit(1); }
      const interval = parseInt(args.find(a => a.startsWith('--interval='))?.split('=')[1] || '60');
      const scraper = new Scraper({ core });
      const monitor = new Monitor({ core });
      await core.boot({ scraper, monitor });
      const result = monitor.start(url, interval * 1000);
      console.log(`Monitoring: ${url} every ${interval}s`);
      core.on('pageChanged', ({ diff }) => {
        console.log(`[${new Date().toISOString()}] Page changed! ±${diff.totalChanges} lines`);
      });
      // Keep running
      process.on('SIGINT', () => { monitor.stopAll(); process.exit(0); });
      break;
    }

    case 'extract': {
      const url = args[1];
      if (!url) { console.error('Error: URL required'); process.exit(1); }
      const schema = args.find(a => a.startsWith('--schema='))?.split('=')[1] || null;
      const scraper = new Scraper({ core });
      const extractor = new AIExtractor();
      const result = await scraper.scrape(url, { format: 'html' });
      if (!result.success) { console.error('Scrape failed:', result.error); process.exit(1); }
      const data = extractor.extract(result.output, schema);
      console.log(JSON.stringify(data, null, 2));
      break;
    }

    case 'serve': {
      const port = parseInt(args.find(a => a.startsWith('--port='))?.split('=')[1] || '3000');
      const scraper = new Scraper({ core });
      const monitor = new Monitor({ core });
      const extractor = new AIExtractor();
      const cdp = new CDPBridge();
      const proxy = new ProxyRotator();
      const scheduler = new Scheduler();
      const server = new APIServer({ port, core });

      await core.boot({ scraper, monitor, extractor, cdp, proxy, scheduler });
      // Try to connect CDP
      try { await cdp.connect(); } catch { console.log('[warn] CDP not available — HTTP-only mode'); }

      const info = await server.start();
      console.log(`🕸️  Obscura Agent API running on http://${info.host}:${info.port}`);
      console.log(`   /api/status  /api/scrape  /api/batch  /api/extract  /api/screenshot`);

      process.on('SIGINT', async () => {
        await cdp.disconnect();
        await server.stop();
        process.exit(0);
      });
      break;
    }

    case 'status': {
      console.log(JSON.stringify({
        status: 'ready',
        version: '1.0.0',
        state: core.state,
        metrics: core.metrics,
      }, null, 2));
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

function parseOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2).replace(/-/g, '_');
      const val = args[i].includes('=') ? args[i].split('=')[1] : args[i + 1];
      options[key] = isNaN(val) ? val : parseInt(val);
      if (!args[i].includes('=')) i++;
    }
  }
  return options;
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });