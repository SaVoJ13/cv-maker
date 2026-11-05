import { useCallback, useEffect, useState } from 'react';
import { canExport, consumeReward, grantReward, touch, type AccessState, type ExportDecision } from '../domain/access';
import { browserStorage } from '../store/persist';
import { loadAccess, saveAccess } from '../store/accessPersist';
import { gateActive } from './ads';

export interface ExportGate {
  /** Co trzeba zrobić przed pobraniem PDF: nic, Pass albo reklamy (ile jeszcze). */
  decide: () => ExportDecision;
  /** Nagroda za reklamy przyznana (ważna 10 minut). */
  grant: () => void;
  /** PDF utworzony i zapisany: nagroda wykorzystana. */
  consume: () => void;
}

export function useExportGate(): ExportGate {
  const [access, setAccess] = useState<AccessState>(() => touch(loadAccess(browserStorage()), Date.now()));
  useEffect(() => saveAccess(browserStorage(), access), [access]);
  const decide = useCallback(() => canExport(access, Date.now(), { gatingEnabled: gateActive() }), [access]);
  const grant = useCallback(() => setAccess((s) => grantReward(s, Date.now())), []);
  const consume = useCallback(() => setAccess((s) => touch(consumeReward(s), Date.now())), []);
  return { decide, grant, consume };
}
