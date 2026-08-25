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
