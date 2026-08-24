/**
 * G P Unite — Theme System
 * Dark/Light/High-Contrast themes with live preview
 */

let previewedTheme = null;
const savedTheme = localStorage.getItem('fcm_theme') || '';

function syncThemePreviewCards(theme) {
  document.querySelectorAll('.theme-preview-card').forEach(c => {
    c.classList.remove('active');
    c.setAttribute('aria-checked', 'false');
  });
  const id = theme === 'light' ? 'preview-light' : theme === 'high-contrast' ? 'preview-high-contrast' : 'preview-dark';
  const el = document.getElementById(id);
  if (el) { el.classList.add('active'); el.setAttribute('aria-checked', 'true'); }
}

function toggleTheme() {
  const html = document.documentElement;
  const cur = html.getAttribute('data-theme');
  const next = cur === 'light' ? 'dark' : 'light';
  if (next === 'dark') html.removeAttribute('data-theme');
  else html.setAttribute('data-theme', next);
  localStorage.setItem('fcm_theme', next);
  document.getElementById('themeToggle').querySelector('span:first-child').textContent = next === 'light' ? '☀️' : '🌙';
  syncThemePreviewCards(next);
}

function toggleHighContrast() {
  const html = document.documentElement;
  const t = document.getElementById('hcToggle');
  if (html.getAttribute('data-theme') === 'high-contrast') {
    html.removeAttribute('data-theme');
    t.classList.remove('active');
    t.setAttribute('aria-checked', 'false');
    localStorage.setItem('fcm_theme', 'dark');
    syncThemePreviewCards('dark');
  } else {
    html.setAttribute('data-theme', 'high-contrast');
    t.classList.add('active');
    t.setAttribute('aria-checked', 'true');
    localStorage.setItem('fcm_theme', 'high-contrast');
    syncThemePreviewCards('high-contrast');
  }
}

function previewTheme(theme) {
  previewedTheme = theme;
  const html = document.documentElement;
  if (theme === 'dark') html.removeAttribute('data-theme');
  else html.setAttribute('data-theme', theme);
  syncThemePreviewCards(theme);
  document.getElementById('themeToggle').querySelector('span:first-child').textContent =
    theme === 'light' ? '☀️' : theme === 'high-contrast' ? '◐' : '🌙';
  announceToSR('Previewing ' + theme + ' theme');
}

function applyPreviewedTheme() {
  if (!previewedTheme) { showToast('Select a theme', 'info'); return; }
  localStorage.setItem('fcm_theme', previewedTheme);
  showToast('Theme applied!', 'success');
  previewedTheme = null;
}

function resetThemePreview() {
  const html = document.documentElement;
  if (savedTheme === 'dark' || !savedTheme) html.removeAttribute('data-theme');
  else html.setAttribute('data-theme', savedTheme);
  previewedTheme = null;
  syncThemePreviewCards(savedTheme || 'dark');
}

function toggleMotion() {
  const html = document.documentElement;
  const t = document.getElementById('motionToggle2');
  if (html.getAttribute('data-motion') === 'reduced') {
    html.removeAttribute('data-motion');
    t.classList.remove('active');
  } else {
    html.setAttribute('data-motion', 'reduced');
    t.classList.add('active');
  }
}

function setFontSize(size) {
  if (size === 'default') document.documentElement.removeAttribute('data-font');
  else document.documentElement.setAttribute('data-font', size);
}
