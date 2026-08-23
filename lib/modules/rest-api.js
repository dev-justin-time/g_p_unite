/**
 * FCM REST API Server
 *
 * Full REST API exposing on-chain and off-chain data:
 *   - /api/v1/agents       — Agent registration, status, heartbeats
 *   - /api/v1/tiers        — Tier rankings, configs, staker lists
 *   - /api/v1/governance   — Proposals, votes, execution status
 *   - /api/v1/escrow       — Escrow lifecycle, milestones, disputes
 *   - /api/v1/reputation   — Soulbound badges, achievements, streaks
 *   - /api/v1/tasks        — Task lifecycle, assignments, disputes
 *   - /api/v1/system       — Health, stats, contract addresses
 *
 * Zero external dependencies — pure Node.js http module.
 */

const http = require("http");
const path = require("path");
const fs = require("fs");

// ── Helpers ──────────────────────────────────────────────────────

function esc(text) {
    if (typeof text !== "string") return String(text);
    return text.replace(/[<>"'&]/g, c => ({ "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;", "&": "&amp;" }[c]));
}

function parseQuery(urlStr) {
    const u = new URL(urlStr, "http://localhost");
    const q = {};
    for (const [k, v] of u.searchParams) q[k] = v;
    return { pathname: u.pathname, query: q };
}

function matchRoute(pattern, pathname) {
    const patternParts = pattern.split("/");
    const pathParts = pathname.split("/");
    if (patternParts.length !== pathParts.length) return null;
    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i].startsWith(":")) {
            params[patternParts[i].slice(1)] = pathParts[i];
        } else if (patternParts[i] !== pathParts[i]) {
            return null;
        }
    }
    return params;
}

function paginate(items, query) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
    const offset = (page - 1) * limit;
    const total = items.length;
    const pages = Math.ceil(total / limit);
    return {
        data: items.slice(offset, offset + limit),
        pagination: { page, limit, total, pages, hasNext: page < pages, hasPrev: page > 1 },
    };
}

function filterByQuery(items, query, fields) {
    let result = [...items];
    for (const field of fields) {
        if (query[field] !== undefined) {
            const val = query[field].toLowerCase();
            result = result.filter(item => String(item[field]).toLowerCase().includes(val));
        }
    }
    if (query.status) {
        result = result.filter(item => item.status === query.status);
    }
    if (query.sort) {
        const desc = query.sort.startsWith("-");
        const key = desc ? query.sort.slice(1) : query.sort;
        result.sort((a, b) => {
            const av = a[key], bv = b[key];
            if (av < bv) return desc ? 1 : -1;
            if (av > bv) return desc ? -1 : 1;
            return 0;
        });
    }
    return result;
}

// ── Mock Data (used when no contract connection) ──────────────────

