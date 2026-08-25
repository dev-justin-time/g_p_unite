/**
 * Obscura Search — Main Application
 * Web Intelligence Console GUI
 */

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════

const state = {
  connected: false,
  apiURL: localStorage.getItem('obscura-api') || 'http://localhost:3001',
  cdpPort: parseInt(localStorage.getItem('obscura-cdp') || '9222'),
  userAgent: localStorage.getItem('obscura-ua') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  ssrfProtection: localStorage.getItem('obscura-ssrf') !== 'false',
  respectRobots: localStorage.getItem('obscura-robots') !== 'false',

  proxies: JSON.parse(localStorage.getItem('obscura-proxies') || '[]'),
  activeProxy: parseInt(localStorage.getItem('obscura-active-proxy') || '-1'),
  monitors: JSON.parse(localStorage.getItem('obscura-monitors') || '[]'),
  history: JSON.parse(localStorage.getItem('obscura-history') || '[]'),

  stats: { pages: 0, latency: 0, proxyCount: 0 }
};

// ═══════════════════════════════════════════════════════════════
// API HELPERS
// ═══════════════════════════════════════════════════════════════

async function api(path, options = {}) {
  try {
    const res = await fetch(`${state.apiURL}${path}`, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(options.timeout || 30000)
    });
    return await res.json();
  } catch (e) {
    // Fallback to direct scraping if API unavailable
    if (options.fallback) return options.fallback(e);
    throw e;
  }
}

// ═══════════════════════════════════════════════════════════════
// CONNECTION
// ═══════════════════════════════════════════════════════════════

