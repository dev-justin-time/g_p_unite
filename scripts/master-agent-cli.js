#!/usr/bin/env node
/**
 * FCM Master Agent CLI — Interactive command-line interface
 *
 * Usage:
 *   node scripts/master-agent-cli.js                  # Interactive chat mode
 *   node scripts/master-agent-cli.js status            # One-shot status
 *   node scripts/master-agent-cli.js onboard           # Run onboarding wizard
 *   node scripts/master-agent-cli.js resources         # Show system resources
 *   node scripts/master-agent-cli.js register <type>   # Register an agent
 */

const { MasterAgent, AGENT_STATE } = require("../lib/master-agent");
const readline = require("readline");

// ── Colors ──────────────────────────────────────────────────────

const C = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
};

function colorize(text, color) {
    return `${color}${text}${C.reset}`;
}

function printBanner() {
    console.log(`
${colorize("╔══════════════════════════════════════════════════════════╗", C.cyan)}
${colorize("║", C.cyan)}  ${colorize("FCM Master Agent", C.bold + C.white)}                                    ${colorize("║", C.cyan)}
${colorize("║", C.cyan)}  ${colorize("Federated Compute Mesh — blocks.ai Network", C.dim)}       ${colorize("║", C.cyan)}
${colorize("╚══════════════════════════════════════════════════════════╝", C.cyan)}
`);
}

function printStatus(status) {
    const { agents, users, tasks, useCases, system } = status;
    console.log(`
${colorize("═══ System Status ═══", C.bold + C.green)}
  Agents:     ${colorize(`${agents.active}/${agents.total}`, C.cyan)} active
  Users:      ${colorize(`${users.active}/${users.total}`, C.cyan)} registered
  Tasks:      ${colorize(`${tasks.active}`, C.cyan)} active, ${colorize(`${tasks.completed}`, C.green)} completed
  Use Cases:  ${colorize(`${useCases.approved}`, C.green)} approved, ${colorize(`${useCases.pending}`, C.yellow)} pending
  Score:      ${colorize(`${system.score}/100`, C.magenta)}
  Uptime:     ${formatUptime(system.uptime)}
  Address:    ${system.address ? system.address.slice(0, 16) + "..." : "Not configured"}
`);
}

function printResources(profile) {
    const usage = require("../lib/modules/resource-analyzer").ResourceAnalyzer.prototype.getUsage.call({ _cache: profile });
    console.log(`
${colorize("═══ System Resources ═══", C.bold + C.blue)}
  CPU:    ${profile.cpu.cores} cores — ${profile.cpu.model}
          Load: ${profile.cpu.speed}MHz | AVX2: ${profile.cpu.features.avx2 ? "✓" : "✗"} | AVX512: ${profile.cpu.features.avx512 ? "✓" : "✗"}
  RAM:    ${profile.memory.totalGB} GB
  GPU:    ${profile.gpu.length > 0 ? profile.gpu.map(g => `${g.name} (${g.vramGB}GB)`).join(", ") : "None detected"}
  TEE:    ${profile.cpu.hasTEE ? "Available" : "Not available"}
  Caps:   ${profile.capabilities.join(", ") || "none"}
  Score:  ${colorize(`${profile.score}/100`, C.magenta)}
`);
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

// ── Interactive Chat Mode ───────────────────────────────────────

async function interactiveMode(master) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: colorize("fcm> ", C.cyan),
    });

    printBanner();
    console.log(colorize("  Type 'help' for available commands, 'exit' to quit.\n", C.dim));
    rl.prompt();

    rl.on("line", async (line) => {
        const input = line.trim();
        if (!input) { rl.prompt(); return; }
        if (input === "exit" || input === "quit") {
            console.log(colorize("\n  Shutting down...", C.yellow));
            await master.shutdown();
            process.exit(0);
        }

        try {
            const response = await master.chat(input);
            const color = {
                status: C.green, resources: C.blue, help: C.dim,
                error: C.red, warning: C.yellow, success: C.green,
                greeting: C.magenta, info: C.cyan,
            }[response.type] || C.white;

            console.log(`\n${colorize(response.text, color)}\n`);
        } catch (e) {
            console.log(colorize(`\n  Error: ${e.message}\n`, C.red));
        }

        rl.prompt();
    });

    rl.on("close", async () => {
        await master.shutdown();
        process.exit(0);
    });
}

