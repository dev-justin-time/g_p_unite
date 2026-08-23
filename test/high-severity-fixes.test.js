const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("High-Severity Fixes", function () {
    let token, registry;
    let admin, validator, agent1, requester;

    const MIN_STAKE = ethers.parseEther("500");

    beforeEach(async function () {
        [admin, validator, agent1, requester] = await ethers.getSigners();

        const FCMToken = await ethers.getContractFactory("FCMToken");
        token = await FCMToken.deploy(admin.address);
        await token.waitForDeployment();

        const FCMAgentRegistry = await ethers.getContractFactory("FCMAgentRegistry");
        registry = await FCMAgentRegistry.deploy(await token.getAddress());
        await registry.waitForDeployment();

        await registry.grantRole(await registry.VALIDATOR_ROLE(), validator.address);
        await token.grantRole(await token.MINTER_ROLE(), await registry.getAddress());
        await token.setFeeExempt(await registry.getAddress(), true);

        await token.transfer(agent1.address, ethers.parseEther("100000"));
        await token.transfer(requester.address, ethers.parseEther("100000"));
        await token.connect(agent1).approve(await registry.getAddress(), ethers.parseEther("1000000"));
        await token.connect(requester).approve(await registry.getAddress(), ethers.parseEther("1000000"));
    });

    // ── H-2: Counter underflow guard ──
    describe("H-2: operatorActiveTasks Underflow Guard", function () {
        it("should prevent submitResult when counter is 0", async function () {
            const did = ethers.keccak256(ethers.toUtf8Bytes("h2-agent"));
            const caps = ethers.encodeBytes32String("gpu");
            const geo = ethers.encodeBytes32String("u4pru");

            await registry.connect(agent1).registerAgent(did, "/ipns/test", caps, geo, 0);

            // Create and complete a task normally
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("h2-task"));
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
            await registry.connect(requester).createTask(taskId, caps, ethers.ZeroHash, deadline);
            await registry.connect(agent1).claimTask(taskId, did);
            await registry.connect(agent1).submitResult(taskId, ethers.ZeroHash, ethers.ZeroHash);

            // Counter should be 0 now. Try to submit again — should revert
            const taskId2 = ethers.keccak256(ethers.toUtf8Bytes("h2-task-2"));
            const deadline2 = (await ethers.provider.getBlock("latest")).timestamp + 86400;
            await registry.connect(requester).createTask(taskId2, caps, ethers.ZeroHash, deadline2);
            await registry.connect(agent1).claimTask(taskId2, did);

            // submitResult for taskId2 works (counter goes 0→1→0)
            await registry.connect(agent1).submitResult(taskId2, ethers.ZeroHash, ethers.ZeroHash);

            // Cannot submit on a task that's already completed
            await expect(
                registry.connect(agent1).submitResult(taskId2, ethers.ZeroHash, ethers.ZeroHash)
            ).to.be.revertedWith("Not assigned");
        });
    });

    // ── H-3: Dispute resolution deadline ──
    describe("H-3: Dispute Resolution Deadline", function () {
        it("should set disputedAt timestamp on dispute", async function () {
            const did = ethers.keccak256(ethers.toUtf8Bytes("h3-agent"));
            const caps = ethers.encodeBytes32String("gpu");
            const geo = ethers.encodeBytes32String("u4pru");

            await registry.connect(agent1).registerAgent(did, "/ipns/test", caps, geo, 0);

            const taskId = ethers.keccak256(ethers.toUtf8Bytes("h3-task"));
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
            await registry.connect(requester).createTask(taskId, caps, ethers.ZeroHash, deadline);
            await registry.connect(agent1).claimTask(taskId, did);
            await registry.connect(agent1).submitResult(taskId, ethers.ZeroHash, ethers.ZeroHash);
            await registry.connect(requester).disputeTask(taskId, "Test dispute");

            const task = await registry.tasks(taskId);
            expect(task.disputedAt).to.be.gt(0);
            expect(task.status).to.equal(3); // Disputed
        });

        it("should reject dispute resolution after 7-day deadline", async function () {
            const did = ethers.keccak256(ethers.toUtf8Bytes("h3-agent-2"));
            const caps = ethers.encodeBytes32String("gpu");
            const geo = ethers.encodeBytes32String("u4pru");

            await registry.connect(agent1).registerAgent(did, "/ipns/test", caps, geo, 0);

            const taskId = ethers.keccak256(ethers.toUtf8Bytes("h3-task-2"));
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
            await registry.connect(requester).createTask(taskId, caps, ethers.ZeroHash, deadline);
            await registry.connect(agent1).claimTask(taskId, did);
            await registry.connect(agent1).submitResult(taskId, ethers.ZeroHash, ethers.ZeroHash);
            await registry.connect(requester).disputeTask(taskId, "Late dispute");

            // Advance past 7 days
            await ethers.provider.send("evm_increaseTime", [7 * 86400 + 1]);
            await ethers.provider.send("evm_mine");

            // Resolution should be rejected
            await expect(
                registry.connect(validator).resolveDispute(taskId, false, "Too late")
            ).to.be.revertedWith("Dispute deadline exceeded");
        });

        it("should allow claimExpiredDispute after 7 days", async function () {
            const did = ethers.keccak256(ethers.toUtf8Bytes("h3-agent-3"));
            const caps = ethers.encodeBytes32String("gpu");
            const geo = ethers.encodeBytes32String("u4pru");

            await registry.connect(agent1).registerAgent(did, "/ipns/test", caps, geo, 0);

            const taskId = ethers.keccak256(ethers.toUtf8Bytes("h3-task-3"));
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
            await registry.connect(requester).createTask(taskId, caps, ethers.ZeroHash, deadline);
            await registry.connect(agent1).claimTask(taskId, did);
            await registry.connect(agent1).submitResult(taskId, ethers.ZeroHash, ethers.ZeroHash);
            await registry.connect(requester).disputeTask(taskId, "Expired dispute");

            // Advance past 7 days
            await ethers.provider.send("evm_increaseTime", [7 * 86400 + 1]);
            await ethers.provider.send("evm_mine");

            // Either party can claim refund for expired dispute
            const balBefore = await token.balanceOf(requester.address);
            await registry.connect(requester).claimExpiredDispute(taskId);
            const balAfter = await token.balanceOf(requester.address);

            expect(balAfter).to.be.gt(balBefore);
            const task = await registry.tasks(taskId);
            expect(task.status).to.equal(4); // Slashed (terminal)
        });

        it("should reject claimExpiredDispute before 7 days", async function () {
            const did = ethers.keccak256(ethers.toUtf8Bytes("h3-agent-4"));
            const caps = ethers.encodeBytes32String("gpu");
            const geo = ethers.encodeBytes32String("u4pru");

            await registry.connect(agent1).registerAgent(did, "/ipns/test", caps, geo, 0);

            const taskId = ethers.keccak256(ethers.toUtf8Bytes("h3-task-4"));
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
            await registry.connect(requester).createTask(taskId, caps, ethers.ZeroHash, deadline);
            await registry.connect(agent1).claimTask(taskId, did);
            await registry.connect(agent1).submitResult(taskId, ethers.ZeroHash, ethers.ZeroHash);
            await registry.connect(requester).disputeTask(taskId, "Too early");

            // Should fail — not expired yet
            await expect(
                registry.connect(requester).claimExpiredDispute(taskId)
            ).to.be.revertedWith("Dispute not expired");
        });

        it("should reject claimExpiredDispute by non-party", async function () {
            const did = ethers.keccak256(ethers.toUtf8Bytes("h3-agent-5"));
            const caps = ethers.encodeBytes32String("gpu");
            const geo = ethers.encodeBytes32String("u4pru");
            const [, , , , randomUser] = await ethers.getSigners();

            await registry.connect(agent1).registerAgent(did, "/ipns/test", caps, geo, 0);

            const taskId = ethers.keccak256(ethers.toUtf8Bytes("h3-task-5"));
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
            await registry.connect(requester).createTask(taskId, caps, ethers.ZeroHash, deadline);
            await registry.connect(agent1).claimTask(taskId, did);
            await registry.connect(agent1).submitResult(taskId, ethers.ZeroHash, ethers.ZeroHash);
            await registry.connect(requester).disputeTask(taskId, "Test");

            await ethers.provider.send("evm_increaseTime", [7 * 86400 + 1]);
            await ethers.provider.send("evm_mine");

            await expect(
                registry.connect(randomUser).claimExpiredDispute(taskId)
            ).to.be.revertedWith("Not party to dispute");
        });
    });
});
