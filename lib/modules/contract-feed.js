/**
 * FCM Contract Data Feed
 *
 * Reads live on-chain data from deployed FCM contracts and provides
 * it to the WebSocket server for real-time dashboard updates.
 *
 * Falls back to mock data when contracts are not connected.
 */

const { ethers } = require("ethers");

// Minimal ABIs for view functions only
const ABIS = {
    token: [
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function totalSupply() view returns (uint256)",
        "function balanceOf(address) view returns (uint256)",
        "function getMintableSupply() view returns (uint256)",
        "function totalBurned() view returns (uint256)",
        "function totalMintedRewards() view returns (uint256)",
    ],
    registry: [
        "function agents(bytes32) view returns (bytes32 name, address operator, uint256 stake, uint256 reputation, uint256 reputationScore, uint256 capabilities, bytes32 geohash, bytes32 didHash, bool isActive, uint8 agentType)",
        "function agentListLength() view returns (uint256)",
        "function getAgentStatus(bytes32) view returns (bool isActive, address operator)",
        "function getAgentsByType(uint8) view returns (bytes32[])",
        "function taskCount() view returns (uint256)",
        "function operatorActiveTasks(address) view returns (uint256)",
    ],
    tierStaking: [
        "function getTier(address) view returns (uint8)",
        "function getEffectiveMultiplier(address) view returns (uint256)",
        "function getStakerCount() view returns (uint256)",
        "function getStakersByTier(uint8) view returns (address[])",
        "function totalStaked() view returns (uint256)",
        "function stakes(address) view returns (uint256 amount, uint256 stakedAt, uint8 currentTier, uint256 gracePeriodEnd, uint256 lastHardwareCheck)",
    ],
    governance: [
        "function proposalCount() view returns (uint256)",
        "function getProposalState(uint256) view returns (uint8)",
        "function getProposalVotes(uint256) view returns (uint256 forVotes, uint256 againstVotes, uint256 abstainVotes)",
        "function proposals(uint256) view returns (address proposer, string description, address target, uint256 startBlock, uint256 endBlock, uint256 eta, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, uint256 totalStakedAtProposal, uint8 state)",
    ],
    escrow: [
        "function escrowCount() view returns (uint256)",
        "function getEscrowSummary(uint256) view returns (uint256 totalAmount, uint256 releasedAmount, uint256 remainingAmount, uint8 completedMilestones, uint8 totalMilestones, uint8 state, uint256 createdAt, uint256 deadline, bool requiresMultiSig)",
    ],
    reputation: [
        "function getBadge(address) view returns (uint256 tier, uint256 totalWork, uint256 totalEarnings, uint256 uptimeScore, uint256 disputesWon, uint256 disputesLost, uint256 consecutiveDays, uint256 achievements, uint256 mintedAt, uint256 lastUpdated)",
        "function totalSupply() view returns (uint256)",
        "function getAchievements(address) view returns (uint256)",
    ],
    rewardsPool: [
        "function currentEpoch() view returns (uint256)",
        "function getEpochInfo(uint256) view returns (uint256 totalDistributed, uint256 totalWork, uint256 finalizedAt, bool finalized)",
        "function getAgentPendingRewards(address) view returns (uint256)",
        "function getAgentLifetimeEarnings(address) view returns (uint256)",
    ],
};

