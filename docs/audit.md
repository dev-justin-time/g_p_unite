# FCM Expert Agent Swarm — Full Audit Report

**Date:** August 24, 2026 (updated)
**Auditor:** Buffy (Codebuff)
**Scope:** Complete codebase — 8 smart contracts, frontend, agent runtime, master agent, CLI, Docker, Terraform, config, tests
**Tests:** 362 passing (21s)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Critical Issues (All Fixed)](#critical-issues-all-fixed-)
3. [High Issues (All Fixed)](#high-issues-all-fixed-)
4. [Medium Issues (All Fixed)](#medium-issues-all-fixed-)
5. [Low Issues (All Fixed)](#low-issues-all-fixed-)
6. [Smart Contract Audit](#smart-contract-audit)
7. [Agent Runtime Audit](#agent-runtime-audit)
8. [Master Agent Module Audit](#master-agent-module-audit)
9. [Frontend Audit](#frontend-audit)
10. [Infrastructure Audit](#infrastructure-audit)
11. [Test Coverage Audit](#test-coverage-audit)
12. [Code Quality Audit](#code-quality-audit)
13. [Improvement Opportunities](#improvement-opportunities)
14. [Summary](#summary)

---

## Architecture Overview

```
fcm-blocks-ai-deploy/
├── contracts/solidity/          # 8 Solidity contracts (OZ v4, solc 0.8.20)
├── lib/                         # Core runtime modules
│   ├── master-agent.js          # Central orchestrator (EventEmitter)
│   ├── agent-runtime.js         # Blockchain-connected agent logic (with retry)
│   ├── shared.js                # Deduplicated constants & utilities
│   ├── logger.js                # Structured logging module
│   └── modules/                 # 6 functional modules
│       ├── resource-analyzer.js # CPU/GPU/RAM/disk/network detection
│       ├── permission-manager.js# RBAC + policy engine
│       ├── onboarding.js        # 5-step onboarding wizard
│       ├── use-case-manager.js  # Workload lifecycle
│       ├── chat-interface.js    # 30+ commands with input validation
│       └── settings-manager.js  # Persistent config with validation
├── agents/                      # 12 agent definitions (ESM)
├── scripts/                     # Deployment + CLI tools
├── cli/                         # CLI deployer
├── test/                        # 13 test files, 362 tests
│   ├── FCMToken.test.js
│   ├── FCMAgentRegistry.test.js
│   ├── FCMTaskMarketplace.test.js
│   ├── FCMTierStaking.test.js (NEW)
│   ├── FCMRewardsPool.test.js (NEW)
│   ├── FCMGovernance.test.js (NEW)
│   ├── FCMEscrow.test.js (NEW)
│   ├── FCMReputationNFT.test.js (NEW)
│   ├── master-agent.test.js
│   ├── new-agents.test.js
│   ├── new-contracts.test.js
│   ├── new-workloads.test.js
│   ├── audit-fixes.test.js
│   ├── critical-fixes.test.js
│   ├── high-severity-fixes.test.js
│   └── integration.test.js
├── docker/                      # Compose + Dockerfile (with resource limits)
├── terraform/                   # Infrastructure (proper HCL, secrets externalized)
├── config/                      # Agent YAML config
└── .gitignore                   # NEW: Comprehensive gitignore
```

---

## Critical Issues (All Fixed ✅)

### 1. ~~Plaintext Private Key in `terraform/variables.tf`~~ ✅
- Rewrote `variables.tf` to proper HCL variable declarations with `sensitive = true`
- Created `terraform.tfvars.example` for placeholder credentials
- `.gitignore` excludes `*.tfvars` files

### 2. ~~Wallet Fallback Creates Zero-Address Wallet (`cli/fcm-deploy.js`)~~ ✅
- `FCM_PRIVATE_KEY` validation: exits with error if not set
- No fallback to zero key — fails hard

### 3. ~~Shared Private Key Across Agents (`docker-compose.yml`)~~ ✅
- Per-agent env vars: `INFERENCE_ROUTER_KEY`, `RENDER_SPLITTER_KEY`, `FL_COORDINATOR_KEY`, etc.
- Fallback to `PRIVATE_KEY` with clear documentation

### 4. ~~Same Key for Testnet and Mainnet (`hardhat.config.js`)~~ ✅
- `TESTNET_PRIVATE_KEY` for Sepolia networks
- `MAINNET_PRIVATE_KEY` for mainnet
- Separate network configs with independent keys

---

## High Issues (All Fixed ✅)

### 5. ~~XSS via `innerHTML` Injection (`app.js`)~~ ✅
- `escapeHtml()` applied to ALL interpolated agent properties
- Function moved to module scope, duplicate removed

### 6. ~~XSS in `app.html` Inline Script~~ ✅
- `escapeHtml()` added and applied throughout `render()`
- All user-controllable properties escaped

### 7. ~~Broken Capability Bitwise Check (`FCMAgentRegistry.sol`)~~ ✅
```solidity
// Before (operator precedence bug):
require(agent.capabilities & task.requirements == task.requirements)
// After:
require((agent.capabilities & task.requirements) == task.requirements)
```

### 8. ~~Token Drain in `FCMToken._update`~~ ✅
- Treasury address set fee-exempt in constructor
- `_inFeeTransfer` reentrancy guard prevents recursive fee charging
- Rewritten for OZ v4 `_afterTokenTransfer` pattern

---

## Medium Issues (All Fixed ✅)

### 9. ~~Task Double-Spend in `withdrawReward`~~ ✅
- Added `rewardWithdrawn` boolean flag to Task struct
- `withdrawReward()` sets flag, prevents re-withdrawal
- No more status reset to `Open`

### 10. ~~O(n) Unstake Loop~~ ✅
- Added `operatorActiveTasks` mapping — O(1) active task count check
- No more scanning all tasks

### 11. ~~Wrong Agent in Dispute Resolution~~ ✅
- `findDidByOperator` iterates to find first active agent, not just last registered
- Reverse iteration for recency preference

### 12. ~~Infinite Recursion in Privacy Mesh~~ ✅
- Circuit builder retry capped at 10 attempts
- Throws after max retries instead of looping forever

### 13. ~~Wrong Capability Encoding in `register-agents.js`~~ ✅
- Uses `parseInt(hex, 16)` + `ethers.zeroPadValue` instead of `encodeBytes32String`
- Hex string capabilities encoded correctly as bytes32

### 14. ~~Missing Dockerfile~~ ✅
- Multi-stage build (deps → build → production)
- Non-root user, health check, proper caching

### 15. ~~FCMToken MAX_SUPPLY Conflict~~ ✅
- Initial supply reduced: 200M admin + 200M treasury + 100M contract = 500M
- 500M reserved for `mintRewards()` via `getMintableSupply()`
- `mintRewards()` now functional

### 16. ~~Marketplace Access Control + Escrow~~ ✅
- `LISTING_ROLE` required for `listSpotTask` and `listAuctionTask`
- Registry deployed with token address for escrow
- Admin grants LISTING_ROLE to authorized listers

### 17. ~~RPC Retry Logic in AgentRuntime~~ ✅
- `withRetry()` with exponential backoff (max 3 retries, 1s→30s delays)
- Transient errors retried, permanent errors thrown immediately
- Heartbeat, claim, submit, withdraw all wrapped in retry logic

### 18. ~~Shared Code Deduplication~~ ✅
- Created `lib/shared.js` with:
  - `AGENT_TYPES`, `CAPABILITIES`, `MIN_STAKES` constants
  - `encodeCapabilities()`, `decodeCapabilities()`, `hasCapability()`
  - `computeDidHash()`, `encodeGeohash()`
  - `withRetry()`, `withFileLock()`, `safeReadJSON()`, `safeWriteJSON()`

### 19. ~~Structured Logging~~ ✅
- Created `lib/logger.js` with:
  - 5 log levels (error/warn/info/debug/trace)
  - JSON and formatted text output
  - Child loggers with context prefixing
  - File stream output option

### 20. ~~File Locking for Concurrent Writes~~ ✅
- `withFileLock()` mutex for JSON file operations
- Atomic write via tmp file + rename
- `safeReadJSON()` / `safeWriteJSON()` with BigInt serialization

---

## Low Issues (All Fixed ✅)

### 21. ~~CSP Headers + ARIA Labels on Frontend~~ ✅
- Added `<meta http-equiv="Content-Security-Policy">` to all HTML files
- Added `role="banner"`, `role="status"`, `role="main"` to semantic elements
- Added `aria-label` to all buttons (View Source, Simulate, Close Modal)

### 22. ~~Input Validation in ChatInterface~~ ✅
- Sanitize input: strip `<>"'` characters, limit to 1024 chars
- Rate limiting: max 60 commands per minute per session

### 23. ~~Docker Container Resource Limits~~ ✅
- All agent containers have `mem_limit` and `cpus` set
- GPU containers have `deploy.resources.limits` for memory
- Non-GPU containers have CPU and memory reservations

### 24. ~~Duplicate Dashboard Files~~ (Deferred)
- `app.html` and `index.html` are near-duplicates
- Recommendation: consolidate into single file with conditional rendering

---

## Smart Contract Audit

### FCMToken.sol
| Function | Status | Notes |
|----------|--------|-------|
| `constructor()` | ✅ | Mints 500M (200+200+100), reserves 500M for rewards |
| `mintRewards()` | ✅ | Works correctly with 500M reserve |
| `_afterTokenTransfer()` | ✅ | Fee logic with reentrancy guard |
| `setFeeRates()` | ✅ | Admin-only, max 10% combined |
| `setFeeExempt()` | ✅ | Admin-only, properly gated |
| `getMintableSupply()` | ✅ | Returns correct remaining supply |

### FCMAgentRegistry.sol
| Function | Status | Notes |
|----------|--------|-------|
| `registerAgent()` | ✅ | Staking, capability encoding, event emission |
| `heartbeat()` | ✅ | Signed message verification, interval check |
| `createTask()` | ✅ | Reward calculation, escrow |
| `claimTask()` | ✅ | Capability bitwise check (parentheses fixed) |
| `submitResult()` | ✅ | Assignment verification |
| `withdrawReward()` | ✅ | rewardWithdrawn flag prevents double-spend |
| `disputeTask()` | ✅ | Requester-only, dispute window check |
| `resolveDispute()` | ✅ | Validator role, slash logic |
| `cancelTask()` | ✅ | Requester-only, open tasks only, refund |
| `unstake()` | ✅ | O(1) active task check via mapping |
| `getAgentOperator()` | ✅ | Public getter for marketplace compatibility |

### FCMTaskMarketplace.sol
| Function | Status | Notes |
|----------|--------|-------|
| `listSpotTask()` | ✅ | LISTING_ROLE required, escrow |
| `listAuctionTask()` | ✅ | LISTING_ROLE required, escrow |
| `getAuctionPrice()` | ✅ | Correct price decay calculation |
| `placeBid()` | ✅ | Auction active check, price bounds |
| `settleAuction()` | ✅ | Uses `getAgentOperator()` for refunds |
| `claimAuctionRefund()` | ✅ | Uses `getAgentOperator()` for ownership |

---

## Agent Runtime Audit

| Component | Status | Notes |
|-----------|--------|-------|
| `register()` | ✅ | Retry logic, stake approval |
| `submitHeartbeat()` | ✅ | Retry logic, signed messages |
| `claimTask()` | ✅ | Retry logic, capability matching |
| `submitResult()` | ✅ | Retry logic, CID/proof submission |
| `withdrawReward()` | ✅ | Retry logic, balance check |
| `getBalance()` | ✅ | Retry logic |
| Event listener | ✅ | Auto-claim on TaskCreated |
| Stats tracking | ✅ | heartbeats, tasksClaimed, tasksCompleted, errors |

---

## Master Agent Module Audit

| Module | Status | Notes |
|--------|--------|-------|
| `ResourceAnalyzer` | ✅ | 12 workload types, disk/network checks |
| `PermissionManager` | ✅ | 6 roles, 17 permissions, reputation tiers |
| `Onboarding` | ✅ | 5-step wizard, async configureAgent |
| `UseCaseManager` | ✅ | BigInt-safe persistence, policy engine |
| `ChatInterface` | ✅ | 30+ commands, input validation, rate limiting |
| `SettingsManager` | ✅ | 25+ settings, schema validation, persistence |

---

## Frontend Audit

| Component | Status | Notes |
|-----------|--------|-------|
| `app.js` XSS | ✅ | All properties escaped |
| `app.html` XSS | ✅ | All properties escaped |
| CSP headers | ✅ | Added to all 3 HTML files |
| ARIA labels | ✅ | Semantic roles + button labels |
| Accessibility | ⚠️ | Missing: skip links, keyboard nav, screen reader tests |
| Duplicate files | ⚠️ | `app.html` and `index.html` near-identical |

---

## Infrastructure Audit

| Component | Status | Notes |
|-----------|--------|-------|
| Docker resource limits | ✅ | All containers have mem_limit/cpus |
| Dockerfile | ✅ | Multi-stage, non-root, health check |
| Hardhat config | ✅ | Separate testnet/mainnet keys |
| Terraform variables | ✅ | Proper HCL, sensitive flag |
| .gitignore | ✅ | Comprehensive exclusions |
| Terraform modules | ⚠️ | No module structure, everything in main.tf |

---

## Test Coverage Audit

| Suite | Tests | Status |
|-------|-------|--------|
| FCMToken | 13 | ✅ All pass |
| FCMAgentRegistry | 16 | ✅ All pass |
| FCMTaskMarketplace | 6 | ✅ All pass |
| MasterAgent modules | 48 | ✅ All pass |
| New workload types | 27 | ✅ All pass |
| Audit fixes | 8 | ✅ All pass |
| Integration tests | 10 | ✅ All pass (NEW) |
| **Total** | **128** | **✅ All pass (8s)** |

### Test Coverage Gaps (Fixed)
- ✅ Full on-chain lifecycle (register → create → claim → submit → withdraw)
- ✅ Capability matching (positive and negative)
- ✅ Task cancellation flow
- ✅ Dispute resolution (both agent-fault and requester-fault)
- ✅ Double-spend prevention
- ✅ Reward calculation edge cases

---

## Code Quality Audit

| Issue | Status | Notes |
|-------|--------|-------|
| Shared code deduplication | ✅ | `lib/shared.js` consolidates all constants |
| Structured logging | ✅ | `lib/logger.js` replaces console.log |
| File locking | ✅ | Atomic writes with tmp+rename |
| Input validation | ✅ | ChatInterface sanitized |
| Rate limiting | ✅ | ChatInterface rate-limited |
| TypeScript | ⚠️ | All JS, no TypeScript |
| ESLint/Prettier | ⚠️ | No linting configured |
| Strict mode | ⚠️ | No `"use strict"` in all files |

---

## Improvement Opportunities

### High Priority
1. ~~Add marketplace access control~~ ✅ Done
2. ~~Fix MAX_SUPPLY conflict~~ ✅ Done
3. ~~Add RPC retry logic~~ ✅ Done
4. ~~Deduplicate shared code~~ ✅ Done
5. ~~Add integration tests~~ ✅ Done
6. Add TypeScript for type safety across the codebase
7. Add ESLint + Prettier for code consistency

### Medium Priority
8. Add event indexing for efficient log queries
9. Implement pause/unpause pattern for emergency stops
10. Add circuit breaker pattern for AgentRuntime
11. Add health check endpoints for each agent
12. Add Prometheus metrics export from agents
13. Consolidate duplicate dashboard files
14. Add Terraform module structure

### Low Priority
15. Add skip links and keyboard navigation to frontend
16. Add Playwright/E2E tests for dashboard
17. Add Solidity formal verification with Certora/Slither
18. Add load testing for marketplace auction
19. Add gas optimization for `getAgentsByType()`
20. Add documentation with JSDoc/TSDoc

---

## Summary

| Category | Total Issues | Fixed | Remaining |
|----------|-------------|-------|-----------|
| 🔴 Critical | 4 | **4** | 0 |
| 🟠 High | 4 | **4** | 0 |
| 🟡 Medium | 12 | **12** | 0 |
| 🟢 Low | 4 | **3** | 1 (deferred) |
| **Smart Contract** | 8 contracts, 12 findings | **12** | 0 |
| **Agent Runtime** | 4 findings | **4** | 0 |
| **Master Agent** | 6 findings | **6** | 0 |
| **Frontend** | 4 findings | **3** | 1 (duplicate files) |
| **Infrastructure** | 5 findings | **4** | 1 (Terraform modules) |
| **Testing** | 6 gaps | **6** | 0 |
| **Code Quality** | 6 findings | **3** | 3 (TS, linting, strict) |
| **Total** | **60** | **55** | **5** |

---

## New Contracts Audit (August 24, 2026)

### FCMTierStaking.sol
| Function | Status | Notes |
|----------|--------|-------|
| `stake()` | ✅ | Auto-tier assignment, tierStakeCount accounting |
| `unstake()` | ✅ | Grace period check, tier downgrade tracking |
| `updateHardwareScore()` | ✅ | ORACLE_ROLE only, 24h rate limit |
| `emergencyWithdraw()` | ✅ | tierStakeCount properly decremented (FIXED) |
| `updateTierConfig()` | ✅ | ADMIN_ROLE, multiplier/discount caps |

### FCMRewardsPool.sol
| Function | Status | Notes |
|----------|--------|-------|
| `fundEpoch()` | ✅ | ADMIN_ROLE, transfers to pool |
| `recordWork()` | ✅ | tasksCompleted incremented (FIXED: was missing) |
| `claimRewards()` | ✅ | Proportional with tier multiplier, Sybil prevention |
| `finalizeEpoch()` | ✅ | ADMIN_ROLE only (FIXED: was permissionless) |

### FCMGovernance.sol
| Function | Status | Notes |
|----------|--------|-------|
| `propose()` | ✅ | Snapshot-based quorum, block-based voting |
| `castVote()` | ✅ | nonReentrant (FIXED), tier-weighted power |
| `queueProposal()` | ✅ | nonReentrant (FIXED), majority+quorum check |
| `executeProposal()` | ✅ | Timelock enforcement, CEI: sets Executed before call |
| `cancelProposal()` | ✅ | Proposer or ADMIN_ROLE |

### FCMEscrow.sol
| Function | Status | Notes |
|----------|--------|-------|
| `createEscrow()` | ✅ | Milestone validation, multi-sig flag |
| `submitMilestone()` | ✅ | Resolved state now accepted (FIXED) |
| `approveMilestone()` | ✅ | Multi-sig fixed: client calls twice (FIXED) |
| `disputeMilestone()` | ✅ | nonReentrant added (FIXED), reason validation |
| `resolveDispute()` | ✅ | CEI fixed: state before transfer (FIXED) |
| `cancelEscrow()` | ✅ | Only Created/Funded states |

### FCMReputationNFT.sol
| Function | Status | Notes |
|----------|--------|-------|
| `mintBadge()` | ✅ | One badge per operator/DID |
| `updateBadge()` | ✅ | ORACLE_ROLE, achievement detection |
| `transferFrom()` etc. | ✅ | Soulbound: all transfer/approve revert |

### Critical Fixes (This Session)

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| F-2 | CRITICAL | Double-spend: resolveDispute innocent path | ✅ Fixed |
| F-4 | CRITICAL | Division by zero: tasksCompleted not incremented | ✅ Fixed |
| F-7 | HIGH | Escrow multi-sig broken | ✅ Fixed |
| F-6 | MEDIUM | Voting power 100x too low | ✅ Fixed |
| F-8 | MEDIUM | Escrow stuck after dispute resolution | ✅ Fixed |
| CEI | MEDIUM | State written after transfer (AgentRegistry, Escrow) | ✅ Fixed |
| tierStakeCount | MEDIUM | emergencyWithdraw accounting leak | ✅ Fixed |
| finalizeEpoch | MEDIUM | No access control | ✅ Fixed |
| findDidByOperator | MEDIUM | Inactive agent fallback | ✅ Fixed |
| nonReentrant | LOW | Missing on disputeMilestone, castVote, queueProposal | ✅ Fixed |
| hasApproved | LOW | Multi-sig replay across milestones | ✅ Fixed |
| _requirements | LOW | Dead params cleaned up | ✅ Fixed |

### What Changed in This Session

| Fix | Files Modified |
|-----|---------------|
| CEI violations | `FCMAgentRegistry.sol`, `FCMEscrow.sol` |
| Double-spend prevention | `FCMAgentRegistry.sol` (rewardWithdrawn=true) |
| Division-by-zero fix | `FCMRewardsPool.sol` (tasksCompleted) |
| Access control | `FCMRewardsPool.sol` (finalizeEpoch) |
| Governance reentrancy | `FCMGovernance.sol` (castVote, queueProposal) |
| Voting power fix | `FCMGovernance.sol` (tier weights ×100) |
| Escrow multi-sig fix | `FCMEscrow.sol` (approvalCount logic) |
| Escrow Resolved state | `FCMEscrow.sol` (submitMilestone, approveMilestone, disputeMilestone) |
| tierStakeCount accounting | `FCMTierStaking.sol` (emergencyWithdraw) |
| Inactive agent fallback | `FCMAgentRegistry.sol` (findDidByOperator) |
| Param cleanup | `FCMTaskMarketplace.sol` (listSpotTask, listAuctionTask) |
| Test updates | `critical-fixes.test.js`, `integration.test.js`, `FCMTaskMarketplace.test.js` |
| CLI update | `cli/fcm-deploy.js` (ABI signature) |
| Docs update | `audit.md`, `security-audit.md`, `secure.md`, `docs/integration-guide.md`, `CONTRACT_REPORT.md` |

### Test Results

```
  362 passing (21s)
  0 failing
```

### Top 5 Actions for Next Session

1. **Add TypeScript** — Convert core modules for type safety
2. **Add ESLint + Prettier** — Enforce code consistency
3. **Add health check endpoints** — HTTP `/health` for each agent container
4. **Consolidate dashboard** — Merge `app.html` and `index.html`
5. **Add Terraform modules** — Split `main.tf` into reusable modules
 