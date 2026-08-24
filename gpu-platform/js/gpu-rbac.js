/**
 * G P Unite — RBAC Engine
 * Role-based access control for admin/operator/viewer
 */

let currentRole = localStorage.getItem('fcm_role') || 'admin';
let pendingRole = currentRole;

function hasPermission(action) {
  return RBAC_PERMISSIONS[currentRole]?.actions[action] === true;
}

function canNavigate(page) {
  return RBAC_PERMISSIONS[currentRole]?.nav.includes(page);
}

function applyRBAC() {
  const p = RBAC_PERMISSIONS[currentRole];
  if (!p) return;

  // Sidebar nav items
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    if (p.nav.includes(btn.dataset.page)) btn.classList.remove('role-hidden');
    else btn.classList.add('role-hidden');
  });

  // Admin-only items
  document.querySelectorAll('[data-rbac]').forEach(el => {
    if (el.dataset.rbac === 'admin' && currentRole !== 'admin') el.classList.add('role-hidden');
    else el.classList.remove('role-hidden');
  });

  // Action buttons
  document.querySelectorAll('[data-action]').forEach(btn => {
    const action = btn.dataset.action;
    if (hasPermission(action)) {
      btn.classList.remove('role-restricted');
      btn.removeAttribute('aria-disabled');
      btn.disabled = false;
    } else {
      btn.classList.add('role-restricted');
      btn.setAttribute('data-required-role', p.label + ' required');
      btn.setAttribute('aria-disabled', 'true');
      btn.disabled = true;
    }
  });

  // Update sidebar role badge
  const sb = document.getElementById('sidebarRoleBadge');
  if (sb) { sb.className = 'role-badge ' + p.cssClass; sb.textContent = p.icon + ' ' + p.label; }

  // Navigate away if current page is restricted
  const cur = document.querySelector('.page-section.active')?.id?.replace('page-', '');
  if (cur && !p.nav.includes(cur)) navigateTo(p.nav[0]);

  announceToSR('Role: ' + p.label);
}

function switchRole(role) {
  pendingRole = role;
  document.querySelectorAll('.role-option').forEach(o => { o.classList.remove('selected'); o.setAttribute('aria-checked', 'false'); });
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('selected');
    event.currentTarget.setAttribute('aria-checked', 'true');
  }
  const descs = {
    admin: { t: '🛡 Admin', d: '✅ Full access to all sections, contracts, roles, emergency actions' },
    operator: { t: '⚙ Operator', d: '✅ Manage agents, tasks, staking, governance, chat. ❌ No role management or contract pause' },
    viewer: { t: '👁 Viewer', d: '✅ Read-only: dashboard, agents, marketplace, governance, resources. ❌ No actions' }
  };
  const dd = descs[role];
  const descEl = document.getElementById('roleDescription');
  if (descEl && dd) {
    descEl.innerHTML = '<div style="font-size:var(--font-sm);font-weight:600;margin-bottom:8px;">' + dd.t + ' Permissions</div><div style="font-size:var(--font-xs);color:var(--text-muted);line-height:1.8;">' + dd.d + '</div>';
  }
}

function applyRole() {
  currentRole = pendingRole;
  localStorage.setItem('fcm_role', currentRole);
  applyRBAC();
  closeModal('roleSwitcherModal');
  showToast('Role: ' + RBAC_PERMISSIONS[currentRole].label, 'info');
}

function renderPermissionMatrix() {
  const tbody = document.getElementById('rolePermsBody');
  if (!tbody) return;
  tbody.innerHTML = PERMISSION_MATRIX.map(p => {
    const cell = v => v === 'yes'
      ? '<td class="perm-yes" style="text-align:center;">✅</td>'
      : '<td class="perm-no" style="text-align:center;">❌</td>';
    return '<tr><td>' + esc(p.name) + '</td>' + cell(p.admin) + cell(p.operator) + cell(p.viewer) + '</tr>';
  }).join('');
}

function switchAdminTab(tab) {
  document.querySelectorAll('.admin-panel').forEach(p => p.style.display = 'none');
  const t = document.getElementById('admin-' + tab);
  if (t) t.style.display = 'block';
  document.querySelectorAll('#page-admin .tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
  if (event && event.target) { event.target.classList.add('active'); event.target.setAttribute('aria-selected', 'true'); }
}
