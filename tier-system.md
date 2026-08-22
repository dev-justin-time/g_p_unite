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