// Agent metadata (maps type index to name, icon, category)
const AGENT_META = [
    { id: "inf", name: "Inference Router", icon: "🧠", role: "Model scheduling & batching", category: "compute" },
    { id: "ren", name: "Render Splitter", icon: "🎬", role: "Frame distribution & dependency graph", category: "compute" },
    { id: "fl", name: "FL Coordinator", icon: "🔒", role: "Secure aggregation & privacy", category: "compute" },
    { id: "edge", name: "Edge Runner", icon: "⚡", role: "WASM cold-start & routing", category: "compute" },
    { id: "zk", name: "ZK Prover", icon: "🛡️", role: "Circuit compilation & witness gen", category: "compute" },
    { id: "game", name: "Game Host", icon: "🎮", role: "Tick sync & matchmaking", category: "compute" },
    { id: "sci", name: "Science Grid", icon: "🔬", role: "Job splitting & validation", category: "compute" },
    { id: "priv", name: "Privacy Mesh", icon: "🕵️", role: "Mixnet routing & relay selection", category: "compute" },
    { id: "node", name: "Node Runner", icon: "🖥️", role: "Blockchain node operations", category: "infrastructure" },
    { id: "stor", name: "Storage Provider", icon: "💾", role: "Distributed file storage", category: "infrastructure" },
    { id: "fsrv", name: "File Server", icon: "📁", role: "Content delivery & streaming", category: "infrastructure" },
    { id: "rwrd", name: "Rewarded Worker", icon: "🎁", role: "Task completion for rewards", category: "infrastructure" },
    { id: "tier", name: "Tier Manager", icon: "📊", role: "Staking tiers & HW verification", category: "platform" },
    { id: "reward", name: "Rewards Distributor", icon: "💰", role: "Epoch funding & distribution", category: "platform" },
    { id: "gov", name: "Governance Agent", icon: "🏛️", role: "Proposal voting & governance", category: "platform" },
    { id: "escrow", name: "Escrow Manager", icon: "🔒", role: "Milestone payment escrow", category: "platform" },
    { id: "rep", name: "Reputation Oracle", icon: "🏅", role: "Badge updates & achievements", category: "platform" },
    { id: "coord", name: "Agent Coordinator", icon: "🤝", role: "Onboarding & coordination", category: "platform" },
];

const TIER_NAMES = ["Free", "Starter", "Standard", "Advanced", "Pro", "Elite"];
const TIER_STAKES = ["0", "100", "500", "2,000", "10,000", "50,000"];
const TIER_MULTS = ["0.5x", "1x", "1.5x", "2x", "3x", "5x"];

class ContractDataFeed {
    /**
     * @param {Object} config
     * @param {string} config.rpcUrl - Blockchain RPC URL
     * @param {string} config.registryAddress
     * @param {string} config.tokenAddress
     * @param {string} config.tierStakingAddress
     * @param {string} config.governanceAddress
     * @param {string} config.escrowAddress
     * @param {string} config.reputationAddress
     * @param {string} config.rewardsPoolAddress
     */
    constructor(config = {}) {
        this.provider = null;
        this.contracts = {};
        this.connected = false;
        this._mockMode = !config.registryAddress;

        if (config.rpcUrl) {
            try {
                this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
            } catch (e) {
                console.log("[Feed] RPC connection failed, using mock data");
                this._mockMode = true;
            }
        }

        if (config.registryAddress && this.provider) {
            try {
                this.contracts.registry = new ethers.Contract(config.registryAddress, ABIS.registry, this.provider);
                this.contracts.token = config.tokenAddress ? new ethers.Contract(config.tokenAddress, ABIS.token, this.provider) : null;
                this.contracts.tierStaking = config.tierStakingAddress ? new ethers.Contract(config.tierStakingAddress, ABIS.tierStaking, this.provider) : null;
                this.contracts.governance = config.governanceAddress ? new ethers.Contract(config.governanceAddress, ABIS.governance, this.provider) : null;
                this.contracts.escrow = config.escrowAddress ? new ethers.Contract(config.escrowAddress, ABIS.escrow, this.provider) : null;
                this.contracts.reputation = config.reputationAddress ? new ethers.Contract(config.reputationAddress, ABIS.reputation, this.provider) : null;
                this.contracts.rewardsPool = config.rewardsPoolAddress ? new ethers.Contract(config.rewardsPoolAddress, ABIS.rewardsPool, this.provider) : null;
                this.connected = true;
                console.log("[Feed] Connected to contracts");
            } catch (e) {
                console.log("[Feed] Contract init failed:", e.message);
                this._mockMode = true;
            }
        }

        if (this._mockMode) {
            console.log("[Feed] Running in mock mode (no contracts connected)");
        }

        this._mockState = this._initMockState();
    }

    // ── Data Providers (registered with WsServer.on()) ────────

