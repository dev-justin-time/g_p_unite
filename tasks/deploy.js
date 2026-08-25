/**
 * FCM Hardhat Tasks — Individual Contract Deployment (Hardhat 3 ESM)
 *
 * Deploy any of the 8 FCM contracts independently with custom configuration.
 *
 * Usage:
 *   npx hardhat deploy:token --network sepolia --treasury 0x...
 *   npx hardhat deploy:registry --network sepolia --token 0x...
 *   npx hardhat deploy:marketplace --network sepolia --registry 0x... --token 0x...
 *   npx hardhat deploy:tier-staking --network sepolia --token 0x...
 *   npx hardhat deploy:governance --network sepolia --token 0x... --tier-staking 0x...
 *   npx hardhat deploy:escrow --network sepolia --token 0x...
 *   npx hardhat deploy:reputation --network sepolia
 *   npx hardhat deploy:rewards-pool --network sepolia --token 0x... --tier-staking 0x...
 *
 *   npx hardhat deploy:all --network sepolia  (deploy all 8)
 *   npx hardhat deploy:status --network sepolia  (check deployed state)
 */

import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types/arguments";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Helpers ──────────────────────────────────────────────────────

function log(msg) { console.log(`  ${msg}`); }
function logHeader(msg) { console.log(`\n${"═".repeat(60)}\n  ${msg}\n${"═".repeat(60)}`); }

