/**
 * PermissionManager — Role-based access control and capability gating
 *
 * Manages user roles, agent permissions, workload approvals,
 * and resource access policies.
 */

const fs = require("fs");
const path = require("path");

const ROLES = {
    SUPER_ADMIN: "super_admin",
    ADMIN: "admin",
    OPERATOR: "operator",
    PROVIDER: "provider",
    CONSUMER: "consumer",
    VIEWER: "viewer",
};

const PERMISSIONS = {
    // Agent management
    AGENT_REGISTER: "agent:register",
    AGENT_START: "agent:start",
    AGENT_STOP: "agent:stop",
    AGENT_CONFIGURE: "agent:configure",

    // Task management
    TASK_CREATE: "task:create",
    TASK_CLAIM: "task:claim",
    TASK_CANCEL: "task:cancel",
    TASK_DISPUTE: "task:dispute",

    // Financial
    TOKEN_TRANSFER: "token:transfer",
    TOKEN_STAKE: "token:stake",
    TOKEN_UNSTAKE: "token:unstake",
    WITHDRAW_REWARD: "token:withdraw",

    // System
    SYSTEM_CONFIG: "system:config",
    SYSTEM_AUDIT: "system:audit",
    SYSTEM_SHUTDOWN: "system:shutdown",

    // Network
    NETWORK_JOIN: "network:join",
    NETWORK_EXIT: "network:exit",
    HEARTBEAT_SUBMIT: "heartbeat:submit",
};

