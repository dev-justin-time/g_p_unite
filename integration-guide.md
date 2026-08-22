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

// List a spot task
await marketplace.listSpotTask(
    taskId,
    ethers.encodeBytes32String("gpu,cuda"),
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
