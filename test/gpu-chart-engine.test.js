/**
 * GPU Platform — Chart Engine Tests
 * Tests pushHistPoint, ingestAgentData, ingestSystemData, ingestRewardsData,
 * MAX_HISTORY buffer, and data integrity.
 */

require("ts-node").register({ transpileOnly: true });

// ── Minimal DOM mocks ──────────────────────────
if (typeof globalThis.document === "undefined") {
  globalThis.document = {
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    documentElement: { getAttribute: () => null, setAttribute: () => {}, removeAttribute: () => {} },
    createElement: (tag) => ({
      tagName: tag,
      style: {},
      getContext: () => null,
      parentElement: null,
      addEventListener: () => {},
      getAttribute: () => null,
      setAttribute: () => {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {} },
      innerHTML: "",
      textContent: "",
      clientWidth: 0,
      clientHeight: 0,
      width: 0,
      height: 0,
    }),
  };
}
if (typeof globalThis.window === "undefined") {
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    location: { protocol: "http:", host: "localhost:9091" },
  };
}
if (typeof globalThis.localStorage === "undefined") {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
  };
}
if (typeof globalThis.getComputedStyle === "undefined") {
  globalThis.getComputedStyle = () => ({
    getPropertyValue: () => "",
  });
}
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = class { close() {} send() {} };
}
if (typeof globalThis.fetch === "undefined") {
  globalThis.fetch = async () => ({ json: async () => ({}) });
}
// Mock announceToSR, closeModal, showToast, navigateTo, esc
globalThis.announceToSR = () => {};
globalThis.closeModal = () => {};
globalThis.showToast = () => {};
globalThis.navigateTo = () => {};
globalThis.esc = (s) => s;

const { expect } = require("chai");

