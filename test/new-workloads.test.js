const { expect } = require("chai");
const { ethers } = require("hardhat");

const { ResourceAnalyzer } = require("../lib/modules/resource-analyzer");
const { PermissionManager, ROLES } = require("../lib/modules/permission-manager");
const { Onboarding } = require("../lib/modules/onboarding");
const { UseCaseManager, USE_CASE_CATEGORIES, APPROVAL_STATUS } = require("../lib/modules/use-case-manager");
const { SettingsManager } = require("../lib/modules/settings-manager");
const fs = require("fs");
const path = require("path");

// ── ResourceAnalyzer — New Workload Types ───────────────────────

describe("ResourceAnalyzer — New Workload Types", function () {
    let analyzer;

    beforeEach(async function () {
        analyzer = new ResourceAnalyzer();
        await analyzer.analyze();
    });

    it("should check node requirements (low barrier)", function () {
        const result = analyzer.meetsRequirements("node");
        expect(result).to.have.property("eligible");
        expect(result.requirements.minRAM_GB).to.equal(2);
        expect(result.requirements.minCores).to.equal(2);
    });

    it("should check storage requirements", function () {
        const result = analyzer.meetsRequirements("storage");
        expect(result).to.have.property("eligible");
        expect(result.requirements.minDisk_GB).to.equal(100);
    });

    it("should check file_server requirements", function () {
        const result = analyzer.meetsRequirements("file_server");
        expect(result).to.have.property("eligible");
        expect(result.requirements.minDisk_GB).to.equal(50);
        expect(result.requirements.requiresNetwork).to.equal(true);
    });

    it("should check rewarded requirements (lowest barrier)", function () {
        const result = analyzer.meetsRequirements("rewarded");
        expect(result).to.have.property("eligible");
        expect(result.requirements.minRAM_GB).to.equal(1);
        expect(result.requirements.minCores).to.equal(1);
    });

    it("should include disk in score computation", async function () {
        const profile = await analyzer.analyze();
        expect(profile.score).to.be.a("number");
        expect(profile.score).to.be.greaterThan(0);
    });

    it("should detect disk capabilities", async function () {
        const profile = await analyzer.analyze();
        expect(profile.disk).to.have.property("totalGB");
        expect(profile.disk).to.have.property("freeGB");
    });
});

// ── UseCaseManager — New Categories ─────────────────────────────

