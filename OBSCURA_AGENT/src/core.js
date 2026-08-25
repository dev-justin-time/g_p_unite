/**
 * Obscura Agent — Core Engine
 * Lifecycle management, state machine, metrics collection
 */

const { EventEmitter } = require('events');

const STATES = {
  BOOTING: 'booting',
  IDLE: 'idle',
  SCRAPING: 'scraping',
  MONITORING: 'monitoring',
  EXTRACTING: 'extracting',
  ERROR: 'error',
  SHUTDOWN: 'shutdown'
};

const ALLOWED_TRANSITIONS = {
  booting: ['idle', 'error'],
  idle: ['scraping', 'monitoring', 'extracting', 'shutdown'],
  scraping: ['idle', 'error'],
  monitoring: ['idle', 'error'],
  extracting: ['idle', 'error'],
  error: ['idle', 'shutdown'],
  shutdown: []
};

class CoreEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      maxConcurrency: config.maxConcurrency || 10,
      requestTimeout: config.requestTimeout || 30000,
      retryCount: config.retryCount || 3,
      retryDelay: config.retryDelay || 1000,
      userAgent: config.userAgent || 'Obscura/2.0 (FCM Agent Swarm)',
      ...config
    };

    this._state = STATES.BOOTING;
    this._metrics = {
      pagesScraped: 0,
      monitorsActive: 0,
      successRate: 100.0,
      avgLatency: 0,
      totalErrors: 0,
      uptime: 0,
    };
    this._latencyHistory = [];
    this._startTime = null;
    this._modules = {};
  }

  get state() { return this._state; }
  get metrics() { return { ...this._metrics }; }

  async boot(modules = {}) {
    this._startTime = Date.now();
    this._modules = modules;
    this._transition(STATES.IDLE);
    this._startUptimeTracker();
    this.emit('ready', { modules: Object.keys(modules) });
    return { status: 'ready', state: this._state };
  }

  async shutdown() {
    this._transition(STATES.SHUTDOWN);
    this.emit('shutdown');
    return { status: 'shutdown' };
  }

  recordScrape(success, latency) {
    this._metrics.pagesScraped++;
    if (!success) this._metrics.totalErrors++;
    this._latencyHistory.push(latency);
    if (this._latencyHistory.length > 1000) this._latencyHistory.shift();
    this._metrics.successRate = parseFloat(
      ((1 - this._metrics.totalErrors / Math.max(1, this._metrics.pagesScraped)) * 100).toFixed(1)
    );
    this._metrics.avgLatency = Math.round(
      this._latencyHistory.reduce((a, b) => a + b, 0) / this._latencyHistory.length
    );
  }

  _transition(newState) {
    if (!ALLOWED_TRANSITIONS[this._state]?.includes(newState)) {
      throw new Error(`Invalid state transition: ${this._state} → ${newState}`);
    }
    const prev = this._state;
    this._state = newState;
    this.emit('stateChange', { from: prev, to: newState });
  }

  _startUptimeTracker() {
    setInterval(() => {
      this._metrics.uptime = Math.floor((Date.now() - this._startTime) / 1000);
    }, 1000);
  }
}

module.exports = { CoreEngine, STATES };