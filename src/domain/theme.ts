export type ThemePref = 'system' | 'light' | 'dark';
export const THEME_KEY = 'cvmaker.theme';
export const THEME_PREFS: readonly ThemePref[] = ['system', 'light', 'dark'];

/** Każda nieznana wartość to „system" (motyw urządzenia). */
export function normalizeTheme(raw: unknown): ThemePref {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem' | 'removeItem'>;

export function loadTheme(storage: ReadableStorage | null): ThemePref {
  if (!storage) return 'system';
  try {
    return normalizeTheme(storage.getItem(THEME_KEY));
  } catch {
    return 'system';
  }
}

export function saveTheme(storage: WritableStorage | null, pref: ThemePref): boolean {
  if (!storage) return false;
  try {
    if (pref === 'system') storage.removeItem(THEME_KEY);
    else storage.setItem(THEME_KEY, pref);
    return true;
  } catch {
    return false;
  }
}

/** Ustawia atrybut na <html>; „system" go usuwa i motyw wraca do prefers-color-scheme. */
export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
}