// ── Chart Engine Tests ─────────────────────────
describe("Chart Engine — Data Functions", function () {
  let histData, pushHistPoint, ingestAgentData, ingestSystemData, ingestRewardsData;

  beforeEach(function () {
    // Fresh module state — clear history by requiring fresh copies
    // We'll use the exports directly and manipulate histData
    const chartModule = require("../gpu-platform/src/chart-engine");
    histData = chartModule.histData;
    pushHistPoint = chartModule.pushHistPoint;
    ingestAgentData = chartModule.ingestAgentData;
    ingestSystemData = chartModule.ingestSystemData;
    ingestRewardsData = chartModule.ingestRewardsData;

    // Clear all history
    for (const key of Object.keys(histData)) histData[key] = [];
  });

  describe("pushHistPoint", function () {
    it("should create channel if it doesn't exist", function () {
      pushHistPoint("newChannel", { val: 42 });
      expect(histData["newChannel"]).to.be.an("array");
      expect(histData["newChannel"].length).to.equal(1);
    });

    it("should push a point with timestamp and values", function () {
      const before = Date.now();
      pushHistPoint("reputation", { agent1: 100, agent2: 200 });
      const after = Date.now();

      const point = histData.reputation[0];
      expect(point.ts).to.be.at.least(before);
      expect(point.ts).to.be.at.most(after);
      expect(point.values.agent1).to.equal(100);
      expect(point.values.agent2).to.equal(200);
    });

    it("should append multiple points", function () {
      pushHistPoint("tasks", { total: 10 });
      pushHistPoint("tasks", { total: 20 });
      pushHistPoint("tasks", { total: 30 });
      expect(histData.tasks.length).to.equal(3);
      expect(histData.tasks[2].values.total).to.equal(30);
    });

    it("should enforce MAX_HISTORY of 500", function () {
      // Push 510 points
      for (let i = 0; i < 510; i++) {
        pushHistPoint("reputation", { val: i });
      }
      // Should keep only last 500
      expect(histData.reputation.length).to.equal(500);
      // First point should be index 10 (was trimmed)
      expect(histData.reputation[0].values.val).to.equal(10);
      // Last point should be index 509
      expect(histData.reputation[499].values.val).to.equal(509);
    });

    it("should trim excess from the front (keeps most recent)", function () {
      for (let i = 0; i < 501; i++) {
        pushHistPoint("reputation", { val: i });
      }
      expect(histData.reputation.length).to.equal(500);
      expect(histData.reputation[0].values.val).to.equal(1);
    });
  });

  describe("ingestAgentData", function () {
    it("should handle empty data gracefully", function () {
      ingestAgentData({});
      // Should not add anything (agents key missing)
      expect(histData.reputation.length).to.equal(0);
    });

    it("should handle null agents", function () {
      ingestAgentData({ agents: null });
      expect(histData.reputation.length).to.equal(0);
    });

    it("should extract and sort agents by reputation (descending)", function () {
      ingestAgentData({
        agents: [
          { id: "low", reputation: 100 },
          { id: "high", reputation: 5000 },
          { id: "mid", reputation: 1000 },
        ],
      });
      const point = histData.reputation[0];
      // First value should be the highest reputation agent
      expect(point.values["high"]).to.equal(5000);
      expect(point.values["mid"]).to.equal(1000);
      expect(point.values["low"]).to.equal(100);
    });

    it("should limit to top 8 agents", function () {
      const agents = [];
      for (let i = 0; i < 20; i++) {
        agents.push({ id: "agent" + i, reputation: i * 100 });
      }
      ingestAgentData({ agents });
      const point = histData.reputation[0];
      // Should have at most 8 values
      expect(Object.keys(point.values).length).to.be.at.most(8);
    });

    it("should handle agents with missing id (auto-generate)", function () {
      ingestAgentData({
        agents: [
          { reputation: 100 },
          { reputation: 200 },
        ],
      });
      const point = histData.reputation[0];
      // Agents without id get 'a-0', 'a-1'
      expect(point.values["a-0"] || point.values["a-1"]).to.exist;
    });

    it("should handle agents with missing reputation (defaults to 0)", function () {
      ingestAgentData({
        agents: [
          { id: "test" },
          { id: "test2", reputation: 500 },
        ],
      });
      const point = histData.reputation[0];
      expect(point.values["test2"]).to.equal(500);
      // Missing reputation defaults to 0
      expect(point.values["test"]).to.equal(0);
    });

    it("should not mutate original array", function () {
      const agents = [
        { id: "a", reputation: 100 },
        { id: "b", reputation: 200 },
      ];
      ingestAgentData({ agents });
      expect(agents[0].id).to.equal("a");
      expect(agents[1].id).to.equal("b");
    });
  });

  describe("ingestSystemData", function () {
    it("should push task count and agent count", function () {
      ingestSystemData({ taskCount: 42, agentCount: 8 });
      const taskPoint = histData.tasks[0];
      expect(taskPoint.values.total).to.equal(42);
      expect(taskPoint.values.agents).to.equal(8);
    });

    it("should push system staking metrics", function () {
      ingestSystemData({
        taskCount: 10,
        agentCount: 5,
        totalStaked: "1,234,567",
        stakerCount: 100,
        mintedRewards: "50,000",
      });
      const sysPoint = histData.system[0];
      expect(sysPoint.values.totalStaked).to.equal(1234567);
      expect(sysPoint.values.stakers).to.equal(100);
      expect(sysPoint.values.supply).to.equal(50000);
    });

    it("should handle string totalStaked with commas", function () {
      ingestSystemData({ totalStaked: "1,000,000" });
      expect(histData.system[0].values.totalStaked).to.equal(1000000);
    });

    it("should handle missing fields gracefully", function () {
      ingestSystemData({});
      const taskPoint = histData.tasks[0];
      expect(taskPoint.values.total).to.equal(0);
      expect(taskPoint.values.agents).to.equal(0);
    });

    it("should handle numeric totalStaked", function () {
      ingestSystemData({ totalStaked: 500000 });
      expect(histData.system[0].values.totalStaked).to.equal(500000);
    });
  });

  describe("ingestRewardsData", function () {
    it("should push epoch and distributed", function () {
      ingestRewardsData({ currentEpoch: 24, totalDistributed: 847000 });
      const point = histData.rewards[0];
      expect(point.values.epoch).to.equal(24);
      expect(point.values.distributed).to.equal(847000);
    });

    it("should handle string distributed with commas", function () {
      ingestRewardsData({ currentEpoch: 5, totalDistributed: "1,234,567" });
      expect(histData.rewards[0].values.distributed).to.equal(1234567);
    });

    it("should default to 0 for missing fields", function () {
      ingestRewardsData({});
      const point = histData.rewards[0];
      expect(point.values.epoch).to.equal(0);
      expect(point.values.distributed).to.equal(0);
    });

    it("should append multiple epochs", function () {
      ingestRewardsData({ currentEpoch: 1, totalDistributed: 100 });
      ingestRewardsData({ currentEpoch: 2, totalDistributed: 200 });
      expect(histData.rewards.length).to.equal(2);
      expect(histData.rewards[1].values.epoch).to.equal(2);
    });
  });

  describe("Cross-channel data", function () {
    it("should maintain separate buffers per channel", function () {
      pushHistPoint("reputation", { a: 1 });
      pushHistPoint("tasks", { b: 2 });
      pushHistPoint("rewards", { c: 3 });
      pushHistPoint("system", { d: 4 });

      expect(histData.reputation.length).to.equal(1);
      expect(histData.tasks.length).to.equal(1);
      expect(histData.rewards.length).to.equal(1);
      expect(histData.system.length).to.equal(1);
    });

    it("should not share references between pushes", function () {
      pushHistPoint("reputation", { a: 1 });
      const first = histData.reputation[0];
      pushHistPoint("reputation", { a: 2 });
      const second = histData.reputation[1];
      expect(first).to.not.equal(second);
      expect(first.values.a).to.equal(1);
      expect(second.values.a).to.equal(2);
    });
  });
});

