/**
 * Obscura Agent — Scheduler Module
 * Cron-like job scheduling for periodic scraping, monitoring, and data exports.
 */

const { EventEmitter } = require('events');

class Scheduler extends EventEmitter {
  constructor(opts = {}) {
    super();
    this._jobs = new Map();
    this._running = false;
    this._tickInterval = opts.tickInterval || 1000;
    this._ticker = null;
  }

  /**
   * Schedule a recurring job
   * @param {string} name - job identifier
   * @param {object} options
   * @param {string} options.cron - simplified cron: 'every N[s|m|h|d]' or 'at HH:MM'
   * @param {Function} fn - async function to execute
   */
  schedule(name, options, fn) {
    if (this._jobs.has(name)) throw new Error(`Job "${name}" already scheduled`);

    const intervalMs = this._parseInterval(options.cron || options.interval);
    const job = {
      name,
      fn,
      intervalMs,
      lastRun: 0,
      nextRun: Date.now() + (options.startDelay || 0),
      runCount: 0,
      errors: 0,
      options,
    };

    this._jobs.set(name, job);
    this.emit('scheduled', { name, nextRun: job.nextRun });
    return job;
  }

  /**
   * Cancel a scheduled job
   */
  cancel(name) {
    const job = this._jobs.get(name);
    if (!job) return false;
    this._jobs.delete(name);
    this.emit('cancelled', { name });
    return true;
  }

  /**
   * List all jobs
   */
  list() {
    const now = Date.now();
    return [...this._jobs.values()].map(j => ({
      name: j.name,
      interval: `${j.intervalMs / 1000}s`,
      lastRun: j.lastRun ? new Date(j.lastRun).toISOString() : 'never',
      nextRun: new Date(j.nextRun).toISOString(),
      runs: j.runCount,
      errors: j.errors,
      due: now >= j.nextRun,
    }));
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this._running) return;
    this._running = true;
    this._ticker = setInterval(() => this._tick(), this._tickInterval);
    this.emit('started');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    this._running = false;
    if (this._ticker) clearInterval(this._ticker);
    this._ticker = null;
    this.emit('stopped');
  }

  async _tick() {
    const now = Date.now();
    for (const job of this._jobs.values()) {
      if (now >= job.nextRun) {
        job.nextRun = now + job.intervalMs;
        try {
          await job.fn();
          job.runCount++;
          job.lastRun = now;
          this.emit('jobComplete', { name: job.name, runCount: job.runCount });
        } catch (err) {
          job.errors++;
          this.emit('jobError', { name: job.name, error: err.message });
        }
      }
    }
  }

  _parseInterval(input) {
    if (typeof input === 'number') return input;

    // 'every 5m'
    const everyMatch = input.match(/^every\s+(\d+)\s*(s|m|h|d)$/i);
    if (everyMatch) {
      const value = parseInt(everyMatch[1]);
      const unit = everyMatch[2].toLowerCase();
      const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
      return value * (multipliers[unit] || 1000);
    }

    // 'at 09:00'
    const atMatch = input.match(/^at\s+(\d{1,2}):(\d{2})$/);
    if (atMatch) {
      const now = new Date();
      const target = new Date(now);
      target.setHours(parseInt(atMatch[1]), parseInt(atMatch[2]), 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      return target.getTime() - now.getTime();
    }

    // Default: 1 hour
    return 3600000;
  }
}

module.exports = { Scheduler };