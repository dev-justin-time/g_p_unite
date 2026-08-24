/**
 * G P Unite — Platform Core
 * Navigation, onboarding, rendering, modals, toasts, live metrics
 */

/* ── UTILITIES ────────────────────────────── */
function esc(text) {
  const d = document.createElement('div');
  d.textContent = String(text);
  return d.innerHTML;
}

function announceToSR(message) {
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.className = 'sr-only';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

/* ── NAVIGATION ───────────────────────────── */
function navigateTo(page) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => { n.classList.remove('active'); n.removeAttribute('aria-current'); });
  const navBtn = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navBtn) { navBtn.classList.add('active'); navBtn.setAttribute('aria-current', 'page'); }

  const label = navBtn ? navBtn.textContent.trim().replace(/\d+$/, '').trim() : page;
  document.getElementById('breadcrumbCurrent').textContent = label;
  document.getElementById('sidebar').classList.remove('open');
  announceToSR('Navigated to ' + label);
  document.getElementById('main-content').focus();
}

/* ── MODALS ───────────────────────────────── */
function showModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('show');
  modal.querySelector('button, input')?.focus();
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('show');
  document.body.style.overflow = '';
}

/* ── TOAST ────────────────────────────────── */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = '<span>' + (icons[type] || 'ℹ️') + '</span><span>' + esc(message) + '</span>';
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity .3s'; setTimeout(() => toast.remove(), 300); }, 4000);
}

/* ── ONBOARDING ───────────────────────────── */
let wizardStep = 1;
let selectedCaps = [];

function completeStep(step) {
  wizardStep = step;
  document.querySelectorAll('.wizard-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('step' + step)?.classList.add('active');
  document.querySelectorAll('.wizard-step').forEach((s, i) => {
    s.classList.remove('active', 'done');
    if (i + 1 < step) s.classList.add('done');
    if (i + 1 === step) s.classList.add('active');
  });
  if (step === 4) updateLaunchSummary();
}

function toggleCap(el) {
  const isSelected = el.classList.toggle('selected');
  el.setAttribute('aria-checked', isSelected);
  const name = el.querySelector('.cap-name').textContent;
  if (isSelected) selectedCaps.push(name);
  else selectedCaps = selectedCaps.filter(c => c !== name);
}

function connectWallet() {
  const addr = document.getElementById('walletAddress').value ||
    '0x' + Array.from({ length: 40 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
  document.getElementById('walletAddress').value = addr;
  loginWithWallet(addr).then(() => {
    showToast('Connected: ' + addr.slice(0, 6) + '...' + addr.slice(-4), 'success');
    setTimeout(() => completeStep(2), 800);
  });
}

function updateLaunchSummary() {
  document.getElementById('sumWallet').textContent =
    (document.getElementById('walletAddress').value || 'Not connected').slice(0, 10) + '...';
  const gpu = document.getElementById('hwGpu').value;
  const ram = document.getElementById('hwRam').value;
  document.getElementById('sumHardware').textContent = gpu && ram ? gpu + ' · ' + ram : 'Not configured';
  document.getElementById('sumCaps').textContent = selectedCaps.length + ' selected';
  const score = selectedCaps.length * 600 + (gpu && gpu.includes('4090') ? 3000 : gpu && gpu.includes('A100') ? 5000 : 1000);
  const tier = score >= 50000 ? 5 : score >= 10000 ? 4 : score >= 2000 ? 3 : score >= 500 ? 2 : score >= 100 ? 1 : 0;
  document.getElementById('sumTier').textContent = 'T' + tier + ' — ' + TIERS[tier].name;
}

function launchNode() {
  showToast('🚀 Node launched! Welcome to the mesh.', 'success');
  setTimeout(() => navigateTo('dashboard'), 1500);
}

/* ── RENDER ───────────────────────────────── */
function renderTierGrids() {
  ['dashTiers', 'stakingTiers'].forEach(id => {
    const grid = document.getElementById(id);
    if (!grid) return;
    grid.innerHTML = TIERS.map((t, i) =>
      '<div class="tier-card" data-tier="' + i + '" tabindex="0"><div class="tier-rank">' + (i === 5 ? '👑' : 'T' + i) + '</div><div class="tier-name">' + esc(t.name) + '</div><div class="tier-detail">Min: ' + esc(t.min) + ' · ' + esc(t.mult) + '</div></div>'
    ).join('');
  });
}

function renderAgents(filter) {
  const grid = document.getElementById('agentsGrid');
  const filtered = filter === 'all' ? AGENTS : AGENTS.filter(a => a.category === filter);
  grid.innerHTML = filtered.map(a => {
    const mhtml = a.metrics.map(m => {
      const v = typeof m.value === 'number' ? m.value.toLocaleString() : m.value;
      return '<div class="metric"><div class="metric-value" id="m-' + a.id + '-' + m.key + '">' + esc(v) + '</div><div class="metric-label">' + esc(m.label) + '</div></div>';
    }).join('');
    const rhtml = a.rules.map(r =>
      '<div class="logic-item"><span class="logic-key">' + esc(r.name) + '</span><span class="logic-val ' + (r.on ? 'on' : 'off') + '">' + (r.on ? 'ON' : 'OFF') + '</span></div>'
    ).join('');
    return '<div class="agent-card ' + esc(a.category) + '" role="listitem" aria-label="' + esc(a.name) + '">' +
      '<div class="agent-header"><div class="agent-title"><div class="agent-icon">' + a.icon + '</div><div><div class="agent-name">' + esc(a.name) + '</div><div class="agent-role">' + esc(a.role) + '</div></div></div>' +
      '<div class="agent-badges"><span class="badge ' + (a.status === 'active' ? 'badge-green' : 'badge-amber') + '">' + (a.status === 'active' ? '● Active' : '○ Standby') + '</span><span class="badge badge-blue">T' + a.tier + '</span></div></div>' +
      '<div class="logic-section"><div class="logic-title">Built-in Logic Rules</div>' + rhtml + '</div>' +
      '<div class="metrics-row">' + mhtml + '</div>' +
      '<div class="action-bar"><button class="btn btn-secondary" onclick="viewSource(\'' + a.id + '\')">View Logic</button><button class="btn btn-primary" onclick="runAgentAction(\'' + a.id + '\')">⚡ Run Agent</button></div>' +
      '</div>';
  }).join('');
}

document.querySelectorAll('.agent-filter').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.agent-filter').forEach(b => { b.classList.remove('btn-primary'); b.classList.add('btn-secondary'); b.classList.remove('active'); });
    btn.classList.add('btn-primary'); btn.classList.remove('btn-secondary'); btn.classList.add('active');
    renderAgents(btn.dataset.filter);
  });
});

