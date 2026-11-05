import type { AdFailReason, GateState } from '../domain/adGate';
import { COUNTDOWN_MS } from '../domain/adGate';

/** Що показує вікно експорту для стану автомата (чиста функція, тестується окремо від React). */
export type GatePhase = 'intro' | 'loading' | 'showing' | 'countdown' | 'failed' | 'early' | 'granted';

export interface GateView {
  phase: GatePhase;
  /** Яка реклама з двох (1 або 2) */
  adIndex: 1 | 2;
  /** Секунд до кінця відліку (вгору), лише для countdown */
  seconds: number | null;
  /** Відлік на паузі (застосунок у фоні) */
  paused: boolean;
  /** Прогрес відліку 0..1 */
  progress: number;
  /** Причина збою першої реклами (failed) */
  reason: AdFailReason | null;
  /** Чи можна запропонувати повтор */
  canRetry: boolean;
}

export function gateView(state: GateState, ad1Done: boolean): GateView {
  const base: GateView = { phase: 'intro', adIndex: ad1Done ? 2 : 1, seconds: null, paused: false, progress: 0, reason: null, canRetry: false };
  switch (state.kind) {
    case 'idle':
      return base;
    case 'loading1':
      return { ...base, phase: 'loading', adIndex: 1, paused: state.paused };
    case 'loading2':
      return { ...base, phase: 'loading', adIndex: 2, paused: state.paused };
    case 'showing1':
      return { ...base, phase: 'showing', adIndex: 1 };
    case 'showing2':
      return { ...base, phase: 'showing', adIndex: 2 };
    case 'countdown':
      return {
        ...base,
        phase: 'countdown',
        adIndex: 2,
        seconds: Math.ceil(state.remainingMs / 1000),
        paused: state.paused,
        progress: Math.min(1, Math.max(0, 1 - state.remainingMs / COUNTDOWN_MS)),
      };
    case 'failed1':
      return { ...base, phase: 'failed', adIndex: 1, reason: state.reason, canRetry: true };
    case 'early1':
      return { ...base, phase: 'early', adIndex: 1, canRetry: true };
    case 'early2':
      return { ...base, phase: 'early', adIndex: 2, canRetry: true };
    case 'granted':
      return { ...base, phase: 'granted', adIndex: 2, progress: 1 };
  }
}
