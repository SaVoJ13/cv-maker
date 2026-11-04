import type {
  AccentId,
  Basics,
  Cv,
  CvData,
  DensityId,
  Education,
  Experience,
  LanguageSkill,
  LangLevel,
  DocLang,
  PhotoShape,
  RodoMode,
  TemplateId,
} from './types';
import { PHOTO_DEFAULT, normalizePhotoView } from './photo';
import { ACCENTS, DENSITY, LEVELS } from './constants';
import { LEGACY_TEMPLATES, SIDEBAR, TEMPLATES, TEMPLATE_META } from './templates';
import { normalizeExtras } from './extras';
import { DOC, rodoText, type DocStrings } from './docText';

/* ---------- małe narzędzia ---------- */

export function uid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  const raw =
    c && typeof c.randomUUID === 'function'
      ? c.randomUUID().replace(/-/g, '')
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return raw.slice(0, 8);
}

/** Dzieli tekst na punkty (jedna linia = jeden punkt), usuwa znaczniki list. */
export function lines(s: string): string[] {
  return String(s || '')
    .split(/\r?\n/)
    .map((x) => x.replace(/^[\s•\-–*]+/, '').trim())
    .filter(Boolean);
}

/** Dzieli listę rozdzieloną przecinkami, średnikami lub enterami. */
export function list(s: string): string[] {
  return String(s || '')
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Klucz do sortowania dat „MM.RRRR" lub „RRRR". 0 = brak daty. */
export function dateKey(s: string): number {
  const m = String(s || '').match(/(\d{1,2})[./-](\d{4})/);
  if (m) return Number(m[2]) * 12 + Number(m[1]);
  const y = String(s || '').match(/(\d{4})/);
  return y ? Number(y[1]) * 12 + 6 : 0;
}

export function dateRange(e: { from: string; to: string; current?: boolean }, L: DocStrings): string {
  const from = e.from || '';
  const to = e.current ? L.present : e.to || '';
  if (!from && !to) return '';
  if (!from) return to;
  if (!to) return from;
  return `${from} – ${to}`;
}

export function levelLabel(level: LangLevel, L: DocStrings): string {
  return level === 'native' ? L.native : level;
}

/* ---------- listy z identyfikatorami ---------- */

export function moveItem<T extends { id: string }>(items: T[], id: string, dir: -1 | 1): T[] {
  const i = items.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= items.length) return items;
  const next = items.slice();
  const tmp = next[i] as T;
  next[i] = next[j] as T;
  next[j] = tmp;
  return next;
}

export function removeItem<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((x) => x.id !== id);
}

/** Od najnowszego: trwające stanowiska na górze, potem po dacie zakończenia i rozpoczęcia. */
export function sortExperience(items: Experience[]): Experience[] {
  const end = (e: Experience) => (e.current ? Number.MAX_SAFE_INTEGER : dateKey(e.to));
  return items.slice().sort((a, b) => {
    const ea = end(a);
    const eb = end(b);
    if (ea !== eb) return eb > ea ? 1 : -1;
    return dateKey(b.from) - dateKey(a.from);
  });
}

/* ---------- fabryki ---------- */

export function newExperience(): Experience {
  return { id: uid(), role: '', company: '', city: '', from: '', to: '', current: false, bullets: '' };
}
export function newEducation(): Education {
  return { id: uid(), school: '', degree: '', field: '', from: '', to: '' };
}
export function newLanguage(): LanguageSkill {
  return { id: uid(), name: '', level: 'B2' };
}

export function emptyBasics(): Basics {
  return {
    name: '',
    title: '',
    email: '',
    phone: '',
    city: '',
    link: '',
    address: '',
    birthDate: '',
    birthPlace: '',
    license: '',
    photo: '',
    photoX: PHOTO_DEFAULT.x,
    photoY: PHOTO_DEFAULT.y,
    photoZoom: PHOTO_DEFAULT.zoom,
    photoSize: PHOTO_DEFAULT.size,
    photoShape: 'circle',
  };
}

