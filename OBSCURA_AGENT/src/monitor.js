/**
 * Obscura Agent — Monitor Module
 * Continuous page monitoring with diff detection and notification
 */

const crypto = require('crypto');

class Monitor {
  constructor(opts = {}) {
    this._watches = new Map();
    this._core = opts.core;
    this._defaultInterval = opts.defaultInterval || 60000; // 1 min
  }

  /**
   * Start monitoring a URL for changes
   * @param {string} url
   * @param {number} intervalMs - check interval in ms
   * @returns {{ url: string, interval: number, status: string }}
   */
  start(url, intervalMs = this._defaultInterval) {
    if (this._watches.has(url)) {
      return { url, status: 'already-monitoring', interval: this._watches.get(url).interval };
    }

    const watch = {
      url,
      interval: intervalMs,
      lastHash: null,
      lastContent: null,
      changes: [],
      running: true,
      timer: null,
    };

    const check = async () => {
      if (!watch.running) return;
      try {
        const scraper = this._core?._modules?.scraper;
        if (!scraper) return;
        const result = await scraper.scrape(url, { format: 'text' });
        if (!result.success) return;

        const hash = this._hash(result.output);
        if (watch.lastHash && hash !== watch.lastHash) {
          const diff = this._computeDiff(watch.lastContent, result.output);
          watch.changes.push({ timestamp: Date.now(), hash, diff });
          if (watch.changes.length > 100) watch.changes.shift();

          this._core?.emit?.('pageChanged', { url, timestamp: Date.now(), diff });
        }

        watch.lastHash = hash;
        watch.lastContent = result.output;
      } catch (e) {
        // Continue monitoring despite errors
      }

      if (watch.running) {
        watch.timer = setTimeout(check, intervalMs);
      }
    };

    this._watches.set(url, watch);
    check();

    this._core?._metrics && (this._core._metrics.monitorsActive = this._watches.size);
    return { url, interval: intervalMs, status: 'monitoring' };
  }

  /**
   * Stop monitoring a URL
   */
  stop(url) {
    const watch = this._watches.get(url);
    if (!watch) return { url, status: 'not-found' };

    watch.running = false;
    if (watch.timer) clearTimeout(watch.timer);
    this._watches.delete(url);

    this._core?._metrics && (this._core._metrics.monitorsActive = this._watches.size);
    return { url, status: 'stopped' };
  }

  /**
   * Stop all monitors
   */
  stopAll() {
    for (const [url] of this._watches) this.stop(url);
  }

  /**
   * Get active monitors
   */
  list() {
    const result = [];
    for (const [url, watch] of this._watches) {
      result.push({
        url,
        interval: watch.interval,
        running: watch.running,
        changes: watch.changes.length,
        lastChecked: watch.changes[watch.changes.length - 1]?.timestamp || null
      });
    }
    return result;
  }

  _hash(content) {
    return crypto.createHash('sha256').update(content || '').digest('hex');
  }

  _computeDiff(oldContent, newContent) {
    const oldLines = (oldContent || '').split('\n');
    const newLines = (newContent || '').split('\n');
    const added = newLines.filter(l => !oldLines.includes(l)).slice(0, 20);
    const removed = oldLines.filter(l => !newLines.includes(l)).slice(0, 20);
    return {
      added: added.length,
      removed: removed.length,
      totalChanges: Math.abs(newLines.length - oldLines.length) + added.length + removed.length,
      sampleAdded: added.slice(0, 5),
      sampleRemoved: removed.slice(0, 5)
    };
  }
}

module.exports = { Monitor };