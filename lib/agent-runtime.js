/**
 * FCM Agent Runtime — Real functional agent logic
 *
 * Connects to the blockchain, registers agents, submits heartbeats,
 * monitors for assignable tasks, and processes them.
 */

const { ethers } = require("ethers");

const REGISTRY_ABI = [
    "function registerAgent(bytes32,string,bytes32,bytes32,uint8) external",
    "function heartbeat(bytes32,bytes32,bytes) external",
    "function claimTask(bytes32,bytes32) external",
    "function submitResult(bytes32,bytes32,bytes32) external",
    "function agents(bytes32) view returns (bytes32 didHash, string ipnsRecord, address operator, uint256 stake, uint256 reputation, uint256 registeredAt, uint256 lastHeartbeat, bytes32 capabilities, bytes32 geohash, bool isActive, uint8 agentType)",
    "function tasks(bytes32) view returns (bytes32 taskId, address requester, uint256 reward, uint256 deadline, bytes32 requirements, bytes32 inputCID, bytes32 outputCID, address assignedAgent, uint8 status, bytes32 proofHash, bool rewardWithdrawn)",
    "function agentList(uint256) view returns (bytes32)",
    "function agentListLength() view returns (uint256)",
];

const TOKEN_ABI = [
    "function approve(address,uint256) returns (bool)",
    "function transfer(address,uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
];

const AGENT_TYPES = {
    inference: 0, render: 1, federated_learning: 2, edge: 3,
    zk_prover: 4, game: 5, science: 6, privacy: 7,
};

class AgentRuntime {
    /**
     * @param {Object} config
     * @param {string} config.privateKey - Agent's private key
     * @param {string} config.rpcUrl - Blockchain RPC endpoint
     * @param {string} config.registryAddress - FCMAgentRegistry contract address
     * @param {string} config.tokenAddress - FCMToken contract address
     * @param {string} config.agentType - Agent type key (e.g. "inference")
     * @param {string} config.agentName - Human-readable agent name
     * @param {string} config.capabilities - Capabilities string (e.g. "gpu,cuda,avx512")
     * @param {string} config.geohash - GeoHash location (e.g. "u4pru")
     * @param {Function} config.processTask - Async function to process a task: (taskId, inputCID) => { outputCID, proofHash }
     */
    constructor(config) {
        this.config = config;
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
        this.wallet = new ethers.Wallet(config.privateKey, this.provider);
        this.registry = new ethers.Contract(config.registryAddress, REGISTRY_ABI, this.wallet);
        this.token = new ethers.Contract(config.tokenAddress, TOKEN_ABI, this.wallet);
        this.agentType = AGENT_TYPES[config.agentType];
        this.didHash = ethers.keccak256(ethers.toUtf8Bytes(config.agentName));
        this.running = false;
        this.heartbeatInterval = null;
        this.taskPollInterval = null;
    }

    /** Current wallet address */
    get address() {
        return this.wallet.address;
    }

    /** Register this agent on-chain (requires tokens for staking) */
    async register(stakeAmount) {
        const geohashBytes = ethers.encodeBytes32String(this.config.geohash);
        const capabilitiesBytes = ethers.encodeBytes32String(this.config.capabilities);
        const ipnsRecord = `/ipns/k51qzi5uqu5dil0q8${this.config.agentType}`;

        console.log(`[${this.config.agentName}] Approving ${ethers.formatEther(stakeAmount)} FCM for staking...`);
        const approveTx = await this.token.approve(
            await this.registry.getAddress(),
            stakeAmount
        );
        await approveTx.wait();

        console.log(`[${this.config.agentName}] Registering agent (type=${this.agentType})...`);
        const tx = await this.registry.registerAgent(
            this.didHash,
            ipnsRecord,
            capabilitiesBytes,
            geohashBytes,
            this.agentType
        );
        const receipt = await tx.wait();
        console.log(`[${this.config.agentName}] Registered! Tx: ${receipt.hash}`);
        return receipt;
    }