    async getAgents() {
        if (this.connected) return this._getLiveAgents();
        return this._getMockAgents();
    }

    async getTiers() {
        if (this.connected) return this._getLiveTiers();
        return this._getMockTiers();
    }

    async getGovernance() {
        if (this.connected) return this._getLiveGovernance();
        return this._getMockGovernance();
    }

    async getEscrows() {
        if (this.connected) return this._getLiveEscrows();
        return this._getMockEscrows();
    }

    async getReputation() {
        if (this.connected) return this._getLiveReputation();
        return this._getMockReputation();
    }

    async getSystem() {
        if (this.connected) return this._getLiveSystem();
        return this._getMockSystem();
    }

    async getRewards() {
        if (this.connected) return this._getLiveRewards();
        return this._getMockRewards();
    }

    /**
     * Get detailed metrics for a single agent.
     * @param {string} agentId - Agent ID (e.g. "inf", "ren", "fl")
     * @returns {Object} Detailed agent metrics
     */
    async getTasks() {
        if (!this.connected || !this.contracts.registry) return { tasks: [], total: 0, mode: "mock", ts: Date.now() };
        try {
            const registry = this.contracts.registry;
            const count = Number(await registry.taskCount());
            const tasks = [];
            const taskAbi = ["function tasks(bytes32) view returns (bytes32,address,uint256,uint256,bytes32,bytes32,bytes32,address,uint8,bytes32,bool,uint256,bytes32)"];
            const taskContract = new ethers.Contract(registry.target, taskAbi, this.provider);
            for (let i = 0; i < Math.min(count, 100); i++) {
                // The registry exposes a count but no indexed task-list getter; task IDs must be
                // supplied by an event indexer. Return an honest empty live collection until then.
                void i;
            }
            return { tasks, total: tasks.length, mode: "live", ts: Date.now() };
        } catch (e) {
            console.error("[Feed] Live tasks error:", e.message);
            return { tasks: [], total: 0, mode: "live", ts: Date.now(), error: e.message };
        }
    }

    async getAgentDetail(agentId) {
        if (this.connected) return this._getLiveAgentDetail(agentId);
        return this._getMockAgentDetail(agentId);
    }

    /**
     * Get all agent IDs.
     * @returns {string[]}
     */
    getAgentIds() {
        return AGENT_META.map(m => m.id);
    }

    // ── Live Contract Reads ───────────────────────────────────

    async _getLiveAgents() {
        try {
            const reg = this.contracts.registry;
            const len = Number(await reg.agentListLength());
            const agents = [];

            for (let i = 0; i < Math.min(len, 50); i++) {
                try {
                    // Read by type — each agent type may have multiple registrations
                    for (let t = 0; t < 18; t++) {
                        const dids = await reg.getAgentsByType(t);
                        for (const did of dids) {
                            const data = await reg.agents(did);
                            const meta = AGENT_META[t] || { id: `type-${t}`, name: `Agent Type ${t}`, icon: "🤖", role: "Unknown", category: "compute" };
                            const tier = this.contracts.tierStaking ? Number(await this.contracts.tierStaking.getTier(data.operator)) : 0;
                            const badge = this.contracts.reputation ? await this._safeGetBadge(data.operator) : null;

                            agents.push({
                                id: meta.id,
                                didHash: did,
                                name: meta.name,
                                icon: meta.icon,
                                role: meta.role,
                                category: meta.category,
                                agentType: t,
                                tier,
                                status: data.isActive ? "active" : "standby",
                                stake: Number(ethers.formatEther(data.stake)),
                                reputation: Number(data.reputation),
                                operator: data.operator,
                                lastHeartbeat: Number(data.reputationScore) || Date.now() / 1000,
                                badge: badge,
                            });
                        }
                    }
                    break; // Only do this once (all types)
                } catch (e) {
                    break;
                }
            }

            return { agents, total: agents.length, mode: "live", ts: Date.now() };
        } catch (e) {
            console.error("[Feed] Live agents error:", e.message);
            return this._getMockAgents();
        }
    }