// ── Onboarding Wizard ───────────────────────────────────────────

async function onboardingWizard(master) {
    printBanner();
    console.log(colorize("  === Onboarding Wizard ===\n", C.bold + C.green));

    const readline = require("readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise(resolve => rl.question(colorize(`  ${q}: `, C.cyan), resolve));

    const privateKey = await ask("Private key (or press Enter to generate new)");
    const workloadType = await ask("Workload type (inference/render/edge/science/game/privacy/federated_learning/zk_prover)");
    const agentName = await ask("Agent name (or press Enter for auto)");

    rl.close();

    console.log(colorize("\n  Running onboarding...\n", C.dim));
    const result = await master.onboard(privateKey || undefined, workloadType, agentName || undefined);

    if (result.success) {
        console.log(colorize("  ✓ Onboarding complete!\n", C.green));
        const s = result.summary;
        console.log(`  Address:          ${s.address}`);
        console.log(`  Agent:            ${s.agentName} (${s.agentType})`);
        console.log(`  DID:              ${s.didHash.slice(0, 20)}...`);
        console.log(`  Capabilities:     ${s.capabilities.join(", ")}`);
        console.log(`  Stake Required:   ${s.stakeRequired} FCM`);
        console.log(`  System Score:     ${s.systemScore}/100`);
        console.log(`  Suitable Types:   ${s.suitableWorkloads.join(", ")}`);
    } else {
        console.log(colorize("  ✗ Onboarding failed:\n", C.red));
        for (const step of result.steps) {
            if (step.status === "error" || step.status === "blocked") {
                console.log(colorize(`    ${step.message}`, C.red));
            }
        }
    }
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
    const master = new MasterAgent();

    // Initialize
    try {
        await master.initialize();
    } catch (e) {
        console.error(colorize(`\n  Initialization failed: ${e.message}`, C.red));
        console.error(colorize("  Continuing in offline mode...\n", C.yellow));
    }

    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
        case "status": {
            const status = master.getFullStatus();
            printStatus(status);
            break;
        }

        case "resources": {
            const profile = await master.resourceAnalyzer.analyze();
            printResources(profile);
            break;
        }

        case "onboard": {
            await onboardingWizard(master);
            break;
        }

        case "register": {
            const type = args[1];
            if (!type) {
                console.log(colorize("\n  Usage: master-agent-cli.js register <type>", C.yellow));
                console.log(colorize("  Types: inference, render, edge, science, game, privacy, federated_learning, zk_prover\n", C.dim));
                break;
            }
            const result = await master.registerAgent({
                workloadType: type,
                agentName: args[2] || `agent-${type}`,
            });
            console.log(colorize(`\n  ${result.message}\n`, result.success ? C.green : C.red));
            break;
        }

        case "start": {
            const id = args[1] || "agent-1";
            const result = await master.startAgent(id);
            console.log(colorize(`\n  ${result.message}\n`, result.success ? C.green : C.red));
            break;
        }

        case "stop": {
            const id = args[1] || "agent-1";
            const result = await master.stopAgent(id);
            console.log(colorize(`\n  ${result.message}\n`, result.success ? C.green : C.red));
            break;
        }

        case "help": {
            printBanner();
            console.log(`  Usage:
    master-agent-cli.js                    Interactive chat mode
    master-agent-cli.js status             Show system status
    master-agent-cli.js resources          Show system resources
    master-agent-cli.js onboard            Run onboarding wizard
    master-agent-cli.js register <type>    Register an agent
    master-agent-cli.js start [id]         Start an agent
    master-agent-cli.js stop [id]          Stop an agent
    master-agent-cli.js help               Show this help

  Workload Types:
    inference            AI model inference routing
    render               Distributed rendering
    federated_learning   Privacy-preserving ML training
    edge                 WASM edge computing
    zk_prover            Zero-knowledge proof generation
    game                 Real-time game server hosting
    science              Scientific computing grid
    privacy              Mixnet privacy infrastructure
    node                 General compute node tasks
    storage              IPFS content storage provider
    file_server          HTTP file hosting server
    rewarded             Reward-earning bounty tasks
`);
            break;
        }

        default: {
            // Interactive chat mode
            await interactiveMode(master);
            break;
        }
    }
}

main().catch(e => {
    console.error(colorize(`\nFatal: ${e.message}`, C.red));
    process.exit(1);
});