function viewSource(id) {
  const a = AGENTS.find(x => x.id === id);
  if (!a) return;
  document.getElementById('sourceModalTitle').textContent = a.icon + ' ' + a.name + ' — Logic Source';
  document.getElementById('sourceModalBody').textContent = a.source;
  showModal('sourceModal');
}

async function runAgentAction(id) {
  const a = AGENTS.find(x => x.id === id);
  if (!a) return;
  if (typeof getDataMode === 'function' && getDataMode() === 'demo') {
    simulateAgent(id);
    return;
  }
  try {
    const response = await fetch('/api/v1/agents/' + encodeURIComponent(id) + '/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Agent action failed');
    showToast(a.icon + ' ' + a.name + ' completed a live action', 'success');
  } catch (error) {
    showToast('Live agent action unavailable: ' + error.message, 'error');
  }
}

function simulateAgent(id) {
  const a = AGENTS.find(x => x.id === id);
  if (!a) return;
  document.querySelectorAll('.agent-card[aria-label="' + a.name + '"] .metric-value').forEach(m => {
    m.style.transform = 'scale(1.2)';
    setTimeout(() => m.style.transform = 'scale(1)', 200);
  });
  if (a.tick) {
    const vals = {};
    a.metrics.forEach(m => vals[m.key] = m.value);
    a.tick(vals);
    a.metrics.forEach(m => {
      m.value = vals[m.key];
      const el = document.getElementById('m-' + a.id + '-' + m.key);
      if (el) el.textContent = typeof m.value === 'number' ? m.value.toLocaleString() : String(m.value);
    });
  }
  showToast(a.icon + ' ' + a.name + ' simulated (Demo mode)', 'success');
}

function renderTasks() {
  const tb = document.getElementById('taskTableBody');
  tb.innerHTML = TASKS.map(t =>
    '<tr><td><strong>' + esc(t.name) + '</strong></td><td><span class="badge badge-blue">' + esc(t.type) + '</span></td><td style="font-family:\'JetBrains Mono\',monospace;font-weight:600;">' + t.reward.toLocaleString() + ' FCM</td><td>' + esc(t.deadline) + '</td><td><span class="badge badge-purple">T' + t.tier + '+</span></td><td><button class="btn btn-sm btn-primary" onclick="claimTask(\'' + esc(t.name) + '\')" data-action="claim_task">Claim</button></td></tr>'
  ).join('');
}

async async function claimTask(name) {
  if (typeof getDataMode === 'function' && getDataMode() === 'demo') {
    showToast('Task "' + name + '" claimed (Demo mode)', 'success');
    return;
  }
  try {
    const r = await fetch('/api/v1/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Task claim failed');
    showToast('Task "' + name + '" claimed!', 'success');
  } catch (e) { showToast('Live task claim unavailable: ' + e.message, 'error'); }
}

