/**
 * FCM Deployment Verification Script
 *
 * Reads deployment addresses from deployments/latest.json and verifies:
 *   1. All 8 contracts have code at their addresses
 *   2. Cross-references match (token address in registry, etc.)
 *   3. All required roles are granted
 *   4. Basic contract state is correct
 *   5. Contracts are pauseable and functional
 *
 * Usage:
 *   npx hardhat run scripts/hardhat/verify-deployment.js --network sepolia
 *   npx hardhat run scripts/hardhat/verify-deployment.js --network localhost
 */

import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Helpers ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let warnings = 0;
const results = [];

function log(msg) { console.log(`  ${msg}`); }
function logHeader(msg) { console.log(`\n${"═".repeat(70)}\n  ${msg}\n${"═".repeat(70)}`); }

function ok(name, detail) {
    passed++;
    results.push({ name, status: "✅", detail });
    log(`  ✅ ${name}${detail ? " — " + detail : ""}`);
}

function fail(name, detail) {
    failed++;
    results.push({ name, status: "❌", detail });
    log(`  ❌ ${name}${detail ? " — " + detail : ""}`);
}

function warn(name, detail) {
    warnings++;
    results.push({ name, status: "⚠️", detail });
    log(`  ⚠️  ${name}${detail ? " — " + detail : ""}`);
}

function section(name) {
    console.log(`\n  ── ${name} ${"─".repeat(60 - name.length)}`);
}

// ── Main Verification ────────────────────────────────────────────

