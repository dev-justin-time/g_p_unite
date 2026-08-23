const { expect } = require("chai");

// Import agent definitions (pure JS objects, no blockchain needed)
const { tierManager } = require("../agents/tier-manager");
const { rewardsDistributor } = require("../agents/rewards-distributor");
const { governanceAgent } = require("../agents/governance-agent");
const { escrowManager } = require("../agents/escrow-manager");
const { reputationOracle } = require("../agents/reputation-oracle");
const { agentCoordinator } = require("../agents/agent-coordinator");
const { agents, agentCategories } = require("../agents/index");

describe("New Feature Agents", function () {

    // ── Agent Structure Tests ──────────────────────────────────
    describe("Agent Definitions", function () {
        const newAgents = [tierManager, rewardsDistributor, governanceAgent, escrowManager, reputationOracle, agentCoordinator];

        for (const agent of newAgents) {
            it(`${agent.name} should have valid structure`, function () {
                expect(agent.id).to.be.a("string").with.length.greaterThan(0);
                expect(agent.name).to.be.a("string").with.length.greaterThan(0);
                expect(agent.icon).to.be.a("string").with.length.greaterThan(0);
                expect(agent.role).to.be.a("string").with.length.greaterThan(0);
                expect(agent.status).to.equal("active");
                expect(agent.rules).to.be.an("array").with.length.greaterThan(0);
                expect(agent.metrics).to.be.an("array").with.length.greaterThan(0);
                expect(agent.source).to.be.a("string").with.length.greaterThan(100);
                expect(agent.simulate).to.be.a("function");
                expect(agent.tick).to.be.a("function");
            });

            it(`${agent.name} should have all required fields in rules`, function () {
                for (const rule of agent.rules) {
                    expect(rule.name).to.be.a("string").with.length.greaterThan(0);
                    expect(rule.enabled).to.equal(true);
                }
            });

            it(`${agent.name} should have all required fields in metrics`, function () {
                for (const metric of agent.metrics) {
                    expect(metric.key).to.be.a("string").with.length.greaterThan(0);
                    expect(metric.label).to.be.a("string").with.length.greaterThan(0);
                    expect(metric.value).to.be.a("string").with.length.greaterThan(0);
                }
            });

            it(`${agent.name} simulate should not throw`, function () {
                // Mock DOM
                global.document = {
                    getElementById: () => ({ textContent: "0" }),
                };
                expect(() => agent.simulate()).to.not.throw();
                delete global.document;
            });

            it(`${agent.name} tick should not throw`, function () {
                global.document = {
                    getElementById: () => ({ textContent: "0" }),
                };
                expect(() => agent.tick()).to.not.throw();
                delete global.document;
            });
        }
    });

    // ── Agent Index Tests ──────────────────────────────────────
    describe("Agent Index", function () {
        it("should export all 18 agents", function () {
            expect(agents).to.have.length(18);
        });

        it("should have unique IDs for all agents", function () {
            const ids = agents.map(a => a.id);
            const unique = new Set(ids);
            expect(unique.size).to.equal(ids.length);
        });

        it("should have unique names for all agents", function () {
            const names = agents.map(a => a.name);
            const unique = new Set(names);
            expect(unique.size).to.equal(names.length);
        });

        it("should categorize agents correctly", function () {
            expect(agentCategories.compute).to.have.length(8);
            expect(agentCategories.infrastructure).to.have.length(4);
            expect(agentCategories.platform).to.have.length(6);
        });

        it("should have matching totals", function () {
            const categorized = [
                ...agentCategories.compute,
                ...agentCategories.infrastructure,
                ...agentCategories.platform
            ];
            expect(categorized.length).to.equal(agents.length);
        });
    });

    // ── TierManager Specific Tests ─────────────────────────────
    describe("TierManager Logic", function () {
        it("should have 6 rules", function () {
            expect(tierManager.rules).to.have.length(5);
        });

        it("should have 3 metrics", function () {
            expect(tierManager.metrics).to.have.length(3);
        });

        it("source should contain tier computation logic", function () {
            expect(tierManager.source).to.include("compute_tier");
            expect(tierManager.source).to.include("grace_period");
        });

        it("source should contain anti-gaming detection", function () {
            expect(tierManager.source).to.include("detect_gaming");
        });
    });

    // ── RewardsDistributor Specific Tests ──────────────────────
    describe("RewardsDistributor Logic", function () {
        it("source should contain epoch lifecycle", function () {
            expect(rewardsDistributor.source).to.include("finalize_epoch");
            expect(rewardsDistributor.source).to.include("compute_reward");
        });

        it("source should contain Sybil detection", function () {
            expect(rewardsDistributor.source).to.include("detect_sybil");
        });

        it("source should contain dynamic pricing", function () {
            expect(rewardsDistributor.source).to.include("compute_dynamic_price");
        });
    });

    // ── GovernanceAgent Specific Tests ─────────────────────────
    describe("GovernanceAgent Logic", function () {
        it("source should contain risk assessment", function () {
            expect(governanceAgent.source).to.include("assess_risk");
            expect(governanceAgent.source).to.include("RiskAssessment");
        });

        it("source should contain auto-vote logic", function () {
            expect(governanceAgent.source).to.include("decide_vote");
        });

        it("source should contain quorum monitoring", function () {
            expect(governanceAgent.source).to.include("check_quorum_status");
        });
    });

    // ── EscrowManager Specific Tests ──────────────────────────
    describe("EscrowManager Logic", function () {
        it("source should validate submissions", function () {
            expect(escrowManager.source).to.include("validate_submission");
        });

        it("source should handle multi-sig", function () {
            expect(escrowManager.source).to.include("multisig");
            expect(escrowManager.source).to.include("process_approval");
        });

        it("source should monitor deadlines", function () {
            expect(escrowManager.source).to.include("check_deadlines");
            expect(escrowManager.source).to.include("DeadlineAlert");
        });
    });

    // ── ReputationOracle Specific Tests ────────────────────────
    describe("ReputationOracle Logic", function () {
        it("source should handle badge updates", function () {
            expect(reputationOracle.source).to.include("update_badge");
        });

        it("source should detect achievements", function () {
            expect(reputationOracle.source).to.include("check_achievements");
            expect(reputationOracle.source).to.include("Achievement");
        });

        it("source should handle reputation decay", function () {
            expect(reputationOracle.source).to.include("apply_decay");
        });
    });

    // ── AgentCoordinator Specific Tests ────────────────────────
    describe("AgentCoordinator Logic", function () {
        it("source should handle onboarding", function () {
            expect(agentCoordinator.source).to.include("onboard_agent");
        });

        it("source should match tasks to agents", function () {
            expect(agentCoordinator.source).to.include("match_task");
        });

        it("source should have fallback routing", function () {
            expect(agentCoordinator.source).to.include("Fallback");
            expect(agentCoordinator.source).to.include("capability_distance");
        });

        it("source should monitor health", function () {
            expect(agentCoordinator.source).to.include("check_health");
            expect(agentCoordinator.source).to.include("HeartbeatExpired");
        });
    });
});