    async _getLiveTiers() {
        try {
            const staking = this.contracts.tierStaking;
            if (!staking) return this._getMockTiers();

            const tierCounts = [];
            const tierAgents = [];
            for (let t = 0; t <= 5; t++) {
                const stakers = await staking.getStakersByTier(t);
                tierCounts.push(Number(stakers.length));
                tierAgents.push(stakers.slice(0, 10).map(s => s));
            }
            const totalStaked = Number(ethers.formatEther(await staking.totalStaked()));
            const stakerCount = Number(await staking.getStakerCount());

            return {
                tiers: TIER_NAMES.map((name, i) => ({
                    tier: i,
                    name,
                    minStake: TIER_STAKES[i],
                    multiplier: TIER_MULTS[i],
                    agentCount: tierCounts[i] || 0,
                    totalStaked: tierCounts[i] * parseFloat(TIER_STAKES[i].replace(",", "")),
                })),
                totalStaked,
                stakerCount,
                mode: "live",
                ts: Date.now(),
            };
        } catch (e) {
            console.error("[Feed] Live tiers error:", e.message);
            return this._getMockTiers();
        }
    }

    async _getLiveGovernance() {
        try {
            const gov = this.contracts.governance;
            if (!gov) return this._getMockGovernance();

            const count = Number(await gov.proposalCount());
            const proposals = [];

            for (let i = 1; i <= Math.min(count, 20); i++) {
                try {
                    const data = await gov.proposals(i);
                    const votes = await gov.getProposalVotes(i);
                    const stateNum = Number(await gov.getProposalState(i));
                    const stateNames = ["Pending", "Active", "Succeeded", "Defeated", "Queued", "Executed", "Cancelled"];

                    proposals.push({
                        id: i,
                        proposer: data.proposer,
                        description: data.description,
                        state: stateNames[stateNum] || "Unknown",
                        forVotes: ethers.formatEther(votes.forVotes),
                        againstVotes: ethers.formatEther(votes.againstVotes),
                        abstainVotes: ethers.formatEther(votes.abstainVotes),
                        startBlock: Number(data.startBlock),
                        endBlock: Number(data.endBlock),
                        totalStakedAtProposal: ethers.formatEther(data.totalStakedAtProposal),
                    });
                } catch (e) { continue; }
            }

            return { proposals, total: count, mode: "live", ts: Date.now() };
        } catch (e) {
            console.error("[Feed] Live governance error:", e.message);
            return this._getMockGovernance();
        }
    }

    async _getLiveEscrows() {
        try {
            const esc = this.contracts.escrow;
            if (!esc) return this._getMockEscrows();

            const count = Number(await esc.escrowCount());
            const escrows = [];

            for (let i = 1; i <= Math.min(count, 20); i++) {
                try {
                    const summary = await esc.getEscrowSummary(i);
                    const stateNames = ["Created", "Funded", "InProgress", "Completed", "Disputed", "Cancelled"];
                    escrows.push({
                        id: i,
                        totalAmount: ethers.formatEther(summary.totalAmount),
                        releasedAmount: ethers.formatEther(summary.releasedAmount),
                        remainingAmount: ethers.formatEther(summary.remainingAmount),
                        completedMilestones: Number(summary.completedMilestones),
                        totalMilestones: Number(summary.totalMilestones),
                        state: stateNames[Number(summary.state)] || "Unknown",
                        createdAt: Number(summary.createdAt),
                        deadline: Number(summary.deadline),
                        requiresMultiSig: summary.requiresMultiSig,
                        progress: Number(summary.totalMilestones) > 0
                            ? Math.round(Number(summary.completedMilestones) / Number(summary.totalMilestones) * 100)
                            : 0,
                    });
                } catch (e) { continue; }
            }

            return { escrows, total: count, mode: "live", ts: Date.now() };
        } catch (e) {
            console.error("[Feed] Live escrows error:", e.message);
            return this._getMockEscrows();
        }
    }

    async _getLiveReputation() {
        try {
            const rep = this.contracts.reputation;
            if (!rep) return this._getMockReputation();

            const totalBadges = Number(await rep.totalSupply());
            return { totalBadges, mode: "live", ts: Date.now() };
        } catch (e) {
            return this._getMockReputation();
        }
    }