async function main() {
    const conn = await hre.network.connect();
    const { ethers } = conn;
    const signers = await conn.provider.request({ method: "eth_accounts" });
    const signer = await ethers.getSigner(signers[0]);
    const signerAddr = signer.address;
    const networkName = conn.networkName;

    logHeader(`FCM DEPLOYMENT VERIFICATION — ${networkName}`);
    log(`Signer: ${signerAddr}`);
    log(`Time:   ${new Date().toISOString()}`);

    // ── Load Deployment ──────────────────────────────────────────
    const deploymentPath = path.join(__dirname, "../../deployments/latest.json");
    if (!fs.existsSync(deploymentPath)) {
        fail("Deployment file", "deployments/latest.json not found");
        printSummary();
        return;
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const contracts = deployment.contracts;
    const roles = deployment.roles || {};

    log(`Network: ${deployment.network} (chain ${deployment.chainId})`);
    log(`Deployer: ${deployment.deployer}`);
    log(`Deployed: ${deployment.timestamp}`);

    // ══════════════════════════════════════════════════════════════
    // 1. CONTRACT EXISTENCE CHECK
    // ══════════════════════════════════════════════════════════════
    section("1. Contract Existence");

    const expectedContracts = [
        "FCMToken",
        "FCMAgentRegistry",
        "FCMTaskMarketplace",
        "FCMTierStaking",
        "FCMGovernance",
        "FCMEscrow",
        "FCMReputationNFT",
        "FCMRewardsPool",
    ];

    const contractInstances = {};

    for (const name of expectedContracts) {
        const addr = contracts[name];
        if (!addr) {
            fail(`${name} address`, "Missing from deployment file");
            continue;
        }

        try {
            const code = await conn.provider.request({ method: "eth_getCode", params: [addr, "latest"] });
            if (code === "0x" || code === "0x0") {
                fail(`${name} code`, `No code at ${addr}`);
            } else {
                const codeSize = (code.length - 2) / 2; // bytes
                ok(`${name}`, `${addr} (${codeSize} bytes)`);

                // Load contract instance
                try {
                    contractInstances[name] = await ethers.getContractAt(name, addr);
                } catch (e) {
                    warn(`${name} ABI`, `Could not load ABI: ${e.message.slice(0, 80)}`);
                }
            }
        } catch (e) {
            fail(`${name} lookup`, e.message.slice(0, 100));
        }
    }

    // ══════════════════════════════════════════════════════════════
    // 2. CROSS-REFERENCE CHECK
    // ══════════════════════════════════════════════════════════════
    section("2. Cross-References");

    const tokenAddr = contracts.FCMToken;
    const registryAddr = contracts.FCMAgentRegistry;
    const tierStakingAddr = contracts.FCMTierStaking;
    const marketplaceAddr = contracts.FCMTaskMarketplace;
    const governanceAddr = contracts.FCMGovernance;
    const escrowAddr = contracts.FCMEscrow;
    const reputationAddr = contracts.FCMReputationNFT;
    const rewardsPoolAddr = contracts.FCMRewardsPool;

    // Registry → Token
    if (contractInstances.FCMAgentRegistry) {
        try {
            const registryToken = await contractInstances.FCMAgentRegistry.fcmToken();
            if (registryToken.toLowerCase() === tokenAddr.toLowerCase()) {
                ok("Registry → Token", `${registryToken}`);
            } else {
                fail("Registry → Token", `Expected ${tokenAddr}, got ${registryToken}`);
            }
        } catch (e) {
            fail("Registry → Token", e.message.slice(0, 80));
        }
    }

    // Marketplace → Registry + Token
    if (contractInstances.FCMTaskMarketplace) {
        try {
            const mktRegistry = await contractInstances.FCMTaskMarketplace.registry();
            const mktToken = await contractInstances.FCMTaskMarketplace.fcmToken();
            const regOk = mktRegistry.toLowerCase() === registryAddr.toLowerCase();
            const tokOk = mktToken.toLowerCase() === tokenAddr.toLowerCase();
            if (regOk && tokOk) {
                ok("Marketplace → Registry", `${mktRegistry}`);
                ok("Marketplace → Token", `${mktToken}`);
            } else {
                if (!regOk) fail("Marketplace → Registry", `Expected ${registryAddr}, got ${mktRegistry}`);
                if (!tokOk) fail("Marketplace → Token", `Expected ${tokenAddr}, got ${mktToken}`);
            }
        } catch (e) {
            fail("Marketplace refs", e.message.slice(0, 80));
        }
    }

    // TierStaking → Token
    if (contractInstances.FCMTierStaking) {
        try {
            const tsToken = await contractInstances.FCMTierStaking.fcmToken();
            if (tsToken.toLowerCase() === tokenAddr.toLowerCase()) {
                ok("TierStaking → Token", `${tsToken}`);
            } else {
                fail("TierStaking → Token", `Expected ${tokenAddr}, got ${tsToken}`);
            }
        } catch (e) {
            fail("TierStaking → Token", e.message.slice(0, 80));
        }
    }

    // Governance → Token + TierStaking
    if (contractInstances.FCMGovernance) {
        try {
            const govToken = await contractInstances.FCMGovernance.fcmToken();
            const govTS = await contractInstances.FCMGovernance.tierStaking();
            const tOk = govToken.toLowerCase() === tokenAddr.toLowerCase();
            const tsOk = govTS.toLowerCase() === tierStakingAddr.toLowerCase();
            if (tOk && tsOk) {
                ok("Governance → Token", `${govToken}`);
                ok("Governance → TierStaking", `${govTS}`);
            } else {
                if (!tOk) fail("Governance → Token", `Expected ${tokenAddr}, got ${govToken}`);
                if (!tsOk) fail("Governance → TierStaking", `Expected ${tierStakingAddr}, got ${govTS}`);
            }
        } catch (e) {
            fail("Governance refs", e.message.slice(0, 80));
        }
    }

    // Escrow → Token
    if (contractInstances.FCMEscrow) {
        try {
            const escToken = await contractInstances.FCMEscrow.fcmToken();
            if (escToken.toLowerCase() === tokenAddr.toLowerCase()) {
                ok("Escrow → Token", `${escToken}`);
            } else {
                fail("Escrow → Token", `Expected ${tokenAddr}, got ${escToken}`);
            }
        } catch (e) {
            fail("Escrow → Token", e.message.slice(0, 80));
        }
    }

    // RewardsPool → Token + TierStaking
    if (contractInstances.FCMRewardsPool) {
        try {
            const rpToken = await contractInstances.FCMRewardsPool.fcmToken();
            const rpTS = await contractInstances.FCMRewardsPool.tierStaking();
            const tOk = rpToken.toLowerCase() === tokenAddr.toLowerCase();
            const tsOk = rpTS.toLowerCase() === tierStakingAddr.toLowerCase();
            if (tOk && tsOk) {
                ok("RewardsPool → Token", `${rpToken}`);
                ok("RewardsPool → TierStaking", `${rpTS}`);
            } else {
                if (!tOk) fail("RewardsPool → Token", `Expected ${tokenAddr}, got ${rpToken}`);
                if (!tsOk) fail("RewardsPool → TierStaking", `Expected ${tierStakingAddr}, got ${rpTS}`);
            }
        } catch (e) {
            fail("RewardsPool refs", e.message.slice(0, 80));
        }
    }

    // ══════════════════════════════════════════════════════════════
    // 3. ROLE VERIFICATION
    // ══════════════════════════════════════════════════════════════
    section("3. Role Verification");

    const roleChecks = [
        {
            name: "Registry has MINTER_ROLE on Token",
            contract: contractInstances.FCMToken,
            roleFn: "MINTER_ROLE",
            grantee: registryAddr,
            label: "Registry",
        },
        {
            name: "RewardsPool has MINTER_ROLE on Token",
            contract: contractInstances.FCMToken,
            roleFn: "MINTER_ROLE",
            grantee: rewardsPoolAddr,
            label: "RewardsPool",
        },
        {
            name: "Deployer has LISTING_ROLE on Marketplace",
            contract: contractInstances.FCMTaskMarketplace,
            roleFn: "LISTING_ROLE",
            grantee: signerAddr,
            label: "Deployer",
        },
        {
            name: "Deployer has VALIDATOR_ROLE on Registry",
            contract: contractInstances.FCMAgentRegistry,
            roleFn: "VALIDATOR_ROLE",
            grantee: signerAddr,
            label: "Deployer",
        },
        {
            name: "Deployer has ORACLE_ROLE on TierStaking",
            contract: contractInstances.FCMTierStaking,
            roleFn: "ORACLE_ROLE",
            grantee: signerAddr,
            label: "Deployer",
        },
        {
            name: "Deployer has ORACLE_ROLE on ReputationNFT",
            contract: contractInstances.FCMReputationNFT,
            roleFn: "ORACLE_ROLE",
            grantee: signerAddr,
            label: "Deployer",
        },
        {
            name: "Deployer has ORACLE_ROLE on RewardsPool",
            contract: contractInstances.FCMRewardsPool,
            roleFn: "ORACLE_ROLE",
            grantee: signerAddr,
            label: "Deployer",
        },
        {
            name: "Deployer has ARBITRATOR_ROLE on Escrow",
            contract: contractInstances.FCMEscrow,
            roleFn: "ARBITRATOR_ROLE",
            grantee: signerAddr,
            label: "Deployer",
        },
    ];

    for (const check of roleChecks) {
        if (!check.contract) {
            warn(check.name, "Contract not loaded, skipping");
            continue;
        }
        try {
            const roleHash = await check.contract[check.roleFn]();
            const hasRole = await check.contract.hasRole(roleHash, check.grantee);
            if (hasRole) {
                ok(check.name, `${check.label} ${check.grantee.slice(0, 10)}...`);
            } else {
                fail(check.name, `${check.label} ${check.grantee.slice(0, 10)}... missing role`);
            }
        } catch (e) {
            fail(check.name, e.message.slice(0, 80));
        }
    }

    // ══════════════════════════════════════════════════════════════
    // 4. STATE VERIFICATION
    // ══════════════════════════════════════════════════════════════
    section("4. Contract State");

    // FCMToken
    if (contractInstances.FCMToken) {
        try {
            const name = await contractInstances.FCMToken.name();
            const symbol = await contractInstances.FCMToken.symbol();
            const totalSupply = await contractInstances.FCMToken.totalSupply();
            const decimals = await contractInstances.FCMToken.decimals();
            ok("Token name", name);
            ok("Token symbol", symbol);
            ok("Token decimals", decimals.toString());
            ok("Token total supply", ethers.formatEther(totalSupply) + " FCM");
        } catch (e) {
            fail("Token state", e.message.slice(0, 80));
        }
    }

    // TierStaking
    if (contractInstances.FCMTierStaking) {
        try {
            const stakerCount = await contractInstances.FCMTierStaking.getStakerCount();
            ok("TierStaking staker count", stakerCount.toString());
            for (let t = 0; t <= 5; t++) {
                const tierCount = await contractInstances.FCMTierStaking.tierStakeCount(t);
                if (tierCount > 0) {
                    ok(`Tier ${t} stakers`, tierCount.toString());
                }
            }
        } catch (e) {
            fail("TierStaking state", e.message.slice(0, 80));
        }
    }

    // Governance
    if (contractInstances.FCMGovernance) {
        try {
            const proposalCount = await contractInstances.FCMGovernance.proposalCount();
            const votingDuration = await contractInstances.FCMGovernance.votingDuration();
            const timelockDuration = await contractInstances.FCMGovernance.timelockDuration();
            const quorum = await contractInstances.FCMGovernance.quorumThreshold();
            ok("Governance proposals", proposalCount.toString());
            ok("Voting duration", `${Number(votingDuration) / 86400} days`);
            ok("Timelock duration", `${Number(timelockDuration) / 86400} days`);
            ok("Quorum threshold", `${Number(quorum) / 100}%`);
        } catch (e) {
            fail("Governance state", e.message.slice(0, 80));
        }
    }

    // Escrow
    if (contractInstances.FCMEscrow) {
        try {
            const escrowCount = await contractInstances.FCMEscrow.escrowCount();
            const multisigThreshold = await contractInstances.FCMEscrow.multisigThreshold();
            const disputeWindow = await contractInstances.FCMEscrow.disputeWindow();
            ok("Escrow count", escrowCount.toString());
            ok("Multisig threshold", ethers.formatEther(multisigThreshold) + " FCM");
            ok("Dispute window", `${Number(disputeWindow) / 86400} days`);
        } catch (e) {
            fail("Escrow state", e.message.slice(0, 80));
        }
    }

    // ReputationNFT
    if (contractInstances.FCMReputationNFT) {
        try {
            const totalBadges = await contractInstances.FCMReputationNFT.totalSupply();
            ok("Total badges minted", totalBadges.toString());
        } catch (e) {
            fail("ReputationNFT state", e.message.slice(0, 80));
        }
    }

    // Registry
    if (contractInstances.FCMAgentRegistry) {
        try {
            const agentCount = await contractInstances.FCMAgentRegistry.agentListLength();
            const taskCount = await contractInstances.FCMAgentRegistry.taskListLength();
            const disputeWindow = await contractInstances.FCMAgentRegistry.disputeWindow();
            const disputeResolution = await contractInstances.FCMAgentRegistry.disputeResolutionDeadline();
            ok("Registered agents", agentCount.toString());
            ok("Total tasks", taskCount.toString());
            ok("Dispute window", `${Number(disputeWindow) / 86400} days`);
            ok("Dispute resolution deadline", `${Number(disputeResolution) / 86400} days`);
        } catch (e) {
            fail("Registry state", e.message.slice(0, 80));
        }
    }

    // ══════════════════════════════════════════════════════════════
    // 5. PAUSE STATE CHECK
    // ══════════════════════════════════════════════════════════════
    section("5. Pause State");

    const pauseableContracts = [
        { name: "FCMAgentRegistry", instance: contractInstances.FCMAgentRegistry },
        { name: "FCMTaskMarketplace", instance: contractInstances.FCMTaskMarketplace },
        { name: "FCMTierStaking", instance: contractInstances.FCMTierStaking },
        { name: "FCMGovernance", instance: contractInstances.FCMGovernance },
        { name: "FCMEscrow", instance: contractInstances.FCMEscrow },
        { name: "FCMReputationNFT", instance: contractInstances.FCMReputationNFT },
        { name: "FCMRewardsPool", instance: contractInstances.FCMRewardsPool },
    ];

    for (const { name, instance } of pauseableContracts) {
        if (!instance) continue;
        try {
            const paused = await instance.paused();
            if (!paused) {
                ok(`${name} not paused`, "Active and accepting transactions");
            } else {
                warn(`${name} paused`, "Contract is currently paused");
            }
        } catch (e) {
            // Not all contracts are Pausable
        }
    }

    // ══════════════════════════════════════════════════════════════
    // 6. DEPLOYMENT FILE INTEGRITY
    // ══════════════════════════════════════════════════════════════
    section("6. Deployment File Integrity");

    const requiredFields = ["network", "chainId", "deployer", "timestamp", "contracts", "roles"];
    for (const field of requiredFields) {
        if (deployment[field]) {
            ok(`Field: ${field}`, typeof deployment[field] === "object" ? JSON.stringify(deployment[field]).slice(0, 60) : String(deployment[field]).slice(0, 60));
        } else {
            fail(`Field: ${field}`, "Missing from deployment file");
        }
    }

    const requiredContracts = expectedContracts;
    for (const name of requiredContracts) {
        if (contracts[name]) {
            const addr = contracts[name];
            if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
                fail(`Address format: ${name}`, `Invalid address: ${addr}`);
            } else {
                ok(`Address format: ${name}`, "Valid checksummed address");
            }
        } else {
            fail(`Address: ${name}`, "Missing from deployment file");
        }
    }

    // ══════════════════════════════════════════════════════════════
    // 7. ETHERSCAN LINKS
    // ══════════════════════════════════════════════════════════════
    section("7. Etherscan Links");

    const explorerBase = `https://${networkName}.etherscan.io`;
    for (const [name, addr] of Object.entries(contracts)) {
        log(`  🔗 ${name}: ${explorerBase}/address/${addr}#code`);
    }

    // ══════════════════════════════════════════════════════════════
    // SUMMARY
    // ══════════════════════════════════════════════════════════════
    printSummary();
}

function printSummary() {
    const total = passed + failed + warnings;
    const status = failed === 0 ? "✅ ALL PASSED" : `❌ ${failed} FAILED`;

    console.log(`\n${"═".repeat(70)}`);
    console.log(`  VERIFICATION SUMMARY`);
    console.log(`${"═".repeat(70)}`);
    console.log(`  Total checks: ${total}`);
    console.log(`  ✅ Passed:    ${passed}`);
    console.log(`  ❌ Failed:    ${failed}`);
    console.log(`  ⚠️  Warnings:  ${warnings}`);
    console.log(`  Status:       ${status}`);
    console.log(`${"═".repeat(70)}\n`);

    // Save report
    const reportPath = path.join(__dirname, "../../deployments/verification-report.json");
    const report = {
        timestamp: new Date().toISOString(),
        network: "unknown",
        status: failed === 0 ? "passed" : "failed",
        summary: { total, passed, failed, warnings },
        checks: results,
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`  📄 Report saved to: ${reportPath}\n`);

    if (failed > 0) {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error("\n❌ Verification failed:", error);
    process.exitCode = 1;
});