export function blankCv(lang: DocLang = 'pl', name = '', opts: Partial<Pick<Cv, 'tpl' | 'accent'>> = {}): Cv {
  return {
    id: uid(),
    name,
    updated: Date.now(),
    lang,
    tpl: opts.tpl ?? 'classic',
    accent: opts.accent ?? 'navy',
    density: 'normal',
    rodo: 'current',
    rodoTarget: '',
    autoFit: false,
    example: false,
    data: {
      basics: emptyBasics(),
      summary: '',
      experience: [newExperience()],
      education: [newEducation()],
      skillsHard: '',
      skillsSoft: '',
      languages: [],
      interests: '',
      courses: '',
      extras: {},
    },
  };
}

/** Neutralna sylwetka zamiast prawdziwego zdjęcia w przykładowym CV. */
const SAMPLE_PHOTO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">' +
      '<rect width="400" height="500" fill="#cfd8e3"/>' +
      '<circle cx="200" cy="190" r="78" fill="#8a9bb0"/>' +
      '<path d="M60 500c0-110 62-170 140-170s140 60 140 170z" fill="#8a9bb0"/></svg>',
  );

/** Przykładowe CV na pulpicie. Wszystkie dane są zmyślone. */
export function sampleCv(): Cv {
  const c = blankCv('pl', 'Frontend Developer – przykład');
  c.example = true;
  c.tpl = 'modern';
  c.data = {
    basics: {
      name: 'Anna Kowalska',
      title: 'Frontend Developer',
      email: 'anna.kowalska@example.com',
      phone: '+48 600 100 200',
      city: 'Warszawa',
      link: 'linkedin.com/in/anna-kowalska-example',
      address: '',
      birthDate: '',
      birthPlace: '',
      license: 'B',
      photo: SAMPLE_PHOTO,
      photoX: PHOTO_DEFAULT.x,
      photoY: PHOTO_DEFAULT.y,
      photoZoom: PHOTO_DEFAULT.zoom,
      photoSize: PHOTO_DEFAULT.size,
      photoShape: 'circle',
    },
    summary:
      'Frontend Developer z 4-letnim doświadczeniem w budowie aplikacji w React i TypeScript dla e-commerce i fintechu. Skracam czas ładowania stron i upraszczam proces zakupowy, co przekłada się na wzrost konwersji. Szukam zespołu, w którym mogę rozwijać design system i dbać o dostępność.',
    experience: [
      {
        id: uid(),
        role: 'Frontend Developer',
        company: 'Nova Commerce Sp. z o.o.',
        city: 'Warszawa',
        from: '03.2023',
        to: '',
        current: true,
        bullets: [
          'Przepisanie koszyka i procesu płatności na React i TypeScript, co zwiększyło konwersję o 12%',
          'Skrócenie czasu ładowania strony głównej z 4,1 s do 1,8 s dzięki code splittingowi i optymalizacji obrazów',
          'Wdrożenie biblioteki komponentów używanej przez 5 zespołów produktowych',
          'Prowadzenie code review i mentoring 2 młodszych programistów',
        ].join('\n'),
      },
      {
        id: uid(),
        role: 'Junior Frontend Developer',
        company: 'Pixelhaus Studio',
        city: 'Kraków',
        from: '07.2021',
        to: '02.2023',
        current: false,
        bullets: [
          'Realizacja 14 serwisów internetowych dla klientów z sektora MŚP w HTML, SCSS i JavaScript',
          'Integracja REST API oraz płatności online',
          'Poprawa dostępności serwisów do poziomu WCAG 2.1 AA',
        ].join('\n'),
      },
    ],
    education: [
      { id: uid(), school: 'Politechnika Warszawska', degree: 'Inżynier', field: 'Informatyka', from: '2017', to: '2021' },
    ],
    skillsHard: 'React, TypeScript, JavaScript (ES6+), HTML5, CSS/SCSS, Next.js, Jest, Git, REST API, Figma',
    skillsSoft: 'Komunikacja w zespole, Rozwiązywanie problemów, Zarządzanie czasem, Mentoring',
    languages: [
      { id: uid(), name: 'Polski', level: 'native' },
      { id: uid(), name: 'Angielski', level: 'C1' },
      { id: uid(), name: 'Niemiecki', level: 'A2' },
    ],
    interests: 'Bieganie, fotografia, wolontariat w fundacji uczącej programowania dzieci',
    courses: '',
    // демо-дані для шаблону Kierowca (друкуються лише в ньому): галерея й порожній попередній перегляд показують блок з дозволами
    extras: {
      driver: { categories: ['B', 'C', 'CE'], code95: true, tachograph: true, adr: false, udt: false, fleet: 'Ciągnik siodłowy z naczepą', routes: ['PL', 'UE'] },
    },
  };
  return c;
}