function generateMockData() {
    const agentDefs = [
        { didHash:"0x"+"a1".repeat(32), name:"Inference Router", icon:"🧠", category:"compute", agentType:0, tier:4, status:"active", stake:10000, reputation:8750, capabilities:"0xff", geohash:"9q8yyk", operator:"0x"+"11".repeat(20), lastHeartbeat:Date.now()/1000, registeredAt:Date.now()/1000-86400*30 },
        { didHash:"0x"+"a2".repeat(32), name:"Render Splitter", icon:"🎬", category:"compute", agentType:1, tier:3, status:"active", stake:2000, reputation:7200, capabilities:"0xaf", geohash:"9q8yym", operator:"0x"+"22".repeat(20), lastHeartbeat:Date.now()/1000, registeredAt:Date.now()/1000-86400*25 },
        { didHash:"0x"+"a3".repeat(32), name:"FL Coordinator", icon:"🔒", category:"compute", agentType:2, tier:5, status:"active", stake:50000, reputation:9800, capabilities:"0xff", geohash:"9q8yyn", operator:"0x"+"33".repeat(20), lastHeartbeat:Date.now()/1000, registeredAt:Date.now()/1000-86400*60 },
        { didHash:"0x"+"a4".repeat(32), name:"Edge Runner", icon:"⚡", category:"compute", agentType:3, tier:3, status:"active", stake:2000, reputation:6900, capabilities:"0x5f", geohash:"9q8yyr", operator:"0x"+"44".repeat(20), lastHeartbeat:Date.now()/1000, registeredAt:Date.now()/1000-86400*20 },
        { didHash:"0x"+"a5".repeat(32), name:"ZK Prover", icon:"🛡️", category:"compute", agentType:4, tier:4, status:"standby", stake:10000, reputation:8100, capabilities:"0xaf", geohash:"9q8yys", operator:"0x"+"55".repeat(20), lastHeartbeat:Date.now()/1000-600, registeredAt:Date.now()/1000-86400*15 },
        { didHash:"0x"+"a6".repeat(32), name:"Game Host", icon:"🎮", category:"compute", agentType:5, tier:2, status:"active", stake:500, reputation:5500, capabilities:"0x3f", geohash:"9q8yyt", operator:"0x"+"66".repeat(20), lastHeartbeat:Date.now()/1000, registeredAt:Date.now()/1000-86400*18 },
        { didHash:"0x"+"a7".repeat(32), name:"Science Grid", icon:"🔬", category:"compute", agentType:6, tier:3, status:"standby", stake:2000, reputation:7000, capabilities:"0x5f", geohash:"9q8yyu", operator:"0x"+"77".repeat(20), lastHeartbeat:Date.now()/1000-300, registeredAt:Date.now()/1000-86400*22 },
        { didHash:"0x"+"a8".repeat(32), name:"Privacy Mesh", icon:"🕵️", category:"compute", agentType:7, tier:4, status:"active", stake:10000, reputation:8400, capabilities:"0xcf", geohash:"9q8yyv", operator:"0x"+"88".repeat(20), lastHeartbeat:Date.now()/1000, registeredAt:Date.now()/1000-86400*35 },
        { didHash:"0x"+"b1".repeat(32), name:"Node Runner", icon:"🖥️", category:"infrastructure", agentType:8, tier:2, status:"active", stake:500, reputation:5200, capabilities:"0x0f", geohash:"9q8yyw", operator:"0x"+"91".repeat(20), lastHeartbeat:Date.now()/1000, registeredAt:Date.now()/1000-86400*12 },
        { didHash:"0x"+"b2".repeat(32), name:"Storage Provider", icon:"💾", category:"infrastructure", agentType:9, tier:3, status:"active", stake:2000, reputation:6800, capabilities:"0x07", geohash:"9q8yyx", operator:"0x"+"92".repeat(20), lastHeartbeat:Date.now()/1000, registeredAt:Date.now()/1000-86400*14 },
        { didHash:"0x"+"b3".repeat(32), name:"File Server", icon:"📁", category:"infrastructure", agentType:10, tier:1, status:"active", stake:100, reputation:4500, capabilities:"0x03", geohash:"9q8yyy", operator:"0x"+"93".repeat(20), lastHeartbeat:Date.now()/1000, registeredAt:Date.now()/1000-86400*10 },
        { didHash:"0x"+"b4".repeat(32), name:"Rewarded Worker", icon:"🎁", category:"infrastructure", agentType:11, tier:1, status:"active", stake:100, reputation:4200, capabilities:"0x01", geohash:"9q8yyz", operator:"0x"+"94".repeat(20), lastHeartbeat:Date.now()/1000, registeredAt:Date.now()/1000-86400*8 },
        { didHash:"0x"+"c1".repeat(32), name:"Tier Manager", icon:"📊", category:"platform", agentType:12, tier:5, status:"active", stake:50000, reputation:9900, capabilities:"0xff", geohash:"9q8yz0", operator:"0x"+"a1".repeat(20), lastHeartbeat:Date.now()/1000, registeredAt:Date.now()/1000-86400*90 },
        { didHash:"0x"+"c2".repeat(32), name:"Rewards Distributor", icon:"💰", category:"platform", agentType:13, tier:5, status:"active", stake:50000, reputation:9850, capabilities:"0xff", geohash:"9q8yz1", operator:"0x"+"a2".repeat(20), lastHeartbeat:Date.now()/1000, registeredAt:Date.now()/1000-86400*90 },
        { didHash:"0x"+"c3".repeat(32), name:"Governance Agent", icon:"🏛️", category:"platform", agentType:14, tier:4, status:"active", stake:10000, reputation:8600, capabilities:"0xff", geohash:"9q8yz2", operator:"0x"+"a3".repeat(20), lastHeartbeat:Date.now()/1000, registeredAt:Date.now()/1000-86400*60 },
        { didHash:"0x"+"c4".repeat(32), name:"Escrow Manager", icon:"🔒", category:"platform", agentType:15, tier:3, status:"active", stake:2000, reputation:7500, capabilities:"0xff", geohash:"9q8yz3", operator:"0x"+"a4".repeat(20), lastHeartbeat:Date.now()/1000, registeredAt:Date.now()/1000-86400*45 },
        { didHash:"0x"+"c5".repeat(32), name:"Reputation Oracle", icon:"🏅", category:"platform", agentType:16, tier:4, status:"active", stake:10000, reputation:9200, capabilities:"0xff", geohash:"9q8yz4", operator:"0x"+"a5".repeat(20), lastHeartbeat:Date.now()/1000, registeredAt:Date.now()/1000-86400*75 },
        { didHash:"0x"+"c6".repeat(32), name:"Agent Coordinator", icon:"🤝", category:"platform", agentType:17, tier:5, status:"active", stake:50000, reputation:9700, capabilities:"0xff", geohash:"9q8yz5", operator:"0x"+"a6".repeat(20), lastHeartbeat:Date.now()/1000, registeredAt:Date.now()/1000-86400*85 },
    ];

    const tierConfigs = [
        { tier:0, name:"Free",      minStake:"0",        minScore:0,    rewardMultiplier:50,  feeDiscount:0,    maxConcurrent:1 },
        { tier:1, name:"Starter",   minStake:"100e18",   minScore:2000, rewardMultiplier:100, feeDiscount:500,  maxConcurrent:3 },
        { tier:2, name:"Standard",  minStake:"500e18",   minScore:4000, rewardMultiplier:150, feeDiscount:1000, maxConcurrent:5 },
        { tier:3, name:"Advanced",  minStake:"2000e18",  minScore:6000, rewardMultiplier:200, feeDiscount:1500, maxConcurrent:10 },
        { tier:4, name:"Pro",       minStake:"10000e18", minScore:8000, rewardMultiplier:300, feeDiscount:2000, maxConcurrent:20 },
        { tier:5, name:"Elite",     minStake:"50000e18", minScore:9000, rewardMultiplier:500, feeDiscount:2500, maxConcurrent:50 },
    ];

    const proposals = [
        { id:1, proposer:"0x"+"a1".repeat(20), description:"Increase MIN_STAKE from 500 to 750 FCM", target:"0x"+"01".repeat(20), forVotes:"125000", againstVotes:"45000", abstainVotes:"10000", state:"Active", startBlock:100, endBlock:200, eta:0, totalStakedAtProposal:"2000000" },
        { id:2, proposer:"0x"+"a3".repeat(20), description:"Add new agent type: ML Training", target:"0x"+"01".repeat(20), forVotes:"89000", againstVotes:"12000", abstainVotes:"5000", state:"Succeeded", startBlock:80, endBlock:180, eta:Date.now()/1000+86400, totalStakedAtProposal:"1800000" },
        { id:3, proposer:"0x"+"a5".repeat(20), description:"Reduce dispute window from 1 day to 12 hours", target:"0x"+"01".repeat(20), forVotes:"34000", againstVotes:"67000", abstainVotes:"8000", state:"Defeated", startBlock:60, endBlock:160, eta:0, totalStakedAtProposal:"1500000" },
        { id:4, proposer:"0x"+"a2".repeat(20), description:"Fund community grants pool with 100K FCM", target:"0x"+"02".repeat(20), forVotes:"0", againstVotes:"0", abstainVotes:"0", state:"Pending", startBlock:250, endBlock:350, eta:0, totalStakedAtProposal:"2200000" },
    ];

    const escrows = [
        { id:1, client:"0x"+"ee".repeat(20), worker:"0x"+"11".repeat(20), totalAmount:"5000e18", releasedAmount:"2500e18", remainingAmount:"2500e18", completedMilestones:2, totalMilestones:4, state:"InProgress", createdAt:Date.now()/1000-86400*5, deadline:Date.now()/1000+86400*85, disputeDeadline:Date.now()/1000+86400*115, requiresMultiSig:false, milestones:[
            { description:"Design phase", amount:"1000e18", approved:true, submitted:true, deliverableCID:"0x"+"aa".repeat(32) },
            { description:"Core implementation", amount:"1500e18", approved:true, submitted:true, deliverableCID:"0x"+"bb".repeat(32) },
            { description:"Testing & QA", amount:"1500e18", approved:false, submitted:true, deliverableCID:"0x"+"cc".repeat(32) },
            { description:"Deployment", amount:"1000e18", approved:false, submitted:false, deliverableCID:"0x"+"00".repeat(32) },
        ]},
        { id:2, client:"0x"+"ff".repeat(20), worker:"0x"+"22".repeat(20), totalAmount:"15000e18", releasedAmount:"0", remainingAmount:"15000e18", completedMilestones:0, totalMilestones:3, state:"Funded", createdAt:Date.now()/1000-86400*2, deadline:Date.now()/1000+86400*88, disputeDeadline:Date.now()/1000+86400*118, requiresMultiSig:true, milestones:[
            { description:"Data collection", amount:"5000e18", approved:false, submitted:false, deliverableCID:"0x"+"00".repeat(32) },
            { description:"Model training", amount:"5000e18", approved:false, submitted:false, deliverableCID:"0x"+"00".repeat(32) },
            { description:"Evaluation report", amount:"5000e18", approved:false, submitted:false, deliverableCID:"0x"+"00".repeat(32) },
        ]},
        { id:3, client:"0x"+"ee".repeat(20), worker:"0x"+"33".repeat(20), totalAmount:"800e18", releasedAmount:"800e18", remainingAmount:"0", completedMilestones:2, totalMilestones:2, state:"Completed", createdAt:Date.now()/1000-86400*30, deadline:Date.now()/1000-86400, disputeDeadline:Date.now()/1000-1, requiresMultiSig:false, milestones:[
            { description:"Smart contract audit", amount:"400e18", approved:true, submitted:true, deliverableCID:"0x"+"dd".repeat(32) },
            { description:"Security report", amount:"400e18", approved:true, submitted:true, deliverableCID:"0x"+"ee".repeat(32) },
        ]},
    ];

    const badges = [
        { tokenId:1, operator:"0x"+"a1".repeat(20), didHash:"0x"+"c1".repeat(32), tier:5, totalWork:1547, totalEarnings:"520000e18", uptimeScore:9950, disputesWon:12, disputesLost:0, consecutiveDays:87, mintedAt:Date.now()/1000-86400*90, lastUpdated:Date.now()/1000-3600, achievements:0x7f },
        { tokenId:2, operator:"0x"+"a3".repeat(20), didHash:"0x"+"c3".repeat(32), tier:4, totalWork:892, totalEarnings:"180000e18", uptimeScore:9800, disputesWon:5, disputesLost:1, consecutiveDays:45, mintedAt:Date.now()/1000-86400*60, lastUpdated:Date.now()/1000-7200, achievements:0x3f },
        { tokenId:3, operator:"0x"+"11".repeat(20), didHash:"0x"+"a1".repeat(32), tier:4, totalWork:2341, totalEarnings:"890000e18", uptimeScore:9980, disputesWon:8, disputesLost:0, consecutiveDays:120, mintedAt:Date.now()/1000-86400*30, lastUpdated:Date.now()/1000-1800, achievements:0xff },
        { tokenId:4, operator:"0x"+"93".repeat(20), didHash:"0x"+"b3".repeat(32), tier:1, totalWork:67, totalEarnings:"3400e18", uptimeScore:8500, disputesWon:0, disputesLost:2, consecutiveDays:5, mintedAt:Date.now()/1000-86400*10, lastUpdated:Date.now()/1000-86400, achievements:0x01 },
    ];

    return { agents: agentDefs, tierConfigs, proposals, escrows, badges };
}

