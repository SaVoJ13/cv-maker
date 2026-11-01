import { migrateState, SCHEMA_PREFIX, serializeState, type PersistedState } from '../domain/schema';

export type { PersistedState };

export const STORAGE_KEY = 'cvmaker.state';
/** Одноразова копія сирого v1-стану, зроблена перед першим записом у v2. */
export const SNAPSHOT_KEY = 'cvmaker.state.v1';

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'> & Partial<Pick<Storage, 'getItem'>>;

/** Wczytuje zapisany stan. Uszkodzone lub niedostępne dane to po prostu null. */
export function loadState(storage: ReadableStorage | null): PersistedState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return migrateState(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Перед першим записом у v2 зберігає сирий v1-запис окремим ключем (один раз).
 * Якщо місця немає або сховище недоступне, мовчки пропускає: зберігання CV важливіше за знімок.
 */
function snapshotV1(storage: WritableStorage): void {
  try {
    if (!storage.getItem) return;
    if (storage.getItem(SNAPSHOT_KEY) !== null) return;
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw || raw.startsWith(SCHEMA_PREFIX)) return;
    storage.setItem(SNAPSHOT_KEY, raw);
  } catch {
    /* brak miejsca: pomijamy */
  }
}

/** Zapisuje stan. Zwraca false, gdy zapis się nie udał (tryb prywatny, pełny limit). */
export function saveState(storage: WritableStorage | null, state: PersistedState): boolean {
  if (!storage) return false;
  try {
    snapshotV1(storage);
    storage.setItem(STORAGE_KEY, serializeState(state));
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
