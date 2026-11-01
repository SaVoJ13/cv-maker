import type { Cv, UiLang } from './types';
import { normalizeCv } from './cvOps';

/**
 * Версія формату збереженого стану (ключ `cvmaker.state`).
 * - v1: поля `schema` немає (усі збірки до Спринту 1).
 * - v2: `schema: 2`, у CV є `extras`, `photoShape`, `autoFit`.
 * Нові необов'язкові поля додаємо без підвищення версії; версію піднімаємо, лише коли міняється зміст наявних полів.
 */
export const CURRENT_SCHEMA = 2;

/** Мови інтерфейсу, які вміємо читати зі збереження. */
export const UI_LANGS: readonly UiLang[] = ['pl', 'uk', 'en'];

/** Стан у пам'яті застосунку. На диск пишеться разом з `schema`. */
export interface PersistedState {
  cvs: Cv[];
  ui: UiLang;
  currentId: string | null;
}

/** Версія сирого запису: без поля `schema` це v1. */
export function schemaOf(raw: unknown): number {
  if (typeof raw !== 'object' || raw === null) return 1;
  const v = (raw as Record<string, unknown>).schema;
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : 1;
}

/**
 * Читає сирий запис будь-якої версії й повертає актуальний стан.
 * Нічого не видаляє: невідомі/зламані поля CV виправляє `normalizeCv`, відсутні нові поля отримують значення за замовчуванням.
 * Запис з більшою версією (від новішого застосунку) читаємо так само обережно, як v2.
 */
export function migrateState(raw: unknown): PersistedState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.cvs)) return null;
  const cvs = o.cvs.map(normalizeCv).filter((c): c is Cv => c !== null);
  const ui = UI_LANGS.find((l) => l === o.ui) ?? 'pl';
  const currentId = typeof o.currentId === 'string' && cvs.some((c) => c.id === o.currentId) ? o.currentId : null;
  return { cvs, ui, currentId };
}

/** Рядок для запису на диск. `schema` іде першим: за цим префіксом дешево відрізняємо v2 від v1 без розбору JSON. */
export function serializeState(state: PersistedState): string {
  return JSON.stringify({ schema: CURRENT_SCHEMA, cvs: state.cvs, ui: state.ui, currentId: state.currentId });
}

export const SCHEMA_PREFIX = '{"schema":';
