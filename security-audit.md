# FCM Security & Bug Audit Report

**Date:** August 22, 2026  
**Auditor:** Buffy (Codebuff)  
**Scope:** Full codebase — smart contracts, JS runtime, frontend, infrastructure  
**Tests:** 133 passing (8s)

---

## Executive Summary

| Severity | Found | Fixed | Remaining |
|----------|-------|-------|-----------|
| 🔴 **Critical** | 6 | 0 | **6** |
| 🟠 **High** | 11 | 0 | **11** |
| 🟡 **Medium** | 14 | 0 | **14** |
| 🟢 **Low** | 10 | 0 | **10** |
| **Total** | **41** | **0** | **41** |

**The codebase has 6 critical vulnerabilities that could lead to permanent fund loss. Immediate action required before any mainnet deployment.**

---

## 🔴 CRITICAL — Immediate Fix Required

### C-1: Task ID Collision Overwrites Escrowed Rewards
**File:** `FCMAgentRegistry.sol:createTask()`  
**Impact:** Permanent loss of escrowed tokens  
**CWE:** CWE-362 (Race Condition)

```solidity
function createTask(bytes32 _taskId, ...) external nonReentrant {
    require(_deadline > block.timestamp, "Invalid deadline");
    uint256 reward = calculateReward(_requirements);
    require(fcmToken.transferFrom(msg.sender, address(this), reward), "Reward escrow failed");
    tasks[_taskId] = Task({...}); // Overwrites existing task without refund
}
```

**Problem:** If two requesters call `createTask` with the same `_taskId`, the second call silently overwrites the first task. The first requester's escrowed reward is permanently locked in the contract with no way to recover it.

**Fix:** Add `require(tasks[_taskId].requester == address(0), "Task exists")` before writing.

---

### C-2: Agent Type Validation Rejects New Agent Types
**File:** `FCMAgentRegistry.sol:registerAgent()`  
**Impact:** node/storage/file_server/rewarded agents cannot register  
**CWE:** CWE-703 (Improper Check)

```solidity
require(_agentType <= 7, "Invalid agent type");
```

**Problem:** The JS code defines 12 agent types (0-11), but the contract only accepts types 0-7. Agents of type node(8), storage(9), file_server(10), and rewarded(11) will always fail registration.

**Fix:** Change to `require(_agentType <= 11, "Invalid agent type")` or better, use an enum.

---

### C-3: Spot Task Escrowed Tokens Are Permanently Locked
**File:** `FCMTaskMarketplace.sol:listSpotTask()`  
**Impact:** Lister loses all escrowed tokens  
**CWE:** CWE-400 (Uncontrolled Resource Consumption)

```solidity
function listSpotTask(...) external nonReentrant {
    require(fcmToken.transferFrom(msg.sender, address(this), _maxPrice), "Escrow failed");
    emit SpotTaskListed(_taskId, msg.sender, _maxPrice, _priority);
    // No task is actually created in the registry
    // No cancel/refund mechanism exists
}
```

**Problem:** `listSpotTask` escrows tokens but never creates a task in the registry and has no cancel/refund function. The lister's tokens are permanently locked.

**Fix:** Either create the task in the registry, or add a `cancelSpotTask()` function that refunds escrowed tokens.

---

### C-4: Marketplace Token Loss for Unregistered Agents
**File:** `FCMTaskMarketplace.sol:settleAuction()`  
**Impact:** Bidder's tokens permanently locked  
**CWE:** CWE-460 (Improper Cleanup)

```solidity
address agentAddr = registry.getAgentOperator(did);
if (agentAddr != address(0)) {
    // Refund sent...
}
// If agentAddr == address(0), tokens are LOST
```

**Problem:** If a bidder's agent was deregistered (unstaked) before auction settlement, their tokens cannot be refunded because `getAgentOperator` returns `address(0)`. The tokens are permanently locked in the marketplace contract.

**Fix:** Store the bidder's address directly in the `Bid` struct instead of looking it up from the registry.

---

### C-5: `mintRewards()` Allows Minting to Zero Address
**File:** `FCMToken.sol:mintRewards()`  
**Impact:** Permanent token burn (unrecoverable)  
**CWE:** CWE-704 (Incorrect Type Conversion)

