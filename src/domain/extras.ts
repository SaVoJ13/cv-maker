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

/** Додає або прибирає категорію; позначені йдуть у стандартному порядку, незнайомі (з даних) лишаються в кінці. */
export function toggleCategory(current: readonly string[], cat: string): string[] {
  const has = current.includes(cat);
  const next = has ? current.filter((c) => c !== cat) : [...current, cat];
  const rank = (c: string): number => {
    const i = (LICENCE_CATEGORIES as readonly string[]).indexOf(c);
    return i === -1 ? LICENCE_CATEGORIES.length : i;
  };
  return next
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .map((x) => x.c)
    .slice(0, EXTRAS_MAX_ITEMS);
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