    /** Submit a signed heartbeat to prove liveness */
    async submitHeartbeat() {
        const geohashBytes = ethers.encodeBytes32String(this.config.geohash);
        const now = Math.floor(Date.now() / 1000);
        const message = ethers.solidityPacked(
            ["bytes32", "bytes32", "uint256"],
            [this.didHash, geohashBytes, now]
        );
        const hash = ethers.keccak256(message);
        const signature = await this.wallet.signMessage(ethers.getBytes(hash));

        const tx = await this.registry.heartbeat(this.didHash, geohashBytes, signature);
        const receipt = await tx.wait();
        return receipt;
    }

    /** Check if this agent is registered and active */
    async isActive() {
        const agent = await this.registry.agents(this.didHash);
        return agent.isActive;
    }

    /** Get agent's on-chain reputation */
    async getReputation() {
        const agent = await this.registry.agents(this.didHash);
        return Number(agent.reputation);
    }

    /** Poll for open tasks and claim one that matches our capabilities */
    async pollAndClaimTasks() {
        const capBytes = ethers.encodeBytes32String(this.config.capabilities);

        // Scan recent tasks (last 50)
        const listLen = await this.registry.agentListLength();
        const scanCount = Math.min(Number(listLen), 50);

        for (let i = 0; i < scanCount; i++) {
            try {
                const taskBytes = await this.registry.agentList(i);
                // This is an agent DID, not a task. We need to scan tasks differently.
                // For now, we rely on task IDs being known or emitted via events.
            } catch {
                break;
            }
        }
    }

    /** Claim a specific task by ID */
    async claimTask(taskId) {
        console.log(`[${this.config.agentName}] Claiming task ${taskId.slice(0, 16)}...`);
        const tx = await this.registry.claimTask(taskId, this.didHash);
        const receipt = await tx.wait();
        console.log(`[${this.config.agentName}] Task claimed! Tx: ${receipt.hash}`);
        return receipt;
    }

    /** Submit result for a claimed task */
    async submitResult(taskId, outputCID, proofHash) {
        console.log(`[${this.config.agentName}] Submitting result for task ${taskId.slice(0, 16)}...`);
        const tx = await this.registry.submitResult(taskId, outputCID, proofHash);
        const receipt = await tx.wait();
        console.log(`[${this.config.agentName}] Result submitted! Tx: ${receipt.hash}`);
        return receipt;
    }

    /** Process a task using the configured processTask function */
    async processTask(taskId, inputCID) {
        if (!this.config.processTask) {
            throw new Error("No processTask function configured");
        }
        return await this.config.processTask(taskId, inputCID);
    }

    /** Start the agent runtime (heartbeat + task polling) */
    async start(heartbeatMs = 120_000) {
        this.running = true;
        console.log(`[${this.config.agentName}] Starting runtime...`);

        // Submit initial heartbeat
        try {
            await this.submitHeartbeat();
            console.log(`[${this.config.agentName}] Initial heartbeat sent`);
        } catch (e) {
            console.error(`[${this.config.agentName}] Heartbeat failed:`, e.message);
        }

        // Start heartbeat loop
        this.heartbeatInterval = setInterval(async () => {
            if (!this.running) return;
            try {
                await this.submitHeartbeat();
            } catch (e) {
                console.error(`[${this.config.agentName}] Heartbeat error:`, e.message);
            }
        }, heartbeatMs);

        // Listen for TaskCreated events to auto-claim matching tasks
        this.registry.on("TaskCreated", async (taskId, requester, reward) => {
            if (!this.running) return;
            try {
                const task = await this.registry.tasks(taskId);
                if (task.status !== 0) return; // Not open

                // Check capability match
                const agentCap = ethers.encodeBytes32String(this.config.capabilities);
                const reqCap = task.requirements;
                const match = (BigInt(agentCap) & BigInt(reqCap)) === BigInt(reqCap);
                if (!match) return;

                await this.claimTask(taskId);

                // Process if we have a processTask handler
                if (this.config.processTask) {
                    const result = await this.processTask(taskId, task.inputCID);
                    await this.submitResult(taskId, result.outputCID, result.proofHash);
                }
            } catch (e) {
                console.error(`[${this.config.agentName}] Task handling error:`, e.message);
            }
        });

        console.log(`[${this.config.agentName}] Runtime started, listening for tasks...`);
    }

    /** Stop the agent runtime */
    stop() {
        this.running = false;
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.registry.removeAllListeners();
        console.log(`[${this.config.agentName}] Runtime stopped`);
    }
}

module.exports = { AgentRuntime, AGENT_TYPES };
