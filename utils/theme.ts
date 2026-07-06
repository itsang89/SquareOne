export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'squareone_theme';

export function getStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'dark' || stored === 'light' || stored === 'system' ? stored : 'light';
}

export function applyTheme(theme: Theme): void {
  const body = document.body;
  body.classList.remove('dark', 'light');
  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    body.classList.add(isDark ? 'dark' : 'light');
  } else {
    body.classList.add(theme);
  }
  localStorage.setItem(STORAGE_KEY, theme);
}