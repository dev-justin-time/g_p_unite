# FCM blocks.ai Network Deployment

Complete deployment infrastructure for the FCM Expert Agent Swarm on blockchain-based compute networks.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your RPC URL, private keys, and cloud credentials

# 3. Initialize deployment
npx fcm-deploy init

# 4. Deploy smart contracts
npx fcm-deploy contract deploy

# 5. Register all 8 agents
npx fcm-deploy agent register

# 6. Start containers
npx fcm-deploy agent start

# 7. Check status
npx fcm-deploy status
```

## Smart Contracts

| Contract | Purpose | Gas |
|----------|---------|-----|
| `FCMToken` | ERC-20 with BME burn-mint equilibrium | ~2.5M |
| `FCMAgentRegistry` | Agent registration, staking, reputation | ~3.2M |
| `FCMTaskMarketplace` | Spot, reserved, and auction task markets | ~2.1M |

## Agent Registration

Each agent registers with:
- **500-1000 FCM stake** (higher for privacy-critical agents)
- **DID hash** (IPFS content-addressed identity)
- **Capability bitmask** (GPU, TEE, WASM, etc.)
- **Geohash** (location for latency optimization)
- **Agent type** (0-7 mapping to the 8 use cases)

## Multi-Cloud Deployment

- **AWS GPU** (p4d.24xlarge spot): Inference, Render, ZK
- **Hetzner CPU** (cpx51): Edge, Game, Science
- **Azure TEE** (DC8s_v3): FL Coordinator, Privacy Mesh

## License

MIT — FCM Architecture Working Group
