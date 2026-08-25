/**
 * Obscura Cross-Agent Web Intelligence
 * Adds obscura-powered scraping & monitoring to all 19 FCM agents.
 * Each agent gets a `web` namespace with scrape(), monitor(), extract(), and search().
 *
 * Usage in any agent:
 *   const { attachWebIntelligence } = require('../obscura-cross');
 *   const web = attachWebIntelligence(this);
 *   await web.scrape('https://example.com');
 */

// Lazy-load ObscuraBridge to avoid crash when module is unavailable
let ObscuraBridge = null;
try {
  ObscuraBridge = require('../gpu-platform/lib/obscura-bridge').ObscuraBridge;
} catch (e) {
  // Obscura bridge not available — agents run in HTTP-only mode
}

/**
 * Web Intelligence capability — attached to any FCM agent
 */
class AgentWebIntelligence {
  constructor(agent, opts = {}) {
    this.agent = agent;
    this.bridge = ObscuraBridge ? new ObscuraBridge({
      port: opts.port || 9222,
      stealth: opts.stealth !== false,
      proxy: opts.proxy || null,
    }) : null;
    this._ready = !!this.bridge;
    this._cache = new Map();
    this._cacheTTL = opts.cacheTTL || 300000; // 5 min
  }

  async ensureReady() {
    if (!this.bridge) return;
    if (this._ready) return;
    try {
      await this.bridge.start();
      await this.bridge.connect();
      this._ready = true;
    } catch (e) {
      // Fallback: operate without CDP
    }
  }

  /**
   * Scrape a single URL
   */
  async scrape(url, opts = {}) {
    const cacheKey = `scrape:${url}:${opts.dump || 'html'}`;
    const cached = this._getCached(cacheKey);
    if (cached && !opts.noCache) return cached;

    await this.ensureReady();
    const result = await this.bridge.fetch(url, {
      dump: opts.dump || 'html',
      eval: opts.eval || null,
      waitUntil: opts.waitUntil || 'load',
      timeout: opts.timeout || 30,
    });

    const output = { success: result.code === 0, output: result.output, error: result.error, url };
    this._setCached(cacheKey, output);
    return output;
  }

  /**
   * Monitor a URL for changes
   */
  async monitor(url, intervalMs = 60000, onChange) {
    let lastHash = null;
    const check = async () => {
      const result = await this.scrape(url, { dump: 'text', noCache: true });
      if (result.success) {
        const hash = require('crypto').createHash('sha256').update(result.output).digest('hex');
        if (lastHash && hash !== lastHash && onChange) {
          onChange({ url, timestamp: Date.now(), hash });
        }
        lastHash = hash;
      }
    };
    await check();
    return setInterval(check, intervalMs);
  }

  /**
   * Extract structured data
   */
  async extract(url, schema = null) {
    const result = await this.scrape(url, { dump: 'html' });
    if (!result.success) return null;

    // Use the AI extractor from the standalone project
    try {
      const { AIExtractor } = require('../OBSCURA_AGENT/src/ai-extractor');
      const extractor = new AIExtractor();
      return extractor.extract(result.output, schema);
    } catch {
      // Fallback: basic extraction without the module
      return { title: result.output?.slice(0, 200) || '' };
    }
    return extractor.extract(result.output, schema);
  }

  /**
   * Search engines via scraping (DuckDuckGo HTML fallback)
   */
  async search(query, limit = 5) {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const result = await this.scrape(ddgUrl, { dump: 'html' });
    if (!result.success) return [];

    const cheerio = require('cheerio');
    const $ = cheerio.load(result.output);
    const results = [];
    $('.result').each((i, el) => {
      if (i >= limit) return false;
      const link = $(el).find('.result__a');
      const snippet = $(el).find('.result__snippet');
      results.push({
        title: link.text().trim(),
        url: link.attr('href'),
        snippet: snippet.text().trim(),
      });
    });
    return results;
  }

  _getCached(key) {
    const entry = this._cache.get(key);
    if (entry && Date.now() - entry.time < this._cacheTTL) return entry.data;
    if (entry) this._cache.delete(key);
    return null;
  }

  _setCached(key, data) {
    this._cache.set(key, { data, time: Date.now() });
    if (this._cache.size > 500) {
      const oldest = [...this._cache.entries()].sort((a, b) => a[1].time - b[1].time)[0];
      if (oldest) this._cache.delete(oldest[0]);
    }
  }