    async _getLiveSystem() {
        try {
            const token = this.contracts.token;
            const reg = this.contracts.registry;
            const data = {};

            if (token) {
                data.tokenName = await token.name();
                data.tokenSymbol = await token.symbol();
                data.totalSupply = ethers.formatEther(await token.totalSupply());
                data.totalBurned = ethers.formatEther(await token.totalBurned());
                data.mintedRewards = ethers.formatEther(await token.totalMintedRewards());
                data.mintableSupply = ethers.formatEther(await token.getMintableSupply());
            }

            if (reg) {
                data.agentCount = Number(await reg.agentListLength());
                data.taskCount = Number(await reg.taskCount());
            }

            if (this.contracts.tierStaking) {
                data.totalStaked = ethers.formatEther(await this.contracts.tierStaking.totalStaked());
                data.stakerCount = Number(await this.contracts.tierStaking.getStakerCount());
            }

            if (this.contracts.governance) {
                data.proposalCount = Number(await this.contracts.governance.proposalCount());
            }

            if (this.contracts.escrow) {
                data.escrowCount = Number(await this.contracts.escrow.escrowCount());
            }

            if (this.contracts.rewardsPool) {
                data.currentEpoch = Number(await this.contracts.rewardsPool.currentEpoch());
            }

            data.mode = "live";
            data.ts = Date.now();
            return data;
        } catch (e) {
            return this._getMockSystem();
        }
    }

    async _getLiveRewards() {
        try {
            const pool = this.contracts.rewardsPool;
            if (!pool) return this._getMockRewards();

            const epoch = Number(await pool.currentEpoch());
            const epochInfo = await pool.getEpochInfo(epoch);

            return {
                currentEpoch: epoch,
                totalDistributed: ethers.formatEther(epochInfo.totalDistributed),
                totalWork: Number(epochInfo.totalWork),
                finalized: epochInfo.finalized,
                mode: "live",
                ts: Date.now(),
            };
        } catch (e) {
            return this._getMockRewards();
        }
    }

    async _safeGetBadge(operator) {
        try {
            const rep = this.contracts.reputation;
            if (!rep) return null;
            const badge = await rep.getBadge(operator);
            return {
                tier: Number(badge.tier),
                totalWork: Number(badge.totalWork),
                totalEarnings: ethers.formatEther(badge.totalEarnings),
                uptimeScore: Number(badge.uptimeScore),
                achievements: Number(badge.achievements),
            };
        } catch (e) {
            return null;
        }
    }

    // ── Mock Data (when no contracts connected) ───────────────

    _initMockState() {
        return {
            tickCount: 0,
            agents: AGENT_META.map((m, i) => ({
                ...m,
                agentType: i,
                tier: Math.floor(Math.random() * 6),
                status: Math.random() > 0.2 ? "active" : "standby",
                stake: [0, 100, 500, 2000, 10000, 50000][Math.floor(Math.random() * 6)],
                reputation: Math.floor(Math.random() * 10000),
                tasksCompleted: Math.floor(Math.random() * 500),
                uptime: (95 + Math.random() * 5).toFixed(1),
            })),
        };
    }

    _getMockAgents() {
        this._mockState.tickCount++;
        const tick = this._mockState.tickCount;

        const agents = this._mockState.agents.map(a => ({
            ...a,
            status: Math.random() > 0.1 ? "active" : "standby",
            reputation: a.reputation + Math.floor(Math.random() * 10 - 3),
            tasksCompleted: a.tasksCompleted + (Math.random() > 0.8 ? 1 : 0),
            lastHeartbeat: Date.now() / 1000 - Math.floor(Math.random() * 30),
        }));

        return {
            agents,
            total: agents.length,
            active: agents.filter(a => a.status === "active").length,
            mode: "mock",
            tick,
            ts: Date.now(),
        };
    }

