# FCM Platform Roadmap

**Federated Compute Mesh — blocks.ai Network**

---

## Purpose

FCM is a decentralized compute-sharing platform that aggregates idle GPU and CPU resources from consumer devices, servers, and IoT into a unified edge-native supercomputer. It replaces centralized cloud providers with a trustless P2P mesh, enabling compute workloads at 10–100x lower cost.

**Core thesis:** The world has billions of underutilized devices. FCM turns them into a single programmable compute fabric — without renting data centers.

---

## Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                          │
│   AI Inference · Render Farm · FL Training · Edge Functions  │
├──────────────────────────────────────────────────────────────┤
│                    ORCHESTRATION LAYER                        │
│   Task Scheduling · Resource Matching · Payment Escrow       │
├──────────────────────────────────────────────────────────────┤
│                    EXECUTION LAYER                            │
│   WASM Runtime · CUDA/Vulkan/Metal · TEE Enclaves            │
├──────────────────────────────────────────────────────────────┤
│                    NETWORK LAYER                              │
│   libp2p · QUIC/WebRTC · GeoHash Clustering                  │
├──────────────────────────────────────────────────────────────┤
│                    IDENTITY LAYER                             │
│   IPFS DIDs · Reputation · Stake/Slashing · Attestation      │
├──────────────────────────────────────────────────────────────┤
│                    STORAGE LAYER                              │
│   IPFS/Filecoin · Content Addressing · Merkle Proofs         │
└──────────────────────────────────────────────────────────────┘
```

---

## Use Cases

### Tier 1 — Commercial Revenue Drivers

#### 1. Distributed AI Inference
**Market:** $15B+ by 2027 (Edge AI)

Host open-source LLMs (Llama 3, Mistral, DeepSeek) across consumer GPUs and serve API requests with geo-distributed load balancing. 10x cheaper than AWS/GCP inference endpoints.

```
User Request → GeoDNS → Regional Supernode
  → Select 3 nodes (RTT < 50ms, VRAM > model_size)
  → Stream tokens via WebRTC
  → Payment split via smart contract (L2)
```

| Metric | AWS | FCM | Savings |
|--------|-----|-----|---------|
| LLM Inference (A100) | $3.67/hr | $0.80/hr | 78% |

**FCM Agent:** `Inference Router` — batch coalescing, KV-cache routing, VRAM overflow guard, quantization auto-select, speculative decoding.

---

#### 2. Decentralized Render Farm
**Market:** $3B+ (VFX, Animation, ArchViz)

Blender, Unreal Engine, Octane render jobs distributed globally with real-time progress streaming via IPFS. 50–80% cost reduction vs AWS Deadline Cloud.

| Metric | AWS | FCM | Savings |
|--------|-----|-----|---------|
| 1000-frame render | $450 | $90 | 80% |

**FCM Agent:** `Render Splitter` — tile-based splitting, dependency DAG solver, preview stream encoding, GPU memory predictor.

---

#### 3. Federated Learning + Privacy-Preserving ML
**Market:** $20B+ (Healthcare, Finance)

Hospitals and banks train models locally, sharing only encrypted gradients. Differential privacy guarantees via Gaussian noise injection. Secure aggregation via MPC.

```
Central Coordinator (IPFS CID: model_v1.2)
  ↓
[Hospital A] [Hospital B] [Hospital C] [Phone Cluster]
  ↓ local training
[Gradient A] [Gradient B] [Gradient C] [Gradient D]
  ↓ secure aggregation (MPC + DP)
