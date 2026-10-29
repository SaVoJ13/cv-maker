import { useCallback, useEffect, useState } from 'react';
import { applyTheme, loadTheme, saveTheme, type ThemePref } from '../domain/theme';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function useTheme(): [ThemePref, (pref: ThemePref) => void] {
  const [pref, setPrefState] = useState<ThemePref>(() => loadTheme(storage()));
  useEffect(() => applyTheme(pref), [pref]);
  const setPref = useCallback((next: ThemePref) => {
    setPrefState(next);
    saveTheme(storage(), next);
  }, []);
  return [pref, setPref];
}
