import { FEATURE_TIER, isFeatureId, type FeatureId } from './features';
import { templateTier } from './templates';
import type { TemplateId } from './types';

/**
 * Хто що може зараз. Чиста логіка без браузера й Capacitor, тому її можна тестувати.
 * Зберігається окремим ключем `cvmaker.access` і НІКОЛИ не потрапляє в резервну копію.
 *
 * - `pro`: куплено PRO (виставляється покупкою в Google Play, Спринт 5).
 * - `proVerifiedAt`: коли востаннє звіряли PRO з Google Play (мс), або null.
 * - `credits`: переглянуті реклами, ще не обміняні на PDF. Кредит зникає лише після успішного PDF.
 * - `unlocks`: разові/тимчасові розблокування окремих функцій.
 */
export interface UnlockToken {
  feature: FeatureId;
  cvId?: string;
  /** Скільки використань лишилось; null = необмежено (поки діє expiresAt) */
  uses: number | null;
  /** Момент завершення (мс); null = без терміну */
  expiresAt: number | null;
}

export interface ProState {
  v: 2;
  pro: boolean;
  proVerifiedAt: number | null;
  credits: number;
  unlocks: UnlockToken[];
}

export const FREE_ACCESS: ProState = { v: 2, pro: false, proVerifiedAt: null, credits: 0, unlocks: [] };

const MAX_TOKENS = 50;

/* ---------- PDF ---------- */

export type ExportDecision = 'free' | 'premium' | 'credit' | 'needs-ad';

/** `gated`: чи в цій збірці завантаження взагалі блокується (Android з рекламою). Вимкнена реклама = усе доступне. */
export function decideExport(state: ProState, gated: boolean): ExportDecision {
  if (!gated) return 'free';
  if (state.pro) return 'premium';
  if (state.credits > 0) return 'credit';
  return 'needs-ad';
}

export function grantCredit(state: ProState, max: number): ProState {
  return { ...state, credits: Math.min(Math.max(0, max), state.credits + 1) };
}

export function consumeCredit(state: ProState): ProState {
  return state.credits > 0 ? { ...state, credits: state.credits - 1 } : state;
}

export function setPro(state: ProState, pro: boolean, now: number): ProState {
  return { ...state, pro, proVerifiedAt: pro ? now : null };
}

/* ---------- функції ---------- */

export type FeatureDecision = 'free' | 'pro' | 'token' | 'locked';

export interface FeatureCtx {
  /** Те саме, що `gated` у decideExport */
  gated: boolean;
  now: number;
  cvId?: string;
}

function tokenMatches(t: UnlockToken, feature: FeatureId, ctx: FeatureCtx): boolean {
  if (t.feature !== feature) return false;
  if (t.cvId !== undefined && t.cvId !== ctx.cvId) return false;
  if (t.uses !== null && t.uses <= 0) return false;
  if (t.expiresAt !== null && t.expiresAt <= ctx.now) return false;
  return true;
}

/** Чи можна користуватися функцією: безкоштовна, PRO, діючий токен або заблокована. */
export function decideFeature(state: ProState, feature: FeatureId, ctx: FeatureCtx): FeatureDecision {
  if (!ctx.gated || FEATURE_TIER[feature] === 'free') return 'free';
  if (state.pro) return 'pro';
  if (state.unlocks.some((t) => tokenMatches(t, feature, ctx))) return 'token';
  return 'locked';
}

/** Безкоштовний шаблон не потребує нічого, PRO-шаблон потребує функції `tpl_pro`. */
export function decideTemplate(state: ProState, tpl: TemplateId, ctx: FeatureCtx): FeatureDecision {
  return templateTier(tpl) === 'free' ? 'free' : decideFeature(state, 'tpl_pro', ctx);
}

export function grantToken(state: ProState, token: UnlockToken): ProState {
  return { ...state, unlocks: [...state.unlocks, token].slice(-MAX_TOKENS) };
}

/** Витрачає одне використання діючого токена. Токен без ліміту використань (uses = null) лишається. */
export function consumeToken(state: ProState, feature: FeatureId, ctx: FeatureCtx): ProState {
  const i = state.unlocks.findIndex((t) => tokenMatches(t, feature, ctx));
  if (i < 0) return state;
  const t = state.unlocks[i]!;
  if (t.uses === null) return state;
  const unlocks = state.unlocks.map((x, j) => (j === i ? { ...x, uses: t.uses! - 1 } : x)).filter((x) => x.uses === null || x.uses > 0);
  return { ...state, unlocks };
}

/** Прибирає використані й прострочені токени. */
export function pruneTokens(state: ProState, now: number): ProState {
  const unlocks = state.unlocks.filter((t) => (t.uses === null || t.uses > 0) && (t.expiresAt === null || t.expiresAt > now));
  return unlocks.length === state.unlocks.length ? state : { ...state, unlocks };
}

/* ---------- читання зі сховища ---------- */

function normalizeToken(raw: unknown): UnlockToken | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (!isFeatureId(o.feature)) return null;
  const uses = o.uses === null ? null : typeof o.uses === 'number' && Number.isInteger(o.uses) && o.uses > 0 ? o.uses : undefined;
  if (uses === undefined) return null;
  const expiresAt = o.expiresAt === null ? null : typeof o.expiresAt === 'number' && Number.isFinite(o.expiresAt) ? o.expiresAt : undefined;
  if (expiresAt === undefined) return null;
  return { feature: o.feature, ...(typeof o.cvId === 'string' ? { cvId: o.cvId } : {}), uses, expiresAt };
}

/**
 * Читання з будь-якого JSON. Усе, що виглядає неправильно, дає відсутність доступу, ніколи не помилку.
 * Старий формат v1 (`{ premium, credits }`) переноситься без втрат: premium стає pro.
 */
export function normalizeAccess(raw: unknown, max: number): ProState {
  if (typeof raw !== 'object' || raw === null) return FREE_ACCESS;
  const o = raw as Record<string, unknown>;
  const credits = typeof o.credits === 'number' && Number.isFinite(o.credits) ? Math.trunc(o.credits) : 0;
  const pro = o.v === 2 ? o.pro === true : o.premium === true;
  const verified = typeof o.proVerifiedAt === 'number' && Number.isFinite(o.proVerifiedAt) ? o.proVerifiedAt : null;
  const unlocks =
    o.v === 2 && Array.isArray(o.unlocks)
      ? o.unlocks.map(normalizeToken).filter((t): t is UnlockToken => t !== null).slice(-MAX_TOKENS)
      : [];
  return {
    v: 2,
    pro,
    proVerifiedAt: pro ? verified : null,
    credits: Math.min(Math.max(0, max), Math.max(0, credits)),
    unlocks,
  };
}
