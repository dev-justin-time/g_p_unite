const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Critical Vulnerability Fixes", function () {
    let token, registry, marketplace;
    let admin, treasury, requester, agent1, agent2, validator;

    const MIN_STAKE = ethers.parseEther("500");

    beforeEach(async function () {
        [admin, treasury, requester, agent1, agent2, validator] = await ethers.getSigners();

        const FCMToken = await ethers.getContractFactory("FCMToken");
        token = await FCMToken.deploy(treasury.address);
        await token.waitForDeployment();

        const FCMAgentRegistry = await ethers.getContractFactory("FCMAgentRegistry");
        registry = await FCMAgentRegistry.deploy(await token.getAddress());
        await registry.waitForDeployment();

        const FCMTaskMarketplace = await ethers.getContractFactory("FCMTaskMarketplace");
        marketplace = await FCMTaskMarketplace.deploy(await registry.getAddress(), await token.getAddress());
        await marketplace.waitForDeployment();

        // Setup roles
        await registry.grantRole(await registry.VALIDATOR_ROLE(), validator.address);
        await token.setFeeExempt(await registry.getAddress(), true);
        await token.setFeeExempt(await marketplace.getAddress(), true);

        // Mint MINTER_ROLE to registry
        await token.grantRole(await token.MINTER_ROLE(), await registry.getAddress());

        // Fund participants
        await token.transfer(requester.address, ethers.parseEther("100000"));
        await token.transfer(agent1.address, ethers.parseEther("100000"));
        await token.transfer(agent2.address, ethers.parseEther("100000"));

        // Approvals
        await token.connect(agent1).approve(await registry.getAddress(), ethers.parseEther("1000000"));
        await token.connect(agent2).approve(await registry.getAddress(), ethers.parseEther("1000000"));
        await token.connect(requester).approve(await registry.getAddress(), ethers.parseEther("1000000"));
        await token.connect(agent1).approve(await marketplace.getAddress(), ethers.parseEther("1000000"));
        await token.connect(agent2).approve(await marketplace.getAddress(), ethers.parseEther("1000000"));
        await token.connect(requester).approve(await marketplace.getAddress(), ethers.parseEther("1000000"));
    });

    // ── C-1: Task ID Collision ──
    describe("C-1: Task ID Collision Prevention", function () {
        it("should reject createTask with duplicate taskId", async function () {
            const caps = ethers.encodeBytes32String("gpu");
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("collision-task"));
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;

            await registry.connect(requester).createTask(taskId, caps, ethers.ZeroHash, deadline);

            // Second task with same ID should revert
            await expect(
                registry.connect(requester).createTask(taskId, caps, ethers.ZeroHash, deadline)
            ).to.be.revertedWith("Task ID already exists");
        });

        it("should allow createTask with different taskIds", async function () {
            const caps = ethers.encodeBytes32String("gpu");
            const task1 = ethers.keccak256(ethers.toUtf8Bytes("task-a"));
            const task2 = ethers.keccak256(ethers.toUtf8Bytes("task-b"));
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;

            await registry.connect(requester).createTask(task1, caps, ethers.ZeroHash, deadline);
            await registry.connect(requester).createTask(task2, caps, ethers.ZeroHash, deadline);

            const t1 = await registry.tasks(task1);
            const t2 = await registry.tasks(task2);
            expect(t1.requester).to.equal(requester.address);
            expect(t2.requester).to.equal(requester.address);
        });
    });

    // ── C-2: Agent Type Validation ──
    describe("C-2: Agent Type 0-11 Validation", function () {
        it("should accept agent types 0-11", async function () {
            const geo = ethers.encodeBytes32String("u4pru");
            const caps = ethers.encodeBytes32String("gpu");

            for (let type = 0; type <= 11; type++) {
                const did = ethers.keccak256(ethers.toUtf8Bytes(`agent-type-${type}`));
                await expect(
                    registry.connect(agent1).registerAgent(did, "/ipns/test", caps, geo, type)
                ).to.emit(registry, "AgentRegistered");
            }
        });

        it("should reject agent type 12 and above", async function () {
            const geo = ethers.encodeBytes32String("u4pru");
            const caps = ethers.encodeBytes32String("gpu");
            const did = ethers.keccak256(ethers.toUtf8Bytes("agent-type-invalid"));

            await expect(
                registry.connect(agent1).registerAgent(did, "/ipns/test", caps, geo, 12)
            ).to.be.revertedWith("Invalid agent type");

            const did2 = ethers.keccak256(ethers.toUtf8Bytes("agent-type-invalid-2"));
            await expect(
                registry.connect(agent1).registerAgent(did2, "/ipns/test", caps, geo, 255)
            ).to.be.revertedWith("Invalid agent type");
        });
    });

    // ── C-3: Spot Task Escrow Refund ──
    describe("C-3: Spot Task Escrow Refund via cancelSpotTask", function () {
        it("should allow lister to cancel and get full refund", async function () {
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("spot-cancel"));
            const caps = ethers.encodeBytes32String("gpu");
            const price = ethers.parseEther("50");
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;

            await marketplace.connect(requester).listSpotTask(taskId, caps, price, deadline, 0);

            const balBefore = await token.balanceOf(requester.address);
            await expect(
                marketplace.connect(requester).cancelSpotTask(taskId)
            ).to.emit(marketplace, "SpotTaskCancelled");
            const balAfter = await token.balanceOf(requester.address);

            expect(balAfter - balBefore).to.equal(price);
        });

        it("should reject cancel by non-lister", async function () {
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("spot-cancel-2"));
            const caps = ethers.encodeBytes32String("gpu");
            const price = ethers.parseEther("50");
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;

            await marketplace.connect(requester).listSpotTask(taskId, caps, price, deadline, 0);

            await expect(
                marketplace.connect(agent1).cancelSpotTask(taskId)
            ).to.be.revertedWith("Not lister");
        });

        it("should reject double cancel", async function () {
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("spot-double"));
            const caps = ethers.encodeBytes32String("gpu");
            const price = ethers.parseEther("50");
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;

            await marketplace.connect(requester).listSpotTask(taskId, caps, price, deadline, 0);
            await marketplace.connect(requester).cancelSpotTask(taskId);

            await expect(
                marketplace.connect(requester).cancelSpotTask(taskId)
            ).to.be.revertedWith("Already cancelled");
        });
    });

    // ── C-4: Auction Refund for Deregistered Agents ──
    describe("C-4: Auction Bid Refund for Deregistered Agents", function () {
        it("should refund bid even after agent unstakes", async function () {
            const did1 = ethers.keccak256(ethers.toUtf8Bytes("auction-agent-1"));
            const did2 = ethers.keccak256(ethers.toUtf8Bytes("auction-agent-2"));
            const caps = ethers.encodeBytes32String("gpu");
            const geo = ethers.encodeBytes32String("u4pru");

            // Register two agents
            await registry.connect(agent1).registerAgent(did1, "/ipns/test", caps, geo, 0);
            await registry.connect(agent2).registerAgent(did2, "/ipns/test", caps, geo, 0);

            // Create auction
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("auction-refund"));
            await marketplace.connect(requester).listAuctionTask(taskId, caps, ethers.parseEther("10"), ethers.parseEther("100"), 3600);

            // Agent2 places higher bid (will lose)
            await marketplace.connect(agent2).placeBid(taskId, did2, ethers.parseEther("80"));
            // Agent1 places lower bid (will win)
            await marketplace.connect(agent1).placeBid(taskId, did1, ethers.parseEther("30"));

            // Unstake agent2 (deregister the loser)
            await registry.connect(agent2).unstake(did2);

            // Advance past auction end
            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine");

            // Settle — agent2's refund should go to stored bidder address, not registry lookup
            const balBefore = await token.balanceOf(agent2.address);
            await marketplace.connect(admin).settleAuction(taskId);
            const balAfter = await token.balanceOf(agent2.address);

            // Deregistered agent should still get refund
            expect(balAfter).to.be.gt(balBefore);
        });
    });

    // ── C-5: Mint to Zero Address Prevention ──
    describe("C-5: Mint to Zero Address Prevention", function () {
        it("should reject mintRewards to address(0)", async function () {
            await expect(
                token.mintRewards(ethers.ZeroAddress, ethers.parseEther("100"))
            ).to.be.revertedWith("Cannot mint to zero address");
        });

        it("should allow mintRewards to valid address", async function () {
            await expect(
                token.mintRewards(agent1.address, ethers.parseEther("100"))
            ).to.not.be.reverted;
        });
    });

    // ── C-6: Dispute Loop Prevention ──
    describe("C-6: Dispute Loop Prevention via Terminal Resolved State", function () {
        it("should set status to Resolved (terminal) when agent found innocent", async function () {
            const did = ethers.keccak256(ethers.toUtf8Bytes("dispute-resolve"));
            const caps = ethers.encodeBytes32String("gpu");
            const geo = ethers.encodeBytes32String("u4pru");

            await registry.connect(agent1).registerAgent(did, "/ipns/test", caps, geo, 0);

            const taskId = ethers.keccak256(ethers.toUtf8Bytes("dispute-loop-task"));
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
            await registry.connect(requester).createTask(taskId, caps, ethers.ZeroHash, deadline);
            await registry.connect(agent1).claimTask(taskId, did);
            await registry.connect(agent1).submitResult(taskId, ethers.ZeroHash, ethers.ZeroHash);
            await registry.connect(requester).disputeTask(taskId, "Dispute");

            // Resolve in favor of agent
            await registry.connect(validator).resolveDispute(taskId, false, "Agent innocent");

            const task = await registry.tasks(taskId);
            // Status should be 5 (Resolved), NOT 2 (Completed) — prevents re-dispute
            expect(task.status).to.equal(5); // TaskStatus.Resolved
        });

        it("should prevent re-dispute after resolution", async function () {
            const did = ethers.keccak256(ethers.toUtf8Bytes("dispute-loop-2"));
            const caps = ethers.encodeBytes32String("gpu");
            const geo = ethers.encodeBytes32String("u4pru");

            await registry.connect(agent1).registerAgent(did, "/ipns/test", caps, geo, 0);

            const taskId = ethers.keccak256(ethers.toUtf8Bytes("dispute-loop-task-2"));
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
            await registry.connect(requester).createTask(taskId, caps, ethers.ZeroHash, deadline);
            await registry.connect(agent1).claimTask(taskId, did);
            await registry.connect(agent1).submitResult(taskId, ethers.ZeroHash, ethers.ZeroHash);
            await registry.connect(requester).disputeTask(taskId, "First dispute");
            await registry.connect(validator).resolveDispute(taskId, false, "Agent innocent");

            // Trying to dispute again should fail — status is Resolved, not Completed
            await expect(
                registry.connect(requester).disputeTask(taskId, "Second dispute")
            ).to.be.revertedWith("Not completed");
        });

        it("should still allow agent withdrawal after Resolved status", async function () {
            const did = ethers.keccak256(ethers.toUtf8Bytes("dispute-withdraw"));
            const caps = ethers.encodeBytes32String("gpu");
            const geo = ethers.encodeBytes32String("u4pru");

            await registry.connect(agent1).registerAgent(did, "/ipns/test", caps, geo, 0);

            const taskId = ethers.keccak256(ethers.toUtf8Bytes("dispute-withdraw-task"));
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
            await registry.connect(requester).createTask(taskId, caps, ethers.ZeroHash, deadline);
            await registry.connect(agent1).claimTask(taskId, did);
            await registry.connect(agent1).submitResult(taskId, ethers.ZeroHash, ethers.ZeroHash);
            await registry.connect(requester).disputeTask(taskId, "Dispute");
            await registry.connect(validator).resolveDispute(taskId, false, "Agent innocent");

            // Advance past dispute window
            await ethers.provider.send("evm_increaseTime", [86400 + 86401]);
            await ethers.provider.send("evm_mine");

            // Agent can still withdraw
            const balBefore = await token.balanceOf(agent1.address);
            await registry.connect(agent1).withdrawReward(taskId);
            const balAfter = await token.balanceOf(agent1.address);

            expect(balAfter).to.be.gt(balBefore);
        });
    });
});
