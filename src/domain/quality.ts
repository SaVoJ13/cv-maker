import type { Cv } from './types';
import { TEMPLATE_META } from './constants';
import { filledExperience, lines, list } from './cvOps';
import type { MsgKey } from './i18n';

export interface QualityCheck {
  key: MsgKey;
  ok: boolean;
}

/** Osiem prostych reguł, które rekruterzy i systemy ATS zauważają najczęściej. */
export function qualityChecks(cv: Cv, pages: number): QualityCheck[] {
  const d = cv.data;
  const exp = filledExperience(d);
  const bullets = exp.flatMap((e) => lines(e.bullets));
  const withNumbers = bullets.filter((b) => /\d/.test(b)).length;
  const summaryLen = d.summary.trim().length;

  return [
    { key: 'ck_contact', ok: Boolean(d.basics.email && d.basics.phone) },
    { key: 'ck_summary', ok: summaryLen >= 150 && summaryLen <= 600 },
    { key: 'ck_exp', ok: exp.length > 0 && exp.every((e) => lines(e.bullets).length >= 2) },
    { key: 'ck_dates', ok: exp.length > 0 && exp.every((e) => Boolean(e.from)) },
    { key: 'ck_metrics', ok: bullets.length > 0 && withNumbers / bullets.length >= 0.3 },
    { key: 'ck_skills', ok: list(d.skillsHard).length >= 5 },
    { key: 'ck_pages', ok: pages <= 2 },
    { key: 'ck_ats', ok: TEMPLATE_META[cv.tpl].atsSafe },
  ];
}
