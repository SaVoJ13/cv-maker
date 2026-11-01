import type { Cv, UiLang } from '../domain/types';
import { normalizeCv } from '../domain/cvOps';

export const STORAGE_KEY = 'cvmaker.state';

export interface PersistedState {
  cvs: Cv[];
  ui: UiLang;
  currentId: string | null;
}

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

/** Wczytuje zapisany stan. Uszkodzone lub niedostępne dane to po prostu null. */
export function loadState(storage: ReadableStorage | null): PersistedState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const o = parsed as Record<string, unknown>;
    if (!Array.isArray(o.cvs)) return null;
    const cvs = o.cvs.map(normalizeCv).filter((c): c is Cv => c !== null);
    const ui: UiLang = o.ui === 'en' ? 'en' : 'pl';
    const currentId = typeof o.currentId === 'string' && cvs.some((c) => c.id === o.currentId) ? o.currentId : null;
    return { cvs, ui, currentId };
  } catch {
    return null;
  }
}

/** Zapisuje stan. Zwraca false, gdy zapis się nie udał (tryb prywatny, pełny limit). */
export function saveState(storage: WritableStorage | null, state: PersistedState): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