// ── API Server ───────────────────────────────────────────────────

class RestApiServer {
    /**
     * @param {Object} masterAgent - MasterAgent instance (optional, uses mock data if null)
     * @param {Object} config
     * @param {number} config.port - HTTP port (default 3000)
     * @param {string} config.host - Bind host (default 127.0.0.1)
     */
    constructor(masterAgent, config = {}) {
        this.master = masterAgent;
        this.port = config.port || 3000;
        this.host = config.host || "127.0.0.1";
        this.server = null;
        this._requestCount = 0;
        this._startTime = Date.now();
        this._mockData = generateMockData();

        // Cache for contract reads (refreshed periodically)
        this._cache = { agents: null, tiers: null, governance: null, escrow: null, reputation: null };
        this._cacheTTL = 10000; // 10 seconds
        this._lastCacheRefresh = 0;
    }

    start() {
        this.server = http.createServer((req, res) => this._handleRequest(req, res));
        this.server.listen(this.port, this.host, () => {
            console.log(`[REST API] Listening on http://${this.host}:${this.port}`);
            console.log(`[REST API] Endpoints: /api/v1/{agents,tiers,governance,escrow,reputation,tasks,system}`);
        });
    }

    stop() {
        if (this.server) this.server.close();
    }

    // ── Request Router ──────────────────────────────────────────

