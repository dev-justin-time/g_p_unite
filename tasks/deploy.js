/**
 * FCM Hardhat Tasks — Individual Contract Deployment
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

const { task, types } = require("hardhat/config");
const fs = require("fs");
const path = require("path");

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

task("deploy:token", "Deploy FCMToken (ERC20 with fees)")
    .addOptionalParam("treasury", "Treasury address (defaults to deployer)")
    .setAction(async (args, hre) => {
        const { ethers } = hre;
        const [deployer] = await ethers.getSigners();
        const treasury = args.treasury || deployer.address;

        logHeader("Deploying FCMToken");
        log(`Deployer:  ${deployer.address}`);
        log(`Treasury:  ${treasury}`);
        log(`Network:   ${hre.network.name}`);

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

        updateDeployment(hre.network.name, "FCMToken", addr);
        return { address: addr, deployer: deployer.address, treasury };
    });

// ══════════════════════════════════════════════════════════════════
// TASK: deploy:registry
// ══════════════════════════════════════════════════════════════════

task("deploy:registry", "Deploy FCMAgentRegistry")
    .addParam("token", "FCMToken contract address")
    .setAction(async (args, hre) => {
        const { ethers } = hre;
        const [deployer] = await ethers.getSigners();

        logHeader("Deploying FCMAgentRegistry");
        log(`Deployer: ${deployer.address}`);
        log(`Token:    ${args.token}`);

        const FCMAgentRegistry = await ethers.getContractFactory("FCMAgentRegistry");
        const registry = await FCMAgentRegistry.deploy(args.token);
        await registry.waitForDeployment();
        const addr = await registry.getAddress();

        log(`\n  ✅ FCMAgentRegistry deployed to: ${addr}`);

        // Verify cross-reference
        const registryToken = await registry.fcmToken();
        log(`  fcmToken: ${registryToken} ${registryToken.toLowerCase() === args.token.toLowerCase() ? "✅" : "❌"}`);

        const VALIDATOR_ROLE = await registry.VALIDATOR_ROLE();
        log(`  VALIDATOR_ROLE: ${VALIDATOR_ROLE}`);

        updateDeployment(hre.network.name, "FCMAgentRegistry", addr);
        return { address: addr, deployer: deployer.address, token: args.token };
    });

// ══════════════════════════════════════════════════════════════════
// TASK: deploy:marketplace
// ══════════════════════════════════════════════════════════════════

task("deploy:marketplace", "Deploy FCMTaskMarketplace")
    .addParam("registry", "FCMAgentRegistry contract address")
    .addParam("token", "FCMToken contract address")
    .setAction(async (args, hre) => {
        const { ethers } = hre;
        const [deployer] = await ethers.getSigners();

        logHeader("Deploying FCMTaskMarketplace");
        log(`Deployer:  ${deployer.address}`);
        log(`Registry:  ${args.registry}`);
        log(`Token:     ${args.token}`);

        const FCMTaskMarketplace = await ethers.getContractFactory("FCMTaskMarketplace");
        const marketplace = await FCMTaskMarketplace.deploy(args.registry, args.token);
        await marketplace.waitForDeployment();
        const addr = await marketplace.getAddress();

        log(`\n  ✅ FCMTaskMarketplace deployed to: ${addr}`);

        const mktRegistry = await marketplace.registry();
        const mktToken = await marketplace.fcmToken();
        log(`  registry: ${mktRegistry} ${mktRegistry.toLowerCase() === args.registry.toLowerCase() ? "✅" : "❌"}`);
        log(`  fcmToken: ${mktToken} ${mktToken.toLowerCase() === args.token.toLowerCase() ? "✅" : "❌"}`);

        const LISTING_ROLE = await marketplace.LISTING_ROLE();
        log(`  LISTING_ROLE: ${LISTING_ROLE}`);

        updateDeployment(hre.network.name, "FCMTaskMarketplace", addr);
        return { address: addr, deployer: deployer.address, registry: args.registry, token: args.token };
    });

// ══════════════════════════════════════════════════════════════════
// TASK: deploy:tier-staking
// ══════════════════════════════════════════════════════════════════

task("deploy:tier-staking", "Deploy FCMTierStaking")
    .addParam("token", "FCMToken contract address")
    .setAction(async (args, hre) => {
        const { ethers } = hre;
        const [deployer] = await ethers.getSigners();

        logHeader("Deploying FCMTierStaking");
        log(`Deployer: ${deployer.address}`);
        log(`Token:    ${args.token}`);

        const FCMTierStaking = await ethers.getContractFactory("FCMTierStaking");
        const tierStaking = await FCMTierStaking.deploy(args.token);
        await tierStaking.waitForDeployment();
        const addr = await tierStaking.getAddress();

        log(`\n  ✅ FCMTierStaking deployed to: ${addr}`);

        const tsToken = await tierStaking.fcmToken();
        log(`  fcmToken: ${tsToken} ${tsToken.toLowerCase() === args.token.toLowerCase() ? "✅" : "❌"}`);

        const ORACLE_ROLE = await tierStaking.ORACLE_ROLE();
        log(`  ORACLE_ROLE: ${ORACLE_ROLE}`);

        // Show tier configs
        log(`\n  Tier configs:`);
        for (let t = 0; t <= 5; t++) {
            const cfg = await tierStaking.tiers(t);
            log(`    T${t}: ${cfg.name} | minStake: ${ethers.formatEther(cfg.minStake)} | mult: ${cfg.rewardMultiplier / 100}x | feeDiscount: ${cfg.feeDiscount / 100}%`);
        }

        updateDeployment(hre.network.name, "FCMTierStaking", addr);
        return { address: addr, deployer: deployer.address, token: args.token };
    });

// ══════════════════════════════════════════════════════════════════
// TASK: deploy:governance
// ══════════════════════════════════════════════════════════════════

task("deploy:governance", "Deploy FCMGovernance")
    .addParam("token", "FCMToken contract address")
    .addParam("tierStaking", "FCMTierStaking contract address")
    .setAction(async (args, hre) => {
        const { ethers } = hre;
        const [deployer] = await ethers.getSigners();

        logHeader("Deploying FCMGovernance");
        log(`Deployer:    ${deployer.address}`);
        log(`Token:       ${args.token}`);
        log(`TierStaking: ${args.tierStaking}`);

        const FCMGovernance = await ethers.getContractFactory("FCMGovernance");
        const governance = await FCMGovernance.deploy(args.token, args.tierStaking);
        await governance.waitForDeployment();
        const addr = await governance.getAddress();

        log(`\n  ✅ FCMGovernance deployed to: ${addr}`);

        const govToken = await governance.fcmToken();
        const govTS = await governance.tierStaking();
        log(`  fcmToken:    ${govToken} ${govToken.toLowerCase() === args.token.toLowerCase() ? "✅" : "❌"}`);
        log(`  tierStaking: ${govTS} ${govTS.toLowerCase() === args.tierStaking.toLowerCase() ? "✅" : "❌"}`);

        const votingDuration = await governance.votingDuration();
        const timelockDuration = await governance.timelockDuration();
        const quorum = await governance.quorumThreshold();
        log(`  Voting duration: ${Number(votingDuration) / 86400} days`);
        log(`  Timelock: ${Number(timelockDuration) / 86400} days`);
        log(`  Quorum: ${Number(quorum) / 100}%`);

        updateDeployment(hre.network.name, "FCMGovernance", addr);
        return { address: addr, deployer: deployer.address, token: args.token, tierStaking: args.tierStaking };
    });

// ══════════════════════════════════════════════════════════════════
// TASK: deploy:escrow
// ══════════════════════════════════════════════════════════════════

task("deploy:escrow", "Deploy FCMEscrow")
    .addParam("token", "FCMToken contract address")
    .setAction(async (args, hre) => {
        const { ethers } = hre;
        const [deployer] = await ethers.getSigners();

        logHeader("Deploying FCMEscrow");
        log(`Deployer: ${deployer.address}`);
        log(`Token:    ${args.token}`);

        const FCMEscrow = await ethers.getContractFactory("FCMEscrow");
        const escrow = await FCMEscrow.deploy(args.token);
        await escrow.waitForDeployment();
        const addr = await escrow.getAddress();

        log(`\n  ✅ FCMEscrow deployed to: ${addr}`);

        const escToken = await escrow.fcmToken();
        log(`  fcmToken: ${escToken} ${escToken.toLowerCase() === args.token.toLowerCase() ? "✅" : "❌"}`);

        const ARBITRATOR_ROLE = await escrow.ARBITRATOR_ROLE();
        log(`  ARBITRATOR_ROLE: ${ARBITRATOR_ROLE}`);

        const multisigThreshold = await escrow.multisigThreshold();
        const disputeWindow = await escrow.disputeWindow();
        log(`  Multisig threshold: ${ethers.formatEther(multisigThreshold)} FCM`);
        log(`  Dispute window: ${Number(disputeWindow) / 86400} days`);

        updateDeployment(hre.network.name, "FCMEscrow", addr);
        return { address: addr, deployer: deployer.address, token: args.token };
    });

// ══════════════════════════════════════════════════════════════════
// TASK: deploy:reputation
// ══════════════════════════════════════════════════════════════════

task("deploy:reputation", "Deploy FCMReputationNFT (soulbound badges)")
    .setAction(async (args, hre) => {
        const { ethers } = hre;
        const [deployer] = await ethers.getSigners();

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

        updateDeployment(hre.network.name, "FCMReputationNFT", addr);
        return { address: addr, deployer: deployer.address };
    });

// ══════════════════════════════════════════════════════════════════
// TASK: deploy:rewards-pool
// ══════════════════════════════════════════════════════════════════

task("deploy:rewards-pool", "Deploy FCMRewardsPool")
    .addParam("token", "FCMToken contract address")
    .addParam("tierStaking", "FCMTierStaking contract address")
    .setAction(async (args, hre) => {
        const { ethers } = hre;
        const [deployer] = await ethers.getSigners();

        logHeader("Deploying FCMRewardsPool");
        log(`Deployer:    ${deployer.address}`);
        log(`Token:       ${args.token}`);
        log(`TierStaking: ${args.tierStaking}`);

        const FCMRewardsPool = await ethers.getContractFactory("FCMRewardsPool");
        const pool = await FCMRewardsPool.deploy(args.token, args.tierStaking);
        await pool.waitForDeployment();
        const addr = await pool.getAddress();

        log(`\n  ✅ FCMRewardsPool deployed to: ${addr}`);

        const rpToken = await pool.fcmToken();
        const rpTS = await pool.tierStaking();
        log(`  fcmToken:    ${rpToken} ${rpToken.toLowerCase() === args.token.toLowerCase() ? "✅" : "❌"}`);
        log(`  tierStaking: ${rpTS} ${rpTS.toLowerCase() === args.tierStaking.toLowerCase() ? "✅" : "❌"}`);

        const ORACLE_ROLE = await pool.ORACLE_ROLE();
        log(`  ORACLE_ROLE: ${ORACLE_ROLE}`);

        updateDeployment(hre.network.name, "FCMRewardsPool", addr);
        return { address: addr, deployer: deployer.address, token: args.token, tierStaking: args.tierStaking };
    });

// ══════════════════════════════════════════════════════════════════
// TASK: deploy:all
// ══════════════════════════════════════════════════════════════════

task("deploy:all", "Deploy all 8 FCM contracts in dependency order")
    .addOptionalParam("safe", "Gnosis Safe address to grant roles to (overrides deployer)")
    .setAction(async (args, hre) => {
        const { ethers } = hre;
        const [deployer] = await ethers.getSigners();

        // Resolve Safe
        let roleGrantee = deployer.address;
        let safeInfo = null;
        if (args.safe) {
            try {
                const { GnosisSafeManager } = require("../../lib/modules/gnosis-safe");
                const safeMgr = new GnosisSafeManager(deployer, args.safe, hre.network.name);
                safeInfo = await safeMgr.validate();
                if (safeInfo.valid) {
                    roleGrantee = args.safe;
                } else {
                    log(`  ⚠️  Safe validation failed, falling back to deployer`);
                }
            } catch (e) {
                log(`  ⚠️  Could not load GnosisSafeManager: ${e.message.slice(0, 60)}`);
            }
        }

        logHeader(`DEPLOY ALL — ${hre.network.name}`);
        log(`Deployer: ${deployer.address}`);
        if (args.safe) log(`Safe:     ${args.safe} ${safeInfo?.valid ? '(✅ valid)' : '(⚠️ validation failed)'}`);
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
            network: hre.network.name,
            chainId: hre.network.config.chainId,
            deployer: deployer.address,
            safe: args.safe || null,
            roleGrantee,
            timestamp: new Date().toISOString(),
            deploymentTime: `${elapsed}s`,
            contracts: deployed,
            roles: { MINTER, LISTING, VALIDATOR, ORACLE_TIER, ORACLE_REP, ORACLE_POOL, ARBITRATOR },
        };
        saveDeployment(hre.network.name, data);

        // ── Summary ──
        logHeader(`DEPLOYED IN ${elapsed}s`);
        for (const [name, addr] of Object.entries(deployed)) {
            log(`  ${name.padEnd(24)} ${addr}`);
        }

        return deployed;
    });

// ══════════════════════════════════════════════════════════════════
// TASK: deploy:status
// ══════════════════════════════════════════════════════════════════

task("deploy:status", "Check deployment status and contract state")
    .setAction(async (args, hre) => {
        const { ethers } = hre;
        const data = loadDeployment(hre.network.name);

        logHeader(`DEPLOYMENT STATUS — ${hre.network.name}`);

        if (!data.contracts || Object.keys(data.contracts).length === 0) {
            log("  No deployments found for this network.");
            return;
        }

        log(`  Deployer: ${data.deployer || "unknown"}`);
        log(`  Deployed: ${data.timestamp || "unknown"}`);
        log(`  Time: ${data.deploymentTime || "unknown"}`);

        for (const [name, addr] of Object.entries(data.contracts)) {
            try {
                const code = await ethers.provider.getCode(addr);
                const hasCode = code !== "0x" && code !== "0x0";
                const size = hasCode ? `${(code.length - 2) / 2} bytes` : "NO CODE";
                log(`  ${hasCode ? "✅" : "❌"} ${name.padEnd(24)} ${addr} (${size})`);
            } catch (e) {
                log(`  ❌ ${name.padEnd(24)} ${addr} (error: ${e.message.slice(0, 40)})`);
            }
        }

        return data;
    });

// ══════════════════════════════════════════════════════════════════
// TASK: deploy:grant-role
// ══════════════════════════════════════════════════════════════════

task("deploy:grant-role", "Grant a role on a deployed contract")
    .addParam("contract", "Contract name (e.g., FCMToken, FCMAgentRegistry)")
    .addParam("role", "Role name (e.g., MINTER_ROLE, VALIDATOR_ROLE)")
    .addParam("account", "Address to grant the role to")
    .addOptionalParam("safe", "Gnosis Safe to execute via (creates multi-sig tx)")
    .setAction(async (args, hre) => {
        const { ethers } = hre;
        const data = loadDeployment(hre.network.name);
        const addr = data.contracts[args.contract];

        if (!addr) {
            log(`  ❌ Contract ${args.contract} not found in deployment for ${hre.network.name}`);
            return;
        }

        logHeader(`Granting ${args.role} on ${args.contract}`);
        log(`Contract: ${addr}`);
        log(`Role:     ${args.role}`);
        log(`Account:  ${args.account}`);

        const contract = await ethers.getContractAt(args.contract, addr);
        const roleHash = await contract[args.role]();

        if (!roleHash) {
            log(`  ❌ Role ${args.role} not found on contract`);
            return;
        }

        const hasRole = await contract.hasRole(roleHash, args.account);
        if (hasRole) {
            log(`  ⚠️  Account already has ${args.role}`);
            return;
        }

        // If Safe is specified, create a multi-sig transaction
        if (args.safe) {
            try {
                const { GnosisSafeManager } = require("../../lib/modules/gnosis-safe");
                const [signer] = await ethers.getSigners();
                const safeMgr = new GnosisSafeManager(signer, args.safe, hre.network.name);

                const safeInfo = await safeMgr.validate();
                if (!safeInfo.valid) {
                    log(`  ❌ Safe validation failed`);
                    return;
                }

                log(`\n  🔐 Creating Safe transaction...`);
                log(`  Threshold: ${safeInfo.threshold}-of-${safeInfo.ownerCount}`);
                log(`  Nonce: ${safeInfo.nonce}`);

                // Encode the grantRole call
                const calldata = contract.interface.encodeFunctionData("grantRole", [roleHash, args.account]);
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
        await (await contract.grantRole(roleHash, args.account)).wait();
        log(`  ✅ Granted ${args.role} to ${args.account}`);
    });