Updated Model (IPFS CID: model_v1.3)
```

| Metric | Traditional | FCM | Savings |
|--------|-------------|-----|---------|
| FL Training (100 nodes) | $2,000/round | $400/round | 80% |

**FCM Agent:** `FL Coordinator` — differential privacy (ε=1.0), secure aggregation (Shamir MPC), gradient clipping, Byzantine fault tolerance, poisoning detection.

---

### Tier 2 — Infrastructure & Protocol Value

#### 4. Serverless Edge Computing
**Market:** $8B+ (Edge/Serverless)

Replace AWS Lambda and Cloudflare Workers with community WASM nodes. Cold-start under 10ms via precompiled module caching and instance pooling.

| Metric | AWS Lambda | FCM Edge | Savings |
|--------|-----------|----------|---------|
| 1M executions | $20 | $4 | 80% |

**FCM Agent:** `Edge Runner` — WASM module cache, pre-warm pools, HTTP route trie match, memory/CPU limits.

---

#### 5. Zero-Knowledge Proving Network
**Market:** $5B+ (Rollup infrastructure, privacy)

Distributed ZK-SNARK proof generation across GPU clusters. Prove transactions for rollups, supply chains, and identity systems.

**FCM Agent:** `ZK Prover` — circuit pre-compilation, GPU-accelerated MSM/FFT, proof aggregation (BLS), verification cache.

---

#### 6. Real-Time Game Server Hosting
**Market:** $10B+ (Multiplayer infrastructure)

Sub-20ms latency game servers geo-distributed to players. Deterministic lockstep with anti-cheat heuristics.

**FCM Agent:** `Game Host` — deterministic lockstep, latency-compensated hitreg, geo-balanced matchmaking, state delta compression, anti-cheat heuristics.

---

#### 7. Scientific Computing Grid
**Market:** $4B+ (HPC, Research)

BOINC successor with crypto-economic incentives. Climate modeling, protein folding, drug discovery with academic bounty funding.

| Metric | Cloud HPC | FCM Grid | Savings |
|--------|-----------|----------|---------|
| 1000-node simulation | $5,000/hr | $800/hr | 84% |

**FCM Agent:** `Science Grid` — PDE-aware domain decomposition, checkpoint/restart, result cross-validation, BOINC credit system.

---

### Tier 3 — Privacy & Social Impact

#### 8. Privacy Infrastructure (Mixnet)
**Market:** $2B+ (Censorship-resistant communication)

Encrypted mixnet relays and censorship-resistant VPN exit nodes. Sphinx packet routing with reputation-weighted path selection.

**FCM Agent:** `Privacy Mesh` — onion layer encryption, Sphinx packet format, cover traffic generation, reputation-weighted paths, exit policy enforcement.

---

## 8 Expert Agents

Each agent operates with **zero LLM calls** on hot paths. All routing, scheduling, privacy, and game logic uses deterministic algorithms and cryptographic protocols.

| Agent | Core Algorithm | Latency Target | Stake |
|-------|---------------|----------------|-------|
| **Inference Router** | Hard-coded decision tree (VRAM → latency → batch → least-loaded) | < 12ms | 500 FCM |
| **Render Splitter** | Cartesian tile grid + Kahn topological sort | < 50ms | 500 FCM |
| **FL Coordinator** | Gaussian mechanism + Shamir MPC + trimmed mean | < 100ms | 1000 FCM |
| **Edge Runner** | Trie path match + LRU module cache + instance pool | < 10ms | 500 FCM |
| **ZK Prover** | Circuit hash → cached PK → GPU MSM/FFT | < 3s | 750 FCM |
| **Game Host** | Fixed-timestep lockstep + speed limit heuristics | < 20ms | 500 FCM |
| **Science Grid** | PDE-order stencil splitting + statistical consensus | < 100ms | 500 FCM |
| **Privacy Mesh** | Weighted random sample + Sphinx layer encryption | < 150ms | 1000 FCM |

**Performance targets:**
- Logic cache hit rate: 99.7%
- Average latency: 12ms (vs 200–800ms for LLM-based orchestration)
- LLM calls saved: 2.4M/hr at scale

---

## Implementation Phases

### Phase 1 — Foundation (Months 1–6)

**Goal:** Core runtime, identity, desktop clients

| Milestone | Status | Details |
|-----------|--------|---------|
| Rust core runtime | 🔲 | libp2p networking, task scheduler, WASM execution |
| IPFS DID implementation | 🔲 | Decentralized identity for all nodes |
| Solidity smart contracts | ✅ | FCMToken, AgentRegistry, TaskMarketplace |
| Dashboard UI | ✅ | Agent monitoring, live metrics, source viewer |
| CLI deployment tool | ✅ | `fcm-deploy` init, register, start/stop |
| GPU abstraction layer | 🔲 | CUDA + Vulkan backends via wgpu |
| Desktop clients | 🔲 | Windows, macOS, Linux node software |
| Docker orchestration | ✅ | All 8 agents containerized |

**Deliverables:**
- Deployable contracts on Base Sepolia testnet
- Working desktop node that joins the mesh
- AI inference demo on 3+ consumer GPUs

---

### Phase 2 — Expansion (Months 7–12)

**Goal:** Mobile clients, token launch, first production use case

| Milestone | Status | Details |
|-----------|--------|---------|
| Mobile clients | 🔲 | iOS (Swift) + Android (Kotlin) node apps |
| FCM token launch | 🔲 | L2 deployment (Arbitrum/Base), DEX listing |
| Location-based clustering | 🔲 | GeoHash precision 4–6, RTT probing |
| WASM runtime integration | 🔲 | Wasmtime engine, precompilation, cold-start < 10ms |
| AI inference marketplace | 🔲 | First production use case, API endpoints |
| Terraform infrastructure | ✅ | AWS GPU + Hetzner CPU + Azure TEE modules |
| Monitoring stack | ✅ | Prometheus + Grafana dashboards |

**Deliverables:**
- Production AI inference serving 100+ concurrent users
- Mobile node app (iOS + Android) with battery-aware compute
- FCM token live on L2 with staking enabled

---

### Phase 3 — Maturation (Months 13–18)

**Goal:** Enterprise features, TEE attestation, cross-chain

| Milestone | Details |
|-----------|---------|
| TEE attestation framework | Intel SGX/TDX, AMD SEV, Apple Secure Enclave verification |
| Federated learning toolkit | Hospital/bank onboarding, HIPAA-compliant data flow |
| IoT embedded client | Rust `no_std` + Lua for sensors, wearables, smart devices |
| Enterprise SLAs | Guaranteed uptime, dedicated capacity, support contracts |
| Cross-chain bridges | ETH, SOL, BTC asset transfers |
| Render farm marketplace | Blender/Unreal addon, frame distribution UI |

---

### Phase 4 — Ecosystem (Months 19–24)

**Goal:** DAO governance, full ecosystem, hardware partnerships

| Milestone | Details |
|-----------|---------|
| DAO governance | Token-weighted voting, Snapshot + Aragon integration |
| Game server hosting | Sub-20ms multiplayer, dynamic matchmaking |
| Scientific computing bounties | Academic partnerships, BOINC credit integration |
| Privacy mixnet | Censorship-resistant relay network |
| Hardware partnerships | NVIDIA, Apple, Qualcomm edge compute integration |
| IoT data marketplace | Sensor streams, smart city analytics |

---

## Economic Model

### FCM Token

- **Supply:** 1,000,000,000 FCM (deflationary via burn)
- **Staking:** 500–1000 FCM per agent registration
- **Slashing:** 30% of stake on Byzantine behavior
- **Fees:** 1% burn + 2% treasury on all transfers (configurable, max 10%)

### Token Flow

```
Compute Consumers ──FCM──→ Task Escrow (Registry Contract)
                                │
                                ↓