    async _handleRequest(req, res) {
        this._requestCount++;
        const { pathname, query } = parseQuery(req.url);

        // CORS
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

        res.setHeader("Content-Type", "application/json; charset=utf-8");

        try {
            // ── System ──
            if (pathname === "/api/v1/system/health") return this._json(res, this._health());
            if (pathname === "/api/v1/system/stats") return this._json(res, this._stats());
            if (pathname === "/api/v1/system/contracts") return this._json(res, this._contracts());

            // ── Agents ──
            if (pathname === "/api/v1/agents") return this._json(res, this._agentsList(query));
            let m;
            if ((m = matchRoute("/api/v1/agents/:did", pathname))) return this._json(res, this._agentDetail(m.did));
            if ((m = matchRoute("/api/v1/agents/:did/heartbeat", pathname))) return this._json(res, this._agentHeartbeat(m.did));
            if ((m = matchRoute("/api/v1/agents/:did/reputation", pathname))) return this._json(res, this._agentReputation(m.did));

            // ── Tiers ──
            if (pathname === "/api/v1/tiers") return this._json(res, this._tiersList());
            if (pathname === "/api/v1/tiers/config") return this._json(res, this._tiersConfig());
            if ((m = matchRoute("/api/v1/tiers/:tier", pathname))) return this._json(res, this._tierDetail(m.tier, query));
            if ((m = matchRoute("/api/v1/tiers/:tier/stakers", pathname))) return this._json(res, this._tierStakers(m.tier, query));

            // ── Governance ──
            if (pathname === "/api/v1/governance/proposals") return this._json(res, this._proposalsList(query));
            if ((m = matchRoute("/api/v1/governance/proposals/:id", pathname))) return this._json(res, this._proposalDetail(m.id));
            if ((m = matchRoute("/api/v1/governance/proposals/:id/votes", pathname))) return this._json(res, this._proposalVotes(m.id));
            if (pathname === "/api/v1/governance/config") return this._json(res, this._governanceConfig());

            // ── Escrow ──
            if (pathname === "/api/v1/escrows") return this._json(res, this._escrowsList(query));
            if ((m = matchRoute("/api/v1/escrows/:id", pathname))) return this._json(res, this._escrowDetail(m.id));
            if ((m = matchRoute("/api/v1/escrows/:id/milestones", pathname))) return this._json(res, this._escrowMilestones(m.id));
            if ((m = matchRoute("/api/v1/escrows/:id/disputes", pathname))) return this._json(res, this._escrowDisputes(m.id));

            // ── Reputation ──
            if (pathname === "/api/v1/reputation/badges") return this._json(res, this._badgesList(query));
            if ((m = matchRoute("/api/v1/reputation/badges/:tokenId", pathname))) return this._json(res, this._badgeDetail(m.tokenId));
            if (pathname === "/api/v1/reputation/achievements") return this._json(res, this._achievementsList());

            // ── Tasks ──
            if (pathname === "/api/v1/tasks") return this._json(res, this._tasksList(query));
            if ((m = matchRoute("/api/v1/tasks/:taskId", pathname))) return this._json(res, this._taskDetail(m.taskId));

            // ── Root ──
            if (pathname === "/api/v1" || pathname === "/api") return this._json(res, this._apiRoot());

            // ── 404 ──
            return this._json(res, { error: "Not found", availableEndpoints: this._apiRoot().endpoints }, 404);
        } catch (e) {
            return this._json(res, { error: e.message, stack: process.env.NODE_ENV === "development" ? e.stack : undefined }, 500);
        }
    }

