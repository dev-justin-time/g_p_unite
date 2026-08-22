const { ethers, run } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying FCM contracts with account:", deployer.address);

    const FCMToken = await ethers.getContractFactory("FCMToken");
    const fcmToken = await FCMToken.deploy(deployer.address);
    await fcmToken.waitForDeployment();
    const tokenAddress = await fcmToken.getAddress();
    console.log("FCMToken deployed to:", tokenAddress);

    const FCMAgentRegistry = await ethers.getContractFactory("FCMAgentRegistry");
    const registry = await FCMAgentRegistry.deploy(tokenAddress);
    await registry.waitForDeployment();
    const registryAddress = await registry.getAddress();
    console.log("FCMAgentRegistry deployed to:", registryAddress);

    const FCMTaskMarketplace = await ethers.getContractFactory("FCMTaskMarketplace");
    const marketplace = await FCMTaskMarketplace.deploy(registryAddress);
    await marketplace.waitForDeployment();
    const marketplaceAddress = await marketplace.getAddress();
    console.log("FCMTaskMarketplace deployed to:", marketplaceAddress);

    const MINTER_ROLE = await fcmToken.MINTER_ROLE();
    await (await fcmToken.grantRole(MINTER_ROLE, registryAddress)).wait();
    console.log("Granted MINTER_ROLE to registry");

    const deploymentInfo = {
        network: hre.network.name,
        chainId: hre.network.config.chainId,
        deployer: deployer.address,
        contracts: { FCMToken: tokenAddress, FCMAgentRegistry: registryAddress, FCMTaskMarketplace: marketplaceAddress },
        timestamp: new Date().toISOString(),
    };

    const fs = require("fs");
    fs.mkdirSync("deployments", { recursive: true });
    fs.writeFileSync(`deployments/latest.json`, JSON.stringify(deploymentInfo, null, 2));
    console.log("\n✅ Deployment complete! Saved to deployments/latest.json");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