```solidity
function mintRewards(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
    require(amount > 0, "Amount must be > 0");
    require(totalMintedRewards + amount <= MAX_SUPPLY - INITIAL_SUPPLY, "Mintable supply exceeded");
    _mint(to, amount); // No check: to != address(0)
}
```

**Problem:** Minting to `address(0)` permanently removes tokens from circulation. This burns the minted amount with no recovery mechanism.

**Fix:** Add `require(to != address(0), "Mint to zero address")`.

---

### C-6: Dispute Resolution Never Reverses Slashes
**File:** `FCMAgentRegistry.sol:resolveDispute()`  
**Impact:** Agent loses stake even when found innocent  
**CWE:** CWE-670 (Always-Incorrect Control Flow)

```solidity
if (_agentFault) {
    // Slash agent...
} else {
    // Agent is innocent — just pay reward, but DON'T reverse slash
    require(fcmToken.transfer(task.assignedAgent, task.reward), "Transfer failed");
    task.status = TaskStatus.Completed;
}
```

**Problem:** If a task goes through Disputed → agent found innocent (not fault), the task status is set back to Completed. But if the agent was previously slashed during a different dispute, there's no mechanism to reverse slashes. More critically, the dispute can be re-opened because status is reset to Completed, allowing the requester to dispute again indefinitely.

**Fix:** Add a `disputeResolved` flag, or change the status to a terminal `Resolved` state.

---

## 🟠 HIGH — Fix Before Mainnet

### H-1: All Agents Share Same Private Key
**File:** `lib/master-agent.js:registerAgent()`  
**Impact:** Compromised key exposes all agent identities  
**CWE:** CWE-798 (Hardcoded Credentials)

```javascript
const runtime = new AgentRuntime({
    privateKey: this.wallet?.privateKey || process.env.FCM_PRIVATE_KEY,
    // Every agent uses the same key
});
```

**Problem:** All agents sign transactions and heartbeats with the same private key. If any agent's key is exposed, all agent identities are compromised. Heartbeats from one agent could be replayed by another.

**Fix:** Generate or load unique keypairs per agent.

---

### H-2: `operatorActiveTasks` Counter Underflow Risk
**File:** `FCMAgentRegistry.sol`  
**Impact:** Counter corruption, agent locked from unstaking  
**CWE:** CWE-191 (Integer Underflow)

```solidity
function submitResult(bytes32 _taskId, ...) external nonReentrant {
    // ...
    operatorActiveTasks[msg.sender]--; // No underflow check
}
```

**Problem:** If `submitResult` is called when the counter is already 0 (possible via direct contract call bypassing the JS runtime), the counter underflows to `type(uint256).max`. The agent can never unstake because `operatorActiveTasks[msg.sender] != 0` forever.

**Fix:** Add `require(operatorActiveTasks[msg.sender] > 0, "No active tasks")` before decrement.

---

### H-3: No Deadline for Dispute Resolution
**File:** `FCMAgentRegistry.sol:resolveDispute()`  
**Impact:** Escrowed rewards locked indefinitely  
**CWE:** CWE-835 (Infinite Loop)

**Problem:** Once a task enters `Disputed` status, there is no time limit for the validator to resolve it. If the validator goes offline, the escrowed reward is permanently locked.

**Fix:** Add a `DISPUTE_RESOLUTION_DEADLINE` (e.g., 7 days) and allow the requester or agent to claim a refund if the dispute is unresolved after the deadline.

---

### H-4: Chat `handleGrant` Has No Authorization Check
**File:** `lib/modules/chat-interface.js:handleGrant()`  
**Impact:** Any user can grant permissions to any address  
**CWE:** CWE-862 (Missing Authorization)

```javascript
async handleGrant(args) {
    if (args.length < 2) return { text: "Usage: grant <address> <permission>", type: "info" };
    this.master.permissionManager.grantPermission(args[0], args[1]);
    // No check: does the caller have permission to grant?
}
```

**Problem:** Any user (even viewers) can grant arbitrary permissions to any address via the chat interface. There is no permission check on the caller.