    _getMockTiers() {
        const agents = this._mockState.agents;
        return {
            tiers: TIER_NAMES.map((name, i) => ({
                tier: i,
                name,
                minStake: TIER_STAKES[i],
                multiplier: TIER_MULTS[i],
                agentCount: agents.filter(a => a.tier === i).length,
                totalStaked: agents.filter(a => a.tier === i).reduce((s, a) => s + a.stake, 0),
            })),
            totalStaked: agents.reduce((s, a) => s + a.stake, 0),
            stakerCount: agents.length,
            mode: "mock",
            ts: Date.now(),
        };
    }

    _getMockGovernance() {
        const tick = this._mockState.tickCount;
        return {
            proposals: [
                {
                    id: 1, proposer: "0xa1a1...b2b2", description: "Increase MAX_CONCURRENT from 50 to 100",
                    state: "Active", forVotes: "125000", againstVotes: "45000", abstainVotes: "10000",
                    startBlock: 100 + tick, endBlock: 200 + tick, totalStakedAtProposal: "2000000",
                },
                {
                    id: 2, proposer: "0xc3c3...d4d4", description: "Treasury allocation for community grants (100K FCM)",
                    state: "Succeeded", forVotes: "89000", againstVotes: "12000", abstainVotes: "5000",
                    startBlock: 80, endBlock: 180, totalStakedAtProposal: "1800000",
                },
                {
                    id: 3, proposer: "0xe5e5...f6f6", description: "Reduce dispute window from 1 day to 12 hours",
                    state: "Defeated", forVotes: "34000", againstVotes: "67000", abstainVotes: "8000",
                    startBlock: 60, endBlock: 160, totalStakedAtProposal: "1500000",
                },
            ],
            total: 3,
            mode: "mock",
            ts: Date.now(),
        };
    }

    _getMockEscrows() {
        return {
            escrows: [
                {
                    id: 1, totalAmount: "50,000", releasedAmount: "25,000", remainingAmount: "25,000",
                    completedMilestones: 2, totalMilestones: 4, state: "InProgress", progress: 50,
                    createdAt: Date.now() / 1000 - 86400 * 5, deadline: Date.now() / 1000 + 86400 * 85,
                    requiresMultiSig: false,
                },
                {
                    id: 2, totalAmount: "15,000", releasedAmount: "0", remainingAmount: "15,000",
                    completedMilestones: 0, totalMilestones: 3, state: "Funded", progress: 0,
                    createdAt: Date.now() / 1000 - 86400 * 2, deadline: Date.now() / 1000 + 86400 * 88,
                    requiresMultiSig: true,
                },
                {
                    id: 3, totalAmount: "800", releasedAmount: "800", remainingAmount: "0",
                    completedMilestones: 2, totalMilestones: 2, state: "Completed", progress: 100,
                    createdAt: Date.now() / 1000 - 86400 * 30, deadline: Date.now() / 1000 - 86400,
                    requiresMultiSig: false,
                },
            ],
            total: 3,
            mode: "mock",
            ts: Date.now(),
        };
    }

    _getMockReputation() {
        return {
            totalBadges: 4,
            badges: [
                { tokenId: 1, tier: 5, totalWork: 1547, totalEarnings: "520,000", uptimeScore: 9950, achievements: 0x7f },
                { tokenId: 2, tier: 4, totalWork: 892, totalEarnings: "180,000", uptimeScore: 9800, achievements: 0x3f },
                { tokenId: 3, tier: 4, totalWork: 2341, totalEarnings: "890,000", uptimeScore: 9980, achievements: 0xff },
                { tokenId: 4, tier: 1, totalWork: 67, totalEarnings: "3,400", uptimeScore: 8500, achievements: 0x01 },
            ],
            mode: "mock",
            ts: Date.now(),
        };
    }

    _getMockSystem() {
        const tick = this._mockState.tickCount;
        return {
            tokenName: "Federated Compute Mesh",
            tokenSymbol: "FCM",
            totalSupply: "500,000,000",
            totalBurned: String(Math.floor(tick * 0.1)),
            mintedRewards: String(Math.floor(tick * 2.3)),
            mintableSupply: "499,999,999",
            agentCount: 18,
            taskCount: 12847 + tick,
            totalStaked: "62,800",
            stakerCount: 18,
            proposalCount: 3,
            escrowCount: 3,
            currentEpoch: 24,
            mode: "mock",
            ts: Date.now(),
        };
    }

