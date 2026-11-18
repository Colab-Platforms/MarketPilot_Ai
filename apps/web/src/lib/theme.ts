export const THEME_STORAGE_KEY = 'mp-theme';

export type ThemeName = 'light' | 'dark';

/**
 * Runs in <head> before first paint so the page never flashes the wrong theme.
 * A saved choice wins; otherwise the system preference is followed live.
 */
export const themeInitScript = `(function(){try{var k='${THEME_STORAGE_KEY}';var m=window.matchMedia('(prefers-color-scheme: dark)');var r=document.documentElement;function a(){var s=null;try{s=localStorage.getItem(k)}catch(e){}var t=s==='light'||s==='dark'?s:(m.matches?'dark':'light');r.setAttribute('data-theme',t);r.style.colorScheme=t}a();m.addEventListener('change',a);window.addEventListener('storage',a)}catch(e){}})();`;

export function applyTheme(theme: ThemeName): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked (private mode); the choice then lasts for this page only.
  }
}

export function toggleTheme(): void {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}
