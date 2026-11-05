import { FREE_ACCESS, normalizeAccess, type AccessState } from '../domain/access';

export const ACCESS_KEY = 'cvmaker.access';

export function loadAccess(storage: Pick<Storage, 'getItem'> | null): AccessState {
  if (!storage) return FREE_ACCESS;
  try {
    const raw = storage.getItem(ACCESS_KEY);
    return raw ? normalizeAccess(JSON.parse(raw)) : FREE_ACCESS;
  } catch {
    return FREE_ACCESS;
  }
}

export function saveAccess(storage: Pick<Storage, 'setItem'> | null, state: AccessState): void {
  try {
    storage?.setItem(ACCESS_KEY, JSON.stringify(state));
  } catch {
    /* brak miejsca lub tryb prywatny: stan zostaje tylko w pamięci */
  }
}
