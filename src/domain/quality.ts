import type { Cv } from './types';
import { TEMPLATE_META } from './templates';
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

/* ---------- поради рекрутера (м'які підказки, не помилки) ---------- */

export type RecruiterTipId = 'phone_code' | 'metrics_where' | 'law_22_1';

export interface RecruiterTip {
  id: RecruiterTipId;
  /** warn — варто виправити; info — довідка */
  tone: 'warn' | 'info';
  /** Для metrics_where: місця досвіду, де немає жодної цифри */
  places?: { index: number; role: string; company: string }[];
}

/** Є код країни: +<код> або 00<код> (на початку, дужки й пробіли допускаються). */
export function phoneHasCountryCode(phone: string): boolean {
  return /^[\s(]*(\+|00)\s*\(?\d/.test(String(phone ?? ''));
}

/**
 * Поради, яких немає в `qualityChecks`:
 * - телефон без коду країни (будь-який код +<код> вважається нормальним, не лише +48);
 * - місця в досвіді, де немає жодної цифри (без вигадування чисел: лише показуємо, де їх бракує);
 * - довідка про art. 22¹ Kodeksu pracy (завжди; обов'язково з підписом «не юридична порада» в інтерфейсі).
 */
export function recruiterTips(cv: Cv): RecruiterTip[] {
  const d = cv.data;
  const tips: RecruiterTip[] = [];

  if (d.basics.phone.trim() && !phoneHasCountryCode(d.basics.phone)) {
    tips.push({ id: 'phone_code', tone: 'warn' });
  }

  const places = filledExperience(d)
    .map((e, index) => ({ e, index }))
    .filter(({ e }) => {
      const b = lines(e.bullets);
      return b.length > 0 && !b.some((x) => /\d/.test(x));
    })
    .map(({ e, index }) => ({ index, role: e.role.trim(), company: e.company.trim() }));
  if (places.length > 0) tips.push({ id: 'metrics_where', tone: 'warn', places });

  tips.push({ id: 'law_22_1', tone: 'info' });
  return tips;
}
