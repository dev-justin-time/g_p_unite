#!/usr/bin/env node
const { ethers } = require("ethers");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const AGENT_TYPES = {
    inference: 0, render: 1, federated_learning: 2, edge: 3,
    zk_prover: 4, game: 5, science: 6, privacy: 7,
};

const AGENT_CONFIGS = [
    { name: "Inference Router", type: "inference", stake: 500, capabilities: "gpu,cuda,avx512", icon: "\u{1f9e0}" },
    { name: "Render Splitter", type: "render", stake: 500, capabilities: "gpu,vulkan,tee", icon: "\u{1f3ac}" },
    { name: "FL Coordinator", type: "federated_learning", stake: 1000, capabilities: "tee,sgx,avx512", icon: "\u{1f512}" },
    { name: "Edge Runner", type: "edge", stake: 500, capabilities: "wasm,neon,avx2", icon: "\u{26a1}" },
    { name: "ZK Prover", type: "zk_prover", stake: 750, capabilities: "gpu,cuda,npu", icon: "\u{1f6e1}" },
    { name: "Game Host", type: "game", stake: 500, capabilities: "gpu,metal,avx2", icon: "\u{1f3ae}" },
    { name: "Science Grid", type: "science", stake: 500, capabilities: "avx512,mpi,openmp", icon: "\u{1f52c}" },
    { name: "Privacy Mesh", type: "privacy", stake: 1000, capabilities: "tee,sgx,neon", icon: "\u{1f575}" },
];

