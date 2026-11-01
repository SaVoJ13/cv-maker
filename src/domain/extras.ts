import type { CvExtras } from './types';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

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
      routes: strs(d.routes).filter((r): r is 'PL' | 'UE' => r === 'PL' || r === 'UE'),
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
    out.qr = { enabled: q.enabled === true, url: str(q.url), label: str(q.label) };
  }
  return out;
}
