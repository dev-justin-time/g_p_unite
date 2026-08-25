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

### 🔔 Keyword Alerts
- Create alerts for keyword combinations
- Multi-keyword support (comma-separated)
- Manual check triggers
- Results stored per alert

### 📦 Bulk Scraper
- Scrape multiple URLs simultaneously
- Configurable concurrency (1/3/5 concurrent)
- Progress bar tracking
- Export results to CSV
- SSRF protection on all URLs

### 🔖 Bookmarks
- Save favorite search queries with names
- One-click re-run with saved engine preference
- Persistent storage in localStorage

### 📅 Scheduled Searches
- Run searches on recurring intervals (1min–1hr)
- Pause/resume individual schedules
- Auto-store latest results
- Server-side timers

### 📥 Export to CSV
- Export search history to CSV
- Export bulk scrape results to CSV
- Standard CSV with headers

### 🌗 Theme Toggle
- Dark mode (default)
- Light mode with full color override
- Persisted in localStorage

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

## WebSocket

Connect to `ws://localhost:3001/ws` for real-time notifications:

| Event | Description |
|-------|-------------|
| `connected` | Server confirmed connection |
| `alert:first` | First results found for an alert |
| `alert:new` | New results detected for an alert |
| `pong` | Heartbeat response |

**Client messages:**
- `subscribe:alerts` — Subscribe to alert notifications
- `ping` — Keep-alive heartbeat (sent every 30s automatically)

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
| POST | `/api/obscura/bulk-scrape` | Bulk scrape URLs |
| GET | `/api/obscura/alerts` | List keyword alerts |
| POST | `/api/obscura/alerts` | Create keyword alert |
| POST | `/api/obscura/alerts/check` | Check alert for new results |
| DELETE | `/api/obscura/alerts` | Delete alert |
| GET | `/api/obscura/scheduled` | List scheduled searches |
| POST | `/api/obscura/scheduled` | Create scheduled search |
| DELETE | `/api/obscura/scheduled` | Delete scheduled search |
| POST | `/api/obscura/scheduled/toggle` | Pause/resume schedule |

## Keyboard Shortcuts

- `Ctrl+K` — Focus search input
- `Enter` — Execute search

## Rate Limiting

### Nginx (L7)

| Endpoint | Rate | Burst | Description |
|----------|------|-------|-------------|
| `/api/obscura/search` | 5 req/s | 10 | Search queries |
| `/api/obscura/bulk-scrape` | 2 req/s | 5 | Bulk operations |
| `/api/obscura/scrape` | 5 req/s | 5 | Single URL scrape |
| `/api/obscura/alerts` | 10 req/s | 20 | Alert management |
| `/ws` | 10 conn/min | 5 | WebSocket upgrades |

### Application (WebSocket)

| Limit | Value | Description |
|-------|-------|-------------|
| Max connections per IP | 5 | Concurrent WebSocket connections |
| Max connects per minute | 10 | New connections per IP per 60s |
| Max messages per minute | 60 | Messages per connection per 60s |
| Max message size | 8 KB | Single message payload limit |
| Idle timeout | 5 min | Disconnect inactive clients |

**Monitor via API:**
```bash
curl http://localhost:3001/api/obscura/ws/status
```

**Docker setup:**
```bash
npm run docker:search:build    # Build image
npm run docker:search:compose  # Start with nginx proxy
npm run docker:search:stop     # Stop all services
```

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

## Data Persistence

Scheduled searches and keyword alerts are persisted to disk as JSON files:

```
data/
├── scheduled.json   # Scheduled search configs + last results
└── alerts.json      # Keyword alert configs + last results
```

- Auto-saved on every create/update/delete
- Auto-loaded on server startup (timers restarted for active schedules)
- Docker: mounted as `obscura-data` named volume at `/app/data`
- Local: stored in `search/data/` directory

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OBSCURA_PORT` | 3001 | API server port |
| `OBSCURA_DATA_DIR` | `./data` | Data directory for persistence |
| `OBSCURA_CDP` | 9222 | Chrome DevTools Protocol port |
