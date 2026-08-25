# Obscura Search — Web Intelligence Console

A stealth-protected web search, scraping, monitoring, and data extraction interface.

## Quick Start

```bash
cd search
npm install   # no deps needed (pure Node.js)
node server.js
# Open index.html in browser
```

## Architecture

```
search/
├── index.html       # Main GUI (Tailwind dark theme)
├── app.js           # Frontend application logic
├── server.js        # API server (port 3001)
├── engine.js        # Search engine (DuckDuckGo, Google, Bing, Brave)
├── proxy-rotator.js # Proxy pool management
├── stealth.js       # Anti-detection + SSRF protection
└── README.md        # This file
```

## Features

### 🔍 Search
- **4 engines**: DuckDuckGo (default), Google, Bing, Brave
- Multi-region support (Global, US, EU, APAC)
- Result deduplication and relevance scoring
- Configurable result limits (10/25/50)

### 🕸️ Scraper
- Fetch any URL through stealth browser
- Output modes: HTML, Text, Custom JS evaluation
- Screenshot capture support
- Timeout configurable

### 📡 Monitor
- Watch URLs for content changes
- Configurable polling intervals (1s–1hr)
- Change detection via content hashing
- Auto-notify on changes

### 📊 Data Extractor
- CSS selector-based extraction
- XPath-like attribute selectors (`img[src]`, `a[href]`)
- Auto-detect mode for common patterns
- JSON schema input

### 🛡️ Stealth
- Browser fingerprint rotation
- SSRF protection (blocks localhost/private IPs)
- robots.txt compliance
- Realistic request headers (sec-ch-ua, DNT, etc.)

### 🔄 Proxy Pool
- Round-robin, latency-based, or random rotation
- Health checking with timeout
- Add/remove proxies via GUI
- Active proxy indicator

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/obscura/status` | Connection status |
| POST | `/api/obscura/search` | Web search |
| POST | `/api/obscura/scrape` | URL scraping |
| POST | `/api/obscura/extract` | Data extraction |
| POST | `/api/obscura/monitor/check` | Monitor check |
| POST | `/api/obscura/proxy/check` | Proxy health check |
| POST | `/api/obscura/connect` | Connect to CDP |
| POST | `/api/obscura/disconnect` | Disconnect |

## Keyboard Shortcuts

- `Ctrl+K` — Focus search input
- `Enter` — Execute search

## Integration with FCM Agents

Each of the 20 FCM agents can use Obscura for web intelligence:

```javascript
const { SearchEngine } = require('./engine');
const engine = new SearchEngine();

// Inference Router scrapes model leaderboards
const results = await engine.search('LLM benchmark rankings 2026');

// FL Coordinator monitors research papers
const monitors = await engine.scrapeURL('https://arxiv.org/list/cs.LG/recent', { dump: 'text' });

// ZK Prover checks proving key availability
const extracted = await engine.extractData('https://circuit.market', {
  keys: '.circuit-name',
  prices: '.price'
});
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OBSCURA_PORT` | 3001 | API server port |
| `OBSCURA_CDP` | 9222 | Chrome DevTools Protocol port |
