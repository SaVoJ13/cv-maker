import type { Cv, CvData, DocLang } from './types';
import { EXTRAS_DOC } from './docText';
import { lines } from './cvOps';

/**
 * Що саме друкується в документі з додаткових даних (`extras`, `courses`) для поточного шаблону.
 * Прев'ю (HTML) і PDF беруть блоки звідси, тому вони завжди збігаються. ATS-сканер, `isBlank`
 * і повнота теж рахують лише те, що друкується. Самі дані ніколи не змінюються й не видаляються:
 * при зміні шаблону блок просто з'являється або зникає.
 */

export type ExtrasBlockId = 'driver' | 'tech' | 'courses';

/**
 * Які блоки показує шаблон. Ключ — id шаблону; шаблони, яких тут немає, жодного блоку не показують.
 * Шаблони driver, trades і student підключаються в `templates.ts` у кроках 2–4 Спринту 3b.
 */
export const TEMPLATE_BLOCKS: Readonly<Record<string, readonly ExtrasBlockId[]>> = {
  driver: ['driver'],
  trades: ['tech'],
  student: ['courses'],
};

export function templateBlocks(tpl: string): readonly ExtrasBlockId[] {
  return TEMPLATE_BLOCKS[tpl] ?? [];
}

/** Рядок «підпис: значення» у документі. */
export interface ViewRow {
  label: string;
  value: string;
}

export interface RowsBlock {
  title: string;
  rows: ViewRow[];
}

export interface LinesBlock {
  title: string;
  /** Один рядок = один пункт списку (як пункти досвіду) */
  lines: string[];
}

/** Блок дорівнює null, коли шаблон його не показує або друкувати нічого. */
export interface ExtrasView {
  driver: RowsBlock | null;
  tech: RowsBlock | null;
  courses: LinesBlock | null;
}

/** Роздільник пунктів в одному рядку. */
export const JOIN = ' · ';

const clean = (s: string): string => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Прибирає порожні та повторні (без урахування регістру) значення, порядок зберігає. */
function unique(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const v = clean(raw);
    const k = v.toLowerCase();
    if (v && !seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  }
  return out;
}

function rowsBlock(title: string, candidates: ViewRow[]): RowsBlock | null {
  const rows = candidates.filter((r) => r.value);
  return rows.length ? { title, rows } : null;
}

function driverBlock(d: CvData, lang: DocLang): RowsBlock | null {
  const x = d.extras?.driver;
  if (!x) return null;
  const T = EXTRAS_DOC[lang];
  const permits = [x.code95 && T.code95, x.tachograph && T.driverCard, x.adr && T.adr, x.udt && T.udt].filter((v): v is string => Boolean(v));
  // порядок маршрутів фіксований (PL, потім UE), навіть якщо в даних інакше
  const routes = [x.routes.includes('PL') && T.routePL, x.routes.includes('UE') && T.routeEU].filter((v): v is string => Boolean(v));
  return rowsBlock(T.driverTitle, [
    { label: T.licCategories, value: unique(x.categories).join(JOIN) },
    { label: T.permits, value: permits.join(JOIN) },
    { label: T.fleet, value: clean(x.fleet) },
    { label: T.routes, value: routes.join(JOIN) },
  ]);
}

function techBlock(d: CvData, lang: DocLang): RowsBlock | null {
  const x = d.extras?.tech;
  if (!x) return null;
  const T = EXTRAS_DOC[lang];
  const also = [x.drawings && T.drawings, x.bhp && T.bhp].filter((v): v is string => Boolean(v));
  return rowsBlock(T.techTitle, [
    { label: T.sep, value: clean(x.sep) },
    { label: T.welding, value: unique(x.welding).join(JOIN) },
    { label: T.cnc, value: clean(x.cnc) },
    { label: T.alsoTech, value: also.join(JOIN) },
    { label: T.certs, value: unique(x.certs).join(JOIN) },
  ]);
}

function coursesBlock(d: CvData, lang: DocLang): LinesBlock | null {
  const items = lines(d.courses);
  return items.length ? { title: EXTRAS_DOC[lang].coursesTitle, lines: items } : null;
}

/** Блоки, які реально друкуються для цього CV (шаблон + мова документа). */
export function extrasView(cv: Pick<Cv, 'lang' | 'data'> & { tpl: string }): ExtrasView {
  const shown = new Set(templateBlocks(cv.tpl));
  return {
    driver: shown.has('driver') ? driverBlock(cv.data, cv.lang) : null,
    tech: shown.has('tech') ? techBlock(cv.data, cv.lang) : null,
    courses: shown.has('courses') ? coursesBlock(cv.data, cv.lang) : null,
  };
}

/** Чи друкується хоч один блок. */
export function hasPrintedExtras(cv: Pick<Cv, 'lang' | 'data'> & { tpl: string }): boolean {
  const v = extrasView(cv);
  return Boolean(v.driver || v.tech || v.courses);
}

/** Чи друкується конкретний блок (для крапок «заповнено» у редакторі). */
export function extrasBlockFilled(cv: Pick<Cv, 'lang' | 'data'> & { tpl: string }, id: ExtrasBlockId): boolean {
  return extrasView(cv)[id] !== null;
}

/** Увесь друкований текст блоків (підписи й значення) для пошуку слів ATS-сканером. */
export function printedExtrasText(cv: Pick<Cv, 'lang' | 'data'> & { tpl: string }): string {
  const v = extrasView(cv);
  const out: string[] = [];
  for (const b of [v.driver, v.tech]) if (b) out.push(...b.rows.map((r) => `${r.label}: ${r.value}`));
  if (v.courses) out.push(...v.courses.lines);
  return out.join('\n');
}
