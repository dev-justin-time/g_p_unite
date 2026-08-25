import { expect } from "chai";
import hre from "hardhat";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const resourceAnalyzerMod = await import("../lib/modules/resource-analyzer.js");
const permissionManagerMod = await import("../lib/modules/permission-manager.js");
const onboardingMod = await import("../lib/modules/onboarding.js");
const useCaseManagerMod = await import("../lib/modules/use-case-manager.js");
const settingsManagerMod = await import("../lib/modules/settings-manager.js");

const { ResourceAnalyzer } = resourceAnalyzerMod;
const { PermissionManager, ROLES, PERMISSIONS } = permissionManagerMod;
const { Onboarding } = onboardingMod;
const { UseCaseManager, USE_CASE_CATEGORIES, APPROVAL_STATUS } = useCaseManagerMod;
const { SettingsManager, DEFAULT_SETTINGS } = settingsManagerMod;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { ethers } = await hre.network.create();

// ── ResourceAnalyzer Tests ──────────────────────────────────────

describe("ResourceAnalyzer", function () {
    let analyzer;

    beforeEach(function () {
        analyzer = new ResourceAnalyzer();
    });

    it("should analyze system and return profile", async function () {
        const profile = await analyzer.analyze();
        expect(profile).to.have.property("platform");
        expect(profile).to.have.property("cpu");
        expect(profile).to.have.property("memory");
        expect(profile).to.have.property("capabilities");
        expect(profile).to.have.property("score");
        expect(profile.score).to.be.a("number");
    });

    it("should detect CPU cores", async function () {
        const profile = await analyzer.analyze();
        expect(profile.cpu.cores).to.be.greaterThan(0);
    });

    it("should detect memory", async function () {
        const profile = await analyzer.analyze();
        expect(profile.memory.totalGB).to.be.greaterThan(0);
    });

    it("should return usage stats", function () {
        const usage = analyzer.getUsage();
        expect(usage).to.have.property("cpu");
        expect(usage).to.have.property("memory");
        expect(usage.cpu.cores).to.be.greaterThan(0);
    });

    it("should check workload requirements", async function () {
        await analyzer.analyze();
        const result = analyzer.meetsRequirements("edge");
        expect(result).to.have.property("eligible");
        expect(result).to.have.property("reason");
    });

    it("should reject unknown workload type", async function () {
        await analyzer.analyze();
        const result = analyzer.meetsRequirements("nonexistent");
        expect(result.eligible).to.equal(false);
    });

    it("should cache results", async function () {
        const p1 = await analyzer.analyze();
        const p2 = await analyzer.analyze();
        expect(p1).to.equal(p2); // Same reference = cached
    });
});

// ── PermissionManager Tests ─────────────────────────────────────

