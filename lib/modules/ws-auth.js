/**
 * FCM WebSocket & HTTP Auth
 *
 * HMAC-SHA256 token-based authentication for WebSocket connections
 * and HTTP API endpoints. Tokens encode wallet address, role,
 * permissions, and expiration.
 *
 * Protocol:
 *   1. Client POSTs to /api/auth/login with { address, signature? }
 *   2. Server generates token: base64({ address, role, perms, exp, iat })
 *   3. Client sends token as query param ?token=... on WS upgrade
 *   4. Server validates HMAC signature and checks expiration
 */

const crypto = require("crypto");

// Default secret — override via FCM_AUTH_SECRET env var
const DEFAULT_SECRET = "fcm-default-secret-change-in-production-" + Date.now();

// Token TTL: 24 hours
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

// Role → permissions mapping
const ROLE_PERMISSIONS = {
    admin: [
        "dashboard:view", "agents:view", "marketplace:view", "governance:view",
        "reputation:view", "resources:view", "staking:view", "escrow:view",
        "chat:view", "chat:send", "settings:view", "settings:edit",
        "admin:view", "admin:manage", "admin:roles", "admin:pause",
        "agents:focus", "tasks:claim", "staking:stake", "staking:unstake",
        "governance:vote", "governance:create", "escrow:approve",
        "system:config", "system:emergency",
    ],
    operator: [
        "dashboard:view", "agents:view", "marketplace:view", "governance:view",
        "reputation:view", "resources:view", "staking:view", "escrow:view",
        "chat:view", "chat:send", "settings:view", "settings:edit",
        "agents:focus", "tasks:claim", "staking:stake", "staking:unstake",
        "governance:vote", "governance:create", "escrow:approve",
    ],
    viewer: [
        "dashboard:view", "agents:view", "marketplace:view", "governance:view",
        "reputation:view", "resources:view", "agents:focus",
    ],
};

class WsAuth {
    /**
     * @param {Object} config
     * @param {string} config.secret - HMAC signing secret (default: random)
     * @param {number} config.tokenTtlMs - Token lifetime in ms (default: 24h)
     * @param {boolean} config.authRequired - Whether auth is enforced (default: true)
     */
    constructor(config = {}) {
        this.secret = config.secret || process.env.FCM_AUTH_SECRET || DEFAULT_SECRET;
        this.tokenTtlMs = config.tokenTtlMs || DEFAULT_TTL_MS;
        this.authRequired = config.authRequired !== false; // default true

        // In-memory session store: token → { address, role, perms, exp, iat }
        this.sessions = new Map();

        // Known wallet addresses → roles (loaded from config or DB)
        this.knownWallets = new Map();

        console.log(`[Auth] Initialized (required: ${this.authRequired}, TTL: ${this.tokenTtlMs / 1000}s)`);
    }

    // ── Token Generation ───────────────────────────────────

    /**
     * Generate an auth token for a wallet address.
     * @param {string} address - Wallet address (0x...)
     * @param {string} role - Role: "admin" | "operator" | "viewer"
     * @param {Object} extra - Extra claims to include
     * @returns {string} Signed token string
     */
    generateToken(address, role = "viewer", extra = {}) {
        const normalized = address.toLowerCase();
        const perms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer;
        const now = Date.now();

        const payload = {
            address: normalized,
            role,
            perms,
            iat: now,
            exp: now + this.tokenTtlMs,
            ...extra,
        };

        // Sign with HMAC-SHA256
        const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
        const signature = crypto
            .createHmac("sha256", this.secret)
            .update(payloadB64)
            .digest("base64url");

        const token = payloadB64 + "." + signature;

        // Store in session map
        this.sessions.set(token, payload);

        return token;
    }

    // ── Token Validation ───────────────────────────────────

    /**
     * Validate an auth token.
     * @param {string} token - The token to validate
     * @returns {{ valid: boolean, payload?: Object, error?: string }}
     */
    validateToken(token) {
        if (!token) return { valid: false, error: "No token provided" };

        const parts = token.split(".");
        if (parts.length !== 2) return { valid: false, error: "Invalid token format" };

        const [payloadB64, signature] = parts;

        // Verify HMAC signature
        const expectedSig = crypto
            .createHmac("sha256", this.secret)
            .update(payloadB64)
            .digest("base64url");

        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
            return { valid: false, error: "Invalid token signature" };
        }

        // Decode payload
        let payload;
        try {
            payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
        } catch (e) {
            return { valid: false, error: "Invalid token payload" };
        }