function renderProposals() {
  const container = document.getElementById('proposalsList');
  container.innerHTML = PROPOSALS.map(p => {
    const total = p.forVotes + p.againstVotes + p.abstainVotes;
    const fp = Math.round(p.forVotes / total * 100);
    const ap = Math.round(p.againstVotes / total * 100);
    const rb = p.risk === 'Low' ? 'badge-green' : p.risk === 'Medium' ? 'badge-amber' : 'badge-red';
    return '<div class="proposal-card"><div class="proposal-header"><div><div class="proposal-id">' + esc(p.id) + ' · ' + esc(p.type) + '</div><div class="proposal-title">' + esc(p.title) + '</div><div style="font-size:var(--font-xs);color:var(--text-muted);margin-top:4px;">By ' + esc(p.author) + ' · ' + esc(p.deadline) + ' left</div></div><span class="badge ' + rb + '">' + esc(p.risk) + '</span></div><div class="proposal-votes"><div style="flex:1;"><div style="display:flex;justify-content:space-between;font-size:var(--font-xs);"><span style="color:var(--green);">For (' + fp + '%)</span><span>' + p.forVotes + '</span></div><div class="vote-bar"><div class="vote-bar-fill vote-for" style="width:' + fp + '%;"></div></div></div><div style="flex:1;"><div style="display:flex;justify-content:space-between;font-size:var(--font-xs);"><span style="color:var(--red);">Against (' + ap + '%)</span><span>' + p.againstVotes + '</span></div><div class="vote-bar"><div class="vote-bar-fill vote-against" style="width:' + ap + '%;"></div></div></div></div><div style="display:flex;gap:8px;margin-top:12px;"><button class="btn btn-sm btn-success" onclick="castVote(\'' + esc(p.id) + '\',\'for\')" data-action="vote">👍 For</button><button class="btn btn-sm btn-danger" onclick="castVote(\'' + esc(p.id) + '\',\'against\')" data-action="vote">👎 Against</button><button class="btn btn-sm btn-ghost" onclick="castVote(\'' + esc(p.id) + '\',\'abstain\')" data-action="vote">🤷 Abstain</button></div></div>';
  }).join('');
}

function castVote(id, vote) { showToast('Vote "' + vote + '" cast on ' + id, 'success'); }

function submitProposal() {
  const t = document.getElementById('propTitle').value;
  if (!t.trim()) { showToast('Enter a title', 'error'); return; }
  showToast('Proposal submitted!', 'success');
  closeModal('proposalModal');
}

function executeStake() {
  const amt = parseInt(document.getElementById('stakeAmount')?.value || '0');
  if (amt <= 0) { showToast('Enter an amount', 'error'); return; }
  showToast('Staked ' + amt.toLocaleString() + ' FCM!', 'success');
  closeModal('stakeModal');
}

function renderBadges() {
  document.getElementById('badgeGrid').innerHTML = BADGES_DATA.map(b =>
    '<div class="rep-badge ' + (b.earned ? 'earned' : '') + '" role="img" aria-label="' + esc(b.name) + ' — ' + (b.earned ? 'Earned' : 'Locked') + '"><div class="badge-icon">' + b.icon + '</div><div class="badge-name">' + esc(b.name) + '</div><div class="badge-desc">' + (b.earned ? '✅ Earned' : '🔒 Locked') + '</div></div>'
  ).join('');
}

function renderChat() {
  const container = document.getElementById('chatMessages');
  container.innerHTML = CHAT_MESSAGES.map(m =>
    '<div class="chat-msg ' + (m.isAgent ? 'agent' : 'user') + '"><div class="msg-sender">' + esc(m.sender) + '</div><div>' + esc(m.text) + '</div></div>'
  ).join('');
  container.scrollTop = container.scrollHeight;
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  CHAT_MESSAGES.push({ sender: 'You', text, isAgent: false });
  input.value = '';
  renderChat();
  setTimeout(() => {
    const responses = [
      'Processing your request...',
      'Got it! Updated the task queue.',
      'Analysis complete. 99.2% uptime.',
      'Acknowledged. Coordinating with agents.',
      'Task assigned. ETA: 12 minutes.'
    ];
    CHAT_MESSAGES.push({ sender: '🤖 Coordinator', text: responses[Math.floor(Math.random() * responses.length)], isAgent: true });
    renderChat();
  }, 1200);
}

