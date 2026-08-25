# 🕸️ Obscura Agent — Standalone Web Intelligence

> Part of the FCM Agent Swarm. Self-contained web intelligence engine with search, scraping, monitoring, and real-time alerts — zero external LLM dependencies.

## What It Does

Obscura Agent is a comprehensive web intelligence platform that combines:

- **Multi-Engine Search** — DuckDuckGo, Google, Bing, Brave with result scoring and deduplication
- **Web Scraping** — CDP-level browser control with retry, timeout, and format support
- **Page Monitoring** — Continuous monitoring with diff detection and change notifications
- **AI Data Extraction** — Structured data extraction using CSS/XPath selectors
- **Stealth Protection** — SSRF protection, robots.txt compliance, browser fingerprinting, CDP injection
- **Proxy Rotation** — Multi-strategy rotation (round-robin, latency, random, score-based)
- **Real-Time Alerts** — Keyword monitoring with WebSocket push notifications
- **Scheduled Searches** — Cron-like scheduling for recurring searches
- **Web GUI** — Full-featured browser-based control panel
- **REST + WebSocket API** — Auth, rate limiting, and real-time updates

## Quick Start

```bash
# Clone and install
cd OBSCURA_AGENT
npm install

# Start the API server (includes GUI)
npm start

# Open the GUI
open http://localhost:3000

# Or use CLI commands
node src/cli.js search "machine learning" --engine duckduckgo --limit 10
node src/cli.js scrape "https://example.com" --format text
node src/cli.js monitor "https://example.com" --interval 60
node src/cli.js extract "https://example.com" --schema '{"title": "h1"}'
```

## Architecture

```
OBSCURA_AGENT/
├── src/
│   ├── index.js          # Entry point: orchestrates all modules
│   ├── core.js           # Core engine: lifecycle, state machine, metrics
│   ├── engine.js         # Multi-engine search (DDG, Google, Bing, Brave)
│   ├── scraper.js        # URL scraping with retry, timeout, formats
│   ├── monitor.js        # Continuous page monitoring with change detection
│   ├── stealth.js        # Anti-detection: SSRF, robots, fingerprints, CDP injection
│   ├── ai-extractor.js   # Content extraction (structured data from HTML)
│   ├── cdp.js            # Chrome DevTools Protocol bridge
│   ├── proxy-rotator.js  # Proxy pool with multi-strategy rotation
│   ├── scheduler.js      # Cron-like job scheduling for periodic tasks
│   ├── api-server.js     # REST + WebSocket API with auth, alerts, rate limiting
│   ├── cli.js            # Command-line interface
│   └── gui/
│       ├── app.js        # Browser-side GUI application logic
│       └── index.html    # Web GUI interface
├── package.json
├── Dockerfile
├── .gitignore
└── README.md
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/status` | Agent health, metrics, active monitors |
| `GET` | `/api/obscura/status` | Connection status, proxy stats |
| `POST` | `/api/obscura/search` | Multi-engine search `{query, engine, limit, region}` |
| `POST` | `/api/obscura/scrape` | Scrape a single URL `{url, dump, eval, timeout}` |
| `POST` | `/api/obscura/bulk-scrape` | Scrape multiple URLs `{urls, concurrency}` |
| `POST` | `/api/obscura/extract` | Extract structured data `{url, schema}` |
| `POST` | `/api/obscura/monitor/check` | Check page for changes `{url}` |
| `POST` | `/api/monitor/start` | Start monitoring `{url, interval}` |
| `POST` | `/api/monitor/stop` | Stop monitoring `{url}` |
| `GET` | `/api/screenshot` | Take screenshot `?url=...&format=png` |
| `POST` | `/api/obscura/proxy/check` | Check proxy health `{url}` |
| `POST` | `/api/proxy/rotate` | Rotate to next proxy |
| `POST` | `/api/obscura/connect` | Connect CDP (admin) `{port}` |
| `POST` | `/api/obscura/disconnect` | Disconnect CDP (admin) |
| `GET` | `/api/obscura/alerts` | List keyword alerts |
| `POST` | `/api/obscura/alerts` | Create alert `{keywords, engine}` |
| `POST` | `/api/obscura/alerts/check` | Manually check alert `{id}` |
| `GET` | `/api/obscura/notifications` | List notifications |
| `GET` | `/api/obscura/scheduled` | List scheduled searches |
| `POST` | `/api/obscura/scheduled` | Add scheduled search `{query, engine, interval}` |
| `WebSocket` | `ws://.../ws` | Real-time alerts and notifications |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | API server port |
| `CDP_PORT` | `9222` | Chrome DevTools Protocol port |
| `CDP_HOST` | `127.0.0.1` | CDP host |
| `PROXY_LIST` | — | Comma-separated proxy URLs |
| `OBSCURA_AUTH` | `true` | Enable authentication |
| `OBSCURA_API_KEY` | — | API key for user access |
| `OBSCURA_ADMIN_KEY` | — | Admin API key |
| `OBSCURA_DATA_DIR` | `./data` | Data persistence directory |

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