    _getMockRewards() {
        const tick = this._mockState.tickCount;
        return {
            currentEpoch: 24,
            totalDistributed: String(847000 + tick * 10),
            totalWork: 12847 + tick,
            finalized: false,
            mode: "mock",
            ts: Date.now(),
        };
    }

    // ── Agent Detail (for per-agent subscriptions) ─────────

    async _getLiveAgentDetail(agentId) {
        try {
            const meta = AGENT_META.find(m => m.id === agentId);
            if (!meta) return this._getMockAgentDetail(agentId);

            const reg = this.contracts.registry;
            if (!reg) return this._getMockAgentDetail(agentId);

            const dids = await reg.getAgentsByType(meta.agentType);
            let agentData = null;
            for (const did of dids) {
                const data = await reg.agents(did);
                if (data.isActive || data.operator !== "0x0000000000000000000000000000000000000000") {
                    agentData = { did, ...data };
                    break;
                }
            }

            if (!agentData) return this._getMockAgentDetail(agentId);

            const tier = this.contracts.tierStaking ? Number(await this.contracts.tierStaking.getTier(agentData.operator)) : 0;
            const badge = await this._safeGetBadge(agentData.operator);
            const effectiveMult = this.contracts.tierStaking ? Number(await this.contracts.tierStaking.getEffectiveMultiplier(agentData.operator)) : 1;
            const activeTasks = Number(await reg.operatorActiveTasks(agentData.operator));

            return {
                id: meta.id,
                name: meta.name,
                icon: meta.icon,
                role: meta.role,
                category: meta.category,
                agentType: meta.agentType,
                operator: agentData.operator,
                didHash: agentData.didHash || agentData.did,
                tier,
                status: agentData.isActive ? "active" : "standby",
                stake: Number(ethers.formatEther(agentData.stake)),
                reputation: Number(agentData.reputation),
                effectiveMultiplier: effectiveMult,
                activeTasks,
                lastHeartbeat: Number(agentData.reputationScore) || 0,
                badge: badge || {
                    tier: 0, totalWork: 0, totalEarnings: "0",
                    uptimeScore: 0, achievements: 0,
                },
                mode: "live",
                ts: Date.now(),
            };
        } catch (e) {
            console.error(`[Feed] Live agent detail error (${agentId}):`, e.message);
            return this._getMockAgentDetail(agentId);
        }
    }

    _getMockAgentDetail(agentId) {
        const meta = AGENT_META.find(m => m.id === agentId);
        const mock = this._mockState.agents.find(a => a.id === agentId);
        if (!meta) return { error: "Agent not found", id: agentId };

        const m = mock || { tier: 0, status: "standby", stake: 0, reputation: 0, tasksCompleted: 0, uptime: "95.0" };
        return {
            id: meta.id,
            name: meta.name,
            icon: meta.icon,
            role: meta.role,
            category: meta.category,
            agentType: meta.agentType,
            operator: "0x" + agentId + "..." + agentId,
            tier: m.tier,
            status: m.status,
            stake: m.stake,
            reputation: m.reputation,
            effectiveMultiplier: [0.5, 1, 1.5, 2, 3, 5][m.tier] || 1,
            activeTasks: Math.floor(Math.random() * 5),
            lastHeartbeat: Date.now() / 1000 - Math.floor(Math.random() * 30),
            tasksCompleted: m.tasksCompleted || 0,
            uptime: m.uptime || "95.0",
            earnings: Math.floor(m.stake * (m.tier + 1) * 0.1),
            badge: {
                tier: m.tier,
                totalWork: m.tasksCompleted || 0,
                totalEarnings: String(Math.floor(m.stake * (m.tier + 1) * 0.5)),
                uptimeScore: Math.floor(parseFloat(m.uptime || "95") * 100),
                achievements: Math.floor(Math.random() * 127),
            },
            mode: "mock",
            ts: Date.now(),
        };
    }
}

module.exports = { ContractDataFeed };
