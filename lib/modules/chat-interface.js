/**
 * ChatInterface — Natural language command processing and conversational agent
 *
 * Parses user commands, routes to appropriate handlers, and generates
 * human-readable responses. Supports both CLI and programmatic usage.
 */

const { ethers } = require("ethers");

// ── Command Definitions ──────────────────────────────────────────

const COMMANDS = {
    // System
    "status":       { handler: "handleStatus",     help: "Show system status and agent health" },
    "resources":    { handler: "handleResources",   help: "Show system resource analysis" },
    "help":         { handler: "handleHelp",         help: "Show available commands" },

    // Agent management
    "agents":       { handler: "handleAgents",      help: "List all registered agents" },
    "register":     { handler: "handleRegister",     help: "Register a new agent: register <type> [name]" },
    "start":        { handler: "handleStart",        help: "Start an agent: start <agent-id>" },
    "stop":         { handler: "handleStop",         help: "Stop an agent: stop <agent-id>" },

    // Tasks
    "tasks":        { handler: "handleTasks",        help: "List active tasks" },
    "submit":       { handler: "handleSubmit",       help: "Submit a task: submit <use-case-id> <input>" },
    "claim":        { handler: "handleClaim",        help: "Claim a task: claim <task-id>" },

    // Permissions
    "users":        { handler: "handleUsers",        help: "List all users and roles" },
    "grant":        { handler: "handleGrant",        help: "Grant permission: grant <address> <permission>" },
    "ban":          { handler: "handleBan",          help: "Ban a user: ban <address> [reason]" },

    // Use cases
    "usecases":     { handler: "handleUseCases",     help: "List use cases" },
    "approve":      { handler: "handleApprove",      help: "Approve a use case: approve <use-case-id>" },
    "reject":       { handler: "handleReject",       help: "Reject a use case: reject <use-case-id> [reason]" },

    // Settings
    "settings":     { handler: "handleSettings",     help: "View or update settings" },
    "set":          { handler: "handleSet",          help: "Set a setting: set <key> <value>" },

    // Financial
    "balance":      { handler: "handleBalance",      help: "Check FCM token balance" },
    "stake":        { handler: "handleStake",        help: "Stake tokens: stake <amount>" },
    "earnings":     { handler: "handleEarnings",     help: "Show estimated earnings per workload type" },
    "bounties":     { handler: "handleBounties",     help: "List available reward bounties" },
    "claim-bounty": { handler: "handleClaimBounty",  help: "Claim a bounty: claim-bounty <bounty-id>" },

    // Storage & Files
    "storage":      { handler: "handleStorage",      help: "Show storage provider status" },
    "pin":          { handler: "handlePin",          help: "Pin content to storage: pin <cid>" },
    "files":        { handler: "handleFiles",        help: "List served files" },
    "serve":        { handler: "handleServe",        help: "Start file server: serve <directory>" },

    // Node
    "node":         { handler: "handleNode",         help: "Show compute node status" },
    "tasks-available": { handler: "handleAvailableTasks", help: "List all available task types" },

    // Network
    "heartbeat":    { handler: "handleHeartbeat",    help: "Submit a heartbeat for all active agents" },
    "network":      { handler: "handleNetwork",      help: "Show network topology and peers" },
};

class ChatInterface {
    constructor(masterAgent) {
        this.master = masterAgent;
        this.history = [];
        this.maxHistory = 100;
    }

    /**
     * Process a user message and return a response
     */
    async processMessage(message) {
        const trimmed = message.trim();
        if (!trimmed) return { text: "Empty message. Type 'help' for available commands.", type: "info" };

        // Record history
        this.history.push({ role: "user", text: trimmed, time: new Date().toISOString() });
        if (this.history.length > this.maxHistory) this.history.shift();

        // Parse command
        const parts = trimmed.split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);

        // Route to handler
        const commandDef = COMMANDS[cmd];
        if (!commandDef) {
            // Try natural language understanding
            const nlResponse = await this._naturalLanguageHandler(trimmed);
            if (nlResponse) return nlResponse;

            return {
                text: `Unknown command: "${cmd}". Type 'help' for available commands.`,
                type: "error",
            };
        }

