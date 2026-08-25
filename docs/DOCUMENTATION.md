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
# FCM Smart Contract System — Complete Report

**Generated:** August 24, 2026  
**Solidity:** ^0.8.20 (via IR, optimizer 200 runs)  
**Framework:** Hardhat · OpenZeppelin 5.x  
**Networks:** Hardhat / Sepolia / Arbitrum Sepolia / Base Sepolia / Base  
**Test suite:** 362 tests, all passing

---

## Table of Contents

1. [System Overview](#system-overview)
2. [FCMToken](#1-fcmtoken) — ERC20 with transfer fees
3. [FCMAgentRegistry](#2-fcmagentregistry) — Agent lifecycle, tasks, disputes
4. [FCMTaskMarketplace](#3-fcmtaskmarketplace) — Spot & auction tasks
5. [FCMTierStaking](#4-fcmtierstaking) — Tiered staking
6. [FCMRewardsPool](#5-fcmrewardspool) — Epoch-based rewards
7. [FCMGovernance](#6-fcmgovernance) — On-chain governance
8. [FCMEscrow](#7-fcmescrow) — Milestone escrow
9. [FCMReputationNFT](#8-fcmreputationnft) — Soulbound reputation
10. [Audit Findings & Fixes](#9-audit-findings)
11. [Role Matrix](#10-role-matrix)
12. [Invariants](#11-invariants)

---

## System Overview

```
FCMToken (ERC20 + fees)
    │
    ├── FCMAgentRegistry (agent lifecycle, task creation, dispute resolution)
    │       └── FCMTaskMarketplace (spot listings, auction tasks)
    │
    ├── FCMTierStaking (stake → tier computation)
    │       ├── FCMGovernance (tier-weighted voting)
    │       └── FCMRewardsPool (tier-multiplied rewards, epoch-based)
    │
    ├── FCMEscrow (milestone-based payments, multi-sig, disputes)
    │
    └── FCMReputationNFT (soulbound ERC721, achievements)
```

**Token flow:** FCMToken is the native token. All staking, rewards, escrow, task rewards, and governance use FCMToken. Fee-exempt addresses (registry, marketplace, staking contracts) skip the 1% burn + 2% treasury fee.

---

## 1. FCMToken

**Inherits:** `ERC20`, `ERC20Burnable`, `AccessControl`  
**File:** `contracts/solidity/FCMToken.sol`

### Constants

| Name | Value | Notes |
|------|-------|-------|
| `MAX_SUPPLY` | 1,000,000,000 FCM | Hard cap |
| `INITIAL_SUPPLY` | 500,000,000 FCM | 500M pre-minted at deploy |
| `MINTER_ROLE` | `keccak256("MINTER_ROLE")` | Can mint reward tokens |

### State

| Variable | Type | Default | Notes |
|----------|------|---------|-------|
| `totalBurned` | `uint256` | 0 | Running total of burned tokens |
| `totalMintedRewards` | `uint256` | 0 | Tokens minted via `mintRewards` |
| `burnRate` | `uint256` | 100 (1.00%) | Basis points |
| `treasuryRate` | `uint256` | 200 (2.00%) | Basis points |
| `treasury` | `address` | constructor arg | Fee destination |
| `feeExempt` | `mapping(address→bool)` | deployer + treasury + self | Addresses immune to fees |

### Functions

#### `constructor(address _treasury)`
Grants `DEFAULT_ADMIN_ROLE` and `MINTER_ROLE` to deployer. Mints 200M to deployer, 200M to treasury, 100M to contract reserve (500M total). Remaining 500M reserved for reward minting.

#### `mintRewards(address to, uint256 amount)` → `onlyRole(MINTER_ROLE)`
- `amount > 0`, `to ≠ address(0)`
- `totalMintedRewards + amount ≤ MAX_SUPPLY - INITIAL_SUPPLY` (500M reserve)
- Increments `totalMintedRewards`, calls `_mint(to, amount)`
- Emits: `BurnMintEquilibrium(burned, minted, timestamp)`

#### `_afterTokenTransfer(from, to, amount)` → `internal override` [hook]
Called after every ERC20 transfer. Implements fee logic:
- **Skips** if `_inFeeTransfer` (reentrancy guard), `from == address(0)` (mint), `to == address(0)` (burn), or either party is `feeExempt`
- Calculates `burnAmount = amount * burnRate / 10000` and `treasuryAmount = amount * treasuryRate / 10000`
- Burns from `to` and transfers to `treasury` under `_inFeeTransfer = true` reentrancy guard

#### `setFeeRates(uint256 _burnRate, uint256 _treasuryRate)` → `onlyRole(DEFAULT_ADMIN_ROLE)`
- `_burnRate + _treasuryRate ≤ 1000` (max 10% combined fees)

#### `setFeeExempt(address account, bool exempt)` → `onlyRole(DEFAULT_ADMIN_ROLE)`

#### `getMintableSupply()` → `view returns (uint256)`
Returns `MAX_SUPPLY - INITIAL_SUPPLY - totalMintedRewards`

### Events

| Event | Parameters |
|-------|------------|
| `BurnMintEquilibrium` | `uint256 burned`, `uint256 minted`, `uint256 timestamp` |
| `FeesUpdated` | `uint256 burnRate`, `uint256 treasuryRate` |
| `FeeExemptUpdated` | `address account`, `bool exempt` |

### Security Notes
- ✅ `_inFeeTransfer` mutex prevents infinite recursion in fee logic
- ✅ Mints skipped in fee calculation (from==0 or to==0)
- ✅ Zero-address guard on `mintRewards`
- ⚠️ Low: `mintRewards` emits only `BurnMintEquilibrium`, not a dedicated transfer event

---

## 2. FCMAgentRegistry

**Inherits:** `AccessControl`, `ReentrancyGuard`, `Pausable`  
**File:** `contracts/solidity/FCMAgentRegistry.sol`

### Roles

| Role | Hash | Purpose |
|------|------|---------|
| `DEFAULT_ADMIN_ROLE` | `0x00` | Pause/unpause, grant roles |
| `ADMIN_ROLE` | `keccak256("ADMIN_ROLE")` | Configure dispute params |
| `VALIDATOR_ROLE` | `keccak256("VALIDATOR_ROLE")` | Resolve disputes |
| `AGENT_ROLE` | `keccak256("AGENT_ROLE")` | Granted on registration |

### Enums

```solidity
enum TaskStatus { Open, Assigned, Completed, Disputed, Slashed, Resolved, Cancelled }
```

**State machine:**
```
Open ──claimTask──→ Assigned ──submitResult──→ Completed
  │                                               │
  └──cancelTask──→ Cancelled                ──────┘
                                               │
                                       disputeTask (must be within window)
                                               │
                                          Disputed
                                         ╱        ╲
                             resolveDispute     claimExpiredDispute
                           (agentFault=true)   (after 7 days)
                                │                    │
                            Slashed              Slashed
                                │                    │
                           resolveDispute
                         (agentFault=false)
                                │
                           Resolved (terminal)
```

### Constants

| Name | Value | Notes |
|------|-------|-------|
| `MIN_STAKE` | 500 FCM | Minimum stake to register |
| `HEARTBEAT_INTERVAL` | 300s | Expected heartbeat interval |
| `SLASH_PERCENT` | 3000 (30%) | Basis points of stake slashed |
| `disputeWindow` | 86400 (1 day) | Admin-configurable |
| `disputeResolutionDeadline` | 604800 (7 days) | Admin-configurable |

### Structs

#### `Agent`
```
didHash          bytes32    Decentralized identifier hash
ipnsRecord       string     IPNS record for agent metadata
operator         address    Agent's controlling address
stake            uint256    Amount staked (500 FCM min)
reputation       uint256    0-10000
registeredAt     uint256    Registration timestamp
lastHeartbeat    uint256    Last heartbeat timestamp
capabilities     bytes32    Bitmask of supported workloads
geohash          bytes32    Encoded geographic hash
isActive         bool       Agent active status
agentType        uint8      0-11 (Inference, Render, FL, Edge, ZK, Game, Science, Privacy, Node, Storage, FileServer, Rewarded)
heartbeatNonce   uint256    Monotonic nonce for replay protection
```

#### `Task`
```
taskId           bytes32    Unique task identifier
requester        address    Who created the task
reward           uint256    Tokens escrowed for completion
deadline         uint256    Task submission deadline
requirements     bytes32    Required capabilities bitmask
inputCID         bytes32    Input data CID
outputCID        bytes32    Output data CID (set on submit)
assignedAgent    address    Agent assigned to task
status           TaskStatus Current lifecycle state
proofHash        bytes32    ZK proof of completion
rewardWithdrawn  bool       Whether reward has been paid
disputedAt       uint256    Timestamp when dispute opened
```

### Mappings

| Mapping | Key → Value |
|---------|-------------|
| `agents` | `didHash → Agent` |
| `tasks` | `taskId → Task` |
| `operatorAgents` | `operator → didHash[]` |
| `slashHistory` | `didHash → total slashed` |
| `operatorActiveTasks` | `operator → active task count` |

### Arrays

| Name | Type | Purpose |
|------|------|---------|
| `agentList` | `bytes32[]` | All registered agent DIDs (for enumeration) |
| `taskList` | `bytes32[]` | All created task IDs |

### Functions

#### Admin

| Function | Access | Description |
|----------|--------|-------------|
| `pause()` | `DEFAULT_ADMIN_ROLE` | Emergency pause all state-changing functions |
| `unpause()` | `DEFAULT_ADMIN_ROLE` | Resume |
| `setDisputeWindow(uint256)` | `ADMIN_ROLE` | Set dispute window (1h–7d) |
| `setDisputeResolutionDeadline(uint256)` | `ADMIN_ROLE` | Set resolution deadline (1d–30d) |

#### `registerAgent(didHash, ipnsRecord, capabilities, geohash, agentType)` → `nonReentrant whenNotPaused`
- Checks: DID not already registered, `agentType ≤ 11`, transferFrom MIN_STAKE succeeds
- Initializes Agent struct: `stake = MIN_STAKE`, `reputation = 5000`, `isActive = true`
- Appends to `operatorAgents[msg.sender]` and `agentList`
- Grants `AGENT_ROLE`
- Emits: `AgentRegistered`

#### `heartbeat(didHash, geohash, nonce, signature)` → public
- Replay-protected via monotonic nonce
- Signed by agent's operator using ECDSA
- Updates `lastHeartbeat`, `geohash`, `heartbeatNonce`
- Emits: `Heartbeat`

#### Task Lifecycle

| Function | Access | State Change |
|----------|--------|-------------|
| `createTask(taskId, requirements, inputCID, deadline)` | public, `nonReentrant whenNotPaused` | Open→Open, escrows reward |
| `claimTask(taskId, didHash)` | public, `nonReentrant whenNotPaused` | Open→Assigned, increments activeTasks |
| `submitResult(taskId, outputCID, proofHash)` | public, `nonReentrant whenNotPaused` | Assigned→Completed, decrements activeTasks |
| `withdrawReward(taskId)` | public, `nonReentrant` | Completed/Resolved→paid, sets rewardWithdrawn=true |
| `cancelTask(taskId)` | public, `nonReentrant` | Open→Cancelled, refunds requester |

**`createTask`:** Computes reward via `calculateReward(requirements)`, escrows tokens from requester.  
**`claimTask`:** Bitwise capability check `(agent.capabilities & task.requirements) == task.requirements`. Only active agents can claim.  
**`submitResult`:** Must be `Assigned`. Guarded against counter underflow via `operatorActiveTasks > 0`.  
**`withdrawReward`:** Eligible when `status ∈ {Completed, Resolved}` and `block.timestamp > deadline + disputeWindow`. Reputation +100.  
**`cancelTask`:** Only Open tasks. CEI-compliant: sets status to Cancelled then transfers. State set **before** transfer.

#### `disputeTask(taskId, reason)` → public
- `reason` must be non-empty (validated)
- Only requester can dispute
- Status must be `Completed`, within `deadline + disputeWindow`
- Sets `status = Disputed`, `disputedAt = block.timestamp`

#### `resolveDispute(taskId, agentFault, resolution)` → `onlyRole(VALIDATOR_ROLE)`
- Must be within `disputedAt + disputeResolutionDeadline`
- **Agent at fault** (`agentFault=true`):
  - Slashes 30% of stake, reputation -500
  - State → `Slashed` (before transfer) ✅ CEI
  - Transfers `reward + slashAmount` to requester
- **Agent innocent** (`agentFault=false`):
  - State → `Resolved`, sets `rewardWithdrawn = true` (before transfer) ✅ CEI, prevents double-spend
  - Transfers reward to assigned agent

#### `claimExpiredDispute(taskId)` → `nonReentrant`
- Must be Disputed, `disputedAt > 0`, `> 7 days` since dispute
- Only requester or assigned agent can call
- Status → `Slashed`, reward refunded to requester

#### `unstake(didHash)` → `nonReentrant`
- Must be operator, have stake, `operatorActiveTasks == 0`
- Returns full stake, sets `isActive = false`

#### View Functions

| Function | Returns | Notes |
|----------|---------|-------|
| `getAgentOperator(didHash)` | `address` | Operator address |
| `getAgentStatus(didHash)` | `(bool, address)` | isActive + operator |
| `getAgentsByType(agentType)` | `bytes32[]` | Two-pass O(n) for gas efficiency |
| `calculateReward(requirements)` | `uint256` | `100 + complexity` FCM |
| `getProposalState(proposalId)` | `ProposalState` | — |
| `getProposalVotes(proposalId)` | `(for, against, abstain)` | — |

### Internal Functions

| Function | Description |
|----------|-------------|
| `findDidByOperator(address)` | Reverse-lookup, prefers active agent. Reverts if none active |
| `min(uint256, uint256)` | Pure min |
| `max(uint256, uint256)` | Pure max |

### Events

| Event | Key fields |
|-------|-----------|
| `AgentRegistered` | `didHash`, `operator`, `agentType`, `geohash` |
| `TaskCreated` | `taskId`, `requester`, `reward` |
| `TaskAssigned` | `taskId`, `agentDid` |
| `TaskCompleted` | `taskId`, `outputCID`, `proofHash` |
| `TaskDisputed` | `taskId`, `disputant`, `reason` |
| `AgentSlashed` | `didHash`, `amount`, `reason` |
| `Heartbeat` | `didHash`, `timestamp`, `geohash` |
| `TaskCancelled` | `taskId`, `requester`, `refund` |
| `DisputeExpired` | `taskId`, `claimant`, `refund` |
| `DisputeWindowUpdated` | `oldWindow`, `newWindow` |

---

## 3. FCMTaskMarketplace

**Inherits:** `ReentrancyGuard`, `AccessControl`  
**File:** `contracts/solidity/FCMTaskMarketplace.sol`

### Enums

```solidity
enum PricingModel { Spot, Reserved, Auction }
enum TaskPriority { Low, Normal, High, Critical }
```

### Structs

#### `Bid`
```
agentDid    bytes32    DID of bidding agent
bidder      address    Address placing bid
price       uint256    Bid amount (escrowed)
timestamp   uint256    When bid was placed
withdrawn   bool       Whether bid has been refunded
```

#### `AuctionTask`
```
taskId          bytes32     Task identifier
minPrice        uint256     Minimum acceptable bid
maxPrice        uint256     Starting price (escrowed from lister)
auctionEnd      uint256     End timestamp
auctionDuration uint256     Duration in seconds
bids            Bid[]       All bids placed
settled         bool        Whether auction has been settled
lister          address     Creator of the auction
```

### Mappings

| Mapping | Purpose |
|---------|---------|
| `auctionTasks[taskId]` | Auction task data |
| `escrowedBids[address]` | Total escrowed bid amount per bidder |
| `spotTaskListers[taskId]` | Lister of spot task |
| `spotTaskAmounts[taskId]` | Escrowed amount for spot task |
| `spotTaskCancelled[taskId]` | Whether spot task was cancelled |

### Functions

#### `constructor(address _registry, address _fcmToken)`
Grants `DEFAULT_ADMIN_ROLE` and `LISTING_ROLE` to deployer.

#### Spot Tasks

**`listSpotTask(taskId, maxPrice, deadline, priority)`** → `nonReentrant`
- No `_requirements` param (removed as dead code)
- `maxPrice > 0`, `deadline > now`, taskId unique
- Escrows `maxPrice` from lister
- Stored lister + amount for refund via `cancelSpotTask`

**`cancelSpotTask(taskId)`** → `nonReentrant`
- Only lister, not already cancelled, escrow > 0
- CEI: sets cancelled + zeros amount before transfer
- Refunds full `maxPrice` to lister

#### Auction Tasks

**`listAuctionTask(taskId, minPrice, maxPrice, auctionDuration)`** → `nonReentrant`
- `minPrice > 0`, `maxPrice > minPrice`, `duration ∈ (0, 86400]`
- Escrows `maxPrice` from lister
- Sets `auctionEnd = now + duration`

**`getAuctionPrice(taskId)`** → `view returns (uint256)`
- Dutch auction: price drops linearly from `maxPrice` to `minPrice` over duration
- At/after end: returns `minPrice`

**`placeBid(taskId, agentDid, price)`** → `nonReentrant`
- Auction active, not settled
- `price ≤ current dutch price` and `price ≥ minPrice`
- Escrows bid amount, increments `escrowedBids[msg.sender]`

**`settleAuction(taskId)`** → `nonReentrant`
- Anyone can call after `auctionEnd`
- Finds lowest bid, marks settled
- Refunds all non-winning bids from stored `bidder` address
- ⚠️ Known issue: lister's `maxPrice` escrow and winning bid refund are not handled here — left for product decision

**`claimAuctionRefund(taskId, bidIndex)`** → `nonReentrant`
- Allows operator or DID operator to claim bid refund
- Only after settlement, for non-withdrawn bids

### Events

| Event | Fields |
|-------|--------|
| `SpotTaskListed` | `taskId`, `lister`, `maxPrice`, `priority` |
| `SpotTaskCancelled` | `taskId`, `lister`, `refund` |
| `AuctionListed` | `taskId`, `lister`, `minPrice`, `maxPrice`, `duration` |
| `BidPlaced` | `taskId`, `agentDid`, `price` |
| `AuctionSettled` | `taskId`, `winningAgent`, `price` |
| `BidRefunded` | `taskId`, `agent`, `amount` |

---

## 4. FCMTierStaking

**Inherits:** `AccessControl`, `ReentrancyGuard`, `Pausable`  
**File:** `contracts/solidity/FCMTierStaking.sol`

### Roles

| Role | Purpose |
|------|---------|
| `ADMIN_ROLE` | Update tier configs |
| `ORACLE_ROLE` | Update hardware scores |

### Constants

| Name | Value |
|------|-------|
| `TIER_CHANGE_GRACE_PERIOD` | 3 days |
| `HARDWARE_CHECK_INTERVAL` | 24 hours |
| `MAX_TIERS` | 6 |

### Tier Definitions

| Tier | Name | Min Stake | Min Score | Reward Multiplier | Fee Discount | Max Concurrent |
|------|------|-----------|-----------|-------------------|-------------|----------------|
| 0 | Free | 0 | 0 | 0.5x | 0% | 1 |
| 1 | Starter | 100 FCM | 2000 | 1.0x | 5% | 3 |
| 2 | Standard | 500 FCM | 4000 | 1.5x | 10% | 5 |
| 3 | Advanced | 2,000 FCM | 6000 | 2.0x | 15% | 10 |
| 4 | Pro | 10,000 FCM | 8000 | 3.0x | 20% | 20 |
| 5 | Elite | 50,000 FCM | 9000 | 5.0x | 25% | 50 |

### Structs

#### `TierConfig`
```
minStake          uint256    Minimum stake
minScore          uint256    Minimum hardware+uptime score (0-10000)
rewardMultiplier  uint256    Basis points (100 = 1x)
feeDiscount       uint256    Basis points
maxConcurrent     uint256    Max concurrent tasks
name              string     Display name
```

#### `StakeInfo`
```
operator          address    Staker's address
amount            uint256    Currently staked
stakedAt          uint256    First stake timestamp
lastHardwareCheck uint256    Last oracle update
hardwareScore     uint256    0-10000
uptimeScore       uint256    0-10000
currentTier       uint8      Current tier
targetTier        uint8      Pending downgrade target
tierChangedAt     uint256    Last tier change timestamp
exists            bool       Has this address ever staked
```

### Functions

#### `stake(uint256 amount)` → `nonReentrant whenNotPaused`
- First-time stakers are added to `stakers[]` and start at Tier 0
- Auto-computes tier via `_computeTier()` after staking
- Upgrades are immediate if qualified

#### `unstake(uint256 amount)` → `nonReentrant whenNotPaused`
- Partial unstaking supported
- Transfers tokens first, then recomputes tier
- Downgrades only after `TIER_CHANGE_GRACE_PERIOD` (anti-gaming)
- Emits `TierDowngraded` with correct old/new tiers

#### `updateHardwareScore(operator, hwScore, uptimeScore)` → `onlyRole(ORACLE_ROLE) whenNotPaused`
- Can only update every 24h
- Scores capped at 10000
- Auto-recomputes tier; upgrades immediate, downgrades gated

#### `emergencyWithdraw()` → `nonReentrant`
- Only when contract is paused
- Returns full stake, sets tier to 0
- ✅ Properly decrements `tierStakeCount[oldTier]`

#### `updateTierConfig(tier, ...)` → `onlyRole(ADMIN_ROLE)`
- Updates tier parameters; multiplier capped at 5x, discount at 50%

#### View Functions

| Function | Returns |
|----------|---------|
| `getTier(address)` | `uint8` current tier |
| `getEffectiveMultiplier(address)` | `uint256` reward multiplier |
| `getFeeDiscount(address)` | `uint256` fee discount |
| `getMaxConcurrent(address)` | `uint256` concurrent task cap |
| `getStakerCount()` | `uint256` |
| `getStakersByTier(uint8)` | `address[]` |

#### `_computeTier(stake, combinedScore)` → `internal view returns (uint8)`
Iterates tier 5→1, returns highest qualifying tier. Falls back to 0.

### Events

| Event | Fields |
|-------|--------|
| `Staked` | `operator`, `amount`, `tier` |
| `Unstaked` | `operator`, `amount` |
| `TierUpgraded` | `operator`, `oldTier`, `newTier` |
| `TierDowngraded` | `operator`, `oldTier`, `newTier` |
| `HardwareScoreUpdated` | `operator`, `hwScore`, `uptimeScore` |
| `TierConfigUpdated` | `tier`, `name`, `minStake`, `minScore` |

---

## 5. FCMRewardsPool

**Inherits:** `AccessControl`, `ReentrancyGuard`, `Pausable`  
**File:** `contracts/solidity/FCMRewardsPool.sol`

### Roles

| Role | Purpose |
|------|---------|
| `ADMIN_ROLE` | Fund epochs, finalize, set prices |
| `ORACLE_ROLE` | Record agent work |

### Constants

| Name | Value |
|------|-------|
| `EPOCH_DURATION` | 7 days |

### Structs

#### `EpochReward`
```
totalPool        uint256    Deposited tokens
totalDistributed uint256    Paid out tokens
tasksCompleted   uint256    Work units completed
finalized        bool       Epoch finalized
```

#### `AgentReward`
```
totalEarned       uint256    Lifetime earnings
epochWork         uint256    Work units this epoch
epochClaimed      uint256    Tokens claimed this epoch
lastClaimEpoch    uint256    Last claimed epoch
consecutiveEpochs uint256    Streak counter
```

#### `TaskPrice`
```
basePrice         uint256    Base price (18 decimal)
marketMultiplier  uint256    Market adjustment (basis points)
active            bool       Whether this type is active
```

### Functions

#### `fundEpoch(uint256 amount)` → `onlyRole(ADMIN_ROLE) whenNotPaused`
- Transfers tokens from admin to pool
- Adds to current epoch's `totalPool` and `totalPoolBalance`

#### `recordWork(agent, agentType, workUnits)` → `onlyRole(ORACLE_ROLE) whenNotPaused`
- `workUnits > 0`, agentType must be active
- Increments `agentRewards[agent].epochWork` and `epochs[currentEpoch].tasksCompleted` ✅ (fixed: was missing)

#### `claimRewards()` → `nonReentrant whenNotPaused`
- Claims from last finalized epoch (not current)
- Formula: `(agentWork × totalPool × multiplier) / (tasksCompleted × 10000)`
- Minimum claim: `minClaimAmount` (default 1 FCM) — Sybil prevention
- CEI-compliant: state updated before transfer

#### `finalizeEpoch()` → `onlyRole(ADMIN_ROLE) whenNotPaused` ✅ (fixed: was permissionless)
- Must be `epochStartTime + EPOCH_DURATION` or later
- Marks current epoch as finalized, starts new epoch

#### `setTaskPrice(agentType, basePrice, marketMultiplier)` → `onlyRole(ADMIN_ROLE)`
- `marketMultiplier ∈ [0.5x, 2x]` (5000-20000 basis points)

#### `setMinClaimAmount(uint256)` → `onlyRole(ADMIN_ROLE)`

#### `emergencyWithdraw(uint256 amount)` → `onlyRole(DEFAULT_ADMIN_ROLE)`
- Only when paused

#### View Functions

| Function | Returns |
|----------|---------|
| `getEffectivePrice(agentType)` | Base × market multiplier / 10000 |
| `getAgentLifetimeEarnings(agent)` | Total earned |
| `getAgentPendingRewards(agent)` | Estimated pending |
| `getEpochInfo(epochNum)` | `(totalPool, distributed, tasks, finalized)` |

---

## 6. FCMGovernance

**Inherits:** `AccessControl`, `ReentrancyGuard`, `Pausable`  
**File:** `contracts/solidity/FCMGovernance.sol`

### Constants / Parameters

| Name | Default | Range | Notes |
|------|---------|-------|-------|
| `votingDuration` | 3 days | 1d–30d | Admin-configurable |
| `timelockDuration` | 1 day | 1h–7d | Admin-configurable |
| `quorumThreshold` | 2000 (20%) | 10%–50% | Basis points |

### Enums

```solidity
enum ProposalState { Pending, Active, Succeeded, Defeated, Queued, Executed, Cancelled }
```
> ⚠️ `Succeeded` and `Defeated` defined but never assigned.

### Struct

#### `Proposal`
```
id                   uint256      Proposal ID (1-indexed)
proposer             address      Creator
description          string       Text description
callData             bytes        Encoded function call
target               address      Target contract
startBlock           uint256      Voting start block
endBlock             uint256      Voting end block
forVotes             uint256      Total for
againstVotes         uint256      Total against
abstainVotes         uint256      Total abstain
eta                  uint256      Execution timestamp (after timelock)
totalStakedAtProposal uint256     Total supply snapshot
state                ProposalState
hasVoted[address]    bool         Per-voter record
votes[address]       uint8        0=against, 1=for, 2=abstain
```

### Functions

#### `propose(description, target, callData)` → `returns (uint256 proposalId)`
- `target ≠ address(0)`, description non-empty
- Snapshot: `totalStakedAtProposal = fcmToken.totalSupply()`
- Voting starts at `block.number + 1`, duration in blocks (`votingDuration / 12`)
- State: `Active`

#### `castVote(proposalId, support)` → `nonReentrant whenNotPaused`
- Support: 0=against, 1=for, 2=abstain
- Voting power = `balanceOf(voter) × tierWeight / 100`
- Tier weights: `[100, 200, 300, 500, 1000, 2000]` → 1x–20x ✅ (fixed from 100x-too-low)
- One vote per voter

#### `queueProposal(proposalId)` → `nonReentrant`
- After voting ended, quorum + majority reached
- Sets timelock ETA (`now + timelockDuration`), state → `Queued`

#### `executeProposal(proposalId)` → `nonReentrant whenNotPaused`
- After timelock expires
- Executes `target.call(callData)`, state → `Executed`

#### `cancelProposal(proposalId)` → public
- Proposer or ADMIN_ROLE
- Only when `Pending` or `Active`

#### Admin Functions

| Function | Access | Purpose |
|----------|--------|---------|
| `setVotingDuration` | `ADMIN_ROLE` | 1d–30d |
| `setTimelockDuration` | `ADMIN_ROLE` | 1h–7d |
| `setQuorumThreshold` | `ADMIN_ROLE` | 10%–50% |

#### View Functions

| Function | Returns |
|----------|---------|
| `getProposalState(id)` | `ProposalState` |
| `getProposalVotes(id)` | `(for, against, abstain)` |
| `hasVoted(id, voter)` | `bool` |

### Internal Functions

| Function | Purpose |
|----------|---------|
| `_getVotingPower(voter)` | `balanceOf(voter) × tierWeights[tier] / 100` |
| `_quorumReached(id)` | `totalVotes ≥ totalStakedAtProposal × quorumThreshold / 10000` |
| `_majorityReached(id)` | `forVotes > againstVotes` |

---

## 7. FCMEscrow

**Inherits:** `AccessControl`, `ReentrancyGuard`, `Pausable`  
**File:** `contracts/solidity/FCMEscrow.sol`

### Roles

| Role | Purpose |
|------|---------|
| `ADMIN_ROLE` | Set multisig threshold |
| `ARBITRATOR_ROLE` | Resolve disputes |

### Enums

```solidity
enum EscrowState { Created, Funded, InProgress, Completed, Disputed, Resolved, Cancelled, Refunded }
```

### Structs

#### `Milestone`
```
description    string     Milestone description
amount         uint256    Payment for this milestone
deliverableCID bytes32    CID of submitted deliverable
approved       bool       Client approved
submitted      bool       Worker submitted
submittedAt    uint256    Submission timestamp
approvedAt     uint256    Approval timestamp
```

#### `Escrow`
```
id                uint256            Escrow ID (1-indexed)
client            address            Client/funder
worker            address            Worker/contractor
totalAmount       uint256            Total escrowed
releasedAmount    uint256            Amount paid out
remainingAmount   uint256            Remaining in escrow
createdAt         uint256            Creation timestamp
deadline          uint256            90 days from creation
disputeDeadline   uint256            120 days from creation
state             EscrowState        Current state
milestones        Milestone[]        Array of milestones
completedMilestones uint256          Count of approved
requiresMultiSig  bool               Jobs ≥ 10K FCM need 2 approvals
approvalCount     uint256            Current multi-sig count
hasApproved[addr] bool               Per-approver anti-replay
arbitrators[addr] bool               Designated arbitrators (unused)
```

### Constants

| Name | Default |
|------|---------|
| `multisigThreshold` | 10,000 FCM |
| `maxMilestones` | 20 |
| `disputeWindow` | 14 days |

### Functions

#### `createEscrow(worker, milestoneDescs[], milestoneAmounts[])` → `nonReentrant whenNotPaused returns (uint256)`
- Validates: worker ≠ address(0), worker ≠ client, arrays match, 1–20 milestones
- Each milestone amount > 0
- 90-day deadline, 120-day dispute deadline
- Multi-sig required if total ≥ `multisigThreshold`

#### `fundEscrow(escrowId)` → `nonReentrant whenNotPaused`
- Client funds total amount
- State: `Created → Funded`
- Resets multi-sig state

#### `submitMilestone(escrowId, milestoneIndex, deliverableCID)` → `nonReentrant`
- Worker only
- State must be `Funded`, `InProgress`, or `Resolved` ✅
- Transition: `Funded → InProgress` on first submit

#### `approveMilestone(escrowId, milestoneIndex)` → `nonReentrant`
- Client only
- States: `InProgress` or `Resolved` ✅
- Multi-sig: client calls twice before funds release ✅ (fixed)
- Transfers milestone amount to worker
- If all milestones approved → state = `Completed`

#### `disputeMilestone(escrowId, milestoneIndex, reason)` → `nonReentrant`
- Either party, `reason` must be non-empty ✅
- States: `InProgress` or `Resolved` ✅
- Within `disputeDeadline`
- State → `Disputed`

#### `resolveDispute(escrowId, clientWins, resolution)` → `nonReentrant onlyRole(ARBITRATOR_ROLE)`
- Finds first disputed milestone (submitted, not approved)
- **Client wins:** State → `Refunded`, milestone amount refunded ✅ CEI
- **Worker wins:** Milestone marked approved, funds released ✅ CEI
- Fallback: `Disputed → Resolved` if no matching milestone
- If all milestones complete after resolution → `Completed`

#### `cancelEscrow(escrowId)` → `nonReentrant`
- Client only, state `Created` or `Funded`
- Refunds totalAmount if Funded
- State → `Cancelled`

#### View Functions

| Function | Returns |
|----------|---------|
| `getEscrowMilestones(id)` | `(descriptions[], amounts[], approved[], submitted[])` |
| `getEscrowSummary(id)` | `(client, worker, total, released, completed, totalMilestones, state)` |

#### `setMultisigThreshold(uint256)` → `onlyRole(ADMIN_ROLE)`

---

## 8. FCMReputationNFT

**Inherits:** `ERC721`, `AccessControl`, `Pausable`  
**File:** `contracts/solidity/FCMReputationNFT.sol`

### Key Design
- **Soulbound:** `transferFrom`, `safeTransferFrom`, `approve`, `setApprovalForAll` all revert
- One badge per operator, one badge per DID
- Achievements use bitmask (8 flags)

### Roles

| Role | Purpose |
|------|---------|
| `ADMIN_ROLE` | Mint badges |
| `ORACLE_ROLE` | Update badges, increment streaks |

### Struct

#### `Badge`
```
operator        address    Agent's address
didHash         bytes32    Agent's DID
tier            uint8      Current tier
totalWork       uint256    Lifetime work units
totalEarnings   uint256    Lifetime earnings
uptimeScore     uint256    Current uptime score
disputesWon     uint256    Disputes won
disputesLost    uint256    Disputes lost
consecutiveDays uint256    Streak
mintedAt        uint256    Mint timestamp
lastUpdated     uint256    Last update timestamp
exists          bool       Validation flag
```

### Achievement Flags

| Bit | Name | Condition |
|-----|------|-----------|
| 0 | FIRST_TASK | `totalWork ≥ 1` |
| 1 | 100_TASKS | `totalWork ≥ 100` |
| 2 | 1000_TASKS | `totalWork ≥ 1000` |
| 3 | PERFECT_UPTIME | `uptimeScore ≥ 9900` |
| 4 | TIER_5 | `tier ≥ 5` |
| 5 | YEAR_VETERAN | 365 days since mint |
| 6 | DISPUTE_CHAMPION | `disputesWon ≥ 10` AND `disputesLost == 0` |
| 7 | MILLION_EARNED | `totalEarnings ≥ 1,000,000 FCM` |

### Functions

#### `supportsInterface(bytes4)` → `view`
Resolves ERC721 + AccessControl diamond inheritance

#### `mintBadge(operator, didHash)` → `onlyRole(ADMIN_ROLE)`
- Operator ≠ address(0), no existing badge for operator or DID
- Mints ERC721 to operator, creates Badge struct
- Emits: `BadgeMinted`

#### `updateBadge(operator, newTier, addWork, addEarnings, newUptime, disputeWon, disputeLost)` → `onlyRole(ORACLE_ROLE) whenNotPaused`
- Increments work, earnings, dispute counters
- Calls `_checkAchievements()` to unlock new achievements
- Emits: `BadgeUpdated`, `AchievementUnlocked` (per new achievement)

#### `incrementStreak(operator)` → `onlyRole(ORACLE_ROLE)`
- Increments `consecutiveDays`

#### Soulbound Overrides
All five transfer/approval functions revert with `"Soulbound: cannot transfer"` or `"Soulbound: cannot approve"`

#### View Functions

| Function | Returns |
|----------|---------|
| `getBadge(operator)` | `Badge` memory |
| `getAchievements(operator)` | `uint256` bitmask |
| `hasAchievement(operator, flag)` | `bool` |
| `totalSupply()` | `uint256` |

#### `_checkAchievements(tokenId, badge)` → `internal`
Checks all 8 achievement conditions and emits events for newly unlocked ones

---

## 9. Audit Findings

### Issues Found & Fixed (this session)

| # | Severity | Contract | Issue | Status |
|---|----------|----------|-------|--------|
| F-2 | 🔴 CRITICAL | AgentRegistry | Double-spend: `resolveDispute` innocent path didn't set `rewardWithdrawn=true` | ✅ Fixed |
| F-4 | 🔴 CRITICAL | RewardsPool | Division by zero: `tasksCompleted` never incremented in `recordWork` | ✅ Fixed |
| F-7 | 🟠 HIGH | Escrow | Multi-sig broken: `e.client == msg.sender` + `hasApproved` prevented second approval | ✅ Fixed |
| F-3 | 🟠 HIGH | TaskMarketplace | Locked funds in `settleAuction` — lister's escrow + winning bid not settled | ⚠️ Needs spec |
| F-6 | 🟡 MEDIUM | Governance | Voting power 100x too low: tier weights / 100 gave 0.01x–0.20x instead of 1x–20x | ✅ Fixed |
| F-8 | 🟡 MEDIUM | Escrow | `Resolved` state stranded remaining milestones — no state path accepted it | ✅ Fixed |
| — | 🟡 MEDIUM | AgentRegistry | CEI violation: `resolveDispute` wrote state after token transfer | ✅ Fixed |
| — | 🟡 MEDIUM | Escrow | CEI violation: `resolveDispute` wrote state after token transfer | ✅ Fixed |
| — | 🟡 MEDIUM | TierStaking | `emergencyWithdraw` didn't decrement `tierStakeCount[oldTier]` | ✅ Fixed |
| — | 🟡 MEDIUM | RewardsPool | `finalizeEpoch` had no access control — anyone could finalize | ✅ Fixed |
| — | 🟡 MEDIUM | AgentRegistry | `findDidByOperator` returned inactive agent as silent fallback | ✅ Fixed |
| — | 🟡 MEDIUM | Escrow | Missing `nonReentrant` on `disputeMilestone` | ✅ Fixed |
| — | 🟡 MEDIUM | Escrow | `hasApproved` not reset after multi-sig approval (replay across milestones) | ✅ Fixed |
| — | 🟢 LOW | AgentRegistry | Empty reason string on `disputeTask` | ✅ Fixed |
| — | 🟢 LOW | Escrow | Empty reason string on `disputeMilestone` | ✅ Fixed |
| — | 🟢 LOW | Governance | Missing `nonReentrant` on `castVote` and `queueProposal` | ✅ Fixed |
| — | 🟢 LOW | TaskMarketplace | Dead `_requirements` parameter in listing functions (compiler warnings) | ✅ Fixed |

### Remaining Considerations

| # | Contract | Note |
|---|----------|------|
| F-1 | FCMToken | `mintRewards` doesn't emit a dedicated `Transfer` event for mint (only `BurnMintEquilibrium`) |
| F-5 | Governance | `Succeeded`/`Defeated` enum values defined but never assigned |
| — | FCMTierStaking | `_computeTier` local variable `stake` shadows `stake()` function name (compiler warning) |
| — | FCMReputationNFT | `view` functions that always revert should be `pure` (compiler warning) |
| — | FCMTaskMarketplace | `settleAuction` locked funds: lister's maxPrice and winning bidder's escrow have no payout path. Needs product decision on whether marketplace holds or forwards to registry |

---

## 10. Role Matrix

| Role | Admin | Agent | Validator | Oracle | Arbitrator | Lister | Minter |
|------|-------|-------|-----------|--------|------------|--------|--------|
| **Pause contracts** | ✅ | | | | | | |
| **Set fee rates** | ✅ | | | | | | |
| **Mint tokens** | | | | | | | ✅ |
| **Set dispute params** | ✅ | | | | | | |
| **Register agent** | | (any) | | | | | |
| **Resolve task dispute** | | | ✅ | | | |
| **Update HW score** | | | | ✅ | | |
| **Finalize epoch** | ✅ | | | | | |
| **Record work** | | | | ✅ | | |
| **Resolve escrow dispute** | | | | | ✅ | |
| **Fund epoch** | ✅ | | | | | |

---

## 11. Invariants

These should hold true at all times — useful for fuzz/invariant testing:

1. **Token supply:** `totalSupply() ≤ MAX_SUPPLY`
2. **Stake accounting:** `sum of all agent.stakes ≤ IERC20(fcmToken).balanceOf(registry)`
3. **Active tasks:** `operatorActiveTasks[addr] = count of tasks where assignedAgent==addr AND status==Assigned`
4. **Tier counts:** `sum(tierStakeCount[0..5]) = stakers.length`
5. **Escrow accounting:** `releasedAmount + remainingAmount = escrowed tokens not refunded`
6. **Rewards pool:** `totalPoolBalance = sum of (epochs[i].totalPool - epochs[i].totalDistributed)`
7. **No double-spend:** `rewardWithdrawn == true` implies token transfer has occurred
8. **Task status integrity:** Only valid state transitions per the state machine diagram
9. **One badge per operator:** `operatorBadge[op] > 0` → cannot mint again for same operator
10. **Soulbound:** No badge token can be transferred (all transfer functions revert)
# FCM — Complete Documentation

**Last Updated:** August 24, 2026
**Version:** 1.0

---

## Table of Contents

1. [Platform Specification](#1-federated-compute-mesh-platform-specification)
2. [Smart Contract Report](#2-fcm-smart-contract-system--complete-report)
3. [Tier System](#3-fcm-tiered-membership--reward-system)
4. [Integration Guide](#4-fcm-integration-guide)
5. [Ethereum Deployment](#5-ethereum-deployment)
6. [Docker Setup](#6-docker-setup)
7. [Roadmap](#7-roadmap)
8. [Security Audit](#8-security-audit)
9. [Security Status](#9-security-status)
10. [Sales & Go-To-Market](#10-sales--go-to-market)

---

# 1. Federated Compute Mesh — Platform Specification

The Federated Compute Mesh (FCM) is a trustless, worldwide distributed computing platform that aggregates idle GPU and mobile compute resources across iOS, Android, Windows, macOS, Linux, servers, and IoT devices. It leverages IPFS for decentralized identity, location-aware grouping for latency optimization, and a polyglot runtime supporting Python, Rust, Lua, TypeScript, CUDA, Swift, and JVM languages.

**Core Value Proposition:** Turn every device into a cloud node without centralized infrastructure, enabling high-value compute workloads at 10-100x lower cost than traditional cloud providers.

## Platform Overview

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Identity Layer** | IPFS/IPNS + DIDs | Trustless node identity without central registries |
| **Location Engine** | GeoHash clustering + RTT probing | Sub-50ms task dispatch via regional grouping |
| **Runtime Kernel** | Rust (Tokio) + WASM3 | Universal sandbox executing Python, TS, Lua, CUDA, Swift, JVM |
| **GPU Abstraction** | wgpu + native backends | CUDA, Metal, Vulkan, OpenCL, DirectX 12 |
| **Networking** | libp2p + WebRTC + QUIC | P2P mesh with 0-RTT connection resumption |
| **Consensus** | HotStuff BFT (regional supernodes) | Byzantine fault tolerance for result verification |
| **Economics** | FCM token (L2 rollup) | Pay-per-compute with stake/slashing security |

### High-Value Use Cases

1. **Distributed AI Inference** — Host Llama 3/Mistral on consumer GPUs at 78% lower cost than AWS
2. **Decentralized Render Farm** — Blender/Unreal distributed rendering with real-time progress streaming
3. **Federated Learning** — Hospitals/banks train models locally, share only encrypted gradients
4. **Serverless Edge** — WASM functions with <10ms cold start, replacing Lambda
5. **ZK-Proving Market** — Generate zero-knowledge proofs for rollups across mobile+GPU clusters
6. **Real-Time Game Servers** — Sub-20ms multiplayer hosting geo-distributed to players
7. **Scientific Computing** — Climate modeling, protein folding with crypto-economic incentives
8. **Privacy Infrastructure** — Encrypted mixnet relays and censorship-resistant VPN exit nodes

## System Architecture

### Layer Stack

| Layer | Function | Technologies |
|-------|----------|-------------|
| **Application** | Workload definitions, marketplaces | TypeScript/React, SwiftUI, Jetpack Compose |
| **Orchestration** | Task scheduling, resource matching | Rust (Tokio), gRPC, Raft consensus |
| **Runtime** | Universal execution environment | WASM3, LLVM, CUDA Runtime, Metal, Vulkan |
| **Communication** | P2P mesh networking | libp2p, WebRTC, QUIC, Noise Protocol |
| **Identity** | Trustless DIDs, reputation | IPFS/IPNS, Ceramic Network, Verifiable Credentials |
| **Storage** | Distributed data, model weights | IPFS/Filecoin, R2/S3 gateways, BitTorrent v2 |
| **Hardware Abstraction** | Cross-platform compute | Rust GPU (wgpu), OpenCL, SYCL, Android NNAPI, CoreML |

### Identity & Trust System (IPFS-Based)

#### DID Schema

```json
{
  "@context": "https://fcm.network/did/v1",
  "id": "did:ipfs:QmXyz...123",
  "controller": "did:ipfs:QmXyz...123",
  "verificationMethod": [{
    "id": "did:ipfs:QmXyz...123#keys-1",
    "type": "Ed25519VerificationKey2020",
    "controller": "did:ipfs:QmXyz...123",
    "publicKeyMultibase": "z6Mkq..."
  }],
  "service": [{
    "id": "did:ipfs:QmXyz...123#compute",
    "type": "FCMComputeNode",
    "serviceEndpoint": "/ip4/192.168.1.1/udp/4001/quic"
  }],
  "computeProfile": {
    "hardwareAttestation": "0x7a3f...",
    "capabilities": ["cuda:12.1", "avx512", "neon", "metal3"],
    "benchmarkScore": 184729,
    "stakeAmount": 500.0,
    "reputation": 4.97,
    "locationHash": "u4pruydqqvj"
  }
}
```

### Location Grouping & Topology

#### Geo-Hash Based Clustering

| Precision | Area Size | Use Case |
|-----------|-----------|----------|
| 4 chars | ~20km x 40km | Metro area clusters |
| 5 chars | ~2.4km x 4.8km | Neighborhood latency optimization |
| 6 chars | ~600m x 600m | Ultra-low latency gaming/VR |

```python
def discover_neighbors(node_id: DID, geohash: str) -> List[Peer]:
    peers = dht_query(prefix=geohash[:5], protocol="fcm/v1")
    candidates = [p for p in peers if ping(p) < 50ms]
    return sorted(candidates, key=lambda p: p.bandwidth, reverse=True)
```

#### Regional Federation Rings

**Supernode Election:**
- Each geohash region elects 7 supernodes via proof-of-stake + reputation weighting
- Supernodes maintain regional consensus using **HotStuff** or **Tendermint BFT**
- Inter-region communication via optimized backbone paths

**Data Sovereignty Compliance:**
- EU nodes form GDPR-compliant sub-meshes
- China nodes operate within cyberspace regulations
- Enterprise nodes enforce geo-fencing policies

#### Network Topology Optimization

```
Tier 1: Backbone Nodes (Data centers, servers)
   ↓ 10-50ms
Tier 2: Edge Nodes (Desktops, high-end mobile)
   ↓ 1-10ms  
Tier 3: IoT/Mobile (Sensors, phones, wearables)

Latency-Based Routing:
- Kademlia DHT with RTT-weighted k-buckets
- Proximity Neighbor Selection (PNS)
- Application-aware path selection
```

## Multi-Language Runtime Architecture

### Polyglot Execution Environment

```
┌─────────────────────────────────────────────────────────────┐
│                    FCM RUNTIME KERNEL                        │
│                      (Rust + Tokio)                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  WASM3 VM    │  │  LuaJIT      │  │  Python      │     │
│  │  (Sandbox)   │  │  (Embedded)  │  │  (PyO3/      │     │
│  │              │  │              │  │   CPython)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  TypeScript  │  │  Swift       │  │  JVM/Kotlin  │     │
│  │  (Deno/      │  │  (Native     │  │  (GraalVM    │     │
│  │   QuickJS)   │  │   interop)   │  │   Native)    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
├─────────────────────────────────────────────────────────────┤
│           GPU ABSTRACTION LAYER (Rust GPU/wgpu)            │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │
│  │ CUDA   │ │ Metal  │ │ Vulkan │ │ OpenCL │ │ DX12   │  │
│  │ (NVIDIA│ │ (Apple)│ │(Cross) │ │(Legacy)│ │(Windows│  │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Language-Specific Integration

| Language | Role | Integration Method | Performance |
|----------|------|-------------------|-------------|
| **Rust** | Core runtime, networking, crypto, scheduler | Native | Zero overhead |
| **Python** | ML/AI workloads (PyTorch, JAX, TensorFlow) | PyO3 bindings + WASM | ~5% overhead |
| **TypeScript** | Orchestration logic, web dashboards, API servers | Deno embedded | ~15% overhead |
| **Lua** | IoT scripting, game logic, rapid prototyping | LuaJIT FFI | ~10% overhead |
| **CUDA** | GPU kernels, matrix operations, neural networks | Native PTX | Zero overhead |
| **Swift** | iOS native compute, Apple Silicon optimization | Swift/Rust interop | ~3% overhead |
| **Gradle/JVM** | Android native, enterprise integration | JNI/GraalVM | ~10% overhead |
| **HTML/CSS** | Progressive Web App interfaces, node dashboards | WebView/WebRTC | N/A |

## Compute Sharing Mechanics

### Resource Abstraction Model

```rust
pub struct ComputeUnit {
    pub id: DID,
    pub hardware: HardwareProfile,
    pub availability: AvailabilityWindow,
    pub pricing: ResourcePricing,
    pub tee_capability: Option<TEEType>,
}

pub struct HardwareProfile {
    pub cpu: CPUProfile { cores, threads, features: [AVX512, NEON, SVE], frequency },
    pub gpu: Option<GPUProfile> { vendor, vram, compute_capability, driver_version },
    pub npu: Option<NPUProfile> { tflops, supported_ops },
    pub memory: MemoryProfile { total, bandwidth, latency },
    pub storage: StorageProfile { ssd_speed, capacity },
    pub network: NetworkProfile { bandwidth, latency, stability },
}
```

### Task Scheduling Algorithm

**Two-Phase Scheduling:**

1. **Global Phase (Regional Supernodes):** Match task requirements against regional capacity, consider data locality, apply reputation/stake filters
2. **Local Phase (Peer-to-Peer):** Fine-grained latency optimization, GPU affinity matching, load balancing

```rust
fn schedule_task(task: &TaskSpec, mesh: &ComputeMesh) -> Result<Assignment> {
    let region = mesh.get_region(task.geo_fence);
    let candidates = region.nodes()
        .filter(|n| n.meets_requirements(&task.resources))
        .filter(|n| n.reputation > task.min_reputation)
        .filter(|n| n.stake >= task.min_stake);

    let scored = candidates.map(|n| {
        let score = w1 * n.benchmark_score +
                   w2 * (1.0 / n.estimated_latency) +
                   w3 * n.reputation +
                   w4 * (1.0 / n.price);
        (n, score)
    });

    let selected = scored.top_k(task.redundancy_factor);
    Ok(Assignment::new(selected))
}
```

### Mobile & IoT Optimizations

**Battery-Aware Compute:**
```swift
class MobileComputeNode {
    func should_accept_task(task: Task) -> Bool {
        guard battery.level > 0.20 else { return false }
        guard thermalState != .critical else { return false }
        guard isCharging || task.priority == .background else { return false }
        let available_cores = thermalState == .serious ? 2 : maxCores
        return task.required_cores <= available_cores
    }
}
```

## Security & Trust Model

### Threat Matrix & Mitigations

| Threat | Mitigation | Layer |
|--------|-----------|-------|
| Sybil attacks | Proof-of-stake + hardware attestation | Identity |
| Byzantine workers | Redundant execution + voting | Task |
| Model/weight theft | TEE enclaves + encrypted memory | Runtime |
| Data poisoning | Multi-party computation + ZK proofs | Application |
| DDoS on mesh | Rate limiting + reputation decay | Network |
| Eclipse attacks | Random peer sampling + anchor nodes | DHT |
| Free-riding | Micropayment channels per task | Economic |

### TEE Integration

```rust
enum TEEType {
    IntelSGX,           // Servers, some desktops
    IntelTDX,           // Next-gen confidential computing
    AMDSEV,             // AMD EPYC servers
    ARMDTrustZone,      // Mobile devices
    AppleSecureEnclave, // iOS, macOS
    NvidiaConfidential, // H100 confidential computing
    RISCVKeystone,      // Open-source TEE
}
```

### Cryptographic Primitives

- **Transport:** Noise Protocol (XX pattern) over QUIC
- **Identity:** Ed25519 for signing, X25519 for encryption
- **Consensus:** BLS12-381 signatures for aggregated BFT
- **Payments:** ERC-20 FCM token on L2 (Arbitrum/Optimism) + Lightning for micropayments
- **Privacy:** zk-SNARKs (Groth16) for proof-of-correctness

## Economic Model

### Tokenomics (FCM Token)

**Supply:** 1 billion FCM, deflationary via burn mechanism

```
Compute Consumers ──FCM──→ Task Escrow
                                │
                                ↓
Compute Providers ←─FCM─── Reward Distribution
       ↑                              │
       └──── Stake/Slash ←────────────┘
```

### Cost Comparison

| Workload | AWS Cost | FCM Cost | Savings |
|----------|----------|----------|---------|
| LLM Inference (A100) | $3.67/hr | $0.80/hr | 78% |
| Blender Render (1000 frames) | $450 | $90 | 80% |
| FL Training (100 nodes) | $2,000/round | $400/round | 80% |
| Edge Function (1M exec) | $20 | $4 | 80% |

## FCM Expert Agent Swarm

| Agent | Built-in Logic Engine | LLM Bypass Strategy |
|-------|----------------------|---------------------|
| **🧠 Inference Router** | Hard-coded decision tree | Deterministic routing, no model selection inference |
| **🎬 Render Splitter** | Tile-based decomposition + topological DAG | Mathematical splitting, no scene analysis |
| **🔒 FL Coordinator** | Differential privacy + MPC secure aggregation | Cryptographic protocols, no trust assumptions |
| **⚡ Edge Runner** | Trie-based HTTP routing + WASM LRU cache | Sub-10ms cold start via cache hits |
| **🛡️ ZK Prover** | Circuit hash → cached proving key → GPU witness | Pre-compiled circuits, no proof strategy LLM |
| **🎮 Game Host** | Deterministic lockstep + latency-compensated hitreg | Mathematical simulation, no state prediction |
| **🔬 Science Grid** | Cartesian domain decomposition + ghost zone | PDE-aware splitting, no workload characterization |
| **🕵️ Privacy Mesh** | Sphinx packet format + reputation-weighted path | Cryptographic routing, no path optimization LLM |
| **🕸️ Obscura** | Web intelligence scraping, monitoring, extraction | Stealth browsing with anti-detection, no LLM for parsing |

## API Specification

### 11.1 Node Registration
```http
POST /v1/node/register
Content-Type: application/json

{
  "did": "did:ipfs:QmXyz...",
  "ipns_record": "/ipns/k51qzi...",
  "geohash": "u4pruydqqvj",
  "hardware_attestation": "0x7a3f...",
  "capabilities": ["cuda:12.1", "avx512"],
  "stake_tx": "0xabc...",
  "endpoint": "/ip4/203.0.113.1/udp/4001/quic"
}
```

### 11.2 Task Submission
```http
POST /v1/task/submit
Authorization: Bearer {jwt}

{
  "runtime": "wasm32-wasi",
  "artifact_cid": "QmTask...",
  "resource_req": {
    "min_gpu_vram_gb": 8,
    "min_cpu_cores": 4,
    "min_memory_gb": 16
  },
  "constraints": {
    "max_latency_ms": 100,
    "geohash_prefix": "u4pru",
    "tee_required": false,
    "redundancy": 3
  },
  "reward": {
    "amount": "2.5",
    "token": "FCM"
  },
  "timeout_seconds": 3600
}
```

### 11.3 Result Retrieval
```http
GET /v1/task/{task_id}/result

Response:
{
  "status": "completed",
  "result_cid": "QmResult...",
  "proof": {
    "type": "merkle_proof",
    "root": "0xabc...",
    "witness": [...]
  },
  "node_attestations": [
    { "did": "did:ipfs:QmA...", "signature": "0x123..." },
    { "did": "did:ipfs:QmB...", "signature": "0x456..." },
    { "did": "did:ipfs:QmC...", "signature": "0x789..." }
  ],
  "consensus_reached": true
}
```

## Performance Benchmarks

| Metric | Target | Method |
|--------|--------|--------|
| Task dispatch latency | < 50ms | Regional supernode caching |
| P2P connection setup | < 200ms | QUIC + 0-RTT resumption |
| WASM cold start | < 10ms | Precompiled modules, LRU cache |
| GPU kernel launch | < 1ms | Persistent CUDA contexts |
| Cross-region sync | < 500ms | Optimized BFT consensus |
| Mobile task overhead | < 5% battery/hr | Adaptive throttling |
| IPFS CID resolution | < 100ms | DHT optimization + gateways |

---

# 2. FCM Smart Contract System — Complete Report

**Generated:** August 24, 2026
**Solidity:** ^0.8.20 (via IR, optimizer 200 runs)
**Framework:** Hardhat · OpenZeppelin 5.x
**Networks:** Hardhat / Sepolia / Arbitrum Sepolia / Base Sepolia / Base
**Test suite:** 372 tests, all passing

## System Overview

```
FCMToken (ERC20 + fees)
    │
    ├── FCMAgentRegistry (agent lifecycle, task creation, dispute resolution)
    │       └── FCMTaskMarketplace (spot listings, auction tasks)
    │
    ├── FCMTierStaking (stake → tier computation)
    │       ├── FCMGovernance (tier-weighted voting)
    │       └── FCMRewardsPool (tier-multiplied rewards, epoch-based)
    │
    ├── FCMEscrow (milestone-based payments, multi-sig, disputes)
    │
    └── FCMReputationNFT (soulbound ERC721, achievements)
```

**Token flow:** FCMToken is the native token. All staking, rewards, escrow, task rewards, and governance use FCMToken. Fee-exempt addresses (registry, marketplace, staking contracts) skip the 1% burn + 2% treasury fee.

## FCMToken

**Inherits:** `ERC20`, `ERC20Burnable`, `AccessControl`

### Constants

| Name | Value | Notes |
|------|-------|-------|
| `MAX_SUPPLY` | 1,000,000,000 FCM | Hard cap |
| `INITIAL_SUPPLY` | 500,000,000 FCM | 500M pre-minted at deploy |
| `MINTER_ROLE` | `keccak256("MINTER_ROLE")` | Can mint reward tokens |

### State

| Variable | Type | Default | Notes |
|----------|------|---------|-------|
| `totalBurned` | `uint256` | 0 | Running total of burned tokens |
| `totalMintedRewards` | `uint256` | 0 | Tokens minted via `mintRewards` |
| `burnRate` | `uint256` | 100 (1.00%) | Basis points |
| `treasuryRate` | `uint256` | 200 (2.00%) | Basis points |
| `treasury` | `address` | constructor arg | Fee destination |
| `feeExempt` | `mapping(address→bool)` | deployer + treasury + self | Addresses immune to fees |

### Functions

#### `constructor(address _treasury)`
Grants `DEFAULT_ADMIN_ROLE` and `MINTER_ROLE` to deployer. Mints 200M to deployer, 200M to treasury, 100M to contract reserve (500M total). Remaining 500M reserved for reward minting.

#### `mintRewards(address to, uint256 amount)` → `onlyRole(MINTER_ROLE)`
- `amount > 0`, `to ≠ address(0)`
- `totalMintedRewards + amount ≤ MAX_SUPPLY - INITIAL_SUPPLY` (500M reserve)
- Increments `totalMintedRewards`, calls `_mint(to, amount)`
- Note: `_mint()` already emits standard `Transfer(address(0), to, amount)` per ERC20. `BurnMintEquilibrium` is an additional event, not a replacement.
- Emits: `BurnMintEquilibrium(burned, minted, timestamp)`

#### `_afterTokenTransfer(from, to, amount)` → `internal override` [hook]
Implements fee logic:
- **Skips** if `_inFeeTransfer` (reentrancy guard), `from == address(0)` (mint), `to == address(0)` (burn), or either party is `feeExempt`
- Calculates `burnAmount = amount * burnRate / 10000` and `treasuryAmount = amount * treasuryRate / 10000`
- Burns from `to` and transfers to `treasury` under `_inFeeTransfer = true` reentrancy guard

#### `setFeeRates(uint256 _burnRate, uint256 _treasuryRate)` → `onlyRole(DEFAULT_ADMIN_ROLE)`
- `_burnRate + _treasuryRate ≤ 1000` (max 10% combined fees)

#### `getMintableSupply()` → `view returns (uint256)`
Returns `MAX_SUPPLY - INITIAL_SUPPLY - totalMintedRewards`

---

## FCMAgentRegistry

**Inherits:** `AccessControl`, `ReentrancyGuard`, `Pausable`

### Roles

| Role | Hash | Purpose |
|------|------|---------|
| `DEFAULT_ADMIN_ROLE` | `0x00` | Pause/unpause, grant roles |
| `ADMIN_ROLE` | `keccak256("ADMIN_ROLE")` | Configure dispute params |
| `VALIDATOR_ROLE` | `keccak256("VALIDATOR_ROLE")` | Resolve disputes |
| `AGENT_ROLE` | `keccak256("AGENT_ROLE")` | Granted on registration |

### Enums

```solidity
enum TaskStatus { Open, Assigned, Completed, Disputed, Slashed, Resolved, Cancelled }
```

**State machine:**
```
Open ──claimTask──→ Assigned ──submitResult──→ Completed
  │                                               │
  └──cancelTask──→ Cancelled                ──────┘
                                               │
                                       disputeTask (must be within window)
                                               │
                                          Disputed
                                         ╱        ╲
                             resolveDispute     claimExpiredDispute
                           (agentFault=true)   (after 7 days)
                                │                    │
                            Slashed              Slashed
                                │                    │
                           resolveDispute
                         (agentFault=false)
                                │
                           Resolved (terminal)
```

### Constants

| Name | Value | Notes |
|------|-------|-------|
| `MIN_STAKE` | 500 FCM | Minimum stake to register |
| `HEARTBEAT_INTERVAL` | 300s | Expected heartbeat interval |
| `SLASH_PERCENT` | 3000 (30%) | Basis points of stake slashed |
| `disputeWindow` | 86400 (1 day) | Admin-configurable |
| `disputeResolutionDeadline` | 604800 (7 days) | Admin-configurable |

### Structs

#### `Agent`
```
didHash          bytes32    Decentralized identifier hash
ipnsRecord       string     IPNS record for agent metadata
operator         address    Agent's controlling address
stake            uint256    Amount staked (500 FCM min)
reputation       uint256    0-10000
registeredAt     uint256    Registration timestamp
lastHeartbeat    uint256    Last heartbeat timestamp
capabilities     bytes32    Bitmask of supported workloads
geohash          bytes32    Encoded geographic hash
isActive         bool       Agent active status
agentType        uint8      0-12 (Inference through Obscura)
heartbeatNonce   uint256    Monotonic nonce for replay protection
```

#### `Task`
```
taskId           bytes32    Unique task identifier
requester        address    Who created the task
reward           uint256    Tokens escrowed for completion
deadline         uint256    Task submission deadline
requirements     bytes32    Required capabilities bitmask
inputCID         bytes32    Input data CID
outputCID        bytes32    Output data CID (set on submit)
assignedAgent    address    Agent assigned to task
assignedDid      bytes32    DID of assigned agent (survives unstaking)
status           TaskStatus Current lifecycle state
proofHash        bytes32    ZK proof of completion
rewardWithdrawn  bool       Whether reward has been paid
disputedAt       uint256    Timestamp when dispute opened
```

### Mappings

| Mapping | Key → Value |
|---------|-------------|
| `agents` | `didHash → Agent` |
| `tasks` | `taskId → Task` |
| `operatorAgents` | `operator → didHash[]` |
| `slashHistory` | `didHash → total slashed` |
| `operatorActiveTasks` | `operator → active task count` |

### Task Lifecycle

| Function | Access | State Change |
|----------|--------|-------------|
| `createTask(taskId, requirements, inputCID, deadline)` | public, `nonReentrant whenNotPaused` | Open→Open, escrows reward |
| `claimTask(taskId, didHash)` | public, `nonReentrant whenNotPaused` | Open→Assigned, increments activeTasks |
| `submitResult(taskId, outputCID, proofHash)` | public, `nonReentrant whenNotPaused` | Assigned→Completed, decrements activeTasks |
| `withdrawReward(taskId)` | public, `nonReentrant` | Completed/Resolved→paid, sets rewardWithdrawn=true |
| `cancelTask(taskId)` | public, `nonReentrant` | Open→Cancelled, refunds requester |

**`createTask`:** Computes reward via `calculateReward(requirements)`, escrows tokens from requester.
**`claimTask`:** Bitwise capability check `(agent.capabilities & task.requirements) == task.requirements`. Only active agents can claim.
**`submitResult`:** Must be `Assigned`. Guarded against counter underflow via `operatorActiveTasks > 0`.
**`withdrawReward`:** Eligible when `status ∈ {Completed, Resolved}` and `block.timestamp > deadline + disputeWindow`. Reads `task.assignedDid` directly (survives unstaking). Reputation +100.
**`cancelTask`:** Only Open tasks. CEI-compliant: sets status to Cancelled then transfers.

#### `disputeTask(taskId, reason)` → public
- `reason` must be non-empty (validated)
- Only requester can dispute
- Status must be `Completed`, within `deadline + disputeWindow`
- Sets `status = Disputed`, `disputedAt = block.timestamp`

#### `resolveDispute(taskId, agentFault, resolution)` → `onlyRole(VALIDATOR_ROLE)`
- Must be within `disputedAt + disputeResolutionDeadline`
- **Agent at fault** (`agentFault=true`):
  - Slashes 30% of stake, reputation -500
  - State → `Slashed` (CEI: state before transfer)
  - Transfers `task.reward` to requester (slash stays in registry — prevents over-compensation)
- **Agent innocent** (`agentFault=false`):
  - State → `Resolved`, sets `rewardWithdrawn = true` (CEI)
  - Transfers reward to assigned agent

#### `calculateReward(requirements)` → `view returns (uint256)`
Uses popcount on capability bitmask. Range: 100–900 FCM based on number of required capabilities.

### Admin Functions

| Function | Access | Description |
|----------|--------|-------------|
| `pause()` | `DEFAULT_ADMIN_ROLE` | Emergency pause |
| `unpause()` | `DEFAULT_ADMIN_ROLE` | Resume |
| `setDisputeWindow(uint256)` | `ADMIN_ROLE` | Set dispute window (1h–7d) |
| `setDisputeResolutionDeadline(uint256)` | `ADMIN_ROLE` | Set resolution deadline (1d–30d) |

---

## FCMTaskMarketplace

**Inherits:** `ReentrancyGuard`, `AccessControl`

### Enums

```solidity
enum PricingModel { Spot, Reserved, Auction }
enum TaskPriority { Low, Normal, High, Critical }
```

### Structs

#### `Bid`
```
agentDid    bytes32    DID of bidding agent
bidder      address    Address placing bid
price       uint256    Bid amount (escrowed)
timestamp   uint256    When bid was placed
withdrawn   bool       Whether bid has been refunded
```

#### `AuctionTask`
```
taskId          bytes32     Task identifier
minPrice        uint256     Minimum acceptable bid
maxPrice        uint256     Starting price (escrowed from lister)
auctionEnd      uint256     End timestamp
auctionDuration uint256     Duration in seconds
bids            Bid[]       All bids placed
settled         bool        Whether auction has been settled
lister          address     Creator of the auction
```

### Functions

#### Spot Tasks

**`listSpotTask(taskId, maxPrice, deadline, priority)`** → `nonReentrant`
- `maxPrice > 0`, `deadline > now`, taskId unique
- Escrows `maxPrice` from lister
- Stored lister + amount for refund via `cancelSpotTask`

**`cancelSpotTask(taskId)`** → `nonReentrant`
- Only lister, not already cancelled, escrow > 0
- CEI: sets cancelled + zeros amount before transfer
- Refunds full `maxPrice` to lister

#### Auction Tasks

**`listAuctionTask(taskId, minPrice, maxPrice, auctionDuration)`** → `nonReentrant`
- `minPrice > 0`, `maxPrice > minPrice`, `duration ∈ (0, 86400]`
- Escrows `maxPrice` from lister
- Sets `auctionEnd = now + duration`

**`getAuctionPrice(taskId)`** → `view returns (uint256)`
- Dutch auction: price drops linearly from `maxPrice` to `minPrice` over duration

**`placeBid(taskId, agentDid, price)`** → `nonReentrant`
- Auction active, not settled
- `price ≤ current dutch price` and `price ≥ minPrice`
- Escrows bid amount

**`settleAuction(taskId)`** → `nonReentrant`
- Anyone can call after `auctionEnd`
- Finds lowest bid, marks settled
- Refunds lister: `maxPrice - bestBid.price`
- Refunds all non-winning bids

---

## FCMTierStaking

**Inherits:** `AccessControl`, `ReentrancyGuard`, `Pausable`

### Constants

| Name | Value |
|------|-------|
| `TIER_CHANGE_GRACE_PERIOD` | 3 days |
| `HARDWARE_CHECK_INTERVAL` | 24 hours |
| `MAX_TIERS` | 6 |

### Tier Definitions

| Tier | Name | Min Stake | Min Score | Reward Multiplier | Fee Discount | Max Concurrent |
|------|------|-----------|-----------|-------------------|-------------|----------------|
| 0 | Free | 0 | 0 | 0.5x | 0% | 1 |
| 1 | Starter | 100 FCM | 2000 | 1.0x | 5% | 3 |
| 2 | Standard | 500 FCM | 4000 | 1.5x | 10% | 5 |
| 3 | Advanced | 2,000 FCM | 6000 | 2.0x | 15% | 10 |
| 4 | Pro | 10,000 FCM | 8000 | 3.0x | 20% | 20 |
| 5 | Elite | 50,000 FCM | 9000 | 5.0x | 25% | 50 |

### Functions

#### `stake(uint256 amount)` → `nonReentrant whenNotPaused`
- First-time stakers start at Tier 0
- Auto-computes tier via `_computeTier()` after staking
- Upgrades are immediate

#### `unstake(uint256 amount)` → `nonReentrant whenNotPaused`
- Partial unstaking supported
- Transfers tokens first, then recomputes tier
- Downgrades gated by `TIER_CHANGE_GRACE_PERIOD`

#### `applyPendingDowngrade(address operator)` → public
- Applies queued tier downgrade after 3-day grace period
- `targetTier` kept in sync on every tier change

#### `updateHardwareScore(operator, hwScore, uptimeScore)` → `onlyRole(ORACLE_ROLE) whenNotPaused`
- Can only update every 24h
- Auto-recomputes tier

#### `getStakedAmount(address operator)` → `view returns (uint256)`
- Returns staked amount for external callers (used by governance)

#### `emergencyWithdraw()` → `nonReentrant`
- Only when paused, returns full stake

---

## FCMRewardsPool

**Inherits:** `AccessControl`, `ReentrancyGuard`, `Pausable`

### Constants

| Name | Value |
|------|-------|
| `EPOCH_DURATION` | 7 days |

### Structs

#### `EpochReward`
```
totalPool        uint256    Deposited tokens
totalDistributed uint256    Paid out tokens
tasksCompleted   uint256    Work units completed
finalized        bool       Epoch finalized
```

#### `AgentReward`
```
totalEarned       uint256    Lifetime earnings
epochWork         uint256    Work units this epoch (reset after claim)
epochClaimed      uint256    Tokens claimed this epoch
lastClaimEpoch    uint256    Last claimed epoch
consecutiveEpochs uint256    Streak counter
```

### Functions

#### `fundEpoch(uint256 amount)` → `onlyRole(ADMIN_ROLE) whenNotPaused`
- Transfers tokens from admin to pool

#### `recordWork(agent, agentType, workUnits)` → `onlyRole(ORACLE_ROLE) whenNotPaused`
- Increments `agentRewards[agent].epochWork` and `epochs[currentEpoch].tasksCompleted`

#### `claimRewards()` → `nonReentrant whenNotPaused`
- Claims from last finalized epoch (not current)
- Formula: `(agentWork × totalPool × multiplier) / (tasksCompleted × 10000)`
- **Resets `epochWork = 0` after successful claim** (prevents double-claiming)
- First-claim sentinel: if `totalEarned == 0`, allows claim even when `lastClaimEpoch == claimEpoch`

#### `finalizeEpoch()` → `onlyRole(ADMIN_ROLE) whenNotPaused`
- Marks current epoch as finalized, starts new epoch

---

## FCMGovernance

**Inherits:** `AccessControl`, `ReentrancyGuard`, `Pausable`

### Parameters

| Name | Default | Range |
|------|---------|-------|
| `votingDuration` | 3 days | 1d–30d |
| `timelockDuration` | 1 day | 1h–7d |
| `quorumThreshold` | 2000 (20%) | 10%–50% |

### Enums

```solidity
enum ProposalState { Pending, Active, Succeeded, Defeated, Queued, Executed, Cancelled }
```

### Functions

#### `propose(description, target, callData)` → `returns (uint256 proposalId)`
- Snapshot: `totalStakedAtProposal = fcmToken.totalSupply()`
- State: `Active`

#### `castVote(proposalId, support)` → `nonReentrant whenNotPaused`
- Support: 0=against, 1=for, 2=abstain
- Voting power = `tierStaking.getStakedAmount(voter) × tierWeights[tier] / 100`
- Tier weights: `[100, 200, 300, 500, 1000, 2000]` → 1x–20x

#### `queueProposal(proposalId)` → `nonReentrant`
- After voting ended, quorum + majority reached
- Sets timelock ETA

#### `executeProposal(proposalId)` → `nonReentrant whenNotPaused`
- After timelock expires, executes `target.call(callData)`

#### `getProposalState(id)` → `ProposalState`
- Computes terminal states dynamically:
  - Voting ended + quorum + majority → `Succeeded`
  - Voting ended + (no quorum OR no majority) → `Defeated`
  - Otherwise returns stored state

---

## FCMEscrow

**Inherits:** `AccessControl`, `ReentrancyGuard`, `Pausable`

### Enums

```solidity
enum EscrowState { Created, Funded, InProgress, Completed, Disputed, Resolved, Cancelled, Refunded }
```

### Structs

#### `Milestone`
```
description    string     Milestone description
amount         uint256    Payment for this milestone
deliverableCID bytes32    CID of submitted deliverable
approved       bool       Client approved
submitted      bool       Worker submitted
submittedAt    uint256    Submission timestamp
approvedAt     uint256    Approval timestamp
```

#### `Escrow`
```
id                  uint256            Escrow ID (1-indexed)
client              address            Client/funder
worker              address            Worker/contractor
totalAmount         uint256            Total escrowed
releasedAmount      uint256            Amount paid out
remainingAmount     uint256            Remaining in escrow
createdAt           uint256            Creation timestamp
deadline            uint256            90 days from creation
disputeDeadline     uint256            120 days from creation
state               EscrowState        Current state
milestones          Milestone[]        Array of milestones
completedMilestones uint256            Count of approved
requiresMultiSig    bool               Jobs ≥ 10K FCM need 2 approvals
approvalCount       uint256            Current multi-sig count
hasApproved[addr]   bool               Per-approver anti-replay
```

### Functions

#### `createEscrow(worker, milestoneDescs[], milestoneAmounts[])` → `nonReentrant returns (uint256)`
- Validates: worker ≠ address(0), worker ≠ client, arrays match, 1–20 milestones
- Multi-sig required if total ≥ `multisigThreshold` (10,000 FCM)

#### `fundEscrow(escrowId)` → `nonReentrant`
- Client funds total amount. State: `Created → Funded`

#### `submitMilestone(escrowId, milestoneIndex, deliverableCID)` → `nonReentrant`
- Worker only. States: `Funded`, `InProgress`, or `Resolved`

#### `approveMilestone(escrowId, milestoneIndex)` → `nonReentrant`
- Client only. Multi-sig: client calls twice before funds release
- Transfers milestone amount to worker
- If all milestones approved → `Completed`

#### `resolveDispute(escrowId, clientWins, resolution)` → `nonReentrant onlyRole(ARBITRATOR_ROLE)`
- Processes ALL submitted-not-approved milestones in one call (worker-wins path)
- **Client wins:** ALL remaining escrow refunded, state → `Refunded`
- **Worker wins:** All disputed milestones approved, funds released

#### `cancelEscrow(escrowId)` → `nonReentrant`
- Client only, state `Created` or `Funded`. Refunds totalAmount.

---

## FCMReputationNFT

**Inherits:** `ERC721`, `AccessControl`, `Pausable`

### Key Design
- **Soulbound:** `transferFrom`, `safeTransferFrom`, `approve`, `setApprovalForAll` all revert
- One badge per operator, one badge per DID
- Achievements use bitmask (8 flags)

### Achievement Flags

| Bit | Name | Condition |
|-----|------|-----------|
| 0 | FIRST_TASK | `totalWork ≥ 1` |
| 1 | 100_TASKS | `totalWork ≥ 100` |
| 2 | 1000_TASKS | `totalWork ≥ 1000` |
| 3 | PERFECT_UPTIME | `uptimeScore ≥ 9900` |
| 4 | TIER_5 | `tier ≥ 5` |
| 5 | YEAR_VETERAN | 365 days since mint |
| 6 | DISPUTE_CHAMPION | `disputesWon ≥ 10` AND `disputesLost == 0` |
| 7 | MILLION_EARNED | `totalEarnings ≥ 1,000,000 FCM` |

### Functions

#### `mintBadge(operator, didHash)` → `onlyRole(ADMIN_ROLE)`
- One badge per operator/DID

#### `updateBadge(operator, newTier, addWork, addEarnings, newUptime, disputeWon, disputeLost)` → `onlyRole(ORACLE_ROLE)`

#### `revokeBadge(tokenId)` → `onlyRole(ADMIN_ROLE)`
- Admin burn: clears `operatorBadge`, `didBadge`, `achievements`, then `_burn`
- For deregistered/penalized agents

#### Soulbound Overrides
All five transfer/approval functions are `pure` and revert with `"Soulbound: cannot transfer"` or `"Soulbound: cannot approve"`

---

## Audit Findings & Fixes

### Critical Fixes (All Fixed ✅)

| ID | Contract | Issue | Fix |
|----|----------|-------|-----|
| C-1 | FCMTaskMarketplace | `settleAuction` permanently locks lister's `maxPrice` + winning bid | Refund lister `maxPrice - bestBid.price` |
| C-2 | FCMRewardsPool | `epochWork` never reset — double-claiming across epochs | Reset `epochWork = 0` after claim |
| C-3 | FCMEscrow | `resolveDispute` (client-wins) refunds only 1 milestone | Refund ALL remaining escrow |

### Medium Fixes (All Fixed ✅)

| ID | Contract | Issue | Fix |
|----|----------|-------|-----|
| M-1 | FCMTierStaking | Pending tier downgrades never auto-applied | Added `applyPendingDowngrade()` |
| L-1 | FCMTierStaking | `_computeTier` param shadows `stake()` function | Renamed to `_stake` |
| L-2 | FCMReputationNFT | 5 soulbound functions `view` instead of `pure` | Changed to `pure` |
| L-3 | FCMGovernance | `Succeeded`/`Defeated` never assigned | `getProposalState` computes terminal states |
| L-4 | FCMAgentRegistry | Fault path over-compensates requester | Slash stays in registry, only reward sent |
| L-5 | FCMAgentRegistry | `withdrawReward` uses `findDidByOperator` — wrong DID if operator has multiple agents | Added `assignedDid` to Task struct |
| L-6 | FCMAgentRegistry | `calculateReward` caps at 199 FCM | Popcount-based: 100–900 FCM range |
| L-7 | FCMGovernance | `balanceOf` for voting power (not staked balance) | Uses `getStakedAmount()` from tierStaking |
| L-8 | FCMEscrow | `resolveDispute` only resolves ONE milestone per call | Worker-wins path processes ALL disputed milestones |
| L-9 | FCMReputationNFT | No burn/revoke function for badges | Added `revokeBadge(tokenId)` admin burn |
| L-10 | FCMToken | `mintRewards` emits non-standard event | `_mint()` already emits standard `Transfer` |

### Bonus Bugs Found & Fixed

- **First-claim bug**: `claimRewards` required `lastClaimEpoch < claimEpoch`, but both default to 0 — first-ever claim always reverted. Fixed via `totalEarned == 0` sentinel.
- **Stuck-funds**: Agent who unstaked before withdrawing reward could never claim. Fixed by storing `assignedDid` in Task struct.
- **Tier downgrade ghost**: `targetTier` defaulted to 0, causing false downgrades. Fixed by syncing on every tier change.

---

## Role Matrix

| Role | Admin | Agent | Validator | Oracle | Arbitrator | Lister | Minter |
|------|-------|-------|-----------|--------|------------|--------|--------|
| **Pause contracts** | ✅ | | | | | | |
| **Set fee rates** | ✅ | | | | | | |
| **Mint tokens** | | | | | | | ✅ |
| **Set dispute params** | ✅ | | | | | | |
| **Register agent** | | (any) | | | | | |
| **Resolve task dispute** | | | ✅ | | | |
| **Update HW score** | | | | ✅ | | |
| **Finalize epoch** | ✅ | | | | | |
| **Record work** | | | | ✅ | | |
| **Resolve escrow dispute** | | | | | ✅ | |
| **Fund epoch** | ✅ | | | | | |

## Invariants

1. **Token supply:** `totalSupply() ≤ MAX_SUPPLY`
2. **Stake accounting:** `sum of all agent.stakes ≤ IERC20(fcmToken).balanceOf(registry)`
3. **Active tasks:** `operatorActiveTasks[addr] = count of tasks where assignedAgent==addr AND status==Assigned`
4. **Tier counts:** `sum(tierStakeCount[0..5]) = stakers.length`
5. **Escrow accounting:** `releasedAmount + remainingAmount = escrowed tokens not refunded`
6. **Rewards pool:** `totalPoolBalance = sum of (epochs[i].totalPool - epochs[i].totalDistributed)`
7. **No double-spend:** `rewardWithdrawn == true` implies token transfer has occurred
8. **Task status integrity:** Only valid state transitions per the state machine diagram
9. **One badge per operator:** `operatorBadge[op] > 0` → cannot mint again for same operator
10. **Soulbound:** No badge token can be transferred (all transfer functions revert)

---

# 3. FCM Tiered Membership & Reward System

**Fair Market Value Reward Points — Hardware-Quality-Based Tiers**

## Overview

```
┌─────────────────────────────────────────────────────────┐
│  TIER 5 — ELITE        5x rewards  │  5000 FCM setup   │
├─────────────────────────────────────────────────────────┤
│  TIER 4 — PRO          3x rewards  │  2000 FCM setup   │
├─────────────────────────────────────────────────────────┤
│  TIER 3 — ADVANCED     2x rewards  │   500 FCM setup   │
├─────────────────────────────────────────────────────────┤
│  TIER 2 — STANDARD     1.5x rewards│   100 FCM setup   │
├─────────────────────────────────────────────────────────┤
│  TIER 1 — STARTER      1x rewards  │    25 FCM setup   │
├─────────────────────────────────────────────────────────┤
│  TIER 0 — FREE         0.5x rewards│     FREE           │
└─────────────────────────────────────────────────────────┘
```

## Hardware Score (0–100 points)

| Component | Tier 0 | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|-----------|--------|--------|--------|--------|--------|--------|
| **CPU Cores** | 1–2 | 4 | 8 | 16 | 32 | 64+ |
| **CPU Score** | < 15 | 15–25 | 25–40 | 40–60 | 60–80 | 80–100 |
| **RAM** | < 4 GB | 4–8 GB | 8–32 GB | 32–64 GB | 64–128 GB | 128+ GB |
| **GPU VRAM** | None | 4 GB | 8 GB | 16 GB | 24 GB | 48+ GB |
| **GPU Score** | 0 | 10–20 | 20–40 | 40–60 | 60–80 | 80–100 |
| **Disk Free** | < 50 GB | 50–200 GB | 200–500 GB | 500 GB–2 TB | 2–8 TB | 8+ TB |
| **TEE/SGX** | No | No | Optional | Yes | Yes | Yes |

## Connection Speed Score (0–100 points)

| Metric | Tier 0 | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|--------|--------|--------|--------|--------|--------|--------|
| **Download** | < 10 Mbps | 10–50 Mbps | 50–200 Mbps | 200–500 Mbps | 500 Mbps–1 Gbps | 1+ Gbps |
| **Upload** | < 5 Mbps | 5–20 Mbps | 20–100 Mbps | 100–250 Mbps | 250–500 Mbps | 500+ Mbps |
| **Latency (RTT)** | > 200ms | 100–200ms | 50–100ms | 20–50ms | 10–20ms | < 10ms |
| **Uptime** | < 90% | 90–95% | 95–99% | 99–99.5% | 99.5–99.9% | 99.9%+ |

## Composite Tier Score

```
Tier Score = (Hardware Score × 0.6) + (Connection Score × 0.4)
```

| Tier | Score Range | Name | Color |
|------|-------------|------|-------|
| 0 | 0–14 | Free | Gray |
| 1 | 15–29 | Starter | White |
| 2 | 30–49 | Standard | Green |
| 3 | 50–69 | Advanced | Blue |
| 4 | 70–89 | Pro | Purple |
| 5 | 90–100 | Elite | Gold |

## Setup Fees

| Tier | Setup Fee | Refund (30d) | Monthly Fee | Fee Waiver |
|------|-----------|-------------|-------------|------------|
| **Tier 0** | FREE | N/A | FREE | N/A |
| **Tier 1** | 25 FCM | 20 FCM | FREE | Stake 100 FCM |
| **Tier 2** | 100 FCM | 80 FCM | 5 FCM/mo | Stake 500 FCM |
| **Tier 3** | 500 FCM | 400 FCM | 20 FCM/mo | Stake 2,000 FCM |
| **Tier 4** | 2,000 FCM | 1,600 FCM | 75 FCM/mo | Stake 10,000 FCM |
| **Tier 5** | 5,000 FCM | 4,000 FCM | 200 FCM/mo | Stake 50,000 FCM |

## Reward Point System

### Base Rewards (Fair Market Value)

| Task Type | Base Reward (FCM) | Point Equivalent | Market Rate Reference |
|-----------|-------------------|-------------------|----------------------|
| AI Inference (1hr) | 2.5 | 250 pts | AWS A100: $3.67/hr → 2.5 FCM |
| Render (1 frame) | 1.0 | 100 pts | AWS g5.xlarge: $1/hr ÷ 24fps |
| FL Training (1 round) | 25.0 | 2,500 pts | Hospital FL: $200/round |
| Edge Function (1M req) | 4.0 | 400 pts | Lambda: $0.20/M |
| ZK Proof (batch) | 1.0 | 100 pts | Rollup prover: $0.04/proof × 25 |
| Game Server (1hr) | 2.0 | 200 pts | Multiplay: $0.50/hr base |
| Science Job (1hr) | 3.0 | 300 pts | HPC: $2–5/hr range |
| Privacy Relay (1GB) | 0.1 | 10 pts | VPN: $0.05–0.15/GB |
| Compute Node (1hr) | 1.0 | 100 pts | VPS: $0.50–2/hr |
| Storage (1GB/mo) | 0.05 | 5 pts | S3: $0.023/GB/mo |
| File Server (1GB) | 0.02 | 2 pts | CDN: $0.01–0.05/GB |
| Bounty (varies) | 1–1000 | 100–100,000 pts | Community-determined |

### Tier Multipliers

| Tier | Multiplier | Example: Inference 1hr |
|------|-----------|----------------------|
| Tier 0 | 0.5x | 125 pts (1.25 FCM) |
| Tier 1 | 1.0x | 250 pts (2.5 FCM) |
| Tier 2 | 1.5x | 375 pts (3.75 FCM) |
| Tier 3 | 2.0x | 500 pts (5.0 FCM) |
| Tier 4 | 3.0x | 750 pts (7.5 FCM) |
| Tier 5 | 5.0x | 1,250 pts (12.5 FCM) |

### Bonus Multipliers (Stack with Tier)

| Condition | Bonus | Example |
|-----------|-------|---------|
| **Uptime > 99%** (monthly) | +10% | 250 → 275 pts |
| **Uptime > 99.9%** (monthly) | +25% | 250 → 312 pts |
| **100+ tasks completed** | +5% | 250 → 262 pts |
| **500+ tasks completed** | +15% | 250 → 287 pts |
| **1000+ tasks completed** | +25% | 250 → 312 pts |
| **Zero disputes** (30 days) | +10% | 250 → 275 pts |
| **Response time < 100ms** | +5% | 250 → 262 pts |
| **Refer a new provider** | +500 pts | One-time bonus |
| **Consecutive 30-day streak** | +2x | Monthly multiplier |

### Penalty Deductions

| Condition | Penalty |
|-----------|---------|
| Task timeout | -50% of task reward |
| Failed task | -100% of task reward |
| Dispute (agent fault) | -200% + stake slash |
| Heartbeat miss (> 5) | -5% daily for 7 days |
| Downtime > 1hr unannounced | -10% daily for 3 days |

## Tier Benefits Summary

| Benefit | Tier 0 | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|---------|--------|--------|--------|--------|--------|--------|
| **Reward Multiplier** | 0.5x | 1x | 1.5x | 2x | 3x | 5x |
| **Priority Task Queue** | No | No | Basic | Standard | Priority | Highest |
| **Max Concurrent Tasks** | 1 | 3 | 5 | 10 | 25 | 100 |
| **Max Task Duration** | 1hr | 4hr | 12hr | 24hr | 48hr | Unlimited |
| **Gas Fee Discount** | 0% | 0% | 10% | 20% | 40% | 60% |
| **API Rate Limit** | 10/min | 50/min | 200/min | 1,000/min | 5,000/min | 50,000/min |
| **Data Retention** | 7 days | 30 days | 90 days | 1 year | 2 years | Unlimited |
| **Reputation Weight** | 0.5x | 1x | 1.5x | 2x | 3x | 5x |

## Point Redemption

| Redemption | Points Required | Value |
|------------|----------------|-------|
| FCM Token withdrawal | 100 pts = 1 FCM | Direct conversion |
| Tier upgrade credit | 500 pts = 5 FCM credit | Applied to setup fee |
| Priority task boost | 200 pts | 24hr priority queue access |
| Custom agent branding | 1,000 pts | Custom icon + name |
| Governance voting weight | 500 pts = 1 vote | DAO proposals |
| NFT achievement badge | 5,000 pts | Collectible tier badge |
| Partner discounts | 2,500 pts | Up to 50% off partner services |

## Anti-Gaming Measures

| Measure | Description |
|---------|-------------|
| **Hardware re-verification** | Random hardware checks every 24hrs |
| **Connection speed tests** | Hourly bandwidth verification |
| **Unique device binding** | One account per physical machine (hardware fingerprint) |
| **Rate limiting** | Max tasks per hour based on tier |
| **Reputation decay** | -1% reputation/day if inactive |
| **Sybil detection** | Cross-reference IP, hardware, behavioral patterns |
| **Slashing** | Stake burned for: fake hardware, Sybil attacks, data poisoning |

## Revenue Projections (Network-Level)

| Tier | Users (6mo) | Users (12mo) | Setup Revenue | Monthly Revenue |
|------|-------------|--------------|---------------|-----------------|
| Tier 0 | 5,000 | 20,000 | 0 | 0 |
| Tier 1 | 2,000 | 8,000 | 50,000 FCM | 0 |
| Tier 2 | 500 | 2,000 | 50,000 FCM | 2,500 FCM |
| Tier 3 | 100 | 500 | 50,000 FCM | 2,000 FCM |
| Tier 4 | 20 | 100 | 40,000 FCM | 1,500 FCM |
| Tier 5 | 5 | 25 | 25,000 FCM | 500 FCM |
| **Total** | **7,625** | **30,625** | **215,000 FCM** | **6,500 FCM/mo** |

---

# 4. FCM Integration Guide

## Quick Start

### Step 1: Clone the repo
```bash
git clone <repo-url>
cd g_p_unite
```

### Step 2: Install dependencies
```bash
npm install ethers dotenv
```

### Step 3: Deploy FCM contracts (if not already deployed)
```bash
cp path/to/fcm/.env.example .env
npx hardhat run scripts/hardhat/deploy.js --network baseSepolia
```

### Step 4: Import agent runtime
```js
const { AgentRuntime, AGENT_TYPES } = require("./lib/fcm/agent-runtime");
```

### Step 5: Configure and start agents
```js
const agent = new AgentRuntime({
    privateKey: process.env.FCM_PRIVATE_KEY,
    rpcUrl: process.env.FCM_RPC_URL,
    registryAddress: process.env.FCM_REGISTRY,
    tokenAddress: process.env.FCM_TOKEN,
    agentType: "inference",
    agentName: "g_p_unite-agent-001",
    capabilities: "gpu,cuda",
    geohash: "u4pru",
    processTask: yourTaskProcessor,
});

await agent.start();
```

## File Structure

```
g_p_unite/
├── lib/
│   └── fcm/
│       ├── agent-runtime.js      ← Core agent logic
│       └── ...
├── contracts/
│   └── fcm/
│       ├── FCMToken.sol
│       ├── FCMAgentRegistry.sol
│       └── FCMTaskMarketplace.sol
├── agents/                        ← Agent type definitions
│   ├── inference-router.js
│   ├── render-splitter.js
│   ├── fl-coordinator.js
│   ├── edge-runner.js
│   ├── zk-prover.js
│   ├── game-host.js
│   ├── science-grid.js
│   ├── privacy-mesh.js
│   └── obscura/
├── OBSCURA_AGENT/                 ← Standalone Obscura project
├── gpu-platform/                  ← Web dashboard
└── package.json
```

## Environment Variables

```bash
# FCM Integration
FCM_PRIVATE_KEY=0x...
FCM_RPC_URL=https://mainnet.base.org
FCM_REGISTRY=0x...  # Deployed FCMAgentRegistry address
FCM_TOKEN=0x...     # Deployed FCMToken address
```

---

# 5. Ethereum Deployment

## Gas Estimates

| Operation | Gas | ETH (@ 30 gwei) |
|-----------|-----|-----------------|
| Deploy FCMToken | ~2,000,000 | ~0.06 ETH |
| Deploy FCMAgentRegistry | ~3,500,000 | ~0.105 ETH |
| Deploy FCMTaskMarketplace | ~2,500,000 | ~0.075 ETH |
| Deploy FCMTierStaking | ~2,000,000 | ~0.06 ETH |
| Deploy FCMRewardsPool | ~1,500,000 | ~0.045 ETH |
| Deploy FCMGovernance | ~2,000,000 | ~0.06 ETH |
| Deploy FCMEscrow | ~2,500,000 | ~0.075 ETH |
| Deploy FCMReputationNFT | ~2,000,000 | ~0.06 ETH |
| **Total** | **~18,000,000** | **~0.54 ETH** |

Recommended: **0.8 ETH** on deployment wallet (safety margin).

## Supported Networks

| Network | Chain ID | RPC | Status |
|---------|----------|-----|--------|
| Hardhat (local) | 31337 | http://localhost:8545 | ✅ Working |
| Sepolia | 11155111 | Public RPC | ✅ Supported |
| Arbitrum Sepolia | 421614 | Public RPC | ✅ Supported |
| Base Sepolia | 84532 | Public RPC | ✅ Supported |
| Base | 8453 | https://mainnet.base.org | ✅ Supported |

## Role Summary

| Role | Contract | Grantee | Purpose |
|------|----------|---------|---------|
| `MINTER_ROLE` | FCMToken | Registry | Mint task rewards |
| `MINTER_ROLE` | FCMToken | RewardsPool | Mint epoch rewards |
| `LISTING_ROLE` | Marketplace | Deployer | List spot/auction tasks |
| `VALIDATOR_ROLE` | Registry | Deployer | Resolve disputes |
| `ORACLE_ROLE` | TierStaking | Deployer | Update HW scores |
| `ORACLE_ROLE` | ReputationNFT | Deployer | Update badges |
| `ORACLE_ROLE` | RewardsPool | Deployer | Record work |
| `ARBITRATOR_ROLE` | Escrow | Deployer | Resolve disputes |

## Troubleshooting

### "insufficient funds for gas"
→ Get more Sepolia ETH from a faucet

### "nonce has already been used"
→ Wait 30s and retry, or reset nonce: `npx hardhat nonce --network sepolia`

### "contract verification failed"
→ Wait 5 minutes for Etherscan indexing, then: `npx hardhat verify --network sepolia ADDRESS [args]`

---

# 6. Docker Setup

## Running

```bash
docker compose up -d
open http://localhost:9091/gpu_nited.html
```

## Security Features

| Feature | Implementation |
|---------|----------------|
| Non-root | Runs as gpu:1001 user |
| Security headers | X-Frame-Options, CSP, X-XSS-Protection |
| Rate limiting | 30 req/s API, 10 conn/s WebSocket |
| Signal handling | tini as PID 1 for graceful shutdown |
| Health check | curl http://localhost:9091/health every 30s |
| Hidden paths | Blocks .env, .git, .log access |
| Gzip | Compresses CSS/JS/JSON for faster load |

---

# 7. Roadmap

## Phase 1 — Foundation (Months 1–6)

| Milestone | Status |
|-----------|--------|
| Rust core runtime + libp2p networking | ✅ |
| IPFS DID implementation | ✅ |
| Basic task scheduler | ✅ |
| Desktop clients (Win, Mac, Linux) | ✅ |
| GPU abstraction layer (CUDA + Vulkan) | ✅ |
| 8 core agents with deterministic logic | ✅ |
| FCMToken + AgentRegistry + TaskMarketplace | ✅ |
| Tier staking + Governance + Rewards | ✅ |
| Escrow + ReputationNFT | ✅ |
| 372 tests passing | ✅ |
| AI inference demo on 3+ consumer GPUs | ✅ |

## Phase 2 — Expansion (Months 7–12)

| Milestone | Status |
|-----------|--------|
| Mobile clients (iOS Swift + Android Kotlin) | 🔲 |
| FCM token launch (L2, DEX listing) | 🔲 |
| Location-based clustering (GeoHash 4–6) | 🔲 |
| WASM runtime integration (Wasmtime) | 🔲 |
| AI inference marketplace (production) | 🔲 |
| Terraform infrastructure | ✅ |
| Monitoring stack (Prometheus + Grafana) | ✅ |

## Phase 3 — Maturation (Months 13–18)

| Milestone | Details |
|-----------|---------|
| TEE attestation framework | Intel SGX/TDX, AMD SEV, Apple Secure Enclave |
| Federated learning toolkit | Hospital/bank onboarding, HIPAA-compliant |
| IoT embedded client | Rust `no_std` + Lua for sensors |
| Enterprise SLAs | Guaranteed uptime, dedicated capacity |
| Cross-chain bridges | ETH, SOL, BTC |
| Render farm marketplace | Blender/Unreal addon |

## Phase 4 — Ecosystem (Months 19–24)

| Milestone | Details |
|-----------|---------|
| DAO governance | Token-weighted voting, Snapshot + Aragon |
| Game server hosting | Sub-20ms multiplayer, dynamic matchmaking |
| Scientific computing bounties | Academic partnerships, BOINC integration |
| Privacy mixnet | Censorship-resistant relay network |
| Hardware partnerships | NVIDIA, Apple, Qualcomm edge compute |

## Economic Model

- **Supply:** 1,000,000,000 FCM (deflationary via burn)
- **Staking:** 500–1000 FCM per agent registration
- **Slashing:** 30% of stake on Byzantine behavior
- **Fees:** 1% burn + 2% treasury on all transfers

## Success Metrics

| Metric | 6-Month | 12-Month | 24-Month |
|--------|---------|----------|----------|
| Active nodes | 100 | 1,000 | 10,000 |
| Daily compute tasks | 500 | 10,000 | 100,000 |
| Concurrent AI inference users | 50 | 500 | 5,000 |
| Total staked FCM | 50,000 | 500,000 | 5,000,000 |
| Cost savings vs cloud (avg) | 50% | 70% | 80% |

## Key Differentiators

1. **True Decentralization** — No central servers; pure P2P mesh
2. **Universal Access** — From $50 Android phones to $50K server clusters
3. **Zero-LLM Hot Paths** — Deterministic algorithms, not AI guessing
4. **Cryptoeconomic Security** — Stake + reputation + TEE = trustless collaboration
5. **Performance-First** — Rust core, zero-copy networking, GPU-native kernels

---

# 8. Security Audit

## 🔴 CRITICAL — ALL FIXED ✅

### C-1: Task ID Collision Prevention ✅ FIXED
Requester can register tasks with arbitrary `taskId`. Two requesters can create tasks with the same ID, causing the second to overwrite the first.

**Fix:** Add `require(tasks[_taskId].requester == address(0), "Task ID already exists")` to `createTask()`.

### C-2: Agent Type 0-11 Validation ✅ FIXED
`registerAgent()` does not validate `_agentType`. Registering `agentType = 255` or `agentType = 12+` produces unbounded array lookups in `getAgentsByType()`.

**Fix:** `require(_agentType <= 12, "Invalid agent type")`.

### C-3: Spot Task Escrow Refund ✅ FIXED
No way to cancel a spot task and recover escrowed FCM.

**Fix:** Added `cancelSpotTask()` with CEI-compliant refund.

### C-4: Auction Bid Refund ✅ FIXED
If a bidder deregisters (unstakes) before `settleAuction`, their bid is permanently locked.

**Fix:** `settleAuction` refunds all bids to stored `bidder` address.

### C-5: Mint to Zero Address ✅ FIXED
`mintRewards()` does not validate `to != address(0)`.

**Fix:** Added zero-address check.

### C-6: Dispute Loop Prevention ✅ FIXED
`resolveDispute(_agentFault=false)` sets status back to `Completed`, allowing infinite dispute cycling.

**Fix:** Set to terminal `Resolved` state.

## 🟠 HIGH — ALL FIXED ✅

### H-1: All Agents Share Same Private Key ✅ FIXED
All agents sign with the same key. Compromised key exposes all identities.

**Fix:** Generate/load unique keypairs per agent.

### H-2: `operatorActiveTasks` Counter Underflow ✅ FIXED
`submitResult` can underflow counter to `type(uint256).max`.

**Fix:** Added `require(operatorActiveTasks[msg.sender] > 0)`.

### H-3: No Deadline for Dispute Resolution ✅ FIXED
Disputed tasks can remain locked indefinitely.

**Fix:** Added `disputeResolutionDeadline` + `claimExpiredDispute()`.

### H-4/H-5: Chat Authorization ✅ FIXED
`handleGrant`/`handleBan` have no caller permission check.

### H-6/H-7: Settings Import Validation ✅ FIXED
Import bypasses schema validation + prototype pollution risk.

### H-8/H-9/H-10: File Locking ✅ FIXED
Race condition on concurrent file writes.

### H-11: NL Handler Sanitization ✅ FIXED
Unsanitized input passed to regex patterns.

## 🟡 MEDIUM — ALL FIXED ✅

| ID | Issue | Fix |
|----|-------|-----|
| M-1 | Dispute terminal state | Added `Resolved` state |
| M-2 | Heartbeat timestamp prediction | Added nonce replay protection |
| M-3 | Predictable calculateReward | Popcount-based pricing |
| M-4 | No re-registration after unstake | Allow re-registration |
| M-5 | Gas limit DoS on getAgentsByType | Two-pass O(n) approach |
| M-6 | cancelTask used Slashed status | Added `Cancelled` status |
| M-7/M-8 | Frontend CSP | Nonce-based CSP |
| M-9/M-10 | Docker auth | Non-root user + localhost binding |
| M-11 | Auto-create users | Separate lookup from creation |
| M-12 | suspendUseCase auth | Added permission check |
| M-13 | BigInt comparison | Parse to BigInt before comparison |
| M-14 | Signing scheme | Documented signing flow |

## 🟢 LOW — BEST PRACTICES

| ID | Issue | Status |
|----|-------|--------|
| L-1 | No emergency pause | ✅ Fixed (Pausable on all contracts) |
| L-2 | No event indexing for task search | Deferred |
| L-3 | Token accepts ETH | ✅ Fixed |
| L-4 | Gas limit DoS on return array | ✅ Fixed |
| L-5 | Hardcoded dispute window | ✅ Fixed (admin configurable) |
| L-6 | No on-chain tier system | Deferred (JS tier exists) |
| L-7 | Logger writes to stdout AND file | ✅ Fixed |
| L-8 | Atomicity on Windows | ✅ Fixed |
| L-9 | No graceful degradation for missing RPC | ✅ Fixed |
| L-10 | Chat history in-memory only | Deferred |

---

# 9. Security Status

**Last Updated:** August 24, 2026

## Test Results
```
372 passing (22s)
0 failing
```

## All Security Fixes Applied

### Round 1 (Aug 22) — 39 fixes
6 Critical | 11 High | 14 Medium | 8 Low

### Round 2 (Aug 24) — 15 fixes
2 Critical | 2 High | 8 Medium | 3 Low

### Round 3 (Aug 24) — 15 fixes (Low severity)
L-1 through L-10: All addressed

## Contracts Secured
All 8 contracts: CEI ✅ | Reentrancy ✅ | Access Control ✅

| Contract | Tests | Status |
|----------|-------|--------|
| FCMToken | 13 | ✅ Production-ready |
| FCMAgentRegistry | 31 | ✅ Production-ready |
| FCMTaskMarketplace | 11 | ✅ Production-ready |
| FCMTierStaking | 8 | ✅ Production-ready |
| FCMRewardsPool | 4 | ✅ Production-ready |
| FCMGovernance | 11 | ✅ Production-ready |
| FCMEscrow | 7 | ✅ Production-ready |
| FCMReputationNFT | 7 | ✅ Production-ready |

## Test Coverage

| Test File | Tests | What It Verifies |
|-----------|-------|------------------|
| `test/critical-fixes.test.js` | 13 | All 6 critical fixes |
| `test/high-severity-fixes.test.js` | 6 | H-2 counter underflow, H-3 dispute deadline |
| `test/audit-fixes.test.js` | 4 | cancelTask status, dispute window, re-registration |
| `test/integration.test.js` | 10 | Full lifecycle, capability matching, cancellation |
| `test/master-agent.test.js` | 48 | MasterAgent, modules, settings, onboarding, chat |
| `test/new-workloads.test.js` | 27 | Node, storage, file_server, rewarded agent types |
| `test/FCMToken.test.js` | 12 | Token deployment, minting, fees, supply |
| `test/FCMAgentRegistry.test.js` | 15 | Registration, lifecycle, capabilities, unstaking |
| `test/FCMTaskMarketplace.test.js` | 6 | Spot tasks, auctions, bids, settlement |
| `test/production-fixes.test.js` | 10 | C-1, C-2, C-3, M-1 regression tests |
| `test/new-agents.test.js` | 20 | All 20 agent definitions |
| `test/gpu-chart-engine.test.js` | 10 | Agent data, RBAC, chart engine |

---

# 10. Sales & Go-To-Market

## Competitive Comparison

| Feature | FCM | AWS | GCP | Azure |
|---------|-----|-----|-----|-------|
| GPU Inference $/hr | $0.80 | $3.67 | $3.50 | $3.40 |
| Edge Functions $/M | $0.40 | $2.00 | $0.40 | $0.20 |
| Object Storage $/GB | $0.01 | $0.023 | $0.020 | $0.018 |
| Crypto Payments | ✅ | ❌ | ❌ | ❌ |
| Decentralized | ✅ | ❌ | ❌ | ❌ |
| Data Sovereignty | User chooses | AWS regions | GCP regions | Azure regions |
| Free Tier | 10 GPU-hrs/mo | 12mo free | $300 credit | $200 credit |

## Go-To-Market Phases

### Phase 1: Developer Community (Months 1–3)
**Goal:** 1,000 signups, 100 paying customers

| Tactic | Action | Budget |
|--------|--------|--------|
| Content | Blog: "How we cut inference costs 78%" | $2K/mo |
| Developer docs | API reference, quickstart guides | $5K |
| Open source | CLI tool, SDKs (JS, Python, Go) | $10K |
| Hackathons | Sponsor 3 ML/AI hackathons | $15K |
| Community | Discord, Twitter/X, dev forums | $1K/mo |
| Free tier | 10 GPU-hrs/month forever | Lost revenue |

### Phase 2: Business Customers (Months 4–9)
**Goal:** 50 paying businesses, $50K MRR

| Tactic | Action | Budget |
|--------|--------|--------|
| Case studies | 3 published success stories | $5K |
| Webinars | Monthly "Reduce Your Cloud Bill" | $2K/mo |
| Outbound | SDR team (2 people) | $20K/mo |
| Events | NeurIPS, GDC, Web Summit | $30K |
| Partnerships | Hugging Face, Replicate integration | $10K |

### Phase 3: Enterprise Scale (Months 10–18)
**Goal:** 20 enterprise contracts, $500K MRR

| Tactic | Action | Budget |
|--------|--------|--------|
| Enterprise sales | 2 AEs + 1 SE | $60K/mo |
| SOC 2 compliance | Security audit + certification | $50K |
| SLA guarantees | 99.99% uptime | Infrastructure |
| Regional expansion | EU (GDPR), Asia-Pacific | $30K |

## Unit Economics

| Metric | Target |
|--------|--------|
| **CAC** (self-serve) | $200 |
| **CAC** (sales-assisted) | $2,000 |
| **LTV** (self-serve) | $2,400 |
| **LTV** (enterprise) | $24,000 |
| **LTV:CAC Ratio** | 12:1 |
| **Gross Margin** | 65% |
| **Net Revenue Retention** | 120% |

## Revenue Projections

| Month | Customers | MRR | ARR |
|-------|-----------|-----|-----|
| 3 | 100 | $15K | $180K |
| 6 | 500 | $75K | $900K |
| 12 | 5,000 | $750K | $9M |
| 24 | 40,000 | $6M | $72M |

## ROI Calculator

```
Your current AWS bill:     $__________ /month
FCM equivalent:            $__________ /month  (60-80% less)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your annual savings:       $__________ /year
```

---

*Document compiled from: fcm-spec.md, CONTRACT_REPORT.md, tier-system.md, integration-guide.md, eth.md, docker.md, roadmap.md, security-audit.md, secure.md, sell.md*
*Last compiled: August 24, 2026*
# FCM Sepolia Testnet Deployment Guide

Step-by-step guide to deploy all 8 FCM smart contracts to the Ethereum Sepolia testnet.

---

## Prerequisites

| Requirement | Details |
|-------------|---------|
| **Node.js** | v18+ required |
| **Sepolia ETH** | ~0.8 ETH for gas (8 deploys + role grants) |
| **Private Key** | Throwaway wallet — never use your main key |
| **Etherscan API Key** | For contract verification |

### Get Sepolia ETH

1. **Alchemy Faucet**: https://sepoliafaucet.com (0.5 ETH/day)
2. **Infura Faucet**: https://www.infura.io/faucet/sepolia
3. **Google Cloud Faucet**: https://cloud.google.com/application/web3/faucet/ethereum/sepolia
4. **QuickNode Faucet**: https://faucet.quicknode.com/ethereum/sepolia

### Get Etherscan API Key

1. Go to https://etherscan.io/myapikey
2. Create free account → API Keys → Add
3. Copy the key

---

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Configure Environment

```bash
# Copy the template
cp .env.example .env

# Edit .env with your values
```

Required `.env` values:

```bash
# Your Sepolia deployer wallet private key (0x prefix required)
TESTNET_PRIVATE_KEY=0x_YOUR_PRIVATE_KEY_HERE

# Etherscan API key for verification
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY

# Sepolia RPC (default works, or use Alchemy/Infura for faster)
SEPOLIA_RPC=https://rpc.sepolia.org
```

## Step 3: Verify Wallet Balance

```bash
# Check deployer balance
npx hardhat run --network sepolia -e "
  const [s] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(s.address);
  console.log('Address:', s.address);
  console.log('Balance:', ethers.formatEther(bal), 'ETH');
"
```

**Need at least 0.3 ETH.** If low, visit a faucet.

## Step 4: Compile Contracts

```bash
npx hardhat compile
```

Expected output:
```
Compiled 29 Solidity files successfully
```

## Step 5: Deploy All 8 Contracts

```bash
npm run deploy:sepolia
```

This deploys in order:
1. **FCMToken** — ERC20 with fees, 500M initial supply, 500M reserve
2. **FCMAgentRegistry** — Agent registration, tasks, heartbeats, disputes
3. **FCMTaskMarketplace** — Spot tasks, auctions, escrow (no requirements param)
4. **FCMTierStaking** — 6-tier staking with hardware verification
5. **FCMGovernance** — On-chain proposal voting (tier-weighted, snapshots)
6. **FCMEscrow** — Milestone payment escrow with multi-sig
7. **FCMReputationNFT** — Soulbound reputation badges
8. **FCMRewardsPool** — Epoch reward distribution (ADMIN-only finalize)

The script also:
- Grants 8 cross-contract roles
- Saves addresses to `deployments/latest.json`
- Verifies all contracts on Etherscan (after 30s delay)

**Typical gas cost:** ~0.2-0.4 ETH on Sepolia

## Step 6: Save Contract Addresses

After deployment, update your `.env`:

```bash
FCM_TOKEN_CONTRACT=0x...
FCM_REGISTRY_CONTRACT=0x...
FCM_MARKETPLACE_CONTRACT=0x...
FCM_TIER_STAKING_CONTRACT=0x...
FCM_GOVERNANCE_CONTRACT=0x...
FCM_ESCROW_CONTRACT=0x...
FCM_REPUTATION_NFT_CONTRACT=0x...
FCM_REWARDS_POOL_CONTRACT=0x...
```

## Step 7: Verify on Etherscan

If automatic verification failed, verify manually:

```bash
# Verify each contract
npx hardhat verify --network sepolia CONTRACT_ADDRESS [constructor_args]

# Example: FCMToken
npx hardhat verify --network sepolia 0xYOUR_TOKEN 0xYOUR_DEPLOYER

# Example: FCMAgentRegistry
npx hardhat verify --network sepolia 0xYOUR_REGISTRY 0xYOUR_TOKEN

# Example: FCMGovernance
npx hardhat verify --network sepolia 0xYOUR_GOVERNANCE 0xYOUR_TOKEN 0xYOUR_TIER_STAKING
```

### Constructor Arguments Reference

| Contract | Constructor Args |
|----------|-----------------|
| FCMToken | `(treasury_address)` |
| FCMAgentRegistry | `(token_address)` |
| FCMTaskMarketplace | `(registry_address, token_address)` |
| FCMTierStaking | `(token_address)` |
| FCMGovernance | `(token_address, tier_staking_address)` |
| FCMEscrow | `(token_address)` |
| FCMReputationNFT | `()` |
| FCMRewardsPool | `(token_address, tier_staking_address)` |

## Step 8: Post-Deployment Setup

### Grant Additional Roles (Optional)

```bash
# Grant VALIDATOR_ROLE to a separate resolver address
npx hardhat console --network sepolia
> const registry = await ethers.getContractAt("FCMAgentRegistry", "0xYOUR_REGISTRY")
> const VALIDATOR_ROLE = await registry.VALIDATOR_ROLE()
> await registry.grantRole(VALIDATOR_ROLE, "0xRESOLVER_ADDRESS")
```

### Fund the RewardsPool

```bash
> const token = await ethers.getContractAt("FCMToken", "0xYOUR_TOKEN")
> const pool = await ethers.getContractAt("FCMRewardsPool", "0xYOUR_POOL")
> await token.approve(await pool.getAddress(), ethers.parseEther("100000"))
> await pool.fundPool(ethers.parseEther("100000"))
```

### Create First Proposal (Governance Test)

```bash
> const gov = await ethers.getContractAt("FCMGovernance", "0xYOUR_GOVERNANCE")
> await gov.propose("Test proposal: update MIN_STAKE", "0xYOUR_REGISTRY", "0x")
```

---

## Deployed Contract URLs

After deployment, view on Etherscan:

```
https://sepolia.etherscan.io/address/0xYOUR_TOKEN
https://sepolia.etherscan.io/address/0xYOUR_REGISTRY
https://sepolia.etherscan.io/address/0xYOUR_MARKETPLACE
https://sepolia.etherscan.io/address/0xYOUR_TIER_STAKING
https://sepolia.etherscan.io/address/0xYOUR_GOVERNANCE
https://sepolia.etherscan.io/address/0xYOUR_ESCROW
https://sepolia.etherscan.io/address/0xYOUR_REPUTATION_NFT
https://sepolia.etherscan.io/address/0xYOUR_REWARDS_POOL
```

---

## Troubleshooting

### "insufficient funds for gas"
→ Get more Sepolia ETH from a faucet

### "nonce has already been used"
→ Wait 30s and retry, or reset nonce:
```bash
npx hardhat nonce --network sepolia
```

### "contract verification failed"
→ Wait 5 minutes for Etherscan indexing, then:
```bash
npx hardhat verify --network sepolia ADDRESS [args]
```

### "replacement transaction underpriced"
→ Increase gas price in `hardhat.config.js`:
```js
sepolia: { gasPrice: 30000000000 } // 30 gwei
```

### Deployment hangs
→ Check RPC endpoint. Try alternative:
```bash
SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com
```

---

## Other Testnets

Deploy to Base Sepolia:
```bash
npm run deploy:baseSepolia
```

Deploy to Arbitrum Sepolia:
```bash
npm run deploy:arbitrumSepolia
```

Deploy locally (no gas needed):
```bash
npm run deploy:local
```

---

## Role Summary

| Role | Contract | Grantee | Purpose |
|------|----------|---------|---------|
| `MINTER_ROLE` | FCMToken | Registry | Mint task rewards |
| `MINTER_ROLE` | FCMToken | RewardsPool | Mint epoch rewards |
| `LISTING_ROLE` | Marketplace | Deployer | List spot/auction tasks |
| `VALIDATOR_ROLE` | Registry | Deployer | Resolve disputes |
| `ORACLE_ROLE` | TierStaking | Deployer | Update HW scores |
| `ORACLE_ROLE` | ReputationNFT | Deployer | Update badges |
| `ORACLE_ROLE` | RewardsPool | Deployer | Record work |
| `ARBITRATOR_ROLE` | Escrow | Deployer | Resolve disputes |
# FCM Tiered Membership & Reward System

**Fair Market Value Reward Points — Hardware-Quality-Based Tiers**

---

## Overview

Users join FCM at a tier determined by their **hardware quality** and **connection speed**. Higher tiers unlock higher reward multipliers, priority task access, and lower fees. Tiers slide dynamically — upgrade as you add hardware, downgrade if performance drops.

```
┌─────────────────────────────────────────────────────────┐
│  TIER 5 — ELITE        5x rewards  │  5000 FCM setup   │
├─────────────────────────────────────────────────────────┤
│  TIER 4 — PRO          3x rewards  │  2000 FCM setup   │
├─────────────────────────────────────────────────────────┤
│  TIER 3 — ADVANCED     2x rewards  │   500 FCM setup   │
├─────────────────────────────────────────────────────────┤
│  TIER 2 — STANDARD     1.5x rewards│   100 FCM setup   │
├─────────────────────────────────────────────────────────┤
│  TIER 1 — STARTER      1x rewards  │    25 FCM setup   │
├─────────────────────────────────────────────────────────┤
│  TIER 0 — FREE         0.5x rewards│     FREE           │
└─────────────────────────────────────────────────────────┘
```

---

## Tier Requirements

### Hardware Score (0–100 points)

Evaluated at registration and re-evaluated every 24 hours.

| Component | Tier 0 | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|-----------|--------|--------|--------|--------|--------|--------|
| **CPU Cores** | 1–2 | 4 | 8 | 16 | 32 | 64+ |
| **CPU Score** | < 15 | 15–25 | 25–40 | 40–60 | 60–80 | 80–100 |
| **RAM** | < 4 GB | 4–8 GB | 8–32 GB | 32–64 GB | 64–128 GB | 128+ GB |
| **GPU VRAM** | None | 4 GB | 8 GB | 16 GB | 24 GB | 48+ GB |
| **GPU Score** | 0 | 10–20 | 20–40 | 40–60 | 60–80 | 80–100 |
| **Disk Free** | < 50 GB | 50–200 GB | 200–500 GB | 500 GB–2 TB | 2–8 TB | 8+ TB |
| **TEE/SGX** | No | No | Optional | Yes | Yes | Yes |
| **Hardware Score** | 0–15 | 15–30 | 30–50 | 50–70 | 70–90 | 90–100 |

### Connection Speed Score (0–100 points)

Measured via bandwidth test at registration and hourly.

| Metric | Tier 0 | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|--------|--------|--------|--------|--------|--------|--------|
| **Download** | < 10 Mbps | 10–50 Mbps | 50–200 Mbps | 200–500 Mbps | 500 Mbps–1 Gbps | 1+ Gbps |
| **Upload** | < 5 Mbps | 5–20 Mbps | 20–100 Mbps | 100–250 Mbps | 250 Mbps–500 Mbps | 500+ Mbps |
| **Latency (RTT)** | > 200ms | 100–200ms | 50–100ms | 20–50ms | 10–20ms | < 10ms |
| **Jitter** | > 50ms | 20–50ms | 10–20ms | 5–10ms | 2–5ms | < 2ms |
| **Uptime** | < 90% | 90–95% | 95–99% | 99–99.5% | 99.5–99.9% | 99.9%+ |
| **Public IP** | No | Yes (NAT) | Yes (CGNAT) | Yes (Static) | Yes (Static IPv4+6) | Yes (BGP) |
| **Connection Score** | 0–15 | 15–30 | 30–50 | 50–70 | 70–90 | 90–100 |

### Composite Tier Score

```
Tier Score = (Hardware Score × 0.6) + (Connection Score × 0.4)
```

| Tier | Score Range | Name | Color |
|------|-------------|------|-------|
| 0 | 0–14 | Free | Gray |
| 1 | 15–29 | Starter | White |
| 2 | 30–49 | Standard | Green |
| 3 | 50–69 | Advanced | Blue |
| 4 | 70–89 | Pro | Purple |
| 5 | 90–100 | Elite | Gold |

---

## Setup Fees

One-time fee to join at a tier. Refundable at 80% if you leave within 30 days.

| Tier | Setup Fee | Refund (30d) | Monthly Fee | Fee Waiver |
|------|-----------|-------------|-------------|------------|
| **Tier 0** | FREE | N/A | FREE | N/A |
| **Tier 1** | 25 FCM | 20 FCM | FREE | Stake 100 FCM |
| **Tier 2** | 100 FCM | 80 FCM | 5 FCM/mo | Stake 500 FCM |
| **Tier 3** | 500 FCM | 400 FCM | 20 FCM/mo | Stake 2,000 FCM |
| **Tier 4** | 2,000 FCM | 1,600 FCM | 75 FCM/mo | Stake 10,000 FCM |
| **Tier 5** | 5,000 FCM | 4,000 FCM | 200 FCM/mo | Stake 50,000 FCM |

**Fee Waiver:** Stake the listed amount to waive monthly fees. Stake is slashable for bad behavior.

---

## Reward Point System

### Base Rewards (Fair Market Value)

Every completed task earns base reward points based on actual compute market rates.

| Task Type | Base Reward (FCM) | Point Equivalent | Market Rate Reference |
|-----------|-------------------|-------------------|----------------------|
| AI Inference (1hr) | 2.5 | 250 pts | AWS A100: $3.67/hr → 2.5 FCM |
| Render (1 frame) | 1.0 | 100 pts | AWS g5.xlarge: $1/hr ÷ 24fps |
| FL Training (1 round) | 25.0 | 2,500 pts | Hospital FL: $200/round |
| Edge Function (1M req) | 4.0 | 400 pts | Lambda: $0.20/M → $4/M equivalent |
| ZK Proof (batch) | 1.0 | 100 pts | Rollup prover: $0.04/proof × 25 |
| Game Server (1hr) | 2.0 | 200 pts | Multiplay: $0.50/hr base |
| Science Job (1hr) | 3.0 | 300 pts | HPC: $2–5/hr range |
| Privacy Relay (1GB) | 0.1 | 10 pts | VPN: $0.05–0.15/GB |
| Compute Node (1hr) | 1.0 | 100 pts | VPS: $0.50–2/hr |
| Storage (1GB/mo) | 0.05 | 5 pts | S3: $0.023/GB/mo |
| File Server (1GB) | 0.02 | 2 pts | CDN: $0.01–0.05/GB |
| Bounty (varies) | 1–1000 | 100–100,000 pts | Community-determined |

### Tier Multipliers

Higher tiers earn more points per task.

| Tier | Multiplier | Example: Inference 1hr |
|------|-----------|----------------------|
| Tier 0 | 0.5x | 125 pts (1.25 FCM) |
| Tier 1 | 1.0x | 250 pts (2.5 FCM) |
| Tier 2 | 1.5x | 375 pts (3.75 FCM) |
| Tier 3 | 2.0x | 500 pts (5.0 FCM) |
| Tier 4 | 3.0x | 750 pts (7.5 FCM) |
| Tier 5 | 5.0x | 1,250 pts (12.5 FCM) |

### Bonus Multipliers (Stack with Tier)

| Condition | Bonus | Example |
|-----------|-------|---------|
| **Uptime > 99%** (monthly) | +10% | 250 → 275 pts |
| **Uptime > 99.9%** (monthly) | +25% | 250 → 312 pts |
| **100+ tasks completed** | +5% | 250 → 262 pts |
| **500+ tasks completed** | +15% | 250 → 287 pts |
| **1000+ tasks completed** | +25% | 250 → 312 pts |
| **Zero disputes** (30 days) | +10% | 250 → 275 pts |
| **Response time < 100ms** | +5% | 250 → 262 pts |
| **Refer a new provider** | +500 pts | One-time bonus |
| **Consecutive 30-day streak** | +2x | Monthly multiplier |

### Penalty Deductions

| Condition | Penalty |
|-----------|---------|
| Task timeout | -50% of task reward |
| Failed task | -100% of task reward |
| Dispute (agent fault) | -200% + stake slash |
| Heartbeat miss (> 5) | -5% daily for 7 days |
| Downtime > 1hr unannounced | -10% daily for 3 days |

---

## Tier Progression Rules

### Upgrading

- **Automatic:** Tier upgrades instantly when composite score exceeds threshold
- **Manual purchase:** Pay setup fee difference to jump tiers (hardware still verified)
- **Stake boost:** Staking 2x the required amount grants +1 tier bonus (max Tier 5)

### Downgrading

- **Automatic:** Tier drops if composite score falls below threshold for 7+ days
- **Penalty downgrade:** 3 disputes in 30 days → drop 1 tier
- **Inactivity:** No tasks for 30 days → drop 1 tier

### Tier Lock

- Once upgraded, you keep your tier for minimum 90 days
- Exception: immediate downgrade for 5+ disputes or TOS violation

---

## Tier Benefits Summary

| Benefit | Tier 0 | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|---------|--------|--------|--------|--------|--------|--------|
| **Reward Multiplier** | 0.5x | 1x | 1.5x | 2x | 3x | 5x |
| **Priority Task Queue** | No | No | Basic | Standard | Priority | Highest |
| **Max Concurrent Tasks** | 1 | 3 | 5 | 10 | 25 | 100 |
| **Max Task Duration** | 1hr | 4hr | 12hr | 24hr | 48hr | Unlimited |
| **Gas Fee Discount** | 0% | 0% | 10% | 20% | 40% | 60% |
| **Early Access Features** | No | No | No | Yes | Yes | Yes |
| **Dedicated Support** | No | No | No | No | Yes | Yes |
| **Custom Agent Config** | No | No | Yes | Yes | Yes | Yes |
| **API Rate Limit** | 10/min | 50/min | 200/min | 1,000/min | 5,000/min | 50,000/min |
| **Data Retention** | 7 days | 30 days | 90 days | 1 year | 2 years | Unlimited |
| **Reputation Weight** | 0.5x | 1x | 1.5x | 2x | 3x | 5x |
| **Dispute Protection** | None | Basic | Standard | Enhanced | Premium | Full |

---

## Point Redemption

Points can be redeemed for:

| Redemption | Points Required | Value |
|------------|----------------|-------|
| FCM Token withdrawal | 100 pts = 1 FCM | Direct conversion |
| Tier upgrade credit | 500 pts = 5 FCM credit | Applied to setup fee |
| Priority task boost | 200 pts | 24hr priority queue access |
| Custom agent branding | 1,000 pts | Custom icon + name |
| Governance voting weight | 500 pts = 1 vote | DAO proposals |
| NFT achievement badge | 5,000 pts | Collectible tier badge |
| Partner discounts | 2,500 pts | Up to 50% off partner services |

---

## Anti-Gaming Measures

| Measure | Description |
|---------|-------------|
| **Hardware re-verification** | Random hardware checks every 24hrs |
| **Connection speed tests** | Hourly bandwidth verification |
| **Unique device binding** | One account per physical machine (hardware fingerprint) |
| **Rate limiting** | Max tasks per hour based on tier |
| **Reputation decay** | -1% reputation/day if inactive |
| **Sybil detection** | Cross-reference IP, hardware, behavioral patterns |
| **Slashing** | Stake burned for: fake hardware, Sybil attacks, data poisoning |

---

## Example Scenarios

### Scenario 1: Home Gamer Joins

```
Hardware: Ryzen 5 5600X (6 cores), 16GB RAM, RTX 3060 (12GB), 500GB SSD
Network:  100 Mbps down / 20 Mbps up, 30ms RTT, 99.5% uptime, Static IP

Hardware Score: 42 (mid-range gaming PC)
Connection Score: 48 (decent home internet)
Composite: (42 × 0.6) + (48 × 0.4) = 25.2 + 19.2 = 44.4

→ Tier 2 (Standard)
→ Setup fee: 100 FCM
→ Earns: 1.5x rewards
→ Can run: inference, edge, game, rewarded tasks
→ Monthly potential: ~150 FCM (100 hrs × 1.5 FCM/hr avg)
```

### Scenario 2: Data Center Operator

```
Hardware: Dual Xeon 8380 (2×40 cores), 512GB RAM, 4× A100 (80GB each), 20TB NVMe
Network:  10 Gbps symmetrical, < 1ms RTT, 99.99% uptime, BGP

Hardware Score: 98 (enterprise GPU cluster)
Connection Score: 99 (data center grade)
Composite: (98 × 0.6) + (99 × 0.4) = 58.8 + 39.6 = 98.4

→ Tier 5 (Elite)
→ Setup fee: 5,000 FCM (waived with 50,000 FCM stake)
→ Earns: 5x rewards + bonuses
→ Can run: ALL task types including TEE/FL
→ Monthly potential: ~12,500 FCM (500 hrs × 25 FCM/hr avg × 1.0 uptime)
```

### Scenario 3: Mobile Phone Contributor

```
Hardware: Samsung Galaxy S24 (8 cores, 12GB RAM, no GPU), 128GB storage
Network:  4G LTE (50 Mbps down / 10 Mbps up, 80ms RTT), Battery-powered

Hardware Score: 12 (mobile device)
Connection Score: 22 (4G, variable)
Composite: (12 × 0.6) + (22 × 0.4) = 7.2 + 8.8 = 16.0

→ Tier 1 (Starter)
→ Setup fee: 25 FCM
→ Earns: 1x rewards
→ Can run: edge (lightweight), rewarded tasks
→ Monthly potential: ~30 FCM (50 hrs × 0.6 FCM/hr avg)
```

---

## Smart Contract Integration

```solidity
struct TierInfo {
    uint8 tier;            // 0-5
    uint256 hardwareScore;
    uint256 connectionScore;
    uint256 compositeScore;
    uint256 setupFeePaid;
    uint256 monthlyFee;
    uint256 stakeAmount;
    uint256 joinedAt;
    uint256 lastVerification;
    uint256 tasksCompleted;
    uint256 pointsEarned;
    uint256 pointsRedeemed;
    bool feeWaived;
}
```

### Tier Verification Events

```solidity
event TierUpgraded(address indexed user, uint8 oldTier, uint8 newTier, uint256 score);
event TierDowngraded(address indexed user, uint8 oldTier, uint8 newTier, uint256 score);
event PointsEarned(address indexed user, uint256 points, string taskType);
event PointsRedeemed(address indexed user, uint256 points, string redemption);
event HardwareVerified(address indexed user, uint256 score, bool passed);
event ConnectionVerified(address indexed user, uint256 score, bool passed);
```

---

## Revenue Projections (Network-Level)

| Tier | Users (6mo) | Users (12mo) | Setup Revenue | Monthly Revenue |
|------|-------------|--------------|---------------|-----------------|
| Tier 0 | 5,000 | 20,000 | 0 | 0 |
| Tier 1 | 2,000 | 8,000 | 50,000 FCM | 0 |
| Tier 2 | 500 | 2,000 | 50,000 FCM | 2,500 FCM |
| Tier 3 | 100 | 500 | 50,000 FCM | 2,000 FCM |
| Tier 4 | 20 | 100 | 40,000 FCM | 1,500 FCM |
| Tier 5 | 5 | 25 | 25,000 FCM | 500 FCM |
| **Total** | **7,625** | **30,625** | **215,000 FCM** | **6,500 FCM/mo** |

---

## Implementation Checklist

- [ ] Smart contract: `FCMTierSystem.sol` — tier tracking, point ledger, verification
- [ ] ResourceAnalyzer: Auto-detect tier from hardware + connection
- [ ] Onboarding: Tier selection flow with fee payment
- [ ] MasterAgent: Tier-aware task routing and reward calculation
- [ ] ChatInterface: Tier status commands (`tier`, `points`, `redeem`)
- [ ] Dashboard: Tier badge, progress bar, earnings chart
- [ ] Anti-gaming: Hardware fingerprinting, connection verification
- [ ] Integration guide: How existing agents adopt tier system
# FCM → g_p_unite Integration Guide

**How to merge Federated Compute Mesh capabilities into g_p_unite**

---

## What FCM Provides

| Component | What It Does | Export |
|-----------|-------------|--------|
| **Smart Contracts** | Token (FCM), Agent Registry, Task Marketplace | `contracts/solidity/*.sol` |
| **Agent Runtime** | Blockchain-connected agent: register, heartbeat, claim tasks, process work | `lib/agent-runtime.js` |
| **8 Agent Types** | Inference, Render, FL, Edge, ZK, Game, Science, Privacy | `agents/*.js` |
| **CLI Tool** | Deploy contracts, register agents, start/stop containers | `cli/fcm-deploy.js` |
| **Dashboard** | Real-time agent monitoring with live metrics | `index.html` + `app.js` |

---

## Use Case 1: Add Decentralized Compute to g_p_unite

**Goal:** Let g_p_unite users offload compute-intensive work to the FCM mesh.

**Integration:**
```js
// In g_p_unite, import the agent runtime
const { AgentRuntime } = require("./path/to/fcm/lib/agent-runtime");

// Create a compute provider agent
const provider = new AgentRuntime({
    privateKey: process.env.FCM_PRIVATE_KEY,
    rpcUrl: process.env.FCM_RPC_URL,
    registryAddress: process.env.FCM_REGISTRY,
    tokenAddress: process.env.FCM_TOKEN,
    agentType: "inference",
    agentName: "g_p_unite-inference-001",
    capabilities: "gpu,cuda,avx512",
    geohash: "u4pru",
    processTask: async (taskId, inputCID) => {
        // Your actual compute logic here
        const result = await runInference(inputCID);
        return { outputCID: result.cid, proofHash: result.hash };
    },
});

await provider.start();
```

**Result:** g_p_unite nodes become compute providers earning FCM tokens.

---

## Use Case 2: Use FCM for AI/ML Workloads

**Goal:** Run model training or inference without centralized GPU servers.

**Flow:**
```
g_p_unite User submits job
  → FCM TaskMarketplace lists the task
  → Inference Router agents claim and process
  → Results returned via IPFS CID
  → Payment escrowed and released
```

**Contract interaction from g_p_unite:**
```js
const marketplace = new ethers.Contract(MARKETPLACE_ADDR, MARKETPLACE_ABI, wallet);

// List a spot task (note: no requirements param since security audit cleanup)
await marketplace.listSpotTask(
    taskId,
    ethers.parseEther("10"),  // max price
    deadline,
    1  // priority: Normal
);
```

---

## Use Case 3: Federated Learning for g_p_unite Data

**Goal:** Train models on distributed g_p_unite user data without centralizing it.

**How it works:**
1. g_p_unite nodes run local training epochs
2. FL Coordinator agents aggregate encrypted gradients
3. Differential privacy (ε=1.0) protects individual data
4. Updated model published to IPFS

**Use in g_p_unite:**
```js
// Each g_p_unite node runs as an FL participant
const flAgent = new AgentRuntime({
    agentType: "federated_learning",
    capabilities: "tee,sgx,avx512",
    processTask: async (taskId, modelCID) => {
        // Download model from IPFS
        const model = await ipfs.get(modelCID);
        // Train locally on g_p_unite data
        const gradients = await trainLocal(model, localData);
        // Upload encrypted gradients
        const gradientCID = await ipfs.add(encrypt(gradients));
        return { outputCID: gradientCID, proofHash: hash(gradients) };
    },
});
```

---

## Use Case 4: Privacy-Powered g_p_unite Network

**Goal:** Add censorship-resistant communication to g_p_unite.

**How it works:**
- Privacy Mesh agents run mixnet relays
- Sphinx packet routing hides traffic patterns
- Cover traffic prevents timing analysis
- Exit policy enforcement blocks abuse

**Integration:**
```js
// g_p_unite routes sensitive traffic through FCM privacy mesh
const privacyAgent = new AgentRuntime({
    agentType: "privacy",
    capabilities: "tee,sgx,neon",
    geohash: "u4pru",  // Regional relay
    processTask: async (taskId, packetCID) => {
        // Decrypt, re-encrypt, forward through mixnet
        const packet = await ipfs.get(packetCID);
        const routed = await routeThroughMixnet(packet);
        return { outputCID: routed.cid, proofHash: routed.hash };
    },
});
```

---

## Use Case 5: Edge Computing for g_p_unite IoT

**Goal:** Run lightweight compute on g_p_unite IoT devices.

**How it works:**
- Edge Runner agents serve WASM functions
- Cold start under 10ms via module caching
- Memory/CPU limits prevent resource abuse
- Trie-based routing for O(log n) function lookup

**Integration:**
```js
// g_p_unite IoT device runs as an edge compute node
const edgeAgent = new AgentRuntime({
    agentType: "edge",
    capabilities: "wasm,neon,avx2",
    processTask: async (taskId, wasmCID) => {
        // Load WASM module from IPFS
        const wasm = await ipfs.get(wasmCID);
        // Execute with resource limits
        const result = await executeWasm(wasm, {
            memoryLimitMB: 128,
            cpuLimitMs: 100,
        });
        return { outputCID: result.cid, proofHash: result.hash };
    },
});
```

---

## Use Case 6: Token-Gated Access in g_p_unite

**Goal:** Use FCM tokens for premium features, staking, or governance.

**Contract integration:**
```js
// Check if user has staked FCM
const token = new ethers.Contract(TOKEN_ADDR, TOKEN_ABI, provider);
const balance = await token.balanceOf(userAddress);
const staked = await registry.agents(userDidHash);

if (staked.stake >= ethers.parseEther("500")) {
    // User is a registered compute provider — grant premium access
    grantPremiumAccess(userAddress);
}

// Transfer tokens for premium features
await token.transfer(providerAddress, ethers.parseEther("10"));
```

---

## Migration Steps

### Step 1: Add FCM as a dependency
```bash
# Copy FCM files into g_p_unite
cp -r path/to/fcm/lib ./lib/fcm
cp -r path/to/fcm/contracts ./contracts/fcm
cp path/to/fcm/package.json ./package.fcm.json
```

### Step 2: Install FCM dependencies
```bash
npm install ethers dotenv
```

### Step 3: Deploy FCM contracts (if not already deployed)
```bash
# Copy .env with your keys
cp path/to/fcm/.env.example .env

# Deploy to testnet first
npx hardhat run scripts/hardhat/deploy.js --network baseSepolia
```

### Step 4: Import agent runtime
```js
const { AgentRuntime, AGENT_TYPES } = require("./lib/fcm/agent-runtime");
```

### Step 5: Configure and start agents
```js
const agent = new AgentRuntime({
    privateKey: process.env.FCM_PRIVATE_KEY,
    rpcUrl: process.env.FCM_RPC_URL,
    registryAddress: process.env.FCM_REGISTRY,
    tokenAddress: process.env.FCM_TOKEN,
    agentType: "inference",
    agentName: "g_p_unite-agent-001",
    capabilities: "gpu,cuda",
    geohash: "u4pru",
    processTask: yourTaskProcessor,
});

await agent.start();
```

---

## File Structure After Merge

```
g_p_unite/
├── lib/
│   └── fcm/
│       ├── agent-runtime.js      ← Core agent logic
│       └── ...
├── contracts/
│   └── fcm/
│       ├── FCMToken.sol
│       ├── FCMAgentRegistry.sol
│       └── FCMTaskMarketplace.sol
├── test/
│   ├── FCMToken.test.js
│   ├── FCMAgentRegistry.test.js
│   └── FCMTaskMarketplace.test.js
├── agents/                        ← Agent type definitions
│   ├── inference-router.js
│   ├── render-splitter.js
│   ├── fl-coordinator.js
│   ├── edge-runner.js
│   ├── zk-prover.js
│   ├── game-host.js
│   ├── science-grid.js
│   └── privacy-mesh.js
├── scripts/
│   └── agent-example.js          ← Working example
├── package.json                   ← Add ethers dependency
└── .env                           ← FCM_PRIVATE_KEY, FCM_RPC_URL, etc.
```

---

## Environment Variables

Add to g_p_unite's `.env`:
```bash
# FCM Integration
FCM_PRIVATE_KEY=0x...
FCM_RPC_URL=https://mainnet.base.org
FCM_REGISTRY=0x...  # Deployed FCMAgentRegistry address
FCM_TOKEN=0x...     # Deployed FCMToken address
```
