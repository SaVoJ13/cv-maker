import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import type { Cv, UiLang } from '../domain/types';
import { blankCv, sampleCv } from '../domain/cvOps';
import { planImport } from '../domain/backup';
import { translate, type MsgKey } from '../domain/i18n';
import { browserStorage, loadState, saveState } from './persist';
import { reducer, type State } from './reducer';

interface Store {
  cvs: Cv[];
  ui: UiLang;
  currentId: string | null;
  current: Cv | null;
  t: (key: MsgKey) => string;
  setUi: (lang: UiLang) => void;
  select: (id: string | null) => void;
  create: (opts?: Partial<Pick<Cv, 'tpl' | 'accent'>>) => string;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  update: (id: string, mutate: (draft: Cv) => void) => void;
  /** Dodaje CV z kopii zapasowej; zwraca, ile dodano i ile pominięto jako duplikaty. */
  importCvs: (cvs: Cv[]) => { added: number; skipped: number };
}

const Ctx = createContext<Store | null>(null);

/** Stan zapisu w localStorage: „saving" w ciągu 250 ms po zmianie, „error" gdy przeglądarka odmówi zapisu (tryb prywatny, pełny limit). */
export type SaveStatus = 'saved' | 'saving' | 'error';
const SaveCtx = createContext<SaveStatus>('saved');

function initialState(): State {
  return loadState(browserStorage()) ?? { cvs: [sampleCv()], ui: 'pl', currentId: null };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  // Zapis z opóźnieniem, żeby nie serializować przy każdym naciśnięciu klawisza.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stateRef = useRef(state);
  stateRef.current = state;
  const dirty = useRef(false);
  const firstRun = useRef(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    setSaveStatus(saveState(browserStorage(), stateRef.current) ? 'saved' : 'error');
  }, []);

  useEffect(() => {
    dirty.current = true;
    if (!firstRun.current) setSaveStatus('saving');
    firstRun.current = false;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 250);
    return () => clearTimeout(timer.current);
  }, [state, flush]);

  // Zamknięcie karty lub aplikacji w ciągu 250 ms od ostatniej zmiany nie może zgubić zmian.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [flush]);

  const value = useMemo<Store>(() => {
    const t = (key: MsgKey) => translate(state.ui, key);
    return {
      cvs: state.cvs,
      ui: state.ui,
      currentId: state.currentId,
      current: state.cvs.find((c) => c.id === state.currentId) ?? null,
      t,
      setUi: (lang) => dispatch({ type: 'ui', lang }),
      select: (id) => dispatch({ type: 'select', id }),
      create: (opts) => {
        const cv = blankCv('pl', t('untitled'), opts);
        dispatch({ type: 'add', cv });
        return cv.id;
      },
      remove: (id) => dispatch({ type: 'remove', id }),
      duplicate: (id) => dispatch({ type: 'duplicate', id, copyLabel: t('copy') }),
      update: (id, mutate) => dispatch({ type: 'update', id, mutate }),
      importCvs: (cvs) => {
        const { toAdd, skipped } = planImport(state.cvs, cvs);
        dispatch({ type: 'addMany', cvs: toAdd });
        return { added: toAdd.length, skipped };
      },
    };
  }, [state]);

  return (
    <Ctx.Provider value={value}>
      <SaveCtx.Provider value={saveStatus}>{children}</SaveCtx.Provider>
    </Ctx.Provider>
  );
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore musi być użyty wewnątrz <StoreProvider>');
  return v;
}

export function useSaveStatus(): SaveStatus {
  return useContext(SaveCtx);
}

/** Wygodny skrót: funkcja aktualizująca jedno CV. */
export function useCvUpdater(id: string): (mutate: (draft: Cv) => void) => void {
  const { update } = useStore();
  return useCallback((mutate) => update(id, mutate), [update, id]);
}
