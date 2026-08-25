/**
 * Obscura Search — Main Application
 * Web Intelligence Console GUI
 */

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════

const state = {
  connected: false,
  wsConnected: false,
  ws: null,
  apiURL: localStorage.getItem('obscura-api') || 'http://localhost:3001',
  cdpPort: parseInt(localStorage.getItem('obscura-cdp') || '9222'),
  userAgent: localStorage.getItem('obscura-ua') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  ssrfProtection: localStorage.getItem('obscura-ssrf') !== 'false',
  respectRobots: localStorage.getItem('obscura-robots') !== 'false',

  proxies: JSON.parse(localStorage.getItem('obscura-proxies') || '[]'),
  activeProxy: parseInt(localStorage.getItem('obscura-active-proxy') || '-1'),
  monitors: JSON.parse(localStorage.getItem('obscura-monitors') || '[]'),
  history: JSON.parse(localStorage.getItem('obscura-history') || '[]'),

  stats: { pages: 0, latency: 0, proxyCount: 0 },

  // Auth
  authToken: localStorage.getItem('obscura-auth-token') || null,
  authRole: localStorage.getItem('obscura-auth-role') || null,
  authRequired: false // will be set after first API call
};

// ═══════════════════════════════════════════════════════════════
// API HELPERS
// ═══════════════════════════════════════════════════════════════

async function api(path, options = {}) {
  try {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    // Add auth token if available
    if (state.authToken) headers['Authorization'] = `Bearer ${state.authToken}`;

    const res = await fetch(`${state.apiURL}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(options.timeout || 30000)
    });

    // Handle 401 — show login
    if (res.status === 401) {
      state.authRequired = true;
      showLogin();
      throw new Error('Authentication required');
    }

    return await res.json();
  } catch (e) {
    if (options.fallback) return options.fallback(e);
    throw e;
  }
}

// ═══════════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════════

function showLogin() {
  document.getElementById('login-overlay').classList.remove('hidden');
}

function hideLogin() {
  document.getElementById('login-overlay').classList.add('hidden');
}

async function doLogin() {
  const apiKey = document.getElementById('login-api-key').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');

  if (!apiKey && !password) {
    errorEl.textContent = 'Enter an API key or password';
    errorEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>';

  try {
    const body = apiKey ? { api_key: apiKey } : { password };
    const res = await fetch(`${state.apiURL}/api/obscura/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (data.success) {
      state.authToken = data.token;
      state.authRole = data.role;
      state.authRequired = false;
      localStorage.setItem('obscura-auth-token', data.token);
      localStorage.setItem('obscura-auth-role', data.role);
      hideLogin();
      showToast('check_circle', `Authenticated as ${data.role}`);
      // Reconnect WebSocket with auth
      disconnectWebSocket();
      connectWebSocket();
    } else {
      errorEl.textContent = data.error || 'Login failed';
      errorEl.classList.remove('hidden');
    }
  } catch (e) {
    errorEl.textContent = 'Connection failed: ' + e.message;
    errorEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">login</span> SIGN IN';
  }
}

async function doLogout() {
  try {
    await api('/api/obscura/auth/logout', { method: 'POST', body: {} });
  } catch (e) {}
  state.authToken = null;
  state.authRole = null;
  localStorage.removeItem('obscura-auth-token');
  localStorage.removeItem('obscura-auth-role');
  disconnectWebSocket();
  showLogin();
  showToast('logout', 'Logged out');
}

async function checkAuth() {
  if (!state.authToken) return;
  try {
    const data = await api('/api/obscura/auth/me');
    if (!data.authenticated) {
      state.authToken = null;
      state.authRole = null;
      localStorage.removeItem('obscura-auth-token');
      localStorage.removeItem('obscura-auth-role');
      showLogin();
    }
  } catch (e) {
    // 401 will trigger showLogin via api()
  }
}

// ═══════════════════════════════════════════════════════════════
// WEBSOCKET CLIENT
// ═══════════════════════════════════════════════════════════════

function connectWebSocket() {
  if (state.ws && (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING)) return;

  // Build WS URL with auth token
  let wsUrl = state.apiURL.replace(/^http/, 'ws') + '/ws';
  if (state.authToken) wsUrl += `?token=${state.authToken}`;

  try {
    state.ws = new WebSocket(wsUrl);
  } catch (e) {
    console.warn('WebSocket connection failed:', e.message);
    return;
  }

  state.ws.onopen = () => {
    state.wsConnected = true;
    updateWSIndicator();
    // Subscribe to alerts channel
    state.ws.send(JSON.stringify({ type: 'subscribe:alerts' }));
    console.log('WebSocket connected');
  };

  state.ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleWSMessage(msg);
    } catch (e) { /* ignore */ }
  };

  state.ws.onclose = () => {
    state.wsConnected = false;
    updateWSIndicator();
    console.log('WebSocket disconnected, reconnecting in 5s...');
    setTimeout(connectWebSocket, 5000);
  };

  state.ws.onerror = () => {
    state.wsConnected = false;
    updateWSIndicator();
  };
}

