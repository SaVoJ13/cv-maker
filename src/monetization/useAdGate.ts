import { useCallback, useEffect, useRef, useState } from 'react';
import { GATE_IDLE, type GateState } from '../domain/adGate';
import { AdGateRunner, type AdsPort } from './adGateRunner';
import { createAdsPort } from './ads';

export interface AdGateOptions {
  /** Перша реклама вже зарахована (прогрес живий, до 10 хв) */
  ad1Done: boolean;
  onAd1Rewarded: () => void;
  onGranted: () => void;
  /** Порт реклам; за замовчуванням AdMob / симулятор розробника */
  port?: AdsPort;
}

export interface AdGate {
  state: GateState;
  start: () => void;
  retry: () => void;
  cancel: () => void;
}

/**
 * Рекламний потік у React: обгортка над AdGateRunner. Таймери — монотонний годинник (performance.now),
 * пауза/продовження — за станом застосунку (@capacitor/app: у браузері це visibilitychange).
 */
export function useAdGate(options: AdGateOptions): AdGate {
  const [state, setState] = useState<GateState>(GATE_IDLE);
  const opts = useRef(options);
  opts.current = options;
  const runner = useRef<AdGateRunner | null>(null);

  if (runner.current === null) {
    runner.current = new AdGateRunner({
      port: options.port ?? createAdsPort(),
      now: () => performance.now(),
      every: (fn, ms) => {
        const id = setInterval(fn, ms);
        return () => clearInterval(id);
      },
      onState: setState,
      onAd1Rewarded: () => opts.current.onAd1Rewarded(),
      onGranted: () => opts.current.onGranted(),
    });
  }

  useEffect(() => {
    const r = runner.current!;
    let remove: (() => void) | null = null;
    let disposed = false;
    void import('@capacitor/app').then(async ({ App }) => {
      const handle = await App.addListener('appStateChange', ({ isActive }) => (isActive ? r.appForeground() : r.appBackground()));
      if (disposed) void handle.remove();
      else remove = () => void handle.remove();
    });
    return () => {
      disposed = true;
      remove?.();
      r.dispose();
    };
  }, []);

  const start = useCallback(() => runner.current!.start(opts.current.ad1Done), []);
  const retry = useCallback(() => runner.current!.retry(), []);
  const cancel = useCallback(() => runner.current!.cancel(), []);
  return { state, start, retry, cancel };
}