Compute Providers ←─FCM─── Reward Distribution
       ↑                              │
       └──── Stake/Slash ←────────────┘
```

### Cost Comparison

| Workload | AWS Cost | FCM Cost | Savings |
|----------|----------|----------|---------|
| LLM Inference (A100, 1hr) | $3.67 | $0.80 | 78% |
| Blender Render (1000 frames) | $450 | $90 | 80% |
| FL Training (100 nodes/round) | $2,000 | $400 | 80% |
| Edge Function (1M exec) | $20 | $4 | 80% |
| ZK Proof (1K proofs) | $50 | $4 | 92% |

---

## Security Model

| Layer | Mechanism |
|-------|-----------|
| **Identity** | IPFS DIDs + Ed25519 signatures |
| **Sybil Resistance** | Proof-of-stake + hardware attestation |
| **Byzantine Tolerance** | Redundant execution + voting consensus |
| **Data Privacy** | TEE enclaves (SGX/TDX/SEV) + encrypted memory |
| **Transport** | Noise Protocol (XX) over QUIC |
| **Consensus** | HotStuff BFT (regional supernodes) |
| **Payments** | ERC-20 on L2 + smart contract escrow |
| **Verification** | Merkle proofs + zk-SNARKs for result integrity |

---

## Key Differentiators

1. **True Decentralization** — No central servers; pure P2P mesh
2. **Universal Access** — From $50 Android phones to $50K server clusters
3. **Zero-LLM Hot Paths** — Deterministic algorithms, not AI guessing
4. **Cryptoeconomic Security** — Stake + reputation + TEE = trustless collaboration
5. **Performance-First** — Rust core, zero-copy networking, GPU-native kernels
6. **Use Case Agnostic** — AI, rendering, science, gaming, privacy infrastructure

---

## Success Metrics

| Metric | 6-Month Target | 12-Month Target | 24-Month Target |
|--------|---------------|-----------------|-----------------|
| Active nodes | 100 | 1,000 | 10,000 |
| Daily compute tasks | 500 | 10,000 | 100,000 |
| Concurrent AI inference users | 50 | 500 | 5,000 |
| Total staked FCM | 50,000 | 500,000 | 5,000,000 |
| Cost savings vs cloud (avg) | 50% | 70% | 80% |
| Average task latency | 100ms | 50ms | 20ms |
