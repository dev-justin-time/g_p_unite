import { agents } from './agents/index.js';

const grid = document.getElementById('agentsGrid');

function renderAgents() {
  grid.innerHTML = agents.map(agent => `
    <div class="agent-card ${agent.id}" data-id="${agent.id}">
      <div class="agent-header">
        <div class="agent-title">
          <div class="agent-icon">${agent.icon}</div>
          <div>
            <div class="agent-name">${agent.name}</div>
            <div class="agent-role">${agent.role}</div>
          </div>
        </div>
        <span class="status-badge ${agent.status === 'active' ? 'status-active' : 'status-standby'}">
          ${agent.status === 'active' ? '● ACTIVE' : '○ STANDBY'}
        </span>
      </div>
      <div class="logic-section">
        <div class="logic-title">Built-in Logic Rules</div>
        ${agent.rules.map(r => `
          <div class="logic-item">
            <span class="logic-key">${r.name}</span>
            <span class="logic-val ${r.enabled ? 'true' : 'false'}">${r.enabled ? 'ON' : 'OFF'}</span>
          </div>
        `).join('')}
      </div>
      <div class="metrics-row">
        ${agent.metrics.map(m => `
          <div class="metric">
            <div class="metric-value" id="${agent.id}-${m.key}">${m.value}</div>
            <div class="metric-label">${m.label}</div>
          </div>
        `).join('')}
      </div>
      <div class="action-bar">
        <button class="btn" onclick="viewSource('${agent.id}')">View Source</button>
        <button class="btn primary" onclick="simulate('${agent.id}')">Simulate</button>
      </div>
    </div>
  `).join('');
}

window.viewSource = function(id) {
  const agent = agents.find(a => a.id === id);
  document.getElementById('modalTitle').textContent = `${agent.name} — Source Code`;
  document.getElementById('modalBody').innerHTML = `<pre><code>${escapeHtml(agent.source)}</code></pre>`;
  document.getElementById('modalOverlay').classList.add('show');
};

window.simulate = function(id) {
  const agent = agents.find(a => a.id === id);
  if (agent.simulate) agent.simulate();
};

window.closeModal = function() {
  document.getElementById('modalOverlay').classList.remove('show');
};

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Live metric updates
setInterval(() => {
  agents.forEach(agent => {
    if (agent.tick) agent.tick();
  });
}, 2000);

renderAgents();