        try {
            const handler = this[commandDef.handler];
            if (!handler) {
                return { text: `Handler not implemented: ${commandDef.handler}`, type: "error" };
            }
            const response = await handler.call(this, args);
            this.history.push({ role: "agent", text: response.text, time: new Date().toISOString() });
            return response;
        } catch (e) {
            const errResponse = { text: `Error: ${e.message}`, type: "error" };
            this.history.push({ role: "agent", text: errResponse.text, time: new Date().toISOString() });
            return errResponse;
        }
    }

    // ── Command Handlers ────────────────────────────────────────

    async handleStatus(args) {
        const summary = this.master.getFullStatus();
        const lines = [
            `═══ FCM Master Agent Status ═══`,
            ``,
            `Agents:     ${summary.agents.active}/${summary.agents.total} active`,
            `Users:      ${summary.users.active}/${summary.users.total} registered`,
            `Tasks:      ${summary.tasks.active} active, ${summary.tasks.completed} completed`,
            `Use Cases:  ${summary.useCases.approved} approved, ${summary.useCases.pending} pending`,
            `System:     ${summary.system.online ? "● Online" : "○ Offline"}`,
            `Uptime:     ${this._formatUptime(summary.system.uptime)}`,
            `Score:      ${summary.system.score}/100`,
        ];
        return { text: lines.join("\n"), type: "status" };
    }

    async handleResources(args) {
        const usage = this.master.resourceAnalyzer.getUsage();
        const profile = this.master.resourceAnalyzer._cache;
        const lines = [
            `═══ System Resources ═══`,
            ``,
            `CPU:    ${usage.cpu.cores} cores — ${usage.cpu.model}`,
            `        Load: ${usage.cpu.loadAvg["1m"].toFixed(2)} (${usage.cpu.usagePercent}%)`,
            `RAM:    ${usage.memory.usedGB}/${usage.memory.totalGB} GB (${usage.memory.usagePercent}%)`,
            `Uptime: ${this._formatUptime(usage.uptime)}`,
            ``,
            `GPU:    ${profile?.gpu?.length ? profile.gpu.map(g => `${g.name} (${g.vramGB}GB)`).join(", ") : "None detected"}`,
            `Caps:   ${profile?.capabilities?.join(", ") || "none"}`,
            `Score:  ${profile?.score || 0}/100`,
        ];
        return { text: lines.join("\n"), type: "resources" };
    }

    async handleHelp(args) {
        const lines = [`═══ Available Commands ═══`, ``];
        for (const [cmd, def] of Object.entries(COMMANDS)) {
            lines.push(`  ${cmd.padEnd(12)} ${def.help}`);
        }
        lines.push(``, `Type any command without arguments for usage info.`);
        return { text: lines.join("\n"), type: "help" };
    }

    async handleAgents(args) {
        const agents = this.master.getAgents();
        if (agents.length === 0) {
            return { text: "No agents registered. Use 'register <type> [name]' to create one.", type: "info" };
        }
        const lines = [`═══ Registered Agents (${agents.length}) ═══`, ``];
        for (const a of agents) {
            const status = a.active ? "●" : "○";
            lines.push(`  ${status} ${a.name} (${a.type}) — ${a.capabilities.join(", ")}`);
            lines.push(`    DID: ${a.didHash.slice(0, 20)}... | Stake: ${a.stake} FCM`);
        }
        return { text: lines.join("\n"), type: "agents" };
    }

    async handleRegister(args) {
        if (args.length < 1) {
            return { text: "Usage: register <type> [name]\nTypes: inference, render, federated_learning, edge, zk_prover, game, science, privacy", type: "info" };
        }
        const result = await this.master.registerAgent({
            workloadType: args[0],
            agentName: args[1] || `agent-${args[0]}-${Date.now().toString(36)}`,
        });
        return { text: result.message, type: result.success ? "success" : "error" };
    }

    async handleStart(args) {
        if (args.length < 1) return { text: "Usage: start <agent-id>", type: "info" };
        const result = await this.master.startAgent(args[0]);
        return { text: result.message, type: result.success ? "success" : "error" };
    }

    async handleStop(args) {
        if (args.length < 1) return { text: "Usage: stop <agent-id>", type: "info" };
        const result = await this.master.stopAgent(args[0]);
        return { text: result.message, type: result.success ? "success" : "error" };
    }

    async handleTasks(args) {
        const tasks = this.master.getActiveTasks();
        if (tasks.length === 0) {
            return { text: "No active tasks.", type: "info" };
        }
        const lines = [`═══ Active Tasks (${tasks.length}) ═══`, ``];
        for (const t of tasks) {
            lines.push(`  ${t.id.slice(0, 16)}... | ${t.type} | ${t.status} | Reward: ${t.reward}`);
        }
        return { text: lines.join("\n"), type: "tasks" };
    }

    async handleSubmit(args) {
        if (args.length < 1) return { text: "Usage: submit <use-case-id> [input]", type: "info" };
        const result = this.master.submitWorkload(args[0], { input: args.slice(1).join(" ") });
        return { text: result.message, type: result.status === "submitted" ? "success" : "error" };
    }

    async handleClaim(args) {
        if (args.length < 1) return { text: "Usage: claim <task-id>", type: "info" };
        const result = await this.master.claimTask(args[0]);
        return { text: result.message, type: result.success ? "success" : "error" };
    }

    async handleUsers(args) {
        const summary = this.master.permissionManager.getNetworkSummary();
        const lines = [
            `═══ Network Users ═══`,
            ``,
            `Total: ${summary.totalUsers} (${summary.activeUsers} active, ${summary.bannedUsers} banned)`,
            ``,
            `Roles:`,
        ];
        for (const [role, count] of Object.entries(summary.roleBreakdown)) {
            if (count > 0) lines.push(`  ${role}: ${count}`);
        }
        return { text: lines.join("\n"), type: "users" };
    }

    async handleGrant(args) {
        if (args.length < 2) return { text: "Usage: grant <address> <permission>", type: "info" };
        this.master.permissionManager.grantPermission(args[0], args[1]);
        return { text: `Granted "${args[1]}" to ${args[0].slice(0, 12)}...`, type: "success" };
    }

    async handleBan(args) {
        if (args.length < 1) return { text: "Usage: ban <address> [reason]", type: "info" };
        this.master.permissionManager.banUser(args[0], args.slice(1).join(" ") || "Banned by admin");
        return { text: `User ${args[0].slice(0, 12)}... has been banned.`, type: "warning" };
    }

    async handleUseCases(args) {
        const summary = this.master.useCaseManager.getSummary();
        const lines = [
            `═══ Use Cases ═══`,
            ``,
            `Total: ${summary.useCases.total}`,
            `  Pending:   ${summary.useCases.pending}`,
            `  Approved:  ${summary.useCases.approved}`,
            `  Rejected:  ${summary.useCases.rejected}`,
            ``,
            `Workloads:`,
            `  Active:    ${summary.workloads.active}`,
            `  Completed: ${summary.workloads.completed}`,
            `  Failed:    ${summary.workloads.failed}`,
        ];
        return { text: lines.join("\n"), type: "usecases" };
    }

    async handleApprove(args) {
        if (args.length < 1) return { text: "Usage: approve <use-case-id>", type: "info" };
        const result = this.master.useCaseManager.approveUseCase(args[0], this.master.adminAddress);
        return { text: result.message || `Use case ${args[0]} approved.`, type: "success" };
    }

    async handleReject(args) {
        if (args.length < 1) return { text: "Usage: reject <use-case-id> [reason]", type: "info" };
        const result = this.master.useCaseManager.rejectUseCase(args[0], this.master.adminAddress, args.slice(1).join(" ") || "Rejected by admin");
        return { text: `Use case ${args[0]} rejected.`, type: "warning" };
    }

    async handleSettings(args) {
        const settings = this.master.settingsManager.getAll();
        const lines = [`═══ Settings ═══`, ``];
        for (const [key, value] of Object.entries(settings)) {
            lines.push(`  ${key}: ${JSON.stringify(value)}`);
        }
        return { text: lines.join("\n"), type: "settings" };
    }

    async handleSet(args) {
        if (args.length < 2) return { text: "Usage: set <key> <value>", type: "info" };
        const key = args[0];
        let value = args.slice(1).join(" ");
        // Parse common types
        if (value === "true") value = true;
        else if (value === "false") value = false;
        else if (!isNaN(value) && value !== "") value = Number(value);
        this.master.settingsManager.set(key, value);
        return { text: `Setting "${key}" = ${JSON.stringify(value)}`, type: "success" };
    }

    async handleBalance(args) {
        if (!this.master.wallet) return { text: "No wallet configured. Set FCM_PRIVATE_KEY.", type: "error" };
        const balance = await this.master.tokenContract?.balanceOf(this.master.wallet.address);
        const formatted = balance ? ethers.formatEther(balance) : "0";
        return { text: `FCM Balance: ${formatted} FCM`, type: "balance" };
    }

    async handleStake(args) {
        if (args.length < 1) return { text: "Usage: stake <amount>", type: "info" };
        const amount = ethers.parseEther(args[0]);
        const result = await this.master.stakeTokens(amount);
        return { text: result.message, type: result.success ? "success" : "error" };
    }

    async handleHeartbeat(args) {
        const results = await this.master.submitAllHeartbeats();
        return { text: `Heartbeat sent for ${results.sent}/${results.total} agents.`, type: "heartbeat" };
    }

    async handleNetwork(args) {
        const lines = [
            `═══ Network Topology ═══`,
            ``,
            `Registry: ${this.master.registryAddress || "Not configured"}`,
            `Token:    ${this.master.tokenAddress || "Not configured"}`,
            `RPC:      ${this.master.rpcUrl || "Not configured"}`,
            `Agents:   ${this.master.getAgents().filter(a => a.active).length} active`,
        ];
        return { text: lines.join("\n"), type: "network" };
    }

    async handleEarnings(args) {
        const lines = [
            `═══ Estimated Earnings ═══`,
            ``,
            `  AI Inference:       2.5 FCM/hr  |  0.01-0.5 FCM/task`,
            `  Rendering:          0.5-2.0 FCM/frame  |  50-500 FCM/job`,
            `  Federated Learning: 10-50 FCM/round`,
            `  Edge Computing:     0.5-2.0 FCM/hr  |  0.001-0.01 FCM/req`,
            `  ZK Proving:         0.04-0.2 FCM/proof`,
            `  Game Server:        1.0-5.0 FCM/hr  |  0.1 FCM/player`,
            `  Science Grid:       1.0-5.0 FCM/hr  |  5-50 FCM/job`,
            `  Privacy Relay:      0.001 FCM/relay  |  0.1 FCM/GB`,
            `  ─────────────────────────────────`,
            `  Compute Node:       0.5-2.0 FCM/hr  |  0.1-1.0 FCM/task`,
            `  Storage Provider:   0.05 FCM/GB/month  |  0.01 FCM/pin`,
            `  File Server:        0.02 FCM/GB  |  0.001 FCM/request`,
            `  Reward Bounties:    1-1000 FCM (varies by bounty)`,
        ];
        return { text: lines.join("\n"), type: "earnings" };
    }

    async handleBounties(args) {
        const lines = [
            `═══ Available Reward Bounties ═══`,
            ``,
            `  🔧 Compute Bounties:`,
            `     • Data processing jobs (1-50 FCM)`,
            `     • Model fine-tuning tasks (10-100 FCM)`,
            `     • Code compilation tasks (0.5-5 FCM)`,
            ``,
            `  💾 Storage Bounties:`,
            `     • Pin public datasets (0.01-0.1 FCM/GB)`,
            `     • Mirror critical data (0.05 FCM/GB)`,
            `     • Backup hosting (0.02 FCM/GB/month)`,
            ``,
            `  📁 File Server Bounties:`,
            `     • Host open-source packages (0.001-0.01 FCM/request)`,
            `     • CDN edge caching (0.005 FCM/GB served)`,
            `     • Static site hosting (0.1 FCM/day)`,
            ``,
            `  🖥️ Node Bounties:`,
            `     • Validation tasks (0.1-1 FCM/task)`,
            `     • Health monitoring (0.5 FCM/hr)`,
            `     • Network relay (0.01 FCM/connection)`,
            ``,
            `  Use 'claim-bounty <id>' to accept a bounty.`,
        ];
        return { text: lines.join("\n"), type: "bounties" };
    }

    async handleClaimBounty(args) {
        if (args.length < 1) return { text: "Usage: claim-bounty <bounty-id>", type: "info" };
        return { text: `Bounty ${args[0]} claimed! Processing...`, type: "success" };
    }

    async handleStorage(args) {
        const agents = this.master.getAgents().filter(a => a.type === "storage" || a.type === "file_server");
        const lines = [
            `═══ Storage Providers ═══`,
            ``,
            `  Active providers: ${agents.length}`,
            ``,
        ];
        if (agents.length === 0) {
            lines.push(`  No storage agents registered.`, `  Run 'register storage <name>' to become a provider.`);
        } else {
            for (const a of agents) {
                lines.push(`  ● ${a.name} (${a.type}) — ${a.capabilities.join(", ")}`);
            }
        }
        lines.push(``, `  Commands: pin <cid> — Pin content to IPFS`);
        return { text: lines.join("\n"), type: "storage" };
    }

    async handlePin(args) {
        if (args.length < 1) return { text: "Usage: pin <cid>", type: "info" };
        return { text: `Pinning ${args[0]} to storage network...`, type: "success" };
    }

    async handleFiles(args) {
        const agents = this.master.getAgents().filter(a => a.type === "file_server");
        const lines = [
            `═══ File Servers ═══`,
            ``,
            `  Active servers: ${agents.length}`,
            ``,
        ];
        if (agents.length === 0) {
            lines.push(`  No file servers registered.`, `  Run 'register file_server <name>' to host files.`);
        } else {
            for (const a of agents) {
                lines.push(`  ● ${a.name} — ${a.capabilities.join(", ")}`);
            }
        }
        lines.push(``, `  Commands: serve <dir> — Start hosting a directory`);
        return { text: lines.join("\n"), type: "files" };
    }

    async handleServe(args) {
        if (args.length < 1) return { text: "Usage: serve <directory>", type: "info" };
        return { text: `Starting file server for: ${args[0]}`, type: "success" };
    }

    async handleNode(args) {
        const agents = this.master.getAgents().filter(a => a.type === "node" || a.type === "rewarded");
        const usage = this.master.resourceAnalyzer.getUsage();
        const lines = [
            `═══ Compute Node Status ═══`,
            ``,
            `  CPU:    ${usage.cpu.cores} cores (${usage.cpu.usagePercent}% load)`,
            `  RAM:    ${usage.memory.usedGB}/${usage.memory.totalGB} GB (${usage.memory.usagePercent}%)`,
            `  Active nodes: ${agents.length}`,
            ``,
        ];
        if (agents.length === 0) {
            lines.push(`  No compute nodes registered.`, `  Run 'register node <name>' to join the network.`);
        } else {
            for (const a of agents) {
                lines.push(`  ● ${a.name} (${a.state}) — ${a.capabilities.join(", ")}`);
            }
        }
        lines.push(``, `  Tasks available: AI, render, edge, science, storage, files, bounties`);
        return { text: lines.join("\n"), type: "node" };
    }

    async handleAvailableTasks(args) {
        const lines = [
            `═══ Available Task Types ═══`,
            ``,
            `  🤖 AI/ML Tasks:`,
            `     inference       — Model inference routing (GPU required)`,
            `     federated_learning — Privacy-preserving ML training (TEE required)`,
            `     zk_prover       — Zero-knowledge proof generation (GPU required)`,
            ``,
            `  🎨 Creative Tasks:`,
            `     render          — Distributed rendering (GPU required)`,
            `     game            — Real-time game server hosting (GPU preferred)`,
            ``,
            `  📊 Compute Tasks:`,
            `     edge            — WASM edge computing (any device)`,
            `     science         — Scientific computing grid (high CPU)`,
            `     node            — General compute node tasks (any device)`,
            `     rewarded        — Reward-earning bounty tasks (any device)`,
            ``,
            `  💾 Storage Tasks:`,
            `     storage         — IPFS content storage (needs disk space)`,
            `     file_server     — HTTP file hosting (needs disk + bandwidth)`,
            ``,
            `  🔒 Privacy Tasks:`,
            `     privacy         — Mixnet relay routing (TEE required)`,
            ``,
            `  Use 'register <type> <name>' to start accepting tasks.`,
        ];
        return { text: lines.join("\n"), type: "tasks-available" };
    }

    // ── Natural Language Handler ─────────────────────────────────

    async _naturalLanguageHandler(message) {
        const lower = message.toLowerCase();

        // Greetings
        if (/^(hi|hello|hey|howdy|greetings)/i.test(lower)) {
            return { text: "Hello! I'm the FCM Master Agent. Type 'help' to see what I can do.", type: "greeting" };
        }

        // Status queries
        if (/status|how.*doing|health|online/i.test(lower)) {
            return await this.handleStatus([]);
        }

        // Resource queries
        if (/resource|hardware|cpu|gpu|ram|memory|system/i.test(lower)) {
            return await this.handleResources([]);
        }

        // Agent queries
        if (/agent|node|worker/i.test(lower)) {
            return await this.handleAgents([]);
        }

        // Task queries
        if (/task|job|workload/i.test(lower)) {
            return await this.handleTasks([]);
        }

        // Use case queries
        if (/use.?case|approval|approved/i.test(lower)) {
            return await this.handleUseCases([]);
        }

        // Thanks
        if (/thank|thanks|thx/i.test(lower)) {
            return { text: "You're welcome! Let me know if you need anything else.", type: "greeting" };
        }

        return null;
    }

    // ── Helpers ─────────────────────────────────────────────────

    _formatUptime(seconds) {
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (d > 0) return `${d}d ${h}h ${m}m`;
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    }

    /**
     * Get command list for autocomplete
     */
    getCommandList() {
        return Object.entries(COMMANDS).map(([cmd, def]) => ({
            command: cmd,
            help: def.help,
        }));
    }
}

module.exports = { ChatInterface, COMMANDS };
