/**
 * FCM Master Agent — Central orchestrator for the Federated Compute Mesh
 *
 * Coordinates all subsystems: onboarding, resource analysis, permissions,
 * use case management, agent lifecycle, chat interface, and settings.
 *
 * This is the single entry point for all platform interactions.
 */

const { ethers } = require("ethers");
const { randomBytes } = require("crypto");
const { EventEmitter } = require("events");
const { ResourceAnalyzer } = require("./modules/resource-analyzer");
const { PermissionManager, ROLES, PERMISSIONS } = require("./modules/permission-manager");
const { Onboarding } = require("./modules/onboarding");
const { UseCaseManager, USE_CASE_CATEGORIES } = require("./modules/use-case-manager");
const { ChatInterface } = require("./modules/chat-interface");
const { SettingsManager } = require("./modules/settings-manager");
const { DashboardServer } = require("./modules/dashboard-server");
const { RestApiServer } = require("./modules/rest-api");
const { AgentRuntime } = require("./agent-runtime");

// ── Agent States ────────────────────────────────────────────────

const AGENT_STATE = {
    CREATED: "created",
    REGISTERING: "registering",
    ACTIVE: "active",
    HEARTBEATING: "heartbeating",
    PROCESSING: "processing",
    STOPPING: "stopping",
    STOPPED: "stopped",
    ERROR: "error",
};

class MasterAgent extends EventEmitter {
    /**
     * @param {Object} config
     * @param {string} config.privateKey - Admin wallet private key
     * @param {string} config.rpcUrl - Blockchain RPC URL
     * @param {string} config.registryAddress - Registry contract address
     * @param {string} config.tokenAddress - Token contract address
     * @param {string} config.dataDir - Directory for persistent data
     */
    constructor(config = {}) {
        super();

        this.rpcUrl = config.rpcUrl || process.env.FCM_RPC_URL || "http://localhost:8545";
        this.registryAddress = config.registryAddress || process.env.FCM_REGISTRY || "";
        this.tokenAddress = config.tokenAddress || process.env.FCM_TOKEN || "";
        this.dataDir = config.dataDir || process.cwd();

        // Wallet
        this.wallet = null;
        this.adminAddress = "";
        if (config.privateKey || process.env.FCM_PRIVATE_KEY) {
            const provider = new ethers.JsonRpcProvider(this.rpcUrl);
            this.wallet = new ethers.Wallet(config.privateKey || process.env.FCM_PRIVATE_KEY, provider);
            this.adminAddress = this.wallet.address;
        }

        // Contracts
        this.registryContract = null;
        this.tokenContract = null;

        // Modules
        this.resourceAnalyzer = new ResourceAnalyzer();
        this.permissionManager = new PermissionManager(
            require("path").join(this.dataDir, ".fcm-permissions.json")
        );
        this.onboarding = new Onboarding({
            permissionManager: this.permissionManager,
            registryAddress: this.registryAddress,
            tokenAddress: this.tokenAddress,
            rpcUrl: this.rpcUrl,
        });
        this.useCaseManager = new UseCaseManager({
            permissionManager: this.permissionManager,
            configPath: require("path").join(this.dataDir, ".fcm-usecases.json"),
        });
        this.settingsManager = new SettingsManager(
            require("path").join(this.dataDir, ".fcm-settings.json")
        );
        this.chat = new ChatInterface(this);

        // Dashboard server
        this.dashboard = new DashboardServer(this, {
            port: this.settingsManager.get("dashboard.port"),
            host: "127.0.0.1",
        });

        // REST API server
        this.restApi = new RestApiServer(this, {
            port: parseInt(process.env.FCM_API_PORT) || 3000,
            host: "127.0.0.1",
        });

        // Agent tracking
        this.agents = new Map();      // id → { runtime, config, state }
        this.agentCounter = 0;

        // Startup time
        this.startTime = Date.now();
    }

    // ── Initialization ──────────────────────────────────────────

