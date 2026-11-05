/**
 * Рекламний потік перед експортом PDF як чистий скінченний автомат: `adGate(стан, подія) → стан`.
 * Без React, Capacitor, часу й мережі: час приходить подіями `TICK` (дельта монотонного годинника),
 * а побічні дії (завантажити/показати рекламу, зберегти прогрес, видати нагороду) описує `gateEffects`.
 *
 * Правила (рішення власника, D2):
 * - потрібні дві реклами підряд (rewarded);
 * - перша не завантажилась/не показалась: запасного варіанту немає, лише повтор або Pass;
 * - друга не завантажилась, не показалась, тайм-аут завантаження 8 с: відлік 20 с, потім нагорода;
 *   відлік не пропускається, на паузі коли застосунок у фоні, скидається при вивантаженні застосунку;
 * - користувач закрив рекламу достроково (без нагороди): нагороди немає; перша повторюється з нуля,
 *   друга повторюється сама, прогрес першої лишається;
 * - прогрес першої реклами живе 10 хв (це зберігає access.ts, див. `recordAd1`).
 */

/** Відлік запасного варіанту, мс. */
export const COUNTDOWN_MS = 20_000;
/** Скільки чекаємо завантаження реклами, мс. */
export const LOAD_TIMEOUT_MS = 8_000;
/** Один TICK враховується не більше, ніж на стільки мс: якщо таймери «заснули», відлік не перестрибує. */
export const MAX_TICK_MS = 2_000;

/** Чому реклама не пішла. `consent` — користувач не дав згоди на рекламу (UMP). */
export type AdFailReason = 'load' | 'timeout' | 'show' | 'consent';

export type GateState =
  | { kind: 'idle' }
  | { kind: 'loading1'; waitedMs: number; paused: boolean }
  | { kind: 'showing1' }
  | { kind: 'loading2'; waitedMs: number; paused: boolean }
  | { kind: 'showing2' }
  | { kind: 'countdown'; remainingMs: number; paused: boolean; reason: AdFailReason }
  | { kind: 'granted'; via: 'ad' | 'countdown' }
  | { kind: 'failed1'; reason: AdFailReason }
  | { kind: 'early1' }
  | { kind: 'early2' };

export type GateEvent =
  /** Користувач натиснув «Obejrzyj»; `ad1Done` — перша реклама вже переглянута (прогрес живий) */
  | { type: 'START'; ad1Done: boolean }
  /** Реклама завантажена й показується */
  | { type: 'LOADED' }
  | { type: 'LOAD_FAILED'; reason: AdFailReason }
  | { type: 'SHOW_FAILED' }
  /** Реклама переглянута до кінця: нагорода отримана, реклама закрита */
  | { type: 'AD_COMPLETED' }
  /** Користувач закрив рекламу достроково (без нагороди) */
  | { type: 'AD_CLOSED_EARLY' }
  /** Дельта монотонного годинника, мс */
  | { type: 'TICK'; ms: number }
  | { type: 'APP_BACKGROUND' }
  | { type: 'APP_FOREGROUND' }
  /** Застосунок вивантажили й відновили: усе скидається */
  | { type: 'APP_RESTORED' }
  | { type: 'RETRY' }
  /** Користувач закрив вікно (або нагорода використана) */
  | { type: 'CANCEL' };

export const GATE_IDLE: GateState = { kind: 'idle' };

const loading = (kind: 'loading1' | 'loading2'): GateState => ({ kind, waitedMs: 0, paused: false });
const countdown = (reason: AdFailReason): GateState => ({ kind: 'countdown', remainingMs: COUNTDOWN_MS, paused: false, reason });

/** Скільки мс з TICK реально враховуємо. */
const usable = (ms: number): number => (Number.isFinite(ms) && ms > 0 ? Math.min(ms, MAX_TICK_MS) : 0);