function getDeploymentPath(networkName) {
    const dir = path.join(__dirname, "../deployments");
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${networkName}.json`);
}

function loadDeployment(networkName) {
    const p = getDeploymentPath(networkName);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
    return { network: networkName, contracts: {}, roles: {} };
}

function saveDeployment(networkName, data) {
    const p = getDeploymentPath(networkName);
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
    // Also update latest.json
    fs.writeFileSync(path.join(path.dirname(p), "latest.json"), JSON.stringify(data, null, 2));
    log(`📄 Saved to ${p}`);
}

function updateDeployment(networkName, contractName, address) {
    const data = loadDeployment(networkName);
    data.contracts[contractName] = address;
    data.network = networkName;
    data.timestamp = new Date().toISOString();
    saveDeployment(networkName, data);
}

// ══════════════════════════════════════════════════════════════════
// TASK: deploy:token
// ══════════════════════════════════════════════════════════════════

export const deployTokenTask = task("deploy:token", "Deploy FCMToken (ERC20 with fees)")
    .addOption({
        name: "treasury",
        description: "Treasury address (defaults to deployer)",
        defaultValue: "",
        type: ArgumentType.STRING,
    })
    .setInlineAction(async (taskArgs, hre) => {
        const conn = await hre.network.connect();
        const { ethers } = conn;
        const signers = await conn.provider.request({ method: "eth_accounts" });
        const deployer = await ethers.getSigner(signers[0]);
        const treasury = taskArgs.treasury || deployer.address;

        logHeader("Deploying FCMToken");
        log(`Deployer:  ${deployer.address}`);
        log(`Treasury:  ${treasury}`);
        log(`Network:   ${conn.networkName}`);

        const FCMToken = await ethers.getContractFactory("FCMToken");
        const token = await FCMToken.deploy(treasury);
        await token.waitForDeployment();
        const addr = await token.getAddress();

        log(`\n  ✅ FCMToken deployed to: ${addr}`);

        // Verify role setup
        const MINTER_ROLE = await token.MINTER_ROLE();
        log(`  MINTER_ROLE: ${MINTER_ROLE}`);

        const totalSupply = await token.totalSupply();
        log(`  Total Supply: ${ethers.formatEther(totalSupply)} FCM`);
        log(`  Decimals: ${await token.decimals()}`);

        updateDeployment(conn.networkName, "FCMToken", addr);
        return { address: addr, deployer: deployer.address, treasury };
    })
    .build();

// ══════════════════════════════════════════════════════════════════
// TASK: deploy:registry
// ══════════════════════════════════════════════════════════════════

export const deployRegistryTask = task("deploy:registry", "Deploy FCMAgentRegistry")
    .addOption({
        name: "token",
        description: "FCMToken contract address",
        defaultValue: "",
        type: ArgumentType.STRING,
    })
    .setInlineAction(async (taskArgs, hre) => {
        if (!taskArgs.token) { log("❌ --token is required"); return; }
        const conn = await hre.network.connect();
        const { ethers } = conn;
        const signers = await conn.provider.request({ method: "eth_accounts" });
        const deployer = await ethers.getSigner(signers[0]);

        logHeader("Deploying FCMAgentRegistry");
        log(`Deployer: ${deployer.address}`);
        log(`Token:    ${taskArgs.token}`);

        const FCMAgentRegistry = await ethers.getContractFactory("FCMAgentRegistry");
        const registry = await FCMAgentRegistry.deploy(taskArgs.token);
        await registry.waitForDeployment();
        const addr = await registry.getAddress();

        log(`\n  ✅ FCMAgentRegistry deployed to: ${addr}`);

        const registryToken = await registry.fcmToken();
        log(`  fcmToken: ${registryToken} ${registryToken.toLowerCase() === taskArgs.token.toLowerCase() ? "✅" : "❌"}`);

        const VALIDATOR_ROLE = await registry.VALIDATOR_ROLE();
        log(`  VALIDATOR_ROLE: ${VALIDATOR_ROLE}`);

        updateDeployment(conn.networkName, "FCMAgentRegistry", addr);
        return { address: addr, deployer: deployer.address, token: taskArgs.token };
    })
    .build();

// ══════════════════════════════════════════════════════════════════
// TASK: deploy:marketplace
// ══════════════════════════════════════════════════════════════════

export const deployMarketplaceTask = task("deploy:marketplace", "Deploy FCMTaskMarketplace")
    .addOption({
        name: "registry",
        description: "FCMAgentRegistry contract address",
        defaultValue: "",
        type: ArgumentType.STRING,
    })
    .addOption({
        name: "token",
        description: "FCMToken contract address",
        defaultValue: "",
        type: ArgumentType.STRING,
    })
    .setInlineAction(async (taskArgs, hre) => {
        if (!taskArgs.registry || !taskArgs.token) { log("❌ --registry and --token are required"); return; }
        const conn = await hre.network.connect();
        const { ethers } = conn;
        const signers = await conn.provider.request({ method: "eth_accounts" });
        const deployer = await ethers.getSigner(signers[0]);

        logHeader("Deploying FCMTaskMarketplace");
        log(`Deployer:  ${deployer.address}`);
        log(`Registry:  ${taskArgs.registry}`);
        log(`Token:     ${taskArgs.token}`);

        const FCMTaskMarketplace = await ethers.getContractFactory("FCMTaskMarketplace");
        const marketplace = await FCMTaskMarketplace.deploy(taskArgs.registry, taskArgs.token);
        await marketplace.waitForDeployment();
        const addr = await marketplace.getAddress();

        log(`\n  ✅ FCMTaskMarketplace deployed to: ${addr}`);

        const mktRegistry = await marketplace.registry();
        const mktToken = await marketplace.fcmToken();
        log(`  registry: ${mktRegistry} ${mktRegistry.toLowerCase() === taskArgs.registry.toLowerCase() ? "✅" : "❌"}`);
        log(`  fcmToken: ${mktToken} ${mktToken.toLowerCase() === taskArgs.token.toLowerCase() ? "✅" : "❌"}`);

        const LISTING_ROLE = await marketplace.LISTING_ROLE();
        log(`  LISTING_ROLE: ${LISTING_ROLE}`);

        updateDeployment(conn.networkName, "FCMTaskMarketplace", addr);
        return { address: addr, deployer: deployer.address, registry: taskArgs.registry, token: taskArgs.token };
    })
    .build();

// ══════════════════════════════════════════════════════════════════
// TASK: deploy:tier-staking
// ══════════════════════════════════════════════════════════════════

export const deployTierStakingTask = task("deploy:tier-staking", "Deploy FCMTierStaking")
    .addOption({
        name: "token",
        description: "FCMToken contract address",
        defaultValue: "",
        type: ArgumentType.STRING,
    })
    .setInlineAction(async (taskArgs, hre) => {
        if (!taskArgs.token) { log("❌ --token is required"); return; }
        const conn = await hre.network.connect();
        const { ethers } = conn;
        const signers = await conn.provider.request({ method: "eth_accounts" });
        const deployer = await ethers.getSigner(signers[0]);

        logHeader("Deploying FCMTierStaking");
        log(`Deployer: ${deployer.address}`);
        log(`Token:    ${taskArgs.token}`);

        const FCMTierStaking = await ethers.getContractFactory("FCMTierStaking");
        const tierStaking = await FCMTierStaking.deploy(taskArgs.token);
        await tierStaking.waitForDeployment();
        const addr = await tierStaking.getAddress();

        log(`\n  ✅ FCMTierStaking deployed to: ${addr}`);

        const tsToken = await tierStaking.fcmToken();
        log(`  fcmToken: ${tsToken} ${tsToken.toLowerCase() === taskArgs.token.toLowerCase() ? "✅" : "❌"}`);

        const ORACLE_ROLE = await tierStaking.ORACLE_ROLE();
        log(`  ORACLE_ROLE: ${ORACLE_ROLE}`);

        // Show tier configs
        log(`\n  Tier configs:`);
        for (let t = 0; t <= 5; t++) {
            const cfg = await tierStaking.tiers(t);
            log(`    T${t}: ${cfg.name} | minStake: ${ethers.formatEther(cfg.minStake)} | mult: ${cfg.rewardMultiplier / 100}x | feeDiscount: ${cfg.feeDiscount / 100}%`);
        }

        updateDeployment(conn.networkName, "FCMTierStaking", addr);
        return { address: addr, deployer: deployer.address, token: taskArgs.token };
    })
    .build();

// ══════════════════════════════════════════════════════════════════
// TASK: deploy:governance
// ══════════════════════════════════════════════════════════════════

export const deployGovernanceTask = task("deploy:governance", "Deploy FCMGovernance")
    .addOption({
        name: "token",
        description: "FCMToken contract address",
        defaultValue: "",
        type: ArgumentType.STRING,
    })
    .addOption({
        name: "tierStaking",
        description: "FCMTierStaking contract address",
        defaultValue: "",
        type: ArgumentType.STRING,
    })
    .setInlineAction(async (taskArgs, hre) => {
        if (!taskArgs.token || !taskArgs.tierStaking) { log("❌ --token and --tierStaking are required"); return; }
        const conn = await hre.network.connect();
        const { ethers } = conn;
        const signers = await conn.provider.request({ method: "eth_accounts" });
        const deployer = await ethers.getSigner(signers[0]);

        logHeader("Deploying FCMGovernance");
        log(`Deployer:    ${deployer.address}`);
        log(`Token:       ${taskArgs.token}`);
        log(`TierStaking: ${taskArgs.tierStaking}`);

        const FCMGovernance = await ethers.getContractFactory("FCMGovernance");
        const governance = await FCMGovernance.deploy(taskArgs.token, taskArgs.tierStaking);
        await governance.waitForDeployment();
        const addr = await governance.getAddress();

        log(`\n  ✅ FCMGovernance deployed to: ${addr}`);

        const govToken = await governance.fcmToken();
        const govTS = await governance.tierStaking();
        log(`  fcmToken:    ${govToken} ${govToken.toLowerCase() === taskArgs.token.toLowerCase() ? "✅" : "❌"}`);
        log(`  tierStaking: ${govTS} ${govTS.toLowerCase() === taskArgs.tierStaking.toLowerCase() ? "✅" : "❌"}`);

        const votingDuration = await governance.votingDuration();
        const timelockDuration = await governance.timelockDuration();
        const quorum = await governance.quorumThreshold();
        log(`  Voting duration: ${Number(votingDuration) / 86400} days`);
        log(`  Timelock: ${Number(timelockDuration) / 86400} days`);
        log(`  Quorum: ${Number(quorum) / 100}%`);

        updateDeployment(conn.networkName, "FCMGovernance", addr);
        return { address: addr, deployer: deployer.address, token: taskArgs.token, tierStaking: taskArgs.tierStaking };
    })
    .build();

// ══════════════════════════════════════════════════════════════════
// TASK: deploy:escrow
// ══════════════════════════════════════════════════════════════════

export const deployEscrowTask = task("deploy:escrow", "Deploy FCMEscrow")
    .addOption({
        name: "token",
        description: "FCMToken contract address",
        defaultValue: "",
        type: ArgumentType.STRING,
    })
    .setInlineAction(async (taskArgs, hre) => {
        if (!taskArgs.token) { log("❌ --token is required"); return; }
        const conn = await hre.network.connect();
        const { ethers } = conn;
        const signers = await conn.provider.request({ method: "eth_accounts" });
        const deployer = await ethers.getSigner(signers[0]);

        logHeader("Deploying FCMEscrow");
        log(`Deployer: ${deployer.address}`);
        log(`Token:    ${taskArgs.token}`);

        const FCMEscrow = await ethers.getContractFactory("FCMEscrow");
        const escrow = await FCMEscrow.deploy(taskArgs.token);
        await escrow.waitForDeployment();
        const addr = await escrow.getAddress();

        log(`\n  ✅ FCMEscrow deployed to: ${addr}`);

        const escToken = await escrow.fcmToken();
        log(`  fcmToken: ${escToken} ${escToken.toLowerCase() === taskArgs.token.toLowerCase() ? "✅" : "❌"}`);

        const ARBITRATOR_ROLE = await escrow.ARBITRATOR_ROLE();
        log(`  ARBITRATOR_ROLE: ${ARBITRATOR_ROLE}`);

        const multisigThreshold = await escrow.multisigThreshold();
        const disputeWindow = await escrow.disputeWindow();
        log(`  Multisig threshold: ${ethers.formatEther(multisigThreshold)} FCM`);
        log(`  Dispute window: ${Number(disputeWindow) / 86400} days`);

        updateDeployment(conn.networkName, "FCMEscrow", addr);
        return { address: addr, deployer: deployer.address, token: taskArgs.token };
    })
    .build();

// ══════════════════════════════════════════════════════════════════
// TASK: deploy:reputation
// ══════════════════════════════════════════════════════════════════

export const deployReputationTask = task("deploy:reputation", "Deploy FCMReputationNFT (soulbound badges)")
    .setInlineAction(async (taskArgs, hre) => {
        const conn = await hre.network.connect();
        const { ethers } = conn;
        const signers = await conn.provider.request({ method: "eth_accounts" });
        const deployer = await ethers.getSigner(signers[0]);

        logHeader("Deploying FCMReputationNFT");
        log(`Deployer: ${deployer.address}`);

        const FCMReputationNFT = await ethers.getContractFactory("FCMReputationNFT");
        const nft = await FCMReputationNFT.deploy();
        await nft.waitForDeployment();
        const addr = await nft.getAddress();

        log(`\n  ✅ FCMReputationNFT deployed to: ${addr}`);

        const ORACLE_ROLE = await nft.ORACLE_ROLE();
        log(`  ORACLE_ROLE: ${ORACLE_ROLE}`);

        log(`\n  Soulbound properties:`);
        log(`    Transfer: blocked`);
        log(`    Approve: blocked`);
        log(`    Total badges: ${await nft.totalSupply()}`);

        updateDeployment(conn.networkName, "FCMReputationNFT", addr);
        return { address: addr, deployer: deployer.address };
    })
    .build();

// ══════════════════════════════════════════════════════════════════
// TASK: deploy:rewards-pool
// ══════════════════════════════════════════════════════════════════

export const deployRewardsPoolTask = task("deploy:rewards-pool", "Deploy FCMRewardsPool")
    .addOption({
        name: "token",
        description: "FCMToken contract address",
        defaultValue: "",
        type: ArgumentType.STRING,
    })
    .addOption({
        name: "tierStaking",
        description: "FCMTierStaking contract address",
        defaultValue: "",
        type: ArgumentType.STRING,
    })
    .setInlineAction(async (taskArgs, hre) => {
        if (!taskArgs.token || !taskArgs.tierStaking) { log("❌ --token and --tierStaking are required"); return; }
        const conn = await hre.network.connect();
        const { ethers } = conn;
        const signers = await conn.provider.request({ method: "eth_accounts" });
        const deployer = await ethers.getSigner(signers[0]);

        logHeader("Deploying FCMRewardsPool");
        log(`Deployer:    ${deployer.address}`);
        log(`Token:       ${taskArgs.token}`);
        log(`TierStaking: ${taskArgs.tierStaking}`);

        const FCMRewardsPool = await ethers.getContractFactory("FCMRewardsPool");
        const pool = await FCMRewardsPool.deploy(taskArgs.token, taskArgs.tierStaking);
        await pool.waitForDeployment();
        const addr = await pool.getAddress();

        log(`\n  ✅ FCMRewardsPool deployed to: ${addr}`);

        const rpToken = await pool.fcmToken();
        const rpTS = await pool.tierStaking();
        log(`  fcmToken:    ${rpToken} ${rpToken.toLowerCase() === taskArgs.token.toLowerCase() ? "✅" : "❌"}`);
        log(`  tierStaking: ${rpTS} ${rpTS.toLowerCase() === taskArgs.tierStaking.toLowerCase() ? "✅" : "❌"}`);

        const ORACLE_ROLE = await pool.ORACLE_ROLE();
        log(`  ORACLE_ROLE: ${ORACLE_ROLE}`);

        updateDeployment(conn.networkName, "FCMRewardsPool", addr);
        return { address: addr, deployer: deployer.address, token: taskArgs.token, tierStaking: taskArgs.tierStaking };
    })
    .build();

// ══════════════════════════════════════════════════════════════════
// TASK: deploy:all
// ══════════════════════════════════════════════════════════════════

export const deployAllTask = task("deploy:all", "Deploy all 8 FCM contracts in dependency order")
    .addOption({
        name: "safe",
        description: "Gnosis Safe address to grant roles to (overrides deployer)",
        defaultValue: "",
        type: ArgumentType.STRING,
    })
    .setInlineAction(async (taskArgs, hre) => {
        const conn = await hre.network.connect();
        const { ethers } = conn;
        const signers = await conn.provider.request({ method: "eth_accounts" });
        const deployer = await ethers.getSigner(signers[0]);

        // Resolve Safe
        let roleGrantee = deployer.address;
        let safeInfo = null;
        if (taskArgs.safe) {
            try {
                const { GnosisSafeManager } = await import("../../lib/modules/gnosis-safe.js");
                const safeMgr = new GnosisSafeManager(deployer, taskArgs.safe, conn.networkName);
                safeInfo = await safeMgr.validate();
                if (safeInfo.valid) {
                    roleGrantee = taskArgs.safe;
                } else {
                    log(`  ⚠️  Safe validation failed, falling back to deployer`);
                }
            } catch (e) {
                log(`  ⚠️  Could not load GnosisSafeManager: ${e.message.slice(0, 60)}`);
            }
        }

        logHeader(`DEPLOY ALL — ${conn.networkName}`);
        log(`Deployer: ${deployer.address}`);
        if (taskArgs.safe) log(`Safe:     ${taskArgs.safe} ${safeInfo?.valid ? '(✅ valid)' : '(⚠️ validation failed)'}`);
        log(`Role grantee: ${roleGrantee === deployer.address ? 'Deployer' : 'Safe'}`);

        const deployed = {};
        const startTime = Date.now();

        // 1. FCMToken
        logHeader("1/8  FCMToken");
        const Token = await ethers.getContractFactory("FCMToken");
        const token = await Token.deploy(deployer.address);
        await token.waitForDeployment();
        deployed.FCMToken = await token.getAddress();
        log(`  ✅ ${deployed.FCMToken}`);

        // 2. FCMAgentRegistry
        logHeader("2/8  FCMAgentRegistry");
        const Registry = await ethers.getContractFactory("FCMAgentRegistry");
        const registry = await Registry.deploy(deployed.FCMToken);
        await registry.waitForDeployment();
        deployed.FCMAgentRegistry = await registry.getAddress();
        log(`  ✅ ${deployed.FCMAgentRegistry}`);

        // 3. FCMTaskMarketplace
        logHeader("3/8  FCMTaskMarketplace");
        const Marketplace = await ethers.getContractFactory("FCMTaskMarketplace");
        const marketplace = await Marketplace.deploy(deployed.FCMAgentRegistry, deployed.FCMToken);
        await marketplace.waitForDeployment();
        deployed.FCMTaskMarketplace = await marketplace.getAddress();
        log(`  ✅ ${deployed.FCMTaskMarketplace}`);

        // 4. FCMTierStaking
        logHeader("4/8  FCMTierStaking");
        const TierStaking = await ethers.getContractFactory("FCMTierStaking");
        const tierStaking = await TierStaking.deploy(deployed.FCMToken);
        await tierStaking.waitForDeployment();
        deployed.FCMTierStaking = await tierStaking.getAddress();
        log(`  ✅ ${deployed.FCMTierStaking}`);

        // 5. FCMGovernance
        logHeader("5/8  FCMGovernance");
        const Governance = await ethers.getContractFactory("FCMGovernance");
        const governance = await Governance.deploy(deployed.FCMToken, deployed.FCMTierStaking);
        await governance.waitForDeployment();
        deployed.FCMGovernance = await governance.getAddress();
        log(`  ✅ ${deployed.FCMGovernance}`);

        // 6. FCMEscrow
        logHeader("6/8  FCMEscrow");
        const Escrow = await ethers.getContractFactory("FCMEscrow");
        const escrow = await Escrow.deploy(deployed.FCMToken);
        await escrow.waitForDeployment();
        deployed.FCMEscrow = await escrow.getAddress();
        log(`  ✅ ${deployed.FCMEscrow}`);

        // 7. FCMReputationNFT
        logHeader("7/8  FCMReputationNFT");
        const ReputationNFT = await ethers.getContractFactory("FCMReputationNFT");
        const reputationNFT = await ReputationNFT.deploy();
        await reputationNFT.waitForDeployment();
        deployed.FCMReputationNFT = await reputationNFT.getAddress();
        log(`  ✅ ${deployed.FCMReputationNFT}`);

        // 8. FCMRewardsPool
        logHeader("8/8  FCMRewardsPool");
        const RewardsPool = await ethers.getContractFactory("FCMRewardsPool");
        const rewardsPool = await RewardsPool.deploy(deployed.FCMToken, deployed.FCMTierStaking);
        await rewardsPool.waitForDeployment();
        deployed.FCMRewardsPool = await rewardsPool.getAddress();
        log(`  ✅ ${deployed.FCMRewardsPool}`);

        // ── Role Grants ──
        logHeader("ROLE GRANTS");
        const MINTER = await token.MINTER_ROLE();
        const LISTING = await marketplace.LISTING_ROLE();
        const VALIDATOR = await registry.VALIDATOR_ROLE();
        const ORACLE_TIER = await tierStaking.ORACLE_ROLE();
        const ORACLE_REP = await reputationNFT.ORACLE_ROLE();
        const ORACLE_POOL = await rewardsPool.ORACLE_ROLE();
        const ARBITRATOR = await escrow.ARBITRATOR_ROLE();

        await (await token.grantRole(MINTER, deployed.FCMAgentRegistry)).wait();
        log("  ✅ Registry → MINTER_ROLE on Token");
        await (await token.grantRole(MINTER, deployed.FCMRewardsPool)).wait();
        log("  ✅ RewardsPool → MINTER_ROLE on Token");
        const granteeLabel = roleGrantee === deployer.address ? "Deployer" : "Safe";
        log(`\n  Roles → ${granteeLabel} (${roleGrantee})\n`);

        await (await marketplace.grantRole(LISTING, roleGrantee)).wait();
        log(`  ✅ ${granteeLabel} → LISTING_ROLE on Marketplace`);
        await (await registry.grantRole(VALIDATOR, roleGrantee)).wait();
        log(`  ✅ ${granteeLabel} → VALIDATOR_ROLE on Registry`);
        await (await tierStaking.grantRole(ORACLE_TIER, roleGrantee)).wait();
        log(`  ✅ ${granteeLabel} → ORACLE_ROLE on TierStaking`);
        await (await reputationNFT.grantRole(ORACLE_REP, roleGrantee)).wait();
        log(`  ✅ ${granteeLabel} → ORACLE_ROLE on ReputationNFT`);
        await (await rewardsPool.grantRole(ORACLE_POOL, roleGrantee)).wait();
        log(`  ✅ ${granteeLabel} → ORACLE_ROLE on RewardsPool`);
        await (await escrow.grantRole(ARBITRATOR, roleGrantee)).wait();
        log(`  ✅ ${granteeLabel} → ARBITRATOR_ROLE on Escrow`);

        // ── Save ──
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const data = {
            network: conn.networkName,
            chainId: conn.networkConfig.chainId,
            deployer: deployer.address,
            safe: taskArgs.safe || null,
            roleGrantee,
            timestamp: new Date().toISOString(),
            deploymentTime: `${elapsed}s`,
            contracts: deployed,
            roles: { MINTER, LISTING, VALIDATOR, ORACLE_TIER, ORACLE_REP, ORACLE_POOL, ARBITRATOR },
        };
        saveDeployment(conn.networkName, data);

        // ── Summary ──
        logHeader(`DEPLOYED IN ${elapsed}s`);
        for (const [name, addr] of Object.entries(deployed)) {
            log(`  ${name.padEnd(24)} ${addr}`);
        }

        return deployed;
    })
    .build();

// ══════════════════════════════════════════════════════════════════
// TASK: deploy:status
// ══════════════════════════════════════════════════════════════════

export const deployStatusTask = task("deploy:status", "Check deployment status and contract state")
    .setInlineAction(async (taskArgs, hre) => {
        const conn = await hre.network.connect();
        const data = loadDeployment(conn.networkName);

        logHeader(`DEPLOYMENT STATUS — ${conn.networkName}`);

        if (!data.contracts || Object.keys(data.contracts).length === 0) {
            log("  No deployments found for this network.");
            return;
        }

        log(`  Deployer: ${data.deployer || "unknown"}`);
        log(`  Deployed: ${data.timestamp || "unknown"}`);
        log(`  Time: ${data.deploymentTime || "unknown"}`);

        for (const [name, addr] of Object.entries(data.contracts)) {
            try {
                const code = await conn.provider.request({ method: "eth_getCode", params: [addr, "latest"] });
                const hasCode = code !== "0x" && code !== "0x0";
                const size = hasCode ? `${(code.length - 2) / 2} bytes` : "NO CODE";
                log(`  ${hasCode ? "✅" : "❌"} ${name.padEnd(24)} ${addr} (${size})`);
            } catch (e) {
                log(`  ❌ ${name.padEnd(24)} ${addr} (error: ${e.message.slice(0, 40)})`);
            }
        }

        return data;
    })
    .build();

// ══════════════════════════════════════════════════════════════════
// TASK: deploy:grant-role
// ══════════════════════════════════════════════════════════════════

export const deployGrantRoleTask = task("deploy:grant-role", "Grant a role on a deployed contract")
    .addOption({
        name: "contract",
        description: "Contract name (e.g., FCMToken, FCMAgentRegistry)",
        defaultValue: "",
        type: ArgumentType.STRING,
    })
    .addOption({
        name: "role",
        description: "Role name (e.g., MINTER_ROLE, VALIDATOR_ROLE)",
        defaultValue: "",
        type: ArgumentType.STRING,
    })
    .addOption({
        name: "account",
        description: "Address to grant the role to",
        defaultValue: "",
        type: ArgumentType.STRING,
    })
    .addOption({
        name: "safe",
        description: "Gnosis Safe to execute via (creates multi-sig tx)",
        defaultValue: "",
        type: ArgumentType.STRING,
    })
    .setInlineAction(async (taskArgs, hre) => {
        if (!taskArgs.contract || !taskArgs.role || !taskArgs.account) { log("❌ --contract, --role, and --account are required"); return; }
        const conn = await hre.network.connect();
        const { ethers } = conn;
        const data = loadDeployment(conn.networkName);
        const addr = data.contracts[taskArgs.contract];

        if (!addr) {
            log(`  ❌ Contract ${taskArgs.contract} not found in deployment for ${conn.networkName}`);
            return;
        }

        logHeader(`Granting ${taskArgs.role} on ${taskArgs.contract}`);
        log(`Contract: ${addr}`);
        log(`Role:     ${taskArgs.role}`);
        log(`Account:  ${taskArgs.account}`);

        const contract = await ethers.getContractAt(taskArgs.contract, addr);
        const roleHash = await contract[taskArgs.role]();

        if (!roleHash) {
            log(`  ❌ Role ${taskArgs.role} not found on contract`);
            return;
        }

        const hasRole = await contract.hasRole(roleHash, taskArgs.account);
        if (hasRole) {
            log(`  ⚠️  Account already has ${taskArgs.role}`);
            return;
        }

        // If Safe is specified, create a multi-sig transaction
        if (taskArgs.safe) {
            try {
                const { GnosisSafeManager } = await import("../../lib/modules/gnosis-safe.js");
                const signers = await conn.provider.request({ method: "eth_accounts" });
                const signer = await ethers.getSigner(signers[0]);
                const safeMgr = new GnosisSafeManager(signer, taskArgs.safe, conn.networkName);

                const safeInfo = await safeMgr.validate();
                if (!safeInfo.valid) {
                    log(`  ❌ Safe validation failed`);
                    return;
                }

                log(`\n  🔐 Creating Safe transaction...`);
                log(`  Threshold: ${safeInfo.threshold}-of-${safeInfo.ownerCount}`);
                log(`  Nonce: ${safeInfo.nonce}`);

                // Encode the grantRole call
                const calldata = contract.interface.encodeFunctionData("grantRole", [roleHash, taskArgs.account]);
                const txHash = await safeMgr.getTransactionHash(addr, 0, calldata);

                // Sign the transaction
                const signature = await signer.signMessage(ethers.getBytes(txHash));

                log(`\n  ✅ Transaction prepared!`);
                log(`  TX Hash: ${txHash}`);
                log(`  Signer:  ${signer.address}`);
                log(`  Signatures: 1/${safeInfo.threshold}`);
                log(`\n  To execute: need ${safeInfo.threshold - 1} more owner(s) to sign`);
                log(`  Submit via Safe UI: https://app.safe.global/`);

                return { txHash, signer: signer.address, threshold: safeInfo.threshold, status: "pending" };
            } catch (e) {
                log(`  ❌ Safe transaction failed: ${e.message.slice(0, 80)}`);
                return;
            }
        }

        // Direct grant (no Safe)
        await (await contract.grantRole(roleHash, taskArgs.account)).wait();
        log(`  ✅ Granted ${taskArgs.role} to ${taskArgs.account}`);
    })
    .build();
