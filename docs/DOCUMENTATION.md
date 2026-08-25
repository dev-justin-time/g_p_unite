# GPU Unite — Complete Documentation

> Unified documentation for the GPU Unite decentralized GPU computing platform.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Roadmap](#architecture--roadmap)
3. [Smart Contracts](#smart-contracts)
4. [Ethereum Integration](#ethereum-integration)
5. [Security Audit](#security-audit)
6. [Docker Deployment](#docker-deployment)
7. [Integration Guide](#integration-guide)
8. [Tier System](#tier-system)
9. [FCM Agent System](#fcm-agent-system)
10. [Sales & Business](#sales--business)
11. [Development Plan](#development-plan)

---

## Project Overview

GPU Unite is a decentralized GPU computing platform that connects GPU providers (miners) with users who need GPU computing power. The platform uses smart contracts for trustless transactions, reputation systems for quality assurance, and a marketplace for task distribution.

### Key Features

- **Decentralized Marketplace** — Connect GPU providers with compute consumers
- **Smart Contract Escrow** — Trustless milestone-based payments
- **Reputation System** — On-chain reputation scoring for agents and providers
- **Governance** — Community-driven proposal and voting system
- **Staking** — Token staking with tiered benefits
- **Agent Control** — Real-time browser-based agent management
- **Obscura Integration** — Headless browser for web intelligence
- **Search Console** — Web search, scraping, monitoring, and data extraction

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS, Chart.js |
| Backend | Node.js, WebSocket |
| Blockchain | Ethereum, Solidity, Hardhat |
| Infrastructure | Docker, Nginx, Prometheus |
| Browser | Puppeteer, CDP (Chrome DevTools Protocol) |

---

## Architecture & Roadmap

### System Architecture

```
┌─────────────────────────────────────────────────┐
│                  Frontend (HTML)                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │Market│ │Agent │ │Staking│ │Escrow│ │Search│  │
│  │place │ │Mgmt  │ │      │ │      │ │      │  │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘  │
│     └────────┴────────┴────────┴────────┘       │
│                        │                         │
│              ┌─────────┴─────────┐               │
│              │   API / WebSocket │               │
│              └─────────┬─────────┘               │
└────────────────────────┼─────────────────────────┘
                         │
┌────────────────────────┼─────────────────────────┐
│              Backend (Node.js)                    │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│  │Engine│ │Proxy │ │Stealth│ │Server│            │
│  └──────┘ └──────┘ └──────┘ └──────┘           │
│                        │                         │
│              ┌─────────┴─────────┐               │
│              │  Ethereum Node    │               │
│              └─────────┬─────────┘               │
└────────────────────────┼─────────────────────────┘
                         │
┌────────────────────────┼─────────────────────────┐
│           Ethereum Blockchain                     │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│  │ERC20 │ │ERC721│ │Escrow│ │Govern│            │
│  └──────┘ └──────┘ └──────┘ └──────┘           │
└─────────────────────────────────────────────────┘
```

### Roadmap

#### Phase 1: Foundation (Q1-Q2 2025)
- ✅ Smart contract development and auditing
- ✅ Frontend platform with all core pages
- ✅ Agent registration and management
- ✅ Basic marketplace functionality

#### Phase 2: Integration (Q3-Q4 2025)
- ✅ Docker deployment infrastructure
- ✅ Nginx reverse proxy with rate limiting
- ✅ WebSocket real-time notifications
- ✅ Search console with web intelligence
- ✅ Obscura browser integration

#### Phase 3: Advanced Features (2026)
- 🔄 Advanced reputation algorithms
- 🔄 Cross-chain support
- 🔄 AI-powered task matching
- 🔄 Mobile application
- 🔄 Enterprise API

#### Phase 4: Ecosystem (2027+)
- 📋 Decentralized governance activation
- 📋 Tokenomics optimization
- 📋 Global GPU network expansion
- 📋 Enterprise partnerships

---

## Smart Contracts

### Contract Overview

| Contract | Purpose | Status |
|----------|---------|--------|
| GPUUniteToken (ERC-20) | Platform utility token | ✅ Deployed |
| GPUUniteNFT (ERC-721) | Agent/Provider NFTs | ✅ Deployed |
| EscrowContract | Milestone-based payments | ✅ Deployed |
| GovernanceContract | Proposal and voting | ✅ Deployed |
| ReputationContract | On-chain reputation | ✅ Deployed |
| StakingContract | Token staking | ✅ Deployed |
| MarketplaceContract | Task listings | ✅ Deployed |

### Token Economics

- **Total Supply:** 1,000,000,000 GPU tokens
- **Distribution:**
  - 40% — Ecosystem rewards
  - 25% — Team (4-year vesting)
  - 20% — Investors (2-year vesting)
  - 10% — Treasury
  - 5% — Initial liquidity

### Staking Tiers

| Tier | Minimum Stake | Benefits |
|------|--------------|----------|
| Bronze | 1,000 GPU | Basic marketplace access |
| Silver | 10,000 GPU | Reduced fees (0.5%) |
| Gold | 50,000 GPU | Reduced fees (0.25%), priority tasks |
| Platinum | 100,000 GPU | Reduced fees (0.1%), governance voting power |
| Diamond | 500,000 GPU | Zero fees, exclusive tasks, DAO governance |

### Escrow Flow

```
1. Client creates task + deposits GPU tokens
2. Provider accepts task
3. Milestones defined in smart contract
4. On milestone completion:
   a. Provider submits proof
   b. Client reviews (48h window)
   c. If approved → funds released to provider
   d. If disputed → DAO arbitration
5. Reputation updated on both parties
```

### Security Measures

- Reentrancy guards on all external calls
- Overflow protection (Solidity 0.8+)
- Time-locked admin functions (48h delay)
- Multi-sig treasury management
- Formal verification pending

---

## Ethereum Integration

### Network Configuration

| Network | Chain ID | RPC URL | Explorer |
|---------|----------|---------|----------|
| Mainnet | 1 | infura.io | etherscan.io |
| Sepolia | 11155111 | infura.io | sepolia.etherscan.io |
| Hardhat | 31337 | localhost:8545 | — |

### Contract Addresses (Testnet)

```javascript
const CONTRACTS = {
  token: '0x...',
  nft: '0x...',
  escrow: '0x...',
  governance: '0x...',
  reputation: '0x...',
  staking: '0x...',
  marketplace: '0x...'
};
```

### Wallet Integration

```javascript
// Connect wallet
async function connectWallet() {
  if (typeof window.ethereum !== 'undefined') {
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    });
    return accounts[0];
  }
  throw new Error('No wallet detected');
}

// Check network
async function checkNetwork() {
  const chainId = await window.ethereum.request({
    method: 'eth_chainId'
  });
  return parseInt(chainId, 16);
}
```

### Event Listening

```javascript
// Listen for contract events
const filter = escrowContract.filters.TaskCompleted();
escrowContract.on(filter, (taskId, provider, amount) => {
  console.log(`Task ${taskId} completed: ${amount} GPU tokens released`);
});
```

---

## Security Audit

### Audit Summary

| Category | Status | Notes |
|----------|--------|-------|
| Reentrancy | ✅ Safe | Guards implemented |
| Overflow | ✅ Safe | Solidity 0.8+ built-in |
| Access Control | ✅ Safe | Role-based with multi-sig |
| Front-running | ⚠️ Medium | Mitigated with commit-reveal |
| Oracle Manipulation | ⚠️ Medium | Time-weighted average price |
| Flash Loan Attacks | ✅ Safe | No oracle dependencies |
| Denial of Service | ✅ Safe | Gas limits and time locks |

### Vulnerabilities Found

#### Critical: None

#### High: None

#### Medium
1. **Front-running risk** on marketplace listings
   - Mitigation: Commit-reveal scheme for large transactions
2. **Oracle manipulation** potential for pricing
   - Mitigation: TWAP (Time-Weighted Average Price) oracles

#### Low
1. **Gas optimization** opportunities in reputation calculations
2. **Event indexing** could be improved for faster queries

### Recommendations

1. ✅ Implement commit-reveal for high-value transactions
2. ✅ Use TWAP oracles for price feeds
3. 🔄 Complete formal verification for escrow contract
4. 🔄 Add circuit breakers for emergency stops
5. 🔄 Implement upgradeable proxy patterns for future improvements

---

## Docker Deployment

### Services

| Service | Port | Description |
|---------|------|-------------|
| obscura-search | 3001 | Search API server |
| obscura-nginx | 80/443 | Reverse proxy |
| obscura-nginx-monitor | 8080 | Nginx status/metrics |
| prometheus | 9090 | Metrics collection |

### Quick Start

```bash
# Clone and start
git clone https://github.com/dev-justin-time/g_p_unite
cd g_p_unite

# Start all services
docker compose -f docker/docker-compose.yml up -d

# Check status
docker compose -f docker/docker-compose.yml ps

# View logs
docker compose -f docker/docker-compose.yml logs -f obscura-search
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3001 | Search server port |
| OBSCURA_AUTH | true | Enable authentication |
| OBSCURA_API_KEY | — | User API key |
| OBSCURA_ADMIN_KEY | — | Admin API key |
| OBSCURA_DATA_DIR | ./data | Persistence directory |
| OBSCURA_CHECK_INTERVAL | 60 | Alert check interval (seconds) |
| NGINX_WORKER_PROCESSES | auto | Nginx workers |
| NGINX_RATE_LIMIT_SEARCH | 5r/s | Search rate limit |

### Docker Commands

```bash
# Build only
docker compose -f docker/docker-compose.yml build

# Stop all
docker compose -f docker/docker-compose.yml down

# Stop + remove volumes
docker compose -f docker/docker-compose.yml down -v

# Restart single service
docker compose -f docker/docker-compose.yml restart obscura-search

# View resource usage
docker stats
```

### Persistent Volumes

| Volume | Mount Point | Description |
|--------|-------------|-------------|
| obscura-data | /app/data | Scheduled searches, alerts, notifications |
| obscura-nginx-logs | /var/log/nginx | Nginx access/error logs |

---

## Integration Guide

### API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/obscura/auth/login | Public | Login |
| POST | /api/obscura/auth/logout | Public | Logout |
| GET | /api/obscura/auth/me | Token | Session info |
| GET | /api/obscura/status | Public | Server status |
| POST | /api/obscura/search | User | Web search |
| POST | /api/obscura/scrape | User | Scrape URL |
| POST | /api/obscura/bulk-scrape | User | Bulk scrape |
| POST | /api/obscura/extract | User | Extract data |
| GET | /api/obscura/scheduled | User | List schedules |
| POST | /api/obscura/scheduled | User | Create schedule |
| GET | /api/obscura/alerts | User | List alerts |
| POST | /api/obscura/alerts | User | Create alert |
| GET | /api/obscura/notifications | User | List notifications |
| POST | /api/obscura/connect | Admin | Connect CDP |
| POST | /api/obscura/disconnect | Admin | Disconnect CDP |
| GET | /api/obscura/settings | Admin | Get settings |
| PUT | /api/obscura/settings | Admin | Update settings |
| GET | /api/obscura/ws/status | Public | WebSocket status |
| GET | /api/obscura/rate-limit/status | Public | Rate limit status |

### Authentication

```bash
# Login
curl -X POST http://localhost:3001/api/obscura/auth/login \
  -H "Content-Type: application/json" \
  -d '{"api_key": "your-api-key"}'

# Use session token
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/obscura/search

# Or use API key directly
curl -H "Authorization: ApiKey your-api-key" \
  http://localhost:3001/api/obscura/search
```

### WebSocket Protocol

```javascript
// Connect
const ws = new WebSocket('ws://localhost:3001/ws?token=<session-token>');

// Subscribe to alerts
ws.send(JSON.stringify({
  type: 'subscribe:alerts',
  keywords: ['AI', 'GPU']  // optional filter
}));

// Handle messages
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  switch (msg.type) {
    case 'connected':     // Connection confirmed
    case 'alert:first':   // First alert results
    case 'alert:new':     // New results found
    case 'notification':  // Real-time notification
    case 'filter:updated': // Filter confirmation
    case 'pong':          // Heartbeat response
  }
};

// Update filter
ws.send(JSON.stringify({
  type: 'update:filter',
  keywords: ['quantum', 'blockchain']
}));
```

### Rate Limits

| Endpoint | Limit | Window | Burst |
|----------|-------|--------|-------|
| /api/obscura/search | 20/min | 60s | 10 |
| /api/obscura/scrape | 10/min | 60s | 5 |
| /api/obscura/bulk-scrape | 3/min | 60s | 3 |
| /api/obscura/extract | 15/min | 60s | 8 |
| /ws connections | 5/IP | 60s | — |
| /ws messages | 60/min | 60s | — |

### Response Headers

```
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 18
X-RateLimit-Reset: 1695312000
Retry-After: 45  (only on 429)
```

---

## Tier System

### Provider Tiers

| Tier | Requirements | Benefits |
|------|-------------|----------|
| **Bronze** | Register + 100 GPU stake | Basic tasks, standard rewards |
| **Silver** | 30 days active + 0.95 uptime | +10% rewards, priority queue |
| **Gold** | 90 days + 0.98 uptime + 50 tasks | +25% rewards, exclusive tasks |
| **Platinum** | 180 days + 0.99 uptime + 200 tasks | +50% rewards, governance weight |
| **Diamond** | 365 days + 0.999 uptime + 1000 tasks | +100% rewards, zero fees, DAO access |

### Reputation Scoring

```
Reputation = (Uptime × 0.3) + (Task Completion × 0.3) + 
             (Client Rating × 0.2) + (Duration × 0.2)
```

### Tier Progression Rules

1. Must meet all requirements for 30 consecutive days
2. Cannot demote more than one tier at a time
3. 7-day grace period after demotion trigger
4. Appeals process for disputed demotions

---

## FCM Agent System

### Agent Overview

The FCM (Fully Connected Mesh) agent system manages GPU compute nodes across the network.

### Agent Capabilities

| Capability | Description |
|-----------|-------------|
| Task Execution | Run ML training, inference, rendering |
| Data Processing | ETL pipelines, data transformation |
| Model Serving | Host and serve ML models |
| Web Intelligence | Scraping, monitoring, extraction |
| Browser Automation | Headless browser via CDP |

### Agent Health Monitoring

```json
{
  "agent_id": "agent-001",
  "status": "active",
  "gpu_utilization": 78.5,
  "memory_used": "12.4 GB / 16 GB",
  "tasks_completed": 142,
  "uptime": "99.95%",
  "reputation": 4.8
}
```

### Task Assignment Flow

```
1. Client submits task with requirements
2. Matching engine finds eligible agents
3. Agents bid on task (reputation-weighted)
4. Client selects agent
5. Smart contract created (escrow)
6. Agent executes task
7. Client reviews output
8. Payment released + reputation updated
```

---

## Sales & Business

### Revenue Model

| Source | Fee | Description |
|--------|-----|-------------|
| Marketplace transactions | 1-2% | Per task completion |
| Premium listings | $50-500 | Featured task placements |
| Enterprise API | $500-5000/mo | Dedicated compute pools |
| Data intelligence | Usage-based | Search/scrape/monitor services |

### Target Market

- **AI/ML Teams** — Distributed model training
- **Game Studios** — Render farms, asset generation
- **Research Labs** — Computational simulations
- **Data Companies** — Web intelligence, scraping
- **Enterprises** — Overflow compute, cost optimization

### Competitive Advantages

1. **Decentralized** — No single point of failure
2. **Trustless** — Smart contract escrow
3. **Reputation-based** — Quality assurance via on-chain reputation
4. **Flexible** — Pay-per-use, no commitments
5. **Global** — Access GPU power worldwide

### Growth Projections

| Metric | Q4 2025 | Q2 2026 | Q4 2026 |
|--------|---------|---------|---------|
| Active Providers | 100 | 500 | 2,000 |
| Active Clients | 50 | 250 | 1,000 |
| Monthly Tasks | 500 | 5,000 | 50,000 |
| Monthly Revenue | $10K | $100K | $1M |

---

## Development Plan

### Sprint 1: Core Platform ✅
- [x] Smart contract development
- [x] Frontend pages (Onboarding, Dashboard, Agents, Marketplace)
- [x] Basic API endpoints
- [x] Wallet integration

### Sprint 2: Advanced Features ✅
- [x] Staking system
- [x] Escrow with milestones
- [x] Governance voting
- [x] Reputation system

### Sprint 3: Intelligence Layer ✅
- [x] Search console
- [x] Web scraping engine
- [x] Keyword alerts
- [x] Scheduled searches
- [x] Bookmarking system

### Sprint 4: Infrastructure ✅
- [x] Docker deployment
- [x] Nginx reverse proxy
- [x] Rate limiting (nginx + app-level)
- [x] SSL/TLS support
- [x] Request logging

### Sprint 5: Real-time Features ✅
- [x] WebSocket server
- [x] Real-time notifications
- [x] Alert auto-checking
- [x] Keyword filtering
- [x] Notification persistence

### Sprint 6: Security ✅
- [x] API key authentication
- [x] Session token management
- [x] Role-based access control
- [x] Rate limiting per endpoint
- [x] Security headers

### Sprint 7: User Experience ✅
- [x] Unified multipage GUI
- [x] Sound notifications
- [x] Desktop push notifications
- [x] Offline notification cache
- [x] Theme system

### Sprint 8: Polish (Current)
- [ ] Comprehensive testing
- [ ] Performance optimization
- [ ] Documentation completion
- [ ] Mobile responsiveness
- [ ] Accessibility audit

### Sprint 9: Launch Preparation
- [ ] Security audit (external)
- [ ] Load testing
- [ ] Monitoring setup
- [ ] Incident response plan
- [ ] Beta launch

### Sprint 10: Production
- [ ] Mainnet deployment
- [ ] Token generation event
- [ ] Marketing launch
- [ ] Community building
- [ ] Support infrastructure

---

## Appendix

### A. File Structure

```
g_p_unite/
├── docker/
│   ├── Dockerfile.search
│   ├── docker-compose.yml
│   ├── .dockerignore
│   └── nginx/
│       ├── search.conf
│       ├── ssl.conf
│       └── logging.conf
├── gpu-platform/
│   ├── gpu_nited.html          # Main unified GUI
│   ├── gpuagent.html           # Agent control (legacy)
│   ├── connect.html            # Node setup (legacy)
│   ├── js/
│   │   ├── gpu-platform.js
│   │   ├── gpu-agents-data.js
│   │   ├── gpu-chart-engine.js
│   │   ├── gpu-rbac.js
│   │   └── gpu-theme.js
│   └── src/
│       ├── obscura-api.ts
│       ├── obscura-bridge.ts
│       ├── rbac.ts
│       ├── theme.ts
│       ├── types.ts
│       └── ws-client.ts
├── search/
│   ├── index.html              # Standalone search console
│   ├── app.js                  # Search console logic
│   ├── server.js               # API + WebSocket server
│   ├── engine.js               # Search/scrape engine
│   ├── stealth.js              # Browser stealth
│   ├── proxy-rotator.js        # Proxy rotation
│   └── README.md
├── docs/
│   └── DOCUMENTATION.md        # This file
├── hardhat.config.js
├── package.json
└── docker-compose.yml
```

### B. API Response Examples

**Search:**
```json
{
  "query": "GPU computing",
  "totalResults": 15,
  "results": [
    {
      "title": "GPU Computing Overview",
      "url": "https://example.com/gpu",
      "snippet": "GPU computing enables parallel processing...",
      "position": 1
    }
  ]
}
```

**Alert Notification:**
```json
{
  "type": "alert:new",
  "alertId": "alert-123",
  "keywords": ["AI", "GPU"],
  "newResults": 3,
  "totalResults": 15,
  "results": [...]
}
```

### C. WebSocket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| connected | Server → Client | `{ clientId, timestamp }` |
| subscribed | Server → Client | `{ subscriptionId, keywords }` |
| alert:first | Server → Client | `{ alertId, keywords, results, totalResults }` |
| alert:new | Server → Client | `{ alertId, keywords, newResults, totalResults }` |
| notification | Server → Client | `{ type, title, message, ... }` |
| filter:updated | Server → Client | `{ keywords }` |
| pong | Server → Client | `{ timestamp }` |
| subscribe:alerts | Client → Server | `{ keywords: [] }` |
| update:filter | Client → Server | `{ keywords: [] }` |
| ping | Client → Server | — |

---

*Last updated: August 2026*
*Version: 2.0*
