/**
 * Kto może teraz pobrać PDF. Czysta logika bez przeglądarki i Capacitora, więc da się ją testować.
 *
 * - `premium`: kupione „bez reklam” (ustawiane później przez zakup w Google Play).
 * - `credits`: obejrzane reklamy, które nie zostały jeszcze zamienione na pobranie PDF.
 *   Kredyt znika dopiero po udanym utworzeniu PDF, więc błąd eksportu nie kosztuje reklamy.
 */
export interface AccessState {
  premium: boolean;
  credits: number;
}

export const FREE_ACCESS: AccessState = { premium: false, credits: 0 };

export type ExportDecision = 'free' | 'premium' | 'credit' | 'needs-ad';

/** `gated`: czy w tej wersji aplikacji pobieranie jest w ogóle blokowane (Android z reklamami). */
export function decideExport(state: AccessState, gated: boolean): ExportDecision {
  if (!gated) return 'free';
  if (state.premium) return 'premium';
  if (state.credits > 0) return 'credit';
  return 'needs-ad';
}

export function grantCredit(state: AccessState, max: number): AccessState {
  return { ...state, credits: Math.min(Math.max(0, max), state.credits + 1) };
}

export function consumeCredit(state: AccessState): AccessState {
  return state.credits > 0 ? { ...state, credits: state.credits - 1 } : state;
}

/** Odczyt z dowolnego JSON-a: wszystko, co nie wygląda poprawnie, daje brak dostępu, nigdy błąd. */
export function normalizeAccess(raw: unknown, max: number): AccessState {
  if (typeof raw !== 'object' || raw === null) return FREE_ACCESS;
  const o = raw as Record<string, unknown>;
  const credits = typeof o.credits === 'number' && Number.isFinite(o.credits) ? Math.trunc(o.credits) : 0;
  return { premium: o.premium === true, credits: Math.min(Math.max(0, max), Math.max(0, credits)) };
}
