/**
 * SettingsManager — Persistent configuration with validation and defaults
 *
 * Manages global settings, per-agent configurations, and environment overrides.
 * Supports hot-reload, validation, and change notifications.
 */

const fs = require("fs");
const path = require("path");

// ── Default Settings Schema ─────────────────────────────────────

const DEFAULT_SETTINGS = {
    // Network
    "network.rpcUrl": { default: "http://localhost:8545", type: "string", description: "Blockchain RPC endpoint" },
    "network.registryAddress": { default: "", type: "string", description: "FCMAgentRegistry contract address" },
    "network.tokenAddress": { default: "", type: "string", description: "FCMToken contract address" },
    "network.chainId": { default: 8453, type: "number", description: "Target chain ID" },

    // Agent defaults
    "agent.heartbeatInterval": { default: 120, type: "number", min: 30, max: 600, description: "Heartbeat interval in seconds" },
    "agent.autoStart": { default: false, type: "boolean", description: "Auto-start agents on launch" },
    "agent.defaultGeohash": { default: "u4pru", type: "string", description: "Default geohash for new agents" },
    "agent.maxConcurrent": { default: 5, type: "number", min: 1, max: 100, description: "Max concurrent agents" },

    // Task defaults
    "task.maxRetries": { default: 3, type: "number", min: 0, max: 10, description: "Max task retry attempts" },
    "task.timeoutSeconds": { default: 3600, type: "number", min: 60, max: 86400, description: "Task execution timeout" },
    "task.autoClaim": { default: true, type: "boolean", description: "Auto-claim matching tasks" },

    // Financial
    "finance.defaultStake": { default: 500, type: "number", min: 100, description: "Default stake amount in FCM" },
    "finance.minBalance": { default: 10, type: "number", min: 0, description: "Minimum balance warning threshold" },
    "finance.autoWithdraw": { default: false, type: "boolean", description: "Auto-withdraw rewards after dispute window" },

    // Security
    "security.maxFailedHeartbeats": { default: 5, type: "number", description: "Max failed heartbeats before auto-stop" },
    "security.requireApproval": { default: true, type: "boolean", description: "Require admin approval for new agents" },
    "security.allowedWorkloads": { default: "*", type: "string", description: "Comma-separated allowed workload types or * for all" },

    // Logging
    "logging.level": { default: "info", type: "string", enum: ["debug", "info", "warn", "error"], description: "Log level" },
    "logging.file": { default: "", type: "string", description: "Log file path (empty = stdout)" },
    "logging.maxSizeMB": { default: 10, type: "number", description: "Max log file size before rotation" },

    // Dashboard
    "dashboard.enabled": { default: true, type: "boolean", description: "Enable web dashboard" },
    "dashboard.port": { default: 8080, type: "number", description: "Dashboard port" },
    "dashboard.refreshInterval": { default: 2, type: "number", description: "Dashboard refresh interval in seconds" },
};

class SettingsManager {
    constructor(configPath) {
        this.configPath = configPath || path.join(process.cwd(), ".fcm-settings.json");
        this.settings = {};
        this.overrides = {};   // Runtime overrides (not persisted)
        this.listeners = new Map();
        this.schema = { ...DEFAULT_SETTINGS };
        this._load();
    }

    // ── Core API ────────────────────────────────────────────────

    /**
     * Get a setting value (checks overrides → persisted → defaults)
     */
    get(key, defaultValue) {
        // Check runtime overrides first
        if (key in this.overrides) return this.overrides[key];
        // Check persisted settings
        if (key in this.settings) return this.settings[key];
        // Check schema defaults
        if (key in this.schema) return this.schema[key].default;
        // Return provided default
        return defaultValue;
    }

    /**
     * Set a setting value with validation
     */
    set(key, value) {
        const schemaEntry = this.schema[key];

        // Validate against schema
        if (schemaEntry) {
            value = this._validate(key, value, schemaEntry);
        }

        const oldValue = this.get(key);
        this.settings[key] = value;
        this._save();

        // Notify listeners
        this._emit(key, value, oldValue);
        return true;
    }

    /**
     * Set a runtime override (not persisted, lost on restart)
     */
    override(key, value) {
        this.overrides[key] = value;
        this._emit(key, value, this.get(key));
    }

    /**
     * Clear a runtime override
     */
    clearOverride(key) {
        delete this.overrides[key];
    }

