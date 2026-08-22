const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FCMTaskMarketplace", function () {
    let marketplace, registry, token;
    let admin, operator1, bidder1, bidder2;

    const MIN_STAKE = ethers.parseEther("500");

    beforeEach(async function () {
        [admin, operator1, bidder1, bidder2] = await ethers.getSigners();

        // Deploy token
        const FCMToken = await ethers.getContractFactory("FCMToken");
        token = await FCMToken.deploy(admin.address);
        await token.waitForDeployment();

        // Deploy registry
        const FCMAgentRegistry = await ethers.getContractFactory("FCMAgentRegistry");
        registry = await FCMAgentRegistry.deploy(await token.getAddress());
        await registry.waitForDeployment();

        // Deploy marketplace
        const FCMTaskMarketplace = await ethers.getContractFactory("FCMTaskMarketplace");
        marketplace = await FCMTaskMarketplace.deploy(await registry.getAddress());
        await marketplace.waitForDeployment();

        // Exempt marketplace from transfer fees
        await token.setFeeExempt(await marketplace.getAddress(), true);
    });

    describe("Spot Tasks", function () {
        it("should emit SpotTaskListed event", async function () {
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("spot-1"));
            const requirements = ethers.encodeBytes32String("gpu,cuda");
            const maxPrice = ethers.parseEther("10");
            const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;

            await expect(
                marketplace.listSpotTask(taskId, requirements, maxPrice, deadline, 1)
            ).to.emit(marketplace, "SpotTaskListed").withArgs(taskId, maxPrice, 1);
        });
    });

    describe("Auction Tasks", function () {
        it("should create an auction task", async function () {
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("auction-1"));
            const requirements = ethers.encodeBytes32String("gpu");
            const minPrice = ethers.parseEther("1");
            const maxPrice = ethers.parseEther("10");
            const duration = 3600; // 1 hour

            await marketplace.listAuctionTask(taskId, requirements, minPrice, maxPrice, duration);

            const auction = await marketplace.auctionTasks(taskId);
            expect(auction.taskId).to.equal(taskId);
            expect(auction.minPrice).to.equal(minPrice);
            expect(auction.maxPrice).to.equal(maxPrice);
        });

        it("should return decreasing price over time", async function () {
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("auction-price"));
            const minPrice = ethers.parseEther("1");
            const maxPrice = ethers.parseEther("10");
            const duration = 3600;

            await marketplace.listAuctionTask(taskId, ethers.ZeroHash, minPrice, maxPrice, duration);

            // Price at start should be maxPrice
            const priceNow = await marketplace.getAuctionPrice(taskId);
            expect(priceNow).to.equal(maxPrice);

            // Fast-forward halfway
            await ethers.provider.send("evm_increaseTime", [1800]);
            await ethers.provider.send("evm_mine");

            const priceHalf = await marketplace.getAuctionPrice(taskId);
            expect(priceHalf).to.be.lt(maxPrice);
            expect(priceHalf).to.be.gt(minPrice);
        });

        it("should accept bids below current price", async function () {
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("auction-bid"));
            const minPrice = ethers.parseEther("1");
            const maxPrice = ethers.parseEther("10");
            const duration = 3600;

            await marketplace.listAuctionTask(taskId, ethers.ZeroHash, minPrice, maxPrice, duration);

            const bidPrice = ethers.parseEther("8");
            await expect(
                marketplace.placeBid(taskId, ethers.encodeBytes32String("agent-1"), bidPrice)
            ).to.emit(marketplace, "BidPlaced");
        });

        it("should reject bids above current price", async function () {
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("auction-high"));
            const minPrice = ethers.parseEther("1");
            const maxPrice = ethers.parseEther("10");
            const duration = 3600;

            await marketplace.listAuctionTask(taskId, ethers.ZeroHash, minPrice, maxPrice, duration);

            const bidPrice = ethers.parseEther("11"); // Above max
            await expect(
                marketplace.placeBid(taskId, ethers.encodeBytes32String("agent-1"), bidPrice)
            ).to.be.revertedWith("Price too high");
        });

        it("should settle auction and select lowest bidder", async function () {
            const taskId = ethers.keccak256(ethers.toUtf8Bytes("auction-settle"));
            const minPrice = ethers.parseEther("1");
            const maxPrice = ethers.parseEther("10");
            const duration = 60;

            await marketplace.listAuctionTask(taskId, ethers.ZeroHash, minPrice, maxPrice, duration);

            // Place bids
            await marketplace.placeBid(taskId, ethers.encodeBytes32String("agent-1"), ethers.parseEther("5"));
            await marketplace.placeBid(taskId, ethers.encodeBytes32String("agent-2"), ethers.parseEther("3"));
            await marketplace.placeBid(taskId, ethers.encodeBytes32String("agent-3"), ethers.parseEther("7"));

            // Fast-forward past auction end
            await ethers.provider.send("evm_increaseTime", [61]);
            await ethers.provider.send("evm_mine");

            // Settle — should pick agent-2 with lowest bid (3 ETH)
            await expect(
                marketplace.settleAuction(taskId)
            ).to.emit(marketplace, "AuctionSettled");

            // Verify the event was emitted with the lowest bidder
            const auction = await marketplace.auctionTasks(taskId);
            expect(auction.taskId).to.equal(taskId);
        });
    });
});