// Role → Permission mappings
const ROLE_PERMISSIONS = {
    [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
    [ROLES.ADMIN]: [
        PERMISSIONS.AGENT_REGISTER, PERMISSIONS.AGENT_START, PERMISSIONS.AGENT_STOP,
        PERMISSIONS.AGENT_CONFIGURE, PERMISSIONS.TASK_CREATE, PERMISSIONS.TASK_CLAIM,
        PERMISSIONS.TASK_CANCEL, PERMISSIONS.TASK_DISPUTE, PERMISSIONS.TOKEN_TRANSFER,
        PERMISSIONS.TOKEN_STAKE, PERMISSIONS.TOKEN_UNSTAKE, PERMISSIONS.WITHDRAW_REWARD,
        PERMISSIONS.SYSTEM_CONFIG, PERMISSIONS.SYSTEM_AUDIT, PERMISSIONS.NETWORK_JOIN,
        PERMISSIONS.HEARTBEAT_SUBMIT,
    ],
    [ROLES.OPERATOR]: [
        PERMISSIONS.AGENT_START, PERMISSIONS.AGENT_STOP, PERMISSIONS.AGENT_CONFIGURE,
        PERMISSIONS.TASK_CLAIM, PERMISSIONS.TASK_CREATE, PERMISSIONS.WITHDRAW_REWARD,
        PERMISSIONS.TOKEN_STAKE, PERMISSIONS.NETWORK_JOIN, PERMISSIONS.HEARTBEAT_SUBMIT,
    ],
    [ROLES.PROVIDER]: [
        PERMISSIONS.TASK_CLAIM, PERMISSIONS.WITHDRAW_REWARD,
        PERMISSIONS.NETWORK_JOIN, PERMISSIONS.HEARTBEAT_SUBMIT,
    ],
    [ROLES.CONSUMER]: [
        PERMISSIONS.TASK_CREATE, PERMISSIONS.TASK_DISPUTE,
        PERMISSIONS.TOKEN_TRANSFER, PERMISSIONS.NETWORK_JOIN,
    ],
    [ROLES.VIEWER]: [
        PERMISSIONS.SYSTEM_AUDIT,
    ],
};

class PermissionManager {
    constructor(configPath) {
        this.configPath = configPath || path.join(process.cwd(), ".fcm-permissions.json");
        this.users = new Map();   // address → { role, permissions, reputation, stake }
        this.agents = new Map();  // didHash → { owner, permissions, capabilities }
        this.policies = [];
        this._load();
    }

    // ── User Management ─────────────────────────────────────────

    /**
     * Register a new user with a role
     */
    addUser(address, role = ROLES.CONSUMER, options = {}) {
        const normalized = address.toLowerCase();
        const user = {
            address: normalized,
            role,
            permissions: ROLE_PERMISSIONS[role] || [],
            customPermissions: options.permissions || [],
            reputation: options.reputation || 500,
            stake: options.stake || 0,
            registeredAt: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            banned: false,
            metadata: options.metadata || {},
        };
        this.users.set(normalized, user);
        this._save();
        return user;
    }

    /**
     * Update a user's role
     */
    updateUserRole(address, newRole) {
        const user = this._getOrCreateUser(address);
        user.role = newRole;
        user.permissions = ROLE_PERMISSIONS[newRole] || [];
        this._save();
        return user;
    }

    /**
     * Grant a specific permission to a user
     */
    grantPermission(address, permission) {
        const user = this._getOrCreateUser(address);
        if (!user.customPermissions.includes(permission)) {
            user.customPermissions.push(permission);
        }
        this._save();
        return user;
    }

    /**
     * Revoke a specific permission from a user
     */
    revokePermission(address, permission) {
        const user = this._getOrCreateUser(address);
        user.customPermissions = user.customPermissions.filter(p => p !== permission);
        this._save();
        return user;
    }

    /**
     * Ban a user from the network
     */
    banUser(address, reason = "No reason provided") {
        const user = this._getOrCreateUser(address);
        user.banned = true;
        user.banReason = reason;
        user.bannedAt = new Date().toISOString();
        this._save();
        return user;
    }

    /**
     * Unban a user
     */
    unbanUser(address) {
        const user = this._getOrCreateUser(address);
        user.banned = false;
        delete user.banReason;
        delete user.bannedAt;
        this._save();
        return user;
    }

    // ── Permission Checking ─────────────────────────────────────

    /**
     * Check if a user has a specific permission
     */
    hasPermission(address, permission) {
        const user = this.users.get(address.toLowerCase());
        if (!user) return false;
        if (user.banned) return false;
        return user.permissions.includes(permission) || user.customPermissions.includes(permission);
    }

    /**
     * Require a permission — throws if not granted
     */
    requirePermission(address, permission) {
        if (!this.hasPermission(address, permission)) {
            const user = this.users.get(address.toLowerCase());
            const role = user?.role || "none";
            throw new Error(
                `Permission denied: ${permission} required for ${address} (role: ${role})`
            );
        }
    }

    /**
     * Get all effective permissions for a user
     */
    getEffectivePermissions(address) {
        const user = this.users.get(address.toLowerCase());
        if (!user) return [];
        return [...new Set([...user.permissions, ...user.customPermissions])];
    }

    // ── Agent Management ────────────────────────────────────────

    /**
     * Register an agent with permission checks
     */
    registerAgent(ownerAddress, didHash, capabilities = []) {
        this.requirePermission(ownerAddress, PERMISSIONS.AGENT_REGISTER);

        const agent = {
            didHash,
            owner: ownerAddress.toLowerCase(),
            permissions: [PERMISSIONS.HEARTBEAT_SUBMIT, PERMISSIONS.TASK_CLAIM],
            capabilities,
            registeredAt: new Date().toISOString(),
            active: true,
        };
        this.agents.set(didHash, agent);
        this._save();
        return agent;
    }

    /**
     * Check if an agent can perform an action
     */
    agentHasPermission(didHash, permission) {
        const agent = this.agents.get(didHash);
        if (!agent || !agent.active) return false;
        return agent.permissions.includes(permission);
    }

    // ── Policy Engine ───────────────────────────────────────────

    /**
     * Add a usage policy (e.g., "no crypto mining", "no weapons sim")
     */
    addPolicy(policy) {
        const entry = {
            id: `policy-${Date.now()}`,
            name: policy.name,
            description: policy.description || "",
            type: policy.type || "deny",  // "deny" | "require" | "limit"
            target: policy.target,         // workload type or capability
            rules: policy.rules || [],
            enabled: true,
            createdAt: new Date().toISOString(),
        };
        this.policies.push(entry);
        this._save();
        return entry;
    }

    /**
     * Evaluate all policies against a proposed workload
     */
    evaluatePolicies(workload) {
        const violations = [];
        const warnings = [];

        for (const policy of this.policies) {
            if (!policy.enabled) continue;

            if (policy.type === "deny") {
                for (const rule of policy.rules) {
                    if (this._matchesRule(workload, rule)) {
                        violations.push({
                            policy: policy.name,
                            rule: rule,
                            message: `Blocked by policy "${policy.name}": ${rule.description || rule.pattern}`,
                        });
                    }
                }
            }

            if (policy.type === "require") {
                for (const rule of policy.rules) {
                    if (!this._matchesRule(workload, rule)) {
                        violations.push({
                            policy: policy.name,
                            rule: rule,
                            message: `Required by policy "${policy.name}": ${rule.description || rule.pattern}`,
                        });
                    }
                }
            }

            if (policy.type === "limit") {
                for (const rule of policy.rules) {
                    if (this._exceedsLimit(workload, rule)) {
                        warnings.push({
                            policy: policy.name,
                            rule: rule,
                            message: `Warning from policy "${policy.name}": ${rule.description || rule.pattern}`,
                        });
                    }
                }
            }
        }

        return {
            approved: violations.length === 0,
            violations,
            warnings,
        };
    }

    // ── Reputation ──────────────────────────────────────────────

    /**
     * Update a user's reputation score
     */
    updateReputation(address, delta) {
        const user = this._getOrCreateUser(address);
        user.reputation = Math.max(0, Math.min(10000, user.reputation + delta));
        this._save();
        return user.reputation;
    }

    /**
     * Get reputation tier
     */
    getReputationTier(address) {
        const user = this.users.get(address.toLowerCase());
        const rep = user?.reputation || 0;
        if (rep >= 9000) return { tier: "legendary", color: "gold" };
        if (rep >= 7000) return { tier: "trusted", color: "green" };
        if (rep >= 5000) return { tier: "established", color: "blue" };
        if (rep >= 2000) return { tier: "newcomer", color: "gray" };
        return { tier: "unverified", color: "red" };
    }

    // ── Summary ─────────────────────────────────────────────────

    /**
     * Full permission audit for a user
     */
    auditUser(address) {
        const user = this.users.get(address.toLowerCase());
        if (!user) return null;

        return {
            address: user.address,
            role: user.role,
            banned: user.banned,
            reputation: user.reputation,
            tier: this.getReputationTier(address),
            effectivePermissions: this.getEffectivePermissions(address),
            agents: [...this.agents.values()].filter(a => a.owner === user.address).map(a => ({
                didHash: a.didHash,
                capabilities: a.capabilities,
                active: a.active,
            })),
            registeredAt: user.registeredAt,
            lastActive: user.lastActive,
        };
    }

    /**
     * Network-wide summary
     */
    getNetworkSummary() {
        const users = [...this.users.values()];
        const agents = [...this.agents.values()];
        return {
            totalUsers: users.length,
            activeUsers: users.filter(u => !u.banned).length,
            bannedUsers: users.filter(u => u.banned).length,
            roleBreakdown: Object.fromEntries(
                Object.values(ROLES).map(r => [r, users.filter(u => u.role === r).length])
            ),
            totalAgents: agents.length,
            activeAgents: agents.filter(a => a.active).length,
            totalPolicies: this.policies.length,
            activePolicies: this.policies.filter(p => p.enabled).length,
        };
    }

    // ── Internal ────────────────────────────────────────────────

    _getUser(address) {
        const normalized = address.toLowerCase();
        return this.users.get(normalized) || null;
    }

    _getOrCreateUser(address) {
        const normalized = address.toLowerCase();
        if (!this.users.has(normalized)) {
            this.addUser(normalized);
        }
        return this.users.get(normalized);
    }

    _matchesRule(workload, rule) {
        if (rule.field && rule.pattern) {
            const value = this._getNestedField(workload, rule.field);
            if (typeof rule.pattern === "string") {
                return value?.toString().toLowerCase().includes(rule.pattern.toLowerCase());
            }
            if (rule.pattern instanceof RegExp) {
                return rule.pattern.test(value?.toString() || "");
            }
        }
        return false;
    }

    _exceedsLimit(workload, rule) {
        if (rule.field && rule.max !== undefined) {
            const value = this._getNestedField(workload, rule.field);
            return Number(value) > rule.max;
        }
        return false;
    }

    _getNestedField(obj, field) {
        return field.split(".").reduce((o, k) => o?.[k], obj);
    }

    _load() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = JSON.parse(fs.readFileSync(this.configPath, "utf8"));
                this.users = new Map((data.users || []).map(u => [u.address, u]));
                this.agents = new Map((data.agents || []).map(a => [a.didHash, a]));
                this.policies = data.policies || [];
            }
        } catch { /* fresh start */ }
    }

    _save() {
        try {
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const data = JSON.stringify({
                users: [...this.users.values()],
                agents: [...this.agents.values()],
                policies: this.policies,
            }, null, 2);
            const tmpPath = this.configPath + '.tmp';
            fs.writeFileSync(tmpPath, data);
            fs.renameSync(tmpPath, this.configPath);
        } catch { /* non-critical */ }
    }
}

module.exports = { PermissionManager, ROLES, PERMISSIONS, ROLE_PERMISSIONS };