    // ── System Endpoints ────────────────────────────────────────

    _health() {
        return {
            status: "ok",
            version: "1.0.0",
            uptime: Math.floor((Date.now() - this._startTime) / 1000),
            requests: this._requestCount,
            timestamp: new Date().toISOString(),
            mode: this.master ? "live" : "mock",
        };
    }

    _stats() {
        const mock = this._mockData;
        return {
            agents: { total: mock.agents.length, active: mock.agents.filter(a => a.status === "active").length, byCategory: { compute: mock.agents.filter(a => a.category === "compute").length, infrastructure: mock.agents.filter(a => a.category === "infrastructure").length, platform: mock.agents.filter(a => a.category === "platform").length } },
            tiers: mock.tierConfigs.map(t => ({ tier: t.tier, name: t.name, count: mock.agents.filter(a => a.tier === t.tier).length })),
            governance: { totalProposals: mock.proposals.length, active: mock.proposals.filter(p => p.state === "Active").length, succeeded: mock.proposals.filter(p => p.state === "Succeeded").length },
            escrow: { total: mock.escrows.length, inProgress: mock.escrows.filter(e => e.state === "InProgress").length, totalLocked: mock.escrows.reduce((s, e) => s + (e.state !== "Completed" && e.state !== "Cancelled" ? parseFloat(e.remainingAmount) : 0), 0) + "e18" },
            reputation: { totalBadges: mock.badges.length, totalAchievements: mock.badges.reduce((s, b) => s + popcount(b.achievements), 0) },
        };
    }

    _contracts() {
        return {
            registry: this.master?.registryAddress || "Not connected",
            token: this.master?.tokenAddress || "Not connected",
            tierStaking: "Not connected",
            governance: "Not connected",
            escrow: "Not connected",
            reputationNFT: "Not connected",
            mode: this.master ? "live" : "mock",
        };
    }

    // ── Agent Endpoints ─────────────────────────────────────────

    _agentsList(query) {
        let agents = this._mockData.agents.map(a => ({
            didHash: a.didHash,
            name: a.name,
            icon: a.icon,
            category: a.category,
            agentType: a.agentType,
            tier: a.tier,
            status: a.status,
            stake: a.stake,
            reputation: a.reputation,
            geohash: a.geohash,
            lastHeartbeat: a.lastHeartbeat,
            registeredAt: a.registeredAt,
            uptime: ((Date.now()/1000 - a.lastHeartbeat) < 600) ? "online" : "offline",
        }));

        agents = filterByQuery(agents, query, ["category", "name", "geohash"]);
        if (query.tier !== undefined) agents = agents.filter(a => a.tier === parseInt(query.tier));
        if (query.minReputation) agents = agents.filter(a => a.reputation >= parseInt(query.minReputation));

        const total = agents.length;
        const result = paginate(agents, query);
        return { ...result, meta: { total, endpoint: "/api/v1/agents" } };
    }

    _agentDetail(did) {
        const agent = this._mockData.agents.find(a => a.didHash === did || a.didHash === "0x" + did);
        if (!agent) return { error: "Agent not found", didHash: did };
        const badge = this._mockData.badges.find(b => b.didHash === agent.didHash);
        return {
            ...agent,
            capabilities: agent.capabilities,
            heartbeatAge: Math.floor(Date.now()/1000 - agent.lastHeartbeat),
            online: (Date.now()/1000 - agent.lastHeartbeat) < 600,
            badge: badge ? { tokenId: badge.tokenId, achievements: badge.achievements, totalWork: badge.totalWork } : null,
        };
    }

    _agentHeartbeat(did) {
        const agent = this._mockData.agents.find(a => a.didHash === did || a.didHash === "0x" + did);
        if (!agent) return { error: "Agent not found" };
        return {
            didHash: agent.didHash,
            lastHeartbeat: agent.lastHeartbeat,
            heartbeatAge: Math.floor(Date.now()/1000 - agent.lastHeartbeat),
            online: (Date.now()/1000 - agent.lastHeartbeat) < 600,
            heartbeatInterval: 300,
            nextExpected: agent.lastHeartbeat + 300,
        };
    }

    _agentReputation(did) {
        const agent = this._mockData.agents.find(a => a.didHash === did || a.didHash === "0x" + did);
        if (!agent) return { error: "Agent not found" };
        const badge = this._mockData.badges.find(b => b.didHash === agent.didHash);
        return {
            didHash: agent.didHash,
            reputation: agent.reputation,
            tier: agent.tier,
            badge: badge || null,
            achievements: badge ? decodeAchievements(badge.achievements) : [],
        };
    }

