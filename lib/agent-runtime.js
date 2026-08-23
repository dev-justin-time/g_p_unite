/**
 * FCM Agent Runtime — Real functional agent logic
 *
 * Connects to the blockchain, registers agents, submits heartbeats,
 * monitors for assignable tasks, and processes them.
 * Includes RPC retry with exponential backoff.
 */

const { ethers } = require("ethers");
const { withRetry, AGENT_TYPES, encodeCapabilities, computeDidHash, encodeGeohash } = require("./shared");
const { defaultLogger } = require("./logger");

const log = defaultLogger.child("agent-runtime");

const REGISTRY_ABI = [
    "function registerAgent(bytes32,string,bytes32,bytes32,uint8) external",
    "function heartbeat(bytes32,bytes32,uint256,bytes) external",
    "function claimTask(bytes32,bytes32) external",
    "function submitResult(bytes32,bytes32,bytes32) external",
    "function withdrawReward(bytes32) external",
    "function agents(bytes32) view returns (bytes32 didHash, string ipnsRecord, address operator, uint256 stake, uint256 reputation, uint256 registeredAt, uint256 lastHeartbeat, bytes32 capabilities, bytes32 geohash, bool isActive, uint8 agentType)",
    "function tasks(bytes32) view returns (bytes32 taskId, address requester, uint256 reward, uint256 deadline, bytes32 requirements, bytes32 inputCID, bytes32 outputCID, address assignedAgent, uint8 status, bytes32 proofHash, bool rewardWithdrawn)",
    "function agentListLength() view returns (uint256)",
    "function agentList(uint256) view returns (bytes32)",
];

const TOKEN_ABI = [
    "function approve(address,uint256) returns (bool)",
    "function transfer(address,uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
];