// ── Agents Data Tests ──────────────────────────
describe("Agents Data — Integrity", function () {
  const {
    AGENTS, TIERS, TASKS, PROPOSALS, BADGES_DATA, CHAT_MESSAGES,
    NAV_ITEMS, CHART_COLORS, PERMISSION_MATRIX, RBAC_PERMISSIONS,
  } = require("../gpu-platform/src/agents-data");

  describe("AGENTS", function () {
    it("should have 19 core agents", function () {
      expect(AGENTS).to.be.an("array");
      expect(AGENTS.length).to.equal(19);
    });

    it("should have unique IDs", function () {
      const ids = AGENTS.map((a) => a.id);
      const unique = new Set(ids);
      expect(unique.size).to.equal(ids.length);
    });

    it("each agent should have required fields", function () {
      for (const agent of AGENTS) {
        expect(agent.id).to.be.a("string").and.to.have.length.greaterThan(0);
        expect(agent.name).to.be.a("string").and.to.have.length.greaterThan(0);
        expect(agent.icon).to.be.a("string");
        expect(agent.role).to.be.a("string");
        expect(["compute", "infrastructure", "platform"]).to.include(agent.category);
        expect(agent.tier).to.be.a("number").and.to.be.within(1, 5);
        expect(["active", "standby"]).to.include(agent.status);
        expect(agent.rules).to.be.an("array").with.length(5);
        expect(agent.metrics).to.be.an("array").with.length(3);
        expect(agent.source).to.be.a("string").and.to.have.length.greaterThan(0);
      }
    });

    it("each agent should have exactly 5 rules", function () {
      for (const agent of AGENTS) {
        expect(agent.rules.length).to.equal(5, `${agent.id} should have 5 rules`);
        for (const rule of agent.rules) {
          expect(rule.name).to.be.a("string");
          expect(rule.on).to.be.a("boolean");
        }
      }
    });

    it("each agent should have exactly 3 metrics with key/label/value", function () {
      for (const agent of AGENTS) {
        expect(agent.metrics.length).to.equal(3, `${agent.id} should have 3 metrics`);
        for (const m of agent.metrics) {
          expect(m.key).to.be.a("string");
          expect(m.label).to.be.a("string");
          expect(m.value !== undefined).to.equal(true);
        }
      }
    });

    it("each agent with tick should be a function", function () {
      for (const agent of AGENTS) {
        if (agent.tick) {
          expect(agent.tick).to.be.a("function");
        }
      }
    });

    it("tick functions should modify values without throwing", function () {
      for (const agent of AGENTS) {
        if (agent.tick) {
          const values = {};
          for (const m of agent.metrics) values[m.key] = m.value;
          expect(() => agent.tick(values)).to.not.throw();
        }
      }
    });

    it("should have compute, infrastructure, and platform categories", function () {
      const categories = new Set(AGENTS.map((a) => a.category));
      expect(categories.has("compute")).to.be.true;
      expect(categories.has("infrastructure")).to.be.true;
      expect(categories.has("platform")).to.be.true;
    });

    it("should include all 9 compute agents", function () {
      const compute = AGENTS.filter((a) => a.category === "compute");
      expect(compute.length).to.equal(9);
      const ids = compute.map((a) => a.id);
      expect(ids).to.include.members(["inf", "ren", "fl", "edge", "zk", "game", "sci", "priv", "obscura"]);
    });

    it("should have at least 9 compute agents", function () {
      const compute = AGENTS.filter((a) => a.category === "compute");
      expect(compute.length).to.be.at.least(9);
    });

    it("should have at least 4 infrastructure agents", function () {
      const infra = AGENTS.filter((a) => a.category === "infrastructure");
      expect(infra.length).to.be.at.least(4);
    });

    it("should have at least 6 platform agents", function () {
      const platform = AGENTS.filter((a) => a.category === "platform");
      expect(platform.length).to.be.at.least(6);
    });
  });

  describe("TIERS", function () {
    it("should have 6 tiers", function () {
      expect(TIERS).to.be.an("array");
      expect(TIERS.length).to.equal(6);
    });

    it("each tier should have name, min, and mult", function () {
      for (const tier of TIERS) {
        expect(tier.name).to.be.a("string");
        expect(tier.min).to.be.a("string");
        expect(tier.mult).to.be.a("string");
      }
    });

    it("should start with Free and end with Elite", function () {
      expect(TIERS[0].name).to.equal("Free");
      expect(TIERS[5].name).to.equal("Elite");
    });

    it("multiplier should increase across tiers", function () {
      const multipliers = TIERS.map((t) => parseFloat(t.mult));
      for (let i = 1; i < multipliers.length; i++) {
        expect(multipliers[i]).to.be.greaterThan(multipliers[i - 1]);
      }
    });
  });

  describe("TASKS", function () {
    it("should have 12 marketplace tasks", function () {
      expect(TASKS).to.be.an("array");
      expect(TASKS.length).to.equal(12);
    });

    it("each task should have required fields", function () {
      for (const task of TASKS) {
        expect(task.name).to.be.a("string");
        expect(task.type).to.be.a("string");
        expect(task.reward).to.be.a("number").and.to.be.greaterThan(0);
        expect(task.deadline).to.be.a("string");
        expect(task.tier).to.be.a("number").and.to.be.within(1, 5);
      }
    });
  });

  describe("PROPOSALS", function () {
    it("should have 3 governance proposals", function () {
      expect(PROPOSALS).to.be.an("array");
      expect(PROPOSALS.length).to.equal(3);
    });

    it("each proposal should have required fields", function () {
      for (const p of PROPOSALS) {
        expect(p.id).to.match(/^PIP-\d+$/);
        expect(p.title).to.be.a("string");
        expect(p.type).to.be.a("string");
        expect(p.author).to.be.a("string");
        expect(p.forVotes).to.be.a("number");
        expect(p.againstVotes).to.be.a("number");
        expect(p.abstainVotes).to.be.a("number");
        expect(p.deadline).to.be.a("string");
        expect(["Low", "Medium", "High"]).to.include(p.risk);
      }
    });

    it("PIP-003 should be high risk (emergency)", function () {
      const emergency = PROPOSALS.find((p) => p.id === "PIP-003");
      expect(emergency.risk).to.equal("High");
      expect(emergency.type).to.equal("Emergency");
    });
  });

  describe("BADGES_DATA", function () {
    it("should have 12 badges", function () {
      expect(BADGES_DATA).to.be.an("array");
      expect(BADGES_DATA.length).to.equal(12);
    });

    it("each badge should have icon, name, desc, earned", function () {
      for (const badge of BADGES_DATA) {
        expect(badge.icon).to.be.a("string");
        expect(badge.name).to.be.a("string");
        expect(badge.desc).to.be.a("string");
        expect(badge.earned).to.be.a("boolean");
      }
    });

    it("should have both earned and unearned badges", function () {
      const earned = BADGES_DATA.filter((b) => b.earned);
      const unearned = BADGES_DATA.filter((b) => !b.earned);
      expect(earned.length).to.be.greaterThan(0);
      expect(unearned.length).to.be.greaterThan(0);
    });
  });

  describe("CHAT_MESSAGES", function () {
    it("should have 5 messages", function () {
      expect(CHAT_MESSAGES).to.be.an("array");
      expect(CHAT_MESSAGES.length).to.equal(5);
    });

    it("each message should have sender, text, isAgent", function () {
      for (const msg of CHAT_MESSAGES) {
        expect(msg.sender).to.be.a("string");
        expect(msg.text).to.be.a("string");
        expect(msg.isAgent).to.be.a("boolean");
      }
    });

    it("should have at least one user message", function () {
      const userMsgs = CHAT_MESSAGES.filter((m) => !m.isAgent);
      expect(userMsgs.length).to.be.greaterThan(0);
    });
  });

  describe("NAV_ITEMS", function () {
    it("should have 13 nav items", function () {
      expect(NAV_ITEMS).to.be.an("array");
      expect(NAV_ITEMS.length).to.equal(13);
    });

    it("should include essential pages", function () {
      const essential = ["dashboard", "agents", "marketplace", "governance", "settings"];
      for (const page of essential) {
        expect(NAV_ITEMS).to.include(page);
      }
    });

    it("should include obscura", function () {
      expect(NAV_ITEMS).to.include("obscura");
    });
  });

  describe("CHART_COLORS", function () {
    it("should have 8 colors", function () {
      expect(CHART_COLORS).to.be.an("array");
      expect(CHART_COLORS.length).to.equal(8);
    });

    it("each color should be a hex string", function () {
      for (const color of CHART_COLORS) {
        expect(color).to.match(/^#[0-9a-f]{6}$/i);
      }
    });
  });

  describe("PERMISSION_MATRIX", function () {
    it("should have 15 permission rows", function () {
      expect(PERMISSION_MATRIX).to.be.an("array");
      expect(PERMISSION_MATRIX.length).to.equal(15);
    });

    it("each row should have name, admin, operator, viewer", function () {
      for (const row of PERMISSION_MATRIX) {
        expect(row.name).to.be.a("string");
        expect(["yes", "no"]).to.include(row.admin);
        expect(["yes", "no"]).to.include(row.operator);
        expect(["yes", "no"]).to.include(row.viewer);
      }
    });

    it("admin should have more permissions than operator", function () {
      const adminYes = PERMISSION_MATRIX.filter((r) => r.admin === "yes").length;
      const operatorYes = PERMISSION_MATRIX.filter((r) => r.operator === "yes").length;
      expect(adminYes).to.be.greaterThan(operatorYes);
    });

    it("operator should have more permissions than viewer", function () {
      const operatorYes = PERMISSION_MATRIX.filter((r) => r.operator === "yes").length;
      const viewerYes = PERMISSION_MATRIX.filter((r) => r.viewer === "yes").length;
      expect(operatorYes).to.be.greaterThan(viewerYes);
    });

    it("admin-only actions should be 'no' for operator", function () {
      const adminOnly = ["Manage Roles", "Pause Contracts", "Emergency Actions", "Configure Multi-Sig"];
      for (const action of adminOnly) {
        const row = PERMISSION_MATRIX.find((r) => r.name === action);
        expect(row.admin).to.equal("yes");
        expect(row.operator).to.equal("no");
      }
    });
  });
});

// ── RBAC Tests ─────────────────────────────────
describe("RBAC — Permission Logic", function () {
  const { RBAC_PERMISSIONS } = require("../gpu-platform/src/agents-data");

  describe("Role Definitions", function () {
    it("should define admin, operator, viewer roles", function () {
      expect(RBAC_PERMISSIONS).to.have.property("admin");
      expect(RBAC_PERMISSIONS).to.have.property("operator");
      expect(RBAC_PERMISSIONS).to.have.property("viewer");
    });

    it("each role should have label, icon, cssClass, nav, actions", function () {
      for (const role of ["admin", "operator", "viewer"]) {
        const r = RBAC_PERMISSIONS[role];
        expect(r.label).to.be.a("string");
        expect(r.icon).to.be.a("string");
        expect(r.cssClass).to.be.a("string");
        expect(r.nav).to.be.an("array");
        expect(r.actions).to.be.an("object");
      }
    });
  });

  describe("Admin Permissions", function () {
    it("should have all actions enabled", function () {
      const actions = RBAC_PERMISSIONS.admin.actions;
      for (const [key, val] of Object.entries(actions)) {
        expect(val).to.equal(true, `admin.${key} should be true`);
      }
    });

    it("should have all nav items", function () {
      expect(RBAC_PERMISSIONS.admin.nav.length).to.equal(13);
    });
  });

  describe("Operator Permissions", function () {
    it("should allow staking, tasks, governance", function () {
      const a = RBAC_PERMISSIONS.operator.actions;
      expect(a.stake).to.equal(true);
      expect(a.unstake).to.equal(true);
      expect(a.claim_task).to.equal(true);
      expect(a.vote).to.equal(true);
      expect(a.send_chat).to.equal(true);
    });

    it("should deny admin-only actions", function () {
      const a = RBAC_PERMISSIONS.operator.actions;
      expect(a.manage_roles).to.equal(false);
      expect(a.pause_contracts).to.equal(false);
      expect(a.emergency_actions).to.equal(false);
      expect(a.configure_multi_sig).to.equal(false);
    });

    it("should not have admin page in nav", function () {
      expect(RBAC_PERMISSIONS.operator.nav).to.not.include("admin");
    });
  });

  describe("Viewer Permissions", function () {
    it("should deny all action permissions (except obscura)", function () {
      const a = RBAC_PERMISSIONS.viewer.actions;
      for (const [key, val] of Object.entries(a)) {
        // Obscura browser is available to all roles for web intelligence
        if (key === "use_obscura") continue;
        expect(val).to.equal(false, `viewer.${key} should be false`);
      }
    });

    it("should only allow read-only nav pages", function () {
      const nav = RBAC_PERMISSIONS.viewer.nav;
      expect(nav).to.include("dashboard");
      expect(nav).to.include("agents");
      expect(nav).to.include("marketplace");
      expect(nav).to.include("governance");
      expect(nav).to.not.include("staking");
      expect(nav).to.not.include("admin");
      expect(nav).to.not.include("settings");
    });

    it("should have 7 nav items", function () {
      expect(RBAC_PERMISSIONS.viewer.nav.length).to.equal(7);
    });
  });

  describe("Permission Hierarchy", function () {
    it("admin should have strictly more actions than operator", function () {
      const adminTrue = Object.values(RBAC_PERMISSIONS.admin.actions).filter(Boolean).length;
      const opTrue = Object.values(RBAC_PERMISSIONS.operator.actions).filter(Boolean).length;
      expect(adminTrue).to.be.greaterThan(opTrue);
    });

    it("operator should have strictly more actions than viewer", function () {
      const opTrue = Object.values(RBAC_PERMISSIONS.operator.actions).filter(Boolean).length;
      const viewTrue = Object.values(RBAC_PERMISSIONS.viewer.actions).filter(Boolean).length;
      expect(opTrue).to.be.greaterThan(viewTrue);
    });

    it("admin should have strictly more nav items than operator", function () {
      expect(RBAC_PERMISSIONS.admin.nav.length).to.be.greaterThan(
        RBAC_PERMISSIONS.operator.nav.length
      );
    });

    it("operator should have strictly more nav items than viewer", function () {
      expect(RBAC_PERMISSIONS.operator.nav.length).to.be.greaterThan(
        RBAC_PERMISSIONS.viewer.nav.length
      );
    });
  });

  describe("Critical Security Checks", function () {
    it("emergency_actions should be admin-only", function () {
      expect(RBAC_PERMISSIONS.admin.actions.emergency_actions).to.equal(true);
      expect(RBAC_PERMISSIONS.operator.actions.emergency_actions).to.equal(false);
      expect(RBAC_PERMISSIONS.viewer.actions.emergency_actions).to.equal(false);
    });

    it("manage_roles should be admin-only", function () {
      expect(RBAC_PERMISSIONS.admin.actions.manage_roles).to.equal(true);
      expect(RBAC_PERMISSIONS.operator.actions.manage_roles).to.equal(false);
      expect(RBAC_PERMISSIONS.viewer.actions.manage_roles).to.equal(false);
    });

    it("pause_contracts should be admin-only", function () {
      expect(RBAC_PERMISSIONS.admin.actions.pause_contracts).to.equal(true);
      expect(RBAC_PERMISSIONS.operator.actions.pause_contracts).to.equal(false);
      expect(RBAC_PERMISSIONS.viewer.actions.pause_contracts).to.equal(false);
    });

    it("configure_multi_sig should be admin-only", function () {
      expect(RBAC_PERMISSIONS.admin.actions.configure_multi_sig).to.equal(true);
      expect(RBAC_PERMISSIONS.operator.actions.configure_multi_sig).to.equal(false);
      expect(RBAC_PERMISSIONS.viewer.actions.configure_multi_sig).to.equal(false);
    });

    it("stake should be denied for viewer", function () {
      expect(RBAC_PERMISSIONS.viewer.actions.stake).to.equal(false);
    });

    it("vote should be denied for viewer", function () {
      expect(RBAC_PERMISSIONS.viewer.actions.vote).to.equal(false);
    });

    it("send_chat should be denied for viewer", function () {
      expect(RBAC_PERMISSIONS.viewer.actions.send_chat).to.equal(false);
    });
  });

  describe("Navigation Security", function () {
    it("admin nav should include all pages", function () {
      const allPages = [
        "onboarding", "dashboard", "agents", "marketplace", "staking",
        "escrow", "governance", "reputation", "chat", "obscura",
        "resources", "settings", "admin",
      ];
      for (const page of allPages) {
        expect(RBAC_PERMISSIONS.admin.nav).to.include(page);
      }
    });

    it("viewer nav should NOT include staking", function () {
      expect(RBAC_PERMISSIONS.viewer.nav).to.not.include("staking");
    });

    it("viewer nav should NOT include escrow", function () {
      expect(RBAC_PERMISSIONS.viewer.nav).to.not.include("escrow");
    });

    it("viewer nav should NOT include chat", function () {
      expect(RBAC_PERMISSIONS.viewer.nav).to.not.include("chat");
    });

    it("operator nav should NOT include admin", function () {
      expect(RBAC_PERMISSIONS.operator.nav).to.not.include("admin");
    });
  });
});

// ── Tick Function Behavior Tests ───────────────
describe("Agent Tick Functions — Behavior", function () {
  const { AGENTS } = require("../gpu-platform/src/agents-data");

  describe("Inference Router tick", function () {
    it("should update tps within range", function () {
      const agent = AGENTS.find((a) => a.id === "inf");
      const values = { tps: 4800, queue: 3, batch: 12 };
      agent.tick(values);
      expect(values.tps).to.be.at.least(4800);
      expect(values.tps).to.be.at.most(4999);
    });

    it("should update queue (can go negative then clamped)", function () {
      const agent = AGENTS.find((a) => a.id === "inf");
      const values = { tps: 4800, queue: 0, batch: 12 };
      // Run multiple times to test randomness
      for (let i = 0; i < 100; i++) {
        agent.tick(values);
        expect(values.queue).to.be.at.least(0);
      }
    });
  });

  describe("Render Splitter tick", function () {
    it("should update fps within range", function () {
      const agent = AGENTS.find((a) => a.id === "ren");
      const values = { fps: 24, nodes: 18, progress: "67%" };
      agent.tick(values);
      expect(values.fps).to.be.at.least(22);
      expect(values.fps).to.be.at.most(27);
    });
  });

  describe("FL Coordinator tick", function () {
    it("should update accuracy as percentage string", function () {
      const agent = AGENTS.find((a) => a.id === "fl");
      const values = { rounds: 42, hospitals: 156, accuracy: "94.2%" };
      agent.tick(values);
      expect(values.accuracy).to.match(/^\d+\.\d+%$/);
    });
  });

  describe("Edge Runner tick", function () {
    it("should update rps as string with 'k' suffix", function () {
      const agent = AGENTS.find((a) => a.id === "edge");
      const values = { cold: "8ms", rps: "12.4k", funcs: 892 };
      agent.tick(values);
      expect(values.rps).to.match(/^\d+\.\d+k$/);
    });
  });

  describe("ZK Prover tick", function () {
    it("should update time as string with 's' suffix", function () {
      const agent = AGENTS.find((a) => a.id === "zk");
      const values = { time: "2.4s", agg: 16, cost: "$0.04" };
      agent.tick(values);
      expect(values.time).to.match(/^\d+\.\d+s$/);
    });
  });

  describe("Game Host tick", function () {
    it("should update latency as string with 'ms' suffix", function () {
      const agent = AGENTS.find((a) => a.id === "game");
      const values = { tick: 128, players: 64, latency: "18ms" };
      agent.tick(values);
      expect(values.latency).to.match(/^\d+ms$/);
    });
  });

  describe("Privacy Mesh tick", function () {
    it("should update throughput as string with 'Gbps' suffix", function () {
      const agent = AGENTS.find((a) => a.id === "priv");
      const values = { relays: "1,247", hoplat: "145ms", throughput: "2.1Gbps" };
      agent.tick(values);
      expect(values.throughput).to.match(/^\d+\.\d+Gbps$/);
    });
  });

  describe("Node Runner tick", function () {
    it("should update blocks in range 355-364", function () {
      const agent = AGENTS.find((a) => a.id === "node");
      const values = { blocks: 360, peers: 48, sync: "99.9%" };
      agent.tick(values);
      expect(values.blocks).to.be.at.least(355);
      expect(values.blocks).to.be.at.most(364);
    });
  });

  describe("Storage Provider tick", function () {
    it("should update retrievals in range 800-899", function () {
      const agent = AGENTS.find((a) => a.id === "stor");
      const values = { stored: "2.4TB", files: "18.2k", retrievals: 847 };
      agent.tick(values);
      expect(values.retrievals).to.be.at.least(800);
      expect(values.retrievals).to.be.at.most(899);
    });
  });

  describe("Agent Coordinator tick", function () {
    it("should update uptime as percentage string", function () {
      const agent = AGENTS.find((a) => a.id === "coord");
      const values = { onboarded: "1,247", active: 89, uptime: "99.7%" };
      agent.tick(values);
      expect(values.uptime).to.match(/^\d+\.\d+%$/);
    });
  });

  describe("All tick functions", function () {
    it("should not throw for any agent", function () {
      for (const agent of AGENTS) {
        if (agent.tick) {
          const values = {};
          for (const m of agent.metrics) values[m.key] = m.value;
          expect(() => agent.tick(values)).to.not.throw();
        }
      }
    });

    it("should not add new keys (only modify existing)", function () {
      for (const agent of AGENTS) {
        if (agent.tick) {
          const values = {};
          for (const m of agent.metrics) values[m.key] = m.value;
          const keysBefore = Object.keys(values);
          agent.tick(values);
          const keysAfter = Object.keys(values);
          expect(keysAfter.length).to.equal(keysBefore.length);
        }
      }
    });

    it("should be deterministic when Math.random is mocked", function () {
      const originalRandom = Math.random;
      Math.random = () => 0.5; // deterministic

      for (const agent of AGENTS) {
        if (agent.tick) {
          const values1 = {};
          for (const m of agent.metrics) values1[m.key] = m.value;
          agent.tick(values1);

          const values2 = {};
          for (const m of agent.metrics) values2[m.key] = m.value;
          agent.tick(values2);

          expect(JSON.stringify(values1)).to.equal(JSON.stringify(values2));
        }
      }

      Math.random = originalRandom;
    });
  });
});
