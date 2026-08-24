# G P Unite — GPU Platform GUI

Unified platform GUI combining agent swarm monitoring, staking, governance, and **obscura** headless browser integration.

## Quick Start

```bash
# Install obscura binary
bash bin/install-obscura.sh

# Start the GUI server
npx serve . -l 9091

# Open in browser
open http://127.0.0.1:9091/gpu_nited.html
```

## File Structure

```
gpu-platform/
├── gpu_nited.html          # Main GUI (487+ lines)
├── css/
│   └── gpu-styles.css      # All themes, layout, components
├── js/
│   ├── gpu-agents-data.js  # 18 agents + obscura with rules, source, tick()
│   ├── gpu-chart-engine.js # Canvas chart engine (FCMChart class)
│   ├── gpu-platform.js     # Navigation, onboarding, rendering, modals
│   ├── gpu-rbac.js         # Role-based access control (admin/operator/viewer)
│   ├── gpu-theme.js        # Dark/Light/High-Contrast theme system
│   └── gpu-ws-client.js    # WebSocket client with auth + reconnection
├── lib/
│   ├── obscura-bridge.js   # Node.js bridge to obscura CDP server
│   └── obscura-api.js      # REST API endpoints for obscura
├── bin/
│   └── install-obscura.sh  # Download obscura binary
├── config/
│   └── gpu-defaults.json   # Platform configuration
└── README.md               # This file
```

## Sections

| Section | Description |
|---------|-------------|
| 🚀 Onboarding | 4-step wizard: Connect → Hardware → Capabilities → Launch |
| 📊 Dashboard | Live stats, tier rankings, charts, activity feed |
| 🤖 Agents | 18 agents with logic rules, source code, simulation |
| 🛒 Marketplace | 12 compute tasks with claim buttons |
| 💎 Staking | Stake FCM tokens, 6-tier system |
| 🔒 Escrow | Milestone-based payment protection |
| 🏛️ Governance | Proposals with voting |
| 🏅 Reputation | Soulbound badges and achievements |
| 💬 Chat | Agent communication |
| 🕸️ Obscura | **Headless browser** for scraping, monitoring, automation |
| ⚡ Resources | CPU/GPU/Memory/Network gauges |
| ⚙️ Settings | General, Notifications, Accessibility, Themes |
| 🛡️ Admin | User management, roles, contracts, audit log |

## Obscura Integration

The platform integrates [obscura](https://github.com/h4ckf0r0day/obscura) — a Rust-based headless browser for AI agents and web scraping.

### Features

- **Quick Scrape** — Fetch any URL and extract content
- **JavaScript Evaluation** — Run JS on scraped pages
- **URL Monitoring** — Watch pages for changes
- **Stealth Mode** — Anti-detection + tracker blocking
- **CDP Protocol** — Compatible with Puppeteer/Playwright

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/obscura/status` | GET | Get agent status, metrics, history |
| `/api/obscura/scrape` | POST | Scrape a single URL |
| `/api/obscura/batch` | POST | Scrape multiple URLs in parallel |
| `/api/obscura/monitor` | POST | Start monitoring a URL |
| `/api/obscura/connect` | POST | Connect to obscura CDP server |
| `/api/obscura/disconnect` | POST | Disconnect from obscura |

### Using Obscura in Code

```javascript
const { ObscuraBridge } = require('./lib/obscura-bridge');

const browser = new ObscuraBridge({ port: 9222, stealth: true });
await browser.start();
await browser.connect();

// Fetch and evaluate
const result = await browser.fetch('https://example.com', {
  eval: 'document.title',
  dump: 'html'
});
console.log(result.output);

// Take screenshot
await browser.screenshot('https://example.com', 'screenshot.png');

// Disconnect
await browser.disconnect();
```

## Accessibility (WCAG 2.1 AA)

- Skip navigation link
- ARIA roles/labels on all interactive elements
- Keyboard shortcuts (`/` focus chat, `1-9` navigate)
- High contrast theme, font scaling, reduced motion
- Screen reader announcements

## Themes

| Theme | Description |
|-------|-------------|
| 🌙 Dark | Default — easy on eyes |
| ☀️ Light | Clean — bright environments |
| ◐ High Contrast | Maximum visibility — accessibility |

## RBAC (Role-Based Access Control)

| Role | Access |
|------|--------|
| 🛡 Admin | Full access: all sections, contracts, roles, emergency |
| ⚙ Operator | Manage agents, tasks, staking, governance, obscura, chat |
| 👁 Viewer | Read-only: dashboard, agents, marketplace, governance, obscura |
