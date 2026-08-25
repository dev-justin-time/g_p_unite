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