function disconnectWebSocket() {
  if (state.ws) {
    state.ws.close();
    state.ws = null;
  }
  state.wsConnected = false;
  updateWSIndicator();
}

function handleWSMessage(msg) {
  switch (msg.type) {
    case 'connected':
      showToast('wifi', `WebSocket connected (ID: ${msg.clientId})`);
      break;

    case 'notification': {
      if (msg.notification) {
        addNotificationLocal(msg.notification);
        const keywords = Array.isArray(msg.notification.keywords) ? msg.notification.keywords : [msg.notification.keywords];
        showToast('notifications_active', `${msg.notification.count} results for "${keywords.join(', ')}"`);
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH+JkI2LhX12dHN1eXt7enl4d3d5e3x9fX18e3p5eHd4eXp7fH19fHt6eXh3eHl6e3x9fXx7enl4d3h5ent8fX18e3p5eHd4eXp7fH19fHt6eXh3eHl6e3x9fXx7e3p5eHd4eXp7fH19fHt6eXh3eHl6e3x9fXx7e3p5eHd4eXp7fH19fHt7enl4d3h5ent8fX19fHt6eXh3eHl6e3x9fX18e3p5eHd4eXp7fH19fHt6eXh3eHl6e3x9fXx7enl4d3h5ent8fX18e3p5eHd4eXp7fH18fA==');
          audio.play().catch(() => {});
        } catch (e) {}
      }
      break;
    }
    case 'alert:first':
    case 'alert:new': {
      const isNew = msg.type === 'alert:new';
      const count = isNew ? msg.newResults.length : msg.totalResults;
      const body = isNew
        ? `${count} new results found for "${msg.keywords.join(', ')}"`
        : `${count} results found for "${msg.keywords.join(', ')}"`;
      showToast('notifications', body);
      // Update local alert data
      const alert = state.alerts.find(a => a.id === msg.alertId);
      if (alert) {
        alert.lastResults = isNew ? [...(alert.lastResults || []), ...msg.newResults] : msg.results;
        alert.lastCheck = msg.timestamp;
        localStorage.setItem('obscura-alerts', JSON.stringify(state.alerts));
        renderAlerts();
      }
      break;
    }

    case 'pong':
      // heartbeat response
      break;

    default:
      console.log('WS message:', msg);
  }
}

function updateWSIndicator() {
  const dot = document.getElementById('ws-dot');
  const label = document.getElementById('ws-label');
  if (!dot || !label) return;
  if (state.wsConnected) {
    dot.className = 'w-2 h-2 rounded-full bg-secondary status-pulse';
    label.className = 'font-code-sm text-code-sm text-secondary';
    label.textContent = 'LIVE';
  } else {
    dot.className = 'w-2 h-2 rounded-full bg-outline-variant';
    label.className = 'font-code-sm text-code-sm text-outline-variant';
    label.textContent = 'OFFLINE';
  }
}

// Heartbeat to keep connection alive
setInterval(() => {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify({ type: 'ping' }));
  }
}, 30000);

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
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