**Fix:** Check `this.master.permissionManager.hasPermission(callerAddress, 'system:config')` before granting.

---

### H-5: `handleBan` Has No Authorization Check
**File:** `lib/modules/chat-interface.js:handleBan()`  
**Impact:** Any user can ban any other user  
**CWE:** CWE-862 (Missing Authorization)

Same pattern as H-4. No caller permission check before banning.

---

### H-6: Settings `import()` Bypasses Schema Validation
**File:** `lib/modules/settings-manager.js:import()`  
**Impact:** Bypass min/max/enum validation  
**CWE:** CWE-20 (Improper Input Validation)

```javascript
import(jsonString) {
    const data = JSON.parse(jsonString);
    for (const [key, value] of Object.entries(data)) {
        this.set(key, value); // set() validates, but...
    }
}
```

**Problem:** While `set()` does validate, the `import()` function doesn't validate the JSON structure itself. A malformed import could set unexpected keys that bypass schema checks. Additionally, there's no permission check on who can import settings.

**Fix:** Add permission check and validate JSON structure before importing.

---

### H-7: Prototype Pollution Risk in Settings Import
**File:** `lib/modules/settings-manager.js:import()`  
**Impact:** Potential RCE via prototype pollution  
**CWE:** CWE-1321 (Prototype Pollution)

```javascript
for (const [key, value] of Object.entries(data)) {
    this.set(key, value);
}
```

**Problem:** If `data` contains `__proto__` or `constructor` keys, they could pollute the Object prototype, affecting all objects in the process.

**Fix:** Filter out `__proto__`, `constructor`, and `prototype` keys before processing.

---

### H-8: PermissionManager Race Condition on File Writes
**File:** `lib/modules/permission-manager.js:_save()`  
**Impact:** Corrupted permissions JSON file  
**CWE:** CWE-362 (Race Condition)

```javascript
_save() {
    fs.writeFileSync(this.configPath, JSON.stringify({...}));
}
```

**Problem:** Multiple concurrent calls to `addUser()`, `grantPermission()`, `banUser()`, etc. can interleave their `fs.writeFileSync()` calls, corrupting the JSON file. The `withFileLock` utility exists in `shared.js` but is not used here.

**Fix:** Use `safeWriteJSON()` from `shared.js` instead of raw `fs.writeFileSync()`.

---

### H-9: Same Race Condition in UseCaseManager
**File:** `lib/modules/use-case-manager.js:_save()`  
**Impact:** Corrupted use cases JSON file  
**CWE:** CWE-362 (Race Condition)

Same issue as H-8. Uses `fs.writeFileSync()` without locking.

---

### H-10: Same Race Condition in SettingsManager
**File:** `lib/modules/settings-manager.js:_save()`  
**Impact:** Corrupted settings JSON file  
**CWE:** CWE-362 (Race Condition)

Same issue as H-8. Uses `fs.writeFileSync()` without locking.

---

### H-11: `_naturalLanguageHandler` Uses Unsanitized Input
**File:** `lib/modules/chat-interface.js:_naturalLanguageHandler()`  
**Impact:** Regex DoS potential  
**CWE:** CWE-1333 (ReDoS)

```javascript
async _naturalLanguageHandler(message) {
    const lower = message.toLowerCase();
    if (/^(hi|hello|hey|howdy|greetings)/i.test(lower)) { ... }
```

**Problem:** The NL handler receives the raw `trimmed` message (not the `sanitized` version). While the current regex patterns are simple, this creates a precedent where unsanitized input is processed. A malicious regex pattern in future could be exploited.

**Fix:** Pass `sanitized` to the NL handler, or ensure all regex patterns are safe.

---

## 🟡 MEDIUM — Fix Before Production

### M-1: `resolveDispute` Agent-Innocent Path Re-opens Task
**File:** `FCMAgentRegistry.sol:resolveDispute()`  
**Impact:** Unlimited dispute cycling  
**CWE:** CWE-670

When `_agentFault = false`, the task status is set back to `Completed`. This means the requester can dispute again, creating an infinite dispute loop.

**Fix:** Set status to a terminal `Resolved` state after dispute resolution.

---