describe("PermissionManager", function () {
    let pm;
    const testConfigPath = path.join(__dirname, ".test-permissions.json");

    beforeEach(function () {
        // Clean up test file
        try { fs.unlinkSync(testConfigPath); } catch {}
        pm = new PermissionManager(testConfigPath);
    });

    afterEach(function () {
        try { fs.unlinkSync(testConfigPath); } catch {}
    });

    describe("User Management", function () {
        it("should add a user with default role", function () {
            const user = pm.addUser("0x1234");
            expect(user.address).to.equal("0x1234");
            expect(user.role).to.equal(ROLES.CONSUMER);
        });

        it("should add a user with specific role", function () {
            const user = pm.addUser("0x1234", ROLES.ADMIN);
            expect(user.role).to.equal(ROLES.ADMIN);
        });

        it("should update user role", function () {
            pm.addUser("0x1234", ROLES.VIEWER);
            pm.updateUserRole("0x1234", ROLES.ADMIN);
            const user = pm.users.get("0x1234");
            expect(user.role).to.equal(ROLES.ADMIN);
        });

        it("should ban and unban users", function () {
            pm.addUser("0x1234");
            pm.banUser("0x1234", "Spam");
            expect(pm.users.get("0x1234").banned).to.equal(true);

            pm.unbanUser("0x1234");
            expect(pm.users.get("0x1234").banned).to.equal(false);
        });
    });

    describe("Permission Checking", function () {
        it("should grant permissions based on role", function () {
            pm.addUser("0x1234", ROLES.ADMIN);
            expect(pm.hasPermission("0x1234", PERMISSIONS.AGENT_REGISTER)).to.equal(true);
            expect(pm.hasPermission("0x1234", PERMISSIONS.SYSTEM_SHUTDOWN)).to.equal(false);
        });

        it("should grant custom permissions", function () {
            pm.addUser("0x1234", ROLES.VIEWER);
            pm.grantPermission("0x1234", PERMISSIONS.TASK_CREATE);
            expect(pm.hasPermission("0x1234", PERMISSIONS.TASK_CREATE)).to.equal(true);
        });

        it("should revoke custom permissions", function () {
            pm.addUser("0x1234", ROLES.VIEWER);
            pm.grantPermission("0x1234", PERMISSIONS.TASK_CREATE);
            pm.revokePermission("0x1234", PERMISSIONS.TASK_CREATE);
            expect(pm.hasPermission("0x1234", PERMISSIONS.TASK_CREATE)).to.equal(false);
        });

        it("should deny permissions for banned users", function () {
            pm.addUser("0x1234", ROLES.ADMIN);
            pm.banUser("0x1234");
            expect(pm.hasPermission("0x1234", PERMISSIONS.AGENT_REGISTER)).to.equal(false);
        });

        it("should throw on requirePermission failure", function () {
            pm.addUser("0x1234", ROLES.VIEWER);
            expect(() => pm.requirePermission("0x1234", PERMISSIONS.SYSTEM_SHUTDOWN))
                .to.throw("Permission denied");
        });

        it("should return effective permissions", function () {
            pm.addUser("0x1234", ROLES.CONSUMER);
            pm.grantPermission("0x1234", PERMISSIONS.AGENT_REGISTER);
            const perms = pm.getEffectivePermissions("0x1234");
            expect(perms).to.include(PERMISSIONS.TASK_CREATE);  // from CONSUMER role
            expect(perms).to.include(PERMISSIONS.AGENT_REGISTER); // custom
        });
    });

    describe("Agent Management", function () {
        it("should register agent with permission check", function () {
            pm.addUser("0x1234", ROLES.ADMIN);
            const agent = pm.registerAgent("0x1234", "did:1234", ["gpu", "cuda"]);
            expect(agent.didHash).to.equal("did:1234");
            expect(agent.active).to.equal(true);
        });

        it("should reject agent registration without permission", function () {
            pm.addUser("0x1234", ROLES.VIEWER);
            expect(() => pm.registerAgent("0x1234", "did:1234"))
                .to.throw("Permission denied");
        });
    });

    describe("Policy Engine", function () {
        it("should add and evaluate policies", function () {
            pm.addPolicy({
                name: "No Mining",
                type: "deny",
                rules: [{ field: "category", pattern: "crypto_mining" }],
            });

            const result = pm.evaluatePolicies({ category: "crypto_mining" });
            expect(result.approved).to.equal(false);
            expect(result.violations.length).to.equal(1);
        });

        it("should approve workloads that pass policies", function () {
            pm.addPolicy({
                name: "No Mining",
                type: "deny",
                rules: [{ field: "category", pattern: "crypto_mining" }],
            });

            const result = pm.evaluatePolicies({ category: "ai_inference" });
            expect(result.approved).to.equal(true);
        });
    });

    describe("Reputation", function () {
        it("should update reputation within bounds", function () {
            pm.addUser("0x1234");
            // Default reputation is 500
            pm.updateReputation("0x1234", 500);
            expect(pm.users.get("0x1234").reputation).to.equal(1000);

            pm.updateReputation("0x1234", -10000);
            expect(pm.users.get("0x1234").reputation).to.equal(0);
        });

        it("should return correct reputation tier", function () {
            pm.addUser("0x1234");
            pm.updateReputation("0x1234", 8500); // 500 + 8500 = 9000 = legendary
            expect(pm.getReputationTier("0x1234").tier).to.equal("legendary");
        });
    });

    describe("Persistence", function () {
        it("should save and load state", function () {
            pm.addUser("0x1234", ROLES.ADMIN);
            pm.registerAgent("0x1234", "did:test", ["gpu"]);

            // Create new instance from same file
            const pm2 = new PermissionManager(testConfigPath);
            expect(pm2.users.size).to.equal(1);
            expect(pm2.agents.size).to.equal(1);
        });
    });

    describe("Network Summary", function () {
        it("should return correct summary", function () {
            pm.addUser("0x111", ROLES.ADMIN);
            pm.addUser("0x222", ROLES.PROVIDER);
            pm.addUser("0x333", ROLES.CONSUMER);
            pm.banUser("0x333");

            const summary = pm.getNetworkSummary();
            expect(summary.totalUsers).to.equal(3);
            expect(summary.activeUsers).to.equal(2);
            expect(summary.bannedUsers).to.equal(1);
        });
    });
});