export function duplicateCv(src: Cv, copyLabel: string): Cv {
  const cp = structuredClone(src);
  cp.id = uid();
  cp.example = false;
  cp.name = `${src.name || ''} (${copyLabel})`.trim();
  cp.updated = Date.now();
  for (const e of cp.data.experience) e.id = uid();
  for (const e of cp.data.education) e.id = uid();
  for (const l of cp.data.languages) l.id = uid();
  return cp;
}

/* ---------- normalizacja danych z localStorage ---------- */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], d: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : d;
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(isObj) : []);

/**
 * Odbudowuje poprawne CV z dowolnego JSON-a (stare wersje, ręczna edycja).
 * Zwraca null, gdy to nie jest obiekt.
 */
export function normalizeCv(raw: unknown): Cv | null {
  if (!isObj(raw)) return null;
  const base = blankCv(oneOf(raw.lang, ['pl', 'en'] as const, 'pl'));
  const d = isObj(raw.data) ? raw.data : {};
  const b = isObj(d.basics) ? d.basics : {};
  const data: CvData = {
    basics: {
      name: str(b.name),
      title: str(b.title),
      email: str(b.email),
      phone: str(b.phone),
      city: str(b.city),
      link: str(b.link),
      address: str(b.address),
      birthDate: str(b.birthDate),
      birthPlace: str(b.birthPlace),
      license: str(b.license),
      photo: typeof b.photo === 'string' && b.photo.startsWith('data:image/') ? b.photo : '',
      ...(() => {
        const v = normalizePhotoView(b);
        return { photoX: v.x, photoY: v.y, photoZoom: v.zoom, photoSize: v.size };
      })(),
      photoShape: oneOf<PhotoShape>(b.photoShape, ['square', 'rounded', 'circle'] as const, 'circle'),
    },
    summary: str(d.summary),
    experience: arr(d.experience).map((e) => ({
      id: str(e.id) || uid(),
      role: str(e.role),
      company: str(e.company),
      city: str(e.city),
      from: str(e.from),
      to: str(e.to),
      current: e.current === true,
      bullets: str(e.bullets),
    })),
    education: arr(d.education).map((e) => ({
      id: str(e.id) || uid(),
      school: str(e.school),
      degree: str(e.degree),
      field: str(e.field),
      from: str(e.from),
      to: str(e.to),
    })),
    skillsHard: str(d.skillsHard),
    skillsSoft: str(d.skillsSoft),
    languages: arr(d.languages).map((l) => ({
      id: str(l.id) || uid(),
      name: str(l.name),
      level: oneOf<LangLevel>(l.level, LEVELS, 'B2'),
    })),
    interests: str(d.interests),
    courses: str(d.courses),
    extras: normalizeExtras(d.extras),
  };
  return {
    id: str(raw.id) || base.id,
    name: str(raw.name),
    updated: typeof raw.updated === 'number' && Number.isFinite(raw.updated) ? raw.updated : Date.now(),
    lang: base.lang,
    tpl: oneOf<TemplateId>(typeof raw.tpl === 'string' ? (LEGACY_TEMPLATES[raw.tpl] ?? raw.tpl) : raw.tpl, TEMPLATES, 'classic'),
    accent: oneOf<AccentId>(raw.accent, Object.keys(ACCENTS) as AccentId[], 'navy'),
    density: oneOf<DensityId>(raw.density, Object.keys(DENSITY) as DensityId[], 'normal'),
    rodo: oneOf<RodoMode>(raw.rodo, ['current', 'future'] as const, 'current'),
    rodoTarget: str(raw.rodoTarget),
    autoFit: raw.autoFit === true,
    example: raw.example === true,
    data,
  };
}

/* ---------- pomocnicze zapytania o CV ---------- */

/** Stanowiska, które mają jakąkolwiek treść (puste szablony pomijamy w dokumencie). */
export function filledExperience(d: CvData): Experience[] {
  return d.experience.filter((e) => e.role || e.company || lines(e.bullets).length);
}
export function filledEducation(d: CvData): Education[] {
  return d.education.filter((e) => e.school || e.degree || e.field);
}
export function filledLanguages(d: CvData): LanguageSkill[] {
  return d.languages.filter((l) => l.name);
}

