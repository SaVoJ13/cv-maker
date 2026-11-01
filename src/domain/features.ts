import type { Cv, Tier } from './types';

/** Функції, які можуть бути доступні лише в PRO (або розблоковані токеном). */
export type FeatureId =
  | 'tpl_pro'
  | 'accent_extra'
  | 'photo_shape'
  | 'autofit'
  | 'qr'
  | 'phrases'
  | 'ats_scan'
  | 'cover_letter'
  | 'no_ads';

export const FEATURE_IDS: readonly FeatureId[] = [
  'tpl_pro',
  'accent_extra',
  'photo_shape',
  'autofit',
  'qr',
  'phrases',
  'ats_scan',
  'cover_letter',
  'no_ads',
];

/** Матриця «функція → рівень». Зміни тут вносити лише за згодою власника (docs/plan-pro.md). */
export const FEATURE_TIER: Readonly<Record<FeatureId, Tier>> = {
  tpl_pro: 'pro',
  accent_extra: 'pro',
  photo_shape: 'pro',
  autofit: 'pro',
  qr: 'pro',
  phrases: 'pro',
  ats_scan: 'pro',
  cover_letter: 'pro',
  no_ads: 'pro',
};

export function isFeatureId(v: unknown): v is FeatureId {
  return typeof v === 'string' && (FEATURE_IDS as readonly string[]).includes(v);
}

/** Ліміти безкоштовної версії. */
export const FREE_LIMITS = {
  /** Скільки власних CV можна мати у Free. Приклад (example) не рахується. */
  maxCvs: 2,
} as const;

/** Власні CV користувача (приклад у ліміт не входить). */
export function ownCvCount(cvs: readonly Pick<Cv, 'example'>[]): number {
  return cvs.filter((c) => !c.example).length;
}

/**
 * Чи можна створити або дублювати ще одне CV.
 * Старі CV понад ліміт не видаляються й лишаються доступними: ліміт блокує лише нові.
 */
export function canAddCv(cvs: readonly Pick<Cv, 'example'>[], pro: boolean): boolean {
  return pro || ownCvCount(cvs) < FREE_LIMITS.maxCvs;
}