    /**
     * Initialize the master agent — connect to contracts, analyze system
     */
    async initialize() {
        this.emit("initializing");

        // Analyze system resources
        const profile = await this.resourceAnalyzer.analyze();
        this.emit("resources_analyzed", profile);

        // Connect to contracts if addresses provided
        if (this.registryAddress && this.wallet) {
            const REGISTRY_ABI = [
                "function registerAgent(bytes32,string,bytes32,bytes32,uint8) external",
                "function heartbeat(bytes32,bytes32,uint256,bytes) external",
                "function claimTask(bytes32,bytes32) external",
                "function submitResult(bytes32,bytes32,bytes32) external",
                "function agents(bytes32) view returns (bytes32,string,address,uint256,uint256,uint256,uint256,bytes32,bytes32,bool,uint8)",
                "function tasks(bytes32) view returns (bytes32,address,uint256,uint256,bytes32,bytes32,bytes32,address,uint8,bytes32,bool,uint256,bytes32)",
                "function agentListLength() view returns (uint256)",
                "event TaskCreated(bytes32 indexed, address, uint256)",
            ];
            this.registryContract = new ethers.Contract(this.registryAddress, REGISTRY_ABI, this.wallet);
        }

        if (this.tokenAddress && this.wallet) {
            const TOKEN_ABI = [
                "function approve(address,uint256) returns (bool)",
                "function transfer(address,uint256) returns (bool)",
                "function balanceOf(address) view returns (uint256)",
                "function allowance(address,address) view returns (uint256)",
            ];
            this.tokenContract = new ethers.Contract(this.tokenAddress, TOKEN_ABI, this.wallet);
        }

        // Register admin user
        if (this.adminAddress) {
            this.permissionManager.addUser(this.adminAddress, ROLES.SUPER_ADMIN);
        }

        this.emit("initialized", {
            address: this.adminAddress,
            systemScore: profile.score,
            capabilities: profile.capabilities,
        });

        return {
            success: true,
            address: this.adminAddress,
            systemScore: profile.score,
            capabilities: profile.capabilities,
        };
    }

    // ── Agent Lifecycle ─────────────────────────────────────────

    /**
     * Register a new agent
     */
    async registerAgent(options) {
        const { workloadType, agentName, geohash, capabilities } = options;

        // Check permissions
        if (this.adminAddress) {
            this.permissionManager.requirePermission(this.adminAddress, PERMISSIONS.AGENT_REGISTER);
        }

        // Resource check
        const resourceCheck = this.resourceAnalyzer.meetsRequirements(workloadType);
        if (!resourceCheck.eligible) {
            return { success: false, message: `Cannot register ${workloadType}: ${resourceCheck.reason}` };
        }

        // Create agent runtime with unique key
        const id = `agent-${++this.agentCounter}`;
        const agentWallet = ethers.Wallet.createRandom();
        const runtime = new AgentRuntime({
            privateKey: agentWallet.privateKey,
            rpcUrl: this.rpcUrl,
            registryAddress: this.registryAddress,
            tokenAddress: this.tokenAddress,
            agentType: workloadType,
            agentName: agentName || id,
            capabilities: capabilities || this._detectCapabilities(workloadType),
            geohash: geohash || this.settingsManager.get("agent.defaultGeohash"),
            processTask: options.processTask,
        });

        const agentEntry = {
            id,
            runtime,
            wallet: agentWallet.address,
            name: agentName || id,
            type: workloadType,
            capabilities: runtime.config.capabilities,
            didHash: runtime.didHash,
            stake: this._getStakeAmount(workloadType),
            state: AGENT_STATE.CREATED,
            active: false,
            registeredAt: new Date().toISOString(),
        };

        this.agents.set(id, agentEntry);

        // Register on-chain if contract is available
        if (this.registryContract && this.tokenContract) {
            try {
                agentEntry.state = AGENT_STATE.REGISTERING;
                this.emit("agent_registering", agentEntry);

                await runtime.register(ethers.parseEther(String(agentEntry.stake)));
                agentEntry.state = AGENT_STATE.ACTIVE;
                agentEntry.active = true;

                this.emit("agent_registered", agentEntry);
            } catch (e) {
                agentEntry.state = AGENT_STATE.ERROR;
                agentEntry.error = e.message;
                this.emit("agent_error", agentEntry, e);
                return { success: false, message: `Registration failed: ${e.message}` };
            }
        }

        return {
            success: true,
            message: `Agent "${agentEntry.name}" (${workloadType}) registered as ${id}`,
            agent: {
                id: agentEntry.id,
                name: agentEntry.name,
                type: agentEntry.type,
                didHash: agentEntry.didHash,
                capabilities: agentEntry.capabilities,
                stake: agentEntry.stake,
            },
        };
    }

