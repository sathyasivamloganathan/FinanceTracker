// Dark-mode helper. The server stores the preference; we also cache it in
// localStorage so the very first paint (see the inline script in layout.jsx)
// already has the right theme — no flash of light mode.
export const THEME_KEY = 'vantage-theme';

export function applyTheme(dark) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', !!dark);
  try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch { /* storage unavailable */ }
}