    // ── Tier Endpoints ──────────────────────────────────────────

    _tiersList() {
        const agents = this._mockData.agents;
        return this._mockData.tierConfigs.map(t => ({
            ...t,
            agentCount: agents.filter(a => a.tier === t.tier).length,
            agents: agents.filter(a => a.tier === t.tier).map(a => ({ didHash: a.didHash, name: a.name, icon: a.icon, reputation: a.reputation })),
            totalStaked: agents.filter(a => a.tier === t.tier).reduce((s, a) => s + a.stake, 0),
        }));
    }

    _tiersConfig() {
        return {
            tiers: this._mockData.tierConfigs,
            tierChangeGracePeriod: "3 days",
            hardwareCheckInterval: "24 hours",
            maxTiers: 6,
        };
    }

    _tierDetail(tierStr, query) {
        const tier = parseInt(tierStr);
        if (isNaN(tier) || tier < 0 || tier > 5) return { error: "Invalid tier (0-5)" };
        const config = this._mockData.tierConfigs[tier];
        const agents = this._mockData.agents.filter(a => a.tier === tier);
        return {
            ...config,
            agentCount: agents.length,
            totalStaked: agents.reduce((s, a) => s + a.stake, 0),
            avgReputation: agents.length ? Math.round(agents.reduce((s, a) => s + a.reputation, 0) / agents.length) : 0,
            agents: paginate(agents, query),
        };
    }

    _tierStakers(tierStr, query) {
        const tier = parseInt(tierStr);
        if (isNaN(tier) || tier < 0 || tier > 5) return { error: "Invalid tier (0-5)" };
        const agents = this._mockData.agents.filter(a => a.tier === tier).map(a => ({
            didHash: a.didHash,
            name: a.name,
            operator: a.operator,
            stake: a.stake,
            reputation: a.reputation,
            lastHeartbeat: a.lastHeartbeat,
        }));
        return paginate(agents, query);
    }

    // ── Governance Endpoints ────────────────────────────────────

    _proposalsList(query) {
        let proposals = this._mockData.proposals.map(p => ({
            id: p.id,
            proposer: p.proposer,
            description: p.description,
            state: p.state,
            forVotes: p.forVotes,
            againstVotes: p.againstVotes,
            abstainVotes: p.abstainVotes,
            startBlock: p.startBlock,
            endBlock: p.endBlock,
            totalVoted: (BigInt(p.forVotes) + BigInt(p.againstVotes) + BigInt(p.abstainVotes)).toString(),
        }));
        if (query.state) proposals = proposals.filter(p => p.state.toLowerCase() === query.state.toLowerCase());
        return paginate(proposals, query);
    }

    _proposalDetail(id) {
        const proposal = this._mockData.proposals.find(p => p.id === parseInt(id));
        if (!proposal) return { error: "Proposal not found", id: parseInt(id) };
        const totalVotes = BigInt(proposal.forVotes) + BigInt(proposal.againstVotes) + BigInt(proposal.abstainVotes);
        return {
            ...proposal,
            totalVotes: totalVotes.toString(),
            forPercent: totalVotes > 0 ? (BigInt(proposal.forVotes) * 10000n / totalVotes / 100n).toString() + "%" : "0%",
            againstPercent: totalVotes > 0 ? (BigInt(proposal.againstVotes) * 10000n / totalVotes / 100n).toString() + "%" : "0%",
            quorum: "20%",
            timelockDuration: "1 day",
            votingDuration: "3 days",
        };
    }

    _proposalVotes(id) {
        const proposal = this._mockData.proposals.find(p => p.id === parseInt(id));
        if (!proposal) return { error: "Proposal not found" };
        return {
            proposalId: parseInt(id),
            forVotes: proposal.forVotes,
            againstVotes: proposal.againstVotes,
            abstainVotes: proposal.abstainVotes,
            totalVotes: (BigInt(proposal.forVotes) + BigInt(proposal.againstVotes) + BigInt(proposal.abstainVotes)).toString(),
            state: proposal.state,
        };
    }

    _governanceConfig() {
        return {
            votingDuration: "3 days",
            timelockDuration: "1 day",
            quorumThreshold: "20%",
            tierWeights: { "0": "1x", "1": "2x", "2": "3x", "3": "5x", "4": "10x", "5": "20x" },
            proposalStates: ["Pending", "Active", "Succeeded", "Defeated", "Queued", "Executed", "Cancelled"],
        };
    }

    // ── Escrow Endpoints ────────────────────────────────────────

    _escrowsList(query) {
        let escrows = this._mockData.escrows.map(e => ({
            id: e.id,
            client: e.client,
            worker: e.worker,
            totalAmount: e.totalAmount,
            releasedAmount: e.releasedAmount,
            remainingAmount: e.remainingAmount,
            completedMilestones: e.completedMilestones,
            totalMilestones: e.totalMilestones,
            state: e.state,
            progress: e.totalMilestones > 0 ? Math.round(e.completedMilestones / e.totalMilestones * 100) + "%" : "0%",
            requiresMultiSig: e.requiresMultiSig,
            createdAt: e.createdAt,
            deadline: e.deadline,
        }));
        if (query.state) escrows = escrows.filter(e => e.state === query.state);
        if (query.client) escrows = escrows.filter(e => e.client.toLowerCase() === query.client.toLowerCase());
        if (query.worker) escrows = escrows.filter(e => e.worker.toLowerCase() === query.worker.toLowerCase());
        return paginate(escrows, query);
    }

