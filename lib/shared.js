/**
 * FCM Shared Utilities
 *
 * Deduplicated constants, utility functions, and helpers
 * used across agents, modules, and tests.
 */

const { ethers } = require("ethers");

// ─── Agent Types ──────────────────────────────────────────────

const AGENT_TYPES = {
    inference: 0,
    render: 1,
    federated_learning: 2,
    edge: 3,
    zk_prover: 4,
    game: 5,
    science: 6,
    privacy: 7,
    node: 8,
    storage: 9,
    file_server: 10,
    rewarded: 11,
};

const AGENT_TYPE_NAMES = Object.fromEntries(
    Object.entries(AGENT_TYPES).map(([k, v]) => [v, k])
);

const AGENT_ICONS = {
    inference: "🧠",
    render: "🎨",
    federated_learning: "🔬",
    edge: "🌐",
    zk_prover: "🔐",
    game: "🎮",
    science: "⚗️",
    privacy: "🕶️",
    node: "🖥️",
    storage: "💾",
    file_server: "📁",
    rewarded: "💰",
};

// ─── Capability Bits ──────────────────────────────────────────

const CAPABILITIES = {
    GPU:        0x01n,
    CUDA:       0x02n,
    AVX2:       0x04n,
    AVX512:     0x08n,
    TEE:        0x10n,
    HPC:        0x20n,
    LOW_LATENCY:0x40n,
    BANDWIDTH:  0x80n,
    STORAGE:    0x100n,
    IPFS:       0x200n,
    HTTP:       0x400n,
    EDGE:       0x800n,
    WASM:       0x1000n,
    ML:         0x2000n,
    PRIVACY:    0x4000n,
    REWARD:     0x8000n,
};

function encodeCapabilities(capString) {
    const parts = capString.toLowerCase().split(",").map(s => s.trim());
    let bits = 0n;
    for (const part of parts) {
        const key = part.replace(/[- ]/g, "_").toUpperCase();
        if (CAPABILITIES[key] !== undefined) {
            bits |= CAPABILITIES[key];
        } else {
            // Fallback: hash the string into a bit position
            const hash = BigInt(ethers.keccak256(ethers.toUtf8Bytes(part)));
            bits |= (1n << (hash % 16n));
        }
    }
    return ethers.zeroPadValue(ethers.toBeHex(bits), 32);
}

function decodeCapabilities(capBytes) {
    const bits = BigInt(capBytes);
    const result = [];
    for (const [name, bit] of Object.entries(CAPABILITIES)) {
        if ((bits & bit) !== 0n) {
            result.push(name);
        }
    }
    return result;
}

function hasCapability(agentCaps, requiredCaps) {
    return (BigInt(agentCaps) & BigInt(requiredCaps)) === BigInt(requiredCaps);
}

// ─── Stakes ───────────────────────────────────────────────────

const MIN_STAKES = {
    inference: 500,
    render: 500,
    federated_learning: 1000,
    edge: 500,
    zk_prover: 750,
    game: 500,
    science: 500,
    privacy: 1000,
    node: 100,
    storage: 250,
    file_server: 250,
    rewarded: 50,
};

function getMinStake(agentType) {
    const stake = MIN_STAKES[agentType];
    if (stake === undefined) throw new Error(`Unknown agent type: ${agentType}`);
    return ethers.parseEther(String(stake));
}

// ─── Geohash ──────────────────────────────────────────────────

function encodeGeohash(geo) {
    return ethers.encodeBytes32String(geo);
}

// ─── DidHash ──────────────────────────────────────────────────

function computeDidHash(name) {
    return ethers.keccak256(ethers.toUtf8Bytes(name));
}

// ─── Retry with Exponential Backoff ───────────────────────────

async function withRetry(fn, { maxRetries = 3, baseDelay = 1000, maxDelay = 30000, logger = null } = {}) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn(attempt);
        } catch (err) {
            lastError = err;

            // Don't retry on certain errors
            if (err.message?.includes("already known") ||
                err.message?.includes("nonce too low") ||
                err.message?.includes("invalid signature") ||
                err.message?.includes("execution reverted")) {
                throw err;
            }

            if (attempt < maxRetries) {
                const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 1000, maxDelay);
                if (logger) logger.warn(`Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms: ${err.message}`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
}

// ─── File Locking ─────────────────────────────────────────────

const locks = new Map();

async function withFileLock(filePath, fn) {
    // Spin-wait for lock
    while (locks.get(filePath)) {
        await new Promise(r => setTimeout(r, 50));
    }
    locks.set(filePath, true);
    try {
        return await fn();
    } finally {
        locks.delete(filePath);
    }
}

// ─── JSON Safe Read/Write ─────────────────────────────────────

const fs = require("fs/promises");
const path = require("path");

async function safeReadJSON(filePath, defaultValue = {}) {
    try {
        const data = await fs.readFile(filePath, "utf8");
        return JSON.parse(data);
    } catch {
        return defaultValue;
    }
}

async function safeWriteJSON(filePath, data) {
    await withFileLock(filePath, async () => {
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        const tmpPath = filePath + ".tmp";
        await fs.writeFile(tmpPath, JSON.stringify(data, (key, val) =>
            typeof val === "bigint" ? `__bigint__${val.toString()}` : val, 2));
        await fs.rename(tmpPath, filePath);
    });
}

function parseBigIntJSON(data) {
    if (typeof data === "string") return data;
    return JSON.parse(JSON.stringify(data), (key, val) => {
        if (typeof val === "string" && val.startsWith("__bigint__")) {
            return BigInt(val.slice(10));
        }
        return val;
    });
}

// ─── Exports ──────────────────────────────────────────────────

module.exports = {
    AGENT_TYPES,
    AGENT_TYPE_NAMES,
    AGENT_ICONS,
    CAPABILITIES,
    encodeCapabilities,
    decodeCapabilities,
    hasCapability,
    MIN_STAKES,
    getMinStake,
    encodeGeohash,
    computeDidHash,
    withRetry,
    withFileLock,
    safeReadJSON,
    safeWriteJSON,
    parseBigIntJSON,
};
