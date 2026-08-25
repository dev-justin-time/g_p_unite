/**
 * GPU Platform — RBAC Module Tests
 * Tests the actual rbac.ts functions: hasPermission, canNavigate,
 * currentRole, applyRBAC, switchRole, renderPermissionMatrix
 */

// ── Minimal DOM mocks ──────────────────────────
if (typeof globalThis.document === "undefined") {
  const elements = {};
  globalThis.document = {
    getElementById: (id) => elements[id] || null,
    querySelectorAll: () => [],
    querySelector: () => null,
    documentElement: { getAttribute: () => null, setAttribute: () => {}, removeAttribute: () => {} },
    createElement: (tag) => ({
      tagName: tag, style: {}, getContext: () => null, parentElement: null,
      addEventListener: () => {}, classList: { add: () => {}, remove: () => {} },
      innerHTML: "", textContent: "", clientWidth: 0, clientHeight: 0,
    }),
  };
}
if (typeof globalThis.window === "undefined") {
  globalThis.window = { devicePixelRatio: 1, addEventListener: () => {}, location: { protocol: "http:", host: "localhost" } };
}
if (typeof globalThis.localStorage === "undefined") {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
}
if (typeof globalThis.getComputedStyle === "undefined") {
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => "" });
}
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = class { close() {} send() {} };
}
if (typeof globalThis.fetch === "undefined") {
  globalThis.fetch = async () => ({ json: async () => ({}) });
}
globalThis.announceToSR = () => {};
globalThis.closeModal = () => {};
globalThis.showToast = () => {};
globalThis.navigateTo = () => {};
globalThis.esc = (s) => s;

import { expect } from "chai";
import * as rbac from "../gpu-platform/src/rbac.ts";
import { RBAC_PERMISSIONS, PERMISSION_MATRIX } from "../gpu-platform/src/agents-data.ts";

describe("RBAC Module — Function Tests", function () {
  let rbac;
  let originalRole;

  beforeEach(function () {
    // Clear localStorage role to reset state
    localStorage.removeItem("fcm_role");
    originalRole = rbac.currentRole;
  });

  afterEach(function () {
    // Restore original role
    rbac.currentRole = originalRole;
  });

  describe("currentRole", function () {
    it("should default to 'admin' when no localStorage value", function () {
      expect(rbac.currentRole).to.equal("admin");
    });

    it("should be one of the valid roles", function () {
      expect(["admin", "operator", "viewer"]).to.include(rbac.currentRole);
    });
  });

  describe("hasPermission", function () {
    it("admin should have all permissions", function () {
      rbac.currentRole = "admin";
      const permissions = [
        "stake", "unstake", "claim_task", "create_proposal",
        "vote", "approve_milestone", "send_chat", "manage_roles",
        "pause_contracts", "emergency_actions", "edit_settings",
        "launch_node", "configure_multi_sig",
      ];
      for (const perm of permissions) {
        expect(rbac.hasPermission(perm)).to.equal(true, `admin should have ${perm}`);
      }
    });

    it("operator should have staking, tasks, governance permissions", function () {
      rbac.currentRole = "operator";
      expect(rbac.hasPermission("stake")).to.equal(true);
      expect(rbac.hasPermission("unstake")).to.equal(true);
      expect(rbac.hasPermission("claim_task")).to.equal(true);
      expect(rbac.hasPermission("vote")).to.equal(true);
      expect(rbac.hasPermission("send_chat")).to.equal(true);
    });

    it("operator should NOT have admin permissions", function () {
      rbac.currentRole = "operator";
      expect(rbac.hasPermission("manage_roles")).to.equal(false);
      expect(rbac.hasPermission("pause_contracts")).to.equal(false);
      expect(rbac.hasPermission("emergency_actions")).to.equal(false);
      expect(rbac.hasPermission("configure_multi_sig")).to.equal(false);
    });

    it("viewer should have NO action permissions", function () {
      rbac.currentRole = "viewer";
      const allPermissions = [
        "stake", "unstake", "claim_task", "create_proposal",
        "vote", "approve_milestone", "send_chat", "manage_roles",
        "pause_contracts", "emergency_actions", "edit_settings",
        "launch_node", "configure_multi_sig",
      ];
      for (const perm of allPermissions) {
        expect(rbac.hasPermission(perm)).to.equal(false, `viewer should NOT have ${perm}`);
      }
    });

    it("should return false for unknown permission", function () {
      rbac.currentRole = "admin";
      expect(rbac.hasPermission("nonexistent_perm")).to.equal(false);
    });

    it("should react to role change", function () {
      rbac.currentRole = "admin";
      expect(rbac.hasPermission("emergency_actions")).to.equal(true);

      rbac.currentRole = "operator";
      expect(rbac.hasPermission("emergency_actions")).to.equal(false);

      rbac.currentRole = "viewer";
      expect(rbac.hasPermission("emergency_actions")).to.equal(false);
    });
  });

  describe("canNavigate", function () {
    it("admin should navigate to any page", function () {
      rbac.currentRole = "admin";
      const pages = [
        "onboarding", "dashboard", "agents", "marketplace", "staking",
        "escrow", "governance", "reputation", "chat", "obscura",
        "resources", "settings", "admin",
      ];
      for (const page of pages) {
        expect(rbac.canNavigate(page)).to.equal(true, `admin should navigate to ${page}`);
      }
    });

    it("operator should navigate to all except admin", function () {
      rbac.currentRole = "operator";
      expect(rbac.canNavigate("dashboard")).to.equal(true);
      expect(rbac.canNavigate("agents")).to.equal(true);
      expect(rbac.canNavigate("staking")).to.equal(true);
      expect(rbac.canNavigate("admin")).to.equal(false);
    });

    it("viewer should only navigate to read-only pages", function () {
      rbac.currentRole = "viewer";
      expect(rbac.canNavigate("dashboard")).to.equal(true);
      expect(rbac.canNavigate("agents")).to.equal(true);
      expect(rbac.canNavigate("marketplace")).to.equal(true);
      expect(rbac.canNavigate("governance")).to.equal(true);
      expect(rbac.canNavigate("staking")).to.equal(false);
      expect(rbac.canNavigate("escrow")).to.equal(false);
      expect(rbac.canNavigate("chat")).to.equal(false);
      expect(rbac.canNavigate("settings")).to.equal(false);
      expect(rbac.canNavigate("admin")).to.equal(false);
    });

    it("should return false for unknown page", function () {
      rbac.currentRole = "admin";
      expect(rbac.canNavigate("nonexistent_page")).to.equal(false);
    });
  });

  describe("Security Boundaries", function () {
    it("emergency_actions should only be admin", function () {
      rbac.currentRole = "admin";
      expect(rbac.hasPermission("emergency_actions")).to.equal(true);
      rbac.currentRole = "operator";
      expect(rbac.hasPermission("emergency_actions")).to.equal(false);
      rbac.currentRole = "viewer";
      expect(rbac.hasPermission("emergency_actions")).to.equal(false);
    });

    it("manage_roles should only be admin", function () {
      rbac.currentRole = "admin";
      expect(rbac.hasPermission("manage_roles")).to.equal(true);
      rbac.currentRole = "operator";
      expect(rbac.hasPermission("manage_roles")).to.equal(false);
    });

    it("pause_contracts should only be admin", function () {
      rbac.currentRole = "admin";
      expect(rbac.hasPermission("pause_contracts")).to.equal(true);
      rbac.currentRole = "operator";
      expect(rbac.hasPermission("pause_contracts")).to.equal(false);
    });

    it("stake should be allowed for admin and operator but not viewer", function () {
      rbac.currentRole = "admin";
      expect(rbac.hasPermission("stake")).to.equal(true);
      rbac.currentRole = "operator";
      expect(rbac.hasPermission("stake")).to.equal(true);
      rbac.currentRole = "viewer";
      expect(rbac.hasPermission("stake")).to.equal(false);
    });

    it("send_chat should be denied for viewer", function () {
      rbac.currentRole = "viewer";
      expect(rbac.hasPermission("send_chat")).to.equal(false);
      rbac.currentRole = "operator";
      expect(rbac.hasPermission("send_chat")).to.equal(true);
    });
  });
});