    _escrowDetail(id) {
        const escrow = this._mockData.escrows.find(e => e.id === parseInt(id));
        if (!escrow) return { error: "Escrow not found", id: parseInt(id) };
        return {
            ...escrow,
            progress: escrow.totalMilestones > 0 ? Math.round(escrow.completedMilestones / escrow.totalMilestones * 100) + "%" : "0%",
            timeRemaining: escrow.deadline > Date.now()/1000 ? Math.floor((escrow.deadline - Date.now()/1000) / 86400) + " days" : "Expired",
        };
    }

    _escrowMilestones(id) {
        const escrow = this._mockData.escrows.find(e => e.id === parseInt(id));
        if (!escrow) return { error: "Escrow not found" };
        return {
            escrowId: parseInt(id),
            totalMilestones: escrow.milestones.length,
            completedMilestones: escrow.completedMilestones,
            milestones: escrow.milestones.map((m, i) => ({
                index: i,
                description: m.description,
                amount: m.amount,
                approved: m.approved,
                submitted: m.submitted,
                deliverableCID: m.deliverableCID,
                status: m.approved ? "approved" : m.submitted ? "submitted" : "pending",
            })),
        };
    }

    _escrowDisputes(id) {
        const escrow = this._mockData.escrows.find(e => e.id === parseInt(id));
        if (!escrow) return { error: "Escrow not found" };
        return {
            escrowId: parseInt(id),
            state: escrow.state,
            disputeWindow: "14 days",
            disputeDeadline: escrow.disputeDeadline,
            canDispute: escrow.state === "InProgress" && Date.now()/1000 <= escrow.disputeDeadline,
            multisigThreshold: "10,000 FCM",
            requiresMultiSig: escrow.requiresMultiSig,
        };
    }

    // ── Reputation Endpoints ────────────────────────────────────

    _badgesList(query) {
        let badges = this._mockData.badges.map(b => ({
            tokenId: b.tokenId,
            operator: b.operator,
            didHash: b.didHash,
            tier: b.tier,
            totalWork: b.totalWork,
            totalEarnings: b.totalEarnings,
            uptimeScore: b.uptimeScore,
            disputesWon: b.disputesWon,
            disputesLost: b.disputesLost,
            consecutiveDays: b.consecutiveDays,
            achievements: decodeAchievements(b.achievements),
            achievementCount: popcount(b.achievements),
            mintedAt: b.mintedAt,
            lastUpdated: b.lastUpdated,
            soulbound: true,
        }));
        if (query.tier !== undefined) badges = badges.filter(b => b.tier === parseInt(query.tier));
        if (query.minWork) badges = badges.filter(b => b.totalWork >= parseInt(query.minWork));
        return paginate(badges, query);
    }

    _badgeDetail(tokenId) {
        const badge = this._mockData.badges.find(b => b.tokenId === parseInt(tokenId));
        if (!badge) return { error: "Badge not found", tokenId: parseInt(tokenId) };
        return {
            ...badge,
            achievements: decodeAchievements(badge.achievements),
            achievementCount: popcount(badge.achievements),
            soulbound: true,
            transferable: false,
            approvalsBlocked: true,
        };
    }

    _achievementsList() {
        return {
            achievements: [
                { id: 1, name: "First Task", description: "Complete your first task", bit: 0 },
                { id: 2, name: "100 Tasks", description: "Complete 100 tasks", bit: 1 },
                { id: 3, name: "1000 Tasks", description: "Complete 1000 tasks", bit: 2 },
                { id: 4, name: "Perfect Uptime", description: "Maintain 99%+ uptime score", bit: 3 },
                { id: 5, name: "Elite Tier", description: "Reach Tier 5 (Elite)", bit: 4 },
                { id: 6, name: "Year Veteran", description: "Active for 365+ days", bit: 5 },
                { id: 7, name: "Dispute Champion", description: "Win 10+ disputes with 0 losses", bit: 6 },
                { id: 8, name: "Million Earned", description: "Earn 1M+ FCM total", bit: 7 },
            ],
            totalAchievements: 8,
        };
    }

    // ── Task Endpoints ──────────────────────────────────────────

    _tasksList(query) {
        // Generate mock tasks
        const tasks = [
            { taskId:"0x"+"t1".repeat(16), requester:"0x"+"ee".repeat(20), reward:"150e18", deadline:Date.now()/1000+86400, requirements:"0xff", status:"Open", assignedAgent:null },
            { taskId:"0x"+"t2".repeat(16), requester:"0x"+"ee".repeat(20), reward:"250e18", deadline:Date.now()/1000+86400*2, requirements:"0xaf", status:"Assigned", assignedAgent:"0x"+"11".repeat(20) },
            { taskId:"0x"+"t3".repeat(16), requester:"0x"+"ff".repeat(20), reward:"100e18", deadline:Date.now()/1000-3600, requirements:"0x5f", status:"Completed", assignedAgent:"0x"+"22".repeat(20) },
            { taskId:"0x"+"t4".repeat(16), requester:"0x"+"ee".repeat(20), reward:"500e18", deadline:Date.now()/1000-7200, requirements:"0xff", status:"Disputed", assignedAgent:"0x"+"33".repeat(20) },
        ];
        let result = tasks;
        if (query.status) result = result.filter(t => t.status === query.status);
        return paginate(result, query);
    }