async function toggleConnection() {
  const btn = document.getElementById('btn-connect');
  const dot = document.getElementById('conn-dot');
  const label = document.getElementById('conn-label');

  if (state.connected) {
    // Disconnect
    await api('/api/obscura/disconnect', { method: 'POST' }).catch(() => {});
    state.connected = false;
    btn.innerHTML = '<span class="material-symbols-outlined text-[16px]">power</span> CONNECT';
    btn.className = btn.className.replace('border-secondary', 'border-error').replace('bg-secondary/10', 'bg-error/10').replace('text-secondary', 'text-error');
    dot.className = 'w-2 h-2 rounded-full bg-error';
    label.className = 'font-code-sm text-code-sm text-error';
    label.textContent = 'DISCONNECTED';
    showToast('error', 'Disconnected from Obscura');
  } else {
    // Connect
    btn.innerHTML = '<div class="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin"></div>';
    try {
      const result = await api('/api/obscura/connect', {
        method: 'POST',
        body: { port: state.cdpPort, stealth: true }
      });
      state.connected = true;
      btn.innerHTML = '<span class="material-symbols-outlined text-[16px]">power</span> DISCONNECT';
      btn.className = btn.className.replace('border-error', 'border-secondary').replace('bg-error/10', 'bg-secondary/10').replace('text-error', 'text-secondary');
      dot.className = 'w-2 h-2 rounded-full bg-secondary status-pulse';
      label.className = 'font-code-sm text-code-sm text-secondary';
      label.textContent = 'CONNECTED';
      showToast('check_circle', 'Connected to Obscura on port ' + (result.port || state.cdpPort));
    } catch (e) {
      btn.innerHTML = '<span class="material-symbols-outlined text-[16px]">power</span> CONNECT';
      showToast('error', 'Connection failed: ' + e.message);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// TAB NAVIGATION
// ═══════════════════════════════════════════════════════════════

function switchTab(tab) {
  // Hide all
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  // Reset nav
  document.querySelectorAll('nav button').forEach(el => {
    el.className = 'w-full flex items-center gap-3 px-4 py-3 rounded-DEFAULT text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors duration-200';
  });
  // Show target
  document.getElementById('tab-' + tab).classList.remove('hidden');
  const navBtn = document.getElementById('nav-' + tab);
  if (navBtn) {
    navBtn.className = 'w-full flex items-center gap-3 px-4 py-3 rounded-DEFAULT text-primary border-l-2 border-primary font-bold bg-primary/5 transition-colors duration-200';
  }
}

// ═══════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════

async function performSearch() {
  const input = document.getElementById('search-input');
  const query = input.value.trim();
  if (!query) return;

  const btn = document.getElementById('btn-search');
  const status = document.getElementById('search-status');
  const statusText = document.getElementById('search-status-text');
  const resultsDiv = document.getElementById('search-results');

  const engine = document.getElementById('opt-engine').value;
  const limit = parseInt(document.getElementById('opt-limit').value);
  const region = document.getElementById('opt-region').value;
  const stealth = document.getElementById('opt-stealth').checked;
  const dedup = document.getElementById('opt-dedup').checked;

  btn.disabled = true;
  status.classList.remove('hidden');
  statusText.textContent = `Querying ${engine}...`;
  resultsDiv.innerHTML = '';

  const startTime = Date.now();

  try {
    const data = await api('/api/obscura/search', {
      method: 'POST',
      body: { query, engine, limit, region, stealth, dedup },
      timeout: 45000,
      fallback: () => clientSideSearch(query, engine, limit)
    });

    const elapsed = Date.now() - startTime;
    const results = data.results || data;

    // Update stats
    state.stats.pages += results.length;
    state.stats.latency = elapsed;
    updateStats();
    updateHistory('search', query, results.length, elapsed);

    // Render results
    status.classList.add('hidden');
    resultsDiv.innerHTML = renderSearchResults(results, query, elapsed, engine);

  } catch (e) {
    statusText.textContent = 'Error: ' + e.message;
    statusText.className = 'font-code-sm text-code-sm text-error';
    setTimeout(() => {
      status.classList.add('hidden');
      statusText.className = 'font-code-sm text-code-sm text-on-surface-variant';
    }, 3000);
  } finally {
    btn.disabled = false;
  }
}

function clientSideSearch(query, engine, limit) {
  // Client-side DuckDuckGo HTML fallback
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=${engine === 'duckduckgo' ? '' : engine}`;
  return { results: [], message: 'Client-side search not available. Start the Obscura API server.', searchUrl };
}

function renderSearchResults(results, query, elapsed, engine) {
  if (!results || results.length === 0) {
    return `<div class="glass-panel rounded-xl p-8 text-center">
      <span class="material-symbols-outlined text-[48px] text-outline-variant">search_off</span>
      <p class="font-body-md text-body-md text-on-surface-variant mt-3">No results found for "${escapeHtml(query)}"</p>
    </div>`;
  }

  let html = `
    <div class="flex items-center justify-between mb-4">
      <span class="font-code-sm text-code-sm text-on-surface-variant">${results.length} results in ${elapsed}ms via ${engine}</span>
      <button onclick="exportResults('search')" class="text-on-surface-variant hover:text-primary transition-colors font-code-sm text-code-sm flex items-center gap-1">
        <span class="material-symbols-outlined text-[16px]">download</span>
        Export JSON
      </button>
    </div>`;

  results.forEach((r, i) => {
    const domain = r.url ? new URL(r.url).hostname : '';
    html += `
      <div class="glass-panel rounded-xl p-5 mb-3 result-row transition-colors">
        <div class="flex items-start gap-3">
          <span class="font-code-sm text-code-sm text-outline-variant mt-1 shrink-0">${i + 1}.</span>
          <div class="flex-1 min-w-0">
            <a href="${escapeHtml(r.url || '#')}" target="_blank" rel="noopener" class="font-body-md text-body-md text-primary hover:text-primary-fixed-dim transition-colors break-words">${escapeHtml(r.title || 'Untitled')}</a>
            <p class="font-code-sm text-code-sm text-on-surface-variant mt-1 truncate">${escapeHtml(domain)}</p>
            <p class="font-body-md text-body-md text-on-surface-variant/80 mt-2 line-clamp-2">${escapeHtml(r.snippet || r.description || '')}</p>
          </div>
        </div>
      </div>`;
  });

  return html;
}

// ═══════════════════════════════════════════════════════════════
// SCRAPER
// ═══════════════════════════════════════════════════════════════

async function performScrape() {
  const url = document.getElementById('scrape-url').value.trim();
  if (!url) return;

  const mode = document.getElementById('scrape-mode').value;
  const evalCode = document.getElementById('scrape-eval').value;
  const screenshot = document.getElementById('scrape-screenshot').checked;

  const status = document.getElementById('scrape-status');
  const statusText = document.getElementById('scrape-status-text');
  const output = document.getElementById('scrape-output');
  const content = document.getElementById('scrape-content');

  status.classList.remove('hidden');
  output.classList.add('hidden');
  statusText.textContent = 'Fetching...';

  const startTime = Date.now();

  try {
    const data = await api('/api/obscura/scrape', {
      method: 'POST',
      body: {
        url,
        dump: mode === 'eval' ? 'html' : mode,
        eval: mode === 'eval' ? evalCode : null,
        screenshot: screenshot ? 'full' : null,
        stealth: true,
        timeout: 30
      },
      timeout: 60000
    });

    const elapsed = Date.now() - startTime;
    state.stats.pages++;
    state.stats.latency = elapsed;
    updateStats();
    updateHistory('scrape', url, 1, elapsed);

    status.classList.add('hidden');
    output.classList.remove('hidden');

    if (data.screenshot) {
      content.innerHTML = `<img src="data:image/png;base64,${data.screenshot}" class="rounded max-w-full"/>` +
        (data.output ? `\n\n<pre class="mt-4">${escapeHtml(data.output).substring(0, 10000)}</pre>` : '');
    } else {
      content.textContent = data.output || data.html || data.text || JSON.stringify(data, null, 2);
    }

  } catch (e) {
    statusText.textContent = 'Error: ' + e.message;
    statusText.className = 'font-code-sm text-code-sm text-error';
    setTimeout(() => {
      status.classList.add('hidden');
      statusText.className = 'font-code-sm text-code-sm text-on-surface-variant';
    }, 3000);
  }
}

// ═══════════════════════════════════════════════════════════════
// MONITOR
// ═══════════════════════════════════════════════════════════════

function addMonitor() {
  const url = document.getElementById('monitor-url').value.trim();
  const interval = parseInt(document.getElementById('monitor-interval').value);
  if (!url) return;

  const monitor = {
    id: Date.now(),
    url,
    interval,
    active: true,
    lastCheck: null,
    lastHash: null,
    changes: 0,
    createdAt: new Date().toISOString()
  };

  state.monitors.push(monitor);
  localStorage.setItem('obscura-monitors', JSON.stringify(state.monitors));
  document.getElementById('monitor-url').value = '';
  renderMonitors();
  showToast('check_circle', `Now monitoring: ${new URL(url).hostname}`);

  // Start polling
  startMonitorPoll(monitor);
}

function startMonitorPoll(monitor) {
  if (!monitor.active) return;
  monitor._timer = setInterval(async () => {
    try {
      const data = await api('/api/obscura/monitor/check', {
        method: 'POST',
        body: { url: monitor.url },
        timeout: 30000
      });

      const hash = simpleHash(data.text || data.html || '');
      if (monitor.lastHash && hash !== monitor.lastHash) {
        monitor.changes++;
        showToast('notifications', `Change detected on ${new URL(monitor.url).hostname}`);
      }
      monitor.lastHash = hash;
      monitor.lastCheck = new Date().toISOString();
      renderMonitors();
    } catch (e) {
      console.error('Monitor check failed:', e);
    }
  }, monitor.interval * 1000);
}

function removeMonitor(id) {
  const idx = state.monitors.findIndex(m => m.id === id);
  if (idx >= 0) {
    if (state.monitors[idx]._timer) clearInterval(state.monitors[idx]._timer);
    state.monitors.splice(idx, 1);
    localStorage.setItem('obscura-monitors', JSON.stringify(state.monitors));
    renderMonitors();
  }
}

function toggleMonitor(id) {
  const monitor = state.monitors.find(m => m.id === id);
  if (monitor) {
    monitor.active = !monitor.active;
    if (monitor.active) startMonitorPoll(monitor);
    else if (monitor._timer) clearInterval(monitor._timer);
    localStorage.setItem('obscura-monitors', JSON.stringify(state.monitors));
    renderMonitors();
  }
}

function renderMonitors() {
  const list = document.getElementById('monitor-list');
  if (state.monitors.length === 0) {
    list.innerHTML = `<div class="glass-panel rounded-xl p-8 text-center">
      <span class="material-symbols-outlined text-[48px] text-outline-variant">visibility_off</span>
      <p class="font-body-md text-body-md text-on-surface-variant mt-3">No active monitors</p>
    </div>`;
    return;
  }

  list.innerHTML = state.monitors.map(m => {
    const domain = m.url ? new URL(m.url).hostname : m.url;
    return `
      <div class="glass-panel rounded-xl p-4 flex items-center gap-4 ${m.active ? 'glow-green' : ''}">
        <div class="w-3 h-3 rounded-full ${m.active ? 'bg-secondary status-pulse' : 'bg-outline-variant'}"></div>
        <div class="flex-1 min-w-0">
          <p class="font-body-md text-body-md text-on-surface truncate">${escapeHtml(domain)}</p>
          <p class="font-code-sm text-code-sm text-on-surface-variant">Every ${formatInterval(m.interval)} · ${m.changes} changes</p>
        </div>
        <span class="font-code-sm text-code-sm text-on-surface-variant">${m.lastCheck ? timeAgo(m.lastCheck) : 'Never'}</span>
        <button onclick="toggleMonitor(${m.id})" class="p-2 rounded hover:bg-surface-container-high transition-colors">
          <span class="material-symbols-outlined text-[18px] text-on-surface-variant">${m.active ? 'pause' : 'play_arrow'}</span>
        </button>
        <button onclick="removeMonitor(${m.id})" class="p-2 rounded hover:bg-error-container/30 transition-colors">
          <span class="material-symbols-outlined text-[18px] text-error/70">delete</span>
        </button>
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// EXTRACTOR
// ═══════════════════════════════════════════════════════════════

async function performExtract() {
  const url = document.getElementById('extract-url').value.trim();
  const schemaText = document.getElementById('extract-schema').value.trim();
  if (!url) return;

  let schema;
  try {
    schema = schemaText ? JSON.parse(schemaText) : {};
  } catch (e) {
    showToast('error', 'Invalid JSON schema');
    return;
  }

  const output = document.getElementById('extract-output');
  const content = document.getElementById('extract-content');

  try {
    const data = await api('/api/obscura/extract', {
      method: 'POST',
      body: { url, schema, stealth: true },
      timeout: 60000
    });

    output.classList.remove('hidden');
    content.textContent = JSON.stringify(data.extracted || data, null, 2);
    state.stats.pages++;
    updateStats();
    updateHistory('extract', url, 1, 0);

  } catch (e) {
    showToast('error', 'Extraction failed: ' + e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// PROXIES
// ═══════════════════════════════════════════════════════════════

function addProxy() {
  const input = document.getElementById('proxy-input');
  const url = input.value.trim();
  if (!url) return;

  const proxy = {
    id: Date.now(),
    url,
    status: 'unchecked',
    latency: null,
    addedAt: new Date().toISOString()
  };

  state.proxies.push(proxy);
  localStorage.setItem('obscura-proxies', JSON.stringify(state.proxies));
  input.value = '';
  renderProxies();
  checkProxy(proxy);
  showToast('check_circle', `Proxy added: ${url}`);
}

function removeProxy(id) {
  state.proxies = state.proxies.filter(p => p.id !== id);
  localStorage.setItem('obscura-proxies', JSON.stringify(state.proxies));
  renderProxies();
  updateStats();
}

function rotateProxy() {
  if (state.proxies.length === 0) {
    showToast('warning', 'No proxies configured');
    return;
  }
  state.activeProxy = (state.activeProxy + 1) % state.proxies.length;
  localStorage.setItem('obscura-active-proxy', state.activeProxy.toString());
  renderProxies();
  showToast('swap_horiz', `Active proxy: ${state.proxies[state.activeProxy].url}`);
}

async function checkProxy(proxy) {
  const startTime = Date.now();
  try {
    await api('/api/obscura/proxy/check', {
      method: 'POST',
      body: { url: proxy.url },
      timeout: 10000
    });
    proxy.status = 'active';
    proxy.latency = Date.now() - startTime;
  } catch (e) {
    proxy.status = 'failed';
    proxy.latency = null;
  }
  localStorage.setItem('obscura-proxies', JSON.stringify(state.proxies));
  renderProxies();
}

function renderProxies() {
  const list = document.getElementById('proxy-list');
  const activeCount = state.proxies.filter(p => p.status === 'active').length;
  document.getElementById('stat-proxies').textContent = activeCount;

  if (state.proxies.length === 0) {
    list.innerHTML = `<div class="glass-panel rounded-xl p-8 text-center">
      <span class="material-symbols-outlined text-[48px] text-outline-variant">wifi_off</span>
      <p class="font-body-md text-body-md text-on-surface-variant mt-3">No proxies configured</p>
    </div>`;
    return;
  }

  list.innerHTML = state.proxies.map((p, i) => {
    const isActive = i === state.activeProxy;
    return `
      <div class="glass-panel rounded-xl p-4 flex items-center gap-4 ${isActive ? 'glow-green' : ''}">
        <div class="w-3 h-3 rounded-full ${p.status === 'active' ? 'bg-secondary' : p.status === 'failed' ? 'bg-error' : 'bg-outline-variant'}"></div>
        <div class="flex-1 min-w-0">
          <p class="font-code-sm text-code-sm text-on-surface truncate">${escapeHtml(p.url)}</p>
          <p class="font-code-sm text-code-sm text-on-surface-variant">${p.latency ? p.latency + 'ms' : '—'} · ${p.status}</p>
        </div>
        ${isActive ? '<span class="tag bg-secondary/20 text-secondary border border-secondary/30">Active</span>' : ''}
        <button onclick="checkProxy(state.proxies[${i}])" class="p-2 rounded hover:bg-surface-container-high transition-colors" title="Check">
          <span class="material-symbols-outlined text-[18px] text-on-surface-variant">refresh</span>
        </button>
        <button onclick="removeProxy(${p.id})" class="p-2 rounded hover:bg-error-container/30 transition-colors" title="Remove">
          <span class="material-symbols-outlined text-[18px] text-error/70">delete</span>
        </button>
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════════════════════════════

function updateHistory(type, query, resultCount, latency) {
  state.history.unshift({
    type,
    query,
    resultCount,
    latency,
    timestamp: new Date().toISOString()
  });
  if (state.history.length > 500) state.history.length = 500;
  localStorage.setItem('obscura-history', JSON.stringify(state.history));
  renderHistory();
}

function clearHistory() {
  state.history = [];
  localStorage.setItem('obscura-history', '[]');
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('history-list');
  const count = document.getElementById('history-count');
  count.textContent = state.history.length + ' entries';

  if (state.history.length === 0) {
    list.innerHTML = `<div class="glass-panel rounded-xl p-8 text-center">
      <span class="material-symbols-outlined text-[48px] text-outline-variant">history</span>
      <p class="font-body-md text-body-md text-on-surface-variant mt-3">No history yet</p>
    </div>`;
    return;
  }

  list.innerHTML = state.history.slice(0, 100).map(h => {
    const icon = h.type === 'search' ? 'search' : h.type === 'scrape' ? 'code' : 'data_object';
    const typeColor = h.type === 'search' ? 'text-primary' : h.type === 'scrape' ? 'text-secondary' : 'text-tertiary';
    return `
      <div class="glass-panel rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:bg-surface-container-high transition-colors"
           onclick="${h.type === 'search' ? `document.getElementById('search-input').value='${escapeHtml(h.query)}';switchTab('search');performSearch();` : ''}">
        <span class="material-symbols-outlined text-[20px] ${typeColor}">${icon}</span>
        <div class="flex-1 min-w-0">
          <p class="font-body-md text-body-md text-on-surface truncate">${escapeHtml(h.query)}</p>
          <p class="font-code-sm text-code-sm text-on-surface-variant">${h.resultCount} results · ${h.latency}ms</p>
        </div>
        <span class="font-code-sm text-code-sm text-outline-variant">${timeAgo(h.timestamp)}</span>
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════

function openSettings() {
  document.getElementById('settings-modal').classList.remove('hidden');
  document.getElementById('settings-api-url').value = state.apiURL;
  document.getElementById('settings-cdp-port').value = state.cdpPort;
  document.getElementById('settings-ua').value = state.userAgent;
  document.getElementById('settings-ssrf').checked = state.ssrfProtection;
  document.getElementById('settings-robots').checked = state.respectRobots;
}

function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
}

function saveSettings() {
  state.apiURL = document.getElementById('settings-api-url').value;
  state.cdpPort = parseInt(document.getElementById('settings-cdp-port').value);
  state.userAgent = document.getElementById('settings-ua').value;
  state.ssrfProtection = document.getElementById('settings-ssrf').checked;
  state.respectRobots = document.getElementById('settings-robots').checked;

  localStorage.setItem('obscura-api', state.apiURL);
  localStorage.setItem('obscura-cdp', state.cdpPort.toString());
  localStorage.setItem('obscura-ua', state.userAgent);
  localStorage.setItem('obscura-ssrf', state.ssrfProtection.toString());
  localStorage.setItem('obscura-robots', state.respectRobots.toString());

  closeSettings();
  showToast('check_circle', 'Settings saved');
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

function updateStats() {
  document.getElementById('stat-pages').textContent = state.stats.pages;
  document.getElementById('stat-latency').textContent = state.stats.latency ? state.stats.latency + 'ms' : '—';
  document.getElementById('stat-proxies').textContent = state.proxies.filter(p => p.status === 'active').length;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString();
}

function formatInterval(seconds) {
  if (seconds < 60) return seconds + 's';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'min';
  return Math.floor(seconds / 3600) + 'hr';
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return Math.floor(diff / 86400000) + 'd ago';
}

function showToast(icon, text) {
  const toast = document.getElementById('toast');
  const toastIcon = document.getElementById('toast-icon');
  const toastText = document.getElementById('toast-text');
  toastIcon.textContent = icon;
  toastIcon.className = `material-symbols-outlined text-[20px] ${icon === 'error' ? 'text-error' : icon === 'warning' ? 'text-tertiary' : 'text-secondary'}`;
  toastText.textContent = text;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

function copyOutput(elementId) {
  const el = document.getElementById(elementId);
  navigator.clipboard.writeText(el.textContent).then(() => {
    showToast('check_circle', 'Copied to clipboard');
  });
}

function exportResults(type) {
  const data = type === 'search' ? state.history.filter(h => h.type === 'search') : [];
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `obscura-${type}-export.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════
// SCRAPE MODE TOGGLE
// ═══════════════════════════════════════════════════════════════

document.getElementById('scrape-mode')?.addEventListener('change', function() {
  document.getElementById('scrape-eval').classList.toggle('hidden', this.value !== 'eval');
});

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════

function init() {
  renderMonitors();
  renderProxies();
  renderHistory();
  updateStats();

  // Auto-start active monitors
  state.monitors.forEach(m => {
    if (m.active) startMonitorPoll(m);
  });

  // Keyboard shortcut: Ctrl+K for search
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      switchTab('search');
      document.getElementById('search-input').focus();
    }
  });
}

init();
