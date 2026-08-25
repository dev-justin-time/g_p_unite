# 🕸️ Obscura Agent — Standalone Web Intelligence

> Part of the FCM Agent Swarm. Operates independently with optimized logic — zero LLM calls required.

## What It Does

Obscura Agent is a self-contained web intelligence engine that:

- **Scrapes** any website with CDP-level browser control (JavaScript execution, screenshot capture, DOM queries)
- **Monitors** pages for changes at configurable intervals with diff detection
- **Extracts** structured data using CSS selectors, XPath, and AI-enhanced content parsing
- **Rotates proxies** and user agents to avoid detection
- **Applies stealth patches** (WebDriver removal, fingerprint normalization, canvas noise)
- **Exposes REST API** for integration with other FCM agents

## Quick Start

```bash
# Clone and install
cd OBSCURA_AGENT
npm install

# Start the API server
npm run server

# Scrape a URL from CLI
npm run scrape -- "https://example.com" --dump text

# Start monitoring a URL for changes
npm run monitor -- "https://example.com" --interval 60
```

## Architecture

```
OBSCURA_AGENT/
├── src/
│   ├── index.js          # Entry point: orchestrates all modules
│   ├── core.js           # Core engine: lifecycle, state machine, metrics
│   ├── scraper.js        # URL scraping with retry, timeout, formats
│   ├── monitor.js        # Continuous page monitoring with change detection
│   ├── stealth.js        # Anti-detection: fingerprint, canvas, WebDriver
│   ├── ai-extractor.js   # Content extraction (structured data from HTML)
│   ├── cdp.js            # Chrome DevTools Protocol bridge
│   ├── proxy-rotator.js  # Proxy pool management and rotation
│   ├── scheduler.js      # Cron-like job scheduling for periodic tasks
│   ├── api-server.js     # Express REST + WebSocket API
│   └── cli.js            # Command-line interface
├── package.json
├── Dockerfile
├── .gitignore
└── README.md
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/status` | Agent health, metrics, active monitors |
| `POST` | `/api/scrape` | Scrape a single URL `{url, format, eval, timeout}` |
| `POST` | `/api/batch` | Scrape multiple URLs `{urls, concurrency}` |
| `POST` | `/api/monitor/start` | Start monitoring a URL `{url, interval}` |
| `POST` | `/api/monitor/stop` | Stop monitoring `{url}` |
| `POST` | `/api/extract` | Extract structured data `{url, schema}` |
| `GET` | `/api/screenshot` | Take screenshot of URL `?url=...&format=png` |
| `POST` | `/api/proxy/rotate` | Rotate to next proxy in pool |

## Integration with FCM Agents

Each FCM agent uses Obscura for web intelligence:

| Agent | Obscura Usage |
|-------|---------------|
| **Inference Router** | Scrapes model leaderboards for routing decisions |
| **Render Splitter** | Monitors render farm status pages |
| **FL Coordinator** | Fetches hospital data-sharing policies |
| **Edge Runner** | Scrapes WASM module registries |
| **ZK Prover** | Monitors circuit version changes |
| **Game Host** | Scrapes anti-cheat databases |
| **Science Grid** | Fetches BOINC project stats |
| **Privacy Mesh** | Monitors exit node blocklists |
| **Governance Agent** | Scrapes forum proposals |
| **Reputation Oracle** | Fetches external reputation feeds |
| **Escrow Manager** | Monitors oracle price feeds |
| **Tier Manager** | Checks hardware benchmark sites |

## Docker

```bash
docker build -t obscura-agent .
docker run -p 3000:3000 -p 9222:9222 obscura-agent
```

## License

MIT — Part of the FCM Federated Compute Mesh.