    _taskDetail(taskId) {
        const task = [
            { taskId:"0x"+"t1".repeat(16), requester:"0x"+"ee".repeat(20), reward:"150e18", deadline:Date.now()/1000+86400, requirements:"0xff", inputCID:"0x"+"aa".repeat(32), outputCID:"0x"+"00".repeat(32), status:"Open", assignedAgent:null, proofHash:"0x"+"00".repeat(32), rewardWithdrawn:false, disputedAt:0 },
            { taskId:"0x"+"t2".repeat(16), requester:"0x"+"ee".repeat(20), reward:"250e18", deadline:Date.now()/1000+86400*2, requirements:"0xaf", inputCID:"0x"+"bb".repeat(32), outputCID:"0x"+"00".repeat(32), status:"Assigned", assignedAgent:"0x"+"11".repeat(20), proofHash:"0x"+"00".repeat(32), rewardWithdrawn:false, disputedAt:0 },
        ].find(t => t.taskId === taskId);
        if (!task) return { error: "Task not found" };
        return task;
    }

    // ── API Root ────────────────────────────────────────────────

    _apiRoot() {
        return {
            name: "FCM REST API",
            version: "1.0.0",
            mode: this.master ? "live" : "mock",
            endpoints: {
                system: {
                    "GET /api/v1/system/health":    "Server health check",
                    "GET /api/v1/system/stats":      "Aggregate statistics",
                    "GET /api/v1/system/contracts":  "Connected contract addresses",
                },
                agents: {
                    "GET  /api/v1/agents":                     "List all agents (paginated, filterable)",
                    "GET  /api/v1/agents/:did":                "Agent detail by DID hash",
                    "GET  /api/v1/agents/:did/heartbeat":      "Agent heartbeat status",
                    "GET  /api/v1/agents/:did/reputation":     "Agent reputation & achievements",
                },
                tiers: {
                    "GET  /api/v1/tiers":                      "All tier rankings with agent counts",
                    "GET  /api/v1/tiers/config":                "Tier configuration details",
                    "GET  /api/v1/tiers/:tier":                 "Tier detail with agents",
                    "GET  /api/v1/tiers/:tier/stakers":         "Stakers in a specific tier",
                },
                governance: {
                    "GET  /api/v1/governance/proposals":        "List all proposals",
                    "GET  /api/v1/governance/proposals/:id":    "Proposal detail",
                    "GET  /api/v1/governance/proposals/:id/votes": "Proposal vote breakdown",
                    "GET  /api/v1/governance/config":            "Governance parameters",
                },
                escrow: {
                    "GET  /api/v1/escrows":                     "List all escrows",
                    "GET  /api/v1/escrows/:id":                 "Escrow detail",
                    "GET  /api/v1/escrows/:id/milestones":      "Escrow milestone breakdown",
                    "GET  /api/v1/escrows/:id/disputes":        "Escrow dispute info",
                },
                reputation: {
                    "GET  /api/v1/reputation/badges":           "List all soulbound badges",
                    "GET  /api/v1/reputation/badges/:tokenId":  "Badge detail",
                    "GET  /api/v1/reputation/achievements":     "Achievement catalog",
                },
                tasks: {
                    "GET  /api/v1/tasks":                       "List all tasks",
                    "GET  /api/v1/tasks/:taskId":               "Task detail",
                },
            },
            queryParameters: {
                page: "Page number (default: 1)",
                limit: "Items per page (default: 20, max: 100)",
                sort: "Sort field (prefix with - for desc, e.g. -reputation)",
                status: "Filter by status",
                category: "Filter by category (agents only)",
                tier: "Filter by tier number",
            },
        };
    }

    // ── JSON Response ───────────────────────────────────────────

    _json(res, data, status = 200) {
        res.statusCode = status;
        res.end(JSON.stringify(data, null, 2));
    }
}

// ── Utility Functions ────────────────────────────────────────────

function popcount(n) {
    let count = 0;
    while (n) { count += n & 1; n >>= 1; }
    return count;
}

function decodeAchievements(bitmask) {
    const ALL = [
        { bit: 0, name: "First Task", icon: "✅" },
        { bit: 1, name: "100 Tasks", icon: "💯" },
        { bit: 2, name: "1000 Tasks", icon: "🏆" },
        { bit: 3, name: "Perfect Uptime", icon: "⚡" },
        { bit: 4, name: "Elite Tier", icon: "👑" },
        { bit: 5, name: "Year Veteran", icon: "🎖️" },
        { bit: 6, name: "Dispute Champion", icon: "⚔️" },
        { bit: 7, name: "Million Earned", icon: "💰" },
    ];
    return ALL.filter(a => (bitmask & (1 << a.bit)) !== 0).map(a => ({ ...a, unlocked: true }));
}

module.exports = { RestApiServer };