describe("UseCaseManager — New Categories", function () {
    let ucm;
    const testConfigPath = path.join(process.cwd(), "test", ".test-new-categories.json");

    beforeEach(function () {
        try { fs.unlinkSync(testConfigPath); } catch {}
        ucm = new UseCaseManager({ configPath: testConfigPath });
    });

    afterEach(function () {
        try { fs.unlinkSync(testConfigPath); } catch {}
    });

    it("should register compute_node use case", function () {
        const uc = ucm.registerUseCase("0x1234", {
            name: "General Compute",
            category: USE_CASE_CATEGORIES.COMPUTE_NODE,
            workloadType: "node",
        });
        expect(uc.category).to.equal("compute_node");
        expect(uc.status).to.equal(APPROVAL_STATUS.PENDING);
    });

    it("should register storage use case", function () {
        const uc = ucm.registerUseCase("0x1234", {
            name: "IPFS Storage",
            category: USE_CASE_CATEGORIES.STORAGE,
            workloadType: "storage",
        });
        expect(uc.category).to.equal("storage");
    });

    it("should register file_server use case", function () {
        const uc = ucm.registerUseCase("0x1234", {
            name: "File Hosting",
            category: USE_CASE_CATEGORIES.FILE_SERVER,
            workloadType: "file_server",
        });
        expect(uc.category).to.equal("file_server");
    });

    it("should register rewarded use case", function () {
        const uc = ucm.registerUseCase("0x1234", {
            name: "Bounty Tasks",
            category: USE_CASE_CATEGORIES.REWARDED_TASKS,
            workloadType: "rewarded",
        });
        expect(uc.category).to.equal("rewarded_tasks");
    });

    it("should approve and submit node workload", function () {
        const uc = ucm.registerUseCase("0x1234", {
            name: "Node Work",
            category: USE_CASE_CATEGORIES.COMPUTE_NODE,
            workloadType: "node",
        });
        ucm.approveUseCase(uc.id, "0xadmin");
        const wl = ucm.submitWorkload("0x1234", uc.id, { input: "process-data" });
        expect(wl.status).to.equal("submitted");
    });

    it("should approve and submit storage workload", function () {
        const uc = ucm.registerUseCase("0x1234", {
            name: "Pin Dataset",
            category: USE_CASE_CATEGORIES.STORAGE,
            workloadType: "storage",
        });
        ucm.approveUseCase(uc.id, "0xadmin");
        const wl = ucm.submitWorkload("0x1234", uc.id, { input: "QmDataset123" });
        expect(wl.status).to.equal("submitted");
    });

    it("should approve and submit file_server workload", function () {
        const uc = ucm.registerUseCase("0x1234", {
            name: "Host Package",
            category: USE_CASE_CATEGORIES.FILE_SERVER,
            workloadType: "file_server",
        });
        ucm.approveUseCase(uc.id, "0xadmin");
        const wl = ucm.submitWorkload("0x1234", uc.id, { input: "/packages/myapp.tar.gz" });
        expect(wl.status).to.equal("submitted");
    });

    it("should approve and submit rewarded workload", function () {
        const uc = ucm.registerUseCase("0x1234", {
            name: "Data Cleanup Bounty",
            category: USE_CASE_CATEGORIES.REWARDED_TASKS,
            workloadType: "rewarded",
        });
        ucm.approveUseCase(uc.id, "0xadmin");
        const wl = ucm.submitWorkload("0x1234", uc.id, { input: "cleanup-logs" });
        expect(wl.status).to.equal("submitted");
    });

    it("should show all categories in summary", function () {
        const summary = ucm.getSummary();
        expect(summary.categories).to.have.property("compute_node");
        expect(summary.categories).to.have.property("storage");
        expect(summary.categories).to.have.property("file_server");
        expect(summary.categories).to.have.property("rewarded_tasks");
    });
});

// ── Onboarding — New Workload Types ─────────────────────────────

