/**
 * G P Unite — WebSocket Client
 * Auth-aware connection with exponential backoff reconnection
 */

let ws = null;
let wsReconnectTimer = null;
let wsReconnectDelay = 1000;
let authToken = localStorage.getItem('fcm_auth_token') || null;
let authAddress = localStorage.getItem('fcm_auth_address') || null;

function setAuth(token, addr) {
  authToken = token;
  authAddress = addr;
  if (token) {
    localStorage.setItem('fcm_auth_token', token);
    localStorage.setItem('fcm_auth_address', addr);
  } else {
    localStorage.removeItem('fcm_auth_token');
    localStorage.removeItem('fcm_auth_address');
  }
}

async function loginWithWallet(addr) {
  if (!addr || !addr.startsWith('0x')) return false;
  try {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: addr, role: 'operator' })
    });
    const d = await r.json();
    if (d.success && d.token) {
      setAuth(d.token, d.address);
      showToast('Logged in as ' + d.role, 'success');
      return true;
    } else {
      showToast(d.error || 'Login failed', 'error');
      return false;
    }
  } catch (e) {
    // Demo mode — create mock auth
    setAuth('mock-' + Date.now(), addr);
    showToast('Connected (demo mode)', 'success');
    return true;
  }
}

function showLoginModal() { showModal('loginModal'); }

function handleLogin() {
  const addr = document.getElementById('loginAddress').value.trim();
  if (!addr) { showToast('Enter address', 'error'); return; }
  loginWithWallet(addr).then(ok => { if (ok) closeModal('loginModal'); });
}

function handleLogout() {
  setAuth(null, null);
  showToast('Logged out', 'info');
  if (ws) ws.close();
}

function updateAuthUI() {
  const lb = document.getElementById('loginBtn');
  const ob = document.getElementById('logoutBtn');
  const as = document.getElementById('authStatus');
  if (authToken) {
    if (lb) lb.style.display = 'none';
    if (ob) ob.style.display = 'block';
    if (as) { as.style.display = 'block'; as.textContent = '🔑 ' + (authAddress || '').slice(0, 10) + '...'; }
  } else {
    if (lb) lb.style.display = 'block';
    if (ob) ob.style.display = 'none';
    if (as) as.style.display = 'none';
  }
}

function updateWsStatus(status) {
  const el = document.getElementById('wsStatus');
  const text = document.getElementById('wsStatusText');
  if (!el || !text) return;
  el.className = 'ws-status ' + status;
  text.textContent = { connected: 'Live', disconnected: 'Offline', connecting: 'Connecting...' }[status] || status;
}

function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  let url = protocol + '//' + location.host;
  if (authToken) url += '?token=' + encodeURIComponent(authToken);

  updateWsStatus('connecting');

  try {
    ws = new WebSocket(url);
  } catch (e) {
    scheduleReconnect();
    return;
  }

  ws.onopen = function () {
    wsReconnectDelay = 1000;
    ws.send(JSON.stringify({ type: 'subscribe', channels: ['agents', 'tiers', 'governance', 'escrows', 'reputation', 'system', 'rewards'] }));
  };

  ws.onmessage = function (event) {
    try {
      const msg = JSON.parse(event.data);
      handleWsMessage(msg);
    } catch (e) { /* ignore parse errors */ }
  };

  ws.onclose = function () {
    updateWsStatus('disconnected');
    ws = null;
    scheduleReconnect();
  };

  ws.onerror = function () { updateWsStatus('disconnected'); };
}

function scheduleReconnect() {
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
  wsReconnectTimer = setTimeout(() => {
    wsReconnectDelay = Math.min(wsReconnectDelay * 1.5, 30000);
    connectWebSocket();
  }, wsReconnectDelay);
}

function handleWsMessage(msg) {
  if (msg.type === 'heartbeat') return;

  if (msg.type === 'auth') {
    if (msg.authed) { updateWsStatus('connected'); }
    else { updateWsStatus('disconnected'); showToast('Auth failed', 'error'); if (!authToken) showLoginModal(); }
    return;
  }

  if (msg.type === 'error') {
    if (msg.code === 'AUTH_REQUIRED' || msg.code === 'INVALID_TOKEN') {
      showToast('Auth required', 'error'); showLoginModal();
    }
    return;
  }

  if (msg.type === 'tokenRefreshed' && msg.token) {
    setAuth(msg.token, authAddress);
    return;
  }

  if (msg.type === 'snapshot' || msg.type === 'update') {
    if (msg.channel === 'agents') ingestAgentData(msg.data);
    if (msg.channel === 'system') ingestSystemData(msg.data);
    if (msg.channel === 'rewards') ingestRewardsData(msg.data);
    renderAllCharts();
  }

  if (msg.type === 'history' && msg.data && Array.isArray(msg.data)) {
    const ch = msg.channel;
    if (ch === 'agents') {
      for (const entry of msg.data) {
        if (entry.data && entry.data.agents) {
          const vals = {};
          const s = [...entry.data.agents].sort((a, b) => (b.reputation || 0) - (a.reputation || 0));
          for (let i = 0; i < Math.min(8, s.length); i++) vals[s[i].id || ('a-' + i)] = s[i].reputation || 0;
          histData.reputation.push({ ts: entry.ts, values: vals });
        }
      }
    }
    renderAllCharts();
  }
}