function renderActivity() {
  const acts = [
    { time: '2 min ago', text: '💰 Rewards Distributor distributed 847k FCM' },
    { time: '5 min ago', text: '📊 Tier Manager upgraded 12 nodes' },
    { time: '8 min ago', text: '🏛️ PIP-003 reached quorum — Emergency pause' },
    { time: '12 min ago', text: '🔒 ESC-0042 milestone 2 submitted' },
    { time: '15 min ago', text: '🏅 Reputation Oracle awarded 342 achievements' },
    { time: '20 min ago', text: '🤝 Coordinator onboarded 8 new nodes' },
    { time: '25 min ago', text: '✅ Storage Provider completed 847 retrievals' },
    { time: '30 min ago', text: '🧠 Inference Router: 4,821 tok/sec' },
    { time: '35 min ago', text: '🛡️ ZK Prover: 16 aggregated proofs' },
    { time: '40 min ago', text: '🎮 Game Host matched 64 players' }
  ];
  document.getElementById('activityLog').innerHTML = acts.map(a =>
    '<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-color);"><span style="font-size:var(--font-xs);color:var(--text-muted);min-width:80px;">' + esc(a.time) + '</span><span style="font-size:var(--font-sm);">' + esc(a.text) + '</span></div>'
  ).join('');
}

function renderContractAdmin() {
  const g = document.getElementById('contractAdminGrid');
  if (!g) return;
  const contracts = [
    { name: 'FCMToken' }, { name: 'FCMAgentRegistry' }, { name: 'FCMTaskMarketplace' },
    { name: 'FCMTierStaking' }, { name: 'FCMGovernance' }, { name: 'FCMEscrow' },
    { name: 'FCMReputationNFT' }, { name: 'FCMRewardsPool' }
  ];
  g.innerHTML = contracts.map(c =>
    '<div class="card" style="padding:16px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><h3 style="font-size:var(--font-base);font-weight:700;">' + esc(c.name) + '</h3><span class="badge badge-green">Unpaused</span></div><div style="display:flex;gap:8px;"><button class="btn btn-sm btn-danger" data-action="pause_contracts" onclick="showToast(\'' + esc(c.name) + ' pause toggled\',\'info\')">⏸ Pause</button><button class="btn btn-sm btn-secondary">Etherscan</button></div></div>'
  ).join('');
}

/* ── LIVE METRICS ─────────────────────────── */
function updateLiveMetrics() {
  AGENTS.forEach(a => {
    if (!a.tick) return;
    const vals = {};
    a.metrics.forEach(m => vals[m.key] = m.value);
    a.tick(vals);
    a.metrics.forEach(m => {
      m.value = vals[m.key];
      const el = document.getElementById('m-' + a.id + '-' + m.key);
      if (el) {
        const nv = typeof m.value === 'number' ? m.value.toLocaleString() : m.value;
        if (el.textContent !== String(nv)) el.textContent = nv;
      }
    });
  });
  document.getElementById('dashLatency').textContent = (12 + Math.floor(Math.random() * 6)) + 'ms';
}

/* ── AGENT FOCUS ──────────────────────────── */
let focusedAgentId = null;

function selectAgent(id) {
  focusedAgentId = id || null;
  const sec = document.getElementById('focusedAgentSection');
  const chip = document.getElementById('focusedAgentChip');
  const info = document.getElementById('focusedAgentInfo');
  if (!focusedAgentId) { sec.style.display = 'none'; chip.innerHTML = ''; info.innerHTML = ''; return; }
  sec.style.display = 'block';
  const names = { inf: 'Inference Router', ren: 'Render Splitter', fl: 'FL Coordinator', edge: 'Edge Runner', zk: 'ZK Prover', game: 'Game Host', sci: 'Science Grid', priv: 'Privacy Mesh', node: 'Node Runner', stor: 'Storage Provider', fsrv: 'File Server', rwrd: 'Rewarded Worker', tier: 'Tier Manager', reward: 'Rewards Distributor', gov: 'Governance Agent', escrow: 'Escrow Manager', rep: 'Reputation Oracle', coord: 'Agent Coordinator' };
  chip.innerHTML = '<span class="agent-chip">' + (names[id] || id) + '<button class="remove-chip" onclick="document.getElementById(\'agentSelect\').value=\'\';selectAgent(\'\')">×</button></span>';
  document.getElementById('focusedChartTitle').textContent = names[id] || id;
  info.innerHTML = '<div style="color:var(--text-muted);font-size:var(--font-sm);">Subscribed to live updates.</div>';
  renderAllCharts();
}

/* ── SETTINGS TABS ────────────────────────── */
function switchSettingsTab(tab) {
  document.querySelectorAll('.settings-panel').forEach(p => p.style.display = 'none');
  const t = document.getElementById('settings-' + tab);
  if (t) t.style.display = 'block';
  const tp = document.getElementById('settings-themes');
  if (tp) tp.style.display = tab === 'accessibility' ? 'block' : 'none';
  document.querySelectorAll('#page-settings .tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
  if (event && event.target) { event.target.classList.add('active'); event.target.setAttribute('aria-selected', 'true'); }
}

function addUser() {
  const a = document.getElementById('newUserAddr')?.value;
  if (!a?.trim()) { showToast('Enter address', 'error'); return; }
  showToast('User added!', 'success');
  closeModal('addUserModal');
}