### M-2: Heartbeat Timestamp Prediction
**File:** `FCMAgentRegistry.sol:heartbeat()`  
**Impact:** Liveness proof can be forged  
**CWE:** CWE-330 (Insufficient Randomness)

```solidity
bytes32 message = keccak256(abi.encodePacked(_didHash, _geohash, block.timestamp));
```

The heartbeat uses `block.timestamp` which is predictable. An attacker could pre-compute and submit heartbeats for an offline agent.

**Fix:** Include a nonce or epoch counter that only increments on valid heartbeats.

---

### M-3: `calculateReward` Is Deterministic and Predictable
**File:** `FCMAgentRegistry.sol:calculateReward()`  
**Impact:** Reward manipulation  
**CWE:** CWE-330

```solidity
function calculateReward(bytes32 _requirements) public pure returns (uint256) {
    uint256 base = 100 * 10**18;
    uint256 complexity = uint256(_requirements) % 100;
    return base + (complexity * 10**18);
}
```

**Problem:** Any requester can compute the exact reward before creating a task. By choosing `_requirements` values, they can minimize the reward (complexity 0 = 100 FCM) while potentially requesting expensive work.

**Fix:** Allow the requester to specify a custom reward, or use a more complex pricing model.

---

### M-4: No Agent Re-registration After Unstake
**File:** `FCMAgentRegistry.sol:unstake()`  
**Impact:** Permanent ban after unstaking  
**CWE:** CWE-670

After `unstake()`, `agent.isActive = false` and `agent.stake = 0`. But the agent entry still exists with `operator != address(0)`, so `registerAgent()` will fail with "Agent exists". The agent can never re-register.

**Fix:** Either delete the agent entry on unstake, or allow re-registration with a new stake.

---

### M-5: `getAgentsByType` Gas Limit DoS
**File:** `FCMAgentRegistry.sol:getAgentsByType()`  
**Impact:** Out-of-gas on large agent lists  
**CWE:** CWE-400

```solidity
function getAgentsByType(uint8 _agentType) external view returns (bytes32[] memory) {
    bytes32[] memory result = new bytes32[](agentList.length);
    for (uint i = 0; i < agentList.length; i++) { ... }
}
```

**Problem:** Allocates an array sized to the full `agentList.length` regardless of how many match. With thousands of agents, this will run out of gas.

**Fix:** Use a two-pass approach: first count matches, then allocate exact size.

---

### M-6: `cancelTask` Uses `Slashed` Status
**File:** `FCMAgentRegistry.sol:cancelTask()`  
**Impact:** Confusing status semantics  
**CWE:** CWE-704

```solidity
task.status = TaskStatus.Slashed; // Used for cancellation too
```

**Problem:** `Slashed` status is used for both dispute-slashes and cancellations. This makes it impossible to distinguish between a malicious agent and a cancelled task.

**Fix:** Add a `Cancelled` status to the enum.

---

### M-7: Frontend `onclick` Attribute Injection
**File:** `app.js`, `app.html`  
**Impact:** Potential XSS via HTML attribute injection  
**CWE:** CWE-79

```javascript
onclick="simulate('${escapeHtml(agent.id)}')"
```

Even with `escapeHtml()`, the value is interpolated into an HTML attribute. If `agent.id` contains `');alert(1)//`, the `escapeHtml` function converts `'` to `&#039;` which is safe in HTML but could be exploited in certain edge cases with character encoding.

**Fix:** Use `addEventListener` instead of inline `onclick` handlers.

---

### M-8: CSP `'unsafe-inline'` Defeats XSS Protection
**File:** `app.html`, `index.html`  
**Impact:** CSP does not prevent XSS  
**CWE:** CWE-693

```html
<meta http-equiv="Content-Security-Policy" content="script-src 'unsafe-inline'">
```

**Problem:** `'unsafe-inline'` allows all inline scripts, which is the primary XSS vector. The CSP provides no meaningful protection against script injection.

**Fix:** Use nonce-based CSP (`script-src 'nonce-...'`) or move all scripts to external files.

---

### M-9: Docker Containers May Run as Root
**File:** `docker/docker-compose.yml`  
**Impact:** Container escape risk  
**CWE:** CWE-250

