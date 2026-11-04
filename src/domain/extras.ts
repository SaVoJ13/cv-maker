import type { CvExtras } from './types';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Ліміти вільних полів: довгий текст не повинен ламати макет у прев'ю й PDF. Діють і в редакторі, і в normalizeCv. */
export const EXTRAS_MAX_VALUE = 80;
export const EXTRAS_MAX_ITEMS = 8;

/** Обрізає до ліміту за символами (не розриває сурогатні пари). */
export function clampValue(s: string, max = EXTRAS_MAX_VALUE): string {
  const chars = Array.from(s);
  return chars.length > max ? chars.slice(0, max).join('') : s;
}

const str = (v: unknown): string => (typeof v === 'string' ? clampValue(v) : '');
const strs = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, EXTRAS_MAX_ITEMS).map((x) => clampValue(x)) : [];

type Driver = NonNullable<CvExtras['driver']>;

/** Категорії прав, які пропонує редактор (у цьому порядку й друкуються). Інші значення з даних теж зберігаються. */
export const LICENCE_CATEGORIES = ['B', 'BE', 'C1', 'C', 'C1E', 'CE', 'D', 'DE'] as const;

export function emptyDriver(): Driver {
  return { categories: [], code95: false, tachograph: false, adr: false, udt: false, fleet: '', routes: [] };
}

/** Методи зварювання, які пропонує редактор (у цьому порядку й друкуються). */
export const WELDING_METHODS = ['MIG', 'MAG', 'TIG', 'MMA'] as const;

type Tech = NonNullable<CvExtras['tech']>;

export function emptyTech(): Tech {
  return { sep: '', welding: [], cnc: '', drawings: false, bhp: false, certs: [] };
}

/** Додає або прибирає значення; позначені йдуть у заданому порядку, незнайомі (з даних) лишаються в кінці. */
function toggleOrdered(current: readonly string[], item: string, order: readonly string[]): string[] {
  const has = current.includes(item);
  const next = has ? current.filter((c) => c !== item) : [...current, item];
  const rank = (c: string): number => {
    const i = order.indexOf(c);
    return i === -1 ? order.length : i;
  };
  return next
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .map((x) => x.c)
    .slice(0, EXTRAS_MAX_ITEMS);
}

/** Категорії прав: стандартний порядок. */
export const toggleCategory = (current: readonly string[], cat: string): string[] => toggleOrdered(current, cat, LICENCE_CATEGORIES);

/** Методи зварювання: MIG, MAG, TIG, MMA. */
export const toggleWelding = (current: readonly string[], method: string): string[] => toggleOrdered(current, method, WELDING_METHODS);

/** Курси й проєкти (поле courses): не більше 8 рядків, кожен до 80 символів. Порожні рядки лишаються (щоб Enter у кінці не зникав). */
export function clampLines(text: string): string {
  return text.split(/\r?\n/).slice(0, EXTRAS_MAX_ITEMS).map((x) => clampValue(x)).join('\n');
}

/** Текст «по рядку на запис» → список: не більше 8 записів, кожен до 80 символів. Порожні рядки лишаються (щоб Enter у кінці не зникав). */
export function certsFromText(text: string): string[] {
  return text.split(/\r?\n/).slice(0, EXTRAS_MAX_ITEMS).map((x) => clampValue(x));
}

/** Приводить будь-який JSON до безпечного CvExtras. Відсутні блоки лишаються відсутніми. */
export function normalizeExtras(raw: unknown): CvExtras {
  const out: CvExtras = {};
  if (!isObj(raw)) return out;
  if (isObj(raw.driver)) {
    const d = raw.driver;
    out.driver = {
      categories: strs(d.categories),
      code95: d.code95 === true,
      tachograph: d.tachograph === true,
      adr: d.adr === true,
      udt: d.udt === true,
      fleet: str(d.fleet),
      routes: Array.isArray(d.routes) ? d.routes.filter((r): r is 'PL' | 'UE' => r === 'PL' || r === 'UE').slice(0, 2) : [],
    };
  }
  if (isObj(raw.tech)) {
    const t = raw.tech;
    out.tech = {
      sep: str(t.sep),
      welding: strs(t.welding),
      cnc: str(t.cnc),
      drawings: t.drawings === true,
      bhp: t.bhp === true,
      certs: strs(t.certs),
    };
  }
  if (isObj(raw.qr)) {
    const q = raw.qr;
    out.qr = { enabled: q.enabled === true, url: String(typeof q.url === 'string' ? q.url : ''), label: String(typeof q.label === 'string' ? q.label : '') };
  }
  return out;
}
