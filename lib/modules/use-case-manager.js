/**
 * UseCaseManager — Approve, reject, and manage compute workloads
 *
 * Handles use case registration, policy enforcement, resource allocation,
 * and workload lifecycle management.
 */

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const USE_CASE_CATEGORIES = {
    AI_INFERENCE: "ai_inference",
    RENDERING: "rendering",
    FEDERATED_LEARNING: "federated_learning",
    EDGE_COMPUTING: "edge_computing",
    ZK_PROVING: "zk_proving",
    GAME_HOSTING: "game_hosting",
    SCIENTIFIC: "scientific",
    PRIVACY: "privacy",
    COMPUTE_NODE: "compute_node",
    STORAGE: "storage",
    FILE_SERVER: "file_server",
    REWARDED_TASKS: "rewarded_tasks",
    CUSTOM: "custom",
};

const APPROVAL_STATUS = {
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
    SUSPENDED: "suspended",
    EXPIRED: "expired",
};

class UseCaseManager {
    constructor(config = {}) {
        this.configPath = config.configPath || path.join(process.cwd(), ".fcm-usecases.json");
        this.permissionManager = config.permissionManager;
        this.useCases = new Map();
        this.workloads = new Map();
        this.bannedCategories = [];
        this.resourceLimits = {
            maxConcurrentTasks: 10,
            maxTaskDuration: 3600,
            maxRewardPerTask: ethers.parseEther("1000"),
            dailyTaskLimit: 100,
        };
        this._load();
    }

    // ── Use Case Registration ───────────────────────────────────