The Dockerfile creates a non-root user, but `docker-compose.yml` doesn't specify `user:` for any service. If the Dockerfile's `USER` directive is ignored or overridden, containers run as root.

**Fix:** Add `user: fcm:fcm` to each service in docker-compose.yml.

---

### M-10: Prometheus/Grafana Exposed Without Authentication
**File:** `docker/docker-compose.yml`  
**Impact:** System metrics exposed to network  
**CWE:** CWE-306

```yaml
prometheus:
  ports: ["9090:9090"]
grafana:
  ports: ["3000:3000"]
```

**Problem:** Prometheus (9090) and Grafana (3000) are exposed on all interfaces with no authentication. Anyone on the network can access system metrics and potentially modify dashboards.

**Fix:** Bind to localhost only (`127.0.0.1:9090:9090`) or add authentication.

---

### M-11: `Onboarding._getUser` Auto-Creates Users
**File:** `lib/modules/permission-manager.js:_getUser()`  
**Impact:** Unintended user creation  
**CWE:** CWE-863

```javascript
_getUser(address) {
    const normalized = address.toLowerCase();
    if (!this.users.has(normalized)) {
        this.addUser(normalized); // Auto-creates as CONSUMER
    }
    return this.users.get(normalized);
}
```

**Problem:** Any function that calls `_getUser()` (including `hasPermission()`, `updateReputation()`, etc.) silently creates new users. This can inflate user counts and grant default permissions.

**Fix:** Separate lookup from creation. Return `null` for unknown users instead of auto-creating.

---

### M-12: UseCaseManager `suspendUseCase` Missing Permission Check
**File:** `lib/modules/use-case-manager.js:suspendUseCase()`  
**Impact:** Any user can suspend approved use cases  
**CWE:** CWE-862

```javascript
suspendUseCase(useCaseId, reviewer, reason) {
    const uc = this._getUseCase(useCaseId);
    uc.status = APPROVAL_STATUS.SUSPENDED;
    // No permission check!
}
```

**Problem:** Unlike `approveUseCase` and `rejectUseCase`, `suspendUseCase` doesn't verify the reviewer has `system:config` permission.

**Fix:** Add `this.permissionManager?.requirePermission(reviewer, "system:config")`.

---

### M-13: BigInt Comparison Bug in `evaluateUseCase`
**File:** `lib/modules/use-case-manager.js:evaluateUseCase()`  
**Impact:** Reward limit check always passes  
**CWE:** CWE-697

```javascript
if (useCase.estimatedCost > this.resourceLimits.maxRewardPerTask) {
```

**Problem:** `estimatedCost` is stored as a string (`"0"` by default) and `maxRewardPerTask` is a BigInt. The `>` comparison between a string and BigInt doesn't work as expected in JavaScript.

**Fix:** Parse `estimatedCost` to BigInt before comparison: `BigInt(ethers.parseEther(useCase.estimatedCost || "0")) > this.resourceLimits.maxRewardPerTask`.

---

### M-14: `recover()` Without `toEthSignedMessageHash` Prefix
**File:** `FCMAgentRegistry.sol:heartbeat()`  
**Impact:** Signature verification mismatch  
**CWE:** CWE-347

```solidity
bytes32 message = keccak256(abi.encodePacked(_didHash, _geohash, block.timestamp));
address signer = message.toEthSignedMessageHash().recover(_signature);
```

This is actually correct — `toEthSignedMessageHash()` adds the `\x19Ethereum Signed Message` prefix. However, the JS `agent-runtime.js` signs the hash directly:

```javascript
const hash = ethers.keccak256(message);
const signature = await this.wallet.signMessage(ethers.getBytes(hash));
```

`wallet.signMessage()` automatically adds the Ethereum prefix, so the contract's `toEthSignedMessageHash()` double-prefixes. This should work because `signMessage` hashes the input and adds the prefix, and the contract does the same. But this is fragile and depends on exact ethers.js behavior.

**Fix:** Document the signing scheme clearly or use `ethers.signTypedData` for EIP-712.

---

## 🟢 LOW — Best Practice Improvements

