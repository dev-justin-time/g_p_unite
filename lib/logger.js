/**
 * FCM Structured Logger
 *
 * Production-grade logging with levels, context, timestamps,
 * and optional file output. Replaces console.log/error usage.
 */

const fs = require("fs");
const path = require("path");

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 };

class Logger {
    /**
     * @param {Object} opts
     * @param {string} opts.name - Logger name (module identifier)
     * @param {string} opts.level - Minimum log level (error|warn|info|debug|trace)
     * @param {string} [opts.logDir] - Directory for log files (null = stdout only)
     * @param {boolean} [opts.json] - Output as JSON lines instead of formatted text
     */
    constructor({ name = "fcm", level = "info", logDir = null, json = false } = {}) {
        this.name = name;
        this.level = LOG_LEVELS[level] ?? LOG_LEVELS.info;
        this.logDir = logDir;
        this.json = json;
        this._stream = null;

        if (logDir) {
            try {
                fs.mkdirSync(logDir, { recursive: true });
                const logFile = path.join(logDir, `${name}.log`);
                this._stream = fs.createWriteStream(logFile, { flags: "a" });
            } catch { /* fall back to stdout */ }
        }
    }

    _format(level, msg, context = {}) {
        const ts = new Date().toISOString();
        const base = { ts, level, logger: this.name, msg, ...context };

        if (this.json) {
            return JSON.stringify(base);
        }

        const ctxStr = Object.keys(context).length > 0
            ? " " + Object.entries(context).map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`).join(" ")
            : "";
        return `[${ts}] ${level.toUpperCase().padEnd(5)} [${this.name}] ${msg}${ctxStr}`;
    }

    _write(level, msg, context) {
        if (LOG_LEVELS[level] > this.level) return;

        const formatted = this._format(level, msg, context);

        if (this._stream) {
            this._stream.write(formatted + "\n");
        }

        // Also write to stdout/stderr
        if (level === "error") {
            process.stderr.write(formatted + "\n");
        } else {
            process.stdout.write(formatted + "\n");
        }
    }

    error(msg, context = {}) { this._write("error", msg, context); }
    warn(msg, context = {})  { this._write("warn", msg, context); }
    info(msg, context = {})  { this._write("info", msg, context); }
    debug(msg, context = {}) { this._write("debug", msg, context); }
    trace(msg, context = {}) { this._write("trace", msg, context); }

    /** Create a child logger with a prefixed context */
    child(prefix) {
        return new ChildLogger(this, prefix);
    }

    /** Close the log file stream */
    close() {
        if (this._stream) {
            this._stream.end();
            this._stream = null;
        }
    }
}

class ChildLogger {
    constructor(parent, prefix) {
        this.parent = parent;
        this.prefix = prefix;
    }

    _ctx(context) {
        return { ...context, _prefix: this.prefix };
    }

    error(msg, ctx = {}) { this.parent.error(msg, this._ctx(ctx)); }
    warn(msg, ctx = {})  { this.parent.warn(msg, this._ctx(ctx)); }
    info(msg, ctx = {})  { this.parent.info(msg, this._ctx(ctx)); }
    debug(msg, ctx = {}) { this.parent.debug(msg, this._ctx(ctx)); }
    trace(msg, ctx = {}) { this.parent.trace(msg, this._ctx(ctx)); }
}

/** Default logger instance */
const defaultLogger = new Logger({ name: "fcm", level: process.env.LOG_LEVEL || "info" });

module.exports = { Logger, ChildLogger, defaultLogger, LOG_LEVELS };
