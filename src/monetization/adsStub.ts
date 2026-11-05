import { AdFailure, type AdsPort } from './adGateRunner';

/**
 * SYMULATOR REKLAM — TYLKO DLA DEWELOPERA (npm run dev). Nie trafia do kompilacji produkcyjnej
 * (importowany wyłącznie pod `import.meta.env.DEV`; skrypt check:prod szuka znacznika poniżej).
 *
 * Scenariusz z adresu: ?gate&adstub=ok,loadfail — wynik kolejnych ładowań reklamy (ostatni powtarza się):
 *   ok        reklama ładuje się i kończy z nagrodą
 *   early     reklama ładuje się, ale użytkownik zamyka ją przed końcem
 *   loadfail  błąd ładowania
 *   consent   brak zgody na reklamy
 *   showfail  ładuje się, ale nie wyświetla się
 *   slow      ładowanie nigdy się nie kończy (sprawdza tajmaut 8 s)
 */
export const STUB_ADS_MARKER = 'CVMAKER_STUB_ADS_DEV_ONLY';

export type StubOutcome = 'ok' | 'early' | 'loadfail' | 'consent' | 'showfail' | 'slow';
const OUTCOMES: readonly StubOutcome[] = ['ok', 'early', 'loadfail', 'consent', 'showfail', 'slow'];

export function parseStubScript(text: string | null): StubOutcome[] {
  const parts = (text ?? '').split(',').map((x) => x.trim()).filter((x): x is StubOutcome => (OUTCOMES as readonly string[]).includes(x));
  return parts.length ? parts : ['ok'];
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createStubAdsPort(script: StubOutcome[], delays = { load: 700, show: 1800 }): AdsPort {
  let n = 0;
  let current: StubOutcome = 'ok';
  return {
    async load() {
      current = script[Math.min(n, script.length - 1)];
      n += 1;
      if (current === 'slow') return new Promise<void>(() => {});
      await wait(delays.load);
      if (current === 'loadfail') throw new AdFailure('load', 'stub: load failed');
      if (current === 'consent') throw new AdFailure('consent', 'stub: no consent');
    },
    async show() {
      await wait(delays.show);
      if (current === 'showfail') throw new AdFailure('show', 'stub: show failed');
      return current === 'early' ? 'closed-early' : 'completed';
    },
  };
}

export function stubAdsPortFromUrl(): AdsPort {
  const script = parseStubScript(typeof location !== 'undefined' ? new URLSearchParams(location.search).get('adstub') : null);
  return createStubAdsPort(script);
}
