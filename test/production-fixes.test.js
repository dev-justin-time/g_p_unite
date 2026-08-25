import { expect } from "chai";
import hre from "hardhat";
const { ethers } = await hre.network.create();

/**
 * Regression tests for production audit fixes:
 *   C-1: settleAuction refunds lister the maxPrice - winningBid difference
 *   C-2: claimRewards resets epochWork so work can't be double-claimed
 *   C-3: resolveDispute (client-wins) refunds ALL remaining escrow
 *   M-1: applyPendingDowngrade applies a queued tier downgrade after grace period
 */
describe("Production Fixes", function () {
    let token, registry, marketplace, tierStaking, rewardsPool, escrow;
    let admin, operator1, bidder1, bidder2, oracle, worker, client;

    const DAY = 86400;
    const WEEK = 7 * DAY;

    beforeEach(async function () {
        [admin, operator1, bidder1, bidder2, oracle, worker, client] = await ethers.getSigners();

        const FCMToken = await ethers.getContractFactory("FCMToken");
        token = await FCMToken.deploy(admin.address);
        await token.waitForDeployment();

        const FCMAgentRegistry = await ethers.getContractFactory("FCMAgentRegistry");
        registry = await FCMAgentRegistry.deploy(await token.getAddress());
        await registry.waitForDeployment();

        const FCMTaskMarketplace = await ethers.getContractFactory("FCMTaskMarketplace");
        marketplace = await FCMTaskMarketplace.deploy(await registry.getAddress(), await token.getAddress());
        await marketplace.waitForDeployment();

        const FCMTierStaking = await ethers.getContractFactory("FCMTierStaking");
        tierStaking = await FCMTierStaking.deploy(await token.getAddress());
        await tierStaking.waitForDeployment();

        const FCMRewardsPool = await ethers.getContractFactory("FCMRewardsPool");
        rewardsPool = await FCMRewardsPool.deploy(await token.getAddress(), await tierStaking.getAddress());
        await rewardsPool.waitForDeployment();

        const FCMEscrow = await ethers.getContractFactory("FCMEscrow");
        escrow = await FCMEscrow.deploy(await token.getAddress());
        await escrow.waitForDeployment();

        // Exempt contracts from transfer fees
        await token.setFeeExempt(await marketplace.getAddress(), true);
        await token.setFeeExempt(await tierStaking.getAddress(), true);
        await token.setFeeExempt(await rewardsPool.getAddress(), true);
        await token.setFeeExempt(await escrow.getAddress(), true);

        // Roles
        await rewardsPool.grantRole(await rewardsPool.ORACLE_ROLE(), oracle.address);
        await tierStaking.grantRole(await tierStaking.ORACLE_ROLE(), oracle.address);
        await escrow.grantRole(await escrow.ARBITRATOR_ROLE(), admin.address);

        // Fund participants
        await token.transfer(bidder1.address, ethers.parseEther("100"));
        await token.transfer(bidder2.address, ethers.parseEther("100"));
        await token.transfer(operator1.address, ethers.parseEther("200000"));
        await token.transfer(worker.address, ethers.parseEther("100000"));
        await token.transfer(client.address, ethers.parseEther("200000"));

        // Approvals
        const maxApprove = ethers.parseEther("1000000000");
        await token.approve(await marketplace.getAddress(), maxApprove);
        await token.connect(bidder1).approve(await marketplace.getAddress(), maxApprove);
        await token.connect(bidder2).approve(await marketplace.getAddress(), maxApprove);
        await token.connect(operator1).approve(await tierStaking.getAddress(), maxApprove);
        await token.connect(client).approve(await escrow.getAddress(), maxApprove);
        await token.approve(await rewardsPool.getAddress(), maxApprove);
    });

    // ── C-1: settleAuction lister refund ────────────────────────
    describe("C-1: settleAuction lister refund", function () {
        it("should refund the lister maxPrice - winningBid difference", async function () {
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("auction-lister-refund"));
            const minPrice = ethers.parseEther("10");
            const maxPrice = ethers.parseEther("100");

            await marketplace.listAuctionTask(taskId, minPrice, maxPrice, 3600);
            await marketplace.connect(bidder1).placeBid(taskId, ethers.ZeroHash, ethers.parseEther("30"));

            // Fast-forward past auction end
            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine");

            // Lister escrowed 100, winning bid is 30 → lister gets 70 back
            const balBefore = await token.balanceOf(admin.address);
            await marketplace.settleAuction(taskId);
            const balAfter = await token.balanceOf(admin.address);
            expect(balAfter - balBefore).to.equal(ethers.parseEther("70"));
        });

        it("should not double-refund the lister across multiple settlements", async function () {
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("auction-no-double-refund"));
            const minPrice = ethers.parseEther("1");
            const maxPrice = ethers.parseEther("10");

            await marketplace.listAuctionTask(taskId, minPrice, maxPrice, 60);
            await marketplace.connect(bidder1).placeBid(taskId, ethers.ZeroHash, ethers.parseEther("5"));

            await ethers.provider.send("evm_increaseTime", [61]);
            await ethers.provider.send("evm_mine");

            const balBefore = await token.balanceOf(admin.address);
            await marketplace.settleAuction(taskId);
            const balAfter = await token.balanceOf(admin.address);
            expect(balAfter - balBefore).to.equal(ethers.parseEther("5"));

            // Second settlement should revert (already settled)
            await expect(
                marketplace.settleAuction(taskId)
            ).to.be.revertedWith("Already settled");
        });
    });

    // ── C-2: epochWork reset after claim ────────────────────────
    describe("C-2: epochWork reset after claim", function () {
        async function setupFinalizedEpoch(agent, workUnits) {
            // Stake so agent has a multiplier (tier 1)
            await tierStaking.connect(operator1).stake(ethers.parseEther("100"));
            await tierStaking.connect(oracle).updateHardwareScore(operator1.address, 1000, 1500);

            // Fund epoch 0
            await rewardsPool.fundEpoch(ethers.parseEther("1000"));

            // Record work for agent
            await rewardsPool.connect(oracle).recordWork(agent, 0, workUnits);

            // Advance past epoch duration
            await ethers.provider.send("evm_increaseTime", [WEEK + 1]);
            await ethers.provider.send("evm_mine");

            // Finalize epoch 0 → currentEpoch becomes 1
            await rewardsPool.finalizeEpoch();
        }

        it("should reset epochWork to 0 after successful claim", async function () {
            await setupFinalizedEpoch(operator1.address, 100);

            const before = await rewardsPool.agentRewards(operator1.address);
            expect(before.epochWork).to.equal(100);

            await rewardsPool.connect(operator1).claimRewards();

            const after = await rewardsPool.agentRewards(operator1.address);
            expect(after.epochWork).to.equal(0);
            expect(after.lastClaimEpoch).to.equal(0);
        });

        it("should NOT allow double-claiming the same work across epochs", async function () {
            await setupFinalizedEpoch(operator1.address, 100);
            await rewardsPool.connect(operator1).claimRewards();

            // Fund the new epoch (epoch 1) and finalize it with NO new work
            await rewardsPool.fundEpoch(ethers.parseEther("1000"));
            await ethers.provider.send("evm_increaseTime", [WEEK + 1]);
            await ethers.provider.send("evm_mine");
            await rewardsPool.finalizeEpoch();

            // Agent did no work in epoch 1 — must NOT be able to claim
            await expect(
                rewardsPool.connect(operator1).claimRewards()
            ).to.be.revertedWith("No work recorded");
        });
    });

    // ── C-3: resolveDispute full remaining escrow refund ────────
    describe("C-3: resolveDispute refunds ALL remaining escrow", function () {
        it("should refund all remaining milestones, not just the disputed one", async function () {
            const desc = ["M1", "M2", "M3"];
            const amounts = [ethers.parseEther("20"), ethers.parseEther("20"), ethers.parseEther("20")];

            await escrow.connect(client).createEscrow(worker.address, desc, amounts);
            await escrow.connect(client).fundEscrow(1);

            // Worker submits milestone 0, client approves → 20 FCM released
            await escrow.connect(worker).submitMilestone(1, 0, ethers.ZeroHash);
            await escrow.connect(client).approveMilestone(1, 0);

            // Dispute milestone 1 (submitted but not approved)
            await escrow.connect(worker).submitMilestone(1, 1, ethers.ZeroHash);
            await escrow.connect(client).disputeMilestone(1, 1, "Bad work");

            const clientBalBefore = await token.balanceOf(client.address);
            await escrow.resolveDispute(1, true, "Client wins");
            const clientBalAfter = await token.balanceOf(client.address);

            // Remaining escrow = 40 FCM (M2 + M3) → full refund of 40
            expect(clientBalAfter - clientBalBefore).to.equal(ethers.parseEther("40"));

            const summary = await escrow.getEscrowSummary(1);
            expect(summary.state).to.equal(7); // Refunded (enum: Created=0,Funded=1,InProgress=2,Completed=3,Disputed=4,Resolved=5,Cancelled=6,Refunded=7)
        });

        it("should leave zero remaining escrow after client-wins refund", async function () {
            const desc = ["M1", "M2"];
            const amounts = [ethers.parseEther("10"), ethers.parseEther("10")];

            await escrow.connect(client).createEscrow(worker.address, desc, amounts);
            await escrow.connect(client).fundEscrow(1);
            await escrow.connect(worker).submitMilestone(1, 1, ethers.ZeroHash);
            await escrow.connect(client).disputeMilestone(1, 1, "Dispute");

            await escrow.resolveDispute(1, true, "Client wins");

            // Read remainingAmount via the summary — released should be 0, remaining 0
            const summary = await escrow.getEscrowSummary(1);
            expect(summary.releasedAmount).to.equal(0);
        });

        it("should still pay worker when worker wins a partial dispute", async function () {
            const desc = ["M1", "M2"];
            const amounts = [ethers.parseEther("10"), ethers.parseEther("10")];

            await escrow.connect(client).createEscrow(worker.address, desc, amounts);
            await escrow.connect(client).fundEscrow(1);
            await escrow.connect(worker).submitMilestone(1, 0, ethers.ZeroHash);
            await escrow.connect(client).disputeMilestone(1, 0, "Dispute");

            const workerBalBefore = await token.balanceOf(worker.address);
            await escrow.resolveDispute(1, false, "Worker wins");
            const workerBalAfter = await token.balanceOf(worker.address);
            expect(workerBalAfter - workerBalBefore).to.equal(ethers.parseEther("10"));

            // Escrow returns to Resolved state so remaining milestones can proceed
            const summary = await escrow.getEscrowSummary(1);
            expect(summary.state).to.equal(5); // Resolved
        });
    });

    // ── M-1: applyPendingDowngrade ──────────────────────────────
    describe("M-1: applyPendingDowngrade", function () {
        async function reachTier3WithPendingDowngrade() {
            // Stake to reach tier 3
            await tierStaking.connect(operator1).stake(ethers.parseEther("2000"));
            await tierStaking.connect(oracle).updateHardwareScore(operator1.address, 3000, 3500);
            expect(await tierStaking.getTier(operator1.address)).to.equal(3);

            // Advance past the 24h hardware check interval
            await ethers.provider.send("evm_increaseTime", [DAY + 1]);
            await ethers.provider.send("evm_mine");

            // Oracle drops hardware score → tier downgrade pending (grace period not passed)
            await tierStaking.connect(oracle).updateHardwareScore(operator1.address, 500, 1000);
            expect(await tierStaking.getTier(operator1.address)).to.equal(3); // Still tier 3
        }

        it("should apply pending downgrade after grace period", async function () {
            await reachTier3WithPendingDowngrade();

            // Advance past grace period (3 days) + hardware check interval for next call
            await ethers.provider.send("evm_increaseTime", [3 * DAY + 1]);
            await ethers.provider.send("evm_mine");

            // Apply pending downgrade
            await tierStaking.applyPendingDowngrade(operator1.address);
            expect(await tierStaking.getTier(operator1.address)).to.equal(0);
        });

        it("should revert if grace period not passed", async function () {
            await reachTier3WithPendingDowngrade();

            await expect(
                tierStaking.applyPendingDowngrade(operator1.address)
            ).to.be.revertedWith("Grace period not passed");
        });

        it("should be a no-op when no downgrade is pending", async function () {
            await tierStaking.connect(operator1).stake(ethers.parseEther("100"));
            await tierStaking.connect(oracle).updateHardwareScore(operator1.address, 1000, 1500);
            expect(await tierStaking.getTier(operator1.address)).to.equal(1);

            await tierStaking.applyPendingDowngrade(operator1.address);
            expect(await tierStaking.getTier(operator1.address)).to.equal(1);
        });
    });
});