state.notifications = [];
state.unreadCount = 0;

async function loadNotifications() {
  try {
    const data = await api('/api/obscura/notifications?limit=100');
    state.notifications = data.notifications || [];
    state.unreadCount = data.unread || 0;
    updateNotifBadge();
    renderNotifications();
  } catch (e) { /* ignore */ }
}

async function markAllRead() {
  try {
    await api('/api/obscura/notifications/read-all', { method: 'POST', body: {} });
    state.notifications.forEach(n => n.read = true);
    state.unreadCount = 0;
    updateNotifBadge();
    renderNotifications();
    showToast('done_all', 'All notifications marked as read');
  } catch (e) {
    showToast('error', 'Failed: ' + e.message);
  }
}

async function clearNotifications() {
  try {
    await api('/api/obscura/notifications/clear', { method: 'DELETE', body: {} });
    state.notifications = [];
    state.unreadCount = 0;
    updateNotifBadge();
    renderNotifications();
    showToast('delete', 'Notifications cleared');
  } catch (e) {
    showToast('error', 'Failed: ' + e.message);
  }
}

async function markRead(id) {
  try {
    await api('/api/obscura/notifications/read', { method: 'POST', body: { id } });
    const n = state.notifications.find(x => x.id === id);
    if (n && !n.read) { n.read = true; state.unreadCount = Math.max(0, state.unreadCount - 1); }
    updateNotifBadge();
    renderNotifications();
  } catch (e) { /* ignore */ }
}

function addNotificationLocal(notif) {
  state.notifications.unshift(notif);
  if (!notif.read) state.unreadCount++;
  if (state.notifications.length > 100) state.notifications.length = 100;
  updateNotifBadge();
  renderNotifications();
}

function updateNotifBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (state.unreadCount > 0) {
    badge.classList.remove('hidden');
    badge.textContent = state.unreadCount > 99 ? '99+' : state.unreadCount;
  } else {
    badge.classList.add('hidden');
  }
}

