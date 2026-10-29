import { useCallback, useEffect, useState } from 'react';
import { consumeCredit, decideExport, grantCredit, type AccessState, type ExportDecision } from '../domain/access';
import { browserStorage } from '../store/persist';
import { loadAccess, saveAccess } from '../store/accessPersist';
import { adsActive } from './ads';
import { MONETIZATION } from './config';

export interface ExportGate {
  /** Co trzeba zrobić przed pobraniem PDF (nic, wykorzystać kredyt albo obejrzeć reklamę). */
  decide: () => ExportDecision;
  grant: () => void;
  consume: () => void;
}

export function useExportGate(): ExportGate {
  const [access, setAccess] = useState<AccessState>(() => loadAccess(browserStorage(), MONETIZATION.maxCredits));
  useEffect(() => saveAccess(browserStorage(), access), [access]);
  const decide = useCallback(() => decideExport(access, adsActive()), [access]);
  const grant = useCallback(() => setAccess((s) => grantCredit(s, MONETIZATION.maxCredits)), []);
  const consume = useCallback(() => setAccess(consumeCredit), []);
  return { decide, grant, consume };
}
