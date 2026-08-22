/**
 * Onboarding — User registration, hardware profiling, and agent setup wizard
 *
 * Guides new users through:
 * 1. Wallet connection / key generation
 * 2. System resource analysis
 * 3. Workload type selection
 * 4. Agent configuration
 * 5. Staking and registration
 */

const { ethers } = require("ethers");
const { ResourceAnalyzer } = require("./resource-analyzer");
const { PermissionManager, ROLES } = require("./permission-manager");

class Onboarding {
    constructor(config = {}) {
        this.analyzer = new ResourceAnalyzer();
        this.permissions = config.permissionManager || new PermissionManager();
        this.registryAddress = config.registryAddress;
        this.tokenAddress = config.tokenAddress;
        this.rpcUrl = config.rpcUrl || "http://localhost:8545";
    }

    /**
     * Step 1: Generate or validate wallet
     */
    async setupWallet(privateKey) {
        if (privateKey) {
            // Validate existing key
            try {
                const wallet = new ethers.Wallet(privateKey);
                return {
                    step: "wallet",
                    status: "ready",
                    address: wallet.address,
                    message: `Wallet validated: ${wallet.address}`,
                };
            } catch (e) {
                return { step: "wallet", status: "error", message: `Invalid key: ${e.message}` };
            }
        }

        // Generate new wallet
        const wallet = ethers.Wallet.createRandom();
        return {
            step: "wallet",
            status: "generated",
            address: wallet.address,
            privateKey: wallet.privateKey,
            mnemonic: wallet.mnemonic?.phrase,
            message: "New wallet generated. SAVE YOUR PRIVATE KEY AND MNEMONIC.",
        };
    }

    /**
     * Step 2: Analyze system resources
     */
    async analyzeSystem() {
        const profile = await this.analyzer.analyze();
        const usage = this.analyzer.getUsage();

        // Determine suitable workload types
        const suitableWorkloads = [];
        const workloadTypes = ["inference", "render", "federated_learning", "edge", "zk_prover", "game", "science", "privacy"];

        for (const type of workloadTypes) {
            const check = this.analyzer.meetsRequirements(type);
            if (check.eligible) {
                suitableWorkloads.push(type);
            }
        }

        return {
            step: "resources",
            status: "analyzed",
            profile,
            usage,
            suitableWorkloads,
            score: profile.score,
            message: `System scored ${profile.score}/100. Compatible with ${suitableWorkloads.length} workload types.`,
        };
    }

    /**
     * Step 3: Select workload type and configure agent
     */
    async configureAgent(options) {
        const { walletAddress, workloadType, agentName, geohash, capabilities } = options;

        if (!walletAddress || !workloadType) {
            return { step: "configure", status: "error", message: "walletAddress and workloadType required" };
        }

        // Check if user is allowed to run this workload
        if (!this.analyzer._cache) await this.analyzer.analyze();
        const resourceCheck = this.analyzer.meetsRequirements(workloadType);
        if (!resourceCheck.eligible) {
            return {
                step: "configure",
                status: "blocked",
                message: `System does not meet requirements for ${workloadType}: ${resourceCheck.reason}`,
            };
        }

        // Auto-detect capabilities from hardware
        const detectedCaps = this._detectCapabilities(workloadType);
        const finalCaps = capabilities || detectedCaps;

        const agentConfig = {
            owner: walletAddress.toLowerCase(),
            type: workloadType,
            name: agentName || `agent-${workloadType}-${Date.now().toString(36)}`,
            geohash: geohash || "u4pru",
            capabilities: finalCaps,
            didHash: ethers.keccak256(ethers.toUtf8Bytes(agentName || `agent-${workloadType}-${Date.now()}`)),
            stakeRequired: this._getStakeAmount(workloadType),
            config: this._getDefaultConfig(workloadType),
            estimatedEarnings: this._getEstimatedEarnings(workloadType),
        };

        return {
            step: "configure",
            status: "configured",
            agent: agentConfig,
            message: `Agent "${agentConfig.name}" configured for ${workloadType}. Stake: ${agentConfig.stakeRequired} FCM.`,
        };
    }

    /**
     * Step 4: Register user in permission system
     */
    registerUser(address, role = ROLES.PROVIDER) {
        const user = this.permissions.addUser(address, role, {
            metadata: { onboardedAt: new Date().toISOString() },
        });

        return {
            step: "register",
            status: "registered",
            user: {
                address: user.address,
                role: user.role,
                permissions: this.permissions.getEffectivePermissions(address),
            },
            message: `User registered with role: ${role}`,
        };
    }

