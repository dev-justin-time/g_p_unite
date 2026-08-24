/**
 * G P Unite — Theme System (TypeScript)
 * Dark/Light/High-Contrast themes with live preview
 */

declare function announceToSR(message: string): void;
declare function showToast(message: string, type?: string): void;

type ThemeName = 'dark' | 'light' | 'high-contrast';

let previewedTheme: ThemeName | null = null;
const savedTheme: string = localStorage.getItem('fcm_theme') || '';

function getEl(id: string): HTMLElement | null { return document.getElementById(id); }

export function syncThemePreviewCards(theme: ThemeName): void {
  document.querySelectorAll<HTMLElement>('.theme-preview-card').forEach(c => {
    c.classList.remove('active');
    c.setAttribute('aria-checked', 'false');
  });
  const id = theme === 'light' ? 'preview-light' : theme === 'high-contrast' ? 'preview-high-contrast' : 'preview-dark';
  const el = getEl(id);
  if (el) { el.classList.add('active'); el.setAttribute('aria-checked', 'true'); }
}

export function toggleTheme(): void {
  const html = document.documentElement;
  const cur = html.getAttribute('data-theme');
  const next: ThemeName = cur === 'light' ? 'dark' : 'light';
  if (next === 'dark') html.removeAttribute('data-theme');
  else html.setAttribute('data-theme', next);
  localStorage.setItem('fcm_theme', next);
  const label = getEl('themeToggle')?.querySelector('span:first-child');
  if (label) label.textContent = next === 'light' ? '☀️' : '🌙';
  syncThemePreviewCards(next);
}

export function toggleHighContrast(): void {
  const html = document.documentElement;
  const t = getEl('hcToggle');
  if (html.getAttribute('data-theme') === 'high-contrast') {
    html.removeAttribute('data-theme');
    t?.classList.remove('active');
    t?.setAttribute('aria-checked', 'false');
    localStorage.setItem('fcm_theme', 'dark');
    syncThemePreviewCards('dark');
  } else {
    html.setAttribute('data-theme', 'high-contrast');
    t?.classList.add('active');
    t?.setAttribute('aria-checked', 'true');
    localStorage.setItem('fcm_theme', 'high-contrast');
    syncThemePreviewCards('high-contrast');
  }
}

export function previewTheme(theme: ThemeName): void {
  previewedTheme = theme;
  const html = document.documentElement;
  if (theme === 'dark') html.removeAttribute('data-theme');
  else html.setAttribute('data-theme', theme);
  syncThemePreviewCards(theme);
  const label = getEl('themeToggle')?.querySelector('span:first-child');
  if (label) label.textContent = theme === 'light' ? '☀️' : theme === 'high-contrast' ? '◐' : '🌙';
  announceToSR('Previewing ' + theme + ' theme');
}

export function applyPreviewedTheme(): void {
  if (!previewedTheme) { showToast('Select a theme', 'info'); return; }
  localStorage.setItem('fcm_theme', previewedTheme);
  showToast('Theme applied!', 'success');
  previewedTheme = null;
}

export function resetThemePreview(): void {
  const html = document.documentElement;
  if (savedTheme === 'dark' || !savedTheme) html.removeAttribute('data-theme');
  else html.setAttribute('data-theme', savedTheme);
  previewedTheme = null;
  syncThemePreviewCards((savedTheme as ThemeName) || 'dark');
}

export function toggleMotion(): void {
  const html = document.documentElement;
  const t = getEl('motionToggle2');
  if (html.getAttribute('data-motion') === 'reduced') {
    html.removeAttribute('data-motion');
    t?.classList.remove('active');
  } else {
    html.setAttribute('data-motion', 'reduced');
    t?.classList.add('active');
  }
}

export function setFontSize(size: string): void {
  if (size === 'default') document.documentElement.removeAttribute('data-font');
  else document.documentElement.setAttribute('data-font', size);
}