    /**
     * Get all settings (merged: defaults + persisted + overrides)
     */
    getAll() {
        const result = {};
        for (const [key, schema] of Object.entries(this.schema)) {
            result[key] = this.get(key);
        }
        // Include any non-schema settings
        for (const [key, value] of Object.entries(this.settings)) {
            if (!(key in result)) result[key] = value;
        }
        for (const [key, value] of Object.entries(this.overrides)) {
            result[key] = value;
        }
        return result;
    }

    /**
     * Reset a setting to its default value
     */
    reset(key) {
        delete this.settings[key];
        delete this.overrides[key];
        this._save();
        this._emit(key, this.get(key), null);
    }

    /**
     * Reset all settings to defaults
     */
    resetAll() {
        this.settings = {};
        this.overrides = {};
        this._save();
    }

    // ── Schema Management ───────────────────────────────────────

    /**
     * Register a custom setting schema
     */
    registerSchema(key, schema) {
        this.schema[key] = {
            default: schema.default,
            type: schema.type || "string",
            description: schema.description || "",
            min: schema.min,
            max: schema.max,
            enum: schema.enum,
        };
    }

    /**
     * Get schema for a setting
     */
    getSchema(key) {
        return this.schema[key] || null;
    }

    /**
     * Get full schema
     */
    getFullSchema() {
        return { ...this.schema };
    }

    // ── Event System ────────────────────────────────────────────

    /**
     * Listen for setting changes
     */
    onChange(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);
    }

    /**
     * Remove a listener
     */
    offChange(key, callback) {
        const cbs = this.listeners.get(key) || [];
        this.listeners.set(key, cbs.filter(cb => cb !== callback));
    }

    // ── Import/Export ───────────────────────────────────────────

    /**
     * Export all settings as JSON
     */
    export() {
        return JSON.stringify(this.getAll(), null, 2);
    }

    /**
     * Import settings from JSON (merges with existing)
     */
    import(jsonString) {
        const data = JSON.parse(jsonString);
        // Prototype pollution guard
        const BLOCKED_KEYS = ['__proto__', 'constructor', 'prototype'];
        for (const [key, value] of Object.entries(data)) {
            if (BLOCKED_KEYS.includes(key)) continue;
            try {
                this.set(key, value);
            } catch (e) {
                // Skip invalid settings during import
            }
        }
    }

    // ── Per-Agent Settings ──────────────────────────────────────

    /**
     * Get settings for a specific agent
     */
    getAgentSettings(agentId) {
        return this.get(`agent.${agentId}`, {});
    }

    /**
     * Update settings for a specific agent
     */
    setAgentSettings(agentId, settings) {
        const existing = this.getAgentSettings(agentId);
        this.set(`agent.${agentId}`, { ...existing, ...settings });
    }

    // ── Internal ────────────────────────────────────────────────

    _validate(key, value, schema) {
        // Type check
        if (schema.type === "number" && typeof value !== "number") {
            const parsed = Number(value);
            if (isNaN(parsed)) throw new Error(`Setting "${key}" must be a number`);
            value = parsed;
        }
        if (schema.type === "boolean") {
            if (typeof value === "string") value = value === "true";
        }
        if (schema.type === "string" && typeof value !== "string") {
            value = String(value);
        }

        // Range check
        if (schema.min !== undefined && value < schema.min) {
            throw new Error(`Setting "${key}" must be >= ${schema.min}`);
        }
        if (schema.max !== undefined && value > schema.max) {
            throw new Error(`Setting "${key}" must be <= ${schema.max}`);
        }

        // Enum check
        if (schema.enum && !schema.enum.includes(value)) {
            throw new Error(`Setting "${key}" must be one of: ${schema.enum.join(", ")}`);
        }

        return value;
    }

    _emit(key, newValue, oldValue) {
        const cbs = this.listeners.get(key) || [];
        for (const cb of cbs) {
            try { cb(newValue, oldValue, key); } catch { /* listener error */ }
        }
    }

    _load() {
        try {
            if (fs.existsSync(this.configPath)) {
                this.settings = JSON.parse(fs.readFileSync(this.configPath, "utf8"));
            }
        } catch { /* fresh start */ }
    }

    _save() {
        try {
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const tmpPath = this.configPath + '.tmp';
            fs.writeFileSync(tmpPath, JSON.stringify(this.settings, null, 2));
            fs.renameSync(tmpPath, this.configPath);
        } catch { /* non-critical */ }
    }
}

module.exports = { SettingsManager, DEFAULT_SETTINGS };