// ── UseCaseManager Tests ────────────────────────────────────────

describe("UseCaseManager", function () {
    let ucm;
    const testConfigPath = path.join(process.cwd(), "test", ".test-usecases.json");

    beforeEach(function () {
        try { fs.unlinkSync(testConfigPath); } catch {}
        ucm = new UseCaseManager({ configPath: testConfigPath });
    });

    afterEach(function () {
        try { fs.unlinkSync(testConfigPath); } catch {}
    });

    it("should register a use case", function () {
        const uc = ucm.registerUseCase("0x1234", {
            name: "AI Inference Job",
            category: USE_CASE_CATEGORIES.AI_INFERENCE,
            workloadType: "inference",
        });
        expect(uc.status).to.equal(APPROVAL_STATUS.PENDING);
        expect(uc.name).to.equal("AI Inference Job");
    });

    it("should approve a use case", function () {
        const uc = ucm.registerUseCase("0x1234", {
            name: "Test Job",
            category: USE_CASE_CATEGORIES.AI_INFERENCE,
            workloadType: "inference",
        });
        const result = ucm.approveUseCase(uc.id, "0xadmin");
        expect(result.status).to.equal("approved");
    });

    it("should reject a use case", function () {
        const uc = ucm.registerUseCase("0x1234", {
            name: "Bad Job",
            category: USE_CASE_CATEGORIES.CUSTOM,
            workloadType: "edge",
        });
        const result = ucm.rejectUseCase(uc.id, "0xadmin", "Not needed");
        expect(result.status).to.equal("rejected");
    });

    it("should submit workload under approved use case", function () {
        const uc = ucm.registerUseCase("0x1234", {
            name: "Test Job",
            category: USE_CASE_CATEGORIES.EDGE_COMPUTING,
            workloadType: "edge",
        });
        ucm.approveUseCase(uc.id, "0xadmin");

        const wl = ucm.submitWorkload("0x1234", uc.id, { input: "test.wasm" });
        expect(wl.status).to.equal("submitted");
    });

    it("should reject workload under non-approved use case", function () {
        const uc = ucm.registerUseCase("0x1234", {
            name: "Pending Job",
            category: USE_CASE_CATEGORIES.EDGE_COMPUTING,
            workloadType: "edge",
        });

        const wl = ucm.submitWorkload("0x1234", uc.id, { input: "test.wasm" });
        expect(wl.status).to.equal("rejected");
    });

    it("should reject banned category use cases", function () {
        ucm.bannedCategories.push(USE_CASE_CATEGORIES.CUSTOM);
        const result = ucm.evaluateUseCase({
            category: USE_CASE_CATEGORIES.CUSTOM,
            workloadType: "edge",
        });
        expect(result.approved).to.equal(false);
    });

    it("should return summary statistics", function () {
        ucm.registerUseCase("0x1", { name: "A", category: "ai_inference", workloadType: "inference" });
        ucm.registerUseCase("0x2", { name: "B", category: "edge_computing", workloadType: "edge" });

        const summary = ucm.getSummary();
        expect(summary.useCases.total).to.equal(2);
        expect(summary.useCases.pending).to.equal(2);
    });

    it("should persist state", function () {
        ucm.registerUseCase("0x1234", { name: "Persist Test", category: "ai_inference", workloadType: "inference" });

        // Verify file was written
        expect(fs.existsSync(testConfigPath)).to.equal(true);
        const data = JSON.parse(fs.readFileSync(testConfigPath, "utf8"));
        expect(data.useCases.length).to.equal(1);

        // Load into new instance
        const ucm2 = new UseCaseManager({ configPath: testConfigPath });
        expect(ucm2.useCases.size).to.equal(1);
    });
});

// ── SettingsManager Tests ───────────────────────────────────────

