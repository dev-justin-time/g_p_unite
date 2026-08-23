const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FCMAgentRegistry", function () {
    let registry, token;
    let admin, validator, operator1, operator2, requester;

    const MIN_STAKE = ethers.parseEther("500");
    const REWARD = ethers.parseEther("100");

    // Helper: create agent type enum values
    const AGENT_TYPE = { INFERENCE: 0, RENDER: 1, FL: 2, EDGE: 3, ZK: 4, GAME: 5, SCIENCE: 6, PRIVACY: 7 };

    // Helper: create a signature for heartbeat
    async function signHeartbeat(signer, didHash, geohash, timestamp) {
        const message = ethers.solidityPacked(
            ["bytes32", "bytes32", "uint256"],
            [didHash, geohash, timestamp]
        );
        const hash = ethers.keccak256(message);
        return signer.signMessage(ethers.getBytes(hash));
    }

    beforeEach(async function () {
        [admin, validator, operator1, operator2, requester] = await ethers.getSigners();

        // Deploy token
        const FCMToken = await ethers.getContractFactory("FCMToken");
        token = await FCMToken.deploy(admin.address);
        await token.waitForDeployment();

        // Deploy registry
        const FCMAgentRegistry = await ethers.getContractFactory("FCMAgentRegistry");
        registry = await FCMAgentRegistry.deploy(await token.getAddress());
        await registry.waitForDeployment();

        // Grant MINTER_ROLE to registry so it can mint rewards
        const MINTER_ROLE = await token.MINTER_ROLE();
        await token.grantRole(MINTER_ROLE, await registry.getAddress());

        // Grant VALIDATOR_ROLE to validator signer
        const VALIDATOR_ROLE = await registry.VALIDATOR_ROLE();
        await registry.grantRole(VALIDATOR_ROLE, validator.address);

        // Exempt registry from transfer fees (escrow contract)
        await token.setFeeExempt(await registry.getAddress(), true);

        // Transfer tokens to operators and requester for staking
        await token.transfer(operator1.address, ethers.parseEther("10000"));
        await token.transfer(operator2.address, ethers.parseEther("10000"));
        await token.transfer(requester.address, ethers.parseEther("10000"));
    });

    describe("Agent Registration", function () {
        it("should register an agent with correct stake", async function () {
            const didHash = ethers.keccak256(ethers.toUtf8Bytes("agent-1"));
            const geohash = ethers.encodeBytes32String("u4pru");
            const capabilities = ethers.encodeBytes32String("gpu,cuda");

            await token.connect(operator1).approve(await registry.getAddress(), MIN_STAKE);
            await registry.connect(operator1).registerAgent(
                didHash, "/ipns/test", capabilities, geohash, AGENT_TYPE.INFERENCE
            );

            const agent = await registry.agents(didHash);
            expect(agent.operator).to.equal(operator1.address);
            expect(agent.stake).to.equal(MIN_STAKE);
            expect(agent.isActive).to.equal(true);
            expect(agent.agentType).to.equal(AGENT_TYPE.INFERENCE);
        });

        it("should reject duplicate agent registration", async function () {
            const didHash = ethers.keccak256(ethers.toUtf8Bytes("agent-1"));
            const geohash = ethers.encodeBytes32String("u4pru");
            const capabilities = ethers.encodeBytes32String("gpu,cuda");

            await token.connect(operator1).approve(await registry.getAddress(), MIN_STAKE);
            await registry.connect(operator1).registerAgent(
                didHash, "/ipns/test", capabilities, geohash, AGENT_TYPE.INFERENCE
            );

            // Try to register again with same didHash
            await token.connect(operator1).approve(await registry.getAddress(), MIN_STAKE);
            await expect(
                registry.connect(operator1).registerAgent(
                    didHash, "/ipns/test2", capabilities, geohash, AGENT_TYPE.INFERENCE
                )
            ).to.be.revertedWith("Agent exists");
        });

        it("should reject invalid agent type", async function () {
            const didHash = ethers.keccak256(ethers.toUtf8Bytes("agent-1"));
            const geohash = ethers.encodeBytes32String("u4pru");
            const capabilities = ethers.encodeBytes32String("gpu,cuda");

            await token.connect(operator1).approve(await registry.getAddress(), MIN_STAKE);
            await expect(
                registry.connect(operator1).registerAgent(
                    didHash, "/ipns/test", capabilities, geohash, 12 // Invalid type (>11)
                )
            ).to.be.revertedWith("Invalid agent type");
        });

        it("should reject registration without sufficient stake", async function () {
            const didHash = ethers.keccak256(ethers.toUtf8Bytes("agent-1"));
            const geohash = ethers.encodeBytes32String("u4pru");
            const capabilities = ethers.encodeBytes32String("gpu,cuda");

            // No approval — should fail
            await expect(
                registry.connect(operator1).registerAgent(
                    didHash, "/ipns/test", capabilities, geohash, AGENT_TYPE.INFERENCE
                )
            ).to.be.reverted;
        });
    });

    describe("Task Lifecycle", function () {
        let didHash, geohash, capabilities;

        beforeEach(async function () {
            didHash = ethers.keccak256(ethers.toUtf8Bytes("agent-task"));
            geohash = ethers.encodeBytes32String("u4pru");
            capabilities = ethers.encodeBytes32String("gpu,cuda");

            // Register agent
            await token.connect(operator1).approve(await registry.getAddress(), MIN_STAKE);
            await registry.connect(operator1).registerAgent(
                didHash, "/ipns/test", capabilities, geohash, AGENT_TYPE.INFERENCE
            );
        });

        it("should create a task with escrowed reward", async function () {
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("task-1"));
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
            const expectedReward = await registry.calculateReward(capabilities);

            await token.connect(requester).approve(await registry.getAddress(), expectedReward);
            await registry.connect(requester).createTask(taskId, capabilities, ethers.ZeroHash, deadline);

            const task = await registry.tasks(taskId);
            expect(task.requester).to.equal(requester.address);
            expect(task.reward).to.equal(expectedReward);
            expect(task.status).to.equal(0); // TaskStatus.Open
        });

        it("should allow agent to claim an open task", async function () {
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("task-claim"));
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
            const expectedReward = await registry.calculateReward(capabilities);

            await token.connect(requester).approve(await registry.getAddress(), expectedReward);
            await registry.connect(requester).createTask(taskId, capabilities, ethers.ZeroHash, deadline);

            await registry.connect(operator1).claimTask(taskId, didHash);
            const task = await registry.tasks(taskId);
            expect(task.status).to.equal(1); // TaskStatus.Assigned
            expect(task.assignedAgent).to.equal(operator1.address);
        });

        it("should allow agent to submit result", async function () {
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("task-submit"));
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
            const outputCID = ethers.keccak256(ethers.toUtf8Bytes("output"));
            const proofHash = ethers.keccak256(ethers.toUtf8Bytes("proof"));
            const expectedReward = await registry.calculateReward(capabilities);

            await token.connect(requester).approve(await registry.getAddress(), expectedReward);
            await registry.connect(requester).createTask(taskId, capabilities, ethers.ZeroHash, deadline);
            await registry.connect(operator1).claimTask(taskId, didHash);
            await registry.connect(operator1).submitResult(taskId, outputCID, proofHash);

            const task = await registry.tasks(taskId);
            expect(task.status).to.equal(2); // TaskStatus.Completed
            expect(task.outputCID).to.equal(outputCID);
        });

        it("should allow agent to withdraw reward after dispute window", async function () {
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("task-withdraw"));
            const expectedReward = await registry.calculateReward(capabilities);

            await token.connect(requester).approve(await registry.getAddress(), expectedReward);
            // Get fresh timestamp right before createTask
            const now = (await ethers.provider.getBlock("latest")).timestamp;
            const deadline = now + 86400;
            await registry.connect(requester).createTask(taskId, capabilities, ethers.ZeroHash, deadline);
            await registry.connect(operator1).claimTask(taskId, didHash);
            await registry.connect(operator1).submitResult(taskId, ethers.ZeroHash, ethers.ZeroHash);

            // Fast-forward past deadline + dispute window
            await ethers.provider.send("evm_increaseTime", [86400 + 86401]);
            await ethers.provider.send("evm_mine");

            const balBefore = await token.balanceOf(operator1.address);
            await registry.connect(operator1).withdrawReward(taskId);
            const balAfter = await token.balanceOf(operator1.address);

            expect(balAfter - balBefore).to.equal(expectedReward);
        });

        it("should prevent double withdrawal", async function () {
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("task-nodouble"));
            const expectedReward = await registry.calculateReward(capabilities);

            await token.connect(requester).approve(await registry.getAddress(), expectedReward);
            const now = (await ethers.provider.getBlock("latest")).timestamp;
            const deadline = now + 86400;
            await registry.connect(requester).createTask(taskId, capabilities, ethers.ZeroHash, deadline);
            await registry.connect(operator1).claimTask(taskId, didHash);
            await registry.connect(operator1).submitResult(taskId, ethers.ZeroHash, ethers.ZeroHash);

            await ethers.provider.send("evm_increaseTime", [86400 + 86401]);
            await ethers.provider.send("evm_mine");

            await registry.connect(operator1).withdrawReward(taskId);
            await expect(
                registry.connect(operator1).withdrawReward(taskId)
            ).to.be.revertedWith("Reward already withdrawn");
        });

        it("should allow requester to dispute within window", async function () {
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("task-dispute"));
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
            const expectedReward = await registry.calculateReward(capabilities);

            await token.connect(requester).approve(await registry.getAddress(), expectedReward);
            await registry.connect(requester).createTask(taskId, capabilities, ethers.ZeroHash, deadline);
            await registry.connect(operator1).claimTask(taskId, didHash);
            await registry.connect(operator1).submitResult(taskId, ethers.ZeroHash, ethers.ZeroHash);

            await registry.connect(requester).disputeTask(taskId, "Bad result");
            const task = await registry.tasks(taskId);
            expect(task.status).to.equal(3); // TaskStatus.Disputed
        });

        it("should allow validator to resolve dispute (agent fault)", async function () {
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("task-resolve"));
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
            const expectedReward = await registry.calculateReward(capabilities);

            await token.connect(requester).approve(await registry.getAddress(), expectedReward);
            await registry.connect(requester).createTask(taskId, capabilities, ethers.ZeroHash, deadline);
            await registry.connect(operator1).claimTask(taskId, didHash);
            await registry.connect(operator1).submitResult(taskId, ethers.ZeroHash, ethers.ZeroHash);
            await registry.connect(requester).disputeTask(taskId, "Bad result");

            const agentBefore = await registry.agents(didHash);
            await registry.connect(validator).resolveDispute(taskId, true, "Agent was wrong");
            const agentAfter = await registry.agents(didHash);

            // Agent should be slashed
            expect(agentAfter.stake).to.be.lt(agentBefore.stake);
            expect(agentAfter.reputation).to.be.lt(agentBefore.reputation);
        });
    });

    describe("Capability Check (Operator Precedence)", function () {
        it("should correctly check bitwise capability matching", async function () {
            const didHash = ethers.keccak256(ethers.toUtf8Bytes("agent-cap"));
            const geohash = ethers.encodeBytes32String("u4pru");
            // capabilities = 0x03 = 0b0011 (bit 0 and bit 1 set)
            const capabilities = ethers.encodeBytes32String("0x03");

            await token.connect(operator1).approve(await registry.getAddress(), MIN_STAKE);
            await registry.connect(operator1).registerAgent(
                didHash, "/ipns/test", capabilities, geohash, AGENT_TYPE.INFERENCE
            );

            const taskId = ethers.keccak256(ethers.toUtf8Bytes("task-cap"));
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;

            // Task requires 0x01 (bit 0) — agent has it
            await token.connect(requester).approve(await registry.getAddress(), REWARD);
            await registry.connect(requester).createTask(taskId, ethers.encodeBytes32String("0x01"), ethers.ZeroHash, deadline);

            await registry.connect(operator1).claimTask(taskId, didHash);
            const task = await registry.tasks(taskId);
            expect(task.status).to.equal(1); // Assigned
        });
    });

    describe("Unstaking", function () {
        it("should allow unstaking when no active tasks", async function () {
            const didHash = ethers.keccak256(ethers.toUtf8Bytes("agent-unstake"));
            const geohash = ethers.encodeBytes32String("u4pru");
            const capabilities = ethers.encodeBytes32String("gpu");

            await token.connect(operator1).approve(await registry.getAddress(), MIN_STAKE);
            await registry.connect(operator1).registerAgent(
                didHash, "/ipns/test", capabilities, geohash, AGENT_TYPE.INFERENCE
            );

            const balBefore = await token.balanceOf(operator1.address);
            await registry.connect(operator1).unstake(didHash);
            const balAfter = await token.balanceOf(operator1.address);

            expect(balAfter - balBefore).to.equal(MIN_STAKE);

            const agent = await registry.agents(didHash);
            expect(agent.isActive).to.equal(false);
            expect(agent.stake).to.equal(0);
        });

        it("should reject unstaking with active tasks", async function () {
            const didHash = ethers.keccak256(ethers.toUtf8Bytes("agent-nounstake"));
            const geohash = ethers.encodeBytes32String("u4pru");
            const unstakeCapabilities = ethers.encodeBytes32String("gpu");

            await token.connect(operator1).approve(await registry.getAddress(), MIN_STAKE);
            await registry.connect(operator1).registerAgent(
                didHash, "/ipns/test", unstakeCapabilities, geohash, AGENT_TYPE.INFERENCE
            );

            // Create and assign a task
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("task-nounstake"));
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
            const expectedReward = await registry.calculateReward(unstakeCapabilities);
            await token.connect(requester).approve(await registry.getAddress(), expectedReward);
            await registry.connect(requester).createTask(taskId, unstakeCapabilities, ethers.ZeroHash, deadline);
            await registry.connect(operator1).claimTask(taskId, didHash);

            // Should fail because agent has active task
            await expect(
                registry.connect(operator1).unstake(didHash)
            ).to.be.revertedWith("Active tasks");
        });
    });

    describe("Reward Calculation", function () {
        it("should calculate reward based on requirements complexity", async function () {
            const base = ethers.parseEther("100");
            // Use a simple bytes32 value: 0x0000...0005 = 5, 5 % 100 = 5
            const req = ethers.zeroPadValue(ethers.toBeHex(5), 32);
            const expected = base + ethers.parseEther("5");
            expect(await registry.calculateReward(req)).to.equal(expected);
        });
    });
});