const DEFAULT_RETRY_OPTS = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
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
     * @param {Function} [config.processTask] - Async function to process a task
     * @param {Object} [config.retry] - Retry options override
     */
    constructor(config) {
        this.config = config;
        this.retryOpts = { ...DEFAULT_RETRY_OPTS, ...config.retry };
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
        this.wallet = new ethers.Wallet(config.privateKey, this.provider);
        this.registry = new ethers.Contract(config.registryAddress, REGISTRY_ABI, this.wallet);
        this.token = new ethers.Contract(config.tokenAddress, TOKEN_ABI, this.wallet);
        this.agentType = AGENT_TYPES[config.agentType];
        this.didHash = computeDidHash(config.agentName);
        this.running = false;
        this.heartbeatInterval = null;
        this.taskPollInterval = null;
        this._stats = { heartbeats: 0, tasksClaimed: 0, tasksCompleted: 0, errors: 0 };
    }

    /** Current wallet address */
    get address() {
        return this.wallet.address;
    }

    /** Get runtime statistics */
    get stats() {
        return { ...this._stats };
    }

    /** Register this agent on-chain (requires tokens for staking) */
    async register(stakeAmount) {
        const geohashBytes = encodeGeohash(this.config.geohash);
        const capabilitiesBytes = encodeCapabilities(this.config.capabilities);
        const ipnsRecord = `/ipns/k51qzi5uqu5dil0q8${this.config.agentType}`;

        log.info("Approving tokens for staking", { agent: this.config.agentName, amount: ethers.formatEther(stakeAmount) });

        await withRetry(async () => {
            const approveTx = await this.token.approve(
                await this.registry.getAddress(),
                stakeAmount
            );
            await approveTx.wait();
        }, this.retryOpts);

        log.info("Registering agent", { type: this.config.agentType, agentTypeCode: this.agentType });

        return await withRetry(async () => {
            const tx = await this.registry.registerAgent(
                this.didHash,
                ipnsRecord,
                capabilitiesBytes,
                geohashBytes,
                this.agentType
            );
            const receipt = await tx.wait();
            log.info("Agent registered", { tx: receipt.hash, didHash: this.didHash.slice(0, 16) });
            return receipt;
        }, this.retryOpts);
    }

    /** Submit a signed heartbeat to prove liveness */
    async submitHeartbeat() {
        const geohashBytes = encodeGeohash(this.config.geohash);
        // M-2: Increment nonce for heartbeat prediction prevention
        this._heartbeatNonce = (this._heartbeatNonce || 0) + 1;
        const nonce = this._heartbeatNonce;
        const now = Math.floor(Date.now() / 1000);
        const message = ethers.solidityPacked(
            ["bytes32", "bytes32", "uint256", "uint256"],
            [this.didHash, geohashBytes, nonce, now]
        );
        const hash = ethers.keccak256(message);
        const signature = await this.wallet.signMessage(ethers.getBytes(hash));

        return await withRetry(async () => {
            const tx = await this.registry.heartbeat(this.didHash, geohashBytes, nonce, signature);
            const receipt = await tx.wait();
            this._stats.heartbeats++;
            return receipt;
        }, this.retryOpts);
    }

    /** Check if this agent is registered and active */
    async isActive() {
        return await withRetry(async () => {
            const agent = await this.registry.agents(this.didHash);
            return agent.isActive;
        }, this.retryOpts);
    }

    /** Get agent's on-chain reputation */
    async getReputation() {
        return await withRetry(async () => {
            const agent = await this.registry.agents(this.didHash);
            return Number(agent.reputation);
        }, this.retryOpts);
    }

    /** Claim a specific task by ID */
    async claimTask(taskId) {
        log.info("Claiming task", { taskId: taskId.slice(0, 16), agent: this.config.agentName });
        return await withRetry(async () => {
            const tx = await this.registry.claimTask(taskId, this.didHash);
            const receipt = await tx.wait();
            this._stats.tasksClaimed++;
            log.info("Task claimed", { tx: receipt.hash });
            return receipt;
        }, this.retryOpts);
    }

    /** Submit result for a claimed task */
    async submitResult(taskId, outputCID, proofHash) {
        log.info("Submitting result", { taskId: taskId.slice(0, 16) });
        return await withRetry(async () => {
            const tx = await this.registry.submitResult(taskId, outputCID, proofHash);
            const receipt = await tx.wait();
            this._stats.tasksCompleted++;
            log.info("Result submitted", { tx: receipt.hash });
            return receipt;
        }, this.retryOpts);
    }

    /** Withdraw reward for a completed task */
    async withdrawReward(taskId) {
        log.info("Withdrawing reward", { taskId: taskId.slice(0, 16) });
        return await withRetry(async () => {
            const tx = await this.registry.withdrawReward(taskId);
            const receipt = await tx.wait();
            log.info("Reward withdrawn", { tx: receipt.hash });
            return receipt;
        }, this.retryOpts);
    }

    /** Get balance of FCM tokens */
    async getBalance() {
        return await withRetry(async () => {
            return await this.token.balanceOf(this.wallet.address);
        }, this.retryOpts);
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
        log.info("Starting runtime", { agent: this.config.agentName, heartbeatMs });

        // Submit initial heartbeat
        try {
            await this.submitHeartbeat();
            log.info("Initial heartbeat sent");
        } catch (e) {
            this._stats.errors++;
            log.error("Heartbeat failed", { error: e.message });
        }

        // Start heartbeat loop
        this.heartbeatInterval = setInterval(async () => {
            if (!this.running) return;
            try {
                await this.submitHeartbeat();
            } catch (e) {
                this._stats.errors++;
                log.error("Heartbeat error", { error: e.message });
            }
        }, heartbeatMs);

        // Listen for TaskCreated events to auto-claim matching tasks
        this.registry.on("TaskCreated", async (taskId, requester, reward) => {
            if (!this.running) return;
            try {
                const task = await this.registry.tasks(taskId);
                if (task.status !== 0) return; // Not open

                // Check capability match
                const match = (BigInt(encodeCapabilities(this.config.capabilities)) & BigInt(task.requirements)) === BigInt(task.requirements);
                if (!match) return;

                log.info("Matched task, claiming", { taskId: taskId.slice(0, 16), reward: ethers.formatEther(reward) });
                await this.claimTask(taskId);

                // Process if we have a processTask handler
                if (this.config.processTask) {
                    const result = await this.processTask(taskId, task.inputCID);
                    await this.submitResult(taskId, result.outputCID, result.proofHash);
                }
            } catch (e) {
                this._stats.errors++;
                log.error("Task handling error", { taskId: taskId.slice(0, 16), error: e.message });
            }
        });

        log.info("Runtime started, listening for tasks");
    }

    /** Stop the agent runtime */
    stop() {
        this.running = false;
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.registry.removeAllListeners();
        log.info("Runtime stopped", { stats: this._stats });
    }
}

module.exports = { AgentRuntime };
