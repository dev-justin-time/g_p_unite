#!/usr/bin/env node
/**
 * FCM Agent Example — Working agent that registers, heartbeats, and processes tasks
 *
 * Usage:
 *   node scripts/agent-example.js
 *
 * Environment Variables:
 *   FCM_PRIVATE_KEY    - Agent's private key (0x...)
 *   FCM_RPC_URL        - Blockchain RPC endpoint
 *   FCM_REGISTRY       - FCMAgentRegistry contract address
 *   FCM_TOKEN          - FCMToken contract address
 */

const { AgentRuntime } = require("../lib/agent-runtime");

async function main() {
    // Validate env
    const required = ["FCM_PRIVATE_KEY", "FCM_RPC_URL", "FCM_REGISTRY", "FCM_TOKEN"];
    for (const key of required) {
        if (!process.env[key]) {
            console.error(`Missing required env var: ${key}`);
            process.exit(1);
        }
    }

    // Create agent with a real task processor
    const agent = new AgentRuntime({
        privateKey: process.env.FCM_PRIVATE_KEY,
        rpcUrl: process.env.FCM_RPC_URL,
        registryAddress: process.env.FCM_REGISTRY,
        tokenAddress: process.env.FCM_TOKEN,
        agentType: "inference",
        agentName: "Inference-Router-001",
        capabilities: "gpu,cuda,avx512",
        geohash: "u4pru",

        /**
         * Real task processor — handles inference requests
         * In production, this would load a model and run inference.
         */
        processTask: async (taskId, inputCID) => {
            console.log(`  Processing inference task ${taskId.slice(0, 16)}...`);
            console.log(`  Input CID: ${inputCID}`);

            // Simulate inference processing
            const startTime = Date.now();
            await new Promise(resolve => setTimeout(resolve, 1000));

            const outputCID = "Qm" + Buffer.from(
                `output-${taskId.slice(0, 8)}-${Date.now()}`
            ).toString("hex").slice(0, 44);
            const proofHash = ethers.keccak256(
                ethers.toUtf8Bytes(`proof-${taskId}-${Date.now()}`)
            );

            const elapsed = Date.now() - startTime;
            console.log(`  Inference complete in ${elapsed}ms`);
            console.log(`  Output CID: ${outputCID}`);

            return { outputCID, proofHash };
        },
    });

    console.log("=== FCM Agent Example ===");
    console.log(`Agent: ${agent.address}`);
    console.log(`Type: inference`);
    console.log(`Capabilities: gpu,cuda,avx512`);
    console.log("");

    // Check if already registered
    const active = await agent.isActive();
    if (!active) {
        console.log("Agent not registered. Registering...");
        const stake = ethers.parseEther("500");
        await agent.register(stake);
    } else {
        const rep = await agent.getReputation();
        console.log(`Agent already registered (reputation: ${rep})`);
    }

    // Start runtime (heartbeat every 2 min, listens for tasks)
    console.log("\nStarting agent runtime...");
    await agent.start(120_000);

    // Keep running
    process.on("SIGINT", () => {
        agent.stop();
        process.exit(0);
    });

    console.log("\nAgent is running. Press Ctrl+C to stop.");
}

// Need ethers for the proof hash in processTask
const { ethers } = require("ethers");
main().catch(console.error);
