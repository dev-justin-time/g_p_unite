/**
 * Obscura Agent — Main Entry Point (Merged)
 * Standalone web intelligence agent with search, scraping, monitoring, and GUI
 *
 * Usage:
 *   node src/index.js                    # Start with defaults
 *   PORT=3000 node src/index.js          # Custom API port
 *   CDP_PORT=9222 node src/index.js      # Custom CDP port
 *   PROXY_LIST=proxy1,proxy2 node ...    # Provide proxy list
 */

const { CoreEngine } = require('./core');
const { Scraper } = require('./scraper');
const { Monitor } = require('./monitor');
const { Stealth } = require('./stealth');
const { AIExtractor } = require('./ai-extractor');
const { CDPBridge } = require('./cdp');
const { ProxyRotator } = require('./proxy-rotator');
const { Scheduler } = require('./scheduler');
const { SearchEngine } = require('./engine');
const { APIServer } = require('./api-server');

async function main() {
  const config = {
    apiPort: parseInt(process.env.PORT || process.env.OBSCURA_PORT || '3000'),
    cdpPort: parseInt(process.env.CDP_PORT || process.env.OBSCURA_CDP || '9222'),
    cdpHost: process.env.CDP_HOST || '127.0.0.1',
    proxies: process.env.PROXY_LIST?.split(',').filter(Boolean) || [],
    maxConcurrency: parseInt(process.env.MAX_CONCURRENCY || '10'),
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
  };

  console.log('🕸️  Obscura Agent — Starting...');
  console.log(`   API: http://${config.cdpHost}:${config.apiPort}`);
  console.log(`   CDP: ${config.cdpHost}:${config.cdpPort}`);

  // Initialize core engine
  const core = new CoreEngine(config);

  // Initialize modules
  const scraper = new Scraper({ core, maxRetries: 3, retryDelay: 1000 });
  const monitor = new Monitor({ core, defaultInterval: 60000 });
  const stealth = new Stealth({ enabled: true });
  const extractor = new AIExtractor();
  const cdp = new CDPBridge({ host: config.cdpHost, port: config.cdpPort });
  const proxy = new ProxyRotator({ proxies: config.proxies });
  const scheduler = new Scheduler();
  const searchEngine = new SearchEngine();

  // Boot engine with all modules
  await core.boot({ scraper, monitor, stealth, extractor, cdp, proxy, scheduler, searchEngine });

  // Try to connect CDP
  try {
    await cdp.connect();
    await stealth.applyToCDP(cdp);
    console.log('   CDP: Connected + Stealth applied');
  } catch {
    console.log('   CDP: Not available (HTTP-only fallback mode)');
  }

  // Start API server (merged server with auth, WebSocket, alerts, rate limiting)
  const server = new APIServer({
    port: config.apiPort,
    host: '0.0.0.0',
    core,
    searchEngine,
    stealth,
    proxyRotator: proxy,
    monitor,
    extractor,
    scraper,
    cdp
  });
  const serverInfo = await server.start();

  // Start scheduler
  scheduler.start();

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n   Shutting down...');
    monitor.stopAll();
    scheduler.stop();
    await cdp.disconnect();
    cdp.stop();
    await server.stop();
    console.log('   ✓ Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return { core, scraper, monitor, extractor, cdp, proxy, scheduler, searchEngine, server };
}

module.exports = { main };

// Auto-start if run directly
if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