        // Check expiration
        if (payload.exp && Date.now() > payload.exp) {
            return { valid: false, error: "Token expired" };
        }

        return { valid: true, payload };
    }

    /**
     * Quick check — returns true/false only.
     * @param {string} token
     * @returns {boolean}
     */
    isValid(token) {
        return this.validateToken(token).valid;
    }

    /**
     * Get the payload from a valid token, or null.
     * @param {string} token
     * @returns {Object|null}
     */
    getPayload(token) {
        const result = this.validateToken(token);
        return result.valid ? result.payload : null;
    }

    // ── Permission Checking ────────────────────────────────

    /**
     * Check if a token has a specific permission.
     * @param {string} token
     * @param {string} permission - e.g. "admin:manage", "chat:send"
     * @returns {boolean}
     */
    hasPermission(token, permission) {
        const payload = this.getPayload(token);
        if (!payload) return false;
        return payload.perms && payload.perms.includes(permission);
    }

    /**
     * Get all permissions for a token.
     * @param {string} token
     * @returns {string[]}
     */
    getPermissions(token) {
        const payload = this.getPayload(token);
        return payload ? (payload.perms || []) : [];
    }

    // ── Wallet Registration ────────────────────────────────

    /**
     * Register a wallet address with a role.
     * @param {string} address
     * @param {string} role - "admin" | "operator" | "viewer"
     */
    registerWallet(address, role = "viewer") {
        this.knownWallets.set(address.toLowerCase(), role);
        console.log(`[Auth] Registered wallet: ${address.slice(0, 10)}... as ${role}`);
    }

    /**
     * Get the role for a wallet address.
     * @param {string} address
     * @returns {string|null}
     */
    getWalletRole(address) {
        return this.knownWallets.get(address.toLowerCase()) || null;
    }

    // ── Token Revocation ───────────────────────────────────

    /**
     * Revoke a token (logout).
     * @param {string} token
     */
    revokeToken(token) {
        this.sessions.delete(token);
    }

    /**
     * Revoke all sessions for a wallet address.
     * @param {string} address
     */
    revokeAllForAddress(address) {
        const normalized = address.toLowerCase();
        for (const [token, session] of this.sessions) {
            if (session.address === normalized) {
                this.sessions.delete(token);
            }
        }
    }

    // ── Token Refresh ──────────────────────────────────────

    /**
     * Refresh a token — extend expiration.
     * @param {string} token
     * @returns {string|null} New token, or null if invalid
     */
    refreshToken(token) {
        const payload = this.getPayload(token);
        if (!payload) return null;

        // Revoke old token
        this.revokeToken(token);

        // Generate new token with extended expiry
        return this.generateToken(payload.address, payload.role, {
            iat: Date.now(),
        });
    }

    // ── HTTP Middleware ─────────────────────────────────────

    /**
     * Express/Connect-style middleware for HTTP API auth.
     * Attaches req.authPayload if token is valid.
     */
    httpMiddleware(req, res, next) {
        // Skip auth for login endpoint and health check
        if (req.url === "/api/auth/login" || req.url === "/api/auth/register" || req.url === "/api/health") {
            return next();
        }

        // Skip auth for static files
        if (!req.url.startsWith("/api/")) {
            return next();
        }

        // Extract token from Authorization header or query param
        let token = null;
        const authHeader = req.headers["authorization"];
        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.slice(7);
        }
        if (!token) {
            const url = new URL(req.url, `http://${req.headers.host}`);
            token = url.searchParams.get("token");
        }

        if (!this.authRequired) {
            // Auth disabled — attach default payload
            req.authPayload = { address: "0x0000...0000", role: "admin", perms: ROLE_PERMISSIONS.admin };
            return next();
        }

        if (!token) {
            res.writeHead(401, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Authentication required", code: "AUTH_REQUIRED" }));
        }

        const result = this.validateToken(token);
        if (!result.valid) {
            res.writeHead(401, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: result.error, code: "INVALID_TOKEN" }));
        }

        req.authPayload = result.payload;
        next();
    }

    // ── Stats ──────────────────────────────────────────────

    getStats() {
        return {
            activeSessions: this.sessions.size,
            registeredWallets: this.knownWallets.size,
            authRequired: this.authRequired,
            tokenTtlSeconds: this.tokenTtlMs / 1000,
        };
    }
}

module.exports = { WsAuth, ROLE_PERMISSIONS };
