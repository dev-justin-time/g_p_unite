const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Full On-Chain Integration Flow", function () {
    let token, registry, marketplace;
    let admin, treasury, requester, agent1, agent2, validator;

    const MIN_STAKE = ethers.parseEther("500");

    beforeEach(async function () {
        [admin, treasury, requester, agent1, agent2, validator] = await ethers.getSigners();

        // Deploy token
        const FCMToken = await ethers.getContractFactory("FCMToken");
        token = await FCMToken.deploy(treasury.address);
        await token.waitForDeployment();

        // Deploy registry
        const FCMAgentRegistry = await ethers.getContractFactory("FCMAgentRegistry");
        registry = await FCMAgentRegistry.deploy(await token.getAddress());
        await registry.waitForDeployment();

        // Deploy marketplace
        const FCMTaskMarketplace = await ethers.getContractFactory("FCMTaskMarketplace");
        marketplace = await FCMTaskMarketplace.deploy(await registry.getAddress(), await token.getAddress());
        await marketplace.waitForDeployment();

        // Exempt contracts from fees
        await token.setFeeExempt(await registry.getAddress(), true);
        await token.setFeeExempt(await marketplace.getAddress(), true);

        // Setup roles
        await registry.grantRole(await registry.VALIDATOR_ROLE(), validator.address);

        // Give tokens to participants
        await token.transfer(requester.address, ethers.parseEther("100000"));
        await token.transfer(agent1.address, ethers.parseEther("100000"));
        await token.transfer(agent2.address, ethers.parseEther("100000"));

        // Approvals
        await token.connect(agent1).approve(await registry.getAddress(), ethers.parseEther("1000000"));
        await token.connect(agent2).approve(await registry.getAddress(), ethers.parseEther("1000000"));
        await token.connect(requester).approve(await registry.getAddress(), ethers.parseEther("1000000"));
    });

    describe("Happy Path: Full Task Lifecycle", function () {
        it("should complete: register → create → claim → submit → withdraw", async function () {
            const did1 = ethers.keccak256(ethers.toUtf8Bytes("agent-inference-1"));
            const did2 = ethers.keccak256(ethers.toUtf8Bytes("agent-inference-2"));
            const capabilities = ethers.encodeBytes32String("gpu,cuda");
            const geohash = ethers.encodeBytes32String("u4pru");

            // 1. Register two agents
            await expect(
                registry.connect(agent1).registerAgent(did1, "/ipns/test1", capabilities, geohash, 0)
            ).to.emit(registry, "AgentRegistered").withArgs(did1, agent1.address, 0, geohash);

            await expect(
                registry.connect(agent2).registerAgent(did2, "/ipns/test2", capabilities, geohash, 0)
            ).to.emit(registry, "AgentRegistered").withArgs(did2, agent2.address, 0, geohash);

            // Verify staking
            const agent1Data = await registry.agents(did1);
            expect(agent1Data.stake).to.equal(MIN_STAKE);
            expect(agent1Data.isActive).to.equal(true);

            // 2. Create a task
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("integration-task-1"));
            const reward = ethers.parseEther("200");
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;

            await expect(
                registry.connect(requester).createTask(taskId, capabilities, ethers.ZeroHash, deadline)
            ).to.emit(registry, "TaskCreated");

            const task = await registry.tasks(taskId);
            expect(task.status).to.equal(0); // Open
            expect(task.reward).to.be.gt(0);

            // 3. Agent1 claims the task
            await expect(
                registry.connect(agent1).claimTask(taskId, did1)
            ).to.emit(registry, "TaskAssigned").withArgs(taskId, did1);

            const taskAfterClaim = await registry.tasks(taskId);
            expect(taskAfterClaim.status).to.equal(1); // Assigned
            expect(taskAfterClaim.assignedAgent).to.equal(agent1.address);

            // 4. Agent1 submits result
            const outputCID = ethers.keccak256(ethers.toUtf8Bytes("output-result-1"));
            const proofHash = ethers.keccak256(ethers.toUtf8Bytes("proof-1"));

            await expect(
                registry.connect(agent1).submitResult(taskId, outputCID, proofHash)
            ).to.emit(registry, "TaskCompleted");

            const taskAfterSubmit = await registry.tasks(taskId);
            expect(taskAfterSubmit.status).to.equal(2); // Completed
            expect(taskAfterSubmit.outputCID).to.equal(outputCID);
            expect(taskAfterSubmit.proofHash).to.equal(proofHash);

            // 5. Wait for dispute window to close (deadline + DISPUTE_WINDOW + 1)
            await ethers.provider.send("evm_increaseTime", [86400 + 86401]); // deadline + dispute window + 1s
            await ethers.provider.send("evm_mine");

            const balanceBefore = await token.balanceOf(agent1.address);
            await registry.connect(agent1).withdrawReward(taskId);
            const balanceAfter = await token.balanceOf(agent1.address);

            expect(balanceAfter).to.be.gt(balanceBefore);
            expect(taskAfterSubmit.rewardWithdrawn).to.equal(false); // Check original storage

            // Verify agent reputation increased
            const agent1After = await registry.agents(did1);
            expect(agent1After.reputation).to.be.gt(5000);
        });
    });

    describe("Agent Registration Edge Cases", function () {
        it("should reject duplicate registration", async function () {
            const did = ethers.keccak256(ethers.toUtf8Bytes("unique-agent"));
            const caps = ethers.encodeBytes32String("gpu");
            const geo = ethers.encodeBytes32String("u4pru");

            await registry.connect(agent1).registerAgent(did, "/ipns/test", caps, geo, 0);

            await expect(
                registry.connect(agent2).registerAgent(did, "/ipns/test2", caps, geo, 1)
            ).to.be.revertedWith("Agent exists");
        });

        it("should reject unstaking with active tasks", async function () {
            const did = ethers.keccak256(ethers.toUtf8Bytes("agent-unstake"));
            const caps = ethers.encodeBytes32String("gpu");
            const geo = ethers.encodeBytes32String("u4pru");

            await registry.connect(agent1).registerAgent(did, "/ipns/test", caps, geo, 0);

            // Create and claim a task
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("unstake-task"));
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
            await registry.connect(requester).createTask(taskId, caps, ethers.ZeroHash, deadline);
            await registry.connect(agent1).claimTask(taskId, did);

            // Should fail to unstake
            await expect(
                registry.connect(agent1).unstake(did)
            ).to.be.revertedWith("Active tasks");
        });
    });

    describe("Task Cancellation", function () {
        it("should allow requester to cancel open task", async function () {
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("cancel-task"));
            const caps = ethers.encodeBytes32String("gpu");
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;

            await registry.connect(requester).createTask(taskId, caps, ethers.ZeroHash, deadline);

            const balanceBefore = await token.balanceOf(requester.address);
            await expect(
                registry.connect(requester).cancelTask(taskId)
            ).to.emit(registry, "TaskCancelled");
            const balanceAfter = await token.balanceOf(requester.address);

            expect(balanceAfter).to.be.gt(balanceBefore);

            const task = await registry.tasks(taskId);
            expect(task.status).to.equal(4); // Slashed (used for cancelled)
        });

        it("should reject cancellation by non-requester", async function () {
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("cancel-task-2"));
            const caps = ethers.encodeBytes32String("gpu");
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;

            await registry.connect(requester).createTask(taskId, caps, ethers.ZeroHash, deadline);

            await expect(
                registry.connect(agent1).cancelTask(taskId)
            ).to.be.revertedWith("Not requester");
        });
    });

    describe("Dispute Resolution", function () {
        it("should allow requester to dispute, then validator resolves in favor of agent", async function () {
            const did = ethers.keccak256(ethers.toUtf8Bytes("agent-dispute"));
            const caps = ethers.encodeBytes32String("gpu");
            const geo = ethers.encodeBytes32String("u4pru");

            await registry.connect(agent1).registerAgent(did, "/ipns/test", caps, geo, 0);

            // Create, claim, submit
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("dispute-task"));
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
            await registry.connect(requester).createTask(taskId, caps, ethers.ZeroHash, deadline);
            await registry.connect(agent1).claimTask(taskId, did);

            const outputCID = ethers.keccak256(ethers.toUtf8Bytes("disputed-output"));
            const proofHash = ethers.keccak256(ethers.toUtf8Bytes("disputed-proof"));
            await registry.connect(agent1).submitResult(taskId, outputCID, proofHash);

            // Dispute within dispute window
            await expect(
                registry.connect(requester).disputeTask(taskId, "Incorrect output")
            ).to.emit(registry, "TaskDisputed");

            const taskAfterDispute = await registry.tasks(taskId);
            expect(taskAfterDispute.status).to.equal(3); // Disputed

            // Validator resolves in favor of agent (not agent's fault)
            await expect(
                registry.connect(validator).resolveDispute(taskId, false, "Output verified correct")
            ).to.not.be.reverted;

            // Agent can now withdraw — advance past deadline + dispute window
            await ethers.provider.send("evm_increaseTime", [86400 + 86401]);
            await ethers.provider.send("evm_mine");

            await expect(
                registry.connect(agent1).withdrawReward(taskId)
            ).to.not.be.reverted;
        });

        it("should slash agent when dispute resolved against them", async function () {
            const did = ethers.keccak256(ethers.toUtf8Bytes("agent-slash"));
            const caps = ethers.encodeBytes32String("gpu");
            const geo = ethers.encodeBytes32String("u4pru");

            await registry.connect(agent1).registerAgent(did, "/ipns/test", caps, geo, 0);
            const agentBefore = await registry.agents(did);
            const stakeBefore = agentBefore.stake;

            // Create, claim, submit, dispute
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("slash-task"));
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
            await registry.connect(requester).createTask(taskId, caps, ethers.ZeroHash, deadline);
            await registry.connect(agent1).claimTask(taskId, did);

            const outputCID = ethers.keccak256(ethers.toUtf8Bytes("bad-output"));
            const proofHash = ethers.keccak256(ethers.toUtf8Bytes("bad-proof"));
            await registry.connect(agent1).submitResult(taskId, outputCID, proofHash);
            await registry.connect(requester).disputeTask(taskId, "Malicious output");

            // Validator resolves against agent
            const reqBalance = await token.balanceOf(requester.address);
            await registry.connect(validator).resolveDispute(taskId, true, "Agent found guilty");

            const agentAfter = await registry.agents(did);
            expect(agentAfter.stake).to.be.lt(stakeBefore);

            // Requester receives reward + slash amount
            const reqBalanceAfter = await token.balanceOf(requester.address);
            expect(reqBalanceAfter).to.be.gt(reqBalance);
        });
    });

    describe("Capability Matching", function () {
        it("should reject claim when agent lacks required capabilities", async function () {
            const did = ethers.keccak256(ethers.toUtf8Bytes("agent-nocap"));
            const agentCaps = ethers.encodeBytes32String("cpu"); // Only CPU
            const taskReqs = ethers.encodeBytes32String("gpu"); // Requires GPU
            const geo = ethers.encodeBytes32String("u4pru");

            await registry.connect(agent1).registerAgent(did, "/ipns/test", agentCaps, geo, 0);

            const taskId = ethers.keccak256(ethers.toUtf8Bytes("cap-task"));
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
            await registry.connect(requester).createTask(taskId, taskReqs, ethers.ZeroHash, deadline);

            await expect(
                registry.connect(agent1).claimTask(taskId, did)
            ).to.be.revertedWith("Capability mismatch");
        });

        it("should allow claim when agent has all required capabilities", async function () {
            const did = ethers.keccak256(ethers.toUtf8Bytes("agent-fullcap"));
            const agentCaps = ethers.encodeBytes32String("gpu,cuda,avx512"); // Has everything
            const taskReqs = ethers.encodeBytes32String("gpu"); // Requires just GPU
            const geo = ethers.encodeBytes32String("u4pru");

            await registry.connect(agent1).registerAgent(did, "/ipns/test", agentCaps, geo, 0);

            const taskId = ethers.keccak256(ethers.toUtf8Bytes("cap-task-ok"));
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
            await registry.connect(requester).createTask(taskId, taskReqs, ethers.ZeroHash, deadline);

            await expect(
                registry.connect(agent1).claimTask(taskId, did)
            ).to.emit(registry, "TaskAssigned");
        });
    });

    describe("Reward Calculation", function () {
        it("should calculate reward based on task requirements", async function () {
            const reqs1 = ethers.encodeBytes32String("simple");
            const reqs2 = ethers.encodeBytes32String("complex-workload");

            const reward1 = await registry.calculateReward(reqs1);
            const reward2 = await registry.calculateReward(reqs2);

            expect(reward1).to.be.gt(0);
            expect(reward2).to.be.gt(0);
            // Different requirements should yield different rewards
            expect(reward1).to.not.equal(reward2);
        });
    });
});