    /**
     * Start an agent's runtime
     */
    async startAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent) return { success: false, message: `Agent ${agentId} not found` };

        try {
            const heartbeatInterval = this.settingsManager.get("agent.heartbeatInterval") * 1000;
            await agent.runtime.start(heartbeatInterval);
            agent.state = AGENT_STATE.ACTIVE;
            agent.active = true;
            this.emit("agent_started", agent);
            return { success: true, message: `Agent "${agent.name}" started` };
        } catch (e) {
            agent.state = AGENT_STATE.ERROR;
            return { success: false, message: `Failed to start: ${e.message}` };
        }
    }

    /**
     * Stop an agent
     */
    async stopAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent) return { success: false, message: `Agent ${agentId} not found` };

        agent.state = AGENT_STATE.STOPPING;
        agent.runtime.stop();
        agent.state = AGENT_STATE.STOPPED;
        agent.active = false;
        this.emit("agent_stopped", agent);
        return { success: true, message: `Agent "${agent.name}" stopped` };
    }

    /**
     * Start all registered agents
     */
    async startAllAgents() {
        const results = [];
        for (const [id, agent] of this.agents) {
            if (agent.state !== AGENT_STATE.ACTIVE && agent.state !== AGENT_STATE.STOPPED) {
                results.push(await this.startAgent(id));
            }
        }
        return results;
    }

    /**
     * Stop all running agents
     */
    async stopAllAgents() {
        const results = [];
        for (const [id, agent] of this.agents) {
            if (agent.active) {
                results.push(await this.stopAgent(id));
            }
        }
        return results;
    }

    // ── Heartbeat ───────────────────────────────────────────────

    /**
     * Submit heartbeats for all active agents
     */
    async submitAllHeartbeats() {
        let sent = 0;
        let total = 0;
        for (const [id, agent] of this.agents) {
            if (!agent.active) continue;
            total++;
            try {
                await agent.runtime.submitHeartbeat();
                sent++;
            } catch (e) {
                this.emit("heartbeat_failed", agent, e);
            }
        }
        return { sent, total };
    }

    // ── Task Management ─────────────────────────────────────────

    /**
     * Submit a workload
     */
    submitWorkload(useCaseId, workload) {
        if (!this.adminAddress) {
            return { status: "rejected", message: "No wallet configured" };
        }
        return this.useCaseManager.submitWorkload(this.adminAddress, useCaseId, workload);
    }

    /**
     * Claim a task with the first available agent
     */
    async claimTask(taskId) {
        for (const [id, agent] of this.agents) {
            if (agent.active && agent.type !== "privacy") {
                try {
                    await agent.runtime.claimTask(taskId);
                    return { success: true, message: `Task claimed by ${agent.name}` };
                } catch (e) {
                    continue;
                }
            }
        }
        return { success: false, message: "No available agent to claim task" };
    }

    /**
     * Get all active tasks
     */
    getActiveTasks() {
        return this.useCaseManager.getActiveWorkloads();
    }

    // ── Financial ───────────────────────────────────────────────

    /**
     * Stake tokens
     */
    async stakeTokens(amount) {
        if (!this.tokenContract || !this.registryContract) {
            return { success: false, message: "Contracts not connected" };
        }
        try {
            const tx = await this.tokenContract.approve(this.registryAddress, amount);
            await tx.wait();
            return { success: true, message: `Approved ${ethers.formatEther(amount)} FCM for staking` };
        } catch (e) {
            return { success: false, message: `Staking failed: ${e.message}` };
        }
    }

    // ── Chat ────────────────────────────────────────────────────

    /**
     * Process a chat message
     */
    async chat(message) {
        return this.chat.processMessage(message);
    }

    // ── Status & Queries ────────────────────────────────────────

    /**
     * Get full system status
     */
    getFullStatus() {
        const agents = [...this.agents.values()];
        const users = [...this.permissionManager.users.values()];
        const tasks = this.useCaseManager.getActiveWorkloads();
        const ucSummary = this.useCaseManager.getSummary();

        return {
            agents: {
                total: agents.length,
                active: agents.filter(a => a.active).length,
                list: agents.map(a => ({ id: a.id, name: a.name, type: a.type, state: a.state })),
            },
            users: {
                total: users.length,
                active: users.filter(u => !u.banned).length,
            },
            tasks: {
                active: tasks.length,
                completed: ucSummary.workloads.completed,
            },
            useCases: ucSummary.useCases,
            system: {
                online: true,
                uptime: Math.floor((Date.now() - this.startTime) / 1000),
                score: this.resourceAnalyzer._cache?.score || 0,
                address: this.adminAddress,
            },
        };
    }

    /**
     * Get all agents
     */
    getAgents() {
        return [...this.agents.values()].map(a => ({
            id: a.id,
            name: a.name,
            type: a.type,
            capabilities: a.capabilities,
            didHash: a.didHash,
            stake: a.stake,
            state: a.state,
            active: a.active,
        }));
    }

    // ── Convenience ─────────────────────────────────────────────

    /**
     * Full onboarding flow
     */
    async onboard(privateKey, workloadType, agentName) {
        return this.onboarding.completeOnboarding({ privateKey, workloadType, agentName });
    }

    /**
     * Register a use case
     */
    registerUseCase(requester, useCase) {
        return this.useCaseManager.registerUseCase(requester, useCase);
    }

    /**
     * Shutdown gracefully
     */
    async shutdown() {
        this.emit("shutting_down");
        await this.stopAllAgents();
        if (this.dashboard) this.dashboard.stop();
        if (this.restApi) this.restApi.stop();
        this.emit("shutdown");
    }

    /**
     * Start the dashboard HTTP server
     */
    startDashboard() {
        this.dashboard.start();
        return { success: true, message: `Dashboard at http://127.0.0.1:${this.dashboard.port}` };
    }

    /**
     * Start the REST API server
     */
    startApi() {
        this.restApi.start();
        return { success: true, message: `REST API at http://127.0.0.1:${this.restApi.port}` };
    }

    // ── Internal ────────────────────────────────────────────────

    _detectCapabilities(workloadType) {
        const caps = this.resourceAnalyzer._cache?.capabilities || [];
        const typeCaps = {
            inference: ["gpu", "cuda", "avx512"],
            render: ["gpu", "vulkan"],
            federated_learning: ["tee", "sgx", "avx512"],
            edge: ["wasm", "avx2"],
            zk_prover: ["gpu", "cuda"],
            game: ["gpu", "metal", "avx2"],
            science: ["avx512", "mpi"],
            privacy: ["tee", "sgx"],
            node: ["compute", "avx2"],
            storage: ["disk", "ipfs"],
            file_server: ["disk", "network", "http"],
            rewarded: ["compute", "avx2"],
        };
        return [...new Set([...(typeCaps[workloadType] || []), ...caps])];
    }

    _getStakeAmount(workloadType) {
        const stakes = {
            inference: 500, render: 500, federated_learning: 1000,
            edge: 500, zk_prover: 750, game: 500, science: 500, privacy: 1000,
            node: 100, storage: 250, file_server: 250, rewarded: 50,
        };
        return stakes[workloadType] || 500;
    }
}

module.exports = { MasterAgent, AGENT_STATE, ROLES, PERMISSIONS, USE_CASE_CATEGORIES };