    /**
     * Step 5: Complete onboarding — returns full setup summary
     */
    async completeOnboarding(options) {
        const { privateKey, workloadType, agentName, geohash } = options;

        const steps = [];

        // Step 1: Wallet
        const wallet = await this.setupWallet(privateKey);
        steps.push(wallet);
        if (wallet.status === "error") return { success: false, steps };

        // Step 2: Resources
        const resources = await this.analyzeSystem();
        steps.push(resources);

        // Step 3: Configure
        const config = await this.configureAgent({
            walletAddress: wallet.address,
            workloadType,
            agentName,
            geohash,
        });
        steps.push(config);
        if (config.status === "error" || config.status === "blocked") {
            return { success: false, steps };
        }

        // Step 4: Register
        const registration = this.registerUser(wallet.address, ROLES.PROVIDER);
        steps.push(registration);

        return {
            success: true,
            steps,
            summary: {
                address: wallet.address,
                agentType: workloadType,
                agentName: config.agent.name,
                didHash: config.agent.didHash,
                capabilities: config.agent.capabilities,
                stakeRequired: config.agent.stakeRequired,
                systemScore: resources.score,
                suitableWorkloads: resources.suitableWorkloads,
            },
            message: `Onboarding complete! Agent "${config.agent.name}" is ready to deploy.`,
        };
    }

    // ── Internal helpers ────────────────────────────────────────

    _detectCapabilities(workloadType) {
        const base = [];
        switch (workloadType) {
            case "inference":
                base.push("gpu", "cuda", "avx512");
                break;
            case "render":
                base.push("gpu", "vulkan");
                break;
            case "federated_learning":
                base.push("tee", "sgx", "avx512");
                break;
            case "edge":
                base.push("wasm", "avx2");
                break;
            case "zk_prover":
                base.push("gpu", "cuda");
                break;
            case "game":
                base.push("gpu", "metal", "avx2");
                break;
            case "science":
                base.push("avx512", "mpi", "openmp");
                break;
            case "privacy":
                base.push("tee", "sgx");
                break;
            case "node":
                base.push("compute", "avx2");
                break;
            case "storage":
                base.push("disk", "ipfs");
                break;
            case "file_server":
                base.push("disk", "network", "http");
                break;
            case "rewarded":
                base.push("compute", "avx2");
                break;
        }
        return base;
    }

    _getStakeAmount(workloadType) {
        const stakes = {
            inference: 500, render: 500, federated_learning: 1000,
            edge: 500, zk_prover: 750, game: 500, science: 500, privacy: 1000,
            node: 100, storage: 250, file_server: 250, rewarded: 50,
        };
        return stakes[workloadType] || 500;
    }

    _getDefaultConfig(workloadType) {
        const configs = {
            inference: { batchSize: 32, coalesceWindowMs: 10, continuousBatching: true },
            render: { tileSize: 1024, overlapPx: 64, denoisePasses: 3 },
            federated_learning: { epsilon: 1.0, l2NormClip: 1.0, mpcThreshold: 3 },
            edge: { wasmPoolSize: 100, memoryLimitMB: 128, cpuLimitMs: 100 },
            zk_prover: { aggregationThreshold: 16, backend: "cuda", curve: "bn254" },
            game: { tickRate: 128, maxPlayers: 64, latencyCompensationMs: 200 },
            science: { redundancyFactor: 3, checkpointInterval: 900, tolerance: 1e-6 },
            privacy: { minHops: 3, coverTrafficRatio: 0.3, pathRefreshMinutes: 10 },
            node: { heartbeatInterval: 60, maxConcurrentTasks: 5, autoClaim: true },
            storage: { maxStorageGB: 1000, replicationFactor: 3, gcInterval: 3600, pinningEnabled: true },
            file_server: { maxBandwidthMbps: 100, cacheEnabled: true, maxConnections: 100, tlsEnabled: true },
            rewarded: { autoClaim: true, minReward: "0.1", maxConcurrentBounties: 10 },
        };
        return configs[workloadType] || {};
    }

    _getEstimatedEarnings(workloadType) {
        const earnings = {
            inference: { perHour: "2.5 FCM", perTask: "0.01-0.5 FCM" },
            render: { perFrame: "0.5-2.0 FCM", perJob: "50-500 FCM" },
            federated_learning: { perRound: "10-50 FCM", perEpoch: "1-5 FCM" },
            edge: { perRequest: "0.001-0.01 FCM", perHour: "0.5-2.0 FCM" },
            zk_prover: { perProof: "0.04-0.2 FCM", perBatch: "0.5-2.0 FCM" },
            game: { perHour: "1.0-5.0 FCM", perPlayer: "0.1 FCM" },
            science: { perJob: "5-50 FCM", perHour: "1.0-5.0 FCM" },
            privacy: { perRelay: "0.001 FCM", perGB: "0.1 FCM" },
            node: { perTask: "0.1-1.0 FCM", perHour: "0.5-2.0 FCM" },
            storage: { perGBMonth: "0.05 FCM", perPin: "0.01 FCM" },
            file_server: { perGB: "0.02 FCM", perRequest: "0.001 FCM" },
            rewarded: { perBounty: "varies (1-1000 FCM)" },
        };
        return earnings[workloadType] || { perTask: "varies" };
    }
}

module.exports = { Onboarding };