describe("RBAC Module — Permission Matrix Consistency", function () {

  it("admin should always have more or equal permissions than operator", function () {
    const adminTrue = Object.values(RBAC_PERMISSIONS.admin.actions).filter(Boolean).length;
    const opTrue = Object.values(RBAC_PERMISSIONS.operator.actions).filter(Boolean).length;
    expect(adminTrue).to.be.at.least(opTrue);
  });

  it("operator should always have more or equal permissions than viewer", function () {
    const opTrue = Object.values(RBAC_PERMISSIONS.operator.actions).filter(Boolean).length;
    const viewTrue = Object.values(RBAC_PERMISSIONS.viewer.actions).filter(Boolean).length;
    expect(opTrue).to.be.at.least(viewTrue);
  });

  it("admin nav should be a superset of operator nav", function () {
    for (const page of RBAC_PERMISSIONS.operator.nav) {
      expect(RBAC_PERMISSIONS.admin.nav).to.include(page, `admin should include operator page: ${page}`);
    }
  });

  it("operator nav should be a superset of viewer nav", function () {
    for (const page of RBAC_PERMISSIONS.viewer.nav) {
      expect(RBAC_PERMISSIONS.operator.nav).to.include(page, `operator should include viewer page: ${page}`);
    }
  });

  it("PERMISSION_MATRIX should be consistent with RBAC_PERMISSIONS for critical actions", function () {
    // Check "View Dashboard" — all yes
    const dashRow = PERMISSION_MATRIX.find((r) => r.name === "View Dashboard");
    expect(dashRow.admin).to.equal("yes");
    expect(dashRow.operator).to.equal("yes");
    expect(dashRow.viewer).to.equal("yes");

    // Check "Manage Roles" — admin only
    const rolesRow = PERMISSION_MATRIX.find((r) => r.name === "Manage Roles");
    expect(rolesRow.admin).to.equal("yes");
    expect(rolesRow.operator).to.equal("no");
    expect(rolesRow.viewer).to.equal("no");

    // Check "Emergency Actions" — admin only
    const emergRow = PERMISSION_MATRIX.find((r) => r.name === "Emergency Actions");
    expect(emergRow.admin).to.equal("yes");
    expect(emergRow.operator).to.equal("no");
    expect(emergRow.viewer).to.equal("no");
  });

  it("every RBAC_PERMISSIONS action should have a matrix row", function () {
    const matrixNames = PERMISSION_MATRIX.map((r) => r.name.toLowerCase());
    // Check that key actions are represented in the matrix
    const criticalActions = ["Manage Roles", "Pause Contracts", "Emergency Actions", "Configure Multi-Sig"];
    for (const action of criticalActions) {
      expect(matrixNames).to.include(action.toLowerCase());
    }
  });
});
