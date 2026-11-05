/**
 * Єдине джерело правди про доступ до експорту PDF. Чиста логіка без браузера, Capacitor і мережі.
 * Зберігається окремим ключем `cvmaker.access` і НІКОЛИ не потрапляє в резервну копію.
 *
 * Модель (рішення власника, Sprint 5):
 * - усі шаблони й функції безкоштовні, ліміту CV немає; єдиний замок — експорт PDF;
 * - експорт = активний Pass (30 днів) АБО дві rewarded-реклами підряд;
 * - рівні `tier` у templates.ts і features.ts лишаються як дані на майбутнє, цей модуль їх не використовує.
 *
 * Час: усі функції отримують `now` (мс, epoch) параметром. Захист від переведення годинника:
 * `lastSeen` — найпізніший відомий час; якщо `now` помітно менший за нього, Pass і прогрес реклам
 * вважаються недійсними, поки час не наздожене.
 */

/** Скільки живе прогрес першої реклами й видана нагорода: 10 хвилин. */
export const AD_PROGRESS_TTL_MS = 10 * 60 * 1000;
/** Допуск на дрібні корекції годинника (синхронізація часу), мс. */
export const CLOCK_TOLERANCE_MS = 2 * 60 * 1000;
/** Тривалість Pass: 30 діб. */
export const PASS_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
/** Скільки реклам треба переглянути для одного експорту. */
export const ADS_PER_EXPORT = 2;

export interface AccessState {
  v: 3;
  /** Кінець дії Pass (мс), або null, якщо Pass не куплено */
  passUntil: number | null;
  /** Найпізніший відомий час (мс): основа захисту від відкату годинника */
  lastSeen: number;
  /** Коли завершилась перша реклама з пари (мс), або null */
  ad1At: number | null;
  /** Коли видано нагороду за пару реклам (мс), або null. Нагорода діє 10 хв і витрачається після успішного експорту. */
  rewardAt: number | null;
}

export const FREE_ACCESS: AccessState = { v: 3, passUntil: null, lastSeen: 0, ad1At: null, rewardAt: null };

/** Прапорці збірки, потрібні рішенню про експорт. */
export interface ExportFlags {
  /** Замок на експорті взагалі діє (у вебі й при розробці вимкнений) */
  gatingEnabled: boolean;
}

/**
 * - `free`: замка немає (gatingEnabled = false);
 * - `pass`: діє Pass, реклами не потрібні;
 * - `ads`: потрібен рекламний потік; `adsRequired` — скільки реклам лишилось переглянути:
 *   2 = жодної, 1 = перша вже є (до 10 хв), 0 = нагорода вже видана й діє (експорт дозволено).
 */
export interface ExportDecision {
  mode: 'free' | 'pass' | 'ads';
  adsRequired: number;
}

/* ---------- час ---------- */

/** Годинник відкотили назад відносно найпізнішого відомого часу. */
export function clockRolledBack(state: AccessState, now: number): boolean {
  return now < state.lastSeen - CLOCK_TOLERANCE_MS;
}

/** Запам'ятовує найпізніший відомий час. Назад не рухається (відкат годинника його не зменшує). */
export function touch(state: AccessState, now: number): AccessState {
  return now > state.lastSeen ? { ...state, lastSeen: now } : state;
}

/** Pass діє зараз: не прострочений і годинник не відкочено. */
export function passActive(state: AccessState, now: number): boolean {
  return state.passUntil !== null && !clockRolledBack(state, now) && now < state.passUntil;
}

/** Мітка часу (прогрес реклами, нагорода) ще жива: не з майбутнього, не старша за 10 хв, годинник не відкочено. */
function stampAlive(state: AccessState, stamp: number | null, now: number): boolean {
  return stamp !== null && !clockRolledBack(state, now) && now >= stamp && now - stamp <= AD_PROGRESS_TTL_MS;
}

export function rewardAlive(state: AccessState, now: number): boolean {
  return stampAlive(state, state.rewardAt, now);
}

export function ad1Alive(state: AccessState, now: number): boolean {
  return stampAlive(state, state.ad1At, now);
}

/* ---------- рішення про експорт ---------- */

export function canExport(state: AccessState, now: number, flags: ExportFlags): ExportDecision {
  if (!flags.gatingEnabled) return { mode: 'free', adsRequired: 0 };
  if (passActive(state, now)) return { mode: 'pass', adsRequired: 0 };
  if (rewardAlive(state, now)) return { mode: 'ads', adsRequired: 0 };
  if (ad1Alive(state, now)) return { mode: 'ads', adsRequired: ADS_PER_EXPORT - 1 };
  return { mode: 'ads', adsRequired: ADS_PER_EXPORT };
}

/* ---------- зміни стану ---------- */

/** Перша реклама з пари переглянута до кінця. */
export function recordAd1(state: AccessState, now: number): AccessState {
  return touch({ ...state, ad1At: now }, now);
}

/** Пара реклам (або друга реклама із запасним відліком) завершена: видаємо нагороду на 10 хв. Прогрес першої реклами очищається. */
export function grantReward(state: AccessState, now: number): AccessState {
  return touch({ ...state, ad1At: null, rewardAt: now }, now);
}

/** Експорт завершився успішно (PDF створено й збережено): нагорода витрачена. З Pass нагорода не чіпається. */
export function consumeReward(state: AccessState): AccessState {
  return state.rewardAt === null ? state : { ...state, rewardAt: null };
}

/** Pass куплено або відновлено: діє до `until`. Якщо вже діє довший Pass, він не вкорочується. */
export function setPass(state: AccessState, until: number, now: number): AccessState {
  const keep = state.passUntil !== null && state.passUntil > until ? state.passUntil : until;
  return touch({ ...state, passUntil: keep }, now);
}

/** Pass більше не діє (повернення коштів, не знайдено в магазині). */
export function clearPass(state: AccessState): AccessState {
  return state.passUntil === null ? state : { ...state, passUntil: null };
}

/* ---------- читання зі сховища ---------- */

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

/**
 * Читання з будь-якого JSON. Усе, що виглядає неправильно, дає відсутність доступу, ніколи не помилку.
 * Старі формати v1 (`premium`, `credits`) і v2 (`pro`, `credits`, `unlocks`) НЕ переносяться: вони
 * існували лише в тестових збірках, оплаченого доступу в них не було, а нова модель (Pass, дві реклами)
 * інша. Дані CV цей ключ не стосується.
 */
export function normalizeAccess(raw: unknown): AccessState {
  if (typeof raw !== 'object' || raw === null) return FREE_ACCESS;
  const o = raw as Record<string, unknown>;
  if (o.v !== 3) return FREE_ACCESS;
  const lastSeen = num(o.lastSeen) ?? 0;
  const stamps = [num(o.passUntil), num(o.ad1At), num(o.rewardAt)];
  // мітки часу не з майбутнього відносно lastSeen: інакше піднімаємо lastSeen, щоб не вийшло «вічного» доступу
  const seen = Math.max(lastSeen, num(o.ad1At) ?? 0, num(o.rewardAt) ?? 0);
  return { v: 3, passUntil: stamps[0], lastSeen: seen, ad1At: stamps[1], rewardAt: stamps[2] };
}
