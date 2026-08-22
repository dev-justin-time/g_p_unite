const { ethers } = require("hardhat");
const fs = require("fs");

const AGENTS = [
    { name: "Inference Router", type: 0, stake: "500", capabilities: "0x01", geohash: "0x7534707275" },
    { name: "Render Splitter", type: 1, stake: "500", capabilities: "0x03", geohash: "0x7534707275" },
    { name: "FL Coordinator", type: 2, stake: "1000", capabilities: "0x05", geohash: "0x7534707275" },
    { name: "Edge Runner", type: 3, stake: "500", capabilities: "0x02", geohash: "0x7534707275" },
    { name: "ZK Prover", type: 4, stake: "750", capabilities: "0x09", geohash: "0x7534707275" },
    { name: "Game Host", type: 5, stake: "500", capabilities: "0x01", geohash: "0x7534707275" },
    { name: "Science Grid", type: 6, stake: "500", capabilities: "0x01", geohash: "0x7534707275" },
    { name: "Privacy Mesh", type: 7, stake: "1000", capabilities: "0x05", geohash: "0x7534707275" },
];

async function main() {
    const deployment = JSON.parse(fs.readFileSync("deployments/latest.json", "utf8"));
    const registry = await ethers.getContractAt("FCMAgentRegistry", deployment.contracts.FCMAgentRegistry);
    const token = await ethers.getContractAt("FCMToken", deployment.contracts.FCMToken);
    const [deployer] = await ethers.getSigners();

    console.log("Registering 8 FCM Expert Agents...\n");

    for (const agent of AGENTS) {
        const didHash = ethers.keccak256(ethers.toUtf8Bytes(agent.name + "-" + Date.now()));
        const stakeAmount = ethers.parseUnits(agent.stake, 18);
        const geohash = ethers.encodeBytes32String("u4pru");
        const capabilities = ethers.encodeBytes32String(agent.capabilities);
        const ipns = `/ipns/k51qzi5uqu5dil0q8${agent.type}`;

        console.log(`Registering ${agent.name}...`);
        await (await token.approve(deployment.contracts.FCMAgentRegistry, stakeAmount)).wait();
        const tx = await registry.registerAgent(didHash, ipns, capabilities, geohash, agent.type);
        await tx.wait();
        console.log(`  ✓ ${agent.name} registered (DID: ${didHash.slice(0, 20)}...)`);
    }
    console.log("\n✅ All 8 agents registered!");
}

main().catch(console.error);
