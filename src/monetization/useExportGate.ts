import { useCallback, useEffect, useRef, useState } from 'react';
import { canExport, consumeReward, grantPass, grantReward, passActive, recordAd1, touch, type AccessState, type ExportDecision } from '../domain/access';
import { browserStorage } from '../store/persist';
import { loadAccess, saveAccess } from '../store/accessPersist';
import { gateActive } from './ads';
import { billingAvailable, getBilling } from './billing';
import type { Redeem } from './billingPlay';
import { MONETIZATION } from './config';

export interface ExportGate {
  /** Co trzeba zrobić przed pobraniem PDF: nic, Pass albo reklamy (ile jeszcze). */
  decide: () => ExportDecision;
  /** Pierwsza reklama z pary obejrzana (postęp ważny 10 minut). */
  ad1: () => void;
  /**
   * Przyznaje Pass za zakup o podanych identyfikatorach. Zapis do pamięci następuje SYNCHRONICZNIE
   * (zanim token zakupu zostanie zużyty). Zwraca true, gdy Pass przyznano teraz; false, gdy zakup już był policzony.
   */
  activatePass: Redeem;
  /** Odbiera niedokończone zakupy Pass (start aplikacji, przed eksportem). Zwraca, ile razy przyznano Pass. */
  restorePurchases: () => Promise<number>;
  /** Koniec ważności aktywnego Pass albo null. */
  passUntil: () => number | null;
  /** Nagroda za reklamy przyznana (ważna 10 minut). */
  grant: () => void;
  /** PDF utworzony i zapisany: nagroda wykorzystana. */
  consume: () => void;
}

export function useExportGate(): ExportGate {
  const [access, setAccess] = useState<AccessState>(() => touch(loadAccess(browserStorage()), Date.now()));
  // Aktualny stan zawsze też w ref: zakup może nadejść między renderami, a zapis musi być natychmiastowy.
  const ref = useRef(access);

  /** Zmienia stan i od razu zapisuje go w localStorage (bez czekania na render). */
  const commit = useCallback((fn: (s: AccessState) => AccessState): AccessState => {
    const prev = ref.current;
    const next = fn(prev);
    if (next !== prev) {
      ref.current = next;
      saveAccess(browserStorage(), next);
      setAccess(next);
    }
    return prev;
  }, []);

  useEffect(() => saveAccess(browserStorage(), access), [access]);

  const decide = useCallback(() => canExport(ref.current, Date.now(), { gatingEnabled: gateActive() }), [access]);
  const ad1 = useCallback(() => void commit((s) => recordAd1(s, Date.now())), [commit]);
  const grant = useCallback(() => void commit((s) => grantReward(s, Date.now())), [commit]);
  const consume = useCallback(() => void commit((s) => touch(consumeReward(s), Date.now())), [commit]);
  const passUntil = useCallback(() => (passActive(ref.current, Date.now()) ? ref.current.passUntil : null), [access]);

  const activatePass = useCallback<Redeem>(
    (ids) => {
      const before = commit((s) => grantPass(s, Date.now(), MONETIZATION.passDays, ids));
      return ref.current !== before;
    },
    [commit],
  );

  const restoring = useRef<Promise<number> | null>(null);
  const restorePurchases = useCallback(async () => {
    if (!gateActive() || !billingAvailable()) return 0;
    if (restoring.current) return restoring.current;
    const run = getBilling()
      .restore(activatePass)
      .catch((e: unknown) => {
        console.warn(e); // немає мережі чи Google Play: спробуємо наступного разу
        return 0;
      })
      .finally(() => {
        restoring.current = null;
      });
    restoring.current = run;
    return run;
  }, [activatePass]);

  // Старт застосунку: покупка могла бути оплачена, а застосунок закрився до запису Pass.
  useEffect(() => {
    void restorePurchases();
  }, [restorePurchases]);

  return { decide, ad1, activatePass, restorePurchases, passUntil, grant, consume };
}
