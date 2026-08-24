/**
 * G P Unite — RBAC Engine (TypeScript)
 * Role-based access control for admin/operator/viewer
 */

import type { UserRole, PermissionAction } from './types';
import { RBAC_PERMISSIONS, PERMISSION_MATRIX } from './agents-data';

declare function announceToSR(message: string): void;
declare function closeModal(id: string): void;
declare function showToast(message: string, type?: string): void;
declare function navigateTo(page: string): void;
declare function esc(text: string): string;

export let currentRole: UserRole = (localStorage.getItem('fcm_role') as UserRole) || 'admin';
let pendingRole: UserRole = currentRole;

export function hasPermission(action: PermissionAction): boolean {
  return RBAC_PERMISSIONS[currentRole]?.actions[action] === true;
}

export function canNavigate(page: string): boolean {
  return RBAC_PERMISSIONS[currentRole]?.nav.includes(page) ?? false;
}

export function applyRBAC(): void {
  const p = RBAC_PERMISSIONS[currentRole];
  if (!p) return;

  // Sidebar nav items
  document.querySelectorAll<HTMLElement>('.nav-item[data-page]').forEach(btn => {
    if (p.nav.includes(btn.dataset.page ?? '')) btn.classList.remove('role-hidden');
    else btn.classList.add('role-hidden');
  });

  // Admin-only items
  document.querySelectorAll<HTMLElement>('[data-rbac]').forEach(el => {
    if (el.dataset.rbac === 'admin' && currentRole !== 'admin') el.classList.add('role-hidden');
    else el.classList.remove('role-hidden');
  });

  // Action buttons
  document.querySelectorAll<HTMLElement>('[data-action]').forEach(btn => {
    const action = btn.dataset.action as PermissionAction;
    if (hasPermission(action)) {
      btn.classList.remove('role-restricted');
      btn.removeAttribute('aria-disabled');
      (btn as HTMLButtonElement).disabled = false;
    } else {
      btn.classList.add('role-restricted');
      btn.setAttribute('data-required-role', p.label + ' required');
      btn.setAttribute('aria-disabled', 'true');
      (btn as HTMLButtonElement).disabled = true;
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

export function switchRole(role: UserRole): void {
  pendingRole = role;
  document.querySelectorAll<HTMLElement>('.role-option').forEach(o => { o.classList.remove('selected'); o.setAttribute('aria-checked', 'false'); });
  const target = (event as MouseEvent)?.currentTarget as HTMLElement | null;
  if (target) {
    target.classList.add('selected');
    target.setAttribute('aria-checked', 'true');
  }

  const descs: Record<UserRole, { t: string; d: string }> = {
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

export function applyRole(): void {
  currentRole = pendingRole;
  localStorage.setItem('fcm_role', currentRole);
  applyRBAC();
  closeModal('roleSwitcherModal');
  showToast('Role: ' + RBAC_PERMISSIONS[currentRole].label, 'info');
}

export function renderPermissionMatrix(): void {
  const tbody = document.getElementById('rolePermsBody');
  if (!tbody) return;
  tbody.innerHTML = PERMISSION_MATRIX.map(p => {
    const cell = (v: string): string => v === 'yes'
      ? '<td class="perm-yes" style="text-align:center;">✅</td>'
      : '<td class="perm-no" style="text-align:center;">❌</td>';
    return '<tr><td>' + esc(p.name) + '</td>' + cell(p.admin) + cell(p.operator) + cell(p.viewer) + '</tr>';
  }).join('');
}

export function switchAdminTab(tab: string): void {
  document.querySelectorAll<HTMLElement>('.admin-panel').forEach(p => p.style.display = 'none');
  const t = document.getElementById('admin-' + tab);
  if (t) (t as HTMLElement).style.display = 'block';
  document.querySelectorAll<HTMLElement>('#page-admin .tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
  const target = (event as MouseEvent)?.target as HTMLElement | null;
  if (target) { target.classList.add('active'); target.setAttribute('aria-selected', 'true'); }
}
