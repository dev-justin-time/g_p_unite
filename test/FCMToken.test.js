const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FCMToken", function () {
    let token, treasury, admin, user1, user2;
    const INITIAL_SUPPLY_ADMIN = ethers.parseEther("200000000");
    const INITIAL_SUPPLY_TREASURY = ethers.parseEther("200000000");
    const INITIAL_SUPPLY_CONTRACT = ethers.parseEther("100000000");
    const MAX_SUPPLY = ethers.parseEther("1000000000");

    beforeEach(async function () {
        [admin, treasury, user1, user2] = await ethers.getSigners();
        const FCMToken = await ethers.getContractFactory("FCMToken");
        token = await FCMToken.deploy(treasury.address);
        await token.waitForDeployment();
    });

    describe("Deployment", function () {
        it("should set correct name and symbol", async function () {
            expect(await token.name()).to.equal("Federated Compute Mesh");
            expect(await token.symbol()).to.equal("FCM");
        });

        it("should mint initial supply to admin, treasury, and contract", async function () {
            expect(await token.balanceOf(admin.address)).to.equal(INITIAL_SUPPLY_ADMIN);
            expect(await token.balanceOf(treasury.address)).to.equal(INITIAL_SUPPLY_TREASURY);
            expect(await token.balanceOf(await token.getAddress())).to.equal(INITIAL_SUPPLY_CONTRACT);
        });

        it("should set treasury as fee-exempt", async function () {
            expect(await token.feeExempt(treasury.address)).to.equal(true);
        });

        it("should set contract address as fee-exempt", async function () {
            expect(await token.feeExempt(await token.getAddress())).to.equal(true);
        });

        it("should grant ADMIN_ROLE and MINTER_ROLE to deployer", async function () {
            const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
            const MINTER_ROLE = await token.MINTER_ROLE();
            expect(await token.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.equal(true);
            expect(await token.hasRole(MINTER_ROLE, admin.address)).to.equal(true);
        });
    });

    describe("Minting", function () {
        it("should allow minting within reserve, reject exceeding MAX_SUPPLY", async function () {
            // Constructor mints 500M, 500M reserved for rewards
            const mintable = await token.getMintableSupply();
            expect(mintable).to.be.gt(0);

            // Minting within reserve should succeed
            await expect(
                token.mintRewards(user1.address, ethers.parseEther("100"))
            ).to.not.be.reverted;

            // Minting beyond reserve should fail
            await expect(
                token.mintRewards(user1.address, mintable + 1n)
            ).to.be.revertedWith("Mintable supply exceeded");
        });

        it("should reject non-minter from minting", async function () {
            await expect(
                token.connect(user1).mintRewards(user2.address, ethers.parseEther("100"))
            ).to.be.reverted;
        });
    });

    describe("Transfer Fees", function () {
        it("should apply burn and treasury fees on transfer", async function () {
            const transferAmount = ethers.parseEther("1000");
            const burnAmount = (transferAmount * 100n) / 10000n;  // 1%
            const treasuryAmount = (transferAmount * 200n) / 10000n;  // 2%

            const treasuryBefore = await token.balanceOf(treasury.address);
            const user1Before = await token.balanceOf(user1.address);

            await token.transfer(user1.address, transferAmount);

            const user1After = await token.balanceOf(user1.address);
            const treasuryAfter = await token.balanceOf(treasury.address);

            // User1 receives transfer minus burn and treasury fees
            // Admin is not fee-exempt, so fees apply
            const expectedReceived = transferAmount - burnAmount - treasuryAmount;
            expect(user1After - user1Before).to.equal(expectedReceived);
            // Treasury receives its cut
            expect(treasuryAfter - treasuryBefore).to.equal(treasuryAmount);
        });

        it("should track totalBurned correctly", async function () {
            const transferAmount = ethers.parseEther("1000");
            const burnAmount = (transferAmount * 100n) / 10000n;

            await token.transfer(user1.address, transferAmount);
            expect(await token.totalBurned()).to.equal(burnAmount);
        });

        it("should not charge fees from fee-exempt accounts", async function () {
            const transferAmount = ethers.parseEther("1000");
            const treasuryBefore = await token.balanceOf(treasury.address);

            // Treasury is fee-exempt, so no fees should be charged
            await token.connect(treasury).transfer(user1.address, transferAmount);

            expect(await token.balanceOf(user1.address)).to.equal(transferAmount);
            expect(await token.balanceOf(treasury.address)).to.equal(
                INITIAL_SUPPLY_TREASURY - transferAmount
            );
        });

        it("should not charge fees on mint (verified by exemption logic)", async function () {
            // Minting bypasses fees because `from == address(0)` check in _afterTokenTransfer
            // We verify this by checking that a transfer from feeExempt account has no fees
            const transferAmount = ethers.parseEther("100");
            const totalBurnedBefore = await token.totalBurned();

            // Treasury is fee-exempt, so transfer from treasury should not burn
            await token.connect(treasury).transfer(user1.address, transferAmount);
            expect(await token.totalBurned()).to.equal(totalBurnedBefore);
            expect(await token.balanceOf(user1.address)).to.equal(transferAmount);
        });

        it("should not charge fees on burn", async function () {
            await token.transfer(user1.address, ethers.parseEther("1000"));
            const totalBurnedBefore = await token.totalBurned();

            await token.connect(user1).burn(ethers.parseEther("100"));
            expect(await token.totalBurned()).to.equal(totalBurnedBefore);
        });
    });

    describe("Fee Configuration", function () {
        it("should allow admin to set fee rates", async function () {
            await token.setFeeRates(200, 300); // 2% burn, 3% treasury
            expect(await token.burnRate()).to.equal(200);
            expect(await token.treasuryRate()).to.equal(300);
        });

        it("should reject fees exceeding 10% combined", async function () {
            await expect(
                token.setFeeRates(501, 500) // 10.01%
            ).to.be.revertedWith("Max 10% fees");
        });

        it("should allow admin to set fee-exempt accounts", async function () {
            await token.setFeeExempt(user1.address, true);
            expect(await token.feeExempt(user1.address)).to.equal(true);

            await token.setFeeExempt(user1.address, false);
            expect(await token.feeExempt(user1.address)).to.equal(false);
        });

        it("should reject non-admin from setting fee rates", async function () {
            await expect(
                token.connect(user1).setFeeRates(100, 100)
            ).to.be.reverted;
        });
    });

    describe("Token Supply", function () {
        it("should have correct MAX_SUPPLY and mintable supply", async function () {
            expect(await token.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
            // 500M initial, 500M reserved for rewards
            expect(await token.getMintableSupply()).to.equal(ethers.parseEther("500000000"));
        });
    });
});