  disconnect() {
    if (this.bridge) {
      this.bridge.disconnect();
      this.bridge.stop();
    }
  }
}

/**
 * Agent-specific web intelligence configurations
 */
const AGENT_WEB_CONFIGS = {
  inf: {
    description: 'Scrapes model leaderboards, benchmarks, and hardware compatibility lists',
    defaultSearches: ['https://huggingface.co/models?sort=trending', 'https://openrouter.ai/rankings'],
    interval: 900000, // 15 min
  },
  ren: {
    description: 'Monitors render farm status pages and GPU availability',
    defaultSearches: ['https://status.sheepit-renderfarm.com'],
    interval: 300000,
  },
  fl: {
    description: 'Fetches hospital data-sharing policies and regulatory updates',
    defaultSearches: ['https://www.hhs.gov/hipaa'],
    interval: 86400000, // 1 day
  },
  edge: {
    description: 'Scrapes WASM module registries and edge runtime compatibility',
    defaultSearches: ['https://wapm.io/explore'],
    interval: 3600000, // 1 hour
  },
  zk: {
    description: 'Monitors circuit version changes and proof system benchmarks',
    defaultSearches: ['https://github.com/matter-labs/era-contracts/releases'],
    interval: 3600000,
  },
  game: {
    description: 'Scrapes anti-cheat databases and game server status',
    defaultSearches: ['https://steamstat.us/'],
    interval: 600000,
  },
  sci: {
    description: 'Fetches BOINC project stats and research publications',
    defaultSearches: ['https://boinc.berkeley.edu/projects.php'],
    interval: 7200000,
  },
  priv: {
    description: 'Monitors exit node blocklists and Tor network status',
    defaultSearches: ['https://metrics.torproject.org/'],
    interval: 1800000,
  },
  node: {
    description: 'Scrapes blockchain explorer APIs for network stats',
    defaultSearches: [],
    interval: 600000,
  },
  stor: {
    description: 'Monitors IPFS pinning service status and storage market rates',
    defaultSearches: ['https://status.ipfs.tech/'],
    interval: 3600000,
  },
  fsrv: {
    description: 'CDN health checks and bandwidth market rates',
    defaultSearches: [],
    interval: 60000,
  },
  rwrd: {
    description: 'Scrapes reward optimization tips and task availability',
    defaultSearches: [],
    interval: 300000,
  },
  tier: {
    description: 'Monitors hardware price indexes and benchmark leaderboards',
    defaultSearches: ['https://www.videocardbenchmark.net/gpu_list.php'],
    interval: 86400000,
  },
  reward: {
    description: 'Fetches FCM token price feeds and market data',
    defaultSearches: ['https://coinmarketcap.com/currencies/federated-compute-mesh/'],
    interval: 600000,
  },
  gov: {
    description: 'Scrapes governance forum proposals and community sentiment',
    defaultSearches: [],
    interval: 3600000,
  },
  escrow: {
    description: 'Monitors oracle price feeds for milestone valuation',
    defaultSearches: [],
    interval: 600000,
  },
  rep: {
    description: 'Fetches external reputation data and community trust scores',
    defaultSearches: [],
    interval: 3600000,
  },
  coord: {
    description: 'Monitors network health dashboards and connectivity status',
    defaultSearches: [],
    interval: 120000,
  },
  obscura: {
    description: 'Self-monitoring: checks own health and connectivity',
    defaultSearches: [],
    interval: 30000,
  },
};

/**
 * Attach web intelligence to an agent
 */
function attachWebIntelligence(agent, opts = {}) {
  const config = AGENT_WEB_CONFIGS[agent.id] || {};
  const web = new AgentWebIntelligence(agent, opts);

  // Add web namespace to agent
  agent.web = web;
  agent.webConfig = config;

  // Add web-intelligence rule if not already present
  if (agent.rules && !agent.rules.some(r => r.name?.includes('Web Intelligence'))) {
    agent.rules.unshift({ name: 'Web Intelligence (Obscura)', enabled: true });
  }

  return web;
}

/**
 * Bootstrap all agents with web intelligence
 */
function bootstrapAllAgents(agentsList) {
  for (const agent of agentsList) {
    if (!agent.web) attachWebIntelligence(agent);
  }
}

module.exports = {
  AgentWebIntelligence,
  attachWebIntelligence,
  bootstrapAllAgents,
  AGENT_WEB_CONFIGS,
};