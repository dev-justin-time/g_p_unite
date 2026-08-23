const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("New Feature Contracts", function () {
    let token, tierStaking, rewardsPool, governance, escrow, reputation;
    let admin, operator1, operator2, operator3, oracle, worker, client;

    beforeEach(async function () {
        [admin, operator1, operator2, operator3, oracle, worker, client] = await ethers.getSigners();

        // Deploy token
        const FCMToken = await ethers.getContractFactory("FCMToken");
        token = await FCMToken.deploy(admin.address);
        await token.waitForDeployment();

        // Deploy tier staking
        const FCMTierStaking = await ethers.getContractFactory("FCMTierStaking");
        tierStaking = await FCMTierStaking.deploy(await token.getAddress());
        await tierStaking.waitForDeployment();

        // Deploy rewards pool
        const FCMRewardsPool = await ethers.getContractFactory("FCMRewardsPool");
        rewardsPool = await FCMRewardsPool.deploy(await token.getAddress(), await tierStaking.getAddress());
        await rewardsPool.waitForDeployment();

        // Deploy governance
        const FCMGovernance = await ethers.getContractFactory("FCMGovernance");
        governance = await FCMGovernance.deploy(await token.getAddress(), await tierStaking.getAddress());
        await governance.waitForDeployment();

        // Deploy escrow
        const FCMEscrow = await ethers.getContractFactory("FCMEscrow");
        escrow = await FCMEscrow.deploy(await token.getAddress());
        await escrow.waitForDeployment();

        // Deploy reputation NFT
        const FCMReputationNFT = await ethers.getContractFactory("FCMReputationNFT");
        reputation = await FCMReputationNFT.deploy();
        await reputation.waitForDeployment();

        // Exempt contracts from transfer fees
        await token.setFeeExempt(await tierStaking.getAddress(), true);
        await token.setFeeExempt(await rewardsPool.getAddress(), true);
        await token.setFeeExempt(await escrow.getAddress(), true);
        await token.setFeeExempt(await governance.getAddress(), true);

        // Setup roles
        await tierStaking.grantRole(await tierStaking.ORACLE_ROLE(), oracle.address);
        await rewardsPool.grantRole(await rewardsPool.ORACLE_ROLE(), oracle.address);
        await reputation.grantRole(await reputation.ORACLE_ROLE(), oracle.address);
        await reputation.grantRole(await reputation.ADMIN_ROLE(), admin.address);
        await escrow.grantRole(await escrow.ARBITRATOR_ROLE(), admin.address);

        // Fund participants
        await token.transfer(operator1.address, ethers.parseEther("200000"));
        await token.transfer(operator2.address, ethers.parseEther("200000"));
        await token.transfer(operator3.address, ethers.parseEther("200000"));
        await token.transfer(worker.address, ethers.parseEther("100000"));
        await token.transfer(client.address, ethers.parseEther("200000"));
        await token.transfer(admin.address, ethers.parseEther("500000"));

        // Approvals
        await token.connect(operator1).approve(await tierStaking.getAddress(), ethers.parseEther("200000"));
        await token.connect(operator2).approve(await tierStaking.getAddress(), ethers.parseEther("200000"));
        await token.connect(operator3).approve(await tierStaking.getAddress(), ethers.parseEther("200000"));
        await token.connect(client).approve(await escrow.getAddress(), ethers.parseEther("200000"));
    });

    // ── FCMTierStaking ──────────────────────────────────────────
    describe("FCMTierStaking", function () {
        it("should stake and assign Tier 0 for small stake (no HW score)", async function () {
            await tierStaking.connect(operator1).stake(ethers.parseEther("10"));
            const tier = await tierStaking.getTier(operator1.address);
            // Tier 0 because hardwareScore=0, uptimeScore=0, combined=0 < minScore
            expect(tier).to.equal(0);
        });

        it("should assign Tier 1 when stake + HW score qualify", async function () {
            await tierStaking.connect(operator1).stake(ethers.parseEther("100"));
            // Set HW score to qualify for Tier 1 (minScore=2000)
            await tierStaking.connect(oracle).updateHardwareScore(operator1.address, 1000, 1500);
            const tier = await tierStaking.getTier(operator1.address);
            expect(tier).to.equal(1);
        });

        it("should assign Tier 2 when stake + HW score qualify", async function () {
            await tierStaking.connect(operator1).stake(ethers.parseEther("500"));
            // Set HW score to qualify for Tier 2 (minScore=4000)
            await tierStaking.connect(oracle).updateHardwareScore(operator1.address, 2000, 2500);
            const tier = await tierStaking.getTier(operator1.address);
            expect(tier).to.equal(2);
        });

        it("should assign Tier 3 when stake + HW score qualify", async function () {
            await tierStaking.connect(operator1).stake(ethers.parseEther("2000"));
            // Set HW score to qualify for Tier 3 (minScore=6000)
            await tierStaking.connect(oracle).updateHardwareScore(operator1.address, 3000, 3500);
            const tier = await tierStaking.getTier(operator1.address);
            expect(tier).to.equal(3);
        });

        it("should upgrade tier when hardware score improves", async function () {
            await tierStaking.connect(operator1).stake(ethers.parseEther("50000"));
            const tierBefore = await tierStaking.getTier(operator1.address);

            // Oracle updates hardware score — need to wait for HARDWARE_CHECK_INTERVAL (24h)
            await ethers.provider.send("evm_increaseTime", [86401]);
            await ethers.provider.send("evm_mine");
            await tierStaking.connect(oracle).updateHardwareScore(operator1.address, 9500, 9500);
            const tierAfter = await tierStaking.getTier(operator1.address);
            expect(tierAfter).to.be.gte(tierBefore);
        });

        it("should unstake and return tokens", async function () {
            await tierStaking.connect(operator1).stake(ethers.parseEther("500"));
            const balBefore = await token.balanceOf(operator1.address);
            // Advance past grace period first
            await ethers.provider.send("evm_increaseTime", [3 * 86400 + 1]);
            await ethers.provider.send("evm_mine");
            await tierStaking.connect(operator1).unstake(ethers.parseEther("500"));
            const balAfter = await token.balanceOf(operator1.address);
            expect(balAfter - balBefore).to.equal(ethers.parseEther("500"));
        });

        it("should reject unstake during grace period if it would change tier", async function () {
            await tierStaking.connect(operator1).stake(ethers.parseEther("500"));
            await tierStaking.connect(oracle).updateHardwareScore(operator1.address, 2000, 2500);
            // Tier 2 assigned, unstaking 401 would drop below Tier 2 minStake
            await expect(
                tierStaking.connect(operator1).unstake(ethers.parseEther("401"))
            ).to.be.revertedWith("Tier change grace period active");
        });

        it("should return correct reward multiplier for tier", async function () {
            await tierStaking.connect(operator1).stake(ethers.parseEther("100"));
            await tierStaking.connect(oracle).updateHardwareScore(operator1.address, 1000, 1500);
            const multiplier = await tierStaking.getEffectiveMultiplier(operator1.address);
            expect(multiplier).to.equal(100); // Tier 1 = 1x = 100bp
        });

        it("should return correct fee discount for tier", async function () {
            await tierStaking.connect(operator1).stake(ethers.parseEther("2000"));
            await tierStaking.connect(oracle).updateHardwareScore(operator1.address, 3000, 3500);
            const discount = await tierStaking.getFeeDiscount(operator1.address);
            expect(discount).to.equal(1500); // Tier 3 = 15% discount = 1500bp
        });
    });

    // ── FCMRewardsPool ──────────────────────────────────────────
    describe("FCMRewardsPool", function () {
        it("should fund epoch", async function () {
            await token.approve(await rewardsPool.getAddress(), ethers.parseEther("10000"));
            await rewardsPool.fundEpoch(ethers.parseEther("10000"));
            const epoch = await rewardsPool.getEpochInfo(0);
            expect(epoch.totalPool).to.equal(ethers.parseEther("10000"));
        });

        it("should record work via oracle", async function () {
            await rewardsPool.connect(oracle).recordWork(operator1.address, 0, 100);
            const reward = await rewardsPool.agentRewards(operator1.address);
            expect(reward.epochWork).to.equal(100);
        });

        it("should return correct effective price", async function () {
            const price = await rewardsPool.getEffectivePrice(0); // Inference
            expect(price).to.equal(ethers.parseEther("2.5"));
        });

        it("should reject work recording with zero units", async function () {
            await expect(
                rewardsPool.connect(oracle).recordWork(operator1.address, 0, 0)
            ).to.be.revertedWith("Work must be > 0");
        });
    });

    // ── FCMGovernance ───────────────────────────────────────────
    describe("FCMGovernance", function () {
        it("should create a proposal", async function () {
            const target = await escrow.getAddress();
            const tx = await governance.propose(
                "Change dispute window to 7 days",
                target,
                "0x"
            );
            const receipt = await tx.wait();
            expect(await governance.proposalCount()).to.equal(1);
        });

        it("should allow voting", async function () {
            await tierStaking.connect(operator1).stake(ethers.parseEther("50000"));
            await governance.propose("Test proposal", await escrow.getAddress(), "0x");
            await governance.connect(operator1).castVote(1, 1); // For
            const votes = await governance.getProposalVotes(1);
            expect(votes.forVotes).to.be.gt(0);
        });

        it("should prevent double voting", async function () {
            await tierStaking.connect(operator1).stake(ethers.parseEther("50000"));
            await governance.propose("Test", await escrow.getAddress(), "0x");
            await governance.connect(operator1).castVote(1, 1);
            await expect(
                governance.connect(operator1).castVote(1, 1)
            ).to.be.revertedWith("Already voted");
        });

        it("should reject proposal with empty description", async function () {
            await expect(
                governance.propose("", await escrow.getAddress(), "0x")
            ).to.be.revertedWith("Description required");
        });

        it("should cancel proposal as proposer", async function () {
            await governance.propose("Cancel me", await escrow.getAddress(), "0x");
            await governance.cancelProposal(1);
            const state = await governance.getProposalState(1);
            expect(state).to.equal(6); // Cancelled (enum: Pending=0,Active=1,Succeeded=2,Defeated=3,Queued=4,Executed=5,Cancelled=6)
        });
    });

    // ── FCMEscrow ───────────────────────────────────────────────
    describe("FCMEscrow", function () {
        it("should create and fund an escrow", async function () {
            const desc = ["Design", "Develop", "Test"];
            const amounts = [ethers.parseEther("100"), ethers.parseEther("200"), ethers.parseEther("100")];

            const tx = await escrow.connect(client).createEscrow(worker.address, desc, amounts);
            const receipt = await tx.wait();
            expect(await escrow.escrowCount()).to.equal(1);

            // Fund it
            await escrow.connect(client).fundEscrow(1);
            const summary = await escrow.getEscrowSummary(1);
            expect(summary.state).to.equal(1); // Funded
        });

        it("should submit and approve milestones", async function () {
            const desc = ["Phase 1", "Phase 2"];
            const amounts = [ethers.parseEther("50"), ethers.parseEther("50")];

            await escrow.connect(client).createEscrow(worker.address, desc, amounts);
            await escrow.connect(client).fundEscrow(1);

            // Worker submits milestone 0
            await escrow.connect(worker).submitMilestone(1, 0, ethers.keccak256(ethers.toUtf8Bytes("deliverable")));
            // Client approves
            await escrow.connect(client).approveMilestone(1, 0);

            const summary = await escrow.getEscrowSummary(1);
            expect(summary.completedMilestones).to.equal(1);
            expect(summary.releasedAmount).to.equal(ethers.parseEther("50"));
        });

        it("should allow dispute on submitted milestone", async function () {
            const desc = ["Work"];
            const amounts = [ethers.parseEther("100")];

            await escrow.connect(client).createEscrow(worker.address, desc, amounts);
            await escrow.connect(client).fundEscrow(1);
            await escrow.connect(worker).submitMilestone(1, 0, ethers.ZeroHash);

            await escrow.connect(client).disputeMilestone(1, 0, "Bad quality");
            const summary = await escrow.getEscrowSummary(1);
            expect(summary.state).to.equal(4); // Disputed
        });

        it("should resolve dispute in client favor (refund)", async function () {
            const desc = ["Work"];
            const amounts = [ethers.parseEther("100")];

            await escrow.connect(client).createEscrow(worker.address, desc, amounts);
            await escrow.connect(client).fundEscrow(1);
            await escrow.connect(worker).submitMilestone(1, 0, ethers.ZeroHash);
            await escrow.connect(client).disputeMilestone(1, 0, "Bad");

            const clientBalBefore = await token.balanceOf(client.address);
            await escrow.resolveDispute(1, true, "Client wins");
            const clientBalAfter = await token.balanceOf(client.address);
            expect(clientBalAfter).to.be.gt(clientBalBefore);
        });

        it("should resolve dispute in worker favor (pay)", async function () {
            const desc = ["Work"];
            const amounts = [ethers.parseEther("100")];

            await escrow.connect(client).createEscrow(worker.address, desc, amounts);
            await escrow.connect(client).fundEscrow(1);
            await escrow.connect(worker).submitMilestone(1, 0, ethers.ZeroHash);
            await escrow.connect(client).disputeMilestone(1, 0, "Bad");

            const workerBalBefore = await token.balanceOf(worker.address);
            await escrow.resolveDispute(1, false, "Worker wins");
            const workerBalAfter = await token.balanceOf(worker.address);
            expect(workerBalAfter).to.be.gt(workerBalBefore);
        });

        it("should cancel unfunded escrow", async function () {
            const desc = ["Work"];
            const amounts = [ethers.parseEther("100")];

            await escrow.connect(client).createEscrow(worker.address, desc, amounts);
            await escrow.connect(client).cancelEscrow(1);
            const summary = await escrow.getEscrowSummary(1);
            // State should be Cancelled (6) or Refunded (5)
            expect(summary.state).to.be.gte(5);
        });

        it("should reject non-client from approving milestone", async function () {
            const desc = ["Work"];
            const amounts = [ethers.parseEther("100")];

            await escrow.connect(client).createEscrow(worker.address, desc, amounts);
            await escrow.connect(client).fundEscrow(1);
            await escrow.connect(worker).submitMilestone(1, 0, ethers.ZeroHash);

            await expect(
                escrow.connect(worker).approveMilestone(1, 0)
            ).to.be.revertedWith("Not client");
        });
    });

    // ── FCMReputationNFT ────────────────────────────────────────
    describe("FCMReputationNFT", function () {
        it("should mint badge for operator", async function () {
            const didHash = ethers.keccak256(ethers.toUtf8Bytes("agent-rep"));
            await reputation.mintBadge(operator1.address, didHash);
            expect(await reputation.totalSupply()).to.equal(1);
        });

        it("should reject duplicate badge", async function () {
            const didHash = ethers.keccak256(ethers.toUtf8Bytes("agent-rep"));
            await reputation.mintBadge(operator1.address, didHash);
            await expect(
                reputation.mintBadge(operator1.address, didHash)
            ).to.be.revertedWith("Badge already exists");
        });

        it("should prevent transfer (soulbound)", async function () {
            const didHash = ethers.keccak256(ethers.toUtf8Bytes("agent-soul"));
            await reputation.mintBadge(operator1.address, didHash);
            await expect(
                reputation.connect(operator1).transferFrom(operator1.address, operator2.address, 1)
            ).to.be.revertedWith("Soulbound: cannot transfer");
        });

        it("should prevent approval (soulbound)", async function () {
            const didHash = ethers.keccak256(ethers.toUtf8Bytes("agent-noprov"));
            await reputation.mintBadge(operator1.address, didHash);
            await expect(
                reputation.connect(operator1).approve(operator2.address, 1)
            ).to.be.revertedWith("Soulbound: cannot approve");
        });

        it("should update badge and unlock achievements", async function () {
            const didHash = ethers.keccak256(ethers.toUtf8Bytes("agent-achieve"));
            await reputation.mintBadge(operator1.address, didHash);

            // Complete first task → unlock FIRST_TASK
            await reputation.connect(oracle).updateBadge(operator1.address, 0, 1, ethers.parseEther("10"), 9500, true, false);
            const ach = await reputation.getAchievements(operator1.address);
            expect(ach & 1n).to.equal(1n); // FIRST_TASK bit set
        });

        it("should return correct badge data", async function () {
            const didHash = ethers.keccak256(ethers.toUtf8Bytes("agent-data"));
            await reputation.mintBadge(operator1.address, didHash);
            const badge = await reputation.getBadge(operator1.address);
            expect(badge.operator).to.equal(operator1.address);
            expect(badge.didHash).to.equal(didHash);
            expect(badge.exists).to.equal(true);
        });

        it("should increment streak", async function () {
            const didHash = ethers.keccak256(ethers.toUtf8Bytes("agent-streak"));
            await reputation.mintBadge(operator1.address, didHash);
            await reputation.connect(oracle).incrementStreak(operator1.address);
            await reputation.connect(oracle).incrementStreak(operator1.address);
            const badge = await reputation.getBadge(operator1.address);
            expect(badge.consecutiveDays).to.equal(2);
        });
    });
});