describe("Onboarding — New Workload Types", function () {
    let onboarding;

    beforeEach(function () {
        onboarding = new Onboarding();
    });

    it("should configure node agent with low stake", async function () {
        const result = await onboarding.configureAgent({
            walletAddress: "0x1234",
            workloadType: "node",
        });
        expect(result.status).to.equal("configured");
        expect(result.agent.stakeRequired).to.equal(100);
        expect(result.agent.config).to.have.property("heartbeatInterval");
    });

    it("should configure storage agent", async function () {
        const result = await onboarding.configureAgent({
            walletAddress: "0x1234",
            workloadType: "storage",
        });
        expect(result.status).to.equal("configured");
        expect(result.agent.stakeRequired).to.equal(250);
        expect(result.agent.config).to.have.property("maxStorageGB");
        expect(result.agent.estimatedEarnings).to.have.property("perGBMonth");
    });

    it("should configure file_server agent", async function () {
        const result = await onboarding.configureAgent({
            walletAddress: "0x1234",
            workloadType: "file_server",
        });
        expect(result.status).to.equal("configured");
        expect(result.agent.stakeRequired).to.equal(250);
        expect(result.agent.config).to.have.property("maxBandwidthMbps");
        expect(result.agent.config).to.have.property("tlsEnabled");
        expect(result.agent.estimatedEarnings).to.have.property("perGB");
    });

    it("should configure rewarded agent with lowest stake", async function () {
        const result = await onboarding.configureAgent({
            walletAddress: "0x1234",
            workloadType: "rewarded",
        });
        expect(result.status).to.equal("configured");
        expect(result.agent.stakeRequired).to.equal(50);
        expect(result.agent.config).to.have.property("autoClaim");
        expect(result.agent.config).to.have.property("minReward");
    });

    it("should include node capabilities", async function () {
        const result = await onboarding.configureAgent({
            walletAddress: "0x1234",
            workloadType: "node",
        });
        expect(result.agent.capabilities).to.include("compute");
    });

    it("should include storage capabilities", async function () {
        const result = await onboarding.configureAgent({
            walletAddress: "0x1234",
            workloadType: "storage",
        });
        expect(result.agent.capabilities).to.include("disk");
        expect(result.agent.capabilities).to.include("ipfs");
    });

    it("should include file_server capabilities", async function () {
        const result = await onboarding.configureAgent({
            walletAddress: "0x1234",
            workloadType: "file_server",
        });
        expect(result.agent.capabilities).to.include("disk");
        expect(result.agent.capabilities).to.include("network");
        expect(result.agent.capabilities).to.include("http");
    });

    it("should include rewarded capabilities", async function () {
        const result = await onboarding.configureAgent({
            walletAddress: "0x1234",
            workloadType: "rewarded",
        });
        expect(result.agent.capabilities).to.include("compute");
    });

    it("should complete full onboarding for node", async function () {
        const { ethers } = require("ethers");
        const wallet = ethers.Wallet.createRandom();
        const result = await onboarding.completeOnboarding({
            privateKey: wallet.privateKey,
            workloadType: "node",
            agentName: "test-node",
        });
        expect(result.success).to.equal(true);
        expect(result.summary.agentType).to.equal("node");
        expect(result.summary.stakeRequired).to.equal(100);
    });

    it("should complete full onboarding for storage", async function () {
        const { ethers } = require("ethers");
        const wallet = ethers.Wallet.createRandom();
        const result = await onboarding.completeOnboarding({
            privateKey: wallet.privateKey,
            workloadType: "storage",
            agentName: "test-storage",
        });
        expect(result.success).to.equal(true);
        expect(result.summary.stakeRequired).to.equal(250);
    });
});

// ── SettingsManager — New Settings ──────────────────────────────

describe("SettingsManager — New Settings", function () {
    let sm;
    const testConfigPath = path.join(process.cwd(), "test", ".test-new-settings.json");

    beforeEach(function () {
        try { fs.unlinkSync(testConfigPath); } catch {}
        sm = new SettingsManager(testConfigPath);
    });

    afterEach(function () {
        try { fs.unlinkSync(testConfigPath); } catch {}
    });

    it("should have storage defaults", function () {
        // These are agent-level settings, accessed via getAgentSettings
        sm.setAgentSettings("storage-001", {
            maxStorageGB: 1000,
            replicationFactor: 3,
            gcInterval: 3600,
            pinningEnabled: true,
        });
        const settings = sm.getAgentSettings("storage-001");
        expect(settings.maxStorageGB).to.equal(1000);
        expect(settings.replicationFactor).to.equal(3);
        expect(settings.pinningEnabled).to.equal(true);
    });

    it("should have file_server defaults", function () {
        sm.setAgentSettings("fileserver-001", {
            maxBandwidthMbps: 100,
            cacheEnabled: true,
            maxConnections: 100,
            tlsEnabled: true,
        });
        const settings = sm.getAgentSettings("fileserver-001");
        expect(settings.maxBandwidthMbps).to.equal(100);
        expect(settings.tlsEnabled).to.equal(true);
    });

    it("should have node defaults", function () {
        sm.setAgentSettings("node-001", {
            heartbeatInterval: 60,
            maxConcurrentTasks: 5,
            autoClaim: true,
        });
        const settings = sm.getAgentSettings("node-001");
        expect(settings.heartbeatInterval).to.equal(60);
        expect(settings.autoClaim).to.equal(true);
    });

    it("should have rewarded defaults", function () {
        sm.setAgentSettings("rewarded-001", {
            autoClaim: true,
            minReward: "0.1",
            maxConcurrentBounties: 10,
        });
        const settings = sm.getAgentSettings("rewarded-001");
        expect(settings.minReward).to.equal("0.1");
        expect(settings.maxConcurrentBounties).to.equal(10);
    });
});