function renderNotifications() {
  const list = document.getElementById('notification-list');
  const count = document.getElementById('notif-count');
  if (count) count.textContent = state.notifications.length + ' notifications (' + state.unreadCount + ' unread)';

  if (state.notifications.length === 0) {
    list.innerHTML = `<div class="glass-panel rounded-xl p-8 text-center">
      <span class="material-symbols-outlined text-[48px] text-outline-variant">notifications_off</span>
      <p class="font-body-md text-body-md text-on-surface-variant mt-3">No notifications yet</p>
    </div>`;
    return;
  }

  list.innerHTML = state.notifications.map(n => {
    const icon = n.type === 'first' ? 'notifications' : n.type === 'new' ? 'notifications_active' : 'search';
    const color = n.type === 'first' ? 'text-secondary' : n.type === 'new' ? 'text-tertiary' : 'text-primary';
    const keywords = Array.isArray(n.keywords) ? n.keywords : [n.keywords];
    return `
      <div class="glass-panel rounded-xl p-4 ${n.read ? '' : 'border-l-2 border-l-secondary'}" onclick="markRead(${n.id})">
        <div class="flex items-center gap-4">
          <span class="material-symbols-outlined text-[20px] ${color}">${icon}</span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              ${keywords.map(k => `<span class="tag bg-primary/20 text-primary border border-primary/30">${escapeHtml(k)}</span>`).join('')}
              <span class="tag ${n.type === 'first' ? 'bg-secondary/20 text-secondary border-secondary/30' : n.type === 'new' ? 'bg-tertiary/20 text-tertiary border-tertiary/30' : 'bg-primary/20 text-primary border-primary/30'}">${n.type}</span>
            </div>
            <p class="font-code-sm text-code-sm text-on-surface-variant mt-1">${n.count} results · ${timeAgo(n.timestamp)}</p>
            ${n.results && n.results.length > 0 ? `<div class="mt-2 space-y-1">${n.results.slice(0, 3).map(r => 
              `<a href="${escapeHtml(r.url || '#')}" target="_blank" class="block text-sm text-primary hover:text-primary-fixed-dim truncate" onclick="event.stopPropagation()">${escapeHtml(r.title || r.url || '')}</a>`
            ).join('')}${n.results.length > 3 ? `<p class="font-code-sm text-code-sm text-outline-variant">+${n.results.length - 3} more</p>` : ''}</div>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// KEYWORD ALERTS
// ═══════════════════════════════════════════════════════════════

state.alerts = JSON.parse(localStorage.getItem('obscura-alerts') || '[]');

async function addAlert() {
  const input = document.getElementById('alert-keywords').value.trim();
  if (!input) return;
  const keywords = input.split(',').map(k => k.trim()).filter(Boolean);
  const engine = document.getElementById('alert-engine').value;

  try {
    const data = await api('/api/obscura/alerts', { method: 'POST', body: { keywords, engine } });
    state.alerts.push({ ...data, keywords, engine });
    localStorage.setItem('obscura-alerts', JSON.stringify(state.alerts));
    document.getElementById('alert-keywords').value = '';
    renderAlerts();
    showToast('add_alert', `Alert created for: ${keywords.join(', ')}`);
  } catch (e) {
    showToast('error', 'Failed to create alert: ' + e.message);
  }
}

async function checkAlert(id) {
  try {
    const data = await api('/api/obscura/alerts/check', { method: 'POST', body: { id } });
    const alert = state.alerts.find(a => a.id === id);
    if (alert) {
      alert.lastResults = data.results;
      alert.lastCheck = new Date().toISOString();
      localStorage.setItem('obscura-alerts', JSON.stringify(state.alerts));
    }
    renderAlerts();
    if (data.total > 0) showToast('notifications', `Alert found ${data.total} results!`);
    else showToast('check_circle', 'No new results for this alert');
  } catch (e) {
    showToast('error', 'Check failed: ' + e.message);
  }
}

function removeAlert(id) {
  api('/api/obscura/alerts', { method: 'DELETE', body: { id } }).catch(() => {});
  state.alerts = state.alerts.filter(a => a.id !== id);
  localStorage.setItem('obscura-alerts', JSON.stringify(state.alerts));
  renderAlerts();
}

function renderAlerts() {
  const list = document.getElementById('alert-list');
  if (state.alerts.length === 0) {
    list.innerHTML = `<div class="glass-panel rounded-xl p-8 text-center">
      <span class="material-symbols-outlined text-[48px] text-outline-variant">notifications_off</span>
      <p class="font-body-md text-body-md text-on-surface-variant mt-3">No keyword alerts configured</p>
    </div>`;
    return;
  }
  list.innerHTML = state.alerts.map(a => {
    const results = a.lastResults || [];
    const keywords = Array.isArray(a.keywords) ? a.keywords : [a.keywords];
    return `
      <div class="glass-panel rounded-xl p-5">
        <div class="flex items-center gap-4 mb-3">
          <span class="material-symbols-outlined text-[20px] text-tertiary">notifications</span>
          <div class="flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              ${keywords.map(k => `<span class="tag bg-tertiary-container/20 text-tertiary border border-tertiary-container/30">${escapeHtml(k)}</span>`).join('')}
            </div>
            <p class="font-code-sm text-code-sm text-on-surface-variant mt-1">Engine: ${a.engine} · ${results.length} results${a.lastCheck ? ' · Last check: ' + timeAgo(a.lastCheck) : ''}</p>
          </div>
          <button onclick="checkAlert(${a.id})" class="p-2 rounded hover:bg-surface-container-high transition-colors" title="Check now">
            <span class="material-symbols-outlined text-[18px] text-on-surface-variant">refresh</span>
          </button>
          <button onclick="removeAlert(${a.id})" class="p-2 rounded hover:bg-error-container/30 transition-colors" title="Remove">
            <span class="material-symbols-outlined text-[18px] text-error/70">delete</span>
          </button>
        </div>
        ${results.length > 0 ? `<div class="space-y-2 mt-3">${results.slice(0, 3).map(r => 
          `<a href="${escapeHtml(r.url || '#')}" target="_blank" class="block glass-panel rounded p-3 hover:bg-surface-container-high transition-colors">
            <p class="font-body-md text-body-md text-primary truncate">${escapeHtml(r.title || 'Untitled')}</p>
            <p class="font-code-sm text-code-sm text-on-surface-variant mt-1 line-clamp-1">${escapeHtml(r.snippet || '')}</p>
          </a>`
        ).join('')}${results.length > 3 ? `<p class="font-code-sm text-code-sm text-on-surface-variant text-center">+${results.length - 3} more</p>` : ''}</div>` : ''}
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// BULK SCRAPE
// ═══════════════════════════════════════════════════════════════

state.bulkResults = [];

async function performBulkScrape() {
  const urlsText = document.getElementById('bulk-urls').value.trim();
  if (!urlsText) return;
  const urls = urlsText.split('\n').map(u => u.trim()).filter(Boolean);
  const mode = document.getElementById('bulk-mode').value;
  const concurrency = parseInt(document.getElementById('bulk-concurrency').value);

  const status = document.getElementById('bulk-status');
  const statusText = document.getElementById('bulk-status-text');
  const progressBar = document.getElementById('bulk-progress');
  const btn = document.getElementById('btn-bulk');
  const resultsDiv = document.getElementById('bulk-results');

  status.classList.remove('hidden');
  btn.disabled = true;
  resultsDiv.innerHTML = '';
  statusText.textContent = `Scraping ${urls.length} URLs (${concurrency} concurrent)...`;
  progressBar.style.width = '0%';

  try {
    const data = await api('/api/obscura/bulk-scrape', {
      method: 'POST',
      body: { urls, dump: mode, concurrency },
      timeout: urls.length * 30000
    });

    state.bulkResults = data.results || [];
    status.classList.add('hidden');
    progressBar.style.width = '100%';

    let html = `<div class="flex items-center justify-between mb-4">
      <span class="font-code-sm text-code-sm text-on-surface-variant">${data.completed}/${data.total} URLs scraped successfully</span>
    </div>`;

    state.bulkResults.forEach((r, i) => {
      const statusColor = r.status === 'ok' ? 'bg-secondary' : r.status === 'blocked' ? 'bg-tertiary' : 'bg-error';
      html += `
        <div class="glass-panel rounded-xl p-4">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-3 h-3 rounded-full ${statusColor}"></div>
            <span class="font-code-sm text-code-sm text-on-surface truncate flex-1">${escapeHtml(r.url)}</span>
            <span class="tag ${r.status === 'ok' ? 'bg-secondary/20 text-secondary border-secondary/30' : 'bg-error/20 text-error border-error/30'}">${r.status}</span>
          </div>
          <pre class="font-code-sm text-code-sm text-on-surface-variant bg-surface-container-low rounded p-3 overflow-auto max-h-[200px] whitespace-pre-wrap break-all text-xs">${escapeHtml((r.output || r.error || '').substring(0, 2000))}</pre>
        </div>`;
    });

    resultsDiv.innerHTML = html;
    state.stats.pages += data.completed;
    updateStats();
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

function exportBulkCSV() {
  if (state.bulkResults.length === 0) { showToast('warning', 'No results to export'); return; }
  const rows = [['URL', 'Status', 'Output']];
  state.bulkResults.forEach(r => rows.push([r.url, r.status, (r.output || r.error || '').replace(/\n/g, ' ')]));
  downloadCSV(rows, 'obscura-bulk-scrape.csv');
}

// ═══════════════════════════════════════════════════════════════
// BOOKMARKS
// ═══════════════════════════════════════════════════════════════

state.bookmarks = JSON.parse(localStorage.getItem('obscura-bookmarks') || '[]');

function addBookmark() {
  const name = document.getElementById('bookmark-name').value.trim();
  const query = document.getElementById('bookmark-query').value.trim();
  const engine = document.getElementById('bookmark-engine').value;
  if (!query) { showToast('warning', 'Enter a search query'); return; }

  const bookmark = { id: Date.now(), name: name || query, query, engine, createdAt: new Date().toISOString() };
  state.bookmarks.push(bookmark);
  localStorage.setItem('obscura-bookmarks', JSON.stringify(state.bookmarks));
  document.getElementById('bookmark-name').value = '';
  document.getElementById('bookmark-query').value = '';
  renderBookmarks();
  showToast('bookmark', `Bookmark saved: ${bookmark.name}`);
}

function removeBookmark(id) {
  state.bookmarks = state.bookmarks.filter(b => b.id !== id);
  localStorage.setItem('obscura-bookmarks', JSON.stringify(state.bookmarks));
  renderBookmarks();
}

function runBookmark(id) {
  const bm = state.bookmarks.find(b => b.id === id);
  if (!bm) return;
  document.getElementById('search-input').value = bm.query;
  document.getElementById('opt-engine').value = bm.engine;
  switchTab('search');
  performSearch();
}

function renderBookmarks() {
  const list = document.getElementById('bookmark-list');
  if (state.bookmarks.length === 0) {
    list.innerHTML = `<div class="glass-panel rounded-xl p-8 text-center">
      <span class="material-symbols-outlined text-[48px] text-outline-variant">bookmark_border</span>
      <p class="font-body-md text-body-md text-on-surface-variant mt-3">No bookmarks saved</p>
    </div>`;
    return;
  }
  list.innerHTML = state.bookmarks.map(b => `
    <div class="glass-panel rounded-xl p-4 flex items-center gap-4">
      <span class="material-symbols-outlined text-[20px] text-primary">bookmark</span>
      <div class="flex-1 min-w-0">
        <p class="font-body-md text-body-md text-on-surface truncate">${escapeHtml(b.name)}</p>
        <p class="font-code-sm text-code-sm text-on-surface-variant">${escapeHtml(b.query)} · ${b.engine}</p>
      </div>
      <button onclick="runBookmark(${b.id})" class="p-2 rounded hover:bg-primary/10 transition-colors" title="Run search">
        <span class="material-symbols-outlined text-[18px] text-primary">play_arrow</span>
      </button>
      <button onclick="removeBookmark(${b.id})" class="p-2 rounded hover:bg-error-container/30 transition-colors" title="Remove">
        <span class="material-symbols-outlined text-[18px] text-error/70">delete</span>
      </button>
    </div>`
  ).join('');
}

// ═══════════════════════════════════════════════════════════════
// SCHEDULED SEARCHES
// ═══════════════════════════════════════════════════════════════

state.scheduled = JSON.parse(localStorage.getItem('obscura-scheduled') || '[]');

async function addScheduled() {
  const query = document.getElementById('sched-query').value.trim();
  if (!query) return;
  const engine = document.getElementById('sched-engine').value;
  const interval = parseInt(document.getElementById('sched-interval').value);

  try {
    const data = await api('/api/obscura/scheduled', { method: 'POST', body: { query, engine, interval } });
    state.scheduled.push(data);
    localStorage.setItem('obscura-scheduled', JSON.stringify(state.scheduled));
    document.getElementById('sched-query').value = '';
    renderScheduled();
    showToast('schedule', `Scheduled: "${query}" every ${formatInterval(interval)}`);
  } catch (e) {
    showToast('error', 'Failed to schedule: ' + e.message);
  }
}

async function removeScheduled(id) {
  await api('/api/obscura/scheduled', { method: 'DELETE', body: { id } }).catch(() => {});
  state.scheduled = state.scheduled.filter(s => s.id !== id);
  localStorage.setItem('obscura-scheduled', JSON.stringify(state.scheduled));
  renderScheduled();
}

async function toggleScheduled(id) {
  try {
    const data = await api('/api/obscura/scheduled/toggle', { method: 'POST', body: { id } });
    const sched = state.scheduled.find(s => s.id === id);
    if (sched) sched.active = data.active;
    localStorage.setItem('obscura-scheduled', JSON.stringify(state.scheduled));
    renderScheduled();
  } catch (e) {
    showToast('error', 'Toggle failed: ' + e.message);
  }
}

function renderScheduled() {
  const list = document.getElementById('scheduled-list');
  if (state.scheduled.length === 0) {
    list.innerHTML = `<div class="glass-panel rounded-xl p-8 text-center">
      <span class="material-symbols-outlined text-[48px] text-outline-variant">schedule</span>
      <p class="font-body-md text-body-md text-on-surface-variant mt-3">No scheduled searches</p>
    </div>`;
    return;
  }
  list.innerHTML = state.scheduled.map(s => {
    const results = s.results || [];
    return `
      <div class="glass-panel rounded-xl p-5 ${s.active ? 'glow-green' : ''}">
        <div class="flex items-center gap-4 mb-3">
          <div class="w-3 h-3 rounded-full ${s.active ? 'bg-secondary status-pulse' : 'bg-outline-variant'}"></div>
          <div class="flex-1">
            <p class="font-body-md text-body-md text-on-surface">${escapeHtml(s.query)}</p>
            <p class="font-code-sm text-code-sm text-on-surface-variant">${s.engine} · Every ${formatInterval(s.interval)} · ${results.length} results${s.lastRun ? ' · Last: ' + timeAgo(s.lastRun) : ''}</p>
          </div>
          <button onclick="toggleScheduled(${s.id})" class="p-2 rounded hover:bg-surface-container-high transition-colors">
            <span class="material-symbols-outlined text-[18px] text-on-surface-variant">${s.active ? 'pause' : 'play_arrow'}</span>
          </button>
          <button onclick="removeScheduled(${s.id})" class="p-2 rounded hover:bg-error-container/30 transition-colors">
            <span class="material-symbols-outlined text-[18px] text-error/70">delete</span>
          </button>
        </div>
        ${results.length > 0 ? `<div class="space-y-1 mt-2">${results.slice(0, 3).map(r => 
          `<a href="${escapeHtml(r.url || '#')}" target="_blank" class="block text-sm text-primary hover:text-primary-fixed-dim truncate">${escapeHtml(r.title || r.url || '')}</a>`
        ).join('')}${results.length > 3 ? `<p class="font-code-sm text-code-sm text-on-surface-variant">+${results.length - 3} more</p>` : ''}</div>` : ''}
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// THEME TOGGLE
// ═══════════════════════════════════════════════════════════════

state.theme = localStorage.getItem('obscura-theme') || 'dark';

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('obscura-theme', state.theme);
  applyTheme();
  showToast('palette', `Theme: ${state.theme}`);
}

function applyTheme() {
  const html = document.documentElement;
  const btn = document.getElementById('btn-theme');
  if (state.theme === 'light') {
    html.classList.add('light');
    html.classList.remove('dark');
    btn.innerHTML = '<span class="material-symbols-outlined">light_mode</span>';
  } else {
    html.classList.remove('light');
    html.classList.add('dark');
    btn.innerHTML = '<span class="material-symbols-outlined">dark_mode</span>';
  }
}

// ═══════════════════════════════════════════════════════════════
// CSV EXPORT HELPERS
// ═══════════════════════════════════════════════════════════════

function downloadCSV(rows, filename) {
  const csv = rows.map(row => row.map(cell => {
    const s = String(cell || '');
    return s.includes(',') || s.includes('\"') || s.includes('\n') ? '\"' + s.replace(/\"/g, '\"\"') + '\"' : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportHistoryCSV() {
  if (state.history.length === 0) { showToast('warning', 'No history to export'); return; }
  const rows = [['Type', 'Query', 'Results', 'Latency (ms)', 'Timestamp']];
  state.history.forEach(h => rows.push([h.type, h.query, h.resultCount, h.latency, h.timestamp]));
  downloadCSV(rows, 'obscura-history.csv');
  showToast('download', 'History exported as CSV');
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
  if (type === 'search') {
    // Export history as CSV
    exportHistoryCSV();
    return;
  }
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
  applyTheme();
  checkAuth();
  renderMonitors();
  renderProxies();
  renderHistory();
  renderAlerts();
  renderBookmarks();
  renderScheduled();
  loadNotifications();
  updateStats();
  connectWebSocket();

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