    /**
     * Register a new use case for approval
     */
    registerUseCase(requester, useCase) {
        const id = `uc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

        const entry = {
            id,
            requester: requester.toLowerCase(),
            name: useCase.name,
            description: useCase.description || "",
            category: useCase.category || USE_CASE_CATEGORIES.CUSTOM,
            workloadType: useCase.workloadType,
            requirements: useCase.requirements || {},
            estimatedCost: useCase.estimatedCost || "0",
            estimatedDuration: useCase.estimatedDuration || 0,
            dataPolicy: useCase.dataPolicy || "standard",  // "standard", "sensitive", "encrypted"
            status: APPROVAL_STATUS.PENDING,
            submittedAt: new Date().toISOString(),
            reviewedAt: null,
            reviewer: null,
            rejectionReason: null,
            expiresAt: useCase.expiresAt || null,
        };

        this.useCases.set(id, entry);
        this._save();
        return entry;
    }

    /**
     * Approve a use case
     */
    approveUseCase(useCaseId, reviewer, conditions = {}) {
        const uc = this._getUseCase(useCaseId);

        // Check reviewer permissions
        if (this.permissionManager) {
            this.permissionManager.requirePermission(reviewer, "system:config");
        }

        // Policy check
        const policyResult = this.evaluateUseCase(uc);
        if (!policyResult.approved) {
            return {
                status: "blocked",
                message: "Use case violates policies",
                violations: policyResult.violations,
            };
        }

        uc.status = APPROVAL_STATUS.APPROVED;
        uc.reviewedAt = new Date().toISOString();
        uc.reviewer = reviewer.toLowerCase();
        uc.conditions = conditions;
        uc.approvedAt = new Date().toISOString();

        this._save();
        return { status: "approved", useCase: uc };
    }

    /**
     * Reject a use case
     */
    rejectUseCase(useCaseId, reviewer, reason) {
        const uc = this._getUseCase(useCaseId);

        if (this.permissionManager) {
            this.permissionManager.requirePermission(reviewer, "system:config");
        }

        uc.status = APPROVAL_STATUS.REJECTED;
        uc.reviewedAt = new Date().toISOString();
        uc.reviewer = reviewer.toLowerCase();
        uc.rejectionReason = reason;

        this._save();
        return { status: "rejected", useCase: uc };
    }

    /**
     * Suspend a previously approved use case
     */
    suspendUseCase(useCaseId, reviewer, reason) {
        const uc = this._getUseCase(useCaseId);
        // M-12: Add missing permission check
        if (this.permissionManager) {
            this.permissionManager.requirePermission(reviewer, "system:config");
        }
        uc.status = APPROVAL_STATUS.SUSPENDED;
        uc.suspensionReason = reason;
        uc.suspendedAt = new Date().toISOString();
        this._save();
        return { status: "suspended", useCase: uc };
    }

    // ── Workload Management ─────────────────────────────────────

    /**
     * Submit a workload under an approved use case
     */
    submitWorkload(submitter, useCaseId, workload) {
        const uc = this._getUseCase(useCaseId);

        if (uc.status !== APPROVAL_STATUS.APPROVED) {
            return { status: "rejected", message: `Use case ${useCaseId} is not approved (status: ${uc.status})` };
        }

        // Check submitter permissions
        if (this.permissionManager && submitter !== uc.requester) {
            if (!this.permissionManager.hasPermission(submitter, "task:create")) {
                return { status: "rejected", message: "Insufficient permissions" };
            }
        }

        // Resource limit checks
        const activeWorkloads = [...this.workloads.values()].filter(
            w => w.status === "active" && w.useCaseId === useCaseId
        );
        if (activeWorkloads.length >= this.resourceLimits.maxConcurrentTasks) {
            return { status: "rejected", message: "Concurrent task limit reached" };
        }

        const id = `wl-${Date.now().toString(36)}`;
        const entry = {
            id,
            useCaseId,
            submitter: submitter.toLowerCase(),
            type: workload.type || uc.workloadType,
            input: workload.input || null,
            requirements: workload.requirements || uc.requirements,
            priority: workload.priority || "normal",
            maxReward: workload.maxReward || uc.estimatedCost,
            deadline: workload.deadline || Date.now() + (this.resourceLimits.maxTaskDuration * 1000),
            status: "active",
            submittedAt: new Date().toISOString(),
            assignedTo: null,
            result: null,
        };

        this.workloads.set(id, entry);
        this._save();
        return { status: "submitted", workload: entry };
    }

    /**
     * Complete a workload with results
     */
    completeWorkload(workloadId, result) {
        const wl = this._getWorkload(workloadId);
        wl.status = "completed";
        wl.completedAt = new Date().toISOString();
        wl.result = result;
        this._save();
        return { status: "completed", workload: wl };
    }

    /**
     * Fail a workload
     */
    failWorkload(workloadId, reason) {
        const wl = this._getWorkload(workloadId);
        wl.status = "failed";
        wl.failedAt = new Date().toISOString();
        wl.failureReason = reason;
        this._save();
        return { status: "failed", workload: wl };
    }

    // ── Policy Evaluation ───────────────────────────────────────

    /**
     * Evaluate a use case against all active policies
     */
    evaluateUseCase(useCase) {
        const violations = [];

        // Check banned categories
        if (this.bannedCategories.includes(useCase.category)) {
            violations.push({
                type: "banned_category",
                message: `Category "${useCase.category}" is banned`,
            });
        }

        // Check data policy
        if (useCase.dataPolicy === "sensitive" && useCase.category !== USE_CASE_CATEGORIES.FEDERATED_LEARNING) {
            violations.push({
                type: "data_policy",
                message: "Sensitive data requires federated learning category",
            });
        }

        // Check resource limits (M-13: safe BigInt comparison)
        try {
            const cost = BigInt(ethers.parseEther(String(useCase.estimatedCost || "0")));
            if (cost > this.resourceLimits.maxRewardPerTask) {
                violations.push({
                    type: "reward_limit",
                    message: `Reward ${useCase.estimatedCost} exceeds maximum ${ethers.formatEther(this.resourceLimits.maxRewardPerTask)}`,
                });
            }
        } catch { /* invalid cost format — skip check */ }

        // Permission manager policies
        if (this.permissionManager) {
            const pmResult = this.permissionManager.evaluatePolicies({
                category: useCase.category,
                workloadType: useCase.workloadType,
                requirements: useCase.requirements,
            });
            violations.push(...pmResult.violations);
        }

        return {
            approved: violations.length === 0,
            violations,
        };
    }

    // ── Queries ─────────────────────────────────────────────────

    /**
     * Get all use cases for a requester
     */
    getUserUseCases(requester) {
        return [...this.useCases.values()].filter(uc => uc.requester === requester.toLowerCase());
    }

    /**
     * Get all pending use cases
     */
    getPendingUseCases() {
        return [...this.useCases.values()].filter(uc => uc.status === APPROVAL_STATUS.PENDING);
    }

    /**
     * Get active workloads
     */
    getActiveWorkloads() {
        return [...this.workloads.values()].filter(w => w.status === "active");
    }

    /**
     * Get summary statistics
     */
    getSummary() {
        const ucs = [...this.useCases.values()];
        const wls = [...this.workloads.values()];

        return {
            useCases: {
                total: ucs.length,
                pending: ucs.filter(uc => uc.status === APPROVAL_STATUS.PENDING).length,
                approved: ucs.filter(uc => uc.status === APPROVAL_STATUS.APPROVED).length,
                rejected: ucs.filter(uc => uc.status === APPROVAL_STATUS.REJECTED).length,
                suspended: ucs.filter(uc => uc.status === APPROVAL_STATUS.SUSPENDED).length,
            },
            workloads: {
                total: wls.length,
                active: wls.filter(w => w.status === "active").length,
                completed: wls.filter(w => w.status === "completed").length,
                failed: wls.filter(w => w.status === "failed").length,
            },
            categories: Object.fromEntries(
                Object.values(USE_CASE_CATEGORIES).map(c => [
                    c, ucs.filter(uc => uc.category === c).length,
                ])
            ),
            limits: this.resourceLimits,
        };
    }

    // ── Internal ────────────────────────────────────────────────

    _getUseCase(id) {
        const uc = this.useCases.get(id);
        if (!uc) throw new Error(`Use case not found: ${id}`);
        return uc;
    }

    _getWorkload(id) {
        const wl = this.workloads.get(id);
        if (!wl) throw new Error(`Workload not found: ${id}`);
        return wl;
    }

    _load() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = JSON.parse(fs.readFileSync(this.configPath, "utf8"));
                this.useCases = new Map((data.useCases || []).map(uc => [uc.id, uc]));
                this.workloads = new Map((data.workloads || []).map(w => [w.id, w]));
                this.bannedCategories = data.bannedCategories || [];
                if (data.resourceLimits) this.resourceLimits = { ...this.resourceLimits, ...data.resourceLimits };
            }
        } catch { /* fresh start */ }
    }

    _save() {
        try {
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const data = {
                useCases: [...this.useCases.values()],
                workloads: [...this.workloads.values()],
                bannedCategories: this.bannedCategories,
                resourceLimits: Object.fromEntries(
                    Object.entries(this.resourceLimits).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v])
                ),
            };
            const tmpPath = this.configPath + '.tmp';
            fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
            fs.renameSync(tmpPath, this.configPath);
        } catch { /* non-critical */ }
    }
}

module.exports = { UseCaseManager, USE_CASE_CATEGORIES, APPROVAL_STATUS };