export function adGate(state: GateState, event: GateEvent): GateState {
  // події, що діють в усіх станах
  if (event.type === 'APP_RESTORED') return GATE_IDLE;
  if (event.type === 'CANCEL') return state.kind === 'idle' ? state : GATE_IDLE;

  switch (state.kind) {
    case 'idle':
      return event.type === 'START' ? (event.ad1Done ? loading('loading2') : loading('loading1')) : state;

    case 'loading1':
    case 'loading2': {
      const second = state.kind === 'loading2';
      switch (event.type) {
        case 'LOADED':
          return { kind: second ? 'showing2' : 'showing1' };
        case 'LOAD_FAILED':
          return second ? countdown(event.reason) : { kind: 'failed1', reason: event.reason };
        case 'APP_BACKGROUND':
          return { ...state, paused: true };
        case 'APP_FOREGROUND':
          return { ...state, paused: false };
        case 'TICK': {
          if (state.paused) return state;
          const waitedMs = state.waitedMs + usable(event.ms);
          if (waitedMs >= LOAD_TIMEOUT_MS) return second ? countdown('timeout') : { kind: 'failed1', reason: 'timeout' };
          return waitedMs === state.waitedMs ? state : { ...state, waitedMs };
        }
        default:
          return state;
      }
    }

    case 'showing1':
      if (event.type === 'AD_COMPLETED') return loading('loading2');
      if (event.type === 'AD_CLOSED_EARLY') return { kind: 'early1' };
      if (event.type === 'SHOW_FAILED') return { kind: 'failed1', reason: 'show' };
      return state;

    case 'showing2':
      if (event.type === 'AD_COMPLETED') return { kind: 'granted', via: 'ad' };
      if (event.type === 'AD_CLOSED_EARLY') return { kind: 'early2' };
      if (event.type === 'SHOW_FAILED') return countdown('show');
      return state;

    case 'countdown':
      // відлік не пропускається: єдині події, що рухають його, — TICK (і пауза/продовження)
      if (event.type === 'APP_BACKGROUND') return { ...state, paused: true };
      if (event.type === 'APP_FOREGROUND') return { ...state, paused: false };
      if (event.type === 'TICK' && !state.paused) {
        const remainingMs = state.remainingMs - usable(event.ms);
        if (remainingMs <= 0) return { kind: 'granted', via: 'countdown' };
        return remainingMs === state.remainingMs ? state : { ...state, remainingMs };
      }
      return state;

    case 'failed1':
      // запасного варіанту немає: лише повторна спроба (CANCEL вже оброблено вище)
      return event.type === 'RETRY' ? loading('loading1') : state;

    case 'early1':
      return event.type === 'RETRY' ? loading('loading1') : state;

    case 'early2':
      // прогрес першої реклами лишається: повторюється лише друга
      return event.type === 'RETRY' ? loading('loading2') : state;

    case 'granted':
      return state;
  }
}

/** Побічні дії, які треба виконати при переході `prev → next` (їх виконує хук у monetization/, не домен). */
export type GateEffect = 'load1' | 'load2' | 'show' | 'recordAd1' | 'grantReward';

export function gateEffects(prev: GateState, next: GateState): GateEffect[] {
  if (prev === next) return [];
  const out: GateEffect[] = [];
  // перша реклама дійсно переглянута: зберігаємо прогрес (10 хв). Повтор після дострокового закриття сюди не потрапляє.
  if (prev.kind === 'showing1' && next.kind === 'loading2') out.push('recordAd1');
  const enteredLoading1 = next.kind === 'loading1' && prev.kind !== 'loading1';
  const enteredLoading2 = next.kind === 'loading2' && prev.kind !== 'loading2';
  if (enteredLoading1) out.push('load1');
  if (enteredLoading2) out.push('load2');
  if ((next.kind === 'showing1' || next.kind === 'showing2') && prev.kind !== next.kind) out.push('show');
  if (next.kind === 'granted' && prev.kind !== 'granted') out.push('grantReward');
  return out;
}

/** Чи показувати користувачу відлік і скільки секунд лишилось (округлено вгору). */
export function countdownSeconds(state: GateState): number | null {
  return state.kind === 'countdown' ? Math.ceil(state.remainingMs / 1000) : null;
}
