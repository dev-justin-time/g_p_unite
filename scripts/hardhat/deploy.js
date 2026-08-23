/**
 * FCM Full Deployment Script — All 8 Contracts
 *
 * Deploys to Sepolia (or any configured network):
 *   1. FCMToken          — ERC20 with fees, minter roles, max supply
 *   2. FCMAgentRegistry  — Agent registration, tasks, heartbeats
 *   3. FCMTaskMarketplace — Spot tasks, auctions, escrow
 *   4. FCMTierStaking    — 6-tier staking with HW verification
 *   5. FCMGovernance     — On-chain proposal voting
 *   6. FCMEscrow         — Milestone-based payment escrow
 *   7. FCMReputationNFT  — Soulbound reputation badges
 *   8. FCMRewardsPool    — Epoch-based reward distribution
 *
 * Usage:
 *   npx hardhat run scripts/hardhat/deploy.js --network sepolia
 */

const { ethers, run, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Gnosis Safe manager (optional)
let GnosisSafeManager;
try {
    ({ GnosisSafeManager } = require("../../lib/modules/gnosis-safe"));
} catch (e) {
    // Module not available, Safe support disabled
}

// ── Helpers ──────────────────────────────────────────────────────

function log(msg) { console.log(`  ${msg}`); }
function logHeader(msg) { console.log(`\n${"═".repeat(60)}\n  ${msg}\n${"═".repeat(60)}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function verify(address, constructorArgs) {
    try {
        await run("verify:verify", { address, constructorArgs });
        log(`  ✅ Verified: ${address}`);
    } catch (e) {
        if (e.message.includes("Already Verified")) {
            log(`  ✅ Already verified: ${address}`);
        } else {
            log(`  ⚠️  Verification failed for ${address}: ${e.message}`);
        }
    }
}

// ── Deployment ───────────────────────────────────────────────────

async function main() {
    const [deployer] = await ethers.getSigners();
    const deployerAddr = deployer.address;
    const networkName = network.name;
    const chainId = network.config.chainId;

    logHeader(`FCM DEPLOYMENT — ${networkName} (chain ${chainId})`);
    log(`Deployer: ${deployerAddr}`);
    log(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployerAddr))} ETH`);
    log(`Time:     ${new Date().toISOString()}`);

    // ── Safe Configuration ──────────────────────────────────────
    const safeAddress = process.env.FCM_SAFE_ADDRESS || "";
    let safeManager = null;
    let roleGrantee = deployerAddr;

    if (safeAddress && GnosisSafeManager) {
        log(`\n  🔐 Gnosis Safe: ${safeAddress}`);
        safeManager = new GnosisSafeManager(signer, safeAddress, networkName);
        const safeInfo = await safeManager.validate();
        if (safeInfo.valid) {
            roleGrantee = safeAddress;
            log(`  ✅ Safe is valid: ${safeInfo.threshold}-of-${safeInfo.ownerCount} multisig`);
            log(`  Owner check: deployer is Safe owner: ${safeInfo.isOwner}`);
        } else {
            log(`  ⚠️  Safe validation failed, falling back to deployer for roles`);
            if (!safeInfo.hasCode) log(`     No code at ${safeAddress}`);
            if (safeInfo.thresholdError) log(`     Threshold error: ${safeInfo.thresholdError}`);
            if (!safeInfo.isOwner) log(`     Deployer is NOT a Safe owner`);
        }
    } else if (safeAddress) {
        log(`  ⚠️  Safe address provided but GnosisSafeManager not available`);
    } else {
        log(`  ℹ️  No Safe configured — roles granted to deployer`);
        log(`     Set FCM_SAFE_ADDRESS in .env to use a Gnosis Safe`);
    }

    const deployed = {};
    const startTime = Date.now();

    // ══════════════════════════════════════════════════════════════
    // 1. FCMToken
    // ══════════════════════════════════════════════════════════════
    logHeader("1/8  FCMToken (ERC20 + Fees + Minter Roles)");

    const FCMToken = await ethers.getContractFactory("FCMToken");
    const token = await FCMToken.deploy(deployerAddr);
    await token.waitForDeployment();
    deployed.FCMToken = await token.getAddress();
    log(`Deployed: ${deployed.FCMToken}`);

    // ══════════════════════════════════════════════════════════════
    // 2. FCMAgentRegistry
    // ══════════════════════════════════════════════════════════════
    logHeader("2/8  FCMAgentRegistry (Agents + Tasks + Heartbeats)");

    const FCMAgentRegistry = await ethers.getContractFactory("FCMAgentRegistry");
    const registry = await FCMAgentRegistry.deploy(deployed.FCMToken);
    await registry.waitForDeployment();
    deployed.FCMAgentRegistry = await registry.getAddress();
    log(`Deployed: ${deployed.FCMAgentRegistry}`);

    // ══════════════════════════════════════════════════════════════
    // 3. FCMTaskMarketplace
    // ══════════════════════════════════════════════════════════════
    logHeader("3/8  FCMTaskMarketplace (Spot Tasks + Auctions)");

    const FCMTaskMarketplace = await ethers.getContractFactory("FCMTaskMarketplace");
    const marketplace = await FCMTaskMarketplace.deploy(deployed.FCMAgentRegistry, deployed.FCMToken);
    await marketplace.waitForDeployment();
    deployed.FCMTaskMarketplace = await marketplace.getAddress();
    log(`Deployed: ${deployed.FCMTaskMarketplace}`);

    // ══════════════════════════════════════════════════════════════
    // 4. FCMTierStaking
    // ══════════════════════════════════════════════════════════════
    logHeader("4/8  FCMTierStaking (6-Tier Staking System)");

    const FCMTierStaking = await ethers.getContractFactory("FCMTierStaking");
    const tierStaking = await FCMTierStaking.deploy(deployed.FCMToken);
    await tierStaking.waitForDeployment();
    deployed.FCMTierStaking = await tierStaking.getAddress();
    log(`Deployed: ${deployed.FCMTierStaking}`);

    // ══════════════════════════════════════════════════════════════
    // 5. FCMGovernance
    // ══════════════════════════════════════════════════════════════
    logHeader("5/8  FCMGovernance (Proposal Voting)");

    const FCMGovernance = await ethers.getContractFactory("FCMGovernance");
    const governance = await FCMGovernance.deploy(deployed.FCMToken, deployed.FCMTierStaking);
    await governance.waitForDeployment();
    deployed.FCMGovernance = await governance.getAddress();
    log(`Deployed: ${deployed.FCMGovernance}`);

    // ══════════════════════════════════════════════════════════════
    // 6. FCMEscrow
    // ══════════════════════════════════════════════════════════════
    logHeader("6/8  FCMEscrow (Milestone Payment Escrow)");

    const FCMEscrow = await ethers.getContractFactory("FCMEscrow");
    const escrow = await FCMEscrow.deploy(deployed.FCMToken);
    await escrow.waitForDeployment();
    deployed.FCMEscrow = await escrow.getAddress();
    log(`Deployed: ${deployed.FCMEscrow}`);

    // ══════════════════════════════════════════════════════════════
    // 7. FCMReputationNFT
    // ══════════════════════════════════════════════════════════════
    logHeader("7/8  FCMReputationNFT (Soulbound Badges)");

    const FCMReputationNFT = await ethers.getContractFactory("FCMReputationNFT");
    const reputationNFT = await FCMReputationNFT.deploy();
    await reputationNFT.waitForDeployment();
    deployed.FCMReputationNFT = await reputationNFT.getAddress();
    log(`Deployed: ${deployed.FCMReputationNFT}`);

    // ══════════════════════════════════════════════════════════════
    // 8. FCMRewardsPool
    // ══════════════════════════════════════════════════════════════
    logHeader("8/8  FCMRewardsPool (Epoch Reward Distribution)");

    const FCMRewardsPool = await ethers.getContractFactory("FCMRewardsPool");
    const rewardsPool = await FCMRewardsPool.deploy(deployed.FCMToken, deployed.FCMTierStaking);
    await rewardsPool.waitForDeployment();
    deployed.FCMRewardsPool = await rewardsPool.getAddress();
    log(`Deployed: ${deployed.FCMRewardsPool}`);

    // ══════════════════════════════════════════════════════════════
    // ROLE SETUP
    // ══════════════════════════════════════════════════════════════
    logHeader("ROLE GRANTS");

    const MINTER_ROLE = await token.MINTER_ROLE();
    const LISTING_ROLE = await marketplace.LISTING_ROLE();
    const VALIDATOR_ROLE = await registry.VALIDATOR_ROLE();
    const ORACLE_ROLE_TIER = await tierStaking.ORACLE_ROLE();
    const ORACLE_ROLE_REP = await reputationNFT.ORACLE_ROLE();
    const ORACLE_ROLE_REWARDS = await rewardsPool.ORACLE_ROLE();
    const ARBITRATOR_ROLE = await escrow.ARBITRATOR_ROLE();

    // Registry needs MINTER_ROLE to mint task rewards
    log("Granting MINTER_ROLE → Registry...");
    await (await token.grantRole(MINTER_ROLE, deployed.FCMAgentRegistry)).wait();
    log("  ✅ Registry can mint rewards");

    // RewardsPool needs MINTER_ROLE to distribute epoch rewards
    log("Granting MINTER_ROLE → RewardsPool...");
    await (await token.grantRole(MINTER_ROLE, deployed.FCMRewardsPool)).wait();
    log("  ✅ RewardsPool can mint rewards");

    const granteeLabel = safeManager ? "Safe" : "Deployer";
    log(`\n  Roles will be granted to: ${granteeLabel} (${roleGrantee})\n`);

    // Deployer gets LISTING_ROLE for marketplace
    log(`Granting LISTING_ROLE → ${granteeLabel}...`);
    await (await marketplace.grantRole(LISTING_ROLE, roleGrantee)).wait();
    log(`  ✅ ${granteeLabel} can list tasks`);

    // Deployer gets VALIDATOR_ROLE for dispute resolution
    log(`Granting VALIDATOR_ROLE → ${granteeLabel}...`);
    await (await registry.grantRole(VALIDATOR_ROLE, roleGrantee)).wait();
    log(`  ✅ ${granteeLabel} can resolve disputes`);

    // Deployer gets ORACLE_ROLE on TierStaking (HW score updates)
    log(`Granting ORACLE_ROLE → ${granteeLabel} (TierStaking)...`);
    await (await tierStaking.grantRole(ORACLE_ROLE_TIER, roleGrantee)).wait();
    log(`  ✅ ${granteeLabel} can update HW scores`);

    // Deployer gets ORACLE_ROLE on ReputationNFT (badge updates)
    log(`Granting ORACLE_ROLE → ${granteeLabel} (ReputationNFT)...`);
    await (await reputationNFT.grantRole(ORACLE_ROLE_REP, roleGrantee)).wait();
    log(`  ✅ ${granteeLabel} can update badges`);

    // Deployer gets ORACLE_ROLE on RewardsPool (work recording)
    log(`Granting ORACLE_ROLE → ${granteeLabel} (RewardsPool)...`);
    await (await rewardsPool.grantRole(ORACLE_ROLE_REWARDS, roleGrantee)).wait();
    log(`  ✅ ${granteeLabel} can record work`);

    // Deployer gets ARBITRATOR_ROLE on Escrow (dispute resolution)
    log(`Granting ARBITRATOR_ROLE → ${granteeLabel}...`);
    await (await escrow.grantRole(ARBITRATOR_ROLE, roleGrantee)).wait();
    log(`  ✅ ${granteeLabel} can resolve escrow disputes`);

    // ══════════════════════════════════════════════════════════════
    // SAVE DEPLOYMENT
    // ══════════════════════════════════════════════════════════════
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    const deploymentInfo = {
        network: networkName,
        chainId,
        deployer: deployerAddr,
        safe: safeAddress || null,
        roleGrantee: roleGrantee,
        timestamp: new Date().toISOString(),
        deploymentTime: `${elapsed}s`,
        contracts: deployed,
        roles: {
            MINTER_ROLE: MINTER_ROLE,
            LISTING_ROLE: LISTING_ROLE,
            VALIDATOR_ROLE: VALIDATOR_ROLE,
            ORACLE_ROLE: ORACLE_ROLE_TIER,
            ARBITRATOR_ROLE: ARBITRATOR_ROLE,
        },
        verification: Object.entries(deployed).map(([name, addr]) => ({
            name,
            address: addr,
            verified: false,
            etherscanUrl: `https://sepolia.etherscan.io/address/${addr}#code`,
        })),
    };

    const deploymentsDir = path.join(__dirname, "../../deployments");
    fs.mkdirSync(deploymentsDir, { recursive: true });
    fs.writeFileSync(
        path.join(deploymentsDir, `sepolia-${Date.now()}.json`),
        JSON.stringify(deploymentInfo, null, 2)
    );
    fs.writeFileSync(
        path.join(deploymentsDir, "latest.json"),
        JSON.stringify(deploymentInfo, null, 2)
    );

    // ══════════════════════════════════════════════════════════════
    // VERIFICATION
    // ══════════════════════════════════════════════════════════════
    if (networkName !== "hardhat" && networkName !== "localhost") {
        logHeader("ETHERSCAN VERIFICATION");
        log("Waiting 30s for Etherscan to index contracts...");
        await sleep(30000);

        await verify(deployed.FCMToken, [deployerAddr]);
        await verify(deployed.FCMAgentRegistry, [deployed.FCMToken]);
        await verify(deployed.FCMTaskMarketplace, [deployed.FCMAgentRegistry, deployed.FCMToken]);
        await verify(deployed.FCMTierStaking, [deployed.FCMToken]);
        await verify(deployed.FCMGovernance, [deployed.FCMToken, deployed.FCMTierStaking]);
        await verify(deployed.FCMEscrow, [deployed.FCMToken]);
        await verify(deployed.FCMReputationNFT, []);
        await verify(deployed.FCMRewardsPool, [deployed.FCMToken, deployed.FCMTierStaking]);
    }

    // ══════════════════════════════════════════════════════════════
    // SUMMARY
    // ══════════════════════════════════════════════════════════════
    logHeader("DEPLOYMENT COMPLETE");

    console.log(`
  Network:  ${networkName} (chain ${chainId})
  Deployer: ${deployerAddr}
  Time:     ${elapsed}s

  ┌──────────────────────────┬─────────────────────────────────────────────┐
  │ Contract                 │ Address                                     │
  ├──────────────────────────┼─────────────────────────────────────────────┤
  │ FCMToken                 │ ${deployed.FCMToken} │
  │ FCMAgentRegistry         │ ${deployed.FCMAgentRegistry} │
  │ FCMTaskMarketplace       │ ${deployed.FCMTaskMarketplace} │
  │ FCMTierStaking           │ ${deployed.FCMTierStaking} │
  │ FCMGovernance            │ ${deployed.FCMGovernance} │
  │ FCMEscrow                │ ${deployed.FCMEscrow} │
  │ FCMReputationNFT         │ ${deployed.FCMReputationNFT} │
  │ FCMRewardsPool           │ ${deployed.FCMRewardsPool} │
  └──────────────────────────┴─────────────────────────────────────────────┘

  Add to .env:
    FCM_TOKEN_CONTRACT=${deployed.FCMToken}
    FCM_REGISTRY_CONTRACT=${deployed.FCMAgentRegistry}
    FCM_MARKETPLACE_CONTRACT=${deployed.FCMTaskMarketplace}
    FCM_TIER_STAKING_CONTRACT=${deployed.FCMTierStaking}
    FCM_GOVERNANCE_CONTRACT=${deployed.FCMGovernance}
    FCM_ESCROW_CONTRACT=${deployed.FCMEscrow}
    FCM_REPUTATION_NFT_CONTRACT=${deployed.FCMReputationNFT}
    FCM_REWARDS_POOL_CONTRACT=${deployed.FCMRewardsPool}

  Etherscan:
    https://sepolia.etherscan.io/address/${deployed.FCMToken}
    https://sepolia.etherscan.io/address/${deployed.FCMAgentRegistry}
    https://sepolia.etherscan.io/address/${deployed.FCMTaskMarketplace}
    https://sepolia.etherscan.io/address/${deployed.FCMTierStaking}
    https://sepolia.etherscan.io/address/${deployed.FCMGovernance}
    https://sepolia.etherscan.io/address/${deployed.FCMEscrow}
    https://sepolia.etherscan.io/address/${deployed.FCMReputationNFT}
    https://sepolia.etherscan.io/address/${deployed.FCMRewardsPool}
`);
}

main().catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exitCode = 1;
});
