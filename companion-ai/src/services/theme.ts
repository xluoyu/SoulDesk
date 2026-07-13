import { getSettings } from './tauriBridge';

type ThemeMode = 'dark' | 'light' | 'system';

function applyTheme(mode: ThemeMode) {
  let resolved: 'dark' | 'light';

  if (mode === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } else {
    resolved = mode;
  }

  document.documentElement.setAttribute('data-theme', resolved);
  return resolved;
}

export function applyRoleTheme(color: string) {
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--bg-bubble-user', color);
}

export async function initTheme(): Promise<'dark' | 'light'> {
  try {
    const settings = await getSettings();
    const mode = (settings.general?.theme_mode as ThemeMode) || 'dark';
    const resolved = applyTheme(mode);

    if (mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', () => applyTheme('system'));
    }

    return resolved;
  } catch {
    return applyTheme('dark');
  }
}

export function setThemeMode(mode: ThemeMode) {
  const resolved = applyTheme(mode);
  return resolved;
}
