import { GATE_IDLE, adGate, gateEffects, type AdFailReason, type GateEffect, type GateEvent, type GateState } from '../domain/adGate';

/**
 * Виконавець автомата adGate: перекладає ефекти (`gateEffects`) у виклики рекламного порту й
 * підміняє час тіками монотонного годинника. Без React і Capacitor: порт, годинник і планувальник
 * передаються ззовні, тож усе перевіряється тестами з підставними реалізаціями.
 */

/** Помилка порту з причиною, яку розуміє автомат. */
export class AdFailure extends Error {
  constructor(
    readonly reason: AdFailReason,
    message?: string,
  ) {
    super(message ?? `ad failure: ${reason}`);
    this.name = 'AdFailure';
  }
}

/** Що вміє рекламна мережа (AdMob або заглушка розробника). Мережеві виклики лише тут, не в domain. */
export interface AdsPort {
  /** Завантажує рекламу; відхиляється AdFailure('load' | 'consent') */
  load(): Promise<void>;
  /** Показує завантажену рекламу: 'completed' лише коли нагороду отримано, 'closed-early' — закрили без неї; збій показу відхиляє AdFailure('show') */
  show(): Promise<'completed' | 'closed-early'>;
}

export interface RunnerDeps {
  port: AdsPort;
  /** Монотонний годинник, мс (performance.now) */
  now: () => number;
  /** Запускає періодичний виклик; повертає функцію зупинки */
  every: (fn: () => void, ms: number) => () => void;
  onState: (state: GateState) => void;
  /** Перша реклама з пари переглянута: зберегти прогрес (10 хв) */
  onAd1Rewarded: () => void;
  /** Нагорода видана (дві реклами або запасний відлік) */
  onGranted: () => void;
}

/** Інтервал тіків годинника, мс. */
export const TICK_INTERVAL_MS = 250;

const classify = (e: unknown): AdFailReason => (e instanceof AdFailure ? e.reason : 'load');

export class AdGateRunner {
  private state: GateState = GATE_IDLE;
  private attempt = 0;
  private stopTicker: (() => void) | null = null;
  private lastTick = 0;

  constructor(private readonly deps: RunnerDeps) {}

  get current(): GateState {
    return this.state;
  }

  /** `ad1Done`: перша реклама вже зарахована (прогрес живий). */
  start(ad1Done: boolean): void {
    this.send({ type: 'START', ad1Done });
  }

  retry(): void {
    this.send({ type: 'RETRY' });
  }

  cancel(): void {
    this.send({ type: 'CANCEL' });
  }

  appBackground(): void {
    this.send({ type: 'APP_BACKGROUND' });
  }

  appForeground(): void {
    this.lastTick = this.deps.now(); // час у фоні не рахуємо: наступний тік почнеться з нуля
    this.send({ type: 'APP_FOREGROUND' });
  }

  appRestored(): void {
    this.send({ type: 'APP_RESTORED' });
  }

  /** Подія автомата (також для тестів). */
  send(event: GateEvent): void {
    const prev = this.state;
    const next = adGate(prev, event);
    if (next === prev) return;
    this.state = next;
    this.deps.onState(next);
    for (const effect of gateEffects(prev, next)) this.run(effect);
    this.syncTicker();
  }

  private run(effect: GateEffect): void {
    switch (effect) {
      case 'load1':
      case 'load2': {
        const token = ++this.attempt;
        this.deps.port.load().then(
          () => this.ifCurrent(token, { type: 'LOADED' }),
          (e: unknown) => this.ifCurrent(token, { type: 'LOAD_FAILED', reason: classify(e) }),
        );
        break;
      }
      case 'show': {
        const token = ++this.attempt;
        this.deps.port.show().then(
          (r) => this.ifCurrent(token, r === 'completed' ? { type: 'AD_COMPLETED' } : { type: 'AD_CLOSED_EARLY' }),
          () => this.ifCurrent(token, { type: 'SHOW_FAILED' }),
        );
        break;
      }
      case 'recordAd1':
        this.deps.onAd1Rewarded();
        break;
      case 'grantReward':
        this.deps.onGranted();
        break;
    }
  }

  /** Результат застарілої спроби (після повтору, скасування чи нового запуску) ігноруємо. */
  private ifCurrent(token: number, event: GateEvent): void {
    if (token === this.attempt) this.send(event);
  }

  /** Тіки потрібні лише під час очікування завантаження й відліку. */
  private syncTicker(): void {
    const needs = this.state.kind === 'loading1' || this.state.kind === 'loading2' || this.state.kind === 'countdown';
    if (needs && !this.stopTicker) {
      this.lastTick = this.deps.now();
      this.stopTicker = this.deps.every(() => {
        const now = this.deps.now();
        const ms = now - this.lastTick;
        this.lastTick = now;
        this.send({ type: 'TICK', ms });
      }, TICK_INTERVAL_MS);
    } else if (!needs && this.stopTicker) {
      this.stopTicker();
      this.stopTicker = null;
    }
  }

  /** Зупиняє таймер (розмонтування вікна). Стан скидається, спроби, що ще тривають, ігноруються. */
  dispose(): void {
    this.attempt += 1;
    this.stopTicker?.();
    this.stopTicker = null;
    this.state = GATE_IDLE;
  }
}