class FCMDeployer {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.FCM_RPC_URL || "http://localhost:8545");
        this.wallet = new ethers.Wallet(process.env.FCM_PRIVATE_KEY || "0x".padEnd(66, "0"), this.provider);
        this.configPath = path.join(process.cwd(), ".fcm-deploy.json");
    }

    async loadConfig() {
        if (!fs.existsSync(this.configPath)) {
            console.error("No deployment config found. Run: fcm-deploy init");
            process.exit(1);
        }
        return JSON.parse(fs.readFileSync(this.configPath, "utf8"));
    }

    async saveConfig(config) {
        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    }

    async init() {
        console.log("\n🚀 FCM Deploy — Initialize blocks.ai network deployment\n");
        const config = {
            network: process.env.FCM_RPC_URL || "http://localhost:8545",
            chainId: (await this.provider.getNetwork()).chainId.toString(),
            deployer: this.wallet.address,
            agents: {},
            contracts: {},
            createdAt: new Date().toISOString(),
        };
        await this.saveConfig(config);
        console.log("✅ Deployment config initialized at .fcm-deploy.json");
        console.log(`   Network: ${config.network}`);
        console.log(`   Chain ID: ${config.chainId}`);
        console.log(`   Deployer: ${config.deployer}`);
    }

    async deployContracts() {
        console.log("\n📜 Deploying FCM Smart Contracts to blocks.ai network...\n");
        const config = await this.loadConfig();
        console.log("Running Hardhat deployment...");
        try {
            const output = execSync("npx hardhat run scripts/hardhat/deploy.js --network " + 
                (config.network.includes("localhost") ? "localhost" : "baseSepolia"), 
                { encoding: "utf8", cwd: process.cwd() });
            console.log(output);
            const deployment = JSON.parse(fs.readFileSync("deployments/latest.json", "utf8"));
            config.contracts = deployment.contracts;
            await this.saveConfig(config);
            console.log("\n✅ Contracts deployed!");
            console.log(`   FCMToken: ${deployment.contracts.FCMToken}`);
            console.log(`   Registry: ${deployment.contracts.FCMAgentRegistry}`);
            console.log(`   Marketplace: ${deployment.contracts.FCMTaskMarketplace}`);
        } catch (e) {
            console.error("Deployment failed:", e.message);
            process.exit(1);
        }
    }

    async registerAgents() {
        console.log("\n🤖 Registering 8 FCM Expert Agents on blocks.ai...\n");
        const config = await this.loadConfig();
        const registry = new ethers.Contract(
            config.contracts.FCMAgentRegistry,
            ["function registerAgent(bytes32,string,bytes32,bytes32,uint8)"],
            this.wallet
        );
        const token = new ethers.Contract(
            config.contracts.FCMToken,
            ["function approve(address,uint256) returns (bool)"],
            this.wallet
        );

        for (const agent of AGENT_CONFIGS) {
            const didHash = ethers.keccak256(ethers.toUtf8Bytes(agent.name + "-" + Date.now()));
            const stakeWei = ethers.parseUnits(agent.stake.toString(), 18);
            const geohash = ethers.encodeBytes32String("u4pru");
            const capabilities = ethers.encodeBytes32String(agent.capabilities);
            const ipns = `/ipns/k51qzi5uqu5dil0q8${agent.type}`;

            console.log(`${agent.icon} Registering ${agent.name}...`);
            try {
                await (await token.approve(config.contracts.FCMAgentRegistry, stakeWei)).wait();
                const tx = await registry.registerAgent(didHash, ipns, capabilities, geohash, AGENT_TYPES[agent.type]);
                await tx.wait();
                config.agents[agent.type] = { didHash, name: agent.name, stake: agent.stake, registeredAt: new Date().toISOString() };
                console.log(`   ✓ DID: ${didHash.slice(0, 30)}...`);
                console.log(`   ✓ Staked: ${agent.stake} FCM`);
            } catch (e) {
                console.error(`   ✗ Failed: ${e.message}`);
            }
        }
        await this.saveConfig(config);
        console.log("\n✅ All agents registered on blocks.ai network!");
    }

    async startAgents() {
        console.log("\n🐳 Starting FCM Agent Swarm containers...\n");
        try {
            execSync("docker-compose -f docker/docker-compose.yml up -d", { stdio: "inherit", cwd: process.cwd() });
            console.log("\n✅ All agents started!");
            console.log("   Dashboard: http://localhost:8080");
            console.log("   Prometheus: http://localhost:9090");
            console.log("   Grafana: http://localhost:3000");
        } catch (e) {
            console.error("Failed to start agents:", e.message);
        }
    }

    async stopAgents() {
        console.log("\n🛑 Stopping FCM Agent Swarm...\n");
        try {
            execSync("docker-compose -f docker/docker-compose.yml down", { stdio: "inherit", cwd: process.cwd() });
            console.log("\n✅ All agents stopped.");
        } catch (e) {
            console.error("Failed to stop agents:", e.message);
        }
    }

    async status() {
        console.log("\n📊 FCM Network Status — blocks.ai\n");
        const config = await this.loadConfig();
        console.log("Contracts:");
        console.log(`  FCMToken: ${config.contracts.FCMToken || "Not deployed"}`);
        console.log(`  Registry: ${config.contracts.FCMAgentRegistry || "Not deployed"}`);
        console.log(`  Marketplace: ${config.contracts.FCMTaskMarketplace || "Not deployed"}`);
        console.log("\nRegistered Agents:");
        for (const [type, agent] of Object.entries(config.agents)) {
            console.log(`  ${AGENT_CONFIGS.find(a => a.type === type)?.icon || "⚡"} ${agent.name}: ${agent.didHash.slice(0, 20)}...`);
        }
        console.log("\nContainer Health:");
        const services = ["inference-router", "render-splitter", "fl-coordinator", "edge-runner", 
                         "zk-prover", "game-host", "science-grid", "privacy-mesh"];
        for (const svc of services) {
            try {
                const status = execSync(`docker inspect -f '{{.State.Status}}' fcm-${svc}`, { encoding: "utf8" }).trim();
                console.log(`  ${svc}: ${status}`);
            } catch {
                console.log(`  ${svc}: not running`);
            }
        }
    }

    async createTask() {
        console.log("\n📋 Create Compute Task on blocks.ai\n");
        const config = await this.loadConfig();
        const marketplace = new ethers.Contract(
            config.contracts.FCMTaskMarketplace,
            ["function listSpotTask(bytes32,bytes32,uint256,uint256,uint8)"],
            this.wallet
        );
        const taskId = ethers.keccak256(ethers.toUtf8Bytes("task-" + Date.now()));
        const requirements = ethers.encodeBytes32String("gpu,cuda");
        const maxPrice = ethers.parseUnits("10", 18);
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        console.log(`Creating task: ${taskId.slice(0, 20)}...`);
        const tx = await marketplace.listSpotTask(taskId, requirements, maxPrice, deadline, 2);
        await tx.wait();
        console.log("✅ Task listed on marketplace!");
    }
}

async function main() {
    const deployer = new FCMDeployer();
    const [cmd, subcmd] = process.argv.slice(2);
    switch (cmd) {
        case "init": await deployer.init(); break;
        case "contract": if (subcmd === "deploy") await deployer.deployContracts(); break;
        case "agent":
            if (subcmd === "register") await deployer.registerAgents();
            else if (subcmd === "start") await deployer.startAgents();
            else if (subcmd === "stop") await deployer.stopAgents();
            else console.log("Usage: fcm-deploy agent [register|start|stop]");
            break;
        case "status": await deployer.status(); break;
        case "task": if (subcmd === "create") await deployer.createTask(); break;
        default:
            console.log(`
FCM Deploy CLI — blocks.ai Network Deployment Tool

Usage:
  fcm-deploy init              Initialize deployment configuration
  fcm-deploy contract deploy   Deploy FCM smart contracts
  fcm-deploy agent register    Register all 8 expert agents
  fcm-deploy agent start       Start agent Docker containers
  fcm-deploy agent stop        Stop agent Docker containers
  fcm-deploy status            Check network and agent status
  fcm-deploy task create       Create a compute task

Environment Variables:
  FCM_RPC_URL        Blockchain RPC endpoint
  FCM_PRIVATE_KEY    Deployer private key
            `);
    }
}

main().catch(console.error);