export function hasContent(cv: Cv): boolean {
  const d = cv.data;
  return Boolean(
    d.summary.trim() || d.experience.some((e) => e.role || lines(e.bullets).length) || list(d.skillsHard).length,
  );
}

export function docStrings(cv: Pick<Cv, 'lang'>): DocStrings {
  return DOC[cv.lang];
}

/* ---------- zdjęcie i dane dodatkowe ---------- */

/** Czy dokument faktycznie pokazuje zdjęcie (szablon je obsługuje i zdjęcie jest dodane). */
export function showsPhoto(cv: Pick<Cv, 'tpl' | 'data'>): boolean {
  return TEMPLATE_META[cv.tpl].photo && cv.data.basics.photo !== '';
}

/** Klauzula RODO dla tego dokumentu; przy zdjęciu obejmuje wizerunek. */
export function documentClause(cv: Cv): string {
  return rodoText(cv, showsPhoto(cv));
}

export interface DetailRow {
  label: string;
  value: string;
}

/** Dobrowolne dane dodatkowe (adres, data i miejsce urodzenia, prawo jazdy), tylko wypełnione. */
export function extraDetails(b: Basics, L: DocStrings): DetailRow[] {
  const rows: DetailRow[] = [
    { label: L.address, value: b.address },
    { label: L.birthDate, value: b.birthDate },
    { label: L.birthPlace, value: b.birthPlace },
    { label: L.license, value: b.license },
  ];
  return rows.filter((r) => r.value.trim() !== '');
}

/** Wiersze bloku „Dane osobowe" w szablonie z panelem bocznym, w stałej kolejności. */
export function sidebarRows(b: Basics, L: DocStrings): DetailRow[] {
  const rows: DetailRow[] = [
    { label: L.address, value: [b.address, b.city].filter((x) => x.trim()).join(', ') },
    { label: L.phone, value: b.phone },
    { label: L.email, value: b.email },
    { label: L.link, value: b.link },
    { label: L.birthDate, value: b.birthDate },
    { label: L.birthPlace, value: b.birthPlace },
    { label: L.license, value: b.license },
  ];
  return rows.filter((r) => r.value.trim() !== '');
}

/* ---------- paski boczne (dwie kolumny) ---------- */

export interface SideBlock {
  title: string;
  kind: 'rows' | 'langs' | 'list';
  rows: { label: string; value: string }[];
  langs: { name: string; level: string }[];
  items: string[];
}

/** Które z sekcji „Umiejętności”, „Języki”, „Zainteresowania” zostają w głównej kolumnie. */
export function mainHas(tpl: TemplateId): { skills: boolean; langs: boolean; interests: boolean } {
  if (!SIDEBAR[tpl]) return { skills: true, langs: true, interests: true };
  if (tpl === 'panel') return { skills: true, langs: false, interests: false };
  if (tpl === 'creative') return { skills: false, langs: false, interests: true };
  return { skills: false, langs: false, interests: false };
}

/** Zawartość paska bocznego danego szablonu (puste bloki są pomijane). */
export function sideBlocks(cv: Pick<Cv, 'tpl' | 'data'>, L: DocStrings): SideBlock[] {
  if (!SIDEBAR[cv.tpl]) return [];
  const d = cv.data;
  const blocks: SideBlock[] = [];
  const rows = sidebarRows(d.basics, L);
  if (rows.length) blocks.push({ title: L.personal, kind: 'rows', rows, langs: [], items: [] });
  const skills = [...list(d.skillsHard), ...list(d.skillsSoft)];
  if (!mainHas(cv.tpl).skills && skills.length) blocks.push({ title: L.skills, kind: 'list', rows: [], langs: [], items: skills });
  const langs = filledLanguages(d).map((l) => ({ name: l.name, level: levelLabel(l.level, L) }));
  if (langs.length) blocks.push({ title: L.lang, kind: 'langs', rows: [], langs, items: [] });
  const hobbies = list(d.interests);
  if (!mainHas(cv.tpl).interests && hobbies.length) blocks.push({ title: L.interests, kind: 'list', rows: [], langs: [], items: hobbies });
  return blocks;
}
