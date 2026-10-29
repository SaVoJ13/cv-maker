import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../store/StoreProvider';
import { Icon } from './Icon';

export type ToastKind = 'ok' | 'error';
type Notify = (msg: string, ms?: number, kind?: ToastKind) => void;

const Ctx = createContext<Notify>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useStore();
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = useCallback<Notify>((msg, ms = 3200, kind = 'ok') => {
    setToast({ msg, kind });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), ms);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <Ctx.Provider value={notify}>
      {children}
      <div className="toast-region" role={toast?.kind === 'error' ? 'alert' : 'status'} aria-live={toast?.kind === 'error' ? 'assertive' : 'polite'}>
        {toast ? (
          <div className={`toast ${toast.kind}`} key={toast.msg}>
            <Icon name={toast.kind === 'error' ? 'alert' : 'check'} size={18} />
            <span>{toast.msg}</span>
            <button type="button" className="toast-x" aria-label={t('close')} onClick={() => setToast(null)}>
              <Icon name="x" size={16} />
            </button>
          </div>
        ) : null}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): Notify {
  return useContext(Ctx);
}