describe("SettingsManager", function () {
    let sm;
    const testConfigPath = path.join(__dirname, ".test-settings.json");

    beforeEach(function () {
        try { fs.unlinkSync(testConfigPath); } catch {}
        sm = new SettingsManager(testConfigPath);
    });

    afterEach(function () {
        try { fs.unlinkSync(testConfigPath); } catch {}
    });

    it("should get default values", function () {
        expect(sm.get("agent.heartbeatInterval")).to.equal(120);
        expect(sm.get("network.rpcUrl")).to.equal("http://localhost:8545");
    });

    it("should set and get values", function () {
        sm.set("agent.heartbeatInterval", 60);
        expect(sm.get("agent.heartbeatInterval")).to.equal(60);
    });

    it("should validate number ranges", function () {
        expect(() => sm.set("agent.heartbeatInterval", 5)).to.throw("must be >=");
        expect(() => sm.set("agent.heartbeatInterval", 9999)).to.throw("must be <=");
    });

    it("should validate enum values", function () {
        expect(() => sm.set("logging.level", "verbose")).to.throw("must be one of");
        sm.set("logging.level", "debug");
        expect(sm.get("logging.level")).to.equal("debug");
    });

    it("should handle runtime overrides", function () {
        sm.set("agent.heartbeatInterval", 120);
        sm.override("agent.heartbeatInterval", 30);
        expect(sm.get("agent.heartbeatInterval")).to.equal(30);

        sm.clearOverride("agent.heartbeatInterval");
        expect(sm.get("agent.heartbeatInterval")).to.equal(120);
    });

    it("should persist settings", function () {
        sm.set("agent.heartbeatInterval", 90);
        const sm2 = new SettingsManager(testConfigPath);
        expect(sm2.get("agent.heartbeatInterval")).to.equal(90);
    });

    it("should fire change listeners", function () {
        let fired = false;
        sm.onChange("agent.heartbeatInterval", (newVal, oldVal) => {
            fired = true;
            expect(newVal).to.equal(30);
            expect(oldVal).to.equal(120);
        });
        sm.set("agent.heartbeatInterval", 30);
        expect(fired).to.equal(true);
    });

    it("should export and import settings", function () {
        sm.set("agent.heartbeatInterval", 45);
        const exported = sm.export();
        const imported = JSON.parse(exported);
        expect(imported["agent.heartbeatInterval"]).to.equal(45);
    });

    it("should get all settings", function () {
        const all = sm.getAll();
        expect(all).to.have.property("agent.heartbeatInterval");
        expect(all).to.have.property("network.rpcUrl");
        expect(all).to.have.property("logging.level");
    });
});

// ── Onboarding Tests ────────────────────────────────────────────

describe("Onboarding", function () {
    let onboarding;

    beforeEach(function () {
        onboarding = new Onboarding();
    });

    it("should validate existing private key", async function () {
        const wallet = ethers.Wallet.createRandom();
        const result = await onboarding.setupWallet(wallet.privateKey);
        expect(result.status).to.equal("ready");
        expect(result.address).to.equal(wallet.address);
    });

    it("should generate new wallet when no key provided", async function () {
        const result = await onboarding.setupWallet();
        expect(result.status).to.equal("generated");
        expect(result.privateKey).to.exist;
        expect(result.mnemonic).to.exist;
    });

    it("should reject invalid private key", async function () {
        const result = await onboarding.setupWallet("not-a-key");
        expect(result.status).to.equal("error");
    });

    it("should analyze system", async function () {
        const result = await onboarding.analyzeSystem();
        expect(result.status).to.equal("analyzed");
        expect(result.suitableWorkloads).to.be.an("array");
    });

    it("should configure agent", async function () {
        const result = await onboarding.configureAgent({
            walletAddress: "0x1234",
            workloadType: "edge",
        });
        expect(result.status).to.equal("configured");
        expect(result.agent.type).to.equal("edge");
    });

    it("should complete full onboarding", async function () {
        const wallet = ethers.Wallet.createRandom();
        const result = await onboarding.completeOnboarding({
            privateKey: wallet.privateKey,
            workloadType: "edge",
            agentName: "test-agent",
        });
        expect(result.success).to.equal(true);
        expect(result.summary.agentName).to.equal("test-agent");
    });
});