### L-1: No Emergency Pause on Contracts
No `Pausable` pattern on any contract. If a vulnerability is discovered, there's no way to halt operations.

### L-2: No Event Indexing for Task Search
`TaskCreated` event only indexes `taskId`. Searching by requester or agent requires scanning all events.

### L-3: `receive() external payable {}` on Token Contract
`FCMToken` accepts ETH with no use case. This could lead to accidentally sent ETH being locked.

### L-4: No Gas Limit on `getAgentsByType` Return
The assembly-terminated array return is fragile. Use `push()` instead.

### L-5: Hardcoded `DISPUTE_WINDOW = 86400`
No governance mechanism to adjust the dispute window. Should be configurable.

### L-6: No Minimum Stake Tier System
All agents pay the same `MIN_STAKE = 500 FCM` regardless of agent type. The JS code has tiered stakes but the contract doesn't enforce them.

### L-7: Logger Writes to stdout AND file
`Logger._write()` writes to both the file stream and stdout, causing duplicate output in production.

### L-8: `safeWriteJSON` Atomicity Not Guaranteed on Windows
`fs.rename()` is not atomic on Windows. The tmp+rename pattern may fail.

### L-9: No Graceful Degradation for Missing RPC
`AgentRuntime` constructor immediately creates a provider and wallet. If the RPC is unreachable, the error only surfaces on the first transaction.

### L-10: Chat History Stored in Memory Only
Chat history is lost on restart. Should persist to disk for audit trails.

---

## Vulnerability Detail — Attack Scenarios

### Scenario 1: Task ID Collision Attack
1. Attacker monitors mempool for `createTask` transactions
2. Before the victim's tx confirms, attacker submits `createTask` with the same `_taskId`
3. If attacker's tx confirms first, victim's tx overwrites the task
4. Victim's escrowed reward is permanently locked

### Scenario 2: Auction Refund Theft
1. Attacker registers agent, places bid in auction
2. Attacker unstakes (deregisters) agent
3. When auction settles, `getAgentOperator(did)` returns `address(0)`
4. Attacker's bid tokens are permanently locked in marketplace

### Scenario 3: Dispute Spam
1. Requester creates task, agent completes it
2. Requester disputes with fabricated reason
3. Validator resolves in agent's favor (status → Completed)
4. Requester disputes AGAIN (status is Completed again)
5. Repeat indefinitely, locking agent's time and potentially stake

### Scenario 4: Chat Permission Escalation
1. Low-privilege user sends `grant <their-address> system:config`
2. `handleGrant` has no permission check
3. User now has admin permissions
4. User promotes themselves to SUPER_ADMIN

---

## Priority Fix Order

| Priority | Fix | Effort | Impact |
|----------|-----|--------|--------|
| **P0** | C-1: Task ID collision | 5 min | Prevents fund loss |
| **P0** | C-2: Agent type validation | 2 min | Enables new agents |
| **P0** | C-3: Spot task refund | 30 min | Prevents fund loss |
| **P0** | C-4: Auction refund for deregistered agents | 20 min | Prevents fund loss |
| **P0** | C-5: Mint to zero address | 2 min | Prevents token burn |
| **P0** | C-6: Dispute resolution terminal state | 15 min | Prevents abuse |
| **P1** | H-1: Per-agent keys | 1 hr | Identity security |
| **P1** | H-2: Counter underflow | 5 min | Prevents lockout |
| **P1** | H-3: Dispute deadline | 30 min | Prevents fund lock |
| **P1** | H-4/H-5: Chat authorization | 10 min | Privilege escalation |
| **P1** | H-8/H-9/H-10: File locking | 30 min | Data integrity |
| **P2** | M-1 through M-14 | 2-4 hrs | Various |
| **P3** | L-1 through L-10 | 1-2 days | Best practices |

---

## Recommended Next Steps

1. **Fix all P0 issues immediately** — These are exploitable and lead to fund loss
2. **Add Slither to CI** — Automated static analysis for every PR
3. **Get a professional audit** — Trail of Bits, OpenZeppelin, or Consensys Diligence
4. **Deploy to testnet first** — Run a full testnet cycle before mainnet
5. **Add bug bounty program** — Incentivize white-hat discovery
